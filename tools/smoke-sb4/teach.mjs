// SB4-WP11: the teacher page (#/grownups/teach and teach/:oid). Loaded by tools/sb2-smoke.mjs with the harness H.
import * as Su from '../../site/js/setup-doc.js';
import * as Ow from '../../site/js/own-doc.js';
import * as PR from '../../site/js/progress-doc.js';

export default function (H) {
  const { scene, go, click, ev, ok, has, text, until, sleep, width, open, acct, W, plus, CHILD, CHILD2, ADULT, shot, style, send, visible } = H;
  const step = (n) => console.log('  · ' + n);
  const q = (s) => JSON.stringify(s);
  const K3 = '55555555-5555-4555-8555-555555555555';
  const K4 = '66666666-6666-4666-8666-666666666666';
  const KIDS = [
    { id: CHILD, nickname: 'Robin', year: 3, avatar: null }, { id: CHILD2, nickname: 'Wren', year: 1, avatar: null },
    { id: K3, nickname: 'Ada', year: 3, avatar: null }, { id: K4, nickname: 'Kofi', year: 4, avatar: null },
  ];
  const NAMES = KIDS.map((k) => k.nickname);
  const DAY = plus(5);
  const TEST = plus(4); // the Friday a week was tested
  const NOW = Date.parse(DAY + 'T10:00:00');
  const at = (day, h = 10) => Date.parse(day + 'T' + String(h).padStart(2, '0') + ':00:00');
  const adultMe = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };
  const WORDS = ['because', 'friend', 'island', 'thought', 'weight', 'knife', 'autumn', 'circle', 'famous', 'history', 'answer', 'breathe'];
  const OID = 'teach1';
  const OID2 = 'teach2';
  const OID3 = 'teach3';
  const noSideways = () => ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth');
  const kidsWords = (k) => W.normalise(acct.get(k, 'spellbright', 'words'));
  const ownCopy = (own, oid) => Su.setOwnCopy({}, oid, { name: own[oid].name, words: own[oid].words, src: 'typed' }, own[oid].at).setup;

  /** The grown-up's lists: A (12 words, all four children), B (6 words, Robin), C (4 words, nobody). A is older, so B is first on the page. */
  function lists({ a = true, b = true, c = false } = {}) {
    let own = {};
    if (a) own = Ow.set(own, OID, { name: 'Autumn 2 spellings', words: WORDS, src: 'typed', to: KIDS.map((k) => k.id) }, NOW - 2000).own;
    if (b) own = Ow.set(own, OID2, { name: 'Spring spellings', words: ['quay', 'rhythm', 'ocean', 'bridge', 'castle', 'orchard'], src: 'typed', to: [CHILD] }, NOW - 1000).own;
    if (c) own = Ow.set(own, OID3, { name: 'Trip words', words: ['map', 'coach', 'ticket', 'museum'], src: 'typed', to: [] }, NOW).own;
    return own;
  }
  const weekDoc = (id, name, words, test, done = false, wrong = []) => {
    let d = W.createGroup(W.emptyDoc(), { id, name, test, words, today: plus(0), now: at(plus(0), 9) }).doc;
    if (done) words.forEach((w, i) => { d = W.addTry(d, { id: 't' + id + i, word: w, day: test, group: id, kind: 't', tries: wrong.includes(w) ? 1 : 0, peeks: 0, clean: !wrong.includes(w), now: at(test) + i }); });
    return d;
  };
  /** The T-4 fixture: Robin passed (letter tiles), Wren studying (a quiz that missed island), Ada has a tested week from the list, Kofi was never sent it. */
  function fixture(own) {
    let rp = PR.mark(PR.mark(PR.emptyDoc(), 'own-' + OID, 'studiedAt', at(plus(1))), 'own-' + OID, 'practisedAt', at(plus(1)));
    rp = PR.recordTest(rp, 'own-' + OID, 11, 12, at(plus(2)), 'rt1', { passed: true, pf: 'normal', lv: 2 });
    rp = PR.addCheck(rp, { c: 'q:own-' + OID, k: 'q', s: 4, t: 5, d: plus(1), lv: 2, pf: 'normal' }, at(plus(1)), 'rq1');
    rp = { ...rp, tricky: { knife: { n: 2, c: 'own-' + OID, at: at(plus(1)) } } };
    let wp = PR.mark(PR.emptyDoc(), 'own-' + OID, 'studiedAt', at(plus(1)));
    wp = PR.addCheck(wp, { c: 'q:own-' + OID, k: 'q', s: 3, t: 5, d: plus(1), lv: 2, pf: 'sen', pk: 1, miss: ['island', 'weight'] }, at(plus(1)), 'rq2');
    const withCopy = (d, oid = OID) => !own[oid] ? d : W.withSetup(d, Su.setOwnCopy(W.setupOf(d), oid, { name: own[oid].name, words: own[oid].words, src: 'typed' }, own[oid].at).setup);
    return {
      [CHILD]: { words: own[OID2] ? withCopy(withCopy(W.emptyDoc()), OID2) : withCopy(W.emptyDoc()), progress: rp },
      [CHILD2]: { words: withCopy(W.emptyDoc()), progress: wp },
      [K3]: { words: withCopy(weekDoc('ga', 'Autumn test', WORDS.slice(0, 10), TEST, true, ['thought'])), progress: PR.emptyDoc() },
      [K4]: { words: W.emptyDoc(), progress: PR.emptyDoc() },
    };
  }
  const putAll = (docs) => { for (const [id, d] of Object.entries(docs)) { acct.put(id, 'spellbright', 'words', d.words); acct.put(id, 'spellbright', 'progress', d.progress); } };

  async function asAdult({ own = lists(), docs = null, hash = '#/grownups/teach', kids = KIDS, day = DAY, wait = 'document.querySelector("[data-teach-home],[data-teach-chapter],[data-teach-empty],[data-teach-offline]")' } = {}) {
    await H.signedOutBlank(day);
    acct.who = adultMe;
    acct.children = (id) => (id === ADULT ? kids : []);
    await ev('localStorage.setItem("sb.words:' + ADULT + '",' + q(JSON.stringify(W.withOwn(W.emptyDoc(), own))) + ')');
    putAll(docs || fixture(own));
    await open(day, hash);
    await until(wait, 'the page');
  }
  const restore = () => { acct.children = (id) => (id === ADULT ? KIDS.slice(0, 2).map((k, i) => ({ ...k, year: i ? 6 : 4 })) : []); acct.scan.missing = true; acct.scan.on = false; acct.failNext = null; };
  const withScene = (fn) => async () => { restore(); try { await fn(); } catch (e) { if (process.env.TEACH_STACK) console.log(e.stack); throw e; } finally { restore(); await send('Emulation.setEmulatedMedia', { media: '' }); await style('garden'); await width(390); } };
  const cell = (cid, label) => ev('(document.querySelector(' + q('tr[data-cid="' + cid + '"] td[data-label="' + label + '"]') + ') || {}).innerText || ""');
  const chapterHash = (oid = OID) => '#/grownups/own/' + oid + '/results';
  const isChapter = 'document.querySelector("[data-each-table]")';

  /** Every width and look: no sideways scroll, nothing off the page, every control at least 44 px. */
  async function layout(name, widths = [320, 390, 768, 1180]) {
    for (const s of ['garden', 'night']) {
      await style(s);
      for (const w of widths) {
        await width(w, 900);
        const over = await ev('document.documentElement.scrollWidth - document.documentElement.clientWidth');
        ok(over <= 0, name + ' scrolls sideways by ' + over + 'px at ' + w + ' in ' + s);
        const bad = await ev(`[...document.querySelectorAll('main *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.sr'); }).slice(0, 3).map((e) => e.className || e.tagName).join(' ')`);
        ok(!bad, name + ': off the page at ' + w + ' in ' + s + ': ' + bad);
        const small = await ev(`[...document.querySelectorAll('main a, main button, main label.gu-check')].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width && r.height && cs.visibility !== 'hidden' && !e.closest('.sr') && (r.height < 43.5 || r.width < 43.5); }).slice(0, 4).map((e) => (e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)).join('; ')`);
        ok(!small, name + ': a control under 44 px at ' + w + ' in ' + s + ': ' + small);
        if (w === 390 || w === 1180) await shot(name + '-' + s + '-' + w);
      }
    }
    await style('garden');
    await width(390);
  }

  // SB5 (TR-43, TR-82): the teacher home (#/grownups/teach) is gone. A parent's lists are cards on Word lists (newest first, a sharing line, Set a week and
  // Results); the per-child help table lives on each child's page; the scan link is a tab in the editor.
  scene('SB4-WP11 Word lists: a card for each list, who it is given to, Set a week and Results; no lists says what to do', withScene(async () => {
    await width(1180, 900);
    await asAdult({ own: lists({ c: true }), hash: '#/grownups/own', wait: 'document.querySelector("[data-own]")' });
    ok(/^Word lists$/.test(await text('h1')), 'the h1: ' + await text('h1'));
    const cards = await ev('[...document.querySelectorAll("[data-own]")].map((e) => ({ id: e.dataset.own, h: e.querySelector("h2").textContent, shared: e.querySelector("[data-shared]").textContent, set: !!e.querySelector("[data-set]"), res: !!e.querySelector("[data-results-link]") }))');
    ok(cards.map((c) => c.h).join() === 'Trip words,Spring spellings,Autumn 2 spellings', 'the three lists, newest first (TR-43, S3-D11): ' + cards.map((c) => c.h));
    const byName = Object.fromEntries(cards.map((c) => [c.h, c]));
    const [trip, spring, autumn] = [byName['Trip words'], byName['Spring spellings'], byName['Autumn 2 spellings']];
    ok(!trip.res && trip.set && /Not given/.test(trip.shared), 'an unshared list: Set a week, no Results: ' + JSON.stringify(trip));
    ok(spring.res && /Given for practice to Robin/.test(spring.shared), 'Spring: ' + JSON.stringify(spring));
    ok(autumn.res && /Week set for Ada · tested /.test(autumn.shared), 'Autumn: ' + JSON.stringify(autumn));
    ok(await ev('document.querySelector("[data-own=\\"' + OID + '\\"] [data-results-link]").getAttribute("href")') === '#/grownups/own/' + OID + '/results', 'Results goes to the list\'s results page');
    ok(await ev('document.querySelectorAll(".gu-ownlist .btn--primary").length') === 3 && await has('[data-own-new]'), 'each card has its Set a week and New list is in the bar');
    await shot('teach-home-1180');
    step('no lists');
    await asAdult({ own: {}, hash: '#/grownups/own', wait: 'document.querySelector("[data-none]")' });
    ok(/No lists of your own yet/.test(await text('[data-none]')) && /Make your first list/.test(await text('[data-own-new]')) && await ev('document.querySelector("[data-own-new]").classList.contains("btn--primary")'), 'no lists: Make your first list is the green button');
    ok(await has('a[href="#/grownups/own/ready"], a[href^="#/grownups/own/ready"]'), 'the Ready-made lists card is there');
    await layout('word-lists');
  }));

  scene('SB4-WP11 the old teacher address goes to Word lists for a parent', withScene(async () => {
    await asAdult({ own: lists(), hash: '#/grownups/teach', wait: 'document.querySelector("[data-own]")' });
    ok(await ev('location.hash') === '#/grownups/own', 'teach goes to Word lists: ' + await ev('location.hash'));
    await go('#/grownups/teach/' + OID);
    await until('/\\/results$/.test(location.hash) || document.querySelector("[data-teach-chapter]")', 'the old results address');
    ok(/^#\/grownups\/own\/[A-Za-z0-9_-]+\/results$/.test(await ev('location.hash')), 'teach/:oid goes to the list\'s results: ' + await ev('location.hash'));
  }));

  scene('SB4-WP11 one list across four children: results, the honest lines, the words', withScene(async () => {
    await width(1180, 900);
    await asAdult({ hash: chapterHash() });
    await until(isChapter, 'the table');
    const keysNow = () => ev('(async () => JSON.stringify([Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort(), indexedDB.databases ? (await indexedDB.databases()).map((x) => x.name).sort() : []]))()');
    const storeBefore = await keysNow(); // whatever earlier scenes left is in here: only a change made by this page counts
    // SB5 (TR-45/TR-82): the results page is "Results: <list>", a table of Child, Score and To practise again, then "Given to" with each child's stage line.
    ok(/^Results: Autumn 2 spellings$/.test(await text('h1')) && await ev('document.activeElement === document.querySelector("h1")'), 'the page name is the h1 and has focus: ' + await text('h1'));
    ok(await text('[data-headline]') === '12 words · given for practice to Robin, Wren, Ada and Kofi', 'the header line: ' + await text('[data-headline]'));
    ok(await ev('document.querySelector(".gu-back").getAttribute("href")') === '#/grownups/own' && /Word lists/.test(await text('.gu-back')), 'back to Word lists');
    ok((await ev('[...document.querySelectorAll("[data-each-table] tbody tr")].map((t) => t.dataset.cid)')).join() === [CHILD, CHILD2, K3, K4].join(), 'one row each, in the account\'s order');
    const sc = (cid) => cell(cid, 'Score');
    const tp = async (cid) => (await cell(cid, 'To practise again')).replace(/\s+/g, ' ').trim();
    ok(/^11 of 12 · Standard · with letter tiles \(Some letters\)$/.test((await sc(CHILD)).trim()) && await tp(CHILD) === 'knife', 'Robin: 11 of 12 with letter tiles, practises knife: ' + await sc(CHILD) + ' / ' + await tp(CHILD));
    ok((await sc(CHILD2)).trim() === '–' && /island/.test(await tp(CHILD2)) && /weight/.test(await tp(CHILD2)), 'Wren: no test yet, practises island and weight: ' + await tp(CHILD2));
    ok((await sc(K3)).trim() === '9 of 10' && await tp(K3) === 'thought', 'Ada: 9 of 10, practises thought: ' + await sc(K3));
    ok((await sc(K4)).trim() === '–' && await tp(K4) === 'None noted yet', 'Kofi has nothing yet, and no result is invented');
    const given = (cid) => ev('(document.querySelector(' + q('.ls-given[data-cid="' + cid + '"]') + ') || {}).innerText || ""').then((t) => t.replace(/\s+/g, ' ').trim());
    ok(/^Robin Practice only · Passed · 11 of 12 · Standard · with letter tiles \(Some letters\) · newest quiz 4 of 5 · Standard · with letter tiles/.test(await given(CHILD)), 'Robin\'s stage line says how it was taken: ' + await given(CHILD));
    ok(/^Wren Practice only · Studying · newest quiz 3 of 5 · Extra support · with letter tiles \(Some letters\) · 1 peek$/.test(await given(CHILD2)), 'Wren\'s stage line: ' + await given(CHILD2));
    ok(/^Ada Week of .* · Autumn test test · 9 of 10 · Standard · keyboard/.test(await given(K3)), 'Ada\'s week from the list: ' + await given(K3));
    ok(/Not sent to Kofi yet\./.test(await given(K4)) && await has('[data-resend="' + K4 + '"]'), 'Kofi: Not sent, with Try again');
    ok(/Words to practise come from the newest quiz, this week's practice and test, and the tricky-words list\. Only what has been saved is shown\./.test(await text('[data-each-table]') + await text('main')), 'the key line');
    step('the words tab');
    await click('[data-tab=words]');
    const wr = await ev('[...document.querySelectorAll("[data-word-row]")].map((r) => r.innerText.replace(/\\s+/g, " ").trim())');
    ok(wr.length === 12 && /^because/.test(wr[0]) && /island.*Wren/.test(wr[2]) && /weight.*Wren/.test(wr[4]), 'one row for each word in the list\'s order: ' + JSON.stringify(wr));
    ok(/thought.*Ada/.test(wr[3]) && /knife.*Robin/.test(wr[5]), 'thought and knife: ' + JSON.stringify(wr.slice(3, 6)));
    ok(/which to go over together/i.test(await text('[data-part="words"]')), 'the caption');
    await click('[data-tab=results]');
    step('Try again on a list that did not reach Kofi');
    await click('[data-resend="' + K4 + '"]');
    await until('!document.querySelector("[data-resend]")', 'sent');
    await until('document.activeElement === document.querySelector("tr[data-cid=\\"' + K4 + '\\"] th")', 'focus goes to Kofi\'s row, not the top of the page');
    ok(!/Not sent/.test(await given(K4)), 'Kofi has it now: ' + await given(K4));
    ok(Object.keys(kidsWords(K4).setup.own || {}).join() === OID, 'Kofi\'s copy was saved');
    step('nothing about a child is kept on this device');
    const stored = await ev('JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)])');
    ok(!NAMES.some((n) => stored.includes(n)), 'no child\'s name in localStorage or sessionStorage');
    ok(await keysNow() === storeBefore, 'the page added nothing to localStorage, sessionStorage or IndexedDB: ' + storeBefore);
    await shot('teach-chapter-1180');
    await layout('teach-chapter');
  }));

  // SB5: "Set this week's test" on the results page is gone. A week from a list is set on the Set a week page (#/grownups/set/list/:oid).
  scene('SB4-WP11 Set a week from a 12-word list for four children: ten words, one week each with its own id', withScene(async () => {
    await width(1180, 900);
    const own = lists({ b: false });
    const docs = fixture(own);
    await asAdult({ own, docs, hash: '#/grownups/set/list/' + OID, wait: 'document.querySelector(".st-page")' });
    await sleep(400);
    ok(/12 words\. A week takes 10: you choose which 10/.test(await text('main')) && await has('[data-act=set]'), 'twelve words: you choose which 10');
    ok(await ev('document.querySelectorAll("input[data-kid]").length') === 4, 'a box for each of the four children');
    for (const k of [CHILD, CHILD2, K3, K4]) if (!await ev('document.querySelector("input[data-kid=\\"' + k + '\\"]").checked')) { await click('input[data-kid="' + k + '"]'); await sleep(80); }
    ok(await ev('document.querySelectorAll("input[data-kid]:checked").length') === 4, 'all four ticked: ' + await ev('document.querySelectorAll("input[data-kid]:checked").length'));
    await click('[data-act=set]');
    await until('document.querySelector("[data-done], .st-done, [data-act=again], [data-act=retry]")', 'the done page', 15000);
    await sleep(500);
    const fromList = (k) => W.liveGroups(kidsWords(k)).filter((g) => g.words.every((w) => WORDS.includes(w)) && g.words.length === 10);
    const ids = [];
    for (const k of [CHILD, CHILD2, K3, K4]) {
      const g = fromList(k);
      ok(g.length >= 1, 'a week of ten words from the list for ' + k + ': ' + JSON.stringify(W.liveGroups(kidsWords(k)).map((x) => [x.id, x.words.length])));
      ids.push(g[g.length - 1].id);
    }
    ok(new Set(ids).size === 4, 'four different week ids: ' + ids);
    ok(new Set([CHILD, CHILD2, K3, K4].map((k) => fromList(k).slice(-1)[0].test)).size === 1, 'one test date for all');
  }));

  scene('SB4-WP11 print this page, print for one child (only that name on paper), Copy as text', withScene(async () => {
    await width(1180, 900);
    await asAdult({ hash: chapterHash() });
    await until(isChapter, 'the page');
    await ev(`(() => { window.__printed = 0; window.print = () => { window.__printed += 1; }; window.__clip = ''; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.__clip = t; } } }); })()`);
    const paper = async () => ev('document.querySelector("main").innerText');
    const media = (m) => send('Emulation.setEmulatedMedia', { media: m });
    step('the whole page, on A4');
    await click('[data-print-all]');
    ok(await ev('window.__printed') === 1 && !await ev('document.querySelector(".gu").hasAttribute("data-print-only")'), 'print was asked for, nothing is hidden for one child');
    await media('print');
    await width(794, 1123);
    const t = await paper();
    ok(/Printed on \d{1,2} \w{3} 2026/.test(t), 'the date line is printed: ' + t.slice(0, 60));
    for (const n of NAMES) ok(t.includes(n), n + ' is on the whole page');
    ok(!await visible('[data-print-all]') && !await visible('.t-actions') && !await visible('[data-resend]'), 'every button is hidden on paper');
    ok(await ev('getComputedStyle(document.querySelector("[data-each-table] tr[data-cid]")).display') === 'block' && await ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), 'stacked for each child, no sideways overflow on A4');
    ok(await ev('[...document.querySelectorAll("[data-each-table] td")].every((td) => getComputedStyle(td).overflowWrap !== "anywhere")'), 'on paper a word never splits mid-word (S3-D12)');
    await shot('teach-print-all-a4');
    await media('');
    await width(1180, 900);
    step('one child');
    await ev('document.querySelector("[data-print-one]").focus()');
    await click('[data-print-one]');
    await until('document.querySelector("[data-dialog]")', 'the dialog');
    ok(await ev('document.querySelector("[data-dialog]").getAttribute("aria-describedby")') === 't-onedesc' && await ev('document.activeElement.name') === 't-kid', 'described by its line; focus on the first child');
    ok(await text('[data-onedesc]') === 'Only Robin’s results will print or copy. Use this when you hand it to one family.', 'the line: ' + await text('[data-onedesc]'));
    ok((await ev('[...document.querySelectorAll("[data-dialog] [data-act]")].map((b) => b.textContent)')).join() === 'Print,Copy as text,Cancel', 'Print, Copy as text, Cancel');
    await ev('document.querySelector("input[name=t-kid][value=\\"' + CHILD2 + '\\"]").click()');
    ok(/^Only Wren’s results will print or copy\./.test(await text('[data-onedesc]')), 'the line follows the choice');
    await ev('document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))');
    ok(!await has('[data-dialog]') && await ev('document.activeElement === document.querySelector("[data-print-one]")') && await ev('window.__printed') === 1, 'Escape cancels; focus goes back; nothing printed: ' + await ev('document.activeElement.outerHTML.slice(0,80)') + ' dialog=' + await has('[data-dialog]') + ' printed=' + await ev('window.__printed'));
    await ev('document.querySelector("[data-print-one]").focus()');
    await click('[data-print-one]');
    await until('document.querySelector("[data-dialog]")', 'the dialog again');
    await ev('document.querySelector("input[name=t-kid][value=\\"' + CHILD2 + '\\"]").click()');
    await click('[data-dialog] [data-act="print"]');
    ok(await ev('window.__printed') === 2 && await ev('document.querySelector(".gu").getAttribute("data-print-only")') === CHILD2, 'printing for Wren');
    await media('print');
    await width(794, 1123);
    const one = await paper();
    ok(one.includes('Wren') && /12 words · Wren/.test(one), 'Wren and the line naming only Wren are printed: ' + one.slice(0, 200));
    for (const n of ['Robin', 'Ada', 'Kofi']) ok(!one.includes(n), n + ' is nowhere on the paper');
    ok(!/The words|No one noted|shared with/.test(one), 'no word rows and no list of children');
    ok(await ev('[...document.querySelectorAll("tr[data-cid], .ls-given[data-cid]")].filter((r) => getComputedStyle(r).display !== "none").length') === 2, 'one child\'s row and given line are visible');
    ok(/island/.test(one) && /weight/.test(one), 'Wren\'s own words to practise are on it');
    await shot('teach-print-one-a4');
    await media(''); // print media off again, as after a print: nothing is left hidden
    await sleep(120);
    ok(!await ev('document.querySelector(".gu").hasAttribute("data-print-only") || !!document.querySelector("[data-print-skip]")'), 'cleaned up when print media ends');
    await width(1180, 900);
    await click('[data-print-one]');
    await until('document.querySelector("[data-dialog]")', 'the dialog a third time');
    await click('[data-dialog] [data-act="print"]');
    ok(await ev('!!document.querySelector("[data-print-skip]")'), 'hidden again for another print');
    await ev('window.dispatchEvent(new Event("afterprint"))');
    ok(!await ev('!!document.querySelector("[data-print-skip]") || document.querySelector(".gu").hasAttribute("data-print-only")'), 'cleaned up on afterprint');
    await click('[data-print-one]');
    await until('document.querySelector("[data-dialog]")', 'the dialog a fourth time');
    await click('[data-dialog] [data-act="print"]');
    await go('#/grownups');
    await until('document.querySelector("main h1")', 'the grown-ups home');
    await go(chapterHash());
    await until(isChapter, 'the page again');
    ok(!await ev('!!document.querySelector("[data-print-skip]") || document.querySelector(".gu").hasAttribute("data-print-only")'), 'nothing is left in one-child state after leaving and coming back');
    step('Copy as text');
    await ev(`(() => { window.__clip = ''; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.__clip = t; } } }); window.print = () => {}; })()`);
    await click('[data-copy-all]');
    await until('document.querySelector("[data-copied]").textContent === "Copied."', 'Copied.');
    const all = await ev('window.__clip');
    ok(NAMES.every((n) => all.includes(n)) && /island: To practise: Wren/.test(all) && /Not sent to Kofi yet\./.test(all) && /11 of 12 · Standard · with letter tiles/.test(all), 'the whole page as text');
    await ev('document.querySelector("[data-print-one]").focus()');
    await click('[data-print-one]');
    await until('document.querySelector("[data-dialog]")', 'the dialog');
    await ev('document.querySelector("input[name=t-kid][value=\\"' + K3 + '\\"]").click()');
    await ev('window.__clip = ""');
    await click('[data-dialog] [data-act="copy"]');
    await until('window.__clip !== ""', 'copied for Ada');
    const adaText = await ev('window.__clip');
    ok(adaText.includes('Ada') && !['Robin', 'Wren', 'Kofi'].some((n) => adaText.includes(n)) && !/The words/.test(adaText), 'one child\'s text names that child only');
    await until('document.querySelector("[data-copied]").textContent === "Copied."', 'Copied. shows in the page');
    ok(!await has('[data-dialog]') && await ev('document.activeElement === document.querySelector("[data-print-one]")'), 'the dialog closed; focus back on its opener');
    await ev(`Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('no'); } } })`);
    await click('[data-copy-all]');
    await until('document.querySelector("[data-copied]").textContent === "Couldn\'t copy. You can print instead."', 'the failure line');
    ok(/Printed or copied results show children's names\. Keep them safe\./.test(await text('[data-teach-chapter]')), 'the warning line');
  }));

  scene('SB4-WP11 empty states: a list nobody has, shared with nobody, a list that is gone, offline', withScene(async () => {
    await width(390, 844);
    // a list whose copies never reached anyone
    const own = lists({ b: false });
    await asAdult({ own, docs: { [CHILD]: { words: W.emptyDoc(), progress: PR.emptyDoc() }, [CHILD2]: { words: W.emptyDoc(), progress: PR.emptyDoc() }, [K3]: { words: W.emptyDoc(), progress: PR.emptyDoc() }, [K4]: { words: W.emptyDoc(), progress: PR.emptyDoc() } }, hash: chapterHash() });
    await until('document.querySelector("[data-nochild]")', 'No child has this list yet');
    ok(/No child has this list yet\./.test(await text('[data-nochild]')) && /It hasn't reached Robin, Wren, Ada or Kofi yet\./.test(await text('[data-nochild]')), 'one summary line: ' + await text('[data-nochild]'));
    ok(!await has('[data-each-table]'), 'no table');
    await click('[data-resend-all]');
    await until('document.querySelector("[data-each-table]")', 'sent: the table appears');
    ok(Object.keys(kidsWords(CHILD).setup.own || {}).join() === OID, 'Try again sent the list');
    // shared with nobody
    await asAdult({ own: lists({ a: false, b: false, c: true }), hash: chapterHash(OID3) });
    await until('document.querySelector("[data-shared-none]")', 'shared with nobody');
    ok(/No results yet/.test(await text('[data-shared-none]')) && /Results show after a child practises these words\./.test(await text('[data-shared-none]')) && /Not given to anyone yet\./.test(await text('[data-notgiven]')), 'the lines');
    ok(await ev('document.querySelector("[data-give]").getAttribute("href")') === '#/grownups/own/' + OID3 + '/give' && /Give for practice/.test(await text('[data-give]')), 'Give for practice goes to the give page');
    // gone: an id that is not there, and a bad address
    for (const h of [chapterHash('nothere'), chapterHash('bad%'), chapterHash('a'.repeat(60))]) {
      await go(h);
      await until('document.querySelector("[data-gone]")', 'gone at ' + h);
      ok(/It may have been deleted, or the link is old/.test(await text('[data-gone]')) && /Back to Word lists/.test(await text('[data-gone] a')) && await ev('document.querySelector("[data-gone] a").getAttribute("href")') === '#/grownups/own', 'gone: ' + h);
    }
    // a deleted list
    const gone = { ...lists({ b: false }) };
    gone[OID] = { ...gone[OID], gone: NOW - 1000, at: NOW };
    await asAdult({ own: gone, hash: chapterHash() });
    await until('document.querySelector("[data-deleted]")', 'a deleted list still shows its results, with a line saying it was deleted');
    ok(/This list was deleted\./.test(await text('[data-deleted]')), 'the deleted line');
    // offline on opening
    await asAdult({ hash: '#/grownups/own', wait: 'document.querySelector("[data-own]")' });
    await ev('Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false })');
    try {
      await go(chapterHash());
      await until('document.querySelector("[data-teach-offline]")', 'the offline card');
      ok(/You're offline\. You can see results when you're back online\./.test(await text()) && await has('[data-retry]'), 'offline line and Try again');
      await go('#/grownups/own');
      await until('document.querySelector("[data-offline]")', 'offline on Word lists too');
    } finally { await ev('delete navigator.onLine'); }
    // one child's data could not be read: that card says so, the others still draw
    await asAdult({ hash: '#/grownups/own', wait: 'document.querySelector("[data-own]")' });
    const real = acct.fetch;
    acct.fetch = async (url, init = {}) => (url.includes('/api/children/' + K3 + '/game/') ? { ok: false, status: 404, headers: { get: () => null }, json: async () => ({ error: 'forced' }) } : real(url, init));
    try {
      await go(chapterHash());
      await until(isChapter, 'the table');
      const row = await ev('(document.querySelector("tr[data-cid=\\"' + K3 + '\\"]") || {}).innerText || ""');
      ok(/Something went wrong on our side\. Please try again\./.test(row) && /Try again/.test(row), 'Ada\'s card says so: ' + row);
      ok(/11 of 12/.test(await cell(CHILD, 'Score')), 'the other rows still draw');
    } finally { acct.fetch = real; }
    // the account says signed out: the usual line, no table
    await asAdult({ hash: '#/grownups/own', wait: 'document.querySelector("[data-own]")' });
    H.allowLog(/status of 401/); // the signed-out step asks for it
    acct.failNext = { status: 401, times: 1 };
    acct.calls.length = 0;
    await go(chapterHash());
    await until('document.querySelector("[data-teach-problem]")', 'a problem page');
    ok(await has('[data-retry]') && /signed out/i.test(await text('[data-teach-problem]')), 'signed out: the usual line and Try again: ' + await text('[data-teach-problem]'));
    await until('true', 'settled'); await sleep(300);
    ok(acct.calls.some((c) => c.path === '/api/me'), 'the account was asked who is signed in again (S3-D13)');
  }));

  // SB5: the Menu has five rows and no "For teachers" row (the teacher page is gone; see the 'adult Menu' scene), so this scene keeps what still applies.
  scene('SB4-WP11 a child and an adult playing as a child get no results data; See results is on each shared list card; About is for teachers too', withScene(async () => {
    await width(390, 844);
    await H.seedChild(W.emptyDoc(), DAY);
    acct.calls.length = 0;
    for (const h of ['#/grownups/own', chapterHash()]) {
      await open(DAY, h);
      await until('document.querySelector("[data-notforyou]")', 'refused at ' + h);
    }
    acct.who = { ...adultMe, playingAs: { id: CHILD, nickname: 'Robin', year: 4, avatar: null } };
    await open(DAY, '#/grownups/own');
    await until('document.querySelector("[data-playing]")', 'the switch-back card');
    ok(await has('[data-switchback]'), 'Switch back to myself');
    ok(!acct.calls.some((c) => c.path.startsWith('/api/children')), 'nothing under /api/children was asked for');
    step('the shared pages that mention it');
    await asAdult({ hash: '#/grownups/own', wait: 'document.querySelector("[data-own]")' });
    ok(await ev('document.querySelectorAll("[data-results-link]").length') === 2 && await ev('[...document.querySelectorAll("[data-results-link]")].every((a) => /^#\\/grownups\\/own\\/teach[12]\\/results$/.test(a.getAttribute("href")))'), 'Results on each shared card');
    await open(DAY, '#/about');
    ok(/For parents, teachers and tutors\./.test(await text()), 'About is for parents, teachers and tutors (SB5 06d: the long teachers paragraph is gone)');
  }));
}
