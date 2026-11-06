// Login before play (REQUIRE_SIGN_IN): signed out, every page is locked except
// For parents. A page where a child is writing is busy: nothing redraws under it.
export const isLocked = (path) => path !== 'about';
export const isPlayPath = (path) => /^t\/[a-z-]+\/(plan|write|check|better)$/.test(path);
export const isComposePath = (path) => /^(t|writing|grownups)(\/|$)/.test(path);
