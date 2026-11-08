// C2-1b: the Waystead voice for Comic Studio's sentences. The names list beside
// voice-allow.txt is up to date, and every line our own data can make passes
// the account's sentence rule (waystead-account src/lib/voice-sentence.ts,
// mirrored here), so none of them falls back to the device's voice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildNames, comicStrings, readSources, readAllowed, NAMES_FILE } from '../../tools/build-voice-names.mjs';
import * as K from '../site/js/comic-doc.js';
import { spokenNumbers } from '../site/js/voice/server.js';
import { splitLong } from '../site/js/speech.js';

const root = (p) => fileURLToPath(new URL('../../' + p, import.meta.url));
const sources = readSources();
const allowed = readAllowed();
const namesText = readFileSync(NAMES_FILE, 'utf8');
const names = new Set(namesText.split('\n').filter((l) => l && !l.startsWith('sha256:')));

// The account's rule (voice-sentence.ts sentenceAllowed + tidySentence), kept in step by hand.
const NEGATIVES = new Set(["can't", "won't", "shan't"]);
const ENDINGS = new Set(['s', 're', 'm', 'll', 've', 'd']);
function voiceOk(raw) {
  const t = spokenNumbers(raw).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  if (!t || [...t].length > 200 || !/^[A-Za-z .,!?'"\-:;]+$/.test(t)) return false;
  const words = t.toLowerCase().match(/[a-z]+(?:'[a-z]+)*/g) || [];
  const known = (w) => w === 'a' || w === 'i' || allowed.has(w) || names.has(w);
  return words.length > 0 && words.length <= 40 && words.every((w) => {
    if (!w.includes("'")) return known(w);
    if (NEGATIVES.has(w)) return true;
    const m = /^([a-z]+)'([a-z]+)$/.exec(w);
    if (!m) return false;
    if (m[2] === 't') return m[1].length > 1 && m[1].endsWith('n') && known(m[1].slice(0, -1));
    return ENDINGS.has(m[2]) && known(m[1]);
  });
}

test('voice-names.txt is current (run node tools/build-voice-names.mjs) and in the allow-list format', () => {
  assert.equal(namesText, buildNames(sources, allowed));
  const lines = namesText.slice(0, -1).split('\n');
  const sha = lines.pop();
  assert.equal(sha, 'sha256:' + createHash('sha256').update(lines.map((w) => w + '\n').join('')).digest('hex'));
  assert.ok(lines.every((w) => /^[a-z]{2,20}$/.test(w)));
  for (const n of ['sam', 'kofi', 'zara', 'amara']) assert.ok(names.has(n), n);
  assert.ok(!names.has('kite') && !names.has('ll'), 'ordinary words and contraction endings are not names');
});

test('every line of our comic data passes the voice rule', () => {
  const bad = comicStrings(sources).map((s) => K.sparkText(s.replace(/\|/g, ' '), { who: 'Kofi', thing: 'the ball' })).flatMap((s) => splitLong(s)).filter((s) => /[A-Za-z]/.test(s) && !voiceOk(s));
  assert.deepEqual(bad, []);
});

test('the built lines too: sentences from every tile path, feelings, bubbles, prompts and the reason start', () => {
  const bad = [];
  const check = (s) => { if (!voiceOk(s)) bad.push(s); };
  for (const t of sources.tasks.tasks) {
    const c = t.comic;
    c.panels.forEach((spec) => {
      for (const path of spec.paths) check(K.plainSentence({ op: '', tiles: path.split('|') }, spec));
      for (const f of sources.comic.feelings) for (const band of Object.keys(f.words)) for (const w of f.words[band]) {
        check(K.feelSentence({ feel: { word: w } }, spec));
        check('Why did ' + spec.feel.who + ' feel ' + w + '?');
        for (const j of sources.comic.why) check(K.whyStart(K.whyBase({ feel: { word: w } }, spec), j));
      }
      for (const sp of spec.speech) check(K.sayLine(sp));
    });
  }
  assert.deepEqual(bad, []);
});

test('the fixed instructions in the views pass too', () => {
  const src = ['compose/site/js/comic-views.js', 'compose/site/js/own-views.js'].map((p) => readFileSync(root(p), 'utf8')).join('\n');
  const lits = [...src.matchAll(/instruct\('([^']+)'/g)].map((m) => m[1]);
  assert.ok(lits.length > 10);
  assert.deepEqual(lits.filter((s) => !voiceOk(s)), []);
});
