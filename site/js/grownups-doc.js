// Grown-ups: the rules with no page in them. Pure; the date comes in as `today`.
// A plan is an ordinary word group, written into the child's own saved value,
// so everything else (Study mode, the grid, merging) treats it like any other.
// The numbers are all counted from the child's tries, as they are for the child.
import * as W from './words-doc.js';
import * as St from './study-doc.js';
import { trickyWords } from './progress-doc.js';

/** Only an adult playing as themselves. A child, or an adult playing as one, never. */
export const canSeeGrownups = (kind) => kind === 'adult';

/** What a plan will do, before it's saved. */
export function preview(d, { name, test, words }, today) {
  const r = W.createGroup(d, { id: 'preview', name, test, words, today, now: 1 });
  if (r.error) return { error: r.error };
  const g = W.groupById({ ...r.doc, resetAt: 0 }, 'preview');
  return { name: g.name, test: g.test, words: g.words, back: g.back, steps: St.studyState(r.doc, g, today).steps, squeezed: W.daysBetween(g.start, g.test) < St.BEFORE_TEST.length };
}
export const createPlan = (d, plan, { id, today, now }) => W.createGroup(d, { id, name: plan.name, test: plan.test, words: plan.words, today, now });
export const editPlan = (d, gid, plan, { today, now }) => W.editGroup(d, gid, plan, today, now);

/** The words a pattern offers, up to a group's worth. */
export const patternWords = (patterns, id) => ((patterns.find((p) => p.id === id) || { words: [] }).words).slice(0, W.MAX_WORDS);
export const childTricky = (progress) => trickyWords(progress).map((t) => t.word);

function groupReport(d, g, today) {
  const p = W.groupProgress(d, g);
  const dots = new Map(W.allDots(d, g, today).map((x) => [x.word, x.dots]));
  const s = St.studyState(d, g, today);
  const test = W.testResults(d, g).filter((x) => x.result);
  return {
    id: g.id, name: g.name, start: g.start, testDate: g.test, canEdit: W.canEdit(g, today),
    status: s.status, job: s.job ? St.STEP_TEXT[s.job].title : '',
    steps: s.steps,
    ready: W.readyForTest(d, g),
    words: p.words.map((x) => ({ word: x.word, back: x.back, status: x.status, tries: x.tries, peeks: x.peeks, dots: dots.get(x.word) })),
    test: { taken: test.length, right: test.filter((x) => x.result.right).length, of: g.words.length, rows: test.map((x) => ({ word: x.word, right: x.result.right })) },
    stars: p.stars, of: p.of,
    sentences: W.notesFor(d, g).map((x) => ({ word: x.w, text: x.x, day: x.d })),
  };
}

/** Everything the dashboard shows for one child. */
export function dashboard(d, today) {
  const g = St.studyGroup(d, today);
  const o = W.overall(d);
  const clues = Object.entries(d.clues).filter(([, c]) => c.t).map(([word, c]) => ({ word, clue: c.t })).sort((a, b) => a.word.localeCompare(b.word));
  return {
    current: g ? groupReport(d, g, today) : null,
    others: W.liveGroups(d).filter((x) => !g || x.id !== g.id).map((x) => groupReport(d, x, today)),
    remembered: o.remembered, practised: o.practised, independent: o.independent, firstGoes: o.firstGoes, clean: o.clean,
    clues,
  };
}
