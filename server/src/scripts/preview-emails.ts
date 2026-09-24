// Dev utility: sends one of each email template to EMAIL_REDIRECT_TO for visual review.
// Usage: EMAIL_MODE=redirect EMAIL_REDIRECT_TO=you@example.com npx tsx --env-file ../.env src/scripts/preview-emails.ts
import { EmailKind } from '@prisma/client';
import * as T from '../lib/email/templates';
import * as EmailService from '../services/EmailService';
import prisma from '../db';

async function main() {
  const sampleConfirm = `https://abundancearchitecture.world/confirm?t=${'0'.repeat(64)}`;
  const jobs: (T.RenderedEmail & { kind: EmailKind })[] = [
    { ...T.subscribeConfirm(sampleConfirm), kind: EmailKind.SUBSCRIBE_CONFIRM },
    { ...T.contactAck(), kind: EmailKind.CONTACT_ACK },
    {
      ...T.adminNotice({
        type: 'Inquiry',
        title: 'Question about the book — Jane Reader',
        rows: [['From', 'Jane Reader <jane@example.com>'], ['Subject', 'Question about the book']],
        body: 'Hi,\n\nWhen do you expect the first chapters to be available?\n\nThanks,\nJane',
      }),
      kind: EmailKind.ADMIN_NOTIFY,
    },
    {
      ...T.adminNotice({
        type: 'Subscriber',
        title: 'jane@example.com confirmed',
        rows: [['Email', 'jane@example.com'], ['Source', 'abundance-architecture']],
      }),
      kind: EmailKind.ADMIN_NOTIFY,
    },
  ];
  for (const job of jobs) {
    const row = await EmailService.send({ ...job, to: 'preview@example.com' });
    console.log(row.status, row.resendId ?? '', row.error ?? '', '|', job.subject);
  }
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
