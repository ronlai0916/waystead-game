// A fake Waystead Account API for the tests, as a `fetch`: the rules of
// waystead-account src/lib/data-api.ts and src/lib/api-me.ts that the games
// depend on. /api/me answers 200 {signedIn:false} when signed out; the data
// routes answer 401. Every PUT names the version it last read (0: never seen);
// a stale one answers 409 with the stored value and version. Prefs at most
// 4 KB, a value at most 64 KB. `offline = true` makes every call fail as a
// network error. No cookie or token exists here: `who` is the session.
export function fakeAccount() {
  const acct = {
    who: null, // null, or a /api/me answer
    offline: false,
    calls: [],
    prefs: new Map(), // profile id -> {theme, dayStyle, prefs}
    data: new Map(), // profile id -> Map(game/key -> {value, version, updatedAt})
    failNext: null, // { status, times } for the next data calls
    meStatus: 0, // e.g. 503 (the service down) or 401: what /api/me answers instead
    children: () => [], // adult id -> [{ id, nickname, year, avatar }]
    // SB4 /api/scan/*: `missing` (the default) = the real endpoint does not exist yet, so every route is a 404.
    // Optional (SB4-WP8-2): `hourResetsAt` (an ISO time) in the allowance; `retryAfter` (seconds) on the hourly 429; `hold` (a promise) delays the words answer.
    // `reply(bytes, type)` may answer { status, body } in place of the usual words (a string body is sent as text).
    // SB5 /api/sentences/* (TRS-change-2 TR-105): `missing` (the default) = the routes do not exist yet (404). `mode`: 'fake' (3 good statements),
    // 'fake-fail' (status failed), 'fake-slow' (status writing, nothing stored yet), 'fake-dirty' (statements that break the rules).
    // `bank` = word -> { status, statements }; `events` = the words that counted (a new word counts once).
    sentences: { missing: true, on: false, limit: 60, left: 60, hourLeft: 20, paused: false, mode: 'fake', bank: {}, events: [], retryAfter: 0 },
    // SB6 /api/pictures/* and /api/credits/* (contract v4 A1-A10, WP-8a): `missing` (the default) or `on: false` = every pictures route is a 404.
    // `trial` = free pictures left, `trialUntil` ('YYYY-MM-DD', null = no trial), `plan` = null | { name, monthly } with `planLeft`, `change` = swapped pictures,
    // `credits` = story credits, `rate` = pictures per credit, `hourLeft` = makes left this hour (0 = 429 + `retryAfter`), `paused` = 503 on make/swap,
    // `mode`: 'fake' (a job is ready on its first read), 'fake-slow' (stays making until `finish(word)`), 'fake-fail' (fails and gives the picture back),
    // `blocked` = Set of words answered 422 refused, `unsuitable` = Set of words answered unsuitable (no spend), `codes` = code -> credits to add,
    // `ledger` = rows { at, reason, amount, pictures }, `swaps` = count of credit swaps (A10 and swap:true), `jobs` = id -> { id, word, status, family, paidFrom },
    // `approved` = word -> id, `delay` = a promise that holds A2 / A4 / A10 answers. A child session may only call A6, A7.
    pictures: { missing: true, on: false, unlimited: false, trial: 5, trialUntil: null, plan: null, planLeft: 0, change: 0, credits: 0, rate: 4, hourLeft: 10, paused: false, swaps: 0, jobs: new Map(), approved: new Map(), delay: 0, mode: 'fake', blocked: new Set(), unsuitable: new Set(), unsuitableSeen: new Set(), codes: {}, ledger: [], retryAfter: 0, seq: 0 },
    scan: { missing: true, on: false, limit: 20, left: 20, hourLeft: 5, paused: false, consent: null, version: 'v1', vendor: 'Test vendor', reply: null },
  };
  const profile = () => {
    const me = acct.who;
    if (!me || !me.signedIn) return null;
    if (me.kind === 'child') return me.id;
    return me.playingAs ? me.playingAs.id : me.id;
  };
  const json = (status, body, headers = {}) => ({
    ok: status >= 200 && status < 300, status,
    headers: { get: (k) => headers[k] ?? null },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  const firstOfNextMonth = () => {
    const d = new Date();
    const y = d.getUTCMonth() === 11 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
    return y + '-' + String((d.getUTCMonth() + 1) % 12 + 1).padStart(2, '0') + '-01';
  };
  const bytes = (v) => new TextEncoder().encode(JSON.stringify(v)).length;

  const scanRoute = async (u, method, init, rawBytes, rawType) => {
    const sc = acct.scan;
    if (sc.missing) return json(404, { error: 'not-found' });
    const me = acct.who;
    if (!me || !me.signedIn) return json(401, { signedIn: false });
    const isChild = me.kind === 'child' || !!me.playingAs;
    if (isChild && u.pathname !== '/api/scan/words') return json(403, { error: 'adult-session-required' }); // all three routes are adult-session only (README Scan)
    if (u.pathname === '/api/scan/allowance' && method === 'GET') {
      return json(200, { on: sc.on, left: sc.left, limit: sc.limit, hourLeft: sc.hourLeft, resetsOn: firstOfNextMonth(), paused: sc.paused, ...(sc.hourResetsAt ? { hourResetsAt: sc.hourResetsAt } : {}), consent: sc.consent, consentVersion: sc.version, vendor: sc.vendor });
    }
    if (u.pathname === '/api/scan/consent' && method === 'POST') {
      const b = init.body ? JSON.parse(init.body) : {};
      if (b.version !== sc.version) return json(400, { error: 'consent-version' });
      sc.consent = { at: new Date().toISOString(), version: b.version };
      return json(200, { consent: sc.consent });
    }
    if (u.pathname === '/api/scan/words' && method === 'POST') {
      if (isChild) return json(403, { error: 'adult-session-required' });
      if (!sc.on) return json(404, { error: 'not-found' });
      if (sc.paused) return json(503, { error: 'scan-paused' });
      if (!sc.consent || sc.consent.version !== sc.version) return json(412, { error: 'consent-required', version: sc.version });
      if (rawType !== 'image/jpeg') return json(415, { error: 'bad-image' });
      if (rawBytes.length > 2097152) return json(413, { error: 'image-too-large' });
      if (sc.hourLeft === 0) return json(429, { error: 'hourly-limit' }, { 'Retry-After': String(sc.retryAfter || 3600) });
      if (sc.left === 0) return json(429, { error: 'monthly-limit', resetsOn: firstOfNextMonth() });
      sc.left -= 1;
      sc.hourLeft -= 1;
      if (sc.hold) await sc.hold; // a promise the test settles: the vendor is slow (Cancel, the 15 second line, a timeout)
      if (sc.reply) { const r = sc.reply(rawBytes, rawType); return json(r.status, r.body); }
      return json(200, { words: ['friend', 'because', 'island'], left: sc.left, resetsOn: firstOfNextMonth() });
    }
    return json(404, { error: 'not-found' });
  };

    const makeStatements = (word, mode) => (mode === 'fake-dirty'
    ? [{ id: word + ':1', s: 'It is nothing like it at all.' }, { id: word + ':2', s: 'Go to www.example.com and see the ' + word + '.' }, { id: word + ':3', s: 'The ' + word + ' and the ' + word + ' met.' }]
    : [1, 2, 3].map((n) => ({ id: word + ':' + n, s: ['Mum said the ' + word + ' was lovely.', 'We looked at the ' + word + ' together.', 'I drew a picture of the ' + word + '.'][n - 1] })));
  const sentencesRoute = (u, method, init) => {
    const sc = acct.sentences;
    if (sc.missing) return json(404, { error: 'not-found' });
    const me = acct.who;
    if (!me || !me.signedIn) return json(401, { signedIn: false });
    const isChild = me.kind === 'child' || !!me.playingAs;
    const read = u.pathname === '/api/sentences' && method === 'GET';
    if (isChild && !read) return json(403, { error: 'adult-session-required' });
    if (u.pathname === '/api/sentences/allowance' && method === 'GET') return json(200, { on: sc.on, left: sc.left, limit: sc.limit, hourLeft: sc.hourLeft, paused: sc.paused });
    if (read) {
      const words = (u.searchParams.get('words') || '').split(',').filter(Boolean);
      if (words.length < 1 || words.length > 15) return json(413, { error: 'too-many-words' });
      return json(200, { items: words.filter((w) => sc.bank[w] && ['ok', 'partial'].includes(sc.bank[w].status)).map((w) => ({ word: w, statements: sc.bank[w].statements })) });
    }
    if (u.pathname === '/api/sentences/report' && method === 'POST') return { ok: true, status: 204, headers: { get: () => null }, json: async () => null };
    if (u.pathname === '/api/sentences' && method === 'POST') {
      if (!sc.on) return json(404, { error: 'not-found' });
      if (sc.paused) return json(503, { error: 'paused' });
      const b = init.body ? JSON.parse(init.body) : {};
      const words = Array.isArray(b.words) ? b.words : [];
      if (words.length < 1 || words.length > 15) return json(413, { error: 'too-many-words' });
      const items = [];
      for (const w of words) {
        if (typeof w !== 'string' || !/^[a-z]{2,20}$/.test(w)) { items.push({ word: String(w), status: 'refused' }); continue; }
        if (sc.bank[w]) { items.push({ word: w, status: sc.bank[w].status, statements: sc.bank[w].statements }); continue; }
        if (sc.hourLeft === 0) return json(429, { error: 'hourly-limit' }, { 'Retry-After': String(sc.retryAfter || 3600) });
        if (sc.left === 0) return json(429, { error: 'monthly-limit' });
        sc.left -= 1; sc.hourLeft -= 1; sc.events.push(w);
        if (sc.mode === 'fake-fail') { sc.bank[w] = { status: 'failed', statements: [] }; items.push({ word: w, status: 'failed' }); continue; }
        if (sc.mode === 'fake-slow') { items.push({ word: w, status: 'writing' }); continue; }
        sc.bank[w] = { status: 'ok', statements: makeStatements(w, sc.mode) };
        items.push({ word: w, status: 'ok', statements: sc.bank[w].statements });
      }
      return json(200, { items, left: sc.left });
    }
    return json(404, { error: 'not-found' });
  };

  // ---- SB6 pictures + credits (contract v4, WP-A-account-brief.md) --------------------------------------------------------------
  const pic = acct.pictures;
  const today = () => new Date().toISOString().slice(0, 10);
  const trialLive = () => pic.trial > 0 && !!pic.trialUntil && pic.trialUntil >= today();
  const picLeft = () => (trialLive() ? pic.trial : 0) + (pic.plan ? pic.planLeft : 0) + pic.change;
  const famId = () => (acct.who.kind === 'child' ? acct.who.parentId : acct.who.id);
  const noBody = { ok: true, status: 204, headers: { get: () => null }, json: async () => null };
  const picId = () => { pic.seq += 1; return String(pic.seq).padStart(32, 'a'); };
  const WORD = /^[a-z]{2,20}$/;
  const ledger = (reason, amount, pictures) => pic.ledger.push({ at: new Date().toISOString(), reason, amount, pictures });
  // Take one picture (trial, then plan, then change); a swap is only taken when `swap` is true. Returns { from } or { res } (the error answer).
  const spend = (swap) => {
    if (pic.unlimited) return { from: 'unlimited' };
    let from = null;
    const take = () => {
      if (trialLive()) { pic.trial -= 1; return 'trial'; }
      if (pic.plan && pic.planLeft > 0) { pic.planLeft -= 1; return 'plan'; }
      if (pic.change > 0) { pic.change -= 1; return 'change'; }
      return null;
    };
    from = take();
    if (!from) {
      if (pic.credits < 1) return { res: json(402, { error: 'no-pictures-left' }) };
      if (swap !== true) return { res: json(402, { error: 'swap-needed', credits: pic.credits, rate: pic.rate }) };
      pic.credits -= 1; pic.change += pic.rate; pic.swaps += 1; ledger('exchange', -1, pic.rate);
      from = take();
    }
    ledger('picture', 0, -1);
    return { from };
  };
  const refund = (job) => {
    const f = job.paidFrom;
    if (f === 'trial') pic.trial += 1; else if (f === 'plan') pic.planLeft += 1; else if (f === 'change') pic.change += 1;
    if (f !== 'unlimited') ledger('picture-refund', 0, 1);
  };
  const settle = (job) => { // a job that is making finishes (or fails) the first time it is read, unless the mode is slow
    if (job.status !== 'making' || pic.mode === 'fake-slow') return;
    if (pic.mode === 'fake-fail') { job.status = 'failed'; refund(job); } else job.status = 'ready';
  };
  pic.finish = (word) => { for (const j of pic.jobs.values()) if (j.word === word && j.status === 'making') { j.status = pic.mode === 'fake-fail' ? 'failed' : 'ready'; if (j.status === 'failed') refund(j); } };
  const jobFor = (fam, word, statuses) => [...pic.jobs.values()].find((j) => j.family === fam && j.word === word && statuses.includes(j.status));
  const makeJob = (fam, word, swap) => {
    if (pic.paused) return json(503, { error: 'paused' });
    if (pic.hourLeft === 0) return json(429, { error: 'hourly-limit' }, { 'Retry-After': String(pic.retryAfter || 3600) });
    const swapsBefore = pic.swaps;
    const sp = spend(swap);
    if (sp.res) return sp.res;
    if (pic.hourLeft > 0) pic.hourLeft -= 1;
    const id = picId();
    pic.jobs.set(id, { id, word, status: 'making', family: fam, paidFrom: sp.from });
    return json(202, { word, status: 'making', id, ...(pic.swaps > swapsBefore ? { swapped: true } : {}) });
  };
  const wordAnswer = (word) => {
    if (typeof word !== 'string' || !WORD.test(word)) return json(400, { error: 'bad-word' });
    if (pic.blocked.has(word)) return json(422, { error: 'refused' });
    return null;
  };
  const familyBody = () => ({
    enabled: true, credits: { available: pic.credits, held: 0, expiring: 0 }, ledger: pic.ledger.slice().reverse(), stories: [],
    pictures: { unlimited: pic.unlimited, left: pic.unlimited ? null : picLeft(), change: pic.change, trial: trialLive() ? { left: pic.trial, until: pic.trialUntil } : null, plan: pic.plan, rate: pic.rate },
  });
  const creditsRoute = async (u, method, init) => {
    if (pic.missing || !pic.on) return json(404, { error: 'not-found' });
    const me = acct.who;
    if (!me || !me.signedIn) return json(401, { signedIn: false });
    if (me.kind === 'child' || me.playingAs) return json(403, { error: 'adult-session-required' });
    if (u.pathname.endsWith('/family') && method === 'GET') return json(200, familyBody());
    if (u.pathname.endsWith('/redeem') && method === 'POST') {
      const b = init.body ? JSON.parse(init.body) : {};
      if (typeof b.code !== 'string' || !(b.code in pic.codes)) return json(404, { error: 'invalid-code' });
      pic.credits += pic.codes[b.code]; delete pic.codes[b.code];
      return json(200, { ok: true, credits: pic.credits });
    }
    return json(404, { error: 'not-found' });
  };
  const picturesRoute = async (u, method, init) => {
    if (pic.missing || !pic.on) return json(404, { error: 'not-found' });
    const me = acct.who;
    if (!me || !me.signedIn) return json(401, { signedIn: false });
    const isChild = me.kind === 'child' || !!me.playingAs;
    const path = u.pathname;
    const q = (k) => (u.searchParams.get(k) || '').split(',').filter(Boolean);
    const fam = famId();
    const approvedRead = path === '/api/pictures/approved' && method === 'GET';
    const imageRead = /^\/api\/pictures\/image\/[A-Za-z0-9]+$/.test(path) && method === 'GET';
    if (approvedRead) {
      const words = q('words');
      if (words.length < 1 || words.length > 15) return json(400, { error: 'too-many' });
      if (words.some((w) => !WORD.test(w))) return json(400, { error: 'bad-word' });
      return json(200, { items: words.filter((w) => pic.approved.has(w)).map((w) => ({ word: w, id: pic.approved.get(w) })) });
    }
    if (imageRead) {
      const j = pic.jobs.get(path.split('/').pop());
      const ok = j && j.family === fam && (j.status === 'approved' || (!isChild && j.status === 'ready'));
      if (!ok) return json(404, { error: 'not-found' });
      return { ok: true, status: 200, headers: { get: (k) => ({ 'content-type': 'image/webp', 'cache-control': 'private, max-age=86400' })[String(k).toLowerCase()] ?? null }, arrayBuffer: async () => new ArrayBuffer(8), json: async () => null };
    }
    if (isChild) return json(403, { error: 'adult-session-required' });
    if (pic.delay) await pic.delay;
    const body = init.body ? JSON.parse(init.body) : {};
    if (path === '/api/pictures/allowance' && method === 'GET') {
      return json(200, { on: true, unlimited: pic.unlimited, left: pic.unlimited ? null : picLeft(), credits: pic.credits, rate: pic.rate, trial: trialLive() ? { left: pic.trial, until: pic.trialUntil } : null, plan: pic.plan, resets: pic.plan ? firstOfNextMonth() : null, paused: pic.paused });
    }
    if (path === '/api/pictures/swap' && method === 'POST') {
      if (body.credits !== 1) return json(400, { error: 'bad-credits' });
      if (pic.paused) return json(503, { error: 'paused' });
      if (pic.unlimited) return json(409, { error: 'unlimited' });
      if (pic.credits < 1) return json(402, { error: 'no-credits' });
      pic.credits -= 1; pic.change += pic.rate; pic.swaps += 1; ledger('exchange', -1, pic.rate);
      return json(200, { change: pic.change, credits: pic.credits, rate: pic.rate });
    }
    if (path === '/api/pictures' && method === 'GET') {
      const words = q('words');
      if (words.length < 1 || words.length > 15) return json(400, { error: 'too-many' });
      if (words.some((w) => !WORD.test(w))) return json(400, { error: 'bad-word' });
      return json(200, { items: words.map((w) => {
        for (const j of pic.jobs.values()) if (j.family === fam && j.word === w) settle(j);
        const ap = jobFor(fam, w, ['approved']);
        const cand = jobFor(fam, w, ['ready', 'making', 'failed', 'none']);
        const status = cand ? cand.status : ap ? 'approved' : pic.unsuitableSeen.has(w) ? 'unsuitable' : 'none';
        return { word: w, status, ...(cand && (cand.status === 'ready' || cand.status === 'making') ? { candidate: { id: cand.id } } : {}), ...(ap ? { approved: { id: ap.id } } : {}), at: new Date().toISOString() };
      }) });
    }
    if (path === '/api/pictures' && method === 'POST') {
      const bad = wordAnswer(body.word);
      if (bad) return bad;
      if (pic.paused) return json(503, { error: 'paused' });
      const w = body.word;
      const ready = jobFor(fam, w, ['ready']);
      if (ready) return json(200, { word: w, status: 'ready', id: ready.id });
      const making = jobFor(fam, w, ['making']);
      if (making) return json(409, { error: 'already-making', id: making.id });
      if (pic.unsuitable.has(w)) { pic.unsuitableSeen.add(w); return json(200, { word: w, status: 'unsuitable' }); }
      return makeJob(fam, w, body.swap);
    }
    if (path === '/api/pictures/decide-all' && method === 'POST') {
      const ids = Array.isArray(body.ids) ? body.ids : null;
      if (!ids || ids.length < 1 || ids.length > 15) return json(400, { error: 'too-many' });
      return json(200, { items: ids.map((id) => {
        const j = pic.jobs.get(id);
        if (!j || j.family !== fam) return { id, error: 'not-yours' };
        settle(j);
        if (j.status !== 'ready') return { id, error: 'not-ready' };
        const old = pic.approved.get(j.word); if (old) pic.jobs.delete(old);
        j.status = 'approved'; pic.approved.set(j.word, id);
        return { word: j.word, approved: { id } };
      }) });
    }
    let m = /^\/api\/pictures\/([A-Za-z0-9]+)\/decide$/.exec(path);
    if (m && method === 'POST') {
      const j = pic.jobs.get(m[1]);
      if (!j) return json(404, { error: 'not-found' });
      if (j.family !== fam) return json(403, { error: 'not-yours' });
      settle(j);
      const choice = body.choice;
      if (!['use', 'another', 'none'].includes(choice)) return json(400, { error: 'bad-choice' });
      if (choice === 'another') {
        if (!['ready', 'approved'].includes(j.status)) return json(409, { error: 'not-ready' });
        const r = makeJob(fam, j.word, body.swap);
        if (r.status !== 202) return r;
        if (j.status === 'ready') pic.jobs.delete(j.id);
        return r;
      }
      if (j.status !== 'ready') return json(409, { error: 'not-ready' });
      if (choice === 'use') {
        const old = pic.approved.get(j.word); if (old) pic.jobs.delete(old);
        j.status = 'approved'; pic.approved.set(j.word, j.id);
        return json(200, { word: j.word, approved: { id: j.id } });
      }
      pic.jobs.delete(j.id);
      return json(200, { word: j.word, status: 'none' });
    }
    m = /^\/api\/pictures\/word\/([^/]+)$/.exec(path);
    if (m && method === 'DELETE') {
      const w = m[1];
      const mine = [...pic.jobs.values()].filter((j) => j.family === fam && j.word === w);
      if (!mine.length) return json(404, { error: 'not-found' });
      for (const j of mine) pic.jobs.delete(j.id);
      pic.approved.delete(w);
      return noBody;
    }
    return json(404, { error: 'not-found' });
  };

  acct.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method || 'GET';
    const isScan = u.pathname.startsWith('/api/scan/');
    // A scanned picture is never kept: only its size and type are recorded.
    const rawBytes = isScan && u.pathname === '/api/scan/words' && init.body != null ? Buffer.from(init.body) : null;
    const rawType = rawBytes ? ((init.headers && (init.headers['Content-Type'] || init.headers['content-type'])) || '') : '';
    acct.calls.push(rawBytes
      ? { method, path: u.pathname, credentials: init.credentials, bytes: rawBytes.length, type: rawType }
      : { method, path: u.pathname, credentials: init.credentials, body: init.body });
    if (init.credentials !== 'include') throw new Error('every call must send credentials: include');
    if (acct.offline) throw new TypeError('Failed to fetch');
    if (u.pathname === '/api/me') return acct.meStatus ? json(acct.meStatus, { error: 'forced' }) : json(200, acct.who || { signedIn: false });
    if (isScan) return scanRoute(u, method, init, rawBytes, rawType);
    if (u.pathname.startsWith('/api/sentences')) return sentencesRoute(u, method, init);
    if (u.pathname.startsWith('/api/pictures')) return picturesRoute(u, method, init);
    if (/^\/api\/(credits|story)\/(family|redeem)$/.test(u.pathname)) return creditsRoute(u, method, init);
    if (acct.failNext && acct.failNext.times > 0) {
      acct.failNext.times -= 1;
      return json(acct.failNext.status, { error: 'forced' });
    }
    const pid = profile();
    if (!pid) return json(401, { signedIn: false });
    const body = init.body ? JSON.parse(init.body) : undefined;
    // /api/children (waystead-account src/lib/data-api.ts): an adult playing as themselves, their own children only.
    const kids = /^\/api\/children(?:\/([^/]+)\/game\/(spellbright|wordbright|compose)(?:\/([A-Za-z0-9._:-]{1,64}))?)?$/.exec(u.pathname);
    if (kids) {
      const me = acct.who;
      if (me.kind !== 'parent' || me.playingAs) return json(403, { error: 'adult-session-required' });
      const mine = acct.children(me.id);
      const [, cid, game, key] = kids;
      if (!cid) return json(200, { children: mine });
      if (!mine.some((c) => c.id === cid)) return json(404, { error: 'no-such-child' });
      if (!acct.data.has(cid)) acct.data.set(cid, new Map());
      const rows = acct.data.get(cid);
      if (!key && method === 'GET') {
        const items = {};
        for (const [k, v] of rows) if (k.startsWith(game + '/')) items[k.slice(game.length + 1)] = v;
        return json(200, { game, items });
      }
      if (method !== 'PUT') return json(405, { error: 'method' });
      if (bytes(body.value) > 65536) return json(413, { error: 'value-too-large' });
      const id = game + '/' + key;
      const cur = rows.get(id);
      if ((cur ? cur.version : 0) !== body.version) return json(409, { error: 'version-conflict', value: cur ? cur.value : null, version: cur ? cur.version : 0 });
      const next = { value: JSON.parse(JSON.stringify(body.value)), version: (cur ? cur.version : 0) + 1, updatedAt: new Date().toISOString() };
      rows.set(id, next);
      return json(200, { version: next.version, updatedAt: next.updatedAt });
    }
    if (u.pathname === '/api/prefs') {
      const cur = acct.prefs.get(pid) || { theme: 'system', dayStyle: 'garden', prefs: {} };
      if (method === 'GET') return json(200, cur);
      if (bytes(body.prefs || {}) > 4096) return json(413, { error: 'prefs-too-large' });
      const next = { ...cur, ...body };
      acct.prefs.set(pid, next);
      return json(200, next);
    }
    const m = /^\/api\/game\/(spellbright|wordbright|compose)(?:\/([A-Za-z0-9._:-]{1,64}))?$/.exec(u.pathname);
    if (!m) return json(404, { error: 'unknown-game' });
    const [, game, key] = m;
    // A parent's values: only through /api/children (waystead-account src/lib/data-api.ts).
    if (game === 'compose' && ['settings', 'marks'].includes(key) && method !== 'GET') return json(403, { error: 'parent-only-key' });
    if (!acct.data.has(pid)) acct.data.set(pid, new Map());
    const rows = acct.data.get(pid);
    if (!key && method === 'GET') {
      const items = {};
      for (const [k, v] of rows) if (k.startsWith(game + '/')) items[k.slice(game.length + 1)] = v;
      return json(200, { game, items });
    }
    const id = game + '/' + key;
    if (method === 'DELETE') { rows.delete(id); return { ok: true, status: 204, headers: { get: () => null }, json: async () => null }; }
    if (method === 'PUT') {
      if (bytes(body.value) > 65536) return json(413, { error: 'value-too-large' });
      const cur = rows.get(id);
      if ((cur ? cur.version : 0) !== body.version) return json(409, { error: 'version-conflict', value: cur ? cur.value : null, version: cur ? cur.version : 0 });
      const next = { value: JSON.parse(JSON.stringify(body.value)), version: (cur ? cur.version : 0) + 1, updatedAt: new Date().toISOString() };
      rows.set(id, next);
      return json(200, { version: next.version, updatedAt: next.updatedAt });
    }
    return json(405, { error: 'method' });
  };

  // Write a value as another device would (bumping the version).
  acct.put = (pid, game, key, value) => {
    if (!acct.data.has(pid)) acct.data.set(pid, new Map());
    const rows = acct.data.get(pid);
    const cur = rows.get(game + '/' + key);
    rows.set(game + '/' + key, { value, version: (cur ? cur.version : 0) + 1, updatedAt: new Date().toISOString() });
  };
  acct.get = (pid, game, key) => {
    const r = acct.data.get(pid) && acct.data.get(pid).get(game + '/' + key);
    return r ? r.value : undefined;
  };
  return acct;
}

export function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
    keys: () => [...m.keys()],
    get size() { return m.size; },
  };
}

// Timers the test runs by hand (debounce).
export function manualTimers() {
  let next = 1;
  const due = new Map();
  return {
    setTimer: (fn) => { const id = next++; due.set(id, fn); return id; },
    clearTimer: (id) => due.delete(id),
    run: async () => { const fns = [...due.values()]; due.clear(); for (const fn of fns) await fn(); },
    get pending() { return due.size; },
  };
}

export const ADULT = { signedIn: true, kind: 'parent', id: '11111111-1111-4111-8111-111111111111', displayName: 'Alex Green', role: 'parent', childLimit: 5, plan: 'parent', playingAs: null };
export const KID_A = { id: '22222222-2222-4222-8222-222222222222', nickname: 'Sam', year: 4, avatar: 'ottie' };
export const KID_B = { id: '33333333-3333-4333-8333-333333333333', nickname: 'Robin', year: 6, avatar: 'fizz' };
export const CHILD_A = { signedIn: true, kind: 'child', id: KID_A.id, nickname: KID_A.nickname, year: 4, avatar: 'ottie', parentId: ADULT.id };
export const playingAs = (kid) => ({ ...ADULT, playingAs: kid });
