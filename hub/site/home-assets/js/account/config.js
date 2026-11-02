// Waystead Account settings shared by the home page, Spellbright and Wordbright.
// THIS FILE IS A COPY: edit shared/account/ and run `node tools/sync-shared.mjs`.

// G6, login before play. Off: signed out, the games work exactly as before.
// On: the Play buttons send a signed-out player to sign in first.
export const REQUIRE_SIGN_IN = false;

export const ACCOUNT_ORIGIN = 'https://account.waystead.co.uk';
// The account service's dev server, used when the game itself runs on localhost.
export const DEV_ACCOUNT_ORIGIN = 'http://localhost:3000';

export function accountOrigin(loc) {
  const host = loc && loc.hostname;
  return host === 'localhost' || host === '127.0.0.1' ? DEV_ACCOUNT_ORIGIN : ACCOUNT_ORIGIN;
}

// Where the chip's links go. `returnUrl` is this page; the account service
// sends the player back to it (its return allow-list: https on waystead.co.uk).
export const signInUrl = (origin, returnUrl) => origin + '/signin?return=' + encodeURIComponent(returnUrl);
export const switchUrl = (origin, returnUrl) => origin + '/play?return=' + encodeURIComponent(returnUrl);
// A child's own page is /child; an adult's is /account. Each has the Sign out button.
export const accountUrl = (origin, kind) => origin + (kind === 'child' ? '/child' : '/account');
// Asks "Sign out of Waystead?"; its button signs out and comes back here with ?signedout=1.
export const signOutUrl = (origin, returnUrl) => origin + '/signout?return=' + encodeURIComponent(returnUrl);

// G6: must this (signed-out) player sign in before a game starts?
export const mustSignIn = (player, flag = REQUIRE_SIGN_IN) => !!flag && !player;
