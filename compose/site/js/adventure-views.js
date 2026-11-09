// Story Adventure's pages (C2-3): start (hero, place, goal, style), each scene
// (What happens next? → How does the hero feel? → a speech bubble → Draw my
// scene), the readers' choices at scenes 3 and 5, a title, the finished comic
// (comic or manga layout), and "Play my adventure". Rules: adventure-doc.js.
//
// Tap first: every step can be done with taps. From Year 4 a child may type one
// sentence or bubble instead; it's checked by the child-safe filter and stays a
// caption. Only ids ever go to the picture server (AD.sceneRequest).
// No credits are ever shown here: a child with none is asked to ask a grown-up.
import * as AD from './adventure-doc.js';
import * as K from './comic-doc.js';
import * as R from './comic-render.js';
import * as S from './store.js';
import { createStoryApi } from './adventure-api.js';
import { adventure, adventureVisible, comicShared, stickers } from './tasks.js';
import { speakLine, speakLines, stop, useOwnWords } from './speech.js';
import { loadKnownWords } from './wordcheck.js';
import { checkTyped, typedNote } from './safe-text.js';
import { kind, playerName } from './who.js';
import { accountOrigin } from './account/config.js';
import { esc, ICON, toast } from './ui.js';
import { instruct, wireHear, gentle, gentleSlot, focusStep, tileBtn, wellDone, wireLevel, moveFinished } from './comic-views.js';

let api = null;
const storyApi = () => { if (!api) api = createStoryApi({ origin: accountOrigin(location) }); return api; };
export const useStoryApi = (a) => { api = a; };
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const data = () => adventure();
const save = (fn) => S.updateAdventures((d) => fn(d, Date.now()));
const fresh = (sid) => S.readAdventures().stories[sid];
const feelNames = () => R.FEELING_NAMES;
const charOf = (id) => (stickers().characters || []).find((c) => c.id === id);
const placeOf = (id) => data().places.find((p) => p.id === id);
const placeArt = (p, w = '600') => { const b = p && p.bg ? R.bgOf(p.bg) : null; return b ? '<img src="' + esc(b.src[w]) + '" alt="" draggable="false">' : '<span class="advicon">' + (R.ICONS[p ? p.icon : 'star'] || '') + '</span>'; };
const STEPS = [['start', 'Hero'], ['scenes', 'Scenes'], ['choices', 'Choices'], ['title', 'Title']];

function guard(main) {
  if (adventure() && adventureVisible(kind())) return true;
  location.replace('#/');
  return false;
}
function page(main, { eyebrow = 'Story Adventure', title, step = 'start', body = '' }) {
  const at = STEPS.findIndex(([s]) => s === step);
  main.innerHTML = '<section class="wrap page studio adventure" data-adv="' + esc(step) + '"><div class="pagehead"><span class="eyebrow">' + esc(eyebrow) + '</span><h1>' + esc(title) + '</h1></div>'
    + '<ol class="stepbar movebar" aria-label="Steps">' + STEPS.map(([s, label], k) => '<li class="' + (k < at ? 'is-done' : '') + (k === at ? ' is-on' : '') + '"' + (k === at ? ' aria-current="step"' : '') + '>' + label + '</li>').join('') + '</ol>'
    + '<div class="studio__body" data-body>' + body + '</div></section>';
  return main.querySelector('[data-body]');
}
const card = (title, line, action = '') => '<div class="card empty advnote" data-advnote><h2 data-focus tabindex="-1">' + esc(title) + '</h2><p class="muted">' + esc(line) + '</p>' + action + '</div>';
const ASK_CREDITS = 'Ask a grown-up to add story credits';
const ASK_CONSENT = 'Ask a grown-up to switch on Story Adventure';

// ---- the start --------------------------------------------------------------------------------
export function start(main) {
  if (!guard(main)) return undefined;
  const d = S.readAdventures();
  const open = Object.values(d.stories).filter((s) => s.stage !== 'done').sort((a, b) => b.at - a.at);
  let level = open[0] ? open[0].level : 3;
  let stopped = false;
  const hero = {};
  let heroName = '';
  let place = '';
  let goal = '';
  let stage = 'intro';
  const body = page(main, { title: 'Story Adventure', body: '<p class="muted">Checking…</p>' });
  const draw = (status) => {
    if (stopped) return;
    if (stage === 'intro') {
      const gate = kind() === 'adult'
        ? card('For a child to play', 'Grown-ups can look around. To draw pictures, play as one of your children.')
        : !status || status.problem ? card('Story Adventure needs the internet', 'Connect, then try again.', '<button type="button" class="btn btn--primary" data-again>Try again</button>')
        : !status.enabled ? card('Story Adventure is resting', 'The pictures can\'t be drawn just now. Try again another day.')
        : !status.consent ? card(ASK_CONSENT, 'A grown-up can turn it on for you in Grown-ups.')
        : !status.canStart ? card(ASK_CREDITS, 'Each new story needs one. Your stories so far are all still here.') : '';
      body.innerHTML = instruct('Make your own adventure! Choose a hero, a place and a goal. Then decide what happens, scene by scene, and the pictures are drawn for you.', 'star')
        + (open.length ? '<h2 class="sectionhead">Carry on</h2><div class="list">' + open.map((s) => '<a class="card listrow" href="#/adv/' + esc(s.id) + '" data-going="' + esc(s.id) + '"><span><strong>' + esc(s.title || AD.heroLabel(s) + '\'s adventure') + '</strong><br><span class="muted small">' + esc(AD.scenesMade(s).length + ' scenes so far') + '</span></span>' + ICON.arrow + '</a>').join('') + '</div>' : '')
        + gate
        + (gate ? '' : '<div class="card levelcard" data-level="' + level + '"><p><b>Level: Year ' + level + '</b><br><span class="muted small">' + (level === 3 ? 'You tap to choose what happens.' : 'Tap, or type your own sentences.') + '</span></p><div class="btnrow">'
          + '<button type="button" class="btn btn--ghost btn--small" data-easier' + (level <= 3 ? ' disabled' : '') + '>' + R.ICONS.minus + 'Make it easier</button><button type="button" class="btn btn--ghost btn--small" data-harder' + (level >= 6 ? ' disabled' : '') + '>' + R.ICONS.plus + 'Make it harder</button></div></div>'
          + '<div class="btnrow"><button type="button" class="btn btn--primary btn--big" data-new>Start a new adventure' + ICON.arrow + '</button></div>');
      wireHear(body);
      wireLevel(body, () => level, (n) => { level = n; draw(status); });
      const again = body.querySelector('[data-again]');
      if (again) again.addEventListener('click', () => storyApi().status().then(draw));
      const go = body.querySelector('[data-new]');
      if (go) go.addEventListener('click', () => { stage = 'hero'; draw(status); focusStep(main); });
      return;
    }
    if (stage === 'hero') {
      const chars = stickers().characters;
      body.innerHTML = instruct('Who is your hero? Tap one, or describe your own.', 'person')
        + '<div class="pickgrid">' + chars.map((c) => '<span class="tilewrap"><button type="button" class="pick pick--sticker" data-hero="' + esc(c.id) + '"><img src="' + esc(c.poses.a) + '" alt="" draggable="false"><span>' + esc(c.name) + '</span></button>' + R.hearBtn(c.name) + '</span>').join('') + '</div>'
        + '<div class="btnrow"><button type="button" class="btn btn--ghost" data-describe>' + R.ICONS.idea + 'Describe my own hero</button></div>';
      wireHear(body);
      body.querySelectorAll('[data-hero]').forEach((b) => b.addEventListener('click', () => {
        Object.keys(hero).forEach((k) => delete hero[k]);
        hero.sticker = b.dataset.hero;
        heroName = charOf(hero.sticker).name;
        speakLine(heroName);
        stage = 'place'; draw(status); focusStep(main);
      }));
      body.querySelector('[data-describe]').addEventListener('click', () => { Object.keys(hero).forEach((k) => delete hero[k]); stage = 'kind'; draw(status); focusStep(main); });
      return;
    }
    const D = data();
    const pickStep = (line, icon, list, attr, onPick, { swatch = false } = {}) => {
      body.innerHTML = instruct(line, icon) + '<div class="ctiles' + (swatch ? ' ctiles--swatch' : '') + '">' + list.map((x) => '<span class="tilewrap"><button type="button" class="ctile' + (swatch ? ' ctile--swatch' : '') + '" ' + attr + '="' + esc(x.id) + '"' + (x.swatch ? ' data-swatch="' + esc(x.swatch) + '"' : '') + '>' + (x.icon ? R.ICONS[x.icon] || '' : '') + (x.swatch ? '<i class="swatch" aria-hidden="true"></i>' : '') + esc(x.label) + '</button>' + R.hearBtn(x.label) + '</span>').join('') + '</div>';
      body.querySelectorAll('[data-swatch]').forEach((b) => b.querySelector('.swatch').style.setProperty('--swatch', b.dataset.swatch));
      wireHear(body);
      body.querySelectorAll('[' + attr + ']').forEach((b) => b.addEventListener('click', () => { const x = list.find((y) => y.id === b.getAttribute(attr)); speakLine(x.label); onPick(x.id); draw(status); focusStep(main); }));
    };
    const person = () => D.kinds.find((k) => k.id === hero.kind).person;
    if (stage === 'kind') return pickStep('Your hero is…', 'person', D.kinds, 'data-kind', (v) => { hero.kind = v; stage = person() ? 'skin' : 'body'; });
    if (stage === 'skin') return pickStep('Choose their skin.', 'person', D.skin, 'data-skin', (v) => { hero.skin = v; stage = 'hair'; }, { swatch: true });
    if (stage === 'hair') return pickStep('Choose their hair.', 'person', D.hair, 'data-hair', (v) => { hero.hair = v; stage = 'hairColour'; });
    if (stage === 'hairColour') return pickStep('What colour is their hair?', 'person', D.hairColours, 'data-haircol', (v) => { hero.hairColour = v; stage = 'top'; });
    if (stage === 'body') return pickStep('What colour are they?', 'dog', D.colours, 'data-body', (v) => { hero.body = v; stage = 'top'; }, { swatch: true });
    if (stage === 'top') return pickStep(person() ? 'What colour is their top?' : 'What colour is their scarf?', 'person', D.colours, 'data-top', (v) => { hero.top = v; stage = person() ? 'bottom' : 'name'; }, { swatch: true });
    if (stage === 'bottom') return pickStep('What colour are their trousers?', 'person', D.colours, 'data-bottom', (v) => { hero.bottom = v; stage = 'name'; }, { swatch: true });
    if (stage === 'name') return pickStep('What is your hero called?', 'person', D.names.map((n) => ({ id: n, label: n })), 'data-name', (v) => { heroName = v; stage = 'place'; });
    if (stage === 'place') {
      body.innerHTML = instruct('Where does the adventure happen?', 'house') + '<div class="pickgrid pickgrid--wide">' + D.places.map((p) => '<span class="tilewrap"><button type="button" class="pick" data-place="' + esc(p.id) + '">' + placeArt(p) + '<span>' + esc(p.label) + '</span></button>' + R.hearBtn(p.label) + '</span>').join('') + '</div>';
      wireHear(body);
      body.querySelectorAll('[data-place]').forEach((b) => b.addEventListener('click', () => { place = b.dataset.place; speakLine(placeOf(place).label); stage = 'goal'; draw(status); focusStep(main); }));
      return;
    }
    if (stage === 'goal') return pickStep('What does ' + heroName + ' want to do?', 'star', D.goals, 'data-goal', (v) => { goal = v; stage = 'style'; });
    if (stage === 'style') {
      body.innerHTML = instruct('How should the pictures look?', 'star') + '<div class="choices">' + D.styles.map((s) => '<span class="tilewrap"><button type="button" class="choice advstyle advstyle--' + esc(s.id) + '" data-style="' + esc(s.id) + '"><span>' + esc(s.label) + '</span></button>' + R.hearBtn(s.label) + '</span>').join('') + '</div>';
      wireHear(body);
      body.querySelectorAll('[data-style]').forEach((b) => b.addEventListener('click', () => {
        const id = S.newStoryId();
        S.updateAdventures((d0) => AD.startAdventure(d0, { id, now: Date.now(), level, hero: { ...hero }, heroName, place, goal, style: b.dataset.style }));
        location.hash = '#/adv/' + id;
      }));
    }
  };
  storyApi().status().then((st) => draw(st));
  return () => { stopped = true; stop(); };
}

// ---- making the story ----------------------------------------------------------------------------
const sceneTitle = (no) => (no === 7 ? 'The other path' : no === 8 ? 'The other ending' : 'Scene ' + no + ' of 6');
function panel(s, no, { big = false, cls = '' } = {}) {
  const sc = s.scenes[no] || AD.blankScene();
  const cap = AD.sceneCaption(s, no, data());
  const feel = AD.feelLine(s, no, feelNames());
  const say = AD.sayLine(s, no);
  const img = sc.image ? '<img src="' + esc(storyApi().imageUrl(sc.image.id)) + '" alt="' + esc(AD.builtCaption(s, no, data())) + '" width="800" height="600" decoding="async"' + (big ? '' : ' loading="lazy"') + '>' : '<span class="panel__n" aria-hidden="true">' + (s.failed && sc.feel ? R.ICONS.book : no) + '</span>';
  return '<figure class="panel ' + cls + (sc.image ? ' is-done' : '') + '" data-scene="' + no + '"><div class="panel__art">' + img + '</div>'
    + (say ? '<p class="bubble"><span class="sr">' + esc(AD.heroLabel(s)) + ' says: </span>' + esc(say) + '</p>' : '')
    + '<figcaption class="caption">' + (cap ? '<span class="caption__line">' + esc(cap) + '</span>' : '<span class="caption__empty">&nbsp;</span>') + (feel ? ' <span class="caption__line">' + esc(feel) + '</span>' : '') + '</figcaption></figure>';
}
const strip = (s) => '<div class="comic comic--strip adv-strip" role="group" aria-label="My adventure so far">' + AD.scenesMade(s).map((n) => panel(s, n)).join('') + '</div>';

export function make(main, { sid }) {
  if (!guard(main)) return undefined;
  const s = fresh(sid);
  if (!s) { location.replace('#/adv'); return undefined; }
  if (s.stage === 'done') { location.replace('#/adv/' + sid + '/read'); return undefined; }
  useOwnWords(AD.typedBitsOf(s));
  const D = data();
  const next = AD.nextStep(s);
  moveFinished(sid + ':' + next.step + ':' + (next.no || next.at || '') + ':' + (next.sub === 'draw' ? 'draw' : ''));
  const redraw = () => { stop(); make(main, { sid }); focusStep(main); };
  const sc = K.scaffold(s.level);
  const setScene = (no, fields) => save((d, now) => AD.changeScene(d, sid, no, fields, now));

  if (next.step === 'title') {
    const first = s.scenes[1] && s.scenes[1].choice;
    const ideas = K.ownTitleIdeas(AD.heroLabel(s), first ? D.objects[first.object].label : '', placeOf(s.place) ? placeOf(s.place).label : '');
    const body = page(main, { title: 'Give it a title', step: 'title', body: '' });
    body.innerHTML = strip(s) + instruct('Every adventure needs a title. Tap one you like.', 'book') + '<div class="ctiles">' + ideas.map((x) => tileBtn(x, 'data-title="' + esc(x) + '"')).join('') + '</div>'
      + (sc.typeOwn ? '<details class="ownbubble"><summary class="btn btn--quiet btn--small">Type my own</summary><div class="stack"><label class="sr" for="advtitle">My title</label><input id="advtitle" class="field typed" maxlength="' + AD.LIMITS.title + '" autocomplete="off" spellcheck="false" data-titletext><button type="button" class="btn btn--ghost btn--small" data-titleown>Use my title</button></div></details>' : '') + gentleSlot();
    wireHear(body);
    const finish = (title, typed) => { save((d, now) => AD.change(d, sid, { title, titleTyped: typed, stage: 'done' }, now)); justFinished = sid; location.hash = '#/adv/' + sid + '/read'; };
    body.querySelectorAll('[data-title]').forEach((b) => b.addEventListener('click', () => { speakLine(b.dataset.title); finish(b.dataset.title, false); }));
    const own = body.querySelector('[data-titleown]');
    if (own) own.addEventListener('click', async () => { const v = body.querySelector('[data-titletext]').value.trim(); if (await typedOk(body, v, { max: AD.LIMITS.title })) finish(v, true); });
    return stop;
  }

  if (next.step === 'fork') {
    const f = s.forks[next.at] || {};
    const list = AD.forkChoices(s, next.at, D).filter((p) => !f.a || p.action + p.object !== f.a.action + f.a.object);
    const body = page(main, { title: 'A choice for your readers', step: 'choices' });
    const line = next.pick === 'a'
      ? 'Your readers will choose what ' + AD.heroLabel(s) + ' does next. First: what happens in YOUR story?'
      : 'Now the other path: what could ' + AD.heroLabel(s) + ' do instead?';
    body.innerHTML = strip(s) + instruct(line, 'path') + '<div class="choices">' + list.map((p, k) => '<span class="tilewrap"><button type="button" class="choice" data-fork="' + k + '"><span>' + esc(AD.choiceLabel(p, D)) + '</span></button>' + R.hearBtn(AD.choiceLabel(p, D)) + '</span>').join('') + '</div>';
    wireHear(body);
    body.querySelectorAll('[data-fork]').forEach((b) => b.addEventListener('click', () => {
      const p = list[Number(b.dataset.fork)];
      speakLine(AD.choiceLabel(p, D));
      save((d, now) => {
        const st = d.stories[sid];
        const forks = { ...st.forks, [next.at]: { ...(st.forks[next.at] || {}), [next.pick]: p } };
        const target = AD.FORKS[next.at][next.pick];
        return AD.changeScene(AD.change(d, sid, { forks }, now), sid, target, { choice: p }, now);
      });
      redraw();
    }));
    return stop;
  }

  const no = next.no;
  const scene = s.scenes[no] || AD.blankScene();
  const body = page(main, { title: sceneTitle(no), step: 'scenes' });
  const head = strip(s);

  if (next.sub === 'what') {
    const list = AD.choicesFor(s, no, D);
    body.innerHTML = head + instruct('What happens next? Tap an idea' + (sc.typeOwn ? ', or write your own sentence.' : '.'), 'idea')
      + '<div class="choices">' + list.map((p, k) => '<span class="tilewrap"><button type="button" class="choice" data-choice="' + k + '"><span>' + esc(AD.choiceLabel(p, D)) + '</span></button>' + R.hearBtn(AD.choiceLabel(p, D)) + '</span>').join('') + '</div>'
      + (sc.typeOwn ? '<details class="ownbubble"><summary class="btn btn--quiet btn--small">Write my own sentence</summary><div class="stack"><label class="sr" for="advtext">What happens next</label><textarea id="advtext" class="field typed" rows="2" maxlength="' + AD.LIMITS.sentence + '" spellcheck="false" data-advtext></textarea><button type="button" class="btn btn--ghost btn--small" data-advown>Use my sentence</button></div></details>' : '')
      + gentleSlot() + '<div class="picktray" data-picktray hidden></div>';
    wireHear(body);
    body.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => {
      const p = list[Number(b.dataset.choice)];
      speakLine(AD.choiceLabel(p, D));
      setScene(no, { choice: p, text: '', typed: false });
      redraw();
    }));
    const own = body.querySelector('[data-advown]');
    if (own) own.addEventListener('click', async () => {
      const v = body.querySelector('[data-advtext]').value.trim();
      if (!(await typedOk(body, v, { max: AD.LIMITS.sentence, minWords: 3 }))) return;
      const m = AD.matchTyped(v, D);
      if (m) { setScene(no, { choice: m, text: v, typed: true }); redraw(); return; }
      // The picture is drawn from our lists, never from the child's words: which idea is closest?
      const tray = body.querySelector('[data-picktray]');
      tray.hidden = false;
      tray.innerHTML = instruct('Great sentence! Which picture fits it best?', 'idea') + '<div class="choices">' + list.map((p, k) => '<span class="tilewrap"><button type="button" class="choice" data-fit="' + k + '"><span>' + esc(AD.choiceLabel(p, D)) + '</span></button></span>').join('') + '</div>';
      wireHear(tray);
      tray.querySelectorAll('[data-fit]').forEach((b) => b.addEventListener('click', () => { setScene(no, { choice: list[Number(b.dataset.fit)], text: v, typed: true }); redraw(); }));
      focusStep(tray);
    });
    return stop;
  }

  if (next.sub === 'feel') {
    const feelings = comicShared().feelings;
    body.innerHTML = head + '<div class="card setting"><p class="bigline">' + esc(AD.sceneCaption(s, no, D)) + ' ' + R.hearBtn(AD.sceneCaption(s, no, D), 'Hear the sentence') + '</p></div>'
      + instruct('How does ' + AD.heroLabel(s) + ' feel? Tap a face.', 'person')
      + '<div class="faces">' + feelings.map((f) => '<button type="button" class="facebtn" data-face="' + f.id + '">' + R.faceSvg(f.id) + '<span>' + R.FEELING_NAMES[f.id] + '</span></button>').join('') + '</div>';
    wireHear(body);
    body.querySelectorAll('[data-face]').forEach((b) => b.addEventListener('click', () => { speakLine(R.FEELING_NAMES[b.dataset.face]); setScene(no, { feel: b.dataset.face }); redraw(); }));
    return stop;
  }

  if (next.sub === 'say') {
    body.innerHTML = head + instruct('Add a speech bubble for ' + AD.heroLabel(s) + '? You can skip this.', 'people')
      + '<div class="ctiles">' + D.speech.map((x) => tileBtn(x, 'data-say="' + esc(x) + '"')).join('') + '</div>'
      + (sc.typeOwn ? '<details class="ownbubble"><summary class="btn btn--quiet btn--small">Type my own</summary><div class="stack"><label class="sr" for="advbubble">What they say</label><input id="advbubble" class="field typed" maxlength="' + AD.LIMITS.bubble + '" autocomplete="off" spellcheck="false" data-advbubble><button type="button" class="btn btn--ghost btn--small" data-advsay>Use my words</button></div></details>' : '')
      + gentleSlot() + '<div class="btnrow"><button type="button" class="btn btn--quiet" data-nosay>No speech bubble</button></div>';
    wireHear(body);
    body.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => { speakLine(b.dataset.say); setScene(no, { say: { text: b.dataset.say, typed: false } }); redraw(); }));
    const own = body.querySelector('[data-advsay]');
    if (own) own.addEventListener('click', async () => { const v = body.querySelector('[data-advbubble]').value.trim(); if (await typedOk(body, v, { max: AD.LIMITS.bubble })) { setScene(no, { say: { text: v, typed: true } }); redraw(); } });
    body.querySelector('[data-nosay]').addEventListener('click', () => { setScene(no, { say: { skip: true } }); redraw(); });
    return stop;
  }

  // next.sub === 'draw'
  let busy = false;
  const ready = (line = '') => {
    body.innerHTML = head + '<div class="stage advstage">' + panel(s, no, { big: true }) + '</div>' + (line ? '<p class="gentle" role="status">' + esc(line) + '</p>' : '')
      + instruct('Your scene is ready. Tap Draw my scene and a picture will be drawn for it.', 'star')
      + '<div class="btnrow"><button type="button" class="btn btn--primary btn--big" data-draw>' + R.ICONS.idea + 'Draw my scene</button>'
      + (![4, 6, 7, 8].includes(no) ? '<button type="button" class="btn btn--quiet" data-change>Change my idea</button>' : '') + '</div>';
    wireHear(body);
    body.querySelector('[data-draw]').addEventListener('click', drawIt);
    const ch = body.querySelector('[data-change]');
    if (ch) ch.addEventListener('click', () => { setScene(no, { choice: null, text: '', typed: false, feel: '' }); redraw(); });
  };
  const waiting = () => {
    body.innerHTML = head + '<div class="card drawing" data-drawing role="status" aria-live="polite"><div class="drawing__anim' + (reduced() ? ' is-still' : '') + '" aria-hidden="true"><span class="drawing__page"></span><span class="drawing__pencil">' + R.ICONS.fix + '</span></div>'
      + '<h2 data-focus tabindex="-1">Your picture is being drawn</h2><p class="muted">This takes a little while. Every picture is checked before you see it.</p></div>';
    focusStep(main);
    speakLine('Your picture is being drawn');
  };
  const message = (title, line, buttons) => {
    body.innerHTML = head + '<div class="card advnote" data-advresult><h2 data-focus tabindex="-1">' + esc(title) + '</h2><p class="muted">' + esc(line) + '</p><div class="btnrow">' + buttons + '</div></div>';
    focusStep(main);
    speakLine(title);
  };
  async function drawIt() {
    if (busy) return;
    busy = true;
    waiting();
    const r = await storyApi().draw(AD.sceneRequest(fresh(sid), no, D));
    busy = false;
    if (r.kind === 'ok') {
      setScene(no, { image: { id: r.imageId } });
      const st = fresh(sid);
      body.innerHTML = AD.scenesMade(st).length ? strip(st) : '';
      wellDone(body, { title: 'Here is your picture!', line: '' }, redraw);
      const box = body.querySelector('[data-welldone]');
      box.insertAdjacentHTML('afterbegin', '<div class="stage advstage">' + panel(st, no, { big: true }) + '</div>');
      if (r.attemptsLeft > 0) {
        box.querySelector('.btnrow').insertAdjacentHTML('beforeend', '<button type="button" class="btn btn--quiet" data-redraw>Draw it again</button>');
        box.querySelector('[data-redraw]').addEventListener('click', () => { setScene(no, { image: null }); drawIt(); });
      }
      return;
    }
    if (r.kind === 'blocked' && r.failed) {
      save((d, now) => AD.change(d, sid, { failed: true }, now));
      message('Let\'s carry on with words', 'This picture couldn\'t be drawn. Your story is saved, and it can carry on with words.', '<button type="button" class="btn btn--primary" data-on>Carry on' + ICON.arrow + '</button>');
      body.querySelector('[data-on]').addEventListener('click', redraw);
      return;
    }
    if (r.kind === 'blocked') {
      message('Let\'s try a different idea', 'That picture didn\'t come out right. Draw it again, or change your idea.', '<button type="button" class="btn btn--primary" data-again>' + R.ICONS.idea + 'Draw it again</button>'
        + (![4, 6, 7, 8].includes(no) ? '<button type="button" class="btn btn--ghost" data-change>Change my idea</button>' : ''));
      body.querySelector('[data-again]').addEventListener('click', drawIt);
      const ch = body.querySelector('[data-change]');
      if (ch) ch.addEventListener('click', () => { setScene(no, { choice: null, text: '', typed: false, feel: '' }); redraw(); });
      return;
    }
    if (r.kind === 'no-credits') { message(ASK_CREDITS, 'Your story is saved. You can carry on once a grown-up has added some.', '<a class="btn btn--primary" href="#/adv">Back</a>'); return; }
    if (r.kind === 'no-consent') { message(ASK_CONSENT, 'Your story is saved.', '<a class="btn btn--primary" href="#/adv">Back</a>'); return; }
    ready(r.kind === 'busy' ? 'Lots of pictures today! Try again in a little while.' : 'The picture couldn\'t be drawn just now. Try again in a moment.');
  }
  ready();
  return stop;
}

async function typedOk(root, text, opts) {
  const isKnown = await loadKnownWords();
  const names = [...data().names, ...stickers().characters.map((c) => c.name)];
  const r = checkTyped(text, isKnown, { extra: names, ...opts });
  if (!r.ok) gentle(root, typedNote(r, opts));
  return r.ok;
}

// ---- the finished adventure --------------------------------------------------------------------------
let justFinished = '';
const LAYOUT_KEY = 'cp.advLayout';
const savedLayout = () => { try { return localStorage.getItem(LAYOUT_KEY) === 'manga' ? 'manga' : 'comic'; } catch (e) { return 'comic'; } };
export function read(main, { sid }) {
  if (!guard(main)) return undefined;
  const s = fresh(sid);
  if (!s) { location.replace('#/adv'); return undefined; }
  if (s.stage !== 'done') { location.replace('#/adv/' + sid); return undefined; }
  useOwnWords(AD.typedBitsOf(s));
  const D = data();
  const isNew = justFinished === sid;
  justFinished = '';
  let layout = savedLayout();
  const title = s.title || AD.heroLabel(s) + '\'s adventure';
  const lines = () => AD.mainPath.flatMap((n) => [AD.sceneCaption(s, n, D), AD.feelLine(s, n, feelNames()), AD.sayLine(s, n)]).filter(Boolean);
  const draw = () => {
    main.innerHTML = '<section class="wrap page comicpage adventure" data-advread><div class="pagehead noprint"><span class="eyebrow">My adventures</span><h1 data-final>' + esc(title) + '</h1></div>'
      + (isNew ? '<p class="welcome" data-focus tabindex="-1">Your adventure is finished, and it has earned a stamp!</p>' : '')
      + '<div class="cover"><div class="cover__art">' + (s.scenes[1] && s.scenes[1].image ? '<img src="' + esc(storyApi().imageUrl(s.scenes[1].image.id)) + '" alt="">' : placeArt(placeOf(s.place))) + '</div><div class="cover__words"><span class="cover__kicker">A Waystead adventure</span><h2 class="cover__title">' + esc(title) + '</h2>' + (playerName() ? '<p class="cover__by">by ' + esc(playerName()) + '</p>' : '') + '</div><span class="stamp" aria-label="Finished: a stamp">' + R.ICONS.stamp + '</span></div>'
      + '<div class="btnrow noprint"><span class="segmented" role="group" aria-label="Layout"><button type="button" class="btn btn--small" data-layout="comic" aria-pressed="' + (layout === 'comic') + '">Comic</button><button type="button" class="btn btn--small" data-layout="manga" aria-pressed="' + (layout === 'manga') + '">Manga</button></span>'
      + '<a class="btn btn--primary" href="#/adv/' + esc(sid) + '/play" data-play>' + R.ICONS.path + 'Play my adventure</a><button type="button" class="btn btn--ghost" data-readall aria-pressed="false">' + R.ICONS.play + 'Read it to me</button><button type="button" class="btn btn--ghost" data-print>' + R.ICONS.print + 'Print</button></div>'
      + (layout === 'manga' ? '<p class="small muted noprint">Manga reads from right to left: start at the top right.</p>' : '')
      + '<div class="comic comic--big adv-comic adv-comic--' + layout + '" role="group" aria-label="My adventure">' + AD.mainPath.map((n) => panel(s, n, { big: true })).join('') + '</div>'
      + (s.scenes[7] || s.scenes[8] ? '<h2 class="sectionhead">The other paths</h2><p class="muted small">Readers who choose differently see these.</p><div class="comic comic--big adv-comic adv-comic--' + layout + '">' + [7, 8].filter((n) => s.scenes[n]).map((n) => panel(s, n, { big: true })).join('') + '</div>' : '')
      + '<div class="btnrow noprint"><a class="btn btn--primary" href="#/adv">Make another' + ICON.arrow + '</a><a class="btn btn--ghost" href="#/comics">My comics</a></div></section>';
    main.querySelectorAll('[data-layout]').forEach((b) => b.addEventListener('click', () => { layout = b.dataset.layout; try { localStorage.setItem(LAYOUT_KEY, layout); } catch (e) { /* fine */ } draw(); main.querySelector('[data-layout="' + layout + '"]').focus(); }));
    const btn = main.querySelector('[data-readall]');
    let on = false;
    btn.addEventListener('click', async () => {
      if (on) { on = false; stop(); btn.setAttribute('aria-pressed', 'false'); return; }
      on = true; btn.setAttribute('aria-pressed', 'true');
      await speakLines(lines());
      on = false; btn.setAttribute('aria-pressed', 'false');
    });
    main.querySelector('[data-print]').addEventListener('click', () => window.print());
  };
  draw();
  if (isNew) { speakLine('Your adventure is finished!'); toast('A new stamp for My comics'); }
  return stop;
}

// ---- Play my adventure: the branching replay -------------------------------------------------------------
export function play(main, { sid }) {
  if (!guard(main)) return undefined;
  const s = fresh(sid);
  if (!s || s.stage !== 'done') { location.replace('#/adv'); return undefined; }
  useOwnWords(AD.typedBitsOf(s));
  const D = data();
  let at = 1;
  const seen = [];
  const draw = () => {
    const nx = AD.nextInPlay(at);
    const title = s.title || AD.heroLabel(s) + '\'s adventure';
    const lineOf = (n) => [AD.sceneCaption(s, n, D), AD.feelLine(s, n, feelNames()), AD.sayLine(s, n)].filter(Boolean).join(' ');
    const buttons = nx.fork
      ? '<p class="instruct" data-focus tabindex="-1">' + R.ICONS.path + '<span>' + esc(AD.forkQuestion(s)) + '</span>' + R.hearBtn(AD.forkQuestion(s), 'Hear the question') + '</p><div class="choices">'
        + ['a', 'b'].map((k) => { const p = s.forks[nx.fork] && s.forks[nx.fork][k]; return p ? '<span class="tilewrap"><button type="button" class="choice" data-go="' + nx[k] + '"><span>' + esc(AD.choiceLabel(p, D)) + '</span></button>' + R.hearBtn(AD.choiceLabel(p, D)) + '</span>' : ''; }).join('') + '</div>'
      : nx.end
        ? '<div class="card welldone"><h2>The end</h2><div class="btnrow btnrow--center"><button type="button" class="btn btn--primary" data-again>Play again</button><a class="btn btn--ghost" href="#/adv/' + esc(sid) + '/read">See the whole comic</a></div></div>'
        : '<div class="btnrow"><button type="button" class="btn btn--primary btn--big" data-go="' + nx.to + '">Next' + ICON.arrow + '</button></div>';
    main.innerHTML = '<section class="wrap page adventure advplay" data-advplay="' + at + '"><div class="pagehead"><span class="eyebrow">Play my adventure</span><h1>' + esc(title) + '</h1></div>'
      + '<div class="stage advstage">' + panel(s, at, { big: true }) + '</div>'
      + '<div class="btnrow"><button type="button" class="btn btn--ghost btn--small" data-hearscene>' + R.ICONS.play + 'Hear this page</button></div>'
      + buttons + '</section>';
    wireHear(main);
    main.querySelector('[data-hearscene]').addEventListener('click', () => speakLine(lineOf(at)));
    main.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { seen.push(at); at = Number(b.dataset.go); draw(); focusStep(main); main.querySelector('[data-hearscene]').focus(); }));
    const again = main.querySelector('[data-again]');
    if (again) again.addEventListener('click', () => { at = 1; seen.length = 0; draw(); });
  };
  draw();
  return stop;
}

/** For My comics: the finished adventures as covers, and the ones still being made. */
export function shelfHtml() {
  if (!adventure() || !adventureVisible(kind())) return '';
  const d = S.readAdventures();
  const all = Object.values(d.stories).sort((a, b) => b.at - a.at);
  const done = all.filter((s) => s.stage === 'done');
  const going = all.filter((s) => s.stage !== 'done');
  const cover = (s) => '<a class="card shelfitem" href="#/adv/' + esc(s.id) + '/read" data-advcover="' + esc(s.id) + '"><div class="cover"><div class="cover__art">' + (s.scenes[1] && s.scenes[1].image ? '<img src="' + esc(storyApi().imageUrl(s.scenes[1].image.id)) + '" alt="" loading="lazy">' : placeArt(placeOf(s.place))) + '</div><div class="cover__words"><h2 class="cover__title">' + esc(s.title || 'My adventure') + '</h2></div><span class="stamp" aria-hidden="true">' + R.ICONS.stamp + '</span></div><span class="muted small">Story Adventure</span></a>';
  return '<h2 class="sectionhead">My adventures</h2>'
    + (going.length ? '<div class="list">' + going.map((s) => '<a class="card listrow" href="#/adv/' + esc(s.id) + '" data-going="' + esc(s.id) + '"><span><strong>' + esc(AD.heroLabel(s) + '\'s adventure') + '</strong><br><span class="muted small">Carry on</span></span>' + ICON.arrow + '</a>').join('') + '</div>' : '')
    + (done.length ? '<div class="shelf">' + done.map(cover).join('') + '</div>' : '')
    + '<div class="shortcuts"><a class="card shortcut" href="#/adv" data-advlink><span><strong>Make a Story Adventure</strong><br><span class="muted small">Your own story, with pictures drawn for you</span></span>' + ICON.arrow + '</a></div>';
}
