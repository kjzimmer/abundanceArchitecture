// src/lib/brand.ts
// Site identity for this deployment. Porting the email/newsletter modules to another site
// (HealthUnveiled, FreeMarketWatch, …) means editing THIS file plus env vars. Nothing
// else in server/src should hardcode the site's name, domain, colors or notice prefix.

export const brand = {
  /** `source_site` value on Person-hub records (subscribers, contacts, analytics) */
  siteKey: 'abundance-architecture',
  /** Display name, used in email subjects, headers and pages */
  name: 'Abundance Architecture',
  /** Short code for admin notice subjects: `[AA Inquiry]`. Gmail filters key on it */
  code: 'AA',
  /** Bare domain, shown as link text in footers */
  domain: 'abundancearchitecture.world',
  /** Completes "Thank you for your interest in {name} — {tagline}." */
  tagline: 'a long-term inquiry into the structural conditions required for human flourishing',

  /** Default senders (overridable via EMAIL_FROM / EMAIL_NOTIFY_FROM) */
  from: 'Abundance Architecture <hello@abundancearchitecture.world>',
  notifyFrom: 'Abundance Architecture <notify@abundancearchitecture.world>',

  /** localStorage key set by public/js/main.js after subscribing. Must match main.js */
  subscribedStorageKey: 'aa_subscribed',

  /** Mirrors the :root tokens in public/index.html */
  colors: {
    ink: '#1a1917',      // masthead + primary text
    inkLight: '#6b6764', // muted text
    paper: '#eeeae0',    // page / outer email background
    card: '#f7f5f0',     // email content card, slightly lighter than paper
    accent: '#2d4a2d',   // buttons, links
    accentHover: '#1e3a1e',
    rule: '#dcd7cb',
  },
  fonts: {
    serif: "'EB Garamond', Georgia, 'Times New Roman', serif",
    sans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    /** Web fonts for server-rendered pages. Email clients mostly ignore web fonts and use the fallbacks */
    googleFontsHref: 'https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400&family=Inter:wght@400;500&display=swap',
  },
} as const;
