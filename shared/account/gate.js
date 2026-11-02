// G6, login before play: what a game page shows for a route.
// THIS FILE IS A COPY: edit shared/account/ and run `node tools/sync-shared.mjs`.
//
// gateFor() answers (play: is this page locked for a signed-out player? G6b:
// every game page is, apart from How to play and For parents / About):
//   'play'     show the page: not locked, the flag is off, or a player is
//              known (the device's cached one counts, so a signed-in child
//              plays offline and progress waits in the queue);
//   'signin'   nobody is signed in: the "Sign in to play" card;
//   'offline'  nobody is signed in and the account can't be reached (no
//              network, or the service is down): the first sign-in needs it;
//   'wait'     nobody cached and /api/me hasn't answered yet.
import { REQUIRE_SIGN_IN } from './config.js';

export function gateFor({ play, player, reach = 'unknown', flag = REQUIRE_SIGN_IN }) {
  if (!flag || !play || player) return 'play';
  if (reach === 'online') return 'signin';
  if (reach === 'offline') return 'offline';
  return 'wait';
}

export const GATE_TEXT = {
  signin: { title: 'Sign in to play', line: 'Sign in to play — your progress is saved to your account.', button: 'Sign in' },
  offline: { title: 'You need to be online', line: 'You need to be online the first time you sign in. Connect to the internet, then try again.', button: 'Try again' },
  down: { title: 'Sign-in isn’t answering', line: 'We can’t reach Waystead sign-in just now. Please try again in a minute.', button: 'Try again' },
  wait: { title: 'Just a moment', line: 'Checking who is playing…' },
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The card both games show in place of a locked page. kind: 'signin',
// 'offline', 'down' or 'wait'. signInHref: the account's /signin with this
// page as the return URL. "Try again" is a [data-gate-retry] button. back: the
// open page to offer instead ({ href, label }: How to play, About).
export function gateHtml(kind, signInHref = '', back = { href: '#/about', label: 'About this game' }) {
  const t = GATE_TEXT[kind];
  const action = kind === 'signin'
    ? '<a class="btn btn--primary" href="' + esc(signInHref) + '" data-gate-signin>' + esc(t.button) + '</a>'
    : kind === 'wait' ? '' : '<button type="button" class="btn btn--primary" data-gate-retry>' + esc(t.button) + '</button>';
  return '<section class="wrap page"><div class="card empty" data-gate="' + kind + '"><h1>' + esc(t.title) + '</h1>'
    + '<p class="muted">' + esc(t.line) + '</p>'
    + (action ? '<div class="btnrow">' + action + '<a class="btn btn--ghost" href="' + esc(back.href) + '">' + esc(back.label) + '</a></div>' : '')
    + '</div></section>';
}

// Which card for a gate answer: 'offline' is split by the device's own
// network flag into "you need to be online" and "sign-in isn't answering".
export const gateCard = (answer, onLine) => (answer === 'offline' ? (onLine === false ? 'offline' : 'down') : answer);
