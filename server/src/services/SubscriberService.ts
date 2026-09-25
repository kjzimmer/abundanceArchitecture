import crypto from 'crypto';
import { EmailKind } from '@prisma/client';
import prisma from '../db';
import { upsertPerson } from './PersonService';
import * as EmailService from './EmailService';
import { subscribeConfirm } from '../lib/email/templates';
import { publicBaseUrl } from '../lib/email/config';

// Don't resend a confirmation to the same address more than once per hour
const CONFIRM_RESEND_WINDOW_MS = 60 * 60 * 1000;

export interface SubscribeResult {
  isNew: boolean;
}

function newToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function confirmUrl(token: string): string {
  return `${publicBaseUrl()}/confirm?t=${token}`;
}

export function unsubscribeUrl(token: string): string {
  return `${publicBaseUrl()}/unsubscribe?t=${token}`;
}

// throttle=false for resubscribes: the token was just rotated, so the recipient needs the
// new link. Not abusable — reaching the resubscribe path requires the recipient to have
// unsubscribed via their own private link first.
async function sendConfirmation(email: string, personId: string, token: string, throttle = true) {
  if (throttle && await EmailService.sentRecently(email, EmailKind.SUBSCRIBE_CONFIRM, CONFIRM_RESEND_WINDOW_MS)) {
    console.log(`[subscribe] confirmation throttled ${email}`);
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
 * Double opt-in: new or returning subscribers are created pending (confirmedAt null)
 * and sent a confirmation link. Already-confirmed subscribers get no email.
 * Confirmation is sent in the background — the HTTP response never waits on Resend.
 */
export async function subscribe(
  email: string,
  sourceSite = 'abundance-architecture'
): Promise<SubscribeResult> {
  const person = await upsertPerson(email);

  const existing = await prisma.newsletterSubscriber.findUnique({
    where: { personId: person.id },
  });

  let token: string;
  let isNew = false;
  let throttle = true;

  if (!existing) {
    token = newToken();
    await prisma.newsletterSubscriber.create({
      data: { personId: person.id, sourceSite, token },
    });
    isNew = true;
    console.log(`[subscribe] new (pending) ${email}`);
  } else if (!existing.active) {
    token = newToken();
    await prisma.newsletterSubscriber.update({
      where: { personId: person.id },
      data: { active: true, confirmedAt: null, unsubscribedAt: null, token },
    });
    throttle = false;
    console.log(`[subscribe] resubscribe (pending) ${email}`);
  } else if (!existing.confirmedAt) {
    token = existing.token;
    console.log(`[subscribe] still pending ${email}`);
  } else {
    console.log(`[subscribe] already confirmed ${email}`);
    return { isNew: false };
  }

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
    include: { person: { select: { email: true } } },
  });
}

/** Returns what the confirm page should say, without changing anything. */
export async function peekConfirm(token: string): Promise<TokenResult> {
  const sub = await findByToken(token);
  if (!sub) return 'invalid';
  if (!sub.active) return 'unsubscribed';
  return sub.confirmedAt ? 'already' : 'ok';
}

export async function confirm(token: string): Promise<TokenResult> {
  const sub = await findByToken(token);
  if (!sub) return 'invalid';
  if (!sub.active) return 'unsubscribed';
  if (sub.confirmedAt) return 'already';

  await prisma.newsletterSubscriber.update({
    where: { id: sub.id },
    data: { confirmedAt: new Date() },
  });
  console.log(`[subscribe] confirmed ${sub.person.email}`);
  EmailService.notifyAdmin({
    type: 'Subscriber',
    title: `${sub.person.email} confirmed`,
    rows: [['Email', sub.person.email], ['Source', sub.sourceSite]],
  }, { replyTo: sub.person.email });
  return 'ok';
}

export async function peekUnsubscribe(token: string): Promise<TokenResult> {
  const sub = await findByToken(token);
  if (!sub) return 'invalid';
  return sub.active ? 'ok' : 'already';
}

export async function unsubscribe(token: string): Promise<TokenResult> {
  const sub = await findByToken(token);
  if (!sub) return 'invalid';
  if (!sub.active) return 'already';

  await prisma.newsletterSubscriber.update({
    where: { id: sub.id },
    data: { active: false, unsubscribedAt: new Date() },
  });
  console.log(`[subscribe] unsubscribed ${sub.person.email}`);
  EmailService.notifyAdmin({
    type: 'Unsubscribe',
    title: `${sub.person.email} unsubscribed`,
    rows: [['Email', sub.person.email]],
  }, { replyTo: sub.person.email });
  return 'ok';
}

/** Used when a spam complaint arrives — stop mailing without a notice email of its own. */
export async function deactivateByEmail(email: string) {
  const person = await prisma.person.findUnique({ where: { email: email.toLowerCase() } });
  if (!person) return;
  await prisma.newsletterSubscriber.updateMany({
    where: { personId: person.id, active: true },
    data: { active: false, unsubscribedAt: new Date() },
  });
}
