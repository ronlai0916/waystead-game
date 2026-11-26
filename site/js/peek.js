// One Peek, every screen (SB6, TR-41). The DOM part of the one component; the rules (which screens, how often, what follows) are in peek-doc.js.
//
//   peekButtonHtml({ label })        the button: the eye, at least 48 x 48, data-peekbtn and data-fold="peek"
//   peekRowHtml({ hint })            the row it sits in (the practice grid's own markup: .peekrow)
//   mountPeek(root, { word, ms, ... })  wires the button inside `root`; returns { destroy, touch, isShowing, setEnabled, peeks, press }
//
// While a Peek shows: the whole word is on view for `ms` (filled letters keep their colour, the missing ones appear lighter, class is-peeked),
// the button is disabled (and only then), `lock(on)` freezes the keys or tiles, "The word is ..." is announced once (polite), and nothing moves.
// It never changes a try itself: `onPeek(count)` tells the screen, which counts it (spell-run `peek`, the pass's `peeks`). No motion, no sound.
// A still outline (is-nudge) after `nudgeMs` with no tap (Step by step only: 0 = off); the word is never shown by itself.
//
// Where the word shows (the first that is given):
//   show() / hide()       the screen draws it (the builder)
//   words()               [{ root, entry }] with tile boxes (.lgap[data-gap]) inside each root (the ladder and the rows)
//   boxes()               the letter boxes in word order (keyboard boxes, the flower's blanks)
//   nothing               the `[data-peek]` line in `root`, as the practice grid has always done

const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
export const PEEK_ICON = EYE;
const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The Peek button (the eye and the word "Peek"). */
export function peekButtonHtml({ label = 'Peek', cls = 'btn btn--ghost peek-btn' } = {}) {
  return '<button type="button" class="' + cls + '" data-peekbtn data-fold="peek">' + EYE + '<span class="peek-btn__label">' + escHtml(label) + '</span></button>';
}
/** The row the button sits in on every keyboard and tile page: after the boxes and Hear, before the keys. `hint` is a line beside it (the practice grid's). */
export function peekRowHtml({ hint = '', label = 'Peek' } = {}) {
  return '<div class="peekrow">' + peekButtonHtml({ label }) + (hint ? '<span class="peekrow__hint" data-hint>' + escHtml(hint) + '</span>' : '') + '</div>';
}

/**
 * Mounts the Peek button found in `root`.
 *   word      the word (default and boxes display; the announcement)
 *   ms        how long it shows (peek-doc peekMs)
 *   lock(on)  called first with true when a Peek starts and with false when it ends: the screen freezes its keys or tiles
 *   onPeek(n) a Peek has started (n = how many so far)
 *   onEnd()   a Peek has ended (after the word is hidden and the screen is unlocked)
 *   can()     false = ignore the tap (a pause between two goes)
 *   allowed   how many Peeks in all (Infinity); after the last one the button stays disabled, quietly
 *   nudgeMs   0 = no nudge
 *   line      selector of the line for the default display (default '[data-peek]')
 */
export function mountPeek(root, { word = '', ms = 3000, lock, onPeek, onEnd, can, allowed = Infinity, nudgeMs = 0, enabled = true, words, boxes, show, hide, line = '[data-peek]', announce = true } = {}) {
  const btn = root && root.querySelector ? root.querySelector('[data-peekbtn]') : null;
  const quiet = { destroy() {}, touch() {}, setEnabled() {}, isShowing: () => false, peeks: () => 0, press() {} };
  if (!btn) return quiet;
  let showing = false;
  let count = 0;
  let timer = null;
  let nudge = null;
  let on = enabled;
  let saved = [];
  let live = null;
  const spent = () => allowed !== Infinity && count >= allowed;
  const custom = typeof show === 'function';
  const lineEl = () => (!custom && !words && !boxes ? root.querySelector(line) : null);
  const say = (text) => {
    if (!announce || lineEl()) return; // the default line is itself a polite live region
    if (!live) {
      live = document.createElement('span');
      live.className = 'sr';
      live.setAttribute('aria-live', 'polite');
      root.append(live);
    }
    live.textContent = '';
    setTimeout(() => { if (live) live.textContent = text; }, 30);
  };
  const arm = () => {
    clearTimeout(nudge);
    btn.classList.remove('is-nudge');
    if (nudgeMs && on && !showing && !spent()) nudge = setTimeout(() => { if (!showing && on) btn.classList.add('is-nudge'); }, nudgeMs);
  };

  function paint() {
    saved = [];
    if (custom) { show(); return; }
    const l = lineEl();
    if (l) { saved.push({ el: l, text: l.textContent, cls: l.className }); l.textContent = word; return; }
    if (words) {
      for (const w of words()) {
        w.root.querySelectorAll('.lgap[data-gap]').forEach((g) => {
          const i = Number(g.dataset.gap);
          const right = [...w.entry.word][i];
          const filledRight = g.classList.contains('is-filled') && g.textContent === right;
          saved.push({ el: g, text: g.textContent, cls: g.className, ch: g.dataset.ch });
          if (!filledRight) { g.textContent = right; g.dataset.ch = right; g.classList.add('is-peeked'); g.classList.remove('is-slip', 'is-next'); }
        });
      }
      return;
    }
    if (boxes) {
      const letters = [...word];
      boxes().forEach((el, i) => {
        saved.push({ el, text: el.textContent, cls: el.className, ch: el.dataset.ch });
        if (el.classList.contains('is-filled') || el.classList.contains('got') || letters[i] === undefined) return;
        el.textContent = letters[i];
        el.dataset.ch = letters[i];
        el.classList.add('is-peeked');
      });
    }
  }
  function unpaint() {
    if (custom) { hide && hide(); return; }
    for (const s of saved) {
      if (!s.el.isConnected) continue;
      s.el.textContent = s.text;
      s.el.className = s.cls;
      if (s.ch === undefined) delete s.el.dataset.ch; else s.el.dataset.ch = s.ch;
    }
    saved = [];
  }

  function press() {
    if (!on || showing || btn.disabled || spent() || (can && !can())) return;
    showing = true;
    count += 1;
    clearTimeout(nudge);
    btn.classList.remove('is-nudge');
    btn.classList.add('is-showing');
    btn.setAttribute('aria-pressed', 'true');
    btn.disabled = true;
    root.classList.add('is-peek');
    if (lock) lock(true); // before the word is drawn: a tray that redraws itself on lock must not undraw it
    paint();
    say('The word is ' + (words ? words().map((w) => w.entry.word).join(', ') : String(word).toLowerCase()) + '.'); // normal case: capitals can be spelled out letter by letter
    if (onPeek) onPeek(count);
    timer = setTimeout(end, ms);
  }
  function end() {
    clearTimeout(timer);
    if (!showing) return;
    showing = false;
    unpaint();
    root.classList.remove('is-peek');
    btn.classList.remove('is-showing');
    btn.removeAttribute('aria-pressed');
    btn.disabled = !on || spent();
    btn.classList.toggle('is-used', spent());
    if (lock) lock(false);
    arm();
    if (onEnd) onEnd();
  }

  btn.addEventListener('click', press);
  const onDown = () => arm();
  if (nudgeMs) root.addEventListener('pointerdown', onDown);
  btn.disabled = !on;
  arm();
  return {
    press,
    destroy() {
      clearTimeout(timer);
      clearTimeout(nudge);
      btn.removeEventListener('click', press);
      root.removeEventListener('pointerdown', onDown);
      if (showing) { showing = false; unpaint(); root.classList.remove('is-peek'); btn.classList.remove('is-showing'); btn.removeAttribute('aria-pressed'); if (lock) lock(false); }
      if (live) { live.remove(); live = null; }
    },
    touch: arm,
    isShowing: () => showing,
    setEnabled(v) { on = !!v; if (!showing) btn.disabled = !on || spent(); arm(); },
    peeks: () => count,
  };
}
