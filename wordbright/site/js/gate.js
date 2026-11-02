// G6, login before play (on: REQUIRE_SIGN_IN in account/config.js); G6b:
// signed out, every page is locked except How to play and For parents, and
// shows "Sign in to play" (account/gate.js), coming back to the same page after.
// Play routes are New game and the game itself.
import { REQUIRE_SIGN_IN, mustSignIn } from './account/config.js';

// The pages open to a signed-out player.
export const isOpenPath = (path) => path === 'rules' || path === 'about';
export const isLocked = (path) => !isOpenPath(path);
export const isPlayPath = (path) => path === 'new' || path === 'play';
export const needsSignIn = (path, player, flag = REQUIRE_SIGN_IN) => isPlayPath(path) && mustSignIn(player, flag);
