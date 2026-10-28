// Waystead Game home page: brand, theme (shared with the games as "sb.theme"),
// the Wordbright card, and the welcome video (only without reduced motion).
import { BRAND, WORDBRIGHT_LIVE } from './config.js';

const THEME_KEY = 'sb.theme';
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

function wireBrand() {
  document.querySelectorAll('[data-brand]').forEach((el) => {
    const key = el.dataset.brand;
    el.textContent = key === 'partof' ? BRAND.name + ' is part of ' + BRAND.maker : BRAND[key];
  });
  document.querySelector('[data-brand-label]').setAttribute('aria-label', BRAND.name + ' home');
}

function getTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch (e) { return 'system'; }
}
function setTheme(t) {
  try {
    if (t === 'light' || t === 'dark') localStorage.setItem(THEME_KEY, t);
    else localStorage.removeItem(THEME_KEY);
  } catch (e) { /* private mode: keep going */ }
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
  else root.removeAttribute('data-theme');
  root.setAttribute('data-theme-mode', t === 'light' || t === 'dark' ? t : 'system');
}
function wireTheme() {
  const btn = document.getElementById('theme');
  const names = { system: 'match device', light: 'light', dark: 'dark' };
  const label = () => btn.setAttribute('aria-label', 'Theme: ' + names[getTheme()] + '. Change theme');
  label();
  btn.addEventListener('click', () => {
    setTheme({ system: 'light', light: 'dark', dark: 'system' }[getTheme()]);
    label();
  });
}

// Before launch the card says "Coming soon" and is not a link.
function wireWordbright() {
  if (!WORDBRIGHT_LIVE) return;
  const card = document.querySelector('[data-wordbright]');
  const link = document.createElement('a');
  link.className = card.className;
  link.href = 'wordbright/';
  link.innerHTML = card.innerHTML;
  link.querySelector('.game__soon').outerHTML = '<span class="game__go">Play Wordbright ' + ARROW + '</span>';
  card.replaceWith(link);
}

// The welcome loop: muted, no controls, never with reduced motion.
function wireVideo() {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches) return;
  const box = document.querySelector('[data-hero]');
  const v = document.createElement('video');
  v.className = 'hero__video';
  v.muted = true;
  v.loop = true;
  v.autoplay = true;
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.setAttribute('aria-hidden', 'true');
  v.preload = 'auto';
  v.poster = 'home-assets/img/hero-1280.webp';
  v.innerHTML = '<source src="home-assets/video/welcome.webm" type="video/webm"><source src="home-assets/video/welcome.mp4" type="video/mp4">';
  v.addEventListener('playing', () => v.classList.add('is-on'), { once: true });
  box.appendChild(v);
  v.play().catch(() => v.remove()); // autoplay refused (e.g. low-power mode): keep the picture
  motion.addEventListener('change', () => { if (motion.matches) v.remove(); });
}

wireBrand();
wireTheme();
wireWordbright();
wireVideo();
