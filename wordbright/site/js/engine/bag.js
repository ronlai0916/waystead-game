// The tile bag. Tiles are letters "a"–"z", and "?" for a blank.
// A bag is plain JSON: { seed, order, pos, swaps }. `order` is the shuffled
// bag (since the last swap), `pos` how many tiles have been drawn from it.
// The same seed always gives the same order, so a game replays exactly.

export const BLANK = '?';

// Small, fast seeded generator (mulberry32). Returns numbers in [0, 1).
export function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, seed) {
  const out = list.slice();
  const next = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Every tile for this board, unshuffled, from tiles.json.
export function bagTiles(tiles, boardId) {
  const spec = tiles.bags && tiles.bags[boardId];
  if (!spec) throw new Error(`No tile bag for board "${boardId}"`);
  const out = [];
  for (const [letter, n] of Object.entries(spec.tiles)) for (let i = 0; i < n; i++) out.push(letter);
  for (let i = 0; i < spec.blanks; i++) out.push(BLANK);
  return out;
}

export function newBag(tiles, boardId, seed) {
  if (!Number.isInteger(seed)) throw new Error('A bag needs a whole-number seed');
  return { seed: seed >>> 0, order: shuffle(bagTiles(tiles, boardId), seed), pos: 0, swaps: 0 };
}

export function tilesLeft(bag) {
  return bag.order.length - bag.pos;
}

// Draw up to n tiles. Returns { bag, drawn }; the old bag is not changed.
export function draw(bag, n) {
  const take = Math.max(0, Math.min(n, tilesLeft(bag)));
  return { bag: { ...bag, pos: bag.pos + take }, drawn: bag.order.slice(bag.pos, bag.pos + take) };
}

// Put tiles back (after a swap) and shuffle the undrawn part again.
// The new shuffle's seed comes from the bag's seed and the swap count.
export function putBack(bag, returned) {
  const swaps = bag.swaps + 1;
  const seed = (Math.imul(bag.seed ^ 0x9E3779B9, swaps) + swaps) >>> 0;
  const rest = shuffle(bag.order.slice(bag.pos).concat(returned), seed);
  return { seed: bag.seed, order: rest, pos: 0, swaps };
}
