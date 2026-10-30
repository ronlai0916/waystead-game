// The look menu in the top bar: one button opens a small menu of four
// choices, with a tick on the current one: Day · Sunny garden, Day · Paint
// box, Night, Match device. It sets the mode ("sb.theme": "light", "dark", or
// no key for Match device) and, by day, this device's style ("sb.dayStyle").
// Both keys are shared with Wordbright, so a choice in one game shows in the
// other. Same as wordbright/site/js/ui/thememenu.js (copied, not imported).
// A menu button (WAI-ARIA APG): Enter, Space or Down opens it on the ticked
// choice; Up/Down/Home/End move; Enter or Space chooses; Esc, Tab or a click
// outside closes it.
import { getTheme, setTheme, getDayStyle, setDayStyle } from './store.js';
import { announce } from './daystyle.js';

export const CHOICES = [
  { id: 'garden', label: 'Day · Sunny garden', short: 'Sunny garden', mode: 'light', dayStyle: 'garden' },
  { id: 'paint', label: 'Day · Paint box', short: 'Paint box', mode: 'light', dayStyle: 'paint' },
  { id: 'night', label: 'Night', short: 'Night', mode: 'dark' },
  { id: 'system', label: 'Match device', short: 'Match device', mode: 'system' },
];

// The ticked choice, from what is saved.
export function currentChoice() {
  const mode = getTheme();
  if (mode === 'dark') return 'night';
  if (mode === 'light') return getDayStyle();
  return 'system';
}

// Save a choice; theme-boot then sets data-theme and data-style.
// Match device keeps the saved day style for the daytime.
export function choose(id) {
  const c = CHOICES.find((x) => x.id === id);
  if (!c) return false;
  if (c.dayStyle) setDayStyle(c.dayStyle);
  setTheme(c.mode);
  return true;
}

export function buttonLabel(id = currentChoice()) {
  const c = CHOICES.find((x) => x.id === id);
  return 'Look: ' + c.label.replace(' · ', ', ') + '. Change the look';
}

// btn: the menu button; menu: the [role=menu] list of [data-choice] items;
// doc: the document (for clicks outside). Returns a function that stops listening.
export function wireThemeMenu(btn, menu, doc) {
  const items = [...menu.querySelectorAll('[data-choice]')];
  const isOpen = () => btn.getAttribute('aria-expanded') === 'true';

  function show() {
    const id = currentChoice();
    btn.setAttribute('data-choice', id);
    btn.setAttribute('aria-label', buttonLabel(id));
    const name = btn.querySelector('[data-theme-name]');
    if (name) name.textContent = CHOICES.find((c) => c.id === id).short;
    items.forEach((it) => it.setAttribute('aria-checked', String(it.dataset.choice === id)));
  }

  function open(focusAt = 'checked') {
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    const at = focusAt === 'last' ? items.length - 1
      : Math.max(0, items.findIndex((it) => it.getAttribute('aria-checked') === 'true'));
    focusItem(at);
  }
  function close(returnFocus = true) {
    if (!isOpen()) return;
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (returnFocus) btn.focus();
  }
  function focusItem(i) {
    const k = (i + items.length) % items.length;
    items.forEach((it, j) => { it.tabIndex = j === k ? 0 : -1; });
    items[k].focus();
  }
  const at = (el) => items.indexOf(el);

  function pick(it) {
    choose(it.dataset.choice);
    show();
    close();
    announce(); // the For parents picker, if open, follows
  }

  const onBtnClick = () => (isOpen() ? close() : open());
  const onBtnKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); open('last'); }
  };
  const onMenuKey = (e) => {
    const i = at(e.target);
    if (i < 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusItem(0); }
    else if (e.key === 'End') { e.preventDefault(); focusItem(items.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(items[i]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') close(false);
  };
  const onMenuClick = (e) => {
    const it = e.target.closest('[data-choice]');
    if (it) pick(it);
  };
  const onDocDown = (e) => {
    if (isOpen() && !menu.contains(e.target) && !btn.contains(e.target)) close(false);
  };
  const onDocKey = (e) => { if (e.key === 'Escape' && isOpen()) close(); };

  btn.addEventListener('click', onBtnClick);
  btn.addEventListener('keydown', onBtnKey);
  menu.addEventListener('keydown', onMenuKey);
  menu.addEventListener('click', onMenuClick);
  doc.addEventListener('pointerdown', onDocDown);
  doc.addEventListener('keydown', onDocKey);
  doc.addEventListener('sb:look', show); // the For parents picker changed the day style
  show();
  return () => {
    btn.removeEventListener('click', onBtnClick);
    btn.removeEventListener('keydown', onBtnKey);
    menu.removeEventListener('keydown', onMenuKey);
    menu.removeEventListener('click', onMenuClick);
    doc.removeEventListener('pointerdown', onDocDown);
    doc.removeEventListener('keydown', onDocKey);
    doc.removeEventListener('sb:look', show);
  };
}
