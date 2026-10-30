// The look, saved on this device and shared with both games: the mode
// ("sb.theme": "light" = Day, "dark" = Night, no key = Match device) and the
// day style ("sb.dayStyle": "garden" or "paint"). The same functions as in
// Spellbright's store.js; the home page keeps nothing else.
const KEYS = { theme: 'sb.theme', dayStyle: 'sb.dayStyle' };

export function getTheme() {
  try {
    const t = localStorage.getItem(KEYS.theme);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch (e) { return 'system'; }
}
export function setTheme(t) {
  try {
    if (t === 'light' || t === 'dark') localStorage.setItem(KEYS.theme, t);
    else localStorage.removeItem(KEYS.theme);
  } catch (e) { /* private mode: keep going */ }
  applyTheme();
}

// Day style for this device: "garden" (Sunny garden, the default) or "paint" (Paint box).
// Night always uses the Night sky style.
export const DAY_STYLES = ['garden', 'paint'];
export function getDayStyle() {
  try {
    const s = localStorage.getItem(KEYS.dayStyle);
    return DAY_STYLES.includes(s) ? s : 'garden';
  } catch (e) { return 'garden'; }
}
export function setDayStyle(s) {
  if (!DAY_STYLES.includes(s)) return;
  try { localStorage.setItem(KEYS.dayStyle, s); } catch (e) { /* private mode: keep going */ }
  applyTheme();
}

// theme-boot.js has already run (it is loaded before the page script).
function applyTheme() {
  if (typeof window !== 'undefined' && window.sbTheme) window.sbTheme.apply();
}
