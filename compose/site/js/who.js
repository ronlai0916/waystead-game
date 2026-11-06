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
