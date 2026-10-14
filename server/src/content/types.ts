// src/content/types.ts
// Shapes of the site-draft content files in content/*.json (field names follow the seed files).
// A bracketed string such as "[OWNER NAME]" is a placeholder; null means "still to write". Both render as
// placeholders, never as invented text. `draft: true` and `note` flag records awaiting Karl's edit.

export interface EnumItem {
  id: string;
  label: string;
  description?: string;
}

export interface Enums {
  forms: EnumItem[];
  formsNote?: string;
  initiativeStages: (EnumItem & { order: number })[];
  whose: EnumItem[];
  structureStatuses: EnumItem[];
  evidentiaryStatuses: EnumItem[];
  evidentiaryStatusesNote?: string;
  analysisStatuses: EnumItem[];
  vitalSignStatuses: EnumItem[];
  sourceKinds: string[];
  howRead: string[];
}

/** Flags shared by every record */
export interface Flagged {
  draft?: boolean;
  note?: string;
}

export interface DomainAnalysis {
  howItWorksToday: string | null;
  whatAbundanceWouldLookLike: string | null;
  whatStandsInTheWay: string | null;
  whatWeDontKnow: string | null;
}

export interface Structure {
  name: string;
  status: string;
  forms: string[] | null;
  captureRisk: string | null;
}

export interface Domain extends Flagged {
  order: number;
  slug: string;
  name: string;
  need: string;
  needFull?: string;
  analysisStatus: string;
  primaryCaseStudy?: boolean;
  analysis?: DomainAnalysis;
  neighbouringDomains?: string[];
  neighbouringDomainsNote?: string;
  /** Side panel "State of this analysis" (placeholders until set) */
  lastRevised?: string | null;
  inTheBook?: string | null;
  structures: Structure[];
}

export interface Question extends Flagged {
  slug: string;
  question: string;
  domains: string[];
  /** Where the question was recorded as open (provenance, shown to Karl only) */
  from?: string;
  whatWeThinkSoFar?: string | null;
  whatWeDontKnow?: string | null;
  whatWouldChangeOurMind?: string | null;
  /** Evidence status of the current answer (enum evidentiaryStatuses); null until rated */
  status?: string | null;
  /** Citation keys (see Citation) */
  sources?: string[];
}

export interface VitalSign extends Flagged {
  slug: string;
  name: string;
  basis: string;
  domains: string[];
  status: string;
  externalUrl?: string;
  definition: string | null;
  reading: string | null;
  cadence: string | null;
  method?: string | null;
  sources?: string[];
}

export interface StatusLogEntry {
  date: string;
  entry: string;
}

export interface Initiative extends Flagged {
  slug: string;
  name: string;
  whose: string;
  forms: string[];
  domains: string[];
  stage: string;
  owner?: string | null;
  whatItIs: string | null;
  whyItMatters?: string | null;
  leavesInCommon: string | null;
  licence?: string | null;
  whatWeAreLearning?: string | null;
  statusLog?: StatusLogEntry[];
}

export interface Claim {
  /** Stable id within the reference. Defaults to the claim's 1-based position */
  id: string;
  claim: string;
  /** Site paths where this claim is cited */
  citedOn: string[];
  /** Enum evidentiaryStatuses; null until Karl rates it */
  status: string | null;
  note?: string;
}

export interface Reference extends Flagged {
  slug: string;
  shortCitation: string;
  citation: string;
  kind: string;
  url: string | null;
  howRead: string | null;
  domains: string[];
  claims: Claim[];
}

/** A resolved citation key: `<reference-slug>` (its only claim) or `<reference-slug>#<claim-id>` */
export interface Citation {
  key: string;
  reference: Reference;
  claim: Claim;
}

export interface LearnCard {
  title: string;
  text: string;
  link?: string;
  to?: string | null;
  membersOnly?: boolean;
}

export interface Learn {
  note?: string;
  guideEnabled: boolean;
  intro: string;
  askLabel: string;
  examplesHeading: string;
  exampleQuestions: string[];
  answerModes: string[];
  sampleAnswerLayout: {
    heading: string;
    body: string;
    evidentiaryStatus: string;
    strongestObjection: string;
    sources: string[];
    next: string[];
    feedbackButtons: string[];
  };
  disclosure: string;
  limits: { visitor: string; member: string };
  media: {
    heading: string;
    intro: string;
    videos: { title: string; url: string; transcript?: string }[];
    podcastEpisodes: { title: string; url: string; transcript?: string }[];
    emptyNote?: string;
  };
  commons: { heading: string; intro: string; cards: LearnCard[] };
}

export interface HomeAction {
  label: string;
  href: string;
  /** Filled button; otherwise outlined */
  primary?: boolean;
  /** A plain text link rather than a button */
  plain?: boolean;
}

export interface HomeLink {
  label: string;
  href: string;
}

/** content/home.json: Home copy, verbatim from the brief */
export interface Home {
  note?: string;
  opening: { purpose: string; question: string; paragraphs: string[]; actions: HomeAction[] };
  whatAbundanceIs: {
    label: string;
    heading: string;
    body: string[];
    ordinary: { heading: string; items: string[]; imagePlaceholder: string };
    evidence: { label: string; claim: string; cite: string }[];
    closing: string;
    links: HomeLink[];
  };
  whyItIsntArriving: {
    label: string;
    heading: string;
    body: string[];
    cards: { title: string; text: string }[];
    after: string[];
    boxed: string;
    links: HomeLink[];
  };
  whatItWouldTake: {
    label: string;
    heading: string;
    shifts: { eyebrow: string; title: string; text: string }[];
    body: string[];
    links: HomeLink[];
  };
  whereWeAre: {
    label: string;
    heading: string;
    cards: { title: string; text: string; linkText: string; href: string; preview: string }[];
    membership: {
      heading: string;
      text: string;
      activitiesHeading: string;
      activities: string[];
      actions: HomeAction[];
    };
    closing: string;
  };
}

/** content/pages.json: copy for the short pages */
export interface Pages {
  note?: string;
  about: { eyebrow: string; paragraphs: string[]; more: string };
  ask: { intro: string };
  report: { intro: string; archiveHeading: string; archiveEmpty: string; signupHeading: string; signupText: string };
  book: { seriesTitle: string; seriesDescription: string; essays: string[] };
  join: { waysIn: string; foundingHeading: string; foundingText: string; noPayments: string };
  licence: { text: string };
}

/** A record or file awaiting Karl's edit, for the owner-only flags page */
export interface FlagEntry {
  collection: string;
  label: string;
  /** Page that shows the record, when it has one */
  href: string | null;
  draft: boolean;
  note: string | null;
}
