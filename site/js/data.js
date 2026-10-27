// Loads the word list and the asset manifest once, and answers lookups from memory.

const YEARS = {
  y34: { key: 'year_3_4', label: 'Year 3 & 4', short: 'Y3–4' },
  y56: { key: 'year_5_6', label: 'Year 5 & 6', short: 'Y5–6' },
};

let curriculum = null;
let byWord = new Map();
let chaptersById = new Map();
let assets = { images: new Set(), audioWords: new Set(), audioLetters: new Set() };

export async function loadData() {
  const [cRes, aRes] = await Promise.all([
    fetch('data/curriculum.json'),
    fetch('data/assets.json').catch(() => null),
  ]);
  if (!cRes.ok) throw new Error('Word list did not load (HTTP ' + cRes.status + ')');
  curriculum = await cRes.json();

  for (const [yearId, y] of Object.entries(YEARS)) {
    const block = curriculum[y.key];
    block.chapters.forEach((ch, i) => {
      ch.yearId = yearId;
      ch.index = i;
      ch.slug = 'ch' + String(i + 1).padStart(2, '0');
      chaptersById.set(ch.id, ch);
      for (const w of ch.words) {
        if (w.chunks.join('') !== w.word) {
          throw new Error('Chunks for "' + w.word + '" do not spell the word');
        }
        byWord.set(w.word, { ...w, chapterId: ch.id, yearId });
      }
    });
  }

  if (aRes && aRes.ok) {
    try {
      const a = await aRes.json();
      assets.images = new Set(a.images || []);
      assets.audioWords = new Set(a.audioWords || []);
      assets.audioLetters = new Set(a.audioLetters || []);
    } catch (e) { /* no manifest yet: placeholders and device voice */ }
  }
}

export const years = () => YEARS;
export const yearBlock = (yearId) => curriculum[YEARS[yearId].key];
export const chapters = (yearId) => yearBlock(yearId).chapters;
export const chapterBySlug = (yearId, slug) => chapters(yearId).find((c) => c.slug === slug) || null;
export const chapterById = (id) => chaptersById.get(id) || null;
export const entry = (word) => byWord.get(word) || null;
export const allWords = () => [...byWord.values()];
export const hasImage = (w) => assets.images.has(w.image);
export const hasWordAudio = (word) => assets.audioWords.has(word.toLowerCase());
export const hasLetterAudio = (L) => assets.audioLetters.has(L.toUpperCase());

export function chapterTitle(ch) {
  // "Chapter 1 — First steps" -> { n: 1, name: "First steps" }
  const m = /^Chapter\s+(\d+)\s+[—-]\s+(.*)$/.exec(ch.title);
  return m ? { n: Number(m[1]), name: m[2] } : { n: ch.index + 1, name: ch.title };
}

export function chapterBlurb(ch) {
  return /^\d+ words to practise\.?$/.test(ch.description) ? '' : ch.description;
}

// The same word all day, a different one tomorrow.
export function wordOfTheDay() {
  const list = allWords();
  const d = new Date();
  const n = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
  return list[(n * 7919) % list.length];
}
