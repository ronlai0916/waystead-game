// Spelling one word in "My words", and the test: the rules with no page in
// them. Pure. A run is plain data; each step answers a new one.
//
// A pass is one go at the word. Letters are checked at once: a wrong one counts
// and the box stays empty. A pass with a wrong letter or a peek isn't clean, so
// the word needs another pass, clean, before it's done for today.

export const newRun = (word) => ({ word, at: 0, tries: 0, peeks: 0 });
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

/** { run, hit, finished }. finished: this pass reached the end of the word. */
export function typeLetter(run, letter) {
  if (run.at >= run.word.length) return { run, hit: false, finished: true };
  if (!same(run.word[run.at], letter)) return { run: { ...run, tries: run.tries + 1 }, hit: false, finished: false };
  const next = { ...run, at: run.at + 1 };
  return { run: next, hit: true, finished: next.at === next.word.length };
}
export const peek = (run) => ({ ...run, peeks: run.peeks + 1 });
export const isClean = (run) => run.tries === 0 && run.peeks === 0;
/** The next pass: the boxes empty and the counts start again. */
export const again = (run) => newRun(run.word);
/** Left halfway after a mistake or a peek: that still counts as this word's try. */
export const mustRecord = (run) => !isClean(run) && run.at < run.word.length;

// The test: one go at each word, and no word from here says right or wrong.
export function checkAnswer(word, typed) { return same(word, typed.trim()); }
export function createTest(words) {
  const left = [...words];
  const answers = [];
  return {
    current: () => left[0] || null,
    remaining: () => left.length,
    /** Takes the answer and moves on. Says only what's next. */
    answer(typed) {
      if (!left.length || !typed.trim()) return { next: left[0] || null };
      answers.push({ word: left.shift(), typed: typed.trim() });
      return { next: left[0] || null };
    },
    /** Only once every word is answered. */
    results: () => (left.length ? null : answers.map((a) => ({ ...a, right: checkAnswer(a.word, a.typed) }))),
  };
}

// Short, kind lines for a wrong letter, in turn.
export const WRONG_LINES = ['Not that letter. Have another go.', 'Nearly there. Listen, and try again.', 'Good try. Think about the sound.', 'Keep going. You can use Hear again.'];
export const wrongLine = (tries) => WRONG_LINES[(tries - 1) % WRONG_LINES.length];
