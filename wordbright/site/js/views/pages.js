// Text pages: how to play, for parents, not found.
import { BRAND } from '../brand.js';
import { esc, ICON, ask, askPin, toast } from '../ui/dom.js';
import { allowedWords, disallowWord, storedPin, savePin, forgetPin } from '../store.js';
import { makePin, checkPin, PIN_RE } from '../pin.js';
import { SQUARE_ICON, SQUARE_TEXT, KINDS } from '../ui/board.js';
import { dayStyleHtml, wireDayStyle } from '../ui/daystyle.js';

const WORD_COUNT = 'We accept about 177,000 British words; no names, places, abbreviations or American spellings.';

// Four small boards: lower case = a tile already on the board, upper case =
// a tile put down this turn, "." = an empty square.
const PLACEMENTS = [
  { ok: true, rows: ['.....', 'cat..', '..O..', '..P..'], text: 'One straight line that joins a word on the board (TOP).' },
  { ok: true, rows: ['...u.', '...p.', 'catS.', '.....'], text: 'One tile can make two words at once (CATS and UPS).' },
  { ok: false, rows: ['.....', 'catS.', '.....', 'O....'], text: 'Not allowed: tiles in two different places.' },
  { ok: false, rows: ['.....', 'cat..', '..O..', '..PS.'], text: 'Not allowed: an L-shape. Keep to one line.' },
];

function placementsHtml() {
  const boards = PLACEMENTS.map((p) => {
    const cells = p.rows.join('').split('').map((ch) => {
      if (ch === '.') return '<span class="pcell"></span>';
      const fresh = ch === ch.toUpperCase();
      return '<span class="pcell pcell--' + (fresh ? 'new' : 'old') + '">' + ch.toUpperCase() + '</span>';
    }).join('');
    return '<figure class="place place--' + (p.ok ? 'ok' : 'no') + '">'
      + '<div class="place__grid" aria-hidden="true">' + cells + '</div>'
      + '<figcaption><span class="place__mark">' + (p.ok ? ICON.play : ICON.cross) + '<span class="sr">' + (p.ok ? 'Allowed: ' : '') + '</span></span>'
      + esc(p.text) + '</figcaption></figure>';
  }).join('');
  return '<div class="places">' + boards + '</div>'
    + '<p class="small muted">Dark tiles were already on the board. Coloured tiles are the ones put down this turn.</p>';
}

export function rules(main) {
  const squares = KINDS.map((k) => '<li><span class="sq sq--' + k.toLowerCase() + ' legend__sq"><span class="sq__icon">' + SQUARE_ICON[k] + '</span></span>'
    + '<span><b>' + k + '</b>: ' + SQUARE_TEXT[k] + '.</span></li>').join('');
  main.innerHTML = '<section class="wrap page prose">'
    + '<span class="eyebrow">' + esc(BRAND.product) + '</span><h1>How to play</h1>'
    + '<p><b>Goal:</b> make words on the board and score the most points.</p>'
    + '<ol class="rules">'
    + '<li><b>Your tiles.</b> Everyone has 7 letter tiles. Each tile shows its points (E is 1, Q is 7).</li>'
    + '<li><b>First word.</b> It must cover the start square (on the Large board: at least one of the four start squares in the middle). It can go across or down.</li>'
    + '<li><b>Taking a turn.</b> Put 1 or more tiles in one straight line, across or down, with no gaps. Every new word must join a word already on the board. Every word you make (the long one and any short ones across it) must be a real word. ' + WORD_COUNT
      + placementsHtml() + '</li>'
    + '<li><b>Points.</b> Add up the points on the tiles in each word you made. Bonus squares count only on the turn a tile is first placed on them:'
    + '<ul class="legend legend--page">' + squares + '</ul>'
    + 'Two word squares in one word multiply together (two Shines make the word count four times).</li>'
    + '<li><b>Star words.</b> If you make a word from the school spelling list for your level (Year 1–2, 3–4 or 5–6 words; Year 7 and up: all of them; Degree and up: none), you get <b>+5</b> for each one, and you see what it means.</li>'
    + '<li><b>Full-rack bonus.</b> Use all 7 tiles in one turn: <b>+30</b>.</li>'
    + '<li><b>Blank tiles.</b> A blank can be any letter. It scores 0.</li>'
    + '<li><b>Swap or pass.</b> Instead of playing, you can swap some tiles with the bag (only while it has at least 7 tiles; you miss that turn), or pass.</li>'
    + '<li><b>New tiles.</b> After your turn, take tiles from the bag until you have 7 again.</li>'
    + '<li><b>Hints.</b> Each child has 3 hints per game. A hint shows a good word you could make with your tiles; you can use it or say no thanks. If no word is found, the hint is not used up.</li>'
    + '<li><b>End of the game.</b> The game ends when the bag is empty and one player has used all their tiles, or after three full rounds in which nobody scores (passes and swaps both count). Each player takes away the points of the tiles still in their rack, but no score goes below 0. Highest score wins.</li>'
    + '</ol>'
    + '<h2>Playing with a keyboard</h2>'
    + '<p>Tab to the board. Arrow keys move around it. Type a letter to put that tile on the board (a blank is used if you do not have the letter); the next square follows the way you last moved. Backspace takes the last tile back. Enter plays your word.</p>'
    + '<p><a class="btn btn--primary" href="#/new">Start a game</a></p>'
    + '</section>';
}

export function about(main) {
  main.innerHTML = '<section class="wrap page prose">'
    + '<span class="eyebrow">For parents</span><h1>About ' + esc(BRAND.product) + '</h1>'
    + '<p>' + esc(BRAND.product) + ' is a word-tile board game for children preparing for the 11+, and for anyone who likes words. Two to four players take turns on one device: children, and computer players if you like (Pip the dormouse is Easy, Ottie the otter Normal, Bramble the badger Hard, Fizz the magpie Crazy). Each player has their own word level.</p>'
    + '<h2>Words and Star words</h2>'
    + '<p>' + WORD_COUNT + ' Only British spellings count ("colour", not "color"), and the list has been filtered to keep it suitable for children. Children may play any of these words at every level. The word level sets which words the computer players know, which words hints suggest, and which Star words count. Star words are the school spelling words for that level; making one scores 5 extra points and shows what it means.</p>'
    + '<h2 id="pin">Grown-up PIN</h2>'
    + '<p>If a real word is missing, a grown-up can allow it when Play is refused ("Grown-up: allow this word"), with a 4-digit PIN. The PIN is kept on this device only, scrambled (as a salted hash), never as the digits.</p>'
    + '<div data-pin></div>'
    + '<h2>Words you have allowed</h2>'
    + '<p>Allowed words count for children on this device only; computer players and hints never use them.</p>'
    + '<div data-allowed></div>'
    + '<h2 id="look">Day style</h2>'
    + dayStyleHtml({ tag: 'div', id: 'about-daystyle' })
    + '<p class="small muted">The look menu at the top switches Day (Sunny garden or Paint box), Night and Match device (which follows this device’s light or dark setting). Day, Night and Match device are shared with Spellbright and the Waystead Game home page.</p>'
    + '<h2>Privacy</h2>'
    + '<p>There are no accounts and no sign-in, no adverts, no tracking and no analytics. Progress and the saved game stay in this browser on this device and are never sent to us.</p>'
    + '<h2>Credits</h2>'
    + '<p>Word lists are made from the English Speller Database (ESDB), with this notice:</p>'
    + '<blockquote class="notice">Copyright 2000-2026 by Kevin Atkinson<br><br>'
    + 'Permission to use, copy, modify, distribute, and sell any part of the English Speller Database (ESDB, previously known as SCOWLv2), or word lists created from it, is hereby granted without fee, provided that the above copyright notice appears in all copies and that both the above copyright notice and this notice appear in supporting documentation. Kevin Atkinson makes no representations about the suitability of this database for any purpose. It is provided "as is" without express or implied warranty.<br><br>'
    + 'ESDB is derived from many sources, most of which are in the Public Domain. Data from the Corpus of Contemporary American English (COCA) was also used.<br><br>'
    + 'All data from COCA comes from 3-gram data that is not freely available; however, the usage is within the rights given by the NDA that was signed when purchasing the data. More information on COCA is available at https://www.english-corpora.org/coca/.<br><br>'
    + 'The primary source of words for ESDB comes from 12dicts and ENABLE2K. Both are in the Public Domain, but Alan Beale deserves special credit as he is the author of 12dicts and a major contributor to ENABLE2K. In addition, he gave me an incredible amount of feedback and created a number of special lists in order to help improve the overall quality of ESDB.</blockquote>'
    + '<p>The child-safe filter uses the <a href="https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words">List of Dirty, Naughty, Obscene, and Otherwise Bad Words</a> (LDNOOBW), licensed under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, with our own additions and changes.</p>'
    + '<p>Star words: English Appendix 1, the national curriculum in England (DfE, 2013). Contains public sector information licensed under the Open Government Licence v3.0.</p>'
    + '<p>Word meanings shown after each play are made from <a href="https://wordnet.princeton.edu/">WordNet</a> 3.1 (Princeton University), chosen and filtered for children and changed to British spelling, with this notice:</p>'
    + '<blockquote class="notice">WordNet 3.1 Copyright 2011 by Princeton University. All rights reserved.<br><br>'
    + 'Permission to use, copy, modify and distribute this software and database and its documentation for any purpose and without fee or royalty is hereby granted, provided that you agree to comply with the following copyright notice and statements, including the disclaimer, and that the same appear on ALL copies of the software, database and documentation, including modifications that you make for internal use or for distribution.<br><br>'
    + 'THIS SOFTWARE AND DATABASE IS PROVIDED "AS IS" AND PRINCETON UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR IMPLIED. BY WAY OF EXAMPLE, BUT NOT LIMITATION, PRINCETON UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES OF MERCHANTABILITY OR FITNESS FOR ANY PARTICULAR PURPOSE OR THAT THE USE OF THE LICENSED SOFTWARE, DATABASE OR DOCUMENTATION WILL NOT INFRINGE ANY THIRD PARTY PATENTS, COPYRIGHTS, TRADEMARKS OR OTHER RIGHTS.<br><br>'
    + 'The name of Princeton University or Princeton may not be used in advertising or publicity pertaining to distribution of the software and/or database. Title to copyright in this software, database and any associated documentation shall at all times remain with Princeton University and LICENSEE agrees to preserve same.</blockquote>'
    + '<p>British pronunciations (IPA) are made from <a href="https://github.com/JoseLlarena/Britfone">Britfone</a> 3.0.1 by Jose Llarena, MIT licence (copyright 2017 Jose Llarena), with our own changes; Star words use Spellbright’s. The full licence texts are in <a href="data/meanings/LICENSE.txt">the licence file</a>.</p>'
    + '<p>“Hear” plays Spellbright’s recording for Star words and otherwise uses this device’s own voice. “Look it up” opens the Cambridge Dictionary, another website, in a new tab; we send it nothing but the word in the link.</p>'
    + '<p>Pictures and videos made with xAI Grok Imagine.</p>'
    + '<h2>Who makes it</h2>'
    + '<p>' + esc(BRAND.product) + ' is made by <a href="https://waystead.co.uk">' + esc(BRAND.maker) + '</a>, as is <a href="../spellbright/">Spellbright</a>. It is an independent project, not affiliated with any board-game publisher, the Department for Education or any exam board.</p>'
    + '</section>';
  const allowedBox = main.querySelector('[data-allowed]');
  drawAllowed(allowedBox);
  drawPin(main.querySelector('[data-pin]'), () => drawAllowed(allowedBox));
  return wireDayStyle(main);
}

// Set, change or forget the grown-up PIN.
function drawPin(box, onForget) {
  const pin = storedPin();
  const form = (title, button) => '<form class="pinform stack" data-pin-form novalidate>'
    + (title ? '<p><b>' + title + '</b></p>' : '')
    + '<div class="pinform__row"><label for="pin-new">New PIN (4 digits)</label>'
    + '<input id="pin-new" class="field field--pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off"></div>'
    + '<div class="pinform__row"><label for="pin-again">Type it again</label>'
    + '<input id="pin-again" class="field field--pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off"></div>'
    + '<p class="small gu-wrong" data-pin-error role="alert"></p>'
    + '<div class="btnrow"><button type="submit" class="btn btn--primary">' + button + '</button>'
    + (pin ? '<button type="button" class="btn btn--ghost" data-pin-cancel>Cancel</button>' : '') + '</div></form>';
  box.innerHTML = pin
    ? '<p>A PIN is set on this device.</p><div class="btnrow"><button type="button" class="btn btn--ghost btn--small" data-pin-change>Change PIN</button>'
      + '<button type="button" class="btn btn--ghost btn--small" data-pin-forget>Forgot PIN?</button></div>'
    : '<p class="muted">No PIN yet.</p>' + form('', 'Save PIN');

  const wireForm = (focus) => {
    box.querySelector('[data-pin-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const a = box.querySelector('#pin-new').value.trim();
      const b = box.querySelector('#pin-again').value.trim();
      const err = box.querySelector('[data-pin-error]');
      if (!PIN_RE.test(a)) { err.textContent = 'A PIN is 4 digits, like 2580.'; return; }
      if (a !== b) { err.textContent = 'The two PINs are not the same.'; return; }
      savePin(await makePin(a));
      toast('PIN saved.');
      drawPin(box, onForget);
      box.querySelector('button').focus();
    });
    const cancel = box.querySelector('[data-pin-cancel]');
    if (cancel) cancel.addEventListener('click', () => drawPin(box, onForget));
    if (focus) box.querySelector('#pin-new').focus();
  };
  if (!pin) { wireForm(false); return; }

  box.querySelector('[data-pin-change]').addEventListener('click', async () => {
    const ok = await askPin('To change the PIN, enter the one you have now.', (entered) => checkPin(entered, pin));
    if (!ok) return;
    box.innerHTML = form('Choose a new PIN', 'Save new PIN');
    wireForm(true);
  });
  box.querySelector('[data-pin-forget]').addEventListener('click', async () => {
    const ok = await ask('Forgot the PIN?', 'This clears the PIN and every word allowed on this device. You can then set a new PIN.', 'Clear PIN and words', 'Keep them');
    if (!ok) return;
    forgetPin();
    toast('PIN and allowed words cleared.');
    drawPin(box, onForget);
    onForget();
  });
}

function drawAllowed(box) {
  const words = allowedWords();
  box.innerHTML = words.length
    ? '<ul class="allowed">' + words.map((w) => '<li><span class="allowed__word">' + esc(w.toUpperCase()) + '</span>'
      + '<button type="button" class="btn btn--ghost btn--small" data-remove="' + esc(w) + '" aria-label="Remove ' + esc(w.toUpperCase()) + '">Remove</button></li>').join('') + '</ul>'
    : '<p class="muted">None yet.</p>';
  box.onclick = (e) => {
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    const i = words.indexOf(b.dataset.remove);
    disallowWord(b.dataset.remove);
    drawAllowed(box);
    const again = box.querySelectorAll('[data-remove]');
    (again[Math.min(i, again.length - 1)] || box).focus?.();
  };
}

export function notFound(main) {
  main.innerHTML = '<section class="wrap page"><div class="card empty"><h1>Page not found</h1>'
    + '<p class="muted">That page is not here.</p><a class="btn btn--primary" href="#/">Go to the start</a></div></section>';
}
