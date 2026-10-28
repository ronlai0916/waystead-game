// Word level (PLAN.md Rev 4): Year 1 … Year 13, Degree, Master, Doctor.
// Each level maps to a band A–I. The band says which list the player may
// play, which list the computer knows, and which Star-word years count.
// Computer strength (Easy / Normal / Hard / Crazy) is separate (C3).

// Word lists, smallest first, with their ESDB size. Each list holds the one before it.
export const LISTS = { starter: 35, steady: 50, full: 60, large: 70, xlarge: 80 };

// Star-word years, as in star_words.json.
export const STAR_YEARS = ['1', '2', '3-4', '5-6'];

export const BANDS = {
  A: { computer: { list: 'starter', maxLength: 6 }, player: 'full', starYears: ['1', '2'] },
  B: { computer: { list: 'starter' }, player: 'full', starYears: ['3-4'] },
  C: { computer: { list: 'steady' }, player: 'full', starYears: ['5-6'] },
  D: { computer: { list: 'steady' }, player: 'full', starYears: STAR_YEARS },
  E: { computer: { list: 'full' }, player: 'full', starYears: STAR_YEARS },
  F: { computer: { list: 'full' }, player: 'large', starYears: STAR_YEARS },
  G: { computer: { list: 'large' }, player: 'large', starYears: [] },
  H: { computer: { list: 'large' }, player: 'xlarge', starYears: [] },
  I: { computer: { list: 'xlarge' }, player: 'xlarge', starYears: [] },
};

const YEAR_BANDS = ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'D', 'E', 'E', 'F', 'F'];

export const LEVELS = [
  ...YEAR_BANDS.map((band, i) => ({ id: `year-${i + 1}`, label: `Year ${i + 1}`, band })),
  { id: 'degree', label: 'Degree', band: 'G' },
  { id: 'master', label: 'Master', band: 'H' },
  { id: 'doctor', label: 'Doctor', band: 'I' },
];

export function level(id) {
  const found = LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`Unknown word level "${id}"`);
  return { ...found, ...BANDS[found.band] };
}

// The list a child at this level may play.
export function playerList(id) {
  return { list: level(id).player };
}

// The list the computer knows at this level ({ list, maxLength? }).
export function computerList(id) {
  return { ...level(id).computer };
}

// The Star words that count at this level, as a Set of words.
// starWords is star_words.json; each word has "years", a list such as ["2", "3-4"].
export function starSet(id, starWords) {
  const years = new Set(level(id).starYears);
  return new Set(starWords.filter((s) => s.years.some((y) => years.has(y))).map((s) => s.word));
}
