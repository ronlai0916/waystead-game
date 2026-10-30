// Runs before the stylesheet paints, so the saved look never flashes.
// Mode (shared with Wordbright, "sb.theme"): light = Day, dark = Night, none = match device.
// Day style ("sb.dayStyle", shared with Wordbright): garden (default) or paint. Night is always "night".
// Sets <html data-theme="light|dark" data-style="garden|paint|night" data-theme-mode="…">,
// and follows the device when the mode is "match device". store.js calls sbTheme.apply().
// Same model as wordbright/site/js/theme-boot.js (copied, not imported: each game stands alone).
(function () {
  var DAY_STYLES = ['garden', 'paint'];

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  // Pure: what the page should show.
  function resolve(mode, dayStyle, deviceDark) {
    var m = mode === 'light' || mode === 'dark' ? mode : 'system';
    var theme = m === 'system' ? (deviceDark ? 'dark' : 'light') : m;
    var day = DAY_STYLES.indexOf(dayStyle) >= 0 ? dayStyle : 'garden';
    return { mode: m, theme: theme, style: theme === 'dark' ? 'night' : day };
  }

  // One-time move: Wordbright kept the day style in "wb.dayStyle" before it was shared.
  try {
    var old = localStorage.getItem('wb.dayStyle');
    if (old !== null) {
      if (localStorage.getItem('sb.dayStyle') === null) localStorage.setItem('sb.dayStyle', old);
      localStorage.removeItem('wb.dayStyle');
    }
  } catch (e) {}

  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function apply() {
    var r = resolve(read('sb.theme'), read('sb.dayStyle'), !!(mq && mq.matches));
    var root = document.documentElement;
    root.setAttribute('data-theme', r.theme);
    root.setAttribute('data-style', r.style);
    root.setAttribute('data-theme-mode', r.mode);
    return r;
  }

  apply();
  if (mq) {
    var onChange = function () { apply(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
  window.sbTheme = { apply: apply, resolve: resolve, DAY_STYLES: DAY_STYLES };
})();
