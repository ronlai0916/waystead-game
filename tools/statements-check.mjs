#!/usr/bin/env node
// WP-K / TR-103 step 4: the machine pass (rules 1-7) over a chapter's candidates.
//   node tools/statements-check.mjs content/statements/<chapter>.json
// Input  { chapter, candidates: { word: [statement x5] } }
// Output content/statements/<chapter>.machine.json { chapter, kept: { word: [..] }, rejects: [{ word, statement, rules, why }], stats }
// The rules are in site/js/statement-rules.js (the module the sentence server copies).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { checkStatement, checkDifferent, RULES_VERSION } from '../site/js/statement-rules.js';
import { loadWordGraph, isWord } from '../wordbright/site/js/engine/words.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const YEAR_KEYS = ['year_1', 'year_2', 'year_3_4', 'year_5_6'];

/** The curriculum as a list of chapters, and a word -> entry map (the first entry of a repeated word wins). */
export function loadCurriculum(root = ROOT) {
  const cur = JSON.parse(readFileSync(join(root, 'site/data/curriculum.json'), 'utf8'));
  const chapters = [];
  for (const k of YEAR_KEYS) for (const ch of cur[k].chapters) chapters.push(ch);
  const entries = new Map();
  const chaptersOf = new Map();
  for (const ch of chapters) {
    for (const w of ch.words) {
      if (!entries.has(w.word)) entries.set(w.word, { word: w.word, year: ch.year, chapter: ch.id, meaning: w.meaning.definition, example: w.meaning.example, partOfSpeech: w.meaning.partOfSpeech });
      if (!chaptersOf.has(w.word)) chaptersOf.set(w.word, []);
      chaptersOf.get(w.word).push(ch.id);
    }
  }
  return { chapters, entries, chaptersOf };
}

/** isKnown(lower): a curriculum word or on Wordbright's list (full list and smaller: tiers 0-2). */
export function makeIsKnown(curr, root = ROOT) {
  const graph = loadWordGraph(readFileSync(join(root, 'wordbright/site/data/words_all.dawg')));
  const cw = new Set([...curr.entries.keys()].map((w) => w.toLowerCase()));
  return (w) => cw.has(w) || isWord(w, graph, 2);
}

/** Rule context for one word. otherWords are the words of EVERY chapter the word is in. */
export function contextFor(word, curr, isKnown) {
  const e = curr.entries.get(word);
  const others = new Set();
  for (const id of curr.chaptersOf.get(word)) {
    const ch = curr.chapters.find((c) => c.id === id);
    for (const w of ch.words) if (w.word !== word) others.add(w.word);
  }
  return { word, year: e.year, meaning: e.meaning, example: e.example, otherWords: [...others], isKnown };
}

/** Machine pass for { word: [statements] }. Rule 6 is applied greedily: a later candidate too like an earlier kept one is rejected. */
export function machinePass(candidates, curr, isKnown) {
  const kept = {};
  const rejects = [];
  const byRule = {};
  const bump = (r) => { byRule[r] = (byRule[r] || 0) + 1; };
  let total = 0;
  for (const [word, list] of Object.entries(candidates)) {
    if (!curr.entries.has(word)) { rejects.push({ word, statement: null, rules: [0], why: ['not a curriculum word'] }); continue; }
    const ctx = contextFor(word, curr, isKnown);
    kept[word] = [];
    const seen = new Set();
    for (const st of list) {
      total += 1;
      const r = checkStatement(st, ctx);
      const rules = r.fails.map((f) => f.rule);
      const why = r.fails.map((f) => f.why);
      if (seen.has(String(st).toLowerCase())) { rules.push(6); why.push('duplicate'); }
      else if (r.ok && checkDifferent([...kept[word], st]).length) { rules.push(6); why.push('too like another candidate'); }
      seen.add(String(st).toLowerCase());
      if (rules.length) { rejects.push({ word, statement: st, rules: [...new Set(rules)], why }); new Set(rules).forEach(bump); } else kept[word].push(st);
    }
  }
  return { kept, rejects, stats: { total, kept: Object.values(kept).reduce((n, a) => n + a.length, 0), rejected: rejects.length, byRule } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node tools/statements-check.mjs content/statements/<chapter>.json'); process.exit(2); }
  const input = JSON.parse(readFileSync(file, 'utf8'));
  const curr = loadCurriculum();
  const out = machinePass(input.candidates, curr, makeIsKnown(curr));
  const dest = file.replace(/\.json$/, '.machine.json');
  writeFileSync(dest, JSON.stringify({ chapter: input.chapter || basename(file, '.json'), rules: RULES_VERSION, ...out }, null, 1) + '\n');
  console.log(`${basename(file)}: ${out.stats.kept}/${out.stats.total} kept; rejects by rule ${JSON.stringify(out.stats.byRule)} -> ${basename(dest)}`);
}
