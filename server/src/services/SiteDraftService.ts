// src/services/SiteDraftService.ts
// Server side of the site draft's own forms (docs/wip/site-draft.md). Reuses the existing pipelines rather
// than adding tables: People, Groups and Inbox conversations.

import * as ContactService from './ContactService';
import * as GroupService from './GroupService';

export const FOUNDING_INTEREST_GROUP = 'Founding member interest';

async function ensureGroup(name: string, description: string): Promise<string> {
  const existing = (await GroupService.listGroups()).find((g) => g.name === name);
  if (existing) return existing.id;
  const created = await GroupService.createGroup({ name, description });
  return created.id;
}

/**
 * Join → founding-member interest. Recorded twice on purpose: an Inbox conversation (with the note, the admin
 * notice and the usual acknowledgement) and membership of the "Founding member interest" group, so Karl has
 * the list in one place. No payment is involved.
 */
export async function recordFoundingInterest(input: { name: string; email: string; note?: string }) {
  await ContactService.createMessage({
    name: input.name,
    email: input.email,
    subject: 'Founding member interest',
    message: input.note || '(No note)',
  });
  const groupId = await ensureGroup(FOUNDING_INTEREST_GROUP, 'People who registered interest on the Join page');
  await GroupService.addMembers(groupId, [{ email: input.email, name: input.name }]);
}
