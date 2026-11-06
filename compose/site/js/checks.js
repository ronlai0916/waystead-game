// The automatic checks on a piece of writing. Pure: no DOM, no fetch. They're
// help for a child, not marks: each says something can be looked at again, and
// none claims to be sure. Fetch nothing here: isReal(word) is passed in.
const WORD = /[A-Za-z]+(?:['’][A-Za-z]+)?/g;
export const words = (text) => String(text || '').match(WORD) || [];
export const wordCount = (text) => words(text).length;

const lower = (w) => w.toLowerCase().replace(/’/g, "'");
const ENDINGS = ['', 's', 'es', 'ed', 'd', 'ing', 'y', 'ly', 'er', 'est'];

// The hint word itself, or a simple ending: climb, climbed, climbing. A final e
// can drop (bake, baking) and a last letter can double (stop, stopped).
function isForm(token, hint) {
  const t = lower(token);
  const forms = [hint, hint.replace(/e$/, ''), hint + hint.slice(-1), hint.replace(/y$/, 'i')];
  return forms.some((f) => ENDINGS.some((e) => f + e === t));
}
/** Which hint words are in the text, spelled right. */
export function hintsUsed(text, hints) {
  const all = words(text);
  return hints.filter((h) => all.some((w) => isForm(w, h)));
}

// Damerau-Levenshtein: a swap of two letters counts as one slip.
export function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
/**
 * Words that look like a slip in a hint word: { word, hint }. Close to it (one
 * slip, or two in a long word), and not a real word by itself: "hart" may be
 * meant, "kit" certainly can be. Words under 4 letters are left alone, and so are
 * `known` words: the task's own names, so "Sam" is never a slip of "sad".
 */
export function misspelledHints(text, hints, isReal = () => false, known = []) {
  const seen = new Set(known.map(lower));
  const out = [];
  for (const raw of words(text)) {
    const w = lower(raw);
    if (w.length < 4 || seen.has(w)) continue;
    seen.add(w);
    if (hints.some((h) => isForm(w, h)) || isReal(w)) continue;
    const near = hints.find((h) => { const n = distance(w, h); return h.length >= 4 && (n === 1 || (n === 2 && h.length >= 7)); });
    if (near) out.push({ word: raw, hint: near });
  }
  return out;
}

/** Sentences, each with where it starts. An end mark is . ! or ?, with any closing quote after it. */
export function sentences(text) {
  const out = [];
  for (const block of String(text || '').split(/\n+/)) {
    const re = /[^.!?]+(?:[.!?]+["'”’]*|$)/g;
    for (const m of block.matchAll(re)) { const s = m[0].trim(); if (/[A-Za-z]/.test(s)) out.push(s); }
  }
  return out;
}
const firstLetter = (s) => (/[A-Za-z]/.exec(s) || [''])[0];
const opensSpeech = (s) => /^["'“‘]/.test(s);
/**
 * The gentle check: { noCapital, noStop, smallI }. noCapital: sentences that start
 * with a small letter. noStop: paragraphs that end with no . ! or ?. Inside speech,
 * "said Tom" after a closing quote isn't a new sentence, so it isn't counted.
 */
export function capitalsAndStops(text) {
  const list = sentences(text);
  const after = (i) => i > 0 && /["”'’]$/.test(list[i - 1]);
  const noCapital = list.filter((s, i) => /[a-z]/.test(firstLetter(s)) && !after(i)).length;
  const noStop = String(text || '').split(/\n+/).map((p) => p.trim()).filter((p) => /[A-Za-z]/.test(p) && !/[.!?]["'”’]*$/.test(p)).length;
  const smallI = (String(text || '').match(/(^|[^A-Za-z'’])i(?=$|[^A-Za-z])/g) || []).length;
  return { noCapital, noStop, smallI };
}

const has = (text, re) => re.test(String(text || ''));
const TIME = /\b(first|next|then|later|after|before|soon|finally|meanwhile|suddenly|eventually|at last|the next|that night|that evening)\b/i;
const opener = (s) => lower((words(s)[0]) || '');
/** How many sentences start with the same word as the one before. */
export function repeatedOpeners(text) {
  const list = sentences(text).map(opener);
  return list.filter((w, i) => i > 0 && w && w === list[i - 1]).length;
}

/** The words a task itself uses, names included. */
export const taskWords = (task) => words([task.background, task.opening].join(' '));

/**
 * Everything the child sees after submitting. Each is { id, ok, text }, in kind words.
 * Year 3 keeps to the basics; later years add more.
 */
export function autoChecks(text, task, isReal) {
  const n = wordCount(text);
  const cs = capitalsAndStops(text);
  const used = hintsUsed(text, task.hints);
  const slips = misspelledHints(text, task.hints, isReal, taskWords(task));
  const paragraphs = String(text || '').split(/\n\s*\n|\n/).filter((p) => p.trim()).length;
  const out = [
    { id: 'words', ok: n >= 20, text: 'You wrote ' + n + (n === 1 ? ' word.' : ' words.') },
    { id: 'hints', ok: used.length >= 3, text: 'You used ' + used.length + ' of the ' + task.hints.length + ' hint words.' },
    { id: 'spelling', ok: slips.length === 0, text: slips.length ? 'Have another look at: ' + slips.map((s) => s.word).join(', ') + '.' : 'The hint words all look right.' },
    { id: 'capitals', ok: cs.noCapital + cs.smallI === 0, text: cs.noCapital + cs.smallI ? 'Check your capital letters.' : 'Your sentences start with capitals.' },
    { id: 'stops', ok: cs.noStop === 0, text: cs.noStop ? 'Check the end of each sentence for a full stop.' : 'Your sentences have their full stops.' },
  ];
  if (task.level === 3) out.push({ id: 'joins', ok: has(text, /\b(and|because)\b/i), text: has(text, /\b(and|because)\b/i) ? 'You joined ideas with and or because.' : 'Try joining two ideas with and or because.' });
  if (task.level >= 4) {
    out.push({ id: 'paragraphs', ok: paragraphs >= 3, text: paragraphs >= 3 ? 'You used paragraphs.' : 'Try a new paragraph for each picture.' });
    out.push({ id: 'speech', ok: has(text, /["“].+["”]/), text: has(text, /["“].+["”]/) ? 'You used speech marks.' : 'Try adding something someone says, in speech marks.' });
    out.push({ id: 'time', ok: has(text, TIME), text: has(text, TIME) ? 'You used time words.' : 'Try a time word, like Next or Later.' });
  }
  if (task.level >= 5) {
    const rep = repeatedOpeners(text);
    out.push({ id: 'openers', ok: rep === 0, text: rep ? 'Try starting your sentences in different ways.' : 'You started your sentences in different ways.' });
  }
  return out;
}
