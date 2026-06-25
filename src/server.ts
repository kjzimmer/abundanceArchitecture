import express, { Request, Response } from 'express';
import path from 'path';
import rateLimit from 'express-rate-limit';
import subscribeRouter from './routes/subscribe';
import contactRouter from './routes/contact';
import peopleRouter from './routes/people';
import analyticsRouter from './routes/analytics';
import authRouter from './routes/auth';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Rate limit public form submissions
const formLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRouter);
app.use('/api/subscribe', formLimiter, subscribeRouter);
app.use('/api/contact', formLimiter, contactRouter);
app.use('/api/people', peopleRouter);
app.use('/api/analytics', analyticsRouter);

app.get(['/health', '/api/health'], (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Serve the admin SPA for any /admin path not matched by static files
app.get(['/admin', '/admin/*path'], (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
