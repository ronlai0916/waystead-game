// The Day style picker (home page and For parents): Sunny garden or Paint box,
// saved on this device as "sb.dayStyle". It changes the look at once; at Night
// the page keeps the Night sky style and says so. Same as Wordbright's picker.
import { getDayStyle, setDayStyle, getTheme } from './store.js';

export const DAY_STYLE_NAMES = { garden: 'Sunny garden', paint: 'Paint box' };

const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';

// tag: "section" as a card on the home page, or "div" inside a text page.
export function dayStyleHtml({ tag = 'section', id = 'daystyle' } = {}) {
  const now = getDayStyle();
  const opts = Object.keys(DAY_STYLE_NAMES).map((k) => '<label class="dsopt">'
    + '<input type="radio" name="daystyle" value="' + k + '"' + (k === now ? ' checked' : '') + '>'
    + '<span class="swatch swatch--' + k + '" aria-hidden="true"><i></i><i></i><i></i><b></b></span>'
    + '<span class="dsopt__name">' + DAY_STYLE_NAMES[k] + '</span>'
    + '<span class="dsopt__tick" aria-hidden="true">' + TICK + '</span></label>').join('');
  const intro = '<p class="muted small" id="' + id + '-help">How Spellbright looks by day on this device. At night it uses Night sky.</p>';
  const body = intro + '<div class="daystyle__opts" role="radiogroup" aria-label="Day style" aria-describedby="' + id + '-help">' + opts + '</div>'
    + '<p class="small daystyle__note" data-daystyle-note role="status"></p>';
  return tag === 'section'
    ? '<section class="card setting daystyle daystyle--card" data-daystyle aria-labelledby="' + id + '-h"><h2 id="' + id + '-h">Day style</h2>' + body + '</section>'
    : '<div class="daystyle" data-daystyle>' + body + '</div>';
}

// The note shown when Night is on, so a change does not seem to do nothing.
export function nightNote(theme = document.documentElement.getAttribute('data-theme')) {
  if (theme !== 'dark') return '';
  return getTheme() === 'dark'
    ? 'Night is on (the Day / Night button at the top), so you see Night sky now. Your day style shows in Day.'
    : 'This device is in dark mode, so you see Night sky now. Your day style shows in the daytime.';
}

// Returns a function that stops listening.
export function wireDayStyle(root) {
  const box = root.querySelector('[data-daystyle]');
  if (!box) return () => {};
  const note = box.querySelector('[data-daystyle-note]');
  const show = () => { if (note) note.textContent = nightNote(); };
  const onChange = (e) => {
    const t = e.target;
    if (!t || t.name !== 'daystyle') return;
    setDayStyle(t.value);
    show();
  };
  box.addEventListener('change', onChange);
  show();
  return () => box.removeEventListener('change', onChange);
}
