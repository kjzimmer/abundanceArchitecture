// src/lib/email/templates.ts
// Typed email templates. Each returns subject + html + plain-text parts.

import { renderLayout, escapeHtml, button, s } from './layout';
import { publicBaseUrl } from './config';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const SIGNOFF_TEXT = '— Abundance Architecture\nhttps://abundancearchitecture.world';

export function subscribeConfirm(confirmUrl: string): RenderedEmail {
  const siteUrl = publicBaseUrl();
  const subject = 'Confirm your subscription to Abundance Architecture';
  const html = renderLayout({
    siteUrl,
    preheader: 'One click to confirm — then you are on the list.',
    bodyHtml: `
      <h1 style="${s.h1}">Please confirm your subscription</h1>
      <p style="${s.p}">Thank you for your interest in Abundance Architecture — a long-term inquiry into the structural conditions required for human flourishing.</p>
      <p style="${s.p}">To start receiving updates, confirm your email address:</p>
      ${button(confirmUrl, 'Confirm subscription')}
      <p style="${s.small}">If the button doesn't work, paste this link into your browser:<br><a href="${escapeHtml(confirmUrl)}" style="${s.link}word-break:break-all;">${escapeHtml(confirmUrl)}</a></p>`,
    footerHtml: `<p style="${s.small}">If you didn't sign up, you can ignore this email — you won't be subscribed.</p>`,
  });
  const text = [
    'Please confirm your subscription',
    '',
    'Thank you for your interest in Abundance Architecture — a long-term inquiry into the structural conditions required for human flourishing.',
    '',
    'To start receiving updates, confirm your email address:',
    confirmUrl,
    '',
    "If you didn't sign up, you can ignore this email — you won't be subscribed.",
    '',
    SIGNOFF_TEXT,
  ].join('\n');
  return { subject, html, text };
}

// Deliberately echoes nothing the sender typed — the contact form must not be usable
// to deliver arbitrary content to arbitrary addresses.
export function contactAck(): RenderedEmail {
  const siteUrl = publicBaseUrl();
  const subject = 'We received your message — Abundance Architecture';
  const html = renderLayout({
    siteUrl,
    preheader: 'Thanks for reaching out — we will reply personally.',
    bodyHtml: `
      <h1 style="${s.h1}">Thank you for reaching out</h1>
      <p style="${s.p}">Your message has arrived safely. Every message is read personally, and we'll reply as soon as we can.</p>
      <p style="${s.p}">If you need to add anything, simply reply to this email.</p>`,
    footerHtml: `<p style="${s.small}">You're receiving this because this address was entered in the contact form at abundancearchitecture.world. If that wasn't you, no action is needed.</p>`,
  });
  const text = [
    'Thank you for reaching out',
    '',
    "Your message has arrived safely. Every message is read personally, and we'll reply as soon as we can.",
    '',
    'If you need to add anything, simply reply to this email.',
    '',
    SIGNOFF_TEXT,
  ].join('\n');
  return { subject, html, text };
}

/**
 * Admin notification. Subject prefix `[AA {type}]` is stable so Gmail filters can label it.
 * Rows and body come from untrusted input and are escaped here.
 */
export type NoticeType =
  | 'Inquiry'
  | 'Subscriber'
  | 'Unsubscribe'
  | 'Deliverability'
  | 'Test';

export interface NoticeInput {
  type: NoticeType;
  title: string;
  rows?: [string, string][];
  body?: string;
  adminPath?: string; // e.g. '/admin' — linked as "Open in admin"
}

export function adminNotice({ type, title, rows = [], body, adminPath = '/admin' }: NoticeInput): RenderedEmail {
  const siteUrl = publicBaseUrl();
  const adminUrl = `${siteUrl}${adminPath}`;
  // Strip newlines so user input can't break the subject line
  const subject = `[AA ${type}] ${title}`.replace(/[\r\n]+/g, ' ').slice(0, 200);

  const rowsHtml = rows.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
        ${rows.map(([k, v]) => `<tr><td style="${s.label}">${escapeHtml(k)}</td><td style="${s.value}">${escapeHtml(v)}</td></tr>`).join('')}
      </table>`
    : '';

  const html = renderLayout({
    siteUrl,
    preheader: title,
    bodyHtml: `
      <p style="${s.eyebrow}">${escapeHtml(type)}</p>
      <h1 style="${s.h1}">${escapeHtml(title)}</h1>
      ${rowsHtml}
      ${body ? `<div style="${s.pre}">${escapeHtml(body)}</div>` : ''}
      ${button(adminUrl, 'Open in admin')}`,
  });

  const text = [
    `[${type}] ${title}`,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(body ? ['', body] : []),
    '',
    `Open in admin: ${adminUrl}`,
  ].join('\n');

  return { subject, html, text };
}
