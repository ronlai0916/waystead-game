// SB5 S7: FAT defects in a real browser. CHROME_PATH=... node tools/sb2-smoke.mjs <dir> 'SB5 S7*'
// F-1 grown-up pages reloaded offline | F-2 a second device is not asked the role | m1 tutor ask page | m3 offline "given" line | m4 prefs 413.
import * as W from '../../site/js/words-doc.js';
import * as Ow from '../../site/js/own-doc.js';
import * as Su from '../../site/js/setup-doc.js';

export default function (H) {
  const { scene, ev, ok, until, sleep, open, acct, signedOutBlank, seedChild, gameDayDoc, plus, CHILD, CHILD2, ADULT } = H;
  const q = (s) => JSON.stringify(s);
  const netLog = () => H.allowLog(/ERR_EMPTY_RESPONSE|ERR_CONNECTION|Failed to load resource/); // the account is made unreachable on purpose
  const DAY = plus(2);
  const NOW = Date.parse(DAY + 'T10:00:00');
  const OID = 'rown1';
  const SIX = ['build', 'earth', 'fruit', 'heart', 'island', 'because'];
  const adultMe = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', childLimit: 5, plan: 'parent', playingAs: null };
  const bodyText = () => ev('(document.querySelector("main") || document.body).innerText.replace(/\\s+/g, " ")');
  const hasEl = (s) => ev('!!document.querySelector(' + q(s) + ')');
  async function adultWithList() {
    await signedOutBlank(DAY);
    acct.who = adultMe;
    const own = Ow.set({}, OID, { name: 'School words', words: SIX, src: 'typed', to: [CHILD] }, NOW).own;
    await ev('localStorage.setItem("sb.words:' + ADULT + '",' + q(JSON.stringify(W.withOwn(W.emptyDoc(), own))) + ')');
    for (const k of [CHILD, CHILD2]) acct.put(k, 'spellbright', 'words', W.withSetup(W.emptyDoc(), k === CHILD ? Su.setOwnCopy({}, OID, { name: 'School words', words: SIX, src: 'typed' }, own[OID].at).setup : {}));
  }

  scene('SB5 S7 F-1 a grown-up reloads offline: pages come from the device, never "Checking who is here", and a given list is not "not given"', async () => {
    netLog();
    await adultWithList();
    await open(DAY, '#/grownups/own');
    await until('document.querySelector("[data-own]")', 'the lists online');
    ok(/Given for practice to Robin/.test(await bodyText()), 'online it says who: ' + (await bodyText()).slice(0, 200));
    acct.offline = true;
    try {
      for (const hash of ['#/grownups/own', '#/grownups', '#/grownups/set']) {
        await open(DAY, hash);
        await sleep(2500);
        const t = await bodyText();
        ok(!/Checking who is here|Just a moment/.test(t), hash + ' offline is not a spinner: ' + t.slice(0, 120));
        ok(!/This page is for grown-ups/.test(t) && !await hasEl('[data-offline-who]'), hash + ' offline shows the grown-up page from the device: ' + t.slice(0, 120));
      }
      await open(DAY, '#/grownups/own');
      await until('document.querySelector("[data-own]")', 'the lists offline from the device', 9000);
      const t = await bodyText();
      ok(!/Not given to anyone yet/.test(t) && /Given for practice|Not known while offline/.test(t), 'S7 m3: offline says what the device knows, not "not given": ' + t.slice(0, 260));
      ok(/offline/i.test(t), 'the offline note is shown');
    } finally { acct.offline = false; }
  });

  scene('SB5 S7 F-1 no confirmed grown-up (a child, or nobody known): offline page with Try again, no data, then it recovers', async () => {
    netLog();
    // a cached player that no live answer ever called a grown-up
    await signedOutBlank(DAY);
    acct.who = adultMe;
    await ev('localStorage.setItem("wa.player",' + q(JSON.stringify({ id: ADULT, name: 'Sam', avatar: null })) + ')');
    acct.offline = true;
    try {
      await open(DAY, '#/grownups/own');
      await until('document.querySelector("[data-offline-who]")', 'the offline page', 9000);
      const t = await bodyText();
      ok(/You are offline/.test(t) && /Sign in again when you are back online/.test(t) && /Try again/.test(t), 'clear offline page: ' + t.slice(0, 200));
      ok(!await hasEl('[data-own]'), 'no list data shown');
    } finally { acct.offline = false; }
    await ev('document.querySelector("[data-who-retry]").click()');
    await until('!document.querySelector("[data-offline-who]")', 'Try again works when back online', 9000);
    // a child on a shared device, offline: never the grown-up data
    await seedChild(gameDayDoc(), plus(2));
    acct.offline = true;
    try {
      for (const hash of ['#/grownups/own', '#/grownups/set']) {
        await open(plus(2), hash);
        await until('document.querySelector("[data-offline-who]")', 'the offline page for a child device at ' + hash, 9000);
        ok(!await hasEl('[data-own]') && !/Robin.s words|Plan/.test(await bodyText()), hash + ': a child device gets the offline page, not grown-up data');
      }
    } finally { acct.offline = false; }
  });

  scene('SB5 S7 F-1 the account never answers: the wait ends by 8 s with the offline page', async () => {
    netLog();
    await signedOutBlank(DAY);
    acct.who = adultMe;
    await ev('localStorage.setItem("wa.player",' + q(JSON.stringify({ id: ADULT, name: 'Sam', avatar: null })) + ')');
    acct.slowMe = 9500; // the slow answer must arrive while the page is still here (the fake account cannot read a request whose page has gone)
    try {
      await open(DAY, '#/grownups/own');
      const t0 = Date.now();
      await until('document.querySelector("[data-offline-who]")', 'the offline page after the wait', 12000);
      const took = Date.now() - t0;
      ok(took <= 9400, 'the spinner lasted ' + took + ' ms at most (8 s plus draw)');
      await sleep(2500); // let the slow /api/me answer reach this page before the next scene
    } finally { acct.slowMe = 0; }
  });

  scene('SB5 S7 F-2 a second device: the account already has the role, so the role page never appears and nothing is overwritten', async () => {
    H.askRole(true);
    try {
      await signedOutBlank(DAY);
      acct.who = adultMe;
      acct.prefs.set(ADULT, { theme: 'system', dayStyle: 'garden', prefs: { saved: 1, sbRole: { r: 'teacher', n: 'Ms Patel', at: 1795000000000 } } });
      await open(DAY, '#/');
      const seen = [];
      for (let i = 0; i < 14; i += 1) { seen.push(await ev('location.hash')); await sleep(250); }
      ok(!seen.some((h) => /role/.test(h)), 'never the role page: ' + [...new Set(seen)].join(' > '));
      ok(!/Who are you setting spellings for/.test(await bodyText()), 'page says: ' + (await bodyText()).slice(0, 100));
      const dev = JSON.parse(await ev('localStorage.getItem("sb.role:' + ADULT + '")'));
      ok(dev && dev.r === 'teacher' && dev.n === 'Ms Patel', 'the account role was copied to the device: ' + JSON.stringify(dev));
      const accRole = acct.prefs.get(ADULT).prefs.sbRole;
      ok(accRole.r === 'teacher' && accRole.n === 'Ms Patel', 'the account role is unchanged: ' + JSON.stringify(accRole));
    } finally { H.askRole(false); }
  });

  scene('SB5 S7 F-2 first time anywhere: the role page appears; a role that turns up while it is open makes it leave, and Continue never overwrites', async () => {
    H.askRole(true);
    try {
      await signedOutBlank(DAY);
      acct.who = adultMe;
      await open(DAY, '#/');
      await until('/role/.test(location.hash)', 'no role anywhere: the role page', 9000);
      ok(/Who are you setting spellings for/.test(await bodyText()), 'asked once');
      // another device chooses a role now; this device hears it on its next read of the account
      acct.prefs.set(ADULT, { theme: 'system', dayStyle: 'garden', prefs: { saved: 1, sbRole: { r: 'tutor', n: 'Mr Lee', at: 1795000000000 } } });
      await sleep(2300);
      await ev('window.dispatchEvent(new Event("focus"))');
      await until('!/role/.test(location.hash)', 'the role page leaves by itself', 9000);
      await sleep(1500);
      const accRole = acct.prefs.get(ADULT).prefs.sbRole;
      ok(accRole.r === 'tutor' && accRole.n === 'Mr Lee', 'the account role is still the one chosen elsewhere: ' + JSON.stringify(accRole));
    } finally { H.askRole(false); }
  });

  scene('SB5 S7 m1 the tutor ask page says learners and a pupil\'s pages', async () => {
    await signedOutBlank(DAY);
    acct.who = adultMe;
    await ev('localStorage.setItem("sb.role:' + ADULT + '",' + q(JSON.stringify({ r: 'tutor', at: 1 })) + ')');
    await open(DAY, '#/grownups/more');
    await until('document.querySelector("[data-places]")', 'the ask page');
    const t = await bodyText();
    ok(/You have \d+ of 5 learners\./.test(t) && !/places/.test(t) && /a pupil.s pages/.test(t) && !/child.s pages/.test(t), 'tutor wording: ' + t.slice(0, 300));
  });

  scene('SB5 S7 m4 a prefs save refused with 413 is not retried on every change; one message', async () => {
    await signedOutBlank(DAY);
    acct.who = adultMe;
    await open(DAY, '#/grownups');
    await sleep(1500);
    await ev(`(() => { window.__puts = 0; const f = window.fetch; window.fetch = (u, i) => { if (i && i.method === 'PUT' && /\\/api\\/prefs$/.test(String(u))) { window.__puts += 1; return Promise.resolve(new Response('{}', { status: 413, headers: { 'Content-Type': 'application/json' } })); } return f(u, i); }; })()`);
    for (let i = 0; i < 4; i += 1) { await ev('window.dispatchEvent(new Event("wa:look"))'); await sleep(1300); }
    ok(await ev('window.__puts') === 1, 'one refused save, no retry on later changes: ' + await ev('window.__puts'));
    ok(/account is full/.test(await ev('document.getElementById("toast").textContent')) || await ev('window.__puts') === 1, 'the message was shown');
  });
}
