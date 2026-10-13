// src/routes/inbox.ts
// Admin Inbox: conversations (list/search/detail), reply, compose, status changes.

import { Router, Request, Response, NextFunction } from 'express';
import { ConversationStatus } from '@prisma/client';
import { requireAdmin } from '../middleware/auth';
import * as ConversationService from '../services/ConversationService';
import { ConversationError, StatusFilter } from '../services/ConversationService';

const router = Router();
router.use(requireAdmin);

type Handler<P> = (req: Request<P>, res: Response) => Promise<void>;

function wrap<P = Record<string, string>>(fn: Handler<P>) {
  return (req: Request<P>, res: Response, next: NextFunction) => {
    fn(req, res).catch((err) => {
      if (err instanceof ConversationError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      next(err);
    });
  };
}

const FILTERS: StatusFilter[] = ['open', 'waiting', 'closed', 'all'];
const STATUSES = Object.values(ConversationStatus) as string[];

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

router.get('/summary', wrap(async (req, res) => {
  res.json(await ConversationService.summary(str(req.query.mailbox)));
}));

router.get('/mailboxes', wrap(async (_req, res) => {
  res.json(await ConversationService.listMailboxes());
}));

router.get('/conversations', wrap(async (req, res) => {
  const status = FILTERS.includes(req.query.status as StatusFilter) ? (req.query.status as StatusFilter) : 'open';
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 200) : undefined;
  res.json(await ConversationService.listConversations(status, q, str(req.query.mailbox)));
}));

router.post('/conversations', wrap(async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  // to/cc/bcc: arrays of addresses (or one comma-separated string)
  res.status(201).json(await ConversationService.compose({
    to: b.to, cc: b.cc, bcc: b.bcc, name: str(b.name), subject: str(b.subject), body: str(b.body),
    from: str(b.from), groupId: str(b.groupId),
  }));
}));

router.get('/conversations/:id', wrap<{ id: string }>(async (req, res) => {
  res.json(await ConversationService.getConversation(req.params.id));
}));

router.post('/conversations/:id/reply', wrap<{ id: string }>(async (req, res) => {
  // to/cc omitted = reply-all defaults (detail.replyAll); bcc is never defaulted
  const b = (req.body ?? {}) as Record<string, unknown>;
  res.json(await ConversationService.reply(req.params.id, {
    body: str(b.body) ?? '', close: b.close === true, to: b.to, cc: b.cc, bcc: b.bcc,
  }));
}));

router.patch('/conversations/:id', wrap<{ id: string }>(async (req, res) => {
  const status = (req.body as { status?: unknown } | undefined)?.status;
  if (typeof status !== 'string' || !STATUSES.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  res.json(await ConversationService.setStatus(req.params.id, status as ConversationStatus));
}));

export default router;
