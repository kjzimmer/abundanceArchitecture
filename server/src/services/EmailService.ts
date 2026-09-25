// src/services/EmailService.ts
// Single entry point for all outbound email. Every send is recorded in OutboundEmail.
// EMAIL_MODE: live (Resend) | log (console only, default) | redirect (Resend, all mail to EMAIL_REDIRECT_TO)

import { Resend } from 'resend';
import { EmailKind, EmailStatus, OutboundEmail } from '@prisma/client';
import prisma from '../db';
import { emailFrom, emailNotifyFrom, emailMode, adminNotifyEmail } from '../lib/email/config';
import { adminNotice, NoticeInput, RenderedEmail } from '../lib/email/templates';

let resendClient: Resend | null = null;

export function getResend(): Resend {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    resendClient = new Resend(key);
  }
  return resendClient;
}

export interface SendInput extends RenderedEmail {
  to: string;
  kind: EmailKind;
  personId?: string | null;
  from?: string; // defaults to EMAIL_FROM
  replyTo?: string;
  headers?: Record<string, string>;
  newsletterIssueId?: string;
  conversationId?: string;
}

export async function isSuppressed(email: string): Promise<boolean> {
  const row = await prisma.emailSuppression.findUnique({ where: { email: email.toLowerCase() } });
  return !!row;
}

export async function suppress(email: string, reason: 'bounce' | 'complaint' | 'manual') {
  const normalized = email.toLowerCase();
  return prisma.emailSuppression.upsert({
    where: { email: normalized },
    update: { reason },
    create: { email: normalized, reason },
  });
}

/** True if an email of this kind went to this address within the window — used to throttle repeats. */
export async function sentRecently(email: string, kind: EmailKind, withinMs: number): Promise<boolean> {
  const count = await prisma.outboundEmail.count({
    where: {
      toEmail: email.toLowerCase(),
      kind,
      status: { notIn: [EmailStatus.FAILED, EmailStatus.SUPPRESSED] },
      createdAt: { gte: new Date(Date.now() - withinMs) },
    },
  });
  return count > 0;
}

/**
 * Records and sends one email. Never throws for delivery problems — failures are
 * recorded on the OutboundEmail row (status FAILED + error) and returned.
 */
export async function send(input: SendInput): Promise<OutboundEmail> {
  const to = input.to.toLowerCase().trim();
  const from = input.from ?? emailFrom();
  const base = {
    toEmail: to,
    fromEmail: from,
    subject: input.subject,
    kind: input.kind,
    personId: input.personId ?? null,
    newsletterIssueId: input.newsletterIssueId ?? null,
    conversationId: input.conversationId ?? null,
  };

  if (await isSuppressed(to)) {
    console.log(`[email] suppressed ${input.kind} → ${maskEmail(to)}`);
    return prisma.outboundEmail.create({ data: { ...base, status: EmailStatus.SUPPRESSED } });
  }

  const row = await prisma.outboundEmail.create({ data: { ...base, status: EmailStatus.QUEUED } });
  const mode = emailMode();

  if (mode === 'log') {
    console.log(`[email] (log mode) ${input.kind} → ${to} — "${input.subject}"\n${input.text}\n`);
    return prisma.outboundEmail.update({
      where: { id: row.id },
      data: { status: EmailStatus.SENT, sentAt: new Date() },
    });
  }

  let actualTo = to;
  let subject = input.subject;
  if (mode === 'redirect') {
    const redirectTo = process.env.EMAIL_REDIRECT_TO;
    if (!redirectTo) {
      return prisma.outboundEmail.update({
        where: { id: row.id },
        data: { status: EmailStatus.FAILED, error: 'EMAIL_MODE=redirect but EMAIL_REDIRECT_TO is not set' },
      });
    }
    actualTo = redirectTo;
    subject = `[→ ${to}] ${input.subject}`;
  }

  try {
    const { data, error } = await getResend().emails.send(
      {
        from,
        to: actualTo,
        subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo,
        headers: input.headers,
        tags: [{ name: 'kind', value: input.kind }],
      },
      { idempotencyKey: `outbound-${row.id}` },
    );

    if (error || !data) {
      const message = error ? `${error.name}: ${error.message}` : 'No response data';
      console.error(`[email] send failed ${input.kind} → ${to}: ${message}`);
      return prisma.outboundEmail.update({
        where: { id: row.id },
        data: { status: EmailStatus.FAILED, error: message },
      });
    }

    console.log(`[email] sent ${input.kind} → ${maskEmail(to)} (${data.id})`);
    return prisma.outboundEmail.update({
      where: { id: row.id },
      data: { status: EmailStatus.SENT, resendId: data.id, sentAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] send threw ${input.kind} → ${to}: ${message}`);
    return prisma.outboundEmail.update({
      where: { id: row.id },
      data: { status: EmailStatus.FAILED, error: message },
    });
  }
}

/** Logs-safe form of an address: ka…@example.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return domain ? `${local.slice(0, 2)}…@${domain}` : '…';
}

/**
 * Fire-and-forget admin notification, sent from EMAIL_NOTIFY_FROM (separate from the
 * subscriber-facing hello@ address). replyTo = the person the notice is about, so
 * replying from the inbox reaches them. No-op if ADMIN_NOTIFY_EMAIL is unset.
 */
export function notifyAdmin(notice: NoticeInput, options: { replyTo?: string } = {}): void {
  const to = adminNotifyEmail();
  if (!to) return;
  send({
    ...adminNotice(notice),
    to,
    kind: EmailKind.ADMIN_NOTIFY,
    from: emailNotifyFrom(),
    replyTo: options.replyTo,
  }).catch((err) => console.error('[email] admin notification failed:', err));
}

// ─── Admin queries ────────────────────────────────────────────────────────────

export async function listOutbound(limit = 100, cursor?: string) {
  const rows = await prisma.outboundEmail.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { person: { select: { id: true, name: true } } },
  });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

export async function listSuppressions() {
  return prisma.emailSuppression.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function removeSuppression(id: string) {
  return prisma.emailSuppression.delete({ where: { id } });
}

export async function sendTest(): Promise<OutboundEmail | null> {
  const to = adminNotifyEmail();
  if (!to) return null;
  return send({
    ...adminNotice({
      type: 'Test',
      title: 'Test email from the admin panel',
      rows: [['Mode', emailMode()], ['Sent at', new Date().toISOString()]],
    }),
    to,
    kind: EmailKind.ADMIN_NOTIFY,
    from: emailNotifyFrom(),
  });
}
