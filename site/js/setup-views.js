// SB4-WP6: the grown-ups' pages for how a child spells (letters or keyboard, help in tests, tests to offer),
// exams ("Big test" to the child), honest result lines, and the overview of all children.
// Every page starts with adultOnly: a child, or an adult playing as one, gets the switch-back card and
// no call is made. The choice is saved inside the child's words through the account (changeSetup) and
// nowhere on this device. The rules are in setup-doc.js, assess-doc.js and grownups-doc.js.
import * as D from './data.js';
import * as W from './words-doc.js';
import * as Su from './setup-doc.js';
import * as As from './assess-doc.js';
import * as T from './tiles-doc.js';
import * as P from './grownups-doc.js';
import * as Dt from './grownups-data.js';
import { adultOnly } from './grownups-views.js';
import { adultName } from './adult-doc.js';
import { playerName, recheckWho } from './who.js';
import { newId } from './store.js';
import { esc, ICON } from './ui.js';
import { accountOrigin } from './account/config.js';

const today = () => W.localDay(Date.now());
let api = null;
const childApi = () => { if (!api) api = Dt.createChildApi({ origin: accountOrigin(location) }); return api; };
const redraw = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
const byName = () => adultName({ name: playerName() });
const childHref = (id) => '#/grownups/child/' + encodeURIComponent(id);
const spellHref = (id) => childHref(id) + '/spelling';
const examHref = (id) => childHref(id) + '/exam';
const examReportHref = (id, eid) => examHref(id) + '/' + encodeURIComponent(eid);
const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
const dateOf = (ms) => W.dayLabel(W.localDay(ms));

// One line carried to the next page, read once.
let flash = '';
const takeFlash = () => { const f = flash; flash = ''; return f; };

const svg = (inner) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + inner + '</svg>';
const I = {
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7"/>'),
  print: svg('<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2"/><path d="M7 14h10v6H7z"/>'),
  star: svg('<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
};

const wrap = (eyebrow, title, line, body) => '<section class="wrap page grownups gu"><div class="pagehead"><span class="eyebrow">' + esc(eyebrow) + '</span><h1>' + esc(title) + '</h1>'
  + (line ? '<p class="muted">' + esc(line) + '</p>' : '') + '</div>' + body + '</section>';
const backLink = (href, text) => '<a class="gu-back" href="' + href + '">' + I.back + esc(text) + '</a>';

// A call that failed, as a whole page: always the reason and a way on, never an empty page.
async function showProblem(main, problem) {
  if (problem === 'playing') { await recheckWho(); if (!adultOnly(main)) return; } // the card is up; if not, say why below
  if (problem === 'signed-out') recheckWho();
  const gone = problem === 'no-child';
  main.innerHTML = wrap('Grown-ups', gone ? P.PROBLEM_TEXT['no-child'] : 'That didn\'t load', gone ? '' : (problem === 'playing' ? P.playingLine(playerName()) : P.PROBLEM_TEXT[problem]),
    '<div class="btnrow" data-problem="' + esc(problem) + '">' + (gone ? '' : '<button type="button" class="btn btn--primary" data-retry>Try again</button>')
    + '<a class="btn ' + (gone ? 'btn--primary' : 'btn--ghost') + '" href="#/grownups">Back to the list</a></div>');
  const retry = main.querySelector('[data-retry]');
  if (retry) retry.addEventListener('click', redraw);
}

// The child, checked against this adult's own list first.
async function loadChild(cid) {
  const { children, problem } = await Dt.listChildren(childApi());
  if (problem) return { problem };
  const child = children.find((c) => c.id === cid);
  if (!child) return { problem: 'no-child' };
  const data = await Dt.readChild(childApi(), cid);
  return data.problem ? data : { child, ...data };
}
// 0 when the account gave no year: nothing then claims a year.
const yearOf = (child) => (Number.isInteger(Number(child.year)) && Number(child.year) >= 1 && Number(child.year) <= 6 ? Number(child.year) : 0);
const yearBit = (year) => (year ? ' · Year ' + year : '');
const noApi = () => { if (Dt.CHILD_DATA_API) return false; location.replace('#/grownups'); return true; };

/** A real dialog: focus inside, Tab stays in it, Escape and the keep button close it. Answers true to confirm. */
let dismissDialog = () => {};
function confirmDialog({ title, body, confirm, keep, opener }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'gu-overlay';
    overlay.innerHTML = '<div class="gu-dialog" role="dialog" aria-modal="true" aria-labelledby="gu-sdtitle" aria-describedby="gu-sdbody" data-dialog><h2 id="gu-sdtitle">' + esc(title) + '</h2><p id="gu-sdbody">' + esc(body) + '</p>'
      + '<div class="btnrow"><button type="button" class="btn btn--destroy" data-confirm>' + esc(confirm) + '</button><button type="button" class="btn btn--ghost" data-keep>' + esc(keep) + '</button></div></div>';
    const prior = document.activeElement;
    const inert = [...document.body.children].filter((e) => e !== overlay && !e.hasAttribute('inert'));
    inert.forEach((e) => e.setAttribute('inert', ''));
    document.body.appendChild(overlay);
    const buttons = [...overlay.querySelectorAll('button')];
    const close = (answer) => {
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('hashchange', away);
      if (dismissDialog === away) dismissDialog = () => {};
      overlay.remove();
      inert.forEach((e) => e.removeAttribute('inert'));
      const back = opener && document.contains(opener) ? opener : prior;
      if (back && back.focus) back.focus();
      resolve(answer);
    };
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(false); return; }
      if (e.key !== 'Tab') return;
      const at = buttons.indexOf(document.activeElement);
      e.preventDefault();
      buttons[(at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    }
    function away() { close(false); }
    dismissDialog = away;
    window.addEventListener('hashchange', away);
    document.addEventListener('keydown', onKey, true);
    overlay.querySelector('[data-confirm]').addEventListener('click', () => close(true));
    overlay.querySelector('[data-keep]').addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    overlay.querySelector('[data-keep]').focus();
  });
}

/* --------------------------------------------------------- still pictures --- */
const APPLE = { word: 'apple', chunks: ['ap', 'ple'], tricky: 'pp' };
const KEY_ROWS = [10, 9, 7];
const keyboardPic = () => '<span class="gu-kbpic">' + KEY_ROWS.map((n) => '<span class="gu-kbpic__row">' + '<span class="gu-kbpic__key"></span>'.repeat(n) + '</span>').join('') + '</span>';
/** A small still picture of "apple" at this level: shown letters, dashed gaps. Level 5 is a tiny keyboard. */
function smallPicture(lv) {
  if (lv === 5) return '<span class="gu-tilepreview gu-tilepreview--kb" aria-hidden="true">' + keyboardPic() + '</span>';
  const spec = T.tilesFor(APPLE, lv, 1);
  return '<span class="gu-tilepreview" aria-hidden="true">' + spec.letters.map((l) => (l.shown ? '<span class="gu-tp gu-tp--shown">' + esc(l.ch) + '</span>' : '<span class="gu-tp gu-tp--gap"></span>')).join('') + '</span>';
}
/** A larger still copy of the spelling card at this level. */
function bigPicture(lv) {
  if (lv === 5) {
    return '<div class="gu-seecard" aria-hidden="true"><p class="gu-seecard__say">Type the word.</p><div class="gu-seecard__word">' + '<span class="gu-tp gu-tp--gap"></span>'.repeat(5) + '</div>' + keyboardPic() + '</div>';
  }
  const spec = T.tilesFor(APPLE, lv, 1);
  return '<div class="gu-seecard" aria-hidden="true"><p class="gu-seecard__say">Tap the missing letters.</p><div class="gu-seecard__word">'
    + spec.letters.map((l) => (l.shown ? '<span class="gu-tp gu-tp--shown">' + esc(l.ch) + '</span>' : '<span class="gu-tp gu-tp--gap"></span>')).join('') + '</div>'
    + '<div class="gu-seecard__tray">' + spec.tiles.map((t) => '<span class="gu-tp gu-tp--tile">' + esc(t.ch) + '</span>').join('') + '</div>'
    + '<div class="gu-seecard__btns"><span class="gu-seecard__btn">Back</span><span class="gu-seecard__btn gu-seecard__btn--go">Check</span></div></div>';
}

/* ------------------------------------------------------------ the screen --- */
const LEVEL_TEXT = (name) => ({
  1: 'A few letters are missing, usually the tricky part.',
  2: 'Some letters are missing.',
  3: 'Most letters are missing.',
  4: 'Every letter is a tile. ' + name + ' builds the whole word.',
  5: name + ' types the whole word.',
});
const badge = (year) => !year ? '' : '<span class="gu-badge">' + I.star + esc(As.RECOMMENDED(year)) + '</span>';

export function spellingPage(main, { cid }) {
  if (!adultOnly(main) || noApi()) return undefined;
  const id = decodeURIComponent(cid);
  let stopped = false;
  let c = null;
  let warn = '';
  let retry = null; // the change that failed, for Try again
  let saving = false;
  let lastFocus = '';
  main.innerHTML = wrap('Grown-ups', 'How your child spells', '', '<p class="muted">Loading…</p>');
  // One status line for the whole visit: it is set with textContent, never rebuilt, so a screen reader hears each change.
  const statusEl = document.createElement('p');
  statusEl.setAttribute('role', 'status');
  statusEl.setAttribute('data-status', '');
  const say = (text) => { statusEl.textContent = text; statusEl.className = 'gu-line' + (text ? '' : ' is-empty'); };
  say('');

  function frame() {
    const name = c.child.nickname;
    const year = yearOf(c.child);
    main.innerHTML = '<section class="wrap page grownups gu gu-spell" data-spelling>' + backLink(childHref(id), name + '’s page')
      + '<div class="pagehead"><span class="eyebrow">' + esc(name + yearBit(year)) + '</span><h1>' + esc(P.spellTitle(name)) + '</h1><p class="muted">' + esc(P.spellSub(name, year)) + '</p></div>'
      + '<div data-slot="status"></div><p class="small muted gu-changed" data-changed></p><div data-slot="warn"></div><div class="gu-set" data-body></div></section>';
    main.querySelector('[data-slot="status"]').replaceWith(statusEl);
  }

  function draw(focus) {
    if (focus !== undefined) lastFocus = focus;
    const name = c.child.nickname;
    const year = yearOf(c.child);
    const s = c.setup;
    const lv = Su.effectiveLevel(s, year, true);
    const pf = Su.effectiveProfile(s, true);
    const off = Su.offers(s);
    const card = P.spellCard(s, year, name);
    const rec = As.SUGGEST[year] ? As.SUGGEST[year].lv : 0;
    const texts = LEVEL_TEXT(name);
    const levels = [1, 2, 3, 4, 5].map((n) => '<label class="gu-radio gu-opt" data-opt-lv="' + n + '"><input type="radio" name="lv" value="' + n + '"' + (n === lv ? ' checked' : '') + '>'
      + smallPicture(n) + '<span class="gu-radio__text"><b>' + esc(As.LEVEL_NAME[n]) + '</b><span>' + esc(texts[n]) + '</span>' + (n === rec ? badge(year) : '') + '</span></label>').join('');
    const helps = As.PROFILES.map((p) => '<label class="gu-radio gu-opt" data-opt-pf="' + p + '"><input type="radio" name="pf" value="' + p + '"' + (p === pf ? ' checked' : '') + '>'
      + '<span class="gu-radio__text"><b>' + esc(As.PROFILE_NAME[p]) + '</b><span>' + esc(As.PROFILE_HELP[p]) + '</span>' + (p === 'normal' ? badge(year) : '') + '</span></label>').join('');
    const offers = '<label class="gu-check gu-opt"><input type="checkbox" name="quiz"' + (off.quiz ? ' checked' : '') + '><span class="gu-radio__text"><b>Quiz</b><span>' + esc(P.QUIZ_OFFER_TEXT) + '</span></span></label>'
      + '<label class="gu-check gu-opt is-fixed"><input type="checkbox" name="test" checked disabled><span class="gu-radio__text"><b>Test</b><span>' + esc(P.TEST_OFFER_TEXT) + '</span></span></label>'
      + '<label class="gu-check gu-opt"><input type="checkbox" name="exam"' + (off.exam ? ' checked' : '') + '><span class="gu-radio__text"><b>Exam</b><span>' + esc(P.examOfferText(name, year, pf)) + '</span></span></label>';
    main.querySelector('[data-changed]').textContent = card.changed;
    const warnSlot = main.querySelector('[data-slot="warn"], [data-warnbox]');
    warnSlot.outerHTML = '<div data-warnbox>' + (warn ? '<p class="gu-line gu-line--warn" role="alert" data-problemline><span>' + esc(warn) + '</span>' + (retry ? '<button type="button" class="btn btn--ghost" data-tryagain>Try again</button>' : '') + '</p>' : '') + '</div>';
    main.querySelector('[data-body]').innerHTML = '<div class="gu-set__groups">'
      + '<fieldset class="card gu-group" data-group="letters" aria-describedby="gu-g1help"><legend><h2>Letters or keyboard</h2></legend><p class="muted" id="gu-g1help">How much of each word ' + esc(name) + ' fills in. The small picture shows the word “apple”.</p>' + levels
      + '<p class="small muted gu-quiet" data-tilesnote>' + esc(P.SPELL_TILES_NOTE) + '</p></fieldset>'
      + '<fieldset class="card gu-group" data-group="help"><legend><h2>Help in tests</h2></legend>' + helps
      + (pf === 'top' && lv < 5 ? '<p class="small muted gu-quiet" data-stretchnote>' + esc(P.stretchNote(lv)) + '</p>' : '') + '</fieldset>'
      + '<fieldset class="card gu-group" data-group="offer"><legend><h2>Tests to offer</h2></legend>' + offers + '</fieldset>'
      + '</div>'
      + '<aside class="card gu-panel gu-see" data-see aria-labelledby="gu-seeh"><h2 id="gu-seeh">See what ' + esc(name) + ' will see</h2><p class="muted small" data-seeline>Updates as you choose. Showing ' + esc(As.LEVEL_NAME[lv]) + '.</p>' + bigPicture(lv) + '</aside>';
    wire();
    if (lastFocus) {
      const el = main.querySelector(lastFocus);
      if (el) el.focus();
    }
  }

  // Each tap saves at once. The controls are off while it saves, so no tap is lost; a failed save puts the choice back.
  async function apply(make, focus) {
    if (saving) return;
    saving = true;
    warn = '';
    retry = null;
    say('');
    lastFocus = focus;
    main.querySelectorAll('[data-body] input:not([name=test])').forEach((el) => { el.disabled = true; });
    const r = await Dt.changeSetup(childApi(), id, (s) => ({ setup: make(s) }));
    saving = false;
    if (stopped) return;
    if (r.problem === 'playing' || r.problem === 'no-child') { showProblem(main, r.problem); return; }
    if (r.problem === 'signed-out') recheckWho();
    if (r.problem || r.error) {
      warn = (r.problem ? P.PROBLEM_TEXT[r.problem] : r.error) + ' Nothing has been changed.';
      retry = () => apply(make, focus);
      draw();
      return;
    }
    c = { ...c, words: W.normalise(r.doc), setup: W.setupOf(W.normalise(r.doc)) };
    say(As.SAVED(c.child.nickname));
    draw();
  }

  function wire() {
    main.querySelectorAll('input[name=lv]').forEach((el) => el.addEventListener('change', () => {
      const n = Number(el.value);
      apply((s) => Su.setHelp(s, n, Date.now(), byName()), 'input[name=lv][value="' + n + '"]');
    }));
    main.querySelectorAll('input[name=pf]').forEach((el) => el.addEventListener('change', () => {
      apply((s) => Su.setProfile(s, el.value, Date.now(), byName()), 'input[name=pf][value="' + el.value + '"]');
    }));
    ['quiz', 'exam'].forEach((k) => {
      const el = main.querySelector('input[name=' + k + ']');
      if (!el) return;
      el.addEventListener('change', () => {
        const on = el.checked;
        apply((s) => { const o = Su.offers(s); return Su.setOffer(s, { quiz: k === 'quiz' ? on : o.quiz, exam: k === 'exam' ? on : o.exam }, Date.now()); }, 'input[name=' + k + ']');
      });
    });
    const again = main.querySelector('[data-tryagain]');
    if (again) again.addEventListener('click', () => { if (retry) retry(); });
  }

  loadChild(id).then((got) => {
    if (stopped) return;
    if (got.problem) { showProblem(main, got.problem); return; }
    c = got;
    frame();
    draw();
  });
  return () => { stopped = true; };
}

/* ------------------------------------------------------ the card on the page --- */
/**
 * The card "How <name> spells" on the child's page, drawn into `host`. ctx: { id, child, words, progress, day, visit }.
 * `visit` is one object for this visit to the page: "Not now" is remembered on it.
 */
export function mountSetupCard(host, ctx) {
  if (!host) return;
  let setup = W.setupOf(ctx.words);
  const name = ctx.child.nickname;
  const year = yearOf(ctx.child);
  // The card is built once; its status line is set with textContent so it is never rebuilt.
  host.innerHTML = '<section class="card gu-spellcard" data-spellcard aria-labelledby="gu-sc-h"><h2 id="gu-sc-h"></h2>'
    + '<p data-sc-level></p><p data-sc-help></p><p class="small muted" data-sc-changed></p><p class="small muted" data-sc-usual></p>'
    + '<p class="gu-line is-empty" role="status" data-sc-flash></p><p class="gu-line gu-line--warn" role="alert" data-sc-warn hidden></p>'
    + '<div data-sc-hint></div><div class="gu-actions noprint"><a class="btn btn--ghost" href="' + spellHref(ctx.id) + '" data-spell-change>Change</a></div></section>';
  const q = (sel) => host.querySelector(sel);
  const setText = (sel, t) => { const el = q(sel); el.textContent = t; el.hidden = !t; };
  const flashEl = q('[data-sc-flash]');
  const say = (t) => { flashEl.textContent = t; flashEl.className = 'gu-line' + (t ? '' : ' is-empty'); };
  const draw = () => {
    const card = P.spellCard(setup, year, name);
    const hint = ctx.visit && ctx.visit.notNow ? null : P.levelHint(ctx.words, ctx.day, setup, year, name);
    q('#gu-sc-h').textContent = card.title;
    q('[data-sc-level]').textContent = card.lines[0];
    q('[data-sc-help]').textContent = card.lines[1];
    setText('[data-sc-changed]', card.changed);
    setText('[data-sc-usual]', card.usual);
    const box = q('[data-sc-hint]');
    box.innerHTML = hint ? '<div class="gu-hint" data-levelhint role="group" aria-label="Fewer letters"><p><b>' + esc(hint.line) + '</b></p><div class="btnrow"><button type="button" class="btn btn--primary" data-hint-yes>Yes</button><button type="button" class="btn btn--ghost" data-hint-no>Not now</button></div></div>' : '';
    const yes = box.querySelector('[data-hint-yes]');
    const no = box.querySelector('[data-hint-no]');
    if (yes) {
      yes.addEventListener('click', async () => {
        yes.disabled = true;
        const r = await Dt.changeSetup(childApi(), ctx.id, (s) => ({ setup: Su.setHelp(s, hint.next, Date.now(), byName()) }));
        if (!host.isConnected) return;
        if (r.ok) { setup = W.setupOf(W.normalise(r.doc)); ctx.words = W.normalise(r.doc); say(As.SAVED(name)); setText('[data-sc-warn]', ''); } else { setText('[data-sc-warn]', (r.problem ? P.PROBLEM_TEXT[r.problem] : r.error) + ' Nothing has been changed.'); }
        draw();
      });
    }
    if (no) {
      no.addEventListener('click', () => {
        if (ctx.visit) ctx.visit.notNow = true;
        draw();
        q('[data-spell-change]').focus();
      });
    }
  };
  draw();
}

/* ------------------------------------------------------ the report sections --- */
/** The sections of "what the page reports": years, from you, tests, quizzes, exams. Stored facts only. */
export function reportHtml(ctx) {
  const { id, child, words: d, progress, day } = ctx;
  const setup = W.setupOf(d);
  const name = child.nickname;
  const off = Su.offers(setup);
  const chapters = D.allChapters();
  const weekName = (gid) => { const g = W.liveGroups(d).find((x) => x.id === gid); return g ? g.name : 'a week'; };
  const own = P.ownRows(setup, progress);
  const nameOf = (src) => {
    const ch = D.chapterById(src);
    if (ch) return P.chapterLabel(ch);
    if (/^g-/.test(src)) return weekName(src.slice(2));
    const o = own.find((x) => 'own-' + x.id === src);
    return o ? o.name : '';
  };
  const years = D.liveYears().map((yid) => {
    const chs = D.chapters(yid);
    const counts = P.yearCounts(chs, progress);
    const tests = chs.map((ch) => ({ ch, t: P.chapterTestLine(progress, ch, 'Chapter ' + ch.n) })).filter((x) => x.t);
    return '<li class="gu-year" data-year="' + esc(yid) + '"><h4>' + esc(D.years()[yid].label) + '</h4><p data-yearcounts>' + esc(P.yearCountsLine(counts)) + '</p>'
      + (tests.length ? '<ul class="gu-lines">' + tests.map((x) => '<li data-chapter-test="' + esc(x.ch.id) + '"><span>' + esc(x.t.line) + '</span>' + (x.t.passed ? '<span class="gu-tag gu-tag--pass">Passed</span>' : '') + '</li>').join('') + '</ul>' : '')
      + '</li>';
  }).join('');
  const fromYou = own.length
    ? '<h3>From you</h3><ul class="gu-lines" data-fromyou>' + own.map((o) => '<li data-own="' + esc(o.id) + '"><span><b>' + esc(o.name) + '</b></span><span class="gu-tag">' + esc(P.stateText(o.state)) + '</span></li>').join('') + '</ul>' : '';
  const weekLines = W.liveGroups(d).map((g) => ({ g, line: P.weekTestLine(d, g) })).filter((x) => x.line);
  const weeks = weekLines.length ? '<h3>Weeks</h3><ul class="gu-lines" data-weeklines>' + weekLines.map((x) => '<li data-weekline="' + esc(x.g.id) + '"><span>' + esc(x.line) + '</span></li>').join('') + '</ul>' : '';
  const quizzes = P.quizLines(progress, nameOf);
  const quizHtml = quizzes.length ? '<h3>Quizzes</h3><ul class="gu-lines" data-quizlines>' + quizzes.map((q) => '<li><span>' + esc(q.line) + '</span></li>').join('') + '</ul>' : '';
  const exams = Su.liveExams(setup).map((e) => {
    const st = P.examNow(progress, e, day);
    const score = st.state === 'done' && st.last ? ' · ' + st.last.s + ' of ' + st.last.t : '';
    return '<li data-exam="' + esc(e.id) + '"><a href="' + examReportHref(id, e.id) + '"><b>' + esc(e.name) + '</b><span>' + esc(W.dayLabel(e.date)) + ' · ' + esc(P.examStateLine(st.state, e, st.last)) + esc(score) + '</span></a></li>';
  }).join('');
  const examHtml = '<h3>Exams</h3>' + (exams ? '<ul class="gu-lines gu-lines--links" data-examlist>' + exams + '</ul>' : '<p class="muted small">No exams set.</p>')
    + (off.exam ? '<div class="gu-actions noprint"><a class="btn btn--ghost" href="' + examHref(id) + '" data-setexam>' + I.plus + 'Set an exam</a></div>' : '');
  return '<section class="card gu-report" data-report aria-labelledby="gu-rep-h"><div class="gu-report__head"><h2 id="gu-rep-h">' + esc(name) + '’s results</h2>'
    + (ctx.print ? '<button type="button" class="btn btn--plain noprint" data-print-report>' + I.print + 'Print this page</button>' : '') + '</div>'
    + '<p class="small muted">Each line says how the test was taken. Only what has been saved is shown.</p>'
    + '<h3>Chapters</h3><ul class="gu-years" data-years>' + years + '</ul>' + fromYou + weeks + quizHtml + examHtml + '</section>';
}
export function mountReport(host, ctx) {
  if (!host) return;
  host.innerHTML = reportHtml(ctx);
  const b = host.querySelector('[data-print-report]');
  if (b) b.addEventListener('click', () => window.print());
}

/* ------------------------------------------------------------- set an exam --- */
export function examForm(main, { cid }) {
  if (!adultOnly(main) || noApi()) return undefined;
  const id = decodeURIComponent(cid);
  const eid = newId(); // one id for this form, so a try again never makes a second exam
  let stopped = false;
  let c = null;
  let saving = false;
  let sources = [];
  let chosen = new Set();
  let date = '';
  let nameText = '';
  let message = '';
  main.innerHTML = wrap('Grown-ups', 'Set an exam', '', '<p class="muted">Loading…</p>');

  const pf = () => Su.effectiveProfile(c.setup, true);
  const plan = () => P.examPlan(sources, [...chosen], pf());

  function draw() {
    const name = c.child.nickname;
    const year = yearOf(c.child);
    const kind = As.kindName('exam', pf(), year);
    if (!Su.offers(c.setup).exam) {
      main.innerHTML = '<section class="wrap page grownups gu" data-examoff>' + backLink(childHref(id), name + '’s page') + '<div class="card gu-empty"><h1>Exams are off for ' + esc(name) + '</h1>'
        + '<p class="muted">Switch them on in “' + esc(P.spellTitle(name)) + '”, under Tests to offer.</p><a class="btn btn--primary" href="' + spellHref(id) + '">' + esc(P.spellTitle(name)) + '</a></div></section>';
      return;
    }
    const rows = sources.map((s) => '<label class="gu-check gu-opt' + (s.ready ? '' : ' is-off') + '" data-src="' + esc(s.key) + '"><input type="checkbox" value="' + esc(s.key) + '"' + (chosen.has(s.key) ? ' checked' : '') + (s.ready ? '' : ' disabled') + '>'
      + '<span class="gu-radio__text"><b>' + esc(s.label) + '</b><span>' + (s.ready ? esc(plural(s.words.length, 'word')) : esc(P.EXAM_NOT_DONE)) + '</span></span></label>').join('');
    const pl = plan();
    main.innerHTML = '<section class="wrap page grownups gu gu-examform" data-examform>' + backLink(childHref(id), name + '’s page')
      + '<div class="pagehead"><span class="eyebrow">' + esc(name) + esc(yearBit(year)) + '</span><h1>Set an exam for ' + esc(name) + '</h1><p class="muted">' + esc(name) + ' sees ‘' + esc(kind) + '’. It only uses words whose test is done.</p></div>'
      + '<div class="gu-set"><div class="gu-set__groups">'
      + '<fieldset class="card gu-group" data-group="include"><legend><h2>What to include</h2></legend><p class="muted">Choose chapters and weeks. A test still to come never shows its words.</p>'
      + (rows || '<p class="muted">Nothing to choose yet.</p>') + '<p class="gu-count" data-examline aria-live="polite">' + esc(P.examSummary(pl)) + '</p></fieldset>'
      + '<div class="card gu-group" data-group="when"><h2>When</h2><div class="gu-field"><label for="gu-exdate">Date</label><input class="field" type="date" id="gu-exdate" min="' + esc(c.day) + '" value="' + esc(date) + '"></div>'
      + '<div class="gu-field"><label for="gu-exname">Name (optional)</label><input class="field" type="text" id="gu-exname" maxlength="' + Su.MAX_NAME + '" placeholder="' + esc(P.examDefaultName(date || c.day)) + '" value="' + esc(nameText) + '" autocomplete="off"></div></div>'
      + '</div><aside class="card gu-panel gu-see" data-see><h2>What ' + esc(name) + ' will get</h2>'
      + '<dl class="gu-facts"><div class="gu-fact"><dt>' + esc(name) + ' sees</dt><dd>' + esc(kind) + '</dd></div><div class="gu-fact"><dt>Words</dt><dd data-exwords>' + esc(String(pl.n)) + '</dd></div>'
      + '<div class="gu-fact"><dt>Help in tests</dt><dd>' + esc(As.PROFILE_NAME[pf()]) + '</dd></div></dl>'
      + '<p class="gu-error" role="alert" data-error>' + esc(message) + '</p>'
      + '<button type="button" class="btn btn--primary" data-setexam-go' + (saving ? ' disabled' : '') + '>Set the exam</button></aside></div></section>';
    wire();
  }

  function wire() {
    main.querySelectorAll('[data-src] input').forEach((el) => el.addEventListener('change', () => {
      if (el.checked) chosen.add(el.value); else chosen.delete(el.value);
      message = '';
      const pl = plan();
      main.querySelector('[data-examline]').textContent = P.examSummary(pl);
      main.querySelector('[data-exwords]').textContent = String(pl.n);
      main.querySelector('[data-error]').textContent = '';
    }));
    const dateEl = main.querySelector('#gu-exdate');
    const nameEl = main.querySelector('#gu-exname');
    dateEl.addEventListener('input', () => { date = dateEl.value; nameEl.placeholder = P.examDefaultName(date || c.day); });
    nameEl.addEventListener('input', () => { nameText = nameEl.value; });
    main.querySelector('[data-setexam-go]').addEventListener('click', save);
  }

  async function save() {
    if (saving) return;
    const err = main.querySelector('[data-error]');
    const pl = plan();
    const problem = P.examProblem({ keys: pl.keys, date, today: today(), liveCount: Su.liveExams(c.setup).length });
    if (problem) { message = problem; err.textContent = problem; return; }
    saving = true;
    const btn = main.querySelector('[data-setexam-go]');
    btn.disabled = true;
    err.textContent = '';
    const finalName = (nameText.trim() || P.examDefaultName(date)).slice(0, Su.MAX_NAME);
    const picked = As.examWords(pl.pools, pf(), T.rng(T.seedOf(eid, date)));
    const r = await Dt.changeSetup(childApi(), id, (s) => Su.setExam(s, eid, { name: finalName, words: picked, from: pl.keys, date }, Date.now()));
    saving = false;
    if (stopped) return;
    if (r.ok) {
      flash = As.SAVED(c.child.nickname);
      location.hash = examReportHref(id, eid);
      return;
    }
    if (r.problem === 'playing' || r.problem === 'no-child') { showProblem(main, r.problem); return; }
    if (r.problem === 'signed-out') recheckWho();
    btn.disabled = false;
    message = r.error === 'too-many' ? P.examPlanLimit() : r.error ? 'That exam could not be saved. Check the name and the date.' : P.PROBLEM_TEXT[r.problem] + ' Nothing has been saved.';
    err.textContent = message;
  }

  loadChild(id).then((got) => {
    if (stopped) return;
    if (got.problem) { showProblem(main, got.problem); return; }
    c = { ...got, day: today() };
    date = W.defaultTest(c.day);
    sources = P.examSources({ chapters: D.allChapters(), progress: c.progress, d: c.words, year: yearOf(c.child), today: c.day });
    draw();
  });
  return () => { stopped = true; };
}

/* ------------------------------------------------------------- the report --- */
export function examReport(main, { cid, eid }) {
  if (!adultOnly(main) || noApi()) return undefined;
  const id = decodeURIComponent(cid);
  const xid = decodeURIComponent(eid);
  let stopped = false;
  let c = null;
  let warn = '';
  let framed = false;
  const line = takeFlash();
  main.innerHTML = wrap('Grown-ups', 'Exam', '', '<p class="muted">Loading…</p>');
  // One status line, set with textContent and never rebuilt.
  const statusEl = document.createElement('p');
  statusEl.setAttribute('role', 'status');
  statusEl.setAttribute('data-flash', '');
  const say = (t) => { statusEl.textContent = t; statusEl.className = 'gu-line' + (t ? '' : ' is-empty'); };
  say(line);

  function frame() {
    main.innerHTML = '<section class="wrap page grownups gu gu-exam"><div data-head></div><div data-slot="status"></div><div data-warnbox></div><div data-body></div></section>';
    main.querySelector('[data-slot="status"]').replaceWith(statusEl);
    framed = true;
  }

  function draw() {
    if (!framed) frame();
    const q1 = (sel) => main.querySelector(sel);
    const name = c.child.nickname;
    const exam = Su.liveExams(c.setup).find((e) => e.id === xid);
    q1('[data-warnbox]').innerHTML = warn ? '<p class="gu-line gu-line--warn" role="alert" data-problemline>' + esc(warn) + '</p>' : '';
    if (!exam) {
      q1('[data-head]').innerHTML = backLink(childHref(id), name + '’s page');
      q1('[data-body]').innerHTML = '<div class="card gu-empty" data-noexam><h1>That exam is not here</h1><p class="muted">It may have been deleted.</p>'
        + '<a class="btn btn--primary" href="' + childHref(id) + '">' + esc(name) + '’s page</a></div>';
      return;
    }
    const day = today();
    const st = P.examNow(c.progress, exam, day);
    const isDone = st.state === 'done';
    const result = isDone && st.last ? P.examResultLine(exam, st.last) : '';
    const miss = isDone && st.last ? P.examMissLine(st.last) : '';
    main.firstElementChild.setAttribute('data-examreport', exam.id);
    q1('[data-head]').innerHTML = backLink(childHref(id), name + '’s page')
      + '<div class="pagehead"><span class="eyebrow">' + esc(name) + ' · ' + esc(As.kindName('exam', Su.effectiveProfile(c.setup, true), yearOf(c.child))) + '</span><h1>' + esc(exam.name) + '</h1>'
      + '<p class="muted">' + esc(W.dayLabel(exam.date)) + ' · ' + esc(plural(exam.words.length, 'word')) + '</p></div>';
    const detail = !isDone ? '<p class="muted small">' + esc(name) + ' has not sat it yet.</p>'
      : st.last ? '<p data-examresult>' + esc(result) + '</p>' + (miss ? '<p data-exammiss>' + esc(miss) + '</p>' : '<p class="muted small">Every word was spelled.</p>')
        : '<p class="muted small">The detail of this result is no longer kept.</p>';
    q1('[data-body]').innerHTML = '<section class="card gu-glance" data-examstate="' + st.state + '"><div class="gu-glance__head"><h2>State</h2><span class="gu-status gu-status--' + P.examChip(st.state) + '"><span data-examstatetext>' + esc(P.examStateLine(st.state, exam, st.last)) + '</span></span></div>'
      + detail
      + '<div class="gu-actions noprint">' + (isDone ? '<button type="button" class="btn btn--ghost" data-reopen>Let ' + esc(name) + ' sit it again</button>' : '')
      + '<button type="button" class="btn btn--danger" data-delete>Delete</button><button type="button" class="btn btn--plain" data-print-report>' + I.print + 'Print this page</button></div></section>';
    wire(exam);
  }

  async function change(make) {
    const r = await Dt.changeSetup(childApi(), id, (s) => ({ setup: make(s) }));
    if (stopped) return null;
    if (r.problem === 'playing' || r.problem === 'no-child') { showProblem(main, r.problem); return null; }
    if (r.problem === 'signed-out') recheckWho();
    if (r.problem || r.error) { warn = (r.problem ? P.PROBLEM_TEXT[r.problem] : r.error) + ' Nothing has been changed.'; draw(); return null; }
    c = { ...c, words: W.normalise(r.doc), setup: W.setupOf(W.normalise(r.doc)) };
    return r;
  }

  function wire(exam) {
    const q = (s) => main.querySelector(s);
    q('[data-print-report]').addEventListener('click', () => window.print());
    const re = q('[data-reopen]');
    if (re) {
      re.addEventListener('click', async () => {
        warn = '';
        say('');
        re.disabled = true;
        const r = await change((s) => Su.reopenExam(s, exam.id, Date.now()));
        if (!r) return;
        say(As.SAVED(c.child.nickname));
        draw();
      });
    }
    const del = q('[data-delete]');
    del.addEventListener('click', async () => {
      const yes = await confirmDialog({ title: 'Delete ' + exam.name + '?', body: c.child.nickname + '’s practice is kept. The exam is taken away.', confirm: 'Delete', keep: 'Keep it', opener: del });
      if (!yes || stopped) return;
      warn = '';
      say('');
      const r = await change((s) => Su.dropExam(s, exam.id, Date.now()));
      if (!r) return;
      location.hash = childHref(id);
    });
  }

  loadChild(id).then((got) => {
    if (stopped) return;
    if (got.problem) { showProblem(main, got.problem); return; }
    c = got;
    draw();
  });
  return () => { stopped = true; dismissDialog(); };
}

/* ------------------------------------------------------------- the overview --- */
/** The link on the grown-ups home: only with two or more children. */
export const overviewLink = (n) => (n >= 2 ? '<p class="small gu-overview-link"><a href="#/grownups/overview" data-overview-link>See all your children in one table</a></p>' : '');

export function overview(main) {
  if (!adultOnly(main) || noApi()) return undefined;
  let stopped = false;
  main.innerHTML = wrap('Grown-ups', 'All your children', '', '<p class="muted">Finding your children…</p>');
  Dt.listChildren(childApi()).then(async ({ children, problem }) => {
    if (stopped) return;
    if (problem) { showProblem(main, problem); return; }
    const list = children.slice(0, P.OVERVIEW_MAX);
    const data = await Promise.all(list.map((ch) => Dt.readChild(childApi(), ch.id)));
    if (stopped) return;
    const day = today();
    const chapters = D.allChapters();
    const rows = list.map((ch, i) => {
      const d = data[i];
      if (d.problem) return '<tr data-child="' + esc(ch.id) + '"><th scope="row">' + esc(ch.nickname) + '</th><td colspan="4" data-problem="' + esc(d.problem) + '">' + esc(P.PROBLEM_TEXT[d.problem]) + '</td></tr>';
      const r = P.overviewRow({ name: ch.nickname, words: d.words, progress: d.progress, setup: d.setup, chapters, today: day, now: Date.now() });
      return '<tr data-child="' + esc(ch.id) + '"><th scope="row"><a href="' + childHref(ch.id) + '">' + esc(r.name) + '</a></th><td data-label="Current week">' + esc(r.week) + '</td><td data-label="Last test">' + esc(r.test) + '</td>'
        + '<td data-label="Chapters passed">' + esc(String(r.passed)) + '</td><td data-label="Next exam">' + esc(r.exam) + '</td></tr>';
    }).join('');
    main.innerHTML = wrap('Grown-ups', 'All your children', '', '<div class="card gu-overview"><table class="gu-table" data-overview><caption>' + esc(P.OVERVIEW_CAPTION) + '</caption>'
      + '<thead><tr><th scope="col">Child</th><th scope="col">Current week</th><th scope="col">Last test</th><th scope="col">Chapters passed</th><th scope="col">Next exam</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + (children.length > list.length ? '<p class="small muted">Showing the first ' + P.OVERVIEW_MAX + ' children.</p>' : '')
      + '<div class="gu-actions noprint"><button type="button" class="btn btn--plain" data-print-report>' + I.print + 'Print this page</button><a class="btn btn--ghost" href="#/grownups">Back to the list</a></div></div>');
    const b = main.querySelector('[data-print-report]');
    if (b) b.addEventListener('click', () => window.print());
  });
  return () => { stopped = true; };
}

void ICON;
