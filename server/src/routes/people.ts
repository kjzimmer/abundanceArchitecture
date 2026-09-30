import { Router, Request, Response } from 'express';
import prisma from '../db';
import { requireAdmin } from '../middleware/auth';
import * as SubscriberService from '../services/SubscriberService';

const router = Router();

router.use(requireAdmin);

// Credentials never leave the server, not even to the admin UI
const OMIT_SECRETS = { passwordHash: true, totpSecret: true } as const;

router.get('/', async (_req, res: Response) => {
  const people = await prisma.person.findMany({
    omit: OMIT_SECRETS,
    orderBy: { createdAt: 'desc' },
    include: {
      newsletter: { select: { active: true, confirmedAt: true, sourceSite: true, subscribedAt: true } },
      _count: { select: { conversations: true } },
    },
  });
  res.json(people);
});

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const person = await prisma.person.findUnique({
    omit: OMIT_SECRETS,
    where: { id: req.params.id },
    include: {
      // token omitted — it grants confirm/unsubscribe and has no use in the admin UI
      newsletter: {
        select: { active: true, confirmedAt: true, unsubscribedAt: true, sourceSite: true, subscribedAt: true },
      },
      conversations: {
        orderBy: { lastMessageAt: 'desc' },
        select: { id: true, subject: true, status: true, channel: true, lastMessageAt: true },
      },
      listSubscriptions: {
        select: { active: true, confirmedAt: true, unsubscribedAt: true, list: { select: { key: true, name: true } } },
      },
      outboundEmails: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, subject: true, kind: true, status: true, createdAt: true },
      },
    },
  });
  if (!person) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(person);
});

router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { name, phone, notes, tags } = req.body as {
    name?: string; phone?: string; notes?: string; tags?: string[];
  };
  try {
    const person = await prisma.person.update({
      omit: OMIT_SECRETS,
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(notes !== undefined && { notes }),
        ...(tags !== undefined && { tags }),
      },
    });
    res.json(person);
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

const INVITE_MESSAGES: Record<SubscriberService.InviteResult, string> = {
  sent: 'Invitation sent. They’ll show as pending until they confirm.',
  resent: 'Invitation sent again.',
  throttled: 'An invitation or confirmation went out within the last hour. Try again later.',
  already: 'Already a confirmed subscriber.',
  unsubscribed: 'They unsubscribed before, so no invitation was sent. They can resubscribe from the website.',
  suppressed: 'This address bounced or reported spam, so it can’t be emailed.',
  not_found: 'Person not found.',
};

// Admin-initiated newsletter invitation (double opt-in)
router.post('/:id/invite', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const result = await SubscriberService.invite(req.params.id);
    const ok = result === 'sent' || result === 'resent';
    res.status(result === 'not_found' ? 404 : ok || result === 'already' ? 200 : 409)
      .json({ result, message: INVITE_MESSAGES[result] });
  } catch (err) {
    console.error('[people] invite failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    await prisma.person.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

export default router;
