// The sentence builder's screens (SB6, TR-45, BR-17, BR-18, BR-34), drawn from the approved design S1 to S11.
// One level to a screen: 1 Choose the cards, 2 Find the missing word (spelled, with Peek and Undo), 3 Put it in order,
// 4 Make your own (optional, typed or tapped). Tap only for levels 1 to 3. Nothing a child types leaves the device:
// the sentence is checked here against our own lists and read aloud with the DEVICE's voice only (sayLine), never the Waystead voice.
// The layout uses the shell of css/sbs.css (.s6, .s6-upper, .s6-block ...) and css/builder.css adds what is only the builder's.
import * as D from './data.js';
import * as S from './store.js';
import * as W from './words-doc.js';
import * as St from './study-doc.js';
import * as Su from './setup-doc.js';
import { entryFor, shown } from './word-info.js';
import { speak, sayLine, stop } from './speech.js';
import { picture, esc } from './ui.js';
import { childYear } from './who.js';
import * as Tr from './tray.js';
import { mountTileKeys, pressCheck } from './tile-keys.js';
import { traySpec, middleCode, CODE } from './ladder-doc.js';
import { peekRule, peekMs } from './peek-doc.js';
import { mountPeek } from './peek.js';
import { RULES } from './sbs-rules.js';
import * as SD from './sentence-doc.js';

export const HELP_LABEL = 'Help me build it'; // the quiet button on a Usual-way child's Story day (BR-34), drawn by WP-5b

const svg = (d) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
const ICO = {
  hear: svg('<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>'),
  eye: svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  tick: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>').replace('<svg', '<svg class="tk"'),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
};
const hearBtn = (label, attr) => '<button type="button" class="hearround" ' + attr + ' aria-label="' + esc(label) + '" data-fold="hear">' + ICO.hear + '</button>';
const today = () => W.localDay(Date.now());
const lc = (s) => String(s).toLowerCase();
const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ---- what the builder reads: the bank, the statements, the lists the typed words are checked against ---------------------------
let bankP = null;
const loadBank = () => {
  if (!bankP) {
    bankP = fetch('data/builder.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
    bankP.then((b) => { if (!b) bankP = null; });
  }
  return bankP;
};
let stmtP = null;
const loadStatements = () => {
  if (!stmtP) {
    stmtP = fetch('data/statements.json').then((r) => (r.ok ? r.json() : null)).then((j) => (j && j.w) || {}).catch(() => ({}));
    stmtP.then((b) => { if (!Object.keys(b).length) stmtP = null; });
  }
  return stmtP;
};
const STARTERS = ['a', 'an', 'the', 'and', 'but', 'so', 'or', 'was', 'were', 'is', 'are', 'am', 'be', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'up', 'we', 'you', 'he', 'she', 'it', 'they', 'i', 'my', 'our', 'your', 'his', 'her', 'their', 'its', 'very', 'can', 'said', 'not', 'no', 'yes', 'this', 'that', 'there', 'here', 'too'];
let knownP = null;
/** isKnown(word): the curriculum, the words of the bank, a few small words, and Wordbright's two smallest tiers (fetched once; offline, only our own words). */
function loadKnown(bank) {
  if (!knownP) {
    knownP = (async () => {
      const own = new Set([...STARTERS, ...[...D.lexicon()].map(lc)]);
      if (bank && bank.frames) for (const g of Object.values(bank.frames)) for (const f of g) { for (const w of f.t.match(/[A-Za-z']+/g) || []) own.add(lc(w)); for (const c of Object.values(f.s || {}).flat()) own.add(lc(c)); }
      let inList = null;
      try {
        const [{ loadWordGraph, isWord }, res] = await Promise.all([import('../../wordbright/js/engine/words.js'), fetch('../wordbright/data/words_all.dawg')]);
        if (res.ok) { const graph = loadWordGraph(await res.arrayBuffer()); inList = (w) => isWord(w, graph, 1); }
      } catch (e) { inList = null; }
      return (w) => own.has(lc(w)) || !!(inList && inList(lc(w)));
    })();
  }
  return knownP;
}

// ---- stickers: Composition's own sticker data, read only; a small built-in set when it cannot be read ------------------------------
const FALLBACK_STICKERS = [
  { id: 'moon', name: 'Moon', emoji: '\u{1F319}' }, { id: 'star', name: 'Star', emoji: '⭐' }, { id: 'flower', name: 'Flower', emoji: '\u{1F33C}' },
  { id: 'tree', name: 'Tree', emoji: '\u{1F333}' }, { id: 'sun', name: 'Sun', emoji: '☀️' },
];
let stickersP = null;
const loadStickers = () => {
  if (!stickersP) {
    stickersP = fetch('../compose/data/stickers.json').then((r) => (r.ok ? r.json() : null)).then((j) => {
      const list = ((j && j.objects) || []).filter((o) => typeof o.src === 'string' && /^assets\/stickers\/[\w-]+\.svg$/.test(o.src)).slice(0, 8).map((o) => ({ id: o.id, name: String(o.name || o.id).replace(/^the /, ''), src: '../compose/' + o.src }));
      return list.length ? list : null;
    }).catch(() => null).then((x) => x || FALLBACK_STICKERS);
  }
  return stickersP;
};
const stickerKey = () => 'sb.stickers:' + (S.currentPlayer() || '');
function readStickers() { try { const v = JSON.parse(localStorage.getItem(stickerKey()) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
function saveSticker(noteId, id) { try { const v = readStickers(); v[noteId] = id; const keys = Object.keys(v); if (keys.length > 80) delete v[keys[0]]; localStorage.setItem(stickerKey(), JSON.stringify(v)); } catch (e) { /* a sticker is a convenience */ } }
const stickerHtml = (st, cls = '') => '<span class="b6-sticker ' + cls + '" role="img" aria-label="' + esc(st.name) + ' sticker">' + (st.src ? '<img src="' + esc(st.src) + '" alt="" width="40" height="40">' : esc(st.emoji)) + '</span>';

// ---- small pieces of markup ------------------------------------------------------------------------------------------------
const stripHtml = ({ index, of, steps, now }) => {
  const dots = index && of ? '<div class="s6-dots" role="img" aria-label="Sentence ' + index + ' of ' + of + '">' + Array.from({ length: of }, (_, i) => '<i class="' + (i + 1 < index ? 'is-done' : i + 1 === index ? 'is-now' : '') + '"></i>').join('') + '<span>Sentence ' + index + ' of ' + of + '</span></div>' : '<span></span>';
  const bars = steps > 1 ? '<div class="s6-steps" role="img" aria-label="Your steps for this word">' + Array.from({ length: steps }, (_, i) => '<i class="b6-h' + Math.min(i + 1, 4) + (i < now ? ' is-done' : i === now ? ' is-now' : '') + '"></i>').join('') + '</div>' : '';
  return dots === '<span></span>' && !bars ? '' : '<div class="s6-strip0">' + dots + bars + '</div>';
};
const lineHtml = (text) => '<div class="s6-line" data-linewrap><p data-instruction role="status">' + esc(text) + '</p>' + hearBtn('Hear the instruction', 'data-instruct') + '</div>';
const nextHtml = (label = 'Next', off = true) => '<button type="button" class="btn btn--primary s6-check" data-next data-fold="next"' + (off ? ' disabled' : '') + '>' + ICO.tick + esc(label) + '</button>';
const peekHtml = (label = 'Peek') => '<button type="button" class="btn btn--ghost s6-peek" data-peekbtn data-fold="peek">' + ICO.eye + esc(label) + '</button>';
const cardBtn = (t, extra = '') => '<button type="button" class="s6-cardbtn' + extra + '" data-card="' + esc(t) + '"><b>' + esc(t) + '</b></button>';

/** The line in the head: text, and 'ok' (a tick) or 'soft' (a still, kind line). */
function setLine(root, text, kind = '') {
  const w = root.querySelector('[data-linewrap]');
  const p = root.querySelector('[data-instruction]');
  if (!w || !p) return;
  p.textContent = text;
  w.classList.toggle('is-ok', kind === 'ok');
  w.classList.toggle('is-soft', kind === 'soft');
}

/** The Peek (peek.js, the one component): shows `show()` for `ms`, then `hide()`; a still outline after 10 s of nothing (nudge). Returns { stop, peeks }. */
function peekControl(root, { ms, show, hide, onPeek }) {
  const ctl = mountPeek(root, { ms, show, hide, onPeek, nudgeMs: RULES.peek.nudgeMs });
  return { peeks: () => ctl.peeks(), stop() { ctl.destroy(); } };
}

// ---- the builder -----------------------------------------------------------------------------------------------------------
/**
 * Draws the levels, one per screen. Options:
 *   g, word          the week and its word (g is needed to save and for the week's other words)
 *   levels           [1, 2, 3, 4] by SD.levelsFor(year, way); a level that cannot be made is left out (at least one remains)
 *   onDone(note)     called once: the saved note { id, g, w, x, d, bl?, hp?, at } (save: true), or { text, bl, hp, typed } (save: false); null when no sentence was made
 *   save             true (default): the sentence is saved as the word's Story day sentence (W.addNote with bl and hp) and "My sentences" is shown.
 *                    false: the Usual way's "Help me build it" (BR-34): nothing is saved here; the caller fills its box with note.text
 *   way, year        'sbs' | 'usual' and the child's school year (default from the setup and the account)
 *   index, of        "Sentence 2 of 3" (Story day)
 *   ss               the sitting's id for the level 2 try (optional)
 *   statements       extra sentences already fetched from the account for this word (optional)
 *   info             the grown-up's own sentence for an own word: a string or { s } (optional)
 *   pictureUrl(word) an approved picture's URL for an own word, or '' (optional)
 * Returns a cleanup. Records nothing until a level is finished.
 */
export function buildSentence(main, opts = {}) {
  const word = opts.word;
  let dead = false;
  const undo = [];
  const leave = () => { if (main) main.classList.remove('b6-main'); if (sbsOwn) document.body.classList.remove('is-sbs'); };
  let sbsOwn = false;
  const cleanup = () => { dead = true; leave(); undo.splice(0).forEach((f) => { try { f(); } catch (e) { /* ignore */ } }); stop(); };
  if (!word || !main) { if (opts.onDone) opts.onDone(null); return cleanup; }
  main.classList.add('b6-main');  sbsOwn = !document.body.classList.contains('is-sbs'); if (sbsOwn) document.body.classList.add('is-sbs');
  main.innerHTML = '<section class="s6 b6" data-builder><p class="s6-hint">Just a moment</p></section>';
  (async () => {
    const [bank, stmts] = await Promise.all([loadBank(), loadStatements()]);
    if (dead) return;
    run(bank, stmts);
  })();

  function run(bank, stmts) {
    const entry = shown(entryFor(word));
    const setup = S.readSetup();
    const way = opts.way || Su.wayOf(setup);
    const year = opts.year != null ? opts.year : childYear();
    const d0 = S.readWords();
    const hidden = St.hiddenWords(d0, today());
    const weekWords = opts.g ? W.rows(opts.g) : [word];
    const ctx = { bank, statements: [...(opts.statements || []), ...(stmts[lc(word)] || [])], info: opts.info, hidden, year };
    const levels = SD.usableLevels(opts.levels || SD.levelsFor(year, way), entry, ctx);
    const required = levels.filter((l) => !SD.OPTIONAL_LEVELS.includes(l));
    const seed = Number(String(opts.seed != null ? opts.seed : Math.abs([...word].reduce((a, c) => a * 31 + c.charCodeAt(0), 7))).slice(0, 8)) || 0;
    const models = SD.modelsFor(entry, ctx);
    const tray48 = year >= 3 || !year ? 't48' : 't56';
    let li = 0;
    let result = null; // { text, bl, hp?, typed? }: the child's latest finished sentence
    let helped = false;
    const picUrl = opts.pictureUrl ? opts.pictureUrl(word) : '';
    const picHtml = () => '<span class="s6-pic b6-pic" role="img" aria-label="' + esc(word) + ' picture">' + (picUrl ? '<img src="' + esc(picUrl) + '" alt="" width="104" height="104">' : picture(entry, { alt: false })) + '</span>';
    const strip = (lv) => stripHtml({ index: opts.index, of: opts.of, steps: way === 'usual' ? 0 : required.length, now: SD.OPTIONAL_LEVELS.includes(lv) ? required.length : Math.max(0, required.indexOf(lv)) });
    const mount = (cls, html) => {
      undo.splice(0).forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
      stop();
      main.innerHTML = '<section class="s6 b6 ' + cls + '" data-builder aria-label="Make a sentence">' + html + '</section>';
      window.scrollTo(0, 0);
      const root = main.querySelector('[data-builder]');
      const ins = root.querySelector('[data-instruct]');
      if (ins) ins.addEventListener('click', () => { const p = root.querySelector('[data-instruction]'); if (p) sayLine(p.textContent); });
      return root;
    };
    const next = () => { li += 1; if (li < levels.length) show(levels[li]); else finish(); };
    function show(lv) {
      if (dead) return;
      if (lv === 1) level1();
      else if (lv === 2) level2();
      else if (lv === 3) level3();
      else level4();
    }

    /* ---------- level 1: choose the cards (S1, S2) ---------- */
    function level1() {
      const frame = SD.frameFor(entry, bank, seed, { year });
      if (!frame) { next(); return; }
      const picks = {};
      const slots = frame.parts.filter((p) => p.slot).map((p) => p.slot);
      const slotOf = (p) => (p.slot === 'w' ? entry.word : picks[p.slot]);
      const root = mount('b6-l1', strip(1) + '<div class="s6-head">' + picHtml() + lineHtml('Pick a card for the gap.') + '</div>'
        + '<div class="s6-sentcard"><p class="s6-sentence" data-sentence></p>' + hearBtn('Hear the sentence', 'data-hearsent') + '</div>'
        + '<div class="s6-cards" data-cards></div><div class="s6-pills" data-pills></div><div class="s6-foot">' + nextHtml('Next', true) + '</div>');
      const cur = () => slots.find((sl) => (sl === 'w' ? !('w' in picks) : !(sl in picks)));
      const spoken = () => SD.sentenceOf({ parts: frame.parts }, picks).replace(/\.\.\./g, 'blank');
      function draw(announce) {
        const now = cur();
        const html = frame.parts.map((p, i) => {
          if (p.text !== undefined) return esc(p.text);
          const filled = p.slot === 'w' ? ('w' in picks) : (p.slot in picks);
          const t = filled ? slotOf(p) : '';
          const first = i === 0 && filled ? capital(t) : t;
          if (filled) return '<button type="button" class="gap is-filled" data-gap="' + p.slot + '" aria-label="' + esc(t) + ', tap to change">' + esc(first) + '</button>';
          return '<span class="gap' + (p.slot === now ? ' is-on' : '') + '" role="img" aria-label="blank"></span>';
        }).join('');
        root.querySelector('[data-sentence]').innerHTML = html;
        const cards = root.querySelector('[data-cards]');
        const pills = root.querySelector('[data-pills]');
        const nx = root.querySelector('[data-next]');
        if (now) {
          const part = frame.parts.find((p) => p.slot === now);
          cards.innerHTML = part.cards.map((c) => cardBtn(c)).join('');
          cards.hidden = false; pills.innerHTML = ''; nx.disabled = true;
          setLine(root, 'Pick a card for the gap.');
        } else {
          cards.hidden = true; cards.innerHTML = '';
          pills.innerHTML = '<span class="s6-pill">Silly is fine.</span>';
          nx.disabled = false;
          setLine(root, 'Hear your sentence.', 'ok');
          if (announce) sayLine(SD.sentenceOf(frame, picks));
        }
        cards.querySelectorAll('[data-card]').forEach((b) => b.addEventListener('click', () => {
          const sl = cur();
          picks[sl] = b.dataset.card;
          draw(true);
        }));
        root.querySelectorAll('[data-gap]').forEach((b) => b.addEventListener('click', () => {
          // take this pick and every later one back: the child may change their mind
          const at = slots.indexOf(b.dataset.gap);
          for (const sl of slots.slice(at)) delete picks[sl];
          draw(false);
        }));
      }
      draw(false);
      root.querySelector('[data-hearsent]').addEventListener('click', () => sayLine(spoken()));
      root.querySelector('[data-next]').addEventListener('click', () => {
        result = { text: SD.sentenceOf(frame, picks), bl: 1 };
        helped = false;
        next();
      });
    }

    /* ---------- level 2: find the missing word (S3) ---------- */
    function level2() {
      const model = SD.modelFor(entry, ctx, 0);
      const gap = model && SD.missingWord(model, entry.word);
      const code = middleCode(entry);
      const spec = gap && traySpec(entry, code, { day: today(), usual: [], lexicon: D.lexicon(), input: 'tiles' });
      if (!spec) { next(); return; }
      const trayMarkup = Tr.trayHtml(spec).replace('keyboard keyboard--tray', 'keyboard keyboard--tray ' + tray48);
      const root = mount('prac b6-l2', '<div class="s6-upper">' + strip(2) + '<div class="s6-head">' + lineHtml('Spell the missing word.') + '</div>'
        + '<div class="s6-stage">' + picHtml() + '</div>'
        + '<div class="s6-sentcard"><p class="s6-sentence" data-sentence>' + esc(gap.before) + '<span class="gap is-on" data-gapword role="img" aria-label="blank"></span>' + esc(gap.after) + '</p>' + hearBtn('Hear the sentence', 'data-hearsent') + '</div></div>'
        + '<div class="s6-block"><div class="s6-peekrow">' + peekHtml() + '<button type="button" class="btn btn--ghost s6-undo" data-undo>' + ICO.undo + 'Undo</button></div><div class="s6-boxline"><div class="s6-boxes" data-boxwrap>' + Tr.boxesHtml(spec, { tricky: entry.tricky }) + '</div>' + hearBtn('Hear ' + word, 'data-hearword') + '</div>'
        + '<div class="traycol" data-traycol>' + trayMarkup + '</div>' + nextHtml('Check', true) + '</div>');
      let done = false;
      const ctrl = Tr.mountTray(root, spec, { mode: 'practice', glowAfter: spec.glowAfter, onChange: (s) => { const b = root.querySelector('[data-next]'); if (b && !done) b.disabled = !s.full; } });
      undo.push(() => ctrl.destroy());
      // D31: a hardware keyboard works the tiles like a tap; removed when the step goes
      const keyMount = mountTileKeys({
        onLetter: (ch) => { if (!done) ctrl.key(ch); },
        onBack: () => { if (!done) ctrl.back(); },
        onCheck: () => { if (!done) pressCheck(root, '[data-next]'); },
      });
      undo.push(() => keyMount.destroy());
      let busy = false;
      const rule = peekRule('builder', { way });
      const peek = peekControl(root, {
        ms: peekMs(setup, { way, input: 'tiles' }),
        show: () => root.querySelectorAll('.lgap[data-gap]').forEach((g) => { if (!g.classList.contains('is-filled')) { g.classList.add('is-peeked'); g.dataset.ch = spec.letters[Number(g.dataset.gap)].ch; } }),
        hide: () => root.querySelectorAll('.lgap.is-peeked').forEach((g) => { g.classList.remove('is-peeked'); delete g.dataset.ch; }),
      });
      if (rule.allowed === 0) root.querySelector('[data-peekbtn]').hidden = true;
      undo.push(() => peek.stop());
      root.querySelector('[data-undo]').addEventListener('click', () => ctrl.back());
      root.querySelector('[data-hearsent]').addEventListener('click', () => sayLine(gap.before + ' blank ' + gap.after));
      root.querySelector('[data-hearword]').addEventListener('click', () => speak(word));
      const nx = root.querySelector('[data-next]');
      nx.addEventListener('click', () => {
        if (done) { next(); return; }
        if (busy) return;
        busy = true; setTimeout(() => { busy = false; }, RULES.ui.debounceMs);
        const r = ctrl.check();
        if (!r) return;
        if (r.right) {
          done = true;
          const slips = r.tries;
          S.updateWords((d) => W.addTry(d, {
            id: S.newId(), word, day: today(), group: opts.g && opts.g.id, kind: opts.g ? W.kindOn(d, opts.g, word, today()) : 'p', tries: slips, peeks: peek.peeks(), clean: slips === 0 && peek.peeks() === 0,
            source: 'g', now: Date.now(), lv: code >= CODE.ALL ? 4 : 3, h: r.helped ? 1 : 0, r: code, j: 'b', ss: opts.ss, sl: Object.keys(r.misses || {}).map(Number),
          }));
          const gw = root.querySelector('[data-gapword]');
          gw.className = 'gap is-filled'; gw.textContent = word; gw.removeAttribute('role'); gw.removeAttribute('aria-label');
          setLine(root, 'You spelled it!', 'ok');
          nx.innerHTML = ICO.tick + 'Next';
          nx.disabled = false;
          sayLine(gap.before + word + gap.after);
        } else if (r.line) setLine(root, r.line, 'soft');
      });
      // the same line style the tray uses for a nudge
      root.addEventListener('click', (e) => { if (e.target.closest('.ltile') && !done) setLine(root, 'Spell the missing word.'); });
    }

    /* ---------- level 3: put it in order (S4, S5a, S5b, S10) ---------- */
    function level3() {
      const list = models.filter((m) => !!SD.orderCards(m));
      const model = list.length > 1 && list[0] === models[0] ? list[1] : list[0]; // another sentence than level 2's when there is one
      const oc = model && SD.orderCards(model);
      if (!oc) { next(); return; }
      const cards = oc.cards;
      const bankOrder = SD.shuffleCards(cards, seed);
      let placed = [];
      let outlined = '';
      let usedHelp = false;
      const root = mount('b6-l3', strip(3) + '<div class="s6-head">' + picHtml() + lineHtml('Tap the words in order.') + '</div>'
        + '<div class="s6-sentcard b6-slotcard"><div class="s6-slots" data-slots></div></div><div class="b6-bank" data-bank></div>'
        + '<div class="b6-hints"><button type="button" class="btn btn--ghost" data-hearit data-fold="hear">' + ICO.hear + 'Hear it</button><button type="button" class="btn btn--ghost" data-which>Which first?</button><button type="button" class="btn btn--ghost" data-show>Show me</button></div>'
        + '<div class="s6-foot">' + nextHtml('Check', true) + '</div>');
      let done = false;
      const spokenNow = () => oc.answer.map((id) => cards.find((c) => c.id === id).text).join(' ') + oc.end;
      function draw() {
        const slots = root.querySelector('[data-slots]');
        slots.innerHTML = cards.map((c, i) => {
          const id = placed[i];
          const mark = i === 0 ? '<small>Aa</small>' : i === cards.length - 1 ? '<small>End ' + esc(oc.end) + '</small>' : '';
          const txt = id ? esc(cards.find((x) => x.id === id).text) : '&nbsp;';
          return '<button type="button" class="s6-slot' + (id ? ' is-filled' : i === placed.length ? ' is-next' : '') + (done ? ' is-right' : '') + '" data-slot="' + i + '"' + (id ? '' : ' aria-label="empty, place ' + (i + 1) + '"') + (done ? ' disabled' : '') + '>' + mark + txt + '</button>';
        }).join('');
        const bank = root.querySelector('[data-bank]');
        bank.innerHTML = bankOrder.filter((c) => !placed.includes(c.id)).map((c) => '<button type="button" class="s6-cardbtn' + (outlined === c.id ? ' is-outline' : '') + '" data-pick="' + c.id + '"' + (done ? ' disabled' : '') + '><b>' + esc(c.text) + '</b></button>').join('');
        bank.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => { placed.push(b.dataset.pick); outlined = ''; draw(); setLine(root, 'Tap the words in order.'); }));
        slots.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => {
          const i = Number(b.dataset.slot);
          if (i < placed.length) { placed = placed.filter((_, k) => k !== i); outlined = ''; draw(); }
        }));
        const nx = root.querySelector('[data-next]');
        nx.disabled = !done && placed.length < cards.length;
        root.querySelectorAll('[data-which], [data-show]').forEach((b) => { b.disabled = done; });
      }
      draw();
      root.querySelector('[data-hearit]').addEventListener('click', () => sayLine(spokenNow()));
      root.querySelector('[data-which]').addEventListener('click', () => {
        placed = placed.slice(0, SD.rightPrefix(cards, oc.answer, placed));
        outlined = SD.nextCard(cards, oc.answer, placed) || '';
        draw();
        setLine(root, 'This card goes next.', 'soft');
      });
      root.querySelector('[data-show]').addEventListener('click', () => {
        placed = placed.slice(0, SD.rightPrefix(cards, oc.answer, placed));
        const id = SD.nextCard(cards, oc.answer, placed);
        if (!id) return;
        placed.push(id); outlined = ''; usedHelp = true; draw();
        setLine(root, 'I put one in for you.', 'soft');
      });
      const nx = root.querySelector('[data-next]');
      let busy = false;
      nx.addEventListener('click', () => {
        if (done) { next(); return; }
        if (busy) return;
        busy = true; setTimeout(() => { busy = false; }, RULES.ui.debounceMs);
        if (SD.orderRight(cards, oc.answer, placed)) {
          done = true;
          result = { text: model, bl: 3, ...(usedHelp ? { hp: 1 } : {}) };
          helped = usedHelp;
          draw();
          setLine(root, 'Hear your sentence.', 'ok');
          nx.innerHTML = ICO.tick + 'Next';
          nx.disabled = false;
          sayLine(model);
        } else {
          placed = placed.slice(0, SD.rightPrefix(cards, oc.answer, placed));
          draw();
          setLine(root, SD.LINES.order, 'soft');
        }
      });
    }

    /* ---------- level 4: make your own (S6, S7, S8, with the keyboard open S6k, S7k) ---------- */
    async function level4() {
      const known = await loadKnown(bank);
      if (dead) return;
      const frame = SD.frameFor(entry, bank, seed, { year });
      // the frame's first words as a start, up to the first card slot that is not the week's word
      let start = '';
      if (frame) {
        for (const p of frame.parts) { if (p.slot && p.slot !== 'w') break; start += p.text !== undefined ? p.text : p.cards[0]; }
        start = capital(start.replace(/\s+/g, ' ').trim());
        if (!lc(start).includes(lc(word)) || start.split(' ').length > 6) start = '';
      }
      const chips = [...new Set([word, ...(frame ? frame.parts.filter((p) => p.slot && p.slot !== 'w').flatMap((p) => p.cards) : []), ...weekWords.filter((w) => lc(w) !== lc(word)).slice(0, 3), 'and', 'was', 'very', 'the', 'a'])].slice(0, 12);
      const canSkip = result !== null || levels.length > 1;
      const root = mount('b6-l4 kb', strip(4).replace('s6-strip0', 's6-strip0 b6-hide-typing') + '<div class="s6-head b6-hide-typing">' + picHtml() + lineHtml('Finish the sentence.') + '</div>'
        + '<div class="b6-lineonly" hidden>' + lineHtml('Finish the sentence.').replace('data-linewrap', 'data-linewrap2') + '</div>'
        + '<textarea class="b6-textin" data-own rows="2" maxlength="' + SD.MAX_OWN_CHARS + '" aria-label="Your sentence" autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false" enterkeyhint="done"></textarea>'
        + '<p class="s6-hint b6-hide-typing" data-bankhint>Tap words, or type.</p><div class="b6-bank b6-hide-typing" data-chips>' + chips.map((c) => '<button type="button" class="s6-cardbtn" data-chip="' + esc(c) + '"><b>' + esc(c) + '</b></button>').join('') + '</div>'
        + '<p class="b6-peekword" data-peekword aria-live="polite"></p>'
        + '<div class="s6-foot s6-foot--own b6-own">' + peekHtml() + nextHtml('Save it', true).replace('s6-check', 's6-check b6-save') + (canSkip ? '<button type="button" class="btn btn--ghost b6-hide-typing" data-skip>Not now</button>' : '') + '</div>');
      const ta = root.querySelector('[data-own]');
      const save = root.querySelector('[data-next]');
      let soft = false;
      ta.value = start ? start + ' ' : '';
      const sync = () => { save.disabled = !ta.value.trim() || soft; };
      const note = (text, kind) => { soft = kind === 'soft'; ta.classList.toggle('is-soft', soft); setLine(root, text, kind); sync(); };
      ta.addEventListener('input', () => { root.classList.add('is-typing'); if (soft) note('Finish the sentence.', ''); else sync(); });
      ta.addEventListener('focus', () => root.classList.add('is-typing'));
      ta.addEventListener('blur', () => root.classList.remove('is-typing'));
      root.querySelectorAll('[data-chip]').forEach((b) => b.addEventListener('click', () => {
        const t = b.dataset.chip;
        const v = ta.value.replace(/\s+$/, '');
        ta.value = (v ? v + ' ' : '') + (v ? t : capital(t)) + ' ';
        if (soft) note('Finish the sentence.', ''); else sync();
      }));
      const peekShow = root.querySelector('[data-peekword]');
      const peek = peekControl(root, { ms: peekMs(setup, { way, input: 'keys' }), show: () => { peekShow.textContent = word; }, hide: () => { peekShow.textContent = ''; } });
      undo.push(() => peek.stop());
      sync();
      save.addEventListener('click', () => {
        const text = ta.value.replace(/\s+/g, ' ').trim();
        const problem = SD.checkOwn(text, word, { isKnown: known, extra: weekWords });
        if (problem) { note(problem, 'soft'); return; }
        result = { text: /[.!?]$/.test(text) ? capital(text) : capital(text) + '.', bl: 4, typed: true };
        helped = false;
        next();
      });
      const skip = root.querySelector('[data-skip]');
      if (skip) skip.addEventListener('click', () => next());
    }

    /* ---------- the end: save the sentence, "My sentences" (S9) ---------- */
    function finish() {
      if (dead) return;
      if (!result) { leave(); if (opts.onDone) opts.onDone(null); return; }
      const text = result.text;
      if (opts.save === false) { leave(); if (opts.onDone) opts.onDone({ text, bl: result.bl, hp: result.hp ? 1 : 0, typed: !!result.typed }); return; }
      const id = S.newId();
      const day = today();
      const now = Date.now();
      S.updateWords((d) => W.addNote(d, { id, group: opts.g && opts.g.id, word, text, day, now, bl: result.bl, hp: result.hp }));
      const note = { id, g: opts.g && opts.g.id, w: word, x: text.slice(0, W.MAX_NOTE), d: day, ...(result.bl ? { bl: result.bl } : {}), ...(result.hp ? { hp: 1 } : {}), at: now };
      mySentencesPage(main, { g: opts.g, newest: note, onDone: () => { leave(); if (opts.onDone) opts.onDone(note); }, setDead: () => dead });
    }

    show(levels[0]);
  }
  return cleanup;
}

/** The Usual way's quiet "Help me build it" (BR-34): levels 1 and 3, nothing saved here; onDone({ text, bl, hp, typed }) fills the Story day box. */
export function helpMeBuild(main, opts = {}) {
  return buildSentence(main, { ...opts, levels: SD.levelsFor(0, 'usual'), way: 'usual', save: false });
}

// ---- My sentences: the week's sentences with a sticker, S9 ----------------------------------------------------------------------
function mySentencesPage(main, { g, newest, onDone, setDead = () => false } = {}) {
  const d = S.readWords();
  const notes = (g ? W.notesFor(d, g) : [newest]).filter(Boolean).slice(-6);
  main.innerHTML = '<section class="s6 b6 b6-l9" data-builder aria-label="My sentences"><h1 class="s6-h1">My sentences</h1><div class="s6-cards" data-sents>'
    + notes.map((n) => '<div class="b6-sent" data-note="' + esc(n.id) + '"><span class="b6-stickslot" data-stick></span><p>' + esc(n.x) + '</p>' + hearBtn('Hear the sentence', 'data-hear-note="' + esc(n.id) + '"') + '</div>').join('')
    + '</div><div class="s6-card b6-stickers" data-stickers><h2>Pick a sticker</h2><div class="b6-bank" data-sticklist></div></div>'
    + '<div class="s6-foot"><button type="button" class="btn btn--primary s6-check" data-next data-fold="next">' + ICO.arrow + 'Next</button></div></section>';
  window.scrollTo(0, 0);
  const root = main.querySelector('[data-builder]');
  const textOf = (id) => (notes.find((n) => n.id === id) || {}).x || '';
  root.querySelectorAll('[data-hear-note]').forEach((b) => b.addEventListener('click', () => sayLine(textOf(b.dataset.hearNote)))); // the device's voice only: it may hold the child's own words
  loadStickers().then((list) => {
    if (setDead() || !root.isConnected) return;
    const paint = () => {
      const m = readStickers();
      root.querySelectorAll('[data-note]').forEach((el) => {
        const st = list.find((s) => s.id === m[el.dataset.note]);
        el.querySelector('[data-stick]').innerHTML = st ? stickerHtml(st) : '';
      });
    };
    root.querySelector('[data-sticklist]').innerHTML = list.map((s) => '<button type="button" class="b6-stickbtn" data-sid="' + esc(s.id) + '" aria-label="' + esc(s.name) + ' sticker">' + stickerHtml(s).replace(/ role="img" aria-label="[^"]*"/, '') + '</button>').join('');
    root.querySelectorAll('[data-sid]').forEach((b) => b.addEventListener('click', () => { if (newest) { saveSticker(newest.id, b.dataset.sid); paint(); } }));
    paint();
  });
  if (newest) { sayLine(newest.x); }
  root.querySelector('[data-next]').addEventListener('click', () => { stop(); onDone(); });
}

/** The week's sentences with their stickers, on their own (for a page that wants only the strip). Returns a cleanup. */
export function mySentences(main, { g, onDone } = {}) {
  let dead = false;
  main.classList.add('b6-main');
  const own = !document.body.classList.contains('is-sbs'); if (own) document.body.classList.add('is-sbs');
  const leave = () => { main.classList.remove('b6-main'); if (own) document.body.classList.remove('is-sbs'); };
  mySentencesPage(main, { g, newest: null, onDone: () => { leave(); if (onDone) onDone(); }, setDead: () => dead });
  return () => { dead = true; leave(); stop(); };
}
