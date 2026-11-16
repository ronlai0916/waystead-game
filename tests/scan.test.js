// SB4-WP8 stage 1: scanning a paper. Pure rules and the account calls (fake fetch). Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../site/js/scan-doc.js';
import * as D from '../site/js/scan-data.js';
import * as Od from '../site/js/own-data.js';
const OWN_30 = Od.OWN_30;

test('isOn: only a 200 with on exactly true', () => {
  assert.equal(S.isOn({ ok: true, status: 200, data: { on: true, left: 20 } }), true);
  assert.equal(S.isOn({ ok: true, status: 200, data: { on: false } }), false);
  assert.equal(S.isOn({ ok: true, status: 200, data: {} }), false);
  assert.equal(S.isOn({ ok: true, status: 200, data: { on: 'true' } }), false);
  assert.equal(S.isOn({ ok: false, status: 404, data: { error: 'not-found' } }), false);
  assert.equal(S.isOn({ ok: false, status: 0, data: null }), false);
  assert.equal(S.isOn({ ok: true, status: 200, data: null }), false, 'HTML');
  assert.equal(S.isOn(null), false);
  assert.equal(S.isOn(undefined), false);
});

test('clean: never trusts the answer', () => {
  assert.deepEqual(S.clean(null), { problem: 'read-failed' });
  assert.deepEqual(S.clean('<html>'), { problem: 'read-failed' });
  assert.deepEqual(S.clean({}), { problem: 'read-failed' });
  assert.deepEqual(S.clean({ words: 'cat' }), { problem: 'read-failed' });
  assert.deepEqual(S.clean({ words: [] }), { problem: 'no-words' });
  assert.deepEqual(S.clean({ words: [1, 2, null, {}] }), { problem: 'no-words' });
  assert.deepEqual(S.clean({ words: ['cat', 7, 'dog'] }), { words: ['cat', 'dog'] });
  assert.deepEqual(S.clean({ words: ['ca<t', '1cat', '', ' cat', 'a'.repeat(26), 'a'.repeat(25), "it's", 'well-known', '-x'] }), { words: ['a'.repeat(25), "it's", 'well-known'] });
  assert.deepEqual(S.clean({ words: ['Cat', 'cat', 'CAT', 'dog'] }), { words: ['Cat', 'dog'] });
  const many = Array.from({ length: 41 }, (_, i) => 'w' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26)));
  assert.equal(S.clean({ words: many }).words.length, 40);
});

test('sortFound: names are masked, the limit counts usable words, one line for unknown and blocked', () => {
  const checks = { friend: true, because: true, island: true };
  const r = S.sortFound(['friend', 'Robin', 'zzqx', "can't", 'because'], checks);
  assert.deepEqual(r.use, ['friend', 'because']);
  const robin = r.out.find((o) => o.word === 'Robin');
  assert.equal(robin.shown, 'R.....');
  assert.equal(robin.reason, 'Looks like a name');
  assert.equal(r.out.find((o) => o.word === 'zzqx').reason, 'We can\'t use this word yet');
  assert.equal(r.out.find((o) => o.word === "can't").reason, 'We can\'t use this word yet');
  assert.equal(S.sortFound(['well-known'], { 'well-known': true }).out[0].reason, 'We can\'t use this word yet');
  // a capitalised word is offered only when it is a curriculum word (known) or in KEEP_CAPITAL
  const all5 = { february: true, monday: true, mrs: true, i: true, christmas: true };
  assert.deepEqual(S.sortFound(['February', 'Monday', 'Mrs', 'I', 'Christmas'], all5, 15, { february: true }).use, ['february', 'Monday', 'Mrs', 'I', 'Christmas']);
  assert.equal(S.sortFound(['February'], all5).out[0].reason, 'Looks like a name', 'not known and not kept: masked');
  // blocked (never on the lists) and unknown give the same line
  assert.equal(S.sortFound(['blockedword'], {}).out[0].reason, S.sortFound(['nonsense'], {}).out[0].reason);
  const words = Array.from({ length: 16 }, (_, i) => 'w' + 'abcdefghijklmnop'[i]);
  const all = Object.fromEntries(words.map((w) => [w, true]));
  const big = S.sortFound(words, all);
  assert.equal(big.use.length, 15);
  assert.deepEqual(big.out, [{ word: 'wp', shown: 'wp', reason: 'For the next chapter' }]);
  assert.equal(S.sortFound(words, all, 3).use.length, 3);
});

test('sortFound: names with an apostrophe or hyphen are masked; the checks cannot be fooled', () => {
  for (const w of ["Robin's", 'Mary-Jane', "O'Neil", 'Robin']) {
    const o = S.sortFound([w], {}).out[0];
    assert.notEqual(o.shown, w);
    assert.equal(o.shown, w[0] + '.....');
    assert.equal(o.reason, 'Looks like a name');
  }
  assert.equal(S.sortFound(["can't", 'well-known'], {}).out.every((o) => o.reason === 'We can\'t use this word yet'), true);
  assert.deepEqual(S.sortFound(['constructor', 'Constructor', 'toString', '__proto__'], {}).use, []);
  assert.deepEqual(S.sortFound(['constructor'], {}).use, []);
  assert.deepEqual(S.sortFound(['cat'], { cat: 'yes' }).use, [], 'only true counts');
});

test('a caller abort is not offline', () => {
  assert.equal(S.problemOf({ ok: false, status: 0, data: null, aborted: true }), 'cancelled');
  assert.deepEqual(S.problemLine('cancelled'), { line: 'Stopped. Your photo is still here.', button: 'Try again', button2: 'Take another photo' });
});

test('small guards: reset day, numeric strings, empty day label', () => {
  assert.match(S.problemLine('monthly', { resetsOn: '2026-12-00' }).line, /the 1st of next month/);
  assert.match(S.problemLine('monthly', { resetsOn: '2026-12-32' }).line, /the 1st of next month/);
  assert.equal(S.leftLine('18'), 'You have 18 scans left this month.');
  });

test('problemOf: a key for every status', () => {
  const p = S.problemOf;
  assert.equal(p({ ok: false, status: 0, data: null }), 'offline');
  assert.equal(p({ ok: false, status: 0, data: null, timedOut: true }), 'timeout');
  assert.equal(p({ status: 401 }), 'signed-out');
  assert.equal(p({ status: 403, data: { error: 'adult-session-required' } }), 'playing');
  assert.equal(p({ status: 404 }), 'off');
  assert.equal(p({ status: 412, data: { error: 'consent-required' } }), 'consent');
  assert.equal(p({ status: 413 }), 'too-large');
  assert.equal(p({ status: 415 }), 'too-large');
  assert.equal(p({ status: 429, data: { error: 'hourly-limit' } }), 'hourly');
  assert.equal(p({ status: 429, data: { error: 'monthly-limit' } }), 'monthly');
  assert.equal(p({ status: 503, data: { error: 'scan-paused' } }), 'paused');
  assert.equal(p({ status: 502, data: { error: 'read-failed' } }), 'failed');
  assert.equal(p({ status: 500, data: null }), 'failed');
  assert.equal(p({ ok: true, status: 200, data: { words: [] } }), null);
});

test('copy: every key has its exact line and button (HF check of 16 Nov, section 5, then the HF scan review section 6)', () => {
  const c = (k, i) => S.problemLine(k, i);
  assert.deepEqual(c('offline'), { line: 'You\'re offline. Connect to the internet and try again.', button: 'Try again' });
  for (const k of ['timeout', 'failed', 'read-failed']) assert.deepEqual(c(k), { line: 'That didn\'t work this time.', button: 'Try again' });
  assert.deepEqual(c('no-words'), { line: 'We couldn\'t find any words. Try a flatter photo in better light, or a printed list.', button: 'Take another photo' });
  assert.deepEqual(c('too-large'), { line: 'That photo is too big. Try a closer photo of just the list.', button: 'Take another photo' });
  assert.deepEqual(c('unreadable'), { line: 'We couldn\'t open that photo. Try a different photo, or a screenshot of the list.', button: 'Take another photo' });
  assert.equal(c('hourly', { time: '4:52pm' }).line, 'You\'ve done 5 scans in the last hour. You can scan again at 4:52pm.');
  assert.equal(c('hourly', {}).line, 'You\'ve done 5 scans in the last hour. You can scan again within the hour.');
  assert.equal(c('hourly', { time: 'soon' }).line, 'You\'ve done 5 scans in the last hour. You can scan again within the hour.', 'a time that is not a clock time is ignored');
  assert.equal(c('hourly', {}).button, null);
  assert.deepEqual(c('paused'), { line: 'Scanning isn\'t working right now. You can type the words instead.', button: null });
  assert.deepEqual(c('off'), { line: 'Scanning isn\'t available yet.', button: null });
  assert.equal(c('own-full').line, OWN_30);
  assert.equal(c('own-full').noType, true);
  assert.equal(c('playing'), null);
  assert.equal(S.TYPE_INSTEAD, 'Type the words instead');
  assert.equal(S.anotherPhoto(false), 'Take another photo');
  assert.equal(S.anotherPhoto(true), 'Choose another photo');
});

test('the monthly line takes its date from the answer', () => {
  assert.equal(S.problemLine('monthly', { resetsOn: '2026-12-01' }).line, 'No scans left this month. They come back on 1 December.');
  assert.equal(S.problemLine('monthly', { resetsOn: '2027-01-01' }).line, 'No scans left this month. They come back on 1 January.');
  assert.match(S.problemLine('monthly', { resetsOn: 'junk' }).line, /They come back on the 1st of next month\.$/);
});

test('shrinkPlan: 1600 at 0.85, 1600 at 0.7, 1280 at 0.7, never enlarges', () => {
  assert.deepEqual(S.shrinkPlan(4000, 3000), [
    { width: 1600, height: 1200, quality: 0.85 }, { width: 1600, height: 1200, quality: 0.7 }, { width: 1280, height: 960, quality: 0.7 }]);
  assert.deepEqual(S.shrinkPlan(3000, 4000)[0], { width: 1200, height: 1600, quality: 0.85 });
  assert.deepEqual(S.shrinkPlan(800, 600).map((s) => [s.width, s.height]), [[800, 600], [800, 600], [800, 600]]);
  assert.equal(S.AFTER_PLAN, 'too-large');
  assert.equal(S.shrinkPlan(0, 0)[0].width, 1);
});

test('leftLine, consent text (defaultName is own-data\'s: scan-doc has none)', () => {
  assert.equal(S.leftLine(18), 'You have 18 scans left this month.');
  assert.equal(S.leftLine(1), 'You have 1 scan left this month.');
  assert.equal(S.leftLine(20), 'You have 20 scans left this month.');
  assert.equal(S.defaultName, undefined);
  assert.equal(S.SCAN_VENDOR, '');
  assert.equal(S.PRIVACY_HREF, '');
  assert.equal(S.consentText().send, 'We send the photo to an AI service to read the words. Waystead does not keep the photo: we only save the words you tick.');
  assert.match(S.consentText('Acme').send, /^We send the photo to Acme, an AI service, to read the words\./);
  assert.equal(S.consentText().cover, 'Cover names before you take the photo, or use a list with no names on it.');
});

test('scan-doc.js is pure and the wording avoids banned words', () => {
  const files = ['scan-doc.js', 'scan-data.js'];
  const src = Object.fromEntries(files.map((f) => [f, readSrc(f)]));
  assert.doesNotMatch(src['scan-doc.js'], /\b(document|window|localStorage|sessionStorage|Date|Math\.random)\b|fetch\(/);
  const strings = [];
  const walk = (v) => { if (typeof v === 'string') strings.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(S.PROBLEM_COPY); walk(S.REASON); walk(S.consentText('Acme'));
  strings.push(S.leftLine(3), S.TYPE_INSTEAD, S.problemLine('monthly', { resetsOn: '2026-12-01' }).line);
  for (const s of strings) {
    assert.doesNotMatch(s, /\b(SEN|profile|mode|doc|sync|toggle|scaffold|OCR|AI model|input method)\b/i, s);
    assert.doesNotMatch(s, /\b(wrong|fail|failed|incorrect|mistake|late|lost|error)\b|×/i, s);
  }
});

import { readFileSync } from 'node:fs';
function readSrc(f) { return readFileSync(new URL('../site/js/' + f, import.meta.url), 'utf8'); }

// A fake fetch: records what was asked and answers as told.
function fakeFetch(answer) {
  const calls = [];
  const f = (url, init) => { calls.push({ url, init }); return answer(url, init); };
  f.calls = calls;
  return f;
}
const res = (status, body, raw) => ({ ok: status >= 200 && status < 300, status, json: async () => { if (raw) throw new Error('not json'); return body; } });

test('scan-data: credentials, cors, no-store, the raw body and its type', async () => {
  const real = globalThis.fetch;
  try {
    const f = fakeFetch(() => res(200, { on: true }));
    globalThis.fetch = f;
    const a = await D.allowance('https://account.example/');
    assert.deepEqual(a, { ok: true, status: 200, data: { on: true } });
    assert.equal(f.calls[0].url, 'https://account.example/api/scan/allowance');
    for (const k of ['credentials', 'mode', 'cache']) assert.ok(f.calls[0].init[k]);
    assert.equal(f.calls[0].init.credentials, 'include');
    assert.equal(f.calls[0].init.mode, 'cors');
    assert.equal(f.calls[0].init.cache, 'no-store');

    await D.consent('https://account.example', 'v1');
    assert.equal(f.calls[1].init.method, 'POST');
    assert.equal(f.calls[1].init.body, '{"version":"v1"}');
    assert.equal(f.calls[1].init.credentials, 'include');

    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    await D.scanWords('https://account.example', blob);
    const w = f.calls[2];
    assert.equal(w.url, 'https://account.example/api/scan/words');
    assert.equal(w.init.method, 'POST');
    assert.equal(w.init.body, blob, 'the blob itself');
    assert.equal(w.init.headers['Content-Type'], 'image/jpeg');
    assert.equal(w.init.credentials, 'include');
  } finally { globalThis.fetch = real; }
});

test('scan-data: non-JSON gives data null, a network error gives status 0, a caller abort is marked aborted', async () => {
  const real = globalThis.fetch;
  try {
    globalThis.fetch = fakeFetch(() => res(200, null, true));
    assert.deepEqual(await D.allowance('x'), { ok: true, status: 200, data: null });
    globalThis.fetch = fakeFetch(() => res(502, { error: 'read-failed' }));
    assert.deepEqual(await D.scanWords('x', new Blob([])), { ok: false, status: 502, data: { error: 'read-failed' } });
    globalThis.fetch = fakeFetch(() => { throw new TypeError('Failed to fetch'); });
    assert.deepEqual(await D.allowance('x'), { ok: false, status: 0, data: null });
    globalThis.fetch = fakeFetch((u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))));
    const ctl = new AbortController();
    const p = D.scanWords('x', new Blob([]), { signal: ctl.signal });
    ctl.abort();
    assert.deepEqual(await p, { ok: false, status: 0, data: null, aborted: true });
  } finally { globalThis.fetch = real; }
});

test('scan-data: the 30 second timer ends the call with timedOut', async (t) => {
  const real = globalThis.fetch;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  try {
    globalThis.fetch = fakeFetch((u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))));
    const p = D.scanWords('x', new Blob([]));
    t.mock.timers.tick(29999);
    let done = false;
    p.then(() => { done = true; });
    await Promise.resolve();
    assert.equal(done, false);
    t.mock.timers.tick(1);
    const r = await p;
    assert.deepEqual(r, { ok: false, status: 0, data: null, timedOut: true });
    assert.equal(S.problemOf(r), 'timeout');
  } finally { globalThis.fetch = real; }
});

// ================================================================= SB4-WP8 stage 2 (the screens) =================================================================
import { OWN_REFUSED, OWN_REPEAT, savedLine } from '../site/js/own-data.js';

test('REASON.cant is the same string as the typed editor\'s OWN_REFUSED, and the other reasons', () => {
  assert.equal(S.REASON.cant, OWN_REFUSED);
  assert.equal(S.REASON.cant, 'We can\'t use this word yet');
  assert.equal(S.REASON.name, 'Looks like a name');
  assert.equal(S.REASON.over, 'For the next chapter');
  assert.equal(OWN_REPEAT, 'Already in the list');
});

test('the capital rule: a name is masked even when it is a dictionary word; a curriculum word or KEEP_CAPITAL stays', () => {
  const inList = (ws) => Object.fromEntries(ws.map((w) => [w.toLowerCase(), true]));
  const found = ['Rose', 'Jack', 'Grace', 'Robin', 'February', 'Wednesday', 'Mr', 'friend', 'Tuesday'];
  const checks = inList(found); // every one of them is "on the lists", as a dictionary would have them
  const known = { february: true, friend: true }; // the curriculum
  const r = S.sortFound(found, checks, 40, known);
  assert.deepEqual(r.use, ['february', 'Wednesday', 'Mr', 'friend', 'Tuesday']);
  assert.deepEqual(r.out.map((o) => o.shown), ['R.....', 'J.....', 'G.....', 'R.....']);
  assert.ok(r.out.every((o) => o.reason === 'Looks like a name'));
  for (const o of r.out) assert.equal(o.shown.length, 6, 'one length for every name: the length is never a clue');
  assert.deepEqual([...S.KEEP_CAPITAL].sort(), ['Christmas', 'Friday', 'I', 'Monday', 'Mr', 'Mrs', 'Saturday', 'Sunday', 'Thursday', 'Tuesday', 'Wednesday']);
  assert.deepEqual(S.sortFound(['rose'], { rose: true }, 40, {}).use, ['rose'], 'the lower-case spelling is fine');
  assert.deepEqual(S.sortFound(['Constructor'], { constructor: true }, 40, {}).use, [], 'prototype keys cannot be known');
  assert.equal(S.manyNames(10, 6), true);
  assert.equal(S.manyNames(10, 5), false, 'exactly half is not more than half');
  assert.equal(S.manyNames(0, 0), false);
  assert.equal(S.MANY_NAMES, 'Many words start with a capital letter, so we left them out in case they are names. Add them with Add a word.');
});

test('consent wording: Waystead does not keep the photo', () => {
  const c = S.consentText();
  assert.equal(c.heading, 'Before you scan');
  assert.equal(c.names, 'School papers often show a child\'s name, class or school.');
  assert.equal(c.tip, 'Printed lists work best. Handwriting is often misread.');
  assert.equal(c.go, 'I understand, scan a paper');
  assert.doesNotMatch(c.send, /is not kept/);
});

test('the hand-off: read once, filtered, capped at 15, only for the page it names', () => {
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const many = Array.from({ length: 20 }, (_, i) => 'word' + String.fromCharCode(97 + i));
  assert.equal(D.giveScanWords(storage, 'editor', ['island', 'o\'clock', '1bad', 'a'.repeat(26), 'x y', 7, ...many]), true);
  const raw = JSON.parse(store.get('sb.scanWords'));
  assert.equal(raw.to, 'editor');
  assert.equal(raw.words.length, 15);
  assert.deepEqual(raw.words.slice(0, 2), ['island', 'o\'clock']);
  assert.ok(raw.words.every((w) => /^[A-Za-z][A-Za-z']{0,24}$/.test(w)));
  assert.equal(D.takeScanWords(storage, 'scan'), null, 'another page gets nothing');
  assert.equal(store.has('sb.scanWords'), false, 'and the key is gone whatever it held');
  D.giveScanWords(storage, 'editor', ['island', 'because']);
  assert.deepEqual(D.takeScanWords(storage, 'editor'), ['island', 'because']);
  assert.equal(D.takeScanWords(storage, 'editor'), null, 'read once');
  store.set('sb.scanWords', '{not json');
  assert.equal(D.takeScanWords(storage, 'editor'), null);
  assert.equal(store.has('sb.scanWords'), false);
  store.set('sb.scanWords', JSON.stringify({ to: 'editor', words: ['<script>', 3, ''] }));
  assert.equal(D.takeScanWords(storage, 'editor'), null);
  assert.equal(D.giveScanWords(storage, 'scan', []), false, 'nothing to carry: nothing stored');
  assert.equal(store.has('sb.scanWords'), false);
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(D.giveScanWords(broken, 'scan', ['island']), false);
  assert.equal(D.takeScanWords(broken, 'scan'), null);
});

test('scan-data: Retry-After on a 429 comes back as seconds', async () => {
  const real = globalThis.fetch;
  try {
    globalThis.fetch = fakeFetch(() => ({ ok: false, status: 429, headers: { get: (k) => (k === 'Retry-After' ? '1800' : null) }, json: async () => ({ error: 'hourly-limit' }) }));
    const r = await D.scanWords('x', new Blob([]));
    assert.equal(r.retryAfter, 1800);
    assert.equal(S.problemOf(r), 'hourly');
    globalThis.fetch = fakeFetch(() => ({ ok: false, status: 429, headers: { get: () => 'Wed, 21 Oct 2026 07:28:00 GMT' }, json: async () => ({ error: 'hourly-limit' }) }));
    assert.equal((await D.scanWords('x', new Blob([]))).retryAfter, undefined, 'a date is not a number of seconds');
    globalThis.fetch = fakeFetch(() => ({ ok: false, status: 429, headers: { get: () => '9000' }, json: async () => ({ error: 'hourly-limit' }) }));
    assert.equal((await D.scanWords('x', new Blob([]))).retryAfter, undefined, 'over 7200 s is dropped, not capped: no invented time');
  } finally { globalThis.fetch = real; }
});

test('scan-data: dropScanWords removes only a hand-off written for that page', () => {
  const store = {};
  const storage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  D.giveScanWords(storage, 'scan', ['island']);
  D.dropScanWords(storage, 'editor');
  assert.notEqual(storage.getItem('sb.scanWords'), null, 'words for the editor page are not dropped by the scan page');
  D.dropScanWords(storage, 'scan');
  assert.equal(storage.getItem('sb.scanWords'), null);
  D.dropScanWords(storage, 'scan'); // nothing there: no error
});

test('sortFound: a weekday is offered with its capital (typed or scanned, any case); month names are not kept', () => {
  const r = S.sortFound(['Wednesday', 'monday', 'FRIDAY'], { wednesday: true, monday: true, friday: true }, 40, {});
  assert.deepEqual(r.use, ['Wednesday', 'Monday', 'Friday']);
  assert.equal(r.out.length, 0, 'never called a name');
  assert.equal(S.sortFound(['Wednesday'], {}, 40, {}).out[0].reason, S.REASON.cant, 'only if the shared word check says yes');
  assert.equal(S.KEEP_CAPITAL.has('April'), false, 'month names are given names too: never in KEEP_CAPITAL');
  assert.equal(S.sortFound(['April'], { april: true }, 40, {}).out[0].reason, S.REASON.name);
});

test('wordcheck: a weekday is usable in any case and saved with its capital, with no word list; a month is not special', async () => {
  const WC = await import('../site/js/wordcheck.js');
  const none = () => null;
  for (const raw of ['Wednesday', 'wednesday', 'WEDNESDAY', ' sunday ']) assert.equal(WC.usableWord(raw, { findEntry: none, inList: () => false }), raw.trim().toLowerCase() === 'sunday' ? 'Sunday' : 'Wednesday');
  assert.equal((await WC.checkTyped('tuesday', none)).word, 'Tuesday');
  assert.equal(WC.usableWord('april', { findEntry: none, inList: () => false }), null);
  assert.equal(WC.weekdayForm('Mondays'), null);
});

test('manyNames: more than half of ALL the found words', () => {
  assert.equal(S.manyNames(16, 6), false, '6 of 16 found is not more than half');
  assert.equal(S.manyNames(10, 6), true);
});

test('clockTime: local, lower-case am and pm', () => {
  assert.equal(S.clockTime(16, 52), '4:52pm');
  assert.equal(S.clockTime(0, 5), '12:05am');
  assert.equal(S.clockTime(12, 0), '12:00pm');
  assert.equal(S.clockTime(9, 7), '9:07am');
});

test('lines for the check, the count and the second chapter', () => {
  assert.equal(S.foundLine(14), 'We found 14 words. Untick any you don\'t want.');
  assert.equal(S.foundMore(28), 'We found 28 words. A chapter holds 15. Tick up to 15 now. You can save the other 13 as a second chapter next, without scanning again.');
  assert.equal(S.otherLede(13), 'Here are the other 13 words. Untick any you don\'t want.');
  assert.equal(S.otherLede(1), 'Here are the other 1 word. Untick any you don\'t want.');
  assert.equal(S.leftOutHead(3), 'We left these out (3)');
  assert.equal(S.tickedLine(14), '14 of 15 words');
  assert.equal(S.tickedLine(16), '16 ticked. A chapter holds 15.');
  assert.equal(S.limitReason(16), 'Untick 1 word to go on. You can save unticked words as another chapter next.');
  assert.equal(S.limitReason(18), 'Untick 3 words to go on. You can save unticked words as another chapter next.');
  assert.equal(S.limitReason(0), 'Tick at least one word.');
  assert.equal(S.limitReason(7), '');
  assert.equal(S.moreButton(1, 13), 'Make a second chapter with the other 13 words');
  assert.equal(S.moreButton(2, 10), 'Make a third chapter with the other 10 words');
  assert.equal(S.moreButton(3, 4), 'Make another chapter with the other 4 words');
  assert.equal(S.moreButton(1, 1), 'Make a second chapter with the other 1 word');
  assert.equal(S.nextName('School words, 16 Nov', 2), 'School words, 16 Nov (2)');
  assert.ok(S.nextName('x'.repeat(40), 3).length <= 40);
  assert.ok(S.nextName('x'.repeat(40), 3).endsWith(' (3)'));
  assert.equal(S.SIGNED_OUT_KEPT, 'We\'ll keep the words you ticked.');
  assert.equal(S.SIGNED_OUT_AGAIN, 'After you sign in, take or choose the photo again.');
  assert.equal(S.T.leaveTitle, 'Leave without saving?');
  assert.equal(S.T.leaveBody, 'The words you ticked won\'t be kept.');
  assert.equal(S.T.addedToList, 'Added to the list.');
  assert.equal(S.T.limits, 'A long list can become up to 3 chapters from one photo.');
  assert.equal(S.T.savedTitle, 'Chapter saved');
  assert.equal(S.T.results, 'See results and set the test');
});

test('the saved line names only the children it reached (the typed editor and the scan Done screen)', () => {
  assert.equal(S.savedLineFor(2, ['Robin', 'Wren'], savedLine), 'Saved. Robin and Wren can find it under \'From your grown-up\'.');
  const one = S.savedLineFor(2, ['Robin'], savedLine);
  assert.equal(one, 'Saved. Robin can find it under \'From your grown-up\'.');
  assert.doesNotMatch(one, /Wren/);
  assert.equal(S.savedLineFor(2, [], savedLine), 'Saved.', 'shared with some, reached none');
  assert.equal(S.savedLineFor(0, [], savedLine), 'Saved. Share it with a child so they can find it under \'From your grown-up\'.');
  assert.match(readSrc('own-views.js'), /Sc\.savedLineFor\(saved\.shared, saved\.names, D\.savedLine\)/);
  assert.match(readSrc('own-views.js'), /kidsFor\(\)\.filter\(\(k\) => !r\.notSent\.includes\(k\.id\)\)/);
  assert.match(readSrc('scan-views.js'), /Sc\.savedLineFor\(sharedKids\.length, reached, D\.savedLine\)/);
});

test('the Scan link is drawn only after the account says on: true', async () => {
  const real = globalThis.fetch;
  const ask = async (answer) => { globalThis.fetch = fakeFetch(answer); return S.isOn(await D.allowance('https://account.example')); };
  try {
    assert.equal(await ask(() => res(404, { error: 'not-found' })), false, '404');
    assert.equal(await ask(() => res(200, { on: false, left: 20 })), false, 'on: false');
    assert.equal(await ask(() => res(200, null, true)), false, 'HTML');
    assert.equal(await ask(() => { throw new TypeError('Failed to fetch'); }), false, 'network error');
    assert.equal(await ask(() => res(200, { left: 20 })), false, 'on missing');
    assert.equal(await ask(() => res(200, { on: true, left: 20 })), true);
  } finally { globalThis.fetch = real; }
  const ov = readSrc('own-views.js');
  assert.match(ov, /const scanIsOn = async \(\) => Sc\.isOn\(await SD\.allowance\(accountOrigin\(location\)\)\);/);
  assert.match(ov, /scanOn\s+\? '<div class="s-btns" data-scan-links>/);
  assert.match(ov, /\(scanOn \? '<p class="gu-ownlink" data-scan-link>/);
  assert.equal((ov.match(/href="#\/grownups\/scan"/g) || []).length, 2, 'the list and the editor, nowhere else');
  assert.match(ov, /editing \? false : scanIsOn\(\)/, 'an existing chapter gets no link and no call');
  assert.match(ov, /export function list\(main\) \{\n  if \(!adultOnly\(main\)\) return undefined;/, 'a child session stops before any call');
  const sv = readSrc('scan-views.js');
  assert.match(sv, /export function scan\(main\) \{[^]*?if \(!offlineNow && !adultOnly\(main\)\) return undefined;/, 'the grown-up guard comes first (offline, who is here cannot be asked, so the offline line is drawn)');
  assert.ok(sv.indexOf('adultOnly(main)') < sv.indexOf('SD.allowance('), 'no allowance request before the guard');
});

test('scan-views.js: no inline style, no script, no image, no object URL, no storage of the photo, nothing logged', () => {
  const v = readSrc('scan-views.js');
  for (const bad of ['style="', '<script', '<img', 'createObjectURL', 'localStorage', 'console.', 'FileReader', 'toDataURL']) assert.equal(v.includes(bad), false, bad);
  assert.doesNotMatch(v, /\.setItem\([^)]*(blob|photo)/i);
  assert.match(v, /document\.createElement\('canvas'\); \/\/ never added to the page/);
  assert.doesNotMatch(v, /appendChild\(canvas\)/);
  assert.match(v, /imageOrientation: 'from-image'/);
  assert.doesNotMatch(readSrc('scan-doc.js'), /style="|<script/);
});

test('grown-up copy: no banned word, no failure word, sentences of 20 words or fewer, British spelling', () => {
  const strings = [];
  for (const f of ['scan-doc.js', 'scan-views.js']) {
    for (const m of readSrc(f).matchAll(/'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) strings.push((m[1] ?? m[2]).replace(/\\'/g, '\''));
  }
  const prose = strings.map((x) => x.replace(/<[^>]*>/g, ' ').replace(/\$\{[^}]*\}/g, ' ').trim()).filter((x) => /\s/.test(x) && /[A-Za-z]{3}/.test(x) && !/="|^[\s"]/.test(x)); // markup fragments are not sentences
  assert.ok(prose.length > 30, 'found the copy: ' + prose.length);
  for (const s of prose) {
    assert.doesNotMatch(s, /\b(SEN|profile|mode|level [1-5]|doc|sync|toggle|scaffold|input method|OCR|AI model)\b/, s);
    assert.doesNotMatch(s, /\b(wrong|fail|failed|incorrect|mistake|late|lost|error|invalid)\b|×/i, s);
    assert.doesNotMatch(s, /(?<![-_.#\w])(color|gray|practicing|favorite|center)(?![-_\w])/i, s);
    for (const sentence of s.split(/(?<=[.!?])\s+/)) if (/^[A-Z]/.test(sentence)) assert.ok(sentence.split(/\s+/).length <= 20, sentence);
  }
  const all = JSON.stringify([S.T, S.PROBLEM_COPY, S.consentText('Acme'), S.MANY_NAMES]);
  assert.doesNotMatch(all, /\b(SEN|profile|mode|level [1-5]|sync|toggle|scaffold|input method|OCR|AI model)\b/);
});
