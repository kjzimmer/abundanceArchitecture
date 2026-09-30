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

router.get('/summary', wrap(async (_req, res) => {
  res.json(await ConversationService.summary());
}));

router.get('/conversations', wrap(async (req, res) => {
  const status = FILTERS.includes(req.query.status as StatusFilter) ? (req.query.status as StatusFilter) : 'open';
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 200) : undefined;
  res.json(await ConversationService.listConversations(status, q));
}));

router.post('/conversations', wrap(async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  res.status(201).json(await ConversationService.compose({
    to: str(b.to), name: str(b.name), subject: str(b.subject), body: str(b.body),
  }));
}));

router.get('/conversations/:id', wrap<{ id: string }>(async (req, res) => {
  res.json(await ConversationService.getConversation(req.params.id));
}));

router.post('/conversations/:id/reply', wrap<{ id: string }>(async (req, res) => {
  const b = (req.body ?? {}) as { body?: unknown; close?: unknown };
  res.json(await ConversationService.reply(req.params.id, typeof b.body === 'string' ? b.body : '', b.close === true));
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
