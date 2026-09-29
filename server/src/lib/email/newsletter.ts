// src/lib/email/newsletter.ts
// Newsletter rendering: Markdown → email-safe HTML (inline styles) inside the brand layout,
// plus a plain-text part. Per-recipient links are placeholders so an issue is rendered once
// and personalized per recipient with personalize().

import { Marked } from 'marked';
import { renderLayout, escapeHtml, s, EMAIL_COLORS } from './layout';
import { publicBaseUrl, newsletterPostalAddress } from './config';
import { brand } from '../brand';
import type { RenderedEmail } from './templates';

export const UNSUBSCRIBE_PLACEHOLDER = '%%UNSUBSCRIBE_URL%%';
export const PREFERENCES_PLACEHOLDER = '%%PREFERENCES_URL%%';

const markdown = new Marked({ gfm: true, breaks: false });

const SERIF = brand.fonts.serif;
const SANS = brand.fonts.sans;
const c = EMAIL_COLORS;

// Inline styles per tag. Email clients ignore <style>, so every element carries its own.
const TAG_STYLES: Record<string, string> = {
  h1: s.h1,
  h2: `margin:28px 0 12px;font-family:${SERIF};font-size:23px;line-height:1.25;font-weight:normal;color:${c.ink};`,
  h3: `margin:24px 0 10px;font-family:${SANS};font-size:13px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:${c.accent};`,
  h4: `margin:20px 0 8px;font-family:${SERIF};font-size:18px;font-weight:bold;color:${c.ink};`,
  p: s.p,
  a: s.link,
  ul: `margin:0 0 16px;padding-left:24px;font-family:${SERIF};font-size:18px;line-height:1.65;color:${c.ink};`,
  ol: `margin:0 0 16px;padding-left:24px;font-family:${SERIF};font-size:18px;line-height:1.65;color:${c.ink};`,
  li: 'margin:0 0 6px;',
  blockquote: `margin:0 0 16px;padding:2px 0 2px 16px;border-left:2px solid ${c.accent};color:${c.muted};font-style:italic;`,
  hr: `border:none;border-top:1px solid ${c.rule};margin:28px 0;`,
  img: 'max-width:100%;height:auto;display:block;margin:0 0 16px;border:0;',
  pre: `margin:0 0 16px;padding:12px 16px;background:#ffffff;overflow-x:auto;font-size:14px;`,
  code: `font-family:Menlo,Consolas,monospace;font-size:15px;background:#ffffff;padding:1px 4px;`,
};

/** Adds inline styles to Markdown output. Tags that already carry a style (raw HTML) are left alone. */
function inlineStyles(html: string): string {
  return html.replace(/<(h[1-4]|p|a|ul|ol|li|blockquote|hr|img|pre|code)(\s[^>]*)?>/g, (match, tag: string, attrs = '') => {
    if (/\sstyle=/.test(attrs)) return match;
    const style = TAG_STYLES[tag];
    return style ? `<${tag} style="${style}"${attrs}>` : match;
  });
}

export function markdownToHtml(md: string): string {
  return inlineStyles(markdown.parse(md, { async: false }) as string);
}

/** Readable plain-text version: links become "text (url)", emphasis markers dropped. */
export function markdownToText(md: string): string {
  return md
    .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, '$1 ($2)')
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, '$1 ($2)')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, '$1$2')
    .replace(/^>\s?/gm, '  ')
    .replace(/<[^>]+>/g, '')
    .trim();
}

export interface IssueContent {
  subject: string;
  preheader?: string | null;
  markdown: string;
  listName: string;
}

/**
 * Renders an issue with placeholder links. Postal address is required by CAN-SPAM; when unset the
 * footer shows a visible reminder (fine for previews/tests — live sends are blocked upstream).
 */
export function renderIssue(issue: IssueContent): RenderedEmail {
  const siteUrl = publicBaseUrl();
  const postal = newsletterPostalAddress() ?? '[Postal address not set — NEWSLETTER_POSTAL_ADDRESS]';

  const footerHtml = `
    <p style="${s.small}">You're receiving ${escapeHtml(issue.listName)} because you subscribed at ${escapeHtml(brand.domain)}.</p>
    <p style="${s.small}">
      <a href="${UNSUBSCRIBE_PLACEHOLDER}" style="color:${c.muted};">Unsubscribe from this newsletter</a>
      &nbsp;·&nbsp;
      <a href="${PREFERENCES_PLACEHOLDER}" style="color:${c.muted};">Manage preferences</a>
    </p>
    <p style="${s.small}">${escapeHtml(postal).replace(/\n/g, '<br>')}</p>`;

  const html = renderLayout({
    siteUrl,
    preheader: issue.preheader ?? '',
    bodyHtml: markdownToHtml(issue.markdown),
    footerHtml,
  });

  const text = [
    markdownToText(issue.markdown),
    '',
    '—',
    `You're receiving ${issue.listName} because you subscribed at ${brand.domain}.`,
    `Unsubscribe: ${UNSUBSCRIBE_PLACEHOLDER}`,
    `Manage preferences: ${PREFERENCES_PLACEHOLDER}`,
    postal,
  ].join('\n');

  return { subject: issue.subject, html, text };
}

/** Swaps placeholders for one recipient's links (HTML-escaped in the html part, raw in text). */
export function personalize(rendered: RenderedEmail, urls: { unsubscribe: string; preferences: string }): RenderedEmail {
  const swap = (v: string, unsub: string, prefs: string) =>
    v.split(UNSUBSCRIBE_PLACEHOLDER).join(unsub).split(PREFERENCES_PLACEHOLDER).join(prefs);
  return {
    subject: rendered.subject,
    html: swap(rendered.html, escapeHtml(urls.unsubscribe), escapeHtml(urls.preferences)),
    text: swap(rendered.text, urls.unsubscribe, urls.preferences),
  };
}
