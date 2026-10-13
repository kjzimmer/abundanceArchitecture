# Email Groups + CC/BCC — WIP Spec

*Status: PR #30, deployed 2026-10-13; prod test pending. Follows the single-user mailboxes work (PR #28).
Roadmap for what comes next: `docs/wip/conversations-roadmap.md`.*

## Goal

Hold email discussions with several people at once, e.g. the collaborators reviewing the next site draft,
and keep each group's conversations together so they can later be pulled into actionable projects.

## Decisions (Karl, 2026-10-12)

- **Model B1: multi-recipient conversations.** One email to every participant (To/CC visible), and people
  reply-all as usual. Our copy arrives through the Worker and threads into the conversation. No list server
- **Not B2 (yet): list address that re-sends** (`design@` → every member, like Google Groups). It needs
  DMARC "via" rewriting, loop protection, and multiplies send volume. Add it if reply-only-to-one-member
  gaps become a real problem
- **Groups are saved sets of People**, managed in admin → **Groups**. Compose can add a group's members
  (visible in To, or hidden in Bcc). The conversation is **filed under the group** (`Conversation.groupId`)
- Reply defaults to **reply-all**; To/CC are editable before sending, and BCC is never carried forward

## Data model

```prisma
Message       += toEmails[], ccEmails[], bccEmails[]   // toEmail kept: inbound = envelope recipient, outbound = first To
OutboundEmail += otherRecipients[]                     // extra To/CC/BCC; non-empty = "shared send"
Conversation  += groupId? → Group (SetNull)
Group        { id, sourceSite, name, description?, members, conversations }    @@map("contact_group")
GroupMember  { groupId, personId, addedAt }  @@id([groupId, personId])          @@map("contact_group_member")
```

Migration `20261012120000_groups_and_cc` backfills `to_emails = [to_email]` on outbound messages.

## Behavior

- **Compose** (`POST /api/inbox/conversations`): `to`, `cc`, `bcc` (arrays or comma-separated), `from`,
  `groupId?`. All BCC → To defaults to the sending mailbox's own address (that copy is ignored by inbound
  because it comes from our domain)
- **Reply** (`POST …/:id/reply`): `to`/`cc` omitted = `replyAll` defaults from the detail response.
  Latest message inbound → To its sender, CC everyone else on its To/CC minus our addresses. Latest message
  ours → same To/CC again
- **Validation:** valid addresses, at least one To, at most **50** recipients (Resend's limit), and
  **any suppressed address blocks the send** with a message naming it
- **Every recipient becomes a Person** (upsert), so participants show in People and can be added to groups
- **Inbound** stores the To/CC headers, so reply-all includes people the sender CC'd
- **Webhook:** a hard bounce or complaint on a shared send **doesn't auto-suppress** (Resend can't say which
  recipient); it sends a `[AA Deliverability]` notice listing the recipients instead. Single-recipient
  sends behave as before
- **Search** matches To/CC/BCC addresses on our messages and CC on inbound
- **Groups API** (`/api/groups`): list, create, get (members + conversations), patch, delete (People and
  conversations kept), `POST /:id/members {members:[{email,name?}]}`, `DELETE /:id/members/:personId`
- **UI:** Groups page (create/edit/delete, members, filed conversations, **Email this group** → Compose);
  Compose with From, group picker + "hide members (Bcc)", To/Cc/Bcc chips with People type-ahead;
  thread reply box with To/Cc (Bcc on demand) and "Reset to reply-all"; participants shown on each
  message; group badge on list rows and the thread; People detail lists a person's groups

## Known limits

- A member who replies **only to another member** (not reply-all) is invisible to us (that's the B1 trade-off)
- **Send volume:** Resend free = 100 emails/day, and a group thread uses it quickly. Upgrade the plan before
  heavy group use (roadmap)
- An all-BCC conversation's follow-up defaults To our own address; edit the recipients when following up
- Group membership changes don't touch existing conversations (they keep their original participants)

## Status

- [x] Code, migration, local smoke test (16 checks: groups CRUD, compose to group with CC/BCC, inbound
      reply-all threading, reply-all defaults, validation, suppression block, shared-bounce no-suppress, search)
- [x] PR #30 merged + deployed 2026-10-13 (migration applied, `/api/groups` live, new admin bundle served)
- [ ] Prod: create a group, email it from `karl@`, have a member reply-all, reply from the Inbox
