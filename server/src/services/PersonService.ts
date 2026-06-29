import prisma from '../db';

export async function upsertPerson(email: string, name?: string, phone?: string) {
  return prisma.person.upsert({
    where: { email },
    update: {},
    create: { email, name: name || null, phone: phone || null },
  });
}
