// src/routes/site.ts
// The site draft (docs/wip/site-draft.md). Mounted only when SITE_MODE=draft, ahead of express.static so
// "/" is the new Home rather than the frozen teaser. Every page sits behind the reviewer gate.

import { Router, Request, Response } from 'express';
import { content } from '../content/load';
import { acceptReviewLink, ownerOnly, reviewerOf, reviewGate } from '../middleware/reviewGate';
import { renderPage } from '../site/layout';
import { notFoundPage, PageBody, signInPage, stubPage } from '../site/pages/common';
import { flagsPage } from '../site/pages/flags';
import { homePage } from '../site/pages/home';

export function createSiteRouter(): Router {
  // Load now so invalid content fails startup (and the deploy) instead of a page request
  const c = content();
  const router = Router();

  const send = (req: Request, res: Response, page: PageBody, status = 200) => {
    res.status(status).type('html').send(renderPage({
      ...page,
      path: req.path,
      reviewer: reviewerOf(res),
      flagCount: c.flags.length,
    }));
  };
  const page = (path: string | string[], build: (req: Request) => PageBody | null) => {
    router.get(path, reviewGate, (req, res) => {
      const body = build(req);
      if (body) send(req, res, body);
      else send(req, res, notFoundPage(), 404);
    });
  };
  const slug = (req: Request) => String(req.params.slug);

  router.get('/r/:token', acceptReviewLink);
  router.get('/review/flags', reviewGate, ownerOnly, (req, res) => send(req, res, flagsPage(c)));

  // Built stage by stage; stubs until then (brief §10)
  page('/', () => homePage(c));
  page('/domains', () => stubPage('Domains'));
  page('/domains/:slug', (req) => (c.domain(slug(req)) ? stubPage(c.domain(slug(req))!.name) : null));
  page('/questions', () => stubPage('Questions'));
  page('/questions/:slug', (req) => (c.question(slug(req)) ? stubPage('Question') : null));
  page('/learn', () => stubPage('Learn'));
  page('/vital-signs', () => stubPage('Vital Signs'));
  page('/vital-signs/:slug', (req) => (c.sign(slug(req)) ? stubPage(c.sign(slug(req))!.name) : null));
  page('/initiatives', () => stubPage('Initiatives'));
  page('/initiatives/:slug', (req) => (c.initiative(slug(req)) ? stubPage(c.initiative(slug(req))!.name) : null));
  page('/book', () => stubPage('Book'));
  page('/report', () => stubPage('Report'));
  page('/join', () => stubPage('Join'));
  page('/references', () => stubPage('References'));
  page('/references/:slug', (req) => (c.reference(slug(req)) ? stubPage('Reference') : null));
  page('/about', () => stubPage('About'));
  page('/licence', () => stubPage('Licence'));
  page('/ask', () => stubPage('Ask a question'));
  page('/sign-in', () => signInPage());

  return router;
}
