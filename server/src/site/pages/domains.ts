// src/site/pages/domains.ts
// Domains (wireframe Domains.dc.html) and one domain (Domain.dc.html, drawn for Health). A domain page lists
// its questions, vital signs and initiatives automatically by shared domain tag, never by hand.

import type { Content } from '../../content/load';
import type { Domain } from '../../content/types';
import { html, ph, text } from '../html';
import { lockIcon } from '../layout';
import {
  breadcrumb, enumLabel, formLabels, initiativeList, learningPlaceholder, questionList, signList,
} from '../ui';
import type { PageBody } from './common';

// Wording from the wireframe
const INTRO = 'Twelve areas of life where the structural argument plays out. Each has its own analysis: what the area needs, which structures exist, and which are still missing.';
const CASE_STUDY_LABEL = "The series' primary case study";

const ANALYSIS_PARTS: { key: keyof NonNullable<Domain['analysis']>; heading: string }[] = [
  { key: 'howItWorksToday', heading: 'How it works today' },
  { key: 'whatAbundanceWouldLookLike', heading: 'What abundance would look like here' },
  { key: 'whatStandsInTheWay', heading: 'What stands in the way' },
  { key: 'whatWeDontKnow', heading: "What we don't know" },
];

const pad = (n: number) => String(n).padStart(2, '0');

function analysisChip(d: Domain) {
  return d.analysisStatus === 'drafted'
    ? html`<span class="chip chip-accent">Analysis drafted</span>`
    : html`<span class="chip chip-dashed">Analysis to write</span>`;
}

export function domainsPage(c: Content): PageBody {
  const caseStudy = c.domains.find((d) => d.primaryCaseStudy);
  return {
    title: 'Domains',
    body: html`<div class="page page-wide">
  ${breadcrumb([{ label: 'Home', href: '/' }, { label: 'Domains' }])}
  <h1>Domains</h1>
  <p class="intro">${INTRO}</p>
  ${caseStudy ? html`<p class="callout"><span class="card-label">${CASE_STUDY_LABEL}</span>
    <a href="/domains/${caseStudy.slug}">${caseStudy.name}</a></p>` : ''}
  <ul class="cards cards-3 domain-cards">
    ${c.domains.map((d) => html`<li class="card">
      <p class="domain-number">${pad(d.order)}</p>
      <h2><a href="/domains/${d.slug}">${d.name}</a></h2>
      <p class="card-text">${text(d.need)}</p>
      <p>${analysisChip(d)}</p>
    </li>`)}
  </ul>
</div>`,
  };
}

export function domainPage(c: Content, d: Domain): PageBody {
  const related = c.related({ domains: [d.slug] });
  const references = c.references.filter((r) => r.domains.includes(d.slug));
  const next = c.domains[(c.domains.indexOf(d) + 1) % c.domains.length];
  const neighbours = (d.neighbouringDomains ?? []).map((s) => c.domain(s)).filter((x): x is Domain => !!x);

  return {
    title: d.name,
    body: html`<div class="page page-wide">
  ${breadcrumb([{ label: 'Home', href: '/' }, { label: 'Domains', href: '/domains' }, { label: d.name }])}
  <h1>${d.name}</h1>
  <p class="label">What this area needs</p>
  <p class="need">${text(d.needFull ?? d.need)}</p>
  <nav class="pills" aria-label="On this page">
    <a href="#analysis">The analysis</a>
    <a href="#structures">Structures</a>
    <a href="#records">Questions, signs, initiatives, learning</a>
  </nav>

  <div class="with-aside">
    <div class="main-col">
      <section id="analysis">
        <h2>The analysis</h2>
        ${ANALYSIS_PARTS.map((p) => html`<h3>${p.heading}</h3><p>${text(d.analysis?.[p.key])}</p>`)}
        <p class="section-links">
          ${ph('[LINK TO THE FULL ANALYSIS]')}
          <a class="text-link" href="/references?domain=${d.slug}">${references.length
            ? `${references.length} reference${references.length === 1 ? '' : 's'} for this domain`
            : 'References'}</a>
        </p>
      </section>

      <section id="structures">
        <h2>Structures</h2>
        <p class="hint">What exists, what exists in part, and what has yet to be built.</p>
        ${d.structures.length ? html`<div class="table-scroll">
          <table class="data-table stack">
            <thead><tr><th scope="col">Structure</th><th scope="col">Form</th><th scope="col">Status</th><th scope="col">Main capture risk</th></tr></thead>
            <tbody>
              ${d.structures.map((s) => html`<tr>
                <th scope="row">${s.name}</th>
                <td data-label="Form">${formLabels(c, s.forms)}</td>
                <td data-label="Status">${enumLabel(c.enums.structureStatuses, s.status)}</td>
                <td data-label="Main capture risk">${text(s.captureRisk, '[CAPTURE RISK]')}</td>
              </tr>`)}
            </tbody>
          </table>
        </div>` : html`<p>${ph('[STRUCTURES STILL TO BE IDENTIFIED]')}</p>`}
        <p class="legend">Form is one of: ${c.enums.forms.map((f) => f.label).join(' · ')}</p>
        <p class="legend">Status is one of: ${c.enums.structureStatuses.map((s) => s.label).join(' · ')}</p>
      </section>

      <section id="records">
        <h2>In this domain</h2>
        <p class="hint">Listed automatically from the four collections.</p>
        <div class="record-groups">
          <div class="record-group"><h3>Questions</h3>${questionList(related.questions)}</div>
          <div class="record-group"><h3>Vital Signs</h3>${signList(c, related.signs)}</div>
          <div class="record-group"><h3>Initiatives</h3>${initiativeList(c, related.initiatives)}</div>
          ${learningPlaceholder()}
        </div>
      </section>
    </div>

    <aside class="aside-col">
      <div class="panel">
        <h2>State of this analysis</h2>
        <p>${d.analysisStatus === 'drafted' ? 'Drafted.' : 'To write.'} Last revised ${text(d.lastRevised, '[DATE]')}.</p>
        <p>In the book: ${text(d.inTheBook, '[STAGE AND CHAPTER]')}</p>
      </div>
      <div class="panel panel-members">
        <h2>${lockIcon} Comment on this analysis</h2>
        <p>Members can comment on the working draft. <span class="after-launch">After first launch</span></p>
        <a href="/join">Become a member</a>
      </div>
      <div class="panel">
        <h2>Neighbouring domains</h2>
        ${neighbours.length
          ? html`<ul class="record-list">${neighbours.map((n) => html`<li><a href="/domains/${n.slug}">${n.name}</a></li>`)}</ul>`
          : html`<p>${ph('[NEIGHBOURING DOMAINS]')}</p>`}
      </div>
    </aside>
  </div>

  <nav class="page-foot" aria-label="Domains">
    <a href="/domains">All twelve domains</a>
    <a href="/domains/${next.slug}">Next: ${next.name}</a>
  </nav>
</div>`,
  };
}
