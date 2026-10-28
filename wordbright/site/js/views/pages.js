// Text pages: how to play, for parents, not found.
import { BRAND } from '../brand.js';
import { esc } from '../ui/dom.js';
import { SQUARE_ICON, SQUARE_TEXT, KINDS } from '../ui/board.js';

export function rules(main) {
  const squares = KINDS.map((k) => '<li><span class="sq sq--' + k.toLowerCase() + ' legend__sq"><span class="sq__icon">' + SQUARE_ICON[k] + '</span></span>'
    + '<span><b>' + k + '</b>: ' + SQUARE_TEXT[k] + '.</span></li>').join('');
  main.innerHTML = '<section class="wrap page prose">'
    + '<span class="eyebrow">' + esc(BRAND.product) + '</span><h1>How to play</h1>'
    + '<p><b>Goal:</b> make words on the board and score the most points.</p>'
    + '<ol class="rules">'
    + '<li><b>Your tiles.</b> Everyone has 7 letter tiles. Each tile shows its points (E is 1, Q is 7).</li>'
    + '<li><b>First word.</b> It must cover the start square (on the Large board: at least one of the four start squares in the middle). It can go across or down.</li>'
    + '<li><b>Taking a turn.</b> Put 1 or more tiles in one straight line, across or down, with no gaps. Every new word must join a word already on the board. Every word you make (the long one and any short ones across it) must be a real word.</li>'
    + '<li><b>Points.</b> Add up the points on the tiles in each word you made. Bonus squares count only on the turn a tile is first placed on them:'
    + '<ul class="legend legend--page">' + squares + '</ul>'
    + 'Two word squares in one word multiply together (two Shines make the word count four times).</li>'
    + '<li><b>Star words.</b> If you make a word from the school spelling list for your level (Year 1–2, 3–4 or 5–6 words; Year 7 and up: all of them; Degree and up: none), you get <b>+5</b> for each one, and you see what it means.</li>'
    + '<li><b>Full-rack bonus.</b> Use all 7 tiles in one turn: <b>+30</b>.</li>'
    + '<li><b>Blank tiles.</b> A blank can be any letter. It scores 0.</li>'
    + '<li><b>Swap or pass.</b> Instead of playing, you can swap some tiles with the bag (only while it has at least 7 tiles; you miss that turn), or pass.</li>'
    + '<li><b>New tiles.</b> After your turn, take tiles from the bag until you have 7 again.</li>'
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
    + '<p>' + esc(BRAND.product) + ' is a word-tile board game for children preparing for the 11+, and for anyone who likes words. Two to four people take turns on one device. Computer players are coming soon.</p>'
    + '<h2>Words and Star words</h2>'
    + '<p>Only British spellings are allowed ("colour", not "color"), and the word lists have been filtered to keep them suitable for children. The word level you choose sets which list is used. Star words are the school spelling words for that level; making one scores 5 extra points and shows what it means.</p>'
    + '<h2>Privacy</h2>'
    + '<p>There is no account and no sign-in. The saved game is kept in this browser on this device and is never sent to us. There are no adverts, no tracking and no analytics.</p>'
    + '<h2>Credits</h2>'
    + '<p>Word lists are made from the English Speller Database (ESDB), with this notice:</p>'
    + '<blockquote class="notice">Copyright 2000-2026 by Kevin Atkinson<br><br>'
    + 'Permission to use, copy, modify, distribute, and sell any part of the English Speller Database (ESDB, previously known as SCOWLv2), or word lists created from it, is hereby granted without fee, provided that the above copyright notice appears in all copies and that both the above copyright notice and this notice appear in supporting documentation. Kevin Atkinson makes no representations about the suitability of this database for any purpose. It is provided "as is" without express or implied warranty.<br><br>'
    + 'ESDB is derived from many sources, most of which are in the Public Domain. Data from the Corpus of Contemporary American English (COCA) was also used.<br><br>'
    + 'All data from COCA comes from 3-gram data that is not freely available; however, the usage is within the rights given by the NDA that was signed when purchasing the data. More information on COCA is available at https://www.english-corpora.org/coca/.<br><br>'
    + 'The primary source of words for ESDB comes from 12dicts and ENABLE2K. Both are in the Public Domain, but Alan Beale deserves special credit as he is the author of 12dicts and a major contributor to ENABLE2K. In addition, he gave me an incredible amount of feedback and created a number of special lists in order to help improve the overall quality of ESDB.</blockquote>'
    + '<p>The child-safe filter uses the <a href="https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words">List of Dirty, Naughty, Obscene, and Otherwise Bad Words</a> (LDNOOBW), licensed under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, with our own additions and changes.</p>'
    + '<p>Star words: English Appendix 1, the national curriculum in England (DfE, 2013). Contains public sector information licensed under the Open Government Licence v3.0.</p>'
    + '<h2>Who makes it</h2>'
    + '<p>' + esc(BRAND.product) + ' is made by <a href="https://waystead.co.uk">' + esc(BRAND.maker) + '</a>, as is <a href="../spellbright/">Spellbright</a>. It is an independent project and is not affiliated with the Department for Education, any exam board or any other word game.</p>'
    + '</section>';
}

export function notFound(main) {
  main.innerHTML = '<section class="wrap page"><div class="card empty"><h1>Page not found</h1>'
    + '<p class="muted">That page is not here.</p><a class="btn btn--primary" href="#/">Go to the start</a></div></section>';
}
