// Step by step (SB6): the one RULES table. Every number the Step-by-step rules use is here and
// nowhere else. Pure data, frozen. (TR-20; D18 of 24 Nov 2026 overrides the TRS ladder text:
// the ladder is strict, rung k hides exactly k letters, no rung is skipped.)

const freeze = (o) => {
  for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v);
  return Object.freeze(o);
};

export const RULES = freeze({
  rungs: {
    // D18/D20: rung k hides exactly k letters, k = 1 ... letters - 1, then the whole word. No cap, no skip.
    // Codes: 0 Meet, 1 Copy, k + 1 = k letters missing (2 ... n), allCode = the whole word. The stored try
    // field r is the code itself (1 ... allCode); allCode is above every partial code (words up to 30 letters).
    allCode: 31,
    copy: true,             // R1 Copy is a rung
    middle: 'ceil(n / 2)',  // k = ceil(n / 2); R-all when k >= n
    codes: { meet: 0, copy: 1, firstMissing: 2 },
  },
  hide: {
    // D18: one letter at a time. Sounded-out letters first (final consonant, consonants, vowels),
    // then the tricky part's letters one by one, then index 0 last.
    order: ['finalConsonant', 'consonant', 'vowel', 'tricky', 'first'],
    vowels: 'aeiouy',
    tricky: ['ough', 'augh', 'eigh', 'tion', 'sion', 'ture', 'ould', 'igh', 'kn', 'wr', 'gn', 'mb', 'ph', 'wh', 'ei', 'ie', 'ue', 'ui', 'ear', 'our', 'ous'],
    slipEarlier: 1,         // a usual slip spot is hidden one rung earlier
  },
  tray: {
    copy: { distractors: 0, glowAfter: 1, alts: false, model: true },
    low: { alts: false, glowAfter: 1, distractors: 2 },   // below the middle rung
    high: { alts: true, glowAfter: 2, distractors: 4 },   // middle rung and up
    mirrors: false,
    levelLow: 2, levelHigh: 3, levelAll: 4,
  },
  slip: {
    repeat: 1,   // a first go that is not clean (1 slip or a Peek): one repeat
    back: 2,     // 2 slips in one try on a first go: back one rung
    // D22: no parking. A repeat that is not clean goes back one rung every time (never below Copy).
    keep: 5,     // last 5 box indices per word
    usualDays: 2,
  },
  lines: {
    stuck: 'This word is tricky today. Ask your grown-up.',
    endCalm: "That's all for today. See you next time.",
    repeat: 'Once more, then the next step.',
    back: "Let's warm up with this one.",
  },
  session: {
    newWords: { y1: 3, y2: 3, y3: 4, y4: 4, y5: 4, y6: 4, max: 5 },
    reviewWords: 5,
    maxItems: 200,
    closeTries: 2, mendExtra: 2, noYearWords: 3,
    minutes: [5, 10, 15], defaultMinutes: 10,
    noNewWordLastMs: 90000,
    breakOffer: { everyWords: 2, afterMs: 480000 },
    breakLineMs: 120000,
    thenGame: { game: 'meaning-match', cards: 3 },
  },
  week: { shareCap: false, catchUpCap: false, noNewWordDayBefore: false },
  peek: {
    seconds: [2, 3, 5],
    sbsDefaultMs: 3000, keysMs: 2000, tilesMs: 3000,
    nudgeMs: 10000,
    everyRungLowers: 1,
    test: 1, stretchQuiz: 1,
  },
  stuck: { backs: 3 }, // D25: a word is stuck after 3 step-backs in one sitting (the child asks a grown-up and moves on)
  secure: { days: 2 },
  rows: { first: 2, grow: 1, startBelowBest: 1, startAtAllFrom: 5 },
  est: { secondsPerTry: 25, rowTriesLow: 2, rowTriesHigh: 1.2, fixedMeanings: 1, sentencesPerSitting: 2, calmLineAbovePerDay: 3 },
  meanings: { cards: 3 },
  builder: { levels: { y12: [1], y36: [1, 2, 3] }, normalLevels: [1, 3], minWords: 4, orderCards: { min: 4, max: 6 } },
  mend: { allRunNeeded: 3 },
  ui: { instructionWords: 8, transitionMs: 150, debounceMs: 400, flashMax: 3, tile: { y12: 56, y36: 48, gap: 8 }, boxLetter: 28 },
  pictures: { pollMs: 5000, stopPollMs: 180000, maxWordsPerCall: 15 },
});

export default RULES;
