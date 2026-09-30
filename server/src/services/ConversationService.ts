// src/services/ConversationService.ts
// Help-desk style conversations: contact-form inquiries, inbound email (B2), newsletter replies (B2),
// and threads started from admin. Statuses: OPEN (needs a response) → WAITING (we replied) → CLOSED.

import {
  ConversationChannel, ConversationStatus, EmailKind, MessageDirection, Prisma,
} from '@prisma/client';
import prisma from '../db';
import * as EmailService from './EmailService';
import { upsertPerson } from './PersonService';
import { getSetting } from './SettingsService';
import { renderReply, replySubject } from '../lib/email/reply';
import { emailFromAddress } from '../lib/email/config';
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
       OR (m.direction = 'OUTBOUND' AND m.to_email ILIKE ${like})  -- our own address never matches
       OR p.email ILIKE ${like} OR p.name ILIKE ${like}
    LIMIT 500`;
  return rows.map((r) => r.id);
}

export async function listConversations(filter: StatusFilter, q?: string) {
  const where: Prisma.ConversationWhereInput = {};
  if (filter !== 'all') where.status = STATUS_BY_FILTER[filter];
  if (q?.trim()) where.id = { in: await searchIds(q.trim()) };

  const rows = await prisma.conversation.findMany({
    where,
    orderBy: { lastMessageAt: 'desc' },
    take: 200,
    include: {
      person: { select: { id: true, name: true, email: true } },
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

export async function summary() {
  const [groups, unread] = await Promise.all([
    prisma.conversation.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.conversation.count({ where: { unread: true, status: { not: ConversationStatus.CLOSED } } }),
  ]);
  const n = (s: ConversationStatus) => groups.find((g) => g.status === s)?._count._all ?? 0;
  return { open: n(ConversationStatus.OPEN), waiting: n(ConversationStatus.WAITING), closed: n(ConversationStatus.CLOSED), unread };
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
      person: {
        omit: { passwordHash: true, totpSecret: true },
        include: {
          newsletter: { select: { active: true, confirmedAt: true } },
          listSubscriptions: { select: { active: true, confirmedAt: true, list: { select: { name: true } } } },
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
  return conv;
}

export async function setStatus(id: string, status: ConversationStatus) {
  const conv = await prisma.conversation.findUnique({ where: { id } });
  if (!conv) throw new ConversationError('Conversation not found', 404);
  return prisma.conversation.update({ where: { id }, data: { status } });
}

// ─── Sending ──────────────────────────────────────────────────────────────────

/** The address a reply should go to: the latest inbound sender, else the original recipient. */
function counterparty(messages: { direction: MessageDirection; fromEmail: string; fromName: string | null; toEmail: string }[]) {
  const lastIn = [...messages].reverse().find((m) => m.direction === MessageDirection.INBOUND);
  if (lastIn) return { email: lastIn.fromEmail, name: lastIn.fromName };
  const firstOut = messages.find((m) => m.direction === MessageDirection.OUTBOUND);
  return firstOut ? { email: firstOut.toEmail, name: null } : null;
}

async function sendOutbound(opts: {
  conversationId: string;
  personId: string | null;
  to: string;
  subject: string;
  body: string;
  quoted: Parameters<typeof renderReply>[0]['quoted'];
  inReplyTo?: string | null;
  references?: string | null;
}) {
  const signature = await getSetting('inbox.signature');
  const { html, text } = renderReply({ body: opts.body, signature, quoted: opts.quoted });
  const headers: Record<string, string> = {};
  if (opts.inReplyTo) headers['In-Reply-To'] = opts.inReplyTo;
  if (opts.references) headers['References'] = opts.references;

  const outbound = await EmailService.send({
    to: opts.to,
    subject: opts.subject,
    html,
    text,
    kind: EmailKind.REPLY,
    personId: opts.personId,
    replyTo: conversationReplyTo(opts.conversationId),
    headers: Object.keys(headers).length ? headers : undefined,
    conversationId: opts.conversationId,
  });
  if (outbound.status === 'FAILED' || outbound.status === 'SUPPRESSED') {
    throw new ConversationError(
      outbound.status === 'SUPPRESSED'
        ? `${opts.to} is on the suppression list (bounced or complained) — not sent`
        : `Send failed: ${outbound.error ?? 'unknown error'}`,
      502,
    );
  }

  return prisma.message.create({
    data: {
      conversationId: opts.conversationId,
      direction: MessageDirection.OUTBOUND,
      fromEmail: emailFromAddress(),
      toEmail: opts.to,
      subject: opts.subject,
      text: opts.body.trim(),
      html,
      inReplyTo: opts.inReplyTo ?? null,
      references: opts.references ?? null,
      outboundEmailId: outbound.id,
    },
  });
}

export async function reply(id: string, body: string, close = false) {
  if (!body.trim()) throw new ConversationError('Write a reply first');
  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!conv) throw new ConversationError('Conversation not found', 404);
  const to = counterparty(conv.messages);
  if (!to) throw new ConversationError('No recipient found for this conversation');

  const withIds = conv.messages.filter((m) => m.messageIdHeader);
  const lastIn = [...conv.messages].reverse().find((m) => m.direction === MessageDirection.INBOUND);
  const references = withIds.slice(-10).map((m) => m.messageIdHeader).join(' ') || null;

  await sendOutbound({
    conversationId: id,
    personId: conv.personId,
    to: to.email,
    subject: replySubject(conv.subject),
    body,
    quoted: lastIn ? { fromName: lastIn.fromName, fromEmail: lastIn.fromEmail, date: lastIn.createdAt, text: lastIn.text } : null,
    inReplyTo: withIds.at(-1)?.messageIdHeader ?? null,
    references,
  });
  await prisma.conversation.update({
    where: { id },
    data: {
      status: close ? ConversationStatus.CLOSED : ConversationStatus.WAITING,
      unread: false,
      lastMessageAt: new Date(),
    },
  });
  return getConversation(id, false);
}

export interface ComposeInput {
  to?: string;
  name?: string;
  subject?: string;
  body?: string;
}

export async function compose(input: ComposeInput) {
  const to = input.to?.trim().toLowerCase() ?? '';
  const subject = input.subject?.trim() ?? '';
  const body = input.body ?? '';
  if (!EMAIL_PATTERN.test(to)) throw new ConversationError('Enter a valid email address');
  if (!subject) throw new ConversationError('Subject is required');
  if (!body.trim()) throw new ConversationError('Write a message first');

  const person = await upsertPerson(to, input.name?.trim() || undefined);
  const conv = await prisma.conversation.create({
    data: {
      sourceSite: brand.siteKey,
      personId: person.id,
      subject,
      channel: ConversationChannel.COMPOSED,
      status: ConversationStatus.WAITING,
      unread: false,
    },
  });
  try {
    await sendOutbound({ conversationId: conv.id, personId: person.id, to, subject, body, quoted: null });
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
