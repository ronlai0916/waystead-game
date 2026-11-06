// Small shared pieces.
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  tick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  dot: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/></svg>',
};
let toastTimer = null;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
const pic = (file, w) => file + '-' + w + '.webp';
/** A picture of a story, small first, the big one on a wide screen. */
export const imgHtml = (p, sizes = '(min-width: 720px) 25vw, 50vw') => '<img src="' + esc(pic(p.file, 600)) + '" srcset="' + esc(pic(p.file, 600)) + ' 600w, ' + esc(pic(p.file, 1200)) + ' 1200w" sizes="' + sizes + '" alt="' + esc(p.alt) + '" width="600" height="450" loading="lazy" decoding="async">';
export function stripHtml(task) {
  return '<div class="strip">' + task.pictures.map((p, i) => '<button type="button" class="strip__pic" data-big="' + i + '" aria-label="Make picture ' + (i + 1) + ' bigger"><span class="strip__n">' + (i + 1) + '</span>' + imgHtml(p) + '</button>').join('') + '</div>';
}
/** Tap a picture to see it big. */
export function wireStrip(root, task) {
  root.querySelectorAll('[data-big]').forEach((b) => b.addEventListener('click', () => {
    const p = task.pictures[Number(b.dataset.big)];
    const d = document.createElement('dialog');
    d.className = 'dlg bigpic';
    d.innerHTML = '<img src="' + esc(pic(p.file, 1200)) + '" alt="' + esc(p.alt) + '"><p class="small">' + esc(p.alt) + '</p><div class="btnrow"><button type="button" class="btn btn--ghost" data-close>Close</button></div>';
    d.querySelector('[data-close]').addEventListener('click', () => d.close());
    d.addEventListener('close', () => d.remove());
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    document.body.append(d);
    d.showModal();
  }));
}
