// A word's details for the study pages and games. A curriculum word has them
// all. A typed word has only its letters here; meaningsFor() fills in what
// Wordbright's meanings know (fetched only when such a word is studied).
import * as D from './data.js';

const NONE = { partOfSpeech: 'word', definition: '', example: '' };
const looked = new Map(); // word -> meaning
export const findEntry = (w) => D.entry(w) || D.allWords().find((e) => e.word.toLowerCase() === w.toLowerCase()) || null;

/** Always an entry the pages can draw. */
export function entryFor(word) {
  return findEntry(word) || { word, ipa: '', chunks: [word], meaning: looked.get(word) || NONE };
}
export const hasMeaning = (word) => !!entryFor(word).meaning.definition;

let meanings = null;
async function wordbrightMeanings() {
  if (!meanings) {
    meanings = import('../../wordbright/js/meanings.js').then(({ createMeanings }) => createMeanings(async (path) => {
      const res = await fetch('../wordbright/' + path);
      if (!res.ok) throw new Error('No meanings');
      return res.json();
    }));
    meanings.catch(() => { meanings = null; });
  }
  return meanings;
}

/** Fill in the typed words' meanings. Never fails: a word with no meaning still works. */
export async function meaningsFor(words) {
  const typed = words.filter((w) => !findEntry(w) && !looked.has(w));
  if (!typed.length) return;
  try {
    const m = await wordbrightMeanings();
    const found = await m.lookup(typed);
    // Not Wiktionary's (src: 'wikt'): those need a credit link, which only Wordbright's panel has.
    for (const [w, e] of found) if (e.m && e.src !== 'wikt') looked.set(w, { partOfSpeech: e.p || 'word', definition: e.m, example: e.e || '' });
  } catch (e) { /* no meanings to hand: the word still works */ }
}
