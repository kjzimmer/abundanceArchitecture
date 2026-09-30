import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import subscribeRouter from './routes/subscribe';
import contactRouter from './routes/contact';
import peopleRouter from './routes/people';
import analyticsRouter from './routes/analytics';
import authRouter from './routes/auth';
import subscriptionRouter from './routes/subscription';
import emailRouter from './routes/email';
import newsletterRouter from './routes/newsletter';
import settingsRouter from './routes/settings';
import { startNewsletterQueue } from './jobs/newsletterQueue';
import { resendWebhookHandler } from './routes/webhooks';
import { turnstileSiteKey } from './lib/turnstile';
import { clientIp } from './lib/clientIp';

const app = express();
const port = process.env.PORT || 3000;

// Must precede express.json() — signature verification needs the raw body
app.post('/api/webhooks/resend', express.raw({ type: '*/*', limit: '1mb' }), resendWebhookHandler);

app.use(express.json());
app.use(cookieParser());

// Keyed on the real visitor IP (see lib/clientIp.ts). `trust proxy` stays off on purpose:
// X-Forwarded-For holds Cloudflare's IP, not the visitor's. ipKeyGenerator groups IPv6 by subnet.
const limiterDefaults = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => ipKeyGenerator(clientIp(req)),
  validate: { xForwardedForHeader: false }, // XFF is deliberately not used
} as const;
const formLimiter = rateLimit({ ...limiterDefaults, max: 10 });
const loginLimiter = rateLimit({ ...limiterDefaults, max: 10 });
const linkLimiter = rateLimit({ ...limiterDefaults, max: 30 });

// Compiled output is server/dist/index.js — public/ is two levels up
app.use(express.static(path.join(__dirname, '..', '..', 'public')));

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRouter);
app.use('/api/subscribe', formLimiter, subscribeRouter);
app.use('/api/contact', formLimiter, contactRouter);
app.use('/api/people', peopleRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/email', emailRouter);
app.use('/api/newsletter', newsletterRouter);
app.use('/api/settings', settingsRouter);

// Public config for public/js/main.js (site key is public by design)
app.get('/api/public-config', (_req: Request, res: Response) => {
  res.json({ turnstileSiteKey: turnstileSiteKey() });
});

// Confirm / unsubscribe / preferences pages — HTML form posts (urlencoded), incl. RFC 8058 one-click.
// extended: true so repeated checkbox fields (lists=a&lists=b) parse as an array
app.use(['/confirm', '/unsubscribe', '/preferences'], linkLimiter, express.urlencoded({ extended: true }));
app.use(subscriptionRouter);

app.get(['/health', '/api/health'], (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.get(['/admin', '/admin/*path'], (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'admin', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  startNewsletterQueue();
});
