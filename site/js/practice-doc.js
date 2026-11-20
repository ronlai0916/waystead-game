// SB5: what a child's Practice page shows, and in which order (BR-18). Pure: no DOM, no storage, no clock.
// A child's copy is short: sentences of 8 words or fewer, and never the grown-up's words "word list".

export const PRACTICE_TITLE = 'Practice';
export const FROM_GROWNUP = 'From your grown-up';
export const PRACTICE_SUB = 'Lists from your grown-up, chapters, tricky words';
export const HIDDEN_LINE = 'Opens after your test.';
// SB5 (TR-101): the "Sentence games" tile: Meaning match, Fill in the blanks and Mix and match on this week's words. Locked while a test is due.
export const SENTENCE_GAMES_TITLE = 'Sentence games';
export const SENTENCE_GAMES_SUB = 'This week\'s words';
export const SENTENCE_GAMES = ['match', 'fill', 'mix'];

const lc = (w) => String(w).toLowerCase();

/**
 * The sections of Practice, in order. own = the child's live copies of the grown-up's lists [{ id, name, words, at }];
 * hidden = the words that must stay out of sight (a test is due). Lists come first when there is at least one (else the
 * year chapters lead); the Sentence games tile follows the first section (left out when `hasWeek` is false); a list holding a hidden word is { id, name, hidden: true } and has no link. `years` and `tricky`
 * are accepted for the caller's convenience; the sections themselves carry no words.
 */
export function practiceSections({ own = [], hidden = [], hasWeek = true } = {}) {
  const gone = new Set(Array.from(hidden || [], lc));
  const items = [...own].sort((a, b) => (b.at || 0) - (a.at || 0) || String(a.name).localeCompare(String(b.name)) || String(a.id).localeCompare(String(b.id)))
    .map((o) => ((o.words || []).some((w) => gone.has(lc(w))) ? { id: o.id, name: o.name, hidden: true } : { id: o.id, name: o.name }));
  const games = hasWeek ? [{ kind: 'sentenceGames', items: [...SENTENCE_GAMES] }] : [];
  const rest = [{ kind: 'tricky' }, { kind: 'years' }, { kind: 'pick' }, { kind: 'progress' }];
  if (!items.length) return [{ kind: 'years' }, ...games, { kind: 'tricky' }, { kind: 'pick' }, { kind: 'progress' }];
  return [{ kind: 'lists', items }, ...games, ...rest];
}
