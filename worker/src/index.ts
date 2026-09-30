// Cloudflare Email Worker — bound to the domain's Email Routing catch-all.
//
// For every inbound message:
//   1. Forward the raw message, unmodified, to FORWARD_TO (backup copy in the admin's mailbox)
//   2. If it's addressed to an app address (APP_LOCAL_PARTS, or reply+…), parse it and POST the
//      parsed JSON to APP_INBOUND_URL, signed with HMAC-SHA256 (INBOUND_WEBHOOK_SECRET)
//   3. Anything else (e.g. dmarc@) is forward-only
//
// Site-specific values live in wrangler.toml [vars], so the same code deploys for every FoA domain.

import PostalMime, { type Address, type Email } from 'postal-mime';

export interface Env {
  APP_INBOUND_URL: string;
  FORWARD_TO: string;
  DOMAIN: string;
  APP_LOCAL_PARTS: string; // comma-separated, e.g. "hello,info"
  INBOUND_WEBHOOK_SECRET: string; // wrangler secret
}

const MAX_TEXT = 200_000; // chars — keep the POST well under typical body limits
const MAX_HTML = 400_000;

function mailbox(addr: Address | undefined): { address: string; name: string | null } | null {
  if (!addr || !addr.address) return null;
  return { address: addr.address.toLowerCase(), name: addr.name || null };
}

function mailboxes(list: Address[] | undefined): string[] {
  return (list ?? []).flatMap((a) => (a.address ? [a.address.toLowerCase()] : []));
}

function isAppRecipient(recipient: string, env: Env): boolean {
  const [local, domain] = recipient.toLowerCase().split('@');
  if (domain !== env.DOMAIN.toLowerCase()) return false;
  if (local.startsWith('reply+')) return true;
  return env.APP_LOCAL_PARTS.split(',').map((s) => s.trim().toLowerCase()).includes(local);
}

function header(email: Email, key: string): string | null {
  return email.headers.find((h) => h.key === key)?.value ?? null;
}

async function sign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function byteLength(content: ArrayBuffer | Uint8Array | string): number {
  if (typeof content === 'string') return content.length;
  return content.byteLength;
}

async function postToApp(message: ForwardableEmailMessage, raw: ArrayBuffer, env: Env): Promise<void> {
  const email = await PostalMime.parse(raw);
  const payload = {
    recipient: message.to.toLowerCase(),        // envelope recipient (the address that routed here)
    envelopeFrom: message.from.toLowerCase(),
    from: mailbox(email.from),
    replyTo: mailboxes(email.replyTo),
    to: mailboxes(email.to),
    cc: mailboxes(email.cc),
    subject: email.subject ?? '',
    text: (email.text ?? '').slice(0, MAX_TEXT),
    html: email.html && email.html.length <= MAX_HTML ? email.html : null,
    messageId: email.messageId ?? null,
    inReplyTo: email.inReplyTo ?? null,
    references: email.references ?? null,
    date: email.date ?? null,
    // Auto-replies / bulk mail are recorded by the app but never reopen threads or notify
    autoSubmitted: header(email, 'auto-submitted'),
    precedence: header(email, 'precedence'),
    autoReply: header(email, 'x-autoreply') ?? header(email, 'x-autorespond'),
    attachments: email.attachments
      .filter((a) => a.disposition !== 'inline' || !a.related)
      .map((a) => ({ filename: a.filename, contentType: a.mimeType, size: byteLength(a.content) })),
  };

  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await sign(env.INBOUND_WEBHOOK_SECRET, `${timestamp}.${body}`);

  const res = await fetch(env.APP_INBOUND_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-aa-timestamp': timestamp,
      'x-aa-signature': `sha256=${signature}`,
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`app responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    // Read the raw bytes once; forward() sends the original message independently
    const raw = await new Response(message.raw).arrayBuffer();

    // 1. Backup copy first — the admin's mailbox always gets the message, whatever happens next
    try {
      await message.forward(env.FORWARD_TO);
    } catch (err) {
      console.error('forward failed:', err instanceof Error ? err.message : err);
    }

    // 2. App addresses → parsed POST (the forward above means a failure here loses nothing)
    if (isAppRecipient(message.to, env)) {
      ctx.waitUntil(
        postToApp(message, raw, env).catch((err) =>
          console.error(`post to app failed for ${message.to}:`, err instanceof Error ? err.message : err),
        ),
      );
    }
  },
};
