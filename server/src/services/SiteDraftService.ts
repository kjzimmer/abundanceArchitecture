// src/services/SiteDraftService.ts
// Server side of the site draft's own forms (docs/wip/site-draft.md). Reuses the existing pipelines rather
// than adding tables: People, Groups and Inbox conversations.

import * as ContactService from './ContactService';
import * as EmailService from './EmailService';
import * as GroupService from './GroupService';
import { publicBaseUrl } from '../lib/email/config';
import type { Reviewer } from '../site/review';

export const FOUNDING_INTEREST_GROUP = 'Founding member interest';

async function ensureGroup(name: string, description: string): Promise<string> {
  const existing = (await GroupService.listGroups()).find((g) => g.name === name);
  if (existing) return existing.id;
  const created = await GroupService.createGroup({ name, description });
  return created.id;
}

/**
 * "Comment on this page" → an [AA Review] email to Karl (ADMIN_NOTIFY_EMAIL; on staging, EMAIL_MODE=redirect
 * delivers it to EMAIL_REDIRECT_TO). Email is the durable record: the staging database is disposable.
 * Reply-To is the reviewer, so Karl can answer from his mail client.
 */
export function recordReviewComment(reviewer: Reviewer, input: { path: string; comment: string }) {
  const url = `${publicBaseUrl()}${input.path}`;
  console.log(`[review] comment from ${reviewer.email} on ${input.path}`);
  EmailService.notifyAdmin({
    type: 'Review',
    title: `${input.path} — ${reviewer.name}`,
    rows: [
      ['Page', url],
      ['Reviewer', `${reviewer.name} <${reviewer.email}>`],
    ],
    body: input.comment,
  }, { replyTo: reviewer.email });
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
