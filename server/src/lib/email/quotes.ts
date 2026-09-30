// src/lib/email/quotes.ts
// Splits an inbound plain-text reply into the new part and the quoted history that email
// clients append below it. Conservative: if no known reply marker is found, nothing is cut,
// and if cutting would leave nothing (e.g. a forward with no comment), the full text is kept.

export interface SplitReply {
  visible: string;
  quoted: string | null;
}

// "On <date>, <name> <addr> wrote:" (Gmail, Apple Mail, Thunderbird) — possibly wrapped over lines
const ON_WROTE_START = /^\s*On\s.+/i;
const ON_WROTE_END = /wrote:\s*$/i;
// Common non-English variants of the same line
const WROTE_OTHER = /^\s*(Le\s.+a écrit\s*:|Am\s.+schrieb.*:|El\s.+escribió\s*:|Op\s.+schreef.*:)\s*$/i;
// Outlook
const ORIGINAL_MESSAGE = /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/i;
const UNDERSCORE_RULE = /^\s*_{10,}\s*$/;
const FROM_LINE = /^\s*\*?From:\*?\s.+/i;
const SENT_OR_DATE_LINE = /^\s*\*?(Sent|Date):\*?\s.+/i;

function findCut(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (ORIGINAL_MESSAGE.test(line) || WROTE_OTHER.test(line)) return i;

    if (ON_WROTE_START.test(line)) {
      // Gmail wraps long attribution lines: allow the "wrote:" to arrive up to 2 lines later
      for (let span = 1; span <= 3; span++) {
        if (ON_WROTE_END.test(lines.slice(i, i + span).join(' ').trim())) return i;
      }
    }

    // Outlook header block: "From: …" followed closely by "Sent:"/"Date:" (optionally after a ____ rule)
    if (FROM_LINE.test(line) && lines.slice(i + 1, i + 5).some((l) => SENT_OR_DATE_LINE.test(l))) {
      return i > 0 && UNDERSCORE_RULE.test(lines[i - 1]) ? i - 1 : i;
    }
  }

  // Trailing block of "> " lines (quoted with no attribution line)
  let j = lines.length - 1;
  while (j >= 0 && lines[j].trim() === '') j--;
  if (j >= 0 && lines[j].trimStart().startsWith('>')) {
    let k = j;
    while (k > 0 && (lines[k - 1].trimStart().startsWith('>') || lines[k - 1].trim() === '')) k--;
    return k;
  }
  return -1;
}

export function splitQuotedReply(text: string): SplitReply {
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const cut = findCut(lines);
  if (cut <= 0) return { visible: normalized.trim(), quoted: null };

  const visible = lines.slice(0, cut).join('\n').trim();
  const quoted = lines.slice(cut).join('\n').trim();
  if (!visible) return { visible: normalized.trim(), quoted: null }; // nothing new was written
  return { visible, quoted: quoted || null };
}
