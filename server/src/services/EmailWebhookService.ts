// src/services/EmailWebhookService.ts
// Processes verified Resend webhook events: logs each one, advances OutboundEmail status,
// and suppresses addresses that hard-bounce or complain.

import { EmailStatus, Prisma } from '@prisma/client';
import prisma from '../db';
import * as EmailService from './EmailService';
import * as SubscriberService from './SubscriberService';

export interface ResendEvent {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    to?: string[];
    subject?: string;
    bounce?: { type: string; subType: string; message: string };
    failed?: { reason: string };
    suppressed?: { type: string; message: string };
  };
}

const STATUS_BY_EVENT: Record<string, EmailStatus> = {
  'email.sent': EmailStatus.SENT,
  'email.delivery_delayed': EmailStatus.DELAYED,
  'email.delivered': EmailStatus.DELIVERED,
  'email.bounced': EmailStatus.BOUNCED,
  'email.failed': EmailStatus.FAILED,
  'email.suppressed': EmailStatus.SUPPRESSED,
  'email.complained': EmailStatus.COMPLAINED,
};

// Events can arrive out of order — never move a row backwards (e.g. delivered → sent)
const RANK: Record<EmailStatus, number> = {
  QUEUED: 0,
  SENT: 1,
  DELAYED: 2,
  DELIVERED: 3,
  FAILED: 4,
  SUPPRESSED: 4,
  BOUNCED: 4,
  COMPLAINED: 5,
};

export type HandleResult = 'processed' | 'duplicate' | 'ignored';

export async function handleEvent(svixId: string, event: ResendEvent): Promise<HandleResult> {
  const resendId = event.data?.email_id ?? null;

  try {
    await prisma.emailEvent.create({
      data: {
        svixId,
        type: event.type,
        resendId,
        payload: event as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return 'duplicate';
    throw err;
  }

  const nextStatus = STATUS_BY_EVENT[event.type];
  if (!nextStatus || !resendId) return 'ignored';

  const row = await prisma.outboundEmail.findUnique({ where: { resendId } });
  const recipient = (row?.toEmail ?? event.data.to?.[0] ?? '').toLowerCase();

  if (row && RANK[nextStatus] >= RANK[row.status]) {
    const error =
      event.data.bounce ? `${event.data.bounce.type}/${event.data.bounce.subType}: ${event.data.bounce.message}`
      : event.data.failed ? event.data.failed.reason
      : event.data.suppressed ? `${event.data.suppressed.type}: ${event.data.suppressed.message}`
      : undefined;
    await prisma.outboundEmail.update({
      where: { id: row.id },
      data: { status: nextStatus, ...(error ? { error } : {}) },
    });
  }

  if (!recipient) return 'processed';

  if (event.type === 'email.bounced' && event.data.bounce?.type === 'Permanent') {
    await EmailService.suppress(recipient, 'bounce');
    EmailService.notifyAdmin({
      type: 'Deliverability',
      title: `Hard bounce — ${recipient}`,
      rows: [
        ['Recipient', recipient],
        ['Subject', event.data.subject ?? row?.subject ?? ''],
        ['Reason', event.data.bounce.message],
      ],
      body: 'This address is now suppressed and will not be emailed again.',
    });
  }

  if (event.type === 'email.complained') {
    await EmailService.suppress(recipient, 'complaint');
    await SubscriberService.deactivateByEmail(recipient);
    EmailService.notifyAdmin({
      type: 'Deliverability',
      title: `Spam complaint — ${recipient}`,
      rows: [
        ['Recipient', recipient],
        ['Subject', event.data.subject ?? row?.subject ?? ''],
      ],
      body: 'The recipient marked an email as spam. They have been unsubscribed and suppressed.',
    });
  }

  return 'processed';
}
