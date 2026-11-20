// SB4-WP7: a grown-up's own chapters, typed. Loaded by tools/sb2-smoke.mjs with the harness H.
import * as Su from '../../site/js/setup-doc.js';
import * as Ow from '../../site/js/own-doc.js';

export default function (H) {
  const { scene, go, click, ev, ok, has, text, until, keys, sleep, width, open, acct, W, MON, plus, CHILD, CHILD2, ADULT, shot } = H;
  const step = (n) => console.log('  · ' + n);
  const q = (s) => JSON.stringify(s);
  const DAY = plus(2);
  const NOW = Date.parse(DAY + 'T10:00:00');
  const adultMe = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };
  const childMe = { signedIn: true, kind: 'child', id: CHILD, nickname: 'Robin', year: 4, avatar: null, parentId: ADULT };
  const SIX = ['build', 'earth', 'fruit', 'heart', 'island', 'because'];
  const OID = 'rown1';
  const BANNED = /\b(wrong|fail|failed|incorrect|mistake|late|lost|error)\b|×/i;
  const kidsWords = (k) => W.normalise(acct.get(k, 'spellbright', 'words'));
  const adultLocal = async () => W.normalise(JSON.parse((await ev('localStorage.getItem("sb.words:' + ADULT + '")')) || 'null'));
  const noSideways = () => ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth');
  const progLocal = async () => JSON.parse((await ev('localStorage.getItem("sb.progress:' + CHILD + '")')) || 'null') || { chapters: {}, results: [] };

  /** The grown-up signed in, with a saved chapter (master and both copies) unless `made` is false. */
  async function asAdult({ made = true, words = SIX, to = [CHILD, CHILD2], hash = '#/grownups/own', keepMaster = true, extra = (d) => d } = {}) {
    await H.signedOutBlank(DAY);
    acct.who = adultMe;
    if (made) {
      const own = Ow.set({}, OID, { name: 'Spring spellings', words, src: 'typed', to }, NOW).own;
      if (keepMaster) await ev('localStorage.setItem("sb.words:' + ADULT + '",' + q(JSON.stringify(W.withOwn(W.emptyDoc(), own))) + ')');
      for (const k of [CHILD, CHILD2]) {
        const setup = to.includes(k) ? Su.setOwnCopy({}, OID, { name: 'Spring spellings', words, src: 'typed' }, own[OID].at).setup : {};
        acct.put(k, 'spellbright', 'words', extra(W.withSetup(W.emptyDoc(), setup)));
      }
    } else for (const k of [CHILD, CHILD2]) acct.put(k, 'spellbright', 'words', W.emptyDoc());
    await open(DAY, hash);
  }
  const typeIn = async (v) => {
    await ev('(()=>{const n=document.querySelector("[data-typed]");n.value=' + q(v) + ';n.dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("[data-typeform]").requestSubmit()})()');
    await sleep(500);
  };
  /** The child, with the grown-up's chapter on their device. */
  async function asChild({ doc = null, prog = null, hash = '#/chapters', day = DAY } = {}) {
    await H.signedOutBlank(day);
    acct.who = childMe;
    await ev('localStorage.setItem("wa.player",' + q(JSON.stringify({ id: CHILD, name: 'Robin', avatar: null })) + ')');
    const d = doc || W.withSetup(W.emptyDoc(), Su.setOwnCopy({}, OID, { name: 'Spring spellings', words: SIX, src: 'typed' }, NOW).setup);
    await ev('localStorage.setItem("sb.words:' + CHILD + '",' + q(JSON.stringify(d)) + ')');
    if (prog) await ev('localStorage.setItem("sb.progress:' + CHILD + '",' + q(JSON.stringify(prog)) + ')');
    await open(day, hash);
  }
  // ---- driving a keyboard run: the word is read from what the page asked to be said ----
  const heard = async () => {
    const probe = `(() => { const s = new Set(${q(SIX)}); return [...globalThis.__said, ...globalThis.__lines.map((l) => l.toLowerCase())].reverse().find((x) => s.has(x)) || ''; })()`;
    await until(probe + ' !== ""', 'the word spoken');
    return ev(probe);
  };
  const screenNow = () => ev('(document.querySelector("[data-assess]") || {}).dataset ? document.querySelector("[data-assess]").dataset.assess : ""');
  async function drive() {
    let last = 0;
    for (let guard = 0; guard < 120; guard += 1) {
      await until('document.querySelector("[data-assess]")', 'a screen', 9000);
      const s = await screenNow();
      if (s === 'rest') { await click('[data-carry]'); continue; }
      if (s === 'fb') { await click('[data-next]'); continue; }
      if (s !== 'word') break;
      const no = await ev('Number(document.querySelector("[data-assess=word]").dataset.wordNo || 0)');
      if (no === last) { await sleep(40); continue; }
      last = no;
      const w = await heard();
      await ev('(() => { globalThis.__said.length = 0; globalThis.__lines.length = 0; })()');
      const typed = await text('[data-answer]');
      await keys(w.slice(typed.length));
      await click('[data-next]');
      await sleep(40);
    }
  }

  // SB5 (TR-45): the list editor. Word by word (find box, Add word) or "Type or paste all" (one textarea, one word a line); "Give for practice"
  // ticks the children; Save list opens a saved page with "Set a week with this list". Chapters are now lists.
  scene('SB4-WP7 a grown-up makes a six-word chapter from one pasted list and shares it with two children', async () => {
    await width(1280, 900);
    await asAdult({ made: false, hash: '#/grownups/own/new' });
    await until('document.querySelector("[data-own-editor]")', 'the editor');
    ok(/^School words, \d{1,2} [A-Z][a-z]{2}$/.test(await ev('document.querySelector("[data-name]").value')), 'the default name: ' + await ev('document.querySelector("[data-name]").value'));
    ok(await ev('document.querySelectorAll("[data-share]").length') === 2 && !await ev('document.querySelector("[data-share]").checked'), 'two children, none ticked yet');
    await ev('(()=>{const n=document.querySelector("[data-name]");n.value="Spring spellings";n.dispatchEvent(new Event("input"))})()');
    step('Type or paste all: a list with list numbers, a tab and line breaks');
    await click('[data-act=tab][data-tab=paste]');
    await until('document.querySelector("[data-paste]")', 'the paste box');
    await ev('(()=>{const n=document.querySelector("[data-paste]");n.value="1. build\\r\\n2. earth\\nfruit\\theart\\r\\nisland\\r\\n3) because\\r\\n";n.dispatchEvent(new Event("input",{bubbles:true}))})()');
    await click('[data-act=tab][data-tab=word]');
    await until('document.querySelectorAll("[data-ownwords] [data-word]").length === 6', 'six rows from the paste');
    ok(/^6 words · a week takes 10$/.test(await text('[data-count]')), 'the count: ' + await text('[data-count]'));
    ok(/Ready-made/.test(await text('[data-word="build"]')), 'a ready-made word says so: ' + await text('[data-word="build"]'));
    ok(await ev('document.querySelector("[data-word=\\"island\\"] [data-act=remove]").getAttribute("aria-label")') === "Remove 'island'", 'the Remove label');
    const r = await ev('(() => { const b = document.querySelector("[data-word=\\"island\\"] [data-act=remove]").getBoundingClientRect(); return [b.width, b.height]; })()');
    ok(r[0] >= 44 && r[1] >= 44, 'Remove is at least 44 x 44: ' + r);
    await click('[data-word="because"] [data-act=remove]');
    ok(await ev('document.activeElement && document.activeElement.dataset.act === "remove"'), 'after Remove, focus is on the next Remove');
    await typeIn('because');
    await until('document.querySelectorAll("[data-ownwords] [data-word]").length === 6', 'six rows again');
    await ev('document.querySelectorAll("[data-share]").forEach((b) => { if (!b.checked) b.click(); })');
    await shot('wp7-editor-1280');
    await click('[data-act=save]');
    await until('document.querySelector("[data-saved]")', 'the saved line');
    ok(await ev('document.activeElement === document.querySelector("[data-saved]")'), 'focus on the saved line');
    const line = await text('[data-saved]');
    ok(/^Saved\. Robin and Wren can find it under 'From your grown-up'\.$/.test(line), 'the saved line: ' + line);
    ok(await has('[data-set]') && /Set a week with this list/.test(await text('[data-set]')) && await has('[data-back-list]'), 'Set a week with this list, and Back to Word lists');
    await sleep(300);
    const own = (await adultLocal()).own;
    const [oid, m] = Object.entries(own)[0];
    ok(Object.keys(own).length === 1 && m.words.join() === SIX.join() && m.to.length === 2, 'the master: ' + JSON.stringify(own));
    for (const k of [CHILD, CHILD2]) ok(kidsWords(k).setup.own[oid].at === m.at && kidsWords(k).setup.own[oid].words.length === 6, 'the copy on ' + k + ' has the same at');
    await width(390, 844);
    ok(await noSideways(), 'no sideways scroll at 390');
    await shot('wp7-editor-390');
    step('the list page');
    await go('#/grownups/own');
    await until('document.querySelector("[data-own-list] [data-own], [data-own]")', 'the list');
    ok(/Given for practice to Robin and Wren/.test(await text('[data-shared]')), 'shared with: ' + await text('[data-shared]'));
  });

  scene('SB4-WP7 the child finds it, learns, practises, tests and quizzes; progress is kept under own-<oid>', async () => {
    await width(390, 844);
    await asChild();
    await until('document.querySelector("[data-own-head]")', 'the section');
    ok(/From your grown-up/.test(await text('[data-own-head]')) && /Spring spellings\s*6 words · /.test(await text('[data-own-chapter]')), 'SB5 Practice: the section and a tile with name and word count: ' + await text('[data-own-head]') + ' / ' + await text('[data-own-chapter]'));
    ok(/to do/i.test(await text('[data-own-chapter]')) && await ev('document.querySelector("[data-own-chapter]").dataset.state') === 'todo', 'the tile says to do');
    await shot('wp7-more-practice-390');
    await click('[data-own-chapter]');
    await until('document.querySelector("[data-chapterpage]")', 'the chapter page');
    ok(/Spring spellings/.test(await text('h1')) && await has('[data-primary="learn"]') && !await has('[data-next-chapter]'), 'the chapter page, no next chapter');
    ok(location_ok(await ev('location.hash')), 'the hash');
    await click('[data-primary="learn"]');
    await until('document.querySelector("[data-done]")', 'the study page');
    ok(await ev('document.querySelectorAll(".wordcard").length') === 6, 'six word cards');
    await click('[data-done]');
    await until('/\\/quick$/.test(location.hash)', 'the quick game');
    ok((await progLocal()).chapters['own-' + OID].studiedAt > 0, 'studied saved under own-<oid>');
    await go('#/words/own/' + OID + '/practice');
    await until('document.querySelector("main h1, main [data-assess]") && !/isn.t here/.test(document.querySelector("main").innerText)', 'practice opens');
    await go('#/words/own/' + OID + '/test');
    await until('document.querySelector("[data-assess=word]")', 'the test');
    await drive();
    await until('document.querySelector("[data-assess=end]")', 'the end');
    ok(/You passed!/.test(await text()) && !BANNED.test(await text()) && !await has('[data-next-chapter]') && !await has('[data-next-year]'), 'passed, gates nothing');
    const res = (await progLocal()).results.filter((x) => x.c === 'own-' + OID);
    ok(res.length === 1 && res[0].passed === true && res[0].s === 6, 'the result is under own-<oid>: ' + JSON.stringify(res));
    await go('#/words/own/' + OID + '/quiz');
    await until('document.querySelector("[data-assess=word]")', 'the quiz');
    await drive();
    await until('document.querySelector("[data-assess=end]")', 'the quiz end');
    ok((await progLocal()).results.some((x) => x.c === 'q:own-' + OID), 'a q:own-<oid> record');
    await go('#/chapters');
    await until('document.querySelector("[data-own-chapter]")', 'More practice again');
    ok(await ev('document.querySelector("[data-own-chapter]").dataset.state') === 'passed', 'the stone is passed');
    await go('#/words/own/' + OID + '/study/island');
    await until('document.querySelector("main h1, main .spell")', 'one word page');
    await go('#/words/own/nothere');
    await until('/isn.t here/.test(document.querySelector("main").innerText)', 'not found for a missing chapter');
  });
  const location_ok = (h) => h === '#/words/own/' + OID;

  scene('SB4-WP7 edit: remove one word, add one; same oid; the child keeps passed and studied', async () => {
    await width(1280, 900);
    const prog = { v: 1, resetAt: 0, chapters: { ['own-' + OID]: { studiedAt: NOW, practisedAt: NOW } }, results: [{ id: 'r1', c: 'own-' + OID, s: 6, t: 6, at: NOW, passed: true }], folded: {}, tricky: {} };
    await asAdult({ hash: '#/grownups/own/' + OID + '/edit' });
    acct.put(CHILD, 'spellbright', 'progress', prog);
    await open(DAY, '#/grownups/own/' + OID + '/edit');
    await until('document.querySelector("[data-started]")', 'the started line');
    ok(/^Robin has started this list\. Changes show next time Robin plays\.$/.test(await text('[data-started]')), await text('[data-started]'));
    await click('[data-word="island"] [data-act=remove]');
    await typeIn('quay');
    await until('document.querySelectorAll("[data-ownwords] [data-word]").length === 6', 'six rows again');
    ok(/^6 words/.test(await text('[data-count]')), 'six again: ' + await text('[data-count]'));
    await click('[data-act=save]');
    await until('document.querySelector("[data-saved]")', 'saved');
    await sleep(300);
    const own = (await adultLocal()).own;
    ok(Object.keys(own).join() === OID && own[OID].words.includes('quay') && !own[OID].words.includes('island'), 'same oid, words changed: ' + JSON.stringify(own));
    ok(kidsWords(CHILD).setup.own[OID].at === own[OID].at && kidsWords(CHILD2).setup.own[OID].words.includes('quay'), 'both copies follow');
    await asChild({ doc: kidsWords(CHILD), prog });
    await until('document.querySelector("[data-own-chapter]")', 'the child');
    ok(await ev('document.querySelector("[data-own-chapter]").dataset.state') === 'passed', 'still passed');
  });

  scene('SB4-WP7 delete and Undo; delete and restore from Deleted lists; the copies follow each time', async () => {
    await width(1280, 900);
    await asAdult({ hash: '#/grownups/own/' + OID + '/edit' });
    await until('document.querySelector("[data-act=delete]")', 'Delete list');
    await click('[data-act=delete]');
    await until('document.querySelector("[data-dialog]")', 'the sheet');
    ok(/^Delete this list\?[\s\S]*Weeks and results already set stay as they are\./.test(await text('[data-dialog]')), 'SB5 sheet: ' + await text('[data-dialog]'));
    await click('[data-act="no"]');
    ok(!await has('[data-dialog]'), 'Keep it closes it');
    await click('[data-act=delete]');
    await click('[data-act="yes"]');
    await until('document.querySelector("[data-undo-go]")', 'Undo');
    ok(kidsWords(CHILD).setup.own[OID].gone > 0, 'the child\'s copy is gone');
    await click('[data-undo-go]');
    await until('document.querySelector("[data-own=\\"' + OID + '\\"]")', 'back on the list');
    await sleep(300);
    ok(!kidsWords(CHILD).setup.own[OID].gone && !kidsWords(CHILD2).setup.own[OID].gone, 'copies are back');
    step('delete, then restore from Deleted lists');
    await go('#/grownups/own/' + OID + '/edit');
    await until('document.querySelector("[data-act=delete]")', 'the editor again');
    await click('[data-act=delete]');
    await click('[data-act="yes"]');
    await until('document.querySelector("[data-deleted] [data-restore]")', 'Deleted lists');
    ok(!await has('[data-own="' + OID + '"]'), 'gone from the list');
    await click('[data-restore]');
    await until('document.querySelector("[data-own=\\"' + OID + '\\"]")', 'restored');
    await sleep(300);
    ok(!kidsWords(CHILD2).setup.own[OID].gone, 'the copy follows the restore');
  });

  scene('SB4-WP7 words we cannot use, a repeat, and the 16th word', async () => {
    await width(390, 844);
    await asAdult({ made: false, hash: '#/grownups/own/new' });
    await until('document.querySelector("[data-own-editor]")', 'the editor');
    await typeIn('grlpx');
    await typeIn('arse');
    await typeIn("it's");
    const lines = await ev('[...document.querySelectorAll("[data-refused] .gu-ownword__s")].map((e) => e.firstChild.textContent)');
    ok(lines.length === 3 && lines.every((l) => l === "We can't use this word yet" || /^“[^”]+” doesn’t look right\.$/.test(l)), 'one kind line for all (S6: a near match reads "doesn\'t look right", any other the plain refusal): ' + lines);
    ok(/Names of people, places and months are not spelling words here/.test(await text('[data-refused] [data-why]')), 'S6: the reason, with what to do: ' + await text('[data-refused] [data-why]'));
    ok(await ev('document.querySelector("[data-refused]").classList.contains("is-refused")') && /^0 words/.test(await text('[data-count]')), 'greyed, not counted: ' + await text('[data-count]'));
    await typeIn('island');
    await typeIn('island');
    ok(/Already in the list/.test(await text('[data-repeat="island"]')) && /^1 word/.test(await text('[data-count]')), 'a repeat: ' + await text('[data-count]'));
    await typeIn('build, earth, fruit, heart, because, quay, lantern, friend, thought, tractor, busy, early, group, heard');
    ok(/^15 words/.test(await text('[data-count]')) && /^That's 15 words, the most a list can hold\./.test(await text('[data-full]')), 'the 15th: ' + await text('[data-count]') + ' / ' + await text('[data-full]'));
    ok(await ev('document.querySelector("[data-add]").disabled'), 'Add is disabled at 15');
    await shot('wp7-editor-full-390');
  });

  scene('S6 two words typed back to back are both taken (a tap during checking is queued, not dropped)', async () => {
    await width(390, 844);
    await asAdult({ made: false, hash: '#/grownups/own/new' });
    await until('document.querySelector("[data-own-editor]")', 'the editor');
    await ev('(()=>{const n=document.querySelector("[data-typed]");const f=document.querySelector("[data-typeform]");for (const v of ["garden","quiet"]) { n.value=v; n.dispatchEvent(new Event("input",{bubbles:true})); f.requestSubmit(); }})()');
    await until('/^2 words/.test(document.querySelector("[data-count]").textContent)', 'both words added');
    ok(await has('[data-word="garden"]') && await has('[data-word="quiet"]'), 'both words are in the list: ' + await text('[data-count]'));
  });

  scene('SB4-WP7 offline: the editor keeps the list on the phone; the child can still play a chapter already on the device', async () => {
    await asAdult({ made: false, hash: '#/grownups' });
    await until('document.querySelector("main h1")', 'the grown-ups home');
    acct.offline = true;
    await ev('Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false })');
    try {
      await go('#/grownups/own/new');
      await until('document.querySelector("[data-own-editor]")', 'the editor opens offline (SB5: a list can be made offline and is kept on the phone)');
      ok(/Save list keeps it on this phone/.test(await text('[data-bar]')), 'the line by Save list: ' + await text('[data-bar]'));
    } finally { acct.offline = false; await ev('delete navigator.onLine'); }
    await asChild({ hash: '#/words/own/' + OID });
    await until('document.querySelector("[data-chapterpage]")', 'the chapter');
    acct.offline = true;
    try {
      await go('#/words/own/' + OID + '/study');
      await until('document.querySelector("[data-done]")', 'the study page offline');
      ok(await ev('document.querySelectorAll(".wordcard").length') === 6, 'six word cards offline');
    } finally { acct.offline = false; }
  });

  scene('SB4-WP7 a child session gets the switch-back card and makes no change', async () => {
    await H.seedChild(W.emptyDoc(), DAY);
    acct.calls.length = 0;
    for (const p of ['#/grownups/own', '#/grownups/own/new', '#/grownups/own/' + OID]) {
      await open(DAY, p);
      await until('document.querySelector("[data-notforyou]")', 'refused at ' + p);
    }
    acct.who = { ...adultMe, playingAs: { id: CHILD, nickname: 'Robin', year: 4, avatar: null } };
    await open(DAY, '#/grownups/own');
    await until('document.querySelector("[data-playing]")', 'the switch-back card');
    ok(await has('[data-switchback]'), 'Switch back to myself');
    ok(!acct.calls.some((c) => c.path.startsWith('/api/children')), 'no PUT and no child data asked for (nothing under /api/children)');
  });

  // SB5: "Use for this week" is now "Set a week" on the list card; a list over ten words opens the trim page (a week holds 10).
  scene('SB4-WP7 Set a week with a 12-word list: a week holds 10, so the trim page comes first', async () => {
    await width(1280, 900);
    const twelve = ['build', 'earth', 'fruit', 'heart', 'island', 'because', 'quay', 'lantern', 'friend', 'thought', 'busy', 'early'];
    await asAdult({ words: twelve, to: [CHILD], hash: '#/grownups/own' });
    await until('document.querySelector("[data-set]")', 'Set a week');
    await click('[data-set]');
    await until('/#\\/grownups\\/set\\/list\\//.test(location.hash) && document.querySelector(".st-page")', 'the Set a week page');
    await sleep(300);
    const t = await text('main');
    ok(/12 words\. A week takes 10: you choose which 10/.test(t) && await has('[data-primary]') || /Choose which 10 words/.test(t), 'the page says 12 words, a week takes 10, choose which 10: ' + t.slice(0, 300));
    ok(await ev('sessionStorage.getItem("sb.planWords")') === null, 'no old hand-off left in the session');
  });

  scene('SB4-WP7 a week whose test is due and shares a word with the chapter shows the test card', async () => {
    const WEEK = ['fruit', 'zebra'];
    const d0 = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week one', test: plus(5), words: WEEK, today: MON, now: Date.parse(MON + 'T09:00:00') }).doc;
    const g = W.groupById(d0, 'g1');
    let d = ['hello', 'fix', 'games', 'story'].reduce((x, st) => W.markStep(x, g, st, plus(1), Date.parse(plus(1) + 'T09:00:00')), d0);
    W.rows(g).forEach((w, i) => { for (const h of [10, 11, 12]) d = W.addTry(d, { id: 'st' + i + h, word: w, day: plus(1), group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, now: Date.parse(plus(1) + 'T' + h + ':00:00') + i }); });
    d = W.withSetup(d, Su.setOwnCopy({}, OID, { name: 'Spring spellings', words: SIX, src: 'typed' }, NOW).setup);
    await asChild({ doc: d, hash: '#/words/own/' + OID + '/study', day: plus(5) });
    await until('document.querySelector("[data-testcard]")', 'the test card');
    ok(!/fruit/i.test(await text()), 'no word shown');
    await go('#/chapters');
    await until('document.querySelector("[data-own-chapter]")', 'More practice');
    ok(await has('[data-own-chapter][data-hidden]') && !await ev('document.querySelector("[data-own-chapter]").getAttribute("href")') && !/Made by your grown-up/.test(await text('[data-own-chapter]')), 'the card shows the name only');
  });

  scene('SB4-WP7 an older app dropped the grown-up\'s field: the list page brings the chapters back', async () => {
    await asAdult({ keepMaster: false, hash: '#/grownups' });
    await until('document.querySelector("main h1")', 'the home');
    ok(Object.keys((await adultLocal()).own || {}).length === 0, 'no master');
    await go('#/grownups/own');
    await until('document.querySelector("[data-own=\\"' + OID + '\\"]")', 'the chapter is back');
    const own = (await adultLocal()).own;
    ok(own[OID] && own[OID].to.length === 2 && own[OID].name === 'Spring spellings', 'adopted from the copies: ' + JSON.stringify(own));
  });
}
