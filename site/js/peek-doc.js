// One Peek, every screen (SB6, TR-24). Pure: which screens allow it, how often, what happens
// after it, and how long it shows. Numbers come from sbs-rules.js.
import { RULES } from './sbs-rules.js';
import { peekSecondsOf } from './setup-doc.js';

export const CONTEXTS = ['grid', 'fix', 'flower', 'missing', 'unjumble', 'quick', 'fill', 'quiz', 'ladder', 'row', 'builder', 'test', 'chapterTest', 'bigTest', 'match', 'mix', 'fillPick', 'story'];
export const PEEK_LABEL = 'Peek';

const NONE = { allowed: 0, after: 'none' };
const GAMES = new Set(['flower', 'missing', 'unjumble', 'quick', 'fill']);

/** { allowed: Infinity | 1 | 0, after: 'reset' | 'repeat' | 'not-clean' | 'with-peek' | 'none' } */
export function peekRule(context, { way = 'usual' } = {}) {
  const sbs = way === 'sbs';
  if (context === 'grid' || context === 'fix') return { allowed: Infinity, after: 'reset' };
  if (GAMES.has(context)) return { allowed: Infinity, after: 'not-clean' };
  if (context === 'quiz') return { allowed: RULES.peek.stretchQuiz, after: 'not-clean' };
  if (context === 'builder') return { allowed: Infinity, after: 'repeat' };
  if (context === 'ladder' || context === 'row') return sbs ? { allowed: Infinity, after: 'repeat' } : { ...NONE };
  if (context === 'test') return sbs ? { allowed: RULES.peek.test, after: 'with-peek' } : { ...NONE };
  return { ...NONE }; // chapterTest, bigTest, match, mix, fillPick, story, anything unknown
}

/** How long a Peek shows: 2000, 3000 or 5000 ms. One source: setup-doc's peekSecondsOf (S6). */
export function peekMs(setup, { way, input = 'keys' } = {}) {
  return peekSecondsOf(setup, { way, input }) * 1000;
}
