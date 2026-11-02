// G6, login before play (off for now: REQUIRE_SIGN_IN in account/config.js).
// When it is on, a signed-out player who presses New game, Continue game or
// a board card is sent to sign in first, and comes back here afterwards.
import { REQUIRE_SIGN_IN, mustSignIn } from './account/config.js';

export const isPlayPath = (path) => path === 'new' || path === 'play';
export const needsSignIn = (path, player, flag = REQUIRE_SIGN_IN) => isPlayPath(path) && mustSignIn(player, flag);
