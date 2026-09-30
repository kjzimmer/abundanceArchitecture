// src/services/InboundService.ts
// Handles parsed inbound mail posted by the Cloudflare Email Worker (worker/src/index.ts).
// Threading, in order of reliability:
//   1. reply+c-<conversationId>@  — Reply-To we set on Inbox replies
//   2. reply+n-<issueId>@         — Reply-To on newsletter issues (one thread per person per issue)
//   3. In-Reply-To / References   — matched against stored RFC Message-IDs
//   4. Same sender + same subject (Re:/Fwd: stripped) within 30 days, not closed
//   5. Otherwise a new EMAIL conversation
// Auto-replies (out-of-office, bulk) never create threads, reopen threads or notify.

import { ConversationChannel, ConversationStatus, MessageDirection, Prisma } from '@prisma/client';
import prisma from '../db';
import * as EmailService from './EmailService';
import { upsertPerson } from './PersonService';
import { brand } from '../lib/brand';
import { splitQuotedReply } from '../lib/email/quotes';

export interface InboundPayload {
  recipient: string;
  envelopeFrom: string;
  from: { address: string; name: string | null } | null;
  replyTo: string[];
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  html: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
  date: string | null;
  autoSubmitted: string | null;
  precedence: string | null;
  autoReply: string | null;
  attachments: { filename: string | null; contentType: string; size: number }[];
}

export type InboundResult =
  | { result: 'created' | 'appended'; conversationId: string }
  | { result: 'duplicate' | 'ignored'; reason: string };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeId(id: string): string {
  const t = id.trim();
  return t.startsWith('<') ? t : `<${t}>`;
}

function baseSubject(subject: string): string {
  return subject.replace(/^(\s*(re|fw|fwd|aw)\s*(\[\d+\])?\s*:\s*)+/i, '').trim().toLowerCase();
}

function isAutomated(p: InboundPayload): boolean {
  if (p.autoSubmitted && p.autoSubmitted.trim().toLowerCase() !== 'no') return true;
  if (p.precedence && /bulk|list|junk|auto_reply/i.test(p.precedence)) return true;
  return !!p.autoReply;
}

function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function findThread(p: InboundPayload, fromEmail: string): Promise<{ id: string } | null> {
  const recipientLocal = p.recipient.split('@')[0];

  const conv = recipientLocal.match(/^reply\+c-([a-z0-9]+)$/i);
  if (conv) {
    const found = await prisma.conversation.findUnique({ where: { id: conv[1] }, select: { id: true } });
    if (found) return found;
  }

  const ids = [p.inReplyTo, ...(p.references ?? '').split(/\s+/)]
    .filter((x): x is string => !!x && x.trim().length > 2)
    .map(normalizeId);
  if (ids.length) {
    const msg = await prisma.message.findFirst({
      where: { messageIdHeader: { in: ids } },
      orderBy: { createdAt: 'desc' },
      select: { conversationId: true },
    });
    if (msg) return { id: msg.conversationId };
  }

  const subject = baseSubject(p.subject);
  if (subject) {
    const candidates = await prisma.conversation.findMany({
      where: {
        status: { not: ConversationStatus.CLOSED },
        lastMessageAt: { gte: new Date(Date.now() - THIRTY_DAYS_MS) },
        person: { email: fromEmail },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 20,
      select: { id: true, subject: true },
    });
    const match = candidates.find((c) => baseSubject(c.subject) === subject);
    if (match) return { id: match.id };
  }
  return null;
}

export async function handleInbound(p: InboundPayload): Promise<InboundResult> {
  const fromEmail = (p.from?.address ?? p.envelopeFrom).toLowerCase();
  const fromName = p.from?.name?.trim() || null;

  // Mail from our own domain (e.g. a notice looping back) never becomes a conversation
  if (fromEmail.endsWith(`@${brand.domain}`)) return { result: 'ignored', reason: 'own domain' };

  const messageIdHeader = p.messageId ? normalizeId(p.messageId) : null;
  if (messageIdHeader && (await prisma.message.findUnique({ where: { messageIdHeader }, select: { id: true } }))) {
    return { result: 'duplicate', reason: 'message already recorded' };
  }

  const automated = isAutomated(p);
  const newsletter = p.recipient.split('@')[0].match(/^reply\+n-([a-z0-9]+)$/i);
  const fullText = p.text.trim() || (p.html ? htmlToText(p.html) : '');
  // Keep only what the sender newly wrote; the quoted history is stored separately
  const { visible: text, quoted: quotedText } = splitQuotedReply(fullText);
  const subject = p.subject.trim() || '(no subject)';

  let conversationId: string | null = null;
  let channel: ConversationChannel = ConversationChannel.EMAIL;
  let issue: { id: string; subject: string } | null = null;

  if (newsletter) {
    if (automated) return { result: 'ignored', reason: 'auto-reply to newsletter' };
    issue = await prisma.newsletterIssue.findUnique({ where: { id: newsletter[1] }, select: { id: true, subject: true } });
    channel = ConversationChannel.NEWSLETTER_REPLY;
    if (issue) {
      const existing = await prisma.conversation.findFirst({
        where: { newsletterIssueId: issue.id, person: { email: fromEmail } },
        select: { id: true },
      });
      conversationId = existing?.id ?? null;
    }
  } else {
    conversationId = (await findThread(p, fromEmail))?.id ?? null;
  }

  if (!conversationId && automated) return { result: 'ignored', reason: 'auto-reply with no thread' };

  const person = await upsertPerson(fromEmail, fromName ?? undefined);
  const created = !conversationId;

  if (!conversationId) {
    const conv = await prisma.conversation.create({
      data: {
        sourceSite: brand.siteKey,
        personId: person.id,
        subject,
        channel,
        newsletterIssueId: issue?.id ?? null,
        status: ConversationStatus.OPEN,
        unread: true,
      },
    });
    conversationId = conv.id;
  }

  await prisma.message.create({
    data: {
      conversationId,
      direction: MessageDirection.INBOUND,
      fromEmail,
      fromName,
      toEmail: p.recipient,
      subject,
      text,
      quotedText,
      html: p.html,
      messageIdHeader,
      inReplyTo: p.inReplyTo,
      references: p.references,
      attachments: p.attachments.length ? p.attachments : Prisma.JsonNull,
      meta: automated ? { automated: true } : Prisma.JsonNull,
    },
  });

  // Auto-replies are recorded quietly; real mail (re)opens the thread and notifies
  await prisma.conversation.update({
    where: { id: conversationId },
    data: automated
      ? { lastMessageAt: new Date() }
      : { status: ConversationStatus.OPEN, unread: true, lastMessageAt: new Date() },
  });

  if (!automated) {
    const who = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
    EmailService.notifyAdmin({
      type: issue || newsletter ? 'Newsletter Reply' : 'Email',
      title: issue ? `${issue.subject} — ${fromName ?? fromEmail}` : `${subject} — ${fromName ?? fromEmail}`,
      rows: [
        ['From', who],
        ['To', p.recipient],
        ...(p.attachments.length ? ([['Attachments', p.attachments.map((a) => a.filename ?? 'unnamed').join(', ')]] as [string, string][]) : []),
      ],
      body: text.slice(0, 4000),
    }, { replyTo: fromEmail });
  }

  console.log(`[inbound] ${created ? 'new' : 'appended'} ${channel.toLowerCase()} from ${EmailService.maskEmail(fromEmail)}${automated ? ' (auto)' : ''}`);
  return { result: created ? 'created' : 'appended', conversationId };
}
