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
import * as RD from './role-doc.js'; // SB5 WP-C: three roles, three homes
import * as AC from './adult-chrome.js'; // the saved role and name (roleStore), the Menu redraw
import * as AD from './adult-doc.js';
import * as Sdata from './set-data.js'; // pushName after a rename
import * as S from './store.js';
import * as Ow from './own-doc.js';
import { mountSetupCard, mountReport, handOffWords } from './setup-views.js'; // SB4-WP6
import * as SD from './set-doc.js';
import { findEntry, hasMeaning, meaningsFor } from './word-info.js';
import { loadStories } from './stories.js';
import { isAdult, kind, playingAsChild, playerName, recheckWho, unknownCard } from './who.js';
import { esc, ICON, toast, dotsHtml } from './ui.js';
import { accountOrigin } from './account/config.js';
import { safeDecode } from './chapters-doc.js'; // SB4-WP13: a bad address piece is '' (never throws)

const today = () => W.localDay(Date.now());
const childHref = (id) => '#/grownups/child/' + encodeURIComponent(id);
const weekHref = (id, gid) => childHref(id) + '/week/' + encodeURIComponent(gid);
const editHref = (id, gid) => childHref(id) + '/plan/' + encodeURIComponent(gid);
const renameHref = (id, gid) => childHref(id) + '/rename/' + encodeURIComponent(gid);
const printHref = (id, gid) => childHref(id) + '/print/' + encodeURIComponent(gid);
const weeksHref = (id) => childHref(id) + '/weeks';
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
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>'),
  again: svg('<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/>'),
  undo: svg('<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4.5h4.5"/>'),
  ext: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  warn: svg('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>'),
  cal: svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
  kids: svg('<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.5a3 3 0 0 1 0 5.5M18 14.8c1.8.7 3 2.4 3 5.2"/>'),
};
const CHIP_ICON = { note: I.image, dashed: I.image, ontrack: I.check, waiting: I.clock, notstarted: I.circle, finished: I.flag, none: I.circle, got: I.check, getting: I.trend, help: I.alert, new: I.circle };
const chip = (key, text, extra = '') => '<span class="gu-status gu-status--' + key + '"' + extra + '>' + CHIP_ICON[key] + '<span>' + esc(text) + '</span></span>';

const wrap = (eyebrow, title, line, body) => '<section class="wrap page grownups gu"><div class="pagehead"><span class="eyebrow">' + esc(eyebrow) + '</span><h1>' + esc(title) + '</h1>'
  + (line ? '<p class="muted">' + esc(line) + '</p>' : '') + '</div>' + body + '</section>';

// An adult playing as a child: never the data, a way back to themselves.
export function playingCard(main) {
  const href = P.switchBackHref(accountOrigin(location), location.href);
  main.innerHTML = '<section class="wrap page"><div class="card empty" data-playing><h1>Grown-ups</h1><p class="muted">' + esc(P.playingLine(playingAsChild() ? playerName() : '')) + '</p>'
    + '<a class="btn btn--primary" href="' + esc(href) + '" data-switchback>Switch back to myself' + ICON.arrow + '</a></div></section>';
}

// A child never gets past here: not the page, and not a single fetch.
export function adultOnly(main) {
  if (isAdult()) return true;
  if (playingAsChild()) { playingCard(main); return false; }
  if (kind() === 'unknown') { unknownCard(main, 'gu'); return false; }
  main.innerHTML = '<section class="wrap page"><div class="card empty" data-notforyou><h1>This page is for grown-ups</h1><a class="btn btn--primary" href="#/">Back to the start</a></div></section>';
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

/* ------------------------------------------------- the three homes (SB5, TR-41, TR-85) --- */
// One engine, three page sets on the same address: Children (parent), My learners (tutor), My class (teacher). The role comes from the
// role store (adult-chrome roleStore: the account's prefs.sbRole, the device copy for first paint). Nothing here writes a child.
const W3 = RD.WORDS;
const roleNow = () => AC.currentRole();
const backName = (role) => (role === 'parent' ? 'Children' : W3[role].home);
const setHref = (cid) => (cid ? '#/grownups/set/child/' + encodeURIComponent(cid) : '#/grownups/set');
const ASK_HREF = '#/grownups/more';
const pill = (t, kind = '', ico = '') => '<span class="gh-pill' + (kind ? ' gh-pill--' + kind : '') + '">' + ico + esc(t) + '</span>';
const faceOf = (name) => '<span class="gh-face" aria-hidden="true">' + esc(String(name).slice(0, 1).toUpperCase()) + '</span>';
const ownLists = () => { try { return Ow.live(W.ownOf(S.readWords())); } catch (e) { return []; } };
const asLink = (href, text, ico = '', extra = '') => '<a class="gh-quiet" href="' + esc(href) + '"' + extra + '>' + ico + esc(text) + '</a>';
const outLink = (href, text, extra = '') => '<a class="gh-quiet" href="' + esc(href) + '" target="_blank" rel="noopener"' + extra + '>' + I.ext + esc(text) + '</a>';
const bar = (btn, line) => '<div class="gh-bar">' + (line ? '<p class="gh-bar__line">' + esc(line) + '</p>' : '') + btn + '</div>';
const bigBtn = (href, text, ico, extra = '') => '<a class="btn btn--primary" href="' + esc(href) + '"' + extra + '>' + ico + esc(text) + '</a>';

/** The stones, small: one per job, done / today / waiting / later (D22). The key is drawn once under the cards. */
const miniClass = (v) => (v.kind === 'done' ? 'is-done' : v.kind === 'today' || v.kind === 'todaywait' ? 'is-today' : v.kind === 'waiting' ? 'is-wait' : '');
function miniStones(k, who) {
  const done = k.steps.filter((v) => v.kind === 'done').length;
  const wait = k.steps.filter((v) => v.kind === 'waiting' || v.kind === 'todaywait').length;
  const label = who + ': ' + done + ' of ' + k.steps.length + ' jobs done' + (wait ? ', ' + wait + ' waiting' : '');
  return '<ol class="gh-mini" role="img" aria-label="' + esc(label) + '">' + k.steps.map((v) => '<li class="gh-ms ' + miniClass(v) + '"></li>').join('') + '</ol>';
}
const stoneKey = () => '<p class="gh-key" data-stonekey><span class="gh-key__s is-done" aria-hidden="true"></span>Done <span class="gh-key__s is-today" aria-hidden="true"></span>Today '
  + '<span class="gh-key__s is-wait" aria-hidden="true"></span>Waiting <span class="gh-key__s" aria-hidden="true"></span>Later</p>';

/** The newest week whose test is done, with its score; null when the child has not taken a test. */
function lastTested(d) {
  const done = W.liveGroups(d).filter((g) => W.testDone(d, g)).reverse();
  if (!done.length) return null;
  const g = done[0];
  const rs = W.testResults(d, g);
  return { g, test: g.test, right: rs.filter((x) => x.result && x.result.right).length, of: rs.length, slipped: W.slipped(d, g) };
}
/** What the home knows about one child: the week card, the last test, who needs help. */
function kidModel(c, d, day) {
  const o = P.childOverview(d, day, Date.now());
  const last = lastTested(d);
  const kid = { id: c.id, name: c.nickname, d, today: day, toPractise: last ? last.slipped : [] };
  return { c, d, k: o.current, ended: !!o.current && o.current.status === 'finished', last, kid, help: RD.needsHelp(kid, day) };
}

function kidCard(m, role) {
  const { c, k, last, help } = m;
  const done = m.ended && last;
  let status;
  let l1;
  let l2 = '';
  if (!k) {
    status = pill('No week yet');
    l1 = last ? 'Last test ' + nb(W.dayLabel(last.test)) + ': <b>' + last.right + ' of ' + last.of + '</b>' : 'No test yet';
  } else if (m.ended) {
    status = help.length ? pill('Look at results', 'todo') : pill('Test done', 'ok', I.check);
    l1 = done ? (role === 'tutor' ? 'Last test: ' : 'Last week’s test: ') + '<b>' + last.right + ' of ' + last.of + '</b>' : esc(k.name) + ' · test was ' + esc(nb(W.dayLabel(k.test)));
    if (done && last.slipped.length) l2 = plural(last.slipped.length, 'word') + ' to practise again';
  } else {
    status = k.chip.key === 'waiting' ? pill(k.chip.label, 'todo', I.clock) : help.length ? pill('Look at results', 'todo') : pill(k.chip.label);
    l1 = 'Test on ' + esc(nb(W.dayLabel(k.test)));
    const next = P.nextLine(k);
    l2 = next || '';
  }
  if (role === 'tutor') { // the tutor reads what to go over first (BR-25), then the last test
    const n = last ? last.slipped.length : 0;
    l1 = '<b>' + (n ? 'To go over: ' + plural(n, 'word') : 'Nothing to go over') + '</b>';
    l2 = !k || m.ended ? (last ? 'Last test' + (k ? '' : ' ' + nb(W.dayLabel(last.test))) + ': ' + last.right + ' of ' + last.of : 'No test yet') : 'Test on ' + nb(W.dayLabel(k.test));
  }
  const state = !k ? 'none' : m.ended ? 'ended' : k.chip.key;
  const showStones = !!k;
  const dId = 'gu-d-' + c.id;
  const statusText = !k ? 'No week yet' : m.ended ? (help.length ? 'Look at results' : 'Test done') : k.chip.label;
  return '<div class="gh-kid" data-child="' + esc(c.id) + '" data-state="' + state + '">'
    + '<a class="gh-kcard" href="' + childHref(c.id) + '" data-see aria-label="' + esc(c.nickname + ', Year ' + c.year + ', ' + statusText) + '" aria-describedby="' + esc(dId) + '">'
    + '<span class="gh-kcard__body"><span class="gh-kcard__top">' + faceOf(c.nickname) + '<span class="gh-kcard__name">' + esc(c.nickname) + '</span><span class="gh-kcard__year">Year ' + esc(c.year) + '</span>' + status + '</span>'
    + '<span class="gh-kcard__line" id="' + esc(dId) + '">' + l1 + '</span>' + (l2 ? '<span class="gh-kcard__line gh-kcard__line--muted">' + esc(l2) + '</span>' : '')
    + (showStones ? miniStones(k, c.nickname) : '') + '</span><span class="gh-go" aria-hidden="true">' + I.chevron + '</span></a>'
    + (!k ? '<a class="btn btn--ghost gh-kid__set" href="' + setHref(c.id) + '" data-plan>Set a week for ' + esc(c.nickname) + '</a>' : '') + '</div>';
}

/** "Ada, Ben and Cy" for up to three children, else "5 children". */
const forNames = (names, many) => (names.length <= 3 ? names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0] || '' : names.length + ' ' + many);
const AND = (names) => (names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0] || '');

/** Who needs a week set, in a line: "No week is set yet. Ada and Cy had their test on Fri 20 Nov." (parent). '' when someone has a week running. */
function nudgeNote(models) {
  if (!models.length || models.some((m) => m.k && !m.ended)) return '';
  const ended = models.filter((m) => m.ended && m.last);
  const day = ended.map((m) => m.last.test).sort().pop();
  return '<div class="gh-note gh-note--help" role="status" data-nudge>' + I.info + '<p><b>No week is set yet.</b>' + (ended.length ? ' ' + esc(AND(ended.map((m) => m.c.nickname)) + ' had their test on ' + nb(W.dayLabel(day)) + '.') : '') + '</p></div>';
}

const EMPTY = {
  parent: { eyebrow: 'Children', title: 'Add your first child', text: 'Children are added on your Waystead account. When one is added, they appear here and you can set a week.', btn: 'Add a child on your account', help: () => 'Your plan says how many children you can add.', agree: 'Only add children whose parents or carers have agreed.' },
  tutor: { eyebrow: 'My learners', title: 'Add your first learner', text: 'Learners are added on your Waystead account. When one is added, they appear here and you can set a week.', btn: 'Add a learner on your account', help: (n) => 'Your plan holds ' + n + ' learners.', agree: 'Only add learners whose parents or carers have agreed.' },
  teacher: { eyebrow: 'My class', title: 'Add the children in your class', text: 'Children are added on your Waystead account. When they are added, your class appears here and you can set the class week.', btn: 'Add children on your account', help: (n) => 'Your plan holds ' + n + ' children.', agree: 'Only add children whose parents or carers have agreed.' },
};
const EXT_NEW = 'Opens your Waystead account in a new tab';

/** The tail under the cards: key, links, the count line (01a, 01u, 01i). */
function homeTail({ role, n, limit, atLimit, hasWeek, unread }) {
  const w = W3[role];
  const accountHref = P.accountHomeHref(accountOrigin(location));
  const out = [];
  if (hasWeek) out.push(stoneKey());
  if (role === 'parent') {
    out.push(asLink('#/grownups/help', w.help));
    if (n >= 2) out.push(asLink('#/grownups/overview', w.all, I.kids));
  } else if (role === 'tutor') {
    if (n >= 2) out.push(asLink('#/grownups/overview', w.all, I.kids));
    out.push(asLink('#/grownups/help', w.help));
  } else out.push(asLink('#/grownups/help', w.help));
  if (!unread) out.push(asLink('#/grownups/stories', 'Review the stories'));
  out.push(atLimit ? asLink(ASK_HREF, RD.askMoreFor(role), I.ext, ' data-ask') : outLink(accountHref, role === 'parent' ? 'Add or manage children on your account' : role === 'tutor' ? 'Add or manage learners on your account' : 'Add or manage children on your account', ' data-addchild'));
  const agree = EMPTY[role].agree;
  let count = '';
  if (role === 'parent') count = atLimit ? '' : '<b>' + esc(RD.limitLine(role, n, limit)) + '.</b> ';
  else if (role === 'tutor') count = '<b>' + esc(RD.limitLine(role, n, limit)) + '.</b> ' + (atLimit ? '' : 'Your plan holds ' + limit + '. ');
  else count = '<b>' + esc(atLimit ? n + ' of ' + limit + ' places used' : RD.limitLine(role, n, limit)) + '.</b> ';
  out.push('<p class="gh-help" data-count>' + count + esc(agree) + '</p>');
  return out.join('');
}

function teacherPanel(steps, hrefs) {
  const body = '<ol class="gh-steps">' + steps.map((s, i) => '<li><a class="gh-step' + (s.done ? ' is-done' : '') + '" href="' + esc(hrefs[i]) + '" data-step="' + s.n + '"><span class="gh-step__n">' + (s.done ? I.check : s.n) + '</span>'
    + '<span class="gh-step__t"><b>' + esc(s.title) + '</b><small>' + esc(['Type it, or scan the class sheet', 'One list, one test date, everyone ticked', 'Scores and words to practise again'][i]) + '</small></span><span class="gh-go" aria-hidden="true">' + I.chevron + '</span></a></li>').join('') + '</ol>';
  if (steps[0].allDone) {
    return '<details class="gh-det" data-steps><summary><b>How it works: 3 steps</b><span class="gh-det__cue"><span class="gh-det__show">Show</span><span class="gh-det__hide">Hide</span>' + I.chevron + '</span></summary>' + body + '</details>';
  }
  return '<section class="gh-card gh-card--flat" aria-labelledby="gu-s3" data-steps><h2 id="gu-s3" class="gh-card__h">How it works: 3 steps</h2>' + body + '</section>';
}

function classTable(models) {
  return '<div class="gh-card gh-card--flat gh-class" data-classtable><table class="gh-ctable"><caption class="sr">Your class this week</caption><thead><tr><th scope="col">Child</th><th scope="col">This week</th><th scope="col">Needs help</th></tr></thead><tbody>'
    + models.map((m) => {
      const { c, k, last, help } = m;
      const lastLine = !k ? 'No week yet' : last ? 'Last test ' + last.right + ' of ' + last.of : 'No test yet';
      return '<tr data-child="' + esc(c.id) + '"><th scope="row"><a class="gh-ctable__who" href="' + childHref(c.id) + '">' + esc(c.nickname) + '<small>Year ' + esc(c.year) + '</small></a></th>'
        + '<td data-label="This week">' + (k ? miniStones(k, c.nickname) : '') + '<small class="gh-help">' + esc(lastLine) + '</small></td>'
        + '<td data-label="Needs help">' + (help.length ? help.map((h) => pill(h.line, 'todo')).join(' ') : '–') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

export function needsRole() { const s = AC.roleStore(); return !!s && s.shouldAsk(); }

export function grownups(main) {
  if (!adultOnly(main)) return undefined;
  const role = roleNow();
  if (needsRole()) { location.replace('#/grownups/role'); return undefined; } // TR-5: the first use asks once (Not now = Parent, again in 7 days)
  const w = W3[role];
  if (!A.CHILD_DATA_API) {
    main.innerHTML = wrap('Grown-ups', 'Grown-ups', '', '<div class="card setting gu-empty" data-noapi><h2>Set a week and the dashboard</h2><p class="muted">These open with the next Waystead account update.</p></div>'
      + '<a class="card gu-notice" href="#/grownups/stories"><span class="gu-notice__text"><b>Review the stories</b><span>Read each one before children can see it</span></span></a>');
    return undefined;
  }
  let stopped = false;
  main.innerHTML = wrap('Grown-ups', w.home, '', '<p class="muted">Finding your ' + w.many.replace(' in your class', '') + '…</p>');
  Promise.all([A.listChildren(childApi()), A.readMe(childApi()), loadStories().catch(() => [])]).then(async ([{ children: list, problem }, me, stories]) => {
    if (stopped) return;
    if (problem) {
      if (problem === 'playing' || problem === 'no-child' || problem === 'signed-out') { showProblem(main, problem); return; }
      main.innerHTML = '<section class="wrap page grownups gu gh-page" data-notready><div class="gh-page__head"><p class="gh-eyebrow">' + esc(P.longDate(today())) + '</p><h1 class="gh-h1">' + esc(w.home) + '</h1></div>'
        + '<div class="gh-note gh-note--help" role="status">' + I.info + '<p>Your ' + esc(w.many.replace(' in your class', '')) + ' are not ready to show yet. You can still set a week. Nothing is lost.</p></div>'
        + '<div><button type="button" class="btn btn--ghost" data-retry>Try again</button></div>'
        + bar(bigBtn(setHref(''), w.set, I.cal, ' data-setweek'), 'You choose the children next') + '</section>';
      main.querySelector('[data-retry]').addEventListener('click', redraw);
      return;
    }
    const data = await A.pool(list, (c) => A.readChild(childApi(), c.id));
    if (stopped) return;
    const day = today();
    const limit = me.limit;
    const n = list.length;
    const atLimit = n >= limit;
    const unread = stories.filter((s) => !s.reviewed).length;
    const notice = unread
      ? '<a class="card gu-notice" href="#/grownups/stories" data-stories><span class="gu-notice__icon">' + I.chat + '</span><span class="gu-notice__text"><b>' + plural(unread, 'story', 'stories') + ' to read first</b><span>Children see their Story day story after you have read it.</span></span><span class="gu-notice__go">' + I.chevron + '</span></a>' : '';
    if (!n) {
      const e = EMPTY[role];
      main.innerHTML = '<section class="wrap page grownups gu gh-page" data-first><div class="gh-page__head"><p class="gh-eyebrow">' + esc(e.eyebrow) + '</p><h1 class="gh-h1">' + esc(e.title) + '</h1></div>'
        + '<div class="gh-card gh-card--flat"><p class="gh-card__line">' + esc(e.text) + '</p><p class="gh-help">' + esc(e.help(limit)) + '</p></div>'
        + '<div class="gh-note" role="status">' + I.info + '<p>' + esc(e.agree) + '</p></div>' + notice + asLink('#/grownups/stories', 'Review the stories')
        + bar('<a class="btn btn--primary" href="' + esc(P.accountHomeHref(accountOrigin(location))) + '" target="_blank" rel="noopener" data-addchild>' + I.ext + esc(e.btn) + '</a>', EXT_NEW) + '</section>';
      return;
    }
    const models = data.map((x, i) => (x.problem ? { c: list[i], problem: x.problem } : kidModel(list[i], x.words, day)));
    const good = models.filter((m) => !m.problem);
    const ordered = role === 'tutor' ? RD.homeOrder('tutor', models.map((m) => (m.problem ? { id: m.c.id, name: m.c.nickname, bad: m } : { ...m.kid, m })), day).map((k) => (k.bad || k.m)) : models;
    const failed = (m) => '<div class="gh-kid" data-child="' + esc(m.c.id) + '" data-state="problem"><div class="gh-card gh-card--flat"><div class="gh-card__top">' + faceOf(m.c.nickname) + '<h2 class="gh-card__name">' + esc(m.c.nickname) + '</h2></div>'
      + '<p class="gh-card__line">We couldn’t load ' + esc(possessive(m.c.nickname)) + ' week. The others are fine.</p><div><button type="button" class="btn btn--ghost" data-retry>Try again</button></div></div></div>';
    const hasWeek = good.some((m) => m.k);
    const lists = ownLists();
    const kidsForDefaults = good.map((m) => ({ id: m.c.id, d: m.d }));
    const defaults = RD.setDefaults(role, { kids: kidsForDefaults, lists, today: day });
    const nameOf = (id) => (list.find((c) => c.id === id) || {}).nickname || '';
    let setBtn;
    let setLine;
    if (role === 'tutor') {
      const first = defaults.cids[0];
      setBtn = bigBtn(setHref(first), w.set, I.cal, ' data-setweek data-primary');
      setLine = first ? 'Opens on ' + nameOf(first) + ', the first learner with no week' : 'One learner at a time';
    } else if (role === 'teacher') {
      const band = RD.classBand({ tests: good.filter((m) => m.k && !m.ended).map((m) => m.k.test), ended: good.filter((m) => m.ended).length, n, today: day, dayLabel: W.dayLabel });
      setBtn = bigBtn(setHref(''), band.label, I.cal, ' data-setweek data-primary');
      setLine = band.line;
    } else {
      setBtn = bigBtn(setHref(''), w.set, I.cal, ' data-setweek data-primary');
      setLine = 'Starts today · for ' + forNames(defaults.cids.map(nameOf).filter(Boolean), 'children');
    }
    if (role === 'parent' && !defaults.cids.length) setLine = 'Starts today · you choose the children';
    // the top of the page
    const seenAs = (() => { const rs = AC.roleStore(); return rs ? RD.seenAsLine(role, rs.name()) : ''; })();
    let top = '<div class="gh-page__head"><p class="gh-eyebrow" data-date>' + esc(P.longDate(day)) + '</p><h1 class="gh-h1">' + esc(w.home) + '</h1>'
      + (role === 'tutor' ? '<p class="gh-sub">The learner who needs you most is first.</p>' : '')
      + (seenAs ? '<p class="gh-help" data-seenas>' + esc(seenAs) + '</p>' : '')
      + (role === 'teacher' ? '<p class="gh-sub" data-limitline>' + esc(atLimit ? n + ' of ' + limit + ' places used' : RD.limitLine(role, n, limit)) + '</p>' : '') + '</div>';
    if (role === 'parent') top += atLimit ? asLink(ASK_HREF, RD.ASK_MORE, I.ext, ' data-ask') : outLink(P.accountHomeHref(accountOrigin(location)), 'Add a child on your account', ' data-addchild');
    if (atLimit) {
      if (role === 'teacher') {
        top += '<div class="gh-warn" role="status" data-limit>' + I.warn + '<p><b>' + esc(n + ' of ' + limit + ' places used.') + '</b> ' + esc(RD.atLimitLine(role, n, limit)) + '</p></div>'
          + '<div class="gh-card gh-card--flat"><h2 class="gh-card__h">What can I do?</h2><p class="gh-card__line"><b>1. Choose your ' + limit + '.</b> Keep the ' + limit + ' children who need Spellbright most this term.</p>'
          + '<p class="gh-card__line"><b>2. Swap children.</b> Remove one on your account to make room for the next. Their results are kept for 30 days.</p>'
          + '<div class="gh-row"><a class="btn btn--ghost" href="' + ASK_HREF + '" data-ask>' + I.ext + esc(RD.ASK_MORE) + '</a></div></div>';
      } else {
        top += '<div class="gh-note gh-note--help" role="status" data-limit>' + I.info + '<p><b>' + esc(RD.limitLine(role, n, limit)) + '.</b> ' + esc(RD.atLimitLine(role, n, limit))
          + (role === 'parent' ? ' Ask for more places, or remove one on your account (their results are kept for 30 days).' : '') + '</p></div>'
          + (role === 'tutor' ? asLink(ASK_HREF, RD.askMoreFor(role), I.ext, ' data-ask') : outLink(P.accountHomeHref(accountOrigin(location)), 'Manage children on your account', ' data-addchild'));
      }
    }
    if (role === 'parent') top += nudgeNote(good);
    top += notice;
    let middle;
    if (role === 'teacher') {
      const everyWeek = good.filter((m) => m.k).map((m) => ({ done: m.ended }));
      const store = AC.roleStore();
      const steps = RD.teacherSteps({ lists, weeks: everyWeek, openedResults: store ? store.openedResults() : false });
      const shared = lists.filter((l) => (l.to || []).length).sort((a, b) => (b.at || 0) - (a.at || 0))[0];
      const hrefs = ['#/grownups/own/new', '#/grownups/set', shared ? '#/grownups/own/' + encodeURIComponent(shared.id) + '/results' : '#/grownups/own'];
      const help = RD.helpList(good.map((m) => m.kid), day);
      const hrow = (h) => '<li><a class="gh-hrow" href="' + childHref(h.id) + '">' + faceOf(h.name) + '<span><b>' + esc(h.name) + '</b><small>' + esc(h.reasons.map((r) => r.line).join(' · ')) + '</small></span><span class="gh-go" aria-hidden="true">' + I.chevron + '</span></a></li>';
      middle = teacherPanel(steps, hrefs) + classTable(ordered.filter((m) => !m.problem))
        + (ordered.some((m) => m.problem) ? ordered.filter((m) => m.problem).map(failed).join('') : '')
        + (hasWeek ? '<section class="gh-card" aria-labelledby="gu-who" data-whoneeds><h2 class="gh-card__h" id="gu-who">Who needs help</h2>' + (help.length ? '<ul class="gh-hlist">' + help.map(hrow).join('') + '</ul>' : '<p class="gh-card__line">' + esc(RD.NOBODY_LINE) + '</p>') + '</section>' : '');
    } else {
      middle = '<div class="gh-cols' + (n === 1 ? ' gh-cols--one' : '') + '" data-cards>' + ordered.map((m) => (m.problem ? failed(m) : kidCard(m, role))).join('') + '</div>';
    }
    main.innerHTML = '<section class="wrap page grownups gu gh-page gh-page--wide" data-role="' + role + '">' + top + middle
      + homeTail({ role, n, limit, atLimit, hasWeek, unread }) + bar(setBtn, setLine) + '</section>';
    main.querySelectorAll('[data-retry]').forEach((b) => b.addEventListener('click', redraw));
    const three = main.querySelector('[data-step="3"]');
    if (three) three.addEventListener('click', () => { const s = AC.roleStore(); if (s) s.markOpenedResults(); });
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
  const id = safeDecode(cid);
  const wanted = gid ? safeDecode(gid) : '';
  let stopped = false;
  let c = null;
  let line = takeFlash();
  let undo = null; // { gid, name }: "Deleted. Undo", for this visit
  let problemLine = '';
  const meaningTried = new Set(); // S3-D3: typed words whose meanings were asked for this visit
  const visit = {}; // SB4-WP6: "Not now" on the level hint lasts for this visit
  const role = roleNow();
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
    const byLine = (gid) => { const row = P.childPageWeeks(d, day, ownLists().map((l) => ({ id: l.id, words: l.words }))).find((r) => r.id === gid); return row ? P.setByLine(row.setBy, nick) : ''; };
    const head = (title, sub) => '<a class="gu-back" href="#/grownups">' + I.back + esc(backName(role)) + '</a><div class="gu-top"><div class="pagehead"><span class="eyebrow">' + esc(nick) + ' · Year ' + esc(c.child.year) + '</span><h1>' + esc(title) + '</h1>'
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
    // The tutor reads the words to go over first, before the session (BR-25): the last test's slipped words and the ones to come back to.
    const before = (wk, card, report) => {
      if (role !== 'tutor') return '';
      const last = lastTested(d);
      const words = [...new Set([...(last ? last.slipped : []), ...(report ? report.comeBack : [])])];
      const facts = [last ? 'Last test ' + last.right + ' of ' + last.of : '', card && card.waiting ? plural(card.waiting, 'job') + ' waiting' : ''].filter(Boolean).join(' · ');
      return '<section class="card gh-before" data-before aria-labelledby="gh-before-h"><h2 id="gh-before-h">Before the session: words to go over</h2>' + (facts ? '<p class="gh-card__line">' + esc(facts) + '</p>' : '')
        + (words.length ? '<p class="gh-words">' + words.map((w2) => '<span class="gu-hw">' + esc(w2) + '</span>').join('') + '</p>' : '<p class="gh-card__line">Nothing to go over.</p>')
        + '<div class="gu-actions noprint"><button type="button" class="btn btn--ghost" data-print-before>' + I.print + 'Print for ' + esc(nick) + '</button></div></section>';
    };
    const nEarlier = W.liveGroups(d).filter((x) => W.testDone(d, x)).length;
    const earlier = nEarlier || o.deleted.length ? '<a class="gh-sum gu-earlier" href="' + weeksHref(id) + '" data-earlier><b>Earlier weeks</b><span class="gh-go" aria-hidden="true">' + I.chevron + '</span><small>' + plural(nEarlier, 'earlier week') + ' · ' + o.deleted.length + ' deleted</small></a>' : '';
    if (!g) {
      main.innerHTML = '<section class="wrap page grownups gu" data-noweek>' + head(nick + '\'s week', PRIVACY) + notes + before(null, null, null) + '<div data-setupcard></div>' + pickCard
        + '<div class="card gu-empty"><h2>No week yet</h2><p class="muted">Set a week of words and a test date for ' + esc(nick) + '.</p><a class="btn btn--primary" href="' + setHref(id) + '" data-plan>' + I.plus + 'Set a week</a></div><div data-setupreport></div>' + earlier + deleted + '</section>';
      wire(null);
      return;
    }
    const k = P.weekCard(d, g, day);
    const rep = P.groupReport(d, g, day);
    const words = P.weekWords(d, g, day);
    const over = W.overall(d);
    const switcher = o.weeks.length > 1
      ? '<p class="gu-switchline" data-manyweeks><b>' + esc(nick) + ' has ' + o.weeks.length + ' weeks running.</b> Pick one to look at, change or delete.</p><ul class="gu-switch" aria-label="' + esc(nick) + '\'s weeks">' + o.weeks.map((x) => '<li><a href="' + weekHref(id, x.id) + '"' + (x.id === g.id ? ' aria-current="page"' : '') + '>' + esc(x.name) + ' · ' + esc(nb(W.dayLabel(x.test))) + '<small class="gh-setby" data-setby>' + esc(byLine(x.id)) + '</small></a></li>').join('') + '</ul>' : '';
    const path = '<section class="gu-path" aria-labelledby="gu-path-h"><h2 id="gu-path-h">The path</h2><ol>' + k.steps.map((v) => '<li class="' + (v.kind.startsWith('today') ? 'is-today' : '') + '">' + stone(v)
      + '<span class="gu-path__name">' + esc(v.name) + '</span><span class="gu-path__sub">' + esc(nb(pathSub(v, k))) + '</span><span class="sr">' + esc(stoneSay(v)) + '</span></li>').join('') + '</ol></section>';
    const glance = '<section class="card gu-glance" aria-labelledby="gu-glance-h" data-glance><div class="gu-glance__head"><h2 id="gu-glance-h">At a glance</h2>'
      + chip(k.chip.key, k.chip.label + (k.chip.key === 'ontrack' ? ' · nothing waiting' : ''), ' data-chip="' + k.chip.key + '"') + '</div>'
      + '<dl class="gu-facts">' + fact('Today', k.today) + fact('Jobs waiting', waitingText(k)) + fact('Test', nb(W.dayLabel(k.test))) + fact('Stars', plural(k.stars, 'star')) + '</dl>'
      + helpRow(k)
      + '<div class="gu-actions noprint"><a class="btn btn--ghost" href="' + (k.canEdit ? editHref(id, g.id) : renameHref(id, g.id)) + '" data-edit>' + I.pencil + (k.canEdit ? 'Change words or test date' : 'Rename this week') + '</a>'
      + (k.canEdit ? '<a class="btn btn--ghost" href="' + renameHref(id, g.id) + '" data-rename>' + I.pencil + 'Rename this week</a>' : '')
      + (rep.test.taken ? '<a class="btn btn--ghost" href="' + printHref(id, g.id) + '" data-printpage>' + I.print + 'Print ' + esc(possessive(nick)) + ' results</a>'
        : '<button type="button" class="btn btn--plain" data-print>' + I.print + 'Print this week</button>')
      + '<a class="btn btn--ghost" href="' + setHref(id) + '" data-plannext>' + I.plus + 'Set next week</a>'
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
      + '<p class="small muted">' + esc(PRIVACY) + '</p><p class="small"><a class="gh-quiet" href="#/grownups/help" data-helplink>' + esc(W3[role].help) + '</a></p></section>';
    main.innerHTML = '<section class="wrap page grownups gu" data-week="' + esc(g.id) + '">' + head(g.name, plural(k.count, 'word') + ' · test ' + nb(W.dayLabel(k.test)) + ' · ' + byLine(g.id) + ' · ' + P.weekLine(k)) + notes + before(g, k, rep) + '<div data-setupcard></div>' + switcher + glance + path + wordsCard + more + '<div data-setupreport></div>' + earlier + pickCard + deleted + '</section>';
    wire(g);
    // S3-D3: a typed word's meaning comes from Wordbright's list, fetched once; only the word rows are redrawn when it arrives.
    const typedNow = words.map((w) => w.word).filter((w2) => !findEntry(w2) && !meaningTried.has(w2));
    if (typedNow.length) {
      typedNow.forEach((w2) => meaningTried.add(w2));
      meaningsFor(typedNow).then(() => {
        const ul = main.querySelector('.gu-wordlist');
        if (stopped || !ul || !typedNow.some((w2) => hasMeaning(w2))) return;
        ul.innerHTML = words.map((w) => wordRow(w, g, nick, !findEntry(w.word))).join('');
      });
    }
  }
  function pathSub(v, k) {
    const st = k.steps.find((x) => x.id === v.id);
    return P.pathLabel(v, W.dayParts(st.date).join(' '));
  }
  function wire(g) {
    const q = (s) => main.querySelector(s);
    const ctx = { id, child: c.child, words: c.words, progress: c.progress, day: today(), visit, print: !g }; // SB4-WP6
    mountSetupCard(q('[data-setupcard]'), ctx);
    mountReport(q('[data-setupreport]'), ctx);
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
    const printBefore = q('[data-print-before]');
    if (printBefore) printBefore.addEventListener('click', () => window.print());
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

/* ------------------------------------------------------ role: first use and change (00a, 00b) --- */
const ROLE_CARDS = [
  ['parent', 'My own children', 'A parent setting the school spellings at home', 'Parent'],
  ['tutor', 'Learners I tutor', 'A tutor with a different list for each learner', 'Tutor'],
  ['teacher', 'My class', 'A teacher setting one list for the whole class', 'Teacher'],
];
const SEE_LINE = { parent: 'Your children see', tutor: 'Your learners will see', teacher: 'Your class sees' };
const SEES = { parent: 'Children see', tutor: 'Learners see', teacher: 'Class sees' };
const NOUN3 = { parent: 'children', tutor: 'learners', teacher: 'class' };
/** Under the name box: what the children will see, with the name or without. Not the email (D34). */
export function nameHelp(role, name) {
  return name ? SEE_LINE[role] + ' “Set by ' + name + '”. Not your email.'
    : 'Until you ' + (role === 'parent' ? 'choose' : 'add') + ' a name your ' + NOUN3[role] + (role === 'teacher' ? ' sees' : ' see') + ' “' + W3[role].seen + '”. Not your email.';
}
/** The line over the Continue button. */
export const barLine = (role, name) => SEES[role] + ' “' + (name ? 'Set by ' + name : W3[role].seen) + '”' + (name ? '' : ' for now');
const NAME_LABEL = { parent: 'Or type another name (for example Auntie Jo)', tutor: 'Your name', teacher: 'Your name (for example Ms Patel)' };
const NAME_HOLD = { parent: 'Type a name', tutor: '', teacher: 'Type your name' };

export function rolePage(main) {
  if (!adultOnly(main)) return undefined;
  const store = AC.roleStore();
  const saved = store ? store.get() : null;
  const first = !saved;
  let stopped = false;
  let picked = saved ? saved.r : '';
  let name = saved && saved.n ? saved.n : '';
  let touched = false; // the grown-up typed or chose a name: a role tap no longer swaps it
  let pickedByHand = false;
  let accountRole = '';
  let message = '';
  const me = () => (playerName() || '');

  const nameBox = () => '<div class="gh-card gh-card--flat gh-namebox" data-namebox><h2 class="gh-card__h" id="gu-nq">' + esc(W3[picked].nameAsk) + '</h2>'
    + (picked === 'parent' ? '<div class="gh-namechips" role="group" aria-label="Common names">' + RD.CHIPS.map((c) => '<button type="button" class="gh-chipbtn' + (c === name ? ' is-on' : '') + '" aria-pressed="' + (c === name) + '" data-chip="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div>' : '')
    + '<div class="gh-field"><label for="gu-name">' + esc(NAME_LABEL[picked]) + '</label><input id="gu-name" class="gh-input" type="text" maxlength="24" autocomplete="off" autocapitalize="words" spellcheck="false" value="' + esc(name) + '"'
    + (NAME_HOLD[picked] ? ' placeholder="' + esc(NAME_HOLD[picked]) + '"' : '') + ' aria-describedby="gu-name-help" data-name>'
    + '<div id="gu-name-help" aria-live="polite">' + (message ? '<div class="gh-err" role="alert" data-nameerr>' + I.warn + '<p><b>' + esc(message) + '</b></p></div>' : '<p class="gh-help" data-namehelp>' + esc(nameHelp(picked, name)) + '</p>') + '</div></div></div>';
  const cards = () => '<fieldset class="gh-roles' + (picked ? ' is-picked' : '') + '" data-roles><legend class="sr">' + (first ? 'Who are you setting spellings for?' : 'I use Spellbright as') + '</legend>' + ROLE_CARDS.map(([r, t, ex, word]) => {
    const on = picked === r;
    return '<label class="gh-rolecard' + (on ? ' is-on' : '') + '"><input class="gh-rolecard__in" type="radio" name="role" value="' + r + '"' + (on ? ' checked' : '') + ' data-role="' + r + '">'
      + '<span class="gh-rolecard__body"><b>' + esc(t) + '</b>' + (first ? '<small>' + esc(ex) + '</small>' : '<small>' + esc(word) + '</small>') + '</span>'
      + '<span class="gh-rolecard__go" aria-hidden="true">' + (on ? I.check : first && !picked ? I.chevron : '') + '</span></label>';
  }).join('') + '</fieldset>';

  function draw(keepFocus) {
    const sub = first ? (picked && picked === accountRole && !pickedByHand ? 'Your account says ' + ROLE_CARDS.find((x) => x[0] === picked)[3] + '. Tap another card if that is not right.' : 'Pick one. You can change it later in your Account.') : '';
    const head = '<div class="gh-page__head"><h1 class="gh-h1">' + (first ? 'Who are you setting spellings for?' : 'I use Spellbright as') + '</h1>' + (sub ? '<p class="gh-sub" data-sub>' + esc(sub) + '</p>' : '') + '</div>';
    let body = cards();
    if (picked) body += nameBox();
    if (first) {
      body += picked ? '<button type="button" class="gh-quiet" data-skip>Skip: use the role words instead</button>' : '<button type="button" class="gh-quiet" data-notnow>Not now (I will use the parent pages)</button>';
      body += picked ? bar('<button type="button" class="btn btn--primary" data-continue>Continue</button>', barLine(picked, name)) : '';
    } else {
      body += '<p class="gh-help">Nothing you made will change. Only the page names, layout and the name children see.</p>'
        + '<div class="gh-bar gh-bar--two"><button type="button" class="btn btn--primary" data-save>Save</button><a class="gh-plain" href="#/grownups" data-cancel>Cancel</a></div>';
    }
    main.innerHTML = '<section class="wrap page grownups gu gh-page" data-rolepage="' + (first ? 'first' : 'change') + '">' + head + body + '</section>';
    wire();
    if (keepFocus) { const e = main.querySelector(keepFocus); if (e) e.focus(); }
  }
  function wire() {
    const q = (s) => main.querySelector(s);
    main.querySelectorAll('[data-role]').forEach((r) => r.addEventListener('change', () => {
      const changed = picked !== r.dataset.role;
      picked = r.dataset.role;
      pickedByHand = true;
      message = '';
      if (changed && !touched) name = RD.nameHint(picked, me()) || (saved && saved.r === picked && saved.n ? saved.n : '');
      draw('[data-role="' + picked + '"]');
    }));
    const input = q('[data-name]');
    if (input) {
      input.addEventListener('input', () => {
        name = input.value;
        touched = true;
        message = '';
        const clean = RD.cleanName(name);
        const line = q('.gh-bar__line');
        q('#gu-name-help').innerHTML = '<p class="gh-help" data-namehelp>' + esc(nameHelp(picked, clean)) + '</p>';
        if (line) line.textContent = barLine(picked, clean);
        main.querySelectorAll('[data-chip]').forEach((b) => { const on = b.dataset.chip === name.trim(); b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
      });
    }
    main.querySelectorAll('[data-chip]').forEach((b) => b.addEventListener('click', () => {
      name = name === b.dataset.chip ? '' : b.dataset.chip;
      touched = true;
      message = '';
      draw('[data-chip="' + CSS.escape(b.dataset.chip) + '"]');
    }));
    const done = () => { AC.roleChanged(); location.hash = '#/grownups'; };
    async function save(skipName) {
      if (!store) { location.hash = '#/grownups'; return; }
      // S7 (F-2): a role that appeared since this page opened (read from the account) is never overwritten by a pre-selected card;
      // only a card the grown-up tapped, or the Change page's own Save, writes.
      if (first && !pickedByHand && store.get()) { done(); return; }
      const nm = skipName ? '' : name.trim();
      const r = store.set(picked, nm);
      if (r.error) {
        message = r.error === 'not-saved' ? 'We could not save that on this device. Please try again.' : RD.NAME_LINE;
        draw('[data-name]');
        return;
      }
      if (stopped) return;
      const before = saved && saved.n ? saved.n : '';
      const after = r.entry.n || '';
      if (before !== after) { // children see the new name after their next read: push it now, one child after another (failures are silent)
        const c = childApi();
        A.listChildren(c).then((l) => { if (l.children && l.children.length) Sdata.pushName(c, l.children, after); }).catch(() => {});
      }
      done();
    }
    const go = q('[data-continue]') || q('[data-save]');
    if (go) go.addEventListener('click', () => save(false));
    const skip = q('[data-skip]');
    if (skip) skip.addEventListener('click', () => save(true));
    const notNow = q('[data-notnow]');
    if (notNow) notNow.addEventListener('click', () => { if (store) store.notNow(); location.hash = '#/grownups'; });
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && go) { e.preventDefault(); go.click(); } });
  }
  draw();
  // S7 (F-2): the account's saved role arrives after the page opened (second device): this page has no job any more, so leave it.
  let onPrefs = null;
  if (first && typeof window !== 'undefined' && window.addEventListener) {
    onPrefs = () => { try { if (!stopped && store && store.get() && !pickedByHand) location.replace('#/grownups'); } catch (e) { /* stay */ } };
    window.addEventListener('wa:prefs', onPrefs);
  }
  // The account may say which role the grown-up is (read only): choose that card, unless a card has been tapped already.
  if (first) {
    A.readMe(childApi()).then((f) => {
      if (stopped || !f.role) return;
      accountRole = f.role;
      if (pickedByHand || picked) return;
      picked = f.role;
      name = RD.nameHint(picked, me());
      draw();
    }).catch(() => {});
  }
  return () => { stopped = true; if (onPrefs) window.removeEventListener('wa:prefs', onPrefs); };
}

/* ---------------------------------------------------------- help for each child (D25, 05k) --- */
const HELP_SUB = {
  parent: 'How each child spells and what help they get in tests. Change opens that child’s settings.',
  tutor: 'How each learner spells and what help they get in tests. Change opens that learner’s settings.',
  teacher: 'How each child in your class spells and what help they get in tests.',
};
const NOUN1 = { parent: 'child', tutor: 'learner', teacher: 'child' };
/** "Keyboard · hints in tests on": how the child spells and the help in tests, from the child's own setup. */
export function helpLine(setup, year, name) {
  const c = P.spellCard(setup, year, name);
  return (c.lv === 5 ? 'Keyboard' : 'Letter tiles') + ' · hints in tests ' + (c.pf === 'sen' ? 'on' : 'off');
}
export function helpTable(main) {
  if (!adultOnly(main) || needsApi()) return undefined;
  const role = roleNow();
  const noun = NOUN1[role];
  let stopped = false;
  main.innerHTML = wrap('Grown-ups', W3[role].help, '', '<p class="muted">Finding your ' + noun + 's…</p>');
  (async () => {
    const lc = await A.listChildren(childApi());
    if (stopped) return;
    if (lc.problem) { showProblem(main, lc.problem); return; }
    const reads = await A.pool(lc.children, (c) => A.readChild(childApi(), c.id));
    if (stopped) return;
    const rows = lc.children.map((c, i) => (reads[i].problem
      ? '<li class="gh-helprow" data-child="' + esc(c.id) + '"><span><b>' + esc(c.nickname) + '</b><small>' + esc(P.PROBLEM_TEXT[reads[i].problem] || P.PROBLEM_TEXT.other) + '</small></span><button type="button" class="btn btn--ghost" data-retry>Try again</button></li>'
      : '<li class="gh-helprow" data-child="' + esc(c.id) + '"><span><b>' + esc(c.nickname) + '</b><small>' + esc(helpLine(reads[i].setup, c.year, c.nickname)) + '</small></span>'
        + '<a class="btn btn--ghost" href="' + childHref(c.id) + '/spelling" aria-label="Change ' + esc(possessive(c.nickname)) + ' help">Change</a></li>')).join('');
    main.innerHTML = '<section class="wrap page grownups gu gh-page" data-helppage>' + backLink('#/grownups', backName(role))
      + '<div class="gh-page__head"><h1 class="gh-h1">' + esc(W3[role].help) + '</h1><p class="gh-sub">' + esc(HELP_SUB[role]) + '</p></div>'
      + '<div class="gh-card gh-card--flat"><h2 class="sr">' + (role === 'tutor' ? 'Learner' : 'Child') + ' and help</h2><ul class="gh-helprows" data-help-table>' + rows + '</ul></div>'
      + '<p class="gh-help">Changes apply from the ' + noun + '’s next word.</p></section>';
    main.querySelectorAll('[data-retry]').forEach((b) => b.addEventListener('click', redraw));
  })();
  return () => { stopped = true; };
}
const backLink = (href, text) => '<a class="gu-back" href="' + esc(href) + '">' + I.back + esc(text) + '</a>';

/* ------------------------------------------------------------- ask for more places (06e2) --- */
// Spellbright sells nothing and takes no money (D41, TR-107 L0): the page says how to ask. The address is the account's.
export const ASK_EMAIL = ''; // set when Waystead gives the address; empty sends the grown-up to their account page instead
export function askMore(main) {
  if (!adultOnly(main) || needsApi()) return undefined;
  const role = roleNow();
  const many = role === 'tutor' ? 'learners' : 'children';
  let stopped = false;
  main.innerHTML = wrap('Grown-ups', RD.askMoreFor(role), '', '<p class="muted">One moment…</p>');
  Promise.all([A.listChildren(childApi()), A.readMe(childApi())]).then(([lc, me]) => {
    if (stopped) return;
    const n = lc.children ? lc.children.length : 0;
    const href = ASK_EMAIL ? 'mailto:' + ASK_EMAIL + '?subject=' + encodeURIComponent('More places on Spellbright') : P.accountHomeHref(accountOrigin(location));
    main.innerHTML = '<section class="wrap page grownups gu gh-page" data-askpage>' + backLink('#/grownups', backName(role))
      + '<div class="gh-page__head"><h1 class="gh-h1">' + esc(RD.askMoreFor(role)) + '</h1><p class="gh-sub" data-places>' + esc(RD.placesLine(role, n, me.limit)) + '</p></div>'
      + '<div class="gh-card gh-card--flat"><p class="gh-card__line">' + esc(RD.askLine(many, !!ASK_EMAIL)) + '</p>'
      + '<p class="gh-help">' + (role === 'parent' ? 'Children' : role === 'tutor' ? 'Learners' : 'Children') + ' are only ever added on your Waystead account. Nothing is sold inside ' + (role === 'tutor' ? 'a pupil’s' : 'a child’s') + ' pages.</p></div>'
      + '<a class="gh-quiet" href="#/grownups">Back to ' + esc(backName(role)) + '</a>'
      + bar('<a class="btn btn--primary" href="' + esc(href) + '"' + (ASK_EMAIL ? '' : ' target="_blank" rel="noopener"') + ' data-email>' + I.ext + (ASK_EMAIL ? 'Email Waystead' : 'Open your Waystead account') + '</a>', ASK_EMAIL ? 'Opens your email app' : EXT_NEW) + '</section>';
  });
  return () => { stopped = true; };
}

/* ------------------------------------------------------------------ play yourself (TR-46, 06c) --- */
const YOURSELF_SUB = { words: 'Words you pick to practise', custom: 'Choose your own', tricky: 'Words that need another go', progress: 'Chapters you have passed' };
const YOURSELF_TITLE = { tricky: 'Your own words to practise again' };
export function yourself(main) {
  if (!adultOnly(main)) return undefined;
  const role = roleNow();
  const rows = AD.yourselfRows(D.liveYears());
  main.innerHTML = '<section class="wrap page grownups gu gh-page" data-yourself>' + backLink('#/grownups', backName(role))
    + '<div class="gh-page__head"><h1 class="gh-h1">' + esc(AD.YOURSELF_TITLE) + '</h1><p class="gh-sub">Your own spelling practice. Children’s results are not affected.</p></div>'
    + '<ul class="gh-links" data-rows>' + rows.map((r) => '<li><a class="gh-sum" href="' + esc(r.href) + '" data-yrow="' + esc(r.id) + '"><b>' + esc(YOURSELF_TITLE[r.id] || r.title) + '</b><span class="gh-go" aria-hidden="true">' + I.chevron + '</span><small>' + esc(YOURSELF_SUB[r.id] || r.sub) + '</small></a></li>').join('') + '</ul>'
    + '<hr class="gh-rule"><button type="button" class="gh-quiet gh-danger" data-clearprogress>Clear my progress</button></section>';
  const clr = main.querySelector('[data-clearprogress]');
  clr.addEventListener('click', async () => {
    const yes = await confirmDialog({ title: 'Clear your progress?', body: 'This clears your own chapters and tricky words. Your children’s results are not affected. It can’t be undone.', confirm: 'Clear my progress', keep: 'Keep it', opener: clr });
    if (!yes) return;
    if (!W.mayClearProgress('adult')) return;
    S.resetAll();
    toast('Progress cleared');
  });
  return () => dismissDialog();
}

/* ------------------------------------------- print, earlier weeks, one past week (05e, 05f, 05g) --- */
const longDay = (day) => nb(W.dayLabel(day)); // "Fri 20 Nov"
const rangeLine = (g) => W.dayLabel(g.start).replace(/ \S+$/, '') + ' to ' + W.dayLabel(g.test); // "Sun 15 to Fri 20 Nov"
const scoreOf = (d, g) => { const rs = W.testResults(d, g); return { right: rs.filter((x) => x.result && x.result.right).length, of: rs.length, rows: rs }; };
const loadPage = (main, cid, after) => {
  let stopped = false;
  let inner = null;
  loadChild(safeDecode(cid)).then((got) => {
    if (stopped) return;
    if (got.problem) { showProblem(main, got.problem); return; }
    inner = after(got);
  });
  return () => { stopped = true; if (typeof inner === 'function') inner(); dismissDialog(); };
};
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall back below */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'sr';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) { return false; }
}

/** #/grownups/child/:cid/print/:gid: one child's test on one page, to print or copy as text. */
export function printWeek(main, { cid, gid } = {}) {
  if (!adultOnly(main) || needsApi()) return undefined;
  main.innerHTML = wrap('Grown-ups', 'Print', '', '<p class="muted">Loading…</p>');
  return loadPage(main, cid, ({ child, words: d }) => {
    const nick = child.nickname;
    const g = W.groupById(d, safeDecode(gid));
    const back = backLink(childHref(child.id), nick);
    if (!g) {
      main.innerHTML = '<section class="wrap page grownups gu gh-page" data-noprint>' + back + '<div class="card gu-empty"><h1>That week isn’t here</h1><p class="muted">It may have been deleted.</p></div></section>';
      return undefined;
    }
    const sc = scoreOf(d, g);
    const rows = sc.rows.map((x) => ({ word: x.word, text: x.result ? (x.result.right ? 'Right' : 'To practise again') : 'Not tested' }));
    const head = nick + ' · Year ' + child.year + ' · Spellbright';
    const sub = g.name + ' · test ' + longDay(g.test) + (sc.rows.some((x) => x.result) ? ': ' + sc.right + ' of ' + sc.of : '');
    main.innerHTML = '<section class="wrap page grownups gu gh-page gu-printpage" data-printweek>' + back
      + '<div class="gh-page__head"><h1 class="gh-h1">Print for ' + esc(nick) + '</h1></div>'
      + '<div class="gu-paper" data-paper><h2>' + esc(head) + '</h2><p>' + esc(sub) + '</p>'
      + '<table class="gu-ptable"><thead><tr><th scope="col">Word</th><th scope="col">Result</th></tr></thead><tbody>' + rows.map((r) => '<tr><td>' + esc(r.word) + '</td><td>' + esc(r.text) + '</td></tr>').join('') + '</tbody></table>'
      + '<p class="small">Only ' + esc(possessive(nick)) + ' results are on this page.</p></div>'
      + '<p class="gh-help noprint">Printed or copied results show children’s names. Keep them safe.</p>'
      + '<p class="gu-line noprint" role="status" data-copied hidden>Copied.</p>'
      + '<button type="button" class="btn btn--ghost gu-copybtn noprint" data-copy>' + I.copy + 'Copy results as text</button>'
      + '<div class="gh-bar noprint"><button type="button" class="btn btn--primary" data-printnow>' + I.print + 'Print</button></div></section>';
    main.querySelector('[data-printnow]').addEventListener('click', () => window.print());
    const copyBtn = main.querySelector('[data-copy]');
    copyBtn.addEventListener('click', async () => {
      const text = [head, sub].concat(rows.map((r) => r.word + ': ' + r.text)).join('\n');
      const ok = await copyText(text);
      const say = main.querySelector('[data-copied]');
      if (say) { say.textContent = ok ? 'Copied.' : 'We couldn’t copy. Use Print instead.'; say.hidden = false; }
    });
    return undefined;
  });
}

/** #/grownups/child/:cid/weeks: finished weeks, newest first, and the deleted ones that can still come back. */
export function earlierWeeks(main, { cid } = {}) {
  if (!adultOnly(main) || needsApi()) return undefined;
  main.innerHTML = wrap('Grown-ups', 'Earlier weeks', '', '<p class="muted">Loading…</p>');
  let c = null;
  let problemLine = '';
  let stopped = false;
  const id = safeDecode(cid);
  async function restore(gone) {
    problemLine = '';
    const r = await A.changeWords(childApi(), id, (doc) => W.restoreGroup(doc, gone, Date.now()));
    if (stopped) return;
    if (r.problem === 'playing' || r.problem === 'no-child') { showProblem(main, r.problem); return; }
    if (r.problem || r.error) problemLine = (r.problem ? P.PROBLEM_TEXT[r.problem] : r.error) + ' Nothing has been changed.';
    else c = { ...c, words: W.normalise(r.doc) };
    draw();
  }
  function draw() {
    const d = c.words;
    const nick = c.child.nickname;
    const done = W.liveGroups(d).filter((g) => W.testDone(d, g)).sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0));
    const gone = P.childOverview(d, today(), Date.now()).deleted;
    const rows = done.map((g) => {
      const s = scoreOf(d, g);
      return '<li><a class="gh-sum" href="' + weekHref(id, g.id) + '" data-pastweek="' + esc(g.id) + '"><b>' + esc(longDay(g.start) + ': ' + g.name) + '</b><span class="gh-go" aria-hidden="true">' + I.chevron + '</span><small>Test ' + s.right + ' of ' + s.of + '</small></a></li>';
    }).join('');
    const left = (x) => Math.max(0, 30 - Math.floor((Date.now() - x.gone) / 86400000));
    const deleted = gone.length ? '<h2 class="gh-h2">Deleted weeks (' + gone.length + ')</h2><p class="gh-help">You can bring a week back within 30 days.</p><ul class="gh-links" data-deletedweeks>'
      + gone.map((x) => '<li class="gu-gone" data-gone="' + esc(x.id) + '"><b>' + esc(x.name) + '</b><span class="gh-pill">' + left(x) + ' days left</span><button type="button" class="btn btn--ghost" data-restore="' + esc(x.id) + '">Bring back this week<span class="sr">: ' + esc(x.name) + '</span></button></li>').join('') + '</ul>' : '';
    main.innerHTML = '<section class="wrap page grownups gu gh-page" data-earlierweeks>' + backLink(childHref(id), nick)
      + '<div class="gh-page__head"><h1 class="gh-h1">' + esc(possessive(nick)) + ' earlier weeks</h1><p class="gh-sub">These weeks are finished. You can look and use the list again.</p></div>'
      + (problemLine ? '<p class="gu-line gu-line--warn" role="alert">' + esc(problemLine) + '</p>' : '')
      + (rows ? '<ul class="gh-links" data-weeks>' + rows + '</ul>' : '<p class="muted" data-noearlier>No finished weeks yet.</p>')
      + (gone.length ? '' : '<p class="gh-quiet-line">Deleted weeks (0)</p>') + deleted + '</section>';
    main.querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', () => restore(b.dataset.restore)));
  }
  loadChild(id).then((got) => {
    if (stopped) return;
    if (got.problem) { showProblem(main, got.problem); return; }
    c = got;
    draw();
  });
  return () => { stopped = true; dismissDialog(); };
}

/** #/grownups/child/:cid/week/:gid for a finished week: read only, with "Use this list again". A week still running opens the child page. */
export function pastWeek(main, { cid, gid } = {}) {
  if (!adultOnly(main) || needsApi()) return undefined;
  main.innerHTML = wrap('Grown-ups', 'Earlier week', '', '<p class="muted">Loading…</p>');
  let stopped = false;
  let inner = null;
  const id = safeDecode(cid);
  const wanted = safeDecode(gid);
  loadChild(id).then((got) => {
    if (stopped) return;
    if (got.problem) { showProblem(main, got.problem); return; }
    const d = got.words;
    const g = W.groupById(d, wanted);
    if (g && !g.gone && !W.testDone(d, g)) { inner = childDashboard(main, { cid, gid }); return; }
    const nick = got.child.nickname;
    if (!g || g.gone) {
      main.innerHTML = '<section class="wrap page grownups gu gh-page">' + backLink(weeksHref(id), 'Earlier weeks') + '<div class="card gu-empty"><h1>That week isn’t here</h1><p class="muted">It may have been deleted.</p></div></section>';
      return;
    }
    const s = scoreOf(d, g);
    const slipped = W.slipped(d, g);
    const oid = SD.weekListOid(g.id);
    const haveList = !!oid && ownLists().some((l) => l.id === oid);
    const chips = (ws, cls = '') => '<span class="gh-chips">' + ws.map((w) => '<span class="gh-wchip' + cls + '">' + esc(w) + '</span>').join('') + '</span>';
    main.innerHTML = '<section class="wrap page grownups gu gh-page" data-pastweek-page="' + esc(g.id) + '">' + backLink(weeksHref(id), 'Earlier weeks')
      + '<div class="gh-page__head"><span class="eyebrow">Earlier week · read only</span><h1 class="gh-h1">' + esc(g.name) + '</h1><p class="gh-sub">' + esc(nick + ' · ' + rangeLine(g) + ' · test ' + s.right + ' of ' + s.of) + '</p></div>'
      + '<div class="gh-note"><p><b>Finished on ' + esc(longDay(g.test)) + '.</b> The words and date can’t change now. The name can.</p></div>'
      + '<a class="btn btn--ghost" href="' + renameHref(id, g.id) + '" data-rename>Rename this week</a>'
      + '<h2 class="gh-h2">Words</h2>' + chips(g.words)
      + (slipped.length ? '<h2 class="gh-h2">To practise again</h2>' + chips(slipped, ' is-miss') : '')
      + '<hr class="gh-rule"><button type="button" class="gh-quiet gh-danger" data-delete>Delete this week</button>'
      + '<div class="gh-bar"><button type="button" class="btn btn--primary" data-again>' + I.again + 'Use this list again</button><p class="gh-bar__line">Opens Set a week with these words</p></div></section>';
    main.querySelector('[data-again]').addEventListener('click', () => {
      if (haveList) { location.hash = '#/grownups/set/list/' + encodeURIComponent(oid); return; }
      handOffWords(g.words);
      location.hash = setHref(id);
    });
    const del = main.querySelector('[data-delete]');
    del.addEventListener('click', async () => {
      const yes = await confirmDialog({ title: P.deleteQuestion(g.name, nick), body: P.deleteBody(nick), confirm: 'Delete this week', keep: 'Keep it', opener: del });
      if (!yes || stopped) return;
      const r = await A.changeWords(childApi(), id, (doc) => ({ doc: W.deleteGroup(doc, g.id, Date.now()) }));
      if (stopped) return;
      if (r.problem || r.error) { toast((r.problem ? P.PROBLEM_TEXT[r.problem] : r.error) + ' Nothing has been changed.'); return; }
      location.hash = weeksHref(id);
    });
  });
  return () => { stopped = true; if (typeof inner === 'function') inner(); dismissDialog(); };
}
