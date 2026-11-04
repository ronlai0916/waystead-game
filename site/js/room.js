// My room: the Spellbright home for a signed-in child. Today's job as one big
// button, this week's stars, the test date, the week strip with its badges and
// Pip. An adult playing as themselves gets the chapters page, with Grown-ups on it.
import * as S from './store.js';
import * as W from './words-doc.js';
import * as St from './study-doc.js';
import * as V from './views.js';
import { stepHref, stripHtml, dotsListHtml, comeBackHtml } from './study-views.js';
import { kind, playerName } from './who.js';
import { esc, ICON } from './ui.js';

const PIP = { happy: 'pip-portrait', thinking: 'pip-thinking', cheering: 'pip-happy' };
const pipHtml = (state) => '<img class="room__pip" data-pip="' + state + '" src="assets/characters/' + PIP[state] + '-256.webp" width="128" height="128" alt="Pip the dormouse">';

const SAY = {
  none: 'Let\'s make your first word group.',
  job: 'Here\'s today\'s job.',
  done: 'Done for today!',
  rest: 'No job today. Your next one is on its way.',
  ready: 'Every job is done. You\'re ready for the test.',
  finished: 'This week is finished. Well done!',
};

export function room(main) {
  const d = S.readWords();
  const day = W.localDay(Date.now());
  const r = St.roomState(d, day);
  const g = r.group;
  const button = r.status === 'job' ? '<a class="btn btn--primary btn--big" href="' + stepHref(d, g, r.step.id, day) + '" data-job>' + esc(r.step.title) + ICON.arrow + '</a><p class="muted">' + esc(r.step.line) + '</p>'
    : r.status === 'none' ? '<a class="btn btn--primary btn--big" href="#/words">My words' + ICON.arrow + '</a>'
      : r.status === 'finished' ? '<a class="btn btn--primary btn--big" href="#/words/new">New word group' + ICON.arrow + '</a>'
        : '<a class="btn btn--primary btn--big" href="../wordbright/" data-wordbright>Play Wordbright' + ICON.arrow + '</a>';
  const stat = (n, label) => '<div class="card stat"><b>' + esc(n) + '</b><span>' + esc(label) + '</span></div>';
  main.innerHTML = '<section class="wrap page room" data-room="' + r.status + '">'
    + '<div class="card room__top">' + pipHtml(r.pip) + '<div class="room__say"><span class="eyebrow">My room</span>'
    + '<h1>' + (r.status === 'done' ? 'Done for today!' : 'Hello' + (playerName() ? ', ' + esc(playerName()) : '')) + '</h1>'
    + '<p class="muted">' + esc(r.status === 'done' ? 'Well done. Your next job is ready tomorrow.' : SAY[r.status]) + '</p>'
    + (r.ready && r.status !== 'ready' && day < g.test ? '<p><span class="pill pill--done">Ready for the test</span></p>' : '') + '</div></div>'
    + '<div class="room__job">' + button + '</div>'
    + (g && !r.hideWords ? comeBackHtml(g, r.comeBack) : '')
    + (g ? '<div class="stats">' + stat(r.stars, 'Stars this week') + stat(W.dayLabel(r.test), 'Test day') + '</div>'
      + '<h2 class="sectionhead">' + esc(g.name) + '</h2>' + stripHtml(r.strip, day)
      + '<h2 class="sectionhead">Practise 3 times</h2>' + dotsListHtml(r.dots, r.hideWords) : '')
    + '<div class="btnrow room__more"><a class="btn btn--ghost" href="#/words">My words</a><a class="btn btn--ghost" href="#/chapters">All chapters</a></div>'
    + '</section>';
}

/** The page at #/: a child's room, or the chapters for an adult. The room makes nothing itself: the first group comes from My words, once this device has caught up. */
export function home(main) {
  const k = kind();
  if (k === 'child' || k === 'unknown') { room(main); return undefined; }
  const end = V.home(main);
  if (k === 'adult') {
    main.querySelector('.shortcuts').insertAdjacentHTML('afterbegin', '<a class="card shortcut" href="#/grownups"><span><strong>Grown-ups</strong><br><span class="muted small">Plan a week and see how it\'s going</span></span>' + ICON.arrow + '</a>');
  }
  return end;
}
