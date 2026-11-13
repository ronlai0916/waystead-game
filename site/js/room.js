// The Spellbright home at #/. A signed-in child gets the garden-path home (child-views.js:
// Pip, today's one job, one big button, the path card). An adult playing as themselves gets
// "This week at a glance" (grownups-views.js, SB3-F); the chapters page is "More practice" at
// #/chapters. A signed-out visitor gets the signed-out page (app.js `front`). The room creates nothing: the first group
// comes from My words, once this device has caught up.
import { kind } from './who.js';
import { childHome } from './child-views.js';
import { grownups } from './grownups-views.js';

/** The page at #/: a child's home, the grown-ups' week for an adult, or nothing here when signed out. */
export function home(main) {
  const k = kind();
  if (k === 'child' || k === 'unknown') return childHome(main);
  if (k === 'adult') return grownups(main);
  return undefined; // signed out: app.js shows the signed-out page (front-views.js) before this is called
}
