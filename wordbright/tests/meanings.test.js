// Word meanings: the built shards (tools/build-meanings.py), Star words, the
// results panel rows, and loading a shard only when it is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createMeanings, shardKey, wordInfo, SPELLBRIGHT_AUDIO } from '../site/js/meanings.js';
import { resultsHtml, movedWords, LOOK_UP } from '../site/js/ui/results.js';
import { starEntry } from '../site/js/ui/moves.js';
import { newGame, play, act } from '../site/js/engine/game.js';
import { computerTurn } from '../site/js/ai/computer.js';
import { DATA, ROOT, env, starWords, cellsWith, anchor } from './helpers.js';

const MEANINGS = DATA + 'meanings/';
const KEYS = new Set(JSON.parse(readFileSync(MEANINGS + 'index.json', 'utf8')));
const shardOf = (w) => JSON.parse(readFileSync(MEANINGS + shardKey(w, KEYS) + '.json', 'utf8'));
const entry = (w) => shardOf(w)[w] || null;

// Every shard, read once.
let all = null;
function allEntries() {
  if (!all) {
    all = new Map();
    for (const f of readdirSync(MEANINGS)) {
      if (f === 'index.json' || !f.endsWith('.json')) continue;
      for (const [w, e] of Object.entries(JSON.parse(readFileSync(MEANINGS + f, 'utf8')))) all.set(w, e);
    }
  }
  return all;
}

// The same fetch the game makes, from the files on disk, counting the calls.
function diskMeanings() {
  const fetched = [];
  const m = createMeanings(async (path) => {
    fetched.push(path);
    return JSON.parse(readFileSync(ROOT + 'site/' + path, 'utf8'));
  });
  return { m, fetched };
}

test('lemmas: "running" and "ran" are forms of "run"; "cats" of "cat"; "run" is itself', () => {
  assert.equal(entry('running').l, 'run');
  assert.equal(entry('ran').l, 'run');
  assert.equal(entry('cats').l, 'cat');
  assert.equal(entry('run').l, undefined);
  assert.equal(entry('running').p, 'verb');
  assert.equal(entry('running').m, entry('run').m);
});

test('British IPA where known, in Spellbright\'s symbols', () => {
  assert.equal(entry('run').i, '/rʌn/');
  assert.equal(entry('running').i, '/ˈrʌnɪŋ/');
  assert.equal(entry('cats').i, '/kæts/');
});

test('child-safety filter: blocked senses are removed, and a word with none left has no meaning', () => {
  const bad = /\b(sex|sexual|sexually|penis|vagina|genitals?|erotic|copulate|cocaine|heroin|marijuana|offensive|derogatory|disparaging|slur|obscene|vulgar|expletives?|pejorative)\b/i;
  const hits = [...allEntries()].filter(([, e]) => bad.test((e.m || '') + ' ' + (e.e || ''))).map(([w]) => w);
  assert.deepEqual(hits.slice(0, 10), []);
  // Every sense of "negroid" is marked as offensive: no meaning, nothing to show.
  assert.ok(!entry('negroid') || !entry('negroid').m);
  // "bum": the insult sense is dropped, the next one shown.
  assert.equal(entry('bum').m, 'A vagrant.');
  // British spelling in WordNet's meanings.
  assert.match(entry('donkey').m, /^Domestic beast of burden/);
  assert.ok(![...allEntries().values()].some((e) => /\b(color|center|realize|organize)\b/.test(e.m || '')));
});

test('Star words: our meaning and example, Spellbright\'s IPA and MP3', () => {
  const star = starEntry(starWords, 'build');
  const info = wordInfo('build', entry('build'), star);
  assert.equal(info.meaning, star.meaning);
  assert.equal(info.example, star.example);
  assert.equal(info.ipa, '/bɪld/');
  assert.equal(info.audio, SPELLBRIGHT_AUDIO + 'build.mp3');
  assert.equal(info.audio, '../spellbright/assets/audio/words/build.mp3');
  // The game is served at /wordbright/, Spellbright at /spellbright/ (site/ in this repo).
  assert.ok(existsSync(ROOT + '../site/assets/audio/words/build.mp3'));
  // A Year 1 word has no Spellbright recording: the device voice instead, IPA from Britfone.
  const said = wordInfo('said', entry('said'), starEntry(starWords, 'said'));
  assert.equal(said.audio, '');
  assert.equal(said.ipa, entry('said').i);
  assert.equal(said.meaning, starEntry(starWords, 'said').meaning);
  // Every Star word that says it has audio really has the file.
  for (const s of starWords.filter((s) => s.audio)) assert.ok(existsSync(ROOT + '../site/assets/audio/words/' + s.word + '.mp3'), s.word);
});

// The rows in a panel: [word, points] in order, plus the HTML.
function rows(html) {
  return [...html.matchAll(/<span class="wordrow__word"[^>]*>([A-Z]+)<\/span>.*?(?:<span class="wordrow__pts">(\d+))/g)].map((m) => [m[1].toLowerCase(), Number(m[2])]);
}

test('panel after a child\'s move: the main word first, then the cross words, each with meaning, IPA, Hear and Look it up', async () => {
  const e = env('junior');
  let s = newGame({ board: 'junior', seed: 1, level: 'year-5', players: [{ name: 'Ada' }, { name: 'Pip', computer: true, strength: 'easy' }] }, e);
  const [r, c] = anchor(e.board);
  s = { ...s, cells: cellsWith(e.board, ['it', r, c, 'across']) };
  s.players = s.players.map((p, i) => (i === 0 ? { ...p, rack: ['s', 'o', 'e', 'e', 'e', 'e', 'e'] } : p));
  // SO under IT: "so" across, and "is", "to" down.
  const res = play(s, [{ r: r + 1, c, letter: 's', blank: false }, { r: r + 1, c: c + 1, letter: 'o', blank: false }], e);
  assert.ok(res.ok, res.message);
  const { m } = diskMeanings();
  const entries = await m.lookup(res.score.words.map((w) => w.word));
  const html = resultsHtml('Ada', res.score, entries, starWords);
  assert.deepEqual(rows(html).map(([w]) => w), ['so', 'is', 'to']);
  assert.deepEqual(rows(html), movedWords(res.score).map((w) => [w.word, w.points]));
  assert.match(html, /Ada scored \d+/);
  for (const w of ['so', 'is', 'to']) {
    assert.ok(html.includes('data-hear="' + w + '"'), 'Hear ' + w);
    assert.ok(html.includes('href="' + LOOK_UP + w + '" target="_blank" rel="noopener"'), 'Look it up ' + w);
    assert.ok(html.includes(entries.get(w).m.replace(/'/g, '&#39;')), 'meaning of ' + w);
  }
  assert.ok(html.includes(entries.get('to').i), 'IPA');
  // No sound until a tap: nothing in the panel plays by itself.
  assert.doesNotMatch(html, /autoplay|<audio/);
});

test('panel after a computer\'s move, with cross words; Star words keep their +5', async () => {
  const e = env('junior');
  const bots = [{ name: 'Pip', computer: true, strength: 'hard' }, { name: 'Ottie', computer: true, strength: 'normal' }];
  let s = newGame({ board: 'junior', seed: 4, level: 'year-5', players: bots }, e);
  let found = null;
  while (!s.over && !found) {
    const out = act(s, computerTurn(s, e).action, e);
    assert.ok(out.ok, out.message);
    if (out.score && out.score.words.length > 1) found = out.score;
    s = out.state;
  }
  assert.ok(found, 'a computer move with a cross word');
  const { m } = diskMeanings();
  const entries = await m.lookup(found.words.map((w) => w.word));
  const html = resultsHtml('Pip', found, entries, starWords);
  const shown = rows(html);
  assert.equal(shown.length, found.words.length);
  assert.equal(shown[0][0], found.words.find((w) => w.main).word);
  for (const w of found.words) {
    const known = entries.get(w.word);
    if (!known || !known.m) assert.match(html, /No meaning yet/);
  }
  // A made-up move with a Star word: the badge, and our meaning.
  const star = { words: [{ word: 'build', points: 9, main: true, star: true }], starBonus: 5, fullRack: 0, total: 14 };
  const starHtml = resultsHtml('Pip', star, new Map([['build', entry('build')]]), starWords);
  assert.match(starHtml, /class="plus5[^"]*" aria-label="Star word, 5 extra points">\+5/);
  assert.ok(starHtml.includes(starEntry(starWords, 'build').meaning));
  assert.ok(starHtml.includes('data-audio="../spellbright/assets/audio/words/build.mp3"'));
});

test('meanings load on demand: nothing at first, then only the shards for the words asked about', async () => {
  const { m, fetched } = diskMeanings();
  assert.deepEqual(fetched, []);
  await m.lookup(['cat', 'cats']);
  assert.deepEqual(fetched, ['data/meanings/index.json', 'data/meanings/' + shardKey('cat', KEYS) + '.json']);
  await m.lookup(['cat']);
  assert.equal(fetched.length, 2, 'a shard is fetched once');
  // Busy beginnings have their own three-letter shard.
  assert.ok(KEYS.has('con'));
  await m.lookup(['contain']);
  assert.equal(fetched.at(-1), 'data/meanings/con.json');
  // prefetch() starts the same fetch the panel will use.
  m.prefetch(['dog']);
  await m.lookup(['dog']);
  assert.equal(fetched.filter((f) => f.endsWith('/do.json')).length, 1);
  // The game's start-up data and the offline download never include meanings.
  const data = readFileSync(ROOT + 'site/js/data.js', 'utf8');
  assert.doesNotMatch(data.slice(data.indexOf('export async function gameEnv')), /meanings/);
  assert.doesNotMatch(readFileSync(ROOT + 'site/sw.js', 'utf8'), /data\/meanings\/[a-z]/);
});

test('shards: small, sorted by first letters, and index.json lists every one', () => {
  const files = readdirSync(MEANINGS).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => f.slice(0, -5));
  assert.deepEqual(files.sort(), [...KEYS].sort());
  for (const k of KEYS) {
    const d = JSON.parse(readFileSync(MEANINGS + k + '.json', 'utf8'));
    for (const w of Object.keys(d)) assert.equal(shardKey(w, KEYS), k, w);
  }
  assert.ok(existsSync(MEANINGS + 'LICENSE.txt'), 'the WordNet and Britfone notices travel with the data');
});
