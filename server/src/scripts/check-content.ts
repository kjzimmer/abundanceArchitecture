// src/scripts/check-content.ts
// Validates content/*.json the same way the server does at startup. Run after editing content:
//   npm run content:check

import { loadContent } from '../content/load';

try {
  const c = loadContent();
  const structures = c.domains.reduce((n, d) => n + d.structures.length, 0);
  console.log('Content OK');
  console.log(`  ${c.domains.length} domains (${structures} structures), ${c.questions.length} questions, ` +
    `${c.signs.length} vital signs, ${c.initiatives.length} initiatives, ${c.references.length} references`);
  console.log(`  ${c.flags.length} flagged records/files (see /review/flags on the draft site)`);
  if (c.warnings.length) {
    console.log(`\nWarnings (${c.warnings.length}):`);
    for (const w of c.warnings) console.log(`  - ${w}`);
  }
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
