// src/site/citation.ts
// The "Source" note beside a claim (brief §8): opens in place, not a modal. Native <details>/<summary> gives
// keyboard and touch support with no script. Shows the short citation and the claim's status. When the claim has
// a matching entry in the knowledge commons, the note shows the commons' recorded agreement status and evidence
// level and links through to the entry (docs/wip/knowledge-commons.md).

import type { Content } from '../content/load';
import { entrySummary } from '../services/CommonsService';
import { html, Html, ph } from './html';

export function evidenceLabel(c: Content, status: string | null | undefined): Html {
  const s = status ? c.enums.evidentiaryStatuses.find((e) => e.id === status) : undefined;
  return s ? html`${s.label}` : ph('[NOT YET RATED]');
}

const AGREEMENT: Record<string, string> = {
  settled: 'Settled', leaning: 'Leaning', contested: 'Contested', unknown: 'Unknown', 'not-studied': 'Not studied',
};
const LEVEL: Record<string, string> = {
  established: 'Established evidence', extension: 'Reasonable extension', speculation: 'Speculation',
};

export function citationNote(c: Content, key: string, label = 'Source'): Html {
  const cite = c.citation(key);
  // Unknown keys are rejected when content loads; this guards hand-written calls
  if (!cite) return ph('[SOURCE MISSING]');
  const entryId = cite.claim.commonsEntry;
  const entry = entryId ? entrySummary(entryId) : undefined;
  return html`<details class="cite">
  <summary>${label}</summary>
  <div class="cite-note">
    <p class="cite-short">${cite.reference.shortCitation}</p>
    ${entry
      ? html`<p class="cite-status">In the commons: ${AGREEMENT[entry.agreement.status] ?? entry.agreement.status} · ${LEVEL[entry.evidence.level] ?? entry.evidence.level}${entry.review === 'reviewed' ? '' : ' · not yet reviewed'}</p>
    <p class="cite-why">${entry.agreement.why}</p>
    <a href="/commons-link?to=/entries/${entry.id}">See the entry in the commons</a> · <a href="/references/${cite.reference.slug}">See the reference</a>`
      : html`<p class="cite-status">Evidence status: ${evidenceLabel(c, cite.claim.status)}</p>
    ${entryId ? html`<a href="/commons-link?to=/entries/${entryId}">See the entry in the commons</a> · ` : ''}<a href="/references/${cite.reference.slug}">See the reference</a>`}
  </div>
</details>`;
}
