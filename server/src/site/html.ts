// src/site/html.ts
// Tiny HTML templating for the site draft. `html` escapes every interpolated value unless it is already
// Html (from another `html` call or `raw`), so content can't inject markup by accident.

import { escapeHtml } from '../lib/email/layout';

export class Html {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

type Part = Html | string | number | null | undefined | false | Part[];

function render(part: Part): string {
  if (part == null || part === false) return '';
  if (part instanceof Html) return part.value;
  if (Array.isArray(part)) return part.map(render).join('');
  return escapeHtml(String(part));
}

export function html(strings: TemplateStringsArray, ...parts: Part[]): Html {
  let out = strings[0];
  for (let i = 0; i < parts.length; i++) out += render(parts[i]) + strings[i + 1];
  return new Html(out);
}

/** Trusted markup, inserted as-is */
export function raw(value: string): Html {
  return new Html(value);
}

// Seed placeholders are bracketed, e.g. "[OWNER NAME]" or "[N] sources"
const PLACEHOLDER_RE = /\[[^\]]+\]/g;

/** Shown where a field is null or empty. Generic wording only: never invented content */
export const EMPTY_PLACEHOLDER = '[NOT YET WRITTEN]';

export function ph(label: string): Html {
  return html`<span class="ph">${label}</span>`;
}

/**
 * Renders record text with every bracketed placeholder in the muted placeholder style, and a null or empty
 * value as a placeholder too, so reviewers can see at a glance what is real and what is pending.
 */
export function text(value: string | null | undefined, emptyLabel = EMPTY_PLACEHOLDER): Html {
  if (value == null || value.trim() === '') return ph(emptyLabel);
  const out: Part[] = [];
  let last = 0;
  for (const m of value.matchAll(PLACEHOLDER_RE)) {
    out.push(value.slice(last, m.index), ph(m[0]));
    last = m.index! + m[0].length;
  }
  out.push(value.slice(last));
  return html`${out}`;
}

/** True when the value is missing or consists only of a placeholder */
export function isPending(value: string | null | undefined): boolean {
  return value == null || value.replace(PLACEHOLDER_RE, '').trim() === '';
}
