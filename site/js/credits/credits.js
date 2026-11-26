// THIS FILE IS A COPY: edit shared/credits/ and run `node tools/sync-shared.mjs`.
// SB6-WP-8 (TRS TR-56, D10): the family's story credits, ONE redeem form and ONE history, shared by Composition and Spellbright.
// Copied into site/js/credits/ and compose/site/js/credits/ (tools/sync-shared.mjs; the entry is WP-9's).
// No storage, no secret. The account answers the same two routes for both games: GET /api/story/family (A9) and POST /api/story/redeem (A8).
// Credits are the one pot: 1 credit is one Story Adventure, or `rate` word pictures (the rate comes from the account, never from here).

/** How the history names each row (the account's `reason`). */
export const REASONS = {
  pack: 'Credit pack',
  code: 'Redeem code',
  plan: 'Monthly plan',
  admin: 'From Waystead',
  story: 'A story',
  'story-failed': 'Story refunded (pictures couldn\'t be drawn)',
  expired: 'Plan stories ran out',
  exchange: 'Story credit used for word pictures',
  picture: 'Word picture',
  'picture-refund': 'Word picture given back',
  trial: 'Free trial pictures',
  'plan-pictures': 'Monthly plan pictures',
};
export const NOT_ACCEPTED = 'That code was not accepted. Check it and try again.';
export const NETWORK = 'We can\'t reach Waystead just now. Check your connection, then try again.';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);

/** The two calls, in the same shape the story client gives: { ok, status, data }. */
export function createCredits({ origin, fetch: doFetch = (...a) => globalThis.fetch(...a), timeoutMs = 20000 } = {}) {
  async function call(method, path, body) {
    const init = { method, credentials: 'include', mode: 'cors', cache: 'no-store', headers: {} };
    if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    if (ctrl) init.signal = ctrl.signal;
    try {
      const res = await doFetch(String(origin).replace(/\/+$/, '') + path, init);
      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: null };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return {
    family: () => call('GET', '/api/story/family'),
    redeem: (code) => call('POST', '/api/story/redeem', { code }),
  };
}

function ledgerCell(l, product) {
  if (product === 'compose') return (l.amount > 0 ? '+' : '') + l.amount; // Composition's own wording, as before
  const parts = [];
  if (Number.isFinite(l.amount) && l.amount !== 0) parts.push(signed(l.amount));
  if (Number.isFinite(l.pictures) && l.pictures !== 0) parts.push(signed(l.pictures) + (Math.abs(l.pictures) === 1 ? ' picture' : ' pictures'));
  return parts.length ? parts.join(', ') : '0';
}

/**
 * The shared card: the balance, the one redeem form (label "Redeem a code", XXXX-XXXX-XXXX, 20 characters) and the one History table.
 * `family` is the account's A9 body. `unlimited` (Spellbright): word pictures never use credits, so the block does not say what a credit is worth in pictures. product 'compose' keeps Composition's wording for stories; 'spellbright' says what a credit is worth in word pictures.
 */
export function creditsCardHtml(f, { product = 'compose', unlimited = false } = {}) {
  const c = f.credits || { available: 0, held: 0, expiring: [] };
  const ledger = Array.isArray(f.ledger) ? f.ledger : [];
  const rows = ledger.map((l) => '<tr><td>' + esc(when(l.at)) + '</td><td>' + esc(REASONS[l.reason] || l.reason) + '</td><td class="num">' + esc(ledgerCell(l, product)) + '</td></tr>').join('');
  const expiring = Array.isArray(c.expiring) ? c.expiring : [];
  const rate = f.pictures && Number.isInteger(f.pictures.rate) ? f.pictures.rate : 0;
  const form = '<form class="stack redeemform" data-redeem><label for="redeem">Redeem a code</label><div class="btnrow"><input id="redeem" class="field" name="code" autocomplete="off" spellcheck="false" maxlength="20" placeholder="XXXX-XXXX-XXXX" data-code><button type="submit" class="btn btn--ghost">Redeem</button></div><p class="small" data-redeemnote role="status"></p></form>';
  const history = rows ? '<details class="ledger"><summary>History</summary><table class="ledgertable"><thead><tr><th>Date</th><th>What</th><th class="num">' + (product === 'compose' ? 'Credits' : 'Change') + '</th></tr></thead><tbody>' + rows + '</tbody></table></details>' : '';
  if (product === 'compose') {
    return '<div class="card setting advcredits" data-credits data-product="compose"><h2>Story credits</h2>'
      + '<p class="bigline"><b data-balance>' + esc(c.available) + '</b> available' + (c.held ? ' · ' + esc(c.held) + ' set aside for a story being made' : '') + '</p>'
      + (expiring.length ? '<p class="small muted">' + expiring.map((e) => esc(e.amount) + ' from your plan until ' + esc(when(e.at))).join('; ') + '</p>' : '')
      + '<p class="small muted">Each Story Adventure uses one credit when its first picture is drawn. Redraws are free, and a story whose pictures can\'t be drawn gives its credit back. Children never see these numbers.</p>'
      + form + history
      + (f.enabled ? '' : '<p class="small muted">Story Adventure isn\'t open yet: pictures can\'t be drawn until it is.</p>') + '</div>';
  }
  return '<div class="pv-credits" data-credits data-product="spellbright"><h3>Story credits</h3>'
    + '<p class="bigline"><b data-balance>' + esc(c.available) + '</b> available' + (c.held ? ' · ' + esc(c.held) + ' set aside for a story being made' : '') + '</p>'
    + (unlimited ? '<p class="small muted">One credit is one story. One code, one pot of credits.</p>' : rate ? '<p class="small muted">One credit is one story, or ' + esc(rate) + ' word pictures. One code, one pot of credits.</p>' : '<p class="small muted">One code, one pot of credits.</p>')
    + form + history + '</div>';
}

/**
 * Wire the form inside `root`. api.redeem(code) answers { ok, status, data }. onChange(message) runs after a code is accepted (the page reloads the card).
 * opts.onAdded(text): a toast. opts.network: Composition's own network line.
 */
export function wireRedeem(root, api, onChange, { onAdded = () => {}, network = NETWORK } = {}) {
  const form = root.querySelector('[data-redeem]');
  if (!form) return;
  const product = (root.querySelector('[data-credits]') || root).dataset.product || 'compose';
  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    const note = root.querySelector('[data-redeemnote]');
    const r = await api.redeem(root.querySelector('[data-code]').value.trim());
    busy = false;
    if (r.ok) {
      const n = r.data && Number.isFinite(r.data.credits) ? r.data.credits : null;
      const msg = product === 'compose'
        ? (n === null ? 'Credits added.' : n + ' credit' + (n === 1 ? '' : 's') + ' added.')
        : 'Code accepted.';
      note.textContent = msg;
      onAdded(product === 'compose' ? 'Credits added' : 'Code accepted');
      onChange(msg);
      return;
    }
    note.textContent = product === 'compose' ? (r.data && r.data.message) || network : r.status === 0 || r.status >= 500 ? network : NOT_ACCEPTED;
  });
}
