// The front pages (SB3-F): the signed-out page, More practice (the chapters page) and one chapter's three steps.
// Views only; the rules are in front-doc.js. Child chrome (Back and Menu) comes from child-views.js as for every
// page a child reaches; an adult has the top bar. Nothing here shows a word on the first two pages.
import * as D from './data.js';
import * as S from './store.js';
import * as F from './front-doc.js';
import { kind, isChild } from './who.js';
import { sayLine, stop } from './speech.js';
import { esc, ICON } from './ui.js';

const href = (...parts) => '#/' + parts.join('/');
const yearName = (id) => D.years()[id].label.replace(/\s*&\s*/g, ' and '); // "Year 3 and 4", said as a child reads it
const YEAR_KEY = 'sb.chaptersYear'; // which year More practice opens on: a device convenience, never saved to the account

export function notFound(main) {
  main.innerHTML = '<section class="wrap page"><div class="card empty"><h1>That page isn’t here</h1>'
    + '<p class="muted">The link may be from an older version.</p><a class="btn btn--primary" href="#/">Go to the start</a></div></section>';
}
/** A chapter is open when the one before it is passed (or "open every chapter" is on). */
export function isUnlocked(ch) {
  if (S.unlockAll() || ch.index === 0) return true;
  const prev = D.chapters(ch.yearId)[ch.index - 1];
  return S.chapterProgress(prev.id).passed;
}

const SVG = {
  hear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true" class="fill"><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>',
  flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4"/><path d="M6 4h11l-2.5 4L17 12H6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/></svg>',
  alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.5h.01"/></svg>',
  bars: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 20v-7M12 20V5M18 20v-10"/></svg>',
};
const hearBtn = '<button type="button" class="btn btn--quiet hearit" data-hear>' + SVG.hear + 'Hear it</button>';

/* ------------------------------------------------------------ signed-out page --- */
/** What a visitor with no session sees at #/ (a child on a shared device too): one button, how a week works. No word, no game. */
export function signedOut(main, { signInHref = '' } = {}) {
  const T = F.SIGNED_OUT;
  main.innerHTML = '<section class="wrap page front frontout" data-front="signed-out">'
    + '<div class="front__hero"><div class="front__say">'
    + '<p class="eyebrow">' + esc(T.eyebrow) + '</p>'
    + '<h1>' + T.headline.map(esc).join('<br>') + '</h1>'
    + '<p class="front__lede">' + esc(T.lede) + '</p>'
    + '<div class="front__go"><a class="btn btn--primary btn--lead" href="' + esc(signInHref) + '" data-signin>' + esc(T.button) + ICON.arrow + '</a>'
    + '<p class="front__offline" data-offline role="status"' + (navigator.onLine === false ? '' : ' hidden') + '>' + esc(T.offline) + '</p>'
    + '<a class="front__create" href="' + esc(signInHref) + '" data-create>' + esc(T.create) + '</a>'
    + '<p class="front__kids">' + esc(T.kids) + '</p></div></div>'
    + '<div class="front__pip" aria-hidden="true"><span class="pipring"><span class="pipring__disc"><img class="room__pip" src="assets/characters/pip-portrait-256.webp" width="148" height="148" alt=""></span></span></div></div>'
    + '<section class="card front__week" aria-labelledby="fw-h"><h2 id="fw-h">' + esc(T.weekTitle) + '</h2><p class="muted">' + esc(T.weekLine) + '</p>'
    + '<ol class="jobs">' + F.JOBS.map((j, i) => '<li class="jobs__one"><span class="stone stone--' + ((i + 1) % 4) + '" aria-hidden="true">' + (i + 1) + '</span>'
      + '<span class="jobs__text"><b>' + esc(j.name) + '</b><span>' + esc(j.help) + '</span></span></li>').join('') + '</ol></section>'
    + '<section class="front__parents" aria-labelledby="fp-h"><h2 id="fp-h">' + esc(T.parentsTitle) + '</h2>'
    + '<p>' + esc(T.parentsLine) + ' <a class="front__more" href="#/about" data-about>' + esc(T.parentsLink) + '</a></p></section>'
    + '</section>';
  // A first-time visitor with no network: say so by the button (the line is there for a screen reader too, as a status).
  const line = main.querySelector('[data-offline]');
  const sync = () => { line.hidden = navigator.onLine !== false; };
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
  return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync); };
}

/* -------------------------------------------------------------- More practice --- */
function remembered() { try { return localStorage.getItem(YEAR_KEY) || ''; } catch (e) { return ''; } }
export function rememberYear(id) { try { localStorage.setItem(YEAR_KEY, id); } catch (e) { /* the page opens on its own pick */ } }

const progressOf = (c) => S.chapterProgress(c.id);
const viewOf = (id) => F.yearView(D.chapters(id), progressOf, isUnlocked);

function stoneHtml(s, state) {
  const inner = state === 'passed' ? SVG.star + s.n : String(s.n);
  return '<span class="stone stone--' + { passed: 'done', studying: 'today', todo: 'later' }[state] + ' stone--' + (s.n % 4) + '" aria-hidden="true">' + inner + '</span>';
}
function yearPanel(id, yearId) {
  const chs = D.chapters(id);
  const v = viewOf(id);
  const sum = F.summaryLine(F.yearSummary(chs, progressOf));
  const stones = v.stones.map((s) => {
    const label = F.STONE_LABEL[s.state];
    const aria = 'Chapter ' + s.n + ', ' + label.toLowerCase() + (s.open ? '' : '. Opens after Chapter ' + (s.n - 1));
    return '<li><a class="stonelink' + (s.next ? ' is-next' : '') + '" href="' + href(id, s.slug) + '" aria-label="' + aria + '" data-chapter="' + s.slug + '" data-state="' + s.state + '">'
      + stoneHtml(s, s.state) + '<span class="stonelink__label">' + label + '</span></a></li>';
  }).join('');
  let go;
  if (v.mode === 'done') {
    go = '<p class="allpassed" data-allpassed>' + SVG.star + 'All ' + v.stones.length + ' passed</p><p class="muted small">Tap a chapter to do it again.</p>';
  } else {
    const dest = { learn: 'study', practise: 'practice', test: 'test' }[v.target.step];
    go = '<a class="btn btn--primary btn--carry" href="' + href(id, v.target.slug, dest) + '" data-carry><span class="btn__two"><b>' + esc(F.carryLabel(v)) + '</b><small>' + esc(v.target.label) + '</small></span>' + ICON.arrow + '</a>';
  }
  return '<section class="card yearcard" aria-label="' + esc(yearName(id)) + '" data-yearpanel="' + id + '">'
    + '<p class="yearcard__sum">' + esc(sum) + '</p><ol class="stones" aria-label="Chapters">' + stones + '</ol>' + go + '</section>';
}

/** #/chapters: "More practice". One year at a time, its ten stones, ONE primary button, then three quiet rows. */
export function chapters(main) {
  const child = isChild();
  const adult = kind() === 'adult';
  let year = F.pickYear(remembered(), { y34: viewOf('y34'), y56: viewOf('y56') });
  const tricky = S.trickyWords().length;
  const sentence = child ? 'Learn a chapter, then test it.' : 'Each chapter: learn the words, practise them, then take the chapter test.';
  const rows = [
    ['#/custom', SVG.pencil, 'Pick words', 'Choose your own words'],
    ['#/tricky', SVG.alert, 'Tricky words', tricky ? tricky + ' to go back to' : 'None yet'],
    ['#/progress', SVG.bars, 'Progress', 'Chapters you have passed'],
  ];
  main.innerHTML = '<section class="wrap page front chapterspage" data-chapters data-for="' + (child ? 'child' : 'adult') + '">'
    + '<div class="pagehead">' + (child ? '' : '<p class="eyebrow">More practice</p>')
    + '<h1>' + (child ? 'More practice' : 'Practise chapter by chapter') + '</h1>'
    + '<div class="front__sentence"><p class="front__lede">' + esc(sentence) + '</p>' + (child ? hearBtn : '') + '</div></div>'
    + '<div class="yearswitch" role="group" aria-label="Year group">'
    + F.YEARS.map((id) => '<button type="button" class="yearswitch__b" data-year="' + id + '" aria-pressed="' + (id === year) + '">' + esc(yearName(id)) + '</button>').join('') + '</div>'
    + '<div data-yearslot></div>'
    + '<h2 class="morehead">More to do</h2>'
    + '<ul class="morerows">' + rows.map(([to, icon, name, sub]) => '<li><a class="morerow" href="' + to + '"><span class="morerow__ico" aria-hidden="true">' + icon + '</span>'
      + '<span class="morerow__text"><b>' + name + '</b><span>' + esc(sub) + '</span></span><span class="morerow__go" aria-hidden="true">' + SVG.chevron + '</span></a></li>').join('') + '</ul>'
    + '</section>';
  const slot = main.querySelector('[data-yearslot]');
  const draw = () => {
    slot.innerHTML = yearPanel(year);
    main.querySelectorAll('.yearswitch__b').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.year === year)));
  };
  draw();
  main.querySelectorAll('.yearswitch__b').forEach((b) => b.addEventListener('click', () => {
    year = b.dataset.year;
    rememberYear(year);
    draw();
  }));
  const hear = main.querySelector('[data-hear]');
  if (hear) hear.addEventListener('click', () => sayLine(sentence));
  return stop;
}

/** The old year page: the year is chosen on More practice now, so this remembers it and goes there (no dead link). */
export function year(main, { yearId }) {
  rememberYear(yearId);
  location.replace('#/chapters');
}

/* --------------------------------------------------------------- one chapter --- */
const ROW = {
  learn: { title: 'Learn the words', line: 'Hear each word. See what it means.', go: 'Learn the words', again: 'Learn them again', to: 'study' },
  practise: { title: 'Practise', line: 'Play the flower game with every word.', go: 'Start practising', again: 'Practise again', to: 'practice' },
  test: { title: 'Chapter test', line: 'Hear each word, then type it.', go: 'Take the test', again: 'Take the test again', to: 'test' },
};
const PILL = { done: 'Done', next: 'Next', later: 'To do' };

/** One chapter: three steps in order, one primary action for the next one. The words can be opened from step 1. */
export function chapter(main, { yearId, slug }) {
  const ch = D.chapterBySlug(yearId, slug);
  if (!ch) return notFound(main);
  const t = D.chapterTitle(ch);
  const label = yearName(yearId);
  if (!isUnlocked(ch)) {
    const prev = D.chapters(yearId)[ch.index - 1];
    main.innerHTML = '<section class="wrap page front chapterpage" data-chapter-locked><div class="pagehead"><p class="eyebrow">' + esc(label) + '</p><h1>Chapter ' + t.n + '</h1>'
      + '<p class="front__lede">Pass Chapter ' + (t.n - 1) + ' first.</p></div>'
      + '<a class="btn btn--primary btn--lead" href="' + href(yearId, prev.slug) + '">Go to Chapter ' + (t.n - 1) + ICON.arrow + '</a></section>';
    return undefined;
  }
  const adult = kind() === 'adult';
  const child = isChild();
  const p = S.chapterProgress(ch.id);
  const st = F.chapterSteps(p, adult);
  const base = href(yearId, slug);
  const sentence = ch.words.length + ' words. Learn, practise, then test.';
  const num = (id, state) => '<span class="stone stone--' + (state === 'done' ? 'done' : state === 'next' ? 'today' : 'later') + ' stone--' + (['learn', 'practise', 'test'].indexOf(id) + 2) % 4 + '" aria-hidden="true">'
    + (state === 'done' ? SVG.star + (['learn', 'practise', 'test'].indexOf(id) + 1) : id === 'test' && state === 'later' ? SVG.flag : String(['learn', 'practise', 'test'].indexOf(id) + 1)) + '</span>';
  const words = '<details class="chapterwords"><summary>See the ' + ch.words.length + ' words</summary><div class="wordchips">' + ch.words.map((w) => '<span>' + esc(w.word) + '</span>').join('') + '</div></details>';
  const action = (id) => {
    const r = ROW[id];
    const state = st[id];
    if (state === 'next') return '<a class="btn btn--primary btn--lead" href="' + base + '/' + r.to + '" data-primary="' + id + '">' + r.go + ICON.arrow + '</a>';
    if (id === 'test') {
      if (state === 'done' || st.testOpen) return '<a class="btn btn--quiet" href="' + base + '/test" data-step-link="test">' + (state === 'done' ? r.again : p.attempts ? 'Take the test again' : r.go) + '</a>';
      return '<p class="stepcard__wait" data-test-gated>Opens when you’ve practised.</p>'
        + (st.testAnyway ? '<a class="linkbtn" href="' + base + '/test" data-test-anyway>Take the test anyway</a>' : '');
    }
    return '<a class="btn btn--quiet" href="' + base + '/' + r.to + '" data-step-link="' + id + '">' + (state === 'done' ? r.again : r.go) + '</a>';
  };
  const next = !st.next && yearId && D.chapters(yearId)[ch.index + 1];
  main.innerHTML = '<section class="wrap page front chapterpage" data-chapterpage data-for="' + (child ? 'child' : 'adult') + '">'
    + '<div class="pagehead"><p class="eyebrow">' + esc(label) + ' · ' + esc(t.name) + '</p><h1>Chapter ' + t.n + '</h1>'
    + '<div class="front__sentence"><p class="front__lede">' + esc(sentence) + '</p>' + (child ? hearBtn : '') + '</div></div>'
    + '<ol class="stepcards">' + ['learn', 'practise', 'test'].map((id) => {
      const state = st[id];
      return '<li class="stepcard stepcard--' + state + '" data-step="' + id + '" data-state="' + state + '"><div class="stepcard__row">' + num(id, state)
        + '<div class="stepcard__text"><h2>' + ROW[id].title + ' <span class="stepcard__pill">' + PILL[state] + '</span></h2><p>' + ROW[id].line + '</p></div></div>'
        + (id === 'learn' ? words : '') + '<div class="stepcard__act">' + action(id) + '</div></li>';
    }).join('') + '</ol>'
    + (next ? '<a class="btn btn--primary btn--lead" href="' + href(yearId, next.slug) + '" data-next-chapter>Next chapter' + ICON.arrow + '</a>' : '')
    + '<p class="chapterfoot"><a class="linkbtn" href="' + base + '/quick" data-quick>Quick game with all ' + ch.words.length + ' words</a></p>'
    + '</section>';
  const hear = main.querySelector('[data-hear]');
  if (hear) hear.addEventListener('click', () => sayLine(sentence));
  return stop;
}
