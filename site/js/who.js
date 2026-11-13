// Who is at the keyboard, as far as the pages need to know. Set by app.js from
// the account session. An adult playing as themselves is the only 'adult';
// someone playing as a child, or a device still waiting for /api/me (the cached
// player has no kind), is never treated as one.
let read = () => null;
let ask = () => Promise.resolve();
export function useWho(fn, recheck = ask) { read = fn; ask = recheck; }
/** Ask the account again: a route has said something the page didn't know. */
export const recheckWho = () => ask();
const player = () => read();
export const playerName = () => (player() ? player().name : '');
/** 'adult', 'child', or 'unknown' before the account has answered. */
export function kind() {
  const p = player();
  if (!p) return 'none';
  return p.kind === 'adult' || p.kind === 'child' ? p.kind : 'unknown';
}
export const isAdult = () => kind() === 'adult';
/** An adult playing as one of their children (a child's own session can't switch). */
export const playingAsChild = () => { const p = player(); return !!p && p.kind === 'child' && p.canSwitch === true; };
/** The child's top bar and pages (SB3-C1) need the kind to be known: only 'child'. 'unknown' keeps today's full top bar. */
export const isKnownChild = () => kind() === 'child';
/** A child's screens (SB3-C1): a signed-in child, or a device still waiting for /api/me. */
export const isChild = () => kind() === 'child' || kind() === 'unknown';

const YEAR_KEY = 'sb.year:';
const asYear = (v) => (Number.isInteger(v) && v >= 1 && v <= 6 ? v : 0);
/**
 * The signed-in child's school year, 1..6, else 0 (SB4). The live player carries `year`
 * once /api/me has answered; it is remembered as `sb.year:<player id>` so a cached player
 * (before /api/me answers, or offline) still has it. An adult not playing as a child, and a
 * signed-out visitor, have none.
 */
export function childYear() {
  const p = player();
  if (!p || !isChild()) return 0;
  const live = asYear(p.year);
  try {
    const ls = globalThis.localStorage;
    if (live) { ls.setItem(YEAR_KEY + p.id, String(live)); return live; }
    return asYear(Number(ls.getItem(YEAR_KEY + p.id)));
  } catch (e) { return live; }
}
