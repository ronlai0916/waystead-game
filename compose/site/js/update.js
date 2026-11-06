// One-load updates (G4b). A new release's worker takes over at once (sw.js),
// but this page is still running the old files, so it loads itself again: now,
// or once the player has left the game or test in progress.
// The worker takes a few seconds to install (longer on a phone), and until then
// the old app is all there is. settled() says when that wait is over, so a page
// the old app doesn't know can wait instead of saying it isn't there.

export const UPDATE_WAIT_MS = 10000;

// sw: navigator.serviceWorker, or null where there is no worker (local testing).
// isBusy(): a game or test is in progress. reload(): load the page again.
// onLeave(fn): call fn whenever the player moves to another page.
// Call this before anything else that waits: a worker can take over early.
export function watchForUpdate({ sw, isBusy, reload, onLeave, wait = UPDATE_WAIT_MS, setTimer = setTimeout }) {
  if (!sw) return { register() {}, settled: () => Promise.resolve() };
  const hadWorker = !!sw.controller; // no worker before: this page is already current
  let queued = false;
  let ready = Promise.resolve(null);
  sw.addEventListener('controllerchange', () => {
    if (!hadWorker || queued) return;
    if (!isBusy()) { reload(); return; }
    queued = true;
    onLeave(() => { if (!isBusy()) reload(); }); // not on the next word: when the game is left
  });

  // Is a new worker on its way? Stays pending while one is, as the reload ends
  // the wait; resolves when there is none, or it failed.
  async function check() {
    if (!hadWorker) return;
    const reg = await ready;
    if (!reg) return;
    try { await reg.update(); } catch (e) { /* offline: only what is here */ }
    const coming = reg.installing || reg.waiting;
    if (!coming) return;
    await new Promise((resolve) => coming.addEventListener('statechange', () => { if (coming.state === 'redundant') resolve(); }));
  }

  return {
    register() { ready = sw.register('sw.js').catch(() => null); },
    settled: () => Promise.race([check(), new Promise((resolve) => { setTimer(resolve, wait); })]),
  };
}
