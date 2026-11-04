// Story day's stories (data/stories.json): one original story per curriculum
// chapter. A story reaches children only when `reviewed` is true in that file,
// which only tools/approve-stories.mjs changes: the switches on the review page
// are the reviewer's notes on one device, and release nothing by themselves.
// The file is public like every other, so this is a rule for what the game
// shows, not a secret.

let loaded = null;
/** Every story, reviewed or not. Only the review page and storyFor() read this. */
export function loadStories() {
  if (!loaded) {
    loaded = fetch('data/stories.json').then((r) => (r.ok ? r.json() : { stories: [] })).then((d) => d.stories).catch(() => { loaded = null; return []; });
  }
  return loaded;
}

/** The chapter a group came from: the one holding all its own words, or null. */
export function chapterOf(g, chapters) {
  const has = (c) => { const set = new Set(c.words.map((w) => w.word)); return g.words.length > 0 && g.words.every((w) => set.has(w)); };
  return chapters.find(has) || null;
}

/** The story children may see for this group, or null: not from a chapter, or not reviewed yet. */
export function storyFor(stories, g, chapters) {
  const c = chapterOf(g, chapters);
  return (c && stories.find((s) => s.chapter === c.id && s.reviewed === true)) || null;
}

export const wordCount = (s) => s.sentences.join(' ').split(/\s+/).filter(Boolean).length;
/** The words a sentence's recording is called by. */
export const lineKey = (s, i) => s.chapter + '-' + i;

/** A sentence in parts, for showing the week's words: [{ text, hit }]. */
export function lineParts(text, words) {
  if (!words.length) return [{ text, hit: false }];
  const re = new RegExp('\\b(' + [...words].sort((a, b) => b.length - a.length).join('|') + ')\\b', 'gi');
  const out = [];
  let at = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > at) out.push({ text: text.slice(at, m.index), hit: false });
    out.push({ text: m[0], hit: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false });
  return out;
}

// The review page's switches: this device only, for the reviewer's own list.
export const REVIEW_KEY = 'sb.storyReview';
export const approveCommand = (ids) => (ids.length ? 'node tools/approve-stories.mjs ' + ids.join(' ') : '');
