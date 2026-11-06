// Entry point: load the tasks, route by the URL hash, wire the top bar.
import { loadTasks } from './tasks.js';
import { wireThemeMenu } from './thememenu.js';
import { stop, getSpeaker, hearSample, useVoiceAccount } from './speech.js';
import * as V from './views.js';
import * as G from './grownups-views.js';
import * as S from './store.js';
import * as W from './writing-doc.js';
import { wireVoiceMenu } from './voice/menu.js';
import { startAccount } from './account/boot.js';
import { gateHtml, gateCard } from './account/gate.js';
import { isLocked, isPlayPath, isComposePath } from './gate.js';
import { watchForUpdate } from './update.js';
import { wireTopNav } from './nav/nav.js';
import { useWho } from './who.js';

const main = document.getElementById('main');
const backBtn = document.getElementById('back');
let cleanup = null;
let account = null;
let voiceMenu = null;
let drawn = false;
let updates = null;
const currentPath = () => decodeURI(location.hash.replace(/^#\/?/, '')).split('?')[0];

const ROUTES = [
  ['', V.home],
  ['about', V.about],
  ['writing', V.writing],
  ['writing/:pid', V.piece],
  ['t/:id/look', V.look],
  ['t/:id/plan', V.plan],
  ['t/:id/write', V.write],
  ['t/:id/check', V.check],
  ['t/:id/feedback', V.feedback],
  ['t/:id/better', V.better],
  ['grownups', G.grownups],
  ['grownups/tasks', G.taskReview],
  ['grownups/child/:cid', G.childPage],
  ['grownups/child/:cid/p/:pid', G.piecePage],
];
function match(path) {
  const parts = path.split('/').filter(Boolean);
  for (const [pattern, view] of ROUTES) {
    const pp = pattern.split('/').filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params = {};
    if (pp.every((seg, i) => { if (seg.startsWith(':')) { params[seg.slice(1)] = parts[i]; return true; } return seg === parts[i]; })) return { view, params };
  }
  return null;
}
function parentOf(path) {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 't') return parts[2] === 'look' ? '#/' : '#/t/' + parts[1] + '/look';
  if (parts[0] === 'grownups') return parts.length > 3 ? '#/grownups/child/' + parts[2] : parts.length > 1 ? '#/grownups' : '#/';
  parts.pop();
  return '#/' + parts.join('/');
}
let waiting = null;
function gated(path) {
  waiting = null;
  if (!account) return false;
  const answer = account.gate(path, isLocked(path));
  if (answer === 'play') return false;
  main.innerHTML = gateHtml(gateCard(answer, navigator.onLine), account.signInHref(), { href: '#/about', label: 'About Composition' });
  backBtn.hidden = path === '';
  backBtn.onclick = () => { location.hash = parentOf(path); };
  const retry = main.querySelector('[data-gate-retry]');
  if (retry) retry.addEventListener('click', () => account.session.refresh().then(() => render()));
  if (answer === 'wait') {
    waiting = path;
    account.ready.then(() => { if (waiting === path) render(); });
  }
  document.title = main.querySelector('h1').textContent + ' · Composition by Waystead';
  return true;
}
function render() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  stop();
  const path = currentPath();
  if (gated(path)) return;
  const found = match(path);
  backBtn.hidden = path === '';
  backBtn.onclick = () => { location.hash = parentOf(path); };
  document.querySelectorAll('.topbar__nav a, .navmenu a').forEach((a) => {
    a.toggleAttribute('aria-current', a.getAttribute('href') === '#/' + path.split('/')[0]);
    if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page');
  });
  if (!found) {
    if (!isComposePath(path)) { V.notFound(main); return; }
    updates.settled().then(() => { if (currentPath() === path) V.notFound(main); });
    return;
  }
  cleanup = found.view(main, found.params) || null;
  const h1 = main.querySelector('h1');
  document.title = (path && h1 ? h1.textContent + ' · ' : '') + 'Composition by Waystead';
}
function onNavigate() {
  render();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}
function wireTheme() {
  const menu = document.getElementById('theme-menu');
  voiceMenu = wireVoiceMenu(menu, getSpeaker(), {
    server: () => ({ signedIn: !!(account && account.session.player), online: navigator.onLine !== false }),
    hearSample,
  });
  wireThemeMenu(document.getElementById('theme'), menu, document, voiceMenu);
}
function wireAccount() {
  account = startAccount({
    slot: document.getElementById('player-slot'),
    game: 'compose',
    usePlayer: (p, onChange) => S.usePlayer(p ? p.id : null, onChange),
    docs: (id) => ({
      [W.DOC_KEY]: {
        read: () => (S.has('writing', id) ? S.readWriting(id) : undefined),
        write: (v) => S.writeWriting(W.normalise(v), id),
        merge: W.merge,
        prepare: (v) => W.trim(W.normalise(v), Date.now()),
      },
      // A parent's values: this device only ever reads them, and the account refuses a child's write.
      [W.MARKS_KEY]: { read: () => (S.has('marks', id) ? S.readMarks(id) : undefined), write: (v) => S.writeMarks(W.normaliseMarks(v), id), merge: (_, remote) => W.normaliseMarks(remote) },
      [W.SETTINGS_KEY]: { read: () => (S.has('settings', id) ? S.readSettings(id) : undefined), write: (v) => S.writeSettings(W.normaliseSettings(v), id), merge: (_, remote) => W.normaliseSettings(remote) },
    }),
    redraw: () => { if (drawn) render(); },
    busy: () => isPlayPath(currentPath()),
    applyLook: () => {
      if (window.sbTheme) window.sbTheme.apply();
      document.dispatchEvent(new Event('sb:look'));
    },
  });
  useVoiceAccount(() => (account ? { origin: account.origin, signedIn: !!account.session.player } : null));
  account.session.on(() => { if (voiceMenu) voiceMenu.redraw(); });
  useWho(() => account.session.player, () => account.session.refresh());
  let knownKind = '';
  account.session.on(({ player }) => {
    const k = (player && player.kind) || '';
    if (k !== knownKind) { knownKind = k; if (drawn && !isPlayPath(currentPath())) render(); }
  });
}
async function start() {
  updates = watchForUpdate({
    sw: 'serviceWorker' in navigator && location.protocol === 'https:' ? navigator.serviceWorker : null,
    isBusy: () => isPlayPath(currentPath()),
    reload: () => location.reload(),
    onLeave: (fn) => window.addEventListener('hashchange', fn),
  });
  wireTopNav();
  wireTheme();
  wireAccount();
  try {
    await loadTasks();
  } catch (e) {
    main.innerHTML = '<section class="wrap page"><div class="card empty"><h1>The stories didn\'t load</h1><p class="muted">Check your connection, then reload the page.</p></div></section>';
    console.error(e);
    return;
  }
  window.addEventListener('hashchange', onNavigate);
  updates.register();
  drawn = true;
  render();
}
start();
