// SB4-WP8 stage 1: scanning a paper. Pure rules and the account calls (fake fetch). Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../site/js/scan-doc.js';
import * as D from '../site/js/scan-data.js';

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
  assert.equal(r.out.find((o) => o.word === 'zzqx').reason, 'Can\'t use this word yet');
  assert.equal(r.out.find((o) => o.word === "can't").reason, 'Can\'t use this word yet');
  assert.equal(S.sortFound(['well-known'], { 'well-known': true }).out[0].reason, 'Can\'t use this word yet');
  // a capitalised word that IS on our lists is fine
  assert.deepEqual(S.sortFound(['February', 'Monday', 'Mrs', 'I', 'Christmas'], { february: true, monday: true, mrs: true, i: true, christmas: true }).use, ['february', 'Monday', 'Mrs', 'I', 'Christmas']);
  // blocked (never on the lists) and unknown give the same line
  assert.equal(S.sortFound(['blockedword'], {}).out[0].reason, S.sortFound(['nonsense'], {}).out[0].reason);
  const words = Array.from({ length: 16 }, (_, i) => 'w' + 'abcdefghijklmnop'[i]);
  const all = Object.fromEntries(words.map((w) => [w, true]));
  const big = S.sortFound(words, all);
  assert.equal(big.use.length, 15);
  assert.deepEqual(big.out, [{ word: 'wp', shown: 'wp', reason: 'Over the 15-word limit' }]);
  assert.equal(S.sortFound(words, all, 3).use.length, 3);
});

test('sortFound: names with an apostrophe or hyphen are masked; the checks cannot be fooled', () => {
  for (const w of ["Robin's", 'Mary-Jane', "O'Neil", 'Robin']) {
    const o = S.sortFound([w], {}).out[0];
    assert.notEqual(o.shown, w);
    assert.equal(o.shown, w[0] + '.....');
    assert.equal(o.reason, 'Looks like a name');
  }
  assert.equal(S.sortFound(["can't", 'well-known'], {}).out.every((o) => o.reason === 'Can\'t use this word yet'), true);
  assert.deepEqual(S.sortFound(['constructor', 'Constructor', 'toString', '__proto__'], {}).use, []);
  assert.deepEqual(S.sortFound(['constructor'], {}).use, []);
  assert.deepEqual(S.sortFound(['cat'], { cat: 'yes' }).use, [], 'only true counts');
});

test('a caller abort is not offline', () => {
  assert.equal(S.problemOf({ ok: false, status: 0, data: null, aborted: true }), 'cancelled');
  assert.equal(S.problemLine('cancelled'), null);
});

test('small guards: reset day, numeric strings, empty day label', () => {
  assert.match(S.problemLine('monthly', { resetsOn: '2026-12-00' }).line, /the 1st of next month/);
  assert.match(S.problemLine('monthly', { resetsOn: '2026-12-32' }).line, /the 1st of next month/);
  assert.equal(S.leftLine('18'), 'You have 18 scans left this month.');
  assert.equal(S.defaultName(''), 'School words');
  assert.equal(S.defaultName('  '), 'School words');
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

test('copy: every key has its exact line and button', () => {
  const c = (k, i) => S.problemLine(k, i);
  assert.deepEqual(c('offline'), { line: 'You\'re offline. You can type the words instead.', button: 'Try again' });
  for (const k of ['timeout', 'failed', 'read-failed']) assert.deepEqual(c(k), { line: 'That didn\'t work this time.', button: 'Try again' });
  assert.deepEqual(c('no-words'), { line: 'We couldn\'t find any words. Printed lists work best.', button: 'Take another photo' });
  assert.deepEqual(c('hourly'), { line: 'Lots of scans just now. Try again in an hour.', button: null });
  assert.deepEqual(c('paused'), { line: 'Scanning is paused just now.', button: null });
  assert.deepEqual(c('too-large'), { line: 'Try a closer photo of just the list.', button: 'Take another photo' });
  assert.deepEqual(c('off'), { line: 'Scanning isn\'t available yet.', button: null });
  assert.equal(c('playing'), null);
  assert.equal(S.TYPE_INSTEAD, 'Type the words instead');
});

test('the monthly line takes its date and limit from the answer', () => {
  assert.equal(S.problemLine('monthly', { limit: 20, resetsOn: '2026-12-01' }).line, 'You\'ve used this month\'s 20 scans. They come back on 1 December.');
  assert.equal(S.problemLine('monthly', { limit: 10, resetsOn: '2027-01-01' }).line, 'You\'ve used this month\'s 10 scans. They come back on 1 January.');
  assert.match(S.problemLine('monthly', { resetsOn: 'junk' }).line, /20 scans\. They come back on the 1st of next month\.$/);
});

test('shrinkPlan: 1600 at 0.85, 1600 at 0.7, 1280 at 0.7, never enlarges', () => {
  assert.deepEqual(S.shrinkPlan(4000, 3000), [
    { width: 1600, height: 1200, quality: 0.85 }, { width: 1600, height: 1200, quality: 0.7 }, { width: 1280, height: 960, quality: 0.7 }]);
  assert.deepEqual(S.shrinkPlan(3000, 4000)[0], { width: 1200, height: 1600, quality: 0.85 });
  assert.deepEqual(S.shrinkPlan(800, 600).map((s) => [s.width, s.height]), [[800, 600], [800, 600], [800, 600]]);
  assert.equal(S.AFTER_PLAN, 'too-large');
  assert.equal(S.shrinkPlan(0, 0)[0].width, 1);
});

test('leftLine, defaultName, consent text', () => {
  assert.equal(S.leftLine(18), 'You have 18 scans left this month.');
  assert.equal(S.leftLine(1), 'You have 1 scan left this month.');
  assert.equal(S.leftLine(20), 'You have 20 scans left this month.');
  assert.equal(S.defaultName('13 Nov'), 'School words, 13 Nov');
  assert.equal(S.SCAN_VENDOR, '');
  assert.equal(S.PRIVACY_HREF, '');
  assert.equal(S.consentText().send, 'We send the photo to an AI service to read the words. The photo is not kept: we only save the words you tick.');
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
  strings.push(S.leftLine(3), S.defaultName('1 Jan'), S.TYPE_INSTEAD, S.problemLine('monthly', { resetsOn: '2026-12-01' }).line);
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
