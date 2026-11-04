// Story day's story, read aloud a sentence at a time with the week's words
// picked out, and the grown-ups' page for reviewing the stories.
import * as D from './data.js';
import * as W from './words-doc.js';
import { loadStories, lineParts, lineKey, wordCount, approveCommand, REVIEW_KEY } from './stories.js';
import { sayStoryLine, stop } from './speech.js';
import { adultOnly } from './grownups-views.js';
import { esc, ICON } from './ui.js';

const lineHtml = (text, words) => lineParts(text, words).map((p) => (p.hit ? '<mark class="storyword">' + esc(p.text) + '</mark>' : esc(p.text))).join('');

export function storyPage(main, g, story, onDone) {
  const words = W.rows(g);
  let reading = 0; // bumps to stop a reading in progress
  main.innerHTML = '<section class="wrap page"><div class="pagehead"><span class="eyebrow">Story day</span><h1>' + esc(story.title) + '</h1>'
    + '<p class="muted">Listen for your words.</p></div><div class="card storycard"><p class="story">' + story.sentences.map((s, i) => '<span class="storyline" data-line="' + i + '">' + lineHtml(s, words) + '</span>').join(' ') + '</p></div>'
    + '<div class="btnrow"><button type="button" class="btn btn--quiet" data-read>' + ICON.play + '<span data-readlabel>Read it to me</span></button>'
    + '<button type="button" class="btn btn--primary" data-go>Write my sentences' + ICON.arrow + '</button></div></section>';
  const label = main.querySelector('[data-readlabel]');
  const light = (i) => main.querySelectorAll('[data-line]').forEach((el) => el.classList.toggle('is-on', Number(el.dataset.line) === i));
  async function read() {
    reading += 1;
    const mine = reading;
    label.textContent = 'Stop';
    for (let i = 0; i < story.sentences.length && mine === reading; i += 1) {
      light(i);
      await sayStoryLine(lineKey(story, i), story.sentences[i]);
    }
    if (mine === reading) { reading += 1; light(-1); label.textContent = 'Read it to me'; }
  }
  const quiet = () => { reading += 1; stop(); };
  main.querySelector('[data-read]').addEventListener('click', () => {
    if (label.textContent === 'Stop') { quiet(); light(-1); label.textContent = 'Read it to me'; } else read();
  });
  main.querySelector('[data-go]').addEventListener('click', () => { quiet(); onDone(); });
  return quiet;
}

/* ------------------------------------------------------- the review page --- */
function marked() {
  try { const v = JSON.parse(localStorage.getItem(REVIEW_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function mark(list) {
  try { localStorage.setItem(REVIEW_KEY, JSON.stringify(list)); } catch (e) { /* private mode: the page still shows the list */ }
}

export function storyReview(main) {
  if (!adultOnly(main)) return undefined;
  let stopped = false;
  loadStories().then((stories) => {
    if (stopped) return;
    const chapterWords = (s) => D.chapterById(s.chapter).words.map((w) => w.word);
    const name = (s) => { const c = D.chapterById(s.chapter); return D.years()[c.yearId].label + ' · ' + D.chapterTitle(c).n + '. ' + D.chapterTitle(c).name; };
    const waiting = () => marked().filter((id) => stories.some((s) => s.chapter === id && !s.reviewed));
    const summary = () => {
      const live = stories.filter((s) => s.reviewed).length;
      const ids = waiting();
      return '<p>' + live + ' of ' + stories.length + ' stories are live for children. ' + ids.length + ' marked here to approve.</p>'
        + (ids.length ? '<p class="small muted">To release them, run this in the game folder, then deploy:</p><code class="command" data-command>' + esc(approveCommand(ids)) + '</code>' : '<p class="small muted">A switch here is your own note on this device. Nothing reaches children until the approve command has run and the site is deployed.</p>');
    };
    main.innerHTML = '<section class="wrap page grownups"><div class="pagehead"><span class="eyebrow">Grown-ups</span><h1>Review the stories</h1></div>'
      + '<div class="card setting" data-summary>' + summary() + '</div><div class="settings storyreview">'
      + stories.map((s) => '<article class="card setting" data-story="' + esc(s.chapter) + '"><span class="eyebrow">' + esc(name(s)) + '</span><h2>' + esc(s.title) + '</h2>'
        + '<p class="small muted">' + wordCount(s) + ' words</p><p class="story">' + lineHtml(s.sentences.join(' '), chapterWords(s)) + '</p>'
        + (s.reviewed ? '<p><span class="pill pill--done">Live for children</span></p>'
          : '<label class="approve"><input type="checkbox" data-approve="' + esc(s.chapter) + '"' + (marked().includes(s.chapter) ? ' checked' : '') + '> Approve</label>')
        + '</article>').join('') + '</div></section>';
    main.querySelectorAll('[data-approve]').forEach((box) => box.addEventListener('change', () => {
      const id = box.dataset.approve;
      mark(box.checked ? [...new Set([...marked(), id])] : marked().filter((x) => x !== id));
      main.querySelector('[data-summary]').innerHTML = summary();
    }));
  });
  return () => { stopped = true; };
}
