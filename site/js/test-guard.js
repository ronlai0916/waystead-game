// While a group's test is due, no page may show its words. Every route in
// app.js is in RULES, and the router asks here before drawing: an answer is the
// group whose Test today card goes up instead. Pure.
//
//   safe     never shows a word from a group's list, or it's the test itself
//   lists    a page that lists words: it leaves the hidden ones out (withoutHidden)
//   chapter  blocked when the chapter holds a hidden word
//   own      a grown-up's own chapter (SB4-WP7): the same, its words come from the child's copy
//   any      blocked while any test is due: these pages list a group's words, or
//            a picker with every chapter in it
//   group    the group's own pages: blocked when it's due, or shares a hidden word
//   first    the group's main page: a due group's has no words; only another
//            group sharing a hidden word is blocked
//   adult    Grown-ups: never a child's page
// A route not listed is blocked, so a new page is safe until someone looks at it.
import * as W from './words-doc.js';
import { dueGroups, hiddenWords, showsHidden } from './study-doc.js';
import { safeDecode } from './chapters-doc.js'; // SB4-WP13: a bad address piece is '' (never throws)

export const RULES = {
  '': 'safe', about: 'safe', progress: 'safe', ':yearId': 'safe',
  chapters: 'lists', custom: 'lists', 'custom/play': 'lists', tricky: 'lists', words: 'lists',
  ':yearId/:slug': 'chapter', ':yearId/:slug/study': 'chapter', ':yearId/:slug/study/:word': 'chapter',
  ':yearId/:slug/quick': 'chapter', ':yearId/:slug/quick/:word': 'chapter', ':yearId/:slug/practice': 'chapter', ':yearId/:slug/test': 'chapter',
  'words/new': 'any', 'words/progress': 'any', 'words/g/:gid/edit': 'any',
  'words/g/:gid': 'first', 'words/g/:gid/test': 'safe', 'words/g/:gid/path': 'safe', settings: 'safe',
  'words/g/:gid/spell/:n': 'group', 'words/g/:gid/study/:step': 'group', 'words/g/:gid/study/:step/:n': 'group', 'words/g/:gid/games': 'group', 'words/g/:gid/game/:game': 'group',
  grownups: 'adult', 'grownups/stories': 'adult', 'grownups/plan': 'adult', 'grownups/child/:cid/week/:gid': 'adult', 'grownups/child/:cid': 'adult', 'grownups/child/:cid/plan': 'adult', 'grownups/child/:cid/plan/:gid': 'adult',
  // SB4-WP5 rules
  'words/exam/:eid': 'any', 'words/g/:gid/quiz': 'group', ':yearId/:slug/quiz': 'chapter',

  // SB4-WP6 rules
  'grownups/overview': 'adult', 'grownups/child/:cid/spelling': 'adult', 'grownups/child/:cid/exam': 'adult', 'grownups/child/:cid/exam/:eid': 'adult',

  // SB4-WP7 rules
  'grownups/own': 'adult', 'grownups/own/new': 'adult', 'grownups/own/:oid': 'adult',
  'words/own/:oid': 'own', 'words/own/:oid/study': 'own', 'words/own/:oid/study/:word': 'own', 'words/own/:oid/quick': 'own', 'words/own/:oid/quick/:word': 'own',
  'words/own/:oid/practice': 'own', 'words/own/:oid/test': 'own', 'words/own/:oid/quiz': 'own',

  // SB4-WP8 rules
  'grownups/scan': 'adult',

  // SB4-WP11 rules
  'grownups/teach': 'adult', 'grownups/teach/:oid': 'adult',
};

// SB4-E/F: an example sentence on a study page must not show a word whose group's test is due.
// A word of one or two letters takes no ending (as boldWord in ui.js). Endings: s es ed d ing (boldWord's) and er est ly ness ful y;
// the stem may have lost an e (make, making), doubled its last consonant (hop, hopped) or turned y into i (baby, babies, happiness).
const ENDINGS = ['s', 'es', 'ed', 'd', 'ing', 'er', 'est', 'ly', 'ness', 'ful', 'y'];
const E_DROP = new Set(['ing', 'ed', 'er', 'est', 'y']);
const MIN = 3; // the shortest base that takes an ending
function bases(t) {
  const out = [];
  for (const e of ENDINGS) {
    if (!t.endsWith(e)) continue;
    const stem = t.slice(0, -e.length);
    if (stem.length >= MIN) out.push(stem);
    if (E_DROP.has(e) && stem.length >= MIN) out.push(stem + 'e');
    if (stem.length > MIN && stem[stem.length - 1] === stem[stem.length - 2] && e !== 's' && e !== 'es' && e !== 'd' && e !== 'ly' && e !== 'ness' && e !== 'ful') out.push(stem.slice(0, -1));
    if (stem.length > MIN - 1 && stem.endsWith('i') && e !== 'ing') out.push(stem.slice(0, -1) + 'y');
  }
  return out;
}
/** True when the sentence holds a hidden word: whole word, any case, with an ending (hidden is W.hiddenWords: lower case). */
export function mentionsHidden(sentence, hidden) {
  if (!sentence || !hidden || !hidden.size) return false;
  for (const m of String(sentence).matchAll(/\w+/g)) {
    const t = m[0].toLowerCase();
    if (hidden.has(t)) return true;
    for (const b of bases(t)) if (b.length >= MIN && hidden.has(b)) return true;
  }
  return false;
}
/** The entry a child may see: the same, or with its example taken out when that sentence holds a hidden word (the page then shows no example line, or the lettered tile). */
export function guardEntry(w, hidden) {
  if (!w || !w.meaning || !w.meaning.example || !mentionsHidden(w.meaning.example, hidden)) return w;
  return { ...w, meaning: { ...w.meaning, example: '' } };
}

/** The group to show instead of this page, or null. chapterWords(yearId, slug, params) -> its words (an own chapter's when params.oid is set). */
export function testGuard(pattern, params, d, today, chapterWords) {
  const due = dueGroups(d, today);
  if (!due.length) return null;
  const rule = RULES[pattern];
  if (rule === 'safe' || rule === 'lists' || rule === 'adult') return null;
  const hidden = hiddenWords(d, today);
  if (rule === 'chapter' || rule === 'own') {
    const w = chapterWords(params.yearId, params.slug, params).find((x) => hidden.has(x.toLowerCase()));
    return w ? due.find((g) => g.words.some((x) => x.toLowerCase() === w.toLowerCase())) : null;
  }
  if (rule === 'group' || rule === 'first') {
    const g = W.groupById(d, safeDecode(params.gid));
    if (!g) return null; // the page sends them on
    if (due.some((x) => x.id === g.id)) return rule === 'first' ? null : g;
    return showsHidden(g, hidden) ? due[0] : null;
  }
  return due[0]; // 'any', and anything not listed
}
