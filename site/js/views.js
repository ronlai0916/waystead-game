// Every screen. Each view takes the <main> element and route params, renders,
// and may return a cleanup function.
import * as D from './data.js';
import * as S from './store.js';
import * as W from './words-doc.js';
import { speak, spellOut, stop } from './speech.js';
import { runSession, summaryHtml } from './play.js';
import { esc, ICON, picture, chunked, chunkText, boldWord, redact, shuffle, toast, meter, applyMeters } from './ui.js';
import { dayStyleHtml, wireDayStyle } from './daystyle.js';
import { burstHtml, placeBursts } from './celebrate.js';
import { backAgainFor, hiddenToday } from './words-views.js';
import { isUnlocked, notFound, chapters } from './front-views.js';
import { withoutHidden, DAILY_TIME, DAILY_TIME_CAP, ROW_LINE } from './study-doc.js';

const MAX_PICK = 30;

const href = (...parts) => '#/' + parts.join('/');

function yearStats(yearId) {
  const chs = D.chapters(yearId);
  const passed = chs.filter((c) => S.chapterProgress(c.id).passed).length;
  const words = chs.reduce((n, c) => n + c.words.length, 0);
  return { passed, total: chs.length, words };
}
// Cambridge Dictionary's page for a word: its UK audio, recorded by people.
// Opens in a new tab so the game keeps its place.
function cambridgeLink(w, cls) {
  return '<a class="btn ' + cls + '" href="https://dictionary.cambridge.org/dictionary/english/' + encodeURIComponent(w.word.toLowerCase())
    + '" target="_blank" rel="noopener noreferrer">' + ICON.external + 'Cambridge Dictionary<span class="sr"> (opens in a new tab)</span></a>';
}
/**
 * The chapter a page is for, and the link to it: { ch, base } for a year's chapter ({ yearId, slug }), else null.
 * (A later package adds a second branch here for a grown-up's own chapter.)
 */
export function chapterFrom(params) {
  const ch = D.chapterBySlug(params.yearId, params.slug);
  return ch ? { ch, base: href(params.yearId, params.slug) } : null;
}
function wordEntries(ch) { return ch.words.map((w) => D.entry(w.word)); }

/* --------------------------------------------------------------- Study --- */
export function study(main, { yearId, slug }) {
  const from = chapterFrom({ yearId, slug });
  if (!from || !isUnlocked(from.ch)) return notFound(main);
  const { ch, base } = from;
  const t = D.chapterTitle(ch);
  main.innerHTML = '<section class="wrap page">'
    + '<div class="pagehead"><span class="eyebrow">Chapter ' + t.n + ' · Study</span><h1>' + esc(t.name) + '</h1>'
    + '<p class="muted">Take your time with each word. Tap “Spell it out” to hear it letter by letter.</p></div>'
    + '<div class="studylist">' + wordEntries(ch).map((w) =>
      '<article class="card wordcard" id="w-' + esc(w.word) + '">' + picture(w)
      + '<div class="wordcard__body">'
      + '<h2 class="wordcard__word">' + chunked(w, '', { tricky: true }) + '</h2>'
      + '<div class="wordcard__line"><span class="ipa">' + esc(w.ipa) + '</span><span class="pill">' + esc(w.meaning.partOfSpeech) + '</span><span class="chunktext">' + esc(chunkText(w)) + '</span></div>'
      + '<p>' + esc(w.meaning.definition) + '</p>'
      + '<p class="example">' + boldWord(w.meaning.example, w.word) + '</p>'
      + '<div class="btnrow">'
      + '<button type="button" class="btn btn--quiet btn--small" data-hear="' + esc(w.word) + '">' + ICON.play + 'Hear it</button>'
      + '<a class="btn btn--quiet btn--small" href="' + base + '/study/' + encodeURIComponent(w.word) + '">' + ICON.spell + 'Spell it out</a>'
      + '<a class="btn btn--quiet btn--small" href="' + base + '/quick/' + encodeURIComponent(w.word) + '">' + ICON.game + 'Quick game</a>'
      + cambridgeLink(w, 'btn--quiet btn--small')
      + '</div></div></article>').join('') + '</div>'
    + '<div class="stickybar"><span class="muted small">Studied all ' + ch.words.length + '?</span>'
    + '<button type="button" class="btn btn--primary" data-done>I\'ve studied these' + ICON.arrow + '</button></div>'
    + '</section>';
  main.querySelectorAll('[data-hear]').forEach((b) => b.addEventListener('click', () => speak(b.dataset.hear)));
  main.querySelector('[data-done]').addEventListener('click', () => {
    S.markStudied(ch.id);
    location.hash = base + '/quick';
  });
  return stop;
}

/* --------------------------------------------------------- Spell it out --- */
export function spell(main, { yearId, slug, word }) {
  const w = D.entry(decodeURIComponent(word));
  const from = chapterFrom({ yearId, slug });
  if (!w || !from) return notFound(main);
  main.innerHTML = '<section class="wrap page"><div class="card spell">'
    + picture(w)
    + '<div class="spell__word">' + chunked(w, '', { tricky: true }) + '</div>'
    + '<p class="ipa">' + esc(w.ipa) + ' · <span class="chunktext">' + esc(chunkText(w)) + '</span></p>'
    + '<div class="btnrow">'
    + '<button type="button" class="btn btn--primary" data-hear>' + ICON.play + 'Hear the word</button>'
    + '<button type="button" class="btn btn--ghost" data-spell>' + ICON.spell + 'Spell it letter by letter</button></div>'
    + '<p>' + esc(w.meaning.definition) + '</p>'
    + '<p class="example">' + boldWord(w.meaning.example, w.word) + '</p>'
    + '<div class="btnrow btnrow--center"><a class="btn btn--quiet btn--small" href="' + from.base + '/quick/' + encodeURIComponent(w.word) + '">' + ICON.game + 'Quick game with this word</a>'
    + cambridgeLink(w, 'btn--quiet btn--small') + '</div>'
    + '</div></section>';
  const letters = main.querySelectorAll('.spell__word .chunked__letter');
  main.querySelector('[data-hear]').addEventListener('click', () => {
    letters.forEach((el) => el.classList.remove('is-on'));
    speak(w.word);
  });
  main.querySelector('[data-spell]').addEventListener('click', () => spellOut(w.word, (i) => {
    letters.forEach((el) => el.classList.toggle('is-on', Number(el.dataset.i) === i));
  }));
  return stop;
}

/* ---------------------------------------------- Quick game (chapter/one) --- */
export function quick(main, { yearId, slug, word }) {
  const from = chapterFrom({ yearId, slug });
  if (!from || !isUnlocked(from.ch)) return notFound(main);
  const { ch, base } = from;
  const t = D.chapterTitle(ch);
  const single = word ? D.entry(decodeURIComponent(word)) : null;
  if (word && !single) return notFound(main);
  const back = single ? [] : backAgainFor(ch.words.map((x) => x.word));
  const words = single ? [single] : shuffle([...wordEntries(ch), ...back]);
  return runSession(main, {
    backAgain: back,
    eyebrow: 'Chapter ' + t.n + ' · Quick game',
    title: single ? 'One word' : t.name,
    words,
    mode: 'mini',
    onFinish: (results) => {
      main.innerHTML = '<section class="wrap page">' + summaryHtml(results, single ? 'Quick game done' : 'Quick game done')
        + '<div class="btnrow">'
        + (single
          ? '<a class="btn btn--primary" href="' + base + '/study">Back to studying</a><a class="btn btn--ghost" href="' + base + '/quick/' + encodeURIComponent(single.word) + '" data-again>Play again</a>'
          : '<a class="btn btn--primary" href="' + base + '/practice">Go to practice' + ICON.arrow + '</a><a class="btn btn--ghost" href="' + base + '">Back to the chapter</a>')
        + '</div></section>';
      const again = main.querySelector('[data-again]');
      if (again) again.addEventListener('click', (e) => { e.preventDefault(); window.dispatchEvent(new HashChangeEvent('hashchange')); });
    },
  });
}

/* ------------------------------------------------------------ Practice --- */
export function practice(main, { yearId, slug }) {
  const from = chapterFrom({ yearId, slug });
  if (!from || !isUnlocked(from.ch)) return notFound(main);
  const { ch, base } = from;
  const t = D.chapterTitle(ch);
  const back = backAgainFor(ch.words.map((x) => x.word));
  return runSession(main, {
    backAgain: back,
    eyebrow: 'Chapter ' + t.n + ' · Practice',
    title: t.name,
    words: shuffle([...wordEntries(ch), ...back]),
    mode: 'full',
    onFinish: (results) => {
      S.markPractised(ch.id);
      main.innerHTML = '<section class="wrap page">' + summaryHtml(results, 'Practice done')
        + '<div class="btnrow"><a class="btn btn--primary" href="' + base + '/test">Take the test' + ICON.arrow + '</a>'
        + '<a class="btn btn--ghost" href="' + base + '/study">Study again</a></div></section>';
    },
  });
}


/* ---------------------------------------------------------------- Test --- */
export function test(main, { yearId, slug }) {
  const from = chapterFrom({ yearId, slug });
  if (!from || !isUnlocked(from.ch)) return notFound(main);
  const { ch, base } = from;
  const t = D.chapterTitle(ch);
  const words = shuffle(wordEntries(ch));
  const answers = [];
  let i = 0;

  function ask() {
    const w = words[i];
    main.innerHTML = '<section class="wrap page">'
      + '<div class="pagehead"><span class="eyebrow">Chapter ' + t.n + ' · Test</span><h1>' + esc(t.name) + '</h1></div>'
      + '<form class="card testcard" novalidate>'
      + '<span class="progressline">Word ' + (i + 1) + ' of ' + words.length + '</span>'
      + '<div class="btnrow"><button type="button" class="btn btn--primary" data-hear>' + ICON.play + 'Hear the word</button></div>'
      + '<p><span class="pill">' + esc(w.meaning.partOfSpeech) + '</span> ' + esc(w.meaning.definition) + '</p>'
      + '<p class="example">' + redact(w.meaning.example, w.word) + '</p>'
      + '<label class="small muted" for="ans">Type the word</label>'
      + '<input id="ans" class="answer" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" enterkeyhint="done">'
      + '<div class="btnrow"><button type="submit" class="btn btn--primary">Check</button></div>'
      + '</form></section>';
    const input = main.querySelector('#ans');
    main.querySelector('[data-hear]').addEventListener('click', () => { speak(w.word); input.focus(); });
    main.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const typed = input.value.trim();
      if (!typed) { toast('Type the word first'); input.focus(); return; }
      check(w, typed);
    });
    input.focus();
    speak(w.word);
  }

  function check(w, typed) {
    const right = typed.toLowerCase() === w.word.toLowerCase();
    answers.push({ entry: w, typed, right });
    if (right) S.noteCorrect(w.word); else S.noteMissed(w.word, ch.id);
    const last = i === words.length - 1;
    main.querySelector('form').outerHTML = '<div class="card result ' + (right ? 'result--good' : 'result--bad') + '">'
      + '<div class="result__head">' + (right ? '<span class="celebrate"><span class="result__badge">✓</span>' + burstHtml(10, 1.2) + '</span>' : '<span class="result__badge">×</span>')
      + '<h2>' + (right ? 'Correct' : 'Not quite') + '</h2></div>'
      + '<div class="result__grid">' + picture(w) + '<div class="stack">'
      + '<div class="result__word">' + chunked(w) + '</div>'
      + (right ? '' : '<p>You typed <b>' + esc(typed) + '</b>. It\'s been added to your tricky words.</p>')
      + '<p class="ipa">' + esc(w.ipa) + '</p></div></div>'
      + '<div class="btnrow"><button type="button" class="btn btn--primary" data-next>' + (last ? 'See your score' : 'Next word') + ICON.arrow + '</button></div></div>';
    placeBursts(main);
    const next = main.querySelector('[data-next]');
    next.focus();
    next.addEventListener('click', () => {
      stop();
      if (last) finish(); else { i += 1; ask(); window.scrollTo(0, 0); }
    });
  }

  function finish() {
    const score = answers.filter((a) => a.right).length;
    const before = S.chapterProgress(ch.id).passed;
    S.recordTest(ch.id, score, words.length);
    const passed = score === words.length;
    const chs = D.chapters(yearId);
    const nextCh = chs[ch.index + 1];
    const live = D.liveYears();
    const nextYear = nextCh ? '' : live[live.indexOf(ch.yearId) + 1] || ''; // the last chapter of a year leads on to the next year
    main.innerHTML = '<section class="wrap page">'
      + '<div class="pagehead' + (passed ? ' pagehead--pass' : '') + '"><span class="eyebrow">Chapter ' + t.n + ' · Test</span>'
      + (passed ? '<span class="celebrate passmark" aria-hidden="true"><span class="passmark__badge">' + ICON.star + '</span>' + burstHtml(16, 2) + '</span>' : '')
      + '<h1>' + (passed ? 'Passed — every word right' : score + ' of ' + words.length + ' right') + '</h1>'
      + '<p class="muted">' + (passed
        ? (nextCh && !before ? 'Chapter ' + (t.n + 1) + ' is now open.' : !nextCh && nextYear ? 'You have finished ' + D.years()[ch.yearId].label + '.' : 'Well done.')
        : 'Get all ' + words.length + ' right to pass. The words you missed are in your tricky words.') + '</p></div>'
      + '<div class="list">' + answers.map((a) => '<div class="card listrow"><span><strong>' + esc(a.entry.word) + '</strong>'
        + (a.right ? '' : '<br><span class="muted small">You typed ' + esc(a.typed) + '</span>') + '</span>'
        + (a.right ? '<span class="pill pill--done">Right</span>' : '<span class="pill pill--warm">Missed</span>') + '</div>').join('') + '</div>'
      + '<div class="btnrow">'
      + (passed && nextCh ? '<a class="btn btn--primary" href="' + base.replace(/[^/]+$/, nextCh.slug) + '" data-next-chapter>Next chapter' + ICON.arrow + '</a>' : '')
      + (passed && !nextCh && nextYear ? '<a class="btn btn--primary" href="' + href(nextYear, D.chapters(nextYear)[0].slug) + '" data-next-year>Start ' + esc(D.years()[nextYear].label) + ICON.arrow + '</a>' : '')
      + (passed && !nextCh && !nextYear ? '<a class="btn btn--primary" href="#/chapters" data-back-practice>More practice' + ICON.arrow + '</a>' : '')
      + (!passed ? '<a class="btn btn--primary" href="' + base + '/practice">Practise again</a><a class="btn btn--ghost" href="' + base + '/test" data-retry>Take the test again</a>' : '')
      + '<a class="btn btn--ghost" href="#/chapters">All chapters</a></div></section>';
    placeBursts(main);
    const retry = main.querySelector('[data-retry]');
    if (retry) retry.addEventListener('click', (e) => { e.preventDefault(); window.dispatchEvent(new HashChangeEvent('hashchange')); });
  }

  ask();
  return stop;
}

/* ---------------------------------------------------------- Pick words --- */
export function custom(main) {
  const hidden = hiddenToday(); // a test is due: its words stay out of the lists
  const all = withoutHidden(D.allWords(), hidden).sort((a, b) => a.word.localeCompare(b.word, 'en-GB', { sensitivity: 'base' }));
  const tricky = withoutHidden(S.trickyWords().map((t) => t.word).filter((w) => D.entry(w)), hidden);
  let tab = 'all';
  let chapterId = D.chapters(D.defaultYear())[0].id;
  let filter = '';
  const chosen = new Set();

  function source() {
    if (tab === 'tricky') return tricky.map((w) => D.entry(w));
    if (tab === 'chapter') return withoutHidden(wordEntries(D.chapterById(chapterId)), hidden);
    return all.filter((w) => w.word.toLowerCase().includes(filter.toLowerCase()));
  }

  function render() {
    const list = source();
    const chapterOpts = D.liveYears().map((yid) => '<optgroup label="' + esc(D.years()[yid].label) + '">'
      + D.chapters(yid).map((c) => '<option value="' + c.id + '"' + (c.id === chapterId ? ' selected' : '') + '>'
        + esc(D.chapterTitle(c).n + '. ' + D.chapterTitle(c).name) + '</option>').join('') + '</optgroup>').join('');
    main.innerHTML = '<section class="wrap page">'
      + '<div class="pagehead"><span class="eyebrow">Pick words</span><h1>Choose the words to play</h1>'
      + '<p class="muted">Up to ' + MAX_PICK + ' words. You play a quick game with them; any you miss go into your tricky words.</p></div>'
      + '<div class="tabs" role="tablist">'
      + tabBtn('all', 'All words') + tabBtn('tricky', 'Tricky words (' + tricky.length + ')') + tabBtn('chapter', 'A chapter') + '</div>'
      + '<div class="stack">'
      + (tab === 'all' ? '<div class="btnrow"><input class="field" type="search" placeholder="Find a word" aria-label="Find a word" value="' + esc(filter) + '" data-filter>'
        + '<button type="button" class="btn btn--quiet btn--small" data-random>Pick 10 at random</button></div>' : '')
      + (tab === 'chapter' ? '<select class="field" aria-label="Chapter" data-chapter>' + chapterOpts + '</select>' : '')
      + (tab === 'tricky' && !tricky.length ? '<div class="card empty"><p>No tricky words yet. Words you miss in a test land here.</p></div>' : '')
      + (list.length ? '<div class="btnrow"><button type="button" class="btn btn--quiet btn--small" data-allon>Select all shown</button>'
        + '<button type="button" class="btn btn--quiet btn--small" data-clear>Clear</button></div>' : '')
      + '<div class="picker">' + list.map((w) => '<label><input type="checkbox" value="' + esc(w.word) + '"' + (chosen.has(w.word) ? ' checked' : '') + '>' + esc(w.word) + '</label>').join('') + '</div>'
      + '</div>'
      + '<div class="stickybar"><span aria-live="polite"><b data-count>' + chosen.size + '</b> chosen</span>'
      + '<button type="button" class="btn btn--primary" data-play' + (chosen.size ? '' : ' disabled') + '>Play' + ICON.arrow + '</button></div>'
      + '</section>';
    wire();
  }

  function tabBtn(id, label) {
    return '<button type="button" class="tab" role="tab" aria-selected="' + (tab === id) + '" data-tab="' + id + '">' + esc(label) + '</button>';
  }

  function refreshCount() {
    main.querySelector('[data-count]').textContent = chosen.size;
    main.querySelector('[data-play]').disabled = chosen.size === 0;
  }

  function add(word) {
    if (chosen.size >= MAX_PICK) { toast('You can pick up to ' + MAX_PICK + ' words'); return false; }
    chosen.add(word); return true;
  }

  function wire() {
    main.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
    const f = main.querySelector('[data-filter]');
    if (f) f.addEventListener('input', () => {
      filter = f.value;
      const pos = f.selectionStart;
      render();
      const nf = main.querySelector('[data-filter]');
      nf.focus(); nf.setSelectionRange(pos, pos);
    });
    const sel = main.querySelector('[data-chapter]');
    if (sel) sel.addEventListener('change', () => { chapterId = sel.value; render(); });
    const rnd = main.querySelector('[data-random]');
    if (rnd) rnd.addEventListener('click', () => { chosen.clear(); shuffle(all).slice(0, 10).forEach((w) => chosen.add(w.word)); render(); });
    const allon = main.querySelector('[data-allon]');
    if (allon) allon.addEventListener('click', () => { for (const w of source()) if (!chosen.has(w.word) && !add(w.word)) break; render(); });
    const clr = main.querySelector('[data-clear]');
    if (clr) clr.addEventListener('click', () => { chosen.clear(); render(); });
    main.querySelectorAll('.picker input').forEach((cb) => cb.addEventListener('change', () => {
      if (cb.checked) { if (!add(cb.value)) cb.checked = false; } else chosen.delete(cb.value);
      refreshCount();
    }));
    main.querySelector('[data-play]').addEventListener('click', () => {
      S.setSelection([...chosen]);
      location.hash = '#/custom/play';
    });
  }

  render();
}

export function customPlay(main) {
  const words = withoutHidden(S.getSelection(), hiddenToday()).map((w) => D.entry(w)).filter(Boolean);
  if (!words.length) { location.replace('#/custom'); return; }
  return runSession(main, {
    eyebrow: 'Pick words',
    title: words.length === 1 ? 'Your word' : 'Your ' + words.length + ' words',
    words: shuffle(words),
    mode: 'mini',
    onFinish: (results) => {
      for (const r of results) {
        if (r.won) S.noteCorrect(r.entry.word); else S.noteMissed(r.entry.word, r.entry.chapterId);
      }
      const missed = results.filter((r) => !r.won).map((r) => r.entry.word);
      main.innerHTML = '<section class="wrap page">' + summaryHtml(results, 'All done')
        + (missed.length ? '<p class="muted">Missed words are now in your tricky words.</p>' : '')
        + '<div class="btnrow">'
        + (missed.length ? '<button type="button" class="btn btn--primary" data-missed>Play the missed words</button>' : '')
        + '<button type="button" class="btn ' + (missed.length ? 'btn--ghost' : 'btn--primary') + '" data-again>Play these again</button>'
        + '<a class="btn btn--ghost" href="#/custom">Pick other words</a></div></section>';
      const replay = (list) => { S.setSelection(list); window.dispatchEvent(new HashChangeEvent('hashchange')); };
      const m = main.querySelector('[data-missed]');
      if (m) m.addEventListener('click', () => replay(missed));
      main.querySelector('[data-again]').addEventListener('click', () => replay(results.map((r) => r.entry.word)));
    },
  });
}

/* -------------------------------------------------------------- Tricky --- */
export function tricky(main) {
  const list = withoutHidden(S.trickyWords().filter((t) => D.entry(t.word)), hiddenToday());
  main.innerHTML = '<section class="wrap page">'
    + '<div class="pagehead"><span class="eyebrow">Tricky words</span><h1>Words to go back to</h1>'
    + '<p class="muted">Each miss adds one. Each time you get it right in a test or quick game, it drops by one.</p></div>'
    + (list.length
      ? '<div class="btnrow"><button type="button" class="btn btn--primary" data-playall>Play all ' + Math.min(list.length, MAX_PICK) + '</button></div>'
        + '<div class="list">' + list.map((t) => {
          const w = D.entry(t.word);
          const ch = D.chapterById(w.chapterId);
          return '<div class="card listrow"><span><strong>' + esc(w.word) + '</strong><br><span class="muted small">'
            + esc(D.years()[w.yearId].label + ' · Chapter ' + D.chapterTitle(ch).n) + ' · missed ' + t.count + (t.count === 1 ? ' time' : ' times') + '</span></span>'
            + '<span class="btnrow"><button type="button" class="btn btn--quiet btn--small" data-hear="' + esc(w.word) + '">' + ICON.play + '<span class="sr">Hear</span></button>'
            + '<button type="button" class="btn btn--ghost btn--small" data-remove="' + esc(w.word) + '">Remove</button></span></div>';
        }).join('') + '</div>'
      : '<div class="card empty"><h2>Nothing here yet</h2><p class="muted">Words you miss in a test or in “Pick words” land here, so you can practise them again.</p><a class="btn btn--primary" href="#/chapters">Choose a chapter</a></div>')
    + '</section>';
  main.querySelectorAll('[data-hear]').forEach((b) => b.addEventListener('click', () => speak(b.dataset.hear)));
  main.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => { S.removeTricky(b.dataset.remove); tricky(main); toast('Removed ' + b.dataset.remove); }));
  const pa = main.querySelector('[data-playall]');
  if (pa) pa.addEventListener('click', () => { S.setSelection(list.slice(0, MAX_PICK).map((t) => t.word)); location.hash = '#/custom/play'; });
  return stop;
}

/* ------------------------------------------------------------ Progress --- */
export function progress(main) {
  const yearBlockHtml = (yid) => {
    const s = yearStats(yid);
    return '<div class="card setting"><h2>' + esc(D.years()[yid].label) + '</h2>' + meter(s.passed, s.total)
      + '<div class="list">' + D.chapters(yid).map((c) => {
        const p = S.chapterProgress(c.id);
        const tt = D.chapterTitle(c);
        return '<div class="listrow"><span>' + tt.n + '. ' + esc(tt.name) + '</span><span>'
          + (p.passed ? '<span class="pill pill--done">Passed</span>' : p.attempts ? '<span class="pill pill--warm">Best ' + p.best + '/' + c.words.length + '</span>' : p.studied ? '<span class="pill">Studied</span>' : '<span class="pill">—</span>')
          + '</span></div>';
      }).join('') + '</div></div>';
  };
  main.innerHTML = '<section class="wrap page">'
    + '<div class="pagehead"><span class="eyebrow">Progress</span><h1>How it\'s going</h1>'
    + '<p class="muted">' + (S.currentPlayer() ? 'Progress is saved to the player signed in, on every device they sign in on.' : 'Progress is saved in this browser on this device only.') + '</p></div>'
    + (S.currentPlayer() ? '<div class="btnrow"><a class="btn btn--ghost" href="#/words/progress">My word numbers' + ICON.arrow + '</a></div>' : '')
    + '<div class="settings">' + D.liveYears().map(yearBlockHtml).join('')
    + '<div class="card setting"><h2>Open every chapter</h2><p class="muted small">Normally a chapter opens when the one before it is passed. Turn this on to jump ahead.</p>'
    + '<label class="radios"><input type="checkbox" data-unlock' + (S.unlockAll() ? ' checked' : '') + '> Open all chapters</label></div>'
    + (document.body.classList.contains('is-adult') ? '<div class="card setting" data-startagain><h2>Start again</h2><p class="muted small">' + (S.currentPlayer() ? 'Clears chapter progress and tricky words for the player signed in, on every device.' : 'Clears chapter progress and tricky words in this browser.') + '</p>'
    + '<div class="btnrow"><button type="button" class="btn btn--ghost" data-reset>Clear my progress</button></div></div>' : '')
    + '</div></section>';
  applyMeters(main);
  main.querySelector('[data-unlock]').addEventListener('change', (e) => { S.setUnlockAll(e.target.checked); toast(e.target.checked ? 'All chapters open' : 'Chapters open one by one'); });
  const reset = main.querySelector('[data-reset]');
  let armed = false;
  if (reset) reset.addEventListener('click', () => {
    // Only a grown-up clears progress (it wipes every week): the role is checked again here.
    if (!W.mayClearProgress(document.body.classList.contains('is-adult') ? 'adult' : 'child')) return;
    if (!armed) { armed = true; reset.textContent = 'Tap again to clear everything'; reset.classList.add('btn--primary'); return; }
    S.resetAll(); toast('Progress cleared'); progress(main);
  });
}

/* --------------------------------------------------------------- About --- */
export function about(main) {
  main.innerHTML = '<section class="wrap page prose">'
    + '<span class="eyebrow">For parents</span><h1>About Spellbright</h1>'
    + '<p>Years 3 to 6 use the statutory word lists for Years 3 and 4 and for Years 5 and 6. The official lists cover two years each; we split each list into two years ourselves.</p>'
    + '<p>Word lists and spelling rules: Department for Education, English Appendix 1: Spelling. Contains public sector information licensed under the Open Government Licence v3.0.</p>'
    + '<h2>How a chapter works</h2>'
    + '<p>Each chapter has about ten words. Your child studies them (meaning, example, British pronunciation and the word split into spelling parts), plays a quick letter game where a flower loses a petal for each wrong guess, then a full practice game, then a test where they hear the word and type it. Every word right opens the next chapter.</p>'
    + '<p>Years 3 and 4 chapters go from easier to harder. Years 5 and 6 chapters group words by spelling pattern, such as silent letters or double consonants. Each official list covers two years, so we split each one into two years of five chapters ourselves.</p>'
    + '<p>Every word has a British recording that comes with the game. If one cannot play, a signed-in player hears the Waystead voice instead: a recording made once by the Waystead account service with Google Cloud Text-to-Speech, which is sent only the word, never anything about your child. Signed out or offline, this device’s own voice says it.</p>'
    + '<h2>My words</h2>'
    + '<p>My words is a weekly list. Your child picks up to ten words and a test date, then practises a little each day: the word is spoken and hidden, and they spell it letter by letter. The day before the test is the last practice day. On test day there is no help and no checking until the end, and the day after, any words that slipped come back as fix-ups.</p>'
    + '<p>A word counts as remembered once it is spelled with no help, at the first go of the day, on three different days at least a week apart from first to last. Words not yet remembered come back in later lists. The numbers are for your child and you only: there are no leagues and no comparing with anyone else.</p>'
    + '<h2>Study mode and Game mode</h2>'
    + '<p>Each word group comes with a guided week, one job each day, ' + DAILY_TIME + ': meet the words, fix them in with look, say, cover, write and check, play four games, see the words at work and write sentences, a round of the practice grid, the test, then mend anything that slipped. A missed day simply waits, and a short week fits the jobs into the days there are. In Fix it in, the practice grid and Mend and keep, a word comes straight back after a mistake or a peek, and is done once it has been spelled 3 times in a row. A word can be skipped for now, but the day\'s job stays open until it\'s done. ' + ROW_LINE + ' The three dots show those three spellings. The games don\'t earn dots; a wrong answer there simply comes back until it\'s right. Game mode has the same four games with the same words at any time, except while a test is due: until it\'s done, its words are kept off every page.</p>'
    + '<h2>Grown-ups</h2>'
    + '<p>Signed in as yourself, you\'ll find Grown-ups on the first page. There you can plan a week for your child and see how it\'s going, word by word. What a child writes (sentences and memory clues) can be seen only by that child and their own parent. The spelling patterns follow English Appendix 1, under the Open Government Licence v3.0.</p>'
    + '<h2>Little and often</h2>'
    + '<p>' + DAILY_TIME_CAP + ' works better than one long session. Start each session with a few tricky words before moving on.</p>'
    + '<h2>How it looks</h2>'
    + '<p>The look menu at the top (the sun or moon button) switches between Day · Sunny garden, Day · Paint box, Night and Match device (which follows this device\'s light or dark setting). The choice is shared with Wordbright, our word-tile game, which uses the same three styles. You can also pick the day style here:</p>'
    + dayStyleHtml({ tag: 'div', id: 'about-daystyle' })
    + '<h2>Privacy</h2>'
    + '<p>There are no adverts, no tracking and no analytics. To play, a child signs in with a Waystead account: their progress, saved games, look and voice are saved to that account, so they follow them to other devices, and play goes on offline on a device they have signed in on before. The home page and this page need no account. Each page asks account.waystead.co.uk whether someone is signed in; signed out, nothing else is sent.</p>'
    + '<h2>Who makes it</h2>'
    + '<p>Spellbright is made by <a href="https://waystead.co.uk">Waystead</a>. It is an independent project and is not affiliated with the Department for Education or any exam board.</p>'
    + '<h2>Fonts</h2>'
    + '<p class="small">Fredoka, Andika, Baloo 2, Nunito, Lexend and Atkinson Hyperlegible, under the SIL Open Font License 1.1 (copies in assets/fonts/licences/). The Waystead name uses Sora.</p>'
    + '</section>';
  return wireDayStyle(main);
}

export { notFound };
