// While a group's test is due, no page may show its words. Every route in
// app.js is in RULES, and the router asks here before drawing: an answer is the
// group whose Test today card goes up instead. Pure.
//
//   safe     never shows a word from a group's list, or it's the test itself
//   lists    a page that lists words: it leaves the hidden ones out (withoutHidden)
//   chapter  blocked when the chapter holds a hidden word
//   any      blocked while any test is due: these pages list a group's words, or
//            a picker with every chapter in it
//   group    the group's own pages: blocked when it's due, or shares a hidden word
//   first    the group's main page: a due group's has no words; only another
//            group sharing a hidden word is blocked
//   adult    Grown-ups: never a child's page
// A route not listed is blocked, so a new page is safe until someone looks at it.
import * as W from './words-doc.js';
import { dueGroups, hiddenWords, showsHidden } from './study-doc.js';

export const RULES = {
  '': 'safe', about: 'safe', progress: 'safe', ':yearId': 'safe',
  chapters: 'lists', custom: 'lists', 'custom/play': 'lists', tricky: 'lists', words: 'lists',
  ':yearId/:slug': 'chapter', ':yearId/:slug/study': 'chapter', ':yearId/:slug/study/:word': 'chapter',
  ':yearId/:slug/quick': 'chapter', ':yearId/:slug/quick/:word': 'chapter', ':yearId/:slug/practice': 'chapter', ':yearId/:slug/test': 'chapter',
  'words/new': 'any', 'words/progress': 'any', 'words/g/:gid/edit': 'any',
  'words/g/:gid': 'first', 'words/g/:gid/test': 'safe', 'words/g/:gid/path': 'safe', settings: 'safe',
  'words/g/:gid/spell/:n': 'group', 'words/g/:gid/study/:step': 'group', 'words/g/:gid/study/:step/:n': 'group', 'words/g/:gid/games': 'group', 'words/g/:gid/game/:game': 'group',
  grownups: 'adult', 'grownups/stories': 'adult', 'grownups/plan': 'adult', 'grownups/child/:cid/week/:gid': 'adult', 'grownups/child/:cid': 'adult', 'grownups/child/:cid/plan': 'adult', 'grownups/child/:cid/plan/:gid': 'adult',
};

/** The group to show instead of this page, or null. chapterWords(yearId, slug) -> its words. */
export function testGuard(pattern, params, d, today, chapterWords) {
  const due = dueGroups(d, today);
  if (!due.length) return null;
  const rule = RULES[pattern];
  if (rule === 'safe' || rule === 'lists' || rule === 'adult') return null;
  const hidden = hiddenWords(d, today);
  if (rule === 'chapter') {
    const w = chapterWords(params.yearId, params.slug).find((x) => hidden.has(x.toLowerCase()));
    return w ? due.find((g) => g.words.some((x) => x.toLowerCase() === w.toLowerCase())) : null;
  }
  if (rule === 'group' || rule === 'first') {
    const g = W.groupById(d, decodeURIComponent(params.gid));
    if (!g) return null; // the page sends them on
    if (due.some((x) => x.id === g.id)) return rule === 'first' ? null : g;
    return showsHidden(g, hidden) ? due[0] : null;
  }
  return due[0]; // 'any', and anything not listed
}
