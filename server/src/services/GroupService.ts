// src/services/GroupService.ts
// Ad hoc groups of People (docs/wip/email-groups.md). Compose can address a group; conversations
// started that way keep groupId so a group's discussions can be gathered later.

import prisma from '../db';
import { brand } from '../lib/brand';
import { upsertPerson } from './PersonService';

export class GroupError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MEMBER_SELECT = { person: { select: { id: true, name: true, email: true } }, addedAt: true } as const;

export async function listGroups() {
  const rows = await prisma.group.findMany({
    where: { sourceSite: brand.siteKey },
    orderBy: { name: 'asc' },
    include: { _count: { select: { members: true, conversations: true } } },
  });
  return rows.map(({ _count, ...g }) => ({ ...g, memberCount: _count.members, conversationCount: _count.conversations }));
}

export async function getGroup(id: string) {
  const group = await prisma.group.findFirst({
    where: { id, sourceSite: brand.siteKey },
    include: {
      members: { select: MEMBER_SELECT, orderBy: { addedAt: 'asc' } },
      conversations: {
        orderBy: { lastMessageAt: 'desc' },
        take: 50,
        select: { id: true, subject: true, status: true, lastMessageAt: true, mailbox: true },
      },
    },
  });
  if (!group) throw new GroupError('Group not found', 404);
  return { ...group, members: group.members.map((m) => ({ ...m.person, addedAt: m.addedAt })) };
}

function cleanName(name: unknown): string {
  const n = typeof name === 'string' ? name.trim() : '';
  if (!n) throw new GroupError('Name is required');
  if (n.length > 100) throw new GroupError('Name must be 100 characters or fewer');
  return n;
}

function cleanDescription(d: unknown): string | null {
  if (d === undefined || d === null) return null;
  if (typeof d !== 'string') throw new GroupError('Description must be text');
  const t = d.trim();
  if (t.length > 1000) throw new GroupError('Description must be 1000 characters or fewer');
  return t || null;
}

export async function createGroup(input: { name?: unknown; description?: unknown }) {
  const group = await prisma.group.create({
    data: { sourceSite: brand.siteKey, name: cleanName(input.name), description: cleanDescription(input.description) },
  });
  return getGroup(group.id);
}

export async function updateGroup(id: string, input: { name?: unknown; description?: unknown }) {
  await getGroup(id);
  await prisma.group.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: cleanName(input.name) }),
      ...(input.description !== undefined && { description: cleanDescription(input.description) }),
    },
  });
  return getGroup(id);
}

/** Deletes the group and its memberships. People and conversations stay (conversations lose the link). */
export async function deleteGroup(id: string) {
  await getGroup(id);
  await prisma.group.delete({ where: { id } });
}

/** Adds members by email (People are created if new). Already-members are skipped. */
export async function addMembers(id: string, members: { email?: unknown; name?: unknown }[]) {
  await getGroup(id);
  const valid = members
    .map((m) => ({
      email: typeof m.email === 'string' ? m.email.trim().toLowerCase() : '',
      name: typeof m.name === 'string' ? m.name.trim() : undefined,
    }))
    .filter((m) => m.email);
  const bad = valid.filter((m) => !EMAIL_PATTERN.test(m.email));
  if (bad.length) throw new GroupError(`Not a valid email: ${bad.map((m) => m.email).join(', ')}`);
  for (const m of valid) {
    const person = await upsertPerson(m.email, m.name || undefined);
    await prisma.groupMember.upsert({
      where: { groupId_personId: { groupId: id, personId: person.id } },
      update: {},
      create: { groupId: id, personId: person.id },
    });
  }
  return getGroup(id);
}

export async function removeMember(id: string, personId: string) {
  await getGroup(id);
  await prisma.groupMember.deleteMany({ where: { groupId: id, personId } });
  return getGroup(id);
}

/** Groups a person belongs to (People detail). */
export async function groupsForPerson(personId: string) {
  const rows = await prisma.groupMember.findMany({
    where: { personId, group: { sourceSite: brand.siteKey } },
    select: { group: { select: { id: true, name: true } } },
    orderBy: { group: { name: 'asc' } },
  });
  return rows.map((r) => r.group);
}

export async function groupExists(id: string): Promise<boolean> {
  return !!(await prisma.group.findFirst({ where: { id, sourceSite: brand.siteKey }, select: { id: true } }));
}
