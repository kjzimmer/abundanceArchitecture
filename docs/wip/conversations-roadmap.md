# Conversations → Projects — Roadmap

*Written 2026-10-12 with Karl. Items are specced enough to start a future session from. Pick one, move its
section into its own `docs/wip/{feature}.md`, and build. Shipped so far: email foundation, newsletter,
conversations inbox, inbound, mailboxes (`karl@`), groups + CC/BCC (`email-groups.md`), shared docs.*

## Direction (Karl)

AA's goal is to organize complex discussions and bring communities together, so that conversations get
**compiled into small actionable projects** that move AA forward, instead of getting lost. Conversation
should be easy to hold and easy to record, and all of it should be available for synthesis (with collaborators
and AI). Existing social media and tool mixes can't do this. So: **build the relationship layer**
(People, groups, conversations, shares, projects, shared across the FoA sites), and **rent the commodity
parts** (Resend sending, Cloudflare receiving, R2 storage). Don't rebuild generic mail-client features Gmail
already does well; Gmail stays the escape hatch through the raw `+aa-raw` copies.

**Design rule for everything below:** every new artifact (message, attachment, note, doc) should link to a
Conversation, Group or Person, so it can be found and synthesized later.

## Suggested order (for the site-draft review)

1. Resend plan upgrade + quota visibility (before heavy group use)
2. Inbound attachments stored
3. Per-group / per-person share links
4. Images in replies + newsletter
5. Conversation notes + labels
6. **Projects: synthesis from conversations** (the AA-specific centerpiece)
7. Everything else in priority order as use reveals needs

---

## 1. Resend plan + quota visibility (Small)

- Free plan: 100/day, 3,000/month. Group threads multiply sends. Upgrade to the paid tier (check current
  pricing) and set `EMAIL_DAILY_LIMIT` to match
- Admin → Email: show sends in the last 24h / this month against the limit (`OutboundEmail` count; a shared
  send = 1 row but N recipients, so count `1 + otherRecipients.length` if Resend bills per recipient (verify))
- Warn in Compose when a send would cross the daily limit

## 2. Inbound attachments stored (Medium)

Today: metadata only; content is in the Gmail raw copy.
- Worker: include attachment content (base64) up to a cap (e.g. 10 MB each / 25 MB total; Workers have
  memory limits), or upload directly to R2 from the Worker with an R2 binding (better: no big POST)
- App: `MessageAttachment { id, messageId, filename, contentType, size, storageKey, inline, contentId }` in R2
  under `attachments/<conversationId>/…`. Admin download through an authenticated route (never public)
- Inline images (`cid:`) in HTML: render in a sandboxed iframe with `cid:` rewritten to the admin route
- Security: never serve with an executable content type; `Content-Disposition: attachment` except images/PDF;
  consider a size/type allowlist
- Shared docs reuse: "Save to share" button copies an attachment into a share folder

## 3. Outbound attachments (Small–Medium)

- Prefer **"attach as share link"**: pick files from Documents (or upload) → insert a share link. Watermark
  and view-only apply, nothing heavy goes through email
- Real attachments: Resend supports `attachments` (base64 or URL; 40 MB total). Store the sent files in R2 and
  link them from the Message

## 4. Images (Medium)

- Replies: paste/drag an image → upload to R2 (public-read prefix or signed long-lived URL) → `<img>` in the
  HTML part. Requires replies to support HTML formatting (see 7)
- Newsletter: image upload in the editor → R2 → markdown `![](url)`; width-constrained in the layout. Logo
  signature reuses the same path (memory: planned)

## 5. Per-group / per-person share links (Medium)

From shared-docs open item 4. `Share` gains optional `groupId` or `personId`. "Share with group" creates one
link per member (watermark = person's name, so leaks are traceable) and Compose can insert each member's own
link (per-recipient sending, so this send is one email per person, not one shared email). Show per-person
last-access in admin

## 6. Projects: synthesis from conversations (Large, AA-specific)

The core of the direction above. Sketch to refine with Karl before building:
- `Project { id, title, summary, status (idea/active/done/dropped), owner?, groupId?, createdAt }`
- `ProjectLink { projectId, conversationId? | messageId? | shareFileId? | personId?, note }`: any artifact can
  be attached as evidence/context
- In a thread: select text or a message → **"Add to project"** (new or existing)
- **AI synthesis** (Claude API): for a group or a set of conversations, generate a digest: themes, open
  questions, decisions, proposed actions → Karl edits → creates Projects/tasks. Store each digest with links to
  the source messages (traceable)
- Later: project pages shared with collaborators (needs accounts, 13), status updates emailed to the group

## 7. Rich text in replies + Compose (Medium)

Markdown in the composer (same `marked` as the newsletter) → HTML part + plain-text part. Preview toggle.
Keep the "plain personal email" look

## 8. Conversation notes + labels (Small–Medium)

- `ConversationNote { conversationId, body, createdAt }`: internal, never emailed (also needed for teams)
- Labels: `Conversation.labels String[]` + filter chips in the Inbox. Useful as a lightweight step toward
  Projects

## 9. Forward a conversation (Small)

Compose prefilled with the thread quoted (or selected messages) and attachments (after 2), new conversation
linked to the original (`forwardedFromId`)

## 10. Snooze / follow-up reminders (Small–Medium)

`Conversation.snoozedUntil`, hidden from Open until then (cron flips it back + notice). "Remind me if no
reply in N days" on WAITING conversations

## 11. Drafts autosave (Small)

Per-conversation draft (body + recipients) in the DB, so a half-written reply survives reloads and devices

## 12. Canned replies / templates (Small)

Snippets in Settings, inserted from the composer

## 13. Accounts, roles, per-user mailbox access (Large)

Already specced: `email-newsletter.md` → "Deferred: mailboxes" (accounts + invites, Owner/Support, per-user
mailbox visibility, `Mailbox` DB record with members, assignment, collision warning). **Required before anyone
else gets an admin login.** Collaborator logins (a review portal for site drafts, project pages) build on it

## 14. Group list address (B2) (Large)

`design@` style addresses that re-send to members (Google Groups model) if B1's "replied to only one
member" gap matters. Needs: From rewriting ("Pat via AA Design"), loop/auto-reply protection, member-only
posting, per-recipient sends (quota)

## 15. Group discussion space (non-email) + social integrations (Large, later)

Web discussion per group (threads, replies by email or on site), then social cross-posting. Should reuse the
same Conversation/Message records so email and web replies land in one place

## Hygiene (do alongside)

- Test suite for the email modules (none yet), then legacy `contact_message` drop
- Porting guide refresh (mailboxes, groups) before HU/FMW
- Deliverability: Resend open/click tracking off for personal mail; DMARC `p=none` → `p=quarantine` after
  reviewing reports
- Newsletter: postal address + first issue (Karl), web archive, scheduled sends
- Shared docs open items (video, images, watermark strength, cache): `shared-docs.md`
