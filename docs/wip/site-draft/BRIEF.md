# Brief for Claude Code: build a draft of the new AbundanceArchitecture.world

Written 11 Oct 2026 for Karl Zimmer. This brief and the files beside it are everything you need. Where something is missing, the rule is in section 9: show a placeholder, never invent.

## 0. Karl: fill these in before handing over

- Repository and branch to work from: `[REPO]`
- Where the draft should be deployed (it must not replace the live site): `[STAGING TARGET]`
- How reviewers get in (shared password, invite link, or allowlist): `[ACCESS METHOD]`
- Who receives reviewer feedback: `[EMAIL]`

## 1. What you are building, and why

AbundanceArchitecture.world is currently a single page. It is becoming the home of a public inquiry into human flourishing: a site that publishes its open questions, tests them against evidence and real initiatives, and revises in public. A nonfiction book series, *Abundance Architecture*, is one output of that inquiry.

Build a **draft** of the new site so that Karl can review it properly and show it to two or three trusted contacts before anything goes public. That purpose sets the priorities:

- The whole structure should be visible and clickable, even where content is thin.
- Real content must be clearly distinguishable from placeholders.
- Nothing may be invented to make a page look finished. Reviewers will judge the ideas, and a made-up number or source would damage trust.
- The live site and its subscribers must not be affected.

## 2. Files in this package

| File | What it is |
|---|---|
| `content/home.md` | Final draft copy for the home page. Use it verbatim. |
| `seed/enums.json` | Fixed vocabularies: forms, stages, statuses, evidence levels. |
| `seed/domains.json` | The twelve domains, with structures for each where they exist. |
| `seed/questions.json` | Nine draft questions for the register. |
| `seed/vital-signs.json` | Five vital signs, none with readings yet. |
| `seed/initiatives.json` | Ten sample initiatives. |
| `seed/references.json` | Seven sources and the claims they support. |
| `seed/learn.json` | Example questions and the text for the Learn page. |
| `wireframes/*.dc.html` | Wireframe markup for eight boards. Reference only: see below. |
| `OPEN_QUESTIONS.md` | Karl's log of open questions, for context only. Build to the default given for each item, and do not try to resolve them. |

**Reading the wireframes.** They show layout, hierarchy, wording and which controls exist. They are greyscale on purpose and are not a visual design. In the markup, `{{ name }}` is a template variable filled from the script block at the bottom of the same file, `<sc-for>` is a loop and `<sc-if>` is a conditional. Ignore `support.js`. Do not copy the inline styles.

Wireframe conventions: blue with a lock means members only; a dashed outline means after first launch.

## 3. How to work

1. **Read the existing codebase first.** Karl built the current site and it already has document sharing, email threading, a newsletter and a question form. Follow its stack, conventions and deployment. Do not introduce a new framework or content system if the existing one can do the job.
2. **Report before building.** Reply with what you found, your plan, where content will live, and any question that would change the plan. Then wait for Karl's go-ahead.
3. **Work on a branch and deploy to the staging target only.** Do not merge to the production branch or deploy to the live domain.
4. **Do not send email to real subscribers,** and do not run destructive database migrations without asking.
5. **Commit in stages** that match section 10, so Karl can review progress.

## 4. Scope

**Build fully**

- All pages in section 6, with navigation, footer and cross-links working.
- A way for Karl to add and edit records (questions, signs, initiatives, structures, references, domain analyses) in one place, with every page that shows a record updating from it. Choose the simplest mechanism the existing stack supports and say which you chose.
- Citations: a source link in the text that opens a short note in place.
- The draft banner, reviewer access and reviewer feedback in section 8.

**Build as visible but inactive**

- Member-only actions. Show them where the wireframes show them, with the lock, but they do nothing yet beyond linking to Join.
- The Ask box on the Learn page. Show it with the example questions and a sample answer layout, marked "After first launch". Do not connect it to a model.
- Join. No payments. A form that records interest in becoming a founding member.

**Do not build**

- Payments, member accounts beyond what already exists, comments, working groups, study circles.
- The AI guide, automated data collection for vital signs, or the newsletter assistant.
- Any change to FreeMarketWatch.world or HealthUnveiled.world, with one exception: FreeMarketWatch's footer calls this project "Architecture of Abundance". If that site is in the same repository, correct it to "Abundance Architecture" and tell Karl. Otherwise just tell him.

## 5. Structure and routes

Menu on every page, in this order: **Domains, Questions, Learn, Vital Signs, Initiatives, Book, Report**, then Sign in and a Join button. The site name links to Home.

Footer on every page: About, Ask a question, References, Licence, FreeMarketWatch.world (external).

| Route | Page |
|---|---|
| `/` | Home |
| `/domains`, `/domains/:slug` | The twelve domains; one domain |
| `/questions`, `/questions/:slug` | The question register; one question |
| `/learn` | Learn |
| `/vital-signs`, `/vital-signs/:slug` | Overview; one sign |
| `/initiatives`, `/initiatives/:slug` | The register; one initiative |
| `/book` | The series and essays |
| `/report` | Monthly report archive and email sign-up |
| `/join` | Membership and founding-member interest form |
| `/references`, `/references/:slug` | All sources; one source |
| `/about`, `/licence` | Short static pages |

Adjust route style to the existing site's conventions if they differ.

## 6. Pages

Wireframes exist for the pages marked (W). Build the others to the same pattern.

**Home (W).** Use `content/home.md` verbatim. It opens with the purpose statement in large type, then the question, then four numbered parts. Each part ends with links into the sections named in the copy. The three evidence claims in part 1 each carry a citation.

**Domains (W).** Twelve cards from `seed/domains.json`: number, name, the one-line need, and whether the analysis is drafted or still to write.

**One domain (W, drawn for Health).** In order: the need; the analysis in four parts (how it works today, what abundance would look like here, what stands in the way, what we don't know); a table of structures with form, status and main capture risk; then that domain's questions, vital signs, initiatives and learning material, listed automatically by shared domain tag. Side panel: state of the analysis, neighbouring domains.

**Questions.** A register page following the Initiatives pattern: filter by domain, list of questions. One question page shows: the question, what we think so far, what we don't know, what would change our mind, its evidence status, sources, and a Related panel.

**Learn (W).** Not a browsable library, and it must not grow a hierarchy of pages. Three parts: the Ask box (inactive, see section 4) with example questions from `seed/learn.json`; the latest videos and podcast episode, each with a transcript link; and "How this commons is kept".

**Vital Signs.** Overview listing each sign with its definition, latest reading and development status. One sign page adds method, sources and a Related panel. "Prices in hard-money terms" links out to FreeMarketWatch.

**Initiatives (W).** Filter buttons by form, selects for domain, stage and "ours or watching", and a search box. Columns: initiative, form, domain, stage, what it leaves in common. Side panel explains the six stages.

**One initiative (W).** Tags, a six-step stage tracker, what it is, why it matters, what it leaves in common, a dated status log, what we're learning, and a Related panel.

**References (W).** The three evidence levels explained at the top; filters by domain, kind and evidence status; each source shows its citation, the claim it supports, where it is cited, the evidence status of that claim, and whether it was read in full or in summary.

**Book.** The series title and description, and a list of essays. Placeholders are fine.

**Report.** An archive list and an email sign-up that uses the existing newsletter feature. No issues exist yet.

**Join.** What membership is (copy in `content/home.md`, part 4), the member activities, and the founding-member interest form: name, email, optional note.

## 7. Data model

Six collections. Use the field names in the seed files unless the existing code has a reason to differ.

| Collection | Key fields |
|---|---|
| Domain | slug, name, need, analysis status, four analysis parts, structures |
| Structure (belongs to a domain) | name, form, status, capture risk |
| Question | slug, question, domains, what we think, what we don't know, what would change our mind |
| Vital sign | slug, name, domain, definition, reading, development status |
| Initiative | slug, name, form, domain, stage, whose, owner, leaves in common, status log |
| Reference | slug, citation, kind, domains, url, claims |

Two rules matter more than the exact schema:

- **Shared tags.** Every question, sign, initiative, structure and reference carries one or more **domains**. Initiatives and structures also carry one or more **forms**. Related panels and domain pages are computed from these tags, never hand-maintained.
- **Evidence status belongs to a claim, not a source.** A reference holds a list of claims, each with: the claim text, where it is cited, and its status (established evidence, reasonable extension or speculation). A citation in the text points to one claim.

Fixed vocabularies are in `seed/enums.json`. Allow more than one form per record.

## 8. Behaviours across the site

- **Citation note.** A "Source" link beside a claim opens a small note in place, not a modal. The note shows the short citation, the claim's evidence status, and a link to the reference page. It must work by keyboard and on a phone.
- **Related panel.** On every record page: related questions, vital signs, initiatives and learning material, chosen by shared domain or form.
- **Draft banner.** Every page shows a slim banner: "Draft for review. Not yet public."
- **Reviewer feedback.** Every page has a "Comment on this page" control that records the page address, the reviewer's name and their comment, and delivers it to Karl.
- **Access.** The draft is reachable only by the method Karl names in section 0, and tells search engines not to index it.
- **Existing features.** Keep document sharing, email threading and the newsletter working. "Ask a question" in the footer is the existing question form.

## 9. Content and design rules

- **Never invent content.** No numbers, readings, dates, sources, names, quotations or member counts that are not in these files or already on the existing site.
- **Placeholders stay visible.** Seed text in square brackets, such as `[OWNER NAME]`, is a placeholder. Render it in a distinct muted style so a reviewer can see at a glance what is real and what is pending. An empty or null field renders as a placeholder too, not as blank space.
- **Draft flags.** Some seed records carry `"draft": true` or a `note`. These are Claude's drafts awaiting Karl's edit. Give Karl a way to see which records are flagged; reviewers do not need to see the flag.
- **Use the seed wording exactly.** Do not rewrite copy for style.
- **Visual design.** Carry over the existing site's visual language. The wireframes fix structure and wording only. Calm and readable; no alarm styling.
- **Accessibility and layout.** Real links, buttons and labelled form fields; sufficient text contrast; every page works at phone width.

## 10. Order of work and definition of done

1. Findings and plan, approved by Karl.
2. Content mechanism, data model and seed import.
3. Layout, menu, footer, draft banner, access control, no-index.
4. Home.
5. Domains and the domain page.
6. Initiatives and the initiative page; Questions; Vital Signs.
7. References and the citation note.
8. Learn, Book, Report, Join, About, Licence.
9. Reviewer feedback; a short note for Karl on how to edit each kind of record.

Done means:

- Every menu and footer link leads to a working page, and every seed record has its own page.
- Changing a record in one place changes it everywhere it appears.
- The Health domain page lists its structures and, automatically, its initiatives.
- The three citations on Home open their notes and link to the right references.
- A reviewer with access can read every page on a phone and leave a comment that reaches Karl.
- No bracketed placeholder has been replaced with invented text.
- The live site, its subscribers and its data are unchanged.

## 11. Settled, so do not reopen

- The menu, the twelve domains, the six forms and the three evidence levels.
- Home opens with the purpose statement, then the question.
- Learn is reached by asking, with no browsable hierarchy.
- Everything is free to read; membership is about taking part.
- No payments and no AI guide in this draft.

If something here conflicts with what you find in the codebase, say so in your plan and let Karl decide.

## 12. Coming later: do not build, but do not block

- Member accounts with proposing, commenting and working groups.
- Dues, including possible bitcoin payment.
- The AI guide for Learn, answering only from the site's own commons, with sources, evidence status and the strongest objection on every answer. It will need the commons stored so it can be read in three layers: a small map of the whole, claim-level entries, and full texts and transcripts.
- Scheduled data collection for vital signs.
- A monthly report assembled from changes to the records, so keep a dated change history on records if the stack makes that cheap.
