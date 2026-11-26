// FIX-U1b scene S-gu-estimate: the Set a week and Change a week estimate for a Step-by-step child (follows words and date, calm line link), Save reachable, and the "See what <name> will see" preview. Registered in index.mjs (SCENE_FILES). Seeds through the fake account, as gu.mjs does.
import * as Su from '../../site/js/setup-doc.js';
import * as W from '../../site/js/words-doc.js';
import * as Ow from '../../site/js/own-doc.js';
import { WORDS10 } from './gu.mjs';

const OID = 'rfocus000001';
const NOW = Date.parse('2026-11-03T09:00:00');

export default (H, S) => {
  const { scene, click, ev, ok, has, text, until, sleep, acct, signedOutBlank, CHILD, CHILD2, ADULT, MON } = H;
  const adultMe = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };
  const IDS = ['iphone-se', 'ipad-landscape-bars'];
  const step = (n) => console.log('  · ' + n);
  const sbsSetup = () => Su.setWay({}, 'sbs', NOW, 'Sam').setup;
  const lc = (w) => String(w).toLowerCase();

  /** An adult with one Word list of ten words, Robin on Step by step and Wren on the Usual way, neither with a week yet. */
  const seed = (day) => async () => {
    await signedOutBlank(day);
    acct.who = adultMe;
    const own = Ow.set({}, OID, { name: 'Class 4 spellings', words: WORDS10, src: 'typed', to: [CHILD, CHILD2] }, NOW).own;
    const copy = Su.setOwnCopy({}, OID, { name: 'Class 4 spellings', words: WORDS10, src: 'typed' }, own[OID].at).setup;
    await ev('localStorage.setItem("sb.words:' + ADULT + '",' + JSON.stringify(JSON.stringify(W.withOwn(W.emptyDoc(), own))) + ')');
    acct.put(ADULT, 'spellbright', 'words', W.withOwn(W.emptyDoc(), own));
    acct.put(CHILD, 'spellbright', 'words', W.withSetup(W.emptyDoc(), { ...copy, ...sbsSetup() }));
    acct.put(CHILD2, 'spellbright', 'words', W.withSetup(W.emptyDoc(), copy));
  };
  const weeks = (id) => Object.values(W.normalise(acct.get(id, 'spellbright', 'words')).groups).filter((g) => !g.gone);
  /** The Set button is on the screen and not under Safari's bar. */
  const reachable = (p) => ev(`(() => { const b = document.querySelector('[data-act=set]'); if (!b) return 'no Set button'; const r = b.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight - ${p.bar || 0} + 0.5) return 'Set button at ' + Math.round(r.top) + '-' + Math.round(r.bottom) + ' of ' + innerHeight + ' (bar ${p.bar || 0})'; return ''; })()`);
  const toWhen = async (p, hash, day, night) => {
    await S.openAs(p, { day, hash, night, seed: seed(day), wait: 'document.querySelector(".st-page")' });
    await sleep(300);
    if (await has('[data-tab=lists]') && !(await has('[data-list]:checked'))) { try { await click('[data-tab=lists]'); } catch (e) { /* already there */ } }
    await until('document.querySelector("[data-act=next]:not([disabled])")', 'Next');
    await click('[data-act=next]');
    await until('document.querySelector("[data-act=set]")', 'the when step');
    await sleep(200);
  };

  scene('SB6 gu: S-gu-estimate (Set a week estimate follows words and date, Save reachable, Usual child)', async () => {
    const day = MON;
    await S.forProfiles(async (p, style) => {
      const night = style === 'night';
      const tag = p.id + ' ' + style;
      step(tag + ': Robin (Step by step)');
      await toWhen(p, '#/grownups/set/child/' + CHILD, day, night);
      ok(!await has('[data-focusbox]') && !await has('[data-fw]'), tag + ': no focus ticks (D21)');
      const read = () => ev('JSON.stringify([document.querySelector("[data-estimate-line]").dataset.tries, document.querySelector("[data-estimate-line]").textContent])');
      const first = await read();
      const firstText = JSON.parse(first)[1];
      ok(/^At least about \d+ sittings? of 10 minutes before the test: about \d+ a day\./.test(firstText), tag + ': the estimate line: ' + first);
      await click('[data-act=chip][data-days="2"]');
      await until('document.querySelector("[data-estimate-line]")', 'the line again');
      const soon = await read();
      ok(JSON.parse(soon)[1] !== firstText, tag + ': the line changes with the date: ' + soon);
      ok(/That is a lot for this week/.test(JSON.parse(soon)[1]) && await has('[data-estimate-date]'), tag + ': a near date gives the calm line with a link to change the date');
      await click('[data-estimate-date]');
      await until('document.querySelector("[data-date]")', 'the date field');
      const bad = await ev(`(() => { const b = document.querySelector('[data-act=set]'); b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return r.top < 0 || r.bottom > innerHeight - ${p.bar || 0} + 0.5 ? 'Set button at ' + Math.round(r.top) + '-' + Math.round(r.bottom) + ' of ' + innerHeight : ''; })()`);
      ok(!bad, tag + ': Save is reachable and not under the bar: ' + (bad || 'ok'));
      await S.shotAs(p, 'estimate-when', style);
      await click('[data-act=set]');
      await until('document.querySelector(".st-h1--done")', 'the week is set', 12000).catch(() => {});
      await sleep(600);
      const mine = weeks(CHILD);
      ok(mine.length === 1 && mine[0].words.length === 10 && !('focus' in mine[0]), tag + ': Robin has one week, ten words, no focus field');

      step(tag + ': Wren (Usual way)');
      await toWhen(p, '#/grownups/set/child/' + CHILD2, day, night);
      ok(!await has('[data-estimate-line]'), tag + ': no estimate for a Usual child');
      const bad3 = await ev(`(() => { const b = document.querySelector('[data-act=set]'); const r = b.getBoundingClientRect(); return r.bottom > innerHeight - ${p.bar || 0} + 0.5 ? 'under the bar' : ''; })()`);
      ok(!bad3, tag + ': Save is reachable (Usual): ' + (bad3 || 'ok'));
    }, { ids: IDS });
  });

  scene('SB6 gu: S-gu-estimate Change a week (words and date change the line)', async () => {
    const day = MON;
    await S.forProfiles(async (p, style) => {
      const tag = p.id + ' ' + style;
      const withWeek = async () => {
        await seed(day)();
        let d = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Class 4 spellings', test: W.addDays(MON, 5), words: WORDS10, today: MON, now: NOW }).doc;
        acct.put(CHILD, 'spellbright', 'words', W.withSetup(d, sbsSetup()));
      };
      await S.openAs(p, { day, hash: '#/grownups/child/' + CHILD + '/plan/g1', night: style === 'night', seed: withWeek, wait: 'document.querySelector(".st-page")' });
      await until('document.querySelector("[data-estimate-line]")', 'the estimate');
      const first = await ev('document.querySelector("[data-estimate-line]").textContent');
      await click('[data-act=words]');
      await ev('document.querySelector("[data-wk][value=night]").click()');
      await ev('document.querySelector("[data-wk][value=friend]").click()');
      await sleep(300);
      const fewer = await ev('document.querySelector("[data-estimate-line]").dataset.tries');
      await click('[data-act=chip]');
      await sleep(300);
      const second = await ev('document.querySelector("[data-estimate-line]").textContent');
      ok(/At least about \d+ sittings?/.test(first) && Number(fewer) > 0 && second !== first, tag + ': ' + first + ' | ' + fewer + ' tries | ' + second);
      const bad = await ev(`(() => { const b = document.querySelector('[data-act=save]'); b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return r.bottom > innerHeight - ${p.bar || 0} + 0.5 ? 'Save under the bar' : ''; })()`);
      ok(!bad, tag + ': Save reachable: ' + (bad || 'ok'));
    }, { ids: IDS });
  });

  scene('SB6 gu: S-gu-estimate preview (the preview link opens and shows what Robin will see)', async () => {
    const day = MON;
    await S.forProfiles(async (p, style) => {
      const tag = p.id + ' ' + style;
      const sbsWeek = async () => {
        await seed(day)();
        let d = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Class 4 spellings', test: W.addDays(MON, 5), words: WORDS10, today: MON, now: NOW }).doc;
        d = W.withSetup(d, sbsSetup());
        acct.put(CHILD, 'spellbright', 'words', d);
      };
      await S.openAs(p, { day, hash: '#/grownups/child/' + CHILD, night: style === 'night', seed: sbsWeek, wait: 'document.querySelector("[data-waycard]")' });
      ok(await has('[data-preview]'), tag + ': the preview link is there');
      await click('[data-preview]');
      await until('document.querySelector("[data-previewpage]")', 'the preview page');
      ok(/#\/grownups\/child\/[^/]+\/preview$/.test(await ev('location.hash')), tag + ': route ' + await ev('location.hash'));
      const t = (await text('main')).replace(/\s+/g, ' ');
      ok(/See what Robin will see/.test(t) && /Nothing is saved/.test(t), tag + ': the page says what it is');
      ok(await has('[data-preview-card] .gu-tp--tile') && await has('[data-preview-card] .gu-tp--gap'), tag + ': a step of the first word is drawn');
      ok(!await has('[data-prevnone]'), tag + ': not the "no step" line');
      ok(/Peek time\s*3 s/.test(t) && /Session\s*10 min/.test(t), tag + ': the settings are listed');
      await S.shotAs(p, 'estimate-preview', style);
      await click('[data-close]');
      await until('document.querySelector("[data-waycard]")', 'back on the child page');
    }, { ids: IDS });
  });
};
