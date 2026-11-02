// G6, login before play (on: REQUIRE_SIGN_IN in account/config.js). Which
// routes are play routes; account/gate.js decides what a signed-out player sees.
// A signed-out player who presses Play (a chapter's Quick game,
// Practice or Test, or "Pick words" → Play) sees "Sign in to play", and
// comes back to the same game afterwards.
import { REQUIRE_SIGN_IN, mustSignIn } from './account/config.js';

export const isPlayPath = (path) => /^y(34|56)\/ch\d\d\/(quick|practice|test)(\/|$)/.test(path) || path === 'custom/play';
export const needsSignIn = (path, player, flag = REQUIRE_SIGN_IN) => isPlayPath(path) && mustSignIn(player, flag);
