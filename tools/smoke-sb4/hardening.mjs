// SB4-WP13: hardening. Loaded by tools/sb2-smoke.mjs with the harness H.
export default function (H) {
  const { scene, go, ev, ok, has, text, until, sleep, width, open, acct, W, CHILD, ADULT, plus, seedChild, style } = H;
  const DAY = plus(2);
  const adultMe = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };
  const childMe = { signedIn: true, kind: 'child', id: CHILD, nickname: 'Robin', year: 4, avatar: null, parentId: ADULT };
  const q = (s) => JSON.stringify(s);
  const noSideways = () => ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth');
  /** The bar: the brand name's text is not cut off (its box is as wide as its text) and does not run under the Menu button. */
  const barProbe = () => ev(`(() => {
    const name = document.querySelector('.brand__name'); const brand = document.querySelector('.brand');
    const btn = [...document.querySelectorAll('.adultbtn--menu, .childbtn--menu')].find((e) => e.getBoundingClientRect().width);
    const nb = name.getBoundingClientRect(); const bb = btn ? btn.getBoundingClientRect() : { left: 9999 };
    const bar = document.querySelector('.topbar').getBoundingClientRect();
    return { nameW: nb.width, nameScroll: name.scrollWidth, nameRight: nb.right, btnLeft: bb.left, bar: bar.height, brandVisible: !!brand.getBoundingClientRect().width, overflow: getComputedStyle(name).overflow, clipped: name.scrollWidth > name.clientWidth + 1 };
  })()`);

  const bsBg = () => 'rgba(0, 0, 0, 0)';
  const h1 = () => ev('(document.querySelector("main h1") || {}).textContent || ""');
  const hashNow = () => ev('location.hash');
  const WEEK = () => W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week one', test: plus(5), words: ['build', 'earth', 'fruit', 'heart'], today: H.MON, now: Date.parse(H.MON + 'T09:00:00') }).doc;

  scene('SB4-WP13 H1 a bad %-piece in the address lands on a page, never a stale one or an error', async () => {
    await width(390, 800);
    const cases = [
      ['child', '#/words/g/%25'], ['child', '#/words/g/%25/test'], ['child', '#/words/g/%E0%A4%A/path'], ['child', '#/y%/..'], ['child', '#/chapters/%/%'],
      ['adult', '#/grownups/child/%'], ['adult', '#/grownups/own/%E0%A4%A'], ['adult', '#/grownups/teach/%E0%A4%A'], ['adult', '#/words/g/%25'],
    ];
    for (const [who, hash] of cases) {
      await H.signedOutBlank(DAY);
      if (who === 'adult') acct.who = adultMe; else { await seedChild(WEEK(), DAY); }
      await open(DAY, '#/');
      await until('document.querySelector("main h1")', 'a first page', 9000);
      const first = await h1();
      await go(hash);
      await sleep(900);
      const now = await h1();
      const moved = (await hashNow()) !== hash;
      ok(await ev('!!document.querySelector("main")'), hash + ': there is a page');
      ok(moved || /isn.t here|can.t|Grown-ups|find/i.test(now) || (now && now !== first), hash + ': the old page is not left on screen (' + JSON.stringify(first) + ' -> ' + JSON.stringify(now) + ', ' + (await hashNow()) + ')');
      console.log('  · ' + who + ' ' + hash + ' -> ' + (await hashNow()) + ' | ' + now.slice(0, 40));
    }
  });

  scene('SB4-WP13 H3 the Waystead mark is whole beside Menu at 320 and 340, bar still 60 px', async () => {
    for (const w of [320, 340, 360, 390]) {
      await width(w, 568);
      for (const hash of ['#/grownups', '#/']) {
        await H.signedOutBlank(DAY);
        acct.who = adultMe;
        await open(DAY, hash);
        await until('document.querySelector(".adultbtn--menu")', 'adult bar');
        await sleep(200);
        const p = await barProbe();
        ok(p.bar <= 61, w + ' adult ' + hash + ': the bar stays 60 px (' + p.bar + ')');
        ok(!p.clipped, w + ' adult ' + hash + ': the brand is not clipped');
        ok(!p.brandVisible || p.nameW === 0 || p.nameRight <= p.btnLeft + 0.5, w + ' adult ' + hash + ': the name ends before Menu (' + p.nameRight + ' vs ' + p.btnLeft + ')');
        ok(await ev('(() => { const b = document.querySelector(".brand").getBoundingClientRect(); const m = document.querySelector(".adultbtn--menu").getBoundingClientRect(); return b.right <= m.left + 0.5; })()'), w + ' adult ' + hash + ': the brand link ends before Menu');
        ok(await noSideways(), w + ' adult ' + hash + ': no sideways scroll');
      }
      for (const hash of ['#/', '#/chapters']) {
        await H.signedOutBlank(DAY);
        acct.who = childMe;
        await ev('localStorage.setItem("wa.player",' + q(JSON.stringify({ id: CHILD, name: 'Robin', avatar: null })) + ')');
        await open(DAY, hash);
        await until('document.querySelector(".childbtn--menu")', 'child bar', 9000);
        await sleep(200);
        const p = await barProbe();
        ok(!p.clipped, w + ' child ' + hash + ': the brand is not clipped');
        ok(!p.brandVisible || p.nameRight <= p.btnLeft + 0.5, w + ' child ' + hash + ': the name ends before Menu (' + p.nameRight + ' vs ' + p.btnLeft + ')');
        ok(await noSideways(), w + ' child ' + hash + ': no sideways scroll');
      }
    }
  });

  scene('SB4-WP13 H4 the quiet links on the Grown-ups home are one height, at least 44 px', async () => {
    for (const w of [320, 390, 1180]) {
      await width(w, 800);
      await H.signedOutBlank(DAY);
      acct.who = adultMe;
      await open(DAY, '#/grownups');
      await until('document.querySelector("main a.gh-quiet")', 'the quiet links (SB5 gh-quiet)');
      const hs = await ev('[...document.querySelectorAll("main a.gh-quiet")].map((a) => Math.round(a.getBoundingClientRect().height))');
      ok(hs.length >= 3, w + ': three quiet links (' + hs.join(',') + ')');
      const one = hs.filter((x) => x <= 49); // a long link may wrap to a second line at 320; the one-line links must all be the same height
      ok(hs.every((x) => x >= 44) && new Set(one).size === 1 && hs.length - one.length <= (w <= 390 ? 1 : 0), w + ': at least 44 px, one-line links equal, at most one wrapped (' + hs.join(',') + ')');
      ok(await noSideways(), w + ': no sideways scroll');
    }
  });

  scene('SB4-WP13 H2 H5 a text field and an unticked box have a 3:1 edge in garden, paint and night', async () => {
    const probe = `(() => {
      const lum = (c) => { const m = c.match(/[\\d.]+/g).map(Number).slice(0, 3).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, r) => r - p); return (x + 0.05) / (y + 0.05); };
      const f = document.querySelector('main .field');
      const holder = document.querySelector('main .gu') || document.querySelector('main');
      const lab = document.createElement('label'); lab.className = 'gu-check'; lab.innerHTML = '<input type="checkbox"><span>x</span>'; holder.appendChild(lab);
      const box = lab.querySelector('input'); const bs = getComputedStyle(box); const fs = getComputedStyle(f);
      const page = getComputedStyle(document.body).backgroundColor;
      const out = { field: ratio(fs.borderTopColor, fs.backgroundColor), fieldPage: ratio(fs.borderTopColor, page), box: ratio(bs.borderTopColor, bs.backgroundColor), boxCard: ratio(bs.borderTopColor, getComputedStyle(lab).backgroundColor), w: box.getBoundingClientRect().width, bw: bs.borderTopWidth };
      box.checked = true; const cs = getComputedStyle(box); const af = getComputedStyle(box, '::after');
      out.ticked = { bg: cs.backgroundColor, content: af.content, w: af.width, h: af.height, tick: af.borderRightColor };
      lab.remove(); return out;
    })()`;
    for (const w of [320, 1180]) {
      await width(w, 800);
      for (const st of ['garden', 'paint', 'night']) {
        await H.signedOutBlank(DAY);
        acct.who = adultMe;
        await style(st);
        await open(DAY, '#/grownups/own/new');
        await until('document.querySelector("[data-own-editor]") && document.querySelector("main .field")', 'the editor');
        const r = await ev(probe);
        ok(r.field >= 3 && r.fieldPage >= 3, w + ' ' + st + ': the text field edge is 3:1 (' + r.field.toFixed(2) + ' on the field, ' + r.fieldPage.toFixed(2) + ' on the page)');
        ok(r.box >= 3 && r.boxCard >= 3, w + ' ' + st + ': the unticked box edge is 3:1 (' + r.box.toFixed(2) + ', ' + r.boxCard.toFixed(2) + ')');
        ok(r.ticked.content !== 'none' && r.ticked.bg !== bsBg(r) && parseFloat(r.ticked.w) >= 4 && parseFloat(r.ticked.h) >= 8, w + ' ' + st + ': a ticked box shows a tick (' + JSON.stringify(r.ticked) + ')');
        ok(r.w >= 24, w + ' ' + st + ': the box is at least 24 px (' + r.w + ')');
        ok(await noSideways(), w + ' ' + st + ': no sideways scroll');
      }
    }
  });
}
