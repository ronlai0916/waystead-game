// SB4 plug-in loader check: this folder's files are imported by tools/sb2-smoke.mjs with the harness `H`.
// Each later package adds its own scene file here (a `NN-name.mjs` with `export default (H) => { H.scene(...) }`).
export default function (H) {
  H.scene('SB4 plug-ins load', async () => {
    await H.seedChild(H.W.emptyDoc());
    await H.open(H.MON, '#/');
    await H.until('document.querySelector("main") && document.querySelector("main").innerText.trim().length > 0', 'the page');
    H.ok(await H.has('main section, main .card'), 'the child\'s page drew');
    H.ok(typeof H.serve === 'function' && typeof H.kbFit === 'function' && H.KB_VIEWS.length > 0, 'the harness is complete');
    H.serve('data/nothing.json', '{}'); // set and cleared again at the next scene
    H.serve('data/nothing.json', null);
  });
}
