# Knowledge commons: concept demo

## Resume here

*Updated 2026-10-21.* **Start with "Next on AA: showing how people participate" below**: Karl's current focus on
the AA side, agreed and not yet started. Karl approved the plan below (commons in its own repo + Railway project, live Holon ask
mode, everything else UX with labelled sample data). Briefs filed in [knowledge-commons/](knowledge-commons/).

**Commons** (repo `kjzimmer/knowledgeCommons`, public; local clone `C:\Users\karlz\claudeSites\knowledgeCommons`;
branch `feat/concept-demo`, which Railway `livingSystems` (production env) deploys). Content: 27 artifacts,
32 entries, 10 questions, agents, growth, `demo/` sample data. Web app: every brief §16 page, public interface
`/api/v1` (read, ask, share, reviewer-links for host sites), Holon ask mode behind a provider interface.
Address: https://livingsystems-production.up.railway.app (invite-only). Railway vars set: `REVIEW_LINK_SECRET`,
`PUBLIC_BASE_URL`, `SITE_KEYS` (AA's key), `NODE_ENV`. Steward link: `railway run --service livingSystems npm run
review:link -- --name "Karl Zimmer" --email karl@abundancearchitecture.world --steward` (from the commons clone).
Try Holon from the CLI: `railway run --service livingSystems -- bash -c 'DATABASE_URL= npm run ask -- "…"'`.

**AA** (`feat/site-draft`, staging): Learn opens with the commons (brief §17 text) and asks Holon via
`CommonsService` → `/api/site/holon/ask`; citation notes show the commons entry (`commonsEntry` on each claim in
`references.json`) and link through `/commons-link` (the commons issues the reviewer a signed link);
`global-problems-many-centers` has a sample discussion + position map (`content/discussions.json`,
`content/facilitation.json`, rendered by `server/src/site/discussion.ts`). Staging vars `COMMONS_URL`,
`COMMONS_SITE_KEY` set.

**Holon live (2026-10-20).** Key "knowledge commons", Default workspace scope (Karl can't create workspaces), **expires
2026-11-19**: renew before then or Holon stops. The three `tests/holon.yaml` questions answered well (real
citations, recorded statuses with reasons, source independence noted, objection, unknowns; $0.01–0.03 each),
including one through AA staging → commons interface → Holon.

**Next:** Karl reviews answers on the site and decides on reviewer links; tune Holon's instructions from what he
sees; consider making the answer format a little lighter for short questions. Karl is considering production
access: possibly a teaser on production and the demo on a staging environment, as AA does.

**Where work continues:** future sessions on the commons start **in the commons repo**. Its `CLAUDE.md` and
`docs/STATUS.md` are the authoritative status, decisions and roadmap from here on, including the agreed design for
Holon's "make" mode (presentations, educational material, briefings; one agent in two steps, structured output
rendered by the commons app with PowerPoint/Word/PDF downloads, templates as content, `POST /api/v1/holon/make`
so AA can offer it). This file covers AA's side only.

**Not built (UX only, labelled sample):** curator, auditor, proposal saving/apply, discuss mode, growth loops,
test harness, monthly ledger commits, AA threads/consent/extraction/consolidation.

**Reviewer access (2026-10-21):** Hans and Natalie have AA draft links. They reach the commons draft with the same
link: after opening it, any commons link on AA (Learn's "See how the commons works…", citation notes, or
`https://draft.abundancearchitecture.world/commons-link`) gets them a commons reviewer link ("via Abundance
Architecture", 90 days). Separate commons-only links can be issued for collaborators who come to the commons on
its own terms. Karl is setting up discussions with both.

## Next on AA: showing how people participate (agreed 2026-10-21, not started)

**Karl's goal:** demonstrate how members come to AA and take part in a dialogue with others, the AI facilitator
and Holon (when invited), and how the AI reviews and updates the analysis as the discussion proceeds.
**The demo question stays `global-problems-many-centers`** (Karl confirmed Claude's pick).

**How much is in the brief:** threads, consent, facilitator, Holon invited, extraction after each post, and
"Propose updates" (AI drafts position-map changes, people endorse or dispute, an AA editor applies) are all in
brief §18–19. Extensions: "members" (the draft has invited reviewers only; they stand in for members), and drafting
updates continuously (e.g. every few posts) instead of on an editor's button. That part is fine as an extension.
AI applying changes without a person is not: it would break the brief's "nothing changes without a person in the
right role".

**The three layers (Karl's model, refined).** Today all three are crammed onto one question page with one
thread. Split them:

1. **Layer 1: the question's status.** What we think so far / what we don't know / what would change our mind.
   AI-drafted from the position map and the evidence, endorsed or disputed by reviewers, applied by an AA editor.
   Today these are placeholders.
2. **Layer 2: two things on the question page.**
   - **The position map**: the question's combined memory *across all threads*: positions (holders, evidence,
     responses), cruxes, open questions, parking lot, each linked to the posts it came from. Combined so that the
     same crux reached from two threads shows once, supported from both. Layer 1 is drawn from it.
   - **The list of threads**: each starts from its own angle and shows two labelled summaries side by side: the
     **facilitator's** neutral "what the conversation has uncovered" (no view on the subject) and **Holon's**
     sourced "what the evidence shows" (from the commons, with agreement statuses). They stay separate on purpose:
     the agent that moderates is never the one taking positions.
3. **Layer 3: the thread page.** The conversation: people, facilitator, Holon when invited, consent tick, reply.
   A margin note marks each post that fed the position map ("became crux 1").

**Pages:** question page = layer 1 + position map + thread list ("Join" per thread); thread page = layer 3.

**Build plan:**
1. **Guided replay first (≈ half a day, recommended for Karl's discussions).** Split the pages as above and add a
   step-by-step "play" of the sample: a post arrives; the facilitator responds; someone invites Holon; the
   extraction note appears; the position map gains a position, crux or parking-lot item; AI drafts an update to
   "What we think so far"; an editor applies it. Scripted, no live AI: free and reliable in a meeting. Likely
   two or three sample threads on the question so the combined map makes sense. Content stays in
   `content/discussions.json` (extend the shape for threads, steps and map provenance).
2. **Live participation later** (brief stages 10–12, slimmed; a few days across both repos): reviewers post for
   real, invite Holon (discuss mode built in the commons repo, `POST /api/v1/holon/discuss`), "Propose updates"
   produces real AI-drafted map changes, the facilitator acts only when asked at first. Real token costs and real
   moderation.

---

# Transition Assessment — Abundance Architecture (commons concept demo)
**Date:** 2026-10-20
**Incoming files:** Commons_AA_BuildBrief_v0_2.md, Commons_WhatThisCommonsIs_v0_2.md, Commons_SeedList_v0_1.md,
AA_Site_OpenQuestions.md

## Summary
These are not shared-standard docs. They are a new feature brief: an independent knowledge commons, plus AA's
side of it. Karl's goal for this round is narrower than the brief: a **demonstrable concept** to show potential
collaborators and test for buy-in, not the full build. Nothing blocks starting. The biggest gap is content:
the AA draft holds only 9 references and 10 claims, which is too little for a live Holon to give a convincing
answer.

## Decisions so far (Karl, 2026-10-20)
- Two components: **the commons** (independent, eventually managed by a separate entity) and **AA** (a consumer of
  commons data and services, not its owner)
- The commons gets a **new GitHub repo and a new Railway project** from the start. Content and app share that one
  repo for the demo (the brief asks for two repos; splitting them later is easy)
- **Holon is live, ask mode only** (a real Claude call). The other agents (curator, auditor, discuss mode, AA
  facilitator) and the growth loops are **UX only**, with labelled sample data

## Gap Analysis

### Brief scope vs. concept demo
**Current state:** the brief describes 13 build stages: the full commons, agents, growth loops, and the AA question
with facilitator, extraction and consolidation.
**Required state (this round):** a demo where every part of the commons can be seen, and Holon is real.
**Gap:** most of the brief becomes screens with sample data. Real: storage as files, Holon ask mode, call logging
and costs, fair-use limits, the public read/ask interface, and AA calling it.
**Complexity:** Medium
**Blocking issues:** None

### Content for Holon
**Current state:** `content/references.json` holds 9 references and 10 claims, most with no evidence level or
agreement status set.
**Required state:** roughly 25–40 entries across a few domains, each with evidence level, agreement status,
strongest objection and sources, so that Holon's answers show the standard working.
**Gap:** I draft entries from **openly readable works** whose text I can actually read (e.g. Walker et al. 2004 in
*Ecology and Society*, Ostrom's 2009 Nobel lecture, Meadows' *Leverage Points*, Fullerton's *Regenerative
Capitalism* if its terms allow, plus Karl's own Dialectical Register / framework excerpts if he provides them).
Every one is labelled "AI-drafted (Claude Code), unreviewed", with the model recorded, which follows the commons'
own rule. No quotations attributed to real authors unless taken from a text I have read; paraphrase otherwise.
Copyrighted works (most books on the seed list) enter as citation and summary only, with a placeholder entry in
the permission log.
**Complexity:** Medium (mostly reading time)
**Blocking issues:** None. Karl reviews afterwards

### Commons app
**Current state:** does not exist.
**Required state:** a separate Express + TypeScript app (same stack as AA), server-rendered pages, content as plain
files, a small Postgres for operational data only (Holon sessions, call ledger, rate limits), invite-only access
with signed reviewer links (reusing AA's review-link pattern).
**Gap:** new build.
**Complexity:** Medium
**Blocking issues:** needs the repo, the Railway project and the Anthropic API key (questions below)

### AA site
**Current state:** the draft site on `feat/site-draft` / staging has Learn and citations served from AA's own
`content/` files.
**Required state:** the Learn opening as written in brief §17; the Ask box calling Holon through the commons
interface; citations opening commons entries; one question page with a **sample** facilitated thread, an invited
Holon post, a moderation log and a position map.
**Gap:** moderate changes on `feat/site-draft` only. The live site is untouched.
**Complexity:** Low–Medium
**Blocking issues:** which question (brief §0 `[QUESTION SLUG]`); otherwise I pick one with real disagreement and
mark the pick as mine

## Transition Plan
1. **Commons repo skeleton:** the brief §5 structure (README = definition marked "Draft 0.2, not adopted",
   CHARTER with interim governance, LICENCE placeholder, FUNDING, `map/`, `artifacts/`, `entries/`, `questions/`,
   `agents/`, `tests/`, `ledger/`, `growth/`). Files: Markdown with a YAML header for prose, YAML for lists
2. **App skeleton:** loads and validates the files, full-text index in memory (no vector store), reviewer links,
   deploys to the new Railway project
3. **Content:** move AA's references into artifacts and entries, seed the open questions from the definition and
   the seed list into `growth/`, then draft the open-access entries (above)
4. **Holon, live:** provider interface (Anthropic implemented, OpenAI-compatible shape defined), tools
   (`search_entries`, `get_entry`, `get_question`, `log_gap`), instructions in `agents/holon/`, the answer
   standard, call logging with cost, the 30-per-day per-reviewer limit and a daily spend ceiling
5. **The rest of the commons UX:** Entry, Artifact, Questions, Search, Contribute, Review (sample proposals and
   auditor reports), Agents (real instructions, sample test results), Costs (real once Holon runs), Growth and
   budget dial (illustrative), Funding, Changes (from git history), Permissions, Interface docs
6. **Public interface:** read entries/questions, ask Holon. Documented on the Interface page
7. **AA:** Learn opening + Ask via the interface, citations to commons entries, the sample facilitated question
8. **A short note for Karl:** how to show the demo, issue links, edit Holon's instructions, read costs

Order rationale: the commons comes first, because AA depends on its interface. Content comes before Holon,
because Holon is only as good as what it can find.

## Questions for User
1. **Repo:** create an empty GitHub repo for the commons and send me its URL. The name can stay neutral (e.g.
   `commons`) while `[COMMONS NAME]` is open
2. **Railway:** create the project with a Postgres service. I deploy with the CLI once you've linked it, or you
   connect the repo in the dashboard
3. **Anthropic API key:** set `ANTHROPIC_API_KEY` in the new Railway project yourself (I never see it), and set a
   monthly spend cap in the Claude Console. Suggest $20 for the demo
4. **Draft address:** e.g. `draft.<commons-domain>` later. The Railway default URL is fine to start
5. **Your own documents:** do you want Dialectical Register / framework excerpts in the seed content? If yes, drop
   them in `incoming/`; they go in as own work, labelled
6. **Question for the facilitated demo:** pick one, or I choose and mark it as my pick

## SHARED_FEEDBACK entries
None. The brief refers to `claude/...` paths that live in Karl's Claude.ai project, not this repo. I've treated the
incoming copies as those files.
