// Comic Studio (C2-1) and My own story (C2-2): the tile content, the moves, sentence
// building (every right path accepted), the level scaffolds, the read-aloud text,
// old drafts, own-story save and merge, and the child-safe check on typed words.
// Run: node --test compose/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as K from '../site/js/comic-doc.js';
import * as T from '../site/js/tasks.js';
import { checkTyped, typedNote, UNKIND, wordsOf } from '../site/js/safe-text.js';
import { isPlayPath, isComposePath } from '../site/js/gate.js';
import { ICONS, FEELING_NAMES } from '../site/js/comic-render.js';
import * as W from '../site/js/writing-doc.js';
import * as C from '../site/js/checks.js';
import { loadWordGraph, isWord } from '../../wordbright/site/js/engine/words.js';

const root = (p) => fileURLToPath(new URL('../../' + p, import.meta.url));
const json = (p) => JSON.parse(readFileSync(root(p), 'utf8'));
const tasks = json('compose/site/data/tasks.json').tasks;
const shared = json('compose/site/data/comic.json');
const stickers = json('compose/site/data/stickers.json');
const buf = readFileSync(root('wordbright/site/data/words_all.dawg'));
const graph = loadWordGraph(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
const isKnown = (w) => isWord(w, graph);
const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
const FEELINGS = shared.feelings.map((f) => f.id);
const hasWord = (s, w) => new RegExp('(^|[^A-Za-z])' + w + '(?![A-Za-z])', 'i').test(s);

// ---- the content -------------------------------------------------------------------------------
test('every task has comic tiles, waiting for review', () => {
  for (const t of tasks) {
    assert.ok(t.comic, t.id);
    assert.equal(t.comic.reviewed, false, t.id + ': unreviewed until approved');
  }
  assert.equal(shared.own.reviewed, false, 'My own story waits for review too');
});
for (const t of tasks) {
  const k = t.comic;
  test(t.id + ': the story wheel has choices that fit, and one that does not', () => {
    for (const q of K.WHEEL) {
      assert.equal(k[q].length, 3, q);
      assert.ok(k[q].some((o) => o.fits) && k[q].some((o) => !o.fits), q);
      for (const o of k[q]) assert.ok(ICONS[o.icon], q + ' icon ' + o.icon);
    }
    for (const o of k.who) assert.ok(o.be === 'was' || o.be === 'were', o.text);
    for (const o of k.when) assert.match(o.text, /^[A-Z]/);
    const open = K.opening(t, { who: 0, where: 0, when: 0 });
    assert.match(open, /^[A-Z].+ (was|were) .+\.$/);
  });
  test(t.id + ': four panels, each with right sentences, wrong tiles, a feeling and speech', () => {
    assert.equal(k.panels.length, 4);
    k.panels.forEach((p, i) => {
      const paths = K.pathsOf(p);
      assert.ok(paths.length >= 2, 'several correct paths in panel ' + (i + 1));
      for (const path of paths) assert.equal(path.length, p.slots.length, p.paths.join(' / '));
      assert.equal(p.wrong.length, p.slots.length, 'a wrong tile for every slot');
      p.wrong.forEach((ws, s) => { for (const w of ws) assert.ok(!paths.some((path) => path[s] === w), 'a wrong tile is never right there: ' + w); });
      for (const path of paths) assert.ok(hasWord(path.join(' '), p.describe.noun), 'the describing word has its noun: ' + p.describe.noun + ' in ' + path.join(' '));
      assert.ok(p.describe.ideas.length >= 2);
      assert.ok(p.feel.fits.length >= 1 && p.feel.fits.every((f) => FEELINGS.includes(f)), p.feel.fits.join());
      assert.equal(p.speech.length, 3);
      for (const s of p.speech) assert.ok(s.who && s.says);
    });
    assert.equal(k.endings.length, 3);
    for (const w of Object.keys(k.upgrades)) assert.ok(k.panels.some((p) => p.paths.some((x) => hasWord(x.replace(/\|/g, ' '), w))), 'an upgrade the tiles can use: ' + w);
    for (const b of Object.values(k.upgrades)) assert.ok(b.length >= 1);
  });
  test(t.id + ': every word in the comic is on our lists (so child-safe), names apart', () => {
    const names = new Set(C.taskWords(t).map((w) => w.toLowerCase()));
    const strings = [...K.WHEEL.flatMap((q) => k[q].map((o) => o.text)), ...k.panels.flatMap((p) => [...p.paths, ...p.wrong.flat(), p.describe.noun, ...p.describe.ideas, p.feel.who, ...p.speech.flatMap((s) => [s.who, s.says])]), ...Object.entries(k.upgrades).flat(2), ...k.endings];
    const bad = new Set();
    for (const w of strings.flatMap(wordsOf)) {
      const l = w.toLowerCase();
      if (UNKIND.has(l)) bad.add(w);
      const r = checkTyped(w, isKnown, { extra: [...names] });
      if (!r.ok) bad.add(w);
    }
    assert.deepEqual([...bad], []);
    assert.doesNotMatch(JSON.stringify(k), /\b(color|favorite|neighbor|center|realize|mom)\b/i);
  });
}
test('the shared tiles: openers for every band and panel, feelings, own-story parts, all on our lists', () => {
  for (const band of ['3', '4', '5']) {
    assert.equal(shared.openers[band].length, 4);
    for (const row of shared.openers[band]) assert.equal(row.length, 3);
  }
  for (const f of shared.feelings) { assert.ok(FEELING_NAMES[f.id], f.id); for (const b of ['3', '4', '5']) assert.equal(f.words[b].length, 2); }
  const strings = [...Object.values(shared.openers).flat(2), ...shared.feelings.flatMap((f) => Object.values(f.words).flat()), ...shared.why, ...shared.own.did, ...Object.values(shared.own.where),
    ...shared.own.problems.map((p) => p.text.replace(/\{\w+\}/g, '')), ...shared.own.solutions.map((p) => p.text.replace(/\{\w+\}/g, '')), ...shared.own.speech, ...shared.own.endings];
  const bad = strings.filter((s) => !checkTyped(s, isKnown).ok && s.trim());
  assert.deepEqual(bad, []);
  for (const c of [...shared.own.problems, ...shared.own.solutions]) assert.ok(ICONS[c.icon], c.icon);
  for (const id of Object.keys(shared.own.where)) assert.ok(stickers.backgrounds.some((b) => b.id === id), id);
});
test('the sticker list: 8 places, 12 characters in 2 poses, 16 things, every file there', () => {
  assert.equal(stickers.backgrounds.length, 8);
  assert.equal(stickers.characters.length, 12);
  assert.equal(stickers.objects.length, 16);
  const files = [...stickers.backgrounds.flatMap((b) => Object.values(b.src)), ...stickers.characters.flatMap((c) => Object.values(c.poses)), ...stickers.objects.map((o) => o.src)];
  for (const f of files) assert.ok(existsSync(root('compose/site/' + f)), f);
  for (const s of [...stickers.backgrounds, ...stickers.characters, ...stickers.objects]) assert.ok(checkTyped(s.name, isKnown, { extra: stickers.characters.map((c) => c.name) }).ok, s.name);
  for (const f of files.filter((x) => x.endsWith('.svg'))) assert.doesNotMatch(readFileSync(root('compose/site/' + f), 'utf8'), /<text|<script|href=/, 'no text or links in a sticker: ' + f);
});

// ---- the moves --------------------------------------------------------------------------------
const NOW = 1_700_000_000_000;
const kite = byId['lost-kite'];
const fresh = (t = kite, level) => { const d = K.startComic(K.emptyComics(), t, { id: 'c1', now: NOW, level }); return { d, c: d.comics.c1 }; };
/** Make one panel at a level with the first right path, a fitting face, the first speech line. */
function makePanel(d, t, i, { word = 'bright', typed = '' } = {}) {
  const spec = t.comic.panels[i];
  const sc = K.scaffold(d.comics.c1.level);
  let guard = 0;
  for (;;) {
    const p = d.comics.c1.panels[i];
    const s = K.panelStep(p, spec, sc);
    if (s === 'done' || guard++ > 20) return d;
    if (s === 'opener') d = K.changePanel(d, 'c1', i, { op: shared.openers[sc.band][i][0] }, NOW);
    if (s === 'sentence') d = K.changePanel(d, 'c1', i, { tiles: [...p.tiles, K.pathsOf(spec)[0][p.tiles.length]] }, NOW);
    if (s === 'type') d = K.changePanel(d, 'c1', i, { text: typed || p.op + ' ' + K.pathsOf(spec)[0].join(' ') }, NOW);
    if (s === 'word') d = K.changePanel(d, 'c1', i, { word }, NOW);
    if (s === 'feel') d = K.changePanel(d, 'c1', i, { feel: { face: spec.feel.fits[0], word: 'happy' } }, NOW);
    if (s === 'why') d = K.changePanel(d, 'c1', i, { feel: { ...p.feel, why: '' } }, NOW);
    if (s === 'say') d = K.changePanel(d, 'c1', i, { say: { i: 0 }, done: true }, NOW);
  }
}
test('the moves come one after another: order, wheel, four panels, join, read, finish', () => {
  let { d } = fresh();
  const seen = [];
  const step = () => { const m = K.nextMove(d.comics.c1); seen.push(m.move + (m.panel !== undefined ? m.panel : '')); return m; };
  assert.equal(step().move, 'order');
  d = K.change(d, 'c1', { order: { tries: 1, done: true } }, NOW);
  assert.equal(step().move, 'wheel');
  for (const q of K.WHEEL) d = K.change(d, 'c1', { wheel: { ...d.comics.c1.wheel, [q]: 0 } }, NOW);
  for (let i = 0; i < 4; i += 1) { assert.deepEqual(step(), { move: 'panel', panel: i }); d = makePanel(d, kite, i); }
  assert.equal(step().move, 'join');
  while (K.joinNext(d.comics.c1, kite)) { const s = K.joinNext(d.comics.c1, kite); d = K.change(d, 'c1', { join: { ...d.comics.c1.join, up: { ...d.comics.c1.join.up, [s.word]: s.better[0] } } }, NOW); }
  d = K.change(d, 'c1', { join: { ...d.comics.c1.join, end: 0, done: true } }, NOW);
  assert.equal(step().move, 'read');
  d = K.change(d, 'c1', { read: true }, NOW);
  assert.equal(step().move, 'finish');
  d = K.finish(d, 'c1', NOW + 5);
  assert.equal(step().move, 'done');
  assert.deepEqual(K.finished(d).map((c) => c.id), ['c1']);
  assert.equal(K.openComic(d, 'lost-kite'), null);
});
test('Order it: never starts in order, always the same for a comic, and finds the wrong boxes', () => {
  for (let n = 0; n < 200; n += 1) {
    const s = K.orderStart('w' + n);
    assert.deepEqual([...s].sort(), [0, 1, 2, 3]);
    assert.ok(!s.every((v, i) => v === i));
    assert.deepEqual(K.orderStart('w' + n), s);
  }
  assert.deepEqual(K.wrongBoxes([0, 1, 2, 3]), []);
  assert.deepEqual(K.wrongBoxes([1, 0, 2, 3]), [0, 1]);
});
test('Story wheel: who, where, when make the opening caption', () => {
  assert.equal(K.opening(kite, { who: 0, where: 0, when: 0 }), 'One windy afternoon, Maya and her little brother Sam were at the park.');
  assert.equal(K.opening(byId['snowman-contest'], { who: 1, where: 1, when: 1 }), 'One cold winter day, two friends, Ella and Kofi, were in the snowy village.');
  assert.equal(K.opening(kite, { who: 0 }), '');
});

// ---- tile sentences: every right path is accepted -------------------------------------------------
for (const t of tasks) {
  test(t.id + ': every right path builds, tile by tile; every wrong tile is turned away', () => {
    t.comic.panels.forEach((spec, i) => {
      for (const path of K.pathsOf(spec)) {
        const chosen = [];
        for (const tile of path) {
          assert.ok(K.canPlace(spec, chosen, tile), 'panel ' + (i + 1) + ': ' + [...chosen, tile].join(' '));
          assert.ok(K.tileChoices(spec, chosen.length, 'x').includes(tile), 'offered: ' + tile);
          chosen.push(tile);
        }
        assert.ok(K.isSentence(spec, chosen));
      }
      spec.wrong.forEach((ws, s) => {
        const prefix = K.pathsOf(spec)[0].slice(0, s);
        for (const w of ws) { assert.ok(!K.canPlace(spec, prefix, w), w); assert.ok(K.tileChoices(spec, s, 'x').includes(w), 'the wrong tile is offered: ' + w); }
      });
      assert.ok(!K.isSentence(spec, K.pathsOf(spec)[0].slice(0, -1)), 'half a sentence is not a sentence');
    });
  });
}
test('mixing two right paths is turned away where they part', () => {
  const spec = kite.comic.panels[0]; // Maya flew her kite in the park / ... high in the sky / Sam watched the kite high in the sky
  assert.ok(K.canPlace(spec, ['Sam', 'watched', 'the kite'], 'high in the sky'));
  assert.ok(!K.canPlace(spec, ['Sam', 'watched', 'the kite'], 'in the park'));
  assert.ok(!K.canPlace(spec, ['Sam'], 'flew'));
  assert.ok(K.canPlace(spec, ['Maya'], 'flew'));
});

// ---- level scaffolds ------------------------------------------------------------------------------
test('levels: Year 3 all tiles, Year 4 tiles and a typed word, Year 5-6 typed sentences', () => {
  assert.deepEqual(K.scaffold(3), { level: 3, band: '3', sentence: 'tiles', word: false, typeBubble: false, why: false, typeOwn: false });
  assert.deepEqual(K.scaffold(4), { level: 4, band: '4', sentence: 'tiles', word: true, typeBubble: true, why: false, typeOwn: true });
  assert.equal(K.scaffold(5).sentence, 'typed');
  assert.equal(K.scaffold(6).band, '5');
  assert.equal(K.scaffold('nonsense').level, 3);
  assert.deepEqual([K.easier(3), K.easier(5), K.harder(4), K.harder(6)], [3, 4, 5, 6]);
});
test('each level takes its own steps through a panel', () => {
  const steps = (level) => {
    let { d } = fresh(kite, level);
    const spec = kite.comic.panels[0];
    const out = [];
    for (let n = 0; n < 12; n += 1) {
      const p = d.comics.c1.panels[0];
      const s = K.panelStep(p, spec, K.scaffold(level));
      out.push(s);
      if (s === 'done') break;
      d = makePanel(K.changePanel(d, 'c1', 0, {}, NOW), kite, 0); // one whole run, to compare with the list below
      break;
    }
    return out;
  };
  assert.deepEqual(steps(3), ['opener']);
  // The full lists:
  const run = (level) => {
    let { d } = fresh(kite, level);
    const spec = kite.comic.panels[0];
    const sc = K.scaffold(level);
    const seen = [];
    for (let n = 0; n < 20; n += 1) {
      const p = d.comics.c1.panels[0];
      const s = K.panelStep(p, spec, sc);
      if (seen[seen.length - 1] !== s) seen.push(s);
      if (s === 'done') break;
      if (s === 'opener') d = K.changePanel(d, 'c1', 0, { op: 'First,' }, NOW);
      if (s === 'sentence') d = K.changePanel(d, 'c1', 0, { tiles: [...p.tiles, K.pathsOf(spec)[0][p.tiles.length]] }, NOW);
      if (s === 'type') d = K.changePanel(d, 'c1', 0, { text: 'First, Maya flew her kite.' }, NOW);
      if (s === 'word') d = K.changePanel(d, 'c1', 0, { word: 'red' }, NOW);
      if (s === 'feel') d = K.changePanel(d, 'c1', 0, { feel: { face: 'happy', word: 'glad' } }, NOW);
      if (s === 'why') d = K.changePanel(d, 'c1', 0, { feel: { ...p.feel, join: 'because', why: 'the kite flew' } }, NOW);
      if (s === 'say') d = K.changePanel(d, 'c1', 0, { say: { skip: true }, done: true }, NOW);
    }
    return seen;
  };
  assert.deepEqual(run(3), ['opener', 'sentence', 'feel', 'say', 'done']);
  assert.deepEqual(run(4), ['opener', 'sentence', 'word', 'feel', 'say', 'done']);
  assert.deepEqual(run(5), ['opener', 'type', 'feel', 'why', 'say', 'done']);
  assert.deepEqual(run(6), run(5));
});
test('moving down a level keeps what is made: a typed sentence still counts at Year 3', () => {
  const spec = kite.comic.panels[0];
  const p = { op: 'First,', tiles: [], text: 'First, Maya ran.', miss: 0, done: false };
  assert.equal(K.panelStep(p, spec, K.scaffold(3)), 'feel');
});

// ---- sentences and the read-aloud text --------------------------------------------------------
test('a describing word goes before its noun, with "an" before a vowel', () => {
  assert.equal(K.addWord('First, Maya flew her kite in the park.', 'kite', 'bright'), 'First, Maya flew her bright kite in the park.');
  assert.equal(K.addWord('Then a park keeper climbed a ladder.', 'ladder', 'old'), 'Then a park keeper climbed an old ladder.');
  assert.equal(K.addWord('A ladder fell.', 'ladder', 'enormous'), 'An enormous ladder fell.');
  assert.equal(K.addWord('The kites flew.', 'kite', 'red'), 'The kites flew.', 'whole words only');
  assert.equal(K.addWord('Maya flew.', 'kite', ''), 'Maya flew.');
});
test('stronger words replace whole words only, keeping a capital', () => {
  assert.equal(K.applyUpgrades('Then Maya flew her kite. Sam flew too.', { flew: 'soared' }), 'Then Maya soared her kite. Sam soared too.');
  assert.equal(K.applyUpgrades('Gave it back.', { gave: 'handed' }), 'Handed it back.');
  assert.equal(K.applyUpgrades('The forgave came.', { gave: 'handed' }), 'The forgave came.');
  assert.equal(K.applyUpgrades('Maya flew.', { flew: 'flew' }), 'Maya flew.');
});
function wholeComic(level = 3) {
  let { d } = fresh(kite, level);
  d = K.change(d, 'c1', { order: { tries: 0, done: true }, wheel: { who: 0, where: 0, when: 0, miss: 0 } }, NOW);
  for (let i = 0; i < 4; i += 1) d = makePanel(d, kite, i);
  d = K.change(d, 'c1', { join: { up: { flew: 'soared' }, end: 0, done: true }, read: true }, NOW);
  return d;
}
test('the read-aloud text: the opening, each panel, speech with "said", and the ending, in order', () => {
  const d = wholeComic(3);
  const lines = K.readText(d.comics.c1, kite);
  assert.deepEqual(lines.map((l) => l.text), [
    'One windy afternoon, Maya and her little brother Sam were at the park.',
    'First, Maya soared her kite in the park.',
    'Sam felt happy.',
    '"Look how high it is!" said Sam.',
    'Then the kite got stuck in a tree.',
    'Maya felt happy.',
    '"Oh no, my kite!" said Maya.',
    'After that, a park keeper climbed a ladder to reach the kite.',
    'Maya felt happy.',
    '"Don\'t worry, I\'ll get it!" said the park keeper.',
    'In the end, the park keeper gave the kite back to Maya.',
    'Maya felt happy.',
    '"Thank you so much!" said Maya.',
    'It was a good day after all.',
  ]);
  assert.deepEqual([...new Set(lines.map((l) => l.panel))], [0, 1, 2, 3]);
  assert.equal(lines.filter((l) => l.kind === 'speech').length, 4);
  assert.match(K.comicText(lines), /^One windy afternoon.+\n\nThen the kite/s);
});
test('Year 4 puts the typed word in; Year 5 keeps the typed sentence and the reason', () => {
  let d = wholeComic(4);
  assert.match(K.readText(d.comics.c1, kite)[1].text, /her bright kite/);
  ({ d } = fresh(kite, 5));
  d = K.changePanel(d, 'c1', 1, { op: 'Without warning,', text: 'without warning, the string snapped', feel: { face: 'sad', word: 'heartbroken', join: 'because', why: 'her kite was stuck.' }, say: { who: 'Sam', text: 'Oh dear' }, done: true }, NOW);
  const lines = K.readText(d.comics.c1, kite);
  assert.deepEqual(lines.map((l) => l.text), ['Without warning, the string snapped.', 'Maya felt heartbroken because her kite was stuck.', '"Oh dear." said Sam.']);
});
test('speech: one of the task\'s lines, typed words, or none', () => {
  const spec = kite.comic.panels[0];
  assert.deepEqual(K.speechOf({ say: { i: 1 } }, spec), spec.speech[1]);
  assert.deepEqual(K.speechOf({ say: { who: 'Maya', text: ' Wow! ' } }, spec), { who: 'Maya', says: 'Wow!' });
  assert.equal(K.speechOf({ say: { skip: true } }, spec), null);
  assert.deepEqual(K.speakers(spec), ['Sam', 'Maya']);
});
test('join it up offers at most three of the words used, in story order', () => {
  const d = wholeComic(3);
  const c = { ...d.comics.c1, join: { up: {}, end: null, done: false } };
  const spots = K.upgradeSpots(c, kite);
  assert.deepEqual(spots.map((s) => s.word), ['flew', 'climbed', 'gave']);
  assert.equal(K.joinNext({ ...c, join: { up: { flew: 'soared', climbed: 'climbed' } } }, kite).word, 'gave');
});
test('tap to fix: the panel starts again, keeping its starter, and the comic is read again', () => {
  let d = wholeComic(3);
  d = K.fixPanel(d, 'c1', 2, NOW + 1);
  const c = d.comics.c1;
  assert.deepEqual([c.panels[2].op, c.panels[2].tiles, c.panels[2].done, c.read], ['After that,', [], false, false]);
  assert.deepEqual(K.nextMove(c), { move: 'panel', panel: 2 });
});

// ---- stars --------------------------------------------------------------------------------------
test('stars are counted from tries and misses, never stored', () => {
  let d = wholeComic(3);
  d = K.change(d, 'c1', { order: { tries: 2, done: true }, wheel: { ...d.comics.c1.wheel, miss: 1 } }, NOW);
  d = K.changePanel(d, 'c1', 0, { miss: 5 }, NOW);
  const s = K.starsOf(d.comics.c1);
  assert.deepEqual(s.moves, { order: 1, wheel: 2, panel1: 1, panel2: 3, panel3: 3, panel4: 3, join: 3, read: 3 });
  assert.equal(s.total, 19);
  assert.equal(s.max, 24);
  const ch = (ok) => K.starsOf({ ...d.comics.c1, challenge: { done: true, checks: ok.map((x) => ({ ok: x })) } }).bonus;
  assert.deepEqual([ch([false, false]), ch([true, false]), ch([true, true])], [1, 2, 3]);
  assert.ok(!JSON.stringify(d).includes('"stars"'));
});

// ---- old drafts ----------------------------------------------------------------------------------
test('an old unfinished draft goes into the Write it yourself box; old writing is left alone', () => {
  let w = W.startPiece(W.emptyDoc(), kite, { id: 'p1', now: NOW });
  w = W.change(w, 'p1', { parts: ['Maya had a kite.', '', 'It got stuck.', ''] }, NOW);
  const before = JSON.stringify(w);
  const d = K.startComic(K.emptyComics(), kite, { id: 'c1', now: NOW, draft: W.openPiece(w, 'lost-kite') });
  assert.deepEqual(d.comics.c1.challenge, { text: 'Maya had a kite.\n\nIt got stuck.', done: false, from: 'p1', at: NOW });
  assert.equal(JSON.stringify(w), before, 'the writing doc is not changed');
  assert.equal(K.startComic(K.emptyComics(), kite, { id: 'c1', now: NOW, draft: null }).comics.c1.challenge, null);
  assert.equal(K.startComic(K.emptyComics(), kite, { id: 'c1', now: NOW, draft: { id: 'p2', parts: ['  '] } }).comics.c1.challenge, null);
});
test('the comics value survives anything: junk is dropped, a missing part is made', () => {
  assert.deepEqual(K.normaliseComics(null), K.emptyComics());
  assert.deepEqual(K.normaliseComics({ v: 2, comics: { a: {} } }), K.emptyComics());
  const n = K.normaliseComics({ v: 1, comics: { a: { kind: 'task', task: 'lost-kite', level: 9 }, b: { kind: 'nope' }, c: 'x', d: { kind: 'task' } } });
  assert.deepEqual(Object.keys(n.comics), ['a']);
  assert.equal(n.comics.a.level, 3);
  assert.equal(n.comics.a.panels.length, 4);
  assert.deepEqual(K.nextMove(n.comics.a), { move: 'order' });
});

// ---- My own story --------------------------------------------------------------------------------
function ownDone() {
  let d = K.startOwn(K.emptyComics(), { id: 'o1', now: NOW, level: 3 });
  d = K.change(d, 'o1', { setting: 'park', cast: ['amara', 'biscuit'], castDone: true, props: ['kite'], propsDone: true, spark: { problem: 'Amara lost the kite.', solution: 'Everyone worked together.' } }, NOW);
  for (let i = 0; i < 4; i += 1) d = K.changePanel(d, 'o1', i, { st: K.placeSticker([], 'amara.a', 30, 60), stDone: true, cap: { op: 'First,', tiles: ['Amara', 'found', 'the kite', 'in the park'] }, say: i === 1 ? { who: 'amara', text: 'Oh no!' } : { skip: true }, done: true }, NOW);
  return K.change(d, 'o1', { title: 'Amara and the Kite' }, NOW);
}
test('My own story: setting, characters, things, problem, solution, four panels, title', () => {
  let d = K.startOwn(K.emptyComics(), { id: 'o1', now: NOW, level: 4 });
  const seq = [];
  const m = () => { const x = K.nextMove(d.comics.o1); seq.push(x.move + (x.panel ?? '')); };
  m(); d = K.change(d, 'o1', { setting: 'beach' }, NOW);
  m(); d = K.change(d, 'o1', { cast: ['mei'], castDone: true }, NOW);
  m(); d = K.change(d, 'o1', { propsDone: true }, NOW);
  m(); d = K.change(d, 'o1', { spark: { problem: 'It started to pour with rain.', solution: null } }, NOW);
  m(); d = K.change(d, 'o1', { spark: { ...d.comics.o1.spark, solution: 'They asked a grown-up for help.' } }, NOW);
  for (let i = 0; i < 4; i += 1) {
    m();
    assert.equal(K.ownPanelStep(d.comics.o1.panels[i]), 'stickers');
    d = K.changePanel(d, 'o1', i, { stDone: true }, NOW);
    assert.equal(K.ownPanelStep(d.comics.o1.panels[i]), 'caption');
    d = K.changePanel(d, 'o1', i, { cap: { text: 'Mei ran.' } }, NOW);
    assert.equal(K.ownPanelStep(d.comics.o1.panels[i]), 'say');
    d = K.changePanel(d, 'o1', i, { say: { skip: true }, done: true }, NOW);
  }
  m(); d = K.change(d, 'o1', { title: 'Rain' }, NOW);
  m();
  assert.deepEqual(seq, ['setting', 'cast', 'props', 'problem', 'solution', 'panel0', 'panel1', 'panel2', 'panel3', 'title', 'finish']);
});
test('My own story: Back a step opens the last step again', () => {
  let d = ownDone();
  d = K.change(d, 'o1', { title: null }, NOW);
  const back = () => { d = K.ownBack(d, 'o1', NOW); return K.nextMove(d.comics.o1); };
  assert.deepEqual(back(), { move: 'panel', panel: 3 }); // title -> the last panel's bubble
  assert.equal(K.ownPanelStep(d.comics.o1.panels[3]), 'say');
  back();
  assert.equal(K.ownPanelStep(d.comics.o1.panels[3]), 'caption');
  back();
  assert.equal(K.ownPanelStep(d.comics.o1.panels[3]), 'stickers');
  assert.equal(d.comics.o1.panels[3].st.length, 1, 'the stickers are kept');
  let e = K.startOwn(K.emptyComics(), { id: 'o1', now: NOW, level: 3 });
  e = K.change(e, 'o1', { setting: 'park', castDone: true, cast: ['finn'] }, NOW);
  e = K.ownBack(e, 'o1', NOW);
  assert.equal(K.nextMove(e.comics.o1).move, 'cast');
  assert.deepEqual(e.comics.o1.cast, ['finn'], 'the choice is kept');
  e = K.ownBack(e, 'o1', NOW);
  assert.equal(K.nextMove(e.comics.o1).move, 'setting');
});
test('stickers are data: clamped, at most 8, moved, sized, flipped and taken out', () => {
  let s = [];
  for (let n = 0; n < 12; n += 1) s = K.placeSticker(s, 'kite', 50, 50);
  assert.equal(s.length, K.MAX_STICKERS);
  s = K.placeSticker([], 'amara.a', 150, -20);
  assert.deepEqual(s, [{ k: 'amara.a', x: 100, y: 0, s: 1, f: 0 }]);
  s = K.moveSticker(s, 0, 33.6, 41.2);
  assert.deepEqual([s[0].x, s[0].y], [34, 41]);
  s = K.nudgeSticker(s, 0, -40, 3);
  assert.deepEqual([s[0].x, s[0].y], [0, 44]);
  for (let n = 0; n < 10; n += 1) s = K.resizeSticker(s, 0, 0.2);
  assert.equal(s[0].s, 2);
  for (let n = 0; n < 20; n += 1) s = K.resizeSticker(s, 0, -0.2);
  assert.equal(s[0].s, 0.4);
  assert.equal(K.flipSticker(s, 0)[0].f, 1);
  assert.deepEqual(K.removeSticker(s, 0), []);
  assert.equal(K.placeSticker([], '<img onerror=x>', 1, 1).length, 0, 'only sticker ids');
  const n = K.normaliseComics({ v: 1, comics: { o: { kind: 'own', panels: [{ st: [{ k: 'kite', x: 'a', y: 500 }, { k: 'bad id!' }] }] } } });
  assert.deepEqual(n.comics.o.panels[0].st, [{ k: 'kite', x: 0, y: 100, s: 1, f: 0 }]);
});
test('My own story reads aloud with names, and its caption tiles make a sentence', () => {
  const d = ownDone();
  const names = { amara: 'Amara' };
  const lines = K.ownReadText(d.comics.o1, (x) => names[x] || x);
  assert.equal(lines[0].text, 'First, Amara found the kite in the park.');
  assert.deepEqual(lines.filter((l) => l.kind === 'speech').map((l) => l.text), ['"Oh no!" said Amara.']);
  assert.equal(K.ownCaption({ text: 'the end' }), 'The end.');
  assert.equal(K.sparkText('{who} lost {thing}.', { who: 'Finn', thing: 'the map' }), 'Finn lost the map.');
  assert.equal(K.sparkText('{thing} broke into pieces.', { thing: 'the kite' }), 'The kite broke into pieces.');
});
test('saving: comics merge by id; a finished copy wins; the child\'s typed words are never lost', () => {
  const a = ownDone();
  const fin = K.finish(a, 'o1', NOW + 10);
  let other = K.change(a, 'o1', { spark: { problem: 'Typed on the tablet.', solution: 'x' } }, NOW + 20);
  other = K.startComic(other, kite, { id: 'c9', now: NOW });
  const m = K.mergeComics(fin, other);
  assert.equal(m.comics.o1.stage, 'done', 'finished beats newer unfinished');
  assert.match(m.comics.o1.other.text, /Typed on the tablet/);
  assert.ok(m.comics.c9, 'a comic from either side is kept');
  assert.deepEqual(K.mergeComics(m, m), m, 'merging is steady');
  assert.deepEqual(K.mergeComics(fin, other), K.mergeComics(other, fin));
  const reset = K.mergeComics({ ...fin, resetAt: NOW + 100 }, other);
  assert.deepEqual(Object.keys(reset.comics), [], 'a reset clears older comics');
});
test('size: past 48 KB other copies go, then old unfinished comics; a finished comic never goes', () => {
  let d = K.emptyComics();
  for (let n = 0; n < 60; n += 1) {
    d = K.startOwn(d, { id: 'f' + n, now: NOW, level: 3 });
    d = K.change(d, 'f' + n, { title: 'x'.repeat(40), other: { text: 'y'.repeat(600), at: NOW } }, NOW);
    d = K.finish(d, 'f' + n, NOW);
  }
  for (let n = 0; n < 40; n += 1) { d = K.startOwn(d, { id: 'u' + n, now: NOW - 90 * 86400000, level: 3 }); d.comics['u' + n].at = NOW - 90 * 86400000; }
  assert.ok(K.sizeOf(d) > K.TRIM_AT);
  const t = K.trimComics(d, NOW);
  assert.ok(K.sizeOf(t) <= K.TRIM_AT, 'size ' + K.sizeOf(t));
  assert.equal(K.finished(t).length, 60);
  assert.equal(K.trimComics(K.emptyComics(), NOW).comics.constructor, Object);
});

// ---- the child-safe check on typed words ---------------------------------------------------------
test('typed words: our list, the comic\'s names and short forms pass', () => {
  assert.ok(checkTyped('The kite flew high!', isKnown).ok);
  assert.ok(checkTyped("Maya's kite can't fly. It's stuck.", isKnown, { extra: ['Maya'] }).ok);
  assert.ok(checkTyped('I have a dog', isKnown).ok);
  assert.ok(checkTyped('Amara and Biscuit', isKnown, { extra: ['Amara', 'Biscuit'] }).ok);
});
test('typed words: unknown, misspelled, blocked or unkind words get the same kind answer', () => {
  const r = checkTyped('My frend flew', isKnown);
  assert.deepEqual([r.ok, r.unknown], [false, ['frend']]);
  assert.equal(typedNote(r), 'We don\'t know the word "frend" yet. Check the spelling, or try another word.');
  for (const w of ['stupid', 'idiot', 'kill', 'hates', 'blockhead', 'xqzt']) {
    const x = checkTyped('You are ' + w, isKnown);
    assert.deepEqual(x.unknown, [w], w);
    assert.match(typedNote(x), /We don't know the word/);
  }
  assert.ok(!isKnown('blockhead'), 'a blocked word is not on the list at all');
  assert.ok(checkTyped('x'.repeat(5), () => true, { max: 4 }).tooLong);
  assert.ok(checkTyped('  ', isKnown).empty);
  assert.equal(typedNote(checkTyped('one two', isKnown, { minWords: 3 }), { minWords: 3 }), 'Write a few more words first.');
  assert.ok(!checkTyped('Kofi ran', () => false).ok, 'with no word list, only the comic\'s own words pass');
});
test('the challenge is free writing: the automatic checks apply, not the filter', () => {
  const v = readFileSync(root('compose/site/js/comic-views.js'), 'utf8');
  const ch = v.slice(v.indexOf('export function challenge'), v.indexOf('export function shelf'));
  assert.match(ch, /C\.autoChecks\(text, t, isReal\)/);
  assert.doesNotMatch(ch, /checkTyped/);
});

// ---- who sees what, and the approve tool ------------------------------------------------------------
test('a comic reaches a child only when the task and its comic are both approved', () => {
  const t = (a, b) => ({ id: 'x', reviewed: a, comic: { reviewed: b } });
  assert.equal(T.comicVisible(t(true, true), 'child'), true);
  assert.equal(T.comicVisible(t(true, false), 'child'), false);
  assert.equal(T.comicVisible(t(false, true), 'child'), false);
  assert.equal(T.comicVisible(t(false, false), 'adult'), true);
  assert.equal(T.comicVisible({ id: 'y', reviewed: true }, 'adult'), false, 'no tiles, no comic');
  T.useComicData({ own: { reviewed: false } }, null);
  assert.deepEqual([T.ownVisible('child'), T.ownVisible('adult')], [false, true]);
  T.useComicData({ own: { reviewed: true } }, null);
  assert.equal(T.ownVisible('child'), true);
  assert.equal(T.approveCommand(['a'], '--comic'), 'node tools/approve-tasks.mjs --comic a');
});
test('the approve tool: --comic and --own set their own flags, and nothing else', () => {
  const dir = mkdtempSync(join(tmpdir(), 'comic-'));
  mkdirSync(join(dir, 'tools'));
  mkdirSync(join(dir, 'compose/site/data'), { recursive: true });
  copyFileSync(root('tools/approve-tasks.mjs'), join(dir, 'tools/approve-tasks.mjs'));
  const f = join(dir, 'compose/site/data/tasks.json');
  const g = join(dir, 'compose/site/data/comic.json');
  writeFileSync(f, JSON.stringify({ tasks: [{ id: 'a', level: 3, title: 'A', reviewed: false, comic: { reviewed: false } }, { id: 'b', level: 3, title: 'B', reviewed: false }] }));
  writeFileSync(g, JSON.stringify({ own: { reviewed: false, speech: ['Hi'] } }));
  const run = (...a) => execFileSync(process.execPath, [join(dir, 'tools/approve-tasks.mjs'), ...a], { stdio: 'pipe' }).toString();
  const read = () => JSON.parse(readFileSync(f, 'utf8')).tasks.map((t) => [t.reviewed, t.comic ? t.comic.reviewed : null]);
  run('--comic', 'a');
  assert.deepEqual(read(), [[false, true], [false, null]]);
  run('--comic', '--off', 'a');
  assert.deepEqual(read(), [[false, false], [false, null]]);
  assert.throws(() => run('--comic', 'b'), 'b has no comic');
  run('--own');
  assert.equal(JSON.parse(readFileSync(g, 'utf8')).own.reviewed, true);
  assert.deepEqual(JSON.parse(readFileSync(g, 'utf8')).own.speech, ['Hi']);
  run('--own', '--off');
  assert.equal(JSON.parse(readFileSync(g, 'utf8')).own.reviewed, false);
  assert.match(run('--list'), /comic waiting/);
});
test('making a comic is a busy page: nothing redraws under it', () => {
  assert.ok(isPlayPath('c/lost-kite/go') && isPlayPath('c/lost-kite/challenge') && isPlayPath('own/w0a1b2c3d4e5f'));
  assert.ok(!isPlayPath('c/lost-kite') && !isPlayPath('comics') && !isPlayPath('own'));
  for (const p of ['c/lost-kite', 'comics', 'comics/w1', 'own', 'own/w1']) assert.ok(isComposePath(p), p);
});
test('the comic pages set no inline styles and keep the word list for typed words only', () => {
  for (const f of ['comic-views.js', 'own-views.js', 'comic-render.js']) {
    const s = readFileSync(root('compose/site/js/' + f), 'utf8');
    assert.doesNotMatch(s, /style="/, f);
    assert.doesNotMatch(s, /\+ (box|v|text)\.value \+|\+ v \+ '</, f + ': typed text never goes into the page unescaped');
  }
});
