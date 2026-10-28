// New-game screen: board, word helper, and 2–4 seats. Each seat is a child
// (with a name) or a computer player (a character, which sets its strength),
// and each seat has its own word level.
import { LEVELS, level, STAR_YEARS } from '../engine/levels.js';
import { MIN_PLAYERS, MAX_PLAYERS, newGame } from '../engine/game.js';
import { BOARD_IDS, BOARD_MINUTES, boardJson, gameEnv } from '../data.js';
import { savedGame, saveGame, lastSetup, saveSetup } from '../store.js';
import { esc, ICON, ask, isPhone, toast } from '../ui/dom.js';
import { CHARACTERS, STRENGTH_ORDER, character, pictureHtml } from '../ai/characters.js';

const MAX_NAME = 16;
const DEFAULT_LEVEL = 'year-5';

const LIST_TEXT = {
  starter: 'common words',
  steady: 'everyday words',
  full: 'the full word list',
  large: 'the large word list, with rarer words',
  xlarge: 'the very large word list',
};

export function starText(years) {
  if (!years.length) return 'no Star words';
  if (years.length === STAR_YEARS.length) return 'Star words from all the Year 1–6 lists';
  if (years.join() === '1,2') return 'Star words from the Year 1–2 list';
  return 'Star words from the Year ' + years.join(', ').replace('-', '–') + ' list';
}

export function levelText(id) {
  const l = level(id);
  return 'You can play any of about 177,000 British words; ' + starText(l.starYears) + '.';
}

function computerLevelText(id) {
  const l = level(id);
  return 'Knows ' + LIST_TEXT[l.computer.list] + (l.computer.maxLength ? ' of up to ' + l.computer.maxLength + ' letters' : '') + '.';
}

const knownLevel = (id) => LEVELS.some((l) => l.id === id);

// The saved choices, including those saved before computer players (names + one level).
function savedSetup() {
  const prev = lastSetup() || {};
  const lvl = knownLevel(prev.level) ? prev.level : DEFAULT_LEVEL;
  let seats = Array.isArray(prev.seats) ? prev.seats : null;
  if (!seats && Array.isArray(prev.names)) seats = prev.names.map((name) => ({ type: 'child', name }));
  if (!seats) seats = [{ type: 'child', name: '' }, { type: 'computer', strength: 'normal' }];
  seats = seats.slice(0, MAX_PLAYERS).map((s) => ({
    type: s.type === 'computer' ? 'computer' : 'child',
    name: typeof s.name === 'string' ? s.name.slice(0, MAX_NAME) : '',
    strength: STRENGTH_ORDER.includes(s.strength) ? s.strength : 'normal',
    level: knownLevel(s.level) ? s.level : lvl,
  }));
  while (seats.length < MIN_PLAYERS) seats.push({ type: 'computer', strength: 'normal', name: '', level: lvl });
  return { board: prev.board || 'standard', helper: prev.helper !== false, level: lvl, seats };
}

export function setup(main) {
  const prev = savedSetup();
  const phone = isPhone();
  if (phone && prev.board === 'large') prev.board = 'standard';
  let seats = prev.seats;

  main.innerHTML = '<section class="wrap page setup">'
    + '<div class="pagehead"><span class="eyebrow">New game</span><h1>Set up a game</h1></div>'
    + '<form class="stack" data-form novalidate>'
    + '<fieldset class="card setting"><legend>Board</legend><div class="boards" data-boards></div></fieldset>'
    + '<fieldset class="card setting"><legend>Players</legend>'
    + '<p class="muted small">Two to four players take turns on this device, with at least one child. Each player has their own word level.</p>'
    + '<div class="seats" data-seats></div>'
    + '<div class="btnrow"><button type="button" class="btn btn--ghost btn--small" data-add>' + ICON.plus + 'Add a player</button></div>'
    + '<p class="small seats__error" data-seat-error role="alert"></p></fieldset>'
    + '<fieldset class="card setting"><legend>Word helper</legend>'
    + '<label class="switch"><input type="checkbox" role="switch" data-helper' + (prev.helper ? ' checked' : '') + ' aria-describedby="helper-text">'
    + '<span class="switch__track" aria-hidden="true"></span><span class="switch__label">Check words before Play</span></label>'
    + '<p class="muted small" id="helper-text" data-helper-text aria-live="polite"></p></fieldset>'
    + '<div class="btnrow"><button type="submit" class="btn btn--primary" data-start>Start game' + ICON.arrow + '</button></div>'
    + '</form></section>';

  const form = main.querySelector('[data-form]');
  const seatsEl = main.querySelector('[data-seats]');
  const addBtn = main.querySelector('[data-add]');
  const seatError = main.querySelector('[data-seat-error]');
  const helperBox = main.querySelector('[data-helper]');
  const helperTextEl = main.querySelector('[data-helper-text]');

  // Boards: sizes come from the board files.
  Promise.all(BOARD_IDS.map(boardJson)).then((boards) => {
    main.querySelector('[data-boards]').innerHTML = boards.map((b) => {
      const locked = phone && b.id === 'large';
      const checked = b.id === prev.board ? ' checked' : '';
      return '<label class="boardopt' + (locked ? ' boardopt--locked' : '') + '">'
        + '<input type="radio" name="board" value="' + esc(b.id) + '"' + checked + (locked ? ' disabled' : '') + '>'
        + '<span class="boardopt__mini" data-mini="' + b.size + '" aria-hidden="true"></span>'
        + '<span class="boardopt__text"><b>' + esc(b.title) + '</b> <span class="muted">' + b.size + ' × ' + b.size + '</span>'
        + '<span class="small muted">' + (locked ? ICON.lock + 'Needs a tablet or computer' : 'About ' + BOARD_MINUTES[b.id] + ' minutes for two players') + '</span></span>'
        + '</label>';
    }).join('');
    main.querySelectorAll('[data-mini]').forEach((el) => el.style.setProperty('--n', el.dataset.mini));
  }).catch(() => { main.querySelector('[data-boards]').innerHTML = '<p>The boards did not load. Check your connection, then reload the page.</p>'; });

  const showHelper = () => {
    helperTextEl.textContent = helperBox.checked
      ? 'On: while you place tiles, the game says whether your words are allowed.'
      : 'Off: you see the points, but not whether a word is allowed until you press Play.';
  };
  helperBox.addEventListener('change', showHelper);
  showHelper();

  // ---- Seats ----
  const levelOptions = (chosen) => '<optgroup label="School">' + LEVELS.slice(0, 13).map((l) => opt(l, chosen)).join('') + '</optgroup>'
    + '<optgroup label="Beyond school">' + LEVELS.slice(13).map((l) => opt(l, chosen)).join('') + '</optgroup>';
  const opt = (l, chosen) => '<option value="' + l.id + '"' + (l.id === chosen ? ' selected' : '') + '>' + esc(l.label) + '</option>';
  const seatNote = (s) => (s.type === 'computer' ? character(s.strength).about + ' ' + computerLevelText(s.level) : levelText(s.level));

  function seatHtml(s, i) {
    const n = i + 1;
    const who = s.type === 'computer'
      ? '<div class="seat__who seat__who--computer">' + pictureHtml(s.strength, 'portrait', 128, 'avatar avatar--seat')
        + '<label class="sr" for="c' + i + '">Computer player ' + n + '</label>'
        + '<select id="c' + i + '" class="field" data-strength="' + i + '">'
        + STRENGTH_ORDER.map((k) => '<option value="' + k + '"' + (k === s.strength ? ' selected' : '') + '>'
          + esc(CHARACTERS[k].name + ' — ' + CHARACTERS[k].label) + '</option>').join('') + '</select></div>'
      : '<div class="seat__who"><label class="sr" for="p' + i + '">Name of player ' + n + '</label>'
        + '<input id="p' + i + '" class="field" type="text" maxlength="' + MAX_NAME + '" autocomplete="off" placeholder="Player ' + n + '" value="' + esc(s.name) + '" data-name="' + i + '"></div>';
    return '<fieldset class="seat" data-seat="' + i + '"><legend class="seat__title">Player ' + n + '</legend>'
      + '<div class="seg" role="radiogroup" aria-label="Player ' + n + ' is">'
      + ['child', 'computer'].map((t) => '<label class="seg__opt"><input type="radio" name="type' + i + '" value="' + t + '" data-type="' + i + '"'
        + (s.type === t ? ' checked' : '') + '><span>' + (t === 'child' ? 'Child' : 'Computer') + '</span></label>').join('')
      + '</div>'
      + who
      + '<div class="seat__level"><label class="small" for="l' + i + '">Word level</label>'
      + '<select id="l' + i + '" class="field" data-level="' + i + '">' + levelOptions(s.level) + '</select></div>'
      + '<p class="muted small seat__note" data-note="' + i + '">' + esc(seatNote(s)) + '</p>'
      + (seats.length > MIN_PLAYERS ? '<button type="button" class="iconbtn seat__remove" data-remove="' + i + '" aria-label="Remove player ' + n + '">' + ICON.cross + '</button>' : '')
      + '</fieldset>';
  }

  function drawSeats() {
    seatsEl.innerHTML = seats.map(seatHtml).join('');
    addBtn.disabled = seats.length >= MAX_PLAYERS;
  }
  drawSeats();

  seatsEl.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.name != null) seats[Number(t.dataset.name)].name = t.value;
  });
  seatsEl.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.type != null) {
      const i = Number(t.dataset.type);
      seats[i].type = t.value;
      seatError.textContent = '';
      drawSeats();
      seatsEl.querySelector('[data-type="' + i + '"][value="' + t.value + '"]').focus();
    } else if (t.dataset.strength != null) {
      const i = Number(t.dataset.strength);
      seats[i].strength = t.value;
      drawSeats();
      seatsEl.querySelector('#c' + i).focus();
    } else if (t.dataset.level != null) {
      const i = Number(t.dataset.level);
      seats[i].level = t.value;
      prev.level = t.value; // new seats start at the last level chosen
      seatsEl.querySelector('[data-note="' + i + '"]').textContent = seatNote(seats[i]);
    }
  });
  seatsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    seats.splice(Number(b.dataset.remove), 1);
    drawSeats();
    addBtn.focus();
  });
  addBtn.addEventListener('click', () => {
    if (seats.length >= MAX_PLAYERS) return;
    const hasChild = seats.some((s) => s.type === 'child');
    seats.push(hasChild ? { type: 'computer', strength: 'normal', name: '', level: prev.level } : { type: 'child', name: '', level: prev.level });
    drawSeats();
    seatsEl.querySelector('[data-seat="' + (seats.length - 1) + '"] input, [data-seat="' + (seats.length - 1) + '"] select').focus();
  });

  // Computer players are named after their character ("Ottie", "Ottie 2").
  function players() {
    const used = new Map();
    return seats.map((s, i) => {
      if (s.type === 'child') return { name: s.name.trim().slice(0, MAX_NAME) || 'Player ' + (i + 1), level: s.level };
      const base = character(s.strength).name;
      const k = (used.get(base) || 0) + 1;
      used.set(base, k);
      return { name: k > 1 ? base + ' ' + k : base, level: s.level, computer: true, strength: s.strength };
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const picked = form.querySelector('input[name="board"]:checked');
    if (!picked) { toast('Choose a board.'); return; }
    if (!seats.some((s) => s.type === 'child')) {
      seatError.textContent = 'At least one player must be a child. Change a computer player to Child.';
      seatsEl.querySelector('[data-type]').focus();
      return;
    }
    const choice = { board: picked.value, level: prev.level, helper: helperBox.checked, seats: seats.map((s) => ({ ...s })) };
    saveSetup(choice);
    const current = savedGame();
    if (current && !current.state.over) {
      const ok = await ask('Start a new game?', 'Your saved game will be replaced.', 'Start new game', 'Keep my saved game');
      if (!ok) return;
    }
    const start = main.querySelector('[data-start]');
    start.disabled = true;
    try {
      const env = await gameEnv(choice.board);
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      saveGame(newGame({ board: choice.board, seed, level: seats[0].level, helper: choice.helper, players: players() }, env));
      location.hash = '#/play';
    } catch (err) {
      console.error(err);
      toast('The game did not load. Check your connection and try again.');
      start.disabled = false;
    }
  });
}
