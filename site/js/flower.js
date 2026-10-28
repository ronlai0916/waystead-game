// One round of the letter game (pure state) and its drawing: a flower that
// loses a petal for every wrong letter. Spell the word before the last petal
// falls. Six petals in the quick game, ten in practice.

export class Round {
  constructor(word, maxWrong) {
    this.word = word.toUpperCase();
    this.maxWrong = maxWrong;
    this.guessed = new Set();
    this.wrong = 0;
  }
  get state() {
    if ([...this.word].every((c) => this.guessed.has(c))) return 'won';
    if (this.wrong >= this.maxWrong) return 'lost';
    return 'playing';
  }
  guess(L) {
    L = L.toUpperCase();
    if (this.state !== 'playing' || this.guessed.has(L)) return 'repeat';
    this.guessed.add(L);
    if (this.word.includes(L)) return 'hit';
    this.wrong += 1;
    return 'miss';
  }
}

const CX = 90;
const CY = 72;

// Petals fall in this order: alternating sides, so the flower stays balanced.
function fallOrder(n) {
  const order = [];
  for (let k = 0; k < n; k += 1) order.push(k % 2 === 0 ? k / 2 : n - 1 - (k - 1) / 2);
  return order;
}

export function flower(petals) {
  const order = fallOrder(petals);
  let p = '';
  for (let i = 0; i < petals; i += 1) {
    const a = (360 / petals) * i;
    p += '<g class="petal" data-petal="' + order.indexOf(i) + '">'
      + '<ellipse cx="' + CX + '" cy="' + (CY - 30) + '" rx="' + (petals > 6 ? 11 : 14) + '" ry="22" transform="rotate(' + a + ' ' + CX + ' ' + CY + ')"/></g>';
  }
  return '<svg class="flower" viewBox="0 0 180 200" role="img" aria-label="A flower with ' + petals + ' petals">'
    + '<path class="flower__ground" d="M30 190 H150"/>'
    + '<path class="flower__stem" d="M90 190 C88 160 94 130 90 100"/>'
    + '<path class="flower__leaf" d="M90 160 C70 158 58 146 56 132 C74 132 86 142 90 160 Z"/>'
    + '<path class="flower__leaf" d="M91 140 C108 138 120 126 124 112 C106 112 94 122 91 140 Z"/>'
    + p
    + '<circle class="flower__centre" cx="' + CX + '" cy="' + CY + '" r="17"/>'
    + '<path class="flower__smile" d="M82 75 Q90 82 98 75"/>'
    + '<circle class="flower__eye" cx="84" cy="68" r="2"/><circle class="flower__eye" cx="96" cy="68" r="2"/>'
    + '</svg>';
}

// Petal k (in fall order) is gone once k < wrong. Each one drifts away
// gently to a slightly different spot.
export function drawFlower(svg, wrong) {
  const petals = svg.querySelectorAll('.petal');
  petals.forEach((el) => {
    const k = Number(el.dataset.petal);
    const gone = k < wrong;
    if (gone && !el.classList.contains('fallen')) {
      el.style.setProperty('--dx', ((k % 2 ? 1 : -1) * (14 + (k * 7) % 22)) + 'px');
      el.style.setProperty('--rot', ((k % 2 ? 1 : -1) * (40 + (k * 13) % 50)) + 'deg');
    }
    el.classList.toggle('fallen', gone);
  });
  const left = petals.length - wrong;
  svg.setAttribute('aria-label', left > 0 ? 'A flower with ' + left + ' of ' + petals.length + ' petals left' : 'The flower has lost all its petals');
  svg.classList.toggle('flower--bare', left <= 0);
}
