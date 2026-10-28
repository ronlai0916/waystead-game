// Drag-and-drop with pointer events (mouse, pen and touch). A press that
// does not move is left alone, so it still works as a tap or click.
//
// opts: { sources, targets: CSS selectors; canStart(el, event); ghost(el) → element;
//         drop(sourceEl, targetEl or null) }

const THRESHOLD = 6;

export function enableDrag(root, opts) {
  let d = null;
  let suppress = false;

  const targetAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest(opts.targets) : null;
  };
  const end = () => {
    if (!d) return;
    if (d.ghost) d.ghost.remove();
    d.src.classList.remove('is-dragging');
    if (d.over) d.over.classList.remove('is-over');
    d = null;
  };

  function down(e) {
    if (e.button !== 0 || d) return;
    const src = e.target.closest(opts.sources);
    if (!src || !root.contains(src) || !opts.canStart(src, e)) return;
    d = { src, x: e.clientX, y: e.clientY, id: e.pointerId, ghost: null, over: null };
  }
  function move(e) {
    if (!d || e.pointerId !== d.id) return;
    if (!d.ghost) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < THRESHOLD) return;
      const box = d.src.getBoundingClientRect();
      d.ghost = opts.ghost(d.src);
      d.ghost.classList.add('drag-ghost');
      const size = Math.max(44, Math.min(box.width, box.height));
      d.ghost.style.width = size + 'px';
      d.ghost.style.height = size + 'px';
      document.body.appendChild(d.ghost);
      d.src.classList.add('is-dragging');
    }
    e.preventDefault();
    d.ghost.style.transform = 'translate(' + e.clientX + 'px, ' + e.clientY + 'px) translate(-50%, -50%)';
    const t = targetAt(e.clientX, e.clientY);
    if (t !== d.over) {
      if (d.over) d.over.classList.remove('is-over');
      if (t) t.classList.add('is-over');
      d.over = t;
    }
  }
  function up(e) {
    if (!d || e.pointerId !== d.id) return;
    if (!d.ghost) { d = null; return; } // a tap: the click handler deals with it
    const src = d.src;
    end();
    suppress = true;
    setTimeout(() => { suppress = false; }, 0);
    opts.drop(src, targetAt(e.clientX, e.clientY));
  }

  root.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', end);
  return {
    // True straight after a drag, so the click that follows can be ignored.
    justDragged: () => suppress,
    stop() {
      end();
      root.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', end);
    },
  };
}
