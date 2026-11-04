// Is a typed word one we can use in "My words"? Only words in our curriculum,
// or in Wordbright's word list. That list is built with every child-safe
// blocklist already applied (tools/build-wordgraph.py), so a blocked word and
// an unknown one get the same kind answer, and nothing says which it was.
// The list is Wordbright's own file, fetched only when someone types a word.
export const REFUSED = 'That word isn\'t on our lists. Check the spelling, or try another word.';
export const NEEDS_LIST = 'We can\'t check that word just now. You can still pick words from the other tabs.';

const shape = (s) => /^[a-z]{2,20}$/.test(s);
export const cleanWord = (raw) => String(raw || '').trim().toLowerCase();

/**
 * The word as it should be saved, or null. findEntry(word) looks in the
 * curriculum, which has a word's own capitals (February); inList(word) in the word list.
 */
export function usableWord(raw, { findEntry, inList }) {
  const s = cleanWord(raw);
  if (!shape(s)) return null;
  const e = findEntry(s);
  if (e) return e.word;
  return inList(s) ? s : null;
}

let list = null;
async function wordList() {
  if (!list) {
    list = (async () => {
      const [{ loadWordGraph, isWord }, res] = await Promise.all([import('../../wordbright/js/engine/words.js'), fetch('../wordbright/data/words_all.dawg')]);
      if (!res.ok) throw new Error('No word list');
      const graph = loadWordGraph(await res.arrayBuffer());
      return (w) => isWord(w, graph);
    })();
    list.catch(() => { list = null; });
  }
  return list;
}

/** { word } or { error }. A curriculum word needs nothing fetched. */
export async function checkTyped(raw, findEntry) {
  const s = cleanWord(raw);
  if (shape(s) && findEntry(s)) return { word: findEntry(s).word };
  if (!shape(s)) return { error: REFUSED };
  try {
    const inList = await wordList();
    const word = usableWord(s, { findEntry, inList });
    return word ? { word } : { error: REFUSED };
  } catch (e) {
    return { error: NEEDS_LIST };
  }
}
