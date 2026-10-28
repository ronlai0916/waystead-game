// Small shared pieces: escaping, icons, the toast, and our own dialogs
// (never the browser's alert/confirm, which block the page).

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const ICON = {
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3c4 0 6 10 10 10h3M4 17h3c1.6 0 2.8-1.6 3.9-3.6M14 9.6C15 8.1 16 7 17 7h3M17 4l3 3-3 3M17 14l3 3-3 3"/></svg>',
  recall: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  swap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v14M3 14l4 4 4-4M17 20V6M13 10l4-4 4 4"/></svg>',
  pass: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12M13 7l5 5-5 5"/><path d="M21 5v14"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
};

let toastTimer = null;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// A modal <dialog>. `build(dialog, close)` fills it; resolves with close(value).
// Escape closes with null.
function modal(className, build) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'dlg ' + className;
    let done = false;
    const close = (value) => {
      if (done) return;
      done = true;
      d.close();
      d.remove();
      resolve(value);
    };
    d.addEventListener('cancel', (e) => { e.preventDefault(); close(null); });
    build(d, close);
    document.body.appendChild(d);
    d.showModal();
    const first = d.querySelector('[autofocus]') || d.querySelector('button');
    if (first) first.focus();
  });
}

// Yes / no question. Resolves true or false.
export function ask(title, text, yes, no = 'Cancel') {
  return modal('dlg--ask', (d, close) => {
    d.setAttribute('aria-labelledby', 'dlg-title');
    d.innerHTML = '<h2 id="dlg-title">' + esc(title) + '</h2>' + (text ? '<p>' + esc(text) + '</p>' : '')
      + '<div class="btnrow"><button type="button" class="btn btn--primary" data-yes autofocus>' + esc(yes) + '</button>'
      + '<button type="button" class="btn btn--ghost" data-no>' + esc(no) + '</button></div>';
    d.querySelector('[data-yes]').addEventListener('click', () => close(true));
    d.querySelector('[data-no]').addEventListener('click', () => close(false));
  }).then((v) => v === true);
}

// Choose the letter a blank tile stands for. Resolves 'a'–'z' or null.
export function pickLetter() {
  return modal('dlg--letters', (d, close) => {
    d.setAttribute('aria-labelledby', 'dlg-title');
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    d.innerHTML = '<h2 id="dlg-title">Which letter is your blank?</h2>'
      + '<p class="muted small">A blank can be any letter. It scores 0.</p>'
      + '<div class="letters">' + letters.map((l) => '<button type="button" class="letterbtn" data-l="' + l + '">' + l.toUpperCase() + '</button>').join('') + '</div>'
      + '<div class="btnrow"><button type="button" class="btn btn--ghost btn--small" data-no>Cancel</button></div>';
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-l]');
      if (b) close(b.dataset.l);
      else if (e.target.closest('[data-no]')) close(null);
    });
    d.addEventListener('keydown', (e) => {
      if (/^[a-z]$/i.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); close(e.key.toLowerCase()); }
    });
  });
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Phones: narrower than 600 px.
export function isPhone() {
  return window.matchMedia('(max-width: 599.98px)').matches;
}
