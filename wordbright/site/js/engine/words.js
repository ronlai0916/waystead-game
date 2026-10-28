// Word graph (DAWG) reader. The files are made by tools/build-wordgraph.py;
// the formats are described there. The game uses words_all.dawg ("WBG2"):
// every word once, tagged with its tier, the smallest list it is in
// (0 starter, 1 steady, 2 full, 3 large, 4 xlarge; see levels.js). The older
// single-list files ("WBG1") still load: all their words have tier 0.
// Words are lower-case a–z.

// In memory every graph uses the WBG2 edge layout:
//   bits 0-4 letter, bit 5 last edge of the node, bits 6-8 tier of the word
//   ending here (7 = none), bits 9-11 smallest tier further on, bits 12-31 child.
export const LAST = 1 << 5;
export const TIER_SHIFT = 6;
export const REACH_SHIFT = 9;
export const CHILD_SHIFT = 12;
export const NO_WORD = 7;
export const ANY_TIER = 6; // isWord's default: a word of any tier

const V1 = { FINAL: 1 << 5, LAST: 1 << 6, CHILD_SHIFT: 7 };

// buffer: an ArrayBuffer, or a typed array / Node Buffer over one.
export function loadWordGraph(buffer) {
  const view = ArrayBuffer.isView(buffer)
    ? new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    : new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== 'WBG1' && magic !== 'WBG2') throw new Error('Not a Wordbright word graph');
  const count = view.getUint32(4, true);
  const tiers = magic === 'WBG2' ? view.getUint32(16, true) : 0;
  const header = magic === 'WBG2' ? 20 + tiers * 4 : 16;
  if (view.byteLength !== header + count * 4) throw new Error('Word graph file is the wrong size');
  const edges = new Uint32Array(count);
  if (magic === 'WBG2') {
    for (let i = 0; i < count; i++) edges[i] = view.getUint32(header + i * 4, true);
  } else {
    for (let i = 0; i < count; i++) {
      const e = view.getUint32(header + i * 4, true);
      edges[i] = (e & 31) | (e & V1.LAST ? LAST : 0) | ((e & V1.FINAL ? 0 : NO_WORD) << TIER_SHIFT)
        | ((e >>> V1.CHILD_SHIFT) << CHILD_SHIFT);
    }
  }
  const tierCounts = [];
  for (let t = 0; t < tiers; t++) tierCounts.push(view.getUint32(20 + t * 4, true));
  return { edges, words: view.getUint32(8, true), longest: view.getUint32(12, true), tierCounts };
}

export const letterOf = (e) => e & 31;
export const tierOf = (e) => (e >>> TIER_SHIFT) & 7;
export const reachOf = (e) => (e >>> REACH_SHIFT) & 7;
export const childOf = (e) => e >>> CHILD_SHIFT;

// The edge for `letter` leaving the node whose edges start at `node`, or -1.
// Node 0 is the root.
export function findEdge(graph, node, letter) {
  const code = letter.charCodeAt(0) - 97;
  const edges = graph.edges;
  for (let i = node; i < edges.length; i++) {
    const e = edges[i];
    if ((e & 31) === code) return i;
    if (e & LAST) return -1;
  }
  return -1;
}

// Every edge leaving `node`, as { letter, final, tier, child } (child 0 = none).
export function edgesOf(graph, node) {
  const out = [];
  const edges = graph.edges;
  for (let i = node; i < edges.length; i++) {
    const e = edges[i];
    out.push({ letter: String.fromCharCode(97 + (e & 31)), final: tierOf(e) !== NO_WORD, tier: tierOf(e), child: childOf(e) });
    if (e & LAST) break;
  }
  return out;
}

// The word's tier (0–4), or NO_WORD if it is not in the graph.
export function wordTier(word, graph) {
  if (typeof word !== 'string' || !/^[a-z]+$/.test(word)) return NO_WORD;
  let node = 0;
  let tier = NO_WORD;
  for (let k = 0; k < word.length; k++) {
    if (k && !node) return NO_WORD;
    const i = findEdge(graph, node, word[k]);
    if (i < 0) return NO_WORD;
    const e = graph.edges[i];
    tier = tierOf(e);
    node = childOf(e);
  }
  return tier;
}

// isWord('colour', graph): is it a word of tier maxTier or below (so in that
// list), with at most maxLength letters? Band A's computer knows words of up
// to 6 letters only.
export function isWord(word, graph, maxTier = ANY_TIER, maxLength = Infinity) {
  if (typeof word !== 'string' || word.length < 2 || word.length > maxLength) return false;
  return wordTier(word, graph) <= maxTier;
}
