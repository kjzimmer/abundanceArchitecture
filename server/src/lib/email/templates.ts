// src/lib/email/templates.ts
// Typed email templates. Each returns subject + html + plain-text parts.

import { renderLayout, escapeHtml, button, s } from './layout';
import { publicBaseUrl } from './config';
import { brand } from '../brand';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const SIGNOFF_TEXT = `— ${brand.name}\nhttps://${brand.domain}`;
const INTEREST_LINE = `Thank you for your interest in ${brand.name} — ${brand.tagline}.`;

export function subscribeConfirm(confirmUrl: string): RenderedEmail {
  const siteUrl = publicBaseUrl();
  const subject = `Confirm your subscription to ${brand.name}`;
  const html = renderLayout({
    siteUrl,
    preheader: 'One click to confirm — then you are on the list.',
    bodyHtml: `
      <h1 style="${s.h1}">Please confirm your subscription</h1>
      <p style="${s.p}">${escapeHtml(INTEREST_LINE)}</p>
      <p style="${s.p}">To start receiving updates, confirm your email address:</p>
      ${button(confirmUrl, 'Confirm subscription')}
      <p style="${s.small}">If the button doesn't work, paste this link into your browser:<br><a href="${escapeHtml(confirmUrl)}" style="${s.link}word-break:break-all;">${escapeHtml(confirmUrl)}</a></p>`,
    footerHtml: `<p style="${s.small}">If you didn't sign up, you can ignore this email — you won't be subscribed.</p>`,
  });
  const text = [
    'Please confirm your subscription',
    '',
    INTEREST_LINE,
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

/**
 * Admin-initiated invitation for someone we've corresponded with. Same double opt-in as
 * subscribeConfirm — nothing changes unless they click — with wording that fits an invite.
 */
export function subscribeInvite(confirmUrl: string, name: string | null): RenderedEmail {
  const siteUrl = publicBaseUrl();
  const greeting = name ? `Hi ${name.split(/\s+/)[0]},` : 'Hello,';
  const subject = `An invitation to follow ${brand.name}`;
  const intro = `Since we've been in touch, I wanted to invite you to receive occasional updates from ${brand.name} — ${brand.tagline}.`;
  const html = renderLayout({
    siteUrl,
    preheader: 'Occasional updates — one click to join, and you can leave anytime.',
    bodyHtml: `
      <p style="${s.p}">${escapeHtml(greeting)}</p>
      <p style="${s.p}">${escapeHtml(intro)}</p>
      <p style="${s.p}">If you'd like to join, just confirm below. If not, no action is needed — you won't be added.</p>
      ${button(confirmUrl, 'Yes, keep me updated')}
      <p style="${s.small}">If the button doesn't work, paste this link into your browser:<br><a href="${escapeHtml(confirmUrl)}" style="${s.link}word-break:break-all;">${escapeHtml(confirmUrl)}</a></p>`,
    footerHtml: `<p style="${s.small}">You're receiving this one-time invitation because we've corresponded. You won't be subscribed unless you confirm.</p>`,
  });
  const text = [
    greeting,
    '',
    intro,
    '',
    "If you'd like to join, confirm here (if not, no action is needed — you won't be added):",
    confirmUrl,
    '',
    SIGNOFF_TEXT,
  ].join('\n');
  return { subject, html, text };
}

// Deliberately echoes nothing the sender typed — the contact form must not be usable
// to deliver arbitrary content to arbitrary addresses.
export function contactAck(): RenderedEmail {
  const siteUrl = publicBaseUrl();
  const subject = `We received your message — ${brand.name}`;
  const html = renderLayout({
    siteUrl,
    preheader: 'Thanks for reaching out — we will reply personally.',
    bodyHtml: `
      <h1 style="${s.h1}">Thank you for reaching out</h1>
      <p style="${s.p}">Your message has arrived safely. Every message is read personally, and we'll reply as soon as we can.</p>
      <p style="${s.p}">If you need to add anything, simply reply to this email.</p>`,
    footerHtml: `<p style="${s.small}">You're receiving this because this address was entered in the contact form at ${escapeHtml(brand.domain)}. If that wasn't you, no action is needed.</p>`,
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
 * One-time confirmation after an unsubscribe. Goes to the subscriber's own address, so if a
 * forwarded email's link was used by someone else, the owner can undo it. Strictly transactional.
 * listNames empty = unsubscribed from everything.
 */
export function unsubscribeConfirm(listNames: string[], preferencesUrl: string): RenderedEmail {
  const siteUrl = publicBaseUrl();
  const what = listNames.length ? listNames.join(', ') : `all ${brand.name} newsletters`;
  const subject = `You've been unsubscribed — ${brand.name}`;
  const html = renderLayout({
    siteUrl,
    preheader: `You won't receive ${what} emails. Changed your mind? Resubscribe in one click.`,
    bodyHtml: `
      <h1 style="${s.h1}">You’ve been unsubscribed</h1>
      <p style="${s.p}">You won’t receive any more emails from <strong>${escapeHtml(what)}</strong>.</p>
      <p style="${s.p}">If this wasn’t you (for example, if you forwarded one of our emails and someone else used its link), or you’ve simply changed your mind, you can resubscribe here:</p>
      ${button(preferencesUrl, 'Review my subscriptions')}`,
    footerHtml: `<p style="${s.small}">This is a one-time confirmation of your request. No further newsletters will be sent unless you resubscribe.</p>`,
  });
  const text = [
    'You’ve been unsubscribed',
    '',
    `You won’t receive any more emails from ${what}.`,
    '',
    'If this wasn’t you (for example, if you forwarded one of our emails and someone else used its link), or you’ve simply changed your mind, you can resubscribe here:',
    preferencesUrl,
    '',
    'This is a one-time confirmation of your request. No further newsletters will be sent unless you resubscribe.',
    '',
    SIGNOFF_TEXT,
  ].join('\n');
  return { subject, html, text };
}

/**
 * Admin notification. Subject prefix `[{brand.code} {type}]` (e.g. `[AA Inquiry]`) is stable so
 * Gmail filters can label it.
 * Rows and body come from untrusted input and are escaped here.
 */
export type NoticeType =
  | 'Inquiry'
  | 'Subscriber'
  | 'Unsubscribe'
  | 'Deliverability'
  | 'Newsletter'
  | 'Email'
  | 'Newsletter Reply'
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
  const subject = `[${brand.code} ${type}] ${title}`.replace(/[\r\n]+/g, ' ').slice(0, 200);

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
