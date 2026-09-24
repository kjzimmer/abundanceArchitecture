import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import rateLimit from 'express-rate-limit';
import subscribeRouter from './routes/subscribe';
import contactRouter from './routes/contact';
import peopleRouter from './routes/people';
import analyticsRouter from './routes/analytics';
import authRouter from './routes/auth';
import subscriptionRouter from './routes/subscription';
import emailRouter from './routes/email';
import { resendWebhookHandler } from './routes/webhooks';
import { turnstileSiteKey } from './lib/turnstile';

const app = express();
const port = process.env.PORT || 3000;

// Must precede express.json() — signature verification needs the raw body
app.post('/api/webhooks/resend', express.raw({ type: '*/*', limit: '1mb' }), resendWebhookHandler);

app.use(express.json());
app.use(cookieParser());

const formLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const linkLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

// Compiled output is server/dist/index.js — public/ is two levels up
app.use(express.static(path.join(__dirname, '..', '..', 'public')));

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRouter);
app.use('/api/subscribe', formLimiter, subscribeRouter);
app.use('/api/contact', formLimiter, contactRouter);
app.use('/api/people', peopleRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/email', emailRouter);

// Public config for public/js/main.js (site key is public by design)
app.get('/api/public-config', (_req: Request, res: Response) => {
  res.json({ turnstileSiteKey: turnstileSiteKey() });
});

// Confirm / unsubscribe pages — HTML form posts (urlencoded), incl. RFC 8058 one-click
app.use(['/confirm', '/unsubscribe'], linkLimiter, express.urlencoded({ extended: false }));
app.use(subscriptionRouter);

app.get(['/health', '/api/health'], (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.get(['/admin', '/admin/*path'], (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'admin', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
