// The Spellbright home at #/. A signed-in child gets the garden-path home (child-views.js:
// Pip, today's one job, one big button, the path card). An adult playing as themselves
// gets the chapters page, with Grown-ups on it. The room creates nothing: the first group
// comes from My words, once this device has caught up.
import * as V from './views.js';
import { kind } from './who.js';
import { childHome } from './child-views.js';
import { ICON } from './ui.js';

/** The page at #/: a child's home, or the chapters for an adult. */
export function home(main) {
  const k = kind();
  if (k === 'child' || k === 'unknown') return childHome(main);
  const end = V.home(main);
  if (k === 'adult') {
    main.querySelector('.shortcuts').insertAdjacentHTML('afterbegin', '<a class="card shortcut" href="#/grownups"><span><strong>Grown-ups</strong><br><span class="muted small">Plan a week and see how it\'s going</span></span>' + ICON.arrow + '</a>');
  }
  return end;
}
