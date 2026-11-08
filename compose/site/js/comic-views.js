// Comic Studio (C2-1): a picture story made into a comic, one small step a screen,
// with the comic strip always on show and filling up. Taps first: every move can
// be done with taps alone at Year 3; typing comes in at Year 4 (one word a panel)
// and Year 5-6 (sentences). Every tile, line and instruction can be heard.
//   #/c/<task>            the start: the level, and Start or Carry on
//   #/c/<task>/go         the next move, whatever it is (comic-doc.js nextMove)
//   #/c/<task>/challenge  "Write it yourself", optional, for bonus stars
//   #/comics              My comics (the shelf), and older stories read-only
//   #/comics/<id>         a finished comic: cover, panels, print
import * as S from './store.js';
import * as W from './writing-doc.js';
import * as K from './comic-doc.js';
import * as C from './checks.js';
import { taskById, comicVisible, ownVisible, comicShared } from './tasks.js';
import { speakLine, speakLines, stop } from './speech.js';
import { loadRealWords, loadKnownWords } from './wordcheck.js';
import { checkTyped, typedNote, wordsOf } from './safe-text.js';
import { kind, playerName } from './who.js';
import { burstHtml, placeBursts } from './celebrate.js';
import { esc, ICON, toast } from './ui.js';
import * as R from './comic-render.js';

const MOVES = [['order', 'Order'], ['wheel', 'Wheel'], ['panel', 'Panels'], ['join', 'Join'], ['read', 'Read']];
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const pendingLevel = new Map();
let justFinished = '';

// ---- shared bits (My own story uses them too) ---------------------------------------------------------
export const instruct = (text, icon = 'play') => '<p class="instruct" data-focus tabindex="-1">' + (R.ICONS[icon] || '') + '<span>' + esc(text) + '</span>' + R.hearBtn(text, 'Hear the instructions') + '</p>';
export function wireHear(root) {
  root.querySelectorAll('[data-hear]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); speakLine(b.dataset.hear); }));
}
/** A kind word when a tile doesn't fit: no red, no cross. */
export function gentle(root, msg, tile = null) {
  const el = root.querySelector('[data-gentle]');
  if (el) { el.textContent = ''; el.textContent = msg; }
  if (tile && !reduced()) { tile.classList.remove('is-nope'); void tile.offsetWidth; tile.classList.add('is-nope'); }
  if (tile) tile.classList.add('is-tried');
}
export const gentleSlot = () => '<p class="gentle" data-gentle role="status" aria-live="polite"></p>';
export function focusStep(main) {
  const f = main.querySelector('[data-focus]');
  if (f) f.focus({ preventScroll: true });
}
export const tileBtn = (text, attrs, { hear = true, cls = '' } = {}) => '<span class="tilewrap"><button type="button" class="ctile ' + cls + '" ' + attrs + '>' + esc(text) + '</button>' + (hear ? R.hearBtn(text) : '') + '</span>';
/** Well done: the stars for the move just made, and one button on. */
export function wellDone(box, { title, stars = 0, line = '', next = 'Next' }, onNext) {
  box.innerHTML = '<div class="card welldone" data-welldone><h2 data-focus tabindex="-1">' + esc(title) + '</h2>' + (stars ? R.starsHtml(stars) : '') + (line ? '<p>' + esc(line) + '</p>' : '')
    + '<div class="btnrow btnrow--center"><button type="button" class="btn btn--primary" data-next>' + esc(next) + ICON.arrow + '</button></div></div>';
  box.querySelector('[data-next]').addEventListener('click', onNext);
  box.querySelector('[data-focus]').focus({ preventScroll: true });
  if (stars === 3) speakLine('Three stars!');
}
/** The words a comic may use besides our lists: the task's names and its own tiles. */
export const comicWords = (t) => [...C.taskWords(t), ...wordsOf(JSON.stringify(t.comic))];

function comicTask(id) {
  const t = taskById(id);
  if (t && comicVisible(t, kind())) return t;
  location.replace('#/');
  return null;
}
const levelLine = (n) => ({ 3: 'Year 3: you build every sentence with word tiles.', 4: 'Year 4: word tiles, and you type one describing word in each panel.', 5: 'Year 5: choose how each part starts, then type the sentence.', 6: 'Year 6: choose how each part starts, then type the sentence.' }[n]);
const levelHtml = (n) => '<div class="card levelcard" data-level="' + n + '"><p><b>Level: Year ' + n + '</b><br><span class="muted small">' + esc(levelLine(n)) + '</span></p><div class="btnrow">'
  + '<button type="button" class="btn btn--ghost btn--small" data-easier' + (n <= 3 ? ' disabled' : '') + '>' + R.ICONS.minus + 'Make it easier</button>'
  + '<button type="button" class="btn btn--ghost btn--small" data-harder' + (n >= 6 ? ' disabled' : '') + '>' + R.ICONS.plus + 'Make it harder</button></div></div>';
export function wireLevel(main, get, set) {
  const e = main.querySelector('[data-easier]');
  const h = main.querySelector('[data-harder]');
  if (e) e.addEventListener('click', () => { set(K.easier(get())); });
  if (h) h.addEventListener('click', () => { set(K.harder(get())); });
}

/* ------------------------------------------------------------------- the start --- */
export function studio(main, { id }) {
  const t = comicTask(id);
  if (!t) return undefined;
  const d = S.readComics();
  const c = K.openComic(d, t.id);
  const level = c ? c.level : pendingLevel.get(t.id) || t.level;
  const draft = W.openPiece(S.readWriting(), t.id);
  const made = K.finished(d).find((x) => x.task === t.id);
  main.innerHTML = '<section class="wrap page studio"><div class="pagehead"><span class="eyebrow">Comic Studio · Year ' + t.level + '</span><h1>' + esc(t.title) + '</h1></div>'
    + '<div class="studio__top"><div class="cover cover--blank"><div class="cover__words"><span class="cover__kicker">A comic in four pictures</span><h2 class="cover__title">' + esc(t.title) + '</h2>' + (playerName() ? '<p class="cover__by">by ' + esc(playerName()) + '</p>' : '') + '</div></div>'
    + '<div class="stack">' + instruct('Put four pictures in order, then build your comic one panel at a time.', 'book')
    + '<p class="muted small">' + esc(t.background) + ' ' + R.hearBtn(t.background, 'Hear the story start') + '</p>' + levelHtml(level)
    + (draft && W.textOf(draft.parts) ? '<div class="card setting" data-olddraft><p class="small">You started writing this story before. It is kept safe: it will be in the <b>Write it yourself</b> box at the end.</p><a class="btn btn--quiet btn--small" href="#/t/' + esc(t.id) + '/write">Carry on the old way</a></div>' : '')
    + '<div class="btnrow"><button type="button" class="btn btn--primary btn--big" data-start>' + (c ? 'Carry on my comic' : 'Start my comic') + ICON.arrow + '</button></div>'
    + (made ? '<p><a href="#/comics/' + esc(made.id) + '">See the comic I made before</a></p>' : '') + '</div></div></section>';
  wireHear(main);
  wireLevel(main, () => level, (n) => {
    if (c) S.updateComics((x) => K.setLevel(x, c.id, n, Date.now())); else pendingLevel.set(t.id, n);
    studio(main, { id });
  });
  main.querySelector('[data-start]').addEventListener('click', () => {
    if (!K.openComic(S.readComics(), t.id)) S.updateComics((x) => K.startComic(x, t, { id: S.newId(), now: Date.now(), level, draft }));
    location.hash = '#/c/' + t.id + '/go';
  });
  return stop;
}

/* --------------------------------------------------------------- the moves --- */
function frame(main, t, c, { move, title, panel = -1 }) {
  const at = MOVES.findIndex(([m]) => m === move);
  main.innerHTML = '<section class="wrap page studio" data-move="' + move + '"><div class="pagehead"><span class="eyebrow">' + esc(t.title) + ' · Year ' + c.level + '</span><h1>' + esc(title) + '</h1></div>'
    + '<ol class="stepbar movebar" aria-label="Moves">' + MOVES.map(([m, label], k) => '<li class="' + (k < at ? 'is-done' : '') + (k === at ? ' is-on' : '') + '"' + (k === at ? ' aria-current="step"' : '') + '>' + label + '</li>').join('') + '</ol>'
    + R.comicHtml(c, t, { cls: 'comic--strip', on: panel, label: 'My comic so far' })
    + '<div class="studio__body" data-body></div></section>';
  return main.querySelector('[data-body]');
}
const save = (fn) => S.updateComics((d) => fn(d, Date.now()));
const fresh = (cid) => S.readComics().comics[cid];

export function go(main, { id }) {
  const t = comicTask(id);
  if (!t) return undefined;
  const c = K.openComic(S.readComics(), t.id);
  if (!c) { location.replace('#/c/' + t.id); return undefined; }
  const next = K.nextMove(c);
  const redraw = () => { stop(); go(main, { id }); focusStep(main); };
  if (next.move === 'order') orderMove(main, t, c, redraw);
  else if (next.move === 'wheel') wheelMove(main, t, c, redraw);
  else if (next.move === 'panel') panelMove(main, t, c, next.panel, redraw);
  else if (next.move === 'join') joinMove(main, t, c, redraw);
  else readMove(main, t, c, redraw);
  return stop;
}

// ---- 1. Order it -----------------------------------------------------------------------------------
function orderMove(main, t, c, redraw) {
  const body = frame(main, t, c, { move: 'order', title: 'Put the pictures in order' });
  const start = K.orderStart(c.id);
  const placed = [null, null, null, null];
  let selected = null;
  let dragged = false;
  const picHtml = (k) => '<img src="' + esc(t.pictures[k].file + '-600.webp') + '" alt="' + esc(t.pictures[k].alt) + '" width="600" height="450" draggable="false">';
  function draw(note = '') {
    const tray = start.filter((k) => !placed.includes(k));
    body.innerHTML = instruct('Tap a picture, then tap the box it goes in. What happens first?', 'book')
      + '<div class="ordertray" aria-label="Pictures to place">' + (tray.length ? tray.map((k) => '<span class="ordercard"><button type="button" class="ordercard__btn" data-card="' + k + '" aria-pressed="' + (selected === k) + '" aria-label="Picture: ' + esc(t.pictures[k].alt) + '">' + picHtml(k) + '</button>' + R.hearBtn(t.pictures[k].alt, 'Hear what is in this picture') + '</span>').join('') : '<p class="muted small">All four are in their boxes.</p>') + '</div>'
      + '<ol class="orderslots">' + placed.map((k, i) => '<li><button type="button" class="orderslot' + (k === null ? '' : ' is-full') + '" data-slot="' + i + '" aria-label="Box ' + (i + 1) + (k === null ? ', empty' : ': ' + esc(t.pictures[k].alt)) + '"><span class="orderslot__n">' + (i + 1) + '</span>' + (k === null ? '' : picHtml(k)) + '</button></li>').join('') + '</ol>'
      + gentleSlot() + '<div class="btnrow"><button type="button" class="btn btn--primary" data-check' + (placed.includes(null) ? ' disabled' : '') + '>Check my order' + ICON.arrow + '</button></div>';
    if (note) body.querySelector('[data-gentle]').textContent = note;
    wireHear(body);
    body.querySelectorAll('[data-card]').forEach((b) => {
      b.addEventListener('click', () => { if (dragged) { dragged = false; return; } const k = Number(b.dataset.card); selected = selected === k ? null : k; draw(); focusOn('[data-card="' + k + '"]'); });
      dragFrom(b, Number(b.dataset.card));
    });
    body.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => placeAt(Number(b.dataset.slot))));
    body.querySelector('[data-check]').addEventListener('click', check);
  }
  const focusOn = (sel) => { const el = body.querySelector(sel); if (el) el.focus(); };
  function placeAt(i, card = selected) {
    if (card === null || card === undefined) {
      if (placed[i] !== null) { placed[i] = null; draw(); focusOn('[data-slot="' + i + '"]'); }
      return;
    }
    const was = placed.indexOf(card);
    if (was >= 0) placed[was] = null;
    placed[i] = card;
    selected = null;
    draw();
    const nextCard = body.querySelector('[data-card]');
    if (nextCard) nextCard.focus(); else focusOn('[data-check]');
  }
  // Drag works too: a press that moves carries the picture; let go over a box.
  function dragFrom(el, card) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const x0 = e.clientX;
      const y0 = e.clientY;
      let ghost = null;
      const move = (ev) => {
        if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) return;
        if (!ghost) {
          ghost = el.querySelector('img').cloneNode();
          ghost.className = 'dragghost';
          ghost.alt = '';
          document.body.append(ghost);
        }
        ghost.style.setProperty('--gx', ev.clientX + 'px');
        ghost.style.setProperty('--gy', ev.clientY + 'px');
      };
      const up = (ev) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (!ghost) return;
        ghost.remove();
        dragged = true;
        setTimeout(() => { dragged = false; }, 0);
        const slot = document.elementFromPoint(ev.clientX, ev.clientY);
        const box = slot && slot.closest('[data-slot]');
        if (box) placeAt(Number(box.dataset.slot), card);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }
  function check() {
    const wrong = K.wrongBoxes(placed);
    if (!wrong.length) {
      save((d, now) => K.change(d, c.id, { order: { tries: c.order.tries, done: true } }, now));
      const n = fresh(c.id);
      frame(main, t, n, { move: 'order', title: 'Put the pictures in order' });
      wellDone(main.querySelector('[data-body]'), { title: 'The pictures are in order!', stars: K.starsOf(n).moves.order, line: 'Next, the story wheel: who, where and when.' }, redraw);
      return;
    }
    c.order.tries += 1;
    save((d, now) => K.change(d, c.id, { order: { tries: c.order.tries, done: false } }, now));
    for (const i of wrong) placed[i] = null;
    const say = 'Nearly! ' + (wrong.length === 1 ? 'One picture wants' : 'Some pictures want') + ' to move. Look again: what happens first?';
    draw(say);
    speakLine(say);
  }
  draw();
}

// ---- 2. Story wheel -------------------------------------------------------------------------------
const WHEEL_Q = { who: 'Who is in the story?', where: 'Where are they?', when: 'When does it happen?' };
function wheelMove(main, t, c, redraw) {
  const body = frame(main, t, c, { move: 'wheel', title: 'Story wheel' });
  const q = K.wheelNext(c);
  const list = t.comic[q];
  const order = K.shuffle(list.map((_, k) => k), c.id + q);
  const tried = new Set();
  const wheel = '<div class="wheel" aria-hidden="true">' + K.WHEEL.map((k) => '<span class="wheel__seg wheel__seg--' + k + (Number.isInteger(c.wheel[k]) ? ' is-set' : '') + (k === q ? ' is-on' : '') + '">' + ({ who: 'Who', where: 'Where', when: 'When' }[k]) + '</span>').join('') + '</div>';
  body.innerHTML = '<div class="wheelrow">' + wheel + '<div class="stack">' + instruct(WHEEL_Q[q] + ' Look at the pictures, then tap.', q === 'who' ? 'people' : q === 'where' ? 'house' : 'clock')
    + '<ul class="wheelchosen">' + K.WHEEL.filter((k) => Number.isInteger(c.wheel[k])).map((k) => '<li><b>' + ({ who: 'Who', where: 'Where', when: 'When' }[k]) + ':</b> ' + esc(t.comic[k][c.wheel[k]].text) + '</li>').join('') + '</ul></div></div>'
    + '<div class="choices">' + order.map((k) => '<span class="tilewrap"><button type="button" class="choice" data-choice="' + k + '">' + (R.ICONS[list[k].icon] || '') + '<span>' + esc(list[k].text.replace(/,$/, '')) + '</span></button>' + R.hearBtn(list[k].text.replace(/,$/, '')) + '</span>').join('') + '</div>' + gentleSlot();
  wireHear(body);
  body.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => {
    const k = Number(b.dataset.choice);
    speakLine(list[k].text.replace(/,$/, ''));
    if (!list[k].fits) {
      if (!tried.has(k)) { tried.add(k); c.wheel.miss += 1; save((d, now) => K.change(d, c.id, { wheel: { ...c.wheel } }, now)); }
      gentle(body, 'Hmm, look at the pictures again. Try another one.', b);
      return;
    }
    save((d, now) => K.change(d, c.id, { wheel: { ...c.wheel, [q]: k } }, now));
    const n = fresh(c.id);
    if (!K.wheelDone(n)) { redraw(); return; }
    const open = K.opening(t, n.wheel);
    frame(main, t, n, { move: 'wheel', title: 'Story wheel', panel: 0 });
    wellDone(main.querySelector('[data-body]'), { title: 'Your comic has its opening!', stars: K.starsOf(n).moves.wheel, line: open }, redraw);
    speakLine(open);
  }));
}

// ---- 3. Panel by panel -----------------------------------------------------------------------------
function panelMove(main, t, c, i, redraw) {
  const spec = t.comic.panels[i];
  const sc = K.scaffold(c.level);
  const p = c.panels[i];
  const step = K.panelStep(p, spec, sc);
  const body = frame(main, t, c, { move: 'panel', title: 'Panel ' + (i + 1) + ' of 4', panel: i });
  const setP = (fields) => save((d, now) => K.changePanel(d, c.id, i, fields, now));
  const miss = () => { p.miss += 1; setP({ miss: p.miss }); };
  const stage = '<div class="stage">' + R.panelHtml(c, t, i, { big: true, on: i }) + '</div>';
  const shared = comicShared();
  const who = spec.feel.who;

  if (step === 'opener') {
    const ops = shared.openers[sc.band][i];
    body.innerHTML = stage + instruct(i === 0 ? 'How does your story start? Tap a starter.' : 'How does this part start? Tap a starter.', 'clock')
      + '<div class="ctiles">' + ops.map((o, k) => tileBtn(o.replace(/,$/, ''), 'data-op="' + k + '"')).join('') + '</div>';
    wireHear(body);
    body.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => { const o = ops[Number(b.dataset.op)]; speakLine(o.replace(/,$/, '')); setP({ op: o, tiles: [] }); redraw(); }));
    return;
  }
  if (step === 'sentence') {
    const k = p.tiles.length;
    const choices = K.tileChoices(spec, k, c.id + ':' + i);
    body.innerHTML = stage + instruct('Build the sentence. Tap the ' + spec.slots[k].replace('?', '').toLowerCase() + ' word.', 'book')
      + '<div class="buildline" aria-label="My sentence"><span class="buildline__op">' + esc(p.op) + '</span>' + spec.slots.map((label, n) => (n < k
        ? '<button type="button" class="ctile ctile--placed" data-undo="' + n + '"' + (n === k - 1 ? '' : ' disabled') + ' aria-label="' + esc(p.tiles[n]) + (n === k - 1 ? ', tap to take it back' : '') + '">' + esc(p.tiles[n]) + '</button>'
        : '<span class="slot' + (n === k ? ' is-next' : '') + '">' + esc(label) + '</span>')).join('') + '</div>'
      + '<div class="ctiles">' + choices.map((w) => tileBtn(w, 'data-tile="' + esc(w) + '"')).join('') + '</div>' + gentleSlot();
    wireHear(body);
    const undo = body.querySelector('[data-undo="' + (k - 1) + '"]');
    if (undo) undo.addEventListener('click', () => { setP({ tiles: p.tiles.slice(0, -1) }); redraw(); });
    body.querySelectorAll('[data-tile]').forEach((b) => b.addEventListener('click', () => {
      const w = b.dataset.tile;
      if (!K.canPlace(spec, p.tiles, w)) { miss(); speakLine('Try another word.'); gentle(body, 'Try another word. Look at the picture.', b); return; }
      speakLine(w);
      setP({ tiles: [...p.tiles, w] });
      redraw();
    }));
    return;
  }
  if (step === 'type') {
    const bank = [...new Set(K.pathsOf(spec).flat())];
    body.innerHTML = stage + instruct('Write the sentence for this picture. Tap a word to add it, or type.', 'book')
      + '<div class="ctiles tiles--bank">' + bank.map((w) => tileBtn(w, 'data-add="' + esc(w) + '"', { cls: 'ctile--small' })).join('') + '</div>'
      + '<label class="sr" for="typed">My sentence</label><textarea id="typed" class="field typed" rows="3" maxlength="' + K.LIMITS.sentence + '" spellcheck="false" autocapitalize="sentences" data-typed>' + esc(p.op + ' ') + '</textarea>'
      + gentleSlot() + '<div class="btnrow"><button type="button" class="btn btn--primary" data-done>Done' + ICON.arrow + '</button>' + R.hearBtn('', 'Hear what I wrote').replace('data-hear=""', 'data-hearbox') + '</div>';
    const box = body.querySelector('[data-typed]');
    wireHear(body);
    body.querySelector('[data-hearbox]').addEventListener('click', () => speakLine(box.value));
    body.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => { speakLine(b.dataset.add); box.value = box.value.replace(/\s*$/, ' ') + b.dataset.add + ' '; box.focus(); }));
    body.querySelector('[data-done]').addEventListener('click', async () => {
      const isKnown = await loadKnownWords();
      const r = checkTyped(box.value, isKnown, { extra: comicWords(t), max: K.LIMITS.sentence, minWords: 3 });
      if (!r.ok) { gentle(body, typedNote(r, { minWords: 3 })); return; }
      setP({ text: box.value.trim() });
      redraw();
    });
    return;
  }
  if (step === 'word') {
    const d = spec.describe;
    body.innerHTML = stage + instruct('Type one describing word for the ' + d.noun + '.', 'idea')
      + '<p class="small muted">Ideas to hear: ' + d.ideas.map((w) => '<button type="button" class="hint" data-hear="' + esc(w) + '">' + ICON.play + esc(w) + '</button>').join(' ') + '</p>'
      + '<label class="sr" for="word">My describing word</label><input id="word" class="field typed typed--word" maxlength="' + K.LIMITS.word + '" autocomplete="off" spellcheck="false" autocapitalize="off" data-word>'
      + gentleSlot() + '<div class="btnrow"><button type="button" class="btn btn--primary" data-done>Add it' + ICON.arrow + '</button><button type="button" class="btn btn--quiet" data-skip>Skip</button></div>';
    wireHear(body);
    const box = body.querySelector('[data-word]');
    const done = async () => {
      const v = box.value.trim().toLowerCase();
      const isKnown = await loadKnownWords();
      const r = checkTyped(v, isKnown, { extra: comicWords(t), max: K.LIMITS.word });
      if (r.ok && wordsOf(v).length !== 1) { gentle(body, 'Just one word, please.'); return; }
      if (!r.ok) { gentle(body, typedNote(r)); return; }
      speakLine(v);
      setP({ word: v });
      redraw();
    };
    body.querySelector('[data-done]').addEventListener('click', done);
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(); } });
    body.querySelector('[data-skip]').addEventListener('click', () => { setP({ word: '' }); redraw(); });
    return;
  }
  if (step === 'feel') {
    const face = p.feel && p.feel.face;
    if (!face) {
      const all = shared.feelings;
      const tried = new Set();
      body.innerHTML = stage + instruct('How does ' + who + ' feel? Look at the picture, then tap a face.', 'person')
        + '<div class="faces">' + all.map((f) => '<button type="button" class="facebtn" data-face="' + f.id + '">' + R.faceSvg(f.id) + '<span>' + R.FEELING_NAMES[f.id] + '</span></button>').join('') + '</div>' + gentleSlot();
      body.querySelectorAll('[data-face]').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.face;
        speakLine(R.FEELING_NAMES[id]);
        if (!spec.feel.fits.includes(id)) {
          if (!tried.has(id)) { tried.add(id); miss(); }
          gentle(body, 'Look at ' + who + '\'s face in the picture. Try another.', b);
          return;
        }
        setP({ feel: { face: id } });
        redraw();
      }));
      return;
    }
    const words = shared.feelings.find((f) => f.id === face).words[sc.band];
    body.innerHTML = stage + instruct('Choose a word: ' + who + ' felt…', 'person') + '<div class="ctiles">' + words.map((w) => tileBtn(w, 'data-feel="' + esc(w) + '"')).join('') + '</div>'
      + '<p><button type="button" class="btn btn--quiet btn--small" data-otherface>Choose another face</button></p>';
    wireHear(body);
    body.querySelectorAll('[data-feel]').forEach((b) => b.addEventListener('click', () => { speakLine(K.feelSentence({ feel: { word: b.dataset.feel } }, spec)); setP({ feel: { face, word: b.dataset.feel } }); redraw(); }));
    body.querySelector('[data-otherface]').addEventListener('click', () => { setP({ feel: null }); redraw(); });
    return;
  }
  if (step === 'why') {
    let join = 'because';
    body.innerHTML = stage + instruct('Why did ' + who + ' feel ' + p.feel.word + '? You can skip this.', 'idea')
      + '<div class="ctiles" role="radiogroup" aria-label="Joining word">' + shared.why.map((w) => '<button type="button" class="ctile" role="radio" aria-checked="' + (w === join) + '" data-join="' + w + '">' + w + '</button>').join('') + '</div>'
      + '<label class="sr" for="why">Why</label><input id="why" class="field typed" maxlength="' + K.LIMITS.why + '" autocomplete="off" spellcheck="false" data-why>'
      + gentleSlot() + '<div class="btnrow"><button type="button" class="btn btn--primary" data-done>Add it' + ICON.arrow + '</button><button type="button" class="btn btn--quiet" data-skip>Skip</button></div>';
    body.querySelectorAll('[data-join]').forEach((b) => b.addEventListener('click', () => { join = b.dataset.join; speakLine(join); body.querySelectorAll('[data-join]').forEach((x) => x.setAttribute('aria-checked', String(x === b))); }));
    body.querySelector('[data-done]').addEventListener('click', async () => {
      const v = body.querySelector('[data-why]').value.trim();
      const isKnown = await loadKnownWords();
      const r = checkTyped(v, isKnown, { extra: comicWords(t), max: K.LIMITS.why, minWords: 2 });
      if (!r.ok) { gentle(body, typedNote(r, { minWords: 2 })); return; }
      setP({ feel: { ...p.feel, join, why: v } });
      redraw();
    });
    body.querySelector('[data-skip]').addEventListener('click', () => { setP({ feel: { ...p.feel, why: '' } }); redraw(); });
    return;
  }
  // step === 'say' (or a panel whose last step is done)
  const finishPanel = (say) => {
    setP({ say, done: true });
    const n = fresh(c.id);
    const last = i === 3;
    frame(main, t, n, { move: 'panel', title: 'Panel ' + (i + 1) + ' of 4', panel: i });
    wellDone(main.querySelector('[data-body]'), { title: 'Panel ' + (i + 1) + ' is finished!', stars: K.starsOf(n).moves['panel' + (i + 1)], line: last ? 'All four panels are done. Next, make your words stronger.' : 'On to panel ' + (i + 2) + '.' }, redraw);
  };
  body.innerHTML = stage + instruct('Add a speech bubble? Tap what someone says.', 'people')
    + '<div class="choices choices--speech">' + spec.speech.map((s, k) => '<span class="tilewrap"><button type="button" class="choice choice--speech" data-say="' + k + '"><b>' + esc(s.who.charAt(0).toUpperCase() + s.who.slice(1)) + ':</b> <span>“' + esc(s.says) + '”</span></button>' + R.hearBtn(s.says) + '</span>').join('') + '</div>'
    + (sc.typeBubble ? '<details class="ownbubble"><summary class="btn btn--quiet btn--small">Type my own</summary><div class="stack"><div class="ctiles" role="radiogroup" aria-label="Who says it">' + K.speakers(spec).map((w, k) => '<button type="button" class="ctile ctile--small" role="radio" aria-checked="' + (k === 0) + '" data-speaker="' + esc(w) + '">' + esc(w) + '</button>').join('') + '</div>'
      + '<label class="sr" for="bubble">What they say</label><input id="bubble" class="field typed" maxlength="' + K.LIMITS.bubble + '" autocomplete="off" spellcheck="false" data-bubble><button type="button" class="btn btn--ghost btn--small" data-ownsay>Use my words</button></div></details>' : '')
    + gentleSlot() + '<div class="btnrow"><button type="button" class="btn btn--quiet" data-nosay>No speech bubble</button></div>';
  wireHear(body);
  let speaker = K.speakers(spec)[0];
  body.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => { const s = spec.speech[Number(b.dataset.say)]; speakLine(s.says); finishPanel({ i: Number(b.dataset.say) }); }));
  body.querySelectorAll('[data-speaker]').forEach((b) => b.addEventListener('click', () => { speaker = b.dataset.speaker; body.querySelectorAll('[data-speaker]').forEach((x) => x.setAttribute('aria-checked', String(x === b))); }));
  const own = body.querySelector('[data-ownsay]');
  if (own) own.addEventListener('click', async () => {
    const v = body.querySelector('[data-bubble]').value.trim();
    const isKnown = await loadKnownWords();
    const r = checkTyped(v, isKnown, { extra: comicWords(t), max: K.LIMITS.bubble });
    if (!r.ok) { gentle(body, typedNote(r)); return; }
    finishPanel({ who: speaker, text: v });
  });
  body.querySelector('[data-nosay]').addEventListener('click', () => finishPanel({ skip: true }));
}

// ---- 4. Join it up --------------------------------------------------------------------------------------
function joinMove(main, t, c, redraw) {
  const body = frame(main, t, c, { move: 'join', title: 'Join it up' });
  const spot = K.joinNext(c, t);
  if (spot) {
    const s = K.panelSentence(c, spot.panel, t);
    const marked = esc(s).replace(new RegExp('(^|[^A-Za-z])(' + spot.word + ')(?![A-Za-z])', 'i'), '$1<mark>$2</mark>');
    body.innerHTML = instruct('Make a word stronger. Which word could replace "' + spot.word + '"?', 'star')
      + '<div class="card setting"><p class="bigline">' + marked + ' ' + R.hearBtn(s, 'Hear the sentence') + '</p></div>'
      + '<div class="ctiles">' + spot.better.map((w) => tileBtn(w, 'data-up="' + esc(w) + '"')).join('') + tileBtn('Keep "' + spot.word + '"', 'data-up="' + esc(spot.word) + '"', { hear: false, cls: 'ctile--keep' }) + '</div>';
    wireHear(body);
    body.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => {
      const w = b.dataset.up;
      const n = K.applyUpgrades(s, { [spot.word]: w });
      speakLine(n);
      save((d, now) => K.change(d, c.id, { join: { ...c.join, up: { ...c.join.up, [spot.word]: w } } }, now));
      redraw();
    }));
    return;
  }
  const ends = t.comic.endings;
  body.innerHTML = instruct('Choose an ending for your comic.', 'star') + '<div class="choices">' + ends.map((e, k) => '<span class="tilewrap"><button type="button" class="choice" data-end="' + k + '"><span>' + esc(e) + '</span></button>' + R.hearBtn(e) + '</span>').join('') + '</div>';
  wireHear(body);
  body.querySelectorAll('[data-end]').forEach((b) => b.addEventListener('click', () => {
    const k = Number(b.dataset.end);
    speakLine(ends[k]);
    save((d, now) => K.change(d, c.id, { join: { ...c.join, end: k, done: true } }, now));
    const n = fresh(c.id);
    frame(main, t, n, { move: 'join', title: 'Join it up' });
    wellDone(main.querySelector('[data-body]'), { title: 'Your comic is joined up!', stars: K.starsOf(n).moves.join, line: 'Now listen to the whole comic.' }, redraw);
  }));
}

// ---- 5. Read it to me, and finish ----------------------------------------------------------------------
/** Read the comic aloud, lighting each line as it's read. */
export function wireReadAloud(root, lines, button) {
  let on = false;
  button.addEventListener('click', async () => {
    if (on) { on = false; stop(); button.setAttribute('aria-pressed', 'false'); return; }
    on = true;
    button.setAttribute('aria-pressed', 'true');
    await speakLines(lines.map((l) => (l.kind === 'speech' ? l.says + '. said ' + l.who : l.text)), (n) => {
      root.querySelectorAll('[data-line]').forEach((el) => el.classList.toggle('is-reading', Number(el.dataset.line) === n));
      const el = root.querySelector('[data-line="' + n + '"]');
      if (el && n >= 0) el.closest('.panel').scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    });
    on = false;
    button.setAttribute('aria-pressed', 'false');
  });
}
function readMove(main, t, c, redraw) {
  const body = frame(main, t, c, { move: 'read', title: 'Read it to me' });
  const lines = K.readText(c, t);
  main.querySelector('.comic--strip').remove();
  body.innerHTML = instruct('Listen to your whole comic. Tap Fix to change a panel.', 'play')
    + '<div class="btnrow"><button type="button" class="btn btn--ghost" data-readall aria-pressed="false">' + R.ICONS.play + 'Read it to me</button></div>'
    + R.comicHtml(c, t, { cls: 'comic--big', fix: true, label: 'My comic' })
    + '<div class="card setting finishcard"><div class="btnrow"><button type="button" class="btn btn--primary btn--big" data-finish>Finish my comic' + ICON.arrow + '</button></div>'
    + '<p class="small muted">Or, for bonus stars: write the story in your own words.</p><button type="button" class="btn btn--ghost" data-challenge>' + R.ICONS.star + 'Write it yourself</button></div>';
  wireHear(body);
  wireReadAloud(body, lines, body.querySelector('[data-readall]'));
  body.querySelectorAll('[data-fix]').forEach((b) => b.addEventListener('click', () => { save((d, now) => K.fixPanel(d, c.id, Number(b.dataset.fix), now)); redraw(); }));
  body.querySelector('[data-finish]').addEventListener('click', () => finishComic(t, c));
  body.querySelector('[data-challenge]').addEventListener('click', () => { save((d, now) => K.change(d, c.id, { read: true }, now)); location.hash = '#/c/' + t.id + '/challenge'; });
}
function finishComic(t, c) {
  save((d, now) => K.finish(K.change(d, c.id, { read: true }, now), c.id, now));
  justFinished = c.id;
  location.hash = '#/comics/' + c.id;
}

/* ------------------------------------------------------- 6. Write it yourself --- */
export function challenge(main, { id }) {
  const t = comicTask(id);
  if (!t) return undefined;
  const c = K.openComic(S.readComics(), t.id);
  if (!c) { location.replace('#/c/' + t.id); return undefined; }
  const nm = K.nextMove(c);
  if (nm.move !== 'finish') { location.replace('#/c/' + t.id + '/go'); return undefined; }
  let text = (c.challenge && c.challenge.text) || '';
  let timer = null;
  // Typing saves as it goes; once handed in ("I'm done") the text is kept as it was.
  const keep = () => { clearTimeout(timer); timer = null; const ch = fresh(c.id).challenge || {}; if (!ch.done) save((d, now) => K.change(d, c.id, { challenge: { ...ch, text, done: false, at: now } }, now)); };
  const later = () => { clearTimeout(timer); timer = setTimeout(keep, 700); };
  main.innerHTML = '<section class="wrap page studio"><div class="pagehead"><span class="eyebrow">' + esc(t.title) + ' · Bonus</span><h1>Write it yourself</h1></div>'
    + instruct('Use your comic as a guide. Write the story in your own words, a paragraph for each panel.', 'book')
    + R.comicHtml(c, t, { cls: 'comic--guide', label: 'My comic, as a guide' })
    + '<p class="small muted">Hint words: ' + t.hints.map((h) => '<button type="button" class="hint" data-hear="' + esc(h) + '">' + ICON.play + esc(h) + '</button>').join(' ') + '</p>'
    + '<div class="card writebox writebox--one"><label for="story"><b>My story</b></label><textarea id="story" class="field" spellcheck="false" autocapitalize="sentences" maxlength="' + K.LIMITS.challenge + '" data-story>' + esc(text) + '</textarea></div>'
    + '<div class="livebar" aria-live="polite"><span data-count></span><p class="small" data-gentle></p><div class="btnrow"><button type="button" class="btn btn--quiet btn--small" data-gentlebtn>Check my capitals and full stops</button></div></div>'
    + '<div data-result></div><div class="btnrow" data-actions><button type="button" class="btn btn--primary" data-done>I\'m done' + ICON.arrow + '</button><a class="btn btn--ghost" href="#/c/' + esc(t.id) + '/go">Back to my comic</a></div></section>';
  wireHear(main);
  const box = main.querySelector('[data-story]');
  const count = () => { main.querySelector('[data-count]').innerHTML = '<b>' + C.wordCount(text) + '</b> words'; };
  count();
  box.addEventListener('input', () => { text = box.value; count(); main.querySelector('[data-gentle]').textContent = ''; later(); });
  main.querySelector('[data-gentlebtn]').addEventListener('click', () => {
    const cs = C.capitalsAndStops(text);
    const say = [];
    if (cs.noCapital) say.push('Some sentences could start with a capital letter.');
    if (cs.smallI) say.push('Remember a capital for the word I.');
    if (cs.noStop) say.push('Look at the end of each sentence for a full stop.');
    main.querySelector('[data-gentle]').textContent = say.length ? say.join(' ') : 'Those look good!';
  });
  main.querySelector('[data-done]').addEventListener('click', async () => {
    if (C.wordCount(text) < 5) { main.querySelector('[data-gentle]').textContent = 'Write a little more first.'; return; }
    clearTimeout(timer);
    timer = null;
    const isReal = await loadRealWords();
    const checks = C.autoChecks(text, t, isReal);
    save((d, now) => K.change(d, c.id, { challenge: { ...(fresh(c.id).challenge || {}), text, checks, done: true, at: now } }, now));
    const n = fresh(c.id);
    box.readOnly = true;
    main.querySelector('[data-result]').innerHTML = '<div class="card setting" data-checks><h2>What we noticed</h2>' + R.starsHtml(K.starsOf(n).bonus, 3, K.starsOf(n).bonus + ' bonus stars') + '<ul class="autochecks">' + checks.map((x) => '<li' + (x.ok ? '' : ' class="is-todo"') + '>' + (x.ok ? ICON.tick : ICON.dot) + '<span>' + esc(x.text) + '</span></li>').join('') + '</ul></div>';
    main.querySelector('[data-actions]').innerHTML = '<button type="button" class="btn btn--primary btn--big" data-finish>Finish my comic' + ICON.arrow + '</button>';
    main.querySelector('[data-finish]').addEventListener('click', () => finishComic(t, n));
    main.querySelector('[data-checks] h2').setAttribute('tabindex', '-1');
    main.querySelector('[data-checks] h2').focus();
  });
  return () => { if (timer) keep(); stop(); };
}

/* ----------------------------------------------------------------- My comics --- */
export function shelf(main) {
  const d = S.readComics();
  const done = K.finished(d);
  const going = Object.values(d.comics).filter((c) => !K.isDone(c)).sort((a, b) => b.at - a.at);
  const old = W.finals(S.readWriting());
  const coverLink = (c) => {
    const t = c.kind === 'task' ? taskById(c.task) : null;
    if (c.kind === 'task' && !t) return '';
    return '<a class="card shelfitem" href="#/comics/' + esc(c.id) + '" data-comic="' + esc(c.id) + '">' + R.coverHtml(c, t, { stamp: true }) + (c.kind === 'task' ? '<span class="muted small">' + R.starsHtml(Math.round(K.starsOf(c).total / Math.max(1, K.starsOf(c).max) * 3)) + ' ' + K.starsOf(c).total + ' stars</span>' : '<span class="muted small">My own story</span>') + '</a>';
  };
  const goingRow = (c) => {
    const t = c.kind === 'task' ? taskById(c.task) : null;
    const href = c.kind === 'own' ? '#/own/' + c.id : t ? '#/c/' + t.id + '/go' : '';
    return href ? '<a class="card listrow" href="' + esc(href) + '" data-going="' + esc(c.id) + '"><span><strong>' + esc(c.kind === 'own' ? c.title || 'My own story' : t.title) + '</strong><br><span class="muted small">Carry on</span></span>' + ICON.arrow + '</a>' : '';
  };
  main.innerHTML = '<section class="wrap page"><div class="pagehead"><span class="eyebrow">Comic Studio</span><h1>My comics</h1>'
    + '<p class="muted">' + (done.length ? 'You have ' + done.length + (done.length === 1 ? ' stamp' : ' stamps') + ': one for every comic you finish.' : 'Every comic you finish gets a stamp here.') + '</p>'
    + (done.length ? '<div class="stamprow" aria-hidden="true">' + done.map(() => '<span class="stamp stamp--small">' + R.ICONS.stamp + '</span>').join('') + '</div>' : '') + '</div>'
    + (going.length ? '<h2 class="sectionhead">Still being made</h2><div class="list">' + going.map(goingRow).join('') + '</div>' : '')
    + (done.length ? '<h2 class="sectionhead">Finished</h2><div class="shelf">' + done.map(coverLink).join('') + '</div>' : '<div class="card empty"><p class="muted">Your finished comics will be here.</p><a class="btn btn--primary" href="#/">Choose a story</a></div>')
    + (ownVisible(kind()) ? '<div class="shortcuts"><a class="card shortcut" href="#/own" data-ownlink><span><strong>Make my own story</strong><br><span class="muted small">Choose a place, characters and stickers</span></span>' + ICON.arrow + '</a></div>' : '')
    + (old.length ? '<h2 class="sectionhead">Earlier stories</h2><div class="list">' + old.map((p) => { const t = taskById(p.task); return '<a class="card listrow" href="#/writing/' + esc(p.id) + '" data-piece="' + esc(p.id) + '"><span><strong>' + esc(t ? t.title : 'A story') + '</strong><br><span class="muted small">' + C.wordCount(p.final) + ' words</span></span>' + ICON.arrow + '</a>'; }).join('') + '</div>' : '')
    + '</section>';
}

export function view(main, { cid }) {
  const c = S.readComics().comics[cid];
  if (!c || !K.isDone(c)) { location.replace('#/comics'); return undefined; }
  const t = c.kind === 'task' ? taskById(c.task) : null;
  if (c.kind === 'task' && !t) { location.replace('#/comics'); return undefined; }
  const fresh_ = justFinished === cid;
  justFinished = '';
  const st = K.starsOf(c);
  const m = S.readMarks().marks[cid];
  const nameOf = (x) => R.stickerName(x + '.a') || x;
  const lines = R.comicLines(c, t, nameOf);
  main.innerHTML = '<section class="wrap page comicpage"><div class="pagehead noprint"><span class="eyebrow">My comics</span><h1 data-final>' + esc(c.kind === 'own' ? c.title || 'My comic' : t.title) + '</h1>'
    + (fresh_ ? '<span class="celebrate"><span class="passmark__badge">' + ICON.tick + '</span>' + burstHtml(14, 1.6) + '</span>' : '') + '</div>'
    + (fresh_ ? '<p class="welcome" data-focus tabindex="-1">Your comic is finished, and it has earned a stamp!</p>' : '')
    + R.coverHtml(c, t, { name: playerName(), stamp: true })
    + (c.kind === 'task' ? '<p class="starline">' + R.starsHtml(Math.round(st.total / Math.max(1, st.max) * 3)) + ' <b>' + st.total + '</b> stars' + (st.bonus ? ', with ' + st.bonus + ' bonus' : '') + '</p>' : '')
    + '<div class="btnrow noprint"><button type="button" class="btn btn--ghost" data-readall aria-pressed="false">' + R.ICONS.play + 'Read it to me</button><button type="button" class="btn btn--ghost" data-print>' + R.ICONS.print + 'Print</button></div>'
    + R.comicHtml(c, t, { cls: 'comic--big comic--print', nameOf, label: 'My comic' })
    + (c.challenge && c.challenge.done ? '<div class="card setting"><h2>In my own words</h2><p class="piece">' + esc(c.challenge.text) + '</p></div>' : '')
    + (m && m.comment ? '<div class="card setting"><h2>From your grown-up</h2><p>' + esc(m.comment) + '</p></div>' : '')
    + '<div class="btnrow noprint"><a class="btn btn--primary" href="#/">Make another' + ICON.arrow + '</a><a class="btn btn--ghost" href="#/comics">My comics</a></div></section>';
  if (fresh_) { placeBursts(main); speakLine('Your comic is finished!'); }
  R.placeStickers(main);
  wireReadAloud(main, lines, main.querySelector('[data-readall]'));
  main.querySelector('[data-print]').addEventListener('click', () => window.print());
  if (fresh_) toast('A new stamp for My comics');
  return stop;
}
