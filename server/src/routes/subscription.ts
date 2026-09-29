// src/routes/subscription.ts
// Public confirm / unsubscribe / preferences pages.
// GET never changes state (mail scanners prefetch links) — it renders a form that POSTs.
// POST /unsubscribe also serves RFC 8058 one-click unsubscribe (params in the query string).
//   /unsubscribe?t=TOKEN            → unsubscribe from everything
//   /unsubscribe?t=TOKEN&l=LIST&i=ISSUE → leave one list (issue recorded for stats)

import { Router, Request, Response } from 'express';
import * as SubscriberService from '../services/SubscriberService';
import { renderPublicPage } from '../lib/publicPage';
import { escapeHtml } from '../lib/email/layout';
import { brand } from '../lib/brand';

const router = Router();

function param(req: Request, name: string): string {
  const fromBody = (req.body as Record<string, unknown> | undefined)?.[name];
  const fromQuery = req.query[name];
  const value = typeof fromBody === 'string' ? fromBody : typeof fromQuery === 'string' ? fromQuery : '';
  return value.trim();
}

const tokenFrom = (req: Request) => param(req, 't').toLowerCase();
const listFrom = (req: Request) => param(req, 'l') || undefined;
const issueFrom = (req: Request) => param(req, 'i') || undefined;

const INVALID = {
  title: 'Link not valid',
  heading: 'This link isn’t valid',
  message: 'It may have been mistyped or replaced by a newer link. You can subscribe again from the home page.',
};

const ERROR = {
  title: 'Error',
  heading: 'Something went wrong',
  message: 'Please try the link again in a moment.',
};

function send(res: Response, page: Parameters<typeof renderPublicPage>[0], status = 200) {
  res.status(status).type('html').send(renderPublicPage(page));
}

// ─── Confirm ────────────────────────────────────────────────────────────────

router.get('/confirm', async (req: Request, res: Response) => {
  const token = tokenFrom(req);
  const state = await SubscriberService.peekConfirm(token);
  if (state === 'invalid') return send(res, INVALID, 404);
  send(res,
    state === 'ok'
      ? { title: 'Confirm subscription', heading: 'Confirm your subscription',
          message: `One click and you’re on the list for updates from ${brand.name}.`,
          form: { action: '/confirm', token, button: 'Confirm subscription' } }
    : state === 'already'
      ? { title: 'Already confirmed', heading: 'You’re already on the list', message: 'Your subscription is confirmed. Thank you.' }
    : { title: 'Unsubscribed', heading: 'This subscription was cancelled', message: 'You can subscribe again from the home page at any time.' });
});

router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const state = await SubscriberService.confirm(tokenFrom(req));
    if (state === 'invalid') return send(res, INVALID, 404);
    send(res,
      state === 'unsubscribed'
        ? { title: 'Unsubscribed', heading: 'This subscription was cancelled', message: 'You can subscribe again from the home page at any time.' }
        : { title: 'Subscription confirmed', heading: 'You’re on the list',
            message: `Thank you for confirming. We’ll be in touch as ${brand.name} takes shape.` });
  } catch (err) {
    console.error('[confirm] error', err);
    send(res, ERROR, 500);
  }
});

// ─── Unsubscribe ────────────────────────────────────────────────────────────

function hiddenFields(fields: Record<string, string | undefined>): string {
  return Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(v!)}">`)
    .join('');
}

router.get('/unsubscribe', async (req: Request, res: Response) => {
  const token = tokenFrom(req);
  const listKey = listFrom(req);
  const peek = await SubscriberService.peekUnsubscribe(token, listKey);
  if (peek.state === 'invalid') return send(res, INVALID, 404);
  const prefs = [{ href: SubscriberService.preferencesUrl(token), label: 'Manage all preferences' }];

  if (peek.state === 'already') {
    return send(res, {
      title: 'Unsubscribed', heading: 'You’re unsubscribed',
      message: peek.listName ? `You won’t receive ${peek.listName} emails.` : 'You won’t receive further newsletter emails.',
      clearSubscribedFlag: !listKey, links: prefs,
    });
  }
  const what = peek.listName ?? `all ${brand.name} newsletters`;
  send(res, {
    title: 'Unsubscribe',
    heading: `Unsubscribe from ${what}?`,
    message: 'You can resubscribe at any time.',
    customHtml: `<form method="post" action="/unsubscribe">
        ${hiddenFields({ t: token, l: listKey, i: issueFrom(req) })}
        <button type="submit">Unsubscribe</button>
      </form>`,
    links: prefs,
  });
});

router.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const token = tokenFrom(req);
    const listKey = listFrom(req);
    const result = await SubscriberService.unsubscribe(token, listKey, issueFrom(req));
    if (result.state === 'invalid') return send(res, INVALID, 404);
    send(res, {
      title: 'Unsubscribed',
      heading: 'You’re unsubscribed',
      message: result.listName
        ? `You won’t receive ${result.listName} emails. Thank you for your interest in ${brand.name}.`
        : `You won’t receive further newsletter emails. Thank you for your interest in ${brand.name}.`,
      clearSubscribedFlag: !listKey,
      links: [{ href: SubscriberService.preferencesUrl(token), label: 'Manage preferences' }],
    });
  } catch (err) {
    console.error('[unsubscribe] error', err);
    send(res, ERROR, 500);
  }
});

// ─── Preferences ────────────────────────────────────────────────────────────

function preferencesForm(token: string, prefs: SubscriberService.Preferences, saved: boolean): string {
  const items = prefs.lists.map((l) => `
      <li><label>
        <input type="checkbox" name="lists" value="${escapeHtml(l.key)}"${l.subscribed ? ' checked' : ''}>
        <div><strong>${escapeHtml(l.name)}</strong>${l.description ? `<span>${escapeHtml(l.description)}</span>` : ''}</div>
      </label></li>`).join('');
  return `${saved ? '<p class="saved">Preferences saved.</p>' : ''}
    <form method="post" action="/preferences">
      <input type="hidden" name="t" value="${escapeHtml(token)}">
      <ul class="lists">${items}</ul>
      <button type="submit">Save preferences</button>
      <button type="submit" name="none" value="1" class="secondary">Unsubscribe from everything</button>
    </form>`;
}

router.get('/preferences', async (req: Request, res: Response) => {
  const token = tokenFrom(req);
  const prefs = await SubscriberService.getPreferences(token);
  if (!prefs) return send(res, INVALID, 404);
  send(res, {
    title: 'Email preferences',
    heading: 'Email preferences',
    message: `Choose which newsletters ${prefs.email} receives.`,
    customHtml: preferencesForm(token, prefs, false),
  });
});

router.post('/preferences', async (req: Request, res: Response) => {
  try {
    const token = tokenFrom(req);
    const raw = (req.body as Record<string, unknown> | undefined)?.lists;
    const none = param(req, 'none') === '1';
    const selected = none ? [] : (Array.isArray(raw) ? raw : [raw]).filter((v): v is string => typeof v === 'string');
    const prefs = await SubscriberService.savePreferences(token, selected);
    if (!prefs) return send(res, INVALID, 404);
    send(res, {
      title: 'Email preferences',
      heading: 'Email preferences',
      message: `Choose which newsletters ${prefs.email} receives.`,
      customHtml: preferencesForm(token, prefs, true),
      clearSubscribedFlag: !prefs.lists.some((l) => l.subscribed),
    });
  } catch (err) {
    console.error('[preferences] error', err);
    send(res, ERROR, 500);
  }
});

export default router;
