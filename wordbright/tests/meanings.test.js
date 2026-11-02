// Word meanings: the built shards (tools/build-meanings.py), Star words, the
// results panel rows, and loading a shard only when it is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createMeanings, shardKey, wordInfo, readIndex, SPELLBRIGHT_AUDIO } from '../site/js/meanings.js';
import { resultsHtml, movedWords, LOOK_UP, fillRows, PENDING_MEANING, FAILED_MEANING, NO_MEANING } from '../site/js/ui/results.js';
import { starEntry } from '../site/js/ui/moves.js';
import { newGame, play, act } from '../site/js/engine/game.js';
import { computerTurn } from '../site/js/ai/computer.js';
import { DATA, ROOT, env, starWords, cellsWith, anchor } from './helpers.js';

const MEANINGS = DATA + 'meanings/';
const INDEX = JSON.parse(readFileSync(MEANINGS + 'index.json', 'utf8'));
const KEYS = readIndex(INDEX).keys;
const shardOf = (w) => JSON.parse(readFileSync(MEANINGS + shardKey(w, KEYS) + '.json', 'utf8'));
const entry = (w) => (shardKey(w, KEYS) ? shardOf(w)[w] || null : null); // no shard: nothing known

// Every shard, read once.
let all = null;
function allEntries() {
  if (!all) {
    all = new Map();
    for (const f of readdirSync(MEANINGS)) {
      if (f === 'index.json' || !f.endsWith('.json')) continue;
      for (const [w, e] of Object.entries(JSON.parse(readFileSync(MEANINGS + f, 'utf8')))) if (w !== '~') all.set(w, e);
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
  // G9b: "sex" only as biology ("of either sex", "both sexes"); "offensive" only
  // where it is not an insult ("offensive players"; insults are "offensive term").
  const SAFE_SEX = /\b(?:either|both|each|one|opposite|same|other|male|female|the two) sex(?:es)?\b|\bsexes\b|\bregardless of (?:\w+ )?sex\b|\b(?:age|and|or) sex\b|\bsex (?:and|or) age\b/gi;
  const bad = /\b(sex|sexual|sexually|penis|vagina|genitals?|erotic|copulate|cocaine|heroin|marijuana|offensive (?:term|name|word)|derogatory|disparaging|slur|obscene|vulgar|expletives?|pejorative)\b/i;
  const hits = [...allEntries()].filter(([, e]) => bad.test(((e.m || '') + ' ' + (e.e || '')).replace(SAFE_SEX, ' '))).map(([w]) => w);
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
    if (!known || !known.m) assert.ok(html.includes('A rare word — it’s in our word list, but we don’t have its meaning yet.'));
  }
  // A made-up move with a Star word: the badge, and our meaning.
  const star = { words: [{ word: 'build', points: 9, main: true, star: true }], starBonus: 5, fullRack: 0, total: 14 };
  const starHtml = resultsHtml('Pip', star, new Map([['build', entry('build')]]), starWords);
  assert.match(starHtml, /class="plus5[^"]*" aria-label="Star word, 5 extra points">(<svg[^>]*aria-hidden="true">.*?<\/svg>)?\+5<\/span>/);
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
  const sw = readFileSync(ROOT + 'site/sw.js', 'utf8');
  assert.doesNotMatch(sw.replace("'data/meanings/index.json'", ''), /data\/meanings\/[a-z]/, 'no shard in the shell');
  assert.match(sw, /'data\/meanings\/index\.json'/, 'G9: the index is cached with each version');
});

test('shards: small, sorted by first letters, and index.json lists every one', () => {
  const files = readdirSync(MEANINGS).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => f.slice(0, -5));
  assert.deepEqual(files.sort(), [...KEYS].sort());
  for (const k of KEYS) {
    const d = JSON.parse(readFileSync(MEANINGS + k + '.json', 'utf8'));
    for (const w of Object.keys(d)) if (w !== '~') assert.equal(shardKey(w, KEYS), k, w);
    assert.equal(d['~'], INDEX.shards[k], 'each shard carries the stamp the index lists: ' + k);
  }
  assert.ok(existsSync(MEANINGS + 'LICENSE.txt'), 'the WordNet and Britfone notices travel with the data');
});

// ---- G6b: Open English WordNet fills gaps; a rare word says so ----------------------
test('G6b: words WordNet 3.1 has no meaning for get one from Open English WordNet (same filters)', () => {
  for (const w of ['everything', 'punchline', 'texting', 'micrometre']) {
    const e = entry(w);
    assert.ok(e && e.m, w + ' has a meaning');
  }
  const lic = readFileSync(MEANINGS + 'LICENSE.txt', 'utf8');
  assert.match(lic, /Open English WordNet/);
  assert.match(lic, /CC BY 4\.0/);
  assert.ok(existsSync(ROOT + 'LICENSE-OEWN.txt'));
  const about = readFileSync(ROOT + 'site/js/views/pages.js', 'utf8');
  assert.match(about, /Open English WordNet<\/a> \(2025 edition\)/, 'credited on For parents');
});

test('G6b: a rare word with no meaning says so, kindly', async () => {
  assert.equal(entry('ren'), null, 'REN: in the list, in neither wordnet');
  const html = resultsHtml('Pip', { words: [{ word: 'ren', points: 3, main: true }], starBonus: 0, fullRack: 0, total: 3 }, new Map(), starWords);
  assert.ok(html.includes('A rare word — it’s in our word list, but we don’t have its meaning yet.'));
  assert.doesNotMatch(html, /No meaning yet/);
});

// ---- G9: meanings from a base word ---------------------------------------------------
test('G9: a word with no meaning of its own gets one from its base word, marked, and shown like any other', () => {
  const e = entry('frothier');
  assert.equal(e.d, 'frothy');
  assert.match(e.m, /^More frothy\. frothy: /);
  assert.match(entry('carefullest').m, /^Most careful\. careful: /);
  assert.match(entry('unweariedly').m, /^In an unwearied way\./);
  const info = wordInfo('frothier', e, null);
  assert.equal(info.derived, 'frothy');
  const html = resultsHtml('Pip', { words: [{ word: 'frothier', points: 12, main: true }], starBonus: 0, fullRack: 0, total: 12 }, new Map([['frothier', e]]), starWords);
  assert.match(html, /<p class="wordrow__meaning" id="[^"]+" data-derived="frothy">More frothy\./);
});

test('G9: a derived meaning only ever comes from a base word in our lists with a meaning of its own', () => {
  const list = new Set(readFileSync(ROOT + '../wordbright-design/wordlist/words_xlarge.txt', 'utf8').split('\n').filter(Boolean));
  const bad = [];
  let n = 0;
  for (const [w, e] of allEntries()) {
    if (!e.d || e.d.includes(' ')) continue; // "eke out": a phrase, tested below
    n++;
    const base = allEntries().get(e.d);
    if (!list.has(e.d) || !base || !base.m || base.d || !e.m.includes(e.d + ': ')) bad.push(w);
  }
  assert.ok(n > 5000, n + ' derived');
  assert.deepEqual(bad, []);
});

// ---- G9: a stale cache never hides a meaning ------------------------------------------
// The server has today's files; the "cache" (service worker or browser) may hold
// an older index or older shards. fresh: true goes past it to the server.
function cachedMeanings({ index, shard = (k) => JSON.parse(readFileSync(MEANINGS + k + '.json', 'utf8')), online = true }) {
  const calls = [];
  const server = (path) => {
    if (!online) throw new Error('offline');
    const file = ROOT + 'site/' + path;
    if (!existsSync(file)) throw new Error('404 ' + path);
    return JSON.parse(readFileSync(file, 'utf8'));
  };
  const m = createMeanings(async (path, { fresh = false } = {}) => {
    calls.push((fresh ? 'fresh ' : '') + path);
    if (fresh) return server(path);
    if (path.endsWith('index.json')) return index;
    const k = path.slice('data/meanings/'.length, -'.json'.length);
    const d = shard(k);
    if (!d) throw new Error('404 ' + path);
    return d;
  });
  return { m, calls };
}
const OLD_INDEX = [...KEYS].filter((k) => k !== 'ek' && !/^s[ac]./.test(k)).concat(['sa', 'sc']).sort(); // before G6b/G9 split sa and sc, and before "ek" existed
const WANT = ['eke', 'roved', 'frothier', 'scale', 'sadly'];

test('G9: an old cached index with new shards still finds EKE, ROVED and FROTHIER (fresh from the server when needed)', async () => {
  for (const w of WANT) assert.ok(entry(w) && entry(w).m, w + ' has a meaning in the shards');
  assert.equal(entry('eke').m.slice(0, 9), 'eke out: ', 'the phrase: eke -> eke out');
  const { m, calls } = cachedMeanings({ index: OLD_INDEX, shard: (k) => (existsSync(MEANINGS + k + '.json') ? JSON.parse(readFileSync(MEANINGS + k + '.json', 'utf8')) : null) });
  const got = await m.lookup(WANT);
  assert.deepEqual(WANT.filter((w) => !got.get(w)), [], 'every word found');
  assert.equal(got.get('frothier').d, 'frothy');
  assert.equal(calls.filter((c) => c === 'fresh data/meanings/index.json').length, 1, 'the fresh index is fetched once');
});

test('G9: a new index with old cached shards (no stamp, or another stamp) fetches those shards afresh', async () => {
  const stale = (k) => {
    const d = JSON.parse(readFileSync(MEANINGS + k + '.json', 'utf8'));
    delete d['~'];
    for (const w of WANT) delete d[w]; // an old copy, before these meanings existed
    return d;
  };
  const { m, calls } = cachedMeanings({ index: INDEX, shard: stale });
  const got = await m.lookup(WANT);
  assert.deepEqual(WANT.filter((w) => !got.get(w)), []);
  assert.ok(calls.some((c) => c.startsWith('fresh data/meanings/fr')));
  // A cached shard with the right stamp is used as it is: nothing fetched afresh.
  const ok = cachedMeanings({ index: INDEX });
  assert.ok((await ok.m.lookup(['roved'])).get('roved'));
  assert.deepEqual(ok.calls.filter((c) => c.startsWith('fresh')), []);
});

test('G9: stale and offline: no meaning, but no error either', async () => {
  const { m } = cachedMeanings({ index: OLD_INDEX, shard: () => null, online: false });
  const got = await m.lookup(['eke', 'roved']);
  assert.equal(got.size, 0);
  assert.equal(wordInfo('constructor', null, null).meaning, '', 'and a word like "constructor" is never read from Object');
});

// ---- G9b: common words are never "rare"; drop only unsafe senses -------------------
test('G9b: these common words always have a meaning', () => {
  const must = ['sin', 'god', 'church', 'war', 'kill', 'die', 'drug', 'beer', 'wine', 'bomb', 'gun', 'blood', 'hell', 'devil', 'pus'];
  assert.deepEqual(must.filter((w) => !(entry(w) && entry(w).m)), []);
});

test('G9b: a sense is dropped only when it is unsafe, not because a word in it looks like a blocked one', () => {
  // Once "rare": a definition with "horny plates", "offensive players", "(slang)", "both sexes", a slang synonym, or only a capitalised sense.
  for (const w of ['armadillo', 'baleen', 'backfield', 'abhorrent', 'backspin', 'batty', 'daft', 'bonkers', 'baloney', 'corpse', 'cadaver',
    'cattle', 'reindeer', 'checkup', 'youngster', 'morphine', 'intestine', 'antarctic', 'druid', 'amen', 'eureka']) {
    assert.ok(entry(w) && entry(w).m, w);
  }
  assert.match(entry('armadillo').m, /horny plates/);
  // Every sense unsafe: still no meaning.
  for (const w of ['lesbian', 'bidet']) assert.ok(!entry(w) || !entry(w).m, w);
  assert.equal(entry('bum').m, 'A vagrant.', 'the insult sense is still dropped');
});

// The panel: a slow look-up is "Finding the meaning…" and fills in; a failed one says so.
test('G9b: a slow meaning shows "Finding the meaning…" and fills in when it arrives; never "rare" before then', () => {
  const score = { words: [{ word: 'sin', points: 3, main: true }, { word: 'ren', points: 3, main: false }], starBonus: 0, fullRack: 0, total: 6 };
  const html = resultsHtml('Pip', score, new Map(), starWords, { pending: true });
  assert.ok(html.includes(PENDING_MEANING));
  assert.ok(!html.includes(NO_MEANING), 'not "rare" while waiting');
  // A tiny DOM for fillRows: rows with data-pending are replaced in place.
  const rows = [...html.matchAll(/<li class="wordrow" data-word="(\w+)" data-pending>/g)].map((m) => m[1]);
  assert.deepEqual(rows, ['sin', 'ren']);
  const replaced = [];
  const li = (word) => ({ dataset: { word }, querySelector: () => ({ firstChild: { textContent: '3' } }), insertAdjacentHTML: (_where, h) => replaced.push(h), remove() {} });
  fillRows({ querySelectorAll: () => rows.map(li) }, new Map([['sin', entry('sin')]]), starWords);
  assert.match(replaced[0], /Estrangement from god/);
  assert.ok(replaced[1].includes(NO_MEANING), 'REN: rare, once the look-up has finished');
  replaced.length = 0;
  fillRows({ querySelectorAll: () => rows.map(li) }, null, starWords);
  assert.ok(replaced.every((h) => h.includes(FAILED_MEANING)), 'failed: says so, not "rare"');
});

// ---- G9c: Wiktionary fills the gaps, kept apart and credited ----------------------------
const WIKT = MEANINGS + 'wikt/';
let wiktAll = null;
function wiktEntries() {
  if (!wiktAll) {
    wiktAll = new Map();
    for (const k of Object.keys(INDEX.wikt || {})) {
      const d = JSON.parse(readFileSync(WIKT + k + '.json', 'utf8'));
      assert.equal(d['~'], INDEX.wikt[k], 'stamp ' + k);
      for (const [w, e] of Object.entries(d)) if (w !== '~') wiktAll.set(w, e);
    }
  }
  return wiktAll;
}

test('G9c: Wiktionary meanings are in their own shards (data/meanings/wikt/), each marked src "wikt", only for words with no other meaning', () => {
  const W = wiktEntries();
  assert.ok(W.size > 40000, W.size + ' meanings');
  const files = readdirSync(WIKT).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  assert.deepEqual(files.sort(), Object.keys(INDEX.wikt).sort());
  for (const [w, e] of W) {
    assert.equal(e.src, 'wikt', w);
    const own = entry(w);
    assert.ok(!own || !own.m, w + ' already had a meaning');
  }
  assert.ok(existsSync(WIKT + 'LICENSE.txt'));
  assert.match(readFileSync(ROOT + 'LICENSE-WIKTIONARY.txt', 'utf8'), /CC BY-SA 4\.0/);
  assert.match(readFileSync(MEANINGS + 'LICENSE.txt', 'utf8'), /Wiktionary/);
  assert.match(readFileSync(ROOT + 'site/js/views/pages.js', 'utf8'), /href="https:\/\/en\.wiktionary\.org\/">Wiktionary<\/a>.*CC BY-SA 4\.0/);
});

test('G9c: every Wiktionary meaning is one short sentence and passes the child-safe checks', () => {
  const SAFE_SEX = /\b(?:either|both|each|one|opposite|same|other|male|female|the two) sex(?:es)?\b|\bsexes\b|\bregardless of (?:\w+ )?sex\b|\b(?:age|and|or) sex\b|\bsex (?:and|or) age\b/gi;
  const bad = /\b(sex|sexual|sexually|penis|vagina|genitals?|erotic|copulate|cocaine|heroin|marijuana|offensive (?:term|name|word)|derogatory|disparaging|slur|obscene|vulgar|expletives?|pejorative)\b/i;
  const long = [];
  const hits = [];
  for (const [w, e] of wiktEntries()) {
    if (bad.test(e.m.replace(SAFE_SEX, ' '))) hits.push(w);
    if (!e.d && e.m.length > 141) long.push(w);
  }
  assert.deepEqual(hits.slice(0, 10), []);
  assert.deepEqual(long.slice(0, 10), []);
});

test('G9c: PUS, REN and SIN all have meanings in the game (REN from Wiktionary, with its credit)', async () => {
  const { m } = diskMeanings();
  const got = await m.lookup(['pus', 'ren', 'sin', 'noticeboard']);
  assert.match(got.get('pus').m, /inflammation/);
  assert.equal(got.get('sin').m, 'Estrangement from god.');
  assert.equal(got.get('ren').m, 'A kidney.');
  assert.equal(got.get('ren').src, 'wikt');
  const info = wordInfo('ren', got.get('ren'), null);
  assert.equal(info.src, 'wikt');
  const html = resultsHtml('Pip', { words: [{ word: 'ren', points: 3, main: true }], starBonus: 0, fullRack: 0, total: 3 }, got, starWords);
  assert.match(html, /<p class="small muted wordrow__credit">Meaning: <a href="https:\/\/en\.wiktionary\.org\/wiki\/ren" target="_blank" rel="noopener">Wiktionary/);
  assert.doesNotMatch(resultsHtml('Pip', { words: [{ word: 'sin', points: 3, main: true }], starBonus: 0, fullRack: 0, total: 3 }, got, starWords), /wiktionary/i);
});

test('G9c: an index from before the Wiktionary shards still finds REN (a fresh index from the server)', async () => {
  const before = { v: 2, shards: INDEX.shards }; // no "wikt"
  const { m, calls } = cachedMeanings({ index: before });
  const got = await m.lookup(['ren', 'sin']);
  assert.equal(got.get('ren').m, 'A kidney.');
  assert.equal(got.get('sin').m, 'Estrangement from god.');
  assert.ok(calls.includes('fresh data/meanings/index.json'));
});
