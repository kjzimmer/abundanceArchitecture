// src/site/citation.ts
// The "Source" note beside a claim (brief §8): opens in place, not a modal. Native <details>/<summary> gives
// keyboard and touch support with no script. Shows the short citation, the claim's evidence status (a claim
// property, not the source's) and a link to the reference page.

import type { Content } from '../content/load';
import { html, Html, ph } from './html';

export function evidenceLabel(c: Content, status: string | null | undefined): Html {
  const s = status ? c.enums.evidentiaryStatuses.find((e) => e.id === status) : undefined;
  return s ? html`${s.label}` : ph('[NOT YET RATED]');
}

export function citationNote(c: Content, key: string, label = 'Source'): Html {
  const cite = c.citation(key);
  // Unknown keys are rejected when content loads; this guards hand-written calls
  if (!cite) return ph('[SOURCE MISSING]');
  return html`<details class="cite">
  <summary>${label}</summary>
  <div class="cite-note">
    <p class="cite-short">${cite.reference.shortCitation}</p>
    <p class="cite-status">Evidence status: ${evidenceLabel(c, cite.claim.status)}</p>
    <a href="/references/${cite.reference.slug}">See the reference</a>
  </div>
</details>`;
}
