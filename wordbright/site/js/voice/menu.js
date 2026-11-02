// The Voice part of the look menu (G8): "Best voice" and this device's best
// few British voices, a tick on the chosen one, and a one-line tip when the
// device has no British voice; with only one (G9), "Add more British voices",
// which opens the steps for this device. Choosing one saves sb.voice and says a few
// words in it. The menu's keyboard handling stays in thememenu.js.
// THIS FILE IS A COPY: edit shared/voice/ and run `node tools/sync-shared.mjs`.
import { voiceChoices, voiceTip, savedVoice, saveVoice, rankVoices, isBritish, voiceLabel, britishCount, deviceKind, MORE_VOICE_STEPS } from './voice.js';

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

// The items as HTML: '' is "Best voice" (the automatic choice), named with the
// voice it uses: "Best British voice (Daniel)", "Best British voice (Serena, Premium)".
export function voiceItemsHtml(voices) {
  const ranked = rankVoices(voices);
  const top = ranked[0];
  const best = { id: '', label: (ranked.some(isBritish) ? 'Best British voice' : 'Best voice') + (top ? ' (' + voiceLabel(top).replace(/\s*\((.*)\)$/, ', $1') + ')' : '') };
  return [best, ...voiceChoices(voices, 3)].map((c) => '<li role="menuitemradio" class="thememenu__item" data-voice="' + esc(c.id)
    + '" aria-checked="false" tabindex="-1">' + TICK + SPEAKER + esc(c.label) + '</li>').join('');
}

// The ticked item: the saved voice if it is listed below "Best voice", else
// "Best voice" (which is also right when the saved voice is the best one).
export function tickedVoice(voices, saved) {
  return saved && voiceChoices(voices, 3).some((c) => c.id === saved) ? saved : '';
}

// menu: the look menu's [role=menu]; speaker: createSpeaker(). Answers
// { items(), pick(id), show() } for wireThemeMenu, or null when this device
// cannot speak (the Voice part then stays hidden).
export function wireVoiceMenu(menu, speaker, { storage = globalThis.localStorage, nav = globalThis.navigator, onChange = () => {} } = {}) {
  const list = menu.querySelector('[data-voice-list]');
  if (!list || !speaker || !speaker.available) return null;
  const tip = menu.querySelector('[data-voice-tip]');
  const parts = [...menu.querySelectorAll('[data-voice-part]')];
  const items = () => [...list.querySelectorAll('[data-voice]')];
  let stepsOpen = false;

  function show() {
    const id = tickedVoice(speaker.voices(), savedVoice(storage));
    items().forEach((it) => { if (it.dataset.voice !== MORE) it.setAttribute('aria-checked', String(it.dataset.voice === id)); });
  }
  function draw() {
    const voices = speaker.voices();
    parts.forEach((p) => { p.hidden = !voices.length; });
    const one = britishCount(voices) === 1;
    list.innerHTML = voiceItemsHtml(voices) + (one ? moreItemHtml(stepsOpen) : '');
    // No British voice: the tip at once. One: the steps when "Add more" is open.
    const line = one ? (stepsOpen ? MORE_VOICE_STEPS[deviceKind(nav || {})] : '') : voiceTip(voices, nav || {});
    if (tip) { tip.textContent = line || ''; tip.hidden = !line; }
    show();
    onChange();
  }
  draw();
  speaker.onVoices(draw);

  return {
    items,
    show,
    pick(id) {
      if (id === MORE) {
        stepsOpen = !stepsOpen;
        draw();
        const more = list.querySelector('[data-voice="' + MORE + '"]'); // drawn again: keep the focus on it
        if (more && typeof more.focus === 'function') { more.tabIndex = 0; more.focus(); }
        return;
      }
      saveVoice(storage, id);
      show();
      speaker.speak(SAMPLE);
    },
  };
}
