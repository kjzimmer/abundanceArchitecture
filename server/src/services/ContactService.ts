import prisma from '../db';
import { upsertPerson } from './PersonService';

export interface ContactInput {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  sourceSite?: string;
}

export async function createMessage(input: ContactInput) {
  const { name, email, phone, subject, message, sourceSite = 'abundance-architecture' } = input;

  const person = await upsertPerson(email, name, phone);

  const msg = await prisma.contactMessage.create({
    data: { personId: person.id, name, email, phone: phone || null, subject, message, sourceSite },
  });

  if (process.env.NOTIFICATION_EMAIL_ENDPOINT) {
    fetch(process.env.NOTIFICATION_EMAIL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, subject, message, sourceSite }),
    }).catch((err) => console.error('[contact] notification failed:', err));
  }

  return msg;
}

export async function listMessages() {
  return prisma.contactMessage.findMany({
    orderBy: { createdAt: 'desc' },
    include: { person: { select: { id: true, name: true, tags: true } } },
  });
}

export async function markRead(id: string) {
  return prisma.contactMessage.update({ where: { id }, data: { read: true } });
}
