import prisma from '../db';

export interface PersonMatch {
  id: string;
  name: string | null;
  email: string;
}

/**
 * Type-ahead lookup for Compose "To": matches name or email (case-insensitive), ranked so that
 * matches at the start of a name word or the email come first. Admin-only (see routes/people.ts).
 */
export async function lookupPeople(query: string, limit = 8): Promise<PersonMatch[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const rows = await prisma.person.findMany({
    where: {
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  const score = (p: { name: string | null; email: string }) => {
    const name = (p.name ?? '').toLowerCase();
    if (name.split(/\s+/).some((w) => w.startsWith(q)) || p.email.startsWith(q)) return 0;
    return 1;
  };
  return rows
    .map((p, i) => ({ p, i, s: score(p) }))
    .sort((a, b) => a.s - b.s || a.i - b.i) // prefix matches first, then most recently active
    .slice(0, limit)
    .map(({ p }) => ({ id: p.id, name: p.name, email: p.email }));
}

export async function upsertPerson(email: string, name?: string, phone?: string) {
  return prisma.person.upsert({
    where: { email },
    update: {},
    create: { email, name: name || null, phone: phone || null },
  });
}
