// Runs before the stylesheet paints, so a saved light/dark choice never flashes.
(function () {
  var t = null;
  try { t = localStorage.getItem('sb.theme'); } catch (e) {}
  var root = document.documentElement;
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
  root.setAttribute('data-theme-mode', t === 'light' || t === 'dark' ? t : 'system');
})();
