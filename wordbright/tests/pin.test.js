import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPin, makePin, checkPin, isStoredPin, PIN_RE } from '../site/js/pin.js';

test('a PIN is stored as a salted SHA-256 hash, never as the digits', async () => {
  const stored = await makePin('2580');
  assert.ok(isStoredPin(stored));
  assert.match(stored.salt, /^[0-9a-f]{32}$/);
  assert.match(stored.hash, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(stored).includes('2580'));
  assert.equal(stored.hash, await hashPin('2580', stored.salt));
});

test('the same PIN gets a different salt and hash each time', async () => {
  const a = await makePin('1234');
  const b = await makePin('1234');
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
});

test('a known hash (so the format never changes by accident)', async () => {
  // SHA-256 of salt + ":" + PIN, worked out a second way with Node's crypto.
  const { createHash } = await import('node:crypto');
  assert.equal(await hashPin('1234', '00'), createHash('sha256').update('00:1234').digest('hex'));
});

test('checkPin: right, wrong, odd input, and no PIN set', async () => {
  const stored = await makePin('0007');
  assert.equal(await checkPin('0007', stored), true);
  assert.equal(await checkPin('0008', stored), false);
  assert.equal(await checkPin('7', stored), false);
  assert.equal(await checkPin('00070', stored), false);
  assert.equal(await checkPin('', stored), false);
  assert.equal(await checkPin('0007', null), false);
  assert.equal(await checkPin('0007', { salt: 'x', hash: 'nope' }), false);
});

test('only 4 digits make a PIN', async () => {
  for (const ok of ['0000', '1234', '9999']) assert.ok(PIN_RE.test(ok));
  for (const bad of ['123', '12345', 'abcd', '12 4', '١٢٣٤']) assert.ok(!PIN_RE.test(bad), bad);
  await assert.rejects(makePin('12a4'), /4 digits/);
});
