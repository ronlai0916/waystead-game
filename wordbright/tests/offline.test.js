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

// voice-allow.txt and voice-names.txt are for the account's voice server, never the game.
test('the shell lists every script, style sheet, data file, icon and character picture', () => {
  const list = new Set(shell());
  const needed = [...files('js'), ...files('css'), ...files('data').filter((f) => !f.startsWith('data/meanings/') && f !== 'data/voice-allow.txt' && f !== 'data/voice-names.txt'), ...files('assets/icons'), ...files('assets/characters'),
    'index.html', 'manifest.webmanifest'];
  assert.deepEqual(needed.filter((f) => !list.has(f)), []);
  for (const f of list) if (f !== './') assert.ok(existsSync(SITE + f), `${f} is in the shell but not on disk`);
});

test('fonts, videos and the meaning shards are not in the shell (cached on first use); the meanings index is (G9)', () => {
  assert.ok(shell().every((f) => !f.startsWith('assets/fonts/')));
  assert.ok(shell().every((f) => !/\.(webm|mp4)$/.test(f)));
  assert.deepEqual(shell().filter((f) => f.startsWith('data/meanings/')), ['data/meanings/index.json']);
});

test('G9: a ?fresh= request goes past the service worker; a new worker takes over at once and the page reloads', () => {
  assert.match(sw, /if \(url\.searchParams\.has\('fresh'\)\) return;/);
  assert.match(sw, /self\.skipWaiting\(\)/);
  assert.match(sw, /self\.clients\.claim\(\)/);
  const app = readFileSync(ROOT + 'site/js/app.js', 'utf8');
  assert.match(app, /addEventListener\('controllerchange'/);
  assert.match(app, /if \(!hadWorker\) return;/);
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
