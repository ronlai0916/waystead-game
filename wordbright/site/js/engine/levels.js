// Word level (PLAN.md Rev 4): Year 1 … Year 13, Degree, Master, Doctor.
// Each level maps to a band A–I. The band says which list the computer knows
// and which Star-word years count. Children may play any word in the biggest
// list at every level (C3a): about 177,000 British words.
// Computer strength (Easy / Normal / Hard / Crazy) is separate (ai/strength.js).

// Word lists, smallest first, with their ESDB size. Each list holds the one before it.
export const LISTS = { starter: 35, steady: 50, full: 60, large: 70, xlarge: 80 };

// A list's tier in words_all.dawg: its place in LISTS (starter 0 … xlarge 4).
// A word's tier is the smallest list it is in, so "in the full list" is tier <= 2.
export const TIERS = Object.keys(LISTS);
export function listTier(list) {
  const t = TIERS.indexOf(list);
  if (t < 0) throw new Error(`Unknown word list "${list}"`);
  return t;
}

// Star-word years, as in star_words.json.
export const STAR_YEARS = ['1', '2', '3-4', '5-6'];

export const BANDS = {
  A: { computer: { list: 'starter', maxLength: 6 }, starYears: ['1', '2'] },
  B: { computer: { list: 'starter' }, starYears: ['3-4'] },
  C: { computer: { list: 'steady' }, starYears: ['5-6'] },
  D: { computer: { list: 'steady' }, starYears: STAR_YEARS },
  E: { computer: { list: 'full' }, starYears: STAR_YEARS },
  F: { computer: { list: 'full' }, starYears: STAR_YEARS },
  G: { computer: { list: 'large' }, starYears: [] },
  H: { computer: { list: 'large' }, starYears: [] },
  I: { computer: { list: 'xlarge' }, starYears: [] },
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

// Children at every level may play the whole word list.
export const PLAYER_LIST = 'xlarge';

// The list a child at this level may play (the same at every level).
export function playerList(id) {
  level(id); // throws on an unknown level
  return { list: PLAYER_LIST };
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
