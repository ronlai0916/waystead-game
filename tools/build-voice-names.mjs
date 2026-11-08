// The names the Waystead voice may say in a sentence (C2-1b): every word in
// Comic Studio's words that isn't on the voice allow-list — the characters'
// names (Maya, Sam, Kofi…), and a few like "grandad" and "Saturday".
// Writes wordbright/site/data/voice-names.txt, beside voice-allow.txt and in
// the same format (sorted lower-case words, then a sha256 line), because the
// account's voice server reads both from there (waystead-account
// src/lib/voice-sentence.ts). Run after changing Composition's tasks.json,
// comic.json or stickers.json; compose/tests/voice-names.test.js fails until
// you do.
//
//   node tools/build-voice-names.mjs
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const at = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
export const NAMES_FILE = at('wordbright/site/data/voice-names.txt');
// Keys whose values are never spoken (ids, file paths, icons).
const SKIP = new Set(['_meta', 'id', 'src', 'icon', 'face', 'fits', 'poses', 'k', 'reviewed']);
const ALWAYS = new Set(['a', 'i']);

function strings(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!SKIP.has(k)) strings(x, out);
  return out;
}

/** The text Comic Studio may speak: each task's title, story start, picture descriptions and comic; the shared comic words; the sticker names. */
export function comicStrings({ tasks, comic, stickers }) {
  return [...tasks.tasks.flatMap((t) => [t.title, t.background, ...(t.pictures || []).map((p) => p.alt), ...strings(t.comic)]), ...strings(comic), ...strings(stickers)].filter((s) => typeof s === 'string');
}

export function buildNames(sources, allowed) {
  const words = new Set();
  for (const s of comicStrings(sources)) for (const w of s.toLowerCase().replace(/[’‘]/g, "'").match(/[a-z]+(?:'[a-z]+)*/g) || []) words.add(w.split("'")[0]);
  const lines = [...words].filter((w) => !allowed.has(w) && !ALWAYS.has(w) && w.length > 1 && w.length <= 20).sort();
  const body = lines.map((w) => w + '\n').join('');
  return body + 'sha256:' + createHash('sha256').update(body, 'utf8').digest('hex') + '\n';
}

export function readSources() {
  const json = (p) => JSON.parse(readFileSync(at(p), 'utf8'));
  return { tasks: json('compose/site/data/tasks.json'), comic: json('compose/site/data/comic.json'), stickers: json('compose/site/data/stickers.json') };
}
export function readAllowed() {
  const lines = readFileSync(at('wordbright/site/data/voice-allow.txt'), 'utf8').split('\n');
  return new Set(lines.filter((l) => l && !l.startsWith('sha256:')));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = buildNames(readSources(), readAllowed());
  writeFileSync(NAMES_FILE, text);
  console.log('voice-names.txt: ' + (text.split('\n').length - 2) + ' words: ' + text.split('\n').slice(0, -2).join(' '));
}
