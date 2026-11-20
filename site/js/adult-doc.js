// The adult's top bar, Menu and account panel (SB3-F): the rules with no page in them. Pure.
import { switchUrl, accountUrl, signOutUrl } from './account/config.js';

/** What shared/account/player.js calls an adult who has no display name. Spellbright never shows it as a name. */
export const SHARED_FALLBACK = 'Grown-up';
export const ACCOUNT_LABEL = 'Your account';

/** The adult's own name, or '' when the account has none (blank, or the shared fallback). */
export function adultName(player) {
  const n = player && typeof player.name === 'string' ? player.name.trim() : '';
  return n && n !== SHARED_FALLBACK ? n : '';
}
/** What the chip shows: the name with its initial, or "Your account" with a person glyph. */
export function chipView(player) {
  const n = adultName(player);
  return { named: !!n, label: n || ACCOUNT_LABEL, initial: n ? n.slice(0, 1).toUpperCase() : '', aria: (n || ACCOUNT_LABEL) + '. Account menu' };
}

/** More practice's helper line, from the years that are live (SB4-WP9): "Year 3 to Year 6 chapters", or "Year 1 to Year 6 chapters" once Year 1 is live. */
export function morePracticeSub(years) {
  const ys = (years || []).map((y) => (typeof y === 'string' ? Number(y.replace(/^y/, '')) : y)).filter((y) => y >= 1 && y <= 6); // numbers or ids ('y3')
  const lo = ys.length ? Math.min(...ys) : 3;
  return lo === 6 ? 'Year 6 chapters' : 'Year ' + lo + ' to Year 6 chapters';
}

/** The Menu's rows, in order (SB5): about the children, then the grown-up's own practice. `id` picks the icon. */
export const MENU_ROWS = [
  { id: 'children', title: 'Children', sub: 'Their weeks and results', href: '#/grownups' },
  { id: 'lists', title: 'Word lists', sub: 'Type or scan school spellings', href: '#/grownups/own' },
  { id: 'set', title: 'Set a week', sub: 'Words, children and a test date', href: '#/grownups/set' },
  { id: 'yourself', title: 'Play yourself', sub: 'Your own practice', href: '#/grownups/yourself' },
  { id: 'games', title: 'All games', sub: 'Waystead’s other games', href: '../' },
];

/** The Play yourself page's rows (the adult's own practice; the years sub is filled by `yourselfRows`). */
export const YOURSELF_ROWS = [
  { id: 'chapters', title: 'More practice', sub: morePracticeSub([1, 2, 3, 4, 5, 6]), href: '#/chapters' },
  { id: 'words', title: 'My words', sub: 'Practise words yourself', href: '#/words' },
  { id: 'custom', title: 'Pick words', sub: 'Choose your own words', href: '#/custom' },
  { id: 'tricky', title: 'Your own tricky words', sub: 'Words that need another go', href: '#/tricky' },
  { id: 'progress', title: 'Your own progress', sub: 'Chapters you have passed', href: '#/progress' },
];
export const YOURSELF_TITLE = 'Play yourself';
export const YOURSELF_LEDE = 'Your own practice. Your children’s work is under Children.';

/** The Menu's rows (the same list for every set of years: the years line moved to Play yourself). */
export const menuRows = (years) => { void years; return MENU_ROWS; };
/** The Play yourself rows for the live years (`D.liveYears()` ids or numbers). */
export const yourselfRows = (years) => YOURSELF_ROWS.map((r) => (r.id === 'chapters' ? { ...r, sub: morePracticeSub(years) } : r));

/** The ONE "Play as a child" row's helper: "Play as Robin", "Robin or Wren", "Robin, Wren or Ada", "Robin, Wren, Ada and 2 more". */
export function playAsLine(children) {
  const n = children.map((c) => c.nickname).filter(Boolean);
  if (n.length === 0) return '';
  if (n.length === 1) return 'Play as ' + n[0];
  if (n.length <= 3) return n.slice(0, -1).join(', ') + ' or ' + n[n.length - 1];
  return n.slice(0, 3).join(', ') + ' and ' + (n.length - 3) + ' more';
}

/** The links the account panel offers (all the account's own, as the old chip had them). */
export function accountLinks(origin, here) {
  return { switchHref: switchUrl(origin, here), accountHref: accountUrl(origin, 'adult'), outHref: signOutUrl(origin, here), parentsHref: '#/about' };
}
