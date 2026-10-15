// src/site/pages/home.ts
// Home (brief §6, wireframe Main.dc.html): purpose statement, the question, then four numbered parts.
// All copy comes from content/home.json, verbatim from the brief.

import type { Content } from '../../content/load';
import type { HomeAction, HomeLink } from '../../content/types';
import { citationNote } from '../citation';
import { html, Html, ph } from '../html';
import { lockIcon } from '../layout';
import type { PageBody } from './common';

function actions(list: HomeAction[]): Html {
  return html`<div class="actions">${list.map((a) =>
    a.plain
      ? html`<a class="text-link" href="${a.href}">${a.label}</a>`
      : html`<a class="button${a.primary ? '' : ' button-outline'}" href="${a.href}">${a.label}</a>`)}</div>`;
}

function links(list: HomeLink[]): Html {
  return html`<p class="section-links">${list.map((l) => html`<a class="text-link" href="${l.href}">${l.label}</a>`)}</p>`;
}

function partLabel(n: number, label: string): Html {
  return html`<p class="part-label">${n} · ${label}</p>`;
}

const paras = (list: string[]) => list.map((p) => html`<p>${p}</p>`);

export function homePage(c: Content): PageBody {
  const h = c.home;
  const p1 = h.whatAbundanceIs;
  const p2 = h.whyItIsntArriving;
  const p3 = h.whatItWouldTake;
  const p4 = h.whereWeAre;

  return {
    body: html`<div class="home">

<section class="band">
  <div class="wrap opening">
    <h1 class="purpose">${h.opening.purpose}</h1>
    <p class="paradox">${h.opening.question}</p>
    <div class="lede">${paras(h.opening.paragraphs)}</div>
    ${actions(h.opening.actions)}
  </div>
</section>

<section class="band band-light" aria-labelledby="part-1">
  <div class="wrap">
    <div class="split">
      <div>
        ${partLabel(1, p1.label)}
        <h2 id="part-1">${p1.heading}</h2>
        ${paras(p1.body)}
      </div>
      <div>
        <p class="ordinary-heading">${p1.ordinary.heading}</p>
        <ul class="ordinary">
          ${p1.ordinary.items.map((item) => html`<li><span class="image-ph" aria-hidden="true">${ph(p1.ordinary.imagePlaceholder)}</span><span>${item}</span></li>`)}
        </ul>
      </div>
    </div>
    <div class="cards cards-3">
      ${p1.evidence.map((e) => html`<div class="card">
        <p class="card-label">${e.label}</p>
        <p class="card-text">${e.claim}</p>
        ${citationNote(c, e.cite)}
      </div>`)}
    </div>
    <p class="closing-line">${p1.closing}</p>
    ${links(p1.links)}
  </div>
</section>

<section class="band" aria-labelledby="part-2">
  <div class="wrap">
    ${partLabel(2, p2.label)}
    <h2 id="part-2">${p2.heading}</h2>
    <div class="measure">${paras(p2.body)}</div>
    ${p2.points?.length ? html`<ul class="cited-points">
      ${p2.points.map((pt) => html`<li>
        <p><strong>${pt.label}</strong> ${pt.text}</p>
        ${citationNote(c, pt.cite, pt.source)}
      </li>`)}
    </ul>` : ''}
    ${p2.leadIn ? html`<p class="lead-in">${p2.leadIn}</p>` : ''}
    <div class="cards cards-3">
      ${p2.cards.map((card) => html`<div class="card">
        <p class="card-label">${card.title}</p>
        <p class="card-text">${card.text}</p>
      </div>`)}
    </div>
    <div class="measure">${paras(p2.after)}</div>
    <div class="boxed"><p>${p2.boxed}</p></div>
    ${links(p2.links)}
  </div>
</section>

<section class="band band-light" aria-labelledby="part-3">
  <div class="wrap">
    ${partLabel(3, p3.label)}
    <h2 id="part-3">${p3.heading}</h2>
    <div class="cards cards-2">
      ${p3.shifts.map((s) => html`<div class="card">
        <p class="card-label">${s.eyebrow}</p>
        <h3>${s.title}</h3>
        <p class="card-text">${s.text}</p>
      </div>`)}
    </div>
    <div class="measure">${paras(p3.body)}</div>
    ${links(p3.links)}
  </div>
</section>

<section class="band" aria-labelledby="part-4">
  <div class="wrap">
    ${partLabel(4, p4.label)}
    <h2 id="part-4">${p4.heading}</h2>
    <div class="cards cards-4">
      ${p4.cards.map((card) => html`<div class="card card-preview">
        <div class="preview" aria-hidden="true">${ph(card.preview)}</div>
        <div class="card-body">
          <h3>${card.title}</h3>
          <p class="card-text">${card.text}</p>
          <a class="text-link" href="${card.href}">${card.linkText}</a>
        </div>
      </div>`)}
    </div>
    <div class="membership">
      <div>
        <h3>${p4.membership.heading}</h3>
        <p>${p4.membership.text}</p>
        ${actions(p4.membership.actions)}
      </div>
      <div class="member-activities">
        <p class="card-label">${p4.membership.activitiesHeading}</p>
        <ul>
          ${p4.membership.activities.map((a) => html`<li>${lockIcon}<span>${a}</span></li>`)}
        </ul>
      </div>
    </div>
    <p class="closing-quote">${p4.closing}</p>
  </div>
</section>

</div>`,
  };
}
