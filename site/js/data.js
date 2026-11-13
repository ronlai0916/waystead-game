// Loads the word list and the asset manifest once, and answers lookups from memory.

import * as Ch from './chapters-doc.js';

let curriculum = null;
let byWord = new Map();
let chaptersById = new Map();
let byYear = {};
let liveIds = [];
let inChapters = new Map(); // word -> the ids of every chapter that has it
let assets = { images: new Set(), audioWords: new Set(), audioLetters: new Set(), audioStories: new Set() };
let audioVersion = '';

export async function loadData() {
  const [cRes, aRes] = await Promise.all([
    fetch('data/curriculum.json'),
    fetch('data/assets.json').catch(() => null),
  ]);
  if (!cRes.ok) throw new Error('Word list did not load (HTTP ' + cRes.status + ')');
  curriculum = await cRes.json();

  const built = Ch.buildYears(curriculum);
  byYear = built.byYear;
  chaptersById = built.byId;
  liveIds = built.live;
  byWord = new Map();
  inChapters = new Map();
  // The old blocks load first and the first entry for a word wins: a word in two chapters (busy) keeps its old audio and picture.
  for (const block of Ch.LOAD_ORDER) {
    for (const ch of (curriculum[block] && curriculum[block].chapters) || []) {
      for (const w of ch.words) {
        if (w.chunks.join('') !== w.word) {
          throw new Error('Chunks for "' + w.word + '" do not spell the word');
        }
        if (!byWord.has(w.word)) byWord.set(w.word, { ...w, chapterId: ch.id, yearId: ch.yearId });
        if (!inChapters.has(w.word)) inChapters.set(w.word, []);
        inChapters.get(w.word).push(ch.id);
      }
    }
  }

  if (aRes && aRes.ok) {
    try {
      const a = await aRes.json();
      assets.images = new Set(a.images || []);
      assets.audioWords = new Set(a.audioWords || []);
      assets.audioLetters = new Set(a.audioLetters || []);
      assets.audioStories = new Set(a.audioStories || []);
      audioVersion = a.audioVersion || '';
    } catch (e) { /* no manifest yet: placeholders and device voice */ }
  }
}

export const years = () => Ch.YEAR_INFO;
export const liveYears = () => liveIds;
/** The year a picker starts on: Year 3, or the first live year. */
export const defaultYear = () => (liveIds.includes('y3') ? 'y3' : liveIds[0]);
export const yearBlock = (yearId) => curriculum[Ch.YEAR_INFO[yearId].block];
export const chapters = (yearId) => byYear[yearId] || [];
export const chapterBySlug = (yearId, slug) => chapters(yearId).find((c) => c.slug === slug) || null;
/** Every chapter by id, for the old-link redirect (chapters-doc.js legacyHref). */
export const chapterIds = () => chaptersById;
export const allChapters = () => [...chaptersById.values()];
export const chapterById = (id) => chaptersById.get(id) || null;
export const entry = (word) => byWord.get(word) || null;
/** Every chapter id that has this word (a few words, such as busy, are in two). */
export const chaptersOf = (word) => (inChapters.get(word) || []).slice();
export const allWords = () => [...byWord.values()];
export const hasImage = (w) => assets.images.has(w.image);
export const letterAudioUrl = (L) => 'assets/audio/letters/' + L.toUpperCase() + '.mp3' + (audioVersion ? '?v=' + audioVersion : '');
export const wordAudioUrl = (word) => 'assets/audio/words/' + word.toLowerCase() + '.mp3' + (audioVersion ? '?v=' + audioVersion : '');
export const hasWordAudio = (word) => assets.audioWords.has(word.toLowerCase());
export const storyAudioUrl = (key) => 'assets/audio/stories/' + key + '.mp3';
export const hasStoryAudio = (key) => assets.audioStories.has(key);
export const hasLetterAudio = (L) => assets.audioLetters.has(L.toUpperCase());

export function chapterTitle(ch) {
  // "Chapter 1 — First steps" -> { n: 1, name: "First steps" }; n is the chapter's place in its year
  return { n: ch.n, name: Ch.chapterName(ch) };
}

export function chapterBlurb(ch) {
  return /^\d+ words to practise\.?$/.test(ch.description) ? '' : ch.description;
}

// The same word all day, a different one tomorrow.
export function wordOfTheDay(hidden = new Set()) {
  const list = allWords().filter((w) => !hidden.has(w.word.toLowerCase()));
  const d = new Date();
  const n = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
  return list[(n * 7919) % list.length];
}
