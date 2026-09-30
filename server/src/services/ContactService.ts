import { EmailKind } from '@prisma/client';
import { upsertPerson } from './PersonService';
import * as EmailService from './EmailService';
import * as ConversationService from './ConversationService';
import { contactAck } from '../lib/email/templates';
import { emailFromAddress } from '../lib/email/config';

// At most one acknowledgement per address per hour, however many messages arrive
const ACK_WINDOW_MS = 60 * 60 * 1000;

export interface ContactInput {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

async function sendAck(email: string, personId: string) {
  if (await EmailService.sentRecently(email, EmailKind.CONTACT_ACK, ACK_WINDOW_MS)) return;
  await EmailService.send({
    ...contactAck(),
    to: email,
    kind: EmailKind.CONTACT_ACK,
    personId,
    replyTo: emailFromAddress(),
  });
}

/** Contact form → new OPEN conversation in the admin Inbox, acknowledgement to sender, notice to admin. */
export async function createMessage(input: ContactInput) {
  const { name, email, phone, subject, message } = input;

  const person = await upsertPerson(email, name, phone);

  const conversation = await ConversationService.createFromContactForm({
    personId: person.id, name, email, phone, subject, message,
  });

  // Background — never block the response on email
  sendAck(email, person.id).catch((err) => console.error('[contact] ack failed:', err));
  EmailService.notifyAdmin({
    type: 'Inquiry',
    title: `${subject} — ${name}`,
    rows: [
      ['From', `${name} <${email}>`],
      ...(phone ? ([['Phone', phone]] as [string, string][]) : []),
      ['Subject', subject],
    ],
    body: message,
  }, { replyTo: email });

  return conversation;
}
