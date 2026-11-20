// WP-K / TR-103: the machine rules 1-7 for a Mix and match statement (BRS change 2, 4.4).
// ONE pure module, no imports, no browser or Node calls: the bank build (tools/statements-check.mjs)
// and the sentence server copy this same file, so both judge alike.
// The caller passes in what it knows: isKnown(lowerCaseWord) says whether a word is on the child-safe
// lists (the curriculum or Wordbright's list). Rules 8-12 (judgement) are NOT here: the Opus check and the child read. The one machine part of rule 8 is here: a statement may not start '<word> means'.
export const RULES_VERSION = 'statements-check v1';

/** Length by the word's year (4.3): words in the sentence, characters. */
export const BANDS = {
  '1': { minWords: 4, maxWords: 9, maxChars: 50 },
  '2': { minWords: 5, maxWords: 10, maxChars: 60 },
  '3-4': { minWords: 5, maxWords: 12, maxChars: 75 },
  '5-6': { minWords: 6, maxWords: 14, maxChars: 90 },
  own: { minWords: 5, maxWords: 12, maxChars: 75 },
};
/** 1, 2, 3, 4, 5, 6 (or '3-4' ...) -> the band key; no year -> 'own'. */
export function bandOf(year) {
  if (year === 1 || year === '1') return '1';
  if (year === 2 || year === '2') return '2';
  if (year === 3 || year === 4 || year === '3-4') return '3-4';
  if (year === 5 || year === 6 || year === '5-6') return '5-6';
  return 'own';
}

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** A capital inside a sentence is allowed only for these (4.4 rule 4). */
export const ALLOW_CAPS = new Set(['I', ...WEEKDAYS, ...MONTHS, 'Earth', 'England', 'Scotland', 'Wales', 'Britain', 'London', 'Christmas', 'Diwali', 'Eid']);

/** Narrow exception to rule 4, for the target words Mr and Mrs ONLY: the word straight after the title may be one of these plain surnames (capital allowed).
 *  The sentence must then hold "his" (Mr) or "her" (Mrs), and not the other one, so Mr and Mrs (same chapter) are never interchangeable. */
export const TITLE_WORDS = { Mr: 'his', Mrs: 'her' };
export const TITLE_SURNAMES = new Set(['Hill', 'Wood', 'Brown', 'Lane']);

/** Topic words that never appear in a statement (4.4 rule 10, caught early by machine). The target word itself is exempt. */
export const BANNED_WORDS = new Set((
  'kill kills killed killing die dies died dying dead death deadly murder blood bleed bleeding bloody gun guns shoot shoots shooting shot knife knives sword swords bomb bombs weapon weapons war wars ' +
  'fight fights fighting fought hurt hurts injured injury wound wounded pain painful cancer virus poison poisoned crash crashed grave funeral coffin ' +
  'alcohol beer wine vodka whisky pub drunk cigarette cigarettes drug drugs diet diets dieting fat fatter fattest skinny ugly stupid dumb idiot loser freak hate hated hates ' +
  'fear scared afraid frightened scary terrified nightmare stranger strangers kidnap steal stole stolen thief robbed god gods pray prayer church mosque bible hell devil ' +
  'election politics politician sex sexy naked bum poo pee fart slave slaves racist debt'
).split(' '));

/** Common given names (lower case). A name is never allowed, even as the first word of a sentence. Ambiguous words (will, mark, rose, grace, hope, ray, pat, bill) are left to the Opus check. */
export const NAMES = new Set((
  'aaron adam adrian ahmed alan albert alex alexander alfie alice alicia amanda amara amelia amir amy andrew andy angela anna anne anthony archie arjun arthur asha ashley ava ben benjamin beth bethany billy bob bobby brian bruce callum cameron carl carol caroline charles charlie charlotte chloe chris christopher claire connor daisy dan daniel danny darren dave david dean debbie dennis diana dominic donna dylan eddie edward eleanor ella ellie elliot emily emma ethan eve evie fatima finn florence frank fred freddie gareth gary gemma george georgia gerald gina hannah harley harry harvey hassan hayley heidi helen henry holly hugo imogen isaac isabel isabella isla ivy jack jacob jade jake james jamie jane jasmine jason jayden jenny jessica jim joe joel john johnny jonathan jordan joseph joshua josh joyce jude julia julie kai karen kate katie keith kelly ken kevin kieran kyle lara laura lauren leah lee leo leon lewis liam libby lily linda lisa logan louis louise lucas lucy luke maddie maisie mandy maria mary matt matthew max megan mia michael millie mohammed molly muhammad nadia nathan neil nicholas nick noah noor olivia oliver ollie oscar owen patrick paul peter philip phoebe poppy priya rachel rebecca reggie richard rob robert robin rory ruby ryan sam samantha samuel sara sarah scott sean sebastian sophia sophie stella stephen steve stuart susan tara teddy theo thomas tilly tim timothy tina toby tom tommy tony tyler vicky victoria vincent wendy william zac zachary zara zoe zayn'
).split(' '));

const STOP = new Set((
  'a an the and or but so to of in on at by for with from up down out off over under as is am are was were be been it its i me my we our us you your he him his she her they them their this that these those there here what who which when where why how not no yes do does did done can could will would should shall may might have has had having just very too also then than if into onto about after before again some any all each every more most much many one'
).split(' '));

const SUFFIXES = ["n't", "'s", "'ll", "'re", "'ve", "'d", "'m"];

/** Tidy the typographic apostrophe so the rest of the code sees one kind. */
const norm = (s) => String(s).replace(/’/g, "'");

/** Words of a sentence: letters with inner ' or - kept together. */
export function tokens(s) {
  return norm(s).match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) || [];
}
/** The pieces of one token, split at ' and - ("Dad's" -> Dad, s). */
const pieces = (t) => t.split(/['-]/).filter(Boolean);
const lc = (t) => (t === 'I' ? 'I' : t.toLowerCase());

/** Lower-case content words of a text (no stop words), used for overlap. */
function contentWords(s, target) {
  const t = target ? String(target).toLowerCase() : null;
  return new Set(tokens(s).map((w) => w.toLowerCase()).filter((w) => !STOP.has(w) && w !== t));
}
function allWords(s) {
  return tokens(s).map((w) => w.toLowerCase());
}

/** 4.4 rule 4 for one token: is every piece known? Contractions ("don't", "I'm") and hyphenated words are allowed when their parts are. */
function knownToken(tok, isKnown) {
  const w = tok.toLowerCase();
  if (isKnown(w)) return true;
  if (w === "can't" || w === "won't" || w === "shan't") return true;
  for (const suf of SUFFIXES) {
    if (w.endsWith(suf)) {
      const stem = w.slice(0, -suf.length);
      if (stem && (isKnown(stem) || stem === 'i')) return true;
    }
  }
  if (w.includes('-')) return w.split('-').every((p) => p && knownToken(p, isKnown));
  return false;
}

const inflected = (word, other) => {
  const w = word.toLowerCase();
  const o = other.toLowerCase();
  if (o === w || o.length <= w.length) return false;
  const endings = ['s', 'es', 'ed', 'd', 'ing', 'er', 'ers', 'est', 'ly', 'y', 'ies', 'en'];
  for (const e of endings) if (o === w + e) return true;
  if (w.endsWith('e') && (o === w.slice(0, -1) + 'ing' || o === w.slice(0, -1) + 'ed')) return true;
  if (w.endsWith('y') && (o === w.slice(0, -1) + 'ies' || o === w.slice(0, -1) + 'ied' || o === w.slice(0, -1) + 'ily')) return true;
  if (/[^aeiou][aeiou][bdgmnprt]$/.test(w) && (o === w + w.slice(-1) + 'ing' || o === w + w.slice(-1) + 'ed' || o === w + w.slice(-1) + 'er')) return true;
  return false;
};

const fail = (rule, why) => ({ rule, why });

/**
 * Rules 1-5 and 7 for ONE statement.
 * ctx: { word, year (1-6, or null for an own word), meaning, example, otherWords: [..the other words of the chapter/list..], isKnown(lower) }
 * Returns { ok, fails: [{ rule, why }] }.
 */
export function checkStatement(statement, ctx) {
  const fails = [];
  const s = norm(statement == null ? '' : statement);
  const word = ctx.word;
  const toks = tokens(s);

  // Rule 2: one sentence, letters and , . ! ? ' - only.
  if (typeof statement !== 'string' || !s.trim()) {
    return { ok: false, fails: [fail(2, 'empty')] };
  }
  if (!/^[A-Za-z ,.!?'-]+$/.test(s)) fails.push(fail(2, 'has a character outside letters, spaces and , . ! ? \' -'));
  if (s !== s.trim() || /\s{2}/.test(s)) fails.push(fail(2, 'extra spaces'));
  if (!/^[A-Z]/.test(s)) fails.push(fail(2, 'does not start with a capital'));
  if (!/[.!?]$/.test(s)) fails.push(fail(2, 'does not end with . ! or ?'));
  if (/[.!?]/.test(s.slice(0, -1))) fails.push(fail(2, 'more than one sentence'));
  if (/[,.!?]{2,}/.test(s.replace(/\.\.\./g, '')) || /\.\.\./.test(s)) fails.push(fail(2, 'repeated punctuation'));
  if (/(^|[^A-Za-z])-|-($|[^A-Za-z])/.test(s)) fails.push(fail(2, 'loose hyphen'));
  if (/\b(www|http|com|co|uk)\b/i.test(s) && /\./.test(s.slice(0, -1))) fails.push(fail(2, 'looks like a web address'));

  // Rule 1: the word exactly once, whole token, same spelling (capital only as the first letter of the sentence).
  const isCapWord = /[A-Z]/.test(word);
  let hits = 0;
  let wholeHits = 0;
  toks.forEach((t, i) => {
    for (const p of pieces(t)) if (p === word || (i === 0 && !isCapWord && p === word[0].toUpperCase() + word.slice(1))) hits += 1;
    if (t === word || (i === 0 && !isCapWord && t === word[0].toUpperCase() + word.slice(1))) wholeHits += 1;
  });
  if (hits === 0) fails.push(fail(1, 'the word is missing or spelled differently'));
  else if (hits > 1 || wholeHits > 1) fails.push(fail(1, 'the word appears more than once'));
  else if (wholeHits !== 1) fails.push(fail(1, 'the word is inside a longer token (' + 'apostrophe or hyphen)'));
  for (const t of toks) {
    if (t !== word && pieces(t).length === 1 && inflected(word, t)) fails.push(fail(1, 'another form of the word: ' + t));
  }

  // Rule 3: length.
  const band = BANDS[bandOf(ctx.year)];
  const n = s.trim().split(/\s+/).length;
  if (n < band.minWords || n > band.maxWords) fails.push(fail(3, n + ' words (needs ' + band.minWords + '-' + band.maxWords + ')'));
  if (s.length > band.maxChars) fails.push(fail(3, s.length + ' characters (max ' + band.maxChars + ')'));

  // Rule 4: every other word on the lists; capitals; no names; no banned topic words.
  const wl = word.toLowerCase();
  const titleIdx = TITLE_WORDS[word] ? toks.indexOf(word) + 1 : -1; // the token after Mr / Mrs
  toks.forEach((t, i) => {
    const parts = pieces(t);
    if (i === titleIdx && i > 0 && TITLE_SURNAMES.has(t)) return; // the narrow Mr/Mrs surname exception
    const isTarget = t === word || (i === 0 && !isCapWord && t === word[0].toUpperCase() + word.slice(1));
    if (isTarget) return;
    const hasCap = /[A-Z]/.test(t);
    if (hasCap && !(t === 'I' || /^I'(m|ll|d|ve)$/.test(t))) {
      const first = i === 0;
      if (!first) {
        if (!ALLOW_CAPS.has(t)) fails.push(fail(4, 'capital word not allowed: ' + t));
      } else if (!/^[A-Z][a-z'-]*$/.test(t) || ALLOW_CAPS.has(t) === false && /[A-Z]/.test(t.slice(1))) {
        fails.push(fail(4, 'odd capitals: ' + t));
      }
      if (i === 0 && NAMES.has(t.toLowerCase())) fails.push(fail(4, 'a name: ' + t));
    }
    if (!ALLOW_CAPS.has(t) && !knownToken(t, ctx.isKnown)) fails.push(fail(4, 'not on the word lists: ' + t));
    for (const p of parts) {
      const pl = p.toLowerCase();
      if (BANNED_WORDS.has(pl) && pl !== wl) fails.push(fail(4, 'banned topic word: ' + p));
      if (NAMES.has(pl) && /^[A-Z]/.test(p)) fails.push(fail(4, 'a name: ' + p));
    }
  });

  // Rule 4b (Mr / Mrs only): the pronoun that tells the two titles apart.
  if (TITLE_WORDS[word]) {
    const low = toks.map((t) => t.toLowerCase());
    const need = TITLE_WORDS[word];
    const other = need === 'his' ? 'her' : 'his';
    if (!low.includes(need)) fails.push(fail(4, 'a sentence for ' + word + ' must contain "' + need + '"'));
    if (low.includes(other)) fails.push(fail(4, 'a sentence for ' + word + ' must not contain "' + other + '"'));
  }

  // Rule 8 (machine part): no definition frame, "<word> means ...".
  if (/^\s*[A-Za-z]+\s+means\b/i.test(s) && toks[0] && toks[0].toLowerCase() === word.toLowerCase()) fails.push(fail(8, 'starts with the word followed by "means" (a definition, not a use)'));

  // Rule 5: not the curriculum example, not the dictionary meaning. Overlap counts content words (no stop words, not the target) and needs at least 2 shared, so a short sentence is not failed for one shared noun.
  for (const [label, ref] of [['example', ctx.example], ['meaning', ctx.meaning]]) {
    if (!ref) continue;
    const a = allWords(s);
    const b = allWords(ref);
    let run = false;
    for (let i = 0; i + 4 <= a.length && !run; i++) {
      for (let j = 0; j + 4 <= b.length; j++) {
        if (a[i] === b[j] && a[i + 1] === b[j + 1] && a[i + 2] === b[j + 2] && a[i + 3] === b[j + 3]) { run = true; break; }
      }
    }
    if (run) fails.push(fail(5, 'shares a run of 4 words with the ' + label));
    const ca = contentWords(s, word);
    const cb = contentWords(ref, word);
    if (ca.size) {
      let shared = 0;
      for (const w of ca) if (cb.has(w)) shared += 1;
      if (shared >= 2 && shared / ca.size >= 0.5) fails.push(fail(5, 'word overlap with the ' + label + ' is ' + Math.round((100 * shared) / ca.size) + '%'));
    }
  }

  // Rule 7: no other word of the same chapter (exact whole-word, pieces included).
  const others = (ctx.otherWords || []).filter((w) => w !== word);
  const otherSet = new Set(others.map((w) => (w === 'I' ? 'I' : w.toLowerCase())));
  toks.forEach((t, i) => {
    for (const p of pieces(t)) {
      const key = i === 0 && p !== 'I' ? p.toLowerCase() : lc(p);
      if (otherSet.has(key) && key !== wl) { fails.push(fail(7, 'holds another word of the chapter: ' + p)); break; }
    }
  });

  return { ok: fails.length === 0, fails: dedupe(fails) };
}

function dedupe(fails) {
  const seen = new Set();
  return fails.filter((f) => { const k = f.rule + f.why; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Rule 6 for two statements: how alike they are (0-1) and whether they start alike. */
export function likeness(a, b) {
  const A = new Set(allWords(a));
  const B = new Set(allWords(b));
  let shared = 0;
  for (const w of A) if (B.has(w)) shared += 1;
  const jaccard = shared / (A.size + B.size - shared || 1);
  const startsAlike = allWords(a).slice(0, 3).join(' ') === allWords(b).slice(0, 3).join(' ');
  return { jaccard, startsAlike };
}
export const SAME_LIMIT = 0.6;
/** Rule 6: do these statements differ clearly from each other? Returns the pairs that do not. */
export function checkDifferent(statements) {
  const bad = [];
  for (let i = 0; i < statements.length; i++) {
    for (let j = i + 1; j < statements.length; j++) {
      const { jaccard, startsAlike } = likeness(statements[i], statements[j]);
      if (jaccard >= SAME_LIMIT || startsAlike) bad.push({ rule: 6, i, j, why: startsAlike ? 'start the same way' : 'overlap ' + Math.round(jaccard * 100) + '%' });
    }
  }
  return bad;
}

/** Greedy: from candidates (best first) keep up to max that pass rule 6 against the ones already kept. */
export function pickDifferent(statements, max = 3) {
  const kept = [];
  for (const s of statements) {
    if (kept.length >= max) break;
    if (kept.every((k) => checkDifferent([k, s]).length === 0)) kept.push(s);
  }
  return kept;
}

/** The statement as the child sees it: the word replaced by a gap. */
export function gapOf(statement, word) {
  const isCapWord = /[A-Z]/.test(word);
  const re = new RegExp('(^|[^A-Za-z\'-])(' + (isCapWord ? word : '[' + word[0] + word[0].toUpperCase() + ']' + word.slice(1)) + ')(?![A-Za-z\'-])');
  return norm(statement).replace(re, '$1___');
}
