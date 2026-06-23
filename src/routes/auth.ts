import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../db';

const router = Router();

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

  const token = jwt.sign(
    { personId: person.id, email: person.email },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  res.json({ token, name: person.name, email: person.email });
});

export default router;
