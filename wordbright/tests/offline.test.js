// The service worker caches every file the game needs to start offline, and
// never touches another game's caches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.js';

const SITE = ROOT + 'site/';
const sw = readFileSync(SITE + 'sw.js', 'utf8');

function files(dir) {
  return readdirSync(join(SITE, dir)).flatMap((name) => {
    const rel = dir + '/' + name;
    return statSync(join(SITE, rel)).isDirectory() ? files(rel) : [rel];
  });
}

// SHELL as the worker builds it (the character list is made in code).
function shell() {
  const body = sw.slice(sw.indexOf('const CHARACTERS'), sw.indexOf("self.addEventListener('install'"));
  return new Function(body + '; return SHELL;')();
}

test('the shell lists every script, data file, font, icon and character picture', () => {
  const list = new Set(shell());
  const needed = [...files('js'), ...files('data'), ...files('assets/fonts'), ...files('assets/icons'), ...files('assets/characters'),
    'index.html', 'css/app.css', 'manifest.webmanifest'];
  assert.deepEqual(needed.filter((f) => !list.has(f)), []);
  for (const f of list) if (f !== './') assert.ok(existsSync(SITE + f), `${f} is in the shell but not on disk`);
});

test('videos are not in the shell (cached on first use)', () => {
  assert.ok(shell().every((f) => !/\.(webm|mp4)$/.test(f)));
});

test('cache names: a VERSION starting "wordbright-", and only "wordbright-" caches are deleted', () => {
  assert.match(sw, /const VERSION = 'wordbright-[\w-]+';/);
  assert.match(sw, /k\.startsWith\('wordbright-'\)/);
  assert.ok(!/spellbright/.test(sw.replace(/Spellbright keeps "spellbright-…"/, '')));
});

test('the manifest is scoped to the game folder', () => {
  const m = JSON.parse(readFileSync(SITE + 'manifest.webmanifest', 'utf8'));
  assert.equal(m.scope, './');
  assert.equal(m.start_url, './');
  for (const icon of m.icons) assert.ok(existsSync(SITE + icon.src), icon.src);
});
