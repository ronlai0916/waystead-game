// G6, login before play (on: REQUIRE_SIGN_IN in account/config.js). Which
// routes are play routes; account/gate.js decides what a signed-out player sees.
// A signed-out player who presses New game, Continue game or
// a board card sees "Sign in to play", and comes back here afterwards.
import { REQUIRE_SIGN_IN, mustSignIn } from './account/config.js';

export const isPlayPath = (path) => path === 'new' || path === 'play';
export const needsSignIn = (path, player, flag = REQUIRE_SIGN_IN) => isPlayPath(path) && mustSignIn(player, flag);
