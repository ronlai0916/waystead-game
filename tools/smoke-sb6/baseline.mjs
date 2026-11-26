// SB6 (WP-10): the baseline S-fold run on 23b's Fix it in and games at every TR-70 profile (plus 1180x640), garden and Night.
//   Record:  SB6_BASELINE_RECORD=1 node tools/sb2-smoke.mjs <fresh dir> 'SB6 baseline*'      writes tools/smoke-sb6/baseline-23b.json
//   Compare: SB6_BASELINE=1 node tools/sb2-smoke.mjs <fresh dir> 'SB6 baseline*'                            fails when a page gets worse than the file (slack down, scroll up, a target smaller, new sideways scroll)
// Filters: SB6_ONLY='iphone-se1|ipad' (profiles), SB6_STYLES=garden, SB6_PAGES='^fix' (pages). A page that is unreachable today is recorded as such.
// What is measured per page (the same ideas as tools/smoke-sb5/fold.mjs and devices.mjs): the lowest main control against the reserve line (slack),
// page scroll, sideways scroll, smallest box, tile, Hear and Peek, the gap from boxes to tiles, the widest play column.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export default (H, S) => {
  const { scene, go, click, ev, until, sleep, ok, studied, weekDoc, gameDayDoc, practiceDayDoc, seedChild, W, MON, plus, ROOT } = H;
  const FILE = join(ROOT, 'tools/smoke-sb6/baseline-23b.json');
  const KEYS = 'document.querySelector(".keyboard .key, .tray .key, .ltile, .keyboard--tray")';
  const D1 = plus(1); const D2 = plus(2); const D4 = plus(4); const D5 = plus(5);
  const onlyPages = process.env.SB6_PAGES ? new RegExp(process.env.SB6_PAGES) : null;
  const FLOWER_LIST = `(async () => { const c = await (await fetch('data/curriculum.json')).json(); return c.year_3_4.chapters.flatMap((ch) => ch.words.map((w) => w.word)).slice(0, 10); })()`;
  const helloDone = () => { const d = weekDoc(); return W.markStep(d, W.groupById(d, 'g1'), 'hello', MON, Date.parse(MON + 'T09:00:00')); };
  const seeded = (doc, day) => async () => { await seedChild(doc(), day); };

  // [id, group, seed, day, hash, wait, after]
  const PAGES = [
    ['fix-typing', 'fix', seeded(helloDone, D1), D1, '#/words/g/g1/study/fix', 'document.querySelector("[data-cover]")', async () => { await click('[data-cover]'); if (await ev('!!document.querySelector("[data-written]")')) await click('[data-written]'); await until('document.querySelector("[data-check]") && ' + KEYS, 'Fix it in typing'); }],
    ['fix-look', 'fix', seeded(helloDone, D1), D1, '#/words/g/g1/study/fix', 'document.querySelector("[data-cover]")', null],
    ['hello-spell', 'game', seeded(weekDoc, MON), MON, '#/words/g/g1/study/hello', 'document.querySelector("[data-play]")', async () => { await click('[data-play]'); await until('document.querySelector(".blanks") && ' + KEYS, 'Hello spell-it-out'); }],
    ['flower', 'game', seeded(weekDoc, MON), MON, '#/', 'document.querySelector("main section")', async () => {
      const list = await ev(FLOWER_LIST);
      await ev('sessionStorage.setItem("sb.selection",' + JSON.stringify(JSON.stringify(list)) + ')');
      await go('#/custom/play');
      await until('document.querySelector(".blanks") && ' + KEYS, 'the flower game');
    }],
    ['practice-grid', 'game', seeded(practiceDayDoc, D4), D4, '#/words/g/g1/spell/0', 'document.querySelector(".spellbox.is-next")', null],
    ['test', 'game', seeded(() => studied(weekDoc()), D5), D5, '#/words/g/g1/test', 'document.querySelector("[data-next]") && ' + KEYS, null],
    ['quiz', 'game', seeded(gameDayDoc, D2), D2, '#/words/g/g1/quiz', 'document.querySelector("[data-check],[data-next],.keyboard .key,main h1")', null],
    ['quick-fire', 'game', seeded(gameDayDoc, D2), D2, '#/words/g/g1/game/quick', 'document.querySelector("[data-game=quick]") && ' + KEYS, null],
    ...['missing', 'unjumble', 'match', 'fill', 'mix'].map((g) => ['game-' + g, 'game', seeded(gameDayDoc, D2), D2, '#/words/g/g1/game/' + g, 'document.querySelector("main h1")', null]),
  ];

  const min = (a, f) => (a.length ? Math.round(Math.min(...a.map(f)) * 10) / 10 : null);
  async function one(p, style, pg) {
    const [id, , seed, day, hash, wait, after] = pg;
    const key = p.id + ' ' + style + ' ' + id;
    try {
      await S.openAs(p, { day, hash, seed, night: style === 'night', wait });
      if (after) await after();
      await ev('document.fonts.ready.then(() => true)');
      await sleep(150);
      await S.drawOverlay(p);
    } catch (e) { return [key, { unreachable: e.message.slice(0, 80) }]; }
    const m = await S.measure();
    const ctl = [...m.check, ...m.hear, ...m.peek];
    const lowest = ctl.length ? Math.max(...ctl.map((c) => c.b)) : null;
    const gapDefects = S.checks.gapBoxesTiles(m);
    const gap = m.boxes.length && m.tiles.length ? Math.min(...m.tiles.map((t) => t.t)) - Math.max(...m.boxes.map((b) => b.b)) : null;
    return [key, {
      ih: m.ih, line: S.line(p), slack: lowest === null ? null : S.line(p) - lowest, scrollPx: m.scrollPx, sideways: m.sideways,
      boxes: m.boxes.length, minBoxW: min(m.boxes.filter((b) => b.w > 8), (b) => b.w), tiles: m.tiles.length, minTile: min(m.tiles, (t) => Math.min(t.w, t.h)),
      minHear: min(m.hear, (h) => Math.min(h.w, h.h)), minPeek: min(m.peek, (h) => Math.min(h.w, h.h)), nCheck: m.check.length,
      gapBoxesTiles: gap, gapOver: gapDefects.length ? 1 : 0, playWidth: Math.round(m.playWidth), covered: ctl.filter((c) => c.hit).length,
    }];
  }

  // Only registered when asked for (it takes minutes): SB6_BASELINE=1 (compare) or SB6_BASELINE_RECORD=1 (record), so the full smoke and 'SB6 *' stay quick.
  if (!process.env.SB6_BASELINE && !process.env.SB6_BASELINE_RECORD) return;
  scene('SB6 baseline: 23b Fix it in and games at every profile', async () => {
    const record = !!process.env.SB6_BASELINE_RECORD;
    const out = {};
    const pages = PAGES.filter((pg) => !onlyPages || onlyPages.test(pg[0]));
    await S.forProfiles(async (p, style) => {
      for (const pg of pages) { const [k, v] = await one(p, style, pg); out[k] = v; }
      console.log('  · ' + p.id + ' ' + style + ' done');
    }, { ids: [...S.TR70, 'ipad-landscape-bars'] });
    const n = Object.keys(out).length;
    const unreachable = Object.entries(out).filter(([, v]) => v.unreachable);
    console.log('  · ' + n + ' page measurements, ' + unreachable.length + ' unreachable');
    unreachable.slice(0, 10).forEach(([k, v]) => console.log('  · not reachable: ' + k + ': ' + v.unreachable));
    if (record) {
      const all = existsSync(FILE) && (process.env.SB6_ONLY || process.env.SB6_STYLES || process.env.SB6_PAGES) ? { ...JSON.parse(readFileSync(FILE, 'utf8')), ...out } : out; // a partial record merges into the file
      writeFileSync(FILE, JSON.stringify({ at: new Date().toISOString(), build: '23b (ddd433d)', note: 'slack = reserve line minus the lowest Check/Hear/Peek bottom (px, higher is better); scrollPx = page scroll; see tools/smoke-sb6/baseline.mjs', pages: all }, null, 1) + '\n');
      console.log('  · baseline written: ' + FILE);
      return;
    }
    ok(existsSync(FILE), 'no baseline file: record one with SB6_BASELINE_RECORD=1');
    const base = JSON.parse(readFileSync(FILE, 'utf8')).pages;
    const worse = [];
    for (const [k, v] of Object.entries(out)) {
      const b = base[k];
      if (!b || v.unreachable || b.unreachable) { if (b && !!b.unreachable !== !!v.unreachable) worse.push(k + ': reachability changed (' + (b.unreachable || 'ok') + ' -> ' + (v.unreachable || 'ok') + ')'); continue; }
      if (v.sideways > b.sideways) worse.push(k + ': sideways scroll ' + b.sideways + ' -> ' + v.sideways);
      if (v.scrollPx > b.scrollPx + 2) worse.push(k + ': page scroll ' + b.scrollPx + ' -> ' + v.scrollPx + ' px');
      if (v.slack !== null && b.slack !== null && v.slack < b.slack - 2) worse.push(k + ': slack ' + b.slack + ' -> ' + v.slack + ' px');
      for (const f of ['minBoxW', 'minTile', 'minHear', 'minPeek']) if (v[f] !== null && b[f] !== null && v[f] < b[f] - 1) worse.push(k + ': ' + f + ' ' + b[f] + ' -> ' + v[f]);
      if (v.covered > b.covered) worse.push(k + ': ' + v.covered + ' covered controls (was ' + b.covered + ')');
    }
    worse.slice(0, 40).forEach((w) => console.log('  WORSE ' + w));
    ok(!worse.length, worse.length + ' pages worse than the 23b baseline (listed above)');
  });
};
