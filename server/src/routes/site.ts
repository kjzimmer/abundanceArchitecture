// src/routes/site.ts
// The site draft (docs/wip/site-draft.md). Mounted only when SITE_MODE=draft, ahead of express.static so
// "/" is the new Home rather than the frozen teaser. Every page sits behind the reviewer gate.

import { Router, Request, Response } from 'express';
import { content } from '../content/load';
import { acceptReviewLink, ownerOnly, reviewerOf, reviewGate } from '../middleware/reviewGate';
import { renderPage } from '../site/layout';
import { notFoundPage, PageBody, signInPage } from '../site/pages/common';
import {
  aboutPage, askPage, bookPage, joinPage, learnPage, licencePage, reportPage,
} from '../site/pages/sections';
import { flagsPage } from '../site/pages/flags';
import { homePage } from '../site/pages/home';
import { domainPage, domainsPage } from '../site/pages/domains';
import { initiativePage, initiativesPage } from '../site/pages/initiatives';
import { questionPage, questionsPage } from '../site/pages/questions';
import { signPage, signsPage } from '../site/pages/signs';
import { referencePage, referencesPage } from '../site/pages/references';

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

  page('/', () => homePage(c));
  page('/domains', () => domainsPage(c));
  page('/domains/:slug', (req) => {
    const d = c.domain(slug(req));
    return d ? domainPage(c, d) : null;
  });
  page('/questions', (req) => questionsPage(c, req.query));
  page('/questions/:slug', (req) => {
    const q = c.question(slug(req));
    return q ? questionPage(c, q) : null;
  });
  page('/learn', () => learnPage(c));
  page('/vital-signs', () => signsPage(c));
  page('/vital-signs/:slug', (req) => {
    const s = c.sign(slug(req));
    return s ? signPage(c, s) : null;
  });
  page('/initiatives', (req) => initiativesPage(c, req.query));
  page('/initiatives/:slug', (req) => {
    const i = c.initiative(slug(req));
    return i ? initiativePage(c, i) : null;
  });
  page('/book', () => bookPage(c));
  page('/report', () => reportPage(c));
  page('/join', () => joinPage(c));
  page('/references', (req) => referencesPage(c, req.query));
  page('/references/:slug', (req) => {
    const r = c.reference(slug(req));
    return r ? referencePage(c, r) : null;
  });
  page('/about', () => aboutPage(c));
  page('/licence', () => licencePage(c));
  page('/ask', () => askPage(c));
  page('/sign-in', () => signInPage());

  return router;
}
