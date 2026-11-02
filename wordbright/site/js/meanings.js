// Word meanings and pronunciations (data/meanings/, built by tools/build-meanings.py).
// Each shard holds the words starting with two letters (three for the busiest),
// and is fetched only when a word in it is played. The service worker keeps a
// copy of each shard once it has been used.
//
// Star words use our own meaning and example (star_words.json) and Spellbright's
// IPA and recording; WordNet fills in anything else.

export const SPELLBRIGHT_AUDIO = '../spellbright/assets/audio/words/';

// The shard index: G9's {"v": 2, "shards": {key: stamp}, "wikt"?: {key: stamp}}
// or an older plain list of keys (a copy cached before G9). "wikt" (G9c) lists
// the Wiktionary shards (data/meanings/wikt/, CC BY-SA 4.0), read only for a
// word whose own shard has no meaning.
export function readIndex(ix) {
  if (Array.isArray(ix)) return { keys: new Set(ix), stamps: null, wkeys: null, wstamps: null };
  const stamps = (ix && ix.shards) || {};
  const wstamps = ix && ix.wikt && typeof ix.wikt === 'object' ? ix.wikt : null;
  return { keys: new Set(Object.keys(stamps)), stamps, wkeys: wstamps ? new Set(Object.keys(wstamps)) : null, wstamps };
}

// fetchJson(path, { fresh }) resolves the parsed JSON; fresh: past every cache
// (the service worker and the browser), straight from the server. Tests pass their own.
//
// An index and its shards must come from the same build. A shard that is
// missing, or whose stamp ("~") is not the one the index lists, means an old
// cached copy met a newer one (or the reverse): the index and that shard are
// then fetched afresh, so a word never shows "no meaning" just because of a
// stale cache. An index with no shard for a word (an old-style one, or one
// from before the Wiktionary shards) is also checked once against a fresh index.
export function createMeanings(fetchJson) {
  const sets = {
    main: { dir: 'data/meanings/', got: new Map(), fresh: new Map(), keys: (ix) => ix.keys, stamps: (ix) => ix.stamps },
    wikt: { dir: 'data/meanings/wikt/', got: new Map(), fresh: new Map(), keys: (ix) => ix.wkeys, stamps: (ix) => ix.wstamps },
  };
  let index = null; // Promise of readIndex()
  let freshIndex = null; // the same, fetched past the caches (once)

  const keys = () => {
    if (!index) index = fetchJson('data/meanings/index.json').then(readIndex).catch((e) => { index = null; throw e; });
    return index;
  };
  const freshKeys = () => {
    if (!freshIndex) freshIndex = fetchJson('data/meanings/index.json', { fresh: true }).then(readIndex).catch(() => { freshIndex = null; return null; });
    return freshIndex;
  };
  const load = (set, key, fresh) => {
    const m = fresh ? set.fresh : set.got;
    if (!m.has(key)) {
      m.set(key, fetchJson(set.dir + key + '.json', fresh ? { fresh: true } : undefined).catch((e) => {
        m.delete(key);
        if (fresh) return null;
        throw e;
      }));
    }
    return m.get(key);
  };
  const matches = (d, stamps, k) => !!d && (!stamps || d['~'] === stamps[k]);
  const entryOf = (d, w) => (w !== '~' && Object.prototype.hasOwnProperty.call(d, w) ? d[w] : null); // not "constructor" from Object

  async function fromSet(set, w, ix) {
    const ks = set.keys(ix);
    const k = ks && shardKey(w, ks);
    if (k) {
      const d = await load(set, k, false).catch(() => null);
      if (matches(d, set.stamps(ix), k)) return entryOf(d, w);
    } else if (ks && ix.stamps) {
      return null; // a current index: there is no shard for this word
    }
    // Missing, stale or mismatched: the index and the shard from the server.
    const fix = await freshKeys();
    const fks = fix && set.keys(fix);
    const fk = fks && shardKey(w, fks);
    if (!fk) return null;
    const d = await load(set, fk, true);
    return matches(d, set.stamps(fix), fk) ? entryOf(d, w) : null;
  }

  async function one(w, ix) {
    const e = await fromSet(sets.main, w, ix);
    if (e && e.m) return e;
    const we = await fromSet(sets.wikt, w, ix).catch(() => null);
    if (!we) return e;
    return e ? { ...e, ...we } : we; // the word's own IPA, Wiktionary's meaning
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

  return { lookup, prefetch, loaded: () => [...sets.main.got.keys()] };
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
  // src (G9c): 'wikt' for a meaning from Wiktionary (the panel credits it).
  return { word, ipa: e.i || '', pos: e.p || '', meaning: e.m || '', example: e.e || '', lemma: e.l || '', audio: '', derived: e.d || '', src: e.src === 'wikt' ? 'wikt' : '' };
}
