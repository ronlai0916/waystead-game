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
export const taskById = (id) => list.find((t) => t.id === id) || null;
export const allTasks = () => list;
/** The tasks this person may see. kind: 'adult', 'child', 'unknown'. */
export const visibleTo = (tasks, kind) => tasks.filter((t) => t.reviewed === true || kind === 'adult');
export const LEVELS = [3, 4, 5, 6];
export const REVIEW_KEY = 'cp.taskReview';
export const approveCommand = (ids) => (ids.length ? 'node tools/approve-tasks.mjs ' + ids.join(' ') : '');
