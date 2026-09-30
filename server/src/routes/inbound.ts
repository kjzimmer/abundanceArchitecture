// src/routes/inbound.ts
// POST /api/inbound-email — parsed mail from the Cloudflare Email Worker.
// Authenticated with HMAC-SHA256 over `${timestamp}.${rawBody}` using INBOUND_WEBHOOK_SECRET.
// Mounted with express.raw() before express.json() (signature covers the exact bytes).

import { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import * as InboundService from '../services/InboundService';

const MAX_SKEW_SECONDS = 5 * 60;

function verify(secret: string, timestamp: string, raw: Buffer, signature: string): boolean {
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest('hex');
  const given = signature.replace(/^sha256=/, '');
  if (!/^[0-9a-f]{64}$/i.test(given)) return false;
  return timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'));
}

export async function inboundEmailHandler(req: Request, res: Response): Promise<void> {
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[inbound] INBOUND_WEBHOOK_SECRET not set');
    res.status(503).json({ error: 'Inbound email not configured' });
    return;
  }

  const timestamp = req.header('x-aa-timestamp') ?? '';
  const signature = req.header('x-aa-signature') ?? '';
  if (!Buffer.isBuffer(req.body) || !/^\d+$/.test(timestamp) || !signature) {
    res.status(400).json({ error: 'Missing signature' });
    return;
  }
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) {
    res.status(401).json({ error: 'Stale timestamp' });
    return;
  }
  if (!verify(secret, timestamp, req.body, signature)) {
    console.warn('[inbound] signature mismatch');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  let payload: InboundService.InboundPayload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  try {
    res.json(await InboundService.handleInbound(payload));
  } catch (err) {
    console.error('[inbound] processing failed:', err);
    res.status(500).json({ error: 'Processing failed' });
  }
}
