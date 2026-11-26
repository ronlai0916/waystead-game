// SB6 scenes of WP-8: S-gu-pictures (grid, Use all, Make another, No picture, Remove, redeem, 0 left, unlimited, paused, offline, the swap question)
// and S-child-pictures (only approved pictures; a removed one disappears; a child never calls A1-A5 or A8-A10).
// Pictures ship OFF; here they are switched on for the test only: localStorage `sb.picturesTest` ('fast': poll every 0.3 s), on localhost, against the fake account.
// The grid and the card are mounted with the page's own module (WP-9 owns the routes); the list page (#/grownups/own/<oid>) is the real route.
// Names: 'SB6 pictures: ...'. Sizes: 390x844 (iphone-14), 420x746 (iphone-air-bar), 820x1180 (ipad-portrait); garden and Night. SB6_ONLY / SB6_STYLES narrow a run.
import * as W from '../../site/js/words-doc.js';
import * as Su from '../../site/js/setup-doc.js';
import * as Ow from '../../site/js/own-doc.js';

export default (H, S) => {
  const { scene, ev, ok, until, sleep, acct, signedOutBlank, weekDoc, CHILD, CHILD2, ADULT, plus, seedChild } = H;
  const A = 'http://localhost:3000';
  const OID = 'rown1';
  const DAY = plus(2);
  const NOW = Date.parse(DAY + 'T10:00:00');
  const WORDS = ['guard', 'island', 'night', 'tree', 'although', 'quay'];
  const SIZES = ['iphone-14', 'iphone-air-bar', 'ipad-portrait'];
  const adultMe = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };
  const q = (s) => JSON.stringify(s);
  const post = (path, body) => acct.fetch(A + path, { method: 'POST', credentials: 'include', body: JSON.stringify(body) });
  const step = (n) => console.log('  · ' + n);
  const FUTURE = '2999-01-01';

  /** A clean fake state for pictures (trial 5, nothing made). */
  function reset(over = {}) {
    Object.assign(acct.pictures, { missing: false, on: true, unlimited: false, trial: 5, trialUntil: FUTURE, plan: null, planLeft: 0, change: 0, credits: 0, rate: 4, hourLeft: 20, paused: false, swaps: 0, jobs: new Map(), approved: new Map(), delay: 0, mode: 'fake-slow', blocked: new Set(), unsuitable: new Set(), unsuitableSeen: new Set(), codes: {}, ledger: [], retryAfter: 0, seq: 0 }, over);
  }
  const idOf = (word) => [...acct.pictures.jobs.values()].find((j) => j.word === word && j.status !== 'none').id;
  /** Ask the account for a picture as the grown-up would (the page itself does the same). */
  const make = async (word, state = 'ready') => {
    await post('/api/pictures', { word });
    if (state === 'ready' || state === 'approved') acct.pictures.finish(word);
    if (state === 'approved') await post('/api/pictures/' + idOf(word) + '/decide', { choice: 'use' });
  };
  const picCalls = () => acct.calls.filter((c) => /^\/api\/(pictures|credits|story)/.test(c.path));
  const text = () => ev('document.querySelector("main").innerText');
  const click = async (sel) => { await ev('(() => { const e = document.querySelector(' + q(sel) + '); if (!e) throw new Error("no " + ' + q(sel) + '); e.click(); })()'); };
  const clickText = async (label, scope = 'main') => { await ev('(() => { const e = [...document.querySelectorAll(' + q(scope + ' button, ' + scope + ' a') + ')].find((b) => b.textContent.trim() === ' + q(label) + ' && !b.disabled); if (!e) throw new Error("no button " + ' + q(label) + '); e.click(); })()'); };
  const clickDialog = async (id) => { await until('document.querySelector("[data-dialog] [data-act=' + id + ']")', 'the dialog'); await click('[data-dialog] [data-act=' + id + ']'); };

  const ownSeed = (over = {}, before) => async () => {
    await signedOutBlank(DAY);
    acct.who = adultMe;
    reset(over);
    const own = Ow.set({}, OID, { name: 'Class 4 spellings', words: WORDS, src: 'typed', to: [CHILD, CHILD2] }, NOW).own;
    const setup = Su.setOwnCopy({}, OID, { name: 'Class 4 spellings', words: WORDS, src: 'typed' }, own[OID].at).setup;
    await ev('localStorage.setItem("sb.words:' + ADULT + '",' + q(JSON.stringify(W.withOwn(weekDoc(), own))) + ')');
    await ev('localStorage.setItem("wa.player",' + q(JSON.stringify({ id: ADULT, name: 'Sam', avatar: null })) + ')');
    await ev('localStorage.setItem("sb.picturesTest","fast")');
    await ev('localStorage.setItem("sb.picsSeen:' + ADULT + '","yes")');
    acct.put(ADULT, 'spellbright', 'words', W.withOwn(weekDoc(), own));
    acct.put(CHILD, 'spellbright', 'words', W.withSetup(weekDoc(), setup));
    acct.put(CHILD2, 'spellbright', 'words', W.withSetup(W.emptyDoc(), setup));
    if (before) await before();
  };
  const mountJs = (fn, args = '') => 'import("./js/pictures-views.js").then((m) => { window.__pvStop = m.' + fn + '(document.querySelector("main"), ' + args + '); return 1; })';
  /** The list page, the grid or the card. */
  async function show(p, kind, { over, before, night = false } = {}) {
    await S.openAs(p, { day: DAY, hash: '#/grownups/own/' + OID, seed: ownSeed(over, before), night, wait: 'document.querySelector("[data-own-page]")' });
    if (kind === 'list') { await until('document.querySelector("[data-pictures] .pv-row, [data-pictures] [data-pv-loading], [data-pictures] .ls-chips")', 'the rows', 9000); await sleep(700); await ev('(document.querySelector("[data-pictures]") || document.body).scrollIntoView({ block: "start" })'); return; }
    await ev(mountJs(kind === 'grid' ? 'picturesPage' : 'picturesCard', kind === 'grid' ? q({ oid: OID }) : ''));
    await until(kind === 'grid' ? 'document.querySelector("[data-pictures][data-view]")' : 'document.querySelector("[data-allowance], [data-problem], [data-pictures-off]")', 'the ' + kind, 9000);
    await sleep(700);
  }
  /** Defects on a picture screen: sideways scroll, a control under 44 px, text under the bottom reserve. */
  async function defects(p, what) {
    const m = await S.measure();
    const small = await ev(`(() => [...document.querySelectorAll('main button, main a.btn, main input, main summary, [data-dialog] button')].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && r.height < 43.5; }).map((e) => (e.textContent || e.id || e.tagName).trim().slice(0, 20) + ' ' + Math.round(e.getBoundingClientRect().height)))()`);
    const out = [];
    if (m.sideways > 0) out.push(what + ': sideways scroll ' + m.sideways + ' px');
    for (const s of small) out.push(what + ': target under 44 px: ' + s);
    return out;
  }
  async function eachSize(what, kind, opts, after) {
    const found = [];
    await S.forProfiles(async (p, style) => {
      await show(p, kind, { ...opts, night: style === 'night' });
      if (after) await after(p, style);
      found.push(...await defects(p, what + ' ' + p.id + ' ' + style));
      await S.shotAs(p, what.replace(/\W+/g, '-') + '-' + p.id, style);
    }, { ids: SIZES });
    S.report(found);
  }

  // ---- S-gu-pictures ---------------------------------------------------------------------------------------------------
  scene('SB6 pictures: list rows (making, check, in use, none)', async () => {
    await eachSize('rows', 'list', { before: async () => { await make('guard', 'making'); await make('island', 'ready'); await make('night', 'approved'); } }, async () => {
      const t = await text();
      ok(/Making a picture…/.test(t) && /Picture ready: check it/.test(t) && /Picture in use/.test(t) && /Add a picture/.test(t), 'rows say: ' + t.slice(0, 200));
      ok(/1 picture to check\./.test(t), 'the list line');
      ok(await ev('!!document.querySelector("[data-act=change]") && !!document.querySelector("[data-act=remove]")'), 'Change picture and Remove picture on the one in use');
      ok(!/spinner|Picture on its way/i.test(await ev('document.querySelector("main").innerHTML')), 'no spinner, no "on its way"');
    });
  });

  scene('SB6 pictures: grid, Use all, Make another, No picture', async () => {
    await eachSize('grid', 'grid', { over: { mode: 'fake' }, before: async () => { for (const w of ['guard', 'island', 'night', 'tree']) await make(w, 'ready'); } }, async () => {
      const t = await text();
      ok(/4 pictures to check/.test(t), 'the heading: ' + t.slice(0, 80));
      ok(await ev('document.querySelectorAll("[data-gcard]").length') === 4 && /Make another \(\d+ left\)/.test(t), 'four cards with Make another (N left)');
    });
    const p = S.profile('iphone-14');
    await show(p, 'grid', { over: { mode: 'fake-slow' }, before: async () => { for (const w of ['guard', 'island', 'night', 'tree']) await make(w, 'ready'); } });
    acct.calls.length = 0;
    step('No picture on guard');
    await click('[data-gcard=guard] [data-act=none]');
    await until('!document.querySelector("[data-gcard=guard]")', 'guard gone');
    ok(acct.pictures.approved.size === 0, 'nothing approved by No picture');
    step('Use island');
    await click('[data-gcard=island] [data-act=use]');
    await until('!document.querySelector("[data-gcard=island]")', 'island used');
    ok(acct.pictures.approved.has('island'), 'island is approved');
    step('Make another for night: the left count goes down by one');
    const before = acct.pictures.trial;
    await click('[data-gcard=night] [data-act=another]');
    await until('document.querySelector("[data-gcard=night].pv-gcard--making")', 'night is making again');
    ok(acct.pictures.trial === before - 1, 'one picture used: ' + before + ' -> ' + acct.pictures.trial);
    step('Use all (the one ready card)');
    await click('[data-act=use-all]');
    await until('document.querySelectorAll("[data-gcard]:not(.pv-gcard--making)").length === 0', 'all used');
    ok(acct.pictures.approved.has('tree'), 'tree approved by Use all');
    acct.pictures.finish('night');
    await until('document.querySelector("[data-gcard=night] [data-act=use]")', 'night comes back to check (poll)', 6000);
    ok(!picCalls().some((c) => c.body && /"swap"/.test(c.body)), 'no swap was sent');
  });

  scene('SB6 pictures: check sheet, Change, Remove (Keep it / Remove picture)', async () => {
    const p = S.profile('iphone-14');
    await show(p, 'list', { over: { mode: 'fake' }, before: async () => { await make('guard', 'ready'); await make('night', 'approved'); } });
    await click('[data-word=guard] [data-act=check]');
    await until('document.querySelector("[data-check-title]")', 'the sheet');
    const t = await text();
    ok(/Use this picture/.test(t) && /Make another \(\d+ left\)/.test(t) && /No picture/.test(t) && /Children see it only after you tap Use this picture\./.test(t), 'the check sheet: ' + t.slice(0, 160));
    await S.shotAs(p, 'check-sheet', 'garden');
    await click('[data-act=use]');
    await until('document.querySelector("[data-word=guard][data-state=in-use]")', 'guard in use');
    step('Remove: Keep it keeps');
    await click('[data-word=night] ~ .pv-btns [data-act=remove], .pv-btns [data-act=remove]');
    await until('document.querySelector("[data-remove-sheet]")', 'the question');
    const q2 = await text();
    ok(/Remove this picture\?/.test(q2) && /Children will see the sentence card again/.test(q2), 'the question');
    ok(await ev('document.querySelector("[data-act=keep]").classList.contains("btn--primary")'), 'Keep it is the primary');
    await S.shotAs(p, 'remove-sheet', 'garden');
    await click('[data-act=keep]');
    await until('document.querySelector("[data-rows]")', 'back to the list');
    ok(acct.pictures.approved.has('night'), 'kept');
    step('Change picture asks for another and keeps the old one in use');
    await click('[data-word=night] ~ .pv-btns [data-act=change], .pv-btns [data-act=change]');
    await until('document.querySelector("[data-word=night]")', 'row');
    await sleep(600);
    ok(acct.pictures.approved.has('night'), 'the old picture stays in use until a new one is used');
    step('Remove picture removes');
    await click('.pv-btns [data-act=remove]');
    await until('document.querySelector("[data-remove-sheet]")', 'the question');
    await click('[data-act=remove-yes]');
    await until('document.querySelector("[data-word=night][data-state=none]")', 'night has no picture');
    ok(!acct.pictures.approved.has('night'), 'removed on the account');
  });

  scene('SB6 pictures: the Word pictures card (trial, plan, unlimited, 0 left, paused)', async () => {
    const cases = [
      ['trial', { trial: 5, trialUntil: '2999-12-23' }, [/Free trial/, /5 left until 23 December/, /Redeem a code/]],
      ['plan', { trial: 0, plan: { name: 'Family plan', monthly: 15 }, planLeft: 11, credits: 8, rate: 4 }, [/Family plan, 15 a month/, /Left this month/, /11/, /One credit is one story, or 4 word pictures/, /Use 1 story credit for 4 word pictures/]],
      ['unlimited', { unlimited: true }, [/No limit/, /never use story credits/, /Redeem a code/]],
      ['zero', { trial: 0, credits: 0, plan: null }, [/No pictures left\. Redeem a code/]],
      ['paused', { paused: true }, [/paused/i]],
    ];
    for (const [name, over, res] of cases) {
      step(name);
      const found = [];
      await S.forProfiles(async (p, style) => {
        await show(p, 'card', { over, night: style === 'night' });
        const t = await text();
        for (const r of res) if (!r.test(t)) found.push(name + ' ' + p.id + ' ' + style + ': missing ' + r + ' in ' + t.slice(0, 200));
        if (name === 'unlimited' && !/No limit/.test(t)) found.push('no "No limit"');
        found.push(...await defects(p, 'card ' + name + ' ' + p.id + ' ' + style));
        await S.shotAs(p, 'card-' + name + '-' + p.id, style);
      }, { ids: name === 'plan' || name === 'trial' ? SIZES : ['iphone-14'] });
      S.report(found);
    }
  });

  scene('SB6 pictures: redeem a code, and the swap question (asked every time)', async () => {
    const p = S.profile('iphone-14');
    await show(p, 'card', { over: { trial: 0, credits: 2, codes: { 'ABCD-EFGH-JKLM': 3 } } });
    step('a wrong code');
    await ev('(() => { const i = document.querySelector("[data-code]"); i.value = "NOPE-NOPE-NOPE"; document.querySelector("[data-redeem]").requestSubmit(); })()');
    await until('/not accepted/.test(document.querySelector("[data-redeemnote]").textContent)', 'the code is not accepted');
    ok(/That code was not accepted\. Check it and try again\./.test(await text()), 'the not-accepted line');
    ok(acct.pictures.credits === 2, 'no credit added');
    step('a good code');
    await ev('(() => { const i = document.querySelector("[data-code]"); i.value = "ABCD-EFGH-JKLM"; document.querySelector("[data-redeem]").requestSubmit(); })()');
    await until('document.querySelector("[data-balance]") && document.querySelector("[data-balance]").textContent === "5"', 'the balance is 5', 6000);
    ok(acct.pictures.credits === 5, 'credits 5');
    ok(await ev('document.querySelectorAll("[data-redeem]").length') === 1, 'one redeem form');
    await S.shotAs(p, 'redeemed', 'garden');
    step('the quiet swap button: Not now spends nothing, Yes spends one');
    await clickText('Use 1 story credit for 4 word pictures');
    await until('document.querySelector("[data-dialog]")', 'the question');
    ok(/Use 1 story credit for 4 more word pictures\?/.test(await ev('document.querySelector("[data-dialog] h2").textContent')), 'the question uses the account rate');
    await S.shotAs(p, 'swap-question', 'garden');
    await clickDialog('no');
    await sleep(300);
    ok(acct.pictures.credits === 5 && acct.pictures.swaps === 0, 'Not now: nothing taken');
    await clickText('Use 1 story credit for 4 word pictures');
    await clickDialog('yes');
    await sleep(600);
    ok(acct.pictures.credits === 4 && acct.pictures.swaps === 1 && acct.pictures.change === 4, 'Yes: one credit became 4 pictures');
    ok(/Word pictures left/.test(await text()) && /4/.test(await text()), 'the card shows the new pictures');
  });

  scene('SB6 pictures: a row\'s Add a picture asks the swap question; Not now keeps Make picture', async () => {
    const p = S.profile('iphone-14');
    H.allowLog(/status of 402 .*\/api\/pictures/); // the account answers 402 (swap needed) on purpose until Yes
    await show(p, 'list', { over: { trial: 0, credits: 3 } });
    acct.calls.length = 0;
    await click('[data-word=guard] [data-act=ask]');
    await clickDialog('no');
    await sleep(500);
    ok(acct.pictures.credits === 3 && acct.pictures.swaps === 0, 'nothing spent on Not now');
    ok(await ev('!![...document.querySelectorAll("[data-word=guard] [data-act=ask]")].find((b) => b.textContent === "Make picture")'), 'the row keeps a Make picture button');
    await click('[data-word=guard] [data-act=ask]');
    await clickDialog('yes');
    await until('document.querySelector("[data-word=guard][data-state=making]")', 'guard is making');
    ok(acct.pictures.swaps === 1 && acct.pictures.credits === 2, 'one swap');
    ok(picCalls().filter((c) => c.body && /"swap":true/.test(c.body)).length === 1, 'swap:true sent once, after Yes');
    await click('[data-word=island] [data-act=ask]');
    await sleep(500);
    ok(!await ev('!!document.querySelector("[data-dialog]")'), 'the next word uses the change: no second question yet');
  });

  scene('SB6 pictures: paused, hourly limit, offline, refused', async () => {
    const p = S.profile('iphone-14');
    H.allowLog(/status of (429|422) .*\/api\/pictures/); // the hourly limit (429) and a refused word (422) are asked for
    await show(p, 'list', { over: { paused: true } });
    ok(!await ev('!!document.querySelector("[data-act=ask]")'), 'paused: no Add a picture buttons');
    await show(p, 'list', { over: { hourLeft: 0 } });
    await click('[data-word=guard] [data-act=ask]');
    await until('document.querySelector("[data-pv-line]")', 'a line');
    ok(/lot of pictures this hour/.test(await text()), 'hourly limit line');
    await S.shotAs(p, 'hourly', 'garden');
    await show(p, 'list', { over: { blocked: new Set(['guard']) } });
    await click('[data-word=guard] [data-act=ask]');
    await until('document.querySelector("[data-word=guard][data-state=refused]")', 'refused');
    ok(/We cannot make a picture for this word\./.test(await text()), 'one answer for refused');
    await show(p, 'list', {});
    acct.offline = true;
    H.netDown(true); // the account drops the connection on purpose (ERR_EMPTY_RESPONSE)
    await click('[data-word=guard] [data-act=ask]');
    await until('document.querySelector("[data-pv-line]")', 'offline line');
    ok(/Pictures are made when you are back online/.test(await text()), 'offline line');
    await S.shotAs(p, 'offline', 'garden');
    await sleep(400); // let the failed loads reach the console while the net is meant to be down
    acct.offline = false;
    H.netDown(false);
  });

  scene('SB6 pictures: off by default (no rows, no card)', async () => {
    const p = S.profile('iphone-14');
    await S.openAs(p, { day: DAY, hash: '#/grownups/own/' + OID, seed: async () => { await ownSeed({})(); await ev('localStorage.removeItem("sb.picturesTest")'); acct.pictures.missing = true; }, wait: 'document.querySelector("[data-own-page]")' });
    await sleep(500);
    ok(await ev('!document.querySelector("[data-pictures]") && !!document.querySelector("[data-words]")'), 'the plain word chips, no picture rows');
    ok(picCalls().length === 0, 'no request to the picture service');
  });

  // ---- S-child-pictures ---------------------------------------------------------------------------------------------------
  scene('SB6 pictures: a child sees only approved pictures; removed ones disappear', async () => {
    const own = ['lantern', 'pebble', 'meadow'];
    const o = Ow.set({}, OID, { name: 'Class 4 spellings', words: own, src: 'typed', to: [CHILD] }, NOW).own;
    const setup = Su.setOwnCopy({}, OID, { name: 'Class 4 spellings', words: own, src: 'typed' }, o[OID].at).setup;
    const seed = async () => {
      await seedChild(W.withSetup(weekDoc(), setup), DAY);
      reset({ mode: 'fake' });
      await ev('localStorage.setItem("sb.picturesTest","fast")');
      acct.who = adultMe; // the grown-up made them
      await make('lantern', 'approved');
      await make('pebble', 'ready'); // a candidate: never shown to a child
      acct.who = { ...acct.who };
    };
    const p = S.profile('iphone-14');
    const kidSeed = async () => { await seed(); const kid = { signedIn: true, kind: 'child', id: CHILD, displayName: 'Robin', nickname: 'Robin', year: 4, parentId: ADULT }; acct.who = kid; acct.calls.length = 0; };
    await S.forProfiles(async (pp, style) => {
      await S.openAs(pp, { day: DAY, hash: '#/words/own/' + OID + '/study', seed: kidSeed, night: style === 'night', wait: 'document.querySelector("main h1")' });
      await sleep(1200);
      const urls = await ev('performance.getEntriesByType("resource").map((e) => e.name).filter((n) => /\\/api\\/pictures\\/image\\//.test(n))');
      const t = await text();
      const found = [];
      if (urls.length !== 1) found.push('child page asked for ' + urls.length + ' pictures (want 1: only the approved one)');
      if (/on its way/i.test(t)) found.push('"on its way" shown to a child');
      if (/story credit|unlimited|allowance/i.test(t)) found.push('credits or allowance shown to a child');
      const bad = picCalls().filter((c) => !/^\/api\/pictures\/(approved|image\/)/.test(c.path));
      if (bad.length) found.push('a child called ' + bad.map((c) => c.method + ' ' + c.path).join(', '));
      found.push(...(await S.measure()).sideways > 0 ? [pp.id + ': sideways scroll'] : []);
      await S.shotAs(pp, 'child-pictures-' + pp.id, style);
      S.report(found);
    }, { ids: SIZES });
    step('the grown-up removes lantern: the child does not see it on the next load');
    await post('/api/pictures/' + idOf('lantern') + '/decide', { choice: 'none' }).catch(() => {});
    acct.pictures.approved.delete('lantern');
    acct.calls.length = 0;
    await S.openAs(p, { day: DAY, hash: '#/words/own/' + OID + '/study', seed: async () => { const keep = acct.pictures.jobs; await seedChild(W.withSetup(weekDoc(), setup), DAY); acct.pictures.jobs = keep; await ev('localStorage.setItem("sb.picturesTest","fast")'); acct.who = { signedIn: true, kind: 'child', id: CHILD, displayName: 'Robin', nickname: 'Robin', year: 4, parentId: ADULT }; }, wait: 'document.querySelector("main h1")' });
    await sleep(1000);
    const after = await ev('performance.getEntriesByType("resource").filter((e) => /\\/api\\/pictures\\/image\\//.test(e.name)).length');
    ok(after === 0, 'no picture asked for after removal: ' + after);
    ok(!picCalls().some((c) => !/^\/api\/pictures\/(approved|image\/)/.test(c.path)), 'a child never calls A1-A5 or A8-A10');
  });
};
