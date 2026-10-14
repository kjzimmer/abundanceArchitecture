// src/routes/siteForms.ts
// POST endpoints for the site draft's own forms, mounted at /api/site only when SITE_MODE=draft and behind the
// reviewer gate. (Report sign-up and Ask a question use the existing /api/subscribe and /api/contact.)

import { Router, Request, Response } from 'express';
import * as SiteDraftService from '../services/SiteDraftService';
import { verifyTurnstile } from '../lib/turnstile';
import { clientIp } from '../lib/clientIp';
import { reviewerOf, reviewGate } from '../middleware/reviewGate';

const router = Router();
router.use(reviewGate);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface JoinBody {
  name?: string;
  email?: string;
  note?: string;
  turnstileToken?: string;
}

router.post('/join', async (req: Request<unknown, unknown, JoinBody>, res: Response) => {
  const { name, email, note, turnstileToken } = req.body;
  if (!name?.trim() || !email || !EMAIL_PATTERN.test(email.trim())) {
    res.status(400).json({ success: false, error: 'Name and a valid email are required' });
    return;
  }
  if (note && note.length > 5000) {
    res.status(400).json({ success: false, error: 'Note is too long' });
    return;
  }
  if (!(await verifyTurnstile(turnstileToken, clientIp(req)))) {
    res.status(403).json({ success: false, error: 'Verification failed' });
    return;
  }
  try {
    await SiteDraftService.recordFoundingInterest({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      note: note?.trim() || undefined,
    });
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('[site/join] error', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

interface FeedbackBody {
  path?: string;
  comment?: string;
}

// "Comment on this page". The reviewer's name and email come from their signed review link, never the form
router.post('/feedback', (req: Request<unknown, unknown, FeedbackBody>, res: Response) => {
  const reviewer = reviewerOf(res);
  const path = typeof req.body.path === 'string' ? req.body.path.trim() : '';
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
  // Same-site paths only: the page address is shown as a link in Karl's email
  if (!reviewer || !path.startsWith('/') || path.startsWith('//') || path.length > 500) {
    res.status(400).json({ success: false, error: 'Invalid page' });
    return;
  }
  if (!comment || comment.length > 10000) {
    res.status(400).json({ success: false, error: 'Comment is required (up to 10,000 characters)' });
    return;
  }
  SiteDraftService.recordReviewComment(reviewer, { path, comment });
  res.status(201).json({ success: true });
});

export default router;
