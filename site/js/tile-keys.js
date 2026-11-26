// A hardware keyboard on a letter-tile screen (SB7, D31). One place decides what a key means, so every tile page treats keys the same:
//   a letter key = a tap on the next matching unused tile; Backspace = Back; Enter = Check (only when Check can be pressed).
// Ignored: a key with Ctrl, Meta or Alt, a key while a dialog is open, a key while focus is in a real text field, and Enter while focus is on
// a button or link other than a tile (the browser presses that one itself, so Check never fires twice; on a tile, Enter is Check). Pure apart from reading the page it is given.

const FIELD = /^(input|textarea|select)$/i;

/** True when focus is in something the person types into. */
export function inTextField(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  return FIELD.test(String(el.tagName || ''));
}
/** True when a button or link has focus (Enter would press it). */
export function onControl(el) {
  return !!(el && el.tagName && /^(button|a)$/i.test(String(el.tagName)));
}
/** True for a letter tile or a gap button: Enter there means Check (not "press this tile"), and Space still presses it. */
export function isTileControl(el) {
  if (!el) return false;
  const c = el.classList;
  return !!((c && typeof c.contains === 'function' && (c.contains('ltile') || c.contains('lgap'))) || (el.dataset && (el.dataset.tile !== undefined || el.dataset.gap !== undefined)));
}
/** True while a modal dialog is open on the page (a sheet, a panel, a `<dialog>`). */
export function dialogOpen(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc || typeof doc.querySelector !== 'function') return false;
  return !!doc.querySelector('dialog[open], [role="dialog"][aria-modal="true"]:not([hidden])');
}

/** What a key press means on a tile screen: { kind: 'letter', ch } | { kind: 'back' } | { kind: 'check' } | null. */
export function intentOf(e, doc) {
  if (!e || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return null;
  if (inTextField(e.target) || dialogOpen(doc)) return null;
  const k = e.key;
  if (typeof k === 'string' && /^[a-z]$/i.test(k)) return { kind: 'letter', ch: k.toLowerCase() };
  if (k === 'Backspace') return { kind: 'back' };
  if (k === 'Enter' && !e.repeat && (!onControl(e.target) || isTileControl(e.target))) return { kind: 'check' };
  return null;
}

/**
 * Runs a key press: calls onLetter(ch), onBack() or onCheck() as the key means, and stops the browser acting on a key it used.
 * Returns true when the key was used. Each handler may return false for "nothing to do" (the key is still used).
 */
export function handleKey(e, { onLetter, onBack, onCheck, doc } = {}) {
  const it = intentOf(e, doc);
  if (!it) return false;
  if (it.kind === 'letter' && onLetter) { e.preventDefault(); onLetter(it.ch); return true; }
  if (it.kind === 'back' && onBack) { e.preventDefault(); onBack(); return true; }
  if (it.kind === 'check' && onCheck) { e.preventDefault(); onCheck(); return true; }
  return false;
}

/**
 * Listens on the page for keys for as long as a screen lives. Returns { destroy } (safe to call twice): call it when the screen goes,
 * so a key after Next is never handled by the old screen as well.
 */
export function mountTileKeys({ onLetter, onBack, onCheck, doc = typeof document !== 'undefined' ? document : null } = {}) {
  if (!doc || typeof doc.addEventListener !== 'function') return { destroy() {} };
  let on = true;
  const fn = (e) => { if (on) handleKey(e, { onLetter, onBack, onCheck, doc }); };
  doc.addEventListener('keydown', fn);
  return { destroy() { if (!on) return; on = false; doc.removeEventListener('keydown', fn); } };
}

/** The next unused tile for a letter (the first, in tray order), or null when none is left. `used` is a Set of tile ids. */
export function tileForLetter(tiles, used, ch) {
  const L = String(ch).toLowerCase();
  return (tiles || []).find((t) => String(t.ch).toLowerCase() === L && !(used && used.has(t.id))) || null;
}

/** The Check button of a page, pressed only when it is there and can be pressed. */
export function pressCheck(root, sel = '[data-check]') {
  const b = root && root.querySelector ? root.querySelector(sel) : null;
  if (!b || b.disabled) return false;
  b.click();
  return true;
}
