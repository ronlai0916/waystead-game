// The four computer players. Strength decides the character (PLAN.md Rev 4,
// F4_assets.md). Pictures: assets/characters/<id>-<mood>-<size>.webp, made by
// tools/wordbright-characters.py.

export const CHARACTERS = {
  easy: { id: 'pip', name: 'Pip', animal: 'dormouse', label: 'Easy', about: 'A sleepy dormouse. Plays easy words and sometimes swaps.' },
  normal: { id: 'ottie', name: 'Ottie', animal: 'otter', label: 'Normal', about: 'A friendly otter. Plays good words, not always the best.' },
  hard: { id: 'bramble', name: 'Bramble', animal: 'badger', label: 'Hard', about: 'A wise badger. Plays the highest-scoring word it can find.' },
  crazy: { id: 'fizz', name: 'Fizz', animal: 'magpie', label: 'Crazy', about: 'A quick magpie. Scores big and keeps good letters for next time.' },
};

export const STRENGTH_ORDER = ['easy', 'normal', 'hard', 'crazy'];

const MOOD_TEXT = {
  portrait: '',
  thinking: ', thinking',
  happy: ', looking happy',
  surprised: ', looking surprised',
};

export function character(strength) {
  return CHARACTERS[strength] || CHARACTERS.normal;
}

// mood: portrait, thinking, happy or surprised. size: 128 or 256.
export function pictureHtml(strength, mood = 'portrait', size = 128, cls = 'avatar') {
  const ch = character(strength);
  return '<img class="' + cls + '" src="assets/characters/' + ch.id + '-' + mood + '-' + size + '.webp" width="' + size + '" height="' + size
    + '" alt="' + ch.name + ' the ' + ch.animal + MOOD_TEXT[mood] + '">';
}
