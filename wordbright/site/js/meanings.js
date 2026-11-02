// Word meanings and pronunciations (data/meanings/, built by tools/build-meanings.py).
// Each shard holds the words starting with two letters (three for the busiest),
// and is fetched only when a word in it is played. The service worker keeps a
// copy of each shard once it has been used.
//
// Star words use our own meaning and example (star_words.json) and Spellbright's
// IPA and recording; WordNet fills in anything else.

export const SPELLBRIGHT_AUDIO = '../spellbright/assets/audio/words/';

// The shard index: G9's {"v": 2, "shards": {key: stamp}} or an older plain
// list of keys (a copy cached before G9).
export function readIndex(ix) {
  if (Array.isArray(ix)) return { keys: new Set(ix), stamps: null };
  const stamps = (ix && ix.shards) || {};
  return { keys: new Set(Object.keys(stamps)), stamps };
}

// fetchJson(path, { fresh }) resolves the parsed JSON; fresh: past every cache
// (the service worker and the browser), straight from the server. Tests pass their own.
//
// An index and its shards must come from the same build. A shard that is
// missing, or whose stamp ("~") is not the one the index lists, means an old
// cached copy met a newer one (or the reverse): the index and that shard are
// then fetched afresh, so a word never shows "no meaning" just because of a
// stale cache. An old-style index (no stamps) that has no shard for a word is
// also checked once against a fresh index.
export function createMeanings(fetchJson) {
  const shards = new Map(); // key -> Promise of { word: entry }
  let index = null; // Promise of { keys, stamps }
  let freshIndex = null; // the same, fetched past the caches (once)
  const freshShards = new Map();

  const keys = () => {
    if (!index) index = fetchJson('data/meanings/index.json').then(readIndex).catch((e) => { index = null; throw e; });
    return index;
  };
  const freshKeys = () => {
    if (!freshIndex) freshIndex = fetchJson('data/meanings/index.json', { fresh: true }).then(readIndex).catch(() => { freshIndex = null; return null; });
    return freshIndex;
  };
  const shard = (key) => {
    if (!shards.has(key)) shards.set(key, fetchJson('data/meanings/' + key + '.json').catch((e) => { shards.delete(key); throw e; }));
    return shards.get(key);
  };
  const freshShard = (key) => {
    if (!freshShards.has(key)) freshShards.set(key, fetchJson('data/meanings/' + key + '.json', { fresh: true }).catch(() => { freshShards.delete(key); return null; }));
    return freshShards.get(key);
  };
  const matches = (d, ix, k) => !!d && (!ix.stamps || d['~'] === ix.stamps[k]);
  const entryOf = (d, w) => (w !== '~' && Object.prototype.hasOwnProperty.call(d, w) ? d[w] : null); // not "constructor" from Object

  async function one(w, ix) {
    const k = shardKey(w, ix.keys);
    if (k) {
      const d = await shard(k).catch(() => null);
      if (matches(d, ix, k)) return entryOf(d, w);
    } else if (ix.stamps) {
      return null; // a current index: there is no shard for this word
    }
    // Missing, stale or mismatched: the index and the shard from the server.
    const fix = await freshKeys();
    const fk = fix && shardKey(w, fix.keys);
    if (!fk) return null;
    const d = await freshShard(fk);
    return matches(d, fix, fk) ? entryOf(d, w) : null;
  }

  // The meanings of these words: Map word -> entry (words with nothing known are left out).
  async function lookup(words) {
    const ix = await keys();
    const want = [...new Set(words)];
    const found = await Promise.all(want.map((w) => one(w, ix).catch(() => null)));
    return new Map(want.map((w, i) => [w, found[i]]).filter(([, e]) => e));
  }

  // Start loading early (while the move is checked); errors wait for lookup().
  function prefetch(words) {
    lookup(words).catch(() => {});
  }

  return { lookup, prefetch, loaded: () => [...shards.keys()] };
}

// The longest shard name the word starts with: "con" before "co".
export function shardKey(word, keys) {
  if (keys.has(word.slice(0, 3))) return word.slice(0, 3);
  if (keys.has(word.slice(0, 2))) return word.slice(0, 2);
  return null;
}

// Everything a results row shows about one word.
// entry: from a shard (or null); star: from star_words.json (or null).
export function wordInfo(word, entry, star) {
  const e = entry || {};
  if (star) {
    return {
      word,
      ipa: star.ipa || e.i || '',
      pos: star.pos || e.p || '',
      meaning: star.meaning,
      example: star.example || '',
      lemma: '',
      audio: star.audio ? SPELLBRIGHT_AUDIO + word + '.mp3' : '',
    };
  }
  // derived (G9): the base word when the meaning was made from it ("frothier" -> "frothy").
  return { word, ipa: e.i || '', pos: e.p || '', meaning: e.m || '', example: e.e || '', lemma: e.l || '', audio: '', derived: e.d || '' };
}
