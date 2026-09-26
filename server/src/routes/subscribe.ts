// src/routes/subscribe.ts
// POST /api/subscribe — validates email and delegates to SubscriberService.

import { Router, Request, Response } from 'express';
import * as SubscriberService from '../services/SubscriberService';
import { verifyTurnstile } from '../lib/turnstile';
import { clientIp } from '../lib/clientIp';

const router = Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SubscribeBody {
  email?: string;
  turnstileToken?: string;
}

router.post('/', async (req: Request<unknown, unknown, SubscribeBody>, res: Response) => {
  const { email, turnstileToken } = req.body;

  if (!email || !EMAIL_PATTERN.test(email)) {
    res.status(400).json({ success: false, error: 'Invalid email' });
    return;
  }

  if (!(await verifyTurnstile(turnstileToken, clientIp(req)))) {
    res.status(403).json({ success: false, error: 'Verification failed' });
    return;
  }

  try {
    await SubscriberService.subscribe(email.toLowerCase().trim());
    res.json({ success: true });
  } catch (err) {
    console.error('[subscribe] error', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
