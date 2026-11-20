// SB5: where Back goes for a grown-up on the pages they reach from Play yourself. Pure: no DOM, no storage.
const YOURSELF = '#/grownups/yourself';
const OWN_PAGES = new Set(['chapters', 'custom', 'custom/play', 'tricky', 'progress', 'words', 'words/progress']);

/**
 * The Back target for an adult on one of their own practice pages ('#/grownups/yourself'), else ''.
 * `path` has no leading '#/'. When `kind` is given, anything but an adult gets '' (a child's Back is unchanged).
 */
export function adultParent(path, kind = 'adult') {
  return kind === 'adult' && OWN_PAGES.has(String(path || '')) ? YOURSELF : '';
}
