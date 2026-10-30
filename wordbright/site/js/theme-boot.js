// Runs before the stylesheet paints, so the saved look never flashes.
// Mode (shared with Spellbright, "sb.theme"): light = Day, dark = Night, none = match device.
// Day style (this device, "wb.dayStyle"): garden (default) or paint. Night is always "night".
// Sets <html data-theme="light|dark" data-style="garden|paint|night" data-theme-mode="…">,
// and follows the device when the mode is "match device". store.js calls wbTheme.apply().
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

  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function apply() {
    var r = resolve(read('sb.theme'), read('wb.dayStyle'), !!(mq && mq.matches));
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
  window.wbTheme = { apply: apply, resolve: resolve, DAY_STYLES: DAY_STYLES };
})();
