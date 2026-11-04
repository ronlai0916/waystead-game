// The top bar's links (G4b): on one line when there is room, otherwise behind a
// "Menu" button with a dropdown. Never wrapped. Room is measured, not guessed
// from the width, because it depends on the player's name, the style's fonts
// and the Back button. Under 700 px the nav is always folded away (the same
// number is in each site's CSS), and under 600 px All games joins the menu.
// THIS FILE IS A COPY: edit shared/topbar/ and run `node tools/sync-shared.mjs`.

export const ALWAYS_MENU_PX = 700;
// Room to spare before the links show: a bar that only just fits looks crowded.
export const SPARE_PX = 24;

/** Do these widths fit in `room`, with `gap` between each? */
export const fits = (room, widths, gap) => widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1) <= room;

const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

// Call once, before the first draw. Returns a function that stops listening.
export function wireTopNav(doc = document, win = window) {
  const inner = doc.querySelector('.topbar__inner');
  const nav = doc.querySelector('.topbar__nav');
  if (!inner || !nav) return () => {};
  const brand = inner.querySelector('.brand');
  const allGames = inner.querySelector('.allgames');

  const box = doc.createElement('div');
  box.className = 'thememenu navmenu';
  box.hidden = true;
  box.innerHTML = '<button type="button" class="iconbtn navmenu__btn" id="nav-menu-btn" aria-expanded="false" aria-controls="nav-menu" aria-label="Menu">'
    + ICON + '<span class="navmenu__text">Menu</span></button><ul class="thememenu__list" id="nav-menu" hidden></ul>';
  const btn = box.querySelector('button');
  const list = box.querySelector('ul');
  const addLink = (a, cls = '') => {
    const li = doc.createElement('li');
    if (cls) li.className = cls;
    const link = doc.createElement('a');
    link.className = 'thememenu__item';
    link.href = a.getAttribute('href');
    link.textContent = a.textContent.trim();
    li.append(link);
    list.append(li);
  };
  nav.querySelectorAll('a').forEach((a) => addLink(a));
  if (allGames) addLink(allGames, 'navmenu__phone');
  nav.after(box);

  const links = () => [...list.querySelectorAll('a')].filter((a) => a.getClientRects().length);
  const isOpen = () => !list.hidden;
  const open = (focusAt = -1) => {
    list.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    const all = links();
    if (focusAt !== -1 && all.length) all[focusAt === 'last' ? all.length - 1 : 0].focus();
  };
  const close = (returnFocus = true) => {
    if (!isOpen()) return;
    list.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (returnFocus) btn.focus();
  };

  const measure = () => {
    const cs = win.getComputedStyle(inner);
    const room = inner.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const others = [...inner.children].filter((el) => el !== nav && el !== box && el.getClientRects().length)
      .map((el) => (el === brand ? el.scrollWidth : Math.ceil(el.getBoundingClientRect().width)));
    const folded = win.matchMedia('(max-width: ' + ALWAYS_MENU_PX + 'px)').matches
      || !fits(room - SPARE_PX, [...others, nav.scrollWidth], parseFloat(cs.columnGap) || 0);
    nav.classList.toggle('is-folded', folded);
    box.hidden = !folded;
    if (!folded) close(false);
  };
  let frame = 0;
  const later = () => { if (!frame) frame = win.requestAnimationFrame(() => { frame = 0; measure(); }); };

  const onBtnClick = () => (isOpen() ? close() : open());
  const onBtnKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); open('first'); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); open('last'); }
  };
  const onListKey = (e) => {
    const all = links();
    const i = all.indexOf(e.target);
    if (i < 0) return;
    const to = { ArrowDown: (i + 1) % all.length, ArrowUp: (i - 1 + all.length) % all.length, Home: 0, End: all.length - 1 }[e.key];
    if (to !== undefined) { e.preventDefault(); all[to].focus(); }
  };
  const onListClick = (e) => { if (e.target.closest('a')) close(false); };
  const onFocusOut = (e) => { if (e.relatedTarget && !box.contains(e.relatedTarget)) close(false); };
  const onDocDown = (e) => { if (isOpen() && !box.contains(e.target)) close(false); };
  const onDocKey = (e) => { if (e.key === 'Escape' && isOpen()) close(); };

  btn.addEventListener('click', onBtnClick);
  btn.addEventListener('keydown', onBtnKey);
  list.addEventListener('keydown', onListKey);
  list.addEventListener('click', onListClick);
  box.addEventListener('focusout', onFocusOut);
  doc.addEventListener('pointerdown', onDocDown);
  doc.addEventListener('keydown', onDocKey);
  // Anything that changes a width: the window, the player's chip, a style's fonts, Back.
  const sizes = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(later) : null;
  if (sizes) [inner, ...inner.children].filter((el) => el !== box).forEach((el) => sizes.observe(el));
  win.addEventListener('resize', later);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(later);
  measure();
  return () => {
    btn.removeEventListener('click', onBtnClick);
    btn.removeEventListener('keydown', onBtnKey);
    list.removeEventListener('keydown', onListKey);
    list.removeEventListener('click', onListClick);
    box.removeEventListener('focusout', onFocusOut);
    doc.removeEventListener('pointerdown', onDocDown);
    doc.removeEventListener('keydown', onDocKey);
    win.removeEventListener('resize', later);
    if (sizes) sizes.disconnect();
  };
}
