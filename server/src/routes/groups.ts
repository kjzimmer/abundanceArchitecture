// src/routes/groups.ts
// Admin Groups: ad hoc sets of People that Compose can address.

import { Router, Request, Response, NextFunction } from 'express';
import { requireAdmin } from '../middleware/auth';
import * as GroupService from '../services/GroupService';
import { GroupError } from '../services/GroupService';

const router = Router();
router.use(requireAdmin);

type Handler<P> = (req: Request<P>, res: Response) => Promise<void>;

function wrap<P = Record<string, string>>(fn: Handler<P>) {
  return (req: Request<P>, res: Response, next: NextFunction) => {
    fn(req, res).catch((err) => {
      if (err instanceof GroupError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      next(err);
    });
  };
}

const body = (req: Request<unknown>) => (req.body ?? {}) as Record<string, unknown>;

router.get('/', wrap(async (_req, res) => {
  res.json(await GroupService.listGroups());
}));

router.post('/', wrap(async (req, res) => {
  res.status(201).json(await GroupService.createGroup(body(req)));
}));

router.get('/:id', wrap<{ id: string }>(async (req, res) => {
  res.json(await GroupService.getGroup(req.params.id));
}));

router.patch('/:id', wrap<{ id: string }>(async (req, res) => {
  res.json(await GroupService.updateGroup(req.params.id, body(req)));
}));

router.delete('/:id', wrap<{ id: string }>(async (req, res) => {
  await GroupService.deleteGroup(req.params.id);
  res.status(204).send();
}));

// Body: { members: [{ email, name? }] }
router.post('/:id/members', wrap<{ id: string }>(async (req, res) => {
  const members = body(req).members;
  if (!Array.isArray(members)) throw new GroupError('members must be a list');
  res.json(await GroupService.addMembers(req.params.id, members as { email?: unknown; name?: unknown }[]));
}));

router.delete('/:id/members/:personId', wrap<{ id: string; personId: string }>(async (req, res) => {
  res.json(await GroupService.removeMember(req.params.id, req.params.personId));
}));

export default router;
