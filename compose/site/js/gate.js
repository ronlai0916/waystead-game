// Login before play (REQUIRE_SIGN_IN): signed out, every page is locked except
// For parents. A page where a child is writing is busy: nothing redraws under it.
export const isLocked = (path) => path !== 'about';
export const isPlayPath = (path) => /^t\/[a-z-]+\/(plan|write|check|better)$/.test(path) || /^c\/[a-z-]+\/(go|challenge)$/.test(path) || /^own\/w[0-9a-f]+$/.test(path) || /^adv\/a[0-9a-f]+$/.test(path);
export const isComposePath = (path) => /^(t|c|writing|comics|own|adv|grownups)(\/|$)/.test(path);
