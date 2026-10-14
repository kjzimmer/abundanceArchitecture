// src/scripts/review-link.ts
// Prints a signed review link for the site draft. The secret must match the server's, so run it with the
// staging environment's variables:
//   railway run --environment staging --service abundanceArchitecture npm run review:link -- --name "Pat Lee" --email pat@example.com
// Add --owner for Karl's own link (also shows draft flags). Locally it reads REVIEW_LINK_SECRET from .env.

import { config } from 'dotenv';
config({ quiet: true }); // loads .env locally; railway run injects the environment's vars (these win). Quiet: stdout is the link
import { createReviewToken } from '../site/review';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const name = arg('name')?.trim();
const email = arg('email')?.trim();
if (!name || !email || !email.includes('@')) {
  console.error('Usage: npm run review:link -- --name "Full Name" --email person@example.com [--owner]');
  process.exit(1);
}

try {
  const token = createReviewToken({ name, email, role: process.argv.includes('--owner') ? 'owner' : 'reviewer' });
  const base = (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
  console.log(`${base}/r/${token}`);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
