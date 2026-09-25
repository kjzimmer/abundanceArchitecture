// src/routes/subscription.ts
// Public confirm + unsubscribe pages.
// GET never changes state (mail scanners prefetch links) — it renders a button that POSTs.
// POST /unsubscribe also serves RFC 8058 one-click unsubscribe (token in query string).

import { Router, Request, Response } from 'express';
import * as SubscriberService from '../services/SubscriberService';
import { renderPublicPage } from '../lib/publicPage';

const router = Router();

function tokenFrom(req: Request): string {
  const fromBody = (req.body as { t?: unknown } | undefined)?.t;
  const fromQuery = req.query.t;
  const value = typeof fromBody === 'string' ? fromBody : typeof fromQuery === 'string' ? fromQuery : '';
  return value.trim().toLowerCase();
}

const INVALID = {
  title: 'Link not valid',
  heading: 'This link isn’t valid',
  message: 'It may have been mistyped or replaced by a newer link. You can subscribe again from the home page.',
};

router.get('/confirm', async (req: Request, res: Response) => {
  const token = tokenFrom(req);
  const state = await SubscriberService.peekConfirm(token);
  const page =
    state === 'ok'
      ? { title: 'Confirm subscription', heading: 'Confirm your subscription',
          message: 'One click and you’re on the list for updates from Abundance Architecture.',
          form: { action: '/confirm', token, button: 'Confirm subscription' } }
    : state === 'already'
      ? { title: 'Already confirmed', heading: 'You’re already on the list', message: 'Your subscription is confirmed. Thank you.' }
    : state === 'unsubscribed'
      ? { title: 'Unsubscribed', heading: 'This subscription was cancelled', message: 'You can subscribe again from the home page at any time.' }
    : INVALID;
  res.status(state === 'invalid' ? 404 : 200).type('html').send(renderPublicPage(page));
});

router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const state = await SubscriberService.confirm(tokenFrom(req));
    const page =
      state === 'ok' || state === 'already'
        ? { title: 'Subscription confirmed', heading: 'You’re on the list',
            message: 'Thank you for confirming. We’ll be in touch as Abundance Architecture takes shape.' }
      : state === 'unsubscribed'
        ? { title: 'Unsubscribed', heading: 'This subscription was cancelled', message: 'You can subscribe again from the home page at any time.' }
      : INVALID;
    res.status(state === 'invalid' ? 404 : 200).type('html').send(renderPublicPage(page));
  } catch (err) {
    console.error('[confirm] error', err);
    res.status(500).type('html').send(renderPublicPage({
      title: 'Error', heading: 'Something went wrong', message: 'Please try the link again in a moment.',
    }));
  }
});

router.get('/unsubscribe', async (req: Request, res: Response) => {
  const token = tokenFrom(req);
  const state = await SubscriberService.peekUnsubscribe(token);
  const page =
    state === 'ok'
      ? { title: 'Unsubscribe', heading: 'Unsubscribe from Abundance Architecture?',
          message: 'You’ll stop receiving newsletter emails. You can resubscribe at any time.',
          form: { action: '/unsubscribe', token, button: 'Unsubscribe' } }
    : state === 'already'
      ? { title: 'Unsubscribed', heading: 'You’re unsubscribed', message: 'You won’t receive further newsletter emails.',
          clearSubscribedFlag: true }
    : INVALID;
  res.status(state === 'invalid' ? 404 : 200).type('html').send(renderPublicPage(page));
});

router.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const state = await SubscriberService.unsubscribe(tokenFrom(req));
    const page =
      state === 'invalid'
        ? INVALID
        : { title: 'Unsubscribed', heading: 'You’re unsubscribed',
            message: 'You won’t receive further newsletter emails. Thank you for your interest in Abundance Architecture.',
            clearSubscribedFlag: true };
    res.status(state === 'invalid' ? 404 : 200).type('html').send(renderPublicPage(page));
  } catch (err) {
    console.error('[unsubscribe] error', err);
    res.status(500).type('html').send(renderPublicPage({
      title: 'Error', heading: 'Something went wrong', message: 'Please try the link again in a moment.',
    }));
  }
});

export default router;
