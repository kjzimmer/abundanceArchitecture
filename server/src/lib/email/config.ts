// src/lib/email/config.ts
// Email-related environment configuration, read at call time so tests/dev can vary it.

import { brand } from '../brand';

export type EmailMode = 'live' | 'log' | 'redirect';

export function emailMode(): EmailMode {
  const mode = process.env.EMAIL_MODE;
  return mode === 'live' || mode === 'redirect' ? mode : 'log';
}

export function emailFrom(): string {
  return process.env.EMAIL_FROM || brand.from;
}

/** Sender for admin notices — kept separate from the subscriber-facing EMAIL_FROM */
export function emailNotifyFrom(): string {
  return process.env.EMAIL_NOTIFY_FROM || brand.notifyFrom;
}

/** Bare address from EMAIL_FROM, e.g. hello@example.com */
export function emailFromAddress(): string {
  const from = emailFrom();
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim().toLowerCase();
}

export function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
}

/** Resend plan's daily send cap (free = 100). Newsletter sends stay under it minus the reserve */
export function dailyLimit(): number {
  return Number(process.env.EMAIL_DAILY_LIMIT) || 100;
}

/** Headroom kept for acknowledgements/notices so a newsletter never starves them */
export function transactionalReserve(): number {
  const v = Number(process.env.EMAIL_TRANSACTIONAL_RESERVE);
  return Number.isFinite(v) && v >= 0 && process.env.EMAIL_TRANSACTIONAL_RESERVE !== undefined ? v : 20;
}

/** CAN-SPAM physical address for newsletter footers. Live newsletter sends are blocked without it */
export function newsletterPostalAddress(): string | null {
  // Accept a literal "\n" as a line break — env var editors rarely allow real newlines
  return process.env.NEWSLETTER_POSTAL_ADDRESS?.replace(/\\n/g, '\n').trim() || null;
}

export function adminNotifyEmail(): string | null {
  return process.env.ADMIN_NOTIFY_EMAIL?.trim() || null;
}
