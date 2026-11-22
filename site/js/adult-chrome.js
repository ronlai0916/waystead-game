// The adult's top bar on Spellbright (SB3-F): the mark with a "Grown-ups" tag, one Menu button and the account chip.
// Only for a signed-in adult who is not playing as a child (who.js 'adult'); body.is-adult gates it (css/adult.css), so a
// signed-out visitor, a child, and the other products' shared top bar (nav/nav.js) are unchanged. The old links, All games
// and the look menu stay in the page (hidden), where the shared code measures them.
//
// Menu and the account chip are disclosures: a button with aria-expanded and aria-controls, a panel below the bar (a bottom
// sheet under 600 px), a dialog while open: focus goes in, Tab stays in, Escape or Close returns it, the page behind is inert,
// and a route change closes it.
import { esc } from './ui.js';
import * as A from './grownups-data.js';
import * as D from './adult-doc.js';
import * as RD from './role-doc.js'; // SB5 WP-C: the Menu rows and words per role
import { createRoleStore } from './role-data.js';
import { CHOICES, currentChoice, choose } from './thememenu.js';
import { announce } from './daystyle.js';
import { voiceCardHtml, roving, childTools } from './child-views.js';
import { MORE } from './voice/menu.js';
import { accountOrigin } from './account/config.js';

const $ = (id) => document.getElementById(id);
const svg = (inner) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + inner + '</svg>';
const I = {
  chev: svg('<path d="M9 6l6 6-6 6"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  person: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>'),
  chapters: svg('<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h6a3 3 0 0 1 0 6H10a3 3 0 0 0 0 6h6"/>'),
  words: svg('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>'),
  own: svg('<path d="M6 3.5h8l4 4V20.5H6z"/><path d="M14 3.5v4h4M12 11v6M9 14h6"/>'),
  teach: svg('<rect x="3.5" y="4" width="17" height="11" rx="1.5"/><path d="M8 8.5h8M8 11.5h5M12 15v2.5M8 20.5l4-3 4 3"/>'),
  custom: svg('<path d="M4 20l1-4L16 5l3 3L8 19z"/>'),
  tricky: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5M12 16h.01"/>'),
  progress: svg('<path d="M6 20V10M12 20V4M18 20v-7"/>'),
  games: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'),
  parents: svg('<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>'),
  out: svg('<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9"/>'),
  swap: svg('<path d="M7 4v14M3 14l4 4 4-4M17 20V6M13 10l4-4 4 4"/>'),
  kids: svg('<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.5a3 3 0 0 1 0 5.5M18 14.8c1.8.7 3 2.4 3 5.2"/>'),
  children: svg('<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.5a3 3 0 0 1 0 5.5M18 14.8c1.8.7 3 2.4 3 5.2"/>'),
  lists: svg('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>'),
  set: svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
  help: svg('<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>'),
  yourself: svg('<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z"/>'),
};

let tools = { origin: () => '', player: () => null, prefs: () => null };
/** app.js gives the origin, the player and (SB5) the account's prefs sync, so the role is kept in the account (TR-80). Without prefs: this device only. */
export const useAdultTools = (t) => { tools = { ...tools, ...t }; };

/** The role store for the signed-in grown-up (account copy through the prefs sync, device copy as the first paint), or null with no player. */
export function roleStore() {
  const p = tools.player();
  const id = p && p.id ? String(p.id) : '';
  if (!id) return null;
  try {
    return createRoleStore({ storage: window.localStorage, playerId: id, prefs: tools.prefs ? tools.prefs() : null });
  } catch (e) { return null; }
}
/** parent, tutor or teacher: the saved role, parent when nothing is chosen. */
export const currentRole = () => { const s = roleStore(); return s ? s.role() : 'parent'; };
/** The name children see ("Mum"), or ''. */
export const currentName = () => { const s = roleStore(); return s ? s.name() : ''; };
/** Draw the Menu and the Account sheet again (the role or the name has changed). */
export function roleChanged() { if (panels.menu) panels.menu.innerHTML = menuHtml(); drawAccount(); }

let layer = null;
let panels = {};
let openKind = null;
let opener = null;
let undoInert = () => {};
let children = null; // the account's list for the switch rows: an array, 'failed', or null (not asked yet)
let api = null;
const childApi = () => { if (!api) api = A.createChildApi({ origin: accountOrigin(location) }); return api; };
const here = () => location.href;

const row = (href, ico, title, sub, extra = '') => '<a class="adultrow" href="' + esc(href) + '"' + extra + '><span class="adultrow__ico">' + ico + '</span><span class="adultrow__text"><b>' + esc(title) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</span><span class="adultrow__go" aria-hidden="true">' + I.chev + '</span></a>';
const head = (id, title) => '<div class="adultpanel__head"><h2 id="' + id + '">' + esc(title) + '</h2><button type="button" class="btn btn--ghost adultclose" data-adult-close>' + I.close + 'Close</button></div>';

const ROLE_NAME = { parent: 'Parent', tutor: 'Tutor', teacher: 'Teacher' };
const WHO = { parent: 'Children', tutor: 'Learners', teacher: 'The class' };
// The Menu's helper lines (final design 06a, 06at, 06au): the rows themselves come from role-doc menuRows(role).
const MENU_SUB = { lists: 'Yours, and Year 1 to 6', help: 'How each one spells', yourself: 'Your own spelling practice', games: 'More Waystead games' };
const SET_SUB = { parent: 'Words, children and a test date', tutor: 'One learner at a time', teacher: 'One list, one date' };
/** "Ada, Ben and Cy", "Ada, Ben, Cy and 2 more"; a teacher's class is a count: "5 children". '' until the account's list has come. */
function kidsSub(role) {
  if (!Array.isArray(children) || !children.length) return '';
  if (role === 'teacher') return children.length + (children.length === 1 ? ' child' : ' children');
  const n = children.map((c) => c.nickname).filter(Boolean);
  return n.length <= 3 ? (n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n[0]) : n.slice(0, 3).join(', ') + ' and ' + (n.length - 3) + ' more';
}
const hereHash = () => { const h = String(location.hash || '').split('?')[0]; return h === '' || h === '#' || h === '#/' ? '#/grownups' : h; };

function menuHtml() {
  const role = currentRole();
  return head('adult-menu-title', 'Menu') + '<nav aria-label="Menu"><ul class="adultlist">'
    + RD.menuRows(role).map((r) => {
      const sub = r.id === 'children' ? (kidsSub(role) || r.sub) : r.id === 'set' ? SET_SUB[role] : (MENU_SUB[r.id] || r.sub);
      return '<li>' + row(r.href, I[r.id], r.title, sub, ' data-adultrow="' + r.id + '"' + (hereHash() === r.href ? ' aria-current="page"' : '')) + '</li>';
    }).join('') + '</ul></nav>';
}

function accountHtml() {
  const p = tools.player();
  const v = D.chipView(p);
  const links = D.accountLinks(tools.origin(), here());
  const face = v.named ? '<span class="adultface" aria-hidden="true">' + esc(v.initial) + '</span>' : '<span class="adultface adultface--plain" aria-hidden="true">' + I.person + '</span>';
  let kids = '';
  if (Array.isArray(children) && children.length) {
    kids = row(links.switchHref, I.swap, 'Play as a child', D.playAsLine(children), ' data-switch="any"');
  } else if (children === 'failed' && p && p.canSwitch !== false) {
    kids = row(links.switchHref, I.swap, 'Switch player', 'Choose a child', ' data-switch="any"');
  }
  const looks = CHOICES.map((c) => '<button type="button" class="choice" role="radio" aria-checked="' + (c.id === currentChoice()) + '" tabindex="' + (c.id === currentChoice() ? 0 : -1) + '" data-choice="' + c.id + '">' + esc(c.label) + '</button>').join('');
  const voice = voiceCardHtml();
  return head('adult-account-title', 'Account') + '<div class="adultwho">' + face + '<span><b>' + esc(v.label) + '</b><span>Signed in with Waystead</span></span></div>'
    + '<ul class="adultlist adultlist--tight">' + (kids ? '<li>' + kids + '</li>' : '') + '<li>' + row(links.accountHref, I.kids, 'Your account', 'Children, password and sign-in', ' data-account') + '</li></ul>'
    + '<h3 class="adultpanel__h" id="adult-look-h">Look</h3><div class="choices adultlooks" role="radiogroup" aria-labelledby="adult-look-h" data-looks>' + looks + '</div>'
    + (voice ? '<div class="adultvoice" data-voicecard>' + voice + '</div>' : '<div class="adultvoice" data-voicecard hidden></div>')
    + roleRowsHtml()
    + '<ul class="adultlist adultlist--rule"><li>' + row(links.parentsHref, I.parents, 'How Spellbright works', 'For parents, teachers and tutors', ' data-parents') + '</li>'
    + '<li>' + row(links.outHref, I.out, 'Sign out', '', ' data-signout') + '</li></ul>'
    + '<p class="small devlink"><a href="#/device" data-devicelink>About this device</a></p>';
}

/** Your role: "I use Spellbright as: Parent" and "Children see: Set by Mum", both to #/grownups/role (the change page). */
function roleRowsHtml() {
  const role = currentRole();
  const name = currentName();
  return '<h3 class="adultpanel__h" id="adult-role-h">Your role</h3><ul class="adultlist adultlist--tight" aria-labelledby="adult-role-h">'
    + '<li>' + row('#/grownups/role', I.person, 'I use Spellbright as: ' + ROLE_NAME[role], 'Change', ' data-role') + '</li>'
    + '<li>' + row('#/grownups/role', I.person, WHO[role] + ' see: ' + (name ? 'Set by ' + name : RD.WORDS[role].seen), 'Change', ' data-rolename') + '</li></ul>';
}

function drawAccount() {
  const panel = panels.account;
  if (!panel || panel.hidden) return;
  const keep = panel.contains(document.activeElement) ? (document.activeElement.dataset.choice || document.activeElement.dataset.voice || (document.activeElement.hasAttribute('data-more') ? '+more' : null)) : null;
  panel.innerHTML = accountHtml();
  if (keep) {
    const b = panel.querySelector(keep === '+more' ? '[data-more]' : '[data-choice="' + CSS.escape(keep) + '"], [data-voice="' + CSS.escape(keep) + '"]');
    if (b) b.focus();
  }
}

function setTop() {
  const bar = document.querySelector('.topbar');
  layer.style.setProperty('--adult-top', Math.round(bar.getBoundingClientRect().bottom + 6) + 'px');
}
const focusables = (panel) => [...panel.querySelectorAll('a[href], button:not([disabled])')].filter((e) => e.getClientRects().length);

export function closePanel(returnFocus = true) {
  if (!openKind) return false;
  const btn = opener;
  const panel = panels[openKind];
  openKind = null;
  opener = null;
  panel.hidden = true;
  panel.removeAttribute('role'); // a dialog only while open
  panel.removeAttribute('aria-modal');
  if (panel === panels.account) panel.innerHTML = ''; // nothing from the account panel lingers in the page when closed
  layer.hidden = true;
  undoInert();
  undoInert = () => {};
  document.removeEventListener('keydown', onKey, true);
  ['adult-menu-btn', 'adult-chip'].forEach((id) => { const b = $(id); if (b) b.setAttribute('aria-expanded', 'false'); });
  if (returnFocus && btn && btn.isConnected) btn.focus();
  return true;
}

function onKey(e) {
  if (!openKind) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePanel(); return; }
  if (e.key !== 'Tab') return;
  const panel = panels[openKind];
  if (!panel.contains(document.activeElement)) return; // the bar's own buttons keep their normal order
  const items = focusables(panel);
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function openPanel(kind, btn) {
  if (openKind) closePanel(false);
  openKind = kind;
  opener = btn;
  if (kind === 'account') { panels.account.innerHTML = accountHtml(); loadChildren(); }
  if (kind === 'menu') { panels.menu.innerHTML = menuHtml(); if (children === null) loadChildren(); }
  setTop();
  layer.hidden = false;
  panels[kind].hidden = false;
  panels[kind].setAttribute('role', 'dialog');
  panels[kind].setAttribute('aria-modal', 'true');
  btn.setAttribute('aria-expanded', 'true');
  const bar = document.querySelector('.topbar');
  const behind = [...document.body.children].filter((el) => el !== layer && el !== bar && !el.matches('script, #toast'));
  behind.forEach((el) => el.setAttribute('inert', ''));
  undoInert = () => behind.forEach((el) => el.removeAttribute('inert'));
  document.addEventListener('keydown', onKey, true);
  const close = panels[kind].querySelector('[data-adult-close]');
  if (close) close.focus();
}

async function loadChildren() {
  const r = await A.listChildren(childApi());
  children = r.children ? r.children : 'failed';
  drawAccount();
  if (openKind === 'menu') {
    const at = panels.menu.contains(document.activeElement) ? document.activeElement : null;
    const key = at ? (at.getAttribute('data-adultrow') || (at.hasAttribute('data-adult-close') ? '+close' : '')) : '';
    panels.menu.innerHTML = menuHtml();
    const again = key === '+close' ? panels.menu.querySelector('[data-adult-close]') : key ? panels.menu.querySelector('[data-adultrow="' + key + '"]') : null;
    if (again) again.focus();
  }
}

function wirePanels() {
  layer = document.createElement('div');
  layer.className = 'adultlayer';
  layer.id = 'adult-layer';
  layer.hidden = true;
  layer.innerHTML = '<div class="adultlayer__back" data-adult-back></div>'
    + '<div class="adultpanel adultpanel--menu" id="adult-menu-panel" aria-labelledby="adult-menu-title" hidden></div>'
    + '<div class="adultpanel adultpanel--account" id="adult-account-panel" aria-labelledby="adult-account-title" hidden></div>';
  document.body.append(layer);
  panels = { menu: layer.querySelector('#adult-menu-panel'), account: layer.querySelector('#adult-account-panel') };
  panels.menu.innerHTML = menuHtml();
  layer.addEventListener('click', (e) => {
    if (e.target.closest('[data-adult-close]') || e.target.matches('[data-adult-back]')) { closePanel(); return; }
    if (e.target.closest('a[href]')) { closePanel(false); chose = !!e.target.closest('a[href^="#/"]'); return; }
    const ch = e.target.closest('[data-choice]');
    if (ch) { choose(ch.dataset.choice); announce(); return; }
    const t = childTools();
    const vo = e.target.closest('[data-voice]');
    if (vo) { if (vo.getAttribute('aria-disabled') !== 'true' && t.voice()) { t.voice().pick(vo.dataset.voice); drawAccount(); } return; }
    if (e.target.closest('[data-more]') && t.voice()) { t.voice().pick(MORE); drawAccount(); }
  });
  roving(panels.account, 'data-choice', (b) => { b.focus(); choose(b.dataset.choice); announce(); });
  roving(panels.account, 'data-voice', (b) => { b.focus(); b.click(); });
  document.addEventListener('sb:look', drawAccount); // Match device, For parents, another tab: tick the saved look
  window.addEventListener('hashchange', () => {
    closePanel(false);
    if (!chose) return;
    chose = false; // a row was chosen: the new page's heading takes focus, as settleFocus does for the child
    keepHeadingFocus();
  });
  const sp = childTools().speaker();
  if (sp && sp.onVoices) sp.onVoices(drawAccount);
  $('adult-menu-btn').addEventListener('click', (e) => (openKind === 'menu' ? closePanel() : openPanel('menu', e.currentTarget)));
  $('adult-chip').addEventListener('click', (e) => (openKind === 'account' ? closePanel() : openPanel('account', e.currentTarget)));
}

/**
 * S3-D6/D7: a page reached from a Menu row draws in steps (a loading card, then the answer), and each redraw can drop focus on <main>
 * or <body>. For a moment after the choice, whenever focus is lost like that the page's h1 takes it; any key or tap by the person ends it.
 */
function keepHeadingFocus() {
  const mainEl = document.querySelector('main');
  if (!mainEl) return;
  let done = false;
  let obs = null;
  const focusH1 = () => {
    const h = mainEl.querySelector('h1');
    if (!h) return;
    const a = document.activeElement;
    if (a === h || (a && a !== document.body && a !== mainEl && a.isConnected && mainEl.contains(a))) return;
    h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
  };
  const stop = () => {
    if (done) return;
    done = true;
    if (obs) obs.disconnect();
    document.removeEventListener('keydown', stop, true);
    document.removeEventListener('pointerdown', stop, true);
  };
  document.addEventListener('keydown', stop, true);
  document.addEventListener('pointerdown', stop, true);
  if (typeof MutationObserver === 'function') {
    obs = new MutationObserver(() => { if (!done) focusH1(); });
    obs.observe(mainEl, { childList: true, subtree: true });
  }
  setTimeout(focusH1, 0);
  setTimeout(stop, 3000);
}

let wired = false;
let chose = false; // a Menu or account row to a page in the app was just chosen
/** Show the adult's bar (or take it away). Call whenever who is playing may have changed. */
export function applyAdult(on) {
  if (!wired) { wired = true; wirePanels(); }
  document.body.classList.toggle('is-adult', !!on);
  const brand = document.querySelector('.brand');
  if (brand) brand.setAttribute('aria-label', on ? 'Spellbright Grown-ups home' : 'Spellbright home');
  if (!on) { closePanel(false); children = null; return; }
  const v = D.chipView(tools.player());
  const chipBtn = $('adult-chip');
  chipBtn.setAttribute('aria-label', v.aria);
  chipBtn.innerHTML = (v.named ? '<span class="adultface" aria-hidden="true">' + esc(v.initial) + '</span>' : '<span class="adultface adultface--plain" aria-hidden="true">' + I.person + '</span>')
    + '<span class="adultchip__name">' + esc(v.label) + '</span><span class="adultchip__chev" aria-hidden="true">' + I.down + '</span>';
  drawAccount();
}
