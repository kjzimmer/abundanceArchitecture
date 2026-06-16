// src/server.ts
// Express app entry point: mounts static file serving, the subscribe route,
// and the health check. Env vars are loaded via --env-file .env in dev;
// Railway injects them directly in production.

import express, { Request, Response } from 'express';
import path from 'path';
import subscribeRouter from './routes/subscribe';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/subscribe', subscribeRouter);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
