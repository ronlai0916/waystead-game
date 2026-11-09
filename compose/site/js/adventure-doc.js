// Story Adventure (C2-3), the pure part: a child's own story, scene by scene,
// with an AI picture per scene drawn on the account's server. No DOM, no fetch,
// no Date.now (the time is passed in).
//
// Saved as the account key "adventures" (apart from "comics"), on the device as
// "cp.adventures:<player id>":
//   { v: 1, stories: { id: story }, deleted: { id: at } }
//   story: { id, at, level, stage: 'make'|'done', hero, heroName, place, goal, style,
//            scenes: { '1'..'8': { choice: {action, object}, text, typed, feel, say, image: {id}|null } },
//            forks: { '3': {a, b}, '5': {a, b} }, failed, title }
// Pictures live on the server; the save holds only their ids. A grown-up's
// delete leaves a tombstone in `deleted`, so no device can bring the story back.
//
// The scenes: 1, 2, 3, then the readers' choice at 3 (paths 4 and 7), 5, the
// choice at 5 (endings 6 and 8). Replayed as an adventure: 1 → 2 → 3 → (4 | 7) →
// 5 → (6 | 8) → the end.
//
// WHAT LEAVES THE DEVICE for a picture is sceneRequest(): ids from our lists
// only. A sentence the child typed stays the caption; the picture is drawn from
// the choice it was matched to (matchTyped), or one the child tapped.

export const ADVENTURES_KEY = 'adventures';
export const MAX_BYTES = 48 * 1024;
export const ORDER = [1, 2, 3, 'fork3', 4, 7, 5, 'fork5', 6, 8, 'title'];
export const FORKS = { 3: { a: 4, b: 7 }, 5: { a: 6, b: 8 } };
export const ALT = new Set([7, 8]);
export const LIMITS = { sentence: 140, bubble: 80, title: 50 };
const ID = /^[a-z0-9]{8,40}$/;

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');
const num = (v) => (Number.isFinite(v) ? v : 0);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const endStop = (s) => (/[.!?]["'”’]?$/.test(s) ? s : s + '.');

export const newStoryId = (bytes) => 'a' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

// ---- the save --------------------------------------------------------------------
function normaliseScene(s) {
  if (!isObj(s)) return null;
  const choice = isObj(s.choice) && str(s.choice.action) && str(s.choice.object) ? { action: s.choice.action, object: s.choice.object } : null;
  const say = s.say === null ? null : isObj(s.say) ? (s.say.skip ? { skip: true } : { text: str(s.say.text).slice(0, LIMITS.bubble), typed: !!s.say.typed }) : undefined;
  const out = { choice, text: str(s.text).slice(0, LIMITS.sentence), typed: !!s.typed, feel: str(s.feel), image: isObj(s.image) && /^[0-9a-f-]{36}$/.test(str(s.image.id)) ? { id: s.image.id } : null };
  if (say !== undefined) out.say = say;
  return out;
}
function normaliseHero(h) {
  if (!isObj(h)) return null;
  if (str(h.sticker)) return { sticker: h.sticker };
  if (!str(h.kind)) return null;
  const out = { kind: h.kind };
  for (const k of ['hair', 'hairColour', 'skin', 'body', 'top', 'bottom']) if (str(h[k])) out[k] = h[k];
  return out;
}
export function normaliseStory(s) {
  if (!isObj(s) || !ID.test(str(s.id))) return null;
  const scenes = {};
  if (isObj(s.scenes)) for (const [k, v] of Object.entries(s.scenes)) { const n = Number(k); const sc = normaliseScene(v); if (n >= 1 && n <= 8 && sc) scenes[n] = sc; }
  const forks = {};
  if (isObj(s.forks)) for (const k of ['3', '5']) { const f = s.forks[k]; if (isObj(f)) forks[k] = { a: isObj(f.a) ? { action: str(f.a.action), object: str(f.a.object) } : null, b: isObj(f.b) ? { action: str(f.b.action), object: str(f.b.object) } : null }; }
  return {
    id: s.id, kind: 'adventure', at: num(s.at), level: [3, 4, 5, 6].includes(s.level) ? s.level : 4, stage: s.stage === 'done' ? 'done' : 'make',
    hero: normaliseHero(s.hero), heroName: str(s.heroName).slice(0, 20), place: str(s.place), goal: str(s.goal), style: s.style === 'manga' ? 'manga' : 'comic',
    scenes, forks, failed: !!s.failed, title: str(s.title).slice(0, LIMITS.title), titleTyped: !!s.titleTyped,
  };
}
export function normaliseAdventures(d) {
  const out = { v: 1, stories: {}, deleted: {} };
  if (!isObj(d)) return out;
  if (isObj(d.deleted)) for (const [k, v] of Object.entries(d.deleted)) if (ID.test(k)) out.deleted[k] = num(v);
  if (isObj(d.stories)) for (const s of Object.values(d.stories)) { const n = normaliseStory(s); if (n && !out.deleted[n.id]) out.stories[n.id] = n; }
  return out;
}
const isDone = (s) => s.stage === 'done';
/** Two copies of the save: tombstones join; a story by id, finished beats unfinished, then the newer. */
export function mergeAdventures(a, b) {
  const x = normaliseAdventures(a);
  const y = normaliseAdventures(b);
  const deleted = { ...x.deleted };
  for (const [k, v] of Object.entries(y.deleted)) deleted[k] = Math.max(deleted[k] || 0, v);
  const stories = {};
  for (const id of new Set([...Object.keys(x.stories), ...Object.keys(y.stories)])) {
    if (deleted[id]) continue;
    const p = x.stories[id];
    const q = y.stories[id];
    if (!p || !q) { stories[id] = p || q; continue; }
    if (isDone(p) !== isDone(q)) stories[id] = isDone(p) ? p : q;
    else stories[id] = q.at > p.at ? q : p;
  }
  return { v: 1, stories, deleted };
}
/** Under the size cap: the oldest unfinished stories go first; a finished one is never dropped. */
export function trimAdventures(d) {
  const out = normaliseAdventures(d);
  const size = () => JSON.stringify(out).length;
  const unfinished = Object.values(out.stories).filter((s) => !isDone(s)).sort((p, q) => p.at - q.at);
  while (size() > MAX_BYTES && unfinished.length) delete out.stories[unfinished.shift().id];
  const tomb = Object.entries(out.deleted).sort((p, q) => p[1] - q[1]);
  while (size() > MAX_BYTES && tomb.length > 50) delete out.deleted[tomb.shift()[0]];
  return out;
}
export const isFull = (d) => JSON.stringify(normaliseAdventures(d)).length > MAX_BYTES - 4096;

export function change(d, id, fields, now) {
  const s = d.stories[id];
  if (!s) return d;
  return { ...d, stories: { ...d.stories, [id]: { ...s, ...fields, at: now } } };
}
export function changeScene(d, id, no, fields, now) {
  const s = d.stories[id];
  if (!s) return d;
  return change(d, id, { scenes: { ...s.scenes, [no]: { ...(s.scenes[no] || blankScene()), ...fields } } }, now);
}
export const blankScene = () => ({ choice: null, text: '', typed: false, feel: '', image: null });

export function startAdventure(d, { id, now, level, hero, heroName, place, goal, style }) {
  const story = normaliseStory({ id, at: now, level, hero, heroName, place, goal, style, scenes: {}, forks: {} });
  return { ...d, stories: { ...d.stories, [id]: story } };
}
/** A grown-up deleted it: gone here, and a tombstone so no other copy brings it back. */
export function forget(d, id, now) {
  const stories = { ...d.stories };
  delete stories[id];
  return { ...d, stories, deleted: { ...d.deleted, [id]: now } };
}

// ---- the steps ----------------------------------------------------------------------
/** Where the child is: { step: 'scene', no, sub } | { step: 'fork', at, pick } | { step: 'title' } | { step: 'done' }. */
export function nextStep(s) {
  if (isDone(s)) return { step: 'done' };
  for (const at of ORDER) {
    if (at === 'title') return { step: 'title' };
    if (typeof at === 'string') {
      const n = Number(at.slice(4));
      const f = s.forks[n] || {};
      if (!f.a) return { step: 'fork', at: n, pick: 'a' };
      if (!f.b) return { step: 'fork', at: n, pick: 'b' };
      continue;
    }
    const sc = s.scenes[at] || blankScene();
    if (!sc.choice) return { step: 'scene', no: at, sub: 'what' };
    if (!sc.feel) return { step: 'scene', no: at, sub: 'feel' };
    if (sc.say === undefined && !ALT.has(at)) return { step: 'scene', no: at, sub: 'say' };
    if (!sc.image && !s.failed) return { step: 'scene', no: at, sub: 'draw' };
  }
  return { step: 'title' };
}
/** Scenes made so far, in the order they were made. */
export const scenesMade = (s) => ORDER.filter((n) => typeof n === 'number' && s.scenes[n] && s.scenes[n].choice);

const stageOf = (no) => (no <= 2 ? 'start' : [3, 4, 7].includes(no) ? 'middle' : 'end');
function seeded(seed) {
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}
const pairKey = (p) => p.action + '/' + p.object;
/** Three "What happens next?" choices from the story's goal, never one already used. Templates, not AI. */
export function choicesFor(s, no, data, n = 3) {
  const goal = data.paths[s.goal] || data.paths[Object.keys(data.paths)[0]];
  const used = new Set(Object.values(s.scenes).filter((x) => x && x.choice).map((x) => pairKey(x.choice)));
  for (const f of Object.values(s.forks)) for (const p of [f.a, f.b]) if (p) used.add(pairKey(p));
  const pool = goal[stageOf(no)].map(([action, object]) => ({ action, object })).filter((p) => !used.has(pairKey(p)));
  const rnd = seeded(s.id + ':' + no);
  const list = [...pool];
  for (let i = list.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  const out = list.slice(0, n);
  if (out.length < n) for (const [action, object] of goal.end) if (out.length < n && !out.some((p) => pairKey(p) === action + '/' + object)) out.push({ action, object });
  return out;
}
export const forkChoices = (s, at, data) => choicesFor(s, FORKS[at].a, data, 4);

export const heroLabel = (s) => s.heroName || 'The hero';
/** "Find the map" — a choice as a tile. */
export const choiceLabel = (p, data) => cap(data.actions[p.action].do + ' ' + data.objects[p.object].label);
/** The caption we build: "Suddenly, Amara found the map." */
export function builtCaption(s, no, data) {
  const sc = s.scenes[no];
  if (!sc || !sc.choice) return '';
  const opener = data.openers[no] || '';
  return endStop(cap((opener ? opener + ' ' : '') + heroLabel(s) + ' ' + data.actions[sc.choice.action].did + ' ' + data.objects[sc.choice.object].label));
}
export const sceneCaption = (s, no, data) => { const sc = s.scenes[no]; return sc && sc.typed && sc.text.trim() ? endStop(cap(sc.text.trim())) : builtCaption(s, no, data); };
export const feelLine = (s, no, names) => { const sc = s.scenes[no]; return sc && sc.feel ? heroLabel(s) + ' felt ' + (names[sc.feel] || sc.feel).toLowerCase() + '.' : ''; };
export const sayLine = (s, no) => { const sc = s.scenes[no]; return sc && sc.say && sc.say.text ? sc.say.text : ''; };

/** A typed sentence matched to our lists: the first doing word, and a thing it can be done to. Null: ask the child to tap. */
export function matchTyped(text, data) {
  const words = str(text).toLowerCase().match(/[a-z]+/g) || [];
  const objectsSeen = Object.entries(data.objects).filter(([, o]) => o.words.some((w) => words.includes(w))).map(([k]) => k);
  for (const w of words) {
    for (const [action, a] of Object.entries(data.actions)) {
      if (!a.words.includes(w)) continue;
      const object = objectsSeen.find((o) => a.objects.includes(o));
      if (object) return { action, object };
    }
  }
  return null;
}

/** Exactly what goes to the picture server: ids from our lists, nothing the child typed. */
export function sceneRequest(s, no, data) {
  const sc = s.scenes[no];
  return {
    storyId: s.id,
    sceneNo: no,
    start: { hero: s.hero, style: s.style, goal: s.goal },
    scene: { place: s.place, action: sc.choice.action, object: sc.choice.object, feeling: sc.feel, time: s.place === 'space' ? 'night' : data.times[no] || 'afternoon' },
  };
}

// ---- reading and replaying -----------------------------------------------------------------
/** The comic in reading order (the child's own path): 1, 2, 3, 4, 5, 6. */
export const mainPath = [1, 2, 3, 4, 5, 6];
/** Replay as an adventure: from a scene, where can a reader go? A fork offers both paths. */
export function nextInPlay(at) {
  if (at === 3 || at === 5) return { fork: at, a: FORKS[at].a, b: FORKS[at].b };
  if (at === 4 || at === 7) return { to: 5 };
  if (at === 6 || at === 8) return { end: true };
  return { to: at + 1 };
}
export const forkQuestion = (s) => 'What should ' + heroLabel(s) + ' do?';

/** The child's own typed words in this story (speech.js keeps them off the voice server). */
export function typedBitsOf(s) {
  const out = [];
  for (const sc of Object.values(s.scenes || {})) {
    if (sc.typed && sc.text) out.push(sc.text);
    if (sc.say && sc.say.typed && sc.say.text) out.push(sc.say.text);
  }
  if (s.titleTyped && s.title) out.push(s.title);
  return out.map((t) => (t.toLowerCase().match(/[a-z0-9]+(?:'[a-z0-9]+)*/g) || []).join(' ')).filter(Boolean);
}
/** Every picture id in the story. */
export const imagesOf = (s) => Object.values(s.scenes).map((x) => x.image && x.image.id).filter(Boolean);
