// Word meanings and pronunciations (data/meanings/, built by tools/build-meanings.py).
// Each shard holds the words starting with two letters (three for the busiest),
// and is fetched only when a word in it is played. The service worker keeps a
// copy of each shard once it has been used.
//
// Star words use our own meaning and example (star_words.json) and Spellbright's
// IPA and recording; WordNet fills in anything else.

export const SPELLBRIGHT_AUDIO = '../spellbright/assets/audio/words/';

// fetchJson(path) resolves the parsed JSON; tests pass their own.
export function createMeanings(fetchJson) {
  const shards = new Map(); // key -> Promise of { word: entry }
  let index = null; // Promise of a Set of shard keys

  const keys = () => {
    if (!index) index = fetchJson('data/meanings/index.json').then((k) => new Set(k)).catch((e) => { index = null; throw e; });
    return index;
  };
  const shard = (key) => {
    if (!shards.has(key)) shards.set(key, fetchJson('data/meanings/' + key + '.json').catch((e) => { shards.delete(key); throw e; }));
    return shards.get(key);
  };

  // The meanings of these words: Map word -> entry (words with nothing known are left out).
  async function lookup(words) {
    const ks = await keys();
    const want = [...new Set(words)];
    const found = await Promise.all(want.map((w) => {
      const k = shardKey(w, ks);
      return k ? shard(k).then((d) => d[w] || null, () => null) : null;
    }));
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
  return { word, ipa: e.i || '', pos: e.p || '', meaning: e.m || '', example: e.e || '', lemma: e.l || '', audio: '' };
}
