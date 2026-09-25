// src/lib/email/config.ts
// Email-related environment configuration, read at call time so tests/dev can vary it.

export type EmailMode = 'live' | 'log' | 'redirect';

export function emailMode(): EmailMode {
  const mode = process.env.EMAIL_MODE;
  return mode === 'live' || mode === 'redirect' ? mode : 'log';
}

export function emailFrom(): string {
  return process.env.EMAIL_FROM || 'Abundance Architecture <hello@abundancearchitecture.world>';
}

/** Sender for admin notices — kept separate from the subscriber-facing EMAIL_FROM */
export function emailNotifyFrom(): string {
  return process.env.EMAIL_NOTIFY_FROM || 'Abundance Architecture <notify@abundancearchitecture.world>';
}

/** Bare address from EMAIL_FROM, e.g. hello@abundancearchitecture.world */
export function emailFromAddress(): string {
  const from = emailFrom();
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim().toLowerCase();
}

export function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
}

export function adminNotifyEmail(): string | null {
  return process.env.ADMIN_NOTIFY_EMAIL?.trim() || null;
}
