// src/routes/email.ts
// Admin: sent-mail log, suppression list, test send.

import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth';
import * as EmailService from '../services/EmailService';
import { emailMode, adminNotifyEmail } from '../lib/email/config';

const router = Router();

router.use(requireAdmin);

router.get('/outbound', async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  res.json(await EmailService.listOutbound(limit, cursor));
});

router.get('/suppressions', async (_req: Request, res: Response) => {
  res.json(await EmailService.listSuppressions());
});

router.delete('/suppressions/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    await EmailService.removeSuppression(req.params.id);
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

router.get('/status', (_req: Request, res: Response) => {
  res.json({ mode: emailMode(), notifyTo: adminNotifyEmail() });
});

router.post('/test', async (_req: Request, res: Response) => {
  const row = await EmailService.sendTest();
  if (!row) {
    res.status(400).json({ error: 'ADMIN_NOTIFY_EMAIL is not set' });
    return;
  }
  res.json(row);
});

export default router;
