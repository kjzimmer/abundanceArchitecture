import prisma from '../db';
import { upsertPerson } from './PersonService';

export interface SubscribeResult {
  isNew: boolean;
}

export async function subscribe(
  email: string,
  sourceSite = 'abundance-architecture'
): Promise<SubscribeResult> {
  const person = await upsertPerson(email);

  const existing = await prisma.newsletterSubscriber.findUnique({
    where: { personId: person.id },
  });

  if (!existing) {
    await prisma.newsletterSubscriber.create({
      data: { personId: person.id, sourceSite },
    });
    console.log(`[subscribe] new ${email}`);
    return { isNew: true };
  }

  if (!existing.active) {
    await prisma.newsletterSubscriber.update({
      where: { personId: person.id },
      data: { active: true },
    });
    console.log(`[subscribe] reactivated ${email}`);
  } else {
    console.log(`[subscribe] already subscribed ${email}`);
  }

  return { isNew: false };
}
