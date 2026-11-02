// Rack leave: what the tiles a player keeps are worth next turn, in points,
// against drawing fresh tiles. The table is learned from self-play
// (tools/wordbright-leaves.mjs → data/leaves.json, one per board). Pure.
//
// A leave is described by small parts, and its value is the sum of theirs:
//   1x   at least one x        ('?' is a blank)
//   2x   at least two x        3x  at least three x
//   pxy  both x and y (x < y)
//   vcV-C  V vowels and C consonants (blanks are neither)

import { BLANK } from '../engine/bag.js';

export const LEAVE_LETTERS = [...'abcdefghijklmnopqrstuvwxyz', BLANK];
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

export function leaveFeatures(leave) {
  const count = new Map();
  let v = 0;
  let c = 0;
  for (const t of leave) {
    count.set(t, (count.get(t) || 0) + 1);
    if (VOWELS.has(t)) v++; else if (t !== BLANK) c++;
  }
  const out = [];
  const kinds = [...count.keys()].sort();
  for (const t of kinds) {
    const k = count.get(t);
    out.push('1' + t);
    if (k >= 2) out.push('2' + t);
    if (k >= 3) out.push('3' + t);
  }
  for (let i = 0; i < kinds.length; i++) for (let j = i + 1; j < kinds.length; j++) out.push('p' + kinds[i] + kinds[j]);
  out.push(`vc${v}-${c}`);
  return out;
}

export function learnedLeave(table, leave) {
  if (!leave.length) return 0;
  let sum = 0;
  for (const f of leaveFeatures(leave)) sum += table[f] || 0;
  return sum;
}
