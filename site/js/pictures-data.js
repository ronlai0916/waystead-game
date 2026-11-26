// SB6-WP-8a (TRS v2 TR-50, TR-54, TR-55; contract v4 A1-A10): the client of the picture service on the Waystead account. No DOM, no secret.
// A grown-up's typed word goes to the account (the only variable in a fixed server prompt); the grown-up checks the picture; children see approved ones only.
//
// SHIPS OFF: `PICTURES_API = false` means no request is ever made. Turned on by hand when Ron approves the account side. A 404 from the feature
// routes (A1, A2, A3, A6, A10, A8, A9) means off for the rest of the session.
// Every call: credentials 'include', mode 'cors', cache 'no-store', a time-out. Nothing is logged or stored here.
// Privacy (TR-55): a request body holds only one checked word (A2), picture ids and a choice (A4, A4b), `swap: true`, `{credits: 1}` (A10) or a code (A8);
// A3, A5, A6 put checked words in the URL. Never a name, id, year, list name, sentence, meaning or anything a child typed.
// Never swap by itself (D16): `swap: true` and A10 are sent only when the caller passes an explicit yes (`swap === true`, `{ yes: true }`).
// A child session (`child` option, true or a function) never makes a grown-up call (A1-A5, A8-A10): it answers { problem: 'playing' } at once.
export const PICTURES_API = false;
export const TIMEOUT_MS = 30000;
export const MAX_WORDS = 15;
export const WORD_RE = /^[a-z]{2,20}$/;
export const ID_RE = /^[A-Za-z0-9]{8,64}$/;
export const CODE_RE = /^[A-Za-z0-9-]{4,20}$/;
export const CHOICES = ['use', 'another', 'none'];
export const STATUSES = ['none', 'making', 'ready', 'approved', 'unsuitable', 'failed'];

/** The words the account will take, as it takes them: lower-case, `[a-z]{2,20}`, once each (any number; callers batch by MAX_WORDS). */
export function askable(words) {
  const seen = new Set();
  const out = [];
  for (const w of Array.isArray(words) ? words : []) {
    const k = typeof w === 'string' ? w.trim().toLowerCase() : '';
    if (WORD_RE.test(k) && !seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}
const batches = (list) => { const out = []; for (let i = 0; i < list.length; i += MAX_WORDS) out.push(list.slice(i, i + MAX_WORDS)); return out; };
const int = (x, d = 0) => (Number.isInteger(x) && x >= 0 ? x : d);
const dateOr = (x) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);
const idOf = (x) => (typeof x === 'string' && ID_RE.test(x) ? x : null);

export function createPictures({ origin, fetch: doFetch = (...a) => globalThis.fetch(...a), enabled = PICTURES_API, timeoutMs = TIMEOUT_MS, child = false } = {}) {
  let off = !enabled; // the session's own kill switch: a 404 from a feature route stops further calls
  const isChild = () => (typeof child === 'function' ? !!child() : !!child);
  const base = () => String(origin).replace(/\/+$/, '');

  async function call(method, path, body) {
    if (off) return { ok: false, status: 0, off: true, data: null };
    const ctl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, timeoutMs);
    const init = { method, credentials: 'include', mode: 'cors', cache: 'no-store', headers: {}, signal: ctl.signal };
    if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
    try {
      const res = await doFetch(base() + path, init);
      let data = null;
      if (res.status !== 204) { try { data = await res.json(); } catch (e) { data = null; } }
      const ra = res.headers && typeof res.headers.get === 'function' ? Number(res.headers.get('Retry-After')) : NaN;
      return { ok: res.ok, status: res.status, data, ...(Number.isFinite(ra) && ra > 0 ? { retryAfter: ra } : {}) };
    } catch (e) {
      return { ok: false, status: 0, data: null, ...(timedOut ? { timedOut: true } : {}) };
    } finally { clearTimeout(timer); }
  }

  /** Why a call did not give what was asked, as one word for the page. `soft404`: a 404 here means "no such picture or code", not "feature off". */
  function problemOf(r, soft404 = '') {
    const err = r.data && r.data.error;
    if (r.off) return 'off';
    if (r.timedOut) return 'timeout';
    if (r.status === 0) return 'offline';
    if (r.status === 404) { if (soft404) return soft404; off = true; return 'off'; }
    if (r.status === 401) return 'signed-out';
    if (r.status === 403) return err === 'adult-session-required' ? 'playing' : err === 'not-yours' ? 'not-yours' : 'forbidden';
    if (r.status === 402) return err === 'swap-needed' ? 'swap-needed' : err === 'no-credits' ? 'no-credits' : 'no-pictures-left';
    if (r.status === 400) return err === 'too-many' ? 'too-many' : err === 'bad-word' ? 'bad-word' : 'bad-request';
    if (r.status === 409) return err === 'already-making' ? 'already-making' : err === 'not-ready' ? 'not-ready' : err === 'unlimited' ? 'unlimited' : 'conflict';
    if (r.status === 413) return 'too-many';
    if (r.status === 422) return 'refused';
    if (r.status === 429) return 'hourly-limit';
    if (r.status === 503) return 'paused';
    return 'other';
  }
  const fail = (r, soft404) => {
    const problem = problemOf(r, soft404);
    const d = r.data || {};
    return {
      problem,
      ...(r.retryAfter ? { retryAfter: r.retryAfter } : {}),
      ...(problem === 'swap-needed' ? { credits: int(d.credits), rate: int(d.rate) } : {}),
      ...(problem === 'already-making' && idOf(d.id) ? { id: d.id } : {}),
    };
  };
  const grownUp = () => (isChild() ? { problem: 'playing' } : null);

  /** A2 / A4 "another" answer, checked: { status: 'making', id, swapped? } | { status: 'ready', id } | { status: 'unsuitable' } | { problem }. */
  function made(r, word) {
    if (!r.ok || !r.data) return fail(r, 'gone');
    const d = r.data;
    if (d.status === 'unsuitable') return { word, status: 'unsuitable' };
    const id = idOf(d.id);
    if ((d.status === 'making' || d.status === 'ready') && id) return { word, status: d.status, id, ...(d.swapped === true ? { swapped: true } : {}) };
    return { problem: 'other' };
  }

  return {
    get off() { return off; },
    /** A1 (grown-up only). { on: true, unlimited, left, credits, rate, trial, plan, resets, paused } or { problem }. `on` other than true is off. */
    async allowance() {
      const g = grownUp(); if (g) return g;
      const r = await call('GET', '/api/pictures/allowance');
      if (!r.ok || !r.data) return fail(r);
      const d = r.data;
      if (d.on !== true) { off = true; return { problem: 'off' }; }
      const unlimited = d.unlimited === true;
      const trial = d.trial && typeof d.trial === 'object' && dateOr(d.trial.until) ? { left: int(d.trial.left), until: d.trial.until } : null;
      const plan = d.plan && typeof d.plan === 'object' && typeof d.plan.name === 'string' ? { name: d.plan.name.slice(0, 60), monthly: int(d.plan.monthly) } : null;
      return { on: true, unlimited, left: unlimited ? null : int(d.left), credits: int(d.credits), rate: int(d.rate), trial, plan, resets: dateOr(d.resets), paused: d.paused === true };
    },
    /**
     * A2 (grown-up only): ask for a picture of ONE word. Sends `swap: true` only when `swap === true` (the grown-up said yes to the question).
     * { word, status: 'making'|'ready'|'unsuitable', id?, swapped? } | { problem: 'swap-needed', credits, rate } | { problem, retryAfter?, id? }.
     */
    async ask(word, { swap } = {}) {
      const g = grownUp(); if (g) return g;
      const w = askable([word])[0];
      if (!w) return { problem: 'bad-word' };
      const r = await call('POST', '/api/pictures', { word: w, ...(swap === true ? { swap: true } : {}) });
      const out = made(r, w);
      if (out.problem === 'gone') { off = true; return { problem: 'off' }; } // A2 has no "no such thing" 404: a 404 means the feature is not there
      return out;
    },
    /** A10 (grown-up only): swap ONE credit for the account's rate of word pictures. Needs `{ yes: true }`: the caller asked the question. { change, credits, rate } | { problem }. */
    async swap({ yes } = {}) {
      const g = grownUp(); if (g) return g;
      if (yes !== true) return { problem: 'not-confirmed' };
      const r = await call('POST', '/api/pictures/swap', { credits: 1 });
      if (!r.ok || !r.data) return fail(r);
      return { change: int(r.data.change), credits: int(r.data.credits), rate: int(r.data.rate) };
    },
    /** A3 (grown-up only): where these words stand, batched by 15. { items: [{ word, status, candidate?, approved?, at }] } | { problem }. */
    async states(words) {
      const g = grownUp(); if (g) return g;
      const list = askable(words);
      const items = [];
      for (const b of batches(list)) {
        const r = await call('GET', '/api/pictures?words=' + encodeURIComponent(b.join(',')));
        if (!r.ok || !r.data || !Array.isArray(r.data.items)) return fail(r);
        for (const it of r.data.items) {
          if (!it || typeof it.word !== 'string' || !b.includes(it.word)) continue;
          const status = STATUSES.includes(it.status) ? it.status : 'none';
          const cand = it.candidate && idOf(it.candidate.id);
          const appr = it.approved && idOf(it.approved.id);
          items.push({ word: it.word, status, ...(cand ? { candidate: { id: cand } } : {}), ...(appr ? { approved: { id: appr } } : {}), at: typeof it.at === 'string' ? it.at : '' });
        }
      }
      return { items };
    },
    /**
     * A4 (grown-up only): use | another | none for the picture with this id. `swap: true` only when `swap === true` (and only "another" can need it).
     * use: { word, approved: { id } }; none: { word, status: 'none' }; another: as ask(). A 404 is { problem: 'gone' } (the picture is not there), not "off".
     */
    async decide(id, choice, { swap } = {}) {
      const g = grownUp(); if (g) return g;
      if (!idOf(id)) return { problem: 'bad-id' };
      if (!CHOICES.includes(choice)) return { problem: 'bad-choice' };
      const r = await call('POST', '/api/pictures/' + id + '/decide', { choice, ...(choice === 'another' && swap === true ? { swap: true } : {}) });
      if (!r.ok || !r.data) return fail(r, 'gone');
      const d = r.data;
      if (choice === 'use') { const a = d.approved && idOf(d.approved.id); return typeof d.word === 'string' && a ? { word: d.word, approved: { id: a } } : { problem: 'other' }; }
      if (choice === 'none') return typeof d.word === 'string' ? { word: d.word, status: 'none' } : { problem: 'other' };
      return made(r, typeof d.word === 'string' ? d.word : '');
    },
    /** A4b (grown-up only): approve every ready candidate, at most 15 ids per call (batched). Never spends. { items: [{ word, approved: { id } } | { id, error }] } | { problem }. */
    async decideAll(ids) {
      const g = grownUp(); if (g) return g;
      const list = [...new Set((Array.isArray(ids) ? ids : []).filter(idOf))];
      const items = [];
      for (const b of batches(list)) {
        const r = await call('POST', '/api/pictures/decide-all', { ids: b });
        if (!r.ok || !r.data || !Array.isArray(r.data.items)) return fail(r, 'gone');
        for (const it of r.data.items) {
          if (!it) continue;
          if (it.approved && idOf(it.approved.id) && typeof it.word === 'string') items.push({ word: it.word, approved: { id: it.approved.id } });
          else if (idOf(it.id)) items.push({ id: it.id, error: typeof it.error === 'string' ? it.error : 'other' });
        }
      }
      return { items };
    },
    /** A5 (grown-up only): remove the picture of this word (and its candidates). { ok: true } | { problem } ('gone': nothing there). */
    async remove(word) {
      const g = grownUp(); if (g) return g;
      const w = askable([word])[0];
      if (!w) return { problem: 'bad-word' };
      const r = await call('DELETE', '/api/pictures/word/' + w);
      return r.ok || r.status === 204 ? { ok: true } : fail(r, 'gone');
    },
    /**
     * A6 (child or grown-up): the approved pictures of these words, batched by 15, as Map(word -> id). Only { word, id } is read: never any allowance data.
     * A failure gives an empty (or part) Map with `map.problem` set to the reason ('off', 'offline', 'signed-out', ...); on success `map.problem` is undefined.
     */
    async approved(words) {
      const map = new Map();
      for (const b of batches(askable(words))) {
        const r = await call('GET', '/api/pictures/approved?words=' + encodeURIComponent(b.join(',')));
        if (!r.ok || !r.data || !Array.isArray(r.data.items)) { map.problem = problemOf(r); return map; }
        for (const it of r.data.items) if (it && typeof it.word === 'string' && b.includes(it.word) && idOf(it.id)) map.set(it.word, it.id);
      }
      return map;
    },
    /** A7: the picture's URL for an <img> ('' when the id is not an id or the feature is off). The browser sends the cookie itself. */
    imageUrl(id) { return off || !idOf(id) ? '' : base() + '/api/pictures/image/' + id; },
    /** A9 (grown-up only): { credits, ledger, pictures: { unlimited, left, change, trial, plan, rate } } | { problem }. */
    async family() {
      const g = grownUp(); if (g) return g;
      const r = await call('GET', '/api/credits/family');
      if (!r.ok || !r.data) return fail(r);
      return r.data;
    },
    /** A8 (grown-up only): redeem a code. { ok: true, credits } | { problem } ('bad-code': not a code we know). */
    async redeem(code) {
      const g = grownUp(); if (g) return g;
      const c = typeof code === 'string' ? code.trim().toUpperCase() : '';
      if (!CODE_RE.test(c)) return { problem: 'bad-code' };
      const r = await call('POST', '/api/credits/redeem', { code: c });
      if (!r.ok || !r.data) return fail(r, 'bad-code');
      return { ok: true, credits: int(r.data.credits) };
    },
  };
}
