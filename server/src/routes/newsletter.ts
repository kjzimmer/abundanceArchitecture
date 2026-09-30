// src/routes/newsletter.ts
// Admin: newsletter lists, issues (drafts), preview, test send, send.

import { Router, Request, Response, NextFunction } from 'express';
import { requireAdmin } from '../middleware/auth';
import * as NewsletterService from '../services/NewsletterService';
import { NewsletterError, IssueInput } from '../services/NewsletterService';
import { kickQueue } from '../jobs/newsletterQueue';
import { emailMode, dailyLimit, transactionalReserve } from '../lib/email/config';
import { getSetting } from '../services/SettingsService';

const router = Router();
router.use(requireAdmin);

type Handler<P = Record<string, string>> = (req: Request<P>, res: Response) => Promise<void>;

// Maps NewsletterError to its status; anything else is a 500
function wrap<P>(fn: Handler<P>) {
  return (req: Request<P>, res: Response, next: NextFunction) => {
    fn(req, res).catch((err) => {
      if (err instanceof NewsletterError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      next(err);
    });
  };
}

function body(req: Request<unknown>): IssueInput {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  return {
    listId: str(b.listId),
    subject: str(b.subject),
    preheader: b.preheader === null ? null : str(b.preheader),
    markdown: str(b.markdown),
  };
}

router.get('/config', wrap(async (_req, res) => {
  res.json({
    mode: emailMode(),
    postalAddressSet: !!(await getSetting('newsletter.postalAddress')),
    dailyLimit: dailyLimit(),
    transactionalReserve: transactionalReserve(),
  });
}));

router.get('/lists', wrap(async (_req, res) => {
  res.json(await NewsletterService.listLists());
}));

router.get('/issues', wrap(async (_req, res) => {
  res.json(await NewsletterService.listIssues());
}));

router.post('/issues', wrap(async (req, res) => {
  res.status(201).json(await NewsletterService.createIssue(body(req)));
}));

router.get('/issues/:id', wrap<{ id: string }>(async (req, res) => {
  res.json(await NewsletterService.getIssue(req.params.id));
}));

router.patch('/issues/:id', wrap<{ id: string }>(async (req, res) => {
  res.json(await NewsletterService.updateIssue(req.params.id, body(req)));
}));

router.delete('/issues/:id', wrap<{ id: string }>(async (req, res) => {
  await NewsletterService.deleteIssue(req.params.id);
  res.status(204).send();
}));

router.post('/preview', wrap(async (req, res) => {
  res.json(await NewsletterService.preview(body(req)));
}));

router.post('/issues/:id/test', wrap<{ id: string }>(async (req, res) => {
  const to = typeof req.body?.to === 'string' ? req.body.to : undefined;
  res.json(await NewsletterService.sendTest(req.params.id, to));
}));

router.post('/issues/:id/send', wrap<{ id: string }>(async (req, res) => {
  const issue = await NewsletterService.startSend(req.params.id);
  kickQueue();
  res.json(issue);
}));

export default router;
