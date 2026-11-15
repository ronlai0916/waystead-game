// assess-views.js: one runner for a quiz, a test and an exam (SB4, WP5), and the pages that start it.
// runCheck asks a list of spoken words and gives its feedback by the rules of a kind and the child's help
// (assess-doc.js: RULES, and every child string). Nothing here decides a rule or writes a child sentence.
// It saves nothing itself: the caller's save(answer) and done(result) do (a chapter test, a weekly test, a quiz, an exam).
import * as D from './data.js';
import * as S from './store.js';
import * as W from './words-doc.js';
import * as A from './assess-doc.js';
import * as T from './tiles-doc.js';
import * as Tr from './tray.js';
import * as P from './progress-doc.js';
import * as Su from './setup-doc.js';
import { speak, sayLine, stop } from './speech.js';
import { hearInSentence, canSentence } from './sentence.js';
import { esc, ICON, keyboard, chunked, toast, meter, applyMeters } from './ui.js';
import { burstHtml, placeBursts } from './celebrate.js';
import { entryFor } from './word-info.js';
import { childYear } from './who.js';
import { notFound, isUnlocked } from './front-views.js';
import { chapterFrom } from './views.js';
import { SPELL_INSTRUCTION } from './child-doc.js';

const PEEK_MS = 3000;
const today = () => W.localDay(Date.now());
const svg = (d) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
const HEAR = svg('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>');
const TICK = svg('<path d="M5 12.5l4.5 4.5L19 7"/>');
const AGAIN = svg('<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>');
const isUp = (c) => c !== c.toLowerCase() && c === c.toUpperCase();

// ---- pure helpers (no DOM; exported for the smoke and the tests) ---------------------------
/** A capital is filled in for the child: typed letters take the word's own case wherever the word has a capital. */
export const shapeAnswer = (typed, word) => [...String(typed)].map((c, k) => (word[k] && isUp(word[k]) && c.toLowerCase() === word[k].toLowerCase() ? word[k] : c)).join('');
/** n words of the set, in an order the seeded generator gives: the same seed, the same words. */
export function pickWords(entries, n, rand) {
  const a = entries.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
const sum = (list, key) => list.reduce((n, r) => n + (r[key] || 0), 0);

/**
 * opts = { kind: 'quiz'|'test'|'exam', scope: { weekly? }, words: entry[], pf, lv, year, backHref, title,
 *          save(answer)  (each word, never for an exam), done(result) -> { buttons?, right?, of?, miss? } | void,
 *          base?: { done, of }   (a test carried on: words already answered),
 *          start?: { i, answers }   (an exam carried on), onDraft?(state)   (an exam's answers so far) }
 * answer = { w, ok, hr, hn, pk, lv };  result = { right, of, miss, hr, hn, pk, lv, pf, answers }
 * buttons = [{ label, href, primary?, again?, attr? }]. Returns a cleanup function.
 */
export function runCheck(main, opts) {
  const { kind, scope = {}, words, year } = opts;
  const pf = opts.pf === 'sen' || opts.pf === 'top' ? opts.pf : 'normal';
  const rule = A.rulesFor(kind, pf);
  const inputLv = A.levelFor(kind, pf, opts.lv);
  const n = words.length;
  const exam = kind === 'exam';
  const y12 = year === 1 || year === 2;
  const base = opts.base || { done: 0, of: n };
  const ends = [];
  { let c = 0; for (const k of A.partsOf(n, rule)) { c += k; ends.push(c); } ends.pop(); } // where a rest comes: after this many words
  const rec = words.map(() => ({ typed: '', ok: 0, hr: 0, hn: 0, pk: 0, seen: false }));
  const restSeen = new Set();
  let i = 0;
  let mode = '';
  let spec = null;
  let ctrl = null;
  let typed = '';
  let hold = false; // a peek on show
  let peekTimer = null;
  let toFinish = false; // an exam word opened from the Finish page goes back there
  let pending = null; // an exam handed in, the wait screen on show
  if (!n) return () => {};

  const kindName = A.kindName(kind, pf, year);
  const eyebrow = opts.title ? '<p class="eyebrow">' + esc(opts.title) + '</p>' : '';
  const cls = (name) => 'wrap page assess assess--card assess--' + name + (y12 ? ' assess--y12' : '') + (pf === 'sen' ? ' assess--sen' : '') + (exam ? ' exampaper' : '');
  const focusHead = () => { const h = main.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } };
  function screen(html) {
    if (ctrl) { ctrl.destroy(); ctrl = null; }
    clearTimeout(peekTimer);
    hold = false;
    main.innerHTML = html;
    applyMeters(main);
    window.scrollTo(0, 0);
    focusHead();
  }
  const sayRow = (line, k) => '<div class="assess__says"><p>' + esc(line) + '</p><button type="button" class="hearround" data-say="' + k + '" aria-label="Hear this line">' + HEAR + '</button></div>';
  const wireSay = (lines) => main.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => sayLine(lines[Number(b.dataset.say)])));

  // ---- the ready screen, a rest, the wait ----
  function ready() {
    mode = 'ready';
    const r = A.readyLines(kind, pf, n);
    screen('<section class="' + cls('ready') + '" data-assess="ready"><div class="assess__card">' + eyebrow + '<h1>' + esc(kindName) + '</h1>'
      + r.lines.map(sayRow).join('')
      + (exam ? '<div class="paperlines" aria-hidden="true"><span>1</span><span>2</span><span>3</span></div>' : '') + '</div>'
      + '<button type="button" class="btn btn--primary btn--hero assess__go" data-start>' + esc(r.button) + '</button></section>');
    wireSay(r.lines);
    main.querySelector('[data-start]').addEventListener('click', () => word());
  }
  function rest() {
    mode = 'rest';
    screen('<section class="' + cls('rest') + '" data-assess="rest"><div class="assess__card"><h1>' + esc(A.REST.head) + '</h1>' + sayRow(A.REST.line, 0) + '</div>'
      + '<button type="button" class="btn btn--primary btn--hero assess__go" data-carry>' + esc(A.REST.button) + '</button></section>');
    wireSay([A.REST.line]);
    main.querySelector('[data-carry]').addEventListener('click', () => word());
  }
  function wait() {
    mode = 'wait';
    screen('<section class="' + cls('wait') + '" data-assess="wait"><div class="assess__card"><h1>' + esc(A.WAIT.line) + '</h1></div>'
      + '<button type="button" class="btn btn--primary btn--hero assess__go" data-show>' + esc(A.WAIT.button) + '</button></section>');
    main.querySelector('[data-show]').addEventListener('click', () => end(pending.result, pending.extra));
  }

  // ---- one word ----
  const progressHtml = () => '<div class="assess__prog"><span class="progressline" data-progress>' + esc(A.progressLine(base.done + i + 1, base.of)) + '</span>' + meter(base.done + i, base.of).replace('<div ', '<div aria-label="' + esc(A.progressLine(base.done + i + 1, base.of)) + '" ', 1) + '</div>';
  const answerOf = (k) => ({ w: words[k].word, ok: rec[k].ok, hr: rec[k].hr, hn: rec[k].hn, pk: rec[k].pk, lv: inputLv });
  function draftNow() {
    if (!opts.onDraft) return;
    opts.onDraft({ i, answers: rec.map((r, k) => (r.typed || r.hr || r.hn || r.pk ? { w: words[k].word, typed: r.typed, hr: r.hr, hn: r.hn, pk: r.pk } : null)) });
  }
  const hearNow = (e) => (rule.sentence === 'auto' && canSentence(e) ? hearInSentence(e) : speak(e.word));
  const left = (r) => (Number.isFinite(rule.replays) ? rule.replays - r.hr : Infinity);
  // The first letter can be given when it is a gap (a tray) or always (the keyboard); a capital already shown does not count.
  const hintGap = () => {
    if (!spec) return 0;
    const f = spec.letters.length > 1 && isUp(spec.letters[0].ch) ? 1 : 0;
    return spec.gaps.includes(f) ? f : -1;
  };

  function word() {
    mode = 'word';
    const e = words[i];
    const r = rec[i];
    spec = inputLv < 5 ? Tr.specFor(e, inputLv, { pf }) : null;
    if (spec && !spec.gaps.length) spec = null; // nothing to tap: the keyboard
    typed = spec ? '' : String(r.typed || '').toLowerCase();
    const sentence = (rule.sentence === 'button' || rule.sentence === 'counts') && canSentence(e) && !(kind === 'quiz' && pf !== 'sen');
    const hint = rule.hints > 0 && hintGap() >= 0;
    const peek = rule.peeks > 0;
    const tools = (sentence ? '<button type="button" class="btn btn--ghost" data-sentence>' + HEAR + esc(A.SENTENCE_BUTTON) + '</button>' : '')
      + (hint ? '<button type="button" class="btn btn--ghost" data-hint>' + esc(A.HINT_BUTTON) + '</button>' : '')
      + (peek ? '<button type="button" class="btn btn--ghost" data-peekbtn>' + Tr.EYE_ICON + 'Peek</button>' : '');
    const toolsRow = tools ? '<div class="assess__tools">' + tools + '</div>' : '';
    const m = e.meaning;
    const meaning = opts.showMeaning && pf === 'normal' && m && m.definition
      ? '<p class="assess__mean" data-meaning>' + (m.partOfSpeech ? '<span class="pill">' + esc(m.partOfSpeech) + '</span> ' : '') + esc(m.definition) + '</p>' : '';
    const prev = exam && i > 0 ? '<button type="button" class="btn btn--quiet" data-prevword>Back one word</button>' : '';
    const paper = exam ? '<span class="paperno" aria-hidden="true">' + (i + 1) + '</span>' : '';
    const shell = ' data-assess="word" data-word-no="' + (i + 1) + '"';
    if (spec) {
      screen('<section class="wrap page spellpage tilepage assess assess--word' + (exam ? ' exampaper' : '') + '"' + shell + '><div class="pagehead">' + progressHtml() + '<h1 class="sr">Spell the word</h1></div>'
        + Tr.lineHtml(Tr.instructionFor(inputLv), '')
        + (peek ? '<p class="peek" data-peek aria-live="polite"></p>' : '')
        + '<div class="card tileword">' + (paper ? '<div class="paperrow">' + paper + Tr.boxesHtml(spec, { tricky: e.tricky }) + '</div>' : Tr.boxesHtml(spec, { tricky: e.tricky }))
        + '<button type="button" class="btn btn--ghost btn--wide" data-hear>' + ICON.play + 'Hear again</button></div>'
        + meaning + toolsRow + '<p class="assess__heard" data-heard role="status"></p>'
        + '<div data-slot>' + Tr.colHtml(Tr.trayHtml(spec),
          '<div class="btnrow btnrow--center testbtns testbtns--tray"><button type="button" class="btn btn--primary" data-next disabled>Next' + ICON.arrow + '</button>' + prev + '</div>') + '</div></section>');
      ctrl = Tr.mountTray(main, spec, { mode: 'test', xs: pf === 'sen', onChange: (s) => { const nx = main.querySelector('[data-next]'); if (nx) nx.disabled = !s.full || hold; } });
      if (r.typed) for (const g of spec.gaps) if (r.typed[g]) ctrl.key(r.typed[g]); // an answer carried back to
    } else {
      screen('<section class="wrap page spellpage assess assess--word' + (exam ? ' exampaper' : '') + '"' + shell + '><div class="pagehead">' + progressHtml()
        + '<h1>' + esc(SPELL_INSTRUCTION) + '</h1><button type="button" class="linkbtn linkbtn--start" data-instruct>Read it to me</button></div>'
        + '<div class="btnrow btnrow--center"><button type="button" class="btn btn--primary btn--wide" data-hear>' + ICON.play + 'Hear the word</button></div>'
        + meaning + toolsRow + (peek ? '<p class="peek" data-peek aria-live="polite"></p>' : '') + '<p class="assess__heard" data-heard role="status"></p>'
        + (paper ? '<div class="paperrow">' + paper + '<p class="answerline" data-answer aria-live="polite" aria-label="Your answer"></p></div>'
          : '<p class="answerline" data-answer aria-live="polite" aria-label="Your answer"></p>')
        + '<div data-slot>' + keyboard({ del: true })
        + '<div class="btnrow btnrow--center testbtns"><button type="button" class="btn btn--primary btn--wide" data-next>Next' + ICON.arrow + '</button>' + prev + '</div></div></section>');
      main.querySelector('[data-del]').addEventListener('click', del);
      main.querySelectorAll('.key[data-letter]').forEach((k) => k.addEventListener('click', () => put(k.dataset.letter)));
      main.querySelector('[data-instruct]').addEventListener('click', () => sayLine(SPELL_INSTRUCTION));
      showTyped();
    }
    const q = (s) => main.querySelector(s);
    q('[data-hear]').addEventListener('click', () => {
      if (hold || left(r) <= 0) return;
      r.hr += 1;
      paintHear();
      hearNow(e);
    });
    if (sentence) {
      q('[data-sentence]').addEventListener('click', () => {
        if (hold) return;
        if (rule.sentence === 'counts') { if (left(r) <= 0) return; r.hr += 1; paintHear(); }
        hearInSentence(e);
      });
    }
    if (hint) {
      const b = q('[data-hint]');
      b.disabled = r.hn >= rule.hints;
      b.addEventListener('click', () => {
        if (hold || r.hn >= rule.hints) return;
        r.hn += 1;
        b.disabled = true;
        if (spec) ctrl.fill(hintGap()); else { typed = e.word[0].toLowerCase() + typed.slice(1); showTyped(); }
      });
    }
    if (peek) {
      const b = q('[data-peekbtn]');
      b.disabled = r.pk >= rule.peeks;
      b.addEventListener('click', () => {
        if (hold || r.pk >= rule.peeks) return;
        r.pk += 1;
        hold = true;
        b.disabled = true;
        q('[data-peek]').textContent = e.word;
        if (ctrl) ctrl.lock(true);
        const nx = q('[data-next]');
        if (nx) nx.disabled = true;
        peekTimer = setTimeout(() => {
          hold = false;
          const p = q('[data-peek]');
          if (p) p.textContent = '';
          if (ctrl) { ctrl.lock(false); const s = ctrl.state(); if (nx) nx.disabled = !s.full; } else if (nx) nx.disabled = false;
        }, PEEK_MS);
      });
    }
    q('[data-next]').addEventListener('click', commit);
    const back = q('[data-prevword]');
    if (back) back.addEventListener('click', goBack);
    paintHear();
    draftNow();
    if (!r.seen) { r.seen = true; hearNow(e); }
  }
  function paintHear() {
    const r = rec[i];
    const l = left(r);
    const h = main.querySelector('[data-hear]');
    if (h && l <= 0 && !h.disabled) {
      const focused = document.activeElement === h;
      h.disabled = true;
      if (focused) { const t = main.querySelector('[data-answer], .tileboxes, [data-next]'); const nx = main.querySelector('[data-next]'); const f = nx && !nx.disabled ? nx : t; if (f) { if (!f.hasAttribute('tabindex') && f.tagName !== 'BUTTON') f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); } }
    } else if (h) h.disabled = l <= 0;
    const s = main.querySelector('[data-sentence]');
    if (s && rule.sentence === 'counts') s.disabled = l <= 0;
    const line = main.querySelector('[data-heard]');
    if (line) line.textContent = l <= 0 ? A.heardLine(r.hr) : '';
  }
  function showTyped() {
    const el = main.querySelector('[data-answer]');
    if (el) el.textContent = shapeAnswer(typed, words[i].word);
  }
  function put(L) { if (hold || mode !== 'word') return; if (typed.length < 24) { typed += L.toLowerCase(); showTyped(); } }
  function del() { if (hold || mode !== 'word') return; typed = typed.slice(0, -1); showTyped(); }

  function commit() {
    if (hold || mode !== 'word') return;
    const e = words[i];
    const r = rec[i];
    const got = spec ? (ctrl.state().full ? ctrl.state().answer : '') : typed;
    if (!got) { if (!spec) toast('Type the word first'); return; }
    r.typed = got;
    r.ok = got.toLowerCase() === e.word.toLowerCase() ? 1 : 0;
    if (!exam && opts.save) opts.save(answerOf(i));
    if (exam) { next(); return; }
    if (rule.feedback === 'each') feedback(); else next();
  }
  function goBack() {
    if (!exam || i === 0 || mode !== 'word') return;
    const r = rec[i];
    const got = spec ? ctrl.state().answer : typed;
    if (got) r.typed = got; // whatever is there stays
    toFinish = false;
    i -= 1;
    word();
  }
  function next() {
    stop();
    if (toFinish) { toFinish = false; finishScreen(); return; }
    i += 1;
    if (i >= n) { if (exam) finishScreen(); else complete(); return; }
    if (ends.includes(i) && !restSeen.has(i)) { restSeen.add(i); rest(); return; }
    word();
  }

  // ---- a quiz tells you after every word ----
  function feedback() {
    mode = 'fb';
    const e = words[i];
    const ok = rec[i].ok;
    const line = ok ? A.RIGHT : A.NEARLY_QUIZ;
    screen('<section class="' + cls('fb') + '" data-assess="fb" data-fb="' + (ok ? 'right' : 'nearly') + '"><div class="pagehead">' + progressHtml() + '</div>'
      + '<div class="assess__fb assess__fb--' + (ok ? 'ok' : 'soft') + '">' + (ok ? TICK : AGAIN).replace('<svg ', '<svg class="assess__fbicon" ')
      + '<h1>' + esc(line) + '</h1><button type="button" class="hearround" data-say="0" aria-label="Hear this line">' + HEAR + '</button></div>'
      + (ok ? '' : '<div class="card assess__how"><div class="assess__how__word" data-right-spelling>' + chunked(e, '', { tricky: true }) + '</div>'
        + '<button type="button" class="btn btn--ghost btn--wide" data-hear>' + ICON.play + 'Hear again</button></div>')
      + '<button type="button" class="btn btn--primary btn--hero assess__go" data-next>Next' + ICON.arrow + '</button></section>');
    wireSay([line]);
    const h = main.querySelector('[data-hear]');
    if (h) h.addEventListener('click', () => speak(e.word));
    main.querySelector('[data-next]').addEventListener('click', next);
  }

  // ---- an exam: check, then hand in ----
  function finishScreen() {
    mode = 'finish';
    i = n; // every word has an answer
    draftNow();
    screen('<section class="' + cls('finish') + '" data-assess="finish"><div class="pagehead">' + eyebrow + '<h1>' + esc(kindName) + '</h1><p class="assess__line">' + esc(A.FINISH.hint) + '</p></div>'
      + '<ol class="paperlist">' + words.map((e, k) => '<li><button type="button" class="paperlist__row" data-edit="' + k + '"><span class="paperno">' + (k + 1) + '</span><span class="paperans">'
        + esc(shapeAnswer(rec[k].typed, e.word)) + '</span><span class="sr">. Change word ' + (k + 1) + '</span></button></li>').join('') + '</ol>'
      + '<button type="button" class="btn btn--primary btn--hero assess__go" data-finish>' + esc(A.FINISH.button) + '</button></section>');
    main.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => { i = Number(b.dataset.edit); toFinish = true; word(); }));
    main.querySelector('[data-finish]').addEventListener('click', handIn);
  }
  function handIn() {
    rec.forEach((r, k) => { r.ok = String(r.typed).toLowerCase() === words[k].word.toLowerCase() ? 1 : 0; });
    const result = resultOf();
    const extra = (opts.done && opts.done(result)) || {};
    pending = { result, extra };
    wait();
  }

  // ---- the end ----
  function resultOf() {
    return {
      right: sum(rec, 'ok'), of: n, miss: words.filter((_, k) => !rec[k].ok).map((e) => e.word),
      hr: sum(rec, 'hr'), hn: sum(rec, 'hn'), pk: sum(rec, 'pk'), lv: inputLv, pf, answers: rec.map((_, k) => answerOf(k)),
    };
  }
  function complete() {
    const result = resultOf();
    const extra = (opts.done && opts.done(result)) || {};
    end(result, extra);
  }
  function end(result, extra) {
    mode = 'end';
    const right = extra.right !== undefined ? extra.right : result.right;
    const of = extra.of !== undefined ? extra.of : result.of;
    const miss = extra.miss || result.miss;
    const L = A.endLines(kind, pf, { right, of, toPractise: miss.length }, scope);
    const say = [L.head, ...L.lines].join(' ');
    const buttons = extra.buttons || [{ label: 'Back', href: opts.backHref || '#/', primary: true }];
    const cards = miss.map((w) => {
      const e = words.find((x) => x.word === w) || entryFor(w);
      return '<li class="assess__pcard"><span data-practise-word>' + chunked(e, '', { tricky: true }) + '</span><button type="button" class="hearround" data-hearword="' + esc(w) + '" aria-label="Hear the word">' + HEAR + '</button></li>';
    });
    screen('<section class="' + cls('end') + '" data-assess="end" data-end="' + (L.celebrate ? 'celebrate' : 'plain') + '"><div class="assess__card">'
      + (L.celebrate ? '<span class="celebrate passmark" aria-hidden="true"><span class="passmark__badge">' + ICON.star + '</span>' + burstHtml(16, 2) + '</span>' : '')
      + eyebrow + '<div class="assess__says"><h1>' + esc(L.head) + '</h1><button type="button" class="hearround" data-sayall aria-label="Hear this">' + HEAR + '</button></div>'
      + L.lines.map((l) => '<p class="assess__line">' + esc(l) + '</p>').join('') + '</div>'
      + (cards.length ? '<h2 class="assess__cardhead">Words to practise</h2><ul class="assess__cards">' + cards.join('') + '</ul>' : '')
      + '<div class="assess__end">' + buttons.map((b) => '<a class="btn ' + (b.primary ? 'btn--primary' : 'btn--ghost') + '" href="' + esc(b.href) + '"'
        + (b.attr && /^[a-z-]+$/.test(b.attr) ? ' ' + b.attr : '') + (b.again ? ' data-again' : '') + '>' + esc(b.label) + (b.primary ? ICON.arrow : '') + '</a>').join('') + '</div></section>');
    placeBursts(main);
    main.querySelector('[data-sayall]').addEventListener('click', () => sayLine(say));
    main.querySelectorAll('[data-hearword]').forEach((b) => b.addEventListener('click', () => speak(b.dataset.hearword)));
    main.querySelectorAll('[data-again]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); window.dispatchEvent(new HashChangeEvent('hashchange')); }));
  }

  // ---- the keys of a real keyboard ----
  function onKey(ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const onControl = ev.target && ev.target.closest && ev.target.closest('button, a, input, select, textarea');
    if (mode === 'word') {
      if (/^[a-z]$/i.test(ev.key)) { ev.preventDefault(); if (spec) { if (!hold) ctrl.key(ev.key); } else put(ev.key); } else if (ev.key === 'Backspace') { ev.preventDefault(); if (spec) { if (!hold) ctrl.back(); } else del(); } else if (ev.key === 'Enter' && (!onControl || ev.target.closest('[data-hear], [data-sentence], [data-hint]'))) { ev.preventDefault(); commit(); }
    }
  }
  document.addEventListener('keydown', onKey);

  // ---- begin ----
  if (opts.start && exam) {
    const s = opts.start;
    (s.answers || []).forEach((a, k) => { if (a && rec[k]) Object.assign(rec[k], { typed: String(a.typed || ''), hr: a.hr || 0, hn: a.hn || 0, pk: a.pk || 0, seen: true }); });
    i = Math.max(0, Math.min(n, Number(s.i) || 0));
    if (i >= n) finishScreen(); else word();
  } else if (rule.ready) ready();
  else word();

  return () => {
    document.removeEventListener('keydown', onKey);
    clearTimeout(peekTimer);
    if (ctrl) ctrl.destroy();
    stop();
  };
}

// ---- a quick quiz: five words (three on Extra support and in Year 1), nothing kept but one record ----
const quizRuns = new Map(); // src -> quizzes finished on this page load (the saved ones are counted too), so "Quiz again" gives other words
function quizWords(src, entries, pf, year) {
  const doc = S.currentPlayer() ? S.readDoc() : null;
  const kept = doc ? P.checksOf(doc, 'q:' + src).runs.length : 0;
  const here = quizRuns.get(src) || 0;
  const rand = T.rng((T.seedOf(src, today()) + kept + here) >>> 0);
  return pickWords(entries, A.quizLength(pf, year), rand);
}
function quizRecord(src, r, day) {
  quizRuns.set(src, (quizRuns.get(src) || 0) + 1); // the next "Quiz again" draws other words, signed in or not
  S.addCheck({
    c: 'q:' + src, k: 'q', s: r.right, t: r.of, d: day,
    ...(r.miss.length ? { miss: r.miss.slice(0, 20) } : {}),
    ...(r.lv < 5 ? { lv: r.lv } : {}), ...(r.pf !== 'normal' ? { pf: r.pf } : {}),
    ...(r.hr > 0 ? { hr: r.hr } : {}), ...(r.hn > 0 ? { hn: r.hn } : {}), ...(r.pk > 0 ? { pk: r.pk } : {}),
  });
}

/** :yearId/:slug/quiz */
export function chapterQuiz(main, params) {
  const from = chapterFrom(params);
  if (!from || !isUnlocked(from.ch)) return notFound(main);
  const { ch, base } = from;
  const year = childYear();
  const { lv, pf, offer } = S.helpNow(year);
  if (!offer.quiz) { location.replace(base); return undefined; }
  const t = D.chapterTitle(ch);
  const entries = ch.words.map((w) => D.entry(w.word)).filter(Boolean);
  if (!entries.length) return notFound(main);
  return runCheck(main, {
    kind: 'quiz', scope: {}, words: quizWords(ch.id, entries, pf, year), pf, lv, year, backHref: base, title: 'Chapter ' + t.n + ' · ' + t.name,
    done: (r) => {
      quizRecord(ch.id, r, today());
      return { buttons: [{ label: 'Practise them', href: base + '/practice', primary: true }, { label: 'Quiz again', href: base + '/quiz', again: true }] };
    },
  });
}

/** words/g/:gid/quiz */
export function groupQuiz(main, { gid }) {
  const id = decodeURIComponent(gid);
  const d = S.readWords();
  const g = W.groupById(d, id);
  if (!g) { location.replace('#/'); return undefined; }
  const href = '#/words/g/' + encodeURIComponent(id);
  const year = childYear();
  const { lv, pf, offer } = S.helpNow(year);
  if (!offer.quiz || W.jobFor(d, g, today()) === 'test') { location.replace(href); return undefined; }
  return runCheck(main, {
    kind: 'quiz', scope: {}, words: quizWords('g-' + id, g.words.map(entryFor), pf, year), pf, lv, year, backHref: href, title: g.name,
    done: (r) => {
      quizRecord('g-' + id, r, today());
      return { buttons: [{ label: 'Practise them', href, primary: true }, { label: 'Quiz again', href: href + '/quiz', again: true }] };
    },
  });
}

// ---- the big test / exam a grown-up set: words/exam/:eid ----
const DRAFT = 'sb.examDraft';
const readDraft = (eid, list, re) => {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT));
    if (!d || d.eid !== eid || !Array.isArray(d.answers) || d.answers.length !== list.length || (d.re || 0) !== re) return null;
    if (!(Number(d.i) > 0) && !d.answers.some(Boolean)) return null; // nothing kept yet: start from the ready screen
    return d.answers.every((a, k) => !a || a.w === list[k]) ? d : null;
  } catch (e) { return null; }
};
const writeDraft = (v) => { try { if (v) sessionStorage.setItem(DRAFT, JSON.stringify(v)); else sessionStorage.removeItem(DRAFT); } catch (e) { /* ignore */ } };

export function examPage(main, { eid }) {
  const id = decodeURIComponent(eid);
  const exam = Su.liveExams(S.readSetup()).find((e) => e.id === id);
  if (!exam) return notFound(main);
  const year = childYear();
  const { lv, pf } = S.helpNow(year);
  const name = A.kindName('exam', pf, year);
  const day = today();
  const { state } = P.examState(S.readDoc(), id, exam, day);
  if (state !== 'ready') {
    const line = state === 'later' ? A.examLater(name, W.dayLabel(exam.date)) : A.EXAM_DONE;
    main.innerHTML = '<section class="wrap page assess assess--card assess--' + state + (year === 1 || year === 2 ? ' assess--y12' : '') + '" data-assess="' + state + '"><div class="assess__card"><h1>' + esc(name) + '</h1>'
      + '<div class="assess__says"><p>' + esc(line) + '</p><button type="button" class="hearround" data-say aria-label="Hear this line">' + HEAR + '</button></div></div>'
      + '<a class="btn btn--primary btn--hero assess__go" href="#/" data-back>Back</a></section>';
    main.querySelector('[data-say]').addEventListener('click', () => sayLine(line));
    const h = main.querySelector('h1');
    h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
    return stop;
  }
  const entries = exam.words.map(entryFor); // fixed, in the grown-up's order, the same for everyone
  const draft = readDraft(id, exam.words, exam.reopen || 0);
  return runCheck(main, {
    kind: 'exam', scope: {}, words: entries, pf, lv, year, backHref: '#/', title: exam.name,
    start: draft ? { i: draft.i, answers: draft.answers } : null,
    onDraft: (s) => writeDraft({ eid: id, re: exam.reopen || 0, i: s.i, answers: s.answers }),
    done: (r) => {
      S.addCheck({
        c: 'e:' + id, k: 'e', s: r.right, t: r.of, d: today(),
        ...(r.miss.length ? { miss: r.miss.slice(0, 20) } : {}),
        ...(r.lv < 5 ? { lv: r.lv } : {}), ...(r.pf !== 'normal' ? { pf: r.pf } : {}),
        ...(r.hr > 0 ? { hr: r.hr } : {}), ...(r.hn > 0 ? { hn: r.hn } : {}),
      });
      writeDraft(null);
      return { buttons: [{ label: 'Go to the start', href: '#/', primary: true }] };
    },
  });
}
