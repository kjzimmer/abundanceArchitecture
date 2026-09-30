// src/services/SubscriberService.ts
// Email consent + newsletter list choices (see docs/wip/email-porting-guide.md → Identity model).
//   NewsletterSubscriber — one per person: verified address (double opt-in) + "receives anything"
//   ListSubscription     — one per person per list: which newsletters they get
// Anything added via the public form starts unconfirmed; only the owner's click (or holding
// their private token on the preferences page) confirms it.

import crypto from 'crypto';
import { EmailKind } from '@prisma/client';
import prisma from '../db';
import { upsertPerson } from './PersonService';
import * as EmailService from './EmailService';
import { subscribeConfirm, unsubscribeConfirm } from '../lib/email/templates';
import { publicBaseUrl } from '../lib/email/config';
import { brand } from '../lib/brand';

// Don't resend a confirmation to the same address more than once per hour
const CONFIRM_RESEND_WINDOW_MS = 60 * 60 * 1000;
// Several unsubscribe actions in quick succession (e.g. on the preferences page) → one email
const UNSUB_CONFIRM_WINDOW_MS = 10 * 60 * 1000;

export interface SubscribeResult {
  isNew: boolean;
}

function newToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function confirmUrl(token: string): string {
  return `${publicBaseUrl()}/confirm?t=${token}`;
}

/** Without listKey: unsubscribe from everything. With it: that list only (issue id recorded if given). */
export function unsubscribeUrl(token: string, listKey?: string, issueId?: string): string {
  const params = new URLSearchParams({ t: token });
  if (listKey) params.set('l', listKey);
  if (issueId) params.set('i', issueId);
  return `${publicBaseUrl()}/unsubscribe?${params.toString()}`;
}

export function preferencesUrl(token: string): string {
  return `${publicBaseUrl()}/preferences?t=${token}`;
}

/** The site's default list — created by migration, upserted here so ported sites self-seed. */
export async function ensureDefaultList() {
  const { key, name, description } = brand.defaultList;
  return prisma.newsletterList.upsert({
    where: { key },
    update: {},
    create: { key, name, description, siteKey: brand.siteKey },
  });
}

// throttle=false for resubscribes after "unsubscribe from everything": the token was just rotated,
// so the recipient needs the new link. Not abusable — that path requires the owner's private link first.
async function sendConfirmation(email: string, personId: string, token: string, throttle = true) {
  if (throttle && await EmailService.sentRecently(email, EmailKind.SUBSCRIBE_CONFIRM, CONFIRM_RESEND_WINDOW_MS)) {
    console.log(`[subscribe] confirmation throttled ${EmailService.maskEmail(email)}`);
    return;
  }
  await EmailService.send({
    ...subscribeConfirm(confirmUrl(token)),
    to: email,
    kind: EmailKind.SUBSCRIBE_CONFIRM,
    personId,
  });
}

/**
 * Tells the subscriber (at their own address) that they were unsubscribed, with a way back in.
 * Covers the forwarded-link case. Not used for complaint/bounce deactivations, and
 * EmailService skips suppressed addresses anyway. Background, throttled.
 */
function sendUnsubscribeConfirmation(email: string, personId: string, token: string, listNames: string[]) {
  (async () => {
    if (await EmailService.sentRecently(email, EmailKind.UNSUBSCRIBE_CONFIRM, UNSUB_CONFIRM_WINDOW_MS)) return;
    await EmailService.send({
      ...unsubscribeConfirm(listNames, preferencesUrl(token)),
      to: email,
      kind: EmailKind.UNSUBSCRIBE_CONFIRM,
      personId,
    });
  })().catch((err) => console.error('[subscribe] unsubscribe confirmation failed:', err));
}

/**
 * Double opt-in for the address and the list. Sends one confirmation email when either
 * the address or the list subscription is unconfirmed. Already fully confirmed → no email.
 * Confirmation is sent in the background — the HTTP response never waits on Resend.
 */
export async function subscribe(
  email: string,
  sourceSite: string = brand.siteKey,
): Promise<SubscribeResult> {
  const person = await upsertPerson(email);
  const list = await ensureDefaultList();

  const existing = await prisma.newsletterSubscriber.findUnique({ where: { personId: person.id } });

  let token: string;
  let isNew = false;
  let throttle = true;
  let needsConfirm = false;

  if (!existing) {
    token = newToken();
    await prisma.newsletterSubscriber.create({ data: { personId: person.id, sourceSite, token } });
    isNew = true;
    needsConfirm = true;
  } else if (!existing.active) {
    // Had unsubscribed from everything → address must be re-confirmed
    token = newToken();
    await prisma.newsletterSubscriber.update({
      where: { personId: person.id },
      data: { active: true, confirmedAt: null, unsubscribedAt: null, token },
    });
    throttle = false;
    needsConfirm = true;
  } else {
    token = existing.token;
    needsConfirm = !existing.confirmedAt;
  }

  const listSub = await prisma.listSubscription.findUnique({
    where: { personId_listId: { personId: person.id, listId: list.id } },
  });
  if (!listSub) {
    await prisma.listSubscription.create({ data: { personId: person.id, listId: list.id } });
    needsConfirm = true;
  } else if (!listSub.active) {
    // Rejoining a list they left. Unthrottled for the same reason as the stop-all path: leaving
    // required the owner's private link, and repeat form posts hit the throttled "pending" branch
    await prisma.listSubscription.update({
      where: { id: listSub.id },
      data: { active: true, confirmedAt: null, unsubscribedAt: null, unsubscribedIssueId: null, subscribedAt: new Date() },
    });
    needsConfirm = true;
    throttle = false;
  } else if (!listSub.confirmedAt) {
    needsConfirm = true;
  }

  if (!needsConfirm) {
    console.log(`[subscribe] already confirmed ${EmailService.maskEmail(email)}`);
    return { isNew: false };
  }

  console.log(`[subscribe] pending ${EmailService.maskEmail(email)} (${list.key})`);
  sendConfirmation(email, person.id, token, throttle).catch((err) =>
    console.error('[subscribe] confirmation send failed:', err),
  );
  return { isNew };
}

export type TokenResult = 'ok' | 'already' | 'unsubscribed' | 'invalid';

async function findByToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return prisma.newsletterSubscriber.findUnique({
    where: { token },
    include: {
      person: {
        select: {
          email: true,
          listSubscriptions: { include: { list: true } },
        },
      },
    },
  });
}

type Subscriber = NonNullable<Awaited<ReturnType<typeof findByToken>>>;

function pendingLists(sub: Subscriber) {
  return sub.person.listSubscriptions.filter((ls) => ls.active && !ls.confirmedAt);
}

/** Returns what the confirm page should say, without changing anything. */
export async function peekConfirm(token: string): Promise<TokenResult> {
  const sub = await findByToken(token);
  if (!sub) return 'invalid';
  if (!sub.active) return 'unsubscribed';
  return sub.confirmedAt && pendingLists(sub).length === 0 ? 'already' : 'ok';
}

/** Confirms the address and every list subscription awaiting confirmation. */
export async function confirm(token: string): Promise<TokenResult> {
  const sub = await findByToken(token);
  if (!sub) return 'invalid';
  if (!sub.active) return 'unsubscribed';
  const pending = pendingLists(sub);
  if (sub.confirmedAt && pending.length === 0) return 'already';

  const now = new Date();
  await prisma.$transaction([
    prisma.newsletterSubscriber.update({ where: { id: sub.id }, data: { confirmedAt: sub.confirmedAt ?? now } }),
    prisma.listSubscription.updateMany({
      where: { id: { in: pending.map((ls) => ls.id) } },
      data: { confirmedAt: now },
    }),
  ]);

  const listNames = pending.map((ls) => ls.list.name).join(', ') || '—';
  console.log(`[subscribe] confirmed ${EmailService.maskEmail(sub.person.email)} (${listNames})`);
  EmailService.notifyAdmin({
    type: 'Subscriber',
    title: `${sub.person.email} confirmed`,
    rows: [['Email', sub.person.email], ['Lists', listNames], ['Source', sub.sourceSite]],
  }, { replyTo: sub.person.email });
  return 'ok';
}

export interface UnsubscribePeek {
  state: 'ok' | 'already' | 'invalid';
  listName?: string; // set when unsubscribing from a single list
}

async function resolveList(sub: Subscriber, listKey?: string) {
  if (!listKey) return null;
  return sub.person.listSubscriptions.find((ls) => ls.list.key === listKey) ?? null;
}

export async function peekUnsubscribe(token: string, listKey?: string): Promise<UnsubscribePeek> {
  const sub = await findByToken(token);
  if (!sub) return { state: 'invalid' };
  if (listKey) {
    const ls = await resolveList(sub, listKey);
    if (!ls) return { state: 'invalid' };
    return { state: ls.active && sub.active ? 'ok' : 'already', listName: ls.list.name };
  }
  return { state: sub.active ? 'ok' : 'already' };
}

/**
 * With listKey: leave that list (issueId records which issue's link was used).
 * Without: unsubscribe from everything — the address stops receiving any newsletter.
 */
export async function unsubscribe(token: string, listKey?: string, issueId?: string): Promise<UnsubscribePeek> {
  const sub = await findByToken(token);
  if (!sub) return { state: 'invalid' };
  const now = new Date();

  if (listKey) {
    const ls = await resolveList(sub, listKey);
    if (!ls) return { state: 'invalid' };
    if (!ls.active || !sub.active) return { state: 'already', listName: ls.list.name };
    await prisma.listSubscription.update({
      where: { id: ls.id },
      data: { active: false, unsubscribedAt: now, unsubscribedIssueId: issueId && /^[a-z0-9]{10,40}$/.test(issueId) ? issueId : null },
    });
    console.log(`[subscribe] left list ${ls.list.key}: ${EmailService.maskEmail(sub.person.email)}`);
    sendUnsubscribeConfirmation(sub.person.email, sub.personId, sub.token, [ls.list.name]);
    EmailService.notifyAdmin({
      type: 'Unsubscribe',
      title: `${sub.person.email} left ${ls.list.name}`,
      rows: [['Email', sub.person.email], ['List', ls.list.name]],
    }, { replyTo: sub.person.email });
    return { state: 'ok', listName: ls.list.name };
  }

  if (!sub.active) return { state: 'already' };
  await prisma.$transaction([
    prisma.newsletterSubscriber.update({ where: { id: sub.id }, data: { active: false, unsubscribedAt: now } }),
    prisma.listSubscription.updateMany({
      where: { personId: sub.personId, active: true },
      data: { active: false, unsubscribedAt: now },
    }),
  ]);
  console.log(`[subscribe] unsubscribed from everything: ${EmailService.maskEmail(sub.person.email)}`);
  sendUnsubscribeConfirmation(sub.person.email, sub.personId, sub.token, []);
  EmailService.notifyAdmin({
    type: 'Unsubscribe',
    title: `${sub.person.email} unsubscribed from everything`,
    rows: [['Email', sub.person.email]],
  }, { replyTo: sub.person.email });
  return { state: 'ok' };
}

// ─── Preferences page ────────────────────────────────────────────────────────

export interface Preferences {
  email: string;
  lists: { key: string; name: string; description: string | null; subscribed: boolean }[];
}

export async function getPreferences(token: string): Promise<Preferences | null> {
  const sub = await findByToken(token);
  if (!sub) return null;
  const lists = await prisma.newsletterList.findMany({ orderBy: { createdAt: 'asc' } });
  return {
    email: sub.person.email,
    lists: lists.map((list) => {
      const ls = sub.person.listSubscriptions.find((x) => x.listId === list.id);
      return {
        key: list.key,
        name: list.name,
        description: list.description,
        subscribed: !!(sub.active && ls?.active && ls.confirmedAt),
      };
    }),
  };
}

/**
 * Saves the ticked lists. Holding the private token proves ownership of the address, so
 * ticked lists are confirmed immediately. Nothing ticked = unsubscribed from everything.
 */
export async function savePreferences(token: string, selectedKeys: string[]): Promise<Preferences | null> {
  const sub = await findByToken(token);
  if (!sub) return null;
  const lists = await prisma.newsletterList.findMany();
  const selected = new Set(selectedKeys);
  const now = new Date();
  const joined: string[] = [];
  const left: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const list of lists) {
      const ls = sub.person.listSubscriptions.find((x) => x.listId === list.id);
      const isOn = !!(sub.active && ls?.active && ls.confirmedAt);
      if (selected.has(list.key) && !isOn) {
        await tx.listSubscription.upsert({
          where: { personId_listId: { personId: sub.personId, listId: list.id } },
          update: { active: true, confirmedAt: now, unsubscribedAt: null, unsubscribedIssueId: null },
          create: { personId: sub.personId, listId: list.id, confirmedAt: now },
        });
        joined.push(list.name);
      } else if (!selected.has(list.key) && ls?.active) {
        await tx.listSubscription.update({ where: { id: ls.id }, data: { active: false, unsubscribedAt: now } });
        if (isOn) left.push(list.name);
      }
    }
    const anyOn = lists.some((l) => selected.has(l.key));
    await tx.newsletterSubscriber.update({
      where: { id: sub.id },
      data: anyOn
        ? { active: true, confirmedAt: sub.confirmedAt ?? now, unsubscribedAt: null }
        : { active: false, unsubscribedAt: sub.active ? now : sub.unsubscribedAt },
    });
  });

  if (left.length) {
    const stillOn = lists.some((l) => selected.has(l.key));
    sendUnsubscribeConfirmation(sub.person.email, sub.personId, sub.token, stillOn ? left : []);
  }

  if (joined.length || left.length) {
    EmailService.notifyAdmin({
      type: left.length && !joined.length ? 'Unsubscribe' : 'Subscriber',
      title: `${sub.person.email} updated preferences`,
      rows: [
        ['Email', sub.person.email],
        ...(joined.length ? ([['Joined', joined.join(', ')]] as [string, string][]) : []),
        ...(left.length ? ([['Left', left.join(', ')]] as [string, string][]) : []),
      ],
    }, { replyTo: sub.person.email });
  }
  return getPreferences(token);
}

/** Used when a spam complaint arrives — stop all mail without a notice email of its own. */
export async function deactivateByEmail(email: string) {
  const person = await prisma.person.findUnique({ where: { email: email.toLowerCase() } });
  if (!person) return;
  const now = new Date();
  await prisma.$transaction([
    prisma.newsletterSubscriber.updateMany({
      where: { personId: person.id, active: true },
      data: { active: false, unsubscribedAt: now },
    }),
    prisma.listSubscription.updateMany({
      where: { personId: person.id, active: true },
      data: { active: false, unsubscribedAt: now },
    }),
  ]);
}
