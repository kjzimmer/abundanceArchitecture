// src/middleware/reviewGate.ts
// Access gate for the site draft: every page needs a valid reviewer cookie, set by opening a signed
// review link (/r/<token>). Fails closed: without REVIEW_LINK_SECRET nobody gets in.

import { Request, Response, NextFunction } from 'express';
import { renderPublicPage } from '../lib/publicPage';
import { REVIEW_COOKIE, REVIEW_COOKIE_MAX_AGE_MS, Reviewer, verifyReviewToken } from '../site/review';

export function reviewerOf(res: Response): Reviewer | null {
  return (res.locals.reviewer as Reviewer | undefined) ?? null;
}

export function sendPrivateDraftPage(res: Response): void {
  res.status(403).type('html').send(renderPublicPage({
    title: 'Private draft',
    heading: 'This draft is private',
    message: 'Open the review link you were sent. If it has stopped working, ask for a new one.',
    noHomeLink: true,
  }));
}

export function reviewGate(req: Request, res: Response, next: NextFunction): void {
  const reviewer = verifyReviewToken(req.cookies?.[REVIEW_COOKIE]);
  if (!reviewer) {
    sendPrivateDraftPage(res);
    return;
  }
  res.locals.reviewer = reviewer;
  next();
}

/** Owner-only pages (draft flags). Runs after reviewGate */
export function ownerOnly(_req: Request, res: Response, next: NextFunction): void {
  if (reviewerOf(res)?.role !== 'owner') {
    res.status(404).type('text').send('Not found');
    return;
  }
  next();
}

/** GET /r/:token — exchange a review link for the cookie, then drop the token from the address bar */
export function acceptReviewLink(req: Request, res: Response): void {
  const token = String(req.params.token ?? '');
  if (!verifyReviewToken(token)) {
    sendPrivateDraftPage(res);
    return;
  }
  res.cookie(REVIEW_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REVIEW_COOKIE_MAX_AGE_MS,
    path: '/',
  });
  res.redirect(303, '/');
}
