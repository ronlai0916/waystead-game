// The child-safe check on what a child types into a comic (C2): a describing word,
// a typed sentence or speech bubble, a story spark, a title. Pure: isKnown(word)
// is passed in (Wordbright's word list, built without blocked words; wordcheck.js).
//
// Every word must be on our lists, or be one of the comic's own words (the task's
// names, the sticker characters' names). A few everyday words that are on the
// lists but unkind or frightening in a child's comic are refused as well.
// An unknown word and a refused one get the same answer, so the check never
// says which words are blocked. Nothing here is a mark: it only asks the child
// to look again.
//
// The typed challenge ("Write it yourself") is free writing, like the classic
// Write page, and is not filtered: the automatic checks apply there instead.
const WORD = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;
export const wordsOf = (text) => String(text || '').match(WORD) || [];

export const UNKIND = new Set(`
stupid idiot idiots idiotic dumb dummy dummies ugly loser losers hate hates hated hating
kill kills killed killing killer dead die dies died dying murder blood bloody gun guns knife knives weapon
fat fatty smelly shutup moron morons fool fools pathetic useless worthless
`.split(/\s+/).filter(Boolean));

// The word without a short ending: "it's" → "it", "Maya's" → "maya".
const base = (w) => w.replace(/['’](s|ll|re|ve|d|m|t)$/i, '').replace(/n['’]t$/i, '');
const CONTRACTIONS = new Set(["can't", "won't", "don't", "isn't", "aren't", "wasn't", "weren't", "didn't", "doesn't", "haven't", "hasn't", "couldn't", "wouldn't", "shouldn't", "i'm", "i've", "i'll", "i'd", "let's", "that's", "what's", "where's", "who's", "there's", "here's", "it's", "he's", "she's", "you're", "we're", "they're", "you'll", "we'll", "they'll", "you've", "we've", "they've"]);

/**
 * { ok, unknown, empty, tooLong }. `extra` is a list of words the comic itself
 * uses (names). `max` is the most characters allowed.
 */
export function checkTyped(text, isKnown, { extra = [], max = 160, minWords = 1 } = {}) {
  const raw = String(text || '');
  const list = wordsOf(raw);
  const known = new Set(extra.flatMap((e) => wordsOf(e)).map((w) => w.toLowerCase()));
  const unknown = [];
  for (const w of list) {
    const l = w.toLowerCase().replace(/’/g, "'");
    const ok = !UNKIND.has(l) && !UNKIND.has(base(l)) && (l === 'a' || l === 'i' || known.has(l) || known.has(base(l)) || CONTRACTIONS.has(l) || isKnown(l) || (base(l) !== l && isKnown(base(l))));
    if (!ok && !unknown.includes(w)) unknown.push(w);
  }
  const tooLong = raw.length > max;
  const empty = list.length < minWords;
  return { ok: !unknown.length && !tooLong && !empty, unknown, empty, tooLong };
}

/** What to say to the child, kindly. Never "wrong". */
export function typedNote(r, { minWords = 1 } = {}) {
  if (r.empty) return minWords > 1 ? 'Write a few more words first.' : 'Type a word first.';
  if (r.tooLong) return 'That is a lot! Try making it a little shorter.';
  if (r.unknown.length) return 'We don\'t know the word "' + r.unknown[0] + '" yet. Check the spelling, or try another word.';
  return '';
}
