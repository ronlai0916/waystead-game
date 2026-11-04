// Release Story day's stories to children: sets "reviewed" in site/data/stories.json.
// This is the only way a story goes live. The review page (Grown-ups) shows the
// exact command to run. After it, bump VERSION in site/sw.js and deploy.
//
//   node tools/approve-stories.mjs y34-ch01 y56-ch03     approve these
//   node tools/approve-stories.mjs --off y34-ch01        take one back
//   node tools/approve-stories.mjs --list                what's live
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../site/data/stories.json', import.meta.url));
const args = process.argv.slice(2);
const data = JSON.parse(readFileSync(FILE, 'utf8'));
if (args[0] === '--list' || !args.length) {
  for (const s of data.stories) console.log((s.reviewed ? 'live    ' : 'waiting ') + s.chapter + '  ' + s.title);
  process.exit(0);
}
const on = args[0] !== '--off';
const ids = on ? args : args.slice(1);
const unknown = ids.filter((id) => !data.stories.some((s) => s.chapter === id));
if (unknown.length) { console.error('No story for: ' + unknown.join(', ')); process.exit(1); }
for (const s of data.stories) if (ids.includes(s.chapter)) s.reviewed = on;
writeFileSync(FILE, JSON.stringify(data, null, 1));
console.log((on ? 'Approved ' : 'Taken back ') + ids.length + '. Now bump VERSION in site/sw.js and deploy.');
