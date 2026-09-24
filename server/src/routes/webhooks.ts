// src/routes/webhooks.ts
// POST /api/webhooks/resend — Resend delivery events, signed via Svix.
// Mounted in index.ts with express.raw() BEFORE express.json(): the signature is computed
// over the exact raw bytes, so the body must not be parsed first.

import { Request, Response } from 'express';
import * as EmailService from '../services/EmailService';
import * as EmailWebhookService from '../services/EmailWebhookService';

export async function resendWebhookHandler(req: Request, res: Response): Promise<void> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhook] RESEND_WEBHOOK_SECRET not set');
    res.status(503).json({ error: 'Webhook not configured' });
    return;
  }

  const id = req.header('svix-id');
  const timestamp = req.header('svix-timestamp');
  const signature = req.header('svix-signature');
  if (!id || !timestamp || !signature || !Buffer.isBuffer(req.body)) {
    res.status(400).json({ error: 'Missing signature headers' });
    return;
  }

  let event: EmailWebhookService.ResendEvent;
  try {
    event = EmailService.getResend().webhooks.verify({
      payload: req.body.toString('utf8'),
      headers: { id, timestamp, signature },
      webhookSecret: secret,
    }) as EmailWebhookService.ResendEvent;
  } catch (err) {
    console.warn('[webhook] signature verification failed:', err instanceof Error ? err.message : err);
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  try {
    const result = await EmailWebhookService.handleEvent(id, event);
    res.json({ ok: true, result });
  } catch (err) {
    // 500 → Resend retries with backoff
    console.error('[webhook] processing failed:', err);
    res.status(500).json({ error: 'Processing failed' });
  }
}
