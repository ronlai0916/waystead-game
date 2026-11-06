// Is this a real word? Wordbright's word list, fetched once when writing starts,
// so a real word near a hint word isn't flagged as a slip. Only everyday words
// count (the two smallest tiers): the full list has rarities like "kyte", which is
// a misspelling when a child writes it. If it doesn't load, the check only goes by
// the hint words.
export const COMMON_TIER = 1;
let list = null;
export function loadRealWords() {
  if (!list) {
    list = (async () => {
      const [{ loadWordGraph, isWord }, res] = await Promise.all([import('../../wordbright/js/engine/words.js'), fetch('../wordbright/data/words_all.dawg')]);
      if (!res.ok) throw new Error('No word list');
      const graph = loadWordGraph(await res.arrayBuffer());
      return (w) => isWord(w, graph, COMMON_TIER);
    })();
    list.catch(() => { list = null; });
  }
  return list.catch(() => () => false);
}
