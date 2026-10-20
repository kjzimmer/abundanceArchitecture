# [COMMONS NAME]: what this commons is

Draft 0.2, 18 Oct 2026. Claude's draft for Karl Zimmer; nothing here is adopted. Intended to become the opening of the commons repository's README and charter. Replaces draft 0.1.

## Purpose

This commons gathers what we know about living, complex adaptive systems, including human societies, and what helps them flourish. It makes that knowledge freely available to anyone, in whatever form they need, on infrastructure the commons itself provides, and it is honest about what is settled, what is contested and what nobody yet knows.

It exists because how we understand living systems, from a body to an ecosystem to a society, shapes how we treat them, and much of that understanding is scattered, paywalled, siloed by discipline or presented with more certainty than it deserves. Locked-up knowledge slows understanding and deepens inequity; open knowledge can let us learn faster, and more fairly.

## What it covers

- **How living systems work.** Complexity, emergence, feedback, resilience, self-organization, and the science behind them.
- **Human societies as living systems.** Economies, health, education, governance, commons and communities, studied as complex adaptive systems.
- **The condition of our systems today.** Evidence and arguments about where they are healthy and where they are failing, including diagnoses such as "polycrisis", the objections to those diagnoses, and the measures used to tell.
- **Ways of seeing.** The lenses people use to understand systems: what each reveals, what each hides, and where each fits.
- **What helps systems flourish.** Principles, designs, and results from real initiatives, with what worked, what failed and why.
- **What it is like.** Experiential knowledge: accounts from practitioners and communities of living and working in healthier or less healthy systems, recorded as such.

## What it holds

A commons is a shared resource, a community, and the rules that community makes. This one has six parts:

| Part | What it is |
|---|---|
| **Artifacts** | The raw material in every form: papers, books, articles, videos, podcasts, datasets, archives of discussions contributed with participants' consent, and records from classrooms and initiatives. Each records its source, its rights status and how it entered the commons. Video and audio carry timestamped transcripts, so a claim can point to the moment it was said. |
| **Knowledge** | What the artifacts say, made explicit: claim entries, the strongest objections to them, evidence levels, agreement status, positions, cruxes (what a disagreement turns on) and open questions. Every item links to the artifacts it came from. |
| **Access** | The means of getting knowledge out: Holon and the other agents (below), their instructions, retrieval methods, the answer standard, and the test sets that define what a good answer is. All public, versioned and forkable. |
| **Infrastructure** | The storage, the running agents and the public interfaces through which anyone can read, ask and contribute. |
| **Rules** | The licence, the charter, and how contributions are made, checked, reviewed and disputed. |
| **Community** | The contributors and stewards. Without them the rest is an archive, not a commons. |

## Infrastructure

Knowledge is only free if the means of reaching it are free. The commons therefore runs its own infrastructure: storage for everything it holds, Holon for anyone to ask, and open interfaces through which other sites and tools can read from it and contribute to it.

Anyone may also run the commons' agents themselves, from the published definitions or a fork of them. The commons' own infrastructure guarantees availability; forkability guarantees against capture.

**The AI layer is a shared, finite resource.** A document costs almost nothing however often it is read; every AI answer costs money. The documents are close to a public good, but the AI budget is a common-pool resource that use can exhaust. It is governed as one: fair-use limits that apply to everyone, usage that anyone can see, and a fair process for adjusting both.

**Non-extractive and transparent in every way:**

- Costs are published: spend per month, per answer and per agent, and what it buys.
- Funding is published: every source is named. Abundance Architecture is listed as a funder while it is one.
- No advertising. Nothing about anyone is sold.
- Private questions are not used to train any model and are not published.
- No lock-in to one AI provider (below).

## Holon and the other agents

**Holon** is the commons' agent. A holon is something that is at once a whole and a part of a larger whole, which is how this commons sees living systems, including itself.

Holon:

- answers anyone's questions in the form they need, under the state-of-knowledge standard;
- analyzes: it can draw together many interacting conditions, propose connections and cruxes, and flag when thinking slips back into treating a living whole as only its parts;
- **participates in discussions** wherever it is invited, on any site, as a labelled contributor whose contributions are checked like anyone's. It speaks when asked, or when it has something sourced to add. It does not answer every post, and it never presents itself as a person.

Behind Holon, the commons defines other roles, each with public instructions and test sets:

- **Curator:** drafts claim entries from new artifacts.
- **Auditor:** checks contributions, from people and agents alike (below). Where possible it runs on a different model from the one whose work it checks.

**Facilitators are not commons agents.** A site that hosts discussions may run its own facilitator to manage the process: summaries, tangents, moderation. A facilitator belongs to its host, has no view on the subject, and is not counted as a participant. Keeping the two apart is a separation of powers: the agent that contributes knowledge is never the one that moderates the people who disagree with it.

**Many models, not one.** The commons starts on one provider's models (Anthropic's Claude) and intends to run on a mix, including open-source models it can host itself. Agent definitions are written to run on any capable model; every answer and contribution records which model produced it; and the transparency pages list every model in use and how each performed on the test sets.

## The state-of-knowledge standard

Holon, and any agent built on this commons, may change the **form** of an answer freely: a short brief, a comparison, a lesson, a talk. It may not change its **honesty**. Every substantive answer reports the state of knowledge:

- what the commons holds on the question, with sources;
- where those sources converge, where they conflict, and where they are silent;
- the agreement status of each point and the reason for it;
- the strongest objection;
- what we don't know.

A person may ask for an answer to be shorter, simpler or more visual. They may not ask for disagreement to be left out, and agents do not leave it out.

**Agreement status** is recorded in the knowledge layer, not improvised by an agent:

| Status | Meaning |
|---|---|
| Settled | Independent lines of strong evidence converge, and serious objections have been answered. |
| Leaning | The weight of evidence points one way, with live objections. |
| Contested | Credible evidence or argument points in different directions. |
| Unknown | Studied, without a clear answer. |
| Not studied | No serious evidence either way. |

Each status records why it was given and what would change it. When no status has been recorded, Holon may give its own reading, says that it is doing so, and logs the gap so a status can be recorded.

**What counts toward agreement** is evidence, not authority:

- the evidence level (established evidence, reasonable extension, speculation) and the kind of evidence (replicated study, observation, model or simulation, historical case, theory, analysis, practitioner experience);
- the **independence** of sources: many works resting on one study count as one;
- recency, where the subject changes;
- the **kind of disagreement**: about facts, about values, or about frame and scale. In complex systems, sources that seem to conflict are sometimes both right at different scales, and an honest answer says so.

The standing of an institution or author is recorded, but it is not a reason to rank one claim over another.

## Contributions and checks

**A contribution is judged by its kind, not by who made it.** People and agents contribute under the same rules, and every contribution records its contributor. For an agent, that means the agent, the model, the version of its instructions and the inputs it used, so the contribution can be reproduced.

**Analysis is weighed by its method, not counted as a source.** Analysis, by a person or an agent, can settle a question: an analysis of new evidence, a synthesis that pools many studies, or a re-reading that finds the flaw behind an apparent conflict. It does not count as an additional independent source on top of the evidence it analyzes. An analysis can change a claim's agreement status when its method is explicit and reproducible, its inputs are traceable, and an independent check confirms it.

**The same checks apply to everyone**, because people and machines both bring bias, conflicts of interest, hidden aims and flawed reasoning:

- **Provenance:** does the contribution say what its sources say?
- **Integrity:** has any position been dropped or weakened without a cited reason; are sources double-counted?
- **Reasoning:** is the method sound; does it isolate one variable and ignore its feedbacks, mismatch scales, or give a single cause for an emergent outcome?
- **Dispute:** anyone may dispute any item, and disputes stay visible until resolved. "Unresolved" is an acceptable outcome.
- **Review:** additions (a new artifact, entry, objection, position, question) need a lower bar than status changes (an evidence level, an agreement status, a merge, a withdrawal).
- **Patterns:** contribution patterns over time, such as coordinated or one-sided activity, are monitored in the open, for people and agents alike.

Some checks address risks that are larger for agents: checks on an agent's work come from a different model or from people, never from the same model checking itself; agents' contributions are limited in volume so they cannot swamp human review; and AI-derived content stays labelled, so agents can tell it apart from primary evidence and do not reinforce their own framing.

## Lenses and purposes

Knowledge is always presented through some frame. This commons makes frames explicit instead of hiding them:

- **The commons holds lenses as content**, including the mechanistic and living-systems lenses, each with its evidence, its uses and its limits. Reductionism is treated as a natural part of how understanding is built: taking a system apart to learn how its parts work. Holism completes the story, showing how the parts behave together, what emerges, and what is lost when the whole is managed as if it were only its parts. The commons records where each is enough on its own and where both are needed.
- **A guide or pathway may present knowledge through a declared purpose**, such as orienting leaders to living-systems thinking, provided it states its purpose and premises at the outset and the state-of-knowledge standard still applies.
- **Diagnoses of what society needs are claims**, including the claim that our most urgent need is a shift of lens. Each carries its evidence, objections and agreement status, and can change as evidence and conditions change. The commons does not build any one diagnosis into how it presents everything else.

## Open knowledge and copyright

The commons aims to hold the full text of every work it relies on, because knowledge locked behind paywalls and permissions slows understanding and falls hardest on those with the fewest resources.

It pursues that aim lawfully and in the open:

- it holds full texts that are its contributors' own work, openly licensed, in the public domain, or released with the rights holder's permission;
- it **asks for permission**, publicly recording each request and its outcome, and invites authors to release their work to the commons;
- for everything else, it holds the citation, its own summary, short quotations and a link, and says plainly that the full text is not held and why.

Whether knowledge of this kind should be enclosed at all is a question this commons exists to debate. It is recorded as an open question, with its positions and evidence, like any other.

## What the commons does not do

- It does not take positions as an institution. It records the positions of others, attributed, and Holon reports the state of knowledge rather than its own beliefs.
- It does not rank knowledge by the authority of who holds it.
- It does not hold copyrighted full texts without permission.
- It does not collect private conversations. Discussion enters only as consented, attributed contributions.
- It does not belong to any one site, organization, steward or AI provider.

## Independence

- **Licence:** `[LICENCE TO BE CHOSEN]`, one that permits copying, adapting and forking.
- **Repository:** all content, agent definitions and test sets are kept as plain files in a public repository that anyone can copy and read without special software.
- **Forkability:** if the commons' governance ever fails or is captured, anyone may take a full copy and continue.
- **Model plurality:** no dependence on a single AI provider, with a path to self-hosted open-source models.
- **Infrastructure and funding in the open:** every cost and every funder is published.

## Governance (interim)

Until a charter is adopted:

- `[INTERIM STEWARDS]` review contributions, and every change is recorded in the repository's history.
- The checks and review rules above apply from the start.
- Changes to agent definitions and test sets follow the same process, and a changed agent must pass the public test sets.
- The interim stewardship is temporary. The charter will set the conditions for handing it over: `[HANDOVER CONDITIONS]`.

## Relationship to Abundance Architecture

Abundance Architecture started this commons and funds it for now. It is one participant: a contributor that uses the same public interfaces as anyone else, and one place where the commons' knowledge is shared, debated and put to use. Abundance Architecture's thesis is recorded in the commons as content, with its evidence, objections and agreement status, not as the commons' conclusion.

## Open questions

- The commons' name.
- The licence.
- The charter, including how status changes are approved (endorsement across positions has been proposed) and the handover conditions.
- How the AI budget is funded and how fair-use limits are set.
- Whether the five agreement statuses are the right ones.
- How experiential knowledge is weighed alongside research.
- Should knowledge about living systems be freely held and shared regardless of copyright?
- When the commons becomes a legal entity or joins a fiscal sponsor.
