// src/services/SubscriberService.ts
// Owns all subscriber persistence logic. Swap out or extend here when a
// real email service is wired up, without touching the route layer.

import prisma from '../db';
import { SubscriptionStatus } from '@prisma/client';

export interface SubscribeResult {
  isNew: boolean;
}

export async function subscribe(
  email: string,
  sourceSite = 'abundance-architecture'
): Promise<SubscribeResult> {
  const existing = await prisma.people.findUnique({ where: { email } });

  if (!existing) {
    await prisma.people.create({ data: { email, sourceSite } });
    console.log(`[subscribe] new ${email}`);
    return { isNew: true };
  }

  if (existing.status === SubscriptionStatus.UNSUBSCRIBED) {
    await prisma.people.update({
      where: { email },
      data: { status: SubscriptionStatus.SUBSCRIBED },
    });
    console.log(`[subscribe] reactivated ${email}`);
  } else {
    console.log(`[subscribe] already subscribed ${email}`);
  }

  return { isNew: false };
}
