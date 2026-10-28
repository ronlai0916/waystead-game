// Word graph (DAWG) reader. The files are made by tools/build-wordgraph.py;
// the format is described there. One graph per word list (starter, steady,
// full, large, xlarge). Words are lower-case a–z.

const FINAL = 1 << 5;
const LAST = 1 << 6;
const CHILD_SHIFT = 7;
const HEADER = 16;

// buffer: an ArrayBuffer, or a typed array / Node Buffer over one.
export function loadWordGraph(buffer) {
  const view = ArrayBuffer.isView(buffer)
    ? new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    : new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== 'WBG1') throw new Error('Not a Wordbright word graph');
  const count = view.getUint32(4, true);
  if (view.byteLength !== HEADER + count * 4) throw new Error('Word graph file is the wrong size');
  const edges = new Uint32Array(count);
  for (let i = 0; i < count; i++) edges[i] = view.getUint32(HEADER + i * 4, true);
  return { edges, words: view.getUint32(8, true), longest: view.getUint32(12, true) };
}

// The edge for `letter` leaving the node whose edges start at `node`, or -1.
// Node 0 is the root. Used by isWord and, later, by the computer players.
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

// Every edge leaving `node`, as { letter, final, child } (child 0 = none).
export function edgesOf(graph, node) {
  const out = [];
  const edges = graph.edges;
  for (let i = node; i < edges.length; i++) {
    const e = edges[i];
    out.push({ letter: String.fromCharCode(97 + (e & 31)), final: !!(e & FINAL), child: e >>> CHILD_SHIFT });
    if (e & LAST) break;
  }
  return out;
}

// isWord('colour', graph). maxLength limits the list (band A's computer knows
// words up to 6 letters only).
export function isWord(word, graph, maxLength = Infinity) {
  if (typeof word !== 'string' || word.length < 2 || word.length > maxLength) return false;
  if (!/^[a-z]+$/.test(word)) return false;
  let node = 0;
  let final = false;
  for (let k = 0; k < word.length; k++) {
    if (k && !node) return false;
    const i = findEdge(graph, node, word[k]);
    if (i < 0) return false;
    const e = graph.edges[i];
    final = !!(e & FINAL);
    node = e >>> CHILD_SHIFT;
  }
  return final;
}
