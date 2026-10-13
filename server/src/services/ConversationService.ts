// src/services/ConversationService.ts
// Help-desk style conversations: contact-form inquiries, inbound email (B2), newsletter replies (B2),
// and threads started from admin. Statuses: OPEN (needs a response) → WAITING (we replied) → CLOSED.

import {
  ConversationChannel, ConversationStatus, EmailKind, MessageDirection, Prisma,
} from '@prisma/client';
import prisma from '../db';
import * as EmailService from './EmailService';
import { upsertPerson } from './PersonService';
import { groupExists } from './GroupService';
import { getSetting } from './SettingsService';
import { renderReply, replySubject } from '../lib/email/reply';
import { emailFromAddress } from '../lib/email/config';
import { Mailbox, defaultMailbox, isMailboxKey, mailboxByKey, mailboxes } from '../lib/email/mailboxes';
import { brand } from '../lib/brand';

export class ConversationError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Reply-To that routes a reply back into this conversation (catch-all → Worker, B2) */
export function conversationReplyTo(conversationId: string): string {
  return `reply+c-${conversationId}@${brand.domain}`;
}

// ─── Creating conversations ───────────────────────────────────────────────────

export interface ContactFormInput {
  personId: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export async function createFromContactForm(input: ContactFormInput) {
  return prisma.conversation.create({
    data: {
      sourceSite: brand.siteKey,
      personId: input.personId,
      subject: input.subject,
      channel: ConversationChannel.CONTACT_FORM,
      status: ConversationStatus.OPEN,
      unread: true,
      messages: {
        create: {
          direction: MessageDirection.INBOUND,
          fromEmail: input.email,
          fromName: input.name,
          toEmail: emailFromAddress(),
          subject: input.subject,
          text: input.message,
          meta: input.phone ? { phone: input.phone } : Prisma.JsonNull,
        },
      },
    },
  });
}

// ─── Listing & search ─────────────────────────────────────────────────────────

export type StatusFilter = 'open' | 'waiting' | 'closed' | 'all';

const STATUS_BY_FILTER: Record<Exclude<StatusFilter, 'all'>, ConversationStatus> = {
  open: ConversationStatus.OPEN,
  waiting: ConversationStatus.WAITING,
  closed: ConversationStatus.CLOSED,
};

/** Full-text over subject + message bodies (Postgres), plus substring match on names/addresses. */
async function searchIds(q: string): Promise<string[]> {
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT c.id
    FROM conversation c
    LEFT JOIN message m ON m.conversation_id = c.id
    LEFT JOIN person p ON p.id = c.person_id
    WHERE to_tsvector('english', c.subject || ' ' || coalesce(m.text, '')) @@ websearch_to_tsquery('english', ${q})
       OR c.subject ILIKE ${like}
       OR (m.direction = 'INBOUND' AND (m.from_email ILIKE ${like} OR m.from_name ILIKE ${like}))
       OR (m.direction = 'OUTBOUND' AND array_to_string(m.to_emails || m.cc_emails || m.bcc_emails, ' ') ILIKE ${like})  -- our own address never matches
       OR (m.direction = 'INBOUND' AND array_to_string(m.cc_emails, ' ') ILIKE ${like})
       OR p.email ILIKE ${like} OR p.name ILIKE ${like}
    LIMIT 500`;
  return rows.map((r) => r.id);
}

export async function listConversations(filter: StatusFilter, q?: string, mailbox?: string) {
  const where: Prisma.ConversationWhereInput = {};
  if (filter !== 'all') where.status = STATUS_BY_FILTER[filter];
  if (isMailboxKey(mailbox)) where.mailbox = mailbox;
  if (q?.trim()) where.id = { in: await searchIds(q.trim()) };

  const rows = await prisma.conversation.findMany({
    where,
    orderBy: { lastMessageAt: 'desc' },
    take: 200,
    include: {
      person: { select: { id: true, name: true, email: true } },
      group: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { direction: true, text: true, fromName: true, fromEmail: true },
      },
      _count: { select: { messages: true } },
    },
  });
  return rows.map(({ messages, _count, ...c }) => ({
    ...c,
    messageCount: _count.messages,
    last: messages[0]
      ? { ...messages[0], text: messages[0].text.replace(/\s+/g, ' ').slice(0, 160) }
      : null,
  }));
}

/** Status counts across all mailboxes (the nav badge), or for one mailbox when given. */
export async function summary(mailbox?: string) {
  const scope: Prisma.ConversationWhereInput = isMailboxKey(mailbox) ? { mailbox } : {};
  const [groups, unread] = await Promise.all([
    prisma.conversation.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
    prisma.conversation.count({ where: { ...scope, unread: true, status: { not: ConversationStatus.CLOSED } } }),
  ]);
  const n = (s: ConversationStatus) => groups.find((g) => g.status === s)?._count._all ?? 0;
  return { open: n(ConversationStatus.OPEN), waiting: n(ConversationStatus.WAITING), closed: n(ConversationStatus.CLOSED), unread };
}

/** Mailboxes for the Inbox UI (filter + Compose From), with open counts. */
export async function listMailboxes() {
  const open = await prisma.conversation.groupBy({
    by: ['mailbox'],
    where: { status: ConversationStatus.OPEN },
    _count: { _all: true },
  });
  return mailboxes().map(({ key, address, name, personal }) => ({
    key, address, name, personal,
    open: open.find((g) => g.mailbox === key)?._count._all ?? 0,
  }));
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export async function getConversation(id: string, markRead = true) {
  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { outboundEmail: { select: { status: true, error: true } } },
      },
      group: { select: { id: true, name: true } },
      person: {
        omit: { passwordHash: true, totpSecret: true },
        include: {
          newsletter: { select: { active: true, confirmedAt: true, unsubscribedAt: true } },
          listSubscriptions: { select: { active: true, confirmedAt: true, unsubscribedAt: true, list: { select: { name: true } } } },
          conversations: {
            where: { id: { not: id } },
            orderBy: { lastMessageAt: 'desc' },
            take: 10,
            select: { id: true, subject: true, status: true, lastMessageAt: true },
          },
        },
      },
    },
  });
  if (!conv) throw new ConversationError('Conversation not found', 404);
  if (markRead && conv.unread) {
    await prisma.conversation.update({ where: { id }, data: { unread: false } });
    conv.unread = false;
  }
  return { ...conv, replyAll: replyAllDefaults(conv.messages) };
}

export async function setStatus(id: string, status: ConversationStatus) {
  const conv = await prisma.conversation.findUnique({ where: { id } });
  if (!conv) throw new ConversationError('Conversation not found', 404);
  return prisma.conversation.update({ where: { id }, data: { status } });
}

// ─── Sending ──────────────────────────────────────────────────────────────────

// ─── Recipients ───────────────────────────────────────────────────────────────

export interface RecipientsInput { to?: unknown; cc?: unknown; bcc?: unknown }
export interface Recipients { to: string[]; cc: string[]; bcc: string[] }

const MAX_RECIPIENTS = 50; // Resend's per-email limit across To + CC + BCC

/** A list from the API: an array of strings, or one string separated by commas/semicolons. */
function parseList(v: unknown): string[] {
  const parts = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : [];
  return parts.flatMap((p) => p.split(/[,;]/));
}

function isOurAddress(address: string): boolean {
  return address.endsWith(`@${brand.domain}`) || mailboxes().some((m) => m.address === address);
}

/** Validates and de-duplicates To/CC/BCC (an address appears once, in the first list it's in). */
function cleanRecipients(input: RecipientsInput): Recipients {
  const to = EmailService.normalizeAddresses(parseList(input.to));
  const cc = EmailService.normalizeAddresses(parseList(input.cc), to);
  const bcc = EmailService.normalizeAddresses(parseList(input.bcc), [...to, ...cc]);
  const all = [...to, ...cc, ...bcc];
  const invalid = all.filter((a) => !EMAIL_PATTERN.test(a));
  if (invalid.length) throw new ConversationError(`Not a valid email address: ${invalid.join(', ')}`);
  if (to.length === 0) throw new ConversationError('Add at least one To address');
  if (all.length > MAX_RECIPIENTS) throw new ConversationError(`Too many recipients (${all.length}); the limit is ${MAX_RECIPIENTS}`);
  return { to, cc, bcc };
}

async function assertNotSuppressed(r: Recipients) {
  const rows = await prisma.emailSuppression.findMany({
    where: { email: { in: [...r.to, ...r.cc, ...r.bcc] } },
    select: { email: true },
  });
  if (rows.length) {
    throw new ConversationError(
      `Remove ${rows.map((x) => x.email).join(', ')}: on the suppression list (bounced or reported spam), so nothing was sent`,
    );
  }
}

type ThreadMessage = {
  direction: MessageDirection; fromEmail: string; toEmail: string; toEmails: string[]; ccEmails: string[];
};

/**
 * Reply-all defaults from the latest message: answering an inbound email goes To its sender and CCs
 * everyone else it was addressed to (minus our own addresses); following up our own message reuses
 * its To/CC. BCC is never carried forward.
 */
export function replyAllDefaults(messages: ThreadMessage[]): { to: string[]; cc: string[] } {
  const last = messages.at(-1);
  if (!last) return { to: [], cc: [] };
  if (last.direction === MessageDirection.INBOUND) {
    const to = [last.fromEmail.toLowerCase()];
    const cc = EmailService.normalizeAddresses([...last.toEmails, ...last.ccEmails], to).filter((a) => !isOurAddress(a));
    return { to, cc };
  }
  const to = last.toEmails.length ? last.toEmails : [last.toEmail];
  return { to, cc: EmailService.normalizeAddresses(last.ccEmails, to) };
}

/** Every address gets a Person, so participants show up in People and can be added to groups. */
async function upsertRecipients(r: Recipients, firstName?: string) {
  const people = [];
  for (const [i, email] of [...r.to, ...r.cc, ...r.bcc].entries()) {
    people.push(await upsertPerson(email, i === 0 ? firstName : undefined));
  }
  return people;
}

async function sendOutbound(opts: {
  conversationId: string;
  mailbox: Mailbox;
  personId: string | null;
  recipients: Recipients;
  subject: string;
  body: string;
  quoted: Parameters<typeof renderReply>[0]['quoted'];
  inReplyTo?: string | null;
  references?: string | null;
}) {
  const { to, cc, bcc } = opts.recipients;
  const signature = await getSetting(opts.mailbox.signatureKey);
  const { html, text } = renderReply({ body: opts.body, signature, quoted: opts.quoted });
  const headers: Record<string, string> = {};
  if (opts.inReplyTo) headers['In-Reply-To'] = opts.inReplyTo;
  if (opts.references) headers['References'] = opts.references;

  const outbound = await EmailService.send({
    to,
    cc,
    bcc,
    subject: opts.subject,
    html,
    text,
    kind: EmailKind.REPLY,
    personId: opts.personId,
    from: opts.mailbox.from,
    // Personal mailboxes show their real address on Reply; answers thread via In-Reply-To instead
    replyTo: opts.mailbox.personal ? undefined : conversationReplyTo(opts.conversationId),
    headers: Object.keys(headers).length ? headers : undefined,
    conversationId: opts.conversationId,
  });
  if (outbound.status === 'FAILED' || outbound.status === 'SUPPRESSED') {
    throw new ConversationError(
      outbound.status === 'SUPPRESSED'
        ? 'A recipient is on the suppression list (bounced or complained) — not sent'
        : `Send failed: ${outbound.error ?? 'unknown error'}`,
      502,
    );
  }

  return prisma.message.create({
    data: {
      conversationId: opts.conversationId,
      direction: MessageDirection.OUTBOUND,
      fromEmail: opts.mailbox.address,
      toEmail: to[0],
      toEmails: to,
      ccEmails: cc,
      bccEmails: bcc,
      subject: opts.subject,
      text: opts.body.trim(),
      html,
      inReplyTo: opts.inReplyTo ?? null,
      references: opts.references ?? null,
      outboundEmailId: outbound.id,
    },
  });
}

export interface ReplyInput extends RecipientsInput {
  body?: string;
  close?: boolean;
}

/** Replies in a thread. To/CC default to reply-all (replyAllDefaults); pass them to override. */
export async function reply(id: string, input: ReplyInput) {
  const body = input.body ?? '';
  if (!body.trim()) throw new ConversationError('Write a reply first');
  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!conv) throw new ConversationError('Conversation not found', 404);

  const defaults = replyAllDefaults(conv.messages);
  const recipients = cleanRecipients({
    to: input.to ?? defaults.to,
    cc: input.cc ?? defaults.cc,
    bcc: input.bcc,
  });
  await assertNotSuppressed(recipients);
  await upsertRecipients(recipients);

  const withIds = conv.messages.filter((m) => m.messageIdHeader);
  const lastIn = [...conv.messages].reverse().find((m) => m.direction === MessageDirection.INBOUND);
  const references = withIds.slice(-10).map((m) => m.messageIdHeader).join(' ') || null;

  await sendOutbound({
    conversationId: id,
    mailbox: mailboxByKey(conv.mailbox),
    personId: conv.personId,
    recipients,
    subject: replySubject(conv.subject),
    body,
    quoted: lastIn ? { fromName: lastIn.fromName, fromEmail: lastIn.fromEmail, date: lastIn.createdAt, text: lastIn.text } : null,
    inReplyTo: withIds.at(-1)?.messageIdHeader ?? null,
    references,
  });
  await prisma.conversation.update({
    where: { id },
    data: {
      status: input.close ? ConversationStatus.CLOSED : ConversationStatus.WAITING,
      unread: false,
      lastMessageAt: new Date(),
    },
  });
  return getConversation(id, false);
}

export interface ComposeInput extends RecipientsInput {
  name?: string;     // name for the first To address, if it's a new Person
  subject?: string;
  body?: string;
  from?: string;     // mailbox key; default mailbox when omitted
  groupId?: string;  // set when the recipients came from a Group
}

export async function compose(input: ComposeInput) {
  const subject = input.subject?.trim() ?? '';
  const body = input.body ?? '';
  if (input.from !== undefined && !isMailboxKey(input.from)) throw new ConversationError('Unknown From address');
  const recipients = cleanRecipients(input);
  if (!subject) throw new ConversationError('Subject is required');
  if (!body.trim()) throw new ConversationError('Write a message first');
  if (input.groupId && !(await groupExists(input.groupId))) throw new ConversationError('Group not found');
  await assertNotSuppressed(recipients);

  const mailbox = input.from ? mailboxByKey(input.from) : defaultMailbox();
  const [person] = await upsertRecipients(recipients, input.name?.trim() || undefined);
  const conv = await prisma.conversation.create({
    data: {
      sourceSite: brand.siteKey,
      personId: person.id,
      subject,
      channel: ConversationChannel.COMPOSED,
      status: ConversationStatus.WAITING,
      unread: false,
      mailbox: mailbox.key,
      groupId: input.groupId || null,
    },
  });
  try {
    await sendOutbound({ conversationId: conv.id, mailbox, personId: person.id, recipients, subject, body, quoted: null });
  } catch (err) {
    // Don't leave an empty thread behind when the first send fails
    await prisma.conversation.delete({ where: { id: conv.id } });
    throw err;
  }
  return getConversation(conv.id, false);
}

// ─── Webhook hook ─────────────────────────────────────────────────────────────

/** Records Resend's RFC Message-ID on our outbound message so inbound replies can match In-Reply-To (B2). */
export async function recordOutboundMessageId(resendId: string, messageId: string) {
  const outbound = await prisma.outboundEmail.findUnique({ where: { resendId }, select: { id: true } });
  if (!outbound) return;
  const normalized = messageId.startsWith('<') ? messageId : `<${messageId}>`;
  await prisma.message.updateMany({
    where: { outboundEmailId: outbound.id, messageIdHeader: null },
    data: { messageIdHeader: normalized },
  }).catch(() => undefined); // unique clash = already recorded elsewhere; harmless
}
