// One school year at a time (SB4-WP1): the pure rules that turn the word list's blocks into Years 1 to 6,
// find a chapter from its old id, and choose which years More practice shows. Pure: no DOM, no storage,
// no clock, no random. The views are in front-views.js and data.js passes the curriculum in.

export const YEARS = ['y1', 'y2', 'y3', 'y4', 'y5', 'y6'];
const BLOCKS = { y1: 'year_1', y2: 'year_2', y3: 'year_3_4', y4: 'year_3_4', y5: 'year_5_6', y6: 'year_5_6' };
export const YEAR_INFO = Object.fromEntries(YEARS.map((id, i) => [id, { n: i + 1, block: BLOCKS[id], label: 'Year ' + (i + 1), short: 'Y' + (i + 1) }]));

/** The blocks of the word list, in the order words are loaded: the first entry for a word wins. */
export const LOAD_ORDER = ['year_3_4', 'year_5_6', 'year_1', 'year_2'];

export const APOSTROPHE_NOTE = 'Not included yet: words with an apostrophe.';

const two = (n) => String(n).padStart(2, '0');

/**
 * Group every chapter by school year. Each chapter gets yearId, index (within its year, in file order), n and slug.
 * A chapter without a "year" takes it from its block (Years 3 and 4: the first five chapters are Year 3).
 * Returns { byYear: { y3: [ch] }, byId: Map(id -> ch), live: ['y3', ...] }.
 */
export function buildYears(curriculum) {
  const byYear = {};
  const byId = new Map();
  for (const block of LOAD_ORDER) {
    const chs = (curriculum && curriculum[block] && curriculum[block].chapters) || [];
    chs.forEach((ch, i) => {
      let n = Number(ch.year);
      if (!(n >= 1 && n <= 6)) n = block === 'year_1' ? 1 : block === 'year_2' ? 2 : block === 'year_3_4' ? (i < 5 ? 3 : 4) : (i < 5 ? 5 : 6);
      const yearId = 'y' + n;
      (byYear[yearId] = byYear[yearId] || []).push(ch);
      ch.yearId = yearId;
    });
  }
  for (const id of Object.keys(byYear)) {
    byYear[id].forEach((ch, i) => {
      ch.index = i;
      ch.n = i + 1;
      ch.slug = 'ch' + two(ch.n);
      byId.set(ch.id, ch);
    });
  }
  return { byYear, byId, live: YEARS.filter((id) => byYear[id] && byYear[id].length) };
}

/**
 * An old link (y34/ch07/study, y56) to where it lives now. Returns { href, remember? } or null when the path is not an old one.
 * A chapter is found through its old id, which never changes ('y34-ch07' is now Year 4, Chapter 2).
 */
export function legacyHref(path, byId) {
  const m = /^(y34|y56)(?:\/(ch\d\d)(\/.*)?)?$/.exec(path || '');
  if (!m) return null;
  if (!m[2]) return { href: '#/chapters', remember: m[1] === 'y34' ? 'y3' : 'y5' };
  const ch = byId.get(m[1] + '-' + m[2]);
  if (!ch) return null;
  return { href: '#/' + ch.yearId + '/' + ch.slug + (m[3] || '') };
}

/** A year remembered by an older version ('y34', 'y56') becomes its first year; else the value if it is live, else ''. */
export function mapRemembered(v, live) {
  if (v === 'y34') return 'y3';
  if (v === 'y56') return 'y5';
  return live.includes(v) ? v : '';
}

/** The live year nearest to a school year n (1..6); the lower one when two are as near. */
function nearestLive(n, live) {
  if (!live.length) return '';
  const id = 'y' + n;
  if (live.includes(id)) return id;
  let best = live[0];
  for (const l of live) if (Math.abs(YEAR_INFO[l].n - n) < Math.abs(YEAR_INFO[best].n - n)) best = l;
  return best;
}

/**
 * The year buttons. An adult, or a child whose year is not known (0): every live year in main, none in more.
 * A child with a year: their own year and the next in main (the last two when it is the last), the rest in more.
 */
export function yearTabs(childYear, adult, live) {
  if (adult || !childYear || childYear < 1 || childYear > 6 || live.length <= 2) return { main: [...live], more: [] };
  const own = nearestLive(childYear, live);
  const at = live.indexOf(own);
  const main = at < live.length - 1 ? [own, live[at + 1]] : [live[at - 1], own];
  return { main, more: live.filter((id) => !main.includes(id)) };
}

/** Which year the page opens on: the remembered one, else the child's year, else the first year being worked in, else Year 3. */
export function pickYear(remembered, views, childYear, live = Object.keys(views)) {
  if (remembered && live.includes(remembered)) return remembered;
  if (childYear >= 1 && childYear <= 6) { const y = nearestLive(childYear, live); if (y) return y; }
  const carry = live.find((id) => views[id] && views[id].mode === 'carry');
  if (carry) return carry;
  return live.includes('y3') || !live.length ? 'y3' : live[0];
}

/** "Chapter 4 — Silent letters" -> "Silent letters". */
export const chapterName = (ch) => String(ch.title || '').replace(/^Chapter\s+\d+\s+[—-]\s+/, '');

/** Where a chapter's statutory words come from, said for a grown-up to read; '' when there is nothing to say. */
export function sourceLine(yearN, set) {
  if (set === 'cew') return yearN === 1 || yearN === 2 ? 'Year ' + yearN + ' common exception words (statutory)' : '';
  if (set && set !== 'statutory') return '';
  if (yearN === 3 || yearN === 4) return 'From the Years 3 and 4 statutory word list (we split it into two years)';
  if (yearN === 5 || yearN === 6) return 'From the Years 5 and 6 statutory word list (we split it into two years)';
  return '';
}

/** Where a chapter's pattern words come from. */
export function patternLabel(yearN, focus) {
  const rule = yearN === 1 || yearN === 2 ? 'Year ' + yearN : yearN === 3 || yearN === 4 ? 'Years 3 and 4' : 'Years 5 and 6';
  return "Pattern words: our examples for the " + rule + " rule '" + focus + "'";
}
