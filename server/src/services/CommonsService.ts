// src/services/CommonsService.ts
// Abundance Architecture's client for the knowledge commons (docs/wip/knowledge-commons.md). AA has no privileged
// access: it uses only the commons' public interface, identified by its site key, like any other site.
// COMMONS_URL = the commons app's address; COMMONS_SITE_KEY = AA's key, issued by the commons.

export interface CommonsReviewer {
  name: string;
  email: string;
}

export interface EntrySummary {
  id: string;
  url: string;
  claim: string;
  evidence: { level: string };
  agreement: { status: string; why: string };
  review: string;
  aiDrafted: boolean;
}

export interface HolonAnswer {
  sessionId: string | null;
  answer: { markdown: string; html: string };
  cited: { entries: string[]; questions: string[] };
  gaps: number;
  agent: { name: string; provider: string; model: string; instructions: string };
  costUsd: number;
}

export class CommonsError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function base(): string | null {
  const u = process.env.COMMONS_URL?.trim();
  return u ? u.replace(/\/$/, '') : null;
}

export function commonsConfigured(): boolean {
  return Boolean(base() && process.env.COMMONS_SITE_KEY);
}

export function commonsUrl(path = '/'): string | null {
  const b = base();
  return b ? `${b}${path}` : null;
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, timeoutMs = 15000): Promise<T> {
  const b = base();
  const key = process.env.COMMONS_SITE_KEY;
  if (!b || !key) throw new CommonsError(503, 'The commons is not connected on this deployment.');
  const res = await fetch(`${b}/api/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new CommonsError(res.status, data.error ?? `The commons returned ${res.status}`);
  return data;
}

/** Asks Holon on behalf of a reviewer. The commons applies its own fair-use limits per person */
export function askHolon(question: string, reviewer: CommonsReviewer, sessionId?: string | null): Promise<HolonAnswer> {
  return call<HolonAnswer>('POST', '/holon/ask', { question, sessionId: sessionId ?? null, asker: reviewer }, 120000);
}

export async function shareQuestion(sessionId: string, reviewer: CommonsReviewer): Promise<boolean> {
  const r = await call<{ ok: boolean }>('POST', '/holon/share', { sessionId, asker: { email: reviewer.email } });
  return r.ok;
}

/** A signed link into the commons app for one of AA's reviewers, landing on `to` */
export async function reviewerLink(reviewer: CommonsReviewer, to: string): Promise<string> {
  const r = await call<{ url: string }>('POST', '/reviewer-links', { reviewer, to });
  return r.url;
}

// ─── Entry summaries for citation notes, cached so pages render without waiting on the commons ─────────────

let entries = new Map<string, EntrySummary>();
let lastFetch = 0;
let fetching = false;
const TTL_MS = 10 * 60 * 1000;

async function refreshEntries(): Promise<void> {
  if (fetching || !commonsConfigured()) return;
  fetching = true;
  try {
    const r = await call<{ entries: EntrySummary[] }>('GET', '/entries');
    entries = new Map(r.entries.map((e) => [e.id, e]));
    lastFetch = Date.now();
  } catch (err) {
    console.error('[commons] could not load entries:', err instanceof Error ? err.message : err);
    lastFetch = Date.now() - TTL_MS + 60 * 1000; // retry in a minute
  } finally {
    fetching = false;
  }
}

/** The cached summary of a commons entry, or undefined. Triggers a background refresh when stale */
export function entrySummary(id: string): EntrySummary | undefined {
  if (Date.now() - lastFetch > TTL_MS) void refreshEntries();
  return entries.get(id);
}

/** Warm the cache at startup */
export function startCommonsCache(): void {
  void refreshEntries();
}
