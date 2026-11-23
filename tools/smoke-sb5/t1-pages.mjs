// SB5 T1 tidy-up: browser checks for the leftover small items. CHROME_PATH=... node tools/sb2-smoke.mjs <dir> 'SB5 T1*'
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as W from '../../site/js/words-doc.js';
import * as Ow from '../../site/js/own-doc.js';
import * as Su from '../../site/js/setup-doc.js';

export default function (H) {
  const { scene, go, ev, ok, until, sleep, style, send, kbSeed, shot, plus, MON } = H;
  const phone = async (w, h) => {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await sleep(150);
  };
  const reset = async () => { try { await send('Emulation.setTouchEmulationEnabled', { enabled: false }); } catch (e) { /* ignore */ } await H.width(390, 900); };

  scene('SB5 T1 item 1: child keyboard keys are as wide as the screen allows', async () => {
    await kbSeed('child', 'practice');
    for (const [w, h, want] of [[360, 530, 34], [375, 527, 35], [390, 704, 36]]) {
      for (const s of ['garden', 'night']) {
        await style(s);
        await phone(w, h);
        const m = await ev(`(() => { const ks = [...document.querySelectorAll('.keyboard .key')].filter((k) => !k.classList.contains('key--del')); const rows = [...document.querySelectorAll('.keyboard-row')].map((r) => r.querySelectorAll('.key').length);
          const P = [...ks].find((k) => k.textContent.trim().toLowerCase() === 'p'); return { w: Math.min(...ks.map((k) => k.getBoundingClientRect().width)), h: Math.min(...ks.map((k) => k.getBoundingClientRect().height)), rows, pTop: P && P.getBoundingClientRect().top, row1Top: document.querySelector('.keyboard-row').getBoundingClientRect().top, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
          left: Math.min(...ks.map((k) => k.getBoundingClientRect().left)), right: Math.max(...ks.map((k) => k.getBoundingClientRect().right)) }; })()`);
        console.log('  · keyboard ' + w + 'x' + h + ' ' + s + ': key ' + m.w.toFixed(1) + ' x ' + m.h.toFixed(1) + ', rows ' + m.rows.join('/') + ', keys ' + m.left.toFixed(1) + '..' + m.right.toFixed(1));
        if (w === 360 && s === 'garden') console.log('  · chain ' + await ev(`(() => { let e = document.querySelector('.keyboard'); const o = []; while (e && e !== document.documentElement) { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); o.push(e.tagName.toLowerCase() + '.' + e.className + ' ' + Math.round(r.left) + '..' + Math.round(r.right) + ' pad ' + cs.paddingLeft + '/' + cs.paddingRight + ' mar ' + cs.marginLeft); e = e.parentElement; } return o.join(' | '); })()`));
        ok(m.w >= want - 0.6 && m.h >= 48, 'keys at ' + w + ' are at least ' + want + ' x 48: ' + JSON.stringify(m));
        ok(m.rows.slice(0, 3).join('/') === '10/9/9' || m.rows.slice(0, 3).join('/') === '10/9/7' || /^10\/9\//.test(m.rows.join('/')), 'rows ' + m.rows.join('/'));
        ok(Math.abs(m.pTop - m.row1Top) < 2, 'P is on row 1');
        ok(m.sw <= m.cw, 'no sideways scroll');
        ok(m.left >= 0 && m.right <= w, 'keys inside the screen');
        if (w === 360 && s === 'garden') await shot('t1-keyboard-360');
      }
    }
    await reset();
  });

  scene('SB5 T1 item 2: child Today has no empty band', async () => {
    await H.seedChild(H.gameDayDoc(), H.plus(2));
    await H.open(H.plus(2), '#/');
    await until('document.querySelector(".today__big")', 'Today');
    const dump = () => ev(`(() => { const q = (s) => document.querySelector(s); const r = (e) => e && e.getBoundingClientRect(); const o = {};
      for (const [n, s] of [['l', '.today__l'], ['stones', '.seeweek'], ['subrow', '.today__subrow'], ['r', '.today__r'], ['big', '.today__big'], ['foot', '.today__foot'], ['section', '.today']]) { const b = r(q(s)); o[n] = b ? Math.round(b.top) + '..' + Math.round(b.bottom) : '-'; }
      const cs = getComputedStyle(q('.today')); o.sec = cs.minHeight + ' ' + cs.display + ' ' + cs.justifyContent + ' ' + cs.alignContent; o.pageh = getComputedStyle(document.documentElement).getPropertyValue('--page-h');
      o.reserve = getComputedStyle(document.documentElement).getPropertyValue('--bottom-reserve'); o.ih = innerHeight; return JSON.stringify(o); })()`);
    for (const [w, h] of [[390, 844], [390, 760], [360, 800], [412, 915], [430, 932]]) {
      await phone(w, h);
      console.log('  · today ' + w + 'x' + h + ' ' + await dump());
      const g = await ev(`(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); return { gap: r('.today__big').top - r('.today__subrow').bottom, bigBottom: r('.today__big').bottom }; })()`);
      ok(g.gap >= 0 && g.gap <= 24, 'no empty band between the day row and the main button at ' + w + 'x' + h + ': ' + g.gap);
      ok(g.bigBottom <= h - 112, 'the main button ends above the bottom reserve: ' + g.bigBottom);
      if (w === 390 && h === 844) await shot('t1-today-390');
    }
    await reset();
  });

  const adultMe = { signedIn: true, kind: 'parent', id: H.ADULT, displayName: 'Sam', role: 'parent', childLimit: 5, plan: 'parent', playingAs: null };
  scene('SB5 T1 item 4: role chooser name chips on one line at 390', async () => {
    H.askRole(true);
    try {
      await H.signedOutBlank(plus(2));
      H.acct.who = adultMe;
      await H.open(plus(2), '#/');
      await until('/grownups\\/role/.test(location.hash) && document.querySelector("[data-role=parent]")', 'the role page', 9000);
      for (const style_ of ['garden', 'night']) {
        await style(style_);
        for (const [w, h] of [[390, 844], [375, 667], [360, 640]]) {
          await phone(w, h);
          await ev('(document.querySelector("[data-chip]") || document.querySelector("[data-role=parent]")).scrollIntoView({block:"center"})');
          if (!await ev('!!document.querySelector("[data-chip]")')) { await ev('document.querySelector("[data-role=parent]").click()'); await until('document.querySelector("[data-chip]")', 'the chips'); }
          const m = await ev(`(() => { const c = [...document.querySelectorAll("[data-chip]")].map((b) => b.getBoundingClientRect()); return { tops: [...new Set(c.map((r) => Math.round(r.top)))], h: Math.min(...c.map((r) => r.height)), w: Math.min(...c.map((r) => r.width)), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; })()`);
          console.log('  · chips ' + w + ' ' + style_ + ': rows ' + m.tops.length + ' min ' + m.w.toFixed(0) + 'x' + m.h.toFixed(0));
          ok(m.h >= 44 && m.w >= 44 && m.sw <= m.cw, 'chips are tappable, no sideways scroll ' + JSON.stringify(m));
          if (w >= 390) ok(m.tops.length === 1, 'the four chips are on one line at ' + w + ': ' + JSON.stringify(m));
          if (w === 390 && style_ === 'garden') await shot('t1-chips-390');
        }
      }
    } finally { H.askRole(false); await reset(); }
  });

  scene('SB5 T1 item 5: Who and when radios take the style colour', async () => {
    const day = plus(2);
    await H.signedOutBlank(day);
    H.acct.who = adultMe;
    for (const k of [H.CHILD, H.CHILD2]) H.acct.put(k, 'spellbright', 'words', H.W.withSetup(H.weekDoc(), {}));
    await H.open(day, '#/grownups/set');
    // the two-weeks twin set is drawn by kidsHtml: build it in the page so the check does not depend on a running week
    await ev(`document.querySelector('main').insertAdjacentHTML('beforeend', '<div class="st-twin" id="t1twin"><label class="st-row"><input type="radio" name="t1" checked><span class="st-row__text"><b>Add another week</b></span></label><label class="st-row"><input type="radio" name="t1"><span class="st-row__text"><b>Replace it</b></span></label></div>')`);
    for (const s of ['garden', 'paint', 'night']) {
      await style(s);
      const c = await ev(`(() => { const i = document.querySelector('#t1twin input'); return [getComputedStyle(i).accentColor, getComputedStyle(document.body).getPropertyValue('--accent') || getComputedStyle(document.documentElement).getPropertyValue('--accent')]; })()`);
      console.log('  · radio accent ' + s + ': ' + c[0] + ' token ' + c[1].trim());
      ok(c[0] !== 'auto' && c[0] !== 'rgb(0, 117, 255)', s + ' radio colour is the token: ' + c[0]);
      await ev('document.querySelector("#t1twin").scrollIntoView({block:"center"})');
      if (s !== 'paint') await shot('t1-radios-' + s);
    }
  });

  scene('SB5 T1 round 2: Night, Who and when: the Set bar and the preview sheet are dark, in the viewport', async () => {
    const day = plus(2);
    const OID = 'rown1';
    const SIX = ['build', 'earth', 'fruit', 'heart', 'island', 'because', 'quay', 'though', 'bridge', 'island2'].slice(0, 9);
    await H.signedOutBlank(day);
    H.acct.who = adultMe;
    const own = Ow.set({}, OID, { name: 'School words', words: SIX, src: 'typed', to: [H.CHILD] }, Date.parse(day + 'T10:00:00')).own;
    await ev('localStorage.setItem("sb.words:' + H.ADULT + '",' + JSON.stringify(JSON.stringify(W.withOwn(W.emptyDoc(), own))) + ')');
    await H.open(day, '#/grownups/set/list/' + OID);
    await until('document.querySelector("[data-bar], .st-bar")', 'the Set a week bar');
    await style('night');
    await phone(390, 844);
    await ev('window.scrollTo(0, document.documentElement.scrollHeight)');
    await sleep(300);
    const snap = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(process.env.T1_SHOTS || '/tmp/claude-0/t1/night', name + '.png'), Buffer.from(r.data, 'base64')); };
    const lum = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c) || []; return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255; };
    const bar = await ev(`(() => { const b = document.querySelector('.st-bar'); const cs = getComputedStyle(b); const r = b.getBoundingClientRect(); return { bg: cs.backgroundColor, fg: getComputedStyle(b.querySelector('p, small, .st-bar__line') || b).color, bottom: r.bottom, ih: innerHeight }; })()`);
    console.log('  · night Set bar: ' + JSON.stringify(bar));
    ok(lum(bar.bg) < 0.35, 'the Set bar is dark in Night: ' + bar.bg);
    await snap('t1-night-setbar-390x844');
    const cue = await ev('!!document.querySelector("[data-act=preview]")');
    if (cue) {
      await ev('document.querySelector("[data-act=preview]").click()');
      await until('document.querySelector(".st-sheetbox")', 'the preview sheet');
      await sleep(300);
      const sh = await ev(`(() => { const b = document.querySelector('.st-sheetbox'); return { bg: getComputedStyle(b).backgroundColor, fg: getComputedStyle(b).color }; })()`);
      console.log('  · night sheet: ' + JSON.stringify(sh));
      ok(lum(sh.bg) < 0.35 && lum(sh.fg) > 0.5, 'the sheet is dark with light text in Night: ' + JSON.stringify(sh));
      await snap('t1-night-sheet-390x844');
    } else console.log('  · no preview cue on this page (one child): sheet not drawn');
    await reset();
  });
}
