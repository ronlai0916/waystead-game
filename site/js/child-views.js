// A child's screens (SB3-C1, "Direction A, the garden path"): the home, the path
// for the week, the Menu sheet, Settings and the top bar's three shapes (home, a
// page, a job). Views only: the rules stay in study-doc.js and words-doc.js, the
// words on screen come from child-doc.js. Signed-in child only; an adult and a
// signed-out visitor keep today's top bar and pages.
import * as S from './store.js';
import * as W from './words-doc.js';
import * as St from './study-doc.js';
import * as C from './child-doc.js';
import { stepHref, comeBackHref } from './study-views.js';
import { sayLine, stop } from './speech.js';
import { MORE } from './voice/menu.js';
import { CHOICES, currentChoice, choose } from './thememenu.js';
import { announce } from './daystyle.js';
import { getWeek, setWeek } from './week-choice.js';
import { esc, ICON } from './ui.js';

const today = () => W.localDay(Date.now());
const groupHref = (id) => '#/words/g/' + encodeURIComponent(id);

const PIP = { happy: 'pip-portrait', thinking: 'pip-thinking', cheering: 'pip-happy' };
const pipHtml = (state) => '<span class="pipring"><span class="pipring__disc"><img class="room__pip" data-pip="' + state + '" src="assets/characters/' + PIP[state] + '-256.webp" width="148" height="148" alt="Pip the dormouse"></span></span>';

const SVG = {
  hear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true" class="fill"><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>',
  flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4"/><path d="M6 4h11l-2.5 4L17 12H6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>',
  again: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4.5h4.5"/></svg>',
  games: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="11" rx="5"/><path d="M8 10.5v4M6 12.5h4M15.5 11.5h.01M17.5 13.5h.01"/></svg>',
  words: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  practice: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
};

/* ------------------------------------------------------------ the stones --- */
const iconFor = { star: SVG.star, clock: SVG.clock, flag: SVG.flag };
/** One stone. mini: the small one on the home card, with its number under it. */
function stoneHtml(v, mini) {
  const inner = iconFor[v.icon] || (mini ? '' : String(v.n));
  return '<span class="stone stone--' + v.kind + (v.id === 'test' ? ' stone--test' : '') + (mini ? ' stone--mini' : '') + ' stone--' + (v.n % 4) + '" aria-hidden="true">' + inner + '</span>';
}

/* app.js hands over the shared Voice part of the look menu, so Settings can offer the same choices. */
let tools = { voice: () => null, speaker: () => null };
export const useChildTools = (t) => { tools = { ...tools, ...t }; };

/* ----------------------------------------------------------------- saved --- */
let savedPending = false;
/** "Stop for now" was pressed: the home says "Your place is saved." once. */
export const markSaved = () => { savedPending = true; };
const takeSaved = () => { const s = savedPending; savedPending = false; return s; };

/* ------------------------------------------------------------------ home --- */
export function childHome(main) {
  const d = S.readWords();
  const day = today();
  const pick = C.weekChoice(d, day, getWeek());
  if (pick.stale) setWeek(''); // the saved week is finished, gone or reset: the home shows its own pick
  const r = St.roomState(d, day, pick.group);
  const g = r.group;
  const st = g ? St.studyState(d, g, day) : null;
  const testStarted = !!(g && r.step && r.step.id === 'test' && W.testLeft(d, g).length < g.words.length); // stopped part-way: no word is named
  const v = C.homeView(r, day, { waiting: st ? st.waiting : 0, mendPart: g && r.step && r.step.id === 'mend' ? St.mendPart(d, g, day) : 'quick', testStarted });
  const href = { job: g && r.step ? stepHref(d, g, r.step.id, day) : '#/words', wordbright: '../wordbright/', words: '#/words', new: '#/words/new' }[v.button.href];
  const attr = v.button.href === 'job' ? ' data-job' : v.button.href === 'wordbright' ? ' data-wordbright' : '';
  const say = '<p class="eyebrow">' + esc(v.eyebrow) + '</p><h1>' + esc(v.headline) + '</h1>' + (v.line ? '<p class="homesay__line">' + esc(v.line) + '</p>' : '');
  let card = '';
  if (g) {
    const steps = st.steps.map((s) => C.stoneView(s, day, St.doneDay(d, g, s.id)));
    const n = C.jobNumber(st.steps, r.step ? r.step.id : '');
    card = '<a class="pathcard" href="' + groupHref(g.id) + '/path" data-pathcard aria-label="My path this week. Job ' + n + ' of 7. Tap to see your week.">'
      + '<span class="pathcard__top"><span class="pathcard__title">My path this week</span><span class="pathcard__go" aria-hidden="true">' + SVG.chevron + '</span></span>'
      + '<span class="minipath" aria-hidden="true">' + steps.map((s) => '<span class="minipath__one">' + stoneHtml(s, true) + '<span class="minipath__n' + (s.kind.startsWith('today') ? ' is-now' : '') + '">' + s.n + '</span></span>').join('') + '</span>'
      + '<span class="pathcard__foot"><span class="pathcard__tap">Tap to see your week</span><span class="pathcard__job">Job ' + n + ' of 7</span></span></a>';
  }
  const weekLine = pick.canSwitch
    ? '<div class="weekline"><p class="weekline__name">Week: <b>' + esc(g.name) + '</b></p><button type="button" class="btn btn--quiet weekline__change" data-week-change aria-haspopup="dialog">Change</button></div>' : '';
  const due = pick.due[0];
  const dueLine = due
    ? '<p class="homego__due" data-duetest>Your test for ' + esc(due.name) + ' is ready.</p><a class="btn btn--ghost" href="' + groupHref(due.id) + '/test" data-taketest>Take the test</a>' : '';
  const nextLine = !due && pick.next
    ? '<p class="homego__due" data-nextweek>' + esc(pick.next.name) + ' has a job waiting.</p><button type="button" class="btn btn--ghost" data-go-week="' + esc(pick.next.id) + '">Go to that week</button>' : '';
  const back = v.comeBack.map((x) => '<a class="linkbtn" href="' + comeBackHref(g, x.word, x.flow) + '" data-comeback>Come back to this: ' + esc(x.word) + '</a>').join('');
  main.innerHTML = '<section class="wrap page room childhome" data-room="' + r.status + '">'
    + (takeSaved() ? '<p class="savedline" role="status" data-saved>' + C.SAVED_LINE + '</p>' : '')
    + '<div class="homesay">' + pipHtml(v.pip)
    + (v.catchUp ? '<div class="homesay__text" data-catchup>' + say + '</div>' : '<div class="homesay__text">' + say + '</div>')
    + '<button type="button" class="btn btn--quiet hearit" data-hear>' + SVG.hear + 'Hear it</button></div>'
    + weekLine + '<div class="homego"><a class="btn btn--primary btn--hero" href="' + href + '"' + attr + '>' + esc(v.button.label) + ICON.arrow + '</a>'
    + (v.note ? '<p class="homego__note">' + esc(v.note) + '</p>' : '') + dueLine + nextLine + (back ? '<div class="comeback">' + back + '</div>' : '') + '</div>'
    + card + '</section>';
  main.querySelector('[data-hear]').addEventListener('click', () => sayLine(v.say));
  const change = main.querySelector('[data-week-change]');
  if (change) change.addEventListener('click', () => openWeeks(change, pick.weeks, (id) => { setWeek(id); if (!change.isConnected) return; childHome(main); const b = main.querySelector('[data-week-change]'); if (b) b.focus(); }));
  const goWeek = main.querySelector('[data-go-week]');
  if (goWeek) goWeek.addEventListener('click', () => { setWeek(goWeek.dataset.goWeek); childHome(main); const b = main.querySelector('[data-week-change]'); if (b) b.focus(); });
  const saved = main.querySelector('[data-saved]');
  if (saved) setTimeout(() => saved.remove(), 6000);
  return () => stop();
}

/* ------------------------------------------------------------------ path --- */
export function pathPage(main, { gid }) {
  const d = S.readWords();
  const g = W.groupById(d, decodeURIComponent(gid));
  if (!g) { location.replace('#/'); return undefined; }
  const day = today();
  const st = St.studyState(d, g, day);
  const rows = st.steps.map((s) => {
    const v = C.stoneView(s, day, St.doneDay(d, g, s.id));
    const text = '<span class="pathrow__text"><b>' + esc(v.name) + '</b><span>' + esc(v.sub) + '</span>' + (v.helper ? '<span class="pathrow__helper">' + v.helper + '</span>' : '') + '</span>';
    const sr = '<span class="sr">' + esc(v.aria) + '. </span>';
    if (v.kind.startsWith('today')) {
      return '<li class="pathrow pathrow--' + v.kind + '"><a class="pathrow__main" href="' + stepHref(d, g, s.id, day) + '" data-job data-step="' + s.id + '">' + sr + stoneHtml(v) + text + '</a></li>';
    }
    const again = v.kind === 'done' && St.canOpen(d, g, s.id, day)
      ? '<a class="linkbtn pathrow__again" href="' + stepHref(d, g, s.id, day) + '" data-again="' + s.id + '">' + SVG.again + 'Do it again<span class="sr">: ' + esc(v.name) + '</span></a>' : '';
    return '<li class="pathrow pathrow--' + v.kind + '"><div class="pathrow__main">' + sr + stoneHtml(v) + text + '</div>' + again + '</li>';
  });
  main.innerHTML = '<section class="wrap page childpath" data-path>'
    + '<div class="pagehead"><span class="eyebrow">' + esc(g.name) + ' · ' + g.words.length + (g.words.length === 1 ? ' word' : ' words') + '</span>'
    + '<div class="instruct"><h1>Your path this week</h1><button type="button" class="hearround" data-hear aria-label="Hear it">' + SVG.hear + '</button></div></div>'
    + '<ol class="pathpanel" aria-label="Your path this week">' + rows.join('') + '</ol>'
    + '<p class="pathfoot"><span class="pathfoot__one">' + ICON.star + C.starsText(St.weekStars(d, g)) + '</span><span class="pathfoot__one">' + SVG.flag + 'Test ' + esc(W.dayLabel(g.test)) + '</span></p></section>';
  main.querySelector('[data-hear]').addEventListener('click', () => sayLine('Your path this week. Tap today\'s stone to start.'));
  return () => stop();
}

/* -------------------------------------------------------------- settings --- */
const chipLink = (item) => { const a = document.querySelector('#player-slot [data-item="' + item + '"]'); return a ? a.getAttribute('href') : ''; };
/** The Voice choices the look menu holds (shared/voice), as plain radio buttons. */
function voiceChoices() {
  const vm = tools.voice();
  const hidden = document.querySelector('#theme-menu [data-voice-part]');
  if (!vm || !hidden || hidden.hidden) return [];
  return vm.items().filter((it) => it.dataset.voice !== MORE).map((it) => ({ id: it.dataset.voice, label: it.textContent.replace(/\s+/g, ' ').trim(), on: it.getAttribute('aria-checked') === 'true', off: it.getAttribute('aria-disabled') === 'true' }));
}
const radios = (list, attr) => list.map((c) => '<button type="button" class="choice" role="radio" aria-checked="' + c.on + '" tabindex="' + (c.on ? 0 : -1) + '" ' + attr + '="' + esc(c.id) + '"' + (c.off ? ' aria-disabled="true"' : '') + '>' + esc(c.label) + '</button>').join('');
/** The Voice card: the shared list as radios, "Add more voices" when the menu offers it, and the menu's own tip line. */
export function voiceCardHtml() {
  const vs = voiceChoices();
  if (!vs.length) return '';
  const vm = tools.voice();
  const more = vm.items().find((it) => it.dataset.voice === MORE);
  const tip = document.querySelector('#theme-menu [data-voice-tip]');
  const line = tip && !tip.hidden ? tip.textContent.trim() : '';
  return '<h2 id="voice-h">Voice</h2><div class="choices" role="radiogroup" aria-labelledby="voice-h" data-voices>' + radios(vs, 'data-voice') + '</div>'
    + (more ? '<button type="button" class="linkbtn" data-more aria-expanded="' + more.getAttribute('aria-expanded') + '">Add more voices</button>' : '')
    + (line ? '<p class="small muted" data-voicetip>' + esc(line) + '</p>' : '');
}
// Arrow keys move through a group of radios and choose as they go.
export function roving(box, attr, pick) {
  box.addEventListener('keydown', (e) => {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (!keys[e.key]) return;
    const all = [...box.querySelectorAll('[' + attr + ']')];
    const i = all.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    pick(all[(i + keys[e.key] + all.length) % all.length]);
  });
}

/** The voice menu and speaker app.js gave us (the grown-up's account panel shares the Voice card). */
export const childTools = () => tools;

export function settingsPage(main) {
  const swi = chipLink('switch');
  const acc = chipLink('account');
  const out = chipLink('out');
  const looks = () => radios(CHOICES.map((c) => ({ id: c.id, label: c.label, on: c.id === currentChoice() })), 'data-choice');
  const voices = voiceCardHtml();
  const row = (href, id, title, sub) => '<a class="card setrow" href="' + esc(href) + '" data-' + id + '><span><strong>' + title + '</strong><br><span class="muted small">' + sub + '</span></span>' + ICON.arrow + '</a>';
  main.innerHTML = '<section class="wrap page childsettings" data-settings><div class="pagehead"><h1>Settings</h1></div>'
    + '<div class="card setting"><h2 id="look-h">Day or night</h2><div class="choices" role="radiogroup" aria-labelledby="look-h" data-looks>' + looks() + '</div></div>'
    + '<div class="card setting" data-voicecard' + (voices ? '' : ' hidden') + '>' + voices + '</div>'
    + (swi ? row(swi, 'switch', 'Switch player', 'Someone else plays') : '')
    + row('#/grownups', 'grownups', 'Grown-ups', 'Ask a grown-up to sign in')
    + (acc ? row(acc, 'account', 'My account', 'See your account') : '')
    + (out ? row(out, 'signout', 'Sign out', 'Stop playing on this device') : '')
    + '<details class="card setting about" data-about><summary>About and licence</summary><div class="about__body">'
    + '<p><a href="#/about">For parents</a></p><p><a href="https://waystead.co.uk">Spellbright is part of Waystead</a></p><p><a href="../">More games</a></p>'
    + '<p class="small muted">Word list: English Appendix 1, the national curriculum in England (DfE, 2013). Contains public sector information licensed under the Open Government Licence v3.0.</p></div></details></section>';
  const box = main.querySelector('[data-looks]');
  const redraw = () => { const keep = document.activeElement && document.activeElement.dataset.choice; box.innerHTML = looks(); if (keep) { const b = box.querySelector('[data-choice="' + keep + '"]'); if (b) b.focus(); } };
  const pickLook = (b) => { choose(b.dataset.choice); announce(); redraw(); };
  box.addEventListener('click', (e) => { const b = e.target.closest('[data-choice]'); if (b) pickLook(b); });
  roving(box, 'data-choice', (b) => { b.focus(); pickLook(b); });
  const follow = () => { if (box.isConnected) redraw(); }; // the look changed elsewhere: Match device, For parents
  document.addEventListener('sb:look', follow);
  // The voices can come in after the page is drawn (iPad Safari lists them once the page is up): draw the card again when they do.
  const vcard = main.querySelector('[data-voicecard]');
  const drawVoices = () => {
    if (!vcard.isConnected) return;
    const keep = vcard.contains(document.activeElement) ? (document.activeElement.dataset.voice || (document.activeElement.hasAttribute('data-more') ? '+more' : null)) : null;
    const html = voiceCardHtml();
    vcard.innerHTML = html;
    vcard.hidden = !html;
    if (keep !== null) { const b = vcard.querySelector(keep === '+more' ? '[data-more]' : '[data-voice="' + CSS.escape(keep) + '"]'); if (b) b.focus(); }
  };
  const pickVoice = (b) => { if (b.getAttribute('aria-disabled') === 'true') return; tools.voice().pick(b.dataset.voice); drawVoices(); };
  vcard.addEventListener('click', (e) => {
    const b = e.target.closest('[data-voice]');
    if (b) { pickVoice(b); return; }
    if (e.target.closest('[data-more]')) { tools.voice().pick(MORE); drawVoices(); }
  });
  roving(vcard, 'data-voice', (b) => { b.focus(); pickVoice(b); });
  const sp = tools.speaker();
  const unvoice = sp && sp.onVoices ? sp.onVoices(drawVoices) : null;
  return () => { document.removeEventListener('sb:look', follow); if (unvoice) unvoice(); stop(); };
}

/* ------------------------------------------------------------- Menu sheet --- */
let sheet = null;
export function closeMenu(returnFocus = true) {
  if (!sheet) return false;
  const { root, opener, undo } = sheet;
  sheet = null;
  undo();
  root.remove();
  stop();
  if (returnFocus && opener && opener.isConnected) opener.focus();
  return true;
}

export function openMenu(opener) {
  if (sheet) return;
  const d = S.readWords();
  const day = today();
  const pick = C.weekChoice(d, day, getWeek());
  const g = pick.group;
  const rows = C.menuRows({ gid: g ? g.id : '', wordsGid: pick.chosen && g ? g.id : '', hasGroup: !!g, gamesOpen: g ? St.gamesOpen(d, g, day) : false, canSwitch: !!chipLink('switch') });
  const ICONS = { games: SVG.games, words: SVG.words, practice: SVG.practice, settings: SVG.settings };
  const row = (x) => x.closed
    ? '<div class="sheetrow sheetrow--closed" data-row="' + x.id + '"><span class="sheetrow__ico">' + ICONS[x.id] + '</span><span class="sheetrow__text"><b>' + x.title + '</b><span>' + esc(x.sub) + '</span></span>'
      + '<button type="button" class="btn btn--quiet hearit" data-hear-line>' + SVG.hear + 'Hear it</button></div>'
    : '<a class="sheetrow' + (x.quiet ? ' sheetrow--quiet' : '') + '" href="' + x.href + '" data-row="' + x.id + '"><span class="sheetrow__ico">' + ICONS[x.id] + '</span><span class="sheetrow__text"><b>' + x.title + '</b><span>' + esc(x.sub) + '</span></span><span class="sheetrow__go" aria-hidden="true">' + SVG.chevron + '</span></a>';
  const root = document.createElement('div');
  root.className = 'sheetlayer';
  root.innerHTML = '<div class="sheetback" data-sheet-back></div>'
    + '<div class="sheet" id="child-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><span class="sheet__grip" aria-hidden="true"></span>'
    + '<div class="sheet__head"><h2 id="sheet-title">Menu</h2><button type="button" class="btn btn--ghost sheet__close" data-close>' + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>Close</button></div>'
    + '<div class="sheet__rows">' + rows.map(row).join('') + '</div></div>';
  document.body.append(root);
  // The page behind can't be reached: no tab, no tap, nothing read out.
  const behind = [...document.body.children].filter((el) => el !== root && !el.matches('script, #toast'));
  behind.forEach((el) => el.setAttribute('inert', ''));
  const undo = () => behind.forEach((el) => el.removeAttribute('inert'));
  sheet = { root, opener, undo };
  const dlg = root.querySelector('.sheet');
  const close = () => closeMenu();
  root.querySelector('[data-close]').addEventListener('click', close);
  root.querySelector('[data-sheet-back]').addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target.closest('a[href]')) closeMenu(false); });
  const hearLine = root.querySelector('[data-hear-line]');
  if (hearLine) hearLine.addEventListener('click', () => sayLine(C.GAMES_CLOSED));
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...dlg.querySelectorAll('a[href], button:not([disabled])')];
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  root.querySelector('[data-close]').focus();
}

/* ------------------------------------------------------- Which week? sheet --- */
/** The bottom sheet "Which week?": one big row per switchable week; one tap calls pick(id) and closes. Same pattern as the Menu sheet. */
function openWeeks(opener, weeks, pick) {
  if (sheet) return;
  const row = (w) => '<button type="button" class="sheetrow weekrow' + (w.current ? ' is-current' : '') + '" data-week="' + esc(w.id) + '"' + (w.current ? ' aria-current="true"' : '') + '>'
    + '<span class="sheetrow__text"><b>' + esc(w.name) + '</b><span>' + esc(w.testLabel) + '</span><span>' + esc(w.job) + '</span></span>'
    + (w.current ? '<span class="pill pill--done">Showing now</span>' : w.waiting ? '<span class="pill pill--warm">Jobs waiting</span>' : '') + '</button>';
  const root = document.createElement('div');
  root.className = 'sheetlayer';
  root.innerHTML = '<div class="sheetback" data-sheet-back></div>'
    + '<div class="sheet weeksheet" id="child-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><span class="sheet__grip" aria-hidden="true"></span>'
    + '<div class="sheet__head"><h2 id="sheet-title">Which week?</h2><button type="button" class="btn btn--ghost sheet__close" data-close><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>Close</button></div>'
    + '<div class="sheet__rows">' + weeks.map(row).join('') + '</div></div>';
  document.body.append(root);
  const behind = [...document.body.children].filter((el) => el !== root && !el.matches('script, #toast'));
  behind.forEach((el) => el.setAttribute('inert', ''));
  const undo = () => behind.forEach((el) => el.removeAttribute('inert'));
  sheet = { root, opener, undo };
  const dlg = root.querySelector('.sheet');
  const close = () => closeMenu();
  root.querySelector('[data-close]').addEventListener('click', close);
  root.querySelector('[data-sheet-back]').addEventListener('click', close);
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-week]');
    if (!b) return;
    const same = b.hasAttribute('aria-current');
    closeMenu(false);
    if (same) { if (opener.isConnected) opener.focus(); } else pick(b.dataset.week);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...dlg.querySelectorAll('a[href], button:not([disabled])')];
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  root.querySelector('[data-close]').focus();
}

/* -------------------------------------------------------------- top bar --- */
const $ = (id) => document.getElementById(id);

/** Set the top bar for this page: 'home' (mark and Menu), 'page' (Back and Menu), 'job' (Stop for now and the job's name), or null (not a child). */
export function applyChrome(child, path, pending = false) {
  const body = document.body;
  document.documentElement.classList.remove('wa-pre');
  body.classList.toggle('is-pending', !child && pending); // the mark alone until the account says who this is
  const job = child && C.isJobPath(path);
  const mode = !child ? '' : job ? 'job' : path === '' ? 'home' : 'page';
  body.classList.toggle('is-child', !!child);
  ['home', 'page', 'job'].forEach((m) => body.classList.toggle('chrome-' + m, mode === m));
  $('child-menu').hidden = !(mode === 'home' || mode === 'page');
  $('child-back').hidden = mode !== 'page';
  $('child-stop').hidden = mode !== 'job';
  const name = $('job-name');
  name.hidden = mode !== 'job';
  name.textContent = mode === 'job' ? C.jobTitle(path, S.readWords(), today()) : '';
  if (mode !== 'home' && mode !== 'page') closeMenu(false);
  const brand = document.querySelector('.brand');
  if (brand) brand.toggleAttribute('inert', mode === 'home'); // the mark links to the page you are on
}

/** Wire the three buttons once. backTo(path) gives the usual one-level-up target. */
export function wireChrome({ currentPath, parentOf }) {
  $('child-menu').addEventListener('click', (e) => (sheet ? closeMenu() : openMenu(e.currentTarget)));
  $('child-back').addEventListener('click', () => { const p = currentPath(); location.hash = C.backTarget(p) || parentOf(p); });
  $('child-stop').addEventListener('click', () => {
    // A sentence half-written on Story day is only in the box: ask before it goes.
    const box = document.getElementById('sentence');
    if (box && box.value.trim() && !window.confirm('Your sentence is not saved yet. Stop anyway?')) return;
    markSaved();
    location.hash = '#/';
  });
  window.addEventListener('hashchange', () => closeMenu(false));
}
