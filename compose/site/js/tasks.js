// The tasks (data/tasks.json). A task reaches children only with `reviewed: true`
// in that file, set by tools/approve-tasks.mjs. Adults signed in as themselves
// see every task, so they can try them before approving. The file is public like
// any other, so this is a rule for what the game shows, not a secret.
let loaded = null;
let list = [];
export async function loadTasks() {
  if (!loaded) {
    loaded = fetch('data/tasks.json').then((r) => { if (!r.ok) throw new Error('No tasks'); return r.json(); }).then((d) => { list = d.tasks; return list; });
    loaded.catch(() => { loaded = null; });
  }
  return loaded;
}
// Comic Studio's shared tiles and the sticker list (data/comic.json, data/stickers.json).
let comicData = null;
let stickerData = null;
export async function loadComicData() {
  const get = (f) => fetch(f).then((r) => { if (!r.ok) throw new Error('No ' + f); return r.json(); });
  [comicData, stickerData] = await Promise.all([get('data/comic.json'), get('data/stickers.json')]);
  return comicData;
}
export const comicShared = () => comicData;
export const stickers = () => stickerData;
export const useComicData = (c, s) => { comicData = c; stickerData = s; };
// Story Adventure's lists and templates (data/adventure.json, C2-3).
let adventureData = null;
export async function loadAdventureData() {
  const r = await fetch('data/adventure.json');
  if (!r.ok) throw new Error('No data/adventure.json');
  adventureData = await r.json();
  return adventureData;
}
export const adventure = () => adventureData;
export const useAdventureData = (d) => { adventureData = d; };
/** Story Adventure has its own review (adventure.json reviewed, approve-tasks.mjs --adventure); grown-ups always see it. */
export const adventureVisible = (kind) => kind === 'adult' || (!!adventureData && adventureData.reviewed === true);
export const taskById = (id) => list.find((t) => t.id === id) || null;
export const allTasks = () => list;
/** The tasks this person may see. kind: 'adult', 'child', 'unknown'. */
export const visibleTo = (tasks, kind) => tasks.filter((t) => t.reviewed === true || kind === 'adult');
/**
 * Is this task a comic for this person? Its comic tiles need their own review
 * (comic.reviewed, set by tools/approve-tasks.mjs --comic) as well as the task's.
 * Until then a child gets the classic Look, Plan, Write pages for a live task.
 */
export const comicVisible = (t, kind) => !!t && !!t.comic && (kind === 'adult' || (t.reviewed === true && t.comic.reviewed === true));
/** My own story's cards and lines have their own review too (comic.json own.reviewed, --own). */
export const ownVisible = (kind) => kind === 'adult' || (!!comicData && !!comicData.own && comicData.own.reviewed === true);
export const LEVELS = [3, 4, 5, 6];
export const REVIEW_KEY = 'cp.taskReview';
export const approveCommand = (ids, flag = '') => (ids.length ? 'node tools/approve-tasks.mjs ' + (flag ? flag + ' ' : '') + ids.join(' ') : '');
