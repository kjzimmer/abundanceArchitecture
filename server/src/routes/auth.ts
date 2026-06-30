import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../db';
import { requireAdmin } from '../middleware/auth';
import type { AdminPayload } from '../middleware/auth';

const router = Router();

const REFRESH_COOKIE = 'aa_refresh';
const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function issueRefreshCookie(res: Response, rawToken: string): void {
  res.cookie(REFRESH_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: REFRESH_TTL_MS,
  });
}

router.post('/login', async (req: Request<unknown, unknown, { email?: string; password?: string }>, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  const person = await prisma.person.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!person?.isAdmin || !person.passwordHash) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, person.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const payload: AdminPayload = { sub: person.id, email: person.email, isAdmin: true };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TTL });

  const rawRefresh = crypto.randomBytes(64).toString('hex');
  const tokenHash = await bcrypt.hash(rawRefresh, 12);
  await prisma.refreshToken.create({
    data: {
      personId: person.id,
      tokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });

  issueRefreshCookie(res, rawRefresh);
  res.json({ success: true, accessToken, name: person.name, email: person.email });
});

router.post('/refresh', async (req: Request, res: Response) => {
  const rawToken: string | undefined = req.cookies?.[REFRESH_COOKIE];
  if (!rawToken) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  const validTokens = await prisma.refreshToken.findMany({
    where: { revokedAt: null, expiresAt: { gt: new Date() } },
    include: { person: true },
  });

  let matched: (typeof validTokens)[number] | null = null;
  for (const t of validTokens) {
    if (await bcrypt.compare(rawToken, t.tokenHash)) {
      matched = t;
      break;
    }
  }

  if (!matched) {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }

  // Rotate: revoke old, issue new
  await prisma.refreshToken.update({
    where: { id: matched.id },
    data: { revokedAt: new Date() },
  });

  const rawRefresh = crypto.randomBytes(64).toString('hex');
  const tokenHash = await bcrypt.hash(rawRefresh, 12);
  await prisma.refreshToken.create({
    data: {
      personId: matched.personId,
      tokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });

  const payload: AdminPayload = { sub: matched.person.id, email: matched.person.email, isAdmin: true };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TTL });

  issueRefreshCookie(res, rawRefresh);
  res.json({ accessToken });
});

router.post('/logout', requireAdmin, async (req: Request, res: Response) => {
  await prisma.refreshToken.updateMany({
    where: { personId: req.admin!.sub, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.status(204).end();
});

router.get('/me', requireAdmin, async (req: Request, res: Response) => {
  const person = await prisma.person.findUnique({
    where: { id: req.admin!.sub },
    select: { name: true, email: true },
  });
  res.json(person);
});

export default router;
