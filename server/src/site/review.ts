// src/site/review.ts
// Signed per-reviewer links for the site draft (docs/wip/site-draft.md, decision 2).
// A token is base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload, REVIEW_LINK_SECRET)).
// Nothing is stored in the database, so links survive staging resets. The same token is the cookie value.
// Revoke one reviewer by adding their email to REVIEW_REVOKED (comma-separated); revoke every link by
// changing REVIEW_LINK_SECRET.

import crypto from 'crypto';

export interface Reviewer {
  name: string;
  email: string;
  /** owner = Karl: also sees draft flags */
  role: 'owner' | 'reviewer';
  /** Issued at (unix seconds) */
  iat: number;
}

export const REVIEW_COOKIE = 'aa_review';
export const REVIEW_COOKIE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function secret(): string | null {
  const s = process.env.REVIEW_LINK_SECRET;
  return s && s.length >= 32 ? s : null;
}

export function reviewSecretConfigured(): boolean {
  return secret() !== null;
}

function sign(payload: string, key: string): string {
  return crypto.createHmac('sha256', key).update(payload).digest('base64url');
}

export function createReviewToken(r: Omit<Reviewer, 'iat'>): string {
  const key = secret();
  if (!key) throw new Error('REVIEW_LINK_SECRET is not set (32+ characters)');
  const payload = Buffer.from(JSON.stringify({ ...r, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
  return `${payload}.${sign(payload, key)}`;
}

function revoked(): Set<string> {
  return new Set(
    (process.env.REVIEW_REVOKED ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
  );
}

/** The reviewer a token was issued to, or null if it is malformed, forged or revoked */
export function verifyReviewToken(token: string | undefined): Reviewer | null {
  const key = secret();
  if (!key || !token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const r = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Reviewer;
    if (typeof r.name !== 'string' || typeof r.email !== 'string') return null;
    if (r.role !== 'owner' && r.role !== 'reviewer') return null;
    if (revoked().has(r.email.toLowerCase())) return null;
    return r;
  } catch {
    return null;
  }
}
