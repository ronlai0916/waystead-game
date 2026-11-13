// The Grown-ups area (SB3-C2, "Direction A, the garden path"): for an adult signed
// in as themselves, never a child and never an adult playing as one. A glance at
// each child, one child's week, a three-step planner (also used to change a week),
// and delete with a way back. The rules are in grownups-doc.js and words-doc.js;
// the account calls in grownups-data.js. Nothing about a child is kept on this device.
import * as D from './data.js';
import * as W from './words-doc.js';
import * as St from './study-doc.js';
import * as P from './grownups-doc.js';
const { possessive } = P;
import * as A from './grownups-data.js';
import { checkTyped } from './wordcheck.js';
import { findEntry, hasMeaning, meaningsFor } from './word-info.js';
import { loadStories } from './stories.js';
import { isAdult, kind, playingAsChild, playerName, recheckWho } from './who.js';
import { esc, ICON, toast, dotsHtml } from './ui.js';
import { accountOrigin } from './account/config.js';

const today = () => W.localDay(Date.now());
const childHref = (id) => '#/grownups/child/' + encodeURIComponent(id);
const weekHref = (id, gid) => childHref(id) + '/week/' + encodeURIComponent(gid);
const planHref = (id) => childHref(id) + '/plan';
const editHref = (id, gid) => childHref(id) + '/plan/' + encodeURIComponent(gid);
const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
const nb = (s) => String(s).replace(/ (\d)/g, ' $1').replace(/(\d) ([A-Z][a-z]{2})/g, '$1 $2'); // a date stays on one line
const PRIVACY = 'Only you and your child can see this.';
let api = null;
const childApi = () => { if (!api) api = A.createChildApi({ origin: accountOrigin(location) }); return api; };
// One line carried to the next page: "Started School spellings for Robin." Read once.
let flash = '';
const takeFlash = () => { const f = flash; flash = ''; return f; };

const svg = (inner, cls = '') => '<svg viewBox="0 0 24 24" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '>' + inner + '</svg>';
const I = {
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>'),
  flag: svg('<path d="M6 21V4"/><path d="M6 4h11l-2.5 4L17 12H6"/>'),
  star: svg('<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>', 'fill'),
  chevron: svg('<path d="M9 6l6 6-6 6"/>'),
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  next: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  pencil: svg('<path d="M4 20l1-4L16 5l3 3L8 19z"/>'),
  print: svg('<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2"/><path d="M7 14h10v6H7z"/>'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  alert: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5M12 16h.01"/>'),
  trend: svg('<path d="M4 16l5-5 4 3 7-8M15 6h5v5"/>'),
  circle: svg('<circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/>'),
  image: svg('<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M5 17l4.5-4 3 2.5 3-3 3.5 3.5"/>'),
  chat: svg('<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>'),
  undo: svg('<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4.5h4.5"/>'),
};
const CHIP_ICON = { note: I.image, dashed: I.image, ontrack: I.check, waiting: I.clock, notstarted: I.circle, finished: I.flag, none: I.circle, got: I.check, getting: I.trend, help: I.alert, new: I.circle };
const chip = (key, text, extra = '') => '<span class="gu-status gu-status--' + key + '"' + extra + '>' + CHIP_ICON[key] + '<span>' + esc(text) + '</span></span>';

const wrap = (eyebrow, title, line, body) => '<section class="wrap page grownups gu"><div class="pagehead"><span class="eyebrow">' + esc(eyebrow) + '</span><h1>' + esc(title) + '</h1>'
  + (line ? '<p class="muted">' + esc(line) + '</p>' : '') + '</div>' + body + '</section>';

// An adult playing as a child: never the data, a way back to themselves.
function playingCard(main) {
  const href = P.switchBackHref(accountOrigin(location), location.href);
  main.innerHTML = '<section class="wrap page"><div class="card empty" data-playing><h1>Grown-ups</h1><p class="muted">' + esc(P.playingLine(playingAsChild() ? playerName() : '')) + '</p>'
    + '<a class="btn btn--primary" href="' + esc(href) + '" data-switchback>Switch back to myself' + ICON.arrow + '</a></div></section>';
}

// A child never gets past here: not the page, and not a single fetch.
export function adultOnly(main) {
  if (isAdult()) return true;
  if (playingAsChild()) { playingCard(main); return false; }
  main.innerHTML = kind() === 'unknown'
    ? '<section class="wrap page"><div class="card empty"><h1>Just a moment</h1><p class="muted">Checking who is here…</p></div></section>'
    : '<section class="wrap page"><div class="card empty" data-notforyou><h1>This page is for grown-ups</h1><a class="btn btn--primary" href="#/">Back to the start</a></div></section>';
  return false;
}
const redraw = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

// A call that failed, as a whole page. The session may have changed in another
// tab (a 403, a 401): ask the account again, so the card names who's playing.
async function showProblem(main, problem) {
  if (problem === 'playing') { await recheckWho(); playingCard(main); return; }
  if (problem === 'signed-out') recheckWho();
  const back = problem === 'no-child';
  main.innerHTML = wrap('Grown-ups', back ? P.PROBLEM_TEXT['no-child'] : 'That didn\'t load', back ? '' : P.PROBLEM_TEXT[problem], '<div class="btnrow" data-problem="' + esc(problem) + '">'
    + (back ? '' : '<button type="button" class="btn btn--primary" data-retry>Try again</button>') + '<a class="btn ' + (back ? 'btn--primary' : 'btn--ghost') + '" href="#/grownups">Back to the list</a></div>');
  const retry = main.querySelector('[data-retry]');
  if (retry) retry.addEventListener('click', redraw);
}

/* ------------------------------------------------------------- the stones --- */
const stoneInner = (v) => (v.icon === 'star' ? I.star : v.icon === 'clock' ? I.clock : v.icon === 'flag' ? I.flag : String(v.n));
const stone = (v) => '<span class="stone stone--' + v.kind + ' stone--' + (v.n % 4) + '" aria-hidden="true">' + stoneInner(v) + '</span>';
const stoneSay = (v) => v.name + ' ' + ({ done: 'done', today: 'today', todaywait: 'today and waiting', waiting: 'waiting', later: 'later', missed: 'not done' }[v.kind] || '');
/** The seven stones with a key; each stone says its state to a screen reader. */
function strip(card, who) {
  return '<ol class="gu-stones" aria-label="' + esc(who + '\'s seven jobs') + '">' + card.steps.map((v) => '<li class="' + (v.kind.startsWith('today') ? 'is-today' : '') + '">' + stone(v)
    + '<span class="gu-stones__name" aria-hidden="true">' + esc(St.STEP_TEXT[v.id].short) + '</span><span class="sr">' + esc(stoneSay(v)) + '</span></li>').join('') + '</ol>';
}
const fact = (label, value, cls = '') => '<div class="gu-fact ' + cls + '"><dt>' + esc(label) + '</dt><dd' + (value === 'None' ? ' class="is-none"' : '') + '>' + esc(value) + '</dd></div>';
// The count is the child's own (a missed job that is today's job counts). Today's job is named under "Today", not here again.
const waitingText = (card) => (card.waiting ? card.waitingTitles.concat(card.waitingToday ? ["today's job"] : []).join(', ').replace(/^./, (x) => x.toUpperCase()) : 'None');
const helpRow = (card) => '<div class="gu-help" data-help><span>Needs help' + (card.help.length ? '' : ': none') + '</span>' + card.help.map((w) => '<span class="gu-hw">' + esc(w) + '</span>').join('') + '</div>';

/* ---------------------------------------------------------------- the home --- */
// The adult's front page (SB3-F): a date, one sentence, one green button in the header row, a card for each child
// (one or two children), or one compact row each (three or more). Order is the account's, never reshuffled.
const hrefFor = (c, key) => (key === 'noweek' || key === 'ended' ? planHref(c.id) : childHref(c.id));
const labelFor = (c, key) => (key === 'noweek' ? 'Plan a week for ' + c.nickname : key === 'ended' ? 'Plan ' + possessive(c.nickname) + ' next week' : 'See ' + possessive(c.nickname) + ' week');
const cardButton = (c, key, extra = '') => '<a class="btn btn--ghost" href="' + hrefFor(c, key) + '"' + (key === 'noweek' || key === 'ended' ? ' data-plan' : ' data-see') + extra + '>'
  + (key === 'noweek' || key === 'ended' ? I.plus : '') + esc(labelFor(c, key)) + (key === 'noweek' || key === 'ended' ? '' : I.next) + '</a>';
/** The stones of a front-page card: the sun is on the next job whether or not today has one. */
function glanceStrip(card, who) {
  const sun = P.sunStep(card);
  const hasToday = card.steps.some((v) => v.kind.startsWith('today'));
  return '<ol class="gu-stones gu-stones--one" aria-label="' + esc(who + '\'s seven jobs') + '">' + card.steps.map((v) => {
    const w = v.kind === 'waiting' || v.kind === 'todaywait';
    const view = !hasToday && v.id === sun ? { ...v, kind: w ? 'todaywait' : 'today', icon: w ? 'clock' : v.icon } : v;
    return '<li class="' + (view.kind.startsWith('today') ? 'is-today' : '') + '">' + stone(view)
      + '<span class="gu-stones__name" aria-hidden="true">' + esc(St.STEP_TEXT[v.id].short) + '</span><span class="sr">' + esc(stoneSay(v)) + '</span></li>';
  }).join('') + '</ol>';
}
function homeCard(c, d, day, key, compact) {
  const name = esc(c.nickname);
  const o = P.childOverview(d, day, Date.now());
  const avatar = '<span class="gu-avatar" aria-hidden="true">' + esc(c.nickname.slice(0, 1).toUpperCase()) + '</span>';
  const who = (sub) => '<div class="gu-card__who"><h2>' + name + ' <small>Year ' + esc(c.year) + '</small></h2>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>';
  if (!o.current) {
    return '<article class="card gu-card' + (compact ? ' gu-card--row' : '') + '" data-child="' + esc(c.id) + '" data-state="none"><div class="gu-card__top">' + avatar + who('No week planned yet.') + chip('none', P.CHIP_LABEL.none, ' data-chip="none"') + '</div>'
      + '<div class="gu-card__act">' + cardButton(c, 'noweek') + '</div></article>';
  }
  const k = o.current;
  const ended = key === 'ended';
  const raw = P.nextLine(k);
  const sub = esc(k.name) + ' · ' + (ended ? 'test was ' : 'test ') + nb(W.dayLabel(k.test));
  return '<article class="card gu-card' + (compact ? ' gu-card--row' : '') + '" data-child="' + esc(c.id) + '" data-state="' + k.chip.key + '">'
    + '<div class="gu-card__top">' + avatar + who(sub) + chip(k.chip.key, k.chip.label, ' data-chip="' + k.chip.key + '"') + '</div>'
    + '<p class="gu-next" data-next>' + (ended ? esc(c.nickname + '\u2019s week ended on ' + W.dayLabel(k.test) + '. Plan the next one.') : raw ? '<b>Next:</b>' + esc(raw.slice(5)) : '') + '</p>'
    + helpRow(k)
    + (compact ? '' : glanceStrip(k, c.nickname))
    + '<div class="gu-card__act">' + cardButton(c, key) + '</div></article>';
}

export function grownups(main) {
  if (!adultOnly(main)) return undefined;
  const storiesLink = '<p class="small"><a href="#/grownups/stories">Review the stories</a></p>';
  if (!A.CHILD_DATA_API) {
    main.innerHTML = wrap('Grown-ups', 'Grown-ups', '', '<div class="card setting gu-empty" data-noapi><h2>Plan a week and the dashboard</h2><p class="muted">These open with the next Waystead account update.</p></div>'
      + '<a class="card gu-notice" href="#/grownups/stories"><span class="gu-notice__text"><b>Review the stories</b><span>Read each one before children can see it</span></span></a>');
    return undefined;
  }
  let stopped = false;
  main.innerHTML = wrap('Grown-ups', 'This week at a glance', '', '<p class="muted">Finding your children…</p>');
  Promise.all([A.listChildren(childApi()), loadStories().catch(() => [])]).then(async ([{ children: list, problem }, stories]) => {
    if (stopped) return;
    if (problem) { showProblem(main, problem); return; }
    const data = await Promise.all(list.map((c) => A.readChild(childApi(), c.id)));
    if (stopped) return;
    const day = today();
    const unread = stories.filter((s) => !s.reviewed).length;
    const notice = unread
      ? '<a class="card gu-notice" href="#/grownups/stories" data-stories><span class="gu-notice__icon">' + I.chat + '</span><span class="gu-notice__text"><b>' + plural(unread, 'story', 'stories') + ' to read first</b><span>Children see their Story day story after you have read it.</span></span><span class="gu-notice__go">' + I.chevron + '</span></a>' : '';
    if (!list.length) {
      const href = P.accountHomeHref(accountOrigin(location));
      main.innerHTML = '<section class="wrap page grownups gu"><div class="card gu-first" data-first><span class="pipring"><span class="pipring__disc"><img class="room__pip" src="assets/characters/pip-portrait-256.webp" width="148" height="148" alt=""></span></span>'
        + '<div class="gu-first__text"><span class="eyebrow">Welcome</span><h1>Add your first child</h1><p class="muted">Spellbright plans a spelling week for each child. Start by adding a child to your Waystead account.</p>'
        + '<div><a class="btn btn--primary" href="' + esc(href) + '" data-addchild>Add a child' + I.plus + '</a></div></div></div>' + notice + '<div class="gu-stories">' + storiesLink + '</div></section>';
      return;
    }
    const items = list.map((c, i) => ({ name: c.nickname, ...P.glanceKey(data[i].problem ? null : P.childOverview(data[i].words, day, Date.now()), data[i].problem || '') }));
    const compact = P.isCompact(list.length);
    const cards = list.map((c, i) => (data[i].problem
      ? '<article class="card gu-card' + (compact ? ' gu-card--row' : '') + '" data-child="' + esc(c.id) + '"><div class="gu-card__who"><h2>' + esc(c.nickname) + '</h2><p>' + esc(P.PROBLEM_TEXT[data[i].problem]) + '</p></div><div><button type="button" class="btn btn--ghost" data-retry>Try again</button></div></article>'
      : homeCard(c, data[i].words, day, items[i].key, compact)));
    const act = P.primaryAction(items);
    const plan = '<a class="btn ' + (act.kind === 'plan' ? 'btn--primary' : 'btn--ghost') + '" href="#/grownups/plan" data-planweek>' + I.plus + 'Plan a week</a>';
    const lead = act.kind === 'plan' ? '' : '<a class="btn btn--primary" href="' + hrefFor(list[act.index], items[act.index].key) + '" data-primary' + (act.kind === 'see' ? ' data-see-lead' : ' data-plan-lead') + '>' + esc(act.label) + (act.kind === 'see' ? I.next : '') + '</a>';
    main.innerHTML = '<section class="wrap page grownups gu"><div class="gu-top"><div class="pagehead"><span class="eyebrow" data-date>' + esc(P.longDate(day)) + '</span><h1>This week at a glance</h1>'
      + '<p class="lede" data-summary>' + esc(P.glanceSummary(items)) + '</p></div>'
      + '<div class="gu-top__acts">' + lead + plan + '</div></div>'
      + notice
      + '<div class="gu-cards' + (compact ? ' gu-cards--rows' : list.length === 1 ? ' gu-cards--one' : '') + '">' + cards.join('') + '</div>'
      + (!compact && data.some((x) => !x.problem && P.childOverview(x.words, day, Date.now()).current) ? '<p class="gu-key" data-stonekey>' + esc(P.STONE_KEY_NEXT) + '</p>' : '')
      + (unread ? '' : '<div class="gu-stories">' + storiesLink + '</div>') + '</section>';
    main.querySelectorAll('[data-retry]').forEach((b) => b.addEventListener('click', redraw));
  });
  return () => { stopped = true; };
}

// The child, checked against this adult's own list first.
async function loadChild(cid) {
  const { children, problem } = await A.listChildren(childApi());
  if (problem) return { problem };
  const child = children.find((c) => c.id === cid);
  if (!child) return { problem: 'no-child' };
  const data = await A.readChild(childApi(), cid);
  return data.problem ? data : { child, ...data };
}
const needsApi = () => { if (A.CHILD_DATA_API) return false; location.replace('#/grownups'); return true; };

/* ------------------------------------------------------------- the dialog --- */
/** A real dialog: role="dialog", focus inside it, Tab stays in it, Escape and Keep it close it, focus goes back. */
let dismissDialog = () => {}; // closes an open dialog as 'keep' (the page was left)
function confirmDialog({ title, body, confirm, keep, opener }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'gu-overlay';
    overlay.innerHTML = '<div class="gu-dialog" role="dialog" aria-modal="true" aria-labelledby="gu-dtitle" aria-describedby="gu-dbody" data-dialog><h2 id="gu-dtitle">' + esc(title) + '</h2><p id="gu-dbody">' + esc(body) + '</p>'
      + '<div class="btnrow"><button type="button" class="btn btn--destroy" data-confirm>' + esc(confirm) + '</button><button type="button" class="btn btn--ghost" data-keep>' + esc(keep) + '</button></div></div>';
    const prior = document.activeElement;
    const inert = [...document.body.children].filter((e) => e !== overlay && !e.hasAttribute('inert'));
    inert.forEach((e) => e.setAttribute('inert', ''));
    document.body.appendChild(overlay);
    const buttons = [...overlay.querySelectorAll('button')];
    function close(answer) {
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('hashchange', away);
      if (dismissDialog === away) dismissDialog = () => {};
      overlay.remove();
      inert.forEach((e) => e.removeAttribute('inert'));
      const back = opener && document.contains(opener) ? opener : prior;
      if (back && back.focus) back.focus();
      resolve(answer);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(false); return; }
      if (e.key !== 'Tab') return;
      const at = buttons.indexOf(document.activeElement);
      e.preventDefault();
      buttons[(at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    }
    const away = () => close(false); // Back, a link, or the page's own cleanup: the answer is keep
    dismissDialog = away;
    window.addEventListener('hashchange', away);
    document.addEventListener('keydown', onKey, true);
    overlay.querySelector('[data-confirm]').addEventListener('click', () => close(true));
    overlay.querySelector('[data-keep]').addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    overlay.querySelector('[data-keep]').focus(); // the safe choice first
  });
}

/* ---------------------------------------------------------- one child's week --- */
function wordRow(w, g, childName, typedInfo) {
  const prep = typedInfo ? P.readiness({ typed: true, hasMeaning: hasMeaning(w.word) }) : null;
  return '<li class="gu-word" data-word="' + esc(w.word) + '" data-status="' + w.status + '">'
    + '<span class="gu-word__name">' + esc(w.word) + (w.back ? '<small>Back again</small>' : '') + '</span>'
    + '<span class="gu-word__dots">' + dotsHtml(w.dots, W.ROW_NEEDED) + '<span>' + w.dots + ' of ' + W.ROW_NEEDED + '</span></span>'
    + '<span class="gu-word__status">' + chip(w.status, w.label + (w.reason ? ' · ' + w.reason : ''), ' data-wordchip') + '</span>'
    + (w.notes.length ? '<span class="gu-word__notes"><b>What we noticed</b>' + w.notes.map((n) => '<span>' + esc(n) + '</span>').join('') + '</span>' : '')
    + (prep ? '<span class="gu-word__prep">' + chip(prep.meaning ? 'note' : 'dashed', prep.picture) + '</span>' : '')
    + '</li>';
}

export function childDashboard(main, { cid, gid }) {
  if (!adultOnly(main) || needsApi()) return undefined;
  const id = decodeURIComponent(cid);
  const wanted = gid ? decodeURIComponent(gid) : '';
  let stopped = false;
  let c = null;
  let line = takeFlash();
  let undo = null; // { gid, name }: "Deleted. Undo", for this visit
  let problemLine = '';
  main.innerHTML = wrap('Grown-ups', 'This week', '', '<p class="muted">Loading…</p>');

  async function change(fn) {
    const r = await A.changeWords(childApi(), id, fn);
    if (stopped) return null;
    if (r.problem === 'playing' || r.problem === 'no-child') { showProblem(main, r.problem); return null; }
    if (r.problem === 'signed-out') recheckWho();
    if (r.problem) { problemLine = P.PROBLEM_TEXT[r.problem] + ' Nothing has been changed.'; draw(); return null; }
    if (r.error) { problemLine = r.error; draw(); return null; }
    c = { ...c, words: W.normalise(r.doc) };
    return r;
  }

  function draw() {
    const day = today();
    const d = c.words;
    const nick = c.child.nickname;
    const o = P.childOverview(d, day, Date.now());
    const g = (wanted && W.groupById(d, wanted)) || (o.current && W.groupById(d, o.current.id)) || null;
    const head = (title, sub) => '<a class="gu-back" href="#/grownups">' + I.back + 'All children</a><div class="gu-top"><div class="pagehead"><span class="eyebrow">' + esc(nick) + ' · Year ' + esc(c.child.year) + '</span><h1>' + esc(title) + '</h1>'
      + (sub ? '<p class="muted">' + esc(sub) + '</p>' : '') + '</div></div>';
    const notes = (line ? '<p class="gu-line" role="status" data-flash>' + esc(line) + '</p>' : '')
      + (undo ? '<p class="gu-line" role="status" data-deleted>Deleted. <button type="button" class="btn btn--plain" data-undo>' + I.undo + 'Undo</button></p>' : '')
      + (problemLine ? '<p class="gu-line gu-line--warn" role="alert" data-problemline>' + esc(problemLine) + '</p>' : '');
    const deleted = o.deleted.length
      ? '<section class="card gu-deleted" data-deletedlist><h2>Deleted weeks</h2><p class="small muted">Removed in the last 30 days. ' + esc(nick) + '\'s practice on these words was kept.</p><ul>'
        + o.deleted.map((x) => '<li data-gone="' + esc(x.id) + '"><span><b>' + esc(x.name) + '</b> <span class="muted small">' + plural(x.words, 'word') + ' · test ' + esc(nb(W.dayLabel(x.test))) + '</span></span>'
          + '<button type="button" class="btn btn--ghost btn--small" data-restore="' + esc(x.id) + '">Bring back<span class="sr">: ' + esc(x.name) + '</span></button></li>').join('') + '</ul></section>' : '';
    const pickOn = W.weekPickOn(d);
    const pickCard = '<section class="card gu-weekpick" data-weekpick><p class="small muted" id="gu-weekpick-help">' + esc(P.weekPickHelp(nick, pickOn)) + '</p>'
      + '<button type="button" class="btn btn--ghost gu-weekpick__btn" data-weekpick-toggle aria-pressed="' + pickOn + '" aria-describedby="gu-weekpick-help"><span>' + esc(P.WEEKPICK_NAME) + '</span><span class="gu-weekpick__state" aria-hidden="true" data-weekpick-state>' + P.weekPickState(pickOn) + '</span></button></section>';
    if (!g) {
      main.innerHTML = '<section class="wrap page grownups gu" data-noweek>' + head(nick + '\'s week', PRIVACY) + notes + pickCard
        + '<div class="card gu-empty"><h2>No week yet</h2><p class="muted">Plan a week of words and a test date for ' + esc(nick) + '.</p><a class="btn btn--primary" href="' + planHref(id) + '" data-plan>' + I.plus + 'Plan a week</a></div>' + deleted + '</section>';
      wire(null);
      return;
    }
    const k = P.weekCard(d, g, day);
    const rep = P.groupReport(d, g, day);
    const words = P.weekWords(d, g, day);
    const over = W.overall(d);
    const switcher = o.weeks.length > 1
      ? '<p class="gu-switchline" data-manyweeks><b>' + esc(nick) + ' has ' + o.weeks.length + ' weeks running.</b> Pick one to look at, change or delete.</p><ul class="gu-switch" aria-label="' + esc(nick) + '\'s weeks">' + o.weeks.map((x) => '<li><a href="' + weekHref(id, x.id) + '"' + (x.id === g.id ? ' aria-current="page"' : '') + '>' + esc(x.name) + ' · ' + esc(nb(W.dayLabel(x.test))) + '</a></li>').join('') + '</ul>' : '';
    const path = '<section class="gu-path" aria-labelledby="gu-path-h"><h2 id="gu-path-h">The path</h2><ol>' + k.steps.map((v) => '<li class="' + (v.kind.startsWith('today') ? 'is-today' : '') + '">' + stone(v)
      + '<span class="gu-path__name">' + esc(v.name) + '</span><span class="gu-path__sub">' + esc(nb(pathSub(v, k))) + '</span><span class="sr">' + esc(stoneSay(v)) + '</span></li>').join('') + '</ol></section>';
    const glance = '<section class="card gu-glance" aria-labelledby="gu-glance-h" data-glance><div class="gu-glance__head"><h2 id="gu-glance-h">At a glance</h2>'
      + chip(k.chip.key, k.chip.label + (k.chip.key === 'ontrack' ? ' · nothing waiting' : ''), ' data-chip="' + k.chip.key + '"') + '</div>'
      + '<dl class="gu-facts">' + fact('Today', k.today) + fact('Jobs waiting', waitingText(k)) + fact('Test', nb(W.dayLabel(k.test))) + fact('Stars', plural(k.stars, 'star')) + '</dl>'
      + helpRow(k)
      + '<div class="gu-actions noprint"><a class="btn btn--ghost" href="' + editHref(id, g.id) + '" data-edit>' + I.pencil + (k.canEdit ? 'Change words or test date' : 'Rename this week') + '</a>'
      + '<button type="button" class="btn btn--plain" data-print>' + I.print + 'Print this week</button>'
      + '<a class="btn btn--ghost" href="' + planHref(id) + '" data-plannext>' + I.plus + 'Plan next week</a>'
      + '<button type="button" class="btn btn--danger" data-delete>Delete this week</button></div></section>';
    const wordsCard = '<section class="card gu-words" aria-labelledby="gu-words-h"><h2 id="gu-words-h">Words</h2>'
      + '<p class="small muted">' + esc(St.ROW_LINE) + ' Words that need help come first.</p>'
      + '<p class="small muted">' + esc(P.STATUS_KEY) + '</p><ul class="gu-wordlist">' + words.map((w) => wordRow(w, g, nick, !findEntry(w.word))).join('') + '</ul></section>';
    const more = '<section class="card gu-glance" aria-labelledby="gu-more-h"><h2 id="gu-more-h">More about the week</h2>'
      + (rep.test.taken ? '<p><b>Test:</b> ' + rep.test.right + ' of ' + rep.test.of + ' right' + (rep.test.rows.some((x) => !x.right) ? ' · Slipped: ' + esc(rep.test.rows.filter((x) => !x.right).map((x) => x.word).join(', ')) : '') + '</p>' : '')
      + (rep.comeBack.length ? '<p data-reportskips><b>Come back to this:</b> ' + esc(rep.comeBack.join(', ')) + '</p>' : '')
      + (rep.waiting && rep.testWaits ? '<p class="small" data-waiting>The test date has come: the test opens once ' + (rep.waiting === 1 ? 'this job is' : 'these jobs are') + ' done. Missed jobs are never skipped: they come first, in order.</p>'
        : rep.waiting ? '<p class="small" data-waiting><b>' + plural(rep.waiting, 'job') + ' waiting.</b> Missed jobs are never skipped: they come first, in order.</p>' : '')
      + '<h3>All weeks</h3><div class="stats"><div class="card stat"><b>' + over.remembered + '</b><span>Remembered</span></div><div class="card stat"><b>' + over.practised + '</b><span>Words practised</span></div>'
      + '<div class="card stat"><b>' + over.independent + '%</b><span>Independent first goes</span><span class="muted small">' + over.clean + ' of ' + plural(over.firstGoes, 'first go', 'first goes') + '</span></div></div>'
      + (rep.sentences.length ? '<h3>Sentences</h3><ul class="report__list">' + rep.sentences.map((s) => '<li><b>' + esc(s.word) + ':</b> ' + esc(s.text) + '</li>').join('') + '</ul>' : '')
      + '<p class="small muted">' + esc(PRIVACY) + '</p></section>';
    main.innerHTML = '<section class="wrap page grownups gu" data-week="' + esc(g.id) + '">' + head(g.name, plural(k.count, 'word') + ' · test ' + nb(W.dayLabel(k.test)) + ' · ' + P.weekLine(k)) + notes + switcher + glance + path + wordsCard + more + pickCard + deleted + '</section>';
    wire(g);
  }
  function pathSub(v, k) {
    const st = k.steps.find((x) => x.id === v.id);
    return P.pathLabel(v, W.dayParts(st.date).join(' '));
  }
  function wire(g) {
    const q = (s) => main.querySelector(s);
    const pick = q('[data-weekpick-toggle]');
    if (pick) {
      pick.addEventListener('click', async () => {
        const on = !W.weekPickOn(c.words);
        line = ''; problemLine = '';
        const r = await change((doc) => ({ doc: W.setWeekPick(doc, on, Date.now()) }));
        if (!r) return;
        line = P.weekPickFlash(on);
        draw();
        const b = main.querySelector('[data-weekpick-toggle]');
        if (b) b.focus();
      });
    }
    const printBtn = q('[data-print]');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
    const del = q('[data-delete]');
    if (del) {
      del.addEventListener('click', async () => {
        const yes = await confirmDialog({ title: P.deleteQuestion(g.name, c.child.nickname), body: P.deleteBody(c.child.nickname), confirm: 'Delete this week', keep: 'Keep it', opener: del });
        if (!yes || stopped) return;
        line = ''; problemLine = '';
        const r = await change((doc) => ({ doc: W.deleteGroup(doc, g.id, Date.now()) }));
        if (!r) return;
        undo = { gid: g.id, name: g.name };
        draw();
        const u = main.querySelector('[data-undo]');
        if (u) u.focus();
      });
    }
    const undoBtn = q('[data-undo]');
    if (undoBtn) undoBtn.addEventListener('click', () => restore(undo.gid, true));
    main.querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', () => restore(b.dataset.restore, false)));
  }
  async function restore(gone, fromUndo) {
    problemLine = '';
    const name = (c.words.groups[gone] || { name: 'the week' }).name;
    const r = await change((doc) => W.restoreGroup(doc, gone, Date.now()));
    if (!r) return;
    undo = null;
    line = fromUndo ? 'Brought back ' + name + '.' : 'Brought back ' + name + '.';
    draw();
  }

  loadChild(id).then((got) => {
    if (stopped) return;
    if (got.problem) { showProblem(main, got.problem); return; }
    c = got;
    draw();
  });
  return () => { stopped = true; dismissDialog(); };
}

/* ------------------------------------------------------------- plan a week --- */
const AVATAR = (n) => '<span class="gu-avatar" aria-hidden="true">' + esc(n.slice(0, 1).toUpperCase()) + '</span>';

function planForm(main, cid, gid) {
  const day = today();
  const fixedId = cid ? decodeURIComponent(cid) : '';
  const editing = gid ? decodeURIComponent(gid) : null;
  let kids = []; // [{ child, words, progress, version }]
  let patterns = [];
  let credit = '';
  let stopped = false;
  let step = 2;
  let chosenId = fixedId;
  let name = '';
  let nameTouched = false;
  let test = W.defaultTest(day);
  let words = [];
  let listName = '';
  let other = false; // "Other lists" open
  let tab = 'year';
  let chapterId = D.chapters(D.defaultYear())[0].id;
  let patternId = '';
  let yearId = D.defaultYear();
  let typed = '';
  let note = '';
  let message = '';
  let saving = false;
  let existing = null; // the week being changed
  // One id for this plan, however many times it's sent: if a save arrives but
  // its answer is lost, trying again changes that group, and never makes a second.
  const planId = 'p' + [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, '0')).join('');

  const kid = () => kids.find((k) => k.child.id === chosenId) || null;
  const nick = () => (kid() ? kid().child.nickname : 'your child');
  const start = () => (existing ? existing.start : day);
  const tricky = () => (kid() ? P.childTricky(kid().progress).filter((w) => findEntry(w)) : []);
  const shownName = () => (nameTouched ? name : P.suggestName({ typedCount: words.filter((w) => !findEntry(w)).length, listName, test }));
  const yearWords = (y) => D.chapters(y).flatMap((x) => x.words.map((w) => w.word)).sort((a, b) => a.localeCompare(b, 'en-GB', { sensitivity: 'base' }));
  const source = () => (tab === 'chapter' ? D.chapterById(chapterId).words.map((w) => w.word)
    : tab === 'pattern' ? P.patternWords(patterns, patternId)
      : tab === 'tricky' ? tricky() : yearWords(yearId));
  const sourceLabel = () => (tab === 'chapter' ? D.chapterTitle(D.chapterById(chapterId)).name : tab === 'pattern' ? ((patterns.find((p) => p.id === patternId) || {}).title || 'a spelling pattern')
    : tab === 'tricky' ? 'Tricky words' : D.years()[yearId].label + ' words');
  const sourceHeading = () => (tab === 'year' ? 'Or tap words from ' + D.years()[yearId].label : tab === 'chapter' ? 'Or tap words from this chapter' : tab === 'pattern' ? 'Or tap words with this pattern' : 'Or tap this child\'s tricky words');

  const tabBtn = (k, label) => '<button type="button" class="tab" role="tab" aria-selected="' + (tab === k) + '" data-tab="' + k + '">' + esc(label) + '</button>';
  const chapterOpts = () => D.liveYears().map((y) => '<optgroup label="' + esc(D.years()[y].label) + '">' + D.chapters(y).map((x) => '<option value="' + x.id + '"' + (x.id === chapterId ? ' selected' : '') + '>' + esc(D.chapterTitle(x).n + '. ' + D.chapterTitle(x).name) + '</option>').join('') + '</optgroup>').join('');
  const patternOpts = () => [['y34', 'Years 3 and 4'], ['y56', 'Years 5 and 6']].map(([s, label]) => '<optgroup label="' + label + '">' + patterns.filter((p) => p.stage === s).map((p) => '<option value="' + p.id + '"' + (p.id === patternId ? ' selected' : '') + '>' + esc(p.title) + '</option>').join('') + '</optgroup>').join('');

  const stepper = () => {
    const parts = [['Who', 1], ['Which words', 2], ['Test date', 3]];
    return '<ol class="gu-stepper" aria-label="Steps">' + parts.map(([label, n]) => {
      const kindOf = n < step ? 'done' : n === step ? 'today' : 'later';
      return '<li' + (n === step ? ' aria-current="step"' : '') + '><span class="stone stone--' + kindOf + ' stone--' + (n % 4) + '" aria-hidden="true">' + (kindOf === 'done' ? I.star : n) + '</span><span>' + label + '<span class="sr">' + (kindOf === 'done' ? ' (done)' : '') + '</span></span></li>';
    }).join('') + '</ol>';
  };
  const eyebrow = () => (editing ? 'Change the week for ' + nick() : 'Plan a week' + (kid() ? ' for ' + nick() : '')) + ' · Step ' + step + ' of 3';
  // Back on the left, the main button on the right: the same row, whatever the step.
  const nav = (primary) => '<div class="gu-nav"><button type="button" class="btn btn--ghost" data-back>' + I.back + 'Back</button><button type="button" class="btn btn--primary" data-next>' + primary + '</button></div>';
  const page = (title, line, body, primary) => '<section class="wrap page grownups gu" data-plan-step="' + step + '"><div class="pagehead"><span class="eyebrow" data-stepmark>' + esc(eyebrow()) + '</span></div>' + stepper()
    + '<div class="pagehead"><h1>' + esc(title) + '</h1>' + (line ? '<p class="muted">' + esc(line) + '</p>' : '') + '</div>' + body + '<p class="gu-error" role="alert" data-error>' + esc(message) + '</p>' + nav(primary) + '</section>';

  function draw() {
    if (step === 1) drawWho(); else if (step === 2) drawWords(); else drawDate();
    wire();
  }
  function drawWho() {
    const day0 = today();
    main.innerHTML = page('Who is this week for?', 'Pick one child. Each child gets their own words.', '<fieldset class="gu-who"><legend>Who is this week for?</legend>' + kids.map((k) => {
      const cur = P.childOverview(k.words, day0, Date.now()).current;
      return '<label class="gu-radio"><input type="radio" name="who" value="' + esc(k.child.id) + '"' + (k.child.id === chosenId ? ' checked' : '') + ' data-who>' + AVATAR(k.child.nickname)
        + '<span class="gu-radio__text"><b>' + esc(k.child.nickname) + ' <small>Year ' + esc(k.child.year) + '</small></b><span>' + (cur ? 'This week: ' + esc(cur.name) + ', test ' + esc(nb(W.dayLabel(cur.test))) : 'No week yet') + '</span></span></label>';
    }).join('') + '</fieldset><p class="muted small">Same words for two children? Plan the first week, then plan again for the other child.</p>', 'Next' + I.next);
  }
  function chipsHtml(list, full) {
    return '<ul class="gu-chips gu-chips--scroll" role="group" aria-label="' + esc(sourceLabel()) + '" tabindex="0">' + list.map((w) => {
      const on = words.includes(w);
      return '<li><button type="button" class="gu-chip" aria-pressed="' + on + '" data-pick="' + esc(w) + '"' + (full && !on ? ' disabled' : '') + '>' + (on ? I.check : I.plus) + esc(w) + '</button></li>';
    }).join('') + '</ul>';
  }
  function drawWords() {
    const full = P.atCap(words);
    const list = source();
    const p = patterns.find((x) => x.id === patternId);
    const typedWords = words.filter((w) => !findEntry(w));
    const listed = words.filter((w) => findEntry(w));
    const typedRows = typedWords.map((w) => {
      const r = P.readiness({ typed: true, hasMeaning: hasMeaning(w) });
      return '<li data-typedrow="' + esc(w) + '"><span class="gu-mywords__main"><span class="gu-mywords__word">' + esc(w) + '<span class="gu-tag">Typed</span></span><span class="gu-mean' + (r.meaning ? '' : ' is-none') + '">' + esc(r.meaningLine) + '</span>'
        + chip(r.meaning ? 'note' : 'dashed', r.picture) + '</span><button type="button" class="gu-x" data-remove="' + esc(w) + '" aria-label="Remove ' + esc(w) + '">' + I.x + '</button></li>';
    }).join('');
    const listedRows = listed.length ? '<li><span class="gu-mywords__main"><span class="small muted">' + plural(listed.length, 'word') + ' from our lists are ready, with a meaning.</span>'
      + '<span class="gu-chips">' + listed.map((w) => '<span><button type="button" class="gu-chip" data-remove="' + esc(w) + '" aria-label="Remove ' + esc(w) + '">' + esc(w) + I.x + '</button></span>').join('') + '</span></span></li>' : '';
    const other_ = other
      ? '<div class="gu-lists"><div class="tabs" role="tablist" aria-label="Lists">' + tabBtn('year', 'A year list') + tabBtn('chapter', 'A chapter') + tabBtn('pattern', 'A spelling pattern') + tabBtn('tricky', 'Tricky words (' + tricky().length + ')') + '</div>'
        + (tab === 'chapter' ? '<select class="field" aria-label="Chapter" data-chapter>' + chapterOpts() + '</select>' : '')
        + (tab === 'pattern' ? '<select class="field" aria-label="Spelling pattern" data-pattern>' + patternOpts() + '</select>' + (p ? '<p class="small muted">' + esc(p.rule) + '</p>' : '') + '<p class="foot__small">' + esc(credit) + '</p>' : '')
        + (tab === 'year' ? '<select class="field" aria-label="Year list" data-year>' + D.liveYears().map((y) => '<option value="' + y + '"' + (y === yearId ? ' selected' : '') + '>' + esc(D.years()[y].label) + '</option>').join('') + '</select>' : '')
        + (tab === 'tricky' && !tricky().length ? '<p class="muted">No tricky words yet.</p>' : '') + '</div>' : '';
    main.innerHTML = page('Which words?', 'Type the school\'s words, or tap words from a list. Up to ' + W.MAX_WORDS + '. ' + St.DAILY_TIME_CAP + '.',
      '<div class="gu-plan gu-plan--two">'
      + '<div class="stack"><section class="card gu-panel" aria-labelledby="gu-type-h"><h2 id="gu-type-h">Type a school word</h2>'
      + '<form class="gu-typeform" data-typeform><input class="field typedword" aria-label="Type a school word" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="20" placeholder="' + (full ? 'Week is full' : '') + '" value="' + esc(full ? '' : typed) + '"' + (full ? ' disabled' : '') + ' data-typed>'
      + '<button type="submit" class="btn btn--ghost" data-add' + (full ? ' disabled' : '') + '>Add</button></form>'
      + (note ? '<p class="small" role="status" data-typednote>' + esc(note) + '</p>' : '<p class="small muted">We find the meaning for you, from the Wordbright word list.</p>') + '</section>'
      + '<section class="card gu-panel" aria-labelledby="gu-pick-h"><h2 id="gu-pick-h">' + esc(sourceHeading()) + '</h2><p>Tap a ticked word to take it off.</p>'
      + chipsHtml(list, full)
      + '<div><button type="button" class="btn btn--ghost" data-other aria-expanded="' + other + '">' + (other ? 'Fewer lists' : 'Other lists') + I.chevron + '</button></div>' + (other ? other_ : '<p class="small muted">Chapters, spelling patterns, year lists and tricky words.</p>') + '</section></div>'
      + '<section class="card gu-panel" aria-labelledby="gu-mine-h" data-mywords><div class="gu-panel__head"><h2 id="gu-mine-h">' + esc(nick()) + '\'s words</h2><span class="gu-count" data-count>' + words.length + ' of ' + W.MAX_WORDS + '</span></div>'
      + (full ? '<p class="gu-line gu-line--warn" role="status" data-full>' + I.alert + esc(P.FULL_WEEK_LINE) + '</p>' : '')
      + (words.length ? '<ul class="gu-mywords">' + typedRows + listedRows + '</ul>' : '<p class="muted">No words yet. Type one, or tap words from a list.</p>') + '</section></div>', 'Next' + I.next);
  }
  function drawDate() {
    const short = P.isShortWeek(start(), test) && /^\d{4}-\d{2}-\d{2}$/.test(test);
    const typedWords = words.filter((w) => !findEntry(w));
    const mini = St.BEFORE_TEST.concat(['test', 'mend']).map((id, i) => '<span class="minipath__one"><span class="stone stone--mini stone--' + (i === 0 ? 'today' : 'later') + ' stone--' + (i % 4) + '" aria-hidden="true">' + (i === 0 ? '1' : id === 'test' ? I.flag : String(i + 1)) + '</span></span>').join('');
    const first = P.firstSight(start());
    main.innerHTML = page('When is the test?', existing ? 'The jobs already done stay done. Jobs not done by the test wait for ' + nick() + '.' : nick() + ' starts today. Jobs not done by the test wait for ' + nick() + '.',
      '<div class="gu-plan gu-plan--date"><section class="card gu-panel"><div class="gu-field"><label for="p-test">Test date</label><div class="gu-datewrap"><input id="p-test" class="field" type="date" value="' + esc(test) + '" min="' + W.addDays(day, 1) + '" max="' + W.addDays(start(), W.MAX_DAYS) + '" data-test>'
      + '<span class="gu-datewords" data-datewords aria-live="polite">' + esc(nb(P.dateWords(test))) + '</span></div><span class="small muted">A full week has ' + P.FULL_WEEK_DAYS + ' days before the test.</span>'
      + (short ? '<p class="gu-line gu-line--warn" role="status" data-short>' + esc(P.SHORT_WEEK_LINE) + '</p>' : '')
      + (existing && existing.test < day ? '<p class="small muted" data-datepassed>' + esc(P.passedLine(nick())) + '</p>' : '') + '</div>'
      + '<div class="gu-field"><label for="p-name">Week name</label><input id="p-name" class="field" maxlength="' + W.MAX_NAME + '" value="' + esc(shownName()) + '" data-name></div>'
      + '<p class="muted small" data-summary>' + esc(nick()) + ' · ' + plural(words.length, 'word') + '.' + (typedWords.length ? ' ' + typedWords.map((w) => w + (hasMeaning(w) ? ' has a meaning only' : ' has no picture or meaning')).join(', ').replace(/^./, (x) => x.toUpperCase()) + '.' : '') + '</p></section>'
      + '<div><h2 class="gu-glimpse__h">What ' + esc(nick()) + ' will see first</h2><section class="card gu-glimpse" data-glimpse><span class="pipring"><span class="pipring__disc"><img class="room__pip" src="assets/characters/pip-portrait-256.webp" width="88" height="88" alt=""></span></span>'
      + '<span class="eyebrow">' + esc(first.day === day ? 'Today' : W.dayLabel(first.day)) + ' · ' + esc(first.title) + '</span><h3>Meet your new words.</h3><span class="btn btn--primary gu-glimpse__btn" aria-hidden="true">Start ' + esc(first.title) + '</span>'
      + '<span class="minipath" aria-hidden="true">' + mini + '</span><small>Test on ' + esc(nb(P.dateWords(test) || 'the test date')) + '</small></section></div></div>',
      I.check + (editing ? 'Save the changes' : 'Start the week for ' + esc(nick())));
  }
  function wire() {
    const q = (s) => main.querySelector(s);
    q('[data-back]').addEventListener('click', goBack);
    q('[data-next]').addEventListener('click', goNext);
    main.querySelectorAll('[data-who]').forEach((r) => r.addEventListener('change', () => { chosenId = r.value; message = ''; }));
    main.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; note = ''; draw(); }));
    const pick = (w, on) => { if (on) addWord(w, sourceLabel()); else removeWord(w); };
    main.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
      const box = q('.gu-chips--scroll');
      const at = box ? box.scrollTop : 0;
      pick(b.dataset.pick, b.getAttribute('aria-pressed') !== 'true');
      draw();
      const again = q('.gu-chips--scroll');
      if (again) again.scrollTop = at;
      focusAfter('[data-pick="' + CSS.escape(b.dataset.pick) + '"]');
    }));
    main.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => { removeWord(b.dataset.remove); draw(); }));
    const o = q('[data-other]');
    if (o) o.addEventListener('click', () => { other = !other; if (!other) { tab = 'year'; yearId = P.yearListFor(kid() ? kid().child.year : 4, D.liveYears()); } draw(); focusAfter('[data-other]'); });
    if (q('[data-chapter]')) q('[data-chapter]').addEventListener('change', (e) => { chapterId = e.target.value; draw(); });
    if (q('[data-pattern]')) q('[data-pattern]').addEventListener('change', (e) => { patternId = e.target.value; draw(); });
    if (q('[data-year]')) q('[data-year]').addEventListener('change', (e) => { yearId = e.target.value; draw(); });
    const form = q('[data-typeform]');
    if (form) {
      q('[data-typed]').addEventListener('input', (e) => { typed = e.target.value; });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (P.atCap(words)) return;
        const r = await checkTyped(typed, findEntry);
        if (stopped) return;
        if (r.word) {
          if (words.includes(r.word)) note = r.word + ' is already in the week.';
          else { addWord(r.word, ''); typed = ''; note = 'Added ' + r.word + '.'; if (!findEntry(r.word)) meaningsFor([r.word]).then(() => { if (!stopped && step === 2) { draw(); } }); }
        } else if (r.error) note = r.error;
        draw();
        const t = q('[data-typed]');
        if (t && !t.disabled) t.focus();
      });
    }
    const date = q('[data-test]');
    if (date) {
      date.addEventListener('input', (e) => {
        test = e.target.value;
        q('[data-datewords]').textContent = nb(P.dateWords(test));
        const short = P.isShortWeek(start(), test) && /^\d{4}-\d{2}-\d{2}$/.test(test);
        const shown = q('[data-short]');
        if (short && !shown) date.closest('.gu-field').insertAdjacentHTML('beforeend', '<p class="gu-line gu-line--warn" role="status" data-short>' + esc(P.SHORT_WEEK_LINE) + '</p>');
        else if (!short && shown) shown.remove();
        q('.gu-glimpse small').textContent = 'Test on ' + nb(P.dateWords(test) || 'the test date');
      });
      q('[data-name]').addEventListener('input', (e) => { name = e.target.value; nameTouched = true; });
    }
  }
  const focusAfter = (sel) => { const e = main.querySelector(sel); if (e && !e.disabled) e.focus(); };
  function addWord(w, from) {
    if (words.includes(w) || P.atCap(words)) return;
    words.push(w);
    if (from) listName = from;
  }
  function removeWord(w) { words = words.filter((x) => x !== w); if (!words.some((x) => findEntry(x))) listName = ''; }

  function goBack() {
    message = '';
    const ctx = { children: kids.length, editing: !!editing };
    const to = P.stepBack(step, ctx);
    if (to) { step = to; draw(); window.scrollTo(0, 0); return; }
    location.hash = editing && existing ? weekHref(chosenId, existing.id) : fixedId ? childHref(fixedId) : '#/grownups';
  }
  function goNext() {
    message = '';
    if (step === 1) {
      if (!chosenId) { message = 'Please choose a child.'; draw(); return; }
      step = 2;
      yearId = P.yearListFor(kid().child.year, D.liveYears());
      draw(); window.scrollTo(0, 0);
    } else if (step === 2) {
      if (!words.length) { message = 'Please add at least one word.'; draw(); return; }
      step = 3; draw(); window.scrollTo(0, 0);
    } else save();
  }
  async function save() {
    if (saving) return;
    saving = true;
    const button = main.querySelector('[data-next]');
    const err = main.querySelector('[data-error]');
    button.disabled = true;
    err.textContent = '';
    const now = Date.now();
    const finalName = (shownName().trim() || P.suggestName({ test })).slice(0, W.MAX_NAME);
    const id = chosenId;
    const r = await A.changeWords(childApi(), id, (doc) => (editing
      ? P.editPlan(doc, editing, { name: finalName, words, test }, { today: day, now })
      : P.createPlan(doc, { name: finalName, test, words }, { id: planId, today: day, now })));
    saving = false;
    if (stopped) return;
    if (r.ok) {
      if (r.updated) toast('Updated with the latest');
      flash = editing ? P.editedLine(finalName) : P.confirmLine(finalName, nick());
      location.hash = weekHref(id, editing || planId);
      return;
    }
    if (r.problem === 'playing' || r.problem === 'no-child') { showProblem(main, r.problem); return; }
    if (r.problem === 'signed-out') recheckWho();
    button.disabled = false;
    message = r.error || P.PROBLEM_TEXT[r.problem] + ' Nothing has been saved.';
    err.textContent = message;
  }

  // A locked week (the test has begun): say why, kindly; the name can still change.
  function drawLocked() {
    const k = kid();
    main.innerHTML = '<section class="wrap page grownups gu" data-locked><a class="gu-back" href="' + weekHref(chosenId, existing.id) + '">' + I.back + 'Back to the week</a>'
      + '<div class="pagehead"><span class="eyebrow">' + esc(k.child.nickname) + ' · ' + esc(existing.name) + '</span><h1>This week has started its test</h1><p class="muted">' + esc(P.LOCKED_LINE) + '</p></div>'
      + '<section class="card gu-panel"><div class="gu-field"><label for="p-name">Week name</label><input id="p-name" class="field" maxlength="' + W.MAX_NAME + '" value="' + esc(existing.name) + '" data-name></div>'
      + '<p class="gu-error" role="alert" data-error></p><div class="btnrow"><button type="button" class="btn btn--primary" data-rename>Save the name</button><a class="btn btn--ghost" href="' + planHref(chosenId) + '" data-plannext>' + I.plus + 'Plan next week</a></div></section></section>';
    main.querySelector('[data-rename]').addEventListener('click', async () => {
      const text = main.querySelector('[data-name]').value;
      const r = await A.changeWords(childApi(), chosenId, (doc) => P.editPlan(doc, editing, { name: text }, { today: day, now: Date.now() }));
      if (stopped) return;
      if (r.ok) { flash = P.editedLine(text.trim()); location.hash = weekHref(chosenId, editing); return; }
      main.querySelector('[data-error]').textContent = r.error || P.PROBLEM_TEXT[r.problem] + ' Nothing has been saved.';
    });
  }

  main.innerHTML = wrap('Grown-ups', editing ? 'Change the week' : 'Plan a week', '', '<p class="muted">Loading…</p>');
  Promise.all([A.listChildren(childApi()), fetch('data/patterns.json').then((r) => r.json()).catch(() => ({ patterns: [] }))]).then(async ([{ children, problem }, data]) => {
    if (stopped) return;
    if (problem) { showProblem(main, problem); return; }
    if (fixedId && !children.some((x) => x.id === fixedId)) { showProblem(main, 'no-child'); return; }
    const ours = fixedId && editing ? children.filter((x) => x.id === fixedId) : children;
    const got = await Promise.all(ours.map((x) => A.readChild(childApi(), x.id)));
    if (stopped) return;
    const bad = got.find((x) => x.problem);
    if (bad) { showProblem(main, bad.problem); return; }
    kids = ours.map((child, i) => ({ child, ...got[i] }));
    patterns = data.patterns;
    credit = (data._meta || {}).credit || '';
    patternId = patterns.length ? patterns[0].id : '';
    if (kids.length === 1 && !chosenId) chosenId = kids[0].child.id;
    if (editing) {
      existing = W.groupById(kid().words, editing);
      if (!existing) { location.replace(childHref(chosenId)); return; }
      if (!W.canEdit(kid().words, existing)) { drawLocked(); return; }
      name = existing.name;
      nameTouched = true;
      test = existing.test; // never moved silently: only a date the grown-up picks has to be after today
      words = [...existing.words];
      listName = '';
    }
    if (kid()) yearId = P.yearListFor(kid().child.year, D.liveYears());
    step = P.firstStep({ children: kids.length, chosen: chosenId && fixedId ? chosenId : '', editing: !!editing });
    draw();
  });
  return () => { stopped = true; };
}
export function planWeek(main, { cid }) { return !adultOnly(main) || needsApi() ? undefined : planForm(main, cid, null); }
export function planAny(main) { return !adultOnly(main) || needsApi() ? undefined : planForm(main, '', null); }
export function editWeek(main, { cid, gid }) { return !adultOnly(main) || needsApi() ? undefined : planForm(main, cid, gid); }
