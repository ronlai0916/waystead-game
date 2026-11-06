// AI feedback, from the Waystead account (POST /api/compose/feedback). It's asked
// for only when a parent has turned it on. Anything else, a refusal, a fallback
// or no network, is simply no feedback: the automatic checks are always there.
export const SPELLINGS_MAX = 5;

/** The reply as the game will use it, or null. */
export function cleanFeedback(r) {
  if (!r || !Array.isArray(r.stars) || r.stars.length !== 2 || typeof r.wish !== 'string' || !Array.isArray(r.spellings)) return null;
  if (!r.stars.every((s) => typeof s === 'string' && s.trim()) || !r.wish.trim()) return null;
  const spellings = r.spellings.filter((s) => s && typeof s.word === 'string' && typeof s.suggestion === 'string').slice(0, SPELLINGS_MAX);
  return { stars: r.stars, wish: r.wish, spellings };
}

export async function askFeedback({ origin, taskId, level, text, fetch: doFetch = (...a) => globalThis.fetch(...a) }) {
  try {
    const res = await doFetch(origin + '/api/compose/feedback', { method: 'POST', credentials: 'include', mode: 'cors', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId, level, text }) });
    return res.ok ? cleanFeedback(await res.json()) : null;
  } catch (e) {
    return null;
  }
}
