// src/lib/email/layout.ts
// Shared HTML email shell. Table-based with inline styles, because email clients
// ignore <style> blocks and modern CSS. Colors, fonts and names come from lib/brand.ts.

import { brand } from '../brand';

export const EMAIL_COLORS = {
  ink: brand.colors.ink,
  paper: brand.colors.paper,
  body: brand.colors.card,
  accent: brand.colors.accent,
  muted: brand.colors.inkLight,
  rule: brand.colors.rule,
};

const SERIF = brand.fonts.serif;
const SANS = brand.fonts.sans;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Inline style snippets for template bodies
export const s = {
  h1: `margin:0 0 16px;font-family:${SERIF};font-size:28px;line-height:1.2;font-weight:normal;color:${EMAIL_COLORS.ink};`,
  p: `margin:0 0 16px;font-family:${SERIF};font-size:18px;line-height:1.65;color:${EMAIL_COLORS.ink};`,
  small: `margin:0 0 12px;font-family:${SANS};font-size:13px;line-height:1.5;color:${EMAIL_COLORS.muted};`,
  eyebrow: `margin:0 0 12px;font-family:${SANS};font-size:11px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL_COLORS.accent};`,
  link: `color:${EMAIL_COLORS.accent};text-decoration:underline;`,
  label: `padding:4px 12px 4px 0;font-family:${SANS};font-size:13px;color:${EMAIL_COLORS.muted};vertical-align:top;white-space:nowrap;`,
  value: `padding:4px 0;font-family:${SANS};font-size:14px;color:${EMAIL_COLORS.ink};vertical-align:top;`,
  pre: `margin:16px 0;padding:12px 16px;background:#ffffff;border-left:2px solid ${EMAIL_COLORS.accent};font-family:${SANS};font-size:14px;line-height:1.6;color:${EMAIL_COLORS.ink};white-space:pre-wrap;`,
};

export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr><td style="background:${EMAIL_COLORS.accent};border-radius:2px;">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 28px;font-family:${SANS};font-size:13px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
  </td></tr>
</table>`;
}

interface LayoutInput {
  bodyHtml: string;
  preheader?: string;   // inbox preview text
  footerHtml?: string;  // extra footer lines (e.g. unsubscribe) — already-escaped HTML
  siteUrl: string;
}

export function renderLayout({ bodyHtml, preheader = '', footerHtml = '', siteUrl }: LayoutInput): string {
  const c = EMAIL_COLORS;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(brand.name)}</title>
</head>
<body style="margin:0;padding:0;background:${c.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.paper};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
      <tr><td style="background:${c.ink};padding:22px 32px;">
        <a href="${escapeHtml(siteUrl)}" style="font-family:${SANS};font-size:12px;font-weight:500;letter-spacing:0.12em;color:${c.paper};text-decoration:none;text-transform:uppercase;">${escapeHtml(brand.name)}</a>
      </td></tr>
      <tr><td style="background:${c.body};padding:36px 32px 20px;">
        ${bodyHtml}
      </td></tr>
      <tr><td style="background:${c.body};padding:0 32px 28px;">
        <div style="border-top:1px solid ${c.rule};padding-top:16px;">
          ${footerHtml}
          <p style="${s.small}margin:0;"><a href="${escapeHtml(siteUrl)}" style="color:${c.muted};">${escapeHtml(brand.domain)}</a></p>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
