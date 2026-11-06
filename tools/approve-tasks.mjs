// Release Composition's tasks to children: sets "reviewed" in compose/site/data/tasks.json.
// This is the only way a task goes live. The review page (Grown-ups) shows the
// exact command to run. After it, bump VERSION in compose/site/sw.js and deploy.
//
//   node tools/approve-tasks.mjs lost-kite muddy-dog     approve these
//   node tools/approve-tasks.mjs --off lost-kite         take one back
//   node tools/approve-tasks.mjs --list                  what's live
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../compose/site/data/tasks.json', import.meta.url));
const args = process.argv.slice(2);
const data = JSON.parse(readFileSync(FILE, 'utf8'));
if (args[0] === '--list' || !args.length) {
  for (const t of data.tasks) console.log((t.reviewed ? 'live    ' : 'waiting ') + 'Y' + t.level + '  ' + t.id + '  ' + t.title);
  process.exit(0);
}
const on = args[0] !== '--off';
const ids = on ? args : args.slice(1);
const unknown = ids.filter((id) => !data.tasks.some((t) => t.id === id));
if (unknown.length) { console.error('No task: ' + unknown.join(', ')); process.exit(1); }
for (const t of data.tasks) if (ids.includes(t.id)) t.reviewed = on;
writeFileSync(FILE, JSON.stringify(data, null, 1));
console.log((on ? 'Approved ' : 'Taken back ') + ids.length + '. Now bump VERSION in compose/site/sw.js and deploy.');
