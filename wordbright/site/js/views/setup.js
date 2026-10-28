// New-game screen: board, word level, word helper, players.
import { LEVELS, level, STAR_YEARS } from '../engine/levels.js';
import { MIN_PLAYERS, MAX_PLAYERS, newGame } from '../engine/game.js';
import { BOARD_IDS, BOARD_MINUTES, boardJson, gameEnv } from '../data.js';
import { savedGame, saveGame, lastSetup, saveSetup } from '../store.js';
import { esc, ICON, ask, isPhone, toast } from '../ui/dom.js';

const MAX_NAME = 16;

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
  return 'You can play ' + LIST_TEXT[l.player] + '; ' + starText(l.starYears) + '.';
}

function defaultSetup() {
  return { board: 'standard', level: 'year-5', helper: true, names: ['', ''] };
}

export function setup(main) {
  const prev = { ...defaultSetup(), ...(lastSetup() || {}) };
  const phone = isPhone();
  if (phone && prev.board === 'large') prev.board = 'standard';
  if (!LEVELS.some((l) => l.id === prev.level)) prev.level = 'year-5';
  prev.helper = prev.helper !== false;
  let names = (Array.isArray(prev.names) ? prev.names : ['', '']).slice(0, MAX_PLAYERS);
  while (names.length < MIN_PLAYERS) names.push('');

  const levelOptions = (from, to) => LEVELS.slice(from, to).map((l) =>
    '<option value="' + l.id + '"' + (l.id === prev.level ? ' selected' : '') + '>' + esc(l.label) + '</option>').join('');

  main.innerHTML = '<section class="wrap page setup">'
    + '<div class="pagehead"><span class="eyebrow">New game</span><h1>Set up a game</h1></div>'
    + '<form class="stack" data-form novalidate>'
    + '<fieldset class="card setting"><legend>Board</legend><div class="boards" data-boards></div></fieldset>'
    + '<fieldset class="card setting"><legend>Word level</legend>'
    + '<label class="field-label" for="level">Choose by school year or beyond</label>'
    + '<select id="level" class="field" data-level>'
    + '<optgroup label="School">' + levelOptions(0, 13) + '</optgroup>'
    + '<optgroup label="Beyond school">' + levelOptions(13) + '</optgroup></select>'
    + '<p class="muted small" data-level-text aria-live="polite"></p></fieldset>'
    + '<fieldset class="card setting"><legend>Word helper</legend>'
    + '<label class="switch"><input type="checkbox" role="switch" data-helper' + (prev.helper ? ' checked' : '') + ' aria-describedby="helper-text">'
    + '<span class="switch__track" aria-hidden="true"></span><span class="switch__label">Check words before Play</span></label>'
    + '<p class="muted small" id="helper-text" data-helper-text aria-live="polite"></p></fieldset>'
    + '<fieldset class="card setting"><legend>Players</legend>'
    + '<p class="muted small">Two to four people take turns on this device. Names are optional.</p>'
    + '<div class="seats" data-seats></div>'
    + '<div class="btnrow"><button type="button" class="btn btn--ghost btn--small" data-add>' + ICON.plus + 'Add a player</button>'
    + '<button type="button" class="btn btn--ghost btn--small" disabled aria-describedby="soon">Add a computer player</button></div>'
    + '<p class="muted small" id="soon">Computer players are coming soon.</p></fieldset>'
    + '<div class="btnrow"><button type="submit" class="btn btn--primary" data-start>Start game' + ICON.arrow + '</button></div>'
    + '</form></section>';

  const form = main.querySelector('[data-form]');
  const levelSel = main.querySelector('[data-level]');
  const levelTextEl = main.querySelector('[data-level-text]');
  const seats = main.querySelector('[data-seats]');
  const addBtn = main.querySelector('[data-add]');
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

  const showLevel = () => { levelTextEl.textContent = levelText(levelSel.value); };
  levelSel.addEventListener('change', showLevel);
  showLevel();

  const showHelper = () => {
    helperTextEl.textContent = helperBox.checked
      ? 'On: while you place tiles, the game says whether your words are allowed.'
      : 'Off: you see the points, but not whether a word is allowed until you press Play.';
  };
  helperBox.addEventListener('change', showHelper);
  showHelper();

  function readNames() {
    names = [...seats.querySelectorAll('input')].map((i) => i.value);
  }
  function drawSeats() {
    seats.innerHTML = names.map((n, i) => '<div class="seat">'
      + '<label for="p' + i + '">Player ' + (i + 1) + '</label>'
      + '<input id="p' + i + '" class="field" type="text" maxlength="' + MAX_NAME + '" autocomplete="off" placeholder="Player ' + (i + 1) + '" value="' + esc(n) + '">'
      + (names.length > MIN_PLAYERS ? '<button type="button" class="iconbtn" data-remove="' + i + '" aria-label="Remove player ' + (i + 1) + '">' + ICON.cross + '</button>' : '')
      + '</div>').join('');
    addBtn.disabled = names.length >= MAX_PLAYERS;
  }
  drawSeats();
  addBtn.addEventListener('click', () => {
    readNames();
    if (names.length < MAX_PLAYERS) names.push('');
    drawSeats();
    seats.querySelector('#p' + (names.length - 1)).focus();
  });
  seats.addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    readNames();
    names.splice(Number(b.dataset.remove), 1);
    drawSeats();
    addBtn.focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    readNames();
    const picked = form.querySelector('input[name="board"]:checked');
    if (!picked) { toast('Choose a board.'); return; }
    const choice = { board: picked.value, level: levelSel.value, helper: helperBox.checked, names };
    saveSetup(choice);
    const current = savedGame();
    if (current && !current.state.over) {
      const ok = await ask('Start a new game?', 'Your saved game will be replaced.', 'Start new game', 'Keep my saved game');
      if (!ok) return;
    }
    const start = main.querySelector('[data-start]');
    start.disabled = true;
    try {
      const lvl = level(choice.level);
      const env = await gameEnv(choice.board, [lvl.player]);
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      const players = names.map((n, i) => ({ name: n.trim().slice(0, MAX_NAME) || 'Player ' + (i + 1) }));
      saveGame(newGame({ board: choice.board, seed, level: choice.level, helper: choice.helper, players }, env));
      location.hash = '#/play';
    } catch (err) {
      console.error(err);
      toast('The game did not load. Check your connection and try again.');
      start.disabled = false;
    }
  });
}
