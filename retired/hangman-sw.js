// Served at /hangman/sw.js after the game moved to /spellbright/ (28 Oct 2026).
// A browser that installed the old service worker under /hangman/ fetches this
// on its next update check: it removes the old caches, unregisters itself and
// sends any open /hangman/ tab to the same page under /spellbright/.
// Progress is in localStorage for the whole site, so nothing is lost.
const OLD = ['spellbright-2026-10-26a', 'spellbright-2026-10-27a', 'spellbright-2026-10-27b'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await Promise.all(OLD.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const tabs = await self.clients.matchAll({ type: 'window' });
    for (const t of tabs) {
      try { await t.navigate(t.url.replace('/hangman/', '/spellbright/')); } catch (e) { /* the tab can stay */ }
    }
  })());
});
