// src/services/EmailService.ts
// Single entry point for all outbound email. Every send is recorded in OutboundEmail.
// EMAIL_MODE: live (Resend) | log (console only, default) | redirect (Resend, all mail to EMAIL_REDIRECT_TO)

import { createHash } from 'crypto';
import { Resend } from 'resend';
import { EmailKind, EmailStatus, OutboundEmail } from '@prisma/client';
import prisma from '../db';
import { emailFrom, emailNotifyFrom, emailMode, adminNotifyEmail } from '../lib/email/config';
import { adminNotice, NoticeInput, RenderedEmail } from '../lib/email/templates';
import { brand } from '../lib/brand';

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
    sourceSite: brand.siteKey,
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

// ─── Batch sending (newsletter queue) ─────────────────────────────────────────

/** One already-created OutboundEmail row (status QUEUED) and its rendered content */
export interface BatchItem extends RenderedEmail {
  rowId: string;
  to: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

// Resend errors worth retrying on the next queue run; anything else fails the rows permanently
const RETRYABLE: ReadonlySet<string> = new Set([
  'rate_limit_exceeded', 'daily_quota_exceeded', 'monthly_quota_exceeded',
  'concurrent_idempotent_requests', 'application_error', 'internal_server_error',
]);

export type BatchResult = 'sent' | 'retry' | 'failed';

/** Sends up to 100 pre-queued rows in one Resend batch call and records the outcome on each row. */
export async function sendBatch(items: BatchItem[]): Promise<BatchResult> {
  if (items.length === 0) return 'sent';
  if (items.length > 100) throw new Error('sendBatch: max 100 items per call');
  const mode = emailMode();
  const now = new Date();

  if (mode === 'log') {
    console.log(`[email] (log mode) batch of ${items.length}: "${items[0].subject}" → ${items.map((i) => maskEmail(i.to)).join(', ')}`);
    await prisma.outboundEmail.updateMany({
      where: { id: { in: items.map((i) => i.rowId) } },
      data: { status: EmailStatus.SENT, sentAt: now },
    });
    return 'sent';
  }

  const redirectTo = process.env.EMAIL_REDIRECT_TO;
  if (mode === 'redirect' && !redirectTo) {
    await prisma.outboundEmail.updateMany({
      where: { id: { in: items.map((i) => i.rowId) } },
      data: { status: EmailStatus.FAILED, error: 'EMAIL_MODE=redirect but EMAIL_REDIRECT_TO is not set' },
    });
    return 'failed';
  }

  const payload = items.map((i) => ({
    from: i.from ?? emailFrom(),
    to: mode === 'redirect' ? redirectTo! : i.to,
    subject: mode === 'redirect' ? `[→ ${i.to}] ${i.subject}` : i.subject,
    html: i.html,
    text: i.text,
    replyTo: i.replyTo,
    headers: i.headers,
    tags: [{ name: 'kind', value: EmailKind.NEWSLETTER }],
  }));

  try {
    // Same rows → same key, so a retried call after a timeout can't double-send
    const idempotencyKey = `batch-${createHash('sha256').update(items.map((i) => i.rowId).join('.')).digest('hex')}`;
    const { data, error } = await getResend().batch.send(payload, { idempotencyKey });

    if (error || !data) {
      const message = error ? `${error.name}: ${error.message}` : 'No response data';
      const retry = !error || RETRYABLE.has(error.name);
      console.error(`[email] batch ${retry ? 'deferred' : 'failed'} (${items.length}): ${message}`);
      await prisma.outboundEmail.updateMany({
        where: { id: { in: items.map((i) => i.rowId) } },
        data: retry ? { error: message } : { status: EmailStatus.FAILED, error: message },
      });
      return retry ? 'retry' : 'failed';
    }

    // Resend returns ids in request order
    await prisma.$transaction(
      items.map((item, idx) =>
        prisma.outboundEmail.update({
          where: { id: item.rowId },
          data: { status: EmailStatus.SENT, resendId: data.data[idx]?.id ?? null, sentAt: now, error: null },
        }),
      ),
    );
    console.log(`[email] batch sent ${items.length} × "${items[0].subject}"`);
    return 'sent';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] batch threw (${items.length}): ${message}`);
    await prisma.outboundEmail.updateMany({
      where: { id: { in: items.map((i) => i.rowId) } },
      data: { error: message },
    });
    return 'retry';
  }
}

/** Emails accepted for sending in the last 24h — Resend's daily cap counts every send */
export async function sentInLast24h(): Promise<number> {
  return prisma.outboundEmail.count({
    where: { sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
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
