// G6, login before play (on: REQUIRE_SIGN_IN in account/config.js); G6b:
// signed out, every page is locked except About (For parents), and shows
// "Sign in to play" (account/gate.js), coming back to the same page after.
// Play routes are the games themselves: there the page is busy (boot.js).
import { REQUIRE_SIGN_IN, mustSignIn } from './account/config.js';

// The one page open to a signed-out player.
export const isOpenPath = (path) => path === 'about';
export const isLocked = (path) => !isOpenPath(path);
export const isPlayPath = (path) => /^y(34|56)\/ch\d\d\/(quick|practice|test)(\/|$)/.test(path) || path === 'custom/play';
export const needsSignIn = (path, player, flag = REQUIRE_SIGN_IN) => isPlayPath(path) && mustSignIn(player, flag);
