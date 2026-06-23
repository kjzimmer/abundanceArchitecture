import { Router, Request, Response } from 'express';
import * as ContactService from '../services/ContactService';
import { requireAdmin } from '../middleware/auth';

const router = Router();

interface ContactBody {
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', async (req: Request<unknown, unknown, ContactBody>, res: Response) => {
  const { name, email, phone, subject, message } = req.body;

  if (!name?.trim() || !email || !EMAIL_PATTERN.test(email) || !subject?.trim() || !message?.trim()) {
    res.status(400).json({ success: false, error: 'All fields except phone are required' });
    return;
  }

  try {
    await ContactService.createMessage({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || undefined,
      subject: subject.trim(),
      message: message.trim(),
    });
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('[contact] error', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.get('/', requireAdmin, async (_req, res: Response) => {
  const messages = await ContactService.listMessages();
  res.json(messages);
});

router.patch('/:id/read', requireAdmin, async (req: Request<{ id: string }>, res: Response) => {
  try {
    const msg = await ContactService.markRead(req.params.id);
    res.json(msg);
  } catch (err) {
    console.error('[contact] mark-read error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
