// Merge rules for saved progress, shared by the games. Pure.
// THIS FILE IS A COPY: edit shared/account/ and run `node tools/sync-shared.mjs`.
//
// A LOG is { resetAt, results: [{ id, at, … }], folded: { [group]: fold } }:
// finished games or tests, each with its own id and time (ms since 1970).
//
// · Results are merged by id: the union of both copies. A result is never lost
//   in a merge, and the same result is never counted twice.
// · Counters (attempts, games played, wins) are always COUNTED FROM the
//   results, never added up from two copies.
// · resetAt ("Clear my progress"): the later reset wins; anything older goes.
// · Before the 64 KB cap, the oldest results are FOLDED: removed one by one
//   into their group's fold, which keeps their count (n), the time of the
//   newest folded result (through) and any best/ever-passed figures. Two folds
//   of one group: the one that reaches later wins (it has folded more). A
//   result at or before its group's `through` is already in the fold: its
//   best/passed figures are kept in the fold, and the result itself goes.

export function newest(a, b, at) {
  if (a == null) return b;
  if (b == null) return a;
  return at(b) > at(a) ? b : a; // a tie keeps this device's copy
}

// group(result) -> the fold it belongs to; absorb(fold, result) -> fold with
// that result's best/passed figures (must be safe to repeat: max / or).
export function mergeLog(a, b, { group, absorb }) {
  const resetAt = Math.max(a.resetAt || 0, b.resetAt || 0);
  const folded = {};
  for (const g of new Set([...Object.keys(a.folded || {}), ...Object.keys(b.folded || {})])) {
    const fa = (a.folded || {})[g];
    const fb = (b.folded || {})[g];
    let f = !fa ? fb : !fb ? fa : fb.through > fa.through || (fb.through === fa.through && fb.n > fa.n) ? fb : fa;
    if (fa && fb) f = absorb(absorb({ ...f }, fa), fb);
    if (f && f.through > resetAt) folded[g] = f;
  }
  const byId = new Map();
  for (const r of [...(a.results || []), ...(b.results || [])]) {
    if (!r || typeof r.id !== 'string' || !(r.at > resetAt)) continue;
    const g = group(r);
    if (folded[g] && r.at <= folded[g].through) { folded[g] = absorb(folded[g], r); continue; }
    if (!byId.has(r.id)) byId.set(r.id, r);
  }
  const results = [...byId.values()].sort((x, y) => x.at - y.at || (x.id < y.id ? -1 : 1));
  return { resetAt, results, folded };
}

// Fold the oldest results until the log (as JSON) is at most `target` bytes.
// count(result) is how many results it stands for (an imported total: n).
// tally(fold, result) adds anything else a fold counts (e.g. wins).
export function foldOldest(log, { target, sizeOf, group, absorb, emptyFold, count = (r) => r.n || 1, tally = (f) => f }) {
  if (sizeOf(log) <= target) return log;
  const results = [...log.results].sort((x, y) => x.at - y.at);
  const folded = { ...log.folded };
  const out = { ...log, folded, results };
  let i = 0;
  while (i < results.length && sizeOf({ ...out, results: results.slice(i) }) > target) {
    const step = Math.max(1, Math.floor((results.length - i) / 20));
    for (const r of results.slice(i, i + step)) {
      const g = group(r);
      const f = folded[g] ? { ...folded[g] } : emptyFold(g);
      f.n += count(r);
      f.through = Math.max(f.through || 0, r.at);
      folded[g] = absorb(tally(f, r), r);
    }
    i += step;
  }
  out.results = results.slice(i);
  return out;
}
