// G6, login before play (off for now: REQUIRE_SIGN_IN in account/config.js).
// When it is on, a signed-out player who presses Play (a chapter's Quick game,
// Practice or Test, or "Pick words" → Play) is sent to sign in first, and
// comes back to the same game afterwards.
import { REQUIRE_SIGN_IN, mustSignIn } from './account/config.js';

export const isPlayPath = (path) => /^y(34|56)\/ch\d\d\/(quick|practice|test)(\/|$)/.test(path) || path === 'custom/play';
export const needsSignIn = (path, player, flag = REQUIRE_SIGN_IN) => isPlayPath(path) && mustSignIn(player, flag);
