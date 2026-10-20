// src/site/pages/sections.ts
// Learn, Book, Report, Join, About, Licence and Ask a question (brief §6). Copy comes from content/pages.json,
// content/learn.json and content/home.json. Forms post JSON through public/site/site.js (with Turnstile):
// Ask → /api/contact (existing), Report → /api/subscribe (existing), Join → /api/site/join.

import type { Content } from '../../content/load';
import { html, Html, ph, text } from '../html';
import { lockIcon } from '../layout';
import { breadcrumb } from '../ui';
import type { PageBody } from './common';
import { commonsConfigured } from '../../services/CommonsService';

interface Field {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'textarea';
  required?: boolean;
  autocomplete?: string;
}

function siteForm(id: string, api: string, fields: Field[], button: string, success: string): Html {
  return html`<form class="site-form" id="${id}" data-api="${api}" data-success="${success}" novalidate>
  ${fields.map((f) => html`<div class="form-field">
    <label for="${id}-${f.name}">${f.label}${f.required ? '' : html` <span class="optional">(optional)</span>`}</label>
    ${f.type === 'textarea'
      ? html`<textarea id="${id}-${f.name}" name="${f.name}" rows="5"${f.required ? html` required` : ''}></textarea>`
      : html`<input id="${id}-${f.name}" name="${f.name}" type="${f.type ?? 'text'}"${f.autocomplete ? html` autocomplete="${f.autocomplete}"` : ''}${f.required ? html` required` : ''}>`}
  </div>`)}
  <button type="submit" class="button">${button}</button>
  <p class="form-status" role="status" aria-live="polite"></p>
</form>`;
}

const simple = (title: string, crumbs: { label: string; href?: string }[], body: Html): PageBody => ({
  title,
  body: html`<div class="page">${breadcrumb([{ label: 'Home', href: '/' }, ...crumbs])}${body}</div>`,
});

export function learnPage(c: Content): PageBody {
  const l = c.learn;
  const videos = l.media.videos.length ? l.media.videos : [null, null, null];
  const connected = commonsConfigured();
  return {
    title: 'Learn',
    body: html`<div class="page page-wide">
  ${breadcrumb([{ label: 'Home', href: '/' }, { label: 'Learn' }])}
  <h1>Learn</h1>
  <h2 class="commons-name">${text(l.commonsName)}</h2>
  ${l.opening.map((p, i) => html`<p${i === 0 ? html` class="intro"` : ''}>${p}</p>`)}

  <section class="ask-box" aria-labelledby="ask-heading" id="holon">
    <div class="ask-head"><h2 id="ask-heading">Ask Holon</h2><span class="after-launch">For reviewers</span></div>
    ${connected ? '' : html`<p class="hint">The commons is not connected on this deployment yet.</p>`}
    <div class="holon-thread" id="holon-thread" aria-live="polite"></div>
    <form class="ask-row" id="holon-form" autocomplete="off">
      <label for="ask-input">${l.askLabel}</label>
      <div class="ask-input-row">
        <input id="ask-input" name="question" type="text" maxlength="2000" placeholder="Ask in your own words"${connected ? '' : html` disabled`}>
        <button type="submit" class="button"${connected ? '' : html` disabled`}>Ask</button>
      </div>
    </form>
    <p class="label">${l.examplesHeading}</p>
    <ul class="example-questions">${l.exampleQuestions.map((q) => html`<li><button type="button" class="holon-example" data-q="${q}"${connected ? '' : html` disabled`}>${q}</button></li>`)}</ul>
    <p class="hint">${l.disclosure}</p>
  </section>

  <p class="commons-through"><a class="text-link" href="/commons-link?to=/how-it-works">${l.commonsLink}</a></p>

  <section id="media" aria-labelledby="media-heading">
    <h2 id="media-heading">${l.media.heading}</h2>
    <p>${l.media.intro}</p>
    <ul class="cards cards-3 media-cards">
      ${videos.map((v) => html`<li class="card card-preview">
        <div class="preview" aria-hidden="true">${ph('[VIDEO]')}</div>
        <div class="card-body">
          <p class="meta">Video · ${ph('[LENGTH]')} · ${ph('[DOMAIN]')}</p>
          <h3>${v ? v.title : ph('[VIDEO TITLE]')}</h3>
          <p>${v ? html`<a href="${v.url}">Watch</a>` : ph('[WATCH]')} · ${v?.transcript ? html`<a href="${v.transcript}">Transcript</a>` : ph('[TRANSCRIPT]')}</p>
        </div>
      </li>`)}
    </ul>
    <div class="card podcast">
      <p class="meta">Podcast · latest episode · ${ph('[LENGTH]')}</p>
      <h3>${l.media.podcastEpisodes[0]?.title ?? ph('[EPISODE TITLE]')}</h3>
      <p>${ph('[LISTEN]')} · ${ph('[TRANSCRIPT]')} · ${ph('[ALL EPISODES]')}</p>
    </div>
  </section>
</div>`,
  };
}

export function bookPage(c: Content): PageBody {
  const b = c.pages.book;
  return simple('Book', [{ label: 'Book' }], html`
  <p class="eyebrow">The series</p>
  <h1><em>${b.seriesTitle}</em></h1>
  <p class="intro">${text(b.seriesDescription)}</p>
  <h2>Essays</h2>
  <ul class="record-list">${b.essays.map((e) => html`<li>${text(e)}</li>`)}</ul>
  <h2>Finished volumes</h2>
  <p><span class="after-launch">After first launch</span></p>
  <div class="panel panel-members">
    <h2>${lockIcon} Draft chapters, with comments</h2>
    <p>Open to members. <span class="after-launch">After first launch</span></p>
    <a href="/join">Become a member</a>
  </div>`);
}

export function reportPage(c: Content): PageBody {
  const r = c.pages.report;
  return simple('Report', [{ label: 'Report' }], html`
  <h1>The Report</h1>
  <p class="intro">${r.intro}</p>
  <h2>${r.archiveHeading}</h2>
  <p>${text(r.archiveEmpty)}</p>
  <section class="panel signup" aria-labelledby="signup-heading">
    <h2 id="signup-heading">${r.signupHeading}</h2>
    <p>${r.signupText}</p>
    ${siteForm('report-signup', '/api/subscribe',
      [{ name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email' }],
      'Follow the report', 'Check your inbox to confirm your subscription.')}
  </section>
  <div class="panel panel-members">
    <h2>${lockIcon} The monthly call</h2>
    <p>For members. <span class="after-launch">After first launch</span></p>
    <a href="/join">Become a member</a>
  </div>`);
}

export function joinPage(c: Content): PageBody {
  const m = c.home.whereWeAre.membership;
  const j = c.pages.join;
  return simple('Join', [{ label: 'Join' }], html`
  <h1>Become a member</h1>
  <p class="intro"><strong>${m.heading}</strong> ${m.text}</p>
  <h2>${m.activitiesHeading}</h2>
  <ul class="member-activities-list">${m.activities.map((a) => html`<li>${lockIcon}<span>${a}</span></li>`)}</ul>
  <p>${text(j.waysIn)}</p>
  <section class="panel signup" aria-labelledby="founding-heading">
    <h2 id="founding-heading">${j.foundingHeading}</h2>
    <p>${text(j.foundingText)}</p>
    ${siteForm('join-form', '/api/site/join', [
      { name: 'name', label: 'Name', required: true, autocomplete: 'name' },
      { name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email' },
      { name: 'note', label: 'Note', type: 'textarea' },
    ], 'Register interest', 'Thank you. Your interest is recorded.')}
    <p class="hint">${j.noPayments}</p>
  </section>`);
}

export function aboutPage(c: Content): PageBody {
  const a = c.pages.about;
  return simple('About', [{ label: 'About' }], html`
  <h1>About</h1>
  <p class="intro">${a.intro}</p>
  ${a.sections.map((s) => html`<h2>${s.heading}</h2>${s.paragraphs.map((p) => html`<p>${text(p)}</p>`)}`)}
  <p class="section-links">${a.links.map((l) => html`<a class="text-link" href="${l.href}">${l.label}</a>`)}</p>`);
}

export function licencePage(c: Content): PageBody {
  return simple('Licence', [{ label: 'Licence' }], html`
  <h1>Licence</h1>
  <p>${text(c.pages.licence.text)}</p>`);
}

export function askPage(c: Content): PageBody {
  return simple('Ask a question', [{ label: 'Ask a question' }], html`
  <h1>Ask a question</h1>
  <p class="intro">${c.pages.ask.intro}</p>
  ${siteForm('ask-form', '/api/contact', [
    { name: 'name', label: 'Your name', required: true, autocomplete: 'name' },
    { name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email' },
    { name: 'subject', label: 'Subject', required: true },
    { name: 'message', label: 'Your message', type: 'textarea', required: true },
  ], 'Send', 'Message received — thank you.')}`);
}
