#!/usr/bin/env node
// WP-K driver: runs the bank pipeline per chapter with headless `claude -p` calls (writers sonnet, checker opus, readers haiku).
//   node content/statements/orchestrate.mjs [--lane y1|y2|y34a|y34b|y56a|y56b|all] [--chapter <id>] [--par 6]
// Resumable: every stage writes its file; a stage whose file exists is skipped. Prompts live in PROMPT.md.
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadCurriculum, makeIsKnown, contextFor, machinePass } from '../../tools/statements-check.mjs';
import { BANDS, bandOf, pickDifferent } from '../../site/js/statement-rules.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const SCRATCH = process.env.WPK_SCRATCH || '/tmp/claude-0/-home-claude/787eaebe-bc20-577f-a293-a7f7cdccd31a/scratchpad/run';
mkdirSync(SCRATCH, { recursive: true });
mkdirSync(join(DIR, 'logs'), { recursive: true });
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const LANE = opt('lane', 'all');
const ONLY = opt('chapter', null);
const PAR = Number(opt('par', 8));
const N = 5;
const MODELS = { writer: 'sonnet', checker: 'opus', reader: 'haiku', rejudge: 'opus' };

const curr = loadCurriculum();
const isKnown = makeIsKnown(curr);
const promptSrc = readFileSync(join(DIR, 'PROMPT.md'), 'utf8');
const SECTION = {};
for (const m of promptSrc.split(/^## /m).slice(1)) { const nl = m.indexOf('\n'); SECTION[m.slice(0, nl).trim()] = m.slice(nl + 1).trim(); }
const fill = (t, v) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in v ? String(v[k]) : `{{${k}}}`));
const LEVEL = { 1: 'everyday words a 5-6 year old reads; Year 1-2 curriculum words', 2: 'as Year 1, plus common two-syllable words', '3-4': 'everyday words; no word harder than the target', '5-6': 'everyday and school words' };

const file = (ch, tag, kind) => join(DIR, `${ch}${tag ? '.' + tag : ''}${kind ? '.' + kind : ''}.json`);
const readJ = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJ = (p, o) => writeFileSync(p, JSON.stringify(o, null, 1) + '\n');
const note = (msg) => { const l = `${new Date().toISOString()} ${msg}`; appendFileSync(join(DIR, 'progress.log'), l + '\n'); console.log(l); };

let running = 0; const queue = [];
const slot = () => new Promise((res) => { const go = () => { if (running < PAR) { running++; res(); } else queue.push(go); }; go(); });
const free = () => { running--; const n = queue.shift(); if (n) n(); };

function extractJson(text) {
  const t = text.replace(/```(?:json)?/g, '');
  const a = t.indexOf('{'); const b = t.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('no JSON in answer');
  return JSON.parse(t.slice(a, b + 1));
}
function run(model, prompt) {
  return new Promise((resolve, reject) => {
    const p = spawn('claude', ['-p', '--model', model, '--tools', '', '--no-session-persistence', '--system-prompt', 'You are a careful assistant who writes and checks children\'s learning content. Follow the user\'s output format exactly: JSON only.'], { cwd: SCRATCH, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    const to = setTimeout(() => { p.kill(); reject(new Error('timeout')); }, 20 * 60 * 1000);
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
    p.on('close', (c) => { clearTimeout(to); c === 0 && out.trim() ? resolve(out) : reject(new Error(`exit ${c}: ${err.slice(0, 300)}`)); });
    p.stdin.end(prompt);
  });
}
/** One agent call with JSON answer; validate(obj) throws on a bad shape; up to 3 tries. */
async function agent(role, label, prompt, validate) {
  await slot();
  try {
    for (let k = 1; k <= 3; k++) {
      try {
        const out = await run(MODELS[role], prompt);
        writeFileSync(join(DIR, 'logs', `${label}.${k}.txt`), `# ${role} ${MODELS[role]}\n\n## PROMPT\n${prompt}\n\n## ANSWER\n${out}\n`);
        const obj = extractJson(out);
        validate(obj);
        return obj;
      } catch (e) { note(`${label} try ${k} failed: ${e.message}`); if (k === 3) throw e; }
    }
  } finally { free(); }
}

const wordLine = (e) => `- ${e.word} (${e.partOfSpeech}, Year ${e.year}) | meaning: "${e.meaning}" | example (do NOT copy): "${e.example}"`;
const chapterOf = (id) => curr.chapters.find((c) => c.id === id);

/** Step 2: the writer. words = the words to write for; feedback = per-word reasons from earlier rounds (or {}). */
async function write(ch, tag, words, feedback) {
  const f = file(ch.id, tag, '');
  if (existsSync(f)) return readJ(f);
  const band = BANDS[bandOf(ch.year)];
  const chapterWords = new Set(ch.words.map((w) => w.word));
  for (const w of words) for (const o of contextFor(w, curr, isKnown).otherWords) chapterWords.add(o);
  let fb = '';
  const fbw = Object.keys(feedback || {});
  if (fbw.length) fb = '### Earlier sentences for these words were rejected. Write NEW ones that avoid these problems (every word below needs fresh sentences; the reasons show what went wrong)\n' + fbw.map((w) => `- ${w}:\n${feedback[w].map((x) => '    * "' + x.s + '" -> ' + x.reason).join('\n')}`).join('\n');
  const prompt = fill(SECTION.WRITER, { N, COUNT: words.length, YEAR: ch.year, LEVEL: LEVEL[bandOf(ch.year)], MINW: band.minWords, MAXW: band.maxWords, MAXC: band.maxChars,
    WORDS: words.map((w) => wordLine(curr.entries.get(w))).join('\n'), CHAPTER_WORDS: [...chapterWords].join(', '), FEEDBACK: fb, CHAPTER: ch.id });
  const obj = await agent('writer', `${ch.id}${tag ? '.' + tag : ''}.write`, prompt, (o) => {
    if (!o.candidates) throw new Error('no candidates');
    for (const w of words) if (!Array.isArray(o.candidates[w]) || o.candidates[w].length < 3) throw new Error('missing word ' + w);
  });
  const candidates = {}; for (const w of words) candidates[w] = obj.candidates[w].map(String);
  const out = { chapter: ch.id, round: tag || 'r0', writer: MODELS.writer, candidates };
  writeJ(f, out); return out;
}

/** Step 3: the machine pass. */
function machine(ch, tag, cands) {
  const f = file(ch.id, tag, 'machine');
  if (existsSync(f)) return readJ(f);
  const r = machinePass(cands.candidates, curr, isKnown);
  const out = { chapter: ch.id, ...r }; writeJ(f, out); return out;
}

/** Step 4: the Opus check. pool = { word: [statements that passed the machine] }. */
async function check(ch, tag, pool) {
  const f = file(ch.id, tag, 'checked');
  if (existsSync(f)) return readJ(f);
  const words = Object.keys(pool).filter((w) => pool[w].length);
  const out = { chapter: ch.id, checker: MODELS.checker, words: {} };
  if (words.length) {
    const chapterWords = new Set(ch.words.map((w) => w.word));
    const block = words.map((w) => { const e = curr.entries.get(w); return `#### ${w} (${e.partOfSpeech}) - meaning: "${e.meaning}"\n${pool[w].map((s, i) => `${i + 1}. ${s}`).join('\n')}`; }).join('\n\n');
    const prompt = fill(SECTION.CHECKER, { CHAPTER: ch.id, YEAR: ch.year, CHAPTER_WORDS: [...chapterWords].join(', '), CANDIDATES: block });
    const obj = await agent('checker', `${ch.id}${tag ? '.' + tag : ''}.check`, prompt, (o) => {
      if (!o.words) throw new Error('no words');
      for (const w of words) if (!o.words[w] || !Array.isArray(o.words[w].judgements)) throw new Error('checker missed ' + w);
    });
    for (const w of words) {
      const j = obj.words[w]; const ok = new Map();
      const judgements = pool[w].map((s) => {
        const m = j.judgements.find((x) => x.s === s) || j.judgements.find((x) => String(x.s).trim() === s.trim());
        if (!m) return { s, verdict: 'no', reason: 'checker gave no judgement', fits: [] };
        const verdict = m.verdict === 'ok' && !(m.fits && m.fits.length) && m.safe !== false && m.british !== false ? 'ok' : 'no';
        return { s, verdict, fits: m.fits || [], sense: m.sense !== false, safe: m.safe !== false, british: m.british !== false, reason: String(m.reason || '') };
      });
      judgements.forEach((x) => x.verdict === 'ok' && ok.set(x.s, x));
      const order = [...(j.picks || []), ...(j.reserve || []), ...pool[w]].filter((s, i, a) => ok.has(s) && a.indexOf(s) === i);
      let picks = pickDifferent(order, 3);
      // rule 9: at least 2 of 3 in the usual sense; swap a non-sense pick for a sense one from the rest
      const noSense = picks.filter((s) => !ok.get(s).sense);
      if (picks.length === 3 && noSense.length > 1) { const alt = order.filter((s) => !picks.includes(s) && ok.get(s).sense); if (alt.length) picks = pickDifferent([...picks.filter((s) => ok.get(s).sense), alt[0], ...picks.filter((s) => !ok.get(s).sense)], 3); }
      out.words[w] = { judgements, picks, reserve: order.filter((s) => !picks.includes(s)) };
    }
  }
  writeJ(f, out); return out;
}

/** Step 5: the child-style read. finals = { word: [picks] }. Boards of 3-4 words, one statement per word, three rotations. */
function boardsOf(ch, finals) {
  const words = ch.words.map((w) => w.word).filter((w, i, a) => a.indexOf(w) === i && (finals[w] || []).length);
  const n = words.length; if (!n) return [];
  const groups = []; const nb = Math.max(1, Math.round(n / 3.5)); let i = 0;
  for (let b = 0; b < nb; b++) { const size = Math.ceil((n - i) / (nb - b)); groups.push(words.slice(i, i + size)); i += size; }
  const boards = [];
  for (let k = 0; k < 3; k++) for (const g of groups) { const items = g.filter((w) => finals[w][k]); if (items.length) boards.push(items.map((w) => ({ word: w, s: finals[w][k] }))); }
  return boards;
}
async function read(ch, tag, finals) {
  const f = file(ch.id, tag, 'read');
  if (existsSync(f)) return readJ(f);
  const boards = boardsOf(ch, finals);
  const young = ch.year <= 2;
  const readerName = young ? 'Year 2 reader' : 'Year 5 reader';
  const out = { chapter: ch.id, reader: readerName, model: MODELS.reader, flags: [] };
  if (boards.length) {
    const text = boards.map((b, bi) => `### Board ${bi + 1}\nWord bank: ${b.map((x) => x.word).sort().join(', ')}\n${b.map((x, n) => `${n + 1}. ${x.s.replace(new RegExp('(^|[^A-Za-z\'-])' + x.word + '(?![A-Za-z\'-])', 'i'), '$1___')}`).join('\n')}`).join('\n\n');
    const prompt = fill(SECTION.READER, { READER: readerName, READER_YEAR: young ? 2 : 5, BOARDS: text });
    const obj = await agent('reader', `${ch.id}${tag ? '.' + tag : ''}.read`, prompt, (o) => { if (!Array.isArray(o.flags)) throw new Error('no flags'); });
    for (const fl of obj.flags) {
      const b = boards[Number(fl.board) - 1]; const it = b && b[Number(fl.n) - 1]; if (!it) continue;
      out.flags.push({ word: it.word, s: it.s, flag: String(fl.flag), note: String(fl.note || '') });
    }
  }
  writeJ(f, out); return out;
}

/** Step 6: Opus re-judges flagged statements; keep only with a written reason. */
async function rejudge(ch, tag, flags) {
  const f = file(ch.id, tag, 'rejudge');
  if (existsSync(f)) return readJ(f);
  const out = { chapter: ch.id, decisions: [] };
  if (flags.length) {
    const text = flags.map((x, i) => `${i + 1}. word "${x.word}": "${x.s}"\n   reader flag: ${x.flag} - ${x.note}`).join('\n');
    const prompt = fill(SECTION.REJUDGE, { CHAPTER_WORDS: ch.words.map((w) => w.word).join(', '), FLAGGED: text });
    const obj = await agent('rejudge', `${ch.id}${tag ? '.' + tag : ''}.rejudge`, prompt, (o) => { if (!Array.isArray(o.decisions)) throw new Error('no decisions'); });
    for (const x of flags) { const d = obj.decisions.find((y) => y.s === x.s); out.decisions.push({ word: x.word, s: x.s, keep: !!(d && d.keep && d.reason && String(d.reason).length > 12), reason: d ? String(d.reason || '') : 'no decision', flag: x.flag, note: x.note }); }
  }
  writeJ(f, out); return out;
}

/** One pipeline pass over `words` of a chapter with pool = earlier ok statements + new candidates. Returns per-word finals and drop reasons. */
async function pass(ch, tag, words, prior, feedback) {
  const w = await write(ch, tag, words, feedback);
  const cands = { candidates: {} };
  for (const x of words) cands.candidates[x] = [...(prior[x] || []), ...w.candidates[x]];
  const m = machine(ch, tag, cands);
  const c = await check(ch, tag, m.kept);
  const finals = {}; for (const x of words) finals[x] = (c.words[x] && c.words[x].picks) || [];
  const r = await read(ch, tag, finals);
  const flags = r.flags.filter((x) => finals[x.word] && finals[x.word].includes(x.s));
  const j = await rejudge(ch, tag, flags);
  const dropped = j.decisions.filter((d) => !d.keep);
  const result = {}; const why = {};
  for (const x of words) {
    result[x] = finals[x].filter((s) => !dropped.some((d) => d.word === x && d.s === s));
    why[x] = [
      ...m.rejects.filter((y) => y.word === x).map((y) => ({ s: y.statement, reason: `machine rule ${y.rules.join(',')}: ${y.why.join('; ')}` })),
      ...((c.words[x] && c.words[x].judgements) || []).filter((y) => y.verdict === 'no').map((y) => ({ s: y.s, reason: `checker: ${y.reason}${y.fits.length ? ' (also fits: ' + y.fits.join(', ') + ')' : ''}` })),
      ...dropped.filter((d) => d.word === x).map((d) => ({ s: d.s, reason: `reader flag ${d.flag} (${d.note}); re-judge: ${d.reason}` })),
    ];
  }
  const okPool = {}; for (const x of words) okPool[x] = ((c.words[x] && c.words[x].judgements) || []).filter((y) => y.verdict === 'ok' && !dropped.some((d) => d.word === x && d.s === y.s)).map((y) => y.s);
  return { result, why, okPool };
}

async function chapter(id) {
  const ch = chapterOf(id);
  const ff = file(id, '', 'final');
  if (existsSync(ff)) return;
  const words = [...new Set(ch.words.map((w) => w.word))].filter((w) => curr.entries.get(w).chapter === id);
  const rec = { chapter: id, year: ch.year, words: {}, rounds: {}, rejected: [], sitOut: [] };
  let todo = words; let prior = {}; let feedback = {};
  for (let r = 0; r <= 2 && todo.length; r++) {
    const tag = r ? `r${r}` : '';
    note(`${id} round ${r}: ${todo.length} words`);
    const p = await pass(ch, tag, todo, prior, feedback);
    const weak = [];
    for (const w of todo) {
      rec.words[w] = p.result[w]; rec.rounds[w] = r;
      rec.rejected.push(...p.why[w].map((x) => ({ word: w, round: r, ...x })));
      if (p.result[w].length < 3) { weak.push(w); prior[w] = p.okPool[w]; feedback[w] = p.why[w].slice(-8); }
    }
    todo = weak;
  }
  for (const w of words) if ((rec.words[w] || []).length < 2) rec.sitOut.push(w);
  writeJ(ff, rec);
  const n3 = words.filter((w) => rec.words[w].length >= 3).length;
  note(`${id} DONE: ${n3}/${words.length} words with 3; ${words.filter((w) => rec.words[w].length === 2).length} with 2; sit out ${rec.sitOut.length}`);
}

const ids = curr.chapters.map((c) => c.id);
const LANES = { y1: ids.filter((i) => i.startsWith('y1-')), y2: ids.filter((i) => i.startsWith('y2-')), y34a: ids.filter((i) => /^y34-ch/.test(i)), y34b: ids.filter((i) => /^y[34]-n/.test(i)), y56a: ids.filter((i) => /^y56-ch/.test(i)), y56b: ids.filter((i) => /^y[56]-n/.test(i)) };
const lanes = ONLY ? [[ONLY]] : LANE === 'all' ? Object.values(LANES) : [LANES[LANE]];
await Promise.all(lanes.map(async (l) => { for (const id of l) { try { await chapter(id); } catch (e) { note(`${id} FAILED: ${e.message}`); } } }));
note('orchestrator finished');
