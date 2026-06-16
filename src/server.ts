// src/server.ts
// Express app for the Abundance Architecture teaser site. Serves the static
// landing page and a stub /api/subscribe endpoint (no email service wired yet).

import express, { Request, Response } from 'express';
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SubscribeRequestBody {
  email?: string;
}

interface SubscribeResponseBody {
  success: boolean;
  error?: string;
}

app.post(
  '/api/subscribe',
  (req: Request<unknown, SubscribeResponseBody, SubscribeRequestBody>, res: Response<SubscribeResponseBody>) => {
    const { email } = req.body;

    if (!email || !EMAIL_PATTERN.test(email)) {
      res.status(400).json({ success: false, error: 'Invalid email' });
      return;
    }

    console.log(`[subscribe] ${email}`);
    res.json({ success: true });
  }
);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
