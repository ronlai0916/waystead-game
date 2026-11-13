// The front pages (SB3-F): what the signed-out page says, and the pure rules behind More practice
// (the chapters page) and one chapter's three steps. Pure: no DOM, no storage, no clock. The views
// are in front-views.js and pass in each chapter's progress ({ studied, practised, passed, attempts }).

// ---- the signed-out page ---------------------------------------------------------------
export const SIGNED_OUT = {
  eyebrow: 'Spellbright by Waystead',
  headline: ['A spelling week.', 'One short job a day.'],
  lede: 'Learn spellings: seven short jobs, then a test.',
  button: 'Sign in to start',
  create: 'New here? Create a free account',
  kids: 'Children: ask a grown-up to sign in.',
  offline: 'You need to be online to sign in.',
  weekTitle: 'How a week works',
  weekLine: 'A grown-up plans the week. A missed job waits for you. Nothing is skipped.',
  parentsTitle: 'For parents and teachers',
  parentsLine: 'For parents and teachers of children aged 7 to 11: you choose the words and the test date.',
  parentsLink: 'How Spellbright works for parents',
};

/** The seven jobs of a week, in order, each with a three-to-five-word helper (the same names as the child's path). */
export const JOBS = [
  { id: 'hello', name: 'Hello words', help: 'Meet each new word' },
  { id: 'fix', name: 'Fix it in', help: 'Look, say, cover, write' },
  { id: 'games', name: 'Game day', help: 'Four quick word games' },
  { id: 'story', name: 'Story day', help: 'Read, then write sentences' },
  { id: 'practice', name: 'Practice day', help: 'Hear it, then type it' },
  { id: 'test', name: 'Test', help: 'Spoken, no peeking' },
  { id: 'mend', name: 'Mend and keep', help: 'Fix any slips' },
];

// ---- More practice ---------------------------------------------------------------------
export const YEARS = ['y34', 'y56'];
const started = (p) => !!(p.studied || p.practised || p.passed || p.attempts > 0);

/** A chapter stone's state: 'passed' (star and number), 'studying' (a sun) or 'todo' (dashed). */
export function stoneState(p) {
  if (p.passed) return 'passed';
  return p.studied || p.practised || p.attempts > 0 ? 'studying' : 'todo';
}
export const STONE_LABEL = { passed: 'Passed', studying: 'Studying', todo: 'To do' };

/** The step a chapter wants next: 'learn', 'practise', 'test', or '' once it is passed. */
export function nextStep(p) {
  if (p.passed) return '';
  if (!p.studied) return 'learn';
  if (!p.practised) return 'practise';
  return 'test';
}
export const STEP_LABEL = { learn: 'Learn the words', practise: 'Practise', test: 'Take the test' };

/** One year's numbers: words, chapters, tests passed. chs: the year's chapters; progressOf(ch) -> progress. */
export function yearSummary(chs, progressOf) {
  return {
    words: chs.reduce((n, c) => n + c.words.length, 0),
    total: chs.length,
    passed: chs.filter((c) => progressOf(c).passed).length,
  };
}
export function summaryLine(s) {
  const tests = s.passed === 0 ? 'no tests passed yet' : s.passed + (s.passed === 1 ? ' test passed' : ' tests passed');
  return s.words + ' words in ' + s.total + ' chapters · ' + tests;
}

/**
 * The year's stones, and the one button. unlockedOf(ch) says whether the chapter is open (the one before it passed).
 * mode: 'start' (nothing begun in this year: Start: Chapter 1), 'carry' (Carry on: Chapter n) or 'done' (all passed).
 * The target is the first chapter that is open and not passed; its next step says where the button goes.
 */
export function yearView(chs, progressOf, unlockedOf) {
  const ps = chs.map(progressOf);
  const begun = ps.some(started);
  const at = chs.findIndex((c, i) => !ps[i].passed && unlockedOf(c));
  const stones = chs.map((c, i) => ({
    id: c.id, slug: c.slug, n: i + 1, state: stoneState(ps[i]), open: unlockedOf(c), next: i === at,
  }));
  if (at < 0) return { mode: 'done', stones, target: null };
  const step = nextStep(ps[at]);
  return { mode: begun ? 'carry' : 'start', stones, target: { n: at + 1, slug: chs[at].slug, step, label: STEP_LABEL[step] } };
}
export const carryLabel = (v) => (v.mode === 'start' ? 'Start: Chapter ' : 'Carry on: Chapter ') + v.target.n;

/** Which year the page opens on: the remembered one, else the year the player is working in. */
export function pickYear(remembered, views) {
  if (YEARS.includes(remembered)) return remembered;
  const a = views.y34;
  const b = views.y56;
  if (a.mode === 'done') return 'y56';
  if (a.mode === 'start' && b.mode === 'carry') return 'y56';
  return 'y34';
}

// ---- One chapter -----------------------------------------------------------------------
/**
 * The three steps of a chapter, each 'done', 'next' or 'later', from what is recorded (studiedAt, practisedAt, the tests).
 * Only the next step is the page's one primary button.
 *
 * THE TEST RULE (a view rule, nothing stored): the chapter test is offered as the primary button when the chapter has been
 * practised. Before that it is a quiet row, "Opens when you've practised.", and an adult has "Take the test anyway".
 * It stays openable (a plain button) whenever it could be before: a chapter practised, tested before (passed or not), or
 * passed. `testOpen` says so; only a child before any practice has no way in, and practising is one button away.
 */
export function chapterSteps(p, adult = false) {
  const next = nextStep(p);
  const testOpen = !!(p.practised || p.passed || p.attempts > 0);
  return {
    next,
    learn: p.studied ? 'done' : next === 'learn' ? 'next' : 'later',
    practise: p.practised ? 'done' : next === 'practise' ? 'next' : 'later',
    test: p.passed ? 'done' : next === 'test' ? 'next' : 'later',
    testOpen,
    testAnyway: adult && !testOpen,
  };
}
