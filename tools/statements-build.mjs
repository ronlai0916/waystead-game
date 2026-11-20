#!/usr/bin/env node
// WP-K step 8-9: assemble the bank.  node tools/statements-build.mjs [--bank 2026-11-18.1]
// Reads content/statements/<chapter>.final.json (+ the stage files for counts), re-runs machine rules 1-7 and rule 6 on every
// statement (G1), writes site/data/statements.json, content/statements/REPORT.md and content/statements/spotcheck.html.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadCurriculum, makeIsKnown, contextFor } from './statements-check.mjs';
import { checkStatement, checkDifferent, gapOf, RULES_VERSION } from '../site/js/statement-rules.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CS = join(ROOT, 'content/statements');
const args = process.argv.slice(2);
const bank = args.includes('--bank') ? args[args.indexOf('--bank') + 1] : '2026-11-18.1';
const curr = loadCurriculum();
const isKnown = makeIsKnown(curr);
const readJ = (p) => JSON.parse(readFileSync(p, 'utf8'));
const tryJ = (p) => (existsSync(p) ? readJ(p) : null);

const w = {};
const dropped = []; // { word, statement, why } failing the final G1 re-check
const sitOut = [];
const pending = [];
let finals = 0;
for (const ch of curr.chapters) {
  const f = tryJ(join(CS, ch.id + '.final.json'));
  if (!f) { pending.push(ch.id); continue; }
  finals += 1;
  for (const [word, list] of Object.entries(f.words)) {
    const ctx = contextFor(word, curr, isKnown);
    let keep = [];
    for (const s of list) {
      const r = checkStatement(s, ctx);
      if (!r.ok) { dropped.push({ word, statement: s, why: r.fails.map((x) => 'rule ' + x.rule + ': ' + x.why).join('; ') }); continue; }
      if (keep.length && checkDifferent([...keep, s]).length) { dropped.push({ word, statement: s, why: 'rule 6' }); continue; }
      keep.push(s);
    }
    if (keep.length >= 2) w[word.toLowerCase()] = keep; else sitOut.push(word);
  }
}
const keys = Object.keys(w).sort();
const sorted = {}; for (const k of keys) sorted[k] = w[k];
const out = { _meta: { v: 1, bank, words: keys.length, rules: RULES_VERSION, writer: 'sonnet', checker: 'opus', reader: 'haiku', spotCheck: 'pending (Ron)' }, w: sorted };
writeFileSync(join(ROOT, 'site/data/statements.json'), JSON.stringify(out) + '\n');

// ---- counts
const yearOf = (word) => curr.entries.get(word).year;
const per = {};
for (const [word, e] of curr.entries) {
  const y = e.year; per[y] ||= { words: 0, three: 0, two: 0, one: 0, zero: 0, statements: 0 };
  const n = (w[word.toLowerCase()] || []).length;
  per[y].words += 1; per[y].statements += n;
  if (n >= 3) per[y].three += 1; else if (n === 2) per[y].two += 1; else if (n === 1) per[y].one += 1; else per[y].zero += 1;
}
const tot = Object.values(per).reduce((a, p) => { for (const k in p) a[k] = (a[k] || 0) + p[k]; return a; }, {});

// ---- rejects from stage files (all rounds)
const byRule = {}; const checkerNo = { total: 0, fits: 0, unsafe: 0, other: 0 }; let candidatesTotal = 0; let machineTotal = 0;
const flags = { total: 0, byFlag: {}, kept: 0, dropped: 0 }; const rounds = { r0: 0, r1: 0, r2: 0 };
for (const file of readdirSync(CS)) {
  let m;
  if ((m = file.match(/\.machine\.json$/))) { const j = readJ(join(CS, file)); machineTotal += j.stats.total; for (const [r, n] of Object.entries(j.stats.byRule)) byRule[r] = (byRule[r] || 0) + n; }
  else if (/\.checked\.json$/.test(file)) { for (const x of Object.values(readJ(join(CS, file)).words)) for (const j of x.judgements) if (j.verdict === 'no') { checkerNo.total += 1; if (j.fits && j.fits.length) checkerNo.fits += 1; else if (j.safe === false || j.british === false) checkerNo.unsafe += 1; else checkerNo.other += 1; } }
  else if (/\.rejudge\.json$/.test(file)) { for (const d of readJ(join(CS, file)).decisions) { flags.total += 1; flags.byFlag[d.flag] = (flags.byFlag[d.flag] || 0) + 1; d.keep ? flags.kept++ : flags.dropped++; } }
  else if (/\.final\.json$/.test(file)) { for (const r of Object.values(readJ(join(CS, file)).rounds)) rounds['r' + r] += 1; }
}
const ruleNames = { 1: 'word once, exact', 2: 'one clean sentence', 3: 'length', 4: 'word lists, capitals, names, banned topics', 5: 'not the meaning or example', 6: 'differs from the others', 7: 'no other chapter word', 0: 'not a curriculum word' };
const twos = []; for (const [word] of curr.entries) { const n = (w[word.toLowerCase()] || []).length; if (n === 2) twos.push(word); }
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : 'n/a');

let md = `# WP-K statement bank report\n\nBank \`${bank}\`, built ${new Date().toISOString().slice(0, 10)} by \`tools/statements-build.mjs\`. Rules: ${RULES_VERSION}. Writers: sonnet. Checker and re-judge: opus. Child readers: haiku (Year 2 reader for Year 1-2 chapters, Year 5 reader for Year 3-6 chapters).\n\n`;
if (pending.length) md += `**INCOMPLETE: ${pending.length} chapters have no final file yet:** ${pending.join(', ')}\n\n`;
md += `## Coverage (G4)\n\n| Year | Words | With 3 | With 2 | With 1 | With 0 | Statements |\n|---|---|---|---|---|---|---|\n`;
for (const y of Object.keys(per).sort()) { const p = per[y]; md += `| ${y} | ${p.words} | ${p.three} | ${p.two} | ${p.one} | ${p.zero} | ${p.statements} |\n`; }
md += `| **All** | ${tot.words} | ${tot.three} | ${tot.two} | ${tot.one} | ${tot.zero} | ${tot.statements} |\n\n`;
md += `Words with 3: ${pct(tot.three, tot.words)} (target at least 98%). Words in the file: ${keys.length}. Chapters built: ${finals} of ${curr.chapters.length}.\n\n`;
md += `## Machine rejects (G1), all rounds\n\nCandidates checked: ${machineTotal}. A candidate can break more than one rule.\n\n| Rule | What | Rejects |\n|---|---|---|\n`;
for (const r of Object.keys(byRule).sort()) md += `| ${r} | ${ruleNames[r] || ''} | ${byRule[r]} |\n`;
md += `\nFinal re-check in the build (rules 1-7 and 6 on every shipped statement): ${dropped.length} dropped.\n${dropped.map((d) => `- ${d.word}: "${d.statement}" (${d.why})`).join('\n')}\n\n`;
md += `## Opus check (G2) and child read (G3)\n\n- Opus "no" verdicts: ${checkerNo.total} (another chapter word also fits: ${checkerNo.fits}; unsafe or not British: ${checkerNo.unsafe}; other: ${checkerNo.other}).\n`;
md += `- Child-read flags re-judged: ${flags.total} (${Object.entries(flags.byFlag).map(([k, v]) => k + ' ' + v).join(', ') || 'none'}); dropped ${flags.dropped}, kept with a written reason ${flags.kept}.\n`;
md += `- Shipped statements flagged and kept: ${flags.kept} of ${tot.statements} (${pct(flags.kept, tot.statements)}).\n`;
md += `- Words settled in round 0: ${rounds.r0}, after retry 1: ${rounds.r1}, after retry 2: ${rounds.r2} (the round a word's final list came from).\n\n`;
md += `## Words with 2 statements (${twos.length})\n\n${twos.join(', ') || 'none'}\n\n## Words sitting out of Mix and match (fewer than 2) (${sitOut.length + 0})\n\n`;
const missing = [...curr.entries.keys()].filter((x) => !w[x.toLowerCase()]);
md += `${missing.join(', ') || 'none'}\n`;
writeFileSync(join(CS, 'REPORT.md'), md);

// ---- spot check page: 30 random statements, repeatable (seeded by the bank id)
let seed = 0; for (const c of bank) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const all = []; for (const k of keys) for (const s of w[k]) all.push({ word: curr.entries.get(k) ? k : k, s });
const pick = []; while (pick.length < Math.min(30, all.length)) { const i = Math.floor(rnd() * all.length); pick.push(all.splice(i, 1)[0]); }
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const item = (p, i) => { const e = [...curr.entries.values()].find((x) => x.word.toLowerCase() === p.word); const real = e ? e.word : p.word; return `<li><p class="s">${esc(gapOf(p.s, real))}</p><p class="w">Answer: <b>${esc(real)}</b> (Year ${e ? e.year : '?'})</p><label><input type="radio" name="q${i}" value="yes"> Fine</label> <label><input type="radio" name="q${i}" value="no"> Not fine</label> <input class="note" type="text" placeholder="Note (optional)" aria-label="Note for sentence ${i + 1}" data-i="${i}"><span class="full" hidden>${esc(p.s)}</span><span class="wd" hidden>${esc(real)}</span></li>`; };
const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Statement spot check</title>
<style>:root{color-scheme:light dark}body{font:18px/1.45 system-ui,sans-serif;max-width:46rem;margin:0 auto;padding:16px;background:#FAF8F3;color:#1B1A20}@media(prefers-color-scheme:dark){body{background:#1B1A20;color:#FAF8F3}}h1{font-size:1.4rem}li{margin:0 0 1.2rem;padding:.8rem;border:1px solid #8884;border-radius:10px;list-style:none}ol{padding:0}.s{font-size:1.15rem;margin:.1rem 0}.w{margin:.1rem 0 .5rem;opacity:.8}label{margin-right:1rem}.note{display:block;margin-top:.5rem;width:100%;box-sizing:border-box;font:inherit;padding:.3rem}button{font:inherit;padding:.6rem 1rem;border-radius:8px}pre{white-space:pre-wrap;border:1px solid #8884;padding:.6rem}</style></head><body>
<h1>Mix and match: 30 statements to read</h1>
<p>Bank <b>${esc(bank)}</b>. Each sentence is shown with its gap; the word that belongs there is under it. Tick "Fine" if a child could read it, only that word fits, and it is kind and suitable. Tick "Not fine" for anything you would not want in the game, and say why if you like. Any "Not fine" sends that batch back.</p>
<ol>${pick.map(item).join('\n')}</ol>
<p><button id="done" type="button">Make my summary</button></p><pre id="out" aria-live="polite"></pre>
<script>document.getElementById('done').addEventListener('click',function(){var li=document.querySelectorAll('li'),no=[],yes=0,left=0;li.forEach(function(x,i){var v=x.querySelector('input[type=radio]:checked');if(!v){left++;return}if(v.value==='yes'){yes++;return}no.push((i+1)+'. '+x.querySelector('.wd').textContent+': '+x.querySelector('.full').textContent+(x.querySelector('.note').value?' ('+x.querySelector('.note').value+')':''))});document.getElementById('out').textContent='Fine: '+yes+'. Not fine: '+no.length+'. Not read yet: '+left+'.'+(no.length?'\\n'+no.join('\\n'):'')});</script></body></html>
`;
writeFileSync(join(CS, 'spotcheck.html'), html);
console.log(`bank ${bank}: ${keys.length} words, ${tot.statements} statements; with 3: ${tot.three}/${tot.words}; dropped in re-check ${dropped.length}; pending chapters ${pending.length}`);
