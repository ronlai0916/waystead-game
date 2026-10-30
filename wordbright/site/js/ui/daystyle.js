// The Day style picker (new-game screen and For parents): Sunny garden or
// Paint box, saved on this device as "wb.dayStyle". It changes the look at
// once; at Night the page keeps the Night sky style.
import { BRAND } from '../brand.js';
import { getDayStyle, setDayStyle, getTheme } from '../store.js';

export const DAY_STYLE_NAMES = { garden: 'Sunny garden', paint: 'Paint box' };

const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';

// tag: "fieldset" inside a form (with a legend), or "div" on a text page (heading given by the page).
export function dayStyleHtml({ tag = 'fieldset', id = 'daystyle' } = {}) {
  const now = getDayStyle();
  const opts = Object.keys(DAY_STYLE_NAMES).map((k) => '<label class="dsopt">'
    + '<input type="radio" name="daystyle" value="' + k + '"' + (k === now ? ' checked' : '') + '>'
    + '<span class="swatch swatch--' + k + '" aria-hidden="true"><i></i><i></i><i></i><b></b></span>'
    + '<span class="dsopt__name">' + DAY_STYLE_NAMES[k] + '</span>'
    + '<span class="dsopt__tick" aria-hidden="true">' + TICK + '</span></label>').join('');
  const intro = '<p class="muted small" id="' + id + '-help">How ' + BRAND.product + ' looks by day on this device. At night it uses Night sky.</p>';
  const body = intro + '<div class="daystyle__opts" role="radiogroup" aria-label="Day style" aria-describedby="' + id + '-help">' + opts + '</div>'
    + '<p class="small daystyle__note" data-daystyle-note role="status"></p>';
  return tag === 'fieldset'
    ? '<fieldset class="card setting daystyle" data-daystyle><legend>Day style</legend>' + body + '</fieldset>'
    : '<div class="daystyle" data-daystyle>' + body + '</div>';
}

// The note shown when Night is on, so a change does not seem to do nothing.
export function nightNote(theme = document.documentElement.getAttribute('data-theme')) {
  if (theme !== 'dark') return '';
  return getTheme() === 'dark'
    ? 'Night is on (the theme button at the top), so you see Night sky now. Your day style shows in Day.'
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
