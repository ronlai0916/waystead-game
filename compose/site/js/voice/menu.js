// The Voice part of the look menu (G8): "Best voice" and this device's best
// few British voices, a tick on the chosen one, and a one-line tip when the
// device has no British voice; with only one (G9), "Add more British voices",
// which opens the steps for this device. Choosing one saves sb.voice and says a few
// words in it. The menu's keyboard handling stays in thememenu.js.
// THIS FILE IS A COPY: edit shared/voice/ and run `node tools/sync-shared.mjs`.
import { voiceChoices, voiceTip, savedVoice, saveVoice, rankVoices, isBritish, voiceLabel, britishCount, deviceKind, MORE_VOICE_STEPS } from './voice.js';
import { SERVER_VOICES, DEVICE_BEST, isServerVoice, serverVoiceFor } from './server.js';

const TICK = '<svg class="thememenu__tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const SPEAKER = '<span class="thememenu__ico" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg></span>';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const SAMPLE = 'Hello! This is how I sound.';
// G9: the "Add more British voices" item (shown only with exactly one British
// voice). It opens the steps for this device below it; it is not a voice.
export const MORE = '+more';
export const moreItemHtml = (open) => '<li role="menuitem" class="thememenu__item thememenu__more" data-voice="' + MORE
  + '" aria-expanded="' + open + '" aria-controls="voice-tip" tabindex="-1"><span></span><span class="thememenu__ico" aria-hidden="true">'
  + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span>Add more British voices</li>';

// G8c: why a Waystead voice cannot be used here now, or '' when it can.
export const serverNeeds = (server) => (!server ? 'sign-in' : !server.signedIn ? 'sign-in' : server.online === false ? 'internet' : '');

// The items as HTML. With `server` ({ signedIn, online }, G8c), the two
// Waystead voices come first (greyed, "needs sign-in" / "needs internet",
// when they cannot be used) and "Best voice" is '@device'; without it, '' as
// before. "Best voice" is named with the voice it uses: "Best British voice (Daniel)".
export function voiceItemsHtml(voices, server = null) {
  const ranked = rankVoices(voices);
  const top = ranked[0];
  const best = { id: server ? DEVICE_BEST : '', label: (ranked.some(isBritish) ? 'Best British voice' : 'Best voice') + (top ? ' (' + voiceLabel(top).replace(/\s*\((.*)\)$/, ', $1') + ')' : '') };
  const needs = server ? serverNeeds(server) : '';
  const waystead = server ? SERVER_VOICES.map((v) => '<li role="menuitemradio" class="thememenu__item" data-voice="' + esc(v.id) + '" aria-checked="false"'
    + (needs ? ' aria-disabled="true"' : '') + ' tabindex="-1">' + TICK + SPEAKER + '<span>' + esc(v.label)
    + (needs ? '<span class="thememenu__needs"> — needs ' + (needs === 'sign-in' ? 'sign-in' : 'internet') + '</span>' : '') + '</span></li>').join('') : '';
  return waystead + [best, ...voiceChoices(voices, 3)].map((c) => '<li role="menuitemradio" class="thememenu__item" data-voice="' + esc(c.id)
    + '" aria-checked="false" tabindex="-1">' + TICK + SPEAKER + esc(c.label) + '</li>').join('');
}

// The ticked item: the voice that will speak. A Waystead voice when it can be
// used (signed in and online: the saved one, or female by default); else the
// saved device voice if it is listed below "Best voice"; else "Best voice".
export function tickedVoice(voices, saved, server = null) {
  const sv = server ? serverVoiceFor(saved, server) : null;
  if (sv) return sv;
  const best = server ? DEVICE_BEST : '';
  return saved && !isServerVoice(saved) && saved !== DEVICE_BEST && voiceChoices(voices, 3).some((c) => c.id === saved) ? saved : best;
}

// menu: the look menu's [role=menu]; speaker: createSpeaker(). Answers
// { items(), pick(id), show() } for wireThemeMenu, or null when this device
// cannot speak (the Voice part then stays hidden).
// server() (G8c): { signedIn, online } for the Waystead voices, or null to
// leave them out (a page with no "Hear"). hearSample(id): says a word in that
// Waystead voice (it falls back to the device by itself).
export function wireVoiceMenu(menu, speaker, { storage = globalThis.localStorage, nav = globalThis.navigator, onChange = () => {},
  server = null, hearSample = null } = {}) {
  const list = menu.querySelector('[data-voice-list]');
  if (!list || !speaker || !speaker.available) return null;
  const tip = menu.querySelector('[data-voice-tip]');
  const parts = [...menu.querySelectorAll('[data-voice-part]')];
  const items = () => [...list.querySelectorAll('[data-voice]')];
  let stepsOpen = false;

  function show() {
    const id = tickedVoice(speaker.voices(), savedVoice(storage), server ? server() : null);
    items().forEach((it) => { if (it.dataset.voice !== MORE) it.setAttribute('aria-checked', String(it.dataset.voice === id)); });
  }
  function draw() {
    const voices = speaker.voices();
    parts.forEach((p) => { p.hidden = !voices.length; });
    const one = britishCount(voices) === 1;
    list.innerHTML = voiceItemsHtml(voices, server ? server() : null) + (one ? moreItemHtml(stepsOpen) : '');
    // No British voice: the tip at once. One: the steps when "Add more" is open.
    const line = one ? (stepsOpen ? MORE_VOICE_STEPS[deviceKind(nav || {})] : '') : voiceTip(voices, nav || {});
    if (tip) { tip.textContent = line || ''; tip.hidden = !line; }
    show();
    onChange();
  }
  draw();
  speaker.onVoices(draw);
  // Signed in or out, on or offline: the Waystead voices are drawn again.
  if (server && typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('online', draw);
    globalThis.addEventListener('offline', draw);
    globalThis.addEventListener('wa:player', draw);
  }

  return {
    items,
    show,
    redraw: draw,
    pick(id) {
      if (id === MORE) {
        stepsOpen = !stepsOpen;
        draw();
        const more = list.querySelector('[data-voice="' + MORE + '"]'); // drawn again: keep the focus on it
        if (more && typeof more.focus === 'function') { more.tabIndex = 0; more.focus(); }
        return;
      }
      if (isServerVoice(id)) {
        if (serverNeeds(server ? server() : null)) return; // greyed: needs sign-in or internet
        saveVoice(storage, id);
        show();
        if (hearSample) hearSample(id);
        return;
      }
      saveVoice(storage, id);
      show();
      speaker.speak(SAMPLE);
    },
  };
}
