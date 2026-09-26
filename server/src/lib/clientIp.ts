// src/lib/clientIp.ts
// Real visitor IP behind Cloudflare → Railway edge → Express.
//
// Measured in production 2026-09-25:
//   - X-Forwarded-For is rewritten by Railway's edge to "<connecting ip>, <edge ip>". On the
//     Cloudflare path the connecting ip is a Cloudflare server, not the visitor. That's why
//     `trust proxy` with a hop count would key every visitor behind one Cloudflare PoP together
//   - X-Real-IP is set by Railway's edge to the true client on BOTH paths (via Cloudflare, and
//     direct to *.up.railway.app). Spoofed X-Real-IP / X-Forwarded-For / CF-Connecting-IP
//     values are overwritten or ignored. Cloudflare rejects client-sent CF-Connecting-IP (error 1000)
//
// Locally there is no edge, so X-Real-IP is absent and req.ip (socket address) is used.

import { isIP } from 'net';
import { Request } from 'express';

// Structural subset so any Request<P, ResBody, ReqBody, …> variant is accepted
type IpSource = Pick<Request, 'header' | 'ip' | 'socket'>;

export function clientIp(req: IpSource): string {
  const realIp = req.header('x-real-ip')?.trim();
  if (realIp && isIP(realIp)) return realIp;
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}
