// Release Composition's tasks to children: sets "reviewed" in compose/site/data/tasks.json.
// This is the only way a task goes live. The review page (Grown-ups) shows the
// exact command to run. After it, bump VERSION in compose/site/sw.js and deploy.
//
//   node tools/approve-tasks.mjs lost-kite muddy-dog     approve these tasks
//   node tools/approve-tasks.mjs --off lost-kite         take one back
//   node tools/approve-tasks.mjs --comic lost-kite       approve a task's comic tiles (C2)
//   node tools/approve-tasks.mjs --comic --off lost-kite take them back
//   node tools/approve-tasks.mjs --own                   approve My own story's cards and lines (data/comic.json)
//   node tools/approve-tasks.mjs --own --off             take them back
//   node tools/approve-tasks.mjs --list                  what's live
//
// A comic reaches a child only when its task is live as well.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../compose/site/data/tasks.json', import.meta.url));
const SHARED = fileURLToPath(new URL('../compose/site/data/comic.json', import.meta.url));
let args = process.argv.slice(2);
const data = JSON.parse(readFileSync(FILE, 'utf8'));
if (args[0] === '--list' || !args.length) {
  for (const t of data.tasks) console.log((t.reviewed ? 'live    ' : 'waiting ') + (t.comic ? (t.comic.reviewed ? 'comic live    ' : 'comic waiting ') : '') + 'Y' + t.level + '  ' + t.id + '  ' + t.title);
  try { console.log('My own story: ' + (JSON.parse(readFileSync(SHARED, 'utf8')).own.reviewed ? 'live' : 'waiting')); } catch (e) { /* no comic.json */ }
  process.exit(0);
}
const comic = args.includes('--comic');
const own = args.includes('--own');
const on = !args.includes('--off');
args = args.filter((a) => !['--comic', '--own', '--off'].includes(a));
if (own) {
  const shared = JSON.parse(readFileSync(SHARED, 'utf8'));
  shared.own.reviewed = on;
  writeFileSync(SHARED, JSON.stringify(shared, null, 1) + '\n');
  console.log((on ? 'Approved' : 'Taken back') + ' My own story. Now bump VERSION in compose/site/sw.js and deploy.');
  process.exit(0);
}
const ids = args;
const unknown = ids.filter((id) => !data.tasks.some((t) => t.id === id && (!comic || t.comic)));
if (unknown.length || !ids.length) { console.error('No task' + (comic ? ' with a comic' : '') + ': ' + (unknown.join(', ') || '(none named)')); process.exit(1); }
for (const t of data.tasks) if (ids.includes(t.id)) { if (comic) t.comic.reviewed = on; else t.reviewed = on; }
writeFileSync(FILE, JSON.stringify(data, null, 1));
console.log((on ? 'Approved ' : 'Taken back ') + ids.length + (comic ? ' comic' + (ids.length === 1 ? '' : 's') : '') + '. Now bump VERSION in compose/site/sw.js and deploy.');
