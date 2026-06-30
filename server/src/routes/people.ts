import { Router, Request, Response } from 'express';
import prisma from '../db';
import { requireAdmin } from '../middleware/auth';

const router = Router();

router.use(requireAdmin);

router.get('/', async (_req, res: Response) => {
  const people = await prisma.person.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      newsletter: { select: { active: true, sourceSite: true, subscribedAt: true } },
      _count: { select: { contacts: true } },
    },
  });
  res.json(people);
});

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const person = await prisma.person.findUnique({
    where: { id: req.params.id },
    include: {
      newsletter: true,
      contacts: { orderBy: { createdAt: 'desc' } },
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
