// The hangman round (pure state) and its drawing.

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

// Ten parts for the full game. The mini game starts with the frame already
// up (parts 0–3) and draws only the figure, so it allows six wrong guesses.
const PARTS = [
  '<path data-part="0" class="g" d="M20 190 H120"/>',
  '<path data-part="1" class="g" d="M50 190 V20"/>',
  '<path data-part="2" class="g" d="M50 20 H130"/>',
  '<path data-part="3" class="g" d="M130 20 V45"/>',
  '<circle data-part="4" class="g head" cx="130" cy="61" r="16"/>',
  '<path data-part="5" class="g" d="M130 77 V125"/>',
  '<path data-part="6" class="g" d="M130 92 L108 112"/>',
  '<path data-part="7" class="g" d="M130 92 L152 112"/>',
  '<path data-part="8" class="g" d="M130 125 L112 158"/>',
  '<path data-part="9" class="g" d="M130 125 L148 158"/>',
];

export function gallows(mode) {
  return '<svg class="gallows" viewBox="0 0 180 200" role="img" aria-label="Hangman drawing">'
    + '<path class="g g--base" d="M10 190 H170"/>'
    + PARTS.join('')
    + '</svg>';
}

export function drawGallows(svg, mode, wrong) {
  const pre = mode === 'mini' ? 4 : 0;
  svg.querySelectorAll('[data-part]').forEach((el) => {
    const i = Number(el.dataset.part);
    el.classList.toggle('on', i < pre + wrong);
  });
}
