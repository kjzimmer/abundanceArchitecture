// src/lib/turnstile.ts
// Cloudflare Turnstile server-side verification.
// If TURNSTILE_SECRET_KEY is unset (local dev), verification is skipped.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

let warned = false;

export function turnstileSiteKey(): string | null {
  return process.env.TURNSTILE_SITE_KEY?.trim() || null;
}

export async function verifyTurnstile(token: unknown, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (!warned) {
      console.warn('[turnstile] TURNSTILE_SECRET_KEY not set — verification skipped');
      warned = true;
    }
    return true;
  }
  if (typeof token !== 'string' || !token) {
    // Usually a stale cached main.js (pre-Turnstile) or the widget failing to load in the browser
    console.warn('[turnstile] missing token — rejected');
    return false;
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const res = await fetch(VERIFY_URL, { method: 'POST', body });
    const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] };
    if (!data.success) console.warn('[turnstile] rejected:', data['error-codes']);
    return data.success;
  } catch (err) {
    // Fail closed — a Cloudflare outage blocks form posts rather than letting bots through
    console.error('[turnstile] verify request failed:', err);
    return false;
  }
}
