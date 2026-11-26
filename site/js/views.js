// Every screen. Each view takes the <main> element and route params, renders,
// and may return a cleanup function.
import * as D from './data.js';
import * as S from './store.js';
import * as W from './words-doc.js';
import { speak, spellOut, stop } from './speech.js';
import { hasSentenceCard, sentenceCard, wireSentence } from './study-views.js'; // SB4-WP9
import { runSession, summaryHtml } from './play.js';
import { esc, ICON, picture, chunked, chunkText, boldWord, shuffle, toast, meter, applyMeters } from './ui.js';
import { backAgainFor, hiddenToday } from './words-views.js';
import { isUnlocked, notFound, chapters } from './front-views.js';
import { backLink, lookHtml, wireLook } from './child-views.js';
import { playable } from './games-doc.js';
import * as G from './games-doc.js';
import { withoutHidden, DAILY_TIME, ROW_LINE } from './study-doc.js';
import * as A from './assess-doc.js';
import { runCheck } from './assess-views.js';
import { childYear, isKnownChild } from './who.js';
import * as Ch from './chapters-doc.js';
import { safeDecode } from './chapters-doc.js';
import { entryFor, shown } from './word-info.js';

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
 * The chapter a page is for, and the link to it: { ch, base } for a year's chapter ({ yearId, slug }) or a grown-up's own
 * chapter ({ oid }, SB4-WP7), else null.
 */
export function chapterFrom(params) {
  if (params.oid) { // SB4-WP7: a grown-up's own chapter, from the copy in this child's setup
    const ch = Ch.ownChapter(S.readSetup(), safeDecode(params.oid), entryFor);
    return ch ? { ch, base: ch.base } : null;
  }
  const ch = D.chapterBySlug(params.yearId, params.slug);
  return ch ? { ch, base: href(params.yearId, params.slug) } : null;
}
/** One word of an own chapter, or null when the chapter has no such word. */
const ownEntry = (ch, word) => ch.words.find((e) => e.word.toLowerCase() === word.toLowerCase()) || null;
const rawEntries = (ch) => (ch.own ? ch.words : ch.words.map((w) => D.entry(w.word))); // an own chapter's words are entries already; the test and Pick words use these (the sentence is only heard there)
function wordEntries(ch) { return rawEntries(ch).map(shown); } // what a child reads: no example that holds a word whose test is due
/** The small heading over a chapter page: "Chapter 3 · Study", or "From your grown-up · Study" for an own chapter. */
const eyebrowOf = (ch, what) => (ch.own ? 'From your grown-up' : 'Chapter ' + D.chapterTitle(ch).n) + ' · ' + what;

/* --------------------------------------------------------------- Study --- */
export function study(main, params) {
  const from = chapterFrom(params);
  if (!from || !isUnlocked(from.ch)) return notFound(main);
  const { ch, base } = from;
  const t = D.chapterTitle(ch);
  main.innerHTML = '<section class="wrap page">'
    + '<div class="pagehead"><span class="eyebrow">' + esc(eyebrowOf(ch, 'Study')) + '</span><h1>' + esc(t.name) + '</h1>'
    + '<p class="muted">Take your time with each word. Tap “Spell it out” to hear it letter by letter.</p></div>'
    + '<div class="studylist">' + wordEntries(ch).map((w) =>
      '<article class="card wordcard' + (hasSentenceCard(w) ? ' wordcard--nopic' : '') + '" id="w-' + esc(w.word) + '">' + (hasSentenceCard(w) ? sentenceCard(w) : picture(w))
      + '<div class="wordcard__body">'
      + '<h2 class="wordcard__word">' + chunked(w, '', { tricky: true }) + '</h2>'
      + (w.meaning.definition // an own word with no meaning has no meaning card
        ? '<div class="wordcard__line"><span class="ipa">' + esc(w.ipa) + '</span><span class="pill">' + esc(w.meaning.partOfSpeech) + '</span><span class="chunktext">' + esc(chunkText(w)) + '</span></div>'
          + '<p>' + esc(w.meaning.definition) + '</p>' : '')
      + (!hasSentenceCard(w) && w.meaning.definition && w.meaning.example ? '<p class="example">' + boldWord(w.meaning.example, w.word) + '</p>' : '')
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
  wordEntries(ch).forEach((w) => { const art = main.querySelector('#w-' + CSS.escape(w.word)); if (art) wireSentence(art, w); }); // SB4-WP9
  main.querySelector('[data-done]').addEventListener('click', () => {
    S.markStudied(ch.id);
    location.hash = base + '/quick';
  });
  return stop;
}

/* --------------------------------------------------------- Spell it out --- */
export function spell(main, params) {
  const from = chapterFrom(params);
  const w = shown(from && from.ch.own ? ownEntry(from.ch, safeDecode(params.word)) : D.entry(safeDecode(params.word)));
  if (!w || !from) return notFound(main);
  main.innerHTML = '<section class="wrap page"><div class="card spell">'
    + picture(w)
    + '<div class="spell__word">' + chunked(w, '', { tricky: true }) + '</div>'
    + (w.meaning.definition ? '<p class="ipa">' + esc(w.ipa) + ' · <span class="chunktext">' + esc(chunkText(w)) + '</span></p>' : '')
    + '<div class="btnrow">'
    + '<button type="button" class="btn btn--primary" data-hear>' + ICON.play + 'Hear the word</button>'
    + '<button type="button" class="btn btn--ghost" data-spell>' + ICON.spell + 'Spell it letter by letter</button></div>'
    + (w.meaning.definition ? '<p>' + esc(w.meaning.definition) + '</p>' + (w.meaning.example ? '<p class="example">' + boldWord(w.meaning.example, w.word) + '</p>' : '') : '')
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
export function quick(main, params) {
  const { word } = params;
  const from = chapterFrom(params);
  if (!from || !isUnlocked(from.ch)) return notFound(main);
  const { ch, base } = from;
  const t = D.chapterTitle(ch);
  const single = word ? (ch.own ? ownEntry(ch, safeDecode(word)) : D.entry(safeDecode(word))) : null;
  if (word && !single) return notFound(main);
  const back = single ? [] : backAgainFor(ch.words.map((x) => x.word));
  const words = (single ? [single] : shuffle([...wordEntries(ch), ...back])).filter((e) => playable(e, 'flower')); // SB4-WP4: "a" and "I" are not played on a flower
  if (!words.length) return notFound(main);
  return runSession(main, {
    backAgain: back,
    eyebrow: eyebrowOf(ch, 'Quick game'),
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
export function practice(main, params) {
  const from = chapterFrom(params);
  if (!from || !isUnlocked(from.ch)) return notFound(main);
  const { ch, base } = from;
  const t = D.chapterTitle(ch);
  const back = backAgainFor(ch.words.map((x) => x.word));
  return runSession(main, {
    backAgain: back,
    eyebrow: eyebrowOf(ch, 'Practice'),
    title: t.name,
    words: shuffle([...wordEntries(ch), ...back]).filter((e) => playable(e, 'flower')), // SB4-WP4
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
export function test(main, params) {
  const from = chapterFrom(params);
  if (!from || !isUnlocked(from.ch)) return notFound(main);
  const { ch, base } = from;
  const t = D.chapterTitle(ch);
  const year = childYear();
  const { lv, pf } = S.helpNow(year);
  const chs = ch.own ? [] : D.chapters(ch.yearId); // an own chapter gates nothing: no next chapter, no next year
  const nextCh = chs[ch.index + 1];
  const live = D.liveYears();
  const nextYear = nextCh || ch.own ? '' : live[live.indexOf(ch.yearId) + 1] || ''; // the last chapter of a year leads on to the next year
  // SB4-WP5: the shared runner. Feedback comes at the end; the pass rule, what is stored and the end buttons stay.
  return runCheck(main, {
    kind: 'test', scope: {}, showMeaning: true, words: shuffle(rawEntries(ch)), pf, lv, year, backHref: base, title: ch.own ? ch.title : D.years()[ch.yearId].label + ' · Chapter ' + t.n,
    save: (a) => { if (a.ok) S.noteCorrect(a.w); else if (D.entry(a.w)) S.noteMissed(a.w, ch.id); }, // SB4-WP7: only a curriculum word is a tricky word
    done: (r) => {
      const passed = A.passes(pf, r.right, r.of);
      S.recordTest(ch.id, r.right, r.of, {
        passed,
        ...(pf !== 'normal' ? { pf } : {}), ...(r.lv < 5 ? { lv: r.lv } : {}),
        ...(r.hr > 0 ? { hr: r.hr } : {}), ...(r.hn > 0 ? { hn: r.hn } : {}),
      });
      return {
        buttons: [
          ...(passed && nextCh ? [{ label: 'Next chapter', href: base.replace(/[^/]+$/, nextCh.slug), primary: true, attr: 'data-next-chapter' }] : []),
          ...(passed && !nextCh && nextYear ? [{ label: 'Start ' + D.years()[nextYear].label, href: href(nextYear, D.chapters(nextYear)[0].slug), primary: true, attr: 'data-next-year' }] : []),
          ...(passed && !nextCh && !nextYear ? [{ label: 'More practice', href: '#/chapters', primary: true, attr: 'data-back-practice' }] : []),
          ...(!passed ? [{ label: 'Practise again', href: base + '/practice', primary: true }, { label: 'Take the test again', href: base + '/test', again: true, attr: 'data-retry' }] : []),
          { label: 'All chapters', href: '#/chapters' },
        ],
      };
    },
  });
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
    if (tab === 'chapter') return withoutHidden(rawEntries(D.chapterById(chapterId)), hidden);
    return all.filter((w) => w.word.toLowerCase().includes(filter.toLowerCase()));
  }

  function render() {
    const list = source();
    const chapterOpts = D.liveYears().map((yid) => '<optgroup label="' + esc(D.years()[yid].label) + '">'
      + D.chapters(yid).map((c) => '<option value="' + c.id + '"' + (c.id === chapterId ? ' selected' : '') + '>'
        + esc(D.chapterTitle(c).n + '. ' + D.chapterTitle(c).name) + '</option>').join('') + '</optgroup>').join('');
    main.innerHTML = '<section class="wrap page">'
      + '<div class="pagehead"><span class="eyebrow">Pick words</span><h1>Choose the words to play</h1>'
      + '<p class="muted">Up to ' + MAX_PICK + ' words. You play a quick game with them; any you miss go into Words to practise again.</p></div>'
      + '<div class="tabs" role="tablist">'
      + tabBtn('all', 'All words') + tabBtn('tricky', 'Practise again (' + tricky.length + ')') + tabBtn('chapter', 'A chapter') + '</div>'
      + '<div class="stack">'
      + (tab === 'all' ? '<div class="btnrow"><input class="field" type="search" placeholder="Find a word" aria-label="Find a word" value="' + esc(filter) + '" data-filter>'
        + '<button type="button" class="btn btn--quiet btn--small" data-random>Pick 10 at random</button></div>' : '')
      + (tab === 'chapter' ? '<select class="field" aria-label="Chapter" data-chapter>' + chapterOpts + '</select>' : '')
      + (tab === 'tricky' && !tricky.length ? '<div class="card empty"><p>No words to practise again yet. Words you miss in a test land here.</p></div>' : '')
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
        const note = G.flowerNote(r); // a peeked or tiled round is not a spelling from memory: it neither marks a word tricky nor clears it
        if (note === 'correct') S.noteCorrect(r.entry.word); else if (note === 'missed') S.noteMissed(r.entry.word, r.entry.chapterId);
      }
      const missed = results.filter((r) => G.flowerNote(r) === 'missed').map((r) => r.entry.word);
      const stepWay = results.some((r) => r.sbs);
      main.innerHTML = '<section class="wrap page">' + summaryHtml(results, 'All done')
        + (missed.length ? '<p class="muted">' + (stepWay ? 'These words are now in Words to practise again.' : 'Missed words are now in Words to practise again.') + '</p>' : '')
        + '<div class="btnrow">'
        + (missed.length ? '<button type="button" class="btn btn--primary" data-missed>' + (stepWay ? 'Practise these again' : 'Play the missed words') + '</button>' : '')
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
    + '<div class="pagehead">' + backLink() + '<h1>Words to practise again</h1>'
    + '<p class="muted">Words you missed in tests and practice. Practise them until you get them right.</p></div>'
    + (list.length
      ? '<div class="btnrow"><button type="button" class="btn btn--primary" data-playall>Practise ' + (list.length === 1 ? 'this word' : 'these ' + Math.min(list.length, MAX_PICK) + ' words') + '</button></div>'
        + '<div class="list">' + list.map((t) => {
          const w = D.entry(t.word);
          const ch = D.chapterById(w.chapterId);
          return '<div class="card listrow"><span><strong>' + esc(w.word) + '</strong><br><span class="muted small">'
            + esc(D.years()[w.yearId].label + ' · Chapter ' + D.chapterTitle(ch).n) + ' · missed ' + t.count + (t.count === 1 ? ' time' : ' times') + '</span></span>'
            + '<span class="btnrow"><button type="button" class="btn btn--quiet btn--small" data-hear="' + esc(w.word) + '">' + ICON.play + '<span class="sr">Hear</span></button>'
            + '<button type="button" class="btn btn--ghost btn--small" data-remove="' + esc(w.word) + '">Remove</button></span></div>';
        }).join('') + '</div>'
      : '<div class="card empty"><p class="empty__line">No words to practise again. Well done!</p><a class="btn btn--primary" href="#/chapters">Go to Practice</a></div>')
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
/**
 * What the About page says (06d): "How Spellbright works". Grown-ups only act on it, but a child or a signed-out visitor may read it.
 * Each is [heading, text]. No count of children, no sharing between grown-ups (lists stay with the one who made them), no "Game mode".
 */
export const ABOUT = {
  title: 'How Spellbright works',
  sub: 'For parents, teachers and tutors.',
  sections: [
    ['Set a week', 'Pick a word list, pick your children and pick a test date. Each child sees the words on their Today page. A week holds 10 words.'],
    ['Word lists', 'Add words word by word or paste a whole list. If scanning is switched on for you, you can scan a paper too. Ready-made lists for Years 1 to 6 are there too. Your word lists are saved for any child, any week.'],
    ['How a day goes', 'A full week gives each day one job, ' + DAILY_TIME + '. A shorter week puts more than one job on some days. ' + ROW_LINE],
    ['See how it is going', 'Each child’s page shows test scores and each word, with the words to practise again first.'],
    ['Three ways to use Spellbright', 'As a parent (My own children), as a tutor (My learners) or as a teacher (My class). Pick one when you start, and change it any time in your Account. Nothing you made will change.'],
    ['Lists stay with you', 'A word list belongs to the grown-up who made it. Lists are not shared between grown-ups.'],
    ['The name your children see', 'Your children see the name you choose (for example “Set by Mum”), never your email. Change it in your Account.'],
    ['Sentences and AI', 'Spellbright uses AI to help write practice sentences. Each one is checked before your child sees it. We never send your child’s name or work to an AI.'],
  ],
  scan: 'Scanning a school paper is for grown-ups only. When it is switched on, the photo goes to an AI service to read the words. Waystead does not keep the photo, and we save only the words you tick. Cover any names first.',
  licence: 'Word lists from the DfE English Appendix 1 and the spelling patterns use public sector information licensed under the Open Government Licence v3.0.',
  privacy: 'There are no adverts, no tracking and no analytics. A child signs in with a Waystead account, so their progress, saved games, look and voice follow them to other devices. This page needs no account.',
  fonts: 'Fredoka, Andika, Baloo 2, Nunito, Lexend and Atkinson Hyperlegible, under the SIL Open Font License 1.1 (copies in assets/fonts/licences/). The Waystead name uses Sora.',
};

export function about(main) {
  const adult = document.body.classList.contains('is-adult');
  const child = document.body.classList.contains('is-child');
  const back = adult ? backLink('Children', '#/grownups') : child ? backLink() : '';
  main.innerHTML = '<section class="wrap page prose about" data-about-page>'
    + back + '<h1>' + ABOUT.title + '</h1><p class="muted about__sub">' + ABOUT.sub + '</p>'
    + ABOUT.sections.map(([h, t]) => '<h2>' + h + '</h2><p>' + t + '</p>').join('')
    + (isKnownChild() ? '' : '<p class="about__scan" data-scan-note>' + ABOUT.scan + '</p>') // SB4-WP8
    + '<h2 id="about-look-h">Look</h2>' + lookHtml('about-look-h')
    + '<p class="small muted about__licence">' + ABOUT.licence + '</p>'
    + '<h2>Privacy</h2><p>' + ABOUT.privacy + '</p>'
    + '<h2>Who makes it</h2><p>Spellbright is made by <a href="https://waystead.co.uk">Waystead</a>. It is an independent project and is not affiliated with the Department for Education or any exam board.</p>'
    + '<p class="small">' + ABOUT.fonts + '</p>'
    + '</section>';
  return wireLook(main);
}

export { notFound };
