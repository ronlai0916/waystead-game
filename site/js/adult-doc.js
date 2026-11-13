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

/** The Menu's rows, in order. `id` picks the icon. */
export const MENU_ROWS = [
  { id: 'chapters', title: 'More practice', sub: 'Year 3 to Year 6 chapters', href: '#/chapters' },
  { id: 'words', title: 'My words', sub: 'Practise words yourself', href: '#/words' },
  { id: 'custom', title: 'Pick words', sub: 'Choose your own words', href: '#/custom' },
  { id: 'tricky', title: 'Tricky words', sub: 'Words that need another go', href: '#/tricky' },
  { id: 'progress', title: 'Progress', sub: 'Chapters you have passed', href: '#/progress' },
  { id: 'games', title: 'All games', sub: 'Waystead’s other games', href: '../' },
];

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
