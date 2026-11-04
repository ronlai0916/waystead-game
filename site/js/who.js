// Who is at the keyboard, as far as the pages need to know. Set by app.js from
// the account session. An adult playing as themselves is the only 'adult';
// someone playing as a child, or a device still waiting for /api/me (the cached
// player has no kind), is never treated as one.
let read = () => null;
export function useWho(fn) { read = fn; }
const player = () => read();
export const playerName = () => (player() ? player().name : '');
/** 'adult', 'child', or 'unknown' before the account has answered. */
export function kind() {
  const p = player();
  if (!p) return 'none';
  return p.kind === 'adult' || p.kind === 'child' ? p.kind : 'unknown';
}
export const isAdult = () => kind() === 'adult';
