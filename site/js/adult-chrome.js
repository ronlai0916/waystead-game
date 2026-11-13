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
  custom: svg('<path d="M4 20l1-4L16 5l3 3L8 19z"/>'),
  tricky: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5M12 16h.01"/>'),
  progress: svg('<path d="M6 20V10M12 20V4M18 20v-7"/>'),
  games: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'),
  parents: svg('<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>'),
  out: svg('<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9"/>'),
  swap: svg('<path d="M7 4v14M3 14l4 4 4-4M17 20V6M13 10l4-4 4 4"/>'),
  kids: svg('<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.5a3 3 0 0 1 0 5.5M18 14.8c1.8.7 3 2.4 3 5.2"/>'),
};

let tools = { origin: () => '', player: () => null };
export const useAdultTools = (t) => { tools = { ...tools, ...t }; };

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

function menuHtml() {
  return head('adult-menu-title', 'Menu') + '<nav aria-label="Menu"><ul class="adultlist">'
    + D.MENU_ROWS.map((r) => '<li>' + row(r.href, I[r.id], r.title, r.sub, ' data-adultrow="' + r.id + '"') + '</li>').join('') + '</ul></nav>';
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
    + '<ul class="adultlist adultlist--rule"><li>' + row(links.parentsHref, I.parents, 'For parents', 'How Spellbright works', ' data-parents') + '</li>'
    + '<li>' + row(links.outHref, I.out, 'Sign out', '', ' data-signout') + '</li></ul>';
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
    setTimeout(() => { const h = document.querySelector('main h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }, 0);
  });
  const sp = childTools().speaker();
  if (sp && sp.onVoices) sp.onVoices(drawAccount);
  $('adult-menu-btn').addEventListener('click', (e) => (openKind === 'menu' ? closePanel() : openPanel('menu', e.currentTarget)));
  $('adult-chip').addEventListener('click', (e) => (openKind === 'account' ? closePanel() : openPanel('account', e.currentTarget)));
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
