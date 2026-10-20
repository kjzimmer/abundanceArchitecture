// src/site/pages/questions.ts
// The question register (follows the Initiatives pattern: filter by domain, list) and one question.

import type { Content } from '../../content/load';
import type { Question } from '../../content/types';
import { citationNote, evidenceLabel } from '../citation';
import { discussionAside, discussionSection, positionMap } from '../discussion';
import { html, ph, text } from '../html';
import { lockIcon } from '../layout';
import {
  breadcrumb, domainLinks, domainOptions, membersNotice, queryValue, relatedPanel, selectFilter,
} from '../ui';
import type { PageBody } from './common';

// Wording from the site map wireframe
const INTRO = "What do we know we don't know?";

export function questionsPage(c: Content, query: Record<string, unknown>): PageBody {
  const domain = queryValue(query, 'domain');
  const rows = c.questions.filter((q) => !domain || q.domains.includes(domain));

  return {
    title: 'Questions',
    body: html`<div class="page page-wide">
  ${breadcrumb([{ label: 'Home', href: '/' }, { label: 'Questions' }])}
  <div class="page-head">
    <div>
      <h1>Questions</h1>
      <p class="intro">${INTRO}</p>
    </div>
    ${membersNotice('Members can propose questions and help decide which come next.')}
  </div>

  <form class="filters" method="get" action="/questions">
    <div class="filter-row">
      ${selectFilter('f-domain', 'Domain', 'domain', 'All twelve domains', domainOptions(c), domain)}
      <div class="filter-field filter-apply"><button type="submit" class="button button-outline">Apply</button></div>
    </div>
  </form>

  <ol class="question-register">
    ${rows.length ? rows.map((q) => html`<li class="card">
      <a class="question-link" href="/questions/${q.slug}">${q.question}</a>
      <p class="meta">${domainLinks(c, q.domains)} · Evidence status: ${evidenceLabel(c, q.status)}</p>
    </li>`) : html`<li>No questions in this domain yet. <a href="/questions">Show all</a></li>`}
  </ol>
  <p class="hint result-count" role="status">${rows.length} shown.</p>
</div>`,
  };
}

export function questionPage(c: Content, q: Question): PageBody {
  const next = c.questions[(c.questions.indexOf(q) + 1) % c.questions.length];
  const sources = q.sources ?? [];
  const discussion = c.discussion(q.slug);

  return {
    title: 'Question',
    body: html`<div class="page page-wide">
  ${breadcrumb([{ label: 'Home', href: '/' }, { label: 'Questions', href: '/questions' }, { label: 'Question' }])}
  <h1 class="question-title">${q.question}</h1>
  <p class="tags">
    ${q.domains.map((d) => html`<a class="chip" href="/domains/${d}">Domain: ${c.domain(d)?.name ?? d}</a>`)}
    <span class="chip">Evidence status: ${evidenceLabel(c, q.status)}</span>
  </p>

  <div class="with-aside">
    <div class="main-col">
      <section><h2>What we think so far</h2><p>${text(q.whatWeThinkSoFar)}</p></section>
      <section><h2>What we don't know</h2><p>${text(q.whatWeDontKnow)}</p></section>
      <section><h2>What would change our mind</h2><p>${text(q.whatWouldChangeOurMind)}</p></section>
      <section><h2>Sources</h2>
        ${sources.length
          ? html`<ul class="source-list">${sources.map((k) => {
              const cite = c.citation(k);
              return html`<li>${cite ? cite.claim.claim : k} ${citationNote(c, k)}</li>`;
            })}</ul>`
          : html`<p>${ph('[SOURCES]')}</p>`}
      </section>
      ${discussion ? positionMap(discussion) : ''}
      ${discussion ? discussionSection(c, discussion) : ''}
    </div>
    <aside class="aside-col">
      ${discussion ? discussionAside(c, discussion) : ''}
      <div class="panel panel-members">
        <h2>${lockIcon} Help set which questions come next</h2>
        <p>Propose questions and help decide which come next. <span class="after-launch">After first launch</span></p>
        <a href="/join">Become a member</a>
      </div>
      ${relatedPanel(c, { domains: q.domains }, q)}
    </aside>
  </div>

  <nav class="page-foot" aria-label="Questions">
    <a href="/questions">All questions</a>
    <a href="/questions/${next.slug}">Next question</a>
  </nav>
</div>`,
  };
}
