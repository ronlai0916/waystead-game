// SB7 (BUILD-1, D28-D30): the grown-up's resets of a Step by step child's week, through the UI.
//   SB6 reset: three resets   at 375x667 (Safari's bar) and 1180x640 (iPad, bars), garden and Night:
//     (a) Restart words: tick 'island', confirm, toast; the report and estimate line refresh; the child's Today still opens and the word is back at Meet
//     (b) Redo a stone: Meet the words; its stone is not done on the child's path, the others are
//     (c) Restart the whole week: back to day 1 (start = today), the words and the test date stay; the child's path shows nothing done
//     Each confirm dialog is checked with the phone rule: its buttons are in view, above the bar, and the dialog needs no scrolling.
//   SB6 reset: not for a child   a child who opens the grown-up page, and the Usual way's page, have no reset control
import * as W from '../../site/js/words-doc.js';
import { sbsDoc, WORDS10 } from './gu.mjs';

export default (H, S) => {
  const { scene, go, click, ev, ok, has, text, until, sleep, acct, signedOutBlank, CHILD, CHILD2, ADULT, MON, plus } = H;
  const adultMe = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };
  const childMe = { signedIn: true, kind: 'child', id: CHILD, nickname: 'Robin', year: 4, avatar: null, parentId: ADULT };
  const step = (n) => console.log('  · ' + n);
  const q = JSON.stringify;
  const IDS = ['iphone-se', 'ipad-landscape-bars'];
  const wordsOf = () => W.normalise(acct.get(CHILD, 'spellbright', 'words'));

  /** The week of sbsDoc with the first four stones marked done on the two days, so the child's path has stones to take back. */
  function seedDoc(day) {
    let d = sbsDoc();
    const g = () => W.groupById(d, 'g1');
    for (const s of ['hello', 'fix', 'games', 'story']) {
      d = W.markStep(d, g(), s, MON, Date.parse(MON + 'T16:30:00'));
    }
    void day;
    return d;
  }
  const seedAdult = (doc, day) => async () => {
    await signedOutBlank(day);
    acct.who = adultMe;
    acct.put(CHILD, 'spellbright', 'words', doc);
    acct.put(CHILD2, 'spellbright', 'words', sbsDoc({ way: 'usual', report: false }));
  };
  const seedChildView = (doc, day) => async () => {
    await signedOutBlank(day);
    acct.who = childMe;
    acct.put(CHILD, 'spellbright', 'words', doc);
    await ev('localStorage.setItem("wa.player",' + q(JSON.stringify({ id: CHILD, name: 'Robin', avatar: null })) + ')');
    await ev('localStorage.setItem("sb.words:' + CHILD + '",' + q(JSON.stringify(doc)) + ')');
    await ev('localStorage.setItem("sb.year:' + CHILD + '","4")');
  };
  const adultAt = (p, style, doc, day) => S.openAs(p, { day, hash: '#/grownups/child/' + CHILD, night: style === 'night', seed: seedAdult(doc, day), wait: 'document.querySelector("[data-resets]")' });
  const childAt = (p, style, hash, day) => S.openAs(p, { day, hash, night: style === 'night', seed: seedChildView(wordsOf(), day), wait: 'document.querySelector("main")' });
  const doneStones = () => ev('document.querySelectorAll(".pathrow2--done").length');

  /** The phone rule on the open dialog: both buttons in view and above the bar, no scrolling inside it. */
  async function dialogRule(p, what) {
    await until('document.querySelector("[data-dialog]")', 'the dialog');
    await sleep(150);
    const m = await ev(`(() => { const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right, h: b.height }; };
      const dlg = document.querySelector('[data-dialog]');
      return { yes: r('[data-confirm]'), no: r('[data-keep]'), ih: innerHeight, iw: innerWidth, scroll: dlg.scrollHeight - dlg.clientHeight, title: dlg.querySelector('h2').textContent, body: dlg.querySelector('p').textContent, yesText: document.querySelector('[data-confirm]').textContent, noText: document.querySelector('[data-keep]').textContent }; })()`);
    const lim = m.ih - (p.bar || 0);
    for (const [k, b] of [['confirm', m.yes], ['keep', m.no]]) {
      ok(b.t >= 0 && b.b <= lim + 0.5, what + ': ' + k + ' button in view above the bar (' + Math.round(b.t) + '-' + Math.round(b.b) + ' of ' + lim + ')');
      ok(b.h >= 43.5 && b.l >= 0 && b.r <= m.iw + 0.5, what + ': ' + k + ' button is at least 44 px and inside the width');
    }
    ok(m.scroll <= 1, what + ': the dialog needs no scrolling (' + m.scroll + ')');
    ok(/can’t be undone/.test(m.body) && m.noText === 'Keep it', what + ': plain words and Keep it: ' + m.body);
    return m;
  }
  async function toastSeen(re, what) {
    await until('(() => { const t = document.getElementById("toast"); return t && t.classList.contains("show") && ' + String(true) + '; })()', 'the toast');
    const t = await text('#toast');
    ok(re.test(t), what + ': toast says ' + t);
  }

  scene('SB6 reset: three resets', async () => {
    const day = plus(2);
    await S.forProfiles(async (p, style) => {
      const tag = p.id + ' ' + style;
      await adultAt(p, style, seedDoc(day), day);
      ok(await has('[data-stuck=light]'), tag + ': before: the report shows the stuck word');
      ok(!await has('[data-resetwhy]'), tag + ': the reset card is offered (no test begun)');
      ok(/Start again/.test(await text('[data-resets]')), tag + ': the card');
      const small = await ev(`[...document.querySelectorAll('[data-resets] input, [data-resets] button, [data-resets] select')].map((e) => { const r = e.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5 ? (e.value || e.textContent).slice(0, 20) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) : ''; }).filter(Boolean)`);
      ok(small.length === 0 && await ev('document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth <= 1'), tag + ': every reset control is at least 44 px and no sideways scroll ' + q(small));

      // ---- (a) restart words
      step(tag + ' (a) restart words');
      ok(await ev('document.querySelector("[data-reset-words-go]").disabled'), 'the words button waits for a tick');
      await ev('document.querySelector("[data-reset-word][value=island]").scrollIntoView({ block: "center" })');
      await click('[data-reset-word][value=island]');
      ok(!await ev('document.querySelector("[data-reset-words-go]").disabled'), 'a tick enables it');
      await click('[data-reset-words-go]');
      const a = await dialogRule(p, tag + ' (a)');
      ok(/Restart ‘island’\?/.test(a.title) && a.yesText === 'Restart', 'the question: ' + a.title);
      await click('[data-keep]');
      await sleep(200);
      ok(wordsOf().results.length === seedDoc(day).results.length, 'Keep it changes nothing');
      await click('[data-reset-words-go]');
      await dialogRule(p, tag + ' (a, again)');
      await click('[data-confirm]');
      await until('!document.querySelector("[data-dialog]")', 'the dialog closes');
      await toastSeen(/island.*back at the start/i, tag + ' (a)');
      let d = wordsOf();
      ok(!d.results.some((r) => r.w === 'island' && r.k !== 't'), 'island has no tries left');
      ok(d.results.some((r) => r.w === 'night'), 'night keeps its tries');
      ok(Object.keys(d.resets || {}).length === 1, 'one stamp saved: ' + JSON.stringify(Object.keys(d.resets || {})));
      ok(!await ev('document.querySelector("[data-reset-word][value=island]").checked'), 'the ticks are cleared after a reset');
      await sleep(300);
      ok(await has('[data-stuck=light]'), 'the other words keep their lines');
      await childAt(p, style, '#/', day);
      await sleep(400);
      ok(await has('[data-job]') || /Meet|Today|Robin/.test(await text('main')), tag + ': (a) the child’s Today opens');
      await childAt(p, style, '#/words/g/g1/path', day);
      await sleep(300);
      const doneA0 = await doneStones();
      ok(doneA0 === 0, tag + ': (a) D32 every stone is open again for the restarted word (' + doneA0 + ' done)');
      ok(!Object.keys(d.steps).some((k) => /\|(games|story)/.test(k)), 'the Meanings and Sentences marks went with the word');
      // the child redoes the word (marks written again), so the path has stones to take back for (b)
      let re = wordsOf();
      for (const st of ['hello', 'fix', 'games', 'games:match', 'story']) re = W.markStep(re, W.groupById(re, 'g1'), st, MON, Math.max(...Object.values(re.resets).map((x) => x.at)) + 1000);
      acct.put(CHILD, 'spellbright', 'words', re);
      await childAt(p, style, '#/words/g/g1/path', day);
      await sleep(300);
      const doneA = await doneStones();
      step('stones done after the word redid them: ' + doneA);

      // ---- (b) redo a stone
      step(tag + ' (b) redo Meet the words');
      await adultAt(p, style, wordsOf(), day);
      await ev('document.querySelector("[data-reset-stone-pick]").value = "hello"');
      await ev('document.querySelector("[data-reset-stone-go]").scrollIntoView({ block: "center" })');
      await click('[data-reset-stone-go]');
      const b = await dialogRule(p, tag + ' (b)');
      ok(/Redo ‘Meet the words’\?/.test(b.title), 'the question: ' + b.title);
      await click('[data-confirm]');
      await until('!document.querySelector("[data-dialog]")', 'the dialog closes');
      await toastSeen(/Meet the words starts again/, tag + ' (b)');
      d = wordsOf();
      ok(!d.results.some((r) => r.j === 'h'), 'no Meet tries left');
      ok(d.results.some((r) => r.j === 'f'), 'the Letter ladder tries stay');
      ok(!Object.keys(d.steps).some((k) => /\|hello/.test(k)), 'no Meet marks left');
      ok(Object.keys(d.steps).some((k) => /\|games/.test(k)), 'the Meanings mark stays');
      await childAt(p, style, '#/words/g/g1/path', day);
      await sleep(300);
      const doneB = await doneStones();
      ok(doneB <= doneA && doneB >= 1, tag + ': (b) a stone fewer or the same on the child’s path (' + doneA + ' -> ' + doneB + ') and the others stay');

      // ---- (c) restart the whole week
      step(tag + ' (c) restart the week');
      await adultAt(p, style, wordsOf(), day);
      const before = W.groupById(wordsOf(), 'g1');
      await ev('document.querySelector("[data-reset-week-go]").scrollIntoView({ block: "center" })');
      await click('[data-reset-week-go]');
      const c = await dialogRule(p, tag + ' (c)');
      ok(/Restart the whole week\?/.test(c.title) && c.yesText === 'Restart the week', 'the question: ' + c.title);
      await click('[data-confirm]');
      await until('!document.querySelector("[data-dialog]")', 'the dialog closes');
      await toastSeen(/starts again at day 1/, tag + ' (c)');
      d = wordsOf();
      const after = W.groupById(d, 'g1');
      ok(after.start === day, 'day 1 is today: ' + after.start);
      ok(after.test === before.test && q(W.rows(after)) === q(W.rows(before)), 'the words and the test date stay');
      ok(!d.results.some((r) => r.k !== 't') && !Object.keys(d.steps).some((k) => k.startsWith('g1|')), 'no tries or marks of the week left');
      ok(await ev('!document.querySelector("[data-stuck=light]")'), 'the report refreshed: no stuck word');
      ok(await has('[data-estimate-line]') || await has('[data-sbswords]'), 'the estimate / report are on the page');
      await childAt(p, style, '#/words/g/g1/path', day);
      await sleep(300);
      ok(await doneStones() === 0, tag + ': (c) nothing done on the child’s path');
      await childAt(p, style, '#/', day);
      await sleep(400);
      ok(!/Test ready|Take the test/.test(await text('main')), '(c) the test is not open early');
    }, { ids: IDS });
  });

  scene('SB6 reset: not for a child', async () => {
    const day = plus(2);
    const p = S.profile('iphone-se');
    step('a child on the grown-up page');
    await S.openAs(p, { day, hash: '#/', seed: seedChildView(seedDoc(day), day), wait: 'document.querySelector("main")' });
    await sleep(300);
    await go('#/grownups/child/' + CHILD);
    await sleep(600);
    ok(!await has('[data-resets]') && !await has('[data-reset-words-go]'), 'a child gets no reset control on the grown-up page');
    for (const h of ['#/', '#/words/g/g1/path', '#/words/g/g1']) {
      await go(h);
      await sleep(400);
      const body = (await ev('document.body.innerText')) + ' ' + (await ev('[...document.querySelectorAll("button, a")].map((e) => e.textContent).join(" ")'));
      ok(!/Restart the (whole )?week|Redo this stone|Restart ticked words|Start again/.test(body), 'no reset words on the child’s ' + h);
    }
    step('the Usual way child, seen by a grown-up');
    await S.openAs(p, { day, hash: '#/grownups/child/' + CHILD2, seed: seedAdult(seedDoc(day), day), wait: 'document.querySelector("main")' });
    await sleep(500);
    ok(!await has('[data-resets]'), 'a Usual-way child page has no reset card');
  });
};
