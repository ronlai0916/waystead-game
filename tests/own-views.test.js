// SB5 (WP-E): the Word lists pages. The pure wording and rules (lists-doc.js), the sentence maker's states against the fake account,
// and guards on the view sources and the CSS (strict CSP, no :has(), 48 px, no sideways scroll, the bottom band).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as L from '../site/js/lists-doc.js';
import * as I from '../site/js/info-doc.js';
import * as SN from '../site/js/sentences-data.js';
import * as Ow from '../site/js/own-doc.js';

const read = (p) => readFileSync(fileURLToPath(new URL('../' + p, import.meta.url)), 'utf8');
const TODAY = '2026-11-23';

// ---- the card line, for each role -----------------------------------------------------------------------------------
test('card line: parent', () => {
  assert.equal(L.cardLine('parent', {}), 'Not given to anyone yet');
  assert.equal(L.cardLine('parent', { toNames: ['Ada'] }), 'Given for practice to Ada');
  assert.equal(L.cardLine('parent', { toNames: ['Ada', 'Cy'], weeks: [{ name: 'Ada', test: '2026-11-20' }, { name: 'Cy', test: '2026-11-20' }], today: TODAY }), 'Week set for Ada and Cy · tested 20 Nov');
  assert.equal(L.cardLine('parent', { toNames: ['Ada'], weeks: [{ name: 'Ada', test: '2026-11-27' }], today: TODAY }), 'Week set for Ada · test Fri 27 Nov');
});
test('card line: tutor owner line when exactly one learner, else as a parent', () => {
  assert.equal(L.cardLine('tutor', { toNames: ['Ben'] }), 'Ben’s list');
  assert.equal(L.cardLine('tutor', { toNames: ['Ben'], weeks: [{ name: 'Ben', test: '2026-11-27' }], today: TODAY }), 'Ben’s list · week set for Ben');
  assert.equal(L.cardLine('tutor', { toNames: ['Cy'], weeks: [{ name: 'Cy', test: '2026-11-20' }], today: TODAY }), 'Cy’s list · tested 20 Nov');
  assert.equal(L.cardLine('tutor', { toNames: ['Ben', 'Cy'] }), 'Given for practice to Ben and Cy');
  assert.equal(L.cardLine('tutor', {}), 'Not given to anyone yet');
});
test('card line: teacher class week and "Not set yet"', () => {
  assert.equal(L.cardLine('teacher', { toNames: ['A', 'B', 'C', 'D', 'E'], weeks: [{ name: 'A', test: '2026-11-27' }] }), 'Class week: Fri 27 Nov · 5 children');
  assert.equal(L.cardLine('teacher', { toNames: ['A'], weeks: [{ name: 'A', test: '2026-11-27' }] }), 'Class week: Fri 27 Nov · 1 child');
  assert.equal(L.cardLine('teacher', { toNames: ['A'] }), 'Not set yet');
});
test('copyName stays inside the name limit', () => {
  assert.equal(L.copyName('Class 4'), 'Copy of Class 4');
  assert.ok(L.copyName('x'.repeat(60)).length <= Ow.MAX_NAME);
});

// ---- a typed word's row (02b13 to 02b15) -----------------------------------------------------------------------------------
test('sentence states and their lines', () => {
  const st = [{ id: 'a1', s: 'The lighthouse showed ships where the rocks were.' }, { id: 'a2', s: 'We climbed the tall lighthouse at sunset.' }, { id: 'a3', s: 'A light shone from the lighthouse all night.' }];
  assert.equal(L.sentenceState({ status: 'making', statements: [] }, undefined), 'making');
  assert.equal(L.stateLine('making').text, 'Making sentences…');
  assert.equal(L.sentenceState({ status: 'ready', statements: st }, undefined), 'ready');
  assert.equal(L.stateLine('ready', { n: 3 }).text, '3 sentences ready');
  assert.deepEqual(L.stateLine('ready', { n: 3 }).actions.map((a) => a.label), ['See them']);
  assert.equal(L.stateLine('ready', { n: 1 }).text, '1 sentence ready');
  const f = L.stateLine('failed', { word: 'lighthouse' });
  assert.equal(f.text, 'We couldn’t make sentences for lighthouse yet');
  assert.deepEqual(f.actions.map((a) => a.label), ['Try again', 'Write your own']);
  assert.equal(L.sentenceState({ status: 'failed' }, undefined), 'failed');
  assert.equal(L.sentenceState(undefined, undefined), 'none');
  assert.equal(L.stateLine('none').text, 'No sentence yet');
  assert.deepEqual(L.stateLine('none').actions.map((a) => a.label), ['Add one']);
  assert.equal(L.sentenceState(undefined, { s: 'The big tower was tall.' }), 'own');
});
test('03l10: a removed or reported sentence leaves the remaining two, never "Looks good"', () => {
  const st = [{ id: 'a1', s: 'One.' }, { id: 'a2', s: 'Two.' }, { id: 'a3', s: 'Three.' }];
  const gen = { status: 'ready', statements: st };
  let info = L.hideId(undefined, 'lighthouse', 'a2');
  assert.deepEqual(info, { lighthouse: { x: ['a2'] } });
  assert.deepEqual(L.visibleFor(gen, info.lighthouse).map((s) => s.id), ['a1', 'a3']);
  assert.equal(L.sentencesFoot(2), '2 sentences · used as soon as they are ready');
  info = L.hideId(L.hideId(L.hideId(info, 'lighthouse', 'a1'), 'lighthouse', 'a3'), 'lighthouse', 'a3');
  assert.deepEqual(info.lighthouse.x, ['a2', 'a1', 'a3'], 'each id once');
  assert.equal(L.sentenceState(gen, info.lighthouse), 'none', 'all removed: the typing box');
  assert.ok(!/looks good/i.test(read('site/js/own-views.js') + read('site/js/lists-doc.js')));
});
test('x keeps at most 5 ids and the info stays in the 400 byte budget', () => {
  let info;
  for (let i = 0; i < 8; i += 1) info = L.hideId(info, 'lighthouse', 'id' + i);
  assert.equal(info.lighthouse.x.length, 5);
  assert.deepEqual(info.lighthouse.x, ['id3', 'id4', 'id5', 'id6', 'id7']);
  const w = ['lighthouse'];
  assert.equal(L.fitInfo(info, w, () => false).ok, true);
  const big = {};
  const words = [];
  for (let i = 0; i < 8; i += 1) { const word = 'wordly' + 'abcdefgh'[i]; words.push(word); big[word] = { s: 'We saw the ' + word + ' on the old green hill today.' }; }
  const r = L.fitInfo(big, words, () => false);
  assert.equal(r.ok, false);
  assert.equal(r.line, I.LINES.shorter);
  assert.equal(I.MAX_INFO_BYTES, 400);
});
test('editInfo: set, clear and never an empty object', () => {
  let info = L.editInfo(undefined, 'lighthouse', { s: 'The big tower was a lighthouse by the sea.' });
  assert.equal(info.lighthouse.s, 'The big tower was a lighthouse by the sea.');
  info = L.editInfo(info, 'lighthouse', { m: 'a tower with a light' });
  assert.deepEqual(Object.keys(info.lighthouse).sort(), ['m', 's']);
  info = L.editInfo(info, 'lighthouse', { s: '', m: '' });
  assert.equal(info, undefined);
});
test('missingCount counts the typed words with no sentence from anyone', () => {
  const isReady = (w) => w === 'necessary';
  const info = { ptarmigan: { s: 'A ptarmigan is a bird that lives on cold hills.' } };
  assert.equal(L.missingCount(['necessary', 'lighthouse', 'ptarmigan', 'xylo'], { isReady, info, gens: { lighthouse: { status: 'ready', statements: [{ id: 'a', s: 'x' }] } } }), 1);
  assert.equal(I.LINES.noSentence(2), '2 of your own words have no sentences yet.');
});

// ---- the note above the typing box: 03l3, 03l5-03l9 ------------------------------------------------------------------------
test('typing notes, each exactly as designed', () => {
  assert.equal(L.typingNote('', {}), null);
  assert.deepEqual(L.typingNote('off'), { head: 'New sentences are switched off for now.', tail: ' Words already in our bank still work, and you can write your own.' });
  assert.equal(L.typingNote('refused').head, 'We can’t make sentences for that word.');
  assert.match(L.typingNote('refused').tail, /Every sentence has to be safe for children/);
  assert.equal(L.typingNote('offline').head, 'You are offline.');
  assert.match(L.typingNote('offline').tail, /We make sentences when you are back online/);
  assert.match(L.typingNote('x', { online: false }).tail, /You can still write and save this sentence\. It is kept on this phone/);
  const used = L.typingNote('monthly-limit', { left: 0, limit: 60 });
  assert.equal(used.head, 'New sentences are used up this month');
  assert.match(used.tail, /^ \(60 of 60\)\. Words already in our bank still work/);
  assert.deepEqual(L.explain(I.LINES.everyday), { head: I.LINES.everyday, tail: ' Also: 4 to 15 words, at most 90 letters, and no web addresses or @.' });
});

// ---- the maker's answers become a row's state --------------------------------------------------------------------------------
test('answers: ok, partial, writing, refused, failed, problems', () => {
  const st = [{ id: 'a1', s: 'The lighthouse showed ships the way.' }];
  assert.equal(L.genFromItem({ word: 'x', status: 'ok', statements: st }).status, 'ready');
  assert.equal(L.genFromItem({ word: 'x', status: 'partial', statements: st }).status, 'ready');
  assert.equal(L.genFromItem({ word: 'x', status: 'ok', statements: [] }).status, 'failed', 'ok with nothing to show is a failure');
  assert.equal(L.genFromItem({ word: 'x', status: 'writing' }).status, 'making');
  assert.deepEqual(L.genFromItem({ word: 'x', status: 'refused' }), { status: 'none', statements: [], why: 'refused' });
  assert.equal(L.genFromItem({ word: 'x', status: 'failed' }).status, 'failed');
  assert.equal(L.genFromItem(undefined).status, 'failed');
  assert.deepEqual(L.genFromProblem('offline'), { status: 'none', statements: [], why: 'offline' });
  assert.equal(L.genFromProblem('timeout').status, 'failed');
  assert.deepEqual(L.genFromAllowance({ on: false, why: 'monthly-limit', left: 0, limit: 60 }), { status: 'none', statements: [], why: 'monthly-limit', left: 0, limit: 60 });
});
test('the maker is OFF by default: no request is made and the answer is "off"', async () => {
  assert.equal(SN.SENTENCES_API, false);
  let calls = 0;
  const c = SN.createSentences({ origin: 'https://account.example', fetch: async () => { calls += 1; throw new Error('no'); } });
  assert.deepEqual(await c.allowance(), { on: false, why: 'off' });
  assert.equal((await c.askFor(['lighthouse'])).problem, 'off');
  assert.equal(c.off, true);
  assert.equal(calls, 0);
});
test('with the switch on: a word with 3 statements is "ready" and a report goes to the report route', async () => {
  const seen = [];
  const json = (status, body) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => body });
  const c = SN.createSentences({ origin: 'https://account.example', enabled: true, fetch: async (url, init) => {
    seen.push(init.method + ' ' + url.replace('https://account.example', ''));
    if (url.endsWith('/allowance')) return json(200, { on: true, left: 50, limit: 60, hourLeft: 20, paused: false });
    if (url.endsWith('/report')) return { ok: true, status: 204, headers: { get: () => null }, json: async () => null };
    return json(200, { items: [{ word: 'lighthouse', status: 'ok', statements: [{ id: 'a1', s: 'The lighthouse showed ships where the rocks were.' }, { id: 'a2', s: 'We climbed the tall lighthouse at sunset.' }, { id: 'a3', s: 'A light shone from the lighthouse all night.' }] }], left: 49 });
  } });
  assert.equal((await c.allowance()).on, true);
  const r = await c.askFor(['lighthouse']);
  assert.equal(L.genFromItem(r.items[0]).statements.length, 3);
  assert.deepEqual(await c.report('a2'), { ok: true });
  assert.deepEqual(seen, ['GET /api/sentences/allowance', 'POST /api/sentences', 'POST /api/sentences/report']);
});

// ---- results head ---------------------------------------------------------------------------------------------------------
test('results head lines', () => {
  assert.equal(L.resultsHead('teacher', { n: 15, names: ['A', 'B', 'C', 'D', 'E'], test: '2026-11-20' }), '15 words · class week, test Fri 20 Nov · 5 children');
  assert.equal(L.resultsHead('parent', { n: 15, names: ['Ada', 'Cy'] }), '15 words · given for practice to Ada and Cy');
  assert.equal(L.resultsHead('parent', { n: 1, names: [] }), '1 word · not given for practice yet');
});

// ---- the sources ---------------------------------------------------------------------------------------------------------
const VIEWS = ['site/js/own-views.js', 'site/js/results-views.js', 'site/js/scan-views.js', 'site/js/lists-doc.js'];
test('no inline style, no script, no :has, no storage of a child in the views', () => {
  for (const f of VIEWS) assert.doesNotMatch(read(f), /style="|<script|setAttribute\('style'|\.style\./, f);
  assert.doesNotMatch(read('site/css/lists.css').replace(/\/\*[\s\S]*?\*\//g, ''), /:has\(|style=/);
  assert.doesNotMatch(read('site/js/results-views.js'), /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(read('site/js/lists-doc.js').replace(/\/\/.*$/gm, ''), /\b(document|window|fetch|localStorage|sessionStorage)\b|Date\.now|new Date\(\)|Math\.random/, 'pure');
});
test('Set a week and Results go to the SB5 routes; no old dialog, no hand-off', () => {
  const ov = read('site/js/own-views.js');
  assert.match(ov, /href="#\/grownups\/set\/list\/'/);
  assert.match(ov, /\/results" data-results-link/);
  assert.doesNotMatch(ov, /useForWeek|givePlanWords|Pick ' \+ W\.MAX_WORDS/);
  const sv = read('site/js/scan-views.js');
  assert.match(sv, /Set a week with this list/);
  assert.match(sv, /DONE = \{[^}]*more: Sc\.MORE_BUTTON/); // S3-D10: the button's words come from scan-doc, once
  assert.match(sv, /#\/grownups\/set\/list\//);
  assert.match(sv, /\/results" data-results/);
  assert.doesNotMatch(sv, /grownups\/teach/);
});
test('the library: Copy for a learner is the tutor\'s, Set the class week is the teacher\'s', () => {
  const ov = read('site/js/own-views.js');
  assert.match(ov, /role === 'tutor' \? '<button type="button" class="btn btn--ghost" data-copy=/);
  assert.match(ov, /RD\.WORDS\[role\]\.set/);
  assert.match(read('site/js/results-views.js'), /Print for the class/);
});
test('the editor never asks the server for a word when the maker is off, and reads the ready-made bank from our own site', () => {
  const ov = read('site/js/own-views.js');
  assert.match(ov, /if \(S2\.off \|\| navigator\.onLine === false\)/);
  assert.match(ov, /fetch\('data\/statements\.json'\)/);
  assert.doesNotMatch(ov, /\/api\/sentences/);
});
test('lists.css: every rule is under .ls, targets are 48 px, the bar clears the bottom band, nothing scrolls sideways', () => {
  const css = read('site/css/lists.css').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const chunk of css.split('}')) {
    const sel = chunk.split('{')[0].trim();
    if (!sel || sel.startsWith('@')) continue;
    for (const s of sel.split(',').map((x) => x.trim())) assert.match(s, /^(\.ls|\.ls-)/, s);
  }
  assert.match(css, /--safe-zone: var\(--bottom-reserve\)/);
  assert.match(css, /\.ls \.ls-bar \{[^}]*bottom: var\(--safe-zone\)/);
  for (const k of ['.ls-tab', '.ls-chip', '.ls-sug__b']) assert.match(css, new RegExp('\\' + k + ' \\{[^}]*min-height: 48px'));
  assert.doesNotMatch(css, /overflow-x:\s*scroll|width:\s*\d{4,}px/);
});
