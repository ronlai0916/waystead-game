// G8: the device voice for "Hear" (shared/voice/): which voice is chosen from
// a device's list, the saved choice, the tip when there is no British voice,
// and what speak() hands to speechSynthesis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankVoices, pickVoice, voiceChoices, voiceTip, isNovelty, createSpeaker, saveVoice, savedVoice, VOICE_KEY, RATE, britishCount, deviceKind, MORE_VOICE_STEPS } from '../voice/voice.js';
import { voiceItemsHtml, tickedVoice, wireVoiceMenu, SAMPLE, MORE } from '../voice/menu.js';
import { memoryStorage } from './fake-account.js';

const v = (name, lang, extra = {}) => ({ name, lang, localService: true, default: false, voiceURI: name, ...extra });

// macOS / iOS Safari: novelty voices, compact and Premium British voices, American ones.
const APPLE = [
  v('Albert', 'en-US'), v('Bad News', 'en-US'), v('Bubbles', 'en-US'), v('Zarvox', 'en-US'), v('Whisper', 'en-US'),
  v('Eddy (English (UK))', 'en-GB'), v('Grandma (English (UK))', 'en-GB'), v('Rocko (English (UK))', 'en-GB'),
  v('Daniel', 'en-GB', { default: true }), v('Kate', 'en-GB'), v('Serena (Premium)', 'en-GB'), v('Arthur', 'en-GB'),
  v('Samantha', 'en-US'), v('Alex', 'en-US'), v('Thomas', 'fr-FR'), v('Anna', 'de-DE'),
];
// Chrome on Windows: Microsoft desktop voices, Google's network voices.
const CHROME_WIN = [
  v('Microsoft David - English (United States)', 'en-US'), v('Microsoft Hazel - English (United Kingdom)', 'en-GB'),
  v('Google US English', 'en-US', { localService: false }), v('Google UK English Female', 'en-GB', { localService: false }),
  v('Google UK English Male', 'en-GB', { localService: false }), v('Google français', 'fr-FR', { localService: false }),
];
// Edge: the Natural voices. Android: en_GB with an underscore.
const EDGE = [v('Microsoft Sonia Online (Natural) - English (United Kingdom)', 'en-GB', { localService: false }), v('Microsoft Hazel - English (United Kingdom)', 'en-GB')];
const ANDROID = [v('English United States', 'en_US'), v('English United Kingdom', 'en_GB')];
// No British voice at all.
const US_ONLY = [v('Samantha', 'en-US'), v('Bubbles', 'en-US'), v('Thomas', 'fr-FR')];

test('the best voice: en-GB first, Premium/Enhanced/Natural, then known good; never a novelty voice', () => {
  assert.equal(pickVoice(APPLE).name, 'Serena (Premium)');
  assert.equal(pickVoice(APPLE.filter((x) => !/Premium/.test(x.name))).name, 'Daniel', 'Daniel, Kate and Arthur are known good; Daniel is the default');
  assert.equal(pickVoice(CHROME_WIN).name, 'Google UK English Female');
  assert.equal(pickVoice(EDGE).name, 'Microsoft Sonia Online (Natural) - English (United Kingdom)');
  assert.equal(pickVoice(ANDROID).name, 'English United Kingdom', 'en_GB counts as British');
  assert.equal(pickVoice([v('Daniel (Enhanced)', 'en-GB'), v('Serena', 'en-GB')]).name, 'Daniel (Enhanced)');
  assert.equal(pickVoice([v('Serena', 'en-GB', { voiceURI: 'com.apple.voice.premium.en-GB.Serena' }), v('Daniel', 'en-GB')]).name, 'Serena', 'Safari marks Premium in the voice URI');
  for (const list of [APPLE, CHROME_WIN, EDGE, ANDROID, US_ONLY]) assert.ok(rankVoices(list).every((x) => !isNovelty(x) && /^en/i.test(x.lang)));
  assert.ok(isNovelty(v('Eddy (English (UK))', 'en-GB')) && isNovelty(v('Grandma (English (UK))', 'en-GB')) && isNovelty(v('Zarvox', 'en-US')));
  assert.ok(isNovelty(v('Reed', 'en-GB', { voiceURI: 'com.apple.eloquence.en-GB.Reed' })));
  assert.equal(pickVoice([v('Bubbles', 'en-US'), v('Thomas', 'fr-FR')]), null, 'only novelty or other languages: none');
  assert.equal(pickVoice([]), null);
});

test('no British voice: the best English voice, and a one-line tip for this device', () => {
  assert.equal(pickVoice(US_ONLY).name, 'Samantha');
  assert.equal(voiceTip(US_ONLY, { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }),
    'For a British voice: Settings → Accessibility → Spoken Content → Voices → English (UK).');
  assert.equal(voiceTip(US_ONLY, { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 }),
    'For a British voice: Settings → Accessibility → Spoken Content → Voices → English (UK).', 'an iPad says it is a Mac');
  assert.equal(voiceTip(US_ONLY, { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 }),
    'For a British voice: System Settings → Accessibility → Spoken Content → Manage Voices.');
  assert.match(voiceTip(US_ONLY, { userAgent: 'Mozilla/5.0 (Windows NT 10.0)' }), /English \(UK\)/);
  assert.equal(voiceTip(APPLE, {}), null, 'a British voice: no tip');
  assert.equal(voiceTip([], {}), null, 'no voices listed yet: no tip');
});

test('the saved choice (sb.voice) wins when this device has it; otherwise the best voice', () => {
  assert.equal(pickVoice(APPLE, 'Kate').name, 'Kate');
  assert.equal(pickVoice(APPLE, 'Microsoft Sonia Online (Natural) - English (United Kingdom)').name, 'Serena (Premium)', 'from another device');
  assert.equal(pickVoice(APPLE, 'Bubbles').name, 'Serena (Premium)', 'never a novelty voice, even if saved');
  const s = memoryStorage();
  const fired = [];
  const win = { dispatchEvent: (e) => fired.push(e.type) };
  saveVoice(s, 'Kate', win);
  assert.equal(s.getItem(VOICE_KEY), 'Kate');
  assert.equal(VOICE_KEY, 'sb.voice');
  assert.deepEqual(fired, ['wa:look'], 'sent to the account with the look');
  saveVoice(s, '', win);
  assert.equal(s.getItem(VOICE_KEY), null, '"Best voice" is no key');
  assert.equal(savedVoice(s), '');
});

test('the Voice menu: "Best British voice (<the voice it uses>)", then up to 3 other British voices; the tick follows sb.voice', () => {
  assert.deepEqual(voiceChoices(APPLE, 3).map((c) => c.id), ['Daniel', 'Arthur', 'Kate'], 'Serena is the best: not listed again');
  assert.deepEqual(voiceChoices(CHROME_WIN, 3).map((c) => c.label), ['UK English Male', 'Hazel']);
  const html = voiceItemsHtml(APPLE);
  assert.equal((html.match(/role="menuitemradio"/g) || []).length, 4);
  assert.match(html, /data-voice=""[^>]*>.*Best British voice \(Serena, Premium\)<\/li>/);
  assert.equal((html.match(/Serena/g) || []).length, 1, 'the best voice appears once');
  assert.match(voiceItemsHtml(APPLE.filter((x) => !/Premium/.test(x.name))), /Best British voice \(Daniel\)<\/li>/);
  assert.match(voiceItemsHtml(CHROME_WIN), /Best British voice \(UK English Female\)/);
  assert.doesNotMatch(html, /Bubbles|Eddy|Samantha|style=/);
  assert.match(voiceItemsHtml(US_ONLY), /Best voice \(Samantha\)<\/li>/);
  assert.equal(tickedVoice(APPLE, 'Daniel'), 'Daniel');
  assert.equal(tickedVoice(APPLE, 'Serena (Premium)'), '', 'the best voice saved: "Best" is ticked');
  assert.equal(tickedVoice(APPLE, 'Gone'), '', 'not on this device: Best voice is ticked');
});

// A fake speechSynthesis that records what it is asked to do.
function fakeSynth(voices, { failNetwork = false } = {}) {
  const log = [];
  const listeners = [];
  const synth = {
    getVoices: () => voices,
    cancel: () => log.push('cancel'),
    speak: (u) => {
      log.push({ text: u.text, voice: u.voice ? u.voice.name : null, lang: u.lang, rate: u.rate });
      queueMicrotask(() => (failNetwork && u.voice && !u.voice.localService ? u.onerror({ error: 'network' }) : u.onend()));
    },
    addEventListener: (t, fn) => { if (t === 'voiceschanged') listeners.push(fn); },
    setVoices(list) { voices = list; listeners.forEach((fn) => fn()); },
  };
  class Utterance { constructor(text) { this.text = text; } }
  return { synth, Utterance, log };
}

test('speak(): cancel first, then the chosen en-GB voice at rate 0.9; voices that arrive late are used', async () => {
  const f = fakeSynth([]);
  const sp = createSpeaker({ synth: f.synth, Utterance: f.Utterance, storage: memoryStorage() });
  await sp.speak('rhythm');
  assert.deepEqual(f.log, ['cancel', { text: 'rhythm', voice: null, lang: 'en-GB', rate: RATE }], 'no voices yet (Safari): still en-GB');
  assert.equal(RATE, 0.9);
  let told = 0;
  sp.onVoices(() => { told++; });
  f.synth.setVoices(APPLE);
  assert.equal(told, 1);
  f.log.length = 0;
  assert.equal(await sp.speak('necessary'), true);
  assert.deepEqual(f.log, ['cancel', { text: 'necessary', voice: 'Serena (Premium)', lang: 'en-GB', rate: 0.9 }]);
});

test('speak(): a network voice that fails offline is tried again with the best voice on the device', async () => {
  const f = fakeSynth(CHROME_WIN, { failNetwork: true });
  const sp = createSpeaker({ synth: f.synth, Utterance: f.Utterance, storage: memoryStorage() });
  assert.equal(await sp.speak('yacht'), true);
  const spoken = f.log.filter((x) => typeof x === 'object').map((x) => x.voice);
  assert.deepEqual(spoken, ['Google UK English Female', 'Microsoft Hazel - English (United Kingdom)']);
});

test('wireVoiceMenu: hidden on a device that cannot speak; picking a voice saves it and says hello in it', async () => {
  assert.equal(wireVoiceMenu({ querySelector: () => ({}) }, null), null);
  const f = fakeSynth(APPLE);
  const storage = memoryStorage();
  const sp = createSpeaker({ synth: f.synth, Utterance: f.Utterance, storage });
  const items = [];
  const list = {
    set innerHTML(h) { items.length = 0; for (const m of h.matchAll(/data-voice="([^"]*)"/g)) items.push({ dataset: { voice: m[1] }, attrs: {}, setAttribute(k, x) { this.attrs[k] = x; } }); },
    querySelectorAll: () => items,
  };
  const tip = { hidden: true, textContent: '' };
  const parts = [{ hidden: true }, { hidden: true }];
  const menu = { querySelector: (s) => (s === '[data-voice-list]' ? list : s === '[data-voice-tip]' ? tip : null), querySelectorAll: () => parts };
  const vm = wireVoiceMenu(menu, sp, { storage, nav: {} });
  assert.equal(vm.items().length, 4);
  assert.ok(parts.every((p) => !p.hidden));
  assert.equal(tip.hidden, true);
  assert.equal(vm.items()[0].attrs['aria-checked'], 'true', 'Best voice ticked');
  vm.pick('Daniel');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(storage.getItem('sb.voice'), 'Daniel');
  assert.equal(vm.items().find((i) => i.dataset.voice === 'Daniel').attrs['aria-checked'], 'true');
  assert.deepEqual(f.log.at(-1), { text: SAMPLE, voice: 'Daniel', lang: 'en-GB', rate: 0.9 });
  f.synth.setVoices(US_ONLY);
  assert.equal(tip.hidden, false, 'no British voice: the tip shows');
});

// ---- G9: "Add more British voices" -------------------------------------------------
function voiceMenuFor(voices, nav) {
  const f = fakeSynth(voices);
  const storage = memoryStorage();
  const sp = createSpeaker({ synth: f.synth, Utterance: f.Utterance, storage });
  const items = [];
  const list = {
    html: '',
    set innerHTML(h) { this.html = h; items.length = 0; for (const m of h.matchAll(/data-voice="([^"]*)"/g)) items.push({ dataset: { voice: m[1] }, attrs: {}, setAttribute(k, x) { this.attrs[k] = x; } }); },
    querySelectorAll: () => items,
    querySelector: (sel) => items.find((i) => sel.includes('"' + i.dataset.voice + '"')) || null,
  };
  const tip = { hidden: true, textContent: '' };
  const menu = { querySelector: (s) => (s === '[data-voice-list]' ? list : s === '[data-voice-tip]' ? tip : null), querySelectorAll: () => [] };
  return { vm: wireVoiceMenu(menu, sp, { storage, nav }), list, tip, storage, f };
}
const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' };
const MAC = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 };

test('G9: one British voice: "Add more British voices" opens the steps for this device; two or more: never shown', () => {
  const ONE = [v('Daniel', 'en-GB'), v('Samantha', 'en-US'), v('Bubbles', 'en-US')];
  assert.equal(britishCount(ONE), 1);
  const { vm, list, tip, storage } = voiceMenuFor(ONE, IPHONE);
  assert.match(list.html, /data-voice="\+more"[^>]*aria-expanded="false"[^>]*>.*Add more British voices<\/li>/);
  assert.equal(tip.hidden, true, 'closed at first');
  vm.pick(MORE);
  assert.equal(tip.hidden, false);
  assert.equal(tip.textContent, 'Settings → Accessibility → Spoken Content → Voices → English → English (UK), then download Serena (Premium) or Kate (Enhanced).');
  assert.match(list.html, /aria-expanded="true"/);
  assert.equal(storage.getItem('sb.voice'), null, 'not a voice: nothing saved');
  vm.pick(MORE);
  assert.equal(tip.hidden, true, 'closes again');
  const mac = voiceMenuFor(ONE, MAC);
  mac.vm.pick(MORE);
  assert.equal(mac.tip.textContent, 'System Settings → Accessibility → Spoken Content → System voice → Manage Voices → English (United Kingdom).');
  const other = voiceMenuFor(ONE, { userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0' });
  other.vm.pick(MORE);
  assert.equal(other.tip.textContent, MORE_VOICE_STEPS.other);
  assert.equal(deviceKind({ userAgent: 'Mozilla/5.0 (Macintosh)', maxTouchPoints: 5 }), 'ios', 'an iPad says it is a Mac');
  for (const two of [[v('Daniel', 'en-GB'), v('Kate', 'en-GB')], APPLE, CHROME_WIN]) {
    const t = voiceMenuFor(two, IPHONE);
    assert.doesNotMatch(t.list.html, /Add more British voices/);
    assert.equal(t.tip.hidden, true);
  }
  const none = voiceMenuFor(US_ONLY, IPHONE);
  assert.doesNotMatch(none.list.html, /Add more British voices/, 'none: the old one-line tip instead');
  assert.equal(none.tip.hidden, false);
});

test('G9: "Add more British voices" steps for each kind of device', () => {
  const UA = {
    ios: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' },
    ipad: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', maxTouchPoints: 5 },
    mac: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 },
    android: { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36' },
    samsung: { userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36' },
    windows: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36 Edg/128.0' },
    chromeos: { userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 15917.71.0) AppleWebKit/537.36 Chrome/128.0 Safari/537.36' },
    linux: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0' },
  };
  const want = { ios: 'ios', ipad: 'ios', mac: 'mac', android: 'android', samsung: 'android', windows: 'windows', chromeos: 'chromeos', linux: 'other' };
  for (const [k, nav] of Object.entries(UA)) assert.equal(deviceKind(nav), want[k], k);
  assert.match(MORE_VOICE_STEPS.android, /^Settings → System → Languages & input → Text-to-speech output → Speech Services by Google → ⚙ → Install voice data → English \(United Kingdom\)\. On Samsung: Settings → General management → Text-to-speech\. Menu names differ between phone makers\.$/);
  assert.match(MORE_VOICE_STEPS.windows, /Manage voices → Add voices → English \(United Kingdom\)\. Then restart the browser\. In Microsoft Edge, the UK Natural voices \(e\.g\. Sonia, Ryan\) are already available\.$/);
  assert.equal(MORE_VOICE_STEPS.chromeos, 'Settings → Accessibility → Text-to-Speech → Speech engine → add English (UK).');
  assert.match(MORE_VOICE_STEPS.ios, /Serena \(Premium\) or Kate \(Enhanced\)/);
  assert.match(MORE_VOICE_STEPS.mac, /Manage Voices → English \(United Kingdom\)/);
  // In the menu: one British voice, each device gets its own steps.
  const ONE = [v('Google UK English Female', 'en-GB', { localService: false }), v('Google US English', 'en-US', { localService: false })];
  for (const [k, nav] of Object.entries(UA)) {
    const m = voiceMenuFor(ONE, nav);
    m.vm.pick(MORE);
    assert.equal(m.tip.textContent, MORE_VOICE_STEPS[want[k]], k);
  }
});
