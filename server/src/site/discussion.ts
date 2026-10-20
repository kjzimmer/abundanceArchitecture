// src/site/discussion.ts
// A question's facilitated discussion and its position map (docs/wip/knowledge-commons.md, brief §18–19).
// In the concept demo the discussion is sample data from content/discussions.json; nothing here is interactive.

import type { Content } from '../content/load';
import type { Discussion, DiscussionPost, MapEvidence } from '../content/types';
import { escapeHtml } from '../lib/email/layout';
import { html, Html, raw } from './html';

const commonsHref = (id: string) => `/commons-link?to=/entries/${encodeURIComponent(id)}`;

/** Post text: paragraphs, with Holon's [[entry:id]] citations turned into links into the commons */
function postText(text: string): Html {
  return raw(
    text
      .split(/\n{2,}/)
      .map((p) => `<p>${escapeHtml(p).replace(/\[\[entry:([a-z0-9-]+)\]\]/g, (_m, id: string) => `<a class="cite-chip" href="${commonsHref(id)}">${id}</a>`)}</p>`)
      .join(''),
  );
}

function evidence(e: MapEvidence): Html {
  return e.commonsEntry
    ? html`${e.text} <a class="cite-chip" href="${commonsHref(e.commonsEntry)}">${e.commonsEntry}</a>`
    : html`${e.text}`;
}

function post(p: DiscussionPost): Html {
  const label =
    p.kind === 'facilitator' ? html`<span class="post-badge post-badge-ai">AI facilitator</span>`
      : p.kind === 'holon' ? html`<span class="post-badge post-badge-holon">Holon (the commons' agent)</span>${p.invitedBy ? html` <span class="post-meta">invited by ${p.invitedBy}</span>` : ''}`
        : html`<span class="post-author">${p.author}</span> <span class="post-badge">Sample participant</span>`;
  return html`<li class="post post-${p.kind}${p.held ? ' post-held' : ''}" id="post-${p.n}">
  <p class="post-head"><span class="post-n">${p.n}</span> ${label} <span class="post-meta">${p.when}</span></p>
  ${p.held ? html`<p class="post-held-note">Held for review: hidden while a moderator looks at it.</p>` : postText(p.text)}
</li>`;
}

export function positionMap(d: Discussion): Html {
  const m = d.positionMap;
  return html`<section class="position-map" aria-labelledby="map-heading">
  <h2 id="map-heading">Position map</h2>
  <p class="hint">This question's public memory, built from the discussion below. "What we think so far" is one labelled entry on it. Changes are proposed, reviewed by reviewers and applied by an AA editor; nothing is rewritten automatically.</p>
  <ol class="map-positions">${m.positions.map((p) => html`<li class="card">
    <p class="map-position">${p.position}</p>
    <p class="post-meta">Held by: ${p.holders.join('; ')}</p>
    ${p.evidence.length ? html`<p class="map-evidence"><span class="label">Evidence</span> ${p.evidence.map((e, i) => html`${i ? html`<br>` : ''}${evidence(e)}`)}</p>` : ''}
    ${p.responses.length ? html`<p class="map-evidence"><span class="label">Responses</span> ${p.responses.join('; ')}</p>` : ''}
  </li>`)}</ol>
  <h3>What it turns on</h3>
  <ul>${m.cruxes.map((c) => html`<li>${c.text} <span class="post-meta">Confirmed by ${c.confirmedBy.join(' and ')} (${c.from})</span></li>`)}</ul>
  <h3>Open questions</h3>
  <ul>${m.openQuestions.map((q) => html`<li>${q}</li>`)}</ul>
  <h3>Parking lot</h3>
  <ul>${m.parkingLot.map((x) => html`<li>${x.text} <span class="post-meta">(${x.from})</span></li>`)}</ul>
  <h3>Sent to the commons</h3>
  <ul>${d.toCommons.map((x) => html`<li>${x.item}<br><span class="post-meta">${x.status}</span></li>`)}</ul>
  <p class="actions-row"><button type="button" class="button button-outline" disabled>Propose updates (AA editors)</button></p>
</section>`;
}

export function discussionSection(c: Content, d: Discussion): Html {
  const f = c.facilitation;
  return html`<section class="discussion" aria-labelledby="discussion-heading">
  <h2 id="discussion-heading">Discussion</h2>
  <p class="sample-banner"><strong>Sample discussion.</strong> The participants are fictional and every post was written to show how a facilitated question would work. ${d.pickNote ?? ''}</p>
  <ol class="thread">${d.thread.map(post)}</ol>
  <div class="reply-box">
    <label class="consent"><input type="checkbox" disabled> ${f.consent}</label>
    <textarea rows="3" disabled placeholder="Reply (not open in the concept demo)"></textarea>
    <p class="actions-row"><button type="button" class="button" disabled>Post</button> <button type="button" class="button button-outline" disabled>Invite Holon</button></p>
  </div>
</section>`;
}

/** Aside: how the discussion is kept, the norms, and the public moderation log */
export function discussionAside(c: Content, d: Discussion): Html {
  const f = c.facilitation;
  return html`<div class="panel discussion-aside">
  <h2>How this discussion is kept</h2>
  <p><strong>${f.facilitator.label}.</strong> Abundance Architecture's own agent manages the process and has no view on the subject. It is never counted as a participant, and its words never become positions. Holon, the commons' agent, joins only when invited, and its posts are labelled.</p>
  <details><summary>The facilitator's instructions</summary>${f.facilitator.instructions.map((p) => html`<p>${p}</p>`)}<p class="post-meta">Model: ${f.facilitator.model}</p></details>
  <h3>Norms</h3>
  <p>${f.norms.intro}</p>
  <ul>${f.norms.items.map((n) => html`<li>${n}</li>`)}</ul>
  <p class="post-meta">The facilitator acts on three rungs only: ${f.norms.rungs.map((r, i) => html`${i + 1}. ${r} `)}${f.norms.never}</p>
  <h3>Moderation log</h3>
  <ul class="mod-log">${d.moderationLog.map((x) => html`<li>${x.when}, <a href="#post-${x.post}">post ${x.post}</a>, rung ${x.rung}: ${x.action}</li>`)}</ul>
  ${d.notActedOn ? html`<p class="post-meta">${d.notActedOn}</p>` : ''}
</div>`;
}
