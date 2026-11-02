// The one-time question on a device that has signed-out progress, the first
// time a player signs in on it: "Save this device's progress to <name>?"
// THIS FILE IS A COPY: edit shared/account/ and run `node tools/sync-shared.mjs`.
//
//   Yes                    merged into that player's progress, once; marked done.
//   Not now                asked again on a later visit (this tab: not again).
//   Never on this device   this player is never asked again on this device.
// The answer is kept per player and per game: wa.import:<player>:<game>
// ("done" or "never"); "Not now" lives in this tab only (sessionStorage).
// The question shows the player's name and picture, so progress is never
// saved to the wrong child. The device's own signed-out progress is left as it is.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const importKey = (playerId, game) => 'wa.import:' + playerId + ':' + game;

export function importStatus(local, tab, playerId, game) {
  try {
    const v = local.getItem(importKey(playerId, game));
    if (v === 'done' || v === 'never') return v;
    if (tab.getItem(importKey(playerId, game)) === 'later') return 'later';
  } catch (e) { /* private mode */ }
  return 'ask';
}

export async function offerImport({ local, tab, player, game, hasDeviceProgress, importNow, ask, stillPlayer = () => true }) {
  if (!player || !hasDeviceProgress()) return 'nothing';
  const status = importStatus(local, tab, player.id, game);
  if (status !== 'ask') return status;
  const answer = await ask(player);
  const key = importKey(player.id, game);
  try {
    if (answer === 'yes') {
      if (!stillPlayer(player.id)) return 'changed'; // the player changed while the question was open
      await importNow(player.id);
      local.setItem(key, 'done');
      return 'imported';
    }
    if (answer === 'never') { local.setItem(key, 'never'); return 'never'; }
    tab.setItem(key, 'later');
  } catch (e) { /* private mode: ask again next time */ }
  return 'later';
}

// The question, as one of the games' own dialogs (.dlg). Escape is "Not now".
export function askImport(doc, player, gameName) {
  return new Promise((resolve) => {
    const d = doc.createElement('dialog');
    d.className = 'dlg dlg--import';
    d.setAttribute('aria-labelledby', 'import-title');
    const face = player.avatar
      ? '<img class="playerchip__face playerchip__face--big" src="' + esc(player.avatar) + '" alt="" width="56" height="56" referrerpolicy="no-referrer">'
      : '<span class="playerchip__face playerchip__face--big playerchip__initial" aria-hidden="true">' + esc(player.name.slice(0, 1).toUpperCase()) + '</span>';
    d.innerHTML = '<div class="importq__who">' + face + '<b>' + esc(player.name) + '</b></div>'
      + '<h2 id="import-title">Save this device\'s progress to ' + esc(player.name) + '?</h2>'
      + '<p>' + esc(gameName) + ' progress made on this device while signed out will be added to ' + esc(player.name)
      + '\'s. It stays on this device for playing signed out.</p>'
      + '<div class="btnrow"><button type="button" class="btn btn--primary" data-answer="yes">Yes</button>'
      + '<button type="button" class="btn btn--ghost" data-answer="later">Not now</button>'
      + '<button type="button" class="btn btn--ghost" data-answer="never">Never on this device</button></div>';
    let done = false;
    const close = (answer) => {
      if (done) return;
      done = true;
      d.close();
      d.remove();
      resolve(answer);
    };
    d.addEventListener('cancel', (e) => { e.preventDefault(); close('later'); });
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-answer]');
      if (b) close(b.dataset.answer);
    });
    doc.body.appendChild(d);
    d.showModal();
    d.querySelector('[data-answer="yes"]').focus();
  });
}
