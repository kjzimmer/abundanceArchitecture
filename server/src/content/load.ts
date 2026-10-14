// src/content/load.ts
// Loads and validates the site-draft content in content/*.json. The files are the single place records are
// edited; every page reads from the Content object built here. Validation runs at startup, so a broken
// cross-reference (unknown domain, form, stage, citation…) fails the deploy instead of rendering a broken page.

import fs from 'fs';
import path from 'path';
import type {
  Citation, Claim, Domain, Enums, FlagEntry, Initiative, Learn, Question, Reference, VitalSign,
} from './types';

// Same depth from src/content (tsx) and dist/content (compiled): repo root is three levels up
const CONTENT_DIR = path.join(__dirname, '..', '..', '..', 'content');

export interface Related {
  questions: Question[];
  signs: VitalSign[];
  initiatives: Initiative[];
  references: Reference[];
}

export interface Content {
  enums: Enums;
  domains: Domain[];
  questions: Question[];
  signs: VitalSign[];
  initiatives: Initiative[];
  references: Reference[];
  learn: Learn;
  domain(slug: string): Domain | undefined;
  question(slug: string): Question | undefined;
  sign(slug: string): VitalSign | undefined;
  initiative(slug: string): Initiative | undefined;
  reference(slug: string): Reference | undefined;
  citation(key: string): Citation | undefined;
  /** Records sharing a domain (any collection) or a form (initiatives). Never hand-maintained */
  related(tags: { domains?: string[]; forms?: string[] }, exclude?: { slug: string }): Related;
  /** Records and files flagged draft or carrying a note (owner-only view) */
  flags: FlagEntry[];
  /** Non-fatal issues, e.g. a record with no domain tag yet */
  warnings: string[];
}

function readJson<T>(file: string): T {
  const full = path.join(CONTENT_DIR, file);
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8')) as T;
  } catch (err) {
    throw new Error(`content/${file}: ${(err as Error).message}`);
  }
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function loadContent(): Content {
  const enums = readJson<Enums>('enums.json');
  const domainsFile = readJson<{ note?: string; domains: Domain[] }>('domains.json');
  const questionsFile = readJson<{
    note?: string;
    answerPlaceholders: Record<'whatWeThinkSoFar' | 'whatWeDontKnow' | 'whatWouldChangeOurMind', string>;
    questions: Question[];
  }>('questions.json');
  const signsFile = readJson<{ note?: string; signs: VitalSign[] }>('vital-signs.json');
  const initiativesFile = readJson<{ note?: string; initiatives: Initiative[] }>('initiatives.json');
  type SeedClaim = Omit<Claim, 'id'> & { id?: string };
  const referencesFile = readJson<{
    note?: string;
    references: (Omit<Reference, 'claims'> & { claims: SeedClaim[] })[];
  }>('references.json');
  const learn = readJson<Learn>('learn.json');

  const errors: string[] = [];
  const warnings: string[] = [];

  const domains = [...domainsFile.domains].sort((a, b) => a.order - b.order);

  // Unanswered question fields show the file's placeholder text
  const ph = questionsFile.answerPlaceholders;
  const questions = questionsFile.questions.map((q) => ({
    ...q,
    whatWeThinkSoFar: q.whatWeThinkSoFar ?? ph.whatWeThinkSoFar,
    whatWeDontKnow: q.whatWeDontKnow ?? ph.whatWeDontKnow,
    whatWouldChangeOurMind: q.whatWouldChangeOurMind ?? ph.whatWouldChangeOurMind,
  }));

  const signs = signsFile.signs;
  const initiatives = initiativesFile.initiatives;
  const references: Reference[] = referencesFile.references.map((r) => ({
    ...r,
    claims: r.claims.map((c, i) => ({ ...c, id: c.id ?? String(i + 1) })),
  }));

  // ── Validation ────────────────────────────────────────────────────────────
  const ids = (items: { id: string }[]) => new Set(items.map((i) => i.id));
  const formIds = ids(enums.forms);
  const stageIds = ids(enums.initiativeStages);
  const whoseIds = ids(enums.whose);
  const structureStatusIds = ids(enums.structureStatuses);
  const evidenceIds = ids(enums.evidentiaryStatuses);
  const analysisIds = ids(enums.analysisStatuses);
  const signStatusIds = ids(enums.vitalSignStatuses);
  const domainSlugs = new Set(domains.map((d) => d.slug));

  const checkSlugs = (collection: string, records: { slug: string }[]) => {
    const seen = new Set<string>();
    for (const r of records) {
      if (!SLUG_RE.test(r.slug)) errors.push(`${collection}: invalid slug "${r.slug}"`);
      if (seen.has(r.slug)) errors.push(`${collection}: duplicate slug "${r.slug}"`);
      seen.add(r.slug);
    }
  };
  const checkIn = (where: string, field: string, value: string | null | undefined, allowed: Set<string>, nullable = false) => {
    if (value == null) {
      if (!nullable) errors.push(`${where}: ${field} is missing`);
    } else if (!allowed.has(value)) {
      errors.push(`${where}: unknown ${field} "${value}"`);
    }
  };
  const checkDomains = (where: string, list: string[] | undefined, requireOne = true) => {
    for (const d of list ?? []) checkIn(where, 'domain', d, domainSlugs);
    if (requireOne && !(list && list.length)) warnings.push(`${where}: no domain tag yet (won't appear on any domain page)`);
  };
  const checkForms = (where: string, list: string[] | null | undefined) => {
    for (const f of list ?? []) checkIn(where, 'form', f, formIds);
  };

  checkSlugs('domains', domains);
  checkSlugs('questions', questions);
  checkSlugs('vital-signs', signs);
  checkSlugs('initiatives', initiatives);
  checkSlugs('references', references);

  for (const d of domains) {
    const where = `domains/${d.slug}`;
    checkIn(where, 'analysisStatus', d.analysisStatus, analysisIds);
    for (const n of d.neighbouringDomains ?? []) checkIn(where, 'neighbouring domain', n, domainSlugs);
    for (const s of d.structures) {
      checkIn(`${where} structure "${s.name}"`, 'status', s.status, structureStatusIds);
      checkForms(`${where} structure "${s.name}"`, s.forms);
    }
  }
  for (const q of questions) {
    const where = `questions/${q.slug}`;
    checkDomains(where, q.domains);
    checkIn(where, 'evidence status', q.status, evidenceIds, true);
  }
  for (const s of signs) {
    const where = `vital-signs/${s.slug}`;
    checkDomains(where, s.domains);
    checkIn(where, 'status', s.status, signStatusIds);
  }
  for (const i of initiatives) {
    const where = `initiatives/${i.slug}`;
    checkDomains(where, i.domains);
    checkForms(where, i.forms);
    if (!i.forms.length) errors.push(`${where}: needs at least one form`);
    checkIn(where, 'stage', i.stage, stageIds);
    checkIn(where, 'whose', i.whose, whoseIds);
  }
  const kinds = new Set(enums.sourceKinds);
  const howRead = new Set(enums.howRead);
  for (const r of references) {
    const where = `references/${r.slug}`;
    checkDomains(where, r.domains);
    checkIn(where, 'kind', r.kind, kinds);
    checkIn(where, 'howRead', r.howRead, howRead, true);
    if (!r.claims.length) errors.push(`${where}: needs at least one claim`);
    const claimIds = new Set<string>();
    for (const c of r.claims) {
      if (claimIds.has(c.id)) errors.push(`${where}: duplicate claim id "${c.id}"`);
      claimIds.add(c.id);
      checkIn(`${where} claim ${c.id}`, 'evidence status', c.status, evidenceIds, true);
    }
  }

  // ── Lookups ───────────────────────────────────────────────────────────────
  const bySlug = <T extends { slug: string }>(list: T[]) => {
    const m = new Map(list.map((x) => [x.slug, x]));
    return (slug: string) => m.get(slug);
  };
  const reference = bySlug(references);

  const citation = (key: string): Citation | undefined => {
    const [slug, claimId] = key.split('#');
    const ref = reference(slug);
    if (!ref) return undefined;
    if (claimId === undefined) {
      // A bare slug is only unambiguous when the reference has a single claim
      return ref.claims.length === 1 ? { key, reference: ref, claim: ref.claims[0] } : undefined;
    }
    const claim = ref.claims.find((c) => c.id === claimId);
    return claim ? { key, reference: ref, claim } : undefined;
  };

  // Citation keys used by records must resolve
  for (const q of questions) for (const k of q.sources ?? []) if (!citation(k)) errors.push(`questions/${q.slug}: unknown citation "${k}"`);
  for (const s of signs) for (const k of s.sources ?? []) if (!citation(k)) errors.push(`vital-signs/${s.slug}: unknown citation "${k}"`);

  if (errors.length) {
    throw new Error(`Site content is invalid:\n  - ${errors.join('\n  - ')}`);
  }

  const related = (tags: { domains?: string[]; forms?: string[] }, exclude?: { slug: string }): Related => {
    const ds = new Set(tags.domains ?? []);
    const fs_ = new Set(tags.forms ?? []);
    const sharesDomain = (list: string[] | undefined) => (list ?? []).some((d) => ds.has(d));
    const keep = <T extends { slug: string }>(x: T) => x.slug !== exclude?.slug;
    return {
      questions: questions.filter((q) => keep(q) && sharesDomain(q.domains)),
      signs: signs.filter((s) => keep(s) && sharesDomain(s.domains)),
      initiatives: initiatives.filter((i) => keep(i) && (sharesDomain(i.domains) || i.forms.some((f) => fs_.has(f)))),
      references: references.filter((r) => keep(r) && sharesDomain(r.domains)),
    };
  };

  // ── Flags (owner-only) ────────────────────────────────────────────────────
  const flags: FlagEntry[] = [];
  const fileFlag = (file: string, note: string | undefined, extra?: string) => {
    const text = [note, extra].filter(Boolean).join(' ');
    if (text) flags.push({ collection: 'file', label: `content/${file}`, href: null, draft: false, note: text });
  };
  fileFlag('enums.json', enums.formsNote);
  fileFlag('enums.json', enums.evidentiaryStatusesNote);
  fileFlag('domains.json', domainsFile.note);
  fileFlag('questions.json', questionsFile.note);
  fileFlag('vital-signs.json', signsFile.note);
  fileFlag('initiatives.json', initiativesFile.note);
  fileFlag('references.json', referencesFile.note);
  fileFlag('learn.json', learn.note);

  const recordFlag = (collection: string, label: string, href: string, r: { draft?: boolean; note?: string }, extraNote?: string) => {
    const note = [r.note, extraNote].filter(Boolean).join(' ') || null;
    if (r.draft || note) flags.push({ collection, label, href, draft: !!r.draft, note });
  };
  for (const d of domains) {
    recordFlag('domains', d.name, `/domains/${d.slug}`, d,
      d.neighbouringDomainsNote ? `Neighbouring domains: ${d.neighbouringDomainsNote}` : undefined);
  }
  for (const q of questions) recordFlag('questions', q.question, `/questions/${q.slug}`, q, q.from ? `From: ${q.from}` : undefined);
  for (const s of signs) recordFlag('vital-signs', s.name, `/vital-signs/${s.slug}`, s);
  for (const i of initiatives) recordFlag('initiatives', i.name, `/initiatives/${i.slug}`, i);
  for (const r of references) {
    const claimNotes = r.claims.filter((c) => c.note).map((c) => `Claim ${c.id}: ${c.note}`).join(' ');
    recordFlag('references', r.shortCitation, `/references/${r.slug}`, r, claimNotes || undefined);
  }

  return {
    enums,
    domains,
    questions,
    signs,
    initiatives,
    references,
    learn,
    domain: bySlug(domains),
    question: bySlug(questions),
    sign: bySlug(signs),
    initiative: bySlug(initiatives),
    reference,
    citation,
    related,
    flags,
    warnings,
  };
}

let cached: Content | null = null;

/** The loaded content. Files are read once per process; a deploy picks up edits */
export function content(): Content {
  if (!cached) cached = loadContent();
  return cached;
}
