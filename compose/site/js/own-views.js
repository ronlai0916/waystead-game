// My own story (C2-2): a comic of the child's own, from our stickers. No AI, and
// nothing leaves the family: it is saved with the child's comics (comic-doc.js).
//   #/own         start a new one, or carry on
//   #/own/<id>    the next step, whatever it is: setting, characters, objects,
//                 a problem and a solution (story-spark cards), then four panels
//                 (stickers, a caption, a bubble), then a title.
// Stickers: tap one to put it in the panel, then tap the panel to move it there, or
// drag it. Its buttons make it smaller or bigger, flip it, or take it out; with a
// keyboard, the arrow keys move it, + and - size it, and Delete takes it out.
// Positions are saved as numbers (comic-doc.js), never as pictures.
import * as S from './store.js';
import * as K from './comic-doc.js';
import { comicShared, stickers, ownVisible } from './tasks.js';
import { speakLine, stop, useOwnWords } from './speech.js';
import { loadKnownWords } from './wordcheck.js';
import { checkTyped, typedNote } from './safe-text.js';
import { kind, playerName } from './who.js';
import { esc, ICON } from './ui.js';
import * as R from './comic-render.js';
import { instruct, wireHear, gentle, gentleSlot, focusStep, tileBtn, wellDone, wireLevel } from './comic-views.js';

const STEPS = [['setting', 'Place'], ['cast', 'Characters'], ['props', 'Things'], ['problem', 'Problem'], ['panel', 'Panels'], ['title', 'Title']];
const PANEL_JOB = ['how the story starts', 'the problem', 'how it is solved', 'how it ends'];
const save = (fn) => S.updateComics((d) => fn(d, Date.now()));
const fresh = (id) => S.readComics().comics[id];

function guard(main) {
  if (ownVisible(kind())) return true;
  location.replace('#/');
  return false;
}
const charName = (id) => { const c = (stickers().characters || []).find((x) => x.id === id); return c ? c.name : id === 'everyone' ? 'everyone' : id; };
const thingName = (id) => { const o = (stickers().objects || []).find((x) => x.id === id); return o ? o.name : ''; };
const nameOf = (id) => (id === 'everyone' ? 'Everyone' : charName(id));
/** Names a typed line may use besides our lists: every sticker's name. */
const ownWords = () => [...stickers().characters.map((c) => c.name), ...stickers().objects.map((o) => o.name), ...stickers().backgrounds.map((b) => b.name)];
async function typedOk(root, text, opts) {
  const isKnown = await loadKnownWords();
  const r = checkTyped(text, isKnown, { extra: ownWords(), ...opts });
  if (!r.ok) gentle(root, typedNote(r, opts));
  return r.ok;
}

/* ----------------------------------------------------------------- the start --- */
export function start(main) {
  if (!guard(main)) return undefined;
  const open = K.openOwn(S.readComics());
  let level = open[0] ? open[0].level : 3;
  const draw = () => {
    main.innerHTML = '<section class="wrap page studio"><div class="pagehead"><span class="eyebrow">Comic Studio</span><h1>My own story</h1></div>'
      + instruct('Make a comic of your own. Choose a place, characters and things, then fill four panels with stickers and words.', 'star')
      + (open.length ? '<h2 class="sectionhead">Carry on</h2><div class="list">' + open.map((c) => '<a class="card listrow" href="#/own/' + esc(c.id) + '" data-going="' + esc(c.id) + '"><span><strong>' + esc(c.title || 'My own story') + '</strong><br><span class="muted small">' + esc(c.setting ? R.bgOf(c.setting).name : 'Just started') + '</span></span>' + ICON.arrow + '</a>').join('') + '</div>' : '')
      + '<div class="card levelcard" data-level="' + level + '"><p><b>Level: Year ' + level + '</b><br><span class="muted small">' + (level === 3 ? 'You build every line with word tiles.' : 'Word tiles, or type your own lines.') + '</span></p><div class="btnrow">'
      + '<button type="button" class="btn btn--ghost btn--small" data-easier' + (level <= 3 ? ' disabled' : '') + '>' + R.ICONS.minus + 'Make it easier</button><button type="button" class="btn btn--ghost btn--small" data-harder' + (level >= 6 ? ' disabled' : '') + '>' + R.ICONS.plus + 'Make it harder</button></div></div>'
      + '<div class="btnrow"><button type="button" class="btn btn--primary btn--big" data-new>Start a new story' + ICON.arrow + '</button></div></section>';
    wireHear(main);
    wireLevel(main, () => level, (n) => { level = n; draw(); });
    main.querySelector('[data-new]').addEventListener('click', () => {
      const id = S.newId();
      S.updateComics((d) => K.startOwn(d, { id, now: Date.now(), level }));
      location.hash = '#/own/' + id;
    });
  };
  draw();
  return stop;
}

/* ------------------------------------------------------------------ the steps --- */
function frame(main, c, { step, title, panel = -1 }) {
  const at = STEPS.findIndex(([m]) => m === step || (step === 'solution' && m === 'problem'));
  main.innerHTML = '<section class="wrap page studio" data-move="own-' + step + '"><div class="pagehead"><span class="eyebrow">My own story · Year ' + c.level + '</span><h1>' + esc(title) + '</h1></div>'
    + '<ol class="stepbar movebar" aria-label="Steps">' + STEPS.map(([m, label], k) => '<li class="' + (k < at ? 'is-done' : '') + (k === at ? ' is-on' : '') + '"' + (k === at ? ' aria-current="step"' : '') + '>' + label + '</li>').join('') + '</ol>'
    + (c.setting ? R.comicHtml(c, null, { cls: 'comic--strip', on: panel, nameOf, label: 'My comic so far' }) : '')
    + '<div class="studio__body" data-body></div>'
    + '<div class="btnrow backrow"><button type="button" class="btn btn--quiet btn--small" data-back>' + R.ICONS.back + 'Back a step</button></div></section>';
  R.placeStickers(main);
  useOwnWords(R.ownWordsOf(c));
  return main.querySelector('[data-body]');
}

export function step(main, { cid }) {
  if (!guard(main)) return undefined;
  const c = S.readComics().comics[cid];
  if (!c || c.kind !== 'own') { location.replace('#/own'); return undefined; }
  if (K.isDone(c)) { location.replace('#/comics/' + cid); return undefined; }
  const redraw = () => { stop(); step(main, { cid }); focusStep(main); };
  const next = K.nextMove(c);
  const sc = K.scaffold(c.level);
  const data = comicShared().own;
  const st = stickers();
  const back = () => { save((d, now) => K.ownBack(d, cid, now)); redraw(); };
  const wireBack = () => { const b = main.querySelector('[data-back]'); if (b) { b.hidden = next.move === 'setting'; b.addEventListener('click', back); } };

  if (next.move === 'setting') {
    const body = frame(main, c, { step: 'setting', title: 'Choose a place' });
    body.innerHTML = instruct('Where does your story happen? Tap a place.', 'house') + '<div class="pickgrid pickgrid--wide">' + st.backgrounds.map((b) => '<span class="tilewrap"><button type="button" class="pick" data-bg="' + b.id + '"><img src="' + esc(b.src['600']) + '" alt="" draggable="false"><span>' + esc(b.name) + '</span></button>' + R.hearBtn(b.name) + '</span>').join('') + '</div>';
    wireHear(body);
    body.querySelectorAll('[data-bg]').forEach((b) => b.addEventListener('click', () => { speakLine(R.bgOf(b.dataset.bg).name); save((d, now) => K.change(d, cid, { setting: b.dataset.bg }, now)); redraw(); }));
  } else if (next.move === 'cast' || next.move === 'props') {
    const isCast = next.move === 'cast';
    const list = isCast ? st.characters : st.objects;
    const chosen = new Set(isCast ? c.cast : c.props);
    const body = frame(main, c, { step: next.move, title: isCast ? 'Choose your characters' : 'Choose some things' });
    const draw = () => {
      body.innerHTML = instruct(isCast ? 'Who is in your story? Tap up to three.' : 'What things are in your story? Tap up to three, or none.', isCast ? 'people' : 'box')
        + '<div class="pickgrid">' + list.map((x) => '<span class="tilewrap"><button type="button" class="pick pick--sticker" data-pick="' + x.id + '" aria-pressed="' + chosen.has(x.id) + '"' + (!chosen.has(x.id) && chosen.size >= 3 ? ' disabled' : '') + '><img src="' + esc(isCast ? x.poses.a : x.src) + '" alt="" draggable="false"><span>' + esc(x.name) + '</span></button>' + R.hearBtn(x.name) + '</span>').join('') + '</div>'
        + '<p class="small muted" role="status">' + chosen.size + ' of 3 chosen</p><div class="btnrow"><button type="button" class="btn btn--primary" data-next' + (isCast && !chosen.size ? ' disabled' : '') + '>Next' + ICON.arrow + '</button></div>';
      wireHear(body);
      body.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.pick;
        if (chosen.has(id)) chosen.delete(id); else if (chosen.size < 3) { chosen.add(id); speakLine(isCast ? charName(id) : thingName(id)); }
        save((d, now) => K.change(d, cid, { [isCast ? 'cast' : 'props']: [...chosen] }, now));
        draw();
        const again = body.querySelector('[data-pick="' + id + '"]');
        if (again) again.focus();
      }));
      body.querySelector('[data-next]').addEventListener('click', () => { save((d, now) => K.change(d, cid, { [isCast ? 'castDone' : 'propsDone']: true }, now)); redraw(); });
    };
    draw();
  } else if (next.move === 'problem' || next.move === 'solution') {
    const isProblem = next.move === 'problem';
    const fill = { who: charName(c.cast[0]), thing: c.props[0] ? thingName(c.props[0]) : 'something' };
    const cards = (isProblem ? data.problems : data.solutions).map((x) => ({ ...x, line: K.sparkText(x.text, fill) }));
    const body = frame(main, c, { step: next.move, title: isProblem ? 'A problem' : 'A solution' });
    body.innerHTML = (isProblem ? '' : '<div class="card setting"><p><b>The problem:</b> ' + esc(c.spark.problem) + ' ' + R.hearBtn(c.spark.problem) + '</p></div>')
      + instruct(isProblem ? 'Every story needs a problem. Tap a story spark.' : 'How is the problem solved? Tap a story spark.', 'idea')
      + '<div class="choices">' + cards.map((x, k) => '<span class="tilewrap"><button type="button" class="choice spark" data-spark="' + k + '">' + (R.ICONS[x.icon] || '') + '<span>' + esc(x.line) + '</span></button>' + R.hearBtn(x.line) + '</span>').join('') + '</div>'
      + (sc.typeOwn ? '<details class="ownbubble"><summary class="btn btn--quiet btn--small">Type my own</summary><div class="stack"><label class="sr" for="spark">My own</label><input id="spark" class="field typed" maxlength="' + K.LIMITS.spark + '" autocomplete="off" spellcheck="false" data-sparktext><button type="button" class="btn btn--ghost btn--small" data-sparkown>Use my words</button></div></details>' : '')
      + gentleSlot();
    wireHear(body);
    const set = (line) => { save((d, now) => K.change(d, cid, { spark: isProblem ? { problem: line, solution: null } : { ...c.spark, solution: line } }, now)); redraw(); };
    body.querySelectorAll('[data-spark]').forEach((b) => b.addEventListener('click', () => { const line = cards[Number(b.dataset.spark)].line; speakLine(line); set(line); }));
    const own = body.querySelector('[data-sparkown]');
    if (own) own.addEventListener('click', async () => { const v = body.querySelector('[data-sparktext]').value.trim(); if (await typedOk(body, v, { max: K.LIMITS.spark, minWords: 3 })) set(v); });
  } else if (next.move === 'panel') {
    panelStep(main, c, next.panel, { sc, data, redraw });
  } else if (next.move === 'title') {
    const who = charName(c.cast[0]);
    const thing = c.props[0] ? thingName(c.props[0]) : '';
    const place = R.bgOf(c.setting).name;
    const ideas = K.ownTitleIdeas(who, thing, place);
    const body = frame(main, c, { step: 'title', title: 'Give it a title' });
    body.innerHTML = instruct('Every comic needs a title. Tap one you like.', 'book') + '<div class="ctiles">' + ideas.map((x) => tileBtn(x, 'data-title="' + esc(x) + '"')).join('') + '</div>'
      + (sc.typeOwn ? '<details class="ownbubble"><summary class="btn btn--quiet btn--small">Type my own</summary><div class="stack"><label class="sr" for="title">My title</label><input id="title" class="field typed" maxlength="' + K.LIMITS.title + '" autocomplete="off" spellcheck="false" data-titletext><button type="button" class="btn btn--ghost btn--small" data-titleown>Use my title</button></div></details>' : '') + gentleSlot();
    wireHear(body);
    const set = (v) => {
      save((d, now) => K.finish(K.change(d, cid, { title: v }, now), cid, now));
      location.hash = '#/comics/' + cid;
    };
    body.querySelectorAll('[data-title]').forEach((b) => b.addEventListener('click', () => { speakLine(b.dataset.title); set(b.dataset.title); }));
    const own = body.querySelector('[data-titleown]');
    if (own) own.addEventListener('click', async () => { const v = body.querySelector('[data-titletext]').value.trim(); if (await typedOk(body, v, { max: K.LIMITS.title })) set(v); });
  }
  wireBack();
  return stop;
}

// ---- a panel: stickers, a caption, a bubble ------------------------------------------------------------------
function panelStep(main, c, i, { sc, data, redraw }) {
  const p = c.panels[i];
  const sub = K.ownPanelStep(p);
  const cid = c.id;
  const body = frame(main, c, { step: 'panel', title: 'Panel ' + (i + 1) + ' of 4', panel: i });
  const setP = (fields) => save((d, now) => K.changePanel(d, cid, i, fields, now));
  const guide = '<p class="small muted panelguide">This panel shows <b>' + PANEL_JOB[i] + '</b>.' + (i === 1 && c.spark ? ' ' + esc(c.spark.problem) : i === 2 && c.spark ? ' ' + esc(c.spark.solution) : '') + '</p>';
  if (sub === 'stickers') { stickerStage(body, c, i, guide, redraw); return; }
  const stage = '<div class="stage">' + R.panelHtml(c, null, i, { big: true, on: i, nameOf }) + '</div>';
  if (sub === 'caption') {
    const cap = { op: '', tiles: [] };
    const quick = i === 1 && c.spark ? c.spark.problem : i === 2 && c.spark ? c.spark.solution : '';
    const whoList = [...c.cast.map(charName), 'everyone'];
    const whatList = [...c.props.map(thingName), ...c.cast.map(charName)];
    const where = data.where[p.bg || c.setting];
    const stages = [
      ['Tap a starter.', comicShared().openers[sc.band][i]],
      ['Who? Tap a name.', whoList],
      ['Did what? Tap a doing word.', data.did],
      ['What, or who? Tap one.', whatList.length ? whatList : ['something']],
      ['Where? Tap the place, or finish here.', [where]],
    ];
    const draw = () => {
      const k = cap.op ? cap.tiles.length + 1 : 0;
      const [line, list] = stages[k];
      body.innerHTML = stage + guide + instruct('Write the caption. ' + line, 'book')
        + (k === 0 && (quick || i === 3) ? '<div class="choices">' + (quick ? '<span class="tilewrap"><button type="button" class="choice" data-quick="' + esc(quick) + '"><span>' + esc(quick) + '</span></button>' + R.hearBtn(quick) + '</span>' : '')
          + (i === 3 ? data.endings.map((e) => '<span class="tilewrap"><button type="button" class="choice" data-quick="' + esc(e) + '"><span>' + esc(e) + '</span></button>' + R.hearBtn(e) + '</span>').join('') : '') + '</div><p class="small muted">Or build your own:</p>' : '')
        + (k ? '<div class="buildline" aria-label="My caption"><span class="buildline__op">' + esc(cap.op) + '</span>' + cap.tiles.map((w, n) => '<button type="button" class="ctile ctile--placed" data-undo' + (n === cap.tiles.length - 1 ? '' : ' disabled') + '>' + esc(w) + '</button>').join('') + '<span class="slot is-next">…</span></div>' : '')
        + '<div class="ctiles">' + list.map((w) => tileBtn(w.replace(/,$/, ''), 'data-tile="' + esc(w) + '"')).join('') + (k === 4 ? '<button type="button" class="btn btn--quiet" data-endhere>Finish here</button>' : '') + '</div>'
        + (sc.typeOwn ? '<details class="ownbubble"><summary class="btn btn--quiet btn--small">Type it instead</summary><div class="stack"><label class="sr" for="cap">My caption</label><input id="cap" class="field typed" maxlength="' + K.LIMITS.sentence + '" autocomplete="off" spellcheck="false" data-captext><button type="button" class="btn btn--ghost btn--small" data-capown>Use my words</button></div></details>' : '')
        + gentleSlot();
      wireHear(body);
      R.placeStickers(body);
      const done = (v) => { setP({ cap: v }); redraw(); };
      body.querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', () => { speakLine(b.dataset.quick); done({ text: b.dataset.quick }); }));
      body.querySelectorAll('[data-tile]').forEach((b) => b.addEventListener('click', () => {
        const w = b.dataset.tile;
        speakLine(w.replace(/,$/, ''));
        if (!cap.op) cap.op = w; else cap.tiles.push(w);
        if (cap.tiles.length === 4) { done({ op: cap.op, tiles: cap.tiles }); return; }
        draw();
        focusStep(main);
      }));
      const undo = body.querySelector('[data-undo]:not([disabled])');
      if (undo) undo.addEventListener('click', () => { cap.tiles.pop(); draw(); });
      const endHere = body.querySelector('[data-endhere]');
      if (endHere) endHere.addEventListener('click', () => done({ op: cap.op, tiles: cap.tiles }));
      const own = body.querySelector('[data-capown]');
      if (own) own.addEventListener('click', async () => { const v = body.querySelector('[data-captext]').value.trim(); if (await typedOk(body, v, { max: K.LIMITS.sentence, minWords: 2 })) done({ text: v }); });
    };
    draw();
    return;
  }
  // sub === 'say'
  let speaker = c.cast[0];
  const finishPanel = (say) => {
    setP({ say, done: true });
    const n = fresh(cid);
    frame(main, n, { step: 'panel', title: 'Panel ' + (i + 1) + ' of 4', panel: i });
    const b = main.querySelector('[data-back]');
    if (b) b.hidden = true;
    wellDone(main.querySelector('[data-body]'), { title: 'Panel ' + (i + 1) + ' is finished!', line: i === 3 ? 'Last of all, a title.' : 'On to panel ' + (i + 2) + '.' }, redraw);
  };
  body.innerHTML = stage + instruct('Add a speech bubble? First tap who is talking.', 'people')
    + '<div class="ctiles" role="radiogroup" aria-label="Who is talking">' + c.cast.map((id) => '<button type="button" class="ctile ctile--small" role="radio" aria-checked="' + (id === speaker) + '" data-speaker="' + esc(id) + '">' + esc(charName(id)) + '</button>').join('') + '</div>'
    + '<div class="ctiles">' + data.speech.map((s) => tileBtn(s, 'data-sayline="' + esc(s) + '"')).join('') + '</div>'
    + (sc.typeOwn ? '<details class="ownbubble"><summary class="btn btn--quiet btn--small">Type my own</summary><div class="stack"><label class="sr" for="bubble">What they say</label><input id="bubble" class="field typed" maxlength="' + K.LIMITS.bubble + '" autocomplete="off" spellcheck="false" data-bubble><button type="button" class="btn btn--ghost btn--small" data-ownsay>Use my words</button></div></details>' : '')
    + gentleSlot() + '<div class="btnrow"><button type="button" class="btn btn--quiet" data-nosay>No speech bubble</button></div>';
  wireHear(body);
  R.placeStickers(body);
  body.querySelectorAll('[data-speaker]').forEach((b) => b.addEventListener('click', () => { speaker = b.dataset.speaker; speakLine(charName(speaker)); body.querySelectorAll('[data-speaker]').forEach((x) => x.setAttribute('aria-checked', String(x === b))); }));
  body.querySelectorAll('[data-sayline]').forEach((b) => b.addEventListener('click', () => { speakLine(b.dataset.sayline); finishPanel({ who: speaker, text: b.dataset.sayline }); }));
  const own = body.querySelector('[data-ownsay]');
  if (own) own.addEventListener('click', async () => { const v = body.querySelector('[data-bubble]').value.trim(); if (await typedOk(body, v, { max: K.LIMITS.bubble })) finishPanel({ who: speaker, text: v }); });
  body.querySelector('[data-nosay]').addEventListener('click', () => finishPanel({ skip: true }));
}

// ---- the sticker stage --------------------------------------------------------------------------------------------
function stickerStage(body, c, i, guide, redraw) {
  const cid = c.id;
  let list = c.panels[i].st.slice();
  let bg = c.panels[i].bg || c.setting;
  let sel = list.length ? list.length - 1 : -1;
  let more = false;
  const st = stickers();
  const keep = () => save((d, now) => K.changePanel(d, cid, i, { st: list, bg }, now));
  const tray = () => {
    const mine = [...c.cast.flatMap((id) => [id + '.a', id + '.b']), ...c.props];
    const all = more ? [...st.characters.flatMap((x) => [x.id + '.a', x.id + '.b']), ...st.objects.map((o) => o.id)].filter((k) => !mine.includes(k)) : [];
    return [...mine, ...all];
  };
  function draw(focus = '') {
    const view = { ...c, panels: c.panels.map((p, k) => (k === i ? { ...p, st: list, bg } : p)) };
    body.innerHTML = guide + instruct('Tap a sticker to put it in. Tap the picture to move it there, or drag it.', 'star')
      + '<div class="stickerwrap"><div class="stage stage--edit" tabindex="0" aria-label="Panel ' + (i + 1) + '. With a sticker chosen, arrow keys move it, plus and minus change its size, Delete takes it out." data-stagebox>' + R.panelHtml(view, null, i, { big: true, on: i, nameOf }) + '</div>'
      + '<div class="stickertools" role="toolbar" aria-label="The chosen sticker">' + (sel >= 0
        ? '<span class="stickertools__name">' + esc(R.stickerName(list[sel].k)) + '</span>'
          + '<button type="button" class="iconbtn" data-tool="smaller" aria-label="Smaller">' + R.ICONS.minus + '</button><button type="button" class="iconbtn" data-tool="bigger" aria-label="Bigger">' + R.ICONS.plus + '</button>'
          + '<button type="button" class="iconbtn" data-tool="flip" aria-label="Flip">' + R.ICONS.flip + '</button><button type="button" class="iconbtn" data-tool="delete" aria-label="Take it out">' + R.ICONS.bin + '</button>'
        : '<span class="muted small">Tap a sticker in the panel to choose it.</span>') + '</div>'
      + (list.length ? '<div class="ctiles tiles--placed" aria-label="Stickers in this panel">' + list.map((s, k) => '<button type="button" class="ctile ctile--small" data-choose="' + k + '" aria-pressed="' + (k === sel) + '">' + esc(R.stickerName(s.k)) + '</button>').join('') + '</div>' : '')
      + '</div>'
      + '<h2 class="sectionhead">Stickers</h2><div class="stickertray">' + tray().map((k) => '<button type="button" class="traybtn" data-add="' + esc(k) + '"' + (list.length >= K.MAX_STICKERS ? ' disabled' : '') + ' aria-label="Put in ' + esc(R.stickerName(k)) + '"><img src="' + esc(R.stickerSrc(k)) + '" alt="" draggable="false"></button>').join('') + '</div>'
      + '<p><button type="button" class="btn btn--quiet btn--small" data-more aria-expanded="' + more + '">' + (more ? 'Fewer stickers' : 'More stickers') + '</button></p>'
      + '<h2 class="sectionhead">The place</h2><div class="bgrow">' + st.backgrounds.map((b) => '<button type="button" class="bgbtn" data-bgset="' + b.id + '" aria-pressed="' + (b.id === bg) + '" aria-label="' + esc(b.name) + '"><img src="' + esc(b.src['600']) + '" alt="" draggable="false"></button>').join('') + '</div>'
      + gentleSlot() + '<div class="btnrow"><button type="button" class="btn btn--primary" data-stdone>' + (list.length ? 'My picture is ready' : 'No stickers in this one') + ICON.arrow + '</button></div>';
    R.placeStickers(body);
    body.querySelectorAll('.sticker').forEach((el) => el.classList.toggle('is-sel', Number(el.dataset.st) === sel));
    wire();
    if (focus) { const f = body.querySelector(focus); if (f) f.focus({ preventScroll: true }); }
  }
  const stageEl = () => body.querySelector('[data-stage]');
  const pct = (ev) => { const r = stageEl().getBoundingClientRect(); return { x: ((ev.clientX - r.left) / r.width) * 100, y: ((ev.clientY - r.top) / r.height) * 100 }; };
  function tool(name) {
    if (sel < 0) return;
    if (name === 'smaller') list = K.resizeSticker(list, sel, -0.2);
    if (name === 'bigger') list = K.resizeSticker(list, sel, 0.2);
    if (name === 'flip') list = K.flipSticker(list, sel);
    if (name === 'delete') { list = K.removeSticker(list, sel); sel = list.length - 1; }
    keep();
  }
  function wire() {
    wireHear(body);
    body.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.add;
      list = K.placeSticker(list, k, 50, R.isCharacter(k) ? 62 : 70);
      sel = list.length - 1;
      speakLine(R.stickerName(k));
      keep();
      draw('[data-stagebox]');
    }));
    body.querySelectorAll('[data-choose]').forEach((b) => b.addEventListener('click', () => { sel = Number(b.dataset.choose); draw('[data-choose="' + sel + '"]'); }));
    body.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => { tool(b.dataset.tool); draw(sel >= 0 ? '[data-tool="' + b.dataset.tool + '"]' : '[data-stagebox]'); }));
    body.querySelector('[data-more]').addEventListener('click', () => { more = !more; draw('[data-more]'); });
    body.querySelectorAll('[data-bgset]').forEach((b) => b.addEventListener('click', () => { bg = b.dataset.bgset; speakLine(R.bgOf(bg).name); keep(); draw('[data-bgset="' + bg + '"]'); }));
    body.querySelector('[data-stdone]').addEventListener('click', () => { save((d, now) => K.changePanel(d, cid, i, { st: list, bg, stDone: true }, now)); redraw(); });
    const box = body.querySelector('[data-stagebox]');
    box.addEventListener('keydown', (e) => {
      if (sel < 0) return;
      const step = e.shiftKey ? 10 : 3;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) { e.preventDefault(); list = K.nudgeSticker(list, sel, ...moves[e.key]); keep(); draw('[data-stagebox]'); return; }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); tool('bigger'); draw('[data-stagebox]'); }
      if (e.key === '-') { e.preventDefault(); tool('smaller'); draw('[data-stagebox]'); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); tool('delete'); draw('[data-stagebox]'); }
      if (e.key === 'Tab' && !e.shiftKey && list.length > 1) { /* let Tab leave the stage */ }
    });
    // Tap the picture: the chosen sticker moves there. Press on a sticker: choose it and drag.
    const stg = stageEl();
    stg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const hit = e.target.closest('.sticker');
      if (hit) {
        sel = Number(hit.dataset.st);
        body.querySelectorAll('.sticker').forEach((el) => el.classList.toggle('is-sel', el === hit));
        hit.setPointerCapture(e.pointerId);
        let moved = false;
        const move = (ev) => {
          const at = pct(ev);
          moved = true;
          hit.style.setProperty('--x', Math.max(0, Math.min(100, at.x)));
          hit.style.setProperty('--y', Math.max(0, Math.min(100, at.y)));
          hit.dataset.x = Math.round(Math.max(0, Math.min(100, at.x)));
          hit.dataset.y = Math.round(Math.max(0, Math.min(100, at.y)));
        };
        const up = () => {
          hit.removeEventListener('pointermove', move);
          hit.removeEventListener('pointerup', up);
          hit.removeEventListener('pointercancel', up);
          if (moved) { list = K.moveSticker(list, sel, Number(hit.dataset.x), Number(hit.dataset.y)); keep(); }
          draw('[data-stagebox]');
        };
        hit.addEventListener('pointermove', move);
        hit.addEventListener('pointerup', up);
        hit.addEventListener('pointercancel', up);
        e.preventDefault();
        return;
      }
      if (sel < 0) { gentle(body, 'Tap a sticker below first.'); return; }
      const at = pct(e);
      list = K.moveSticker(list, sel, at.x, at.y);
      keep();
      draw('[data-stagebox]');
    });
  }
  draw();
}
