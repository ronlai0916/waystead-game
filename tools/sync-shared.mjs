// Copy the shared client code into each site, which serves it from its own
// folder (the sites are separate roots, and each must work offline and from a
// plain local server). Run after editing shared/; shared/tests/copies.test.js
// fails if a copy differs.
//   shared/account/  the Waystead Account client  → all three sites
//   shared/voice/    the device voice for "Hear"  → the two games (G8)
//   shared/topbar/   the top bar's Menu button    → all three sites (G4b)
//   shared/update/   one-load updates             → the three games (C2-3)
//   shared/credits/  the one Redeem a code card    → Spellbright and Composition (SB6 TR-56), only once the folder exists
//   shared/safe-text/ the safe-text check          → site/js/safe-text.js and compose/site/js/safe-text.js (SB6 TR-28), single files
//                     (FLAT_SETS: copied into a folder that holds other files, so nothing there is ever pruned), only once it exists
//
//   node tools/sync-shared.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const SETS = [
  { source: 'shared/account/', targets: ['site/js/account/', 'wordbright/site/js/account/', 'hub/site/home-assets/js/account/', 'compose/site/js/account/'] },
  { source: 'shared/voice/', targets: ['site/js/voice/', 'wordbright/site/js/voice/', 'compose/site/js/voice/'] },
  { source: 'shared/update/', targets: ['site/js/update/', 'wordbright/site/js/update/', 'compose/site/js/update/'] },
  { source: 'shared/topbar/', targets: ['site/js/nav/', 'wordbright/site/js/nav/', 'hub/site/home-assets/js/nav/', 'compose/site/js/nav/'] },
];
// SB6 (TR-56): added only when WP-8 has made shared/credits/, so the copies test never meets a missing source.
if (existsSync(ROOT + 'shared/credits/')) SETS.push({ source: 'shared/credits/', targets: ['site/js/credits/', 'compose/site/js/credits/'] });
// SB6 (TR-28): a flat set copies its files into a folder that has other files, and prunes nothing.
// shared/tests/copies.test.js (not WP-9's file) should check these too: see builds/WP-9.md.
export const FLAT_SETS = [];
if (existsSync(ROOT + 'shared/safe-text/')) FLAT_SETS.push({ source: 'shared/safe-text/', targets: ['site/js/', 'compose/site/js/'] });

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let n = 0;
  for (const { source, targets } of SETS) {
    const files = readdirSync(ROOT + source).filter((f) => f.endsWith('.js')).sort();
    for (const t of targets) {
      const dir = ROOT + t;
      if (existsSync(dir)) for (const f of readdirSync(dir)) if (!files.includes(f)) rmSync(dir + f);
      mkdirSync(dir, { recursive: true });
      for (const f of files) writeFileSync(dir + f, readFileSync(ROOT + source + f));
      n += files.length;
    }
  }
  for (const { source, targets } of FLAT_SETS) {
    const files = readdirSync(ROOT + source).filter((f) => f.endsWith('.js')).sort();
    for (const t of targets) {
      mkdirSync(ROOT + t, { recursive: true });
      for (const f of files) writeFileSync(ROOT + t + f, readFileSync(ROOT + source + f));
      n += files.length;
    }
  }
  console.log(`Copied ${n} files into ${[...SETS, ...FLAT_SETS].reduce((k, s) => k + s.targets.length, 0)} folders.`);
}
