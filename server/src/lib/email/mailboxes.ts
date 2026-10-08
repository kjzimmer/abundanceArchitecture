// src/lib/email/mailboxes.ts
// Inbox mailboxes (brand.mailboxes): which address a conversation lives in, and how mail from it is sent.

import { brand } from '../brand';
import { SettingKey, settingDefinition } from '../settings';
import { emailFrom, emailFromAddress } from './config';

export interface Mailbox {
  key: string;          // local part, stored on Conversation.mailbox
  address: string;      // bare address, e.g. karl@example.com
  from: string;         // From header, e.g. "Karl Zimmer <karl@example.com>"
  name: string;
  personal: boolean;    // no reply+c- Reply-To (see brand.ts)
  signatureKey: SettingKey;
}

function build(def: (typeof brand.mailboxes)[number], index: number): Mailbox {
  const primary = index === 0;
  const address = primary ? emailFromAddress() : `${def.key}@${brand.domain}`;
  const signature = primary ? 'inbox.signature' : `inbox.signature.${def.key}`;
  return {
    key: def.key,
    address,
    from: primary ? emailFrom() : `${def.name} <${address}>`,
    name: def.name,
    personal: def.personal,
    signatureKey: (settingDefinition(signature) ? signature : 'inbox.signature') as SettingKey,
  };
}

export function mailboxes(): Mailbox[] {
  return brand.mailboxes.map(build);
}

export function defaultMailbox(): Mailbox {
  return build(brand.mailboxes[0], 0);
}

/** The mailbox for a stored key; unknown or missing keys fall back to the default. */
export function mailboxByKey(key: string | null | undefined): Mailbox {
  return mailboxes().find((m) => m.key === key) ?? defaultMailbox();
}

export function isMailboxKey(key: unknown): key is string {
  return typeof key === 'string' && brand.mailboxes.some((m) => m.key === key);
}

/** The mailbox an inbound envelope recipient was addressed to, or null (e.g. reply+…@). */
export function mailboxForRecipient(recipient: string): Mailbox | null {
  const addr = recipient.trim().toLowerCase();
  const [local, domain] = addr.split('@');
  return mailboxes().find((m) => m.address === addr || (domain === brand.domain && m.key === local)) ?? null;
}
