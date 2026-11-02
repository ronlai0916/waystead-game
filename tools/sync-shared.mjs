// Copy the shared Waystead Account client (shared/account/) into each site,
// which serves it from its own folder (the sites are separate roots, and each
// must work offline and from a plain local server). Run after editing
// shared/account/; shared/tests/copies.test.js fails if a copy differs.
//
//   node tools/sync-shared.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const SOURCE = ROOT + 'shared/account/';
export const TARGETS = ['site/js/account/', 'wordbright/site/js/account/', 'hub/site/home-assets/js/account/'].map((t) => ROOT + t);

const files = readdirSync(SOURCE).filter((f) => f.endsWith('.js')).sort();
for (const dir of TARGETS) {
  if (existsSync(dir)) for (const f of readdirSync(dir)) if (!files.includes(f)) rmSync(dir + f);
  mkdirSync(dir, { recursive: true });
  for (const f of files) writeFileSync(dir + f, readFileSync(SOURCE + f));
}
console.log(`Copied ${files.length} files into ${TARGETS.length} sites.`);
