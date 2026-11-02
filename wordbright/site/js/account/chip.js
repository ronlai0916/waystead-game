// The player chip in the top bar. Signed out: "Sign in".
// Signed in: the player's picture (or initial) and name, opening a menu:
// Switch player (an adult's session), My account, Sign out.
// THIS FILE IS A COPY: edit shared/account/ and run `node tools/sync-shared.mjs`.
//
// It uses the top bar's own classes (.iconbtn, .themebtn and the look menu's
// .thememenu__list/__item) and the .playerchip block in each site's CSS, which
// uses only existing tokens: each style's colours and fonts, no new ones. The menu is a menu button (WAI-ARIA APG), as the look menu.
import { signInUrl, switchUrl, accountUrl, signOutUrl } from './config.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PERSON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
const ICONS = {
  switch: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v14M3 14l4 4 4-4M17 20V6M13 10l4-4 4 4"/></svg>',
  account: PERSON,
  out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M10 16l-4-4 4-4M6 12h10"/></svg>',
};
const SPACER = '<svg class="thememenu__tick" viewBox="0 0 24 24" aria-hidden="true"></svg>';

export function chipHtml(player, origin, here) {
  if (!player) {
    return '<a class="iconbtn playerchip playerchip--out" href="' + esc(signInUrl(origin, here)) + '" aria-label="Sign in">'
      + PERSON + '<span class="playerchip__text">Sign in</span></a>';
  }
  const face = player.avatar
    ? '<img class="playerchip__face" src="' + esc(player.avatar) + '" alt="" width="28" height="28" referrerpolicy="no-referrer">'
    : '<span class="playerchip__face playerchip__initial" aria-hidden="true">' + esc(player.name.slice(0, 1).toUpperCase()) + '</span>';
  const items = [
    player.canSwitch !== false && ['switch', 'Switch player', switchUrl(origin, here)],
    ['account', 'My account', accountUrl(origin, player.kind)],
    ['out', 'Sign out', signOutUrl(origin, here)],
  ].filter(Boolean);
  return '<button type="button" class="iconbtn themebtn playerchip playerchip--in" id="player" aria-haspopup="menu" aria-expanded="false" aria-controls="player-menu"'
    + ' aria-label="Playing as ' + esc(player.name) + '. Player menu">' + face
    + '<span class="playerchip__name" aria-hidden="true">' + esc(player.name) + '</span></button>'
    + '<div class="thememenu__list" id="player-menu" role="menu" aria-label="Player" hidden>'
    + items.map(([id, label, href]) => '<a class="thememenu__item" role="menuitem" tabindex="-1" data-item="' + id + '" href="' + esc(href) + '">'
      + SPACER + '<span class="thememenu__ico" aria-hidden="true">' + ICONS[id] + '</span>' + esc(label) + '</a>').join('')
    + '</div>';
}

// btn opens menu; returns a function that stops listening.
export function wireMenu(btn, menu, doc) {
  const items = [...menu.querySelectorAll('[role="menuitem"]')];
  const isOpen = () => btn.getAttribute('aria-expanded') === 'true';
  const focusItem = (i) => {
    const k = (i + items.length) % items.length;
    items.forEach((it, j) => { it.tabIndex = j === k ? 0 : -1; });
    items[k].focus();
  };
  const open = (at = 0) => { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); focusItem(at); };
  const close = (back = true) => {
    if (!isOpen()) return;
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (back) btn.focus();
  };
  const onBtnClick = () => (isOpen() ? close() : open());
  const onBtnKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); open(items.length - 1); }
  };
  const onMenuKey = (e) => {
    const i = items.indexOf(e.target);
    if (i < 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusItem(0); }
    else if (e.key === 'End') { e.preventDefault(); focusItem(items.length - 1); }
    else if (e.key === ' ') { e.preventDefault(); e.target.click(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') close(false);
  };
  const onDocDown = (e) => { if (isOpen() && !menu.contains(e.target) && !btn.contains(e.target)) close(false); };
  const onDocKey = (e) => { if (e.key === 'Escape' && isOpen()) close(); };
  btn.addEventListener('click', onBtnClick);
  btn.addEventListener('keydown', onBtnKey);
  menu.addEventListener('keydown', onMenuKey);
  doc.addEventListener('pointerdown', onDocDown);
  doc.addEventListener('keydown', onDocKey);
  return () => {
    btn.removeEventListener('click', onBtnClick);
    btn.removeEventListener('keydown', onBtnKey);
    menu.removeEventListener('keydown', onMenuKey);
    doc.removeEventListener('pointerdown', onDocDown);
    doc.removeEventListener('keydown', onDocKey);
  };
}

// slot: an empty .thememenu.playermenu element in the top bar.
export function mountChip(slot, { session, origin, win, doc }) {
  let unwire = null;
  function render() {
    if (unwire) { unwire(); unwire = null; }
    slot.innerHTML = chipHtml(session.player, origin, win.location.href);
    const btn = slot.querySelector('#player');
    const menu = slot.querySelector('#player-menu');
    if (btn && menu) unwire = wireMenu(btn, menu, doc);
  }
  // The links carry this page as the way back, so keep them current.
  const onHash = () => {
    slot.querySelectorAll('a[href]').forEach((a) => {
      const item = a.dataset.item;
      if (!item) a.href = signInUrl(origin, win.location.href);
      else if (item === 'switch') a.href = switchUrl(origin, win.location.href);
      else if (item === 'out') a.href = signOutUrl(origin, win.location.href);
    });
  };
  win.addEventListener('hashchange', onHash);
  render();
  return { render };
}
