// SB5-WP-B (TR-80, TR-100, D30, D34, D37): where a grown-up's role and chosen name are kept. No DOM.
// Account copy: prefs.sbRole = { r, n?, at } through the prefs sync's extra/setExtra (shared/account/prefs.js, WP-I), so it survives every
// device and every game. Device copy (first paint, and the only copy offline): localStorage `sb.role:<playerId>` holds the same object.
// Order on read: the device copy; the account copy wins when its `at` is newer (and is written back to the device).
// Changing the role or name writes sbRole only: no list, week, child or result is touched (BR-24 AC3).
// Convenience keys (this device only, never sent): `sb.roleAsk:<id>` ("Not now": ask again after 7 days), `sb.t3:<id>` (teacher opened results).
import { ROLES, roleOf, normRole, cleanName, NAME_LINE } from './role-doc.js';

export const ROLE_KEY = 'sb.role:';
export const ASK_KEY = 'sb.roleAsk:';
export const OPENED_KEY = 'sb.t3:';
export const PREF_NAME = 'sbRole';
export const ASK_AGAIN_MS = 7 * 24 * 60 * 60 * 1000;

const readJson = (storage, key) => { try { return JSON.parse(storage.getItem(key)); } catch (e) { return null; } };
const write = (storage, key, v) => { try { storage.setItem(key, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch (e) { return false; } };

/**
 * storage: localStorage (or a stand-in); playerId: the adult's id; prefs: the prefs sync ({ extra, setExtra }) or null (offline-only: device copy);
 * now: () => ms. Every storage call is in try/catch: the page works without storage.
 */
export function createRoleStore({ storage, playerId, prefs = null, now = () => Date.now() }) {
  const key = ROLE_KEY + playerId;
  const device = () => normRole(readJson(storage, key));
  const account = () => { try { return prefs && prefs.extra ? normRole(prefs.extra(PREF_NAME)) : null; } catch (e) { return null; } };

  // SB5 M3: a role chosen offline, or before the account's prefs were read, is on the device only. Once the prefs have been read
  // (prefs.loaded) and the account has no copy, or an older one, the device copy is sent. Tried once per store: a refusal is not retried in a loop.
  let sentUp = false;
  function sendUp(d, a) {
    if (sentUp || !d || !prefs || !prefs.setExtra || prefs.loaded !== true) return;
    if (a && a.at >= d.at) return;
    sentUp = true;
    try { prefs.setExtra(PREF_NAME, d); } catch (e) { /* the device copy stays; tried again next load */ }
  }

  /** { r, n?, at } or null (no role chosen yet). */
  function get() {
    const d = device();
    const a = account();
    sendUp(d, a);
    if (a && (!d || a.at > d.at)) { write(storage, key, a); return a; }
    return d || a || null;
  }
  function put(entry) {
    write(storage, key, entry);
    let sent = true;
    if (prefs && prefs.setExtra) { try { sent = prefs.setExtra(PREF_NAME, entry) !== false; } catch (e) { sent = false; } }
    return sent;
  }
  /**
   * Choose a role (and, when `name` is a string, the name: '' = none; undefined keeps the name already saved). A name must pass cleanName
   * (TR-100): otherwise { error: NAME_LINE } and nothing changes. Answers { ok, entry } | { error }.
   */
  function set(role, name) {
    if (!ROLES.includes(role)) return { error: 'bad-role' };
    let n;
    if (name === undefined) { const cur = get(); n = cur && cur.n ? cur.n : ''; }
    else if (name === '') n = '';
    else { n = cleanName(name); if (!n) return { error: NAME_LINE }; }
    const prev = get();
    const entry = { r: role, ...(n ? { n } : {}), at: Math.max(now(), prev ? prev.at + 1 : 0) };
    if (!put(entry)) return { error: 'not-saved' };
    return { ok: true, entry };
  }
  const setName = (name) => { const cur = get(); return set(cur ? cur.r : 'parent', name === '' ? '' : name); };
  /** The role to draw pages with: parent when nothing is chosen. */
  const role = () => { const e = get(); return roleOf(e && e.r); };
  const name = () => { const e = get(); return e && e.n ? e.n : ''; };

  // "Not now" on 00a: role parent, ask again after 7 days (this device only)
  const notNow = () => write(storage, ASK_KEY + playerId, String(now() + ASK_AGAIN_MS));
  function shouldAsk() {
    if (get()) return false;
    let until = 0;
    try { until = Number(storage.getItem(ASK_KEY + playerId)) || 0; } catch (e) { until = 0; }
    return now() >= until;
  }
  /**
   * T1 round 2 (checker S1): the ONE rule for asking the role. 'no' = nobody is asked (a role exists here, or "Not now" is still running);
   * 'wait' = no role on this device but the account's prefs have not been read (or there is no sync), so a role may exist elsewhere: not yet;
   * 'ask' = no role anywhere we can see: show the role page. app.js landing() and grownups() both use it.
   */
  function askState() {
    if (!shouldAsk()) return 'no';
    if (!prefs || prefs.loaded !== true) return 'wait';
    return 'ask';
  }
  // The teacher's "3 steps" panel: has this device opened the class results? (convenience, absent = not done)
  const openedResults = () => { try { return storage.getItem(OPENED_KEY + playerId) === '1'; } catch (e) { return false; } };
  const markOpenedResults = () => write(storage, OPENED_KEY + playerId, '1');

  return { get, set, setName, role, name, notNow, shouldAsk, askState, openedResults, markOpenedResults };
}
