// SB5 D2: "About this device" (#/device). A plain page of the numbers the layout uses, so Ron can calibrate on a real phone: what the page sees
// (sizes, insets, the bottom reserve) with a red line drawn at the reserve and a ruler on the right edge (ticks every 50 px, counted from the bottom of the page).
// No inline script, no style attribute in the markup: the ruler's ticks are set through the DOM (allowed by the strict CSP); the red line is pure CSS.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The numbers, as [label, value] pairs. `env` is the window (injectable for a test). */
export function deviceRows(env) {
  const w = env || window;
  const html = w.document.documentElement;
  const cs = w.getComputedStyle(html);
  const v = (k) => String(cs.getPropertyValue(k) || '').trim() || '(not set)';
  const vv = w.visualViewport;
  const nav = w.navigator || {};
  const det = w.sbDevice && w.sbDevice.detect ? w.sbDevice.detect({ ua: nav.userAgent, maxTouchPoints: nav.maxTouchPoints, standalone: !!nav.standalone || (w.matchMedia ? w.matchMedia('(display-mode: standalone)').matches : false) }) : {};
  const r = (n) => (typeof n === 'number' ? String(Math.round(n * 100) / 100) : '?');
  const scr = w.screen || {};
  return [
    ['Browser string', nav.userAgent || '?'],
    ['Detected system', (html.getAttribute('data-os') || det.os || '?')],
    ['Detected browser', (html.getAttribute('data-browser') || det.browser || '?') + (det.iosVersion ? ' (iOS ' + det.iosVersion + ')' : '')],
    ['Home-screen app', html.getAttribute('data-standalone') || '?'],
    ['Page size (inner)', r(w.innerWidth) + ' x ' + r(w.innerHeight)],
    ['Visible size (visual viewport)', vv ? r(vv.width) + ' x ' + r(vv.height) : 'not available'],
    ['Visual viewport top offset', vv ? r(vv.offsetTop) : 'not available'],
    ['Screen size', r(scr.width) + ' x ' + r(scr.height)],
    ['Pixel ratio', r(w.devicePixelRatio)],
    ['Inset top', v('--sat')],
    ['Inset right', v('--sar')],
    ['Inset bottom', v('--sab')],
    ['Inset left', v('--sal')],
    ['Bottom reserve (red line)', v('--bottom-reserve')],
    ['Top bar height', v('--head-h')],
    ['Room class (data-h)', html.getAttribute('data-h') || '?'],
    ['Orientation', html.getAttribute('data-orient') || '?'],
  ];
}

export const rowsText = (rows) => rows.map((x) => x[0] + ': ' + x[1]).join('\n');

export function devicePage(main) {
  const doc = document;
  main.innerHTML = '<section class="wrap page prose devpage" data-device-page>'
    + '<div class="pagehead"><a class="btn btn--ghost devpage__back" href="#/" data-devback>Back</a><h1>About this device</h1></div>'
    + '<p class="muted">These are the sizes this page sees on your phone. If something sits in the wrong place, press the button and send us the numbers. '
    + 'The red line shows where the page thinks the browser’s bottom bar starts. The ruler on the right counts up from the bottom in steps of 50.</p>'
    + '<dl class="devpage__list" data-devrows></dl>'
    + '<div class="devpage__actions"><button type="button" class="btn btn--primary" data-devcopy>Copy these numbers</button><p class="small muted" role="status" data-devmsg></p></div>'
    + '<pre class="devpage__text" data-devtext tabindex="0"></pre></section>';
  const back = main.querySelector('[data-devback]');
  back.setAttribute('href', doc.body.classList.contains('is-adult') ? '#/grownups' : doc.body.classList.contains('is-child') ? '#/settings' : '#/');
  const list = main.querySelector('[data-devrows]');
  const pre = main.querySelector('[data-devtext]');
  const msg = main.querySelector('[data-devmsg]');
  let rows = [];
  // the fixed red line (CSS puts it at the reserve) and the ruler
  const line = doc.createElement('div');
  line.className = 'devline'; line.setAttribute('aria-hidden', 'true'); line.setAttribute('data-devline', '');
  const ruler = doc.createElement('div');
  ruler.className = 'devruler'; ruler.setAttribute('aria-hidden', 'true'); ruler.setAttribute('data-devruler', '');
  doc.body.append(line, ruler);
  const draw = () => {
    rows = deviceRows(window);
    list.innerHTML = rows.map((x) => '<div class="devpage__row"><dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd></div>').join('');
    pre.textContent = rowsText(rows);
    const h = Math.round(window.innerHeight || 0);
    ruler.textContent = '';
    for (let n = 0; n <= h; n += 50) {
      const t = doc.createElement('span');
      t.className = 'devruler__tick';
      t.style.bottom = n + 'px';
      t.textContent = String(n);
      ruler.append(t);
    }
  };
  draw();
  const onSize = () => draw();
  window.addEventListener('resize', onSize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onSize);
  main.querySelector('[data-devcopy]').addEventListener('click', async () => {
    const text = rowsText(rows);
    try {
      await navigator.clipboard.writeText(text);
      msg.textContent = 'Copied. You can paste it into a message now.';
      return;
    } catch (e) { /* select the text instead */ }
    try {
      const range = doc.createRange(); range.selectNodeContents(pre);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      msg.textContent = 'The numbers are selected below. Press and hold, then choose Copy.';
    } catch (e) { msg.textContent = 'Press and hold the numbers below, then choose Copy.'; }
  });
  return () => { window.removeEventListener('resize', onSize); if (window.visualViewport) window.visualViewport.removeEventListener('resize', onSize); line.remove(); ruler.remove(); };
}
