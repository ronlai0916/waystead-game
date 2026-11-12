// The child's chosen week (SB3-C1b): a DEVICE preference only, "sb.week:<player id>" = a group id.
// Never saved to the account. Forgotten at sign-out with the player's other cached copies
// (shared/account/forget.js). Cleared by the home when it no longer applies.
import * as S from './store.js';

const key = () => (S.currentPlayer() ? 'sb.week:' + S.currentPlayer() : '');

export function getWeek() {
  try { const k = key(); return k ? localStorage.getItem(k) || '' : ''; } catch (e) { return ''; }
}
export function setWeek(id) {
  try { const k = key(); if (!k) return; if (id) localStorage.setItem(k, id); else localStorage.removeItem(k); } catch (e) { /* private mode: the home shows its own pick */ }
}
