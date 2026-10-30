// Wordbright style options: static mock-ups (W2a). Not the live game.
// One script draws the start, play and end screens for every option, from a
// fixed game: Maya against Ottie on the Standard board. Each option's CSS does
// the rest. A classic script (not a module) so the pages also open from disk.
// No inline styles: sizes are set with el.style.setProperty, as in the game.
(function () {
  'use strict';

  const root = document.documentElement;
  const OPTION = root.dataset.option; // a | b | c
  const SCREEN = document.body.dataset.screen; // start | play | end
  const params = new URLSearchParams(location.search);

  // Theme: ?theme=light|dark, else the device. Night sky is dark unless asked.
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = params.get('theme') || (OPTION === 'c' ? 'dark' : (dark ? 'dark' : 'light'));
  if (params.has('freeze')) root.classList.add('freeze'); // screenshots: hold the celebration mid-burst

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // ---- Icons (copied from wordbright/site/js/ui/dom.js and board.js) --------
  const ICON = {
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3c4 0 6 10 10 10h3M4 17h3c1.6 0 2.8-1.6 3.9-3.6M14 9.6C15 8.1 16 7 17 7h3M17 4l3 3-3 3M17 14l3 3-3 3"/></svg>',
    recall: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
    swap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v14M3 14l4 4 4-4M17 20V6M13 10l4-4 4 4"/></svg>',
    pass: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12M13 7l5 5-5 5"/><path d="M21 5v14"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>',
    level: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4v-5H4zM10 20h4v-9h-4zM16 20h4V5h-4z"/></svg>',
  };
  const SVG = (d) => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + d + '</svg>';
  const SQUARE_ICON = {
    Spark: SVG('<path d="M12 3.5l1.9 6.6 6.6 1.9-6.6 1.9-1.9 6.6-1.9-6.6-6.6-1.9 6.6-1.9z"/>'),
    Glow: SVG('<circle cx="12" cy="12" r="4.2"/><path class="ray" d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/>'),
    Shine: SVG('<path d="M7 4.5h10l3.5 5L12 20 3.5 9.5z"/><path class="cut" d="M3.8 9.5h16.4M9.4 4.8L12 9.5l2.6-4.7M12 9.5V19.4"/>'),
    Star: SVG('<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/>'),
  };
  const SQUARE_TEXT = {
    Spark: 'the letter counts twice',
    Glow: 'the letter counts three times',
    Shine: 'the whole word counts twice',
    Star: 'the whole word counts three times',
  };

  // ---- Fixed data (from wordbright/site/data) ------------------------------
  const VALUES = { a: 2, b: 3, c: 3, d: 2, e: 1, f: 4, g: 3, h: 3, i: 2, j: 6, k: 4, l: 2, m: 3, n: 2, o: 2, p: 3, q: 7, r: 2, s: 1, t: 2, u: 3, v: 5, w: 4, x: 6, y: 4, z: 6 };
  const BOARD = {
    size: 13, start: [6, 6],
    grid: ['G.S.......S.G', '.T..H...H..T.', 'S..S..G..S..S', '..S..S.S..S..', '.H..H...H..H.', '...S.....S...',
      '..G...*...G..', '...S.....S...', '.H..H...H..H.', '..S..S.S..S..', 'S..S..G..S..S', '.T..H...H..T.', 'G.S.......S.G'],
  };
  const KIND = { S: 'Spark', G: 'Glow', H: 'Shine', T: 'Star' };
  // Moves so far: PLANT (Maya), PEN (Ottie), NEST (Maya), ON (Ottie), then HEART (Maya, just played).
  const TILES = [
    [6, 4, 'p'], [6, 5, 'l'], [6, 6, 'a'], [6, 7, 'n'], [6, 8, 't'],
    [7, 4, 'e'], [8, 4, 'n'],
    [8, 5, 'e'], [8, 6, 's'], [8, 7, 't'],
    [5, 7, 'o'],
    [2, 8, 'h', 'new'], [3, 8, 'e', 'new'], [4, 8, 'a', 'new'], [5, 8, 'r', 'new'],
  ];
  const RACK = ['s', 'i', 'l', 'e', 'n', 'c', '?'];

  const CHARACTERS = [
    { id: 'pip', name: 'Pip', animal: 'dormouse', label: 'Easy', about: 'A sleepy dormouse. Plays easy words and sometimes swaps.' },
    { id: 'ottie', name: 'Ottie', animal: 'otter', label: 'Normal', about: 'A friendly otter. Plays good words, not always the best.' },
    { id: 'bramble', name: 'Bramble', animal: 'badger', label: 'Hard', about: 'A wise badger. Plays the highest-scoring word it can find.' },
    { id: 'fizz', name: 'Fizz', animal: 'magpie', label: 'Crazy', about: 'A quick magpie. Scores big and keeps good letters for next time.' },
  ];
  const ART = '../../../wordbright/site/assets/characters/';

  // Star words use the child meaning from star_words.json; others the WordNet/house entry.
  const WORDS = {
    heart: { ipa: '/hɑːt/', pos: 'noun', meaning: 'The part inside your chest that pumps blood; the shape ♥.', example: 'Your heart beats faster when you run.' },
    or: { ipa: '/ɔː/', pos: 'conjunction', meaning: 'Used to show a choice between things.', example: 'Tea or juice?' },
    silence: { ipa: '/ˈsaɪləns/', pos: 'noun', meaning: 'The state of being silent (as when no one is speaking).', example: 'There was a shocked silence.' },
    earth: { ipa: '/ɜːθ/', pos: 'noun', meaning: 'Our planet; also the ground or soil.', example: 'The Earth goes around the Sun.' },
  };

  // ---- Pieces --------------------------------------------------------------
  function face(ch, mood, cls, alt) {
    const src = ART + ch.id + '-' + mood + '-';
    return '<img class="' + cls + '" src="' + src + '128.webp" srcset="' + src + '128.webp 1x, ' + src + '256.webp 2x" width="128" height="128" alt="'
      + (alt ? esc(ch.name + ' the ' + ch.animal) : '') + '">';
  }

  function tile(letter, { pending = false, extra = '' } = {}) {
    const blank = letter === '?';
    return '<span class="tile' + (blank ? ' tile--blank' : '') + (pending ? ' tile--pending' : '') + (extra ? ' ' + extra : '') + '">'
      + '<span class="tile__l">' + (blank ? '' : letter.toUpperCase()) + '</span>'
      + (blank ? '' : '<span class="tile__v">' + VALUES[letter] + '</span>') + '</span>';
  }

  function boardHtml() {
    const at = new Map(TILES.map(([r, c, l, f]) => [r * BOARD.size + c, { l, f }]));
    let html = '<div class="board" role="grid" aria-label="Standard board, 13 by 13">';
    for (let r = 0; r < BOARD.size; r++) {
      html += '<div role="row" class="board__row">';
      for (let c = 0; c < BOARD.size; c++) {
        const i = r * BOARD.size + c;
        const ch = BOARD.grid[r][c];
        const kind = KIND[ch] || '';
        const t = at.get(i);
        let inner = '';
        if (t) inner = tile(t.l);
        else if (ch === '*') inner = '<span class="sq__start"></span>';
        else if (kind) inner = '<span class="sq__icon">' + SQUARE_ICON[kind] + '</span><span class="sq__label">' + kind + '</span>';
        html += '<div role="gridcell" class="board__cell"><span class="sq' + (kind ? ' sq--' + kind.toLowerCase() : '') + (ch === '*' ? ' sq--start' : '')
          + (t && t.f === 'new' ? ' is-new' : '') + '">' + inner + '</span></div>';
      }
      html += '</div>';
    }
    return html + '</div>';
  }

  function legendHtml() {
    return '<ul class="legend" aria-label="What the squares do">'
      + ['Spark', 'Glow', 'Shine', 'Star'].map((k) => '<li><span class="sq sq--' + k.toLowerCase() + ' legend__sq"><span class="sq__icon">' + SQUARE_ICON[k] + '</span></span>'
        + '<span><b>' + k + '</b> ' + SQUARE_TEXT[k] + '</span></li>').join('')
      + '<li><span class="sq sq--start legend__sq"><span class="sq__start"></span></span><span><b>Start</b> the first word covers this square</span></li></ul>';
  }

  // The celebration: a burst of small pieces (petals, paint or stars, by option).
  function burstHtml(n = 12, spread = 1) {
    let html = '<span class="burst" data-spread="' + spread + '" aria-hidden="true">';
    for (let k = 0; k < n; k++) html += '<i data-k="' + k + '"></i>';
    return html + '</span>';
  }
  function placeBursts() {
    document.querySelectorAll('.burst').forEach((b) => {
      const pieces = b.querySelectorAll('i');
      pieces.forEach((p, k) => {
        const a = (k / pieces.length) * Math.PI * 2 + (k % 2 ? 0.25 : -0.1);
        const d = (30 + (k % 3) * 13) * Number(b.dataset.spread || 1);
        p.style.setProperty('--dx', Math.round(Math.cos(a) * d) + 'px');
        p.style.setProperty('--dy', Math.round(Math.sin(a) * d - 8) + 'px');
        p.style.setProperty('--rot', ((k * 67) % 360) + 'deg');
        p.style.setProperty('--delay', (k % 4) * 40 + 'ms');
      });
    });
  }
  // Tap the +5 (or the cheering player) to see it again.
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-replay]');
    if (!t) return;
    const host = t.closest('.celebrate');
    host.classList.remove('is-on');
    void host.offsetWidth;
    host.classList.add('is-on');
  });

  function wordRow(word, { star = false, points = null, by = '', party = false } = {}) {
    const w = WORDS[word];
    return '<li class="wordrow' + (star ? ' wordrow--star' : '') + '">'
      + '<div class="wordrow__head"><span class="wordrow__word" lang="en-GB">' + word.toUpperCase() + '</span>'
      + (star ? '<span class="celebrate' + (party ? ' is-on' : '') + '"><button type="button" class="plus5" data-replay aria-label="Star word, 5 extra points">'
        + '<span class="plus5__icon">' + ICON.star + '</span>+5</button>' + burstHtml() + '</span>' : '')
      + (points == null ? '' : '<span class="wordrow__pts">' + points + '<span class="sr"> points</span></span>')
      + '</div>'
      + (by ? '<p class="small muted wordrow__by">' + esc(by) + '</p>' : '')
      + '<div class="wordrow__say"><span class="wordrow__ipa" lang="en-GB-fonipa">' + w.ipa + '</span>'
      + '<button type="button" class="btn btn--quiet btn--small wordrow__hear">' + ICON.speaker + 'Hear<span class="sr"> ' + word + '</span></button></div>'
      + '<p class="wordrow__pos small muted">' + w.pos + '</p>'
      + '<p class="wordrow__meaning">' + esc(w.meaning) + '</p>'
      + '<p class="example">' + esc(w.example) + '</p>'
      + '<a class="small wordrow__look" href="#">Look it up' + ICON.external + '</a>'
      + '</li>';
  }

  // ---- Header and footer ---------------------------------------------------
  const OPTIONS = { a: 'A · Sunny garden', b: 'B · Paint box', c: 'C · Night sky' };
  const DIRS = { a: 'a-sunny-garden', b: 'b-paint-box', c: 'c-night-sky' };

  function header() {
    return '<a class="skip" href="#main">Skip to content</a>'
      + '<header class="topbar"><div class="topbar__inner">'
      + '<a class="brand" href="start.html">'
      + '<svg class="brand__mark" viewBox="0 0 100 100" aria-hidden="true"><path d="M16 34 L34 70 L50 26 L66 70 L84 34" class="brand__stroke"/><circle cx="50" cy="20" r="7.5" class="brand__dot"/></svg>'
      + '<span class="brand__words"><span class="brand__name">Waystead</span><span class="brand__product">Wordbright</span></span></a>'
      + '<nav class="topbar__nav" aria-label="Main"><a href="play.html"' + (SCREEN === 'play' ? ' aria-current="page"' : '') + '>New game</a><a href="#">How to play</a><a href="#">For parents</a></nav>'
      + '<a class="iconbtn allgames" href="#">' + ICON.grid + '<span class="allgames__text">All games</span></a>'
      + '<button type="button" class="iconbtn" data-theme-toggle aria-label="Change theme">' + (root.dataset.theme === 'dark' ? ICON.sun : ICON.moon) + '</button>'
      + '</div></header>';
  }

  function footer() {
    const links = ['start', 'play', 'end'].map((s) => '<a href="' + s + '.html"' + (s === SCREEN ? ' aria-current="page"' : '') + '>' + s[0].toUpperCase() + s.slice(1) + '</a>').join(' · ');
    const others = Object.keys(OPTIONS).filter((k) => k !== OPTION).map((k) => '<a href="../' + DIRS[k] + '/' + SCREEN + '.html">' + OPTIONS[k] + '</a>').join(' · ');
    return '<footer class="foot"><div class="wrap foot__inner">'
      + '<p><b>Mock-up, style option ' + OPTIONS[OPTION] + '.</b> Screens: ' + links + '</p>'
      + '<p class="small">Other options: ' + others + ' · <a href="../index.html">All options</a></p>'
      + '</div></footer>';
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-theme-toggle]')) return;
    const p = new URLSearchParams(location.search);
    p.set('theme', root.dataset.theme === 'dark' ? 'light' : 'dark');
    location.search = p.toString();
  });

  // ---- Screens -------------------------------------------------------------
  function start() {
    const faces = CHARACTERS.map((ch, i) => '<figure class="face face--' + (i + 1) + ' face--' + ch.id + '"><span class="face__frame">'
      + face(ch, 'portrait', 'face__img', true) + '</span><figcaption class="face__name">' + ch.name + '</figcaption></figure>').join('');
    const word = ['w', 'o', 'r', 'd'].map((l, i) => '<span class="hero__t">' + tile(l, { pending: i === 3 }) + '</span>').join('');
    const players = CHARACTERS.map((ch) => '<li class="card player player--' + ch.id + '"><span class="player__frame">' + face(ch, 'portrait', 'player__pic', false) + '</span>'
      + '<div class="player__text"><h3>' + ch.name + '</h3><span class="pill">' + ch.label + '</span>'
      + '<p class="small muted">' + ch.about + '</p></div></li>').join('');
    const why = [
      [ICON.star, 'Star words: +5', 'Words from the school spelling lists score 5 extra points. You also see what each one means.'],
      [ICON.level, 'A word level for each player', 'From Year 1 to Doctor. It sets which Star words count, and how many words a computer player knows.'],
      [ICON.bulb, '3 hints per game', 'Stuck? A hint shows a good word you can make with your tiles.'],
    ].map(([i, t, p]) => '<li class="why__item"><span class="why__icon">' + i + '</span><div><h3>' + t + '</h3><p class="muted">' + p + '</p></div></li>').join('');
    return '<section class="wrap page home">'
      + '<div class="hero"><div class="hero__copy stack">'
      + '<span class="eyebrow">Wordbright by Waystead</span>'
      + '<h1>Make words. Light up the board.</h1>'
      + '<p class="hero__lede">A word-tile game for 11+ practice. Play against Pip, Ottie, Bramble and Fizz, or with up to 4 people on one device. Find the bonus squares, and score extra for the school spelling words.</p>'
      + '<div class="btnrow"><a class="btn btn--primary" href="play.html">New game' + ICON.arrow + '</a><a class="btn btn--ghost" href="#">How to play</a></div></div>'
      + '<div class="hero__art"><span class="deco" aria-hidden="true"></span>' + faces + '<div class="hero__tiles" aria-hidden="true">' + word + '</div></div>'
      + '</div>'
      + '<section class="hsec"><h2>Meet the players</h2><p class="muted">Four computer players, from easy to very hard. Pick one or more when you start a game.</p>'
      + '<ul class="players">' + players + '</ul></section>'
      + '<section class="hsec"><h2>Why it helps</h2><ul class="card why">' + why + '</ul></section>'
      + '</section>';
  }

  function play() {
    const ottie = CHARACTERS[1];
    const rack = RACK.map((l) => '<button type="button" class="rackbtn" aria-label="' + (l === '?' ? 'blank' : l.toUpperCase()) + '">' + tile(l) + '</button>').join('');
    return '<section class="wrap wrap--game page game">'
      + '<h1 class="sr">Maya’s turn</h1>'
      + '<div class="game__main">'
      + '<div class="game__board">' + boardHtml() + '</div>'
      + '<div class="game__legend">' + legendHtml() + '</div></div>'
      + '<div class="game__panel">'
      + '<div class="game__scores"><ul class="scores">'
      + '<li class="scores__p is-turn"><span class="scores__me" aria-hidden="true">M</span>Maya <span class="scores__pts">46</span></li>'
      + '<li class="scores__p">' + face(ottie, 'portrait', 'scores__face', false) + 'Ottie <span class="scores__pts">16</span></li></ul>'
      + '<p class="bagcount small muted">Tiles in the bag: <b>63</b></p></div>'
      + '<div class="game__rack">'
      + '<p class="turnnote">Your turn, Maya. Make a word that joins the others.</p>'
      + '<div class="rack" role="group" aria-label="Your tiles">' + rack + '</div>'
      + '<div class="controls"><div class="controls__row">'
      + '<button type="button" class="btn btn--quiet btn--small">' + ICON.shuffle + 'Shuffle</button>'
      + '<button type="button" class="btn btn--quiet btn--small" disabled>' + ICON.recall + 'Recall</button>'
      + '<button type="button" class="btn btn--quiet btn--small">' + ICON.swap + 'Swap</button>'
      + '<button type="button" class="btn btn--quiet btn--small">' + ICON.pass + 'Pass</button></div>'
      + '<div class="controls__main"><button type="button" class="btn btn--ghost">' + ICON.bulb + 'Hint (3)</button>'
      + '<button type="button" class="btn btn--primary" disabled>' + ICON.play + 'Play</button></div></div>'
      + '</div>'
      + '<div class="game__side"><div class="card results">'
      + '<span class="eyebrow">Last turn</span><h2>Maya scored 29</h2>'
      + '<ul class="wordrows">' + wordRow('heart', { star: true, points: 20, party: true }) + wordRow('or', { points: 4 }) + '</ul>'
      + '<ul class="wordlines"><li class="wordline--bonus"><span>Star words</span><span>+5</span></li>'
      + '<li class="wordline--total"><span>Total</span><span>29</span></li></ul>'
      + '</div></div></div>'
      + '</section>';
  }

  function end() {
    const ottie = CHARACTERS[1];
    return '<section class="wrap page endgame">'
      + '<div class="endgame__top">'
      + '<div class="pagehead"><span class="eyebrow">Game over</span><h1>Maya wins!</h1><p class="muted">The bag is empty and Maya used every tile.</p></div>'
      + '<figure class="card cheer celebrate is-on"><button type="button" class="cheer__btn" data-replay aria-label="Cheer again">'
      + face(ottie, 'happy', 'cheer__media', false) + '</button>' + burstHtml(18, 2.6)
      + '<figcaption>Ottie is cheering for you!</figcaption></figure>'
      + '</div>'
      + '<div class="endgame__cols">'
      + '<div class="card final"><h2>Final scores</h2><ol class="final__list">'
      + '<li class="final__row is-winner"><span class="final__name"><span class="final__crown" aria-hidden="true">' + ICON.star + '</span>Maya</span><span class="final__note small muted">no tiles left</span><span class="final__pts">212</span></li>'
      + '<li class="final__row"><span class="final__name">' + face(ottie, 'portrait', 'final__face', false) + 'Ottie</span><span class="final__note small muted">minus 6 for tiles left</span><span class="final__pts">187</span></li>'
      + '</ol></div>'
      + '<div class="card bestword"><span class="eyebrow">Best word</span><ul class="wordrows">' + wordRow('silence', { points: 74, by: 'Maya' }) + '</ul></div>'
      + '<div class="card stars"><h2>Star words made</h2><ul class="wordrows">' + wordRow('heart', { star: true, by: 'Maya' }) + wordRow('earth', { star: true, by: 'Ottie' }) + '</ul></div>'
      + '</div>'
      + '<div class="btnrow"><a class="btn btn--primary" href="start.html">New game' + ICON.arrow + '</a>'
      + '<a class="btn btn--ghost" href="#">Practise these in Spellbright' + ICON.external + '</a></div>'
      + '</section>';
  }

  const body = { start, play, end }[SCREEN]();
  document.body.insertAdjacentHTML('afterbegin', header() + '<main id="main" tabindex="-1">' + body + '</main>' + footer());
  placeBursts();
})();
