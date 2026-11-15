#!/usr/bin/env node
// Spellbright SB4 content tool (WP9-C0). No npm packages.
//
//   node tools/build-chapters.mjs                validate every batch file, print a report (exit 1 on a broken rule)
//   node tools/build-chapters.mjs --review       also write spellbright-design/sb4/review/year-N.md for Ron
//   node tools/build-chapters.mjs --approve y1   (y1..y6) only when the whole year validates: mark it signed off
//                                                and build it into site/data/curriculum.json. Never part of a year.
//
// Batch files: spellbright-design/sb4/content/<batch>.json (schema in the README beside them).
// Statutory lists: spellbright-design/sb4/appendix1-y1y2.json (DfE English Appendix 1, OGL v3.0).

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// batch -> year, and the chapter numbers it must hold
export const BATCHES = {
  'y1-a': { year: 1, from: 1, to: 5 },
  'y1-b': { year: 1, from: 6, to: 10 },
  'y2-a': { year: 2, from: 1, to: 5 },
  'y2-b': { year: 2, from: 6, to: 10 },
  'y3-new': { year: 3, from: 1, to: 5, prefix: 'y3-n' },
  'y4-new': { year: 4, from: 1, to: 5, prefix: 'y4-n' },
  'y5-new': { year: 5, from: 1, to: 5, prefix: 'y5-n' },
  'y6-new': { year: 6, from: 1, to: 5, prefix: 'y6-n' },
};
// the curriculum block each year belongs to
export const BLOCK_OF = { 1: 'year_1', 2: 'year_2', 3: 'year_3_4', 4: 'year_3_4', 5: 'year_5_6', 6: 'year_5_6' };
export const CREDIT = 'Department for Education, English Appendix 1: Spelling. Open Government Licence v3.0.';

// Words stored with a capital; none of these can be found in Wordbright's list (a one-letter word,
// an abbreviation or a proper noun), so the Wordbright check says so plainly instead of failing them.
const CAPITALS = new Set(['I', 'Mr', 'Mrs', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Christmas']);
const ONE_LETTER = new Set(['a', 'I']);
const CHILD_BANNED = ['wrong', 'fail', 'failed', 'incorrect', 'mistake', 'late', 'lost', 'error'];
const GROWN_BANNED_WORDS = ['sen', 'profile', 'mode', 'level', 'doc', 'sync', 'toggle', 'scaffold', 'ocr'];
const GROWN_BANNED_PHRASES = ['input method', 'ai model'];
// Rule 9: homophones are left out of pattern words (statutory words may stay).
const HOMOPHONES = new Set(('their there theyre hear here to too two for four fore be bee by buy bye no know new knew one won ' +
  'sun son see sea write right rite wait weight way weigh whole hole which witch weather whether where wear ware ' +
  'flour flower road rode rowed read reed red some sum mail male meat meet pair pear pare plain plane sale sail ' +
  'tail tale steal steel stair stare break brake bored board blue blew bear bare beach beech berry bury ' +
  'cell sell cent scent sent dear deer die dye eye aye fair fare feat feet find fined grate great groan grown ' +
  'heal heel her hair hi high hour our ours in inn knight night knot not mane main medal meddle morning mourning ' +
  'none nun pause paws peace piece peak peek pedal peddle poor pour pore principal principle profit prophet ' +
  'rain reign rein raise rays rap wrap ring wring role roll root route sauce source scene seen sight site cite ' +
  'sew so sow soar sore stationary stationery suite sweet tide tied toe tow vain vein vane waist waste ' +
  'wood would yoke yolk allowed aloud altar alter ate eight bean been board bold bowled born borne brews bruise ' +
  'caught court cereal serial cheap cheep choose chews chord cord colonel kernel complement compliment ' +
  'council counsel currant current draft draught dual duel fate fete files miles gait gate guessed guest ' +
  'heard herd hoarse horse idle idol isle aisle lessen lesson mussel muscle naval navel packed pact ' +
  'passed past patience patients populace populous prey pray rapt wrapped rough ruff shore sure sore ' +
  'storey story straight strait team teem throne thrown thyme time tire tyre veracity voracity ' +
  'wail whale wales whales ware warn worn whine wine yore your youre').split(/\s+/));
// a word may be a homophone only by a very loose reading; these are listed as pairs above, so a false
// positive is possible: the writer can tell the director and the entry can be removed here.

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const tokens = (s) => String(s).split(/[^A-Za-z]+/).filter(Boolean);
const wordCount = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;

export function expectedIds(batch) {
  const b = BATCHES[batch];
  const out = [];
  for (let n = b.from; n <= b.to; n++) {
    out.push(b.prefix ? `${b.prefix}${String(n).padStart(2, '0')}` : `y${b.year}-ch${String(n).padStart(2, '0')}`);
  }
  return out;
}

// word count ranges per chapter: [min, max]
function wordRange(year) {
  if (year === 1) return [8, 10];
  return [10, 10];
}

export function loadContext(root = ROOT) {
  const lists = readJson(join(root, 'spellbright-design/sb4/appendix1-y1y2.json'));
  const curriculum = readJson(join(root, 'site/data/curriculum.json'));
  const assets = existsSync(join(root, 'site/data/assets.json')) ? readJson(join(root, 'site/data/assets.json')) : {};
  const allowPath = join(root, 'wordbright/site/data/voice-allow.txt');
  const allow = existsSync(allowPath) ? new Set(readFileSync(allowPath, 'utf8').split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter(Boolean)) : new Set();
  return { root, lists, curriculum, assets, allow };
}

export function loadBatches(root = ROOT) {
  const dir = join(root, 'spellbright-design/sb4/content');
  const out = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    const name = f.replace(/\.json$/, '');
    try { out[name] = { file: join(dir, f), data: readJson(join(dir, f)) }; } catch (e) { out[name] = { file: join(dir, f), parseError: String(e.message) }; }
  }
  return out;
}

// Wordbright's list: returns { check(word) -> true | false | null (cannot be checked) , available, note }.
export async function loadWordbright(root = ROOT) {
  const p = join(root, 'wordbright/site/data/words_all.dawg');
  try {
    const m = await import(new URL('file://' + join(root, 'wordbright/site/js/engine/words.js')));
    const graph = m.loadWordGraph(readFileSync(p));
    return {
      available: true,
      check(word) {
        if (ONE_LETTER.has(word) || CAPITALS.has(word)) return null;
        return m.wordTier(word.toLowerCase(), graph) !== m.NO_WORD;
      },
    };
  } catch (e) {
    return { available: false, note: String(e.message), check: () => null };
  }
}

const fieldSig = (w) => JSON.stringify([w.ipa, w.meaning, w.chunks, w.tricky ?? null]);

// Validate every batch. Returns { errors: [{year, batch, where, msg}], notes: [string], summary: [..], batches, words }
export async function validate(root = ROOT, opts = {}) {
  const ctx = opts.ctx || loadContext(root);
  const batches = opts.batches || loadBatches(root);
  const wb = opts.wordbright || (await loadWordbright(root));
  const errors = [];
  const notes = [];
  const err = (batch, where, msg) => errors.push({ year: BATCHES[batch]?.year ?? null, batch, where, msg });

  const stat = { 1: new Set(ctx.lists.year1), 2: new Set(ctx.lists.year2) };
  const batchIdsByYear = {};
  const seenInYear = {}; // `${year}:${word}` -> chapter id, for cew duplicates and pattern duplicates
  const wordSeenInBatches = new Map(); // word -> { sig, where }
  const present = Object.keys(batches).filter((b) => BATCHES[b]);
  for (const name of Object.keys(batches)) if (!BATCHES[name]) err(name, 'file', `unknown batch file name "${name}" (expected one of ${Object.keys(BATCHES).join(', ')})`);

  // words already in the curriculum, apart from chapters a batch itself describes
  const batchChapterIds = new Set();
  for (const name of present) for (const ch of batches[name].data?.chapters || []) batchChapterIds.add(ch.id);
  const existing = new Map(); // word -> [{block, id, entry}]
  const blockWords = {}; // block -> Set of words (excluding batch chapters)
  for (const [block, v] of Object.entries(ctx.curriculum)) {
    if (block === '_meta' || !v?.chapters) continue;
    blockWords[block] = new Set();
    for (const ch of v.chapters) {
      if (batchChapterIds.has(ch.id)) continue;
      for (const w of ch.words || []) {
        blockWords[block].add(w.word);
        if (!existing.has(w.word)) existing.set(w.word, []);
        existing.get(w.word).push({ block, id: ch.id, entry: w });
      }
    }
  }

  for (const name of present) {
    const B = batches[name];
    const spec = BATCHES[name];
    if (B.parseError) { err(name, 'file', 'not valid JSON: ' + B.parseError); continue; }
    const d = B.data;
    if (typeof d.status !== 'string' || !/draft/i.test(d.status) && !/signed/i.test(d.status)) err(name, 'status', 'top-level "status" must be a string (draft — Ron to sign off)');
    if (d.year !== spec.year) err(name, 'year', `batch year must be ${spec.year}, found ${d.year}`);
    if (d.batch !== name) err(name, 'batch', `"batch" must be "${name}", found ${JSON.stringify(d.batch)}`);
    if (!Array.isArray(d.chapters)) { err(name, 'chapters', 'chapters must be an array'); continue; }
    const want = expectedIds(name);
    const got = d.chapters.map((c) => c.id);
    if (JSON.stringify(got) !== JSON.stringify(want)) err(name, 'ids', `chapter ids must be exactly ${want.join(', ')} in order; found ${got.join(', ') || 'none'}`);
    (batchIdsByYear[spec.year] ||= []).push(...got);

    d.chapters.forEach((ch, ci) => {
      const cid = ch.id || `#${ci + 1}`;
      const at = (m) => err(name, cid, m);
      for (const k of ['id', 'year', 'title', 'focus', 're', 'description', 'words']) if (ch[k] === undefined) at(`missing "${k}"`);
      if (ch.year !== spec.year) at(`year must be ${spec.year}`);
      const num = spec.from + ci;
      if (typeof ch.title === 'string') {
        const m = /^Chapter (\d+) — (.+)$/.exec(ch.title);
        if (!m) at(`title must look like "Chapter N — <name>", found "${ch.title}"`);
        else if (!spec.prefix && Number(m[1]) !== num) at(`title says Chapter ${m[1]} but this is chapter ${num}`);
        else if (/[–-]/.test(m[2]) && /^\s*[-–—]/.test(m[2])) at('title has a stray dash');
      }
      if (typeof ch.description === 'string') {
        const low = ch.description.toLowerCase();
        if (wordCount(ch.description) < 4 || !/[.!]$/.test(ch.description.trim())) at('description must be one full sentence ending with a full stop');
        for (const t of tokens(low)) if (GROWN_BANNED_WORDS.includes(t)) at(`description uses "${t}", which grown-up copy never uses`);
        for (const p of GROWN_BANNED_PHRASES) if (low.includes(p)) at(`description uses "${p}", which grown-up copy never uses`);
      }
      if (ch.noMatch !== undefined && typeof ch.noMatch !== 'boolean') at('noMatch must be true or left out');
      if (ch.signedOff !== undefined && typeof ch.signedOff !== 'boolean') at('signedOff must be true or false');
      let re = null;
      try { re = new RegExp(ch.re, 'i'); } catch { at(`"re" is not a valid regular expression: ${ch.re}`); }
      if (!Array.isArray(ch.words)) { at('words must be an array'); return; }
      const [lo, hi] = wordRange(spec.year);
      if (ch.words.length < lo || ch.words.length > hi) at(`${ch.words.length} words; this year needs ${lo === hi ? lo : lo + ' to ' + hi}`);
      const inChapter = new Set();
      let matchable = 0;
      ch.words.forEach((w, wi) => {
        const wid = `${cid}/${w.word ?? '#' + (wi + 1)}`;
        const bad = (m) => err(name, wid, m);
        if (typeof w.word !== 'string' || !w.word) { bad('word missing'); return; }
        // 1. letters only
        if (!/^[A-Za-z]+$/.test(w.word)) bad('letters A–Z only: no apostrophe, hyphen or space');
        // 7. capitals
        const cap = /^[A-Z]/.test(w.word);
        if (cap && !CAPITALS.has(w.word)) bad('only I, Mr, Mrs, the days of the week and Christmas keep a capital');
        const asCap = [...CAPITALS].find((c) => c.toLowerCase() === w.word.toLowerCase());
        if (asCap && asCap !== w.word) bad(`must be stored as "${asCap}" with its capital`);
        if (w.word.length > 1 && /[A-Z]/.test(w.word.slice(1)) ) bad('capital letter inside the word');
        // duplicates inside the chapter
        if (inChapter.has(w.word)) bad('repeated in this chapter'); inChapter.add(w.word);
        // set
        if (w.set !== 'cew' && w.set !== 'pattern') bad(`"set" must be "cew" or "pattern", found ${JSON.stringify(w.set)}`);
        const inList = spec.year <= 2 && stat[spec.year].has(w.word);
        if (w.set === 'cew') {
          if (spec.year > 2) bad('statutory (cew) words are for Years 1 and 2 only');
          else if (!inList) bad(`not on the Year ${spec.year} statutory list`);
          const key = `${spec.year}:${w.word}`;
          if (seenInYear[key]) bad(`statutory word already in chapter ${seenInYear[key]}`); else seenInYear[key] = cid;
        } else if (w.set === 'pattern') {
          if (spec.year <= 2 && (stat[1].has(w.word) || stat[2].has(w.word))) bad('is a statutory word: mark it set "cew"');
          const key = `${spec.year}:p:${w.word}`;
          if (seenInYear[key]) bad(`pattern word already in chapter ${seenInYear[key]} of this year`); else seenInYear[key] = cid;
          if (re && !re.test(w.word)) bad(`does not match the chapter's re ${ch.re}`);
          // 9. homophones
          if (HOMOPHONES.has(w.word.toLowerCase())) bad('is a homophone: left out of pattern words for now (rule 9)');
        }
        // 3. ipa, meaning
        if (typeof w.ipa !== 'string' || !/^\/.+\/$/.test(w.ipa)) bad('ipa must be written between slashes, e.g. /ɒf/');
        const m = w.meaning;
        if (!m || typeof m !== 'object') bad('meaning { partOfSpeech, definition, example } missing');
        else {
          for (const k of ['partOfSpeech', 'definition', 'example']) if (typeof m[k] !== 'string' || !m[k].trim()) bad(`meaning.${k} missing`);
          if (typeof m.definition === 'string') {
            if (wordCount(m.definition) > 14) bad(`definition has ${wordCount(m.definition)} words (14 at most)`);
            for (const t of tokens(m.definition.toLowerCase())) if (CHILD_BANNED.includes(t)) bad(`definition uses "${t}"`);
          }
          if (typeof m.example === 'string') {
            if (wordCount(m.example) > 12) bad(`example has ${wordCount(m.example)} words (12 at most)`);
            const hits = tokens(m.example).filter((t) => t.toLowerCase() === w.word.toLowerCase()).length;
            if (hits !== 1) bad(`example must contain the word exactly once (found ${hits})`);
            for (const t of tokens(m.example.toLowerCase())) if (CHILD_BANNED.includes(t)) bad(`example uses "${t}"`);
          }
          if (['noun', 'verb', 'adjective', 'adverb'].includes(m.partOfSpeech) && m.definition) matchable++;
        }
        // chunks, tricky
        if (!Array.isArray(w.chunks) || !w.chunks.length || w.chunks.some((c) => typeof c !== 'string' || !c)) bad('chunks must be a list of non-empty strings');
        else if (w.chunks.join('') !== w.word) bad(`chunks join to "${w.chunks.join('')}", not "${w.word}"`);
        if (w.tricky !== undefined) {
          if (typeof w.tricky !== 'string' || w.tricky.length < 1 || w.tricky.length > 3) bad('tricky must be 1 to 3 letters');
          else if (!w.word.toLowerCase().includes(w.tricky.toLowerCase())) bad(`tricky "${w.tricky}" does not occur in the word`);
        }
        // 6. one-letter words
        if (w.word.length === 1) {
          if (!ONE_LETTER.has(w.word)) bad('only a and I may be one-letter words');
          else {
            if (JSON.stringify(w.chunks) !== JSON.stringify([w.word])) bad(`chunks must be ["${w.word}"]`);
            if (w.tricky !== undefined) bad('a one-letter word has no tricky');
          }
        }
        // Wordbright's list
        const r = wb.check(w.word);
        if (r === false) bad('not in Wordbright\'s word list (words_all.dawg)');
        // one description for a word in more than one place
        const sig = fieldSig(w);
        const prev = wordSeenInBatches.get(w.word);
        if (prev && prev.sig !== sig) bad(`has a different description from the same word in ${prev.where}`);
        if (!prev) wordSeenInBatches.set(w.word, { sig, where: wid });
        for (const e of existing.get(w.word) || []) {
          if (fieldSig(e.entry) !== sig) bad(`already in curriculum.json (${e.id}) with a different ipa, meaning, chunks or tricky: copy it exactly`);
          if (w.image !== undefined && e.entry.image !== undefined && w.image !== e.entry.image) bad(`image differs from curriculum.json (${e.id})`);
        }
        // paired block
        const block = BLOCK_OF[spec.year];
        if (w.set === 'pattern' && blockWords[block]?.has(w.word)) bad(`already in a chapter of ${block} in curriculum.json`);
      });
      // 10. noMatch
      if (matchable < 4 && ch.noMatch !== true && ch.words.length) at(`only ${matchable} words have a meaning a child could match: set "noMatch": true`);
    });
  }

  // paired blocks: Years 3/4 share year_3_4, 5/6 share year_5_6; pattern words may not repeat across the two batches
  for (const [a, b] of [[3, 4], [5, 6]]) {
    const A = patternSet(batches, `y${a}-new`), B = patternSet(batches, `y${b}-new`);
    for (const w of A) if (B.has(w)) err(`y${b}-new`, w, `pattern word also in the Year ${a} batch (same paired block)`);
  }

  // statutory coverage once both batches of a year exist
  const coverage = {};
  for (const y of [1, 2]) {
    const both = batches[`y${y}-a`]?.data && batches[`y${y}-b`]?.data;
    if (!both) { coverage[y] = null; notes.push(`Year ${y}: statutory coverage not checked (both batches needed).`); continue; }
    const have = new Set();
    for (const n of [`y${y}-a`, `y${y}-b`]) for (const ch of batches[n].data.chapters || []) for (const w of ch.words || []) if (w.set === 'cew') have.add(w.word);
    const missing = [...stat[y]].filter((w) => !have.has(w));
    coverage[y] = missing;
    for (const w of missing) errors.push({ year: y, batch: `y${y}-*`, where: 'coverage', msg: `statutory word "${w}" is in no chapter` });
    // Year 1 days chapter
    if (y === 1) {
      const ch10 = batches['y1-b'].data.chapters?.find((c) => c.id === 'y1-ch10');
      const days = (ch10?.words || []).map((w) => w.word).filter((w) => DAYS.includes(w));
      if (days.length !== 7) err('y1-b', 'y1-ch10', `the days chapter must hold all seven days (found ${days.length})`);
    }
  }
  if (!wb.available) notes.push('Wordbright word list could NOT be read (' + wb.note + '): the list check was not run.');
  else notes.push('Wordbright check: words_all.dawg is built without blocked words, so "in the list" also means "not blocked". One-letter words (a, I), Mr, Mrs, the days and Christmas are not in that list and CANNOT be checked there.');
  return { errors, notes, present, coverage };
}

function patternSet(batches, name) {
  const s = new Set();
  for (const ch of batches[name]?.data?.chapters || []) for (const w of ch.words || []) if (w.set === 'pattern') s.add(w.word);
  return s;
}

// ---- review sheets ----
function cell(s) { return String(s ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim(); }

export function reviewSheet(year, batches, ctx) {
  const mp3 = new Set((ctx.assets.audioWords || []).map((s) => s.toLowerCase()));
  const pics = new Set(ctx.assets.images || []);
  const lines = [];
  lines.push(`# Year ${year}: DRAFT — Ron to sign off`, '');
  lines.push(`Source of the rules: ${CREDIT} The pattern words are ours.`, '');
  const names = Object.keys(BATCHES).filter((b) => BATCHES[b].year === year && batches[b]?.data);
  if (!names.length) lines.push('No batch file for this year yet.');
  for (const n of names) {
    for (const ch of batches[n].data.chapters || []) {
      lines.push(`## ${ch.title || ch.id}  (${ch.id})`, '');
      lines.push(`Focus: ${ch.focus}${ch.noMatch ? '  ·  no Meaning match' : ''}`, '', cell(ch.description), '');
      lines.push('| Word | List | Chunks | Tricky | Meaning | Example | MP3 | Voice list | Picture |', '|---|---|---|---|---|---|---|---|---|');
      for (const w of ch.words || []) {
        const low = String(w.word).toLowerCase();
        const list = w.set === 'cew' ? `Year ${year} common exception words (statutory)` : `Pattern words: our examples for the ${year <= 2 ? `Year ${year}` : year <= 4 ? 'Years 3 and 4' : 'Years 5 and 6'} rule '${ch.focus}'`;
        const m = w.meaning || {};
        const pic = w.image ? (pics.has(w.image) ? 'yes' : 'named, file missing') : pics.has(low + '.jpg') ? 'yes' : 'no';
        lines.push(`| ${cell(w.word)} | ${list === '' ? '' : w.set === 'cew' ? 'statutory' : 'pattern'} | ${cell((w.chunks || []).join(' · '))} | ${cell(w.tricky)} | ${cell(m.partOfSpeech)}: ${cell(m.definition)} | ${cell(m.example)} | ${mp3.has(low) ? 'yes' : 'no'} | ${ctx.allow.has(low) ? 'yes' : 'no'} | ${pic} |`);
      }
      lines.push('');
    }
  }
  lines.push('Labels the app shows: statutory words, "Year ' + year + ' common exception words (statutory)"; pattern words, "Pattern words: our examples for the ' + (year <= 2 ? 'Year ' + year : year <= 4 ? 'Years 3 and 4' : 'Years 5 and 6') + " rule '…'\".", '');
  return lines.join('\n');
}

// ---- approve ----
export function approveYear(year, root, batches, ctx) {
  const names = Object.keys(BATCHES).filter((b) => BATCHES[b].year === year);
  const chapters = [];
  for (const n of names) chapters.push(...batches[n].data.chapters);
  const curPath = join(root, 'site/data/curriculum.json');
  const cur = readJson(curPath);
  const blockName = BLOCK_OF[year];
  const existingChapters = (cur[blockName]?.chapters || []);
  const byId = new Map(existingChapters.map((c) => [c.id, c]));
  const allWords = new Map();
  for (const [k, v] of Object.entries(cur)) if (k !== '_meta') for (const c of v.chapters) for (const w of c.words) if (!allWords.has(w.word) && w.image) allWords.set(w.word, w.image);
  const built = chapters.map((c) => {
    const out = { ...c, signedOff: true };
    out.words = c.words.map((w) => {
      const x = { ...w };
      if (x.image === undefined && allWords.has(x.word)) x.image = allWords.get(x.word);
      return x;
    });
    return out;
  });
  let changed = false;
  if (!cur[blockName]) {
    const titles = { year_1: ['Year 1', 'Common exception words and spelling patterns'], year_2: ['Year 2', 'Common exception words and spelling patterns'] };
    const rebuilt = {};
    for (const [k, v] of Object.entries(cur)) {
      if (k === 'year_3_4' || k === 'year_5_6') {
        for (const nk of ['year_1', 'year_2']) if (nk === blockName && !rebuilt[nk]) rebuilt[nk] = { title: titles[nk][0], subtitle: titles[nk][1], chapters: [] };
      }
      rebuilt[k] = v;
    }
    if (!rebuilt[blockName]) rebuilt[blockName] = { title: titles[blockName]?.[0] || blockName, subtitle: titles[blockName]?.[1] || '', chapters: [] };
    // keep year_1 before year_2 before the existing blocks
    const order = ['_meta', 'year_1', 'year_2', 'year_3_4', 'year_5_6'];
    const final = {};
    for (const k of order) if (rebuilt[k]) final[k] = rebuilt[k];
    for (const k of Object.keys(rebuilt)) if (!(k in final)) final[k] = rebuilt[k];
    for (const k of Object.keys(cur)) delete cur[k];
    Object.assign(cur, final);
    changed = true;
  }
  for (const c of built) {
    const there = byId.get(c.id);
    if (!there) { cur[blockName].chapters.push(c); changed = true; }
    else if (JSON.stringify(there) !== JSON.stringify(c)) throw new Error(`curriculum.json already holds ${c.id} with different content; existing chapters are never changed`);
  }
  if (cur._meta && cur._meta.credit === undefined) { cur._meta.credit = CREDIT; changed = true; }
  if (changed) writeFileSync(curPath, JSON.stringify(cur, null, 2));
  // the batch files record the sign-off
  let batchChanged = false;
  for (const n of names) {
    const d = batches[n].data;
    if (d.chapters.some((c) => c.signedOff !== true)) { for (const c of d.chapters) c.signedOff = true; d.status = 'signed off by Ron'; writeFileSync(batches[n].file, JSON.stringify(d, null, 1) + '\n'); batchChanged = true; }
  }
  return { changed, batchChanged, chapters: built.length };
}

// ---- CLI ----
async function main(argv) {
  const root = ROOT;
  const review = argv.includes('--review');
  const ai = argv.indexOf('--approve');
  const approve = ai >= 0 ? argv[ai + 1] : null;
  if (ai >= 0 && !/^y[1-6]$/.test(approve || '')) { console.error('--approve needs y1, y2, y3, y4, y5 or y6'); return 2; }
  const ctx = loadContext(root);
  const batches = loadBatches(root);
  const res = await validate(root, { ctx, batches });
  console.log('Batches found: ' + (res.present.join(', ') || 'none'));
  for (const b of res.present) {
    const d = batches[b].data;
    if (!d) continue;
    const n = (d.chapters || []).reduce((s, c) => s + (c.words || []).length, 0);
    const cew = (d.chapters || []).reduce((s, c) => s + (c.words || []).filter((w) => w.set === 'cew').length, 0);
    console.log(`  ${b}: ${(d.chapters || []).length} chapters, ${n} words (${cew} statutory, ${n - cew} pattern)`);
  }
  for (const note of res.notes) console.log('Note: ' + note);
  if (res.errors.length) {
    console.log(`\n${res.errors.length} problem(s):`);
    for (const e of res.errors) console.log(`  [${e.batch}] ${e.where}: ${e.msg}`);
  } else console.log('\nAll batches validate.');
  if (review) {
    const dir = join(root, 'spellbright-design/sb4/review');
    mkdirSync(dir, { recursive: true });
    for (let y = 1; y <= 6; y++) {
      if (!Object.keys(BATCHES).some((b) => BATCHES[b].year === y && batches[b]?.data)) continue;
      writeFileSync(join(dir, `year-${y}.md`), reviewSheet(y, batches, ctx));
      console.log(`Wrote spellbright-design/sb4/review/year-${y}.md`);
    }
  }
  if (approve) {
    const year = Number(approve.slice(1));
    const need = Object.keys(BATCHES).filter((b) => BATCHES[b].year === year);
    const missing = need.filter((b) => !batches[b]?.data);
    if (missing.length) { console.error(`Cannot approve ${approve}: batch file(s) missing: ${missing.join(', ')}`); return 1; }
    const mine = res.errors.filter((e) => e.year === year);
    if (mine.length) { console.error(`Cannot approve ${approve}: the year does not validate (${mine.length} problem(s)).`); return 1; }
    const r = approveYear(year, root, batches, ctx);
    console.log(r.changed || r.batchChanged ? `Approved ${approve}: ${r.chapters} chapters built into site/data/curriculum.json.` : `Approved ${approve}: nothing to change (already built).`);
  }
  return res.errors.length ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { console.error(e); process.exitCode = 2; });
}
