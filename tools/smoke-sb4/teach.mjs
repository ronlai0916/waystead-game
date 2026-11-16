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
  const chapterHash = (oid = OID) => '#/grownups/teach/' + oid;
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

  scene('SB4-WP11 teacher home: two lists with their summaries, the help table, and the links', withScene(async () => {
    await width(1180, 900);
    await asAdult({ own: lists({ c: true }) });
    ok(/^For teachers and tutors$/.test(await text('h1')), 'the h1: ' + await text('h1'));
    ok(await ev('document.activeElement === document.querySelector("h1")'), 'focus goes to the h1');
    const page = await text();
    ok(/Give up to 5 children the same list, set the test, and see how each one did\./.test(page), 'the lede');
    ok(/Your account holds up to 5 children\. Whole classes are not here yet\./.test(page) && /Only add children whose parents or carers have agreed\./.test(page), 'the scope and permission lines');
    ok(!/Scan a paper/.test(page) && await has('[data-type-link]'), 'no Scan a paper while scanning is dark; Type a list is there');
    ok(await ev('document.querySelector("[data-type-link]").getAttribute("href")') === '#/grownups/own/new', 'Type a list goes to the editor');
    const cards = await ev('[...document.querySelectorAll("[data-lists] [data-own]")].map((e) => ({ id: e.dataset.own, h: e.querySelector("h2").textContent, sum: (e.querySelector("[data-summary]") || {}).textContent || "", shared: e.querySelector("[data-shared]").textContent, btn: [...e.querySelectorAll(".gu-actions a")].map((a) => a.textContent + "|" + a.className + "|" + a.getAttribute("href")) }))');
    ok(cards.map((c) => c.h).join() === 'Trip words,Spring spellings,Autumn 2 spellings', 'newest first: ' + cards.map((c) => c.h));
    const [trip, spring, autumn] = cards;
    ok(trip.shared === 'Not shared yet' && trip.sum === '' && /Share it\|btn btn--ghost\|#\/grownups\/own\/teach3/.test(trip.btn[0]), 'an unshared list: Share it and no summary: ' + JSON.stringify(trip));
    ok(spring.shared === 'Shared with Robin' && spring.sum === '1 to do', 'Spring: ' + JSON.stringify(spring));
    ok(autumn.shared === 'Shared with Robin, Wren, Ada and Kofi' && autumn.sum === '1 passed · 1 studying · 1 to do · 1 not sent yet', 'Autumn: ' + JSON.stringify(autumn));
    ok(/See results\|btn btn--ghost\|#\/grownups\/teach\/teach1/.test(autumn.btn[0]) && /See results\|btn btn--ghost/.test(spring.btn[0]), 'See results on the shared cards');
    ok(await ev('document.querySelectorAll("[data-lists] .btn--primary").length') === 0 && await ev('document.querySelector("[data-type-link]").classList.contains("btn--primary")') === false, 'the first card is unshared here, so no second green button is forced');
    step('the help table');
    const rows = await ev('[...document.querySelectorAll("[data-help-table] tbody tr")].map((tr) => [...tr.children].map((c) => c.innerText.replace(/\\s+/g, " ").trim()))');
    ok(rows.length === 4 && rows.map((r) => r[0]).join() === 'Robin,Wren,Ada,Kofi', 'one row for each child in account order: ' + JSON.stringify(rows));
    ok(rows[0][1] === 'Year 3' && rows[0][2] === 'Keyboard' && rows[0][3] === 'Standard' && rows[0][4] === 'Change', 'Robin: ' + JSON.stringify(rows[0]));
    ok(rows[1][1] === 'Year 1' && rows[1][2] === 'Some letters', 'Wren is in Year 1 and starts with some letters: ' + JSON.stringify(rows[1]));
    ok(await ev('document.querySelectorAll("[data-help-table] tbody a.btn")[1].getAttribute("aria-label")') === 'Change how Wren spells', 'the Change label');
    ok(await ev('document.querySelectorAll("[data-help-table] tbody a.btn")[1].getAttribute("href")') === '#/grownups/child/' + CHILD2 + '/spelling', 'Change goes to that child\'s spelling page');
    ok(await ev('document.querySelector("[data-help-table] caption").textContent') === 'How each child spells. Change it on the child\'s page.', 'the caption');
    ok(await has('[data-overview-link]'), 'the link to all children in one table');
    await shot('teach-home-1180');
    step('the caption is one block on a phone, here and on the overview');
    await width(390, 844);
    const cap = await ev('(() => { const r = document.querySelector("[data-help-table] caption").getBoundingClientRect(); return { w: r.width, h: r.height }; })()');
    ok(cap.w > 250 && cap.h < 90, 'the help caption is wide, not one word a line: ' + JSON.stringify(cap));
    await go('#/grownups/overview');
    await until('document.querySelector("[data-overview] caption")', 'the overview');
    const cap2 = await ev('(() => { const r = document.querySelector("[data-overview] caption").getBoundingClientRect(); return { w: r.width, h: r.height }; })()');
    ok(cap2.w > 250 && cap2.h < 90, 'the overview caption too: ' + JSON.stringify(cap2));
    await go(HOME_HASH);
    await until('document.querySelector("[data-teach-home] [data-help-table]")', 'the home again');
    step('scanning on: Scan a paper appears');
    acct.scan.missing = false;
    acct.scan.on = true;
    await open(DAY, HOME_HASH);
    await until('document.querySelector("[data-teach-home] [data-help-table]")', 'the home');
    ok(await has('[data-scan-link]') && await ev('document.querySelector("[data-scan-link]").getAttribute("href")') === '#/grownups/scan' && /Scan a paper/.test(await text('[data-scan-link]')), 'Scan a paper after the account says on');
    ok(await ev('document.querySelector("[data-scan-link]").classList.contains("btn--primary")') === false, 'a list is there, so Scan a paper is quiet');
    await layout('teach-home');
  }));
  const HOME_HASH = '#/grownups/teach';

  scene('SB4-WP11 teacher home: no lists, and no children', withScene(async () => {
    await width(390, 844);
    await asAdult({ own: {} });
    ok(/No lists yet\. Make one above\./.test(await text('[data-none]')), 'no lists');
    ok(await ev('document.querySelector("[data-type-link]").classList.contains("btn--primary")'), 'with no list, Type a list is the one green button');
    ok(await has('[data-help-table]'), 'the help table is still there');
    await asAdult({ own: {}, kids: [], docs: {} });
    await until('document.querySelector("[data-first]")', 'Add your first child');
    ok(/Add your first child/.test(await text('[data-first]')) && await has('[data-addchild]'), 'the first-child card');
    ok(!await has('[data-help-table]') && !await has('[data-lists]') && !/Three steps/.test(await text()), 'steps, lists and the help table are hidden');
    ok(/Whole classes are not here yet\./.test(await text()), 'the scope line is still there');
  }));

  scene('SB4-WP11 one list across four children: results, the honest lines, the words', withScene(async () => {
    await width(1180, 900);
    await asAdult({ hash: chapterHash() });
    await until(isChapter, 'the table');
    const keysNow = () => ev('(async () => JSON.stringify([Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort(), indexedDB.databases ? (await indexedDB.databases()).map((x) => x.name).sort() : []]))()');
    const storeBefore = await keysNow(); // whatever earlier scenes left is in here: only a change made by this page counts
    ok(/^Autumn 2 spellings$/.test(await text('h1')) && await ev('document.activeElement === document.querySelector("h1")'), 'the list\'s name is the h1 and has focus');
    ok(await text('[data-headline]') === '12 words · shared with Robin, Wren, Ada and Kofi', 'the header line: ' + await text('[data-headline]'));
    ok(await ev('document.querySelector("[data-change-list]").getAttribute("href")') === '#/grownups/own/' + OID && /Change the list or who has it/.test(await text('[data-change-list]')), 'Change the list or who has it');
    ok(await ev('document.querySelector(".gu-back").getAttribute("href")') === '#/grownups/teach', 'back to For teachers');
    ok((await ev('[...document.querySelectorAll("[data-each-table] tbody tr")].map((t) => t.dataset.cid)')).join() === [CHILD, CHILD2, K3, K4].join(), 'one row each, in the account\'s order');
    // Robin: passed with letter tiles
    ok(await cell(CHILD, 'Has the list') === 'Yes', 'Robin has the list');
    ok(/Passed/.test(await cell(CHILD, 'Stage')) && /Learned the words: Yes/.test(await cell(CHILD, 'Stage')) && /Practised: Yes/.test(await cell(CHILD, 'Stage')), 'Robin stage: ' + await cell(CHILD, 'Stage'));
    const rt = await cell(CHILD, 'Chapter test');
    ok(/11 of 12 · Standard · with letter tiles \(Some letters\)/.test(rt) && /Passed/.test(rt) && /Taken 1 time/.test(rt), 'Robin\'s test says how it was taken: ' + rt);
    ok(/4 of 5 · Standard · with letter tiles/.test(await cell(CHILD, 'Newest quiz')), 'Robin\'s quiz');
    ok(await cell(CHILD, 'This week\'s test') === 'No week set from this list', 'no week from the list');
    ok((await cell(CHILD, 'Words to practise')).trim() === 'knife', 'Robin practises knife (tricky list)');
    // Wren: studying, a quiz that missed island and weight
    ok(/Studying/.test(await cell(CHILD2, 'Stage')) && /Practised: Not yet/.test(await cell(CHILD2, 'Stage')), 'Wren studying');
    ok(await cell(CHILD2, 'Chapter test') === 'Not taken yet', 'Wren has not taken the test');
    ok(/3 of 5 · Extra support · with letter tiles \(Some letters\) · 1 peek/.test(await cell(CHILD2, 'Newest quiz')), 'Wren\'s quiz: ' + await cell(CHILD2, 'Newest quiz'));
    ok(/island/.test(await cell(CHILD2, 'Words to practise')) && /weight/.test(await cell(CHILD2, 'Words to practise')), 'Wren practises island and weight');
    // Ada: a tested week from the list, one word not right
    ok(/Autumn test test · 9 of 10 · Standard · keyboard/.test(await cell(K3, 'This week\'s test')), 'Ada\'s week: ' + await cell(K3, 'This week\'s test'));
    ok((await cell(K3, 'Words to practise')).trim() === 'thought', 'Ada practises thought');
    ok(await cell(K3, 'Newest quiz') === 'No quiz yet', 'no quiz yet');
    // Kofi: not started, not sent
    ok(/Not sent to Kofi yet\./.test(await cell(K4, 'Has the list')) && await has('[data-resend="' + K4 + '"]'), 'Kofi: Not sent, with Try again');
    ok(/To do/.test(await cell(K4, 'Stage')) && await cell(K4, 'Words to practise') === 'None noted yet' && await cell(K4, 'Chapter test') === 'Not taken yet', 'Kofi has nothing yet, and no result is invented');
    ok(/Words to practise come from the newest quiz, this week's practice and test, and the tricky-words list\. Only what has been saved is shown\./.test(await text('[data-each-table]') + await text('[data-part="each"]')), 'the key line');
    step('the words');
    const wr = await ev('[...document.querySelectorAll("[data-word-row]")].map((r) => r.innerText.replace(/\\s+/g, " ").trim())');
    ok(wr.length === 12 && wr[0] === 'because No one noted' && wr[2] === 'island To practise: Wren' && wr[4] === 'weight To practise: Wren', 'one row for each word in the list\'s order: ' + JSON.stringify(wr));
    ok(wr[3] === 'thought To practise: Ada' && wr[5] === 'knife To practise: Robin', 'thought and knife');
    ok(/Which words to go over together\./.test(await text('[data-part="words"]')), 'the caption');
    step('Try again on a list that did not reach Kofi');
    await click('[data-resend="' + K4 + '"]');
    await until('!document.querySelector("[data-resend]")', 'sent');
    await until('document.activeElement === document.querySelector("tr[data-cid=\\"' + K4 + '\\"] th")', 'focus goes to Kofi\'s row, not the top of the page');
    ok(await cell(K4, 'Has the list') === 'Yes', 'Kofi has it now');
    ok(Object.keys(kidsWords(K4).setup.own || {}).join() === OID, 'Kofi\'s copy was saved');
    step('nothing about a child is kept on this device');
    const stored = await ev('JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)])');
    ok(!NAMES.some((n) => stored.includes(n)), 'no child\'s name in localStorage or sessionStorage');
    ok(await keysNow() === storeBefore, 'the page added nothing to localStorage, sessionStorage or IndexedDB: ' + storeBefore);
    await shot('teach-chapter-1180');
    await layout('teach-chapter');
  }));

  scene('SB4-WP11 Set this week\'s test for three children: one id each, a failed one retried makes no second week, a child with a week from the list starts unticked', withScene(async () => {
    await width(1180, 900);
    const own = lists({ b: false });
    const docs = fixture(own);
    docs[CHILD2] = { ...docs[CHILD2], words: W.withSetup(weekDoc('gw', 'Wren week', ['island', 'weight'], plus(9)), W.setupOf(docs[CHILD2].words)) }; // a week from this list, test not done
    docs[K3] = { ...docs[K3], words: W.withSetup(weekDoc('go', 'Trip week', ['zebra', 'quay'], plus(9)), W.setupOf(docs[K3].words)) }; // another week
    await asAdult({ own, docs, hash: chapterHash() });
    await until(isChapter, 'the page');
    ok(/Each child practises these words in the game every day, then takes the test on the test date\./.test(await text('[data-set]')), 'the line at the top of the card');
    ok(/Spellbright may add up to 3 words each child found tricky before\./.test(await text('[data-set]')), 'the tricky line');
    ok(/Pick 10 for this week/.test(await text('[data-set] legend')) && await ev('document.querySelectorAll("[data-pickword]:checked").length') === 10, 'twelve words: ten ticked');
    ok(await text('[data-pickline]') === '10 of 10 ticked. Untick one to choose another.', 'full: ' + await text('[data-pickline]'));
    ok(await ev('document.querySelectorAll("[data-pickword]:disabled").length') === 2 && await ev('document.querySelector("[data-pickword]:disabled").getAttribute("aria-describedby")') === 't-pickline', 'the two spare boxes are disabled, with the reason linked');
    await click('[data-pickword][value="breathe"]'); // not ticked: disabled, so nothing happens
    await ev('document.querySelector("[data-pickword][value=\\"history\\"]").click()');
    ok(await ev('document.querySelectorAll("[data-pickword]:checked").length') === 9 && await text('[data-pickline]') === '9 of 10 ticked.', 'unticking one: ' + await text('[data-pickline]'));
    await ev('document.querySelector("[data-pickword][value=\\"history\\"]").click()');
    const ticks = await ev('[...document.querySelectorAll("[data-kid]")].map((b) => b.checked)');
    ok(ticks.join() === 'true,false,true,true', 'Wren (a week from this list) is unticked, the others ticked: ' + ticks);
    ok(/^Wren already has a week from this list, with a test on \w{3} \d{1,2} \w{3}\.$/.test(await ev('document.querySelectorAll("[data-running]")[0].textContent')), 'Wren\'s line: ' + await ev('document.querySelectorAll("[data-running]")[0].textContent'));
    ok(await ev('document.querySelectorAll("[data-running]")[1].textContent') === 'Ada already has a week running: Trip week. This adds another week.', 'Ada\'s line (another week)');
    ok(await text('[data-set-go]') === 'Set the test for 3 children', 'the button: ' + await text('[data-set-go]'));
    step('no child ticked');
    for (const id of [CHILD, K3, K4]) await ev('document.querySelector("[data-kid][value=\\"' + id + '\\"]").click()');
    ok(await ev('document.querySelector("[data-set-go]").disabled') && await text('[data-set-go]') === 'Set the test for 0 children' && await text('[data-why]') === 'Tick at least one child.' && await ev('document.querySelector("[data-set-go]").getAttribute("aria-describedby")') === 't-why', 'disabled with its reason');
    for (const id of [CHILD, K3, K4]) await ev('document.querySelector("[data-kid][value=\\"' + id + '\\"]").click()');
    ok(await text('[data-set-go]') === 'Set the test for 3 children', 'three again');
    step('a date of today is refused before anything is asked of the account');
    const put = () => acct.calls.filter((c) => c.method === 'PUT').length;
    await ev('(() => { const d = document.querySelector("[data-date]"); d.value = ' + q(DAY) + '; d.dispatchEvent(new Event("input", { bubbles: true })); })()');
    const before = acct.calls.length;
    await click('[data-set-go]');
    ok(await text('[data-set-error]') === 'The test date needs to be after today.', 'the refusal: ' + await text('[data-set-error]'));
    ok(acct.calls.length === before, 'no call was made');
    step('a short week');
    await ev('(() => { const d = document.querySelector("[data-date]"); d.value = ' + q(plus(6)) + '; d.dispatchEvent(new Event("input", { bubbles: true })); })()');
    ok(!await ev('document.querySelector("[data-short]").hidden') && /Short week: some days will have two jobs\./.test(await text('[data-short]')), 'Short week line');
    const test = plus(12);
    await ev('(() => { const d = document.querySelector("[data-date]"); d.value = ' + q(test) + '; d.dispatchEvent(new Event("input", { bubbles: true })); })()');
    ok(await ev('document.querySelector("[data-short]").hidden'), 'no short line for a full week');
    step('Robin\'s save is stored, then the answer is lost: the page says not set, Try again makes no second week');
    const real = acct.fetch;
    let lost = false;
    acct.fetch = async (url, init = {}) => {
      const r = await real(url, init);
      if (!lost && (init.method || 'GET') === 'PUT' && url.includes('/api/children/' + CHILD + '/')) { lost = true; return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({ error: 'forced' }) }; }
      return r;
    };
    try {
      await click('[data-set-go]');
      await until('document.querySelectorAll("[data-set-result]").length === 3', 'three results');
    } finally { acct.fetch = real; }
    ok(await ev('document.activeElement === document.querySelector("[data-set-results]")') && await ev('document.querySelector("[data-set-results]").getAttribute("role")') === 'status', 'focus on the results, a status');
    const res = await ev('[...document.querySelectorAll("[data-set-result]")].map((p) => p.innerText.replace(/\\s+/g, " ").trim())');
    ok(res.includes('Set for Ada.') && res.includes('Set for Kofi.') && res.some((r) => /^Not set for Robin yet\.\s*Try again$/.test(r)), 'one result each: ' + JSON.stringify(res));
    const fromList = (k) => W.liveGroups(kidsWords(k)).filter((g) => g.name === 'Autumn 2 spellings');
    const robinFirst = fromList(CHILD);
    ok(robinFirst.length === 1 && robinFirst[0].test === test && robinFirst[0].words.length === 10, 'Robin\'s week was stored once: ' + JSON.stringify(robinFirst.map((g) => [g.id, g.test, g.words.length])));
    await click('[data-set-retry="' + CHILD + '"]');
    await until('/^Set for Robin\\./.test(document.querySelector("[data-set-result=\\"' + CHILD + '\\"]").innerText)', 'Robin set');
    await sleep(300);
    const robinAfter = fromList(CHILD);
    ok(robinAfter.length === 1 && robinAfter[0].id === robinFirst[0].id, 'the retry made no second week: ' + JSON.stringify(robinAfter.map((g) => g.id)));
    step('every ticked child has one week with the chosen words, name and date; one id each; Wren is untouched');
    const ids = [];
    for (const k of [CHILD, K3, K4]) {
      const g = fromList(k);
      ok(g.length === 1 && g[0].test === test && g[0].words.join() === WORDS.slice(0, 10).join(), NAMES[KIDS.findIndex((x) => x.id === k)] + ' has the week: ' + JSON.stringify(g));
      ids.push(g[0].id);
    }
    ok(new Set(ids).size === 3, 'three different week ids: ' + ids);
    ok(W.liveGroups(kidsWords(K3)).length === 2, 'Ada keeps her other week, and has the new one');
    ok(W.liveGroups(kidsWords(CHILD2)).length === 1 && W.liveGroups(kidsWords(CHILD2))[0].id === 'gw', 'Wren was not ticked and is unchanged');
    ok(/Test on \w{3} \d{1,2} \w{3}/.test(await cell(CHILD, 'This week\'s test')), 'part A shows the new week: ' + await cell(CHILD, 'This week\'s test'));
    ok(await ev('document.activeElement === document.querySelector("[data-set-results]")'), 'focus stays in the results after Try again');
    ok(put() >= 4, 'it did write');
    step('after saving, the children who now have the week are unticked; pressing Set again makes no second week');
    const after = await ev('[...document.querySelectorAll("[data-kid]")].map((b) => b.checked)');
    ok(after.every((t) => t === false), 'everyone with a week from this list is unticked now: ' + after);
    ok(/already has a week from this list/.test(await text('[data-set]')), 'the line shows after saving');
    ok(await ev('document.querySelector("[data-set-go]").disabled') && await text('[data-why]') === 'All of these children already have a week from this list.' && await text('[data-set-go]') === 'Set the test', 'Set is off, plain, and says why (never 0 children, never Tick at least one child)');
    ok(await text('[data-set-summary]') === 'Week set for Ada, Kofi and Robin.', 'a plain success line: ' + await text('[data-set-summary]'));
    await ev('document.querySelectorAll("[data-kid]").forEach((b) => { if (!b.checked) b.click(); })'); // the teacher ticks them all again
    await click('[data-set-go]');
    await until('document.querySelectorAll("[data-set-result][data-ok]").length >= 3', 'saved again');
    await sleep(300);
    for (const k of [CHILD, K3, K4]) ok(fromList(k).length === 1 && fromList(k)[0].id === ids[[CHILD, K3, K4].indexOf(k)], 'still one week from the list, same id, for ' + k + ': ' + fromList(k).length);
    ok(/^Week set for /.test(await text('[data-set-summary]')) && await text('[data-set-go]') === 'Set the test' && await ev('document.querySelector("[data-set-go]").disabled') && await text('[data-why]') === 'All of these children already have a week from this list.', 'a success line, a plain disabled button with its reason: ' + await text('[data-set-go]') + ' / ' + await text('[data-why]'));
    await shot('teach-set-results-1180');
  }));

  scene('SB4-WP11 Set the test: a short list needs no picking; a child whose save fails shows its own Try again, the others are set', withScene(async () => {
    await width(390, 844);
    const own = Ow.set({}, OID, { name: 'Six words', words: WORDS.slice(0, 6), src: 'typed', to: [CHILD, CHILD2] }, NOW - 1000).own;
    const docs = { [CHILD]: { words: W.withSetup(W.emptyDoc(), ownCopy(own, OID)), progress: PR.emptyDoc() }, [CHILD2]: { words: W.withSetup(W.emptyDoc(), ownCopy(own, OID)), progress: PR.emptyDoc() } };
    await asAdult({ own, docs, kids: KIDS.slice(0, 2), hash: chapterHash() });
    await until(isChapter, 'the page');
    ok(!await has('[data-pickword]') && !await has('[data-pickline]'), 'six words: no Pick 10');
    ok(await text('[data-set-go]') === 'Set the test for 2 children', 'two children');
    await ev('document.querySelector("[data-kid][value=\\"' + CHILD2 + '\\"]").click()');
    ok(await text('[data-set-go]') === 'Set the test for 1 child', 'one child: ' + await text('[data-set-go]'));
    await ev('document.querySelector("[data-kid][value=\\"' + CHILD2 + '\\"]").click()');
    acct.failNext = { status: 404, times: 1 }; // the first call, Robin's, is refused
    await click('[data-set-go]');
    await until('document.querySelectorAll("[data-set-result]").length === 2', 'two results');
    const res = await ev('[...document.querySelectorAll("[data-set-result]")].map((p) => p.innerText.replace(/\\s+/g, " ").trim())');
    ok(res.join() === 'Not set for Robin yet. Try again,Set for Wren.', 'Robin did not work, Wren did: ' + JSON.stringify(res));
    ok(W.liveGroups(kidsWords(CHILD)).length === 0 && W.liveGroups(kidsWords(CHILD2)).length === 1, 'Wren has her week, Robin has none yet');
    await click('[data-set-retry="' + CHILD + '"]');
    await until('/^Set for Robin\\./.test(document.querySelector("[data-set-result=\\"' + CHILD + '\\"]").innerText)', 'Robin set on the retry');
    await sleep(200);
    ok(W.liveGroups(kidsWords(CHILD)).length === 1 && W.liveGroups(kidsWords(CHILD2)).length === 1, 'one week each');
    await layout('teach-set', [320, 390]);
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
    ok(!await visible('[data-set]') && !await visible('[data-print-all]') && !await visible('.t-actions') && !await visible('[data-resend]'), 'the Set card and every button are hidden on paper');
    ok(await ev('getComputedStyle(document.querySelector("[data-each-table] tr[data-cid]")).display') === 'block' && await ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), 'stacked for each child, no sideways overflow on A4');
    ok(await ev('[...document.querySelectorAll("[data-each-table] td")].every((td) => getComputedStyle(td).overflowWrap !== "anywhere")'), 'no mid-word breaks');
    await shot('teach-print-all-a4');
    await media('');
    await width(1180, 900);
    step('one child');
    await ev('document.querySelector("[data-print-one]").focus()');
    await click('[data-print-one]');
    await until('document.querySelector("[data-dialog]")', 'the dialog');
    ok(await ev('document.querySelector("[data-dialog]").getAttribute("aria-describedby")') === 't-onedesc' && await ev('document.activeElement.name') === 't-kid', 'described by its line; focus on the first child');
    ok(await text('[data-onedesc]') === 'Only Robin’s results will print or copy. Use this when you share with one family.', 'the line: ' + await text('[data-onedesc]'));
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
    ok(await ev('[...document.querySelectorAll("[data-cid]")].filter((r) => getComputedStyle(r).display !== "none").length') === 1, 'one child\'s row is visible');
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
    await until('document.querySelector("[data-teachlink]")', 'the grown-ups home');
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
    ok(!await has('[data-each-table]') && !await has('[data-set]'), 'no table and no Set card');
    await click('[data-resend-all]');
    await until('document.querySelector("[data-each-table]")', 'sent: the table appears');
    ok(Object.keys(kidsWords(CHILD).setup.own || {}).join() === OID, 'Try again sent the list');
    // shared with nobody
    await asAdult({ own: lists({ a: false, b: false, c: true }), hash: chapterHash(OID3) });
    await until('document.querySelector("[data-shared-none]")', 'shared with nobody');
    ok(/Not shared yet\./.test(await text('[data-shared-none]')) && /Share this list with up to 5 children to see how they get on\./.test(await text('[data-shared-none]')), 'the lines');
    ok(await ev('document.querySelector("[data-shared-none] a").getAttribute("href")') === '#/grownups/own/' + OID3, 'Share it goes to the editor');
    // gone: an id that is not there, and a bad address
    for (const h of [chapterHash('nothere'), chapterHash('bad%'), chapterHash('a'.repeat(60))]) {
      await go(h);
      await until('document.querySelector("[data-gone]")', 'gone at ' + h);
      ok(/That list isn't here any more\./.test(await text('[data-gone]')) && /Back to For teachers/.test(await text('[data-gone] a')) && await ev('document.querySelector("[data-gone] a").getAttribute("href")') === '#/grownups/teach', 'gone: ' + h);
    }
    // a deleted list
    const gone = { ...lists({ b: false }) };
    gone[OID] = { ...gone[OID], gone: NOW - 1000, at: NOW };
    await asAdult({ own: gone, hash: chapterHash() });
    await until('document.querySelector("[data-gone]")', 'a deleted list');
    // offline on opening
    await asAdult({ hash: HOME_HASH });
    await ev('Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false })');
    try {
      await go(chapterHash());
      await until('document.querySelector("[data-teach-offline]")', 'the offline card');
      ok(/You're offline\. You can see results when you're back online\./.test(await text()) && await has('[data-retry]'), 'offline line and Try again');
      await go(HOME_HASH);
      await until('document.querySelector("[data-teach-offline]")', 'offline on the home too');
    } finally { await ev('delete navigator.onLine'); }
    // one child's data could not be read: that card says so, the others still draw
    await asAdult({ hash: HOME_HASH });
    const real = acct.fetch;
    acct.fetch = async (url, init = {}) => (url.includes('/api/children/' + K3 + '/game/') ? { ok: false, status: 404, headers: { get: () => null }, json: async () => ({ error: 'forced' }) } : real(url, init));
    try {
      await go(chapterHash());
      await until(isChapter, 'the table');
      const row = await ev('(document.querySelector("tr[data-cid=\\"' + K3 + '\\"]") || {}).innerText || ""');
      ok(/Something went wrong on our side\. Please try again\./.test(row) && /Try again/.test(row), 'Ada\'s card says so: ' + row);
      ok(/Passed/.test(await cell(CHILD, 'Stage')), 'the other cards still draw');
    } finally { acct.fetch = real; }
    // the account says signed out: the usual line, no table
    await asAdult({ hash: HOME_HASH });
    H.allowLog(/status of 401/); // the signed-out step asks for it
    acct.failNext = { status: 401, times: 1 };
    acct.calls.length = 0;
    await go(chapterHash());
    await until('document.querySelector("[data-teach-problem]")', 'a problem page');
    ok(await has('[data-retry]') && /signed out/i.test(await text('[data-teach-problem]')), 'signed out: the usual line and Try again: ' + await text('[data-teach-problem]'));
    await until('true', 'settled'); await sleep(300);
    ok(acct.calls.some((c) => c.path === '/api/me'), 'the account was asked who is signed in again');
  }));

  scene('SB4-WP11 the Menu has eight rows and For teachers opens the page with focus on the h1; a child and an adult playing as a child get no data', withScene(async () => {
    for (const w of [1280, 390]) {
      await width(w, w === 390 ? 844 : 800);
      await asAdult({ hash: '#/grownups', wait: 'document.querySelector("[data-teachlink]")' });
      await until('document.querySelector("[data-teachlink]")', 'the grown-ups home');
      ok(/For teachers and tutors/.test(await text('[data-teachlink]')) && await ev('document.querySelector("[data-teachlink]").getAttribute("href")') === '#/grownups/teach', 'the quiet link on the home at ' + w);
      ok(await ev('document.querySelector("[data-teachlink]").getBoundingClientRect().height') >= 44, 'the link is 44 px high');
      await click('#adult-menu-btn');
      await until('!document.querySelector("#adult-menu-panel").hidden', 'the Menu');
      const rows = await ev('[...document.querySelectorAll("#adult-menu-panel nav ul a")].map((a) => ({ t: a.querySelector("b").textContent, h: a.getAttribute("href"), tall: a.getBoundingClientRect().height, sub: a.querySelector("span.adultrow__text > span").textContent }))');
      ok(rows.length === 8 && rows[4].t === 'For teachers' && rows[4].sub === 'One list for up to 5 children' && rows[4].h === '#/grownups/teach', 'eight rows, For teachers after Your own chapters: ' + JSON.stringify(rows.map((r) => r.t)));
      ok(rows.every((r) => r.tall >= 48), 'each row 48 px or more');
      if (w === 390) await shot('teach-menu-390');
      await click('#adult-menu-panel a[href="#/grownups/teach"]');
      await until('location.hash === "#/grownups/teach" && document.querySelector("[data-help-table]")', 'the teacher page');
      ok(await ev('document.activeElement === document.querySelector("main h1")'), 'focus goes to the h1 at ' + w);
    }
    step('a child');
    await H.seedChild(W.emptyDoc(), DAY);
    acct.calls.length = 0;
    for (const h of ['#/grownups/teach', chapterHash()]) {
      await open(DAY, h);
      await until('document.querySelector("[data-notforyou]")', 'refused at ' + h);
    }
    acct.who = { ...adultMe, playingAs: { id: CHILD, nickname: 'Robin', year: 4, avatar: null } };
    await open(DAY, '#/grownups/teach');
    await until('document.querySelector("[data-playing]")', 'the switch-back card');
    ok(await has('[data-switchback]'), 'Switch back to myself');
    ok(!acct.calls.some((c) => c.path.startsWith('/api/children')), 'nothing under /api/children was asked for');
    step('the shared pages that mention it');
    await asAdult({ hash: '#/grownups/own', wait: 'document.querySelector("[data-own]")' });
    await until('document.querySelector("[data-own]")', 'the list page');
    ok(await ev('document.querySelectorAll("[data-teach-link]").length') === 2 && await ev('document.querySelector("[data-teach-link]").getAttribute("href")').then((h) => /^#\/grownups\/teach\/teach[12]$/.test(h)), 'See results on each shared card');
    await open(DAY, '#/about');
    ok(/Teachers and tutors: a grown-up's account can hold up to 5 children\. Make one list, share it with them, and see each child's results on one page\./.test(await text()), 'the About sentence');
  }));
}
