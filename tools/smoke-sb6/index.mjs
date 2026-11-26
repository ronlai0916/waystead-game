// SB6 (WP-10): loaded by tools/sb2-smoke.mjs with the harness H. Builds the shared helpers S (helpers.mjs) and gives every scene file (H, S).
// Scene files, one per owning WP (TRS section 8); each is `export default (H, S) => { H.scene('SB6 <name>: ...', async () => { ... }) }`:
//   sbs.mjs WP-6   gu.mjs WP-7   pictures.mjs WP-8   peek.mjs WP-5a   builder.mjs WP-4   normal.mjs WP-5b   (baseline.mjs and devices-sb6.mjs are WP-10's)
// An owner edits ONLY their file. A file that is missing is skipped; an empty skeleton registers one scene that passes.
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeHelpers } from './helpers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCENE_FILES = ['baseline.mjs', 'sbs.mjs', 'gu.mjs', 'pictures.mjs', 'peek.mjs', 'builder.mjs', 'normal.mjs', 'estimate.mjs', 'reset.mjs', 'keyboard.mjs'];

export default async function (H) {
  const S = makeHelpers(H);
  H.S6 = S;
  for (const f of SCENE_FILES) {
    const p = join(HERE, f);
    if (!existsSync(p)) continue;
    const m = await import(pathToFileURL(p));
    if (typeof m.default === 'function') m.default(H, S);
  }
}
