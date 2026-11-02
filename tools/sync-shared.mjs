// Copy the shared client code into each site, which serves it from its own
// folder (the sites are separate roots, and each must work offline and from a
// plain local server). Run after editing shared/; shared/tests/copies.test.js
// fails if a copy differs.
//   shared/account/  the Waystead Account client  → all three sites
//   shared/voice/    the device voice for "Hear"  → the two games (G8)
//
//   node tools/sync-shared.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const SETS = [
  { source: 'shared/account/', targets: ['site/js/account/', 'wordbright/site/js/account/', 'hub/site/home-assets/js/account/'] },
  { source: 'shared/voice/', targets: ['site/js/voice/', 'wordbright/site/js/voice/'] },
];

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
  console.log(`Copied ${n} files into ${SETS.reduce((k, s) => k + s.targets.length, 0)} folders.`);
}
