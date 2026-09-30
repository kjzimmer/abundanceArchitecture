// src/lib/email/reply.ts
// Personal-style email for Inbox replies and composed messages: plain paragraphs, signature,
// quoted previous message. Deliberately NOT the branded newsletter layout — one-to-one mail
// should look like a person wrote it (better for readers and for deliverability).

import { escapeHtml } from './layout';
import { brand } from '../brand';

export interface QuotedMessage {
  fromName: string | null;
  fromEmail: string;
  date: Date;
  text: string;
}

export interface ReplyInput {
  body: string;
  signature: string | null;
  quoted?: QuotedMessage | null;
}

const FONT = brand.fonts.sans;

function paragraphs(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function attribution(q: QuotedMessage): string {
  const who = q.fromName ? `${q.fromName} <${q.fromEmail}>` : q.fromEmail;
  const when = q.date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
  return `On ${when}, ${who} wrote:`;
}

export function renderReply({ body, signature, quoted }: ReplyInput): { html: string; text: string } {
  const sig = signature?.trim();
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:16px;font-family:${FONT};font-size:15px;line-height:1.55;color:${brand.colors.ink};">
${paragraphs(body)}
${sig ? `<p style="margin:18px 0 0;color:${brand.colors.inkLight};">${escapeHtml(sig).replace(/\n/g, '<br>')}</p>` : ''}
${quoted ? `<div style="margin-top:24px;color:${brand.colors.inkLight};font-size:14px;">
  <p style="margin:0 0 8px;">${escapeHtml(attribution(quoted))}</p>
  <blockquote style="margin:0;padding:0 0 0 12px;border-left:2px solid ${brand.colors.rule};">${paragraphs(quoted.text)}</blockquote>
</div>` : ''}
</body></html>`;

  const text = [
    body.trim(),
    ...(sig ? ['', sig] : []),
    ...(quoted ? ['', attribution(quoted), ...quoted.text.trim().split('\n').map((l) => `> ${l}`)] : []),
  ].join('\n');

  return { html, text };
}

/** "Re: subject" without stacking "Re: Re: …" */
export function replySubject(subject: string): string {
  return /^\s*re:/i.test(subject) ? subject.trim() : `Re: ${subject.trim()}`;
}
