import { Router, Request, Response } from 'express';
import prisma from '../db';
import { requireAdmin } from '../middleware/auth';

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
        select: { active: true, confirmedAt: true, list: { select: { key: true, name: true } } },
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

router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    await prisma.person.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

export default router;
