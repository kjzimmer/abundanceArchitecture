// src/routes/contact.ts
// POST /api/contact — public contact form. Creates an Inbox conversation (see ConversationService).
// Admin reading/replying lives under /api/inbox.

import { Router, Request, Response } from 'express';
import * as ContactService from '../services/ContactService';
import { verifyTurnstile } from '../lib/turnstile';
import { clientIp } from '../lib/clientIp';

const router = Router();

interface ContactBody {
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
  turnstileToken?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', async (req: Request<unknown, unknown, ContactBody>, res: Response) => {
  const { name, email, phone, subject, message, turnstileToken } = req.body;

  if (!name?.trim() || !email || !EMAIL_PATTERN.test(email) || !subject?.trim() || !message?.trim()) {
    res.status(400).json({ success: false, error: 'All fields except phone are required' });
    return;
  }

  if (!(await verifyTurnstile(turnstileToken, clientIp(req)))) {
    res.status(403).json({ success: false, error: 'Verification failed' });
    return;
  }

  try {
    await ContactService.createMessage({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || undefined,
      subject: subject.trim(),
      message: message.trim(),
    });
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('[contact] error', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
