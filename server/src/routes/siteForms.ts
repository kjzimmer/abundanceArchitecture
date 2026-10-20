// src/routes/siteForms.ts
// POST endpoints for the site draft's own forms, mounted at /api/site only when SITE_MODE=draft and behind the
// reviewer gate. (Report sign-up and Ask a question use the existing /api/subscribe and /api/contact.)

import { Router, Request, Response } from 'express';
import * as SiteDraftService from '../services/SiteDraftService';
import * as CommonsService from '../services/CommonsService';
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

// ─── Learn: ask Holon through the commons' public interface (docs/wip/knowledge-commons.md) ──────────────

interface AskBody {
  question?: string;
  sessionId?: string | null;
}

router.post('/holon/ask', async (req: Request<unknown, unknown, AskBody>, res: Response) => {
  const reviewer = reviewerOf(res)!;
  const question = typeof req.body.question === 'string' ? req.body.question.trim() : '';
  if (!question || question.length > 2000) {
    res.status(400).json({ success: false, error: 'Please type a question (up to 2,000 characters).' });
    return;
  }
  const sessionId = typeof req.body.sessionId === 'string' ? req.body.sessionId : null;
  try {
    const r = await CommonsService.askHolon(question, { name: reviewer.name, email: reviewer.email }, sessionId);
    res.json({
      success: true,
      sessionId: r.sessionId,
      html: r.answer.html,
      entries: r.cited.entries.length,
      gaps: r.gaps,
      meta: `${r.agent.model} · ${r.agent.instructions}`,
    });
  } catch (err) {
    const status = err instanceof CommonsService.CommonsError ? err.status : 502;
    const message = err instanceof CommonsService.CommonsError && status !== 401 ? err.message : 'Holon could not answer just now.';
    if (status >= 500 || status === 401) console.error('[site/holon] ask failed', err);
    res.status(status === 401 ? 502 : status).json({ success: false, error: message });
  }
});

router.post('/holon/share', async (req: Request<unknown, unknown, { sessionId?: string }>, res: Response) => {
  const reviewer = reviewerOf(res)!;
  try {
    const ok = await CommonsService.shareQuestion(String(req.body.sessionId ?? ''), { name: reviewer.name, email: reviewer.email });
    res.json({ success: ok });
  } catch (err) {
    console.error('[site/holon] share failed', err);
    res.status(502).json({ success: false });
  }
});

export default router;
