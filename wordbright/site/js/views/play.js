// The game screen: board, rack, turn controls, and the pass-the-device screen
// between turns. The engine decides everything; this file only shows it.
import { play, swap, pass, checkPlay, starCheck } from '../engine/game.js';
import { scoreMove, RACK_SIZE } from '../engine/score.js';
import { checkMove } from '../engine/rules.js';
import { tilesLeft, BLANK } from '../engine/bag.js';
import { level } from '../engine/levels.js';
import { gameEnv } from '../data.js';
import { savedGame, saveGame } from '../store.js';
import { esc, ICON, toast, ask, pickLetter, isPhone } from '../ui/dom.js';
import { boardHtml, legendHtml, squareInner, squareLabel, squareClass, tileHtml } from '../ui/board.js';
import { enableDrag } from '../ui/drag.js';
import { starEntry, starCardHtml, wordsHtml, scoresHtml } from '../ui/moves.js';

const LENS = 1; // the phone preview shows the chosen square and one square each side
const ROOMY = 44; // px: squares this big show their names as well as icons
const anyWord = () => true; // word helper off: check where the tiles are, not the words

export function playView(main) {
  const saved = savedGame();
  if (!saved) { main.innerHTML = noGameHtml(); return null; }
  let state = saved.state;
  if (state.over) { location.hash = '#/end'; return null; }
  if (state.board === 'large' && isPhone()) {
    main.innerHTML = '<section class="wrap page"><div class="card empty">' + ICON.lock
      + '<h1>Needs a tablet or computer</h1><p class="muted">The Large board is too big for a phone screen. Carry on this game on a tablet or computer, or start a new game on the Junior or Standard board.</p>'
      + '<a class="btn btn--primary" href="#/new">New game</a></div></section>';
    return null;
  }

  main.innerHTML = '<section class="wrap page"><p class="muted">Getting the board ready…</p></section>';
  let env = null;
  let alive = true;
  const stops = [];
  const lists = [...new Set(state.players.map((p) => level(p.level).player))];
  gameEnv(state.board, lists).then((e) => {
    if (!alive) return;
    env = e;
    handoff(null);
  }).catch((err) => {
    console.error(err);
    if (alive) main.innerHTML = '<section class="wrap page"><div class="card empty"><h1>The game did not load</h1><p class="muted">Check your connection, then reload the page.</p></div></section>';
  });

  const stopAll = () => { while (stops.length) stops.pop()(); };
  const player = () => state.players[state.turn];

  // ---- Between turns: what just happened, then "pass the device" -------
  function handoff(last) {
    stopAll();
    const next = player();
    let moveCard = '';
    if (last) {
      let body = '';
      if (last.type === 'play') {
        const stars = last.score.words.filter((w) => w.star).map((w) => starEntry(env.starWords, w.word)).filter(Boolean);
        body = '<h2>' + esc(last.name) + ' scored ' + last.score.total + '</h2>' + wordsHtml(last.score)
          + stars.map((s) => starCardHtml(s, { pop: true })).join('');
      } else if (last.type === 'swap') {
        body = '<h2>' + esc(last.name) + ' swapped ' + last.count + (last.count === 1 ? ' tile' : ' tiles') + '</h2>';
      } else {
        body = '<h2>' + esc(last.name) + ' passed</h2>';
      }
      moveCard = '<div class="card movecard" aria-live="polite">' + body + '</div>';
    }
    const over = state.over;
    const ready = over
      ? '<div class="card handoff__card"><h1>The game is over</h1><a class="btn btn--primary" href="#/end">See the final scores' + ICON.arrow + '</a></div>'
      : '<div class="card handoff__card"><span class="eyebrow">Next turn</span>'
        + '<h1>Pass the device to ' + esc(next.name) + '</h1>'
        + '<p class="muted">' + esc(next.name) + ', your tiles are hidden until you are ready.</p>'
        + '<button type="button" class="btn btn--primary" data-ready>Show my tiles' + ICON.arrow + '</button></div>';
    main.innerHTML = '<section class="wrap page handoff">' + moveCard + ready
      + '<div class="card handoff__scores">' + scoresHtml(state, { bag: tilesLeft(state.bag) }) + '</div></section>';
    const btn = main.querySelector('[data-ready]');
    if (btn) {
      btn.addEventListener('click', turn);
      btn.focus();
    } else main.querySelector('a.btn').focus();
  }

  // ---- One player's turn --------------------------------------------------
  function turn() {
    stopAll();
    const board = env.board;
    const n = board.size;
    const values = env.tiles.values;
    const phone = isPhone();
    const ui = {
      order: player().rack.map((_, i) => i), // display order of rack positions
      pending: [], // { idx, i, letter, blank }
      selected: null,
      cursor: null,
      dir: 'across',
      swapping: false,
      swapSel: new Set(),
      error: '',
    };
    const empty = state.cells.every((c) => c === null);
    ui.cursor = empty ? Math.min(...board.start) : Math.floor(n / 2) * n + Math.floor(n / 2);

    main.innerHTML = '<section class="wrap wrap--game page game" data-game>'
      + '<h1 class="sr">' + esc(player().name) + '’s turn</h1>'
      + '<div class="game__scores" data-scores></div>'
      + '<div class="game__board">' + boardHtml(board, board.title + ' board, ' + n + ' by ' + n) + '</div>'
      + '<div class="game__legend">' + legendHtml(board) + '</div>'
      + '<div class="game__side">'
      + '<div class="look"><div class="lens" data-lens aria-hidden="true"></div>'
      + '<p class="preview" data-preview role="status" aria-live="polite"></p></div>'
      + '<div class="rack" data-rack-zone role="group" aria-label="Your tiles"></div>'
      + '<div class="controls" data-controls></div>'
      + '<p class="keyhelp small muted">' + (phone ? 'Tap a tile, then tap a square. Tap a placed tile to take it back.'
        : 'Drag tiles to the board, or choose a tile and then a square. Keyboard: arrows move, type a letter to place it, Backspace takes it back, Enter plays.') + '</p>'
      + '</div></section>';

    const root = main.querySelector('[data-game]');
    const boardEl = root.querySelector('[data-board]');
    const sqEls = [...boardEl.querySelectorAll('[data-sq]')];
    const rackEl = root.querySelector('[data-rack-zone]');
    const controlsEl = root.querySelector('[data-controls]');
    const previewEl = root.querySelector('[data-preview]');
    const lensEl = root.querySelector('[data-lens]');
    const scoresEl = root.querySelector('[data-scores]');
    boardEl.style.setProperty('--n', n);
    lensEl.style.setProperty('--n', 2 * LENS + 1);

    const pendingAt = (i) => ui.pending.find((p) => p.i === i) || null;
    const isPending = (idx) => ui.pending.some((p) => p.idx === idx);
    const filled = (i) => !!state.cells[i] || !!pendingAt(i);
    const tileAt = (i) => {
      const p = pendingAt(i);
      return p ? { letter: p.letter, blank: p.blank, pending: true } : state.cells[i];
    };
    const placedTiles = () => ui.pending.map((p) => ({ r: Math.floor(p.i / n), c: p.i % n, letter: p.letter, blank: p.blank }));

    // Square size decides whether the names fit.
    const ro = new ResizeObserver(() => {
      const w = boardEl.getBoundingClientRect().width / n;
      boardEl.classList.toggle('board--roomy', w >= ROOMY);
    });
    ro.observe(boardEl);
    stops.push(() => ro.disconnect());

    // ---- Drawing ----
    function drawBoard() {
      sqEls.forEach((el, i) => {
        const t = tileAt(i);
        const html = squareInner(board, i, t, values);
        if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
        el.setAttribute('aria-label', squareLabel(board, i, t));
        el.classList.toggle('has-tile', !!t);
        el.classList.toggle('is-pending', !!(t && t.pending));
        el.classList.toggle('is-cursor', i === ui.cursor);
        el.tabIndex = i === ui.cursor ? 0 : -1;
      });
    }

    function drawLens() {
      if (!phone || ui.cursor == null) { lensEl.hidden = true; return; }
      lensEl.hidden = false;
      const r0 = Math.floor(ui.cursor / n);
      const c0 = ui.cursor % n;
      let html = '';
      for (let r = r0 - LENS; r <= r0 + LENS; r++) {
        for (let c = c0 - LENS; c <= c0 + LENS; c++) {
          if (r < 0 || c < 0 || r >= n || c >= n) { html += '<span class="lens__off"></span>'; continue; }
          const i = r * n + c;
          const t = tileAt(i);
          html += '<span class="' + squareClass(board, i) + (t ? ' has-tile' : '') + (i === ui.cursor ? ' is-cursor' : '') + '">' + squareInner(board, i, t, values) + '</span>';
        }
      }
      lensEl.innerHTML = html;
    }

    function drawRack() {
      const rack = player().rack;
      const hadFocus = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-rack]');
      const focusIdx = hadFocus ? hadFocus.dataset.rack : null;
      const shown = ui.order.filter((idx) => !isPending(idx));
      let html = shown.map((idx) => {
        const t = rack[idx];
        const on = ui.swapping ? ui.swapSel.has(idx) : ui.selected === idx;
        const name = t === BLANK ? 'Blank tile' : 'Tile ' + t.toUpperCase() + ', ' + values[t] + (values[t] === 1 ? ' point' : ' points');
        return '<button type="button" class="rackbtn' + (on ? ' is-on' : '') + '" data-rack="' + idx + '" aria-pressed="' + on + '" aria-label="' + esc(name) + '">'
          + tileHtml(t, { value: values[t], blank: false }) + '</button>';
      }).join('');
      for (let k = shown.length; k < RACK_SIZE; k++) html += '<span class="rackslot" aria-hidden="true"></span>';
      rackEl.innerHTML = html;
      if (focusIdx != null) {
        const again = rackEl.querySelector('[data-rack="' + focusIdx + '"]');
        if (again) again.focus();
      }
    }

    function drawControls() {
      const bag = tilesLeft(state.bag);
      if (ui.swapping) {
        const k = ui.swapSel.size;
        controlsEl.innerHTML = '<p class="small"><b>Swap:</b> choose the tiles to put back in the bag.</p>'
          + '<div class="btnrow"><button type="button" class="btn btn--primary" data-act="swap-go"' + (k ? '' : ' disabled') + '>Swap ' + (k || '') + (k === 1 ? ' tile' : ' tiles') + '</button>'
          + '<button type="button" class="btn btn--ghost" data-act="swap-cancel">Cancel</button></div>';
        return;
      }
      const none = ui.pending.length === 0;
      const canSwap = bag >= RACK_SIZE;
      controlsEl.innerHTML = '<div class="controls__row">'
        + '<button type="button" class="btn btn--quiet btn--small" data-act="shuffle">' + ICON.shuffle + 'Shuffle</button>'
        + '<button type="button" class="btn btn--quiet btn--small" data-act="recall"' + (none ? ' disabled' : '') + '>' + ICON.recall + 'Recall</button>'
        + '<button type="button" class="btn btn--quiet btn--small" data-act="swap"' + (canSwap ? '' : ' disabled aria-describedby="swapnote"') + '>' + ICON.swap + 'Swap</button>'
        + '<button type="button" class="btn btn--quiet btn--small" data-act="pass">' + ICON.pass + 'Pass</button>'
        + '</div>'
        + '<button type="button" class="btn btn--primary btn--play" data-act="play"' + (none ? ' disabled' : '') + '>' + ICON.play + 'Play</button>'
        + (canSwap ? '' : '<p class="small muted" id="swapnote">You can swap only while the bag has at least 7 tiles.</p>');
    }

    function drawPreview() {
      previewEl.classList.toggle('is-error', !!ui.error);
      if (ui.error) { previewEl.textContent = ui.error; return; }
      if (ui.swapping) { previewEl.textContent = ''; return; }
      if (!ui.pending.length) {
        previewEl.textContent = empty
          ? (board.start.size > 1 ? 'Your first word must cover one of the start squares in the middle.' : 'Your first word must cover the start square in the middle.')
          : 'Make a word that joins the words on the board.';
        return;
      }
      const tiles = placedTiles();
      if (state.config.helper === false) {
        // Points only; whether the words are allowed shows when Play is pressed.
        const res = checkMove(board, state.cells, tiles, anyWord);
        if (!res.ok) { previewEl.textContent = res.message; return; }
        const sc = scoreMove(board, values, res.words, tiles.length);
        const words = sc.words.map((w) => w.word.toUpperCase() + ' (?) ' + w.points).join(', ');
        previewEl.innerHTML = esc(words) + (sc.fullRack ? ', full-rack bonus +30' : '') + ' — <b>' + sc.total + (sc.total === 1 ? ' point' : ' points') + '</b> if allowed';
        return;
      }
      const res = checkPlay(state, tiles, env);
      if (!res.ok) { previewEl.textContent = res.message; return; }
      const sc = scoreMove(board, values, res.words, tiles.length, starCheck(player(), env));
      const words = sc.words.map((w) => w.word.toUpperCase() + ' ' + w.points + (w.star ? ' (Star word +5)' : '')).join(', ');
      previewEl.innerHTML = esc(words) + (sc.fullRack ? ', full-rack bonus +30' : '') + ' — <b>' + sc.total + (sc.total === 1 ? ' point' : ' points') + '</b>';
    }

    function refresh() {
      scoresEl.innerHTML = scoresHtml(state, { bag: tilesLeft(state.bag) });
      drawBoard();
      drawLens();
      drawRack();
      drawControls();
      drawPreview();
    }

    // ---- Changing the move ----
    async function place(idx, i) {
      if (filled(i) || isPending(idx)) return false;
      let letter = player().rack[idx];
      let blank = false;
      if (letter === BLANK) {
        const chosen = await pickLetter();
        if (!alive) return false;
        if (!chosen || filled(i)) { focusSquare(i); return false; }
        letter = chosen;
        blank = true;
      }
      ui.pending.push({ idx, i, letter, blank });
      ui.selected = null;
      ui.error = '';
      ui.cursor = i;
      refresh();
      return true;
    }
    function recall(i) {
      ui.pending = ui.pending.filter((p) => p.i !== i);
      ui.error = '';
      refresh();
    }
    function recallAll() {
      ui.pending = [];
      ui.error = '';
    }
    function setCursor(i, focus = true) {
      ui.cursor = i;
      drawBoard();
      drawLens();
      if (focus) sqEls[i].focus();
    }
    function focusSquare(i) {
      setCursor(i, true);
    }

    // ---- Board: click/tap ----
    boardEl.addEventListener('click', (e) => {
      const el = e.target.closest('[data-sq]');
      if (!el || drag.justDragged() || ui.swapping) return;
      const i = Number(el.dataset.sq);
      if (pendingAt(i)) { recall(i); setCursor(i); return; }
      if (!state.cells[i] && ui.selected != null) { place(ui.selected, i); return; }
      setCursor(i);
    });

    // ---- Board: keyboard ----
    const step = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
    function nextEmpty(from) {
      const [dr, dc] = ui.dir === 'across' ? [0, 1] : [1, 0];
      let r = Math.floor(from / n);
      let c = from % n;
      while (true) {
        r += dr; c += dc;
        if (r >= n || c >= n) return from;
        if (!filled(r * n + c)) return r * n + c;
      }
    }
    boardEl.addEventListener('keydown', async (e) => {
      const el = e.target.closest('[data-sq]');
      if (!el || e.metaKey || e.ctrlKey || e.altKey || ui.swapping) return;
      const i = Number(el.dataset.sq);
      if (step[e.key]) {
        e.preventDefault();
        const [dr, dc] = step[e.key];
        ui.dir = dr ? 'down' : 'across';
        const r = Math.min(n - 1, Math.max(0, Math.floor(i / n) + dr));
        const c = Math.min(n - 1, Math.max(0, (i % n) + dc));
        setCursor(r * n + c);
      } else if (/^[a-z]$/i.test(e.key)) {
        e.preventDefault();
        const letter = e.key.toLowerCase();
        const rack = player().rack;
        let target = i;
        if (filled(target)) target = nextEmpty(target);
        if (filled(target)) return;
        let idx = ui.order.find((k) => !isPending(k) && rack[k] === letter);
        let blank = false;
        if (idx === undefined) { idx = ui.order.find((k) => !isPending(k) && rack[k] === BLANK); blank = true; }
        if (idx === undefined) { ui.error = 'You do not have ' + letter.toUpperCase() + ' in your rack.'; drawPreview(); return; }
        ui.pending.push({ idx, i: target, letter, blank });
        ui.error = '';
        ui.cursor = nextEmpty(target);
        refresh();
        sqEls[ui.cursor].focus();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        const last = ui.pending[ui.pending.length - 1];
        if (!last) return;
        ui.pending.pop();
        ui.error = '';
        ui.cursor = last.i;
        refresh();
        sqEls[last.i].focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });

    // ---- Rack ----
    rackEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rack]');
      if (!b || drag.justDragged()) return;
      const idx = Number(b.dataset.rack);
      if (ui.swapping) {
        if (ui.swapSel.has(idx)) ui.swapSel.delete(idx); else ui.swapSel.add(idx);
        refresh();
        return;
      }
      ui.selected = ui.selected === idx ? null : idx;
      refresh();
    });

    // ---- Drag and drop (mouse anywhere; touch on tablets and bigger) ----
    const drag = enableDrag(root, {
      sources: '[data-rack], .sq.is-pending',
      targets: '[data-sq], [data-rack-zone]',
      canStart: (el, e) => !ui.swapping && (e.pointerType === 'mouse' || !isPhone()),
      ghost: (el) => {
        const g = document.createElement('div');
        g.innerHTML = el.querySelector('.tile').outerHTML;
        return g;
      },
      drop: (src, target) => {
        const from = src.dataset.rack != null ? { idx: Number(src.dataset.rack) } : pendingAt(Number(src.dataset.sq));
        if (!from || !target) return;
        if (target.dataset.rackZone != null || target.closest('[data-rack-zone]')) {
          if (from.i != null) recall(from.i);
          return;
        }
        const i = Number(target.dataset.sq);
        if (from.i != null) {
          if (filled(i)) return;
          from.i = i; // move a tile placed this turn
          ui.cursor = i;
          ui.error = '';
          refresh();
        } else place(from.idx, i);
      },
    });
    stops.push(() => drag.stop());

    // ---- Controls ----
    controlsEl.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      const act = b.dataset.act;
      if (act === 'shuffle') {
        const o = ui.order;
        for (let k = o.length - 1; k > 0; k--) {
          const j = Math.floor(Math.random() * (k + 1));
          [o[k], o[j]] = [o[j], o[k]];
        }
        refresh();
      } else if (act === 'recall') {
        recallAll();
        refresh();
      } else if (act === 'swap') {
        recallAll();
        ui.selected = null;
        ui.swapping = true;
        ui.swapSel.clear();
        refresh();
        const first = rackEl.querySelector('[data-rack]');
        if (first) first.focus();
      } else if (act === 'swap-cancel') {
        ui.swapping = false;
        refresh();
      } else if (act === 'swap-go') {
        const rack = player().rack;
        const letters = [...ui.swapSel].map((idx) => rack[idx]);
        const res = swap(state, letters, env);
        if (!res.ok) { toast(res.message); return; }
        finish(res, { type: 'swap', count: letters.length });
      } else if (act === 'pass') {
        const ok = await ask('Pass this turn?', 'You will not score this turn.', 'Pass', 'Keep playing');
        if (!ok || !alive) return;
        const res = pass(state, env);
        if (res.ok) finish(res, { type: 'pass' });
      } else if (act === 'play') {
        submit();
      }
    });

    function submit() {
      if (!ui.pending.length) return;
      const res = play(state, placedTiles(), env);
      if (!res.ok) {
        // Tiles stay where they are; show the engine's hint.
        ui.error = res.message;
        drawPreview();
        toast(res.message);
        return;
      }
      finish(res, { type: 'play', score: res.score });
    }

    function finish(res, last) {
      last.name = player().name;
      state = res.state;
      saveGame(state);
      handoff(last);
      window.scrollTo(0, 0);
    }

    refresh();
    sqEls[ui.cursor].tabIndex = 0;
  }

  return () => { alive = false; stopAll(); };
}

function noGameHtml() {
  return '<section class="wrap page"><div class="card empty"><h1>No game in progress</h1>'
    + '<p class="muted">Start a new game to play.</p><a class="btn btn--primary" href="#/new">New game</a></div></section>';
}
