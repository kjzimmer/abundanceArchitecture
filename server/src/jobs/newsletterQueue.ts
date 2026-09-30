// src/jobs/newsletterQueue.ts
// Drains QUEUED newsletter rows through Resend's batch API, within the daily send budget.
// Runs every minute (node-cron) and immediately after a send is started. Single-instance:
// an in-process flag prevents overlapping runs.

import cron from 'node-cron';
import { EmailKind, EmailStatus, IssueStatus } from '@prisma/client';
import prisma from '../db';
import * as EmailService from '../services/EmailService';
import { issueStats } from '../services/NewsletterService';
import { unsubscribeUrl, preferencesUrl } from '../services/SubscriberService';
import { getSetting } from '../services/SettingsService';
import { renderIssue, personalize } from '../lib/email/newsletter';
import { dailyLimit, transactionalReserve, emailMode } from '../lib/email/config';
import type { RenderedEmail } from '../lib/email/templates';
import { brand } from '../lib/brand';

const BATCH_SIZE = 100; // Resend batch API maximum
let running = false;
let lastBudgetLog = 0;

async function budget(): Promise<number> {
  // Log mode never reaches Resend, so its quota doesn't apply
  if (emailMode() === 'log') return BATCH_SIZE;
  return dailyLimit() - transactionalReserve() - (await EmailService.sentInLast24h());
}

async function sendNextBatch(): Promise<'sent' | 'empty' | 'stop'> {
  const available = await budget();
  if (available <= 0) {
    if (Date.now() - lastBudgetLog > 60 * 60 * 1000) {
      console.log('[newsletter] daily budget reached — remaining recipients go out as the 24h window frees up');
      lastBudgetLog = Date.now();
    }
    return 'stop';
  }

  const first = await prisma.outboundEmail.findFirst({
    where: { status: EmailStatus.QUEUED, kind: EmailKind.NEWSLETTER, newsletterIssueId: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { newsletterIssueId: true },
  });
  if (!first?.newsletterIssueId) return 'empty';

  const issue = await prisma.newsletterIssue.findUnique({
    where: { id: first.newsletterIssueId },
    include: { list: true },
  });
  if (!issue) return 'empty';

  const rows = await prisma.outboundEmail.findMany({
    where: { status: EmailStatus.QUEUED, kind: EmailKind.NEWSLETTER, newsletterIssueId: issue.id },
    orderBy: { createdAt: 'asc' },
    take: Math.min(BATCH_SIZE, available),
    include: {
      person: {
        select: {
          newsletter: { select: { active: true, confirmedAt: true, token: true } },
          listSubscriptions: { where: { listId: issue.listId }, select: { active: true, confirmedAt: true } },
        },
      },
    },
  });
  if (rows.length === 0) return 'empty';

  // Re-check at send time: people may have unsubscribed or bounced since the send was started
  const suppressed = new Set(
    (await prisma.emailSuppression.findMany({
      where: { email: { in: rows.map((r) => r.toEmail) } },
      select: { email: true },
    })).map((s) => s.email),
  );
  const postalAddress = await getSetting('newsletter.postalAddress');
  if (!postalAddress && emailMode() === 'live') {
    // Cleared after the send started — pause rather than send a non-compliant footer
    console.warn('[newsletter] postal address not set — queue paused (Admin → Settings)');
    return 'stop';
  }

  const skip: string[] = [];
  const template: RenderedEmail = renderIssue({
    subject: issue.subject,
    preheader: issue.preheader,
    markdown: issue.markdown,
    listName: issue.list.name,
    postalAddress,
  });
  const replyTo = `reply+n-${issue.id}@${brand.domain}`;

  const items: EmailService.BatchItem[] = [];
  for (const row of rows) {
    const sub = row.person?.newsletter;
    const ls = row.person?.listSubscriptions[0];
    const ok = sub?.active && sub.confirmedAt && ls?.active && ls.confirmedAt && !suppressed.has(row.toEmail);
    if (!ok || !sub) {
      skip.push(row.id);
      continue;
    }
    const unsub = unsubscribeUrl(sub.token, issue.list.key, issue.id);
    items.push({
      rowId: row.id,
      to: row.toEmail,
      replyTo,
      headers: {
        'List-Unsubscribe': `<${unsub}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      ...personalize(template, { unsubscribe: unsub, preferences: preferencesUrl(sub.token) }),
    });
  }

  if (skip.length) {
    await prisma.outboundEmail.updateMany({
      where: { id: { in: skip } },
      data: { status: EmailStatus.SUPPRESSED, error: 'No longer subscribed or suppressed at send time' },
    });
  }
  if (items.length === 0) return 'sent'; // all skipped — loop continues

  const result = await EmailService.sendBatch(items);
  return result === 'retry' ? 'stop' : 'sent';
}

/** Issues whose queue is empty become SENT, with a summary notice to the admin. */
async function finalizeIssues() {
  const sending = await prisma.newsletterIssue.findMany({
    where: { status: IssueStatus.SENDING },
    include: { list: true },
  });
  for (const issue of sending) {
    const queued = await prisma.outboundEmail.count({
      where: { newsletterIssueId: issue.id, kind: EmailKind.NEWSLETTER, status: EmailStatus.QUEUED },
    });
    if (queued > 0) continue;
    await prisma.newsletterIssue.update({
      where: { id: issue.id },
      data: { status: IssueStatus.SENT, sentAt: new Date() },
    });
    const s = await issueStats(issue.id);
    const accepted = s.sent + s.delivered + s.delayed + s.bounced + s.complained;
    console.log(`[newsletter] finished "${issue.subject}": ${accepted} sent, ${s.failed} failed, ${s.skipped} skipped`);
    EmailService.notifyAdmin({
      type: 'Newsletter',
      title: `"${issue.subject}" sent to ${accepted} subscribers`,
      rows: [
        ['List', issue.list.name],
        ['Recipients', String(issue.recipientCount)],
        ['Sent', String(accepted)],
        ['Failed', String(s.failed)],
        ['Skipped', String(s.skipped)],
      ],
      body: 'Delivery, bounce and unsubscribe counts keep updating in Admin → Newsletter.',
      adminPath: '/admin',
    });
  }
}

export async function processQueue(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (let i = 0; i < 50; i++) {
      const r = await sendNextBatch();
      if (r !== 'sent') break;
    }
    await finalizeIssues();
  } catch (err) {
    console.error('[newsletter] queue run failed:', err);
  } finally {
    running = false;
  }
}

/** Run soon, outside the current request. */
export function kickQueue(): void {
  setImmediate(() => void processQueue());
}

export function startNewsletterQueue(): void {
  cron.schedule('* * * * *', () => void processQueue());
  kickQueue(); // resume anything left queued before a restart
}
