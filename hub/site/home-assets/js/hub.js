// Waystead Game home page: brand, the look menu (shared with the games as
// "sb.theme" and "sb.dayStyle"), the Wordbright card, and the welcome video
// (only without reduced motion).
import { BRAND, WORDBRIGHT_LIVE } from './config.js';
import { wireThemeMenu } from './thememenu.js';

const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

function wireBrand() {
  document.querySelectorAll('[data-brand]').forEach((el) => {
    const key = el.dataset.brand;
    el.textContent = key === 'partof' ? BRAND.name + ' is part of ' + BRAND.maker : BRAND[key];
  });
  document.querySelector('[data-brand-label]').setAttribute('aria-label', BRAND.name + ' home');
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
wireThemeMenu(document.getElementById('theme'), document.getElementById('theme-menu'), document);
wireWordbright();
wireVideo();
