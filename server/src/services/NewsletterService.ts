// src/services/NewsletterService.ts
// Newsletter issues: drafts, preview, test sends, send kickoff, stats.
// Actual delivery happens in jobs/newsletterQueue.ts, which drains QUEUED rows within the daily budget.

import { EmailKind, EmailStatus, IssueStatus } from '@prisma/client';
import prisma from '../db';
import * as EmailService from './EmailService';
import { renderIssue, personalize } from '../lib/email/newsletter';
import { emailMode, adminNotifyEmail, emailFrom, publicBaseUrl } from '../lib/email/config';
import { getSetting } from './SettingsService';
import { brand } from '../lib/brand';

export class NewsletterError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export interface IssueInput {
  listId?: string;
  subject?: string;
  preheader?: string | null;
  markdown?: string;
}

// ─── Recipients ───────────────────────────────────────────────────────────────

export interface Recipient {
  personId: string;
  email: string;
  token: string;
}

/** Everyone who should receive list L right now: verified, not stopped, on the list, not suppressed. */
export async function mailableRecipients(listId: string): Promise<Recipient[]> {
  const subs = await prisma.listSubscription.findMany({
    where: {
      listId,
      active: true,
      confirmedAt: { not: null },
      person: { newsletter: { active: true, confirmedAt: { not: null } } },
    },
    select: { person: { select: { id: true, email: true, newsletter: { select: { token: true } } } } },
    orderBy: { subscribedAt: 'asc' },
  });
  const emails = subs.map((s) => s.person.email.toLowerCase());
  const suppressed = new Set(
    (await prisma.emailSuppression.findMany({ where: { email: { in: emails } }, select: { email: true } }))
      .map((r) => r.email),
  );
  return subs
    .filter((s) => s.person.newsletter && !suppressed.has(s.person.email.toLowerCase()))
    .map((s) => ({ personId: s.person.id, email: s.person.email, token: s.person.newsletter!.token }));
}

// ─── Lists & issues ───────────────────────────────────────────────────────────

export async function listLists() {
  const lists = await prisma.newsletterList.findMany({ orderBy: { createdAt: 'asc' } });
  return Promise.all(
    lists.map(async (l) => ({ ...l, recipientCount: (await mailableRecipients(l.id)).length })),
  );
}

export async function listIssues() {
  const issues = await prisma.newsletterIssue.findMany({
    orderBy: { createdAt: 'desc' },
    include: { list: { select: { key: true, name: true } } },
  });
  return Promise.all(issues.map(async (i) => ({ ...i, stats: await issueStats(i.id) })));
}

export async function getIssue(id: string) {
  const issue = await prisma.newsletterIssue.findUnique({
    where: { id },
    include: { list: { select: { key: true, name: true } } },
  });
  if (!issue) throw new NewsletterError('Issue not found', 404);
  return { ...issue, stats: await issueStats(id) };
}

export async function createIssue(input: IssueInput) {
  const listId = input.listId ?? (await prisma.newsletterList.findUnique({ where: { key: brand.defaultList.key } }))?.id;
  if (!listId) throw new NewsletterError('No newsletter list found');
  return prisma.newsletterIssue.create({
    data: {
      listId,
      subject: input.subject?.trim() ?? '',
      preheader: input.preheader?.trim() || null,
      markdown: input.markdown ?? '',
    },
  });
}

async function requireDraft(id: string) {
  const issue = await prisma.newsletterIssue.findUnique({ where: { id }, include: { list: true } });
  if (!issue) throw new NewsletterError('Issue not found', 404);
  if (issue.status !== IssueStatus.DRAFT) throw new NewsletterError('Only drafts can be changed');
  return issue;
}

export async function updateIssue(id: string, input: IssueInput) {
  await requireDraft(id);
  return prisma.newsletterIssue.update({
    where: { id },
    data: {
      ...(input.listId !== undefined && { listId: input.listId }),
      ...(input.subject !== undefined && { subject: input.subject.trim() }),
      ...(input.preheader !== undefined && { preheader: input.preheader?.trim() || null }),
      ...(input.markdown !== undefined && { markdown: input.markdown }),
    },
  });
}

export async function deleteIssue(id: string) {
  await requireDraft(id);
  await prisma.newsletterIssue.delete({ where: { id } });
}

// ─── Preview & test ───────────────────────────────────────────────────────────

const SAMPLE_LINKS = {
  unsubscribe: `${publicBaseUrl()}/unsubscribe?t=preview`,
  preferences: `${publicBaseUrl()}/preferences?t=preview`,
};

export async function preview(input: IssueInput) {
  const list = input.listId
    ? await prisma.newsletterList.findUnique({ where: { id: input.listId } })
    : await prisma.newsletterList.findUnique({ where: { key: brand.defaultList.key } });
  const rendered = renderIssue({
    subject: input.subject ?? '',
    preheader: input.preheader,
    markdown: input.markdown ?? '',
    listName: list?.name ?? brand.defaultList.name,
    postalAddress: await getSetting('newsletter.postalAddress'),
  });
  return personalize(rendered, SAMPLE_LINKS);
}

/** Sends the current draft to ADMIN_NOTIFY_EMAIL (or `to`). Links in a test point to sample pages. */
export async function sendTest(id: string, to?: string) {
  const issue = await prisma.newsletterIssue.findUnique({ where: { id }, include: { list: true } });
  if (!issue) throw new NewsletterError('Issue not found', 404);
  const recipient = to?.trim() || adminNotifyEmail();
  if (!recipient) throw new NewsletterError('No test address — set ADMIN_NOTIFY_EMAIL');
  if (!issue.subject.trim()) throw new NewsletterError('Add a subject first');

  const rendered = personalize(
    renderIssue({
      subject: issue.subject, preheader: issue.preheader, markdown: issue.markdown, listName: issue.list.name,
      postalAddress: await getSetting('newsletter.postalAddress'),
    }),
    SAMPLE_LINKS,
  );
  return EmailService.send({
    ...rendered,
    subject: `[Test] ${rendered.subject}`,
    to: recipient,
    kind: EmailKind.NEWSLETTER_TEST,
    newsletterIssueId: issue.id,
  });
}

// ─── Send ─────────────────────────────────────────────────────────────────────

/** Validates, snapshots recipients as QUEUED rows, marks SENDING. The queue job delivers them. */
export async function startSend(id: string) {
  const issue = await requireDraft(id);
  if (!issue.subject.trim()) throw new NewsletterError('Subject is required');
  if (!issue.markdown.trim()) throw new NewsletterError('Content is required');
  if (emailMode() === 'live' && !(await getSetting('newsletter.postalAddress'))) {
    throw new NewsletterError('Set the postal address in Admin → Settings before sending — US law (CAN-SPAM) requires a postal address in every newsletter');
  }

  const recipients = await mailableRecipients(issue.listId);
  if (recipients.length === 0) throw new NewsletterError('This list has no confirmed subscribers');

  const now = new Date();
  await prisma.$transaction([
    prisma.outboundEmail.createMany({
      data: recipients.map((r) => ({
        personId: r.personId,
        toEmail: r.email.toLowerCase(),
        fromEmail: emailFrom(),
        subject: issue.subject,
        kind: EmailKind.NEWSLETTER,
        status: EmailStatus.QUEUED,
        sourceSite: brand.siteKey,
        newsletterIssueId: issue.id,
      })),
    }),
    prisma.newsletterIssue.update({
      where: { id: issue.id },
      data: { status: IssueStatus.SENDING, recipientCount: recipients.length, sendStartedAt: now },
    }),
  ]);
  console.log(`[newsletter] queued "${issue.subject}" for ${recipients.length} recipients`);
  return getIssue(id);
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface IssueStats {
  queued: number;
  sent: number;      // accepted by Resend, no delivery report yet
  delivered: number;
  delayed: number;
  bounced: number;
  complained: number;
  failed: number;
  skipped: number;   // SUPPRESSED at send time (unsubscribed / suppressed after queuing)
  unsubscribed: number; // left the list via this issue's link
}

export async function issueStats(issueId: string): Promise<IssueStats> {
  const [groups, unsubscribed] = await Promise.all([
    prisma.outboundEmail.groupBy({
      by: ['status'],
      where: { newsletterIssueId: issueId, kind: EmailKind.NEWSLETTER },
      _count: { _all: true },
    }),
    prisma.listSubscription.count({ where: { unsubscribedIssueId: issueId } }),
  ]);
  const n = (s: EmailStatus) => groups.find((g) => g.status === s)?._count._all ?? 0;
  return {
    queued: n(EmailStatus.QUEUED),
    sent: n(EmailStatus.SENT),
    delivered: n(EmailStatus.DELIVERED),
    delayed: n(EmailStatus.DELAYED),
    bounced: n(EmailStatus.BOUNCED),
    complained: n(EmailStatus.COMPLAINED),
    failed: n(EmailStatus.FAILED),
    skipped: n(EmailStatus.SUPPRESSED),
    unsubscribed,
  };
}
