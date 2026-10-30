// A small celebration when a word is spelled and when a chapter test is
// passed: pieces burst outward. Each style draws the pieces (css/styles/*.css):
// petals in Sunny garden, paint splats in Paint box, stars in Night sky.
// With reduced motion the CSS hides them and shows a still ring instead.
// No inline styles (CSP): positions are set here with el.style.setProperty.
// Copied from wordbright/site/js/ui/celebrate.js.

// spread: 1 round a badge, about 2.5 round a picture.
export function burstHtml(pieces = 12, spread = 1) {
  return '<span class="burst" data-spread="' + spread + '" aria-hidden="true">' + '<i></i>'.repeat(pieces) + '</span>';
}

// Where each piece flies to: evenly round a circle, at three distances.
export function burstOffsets(pieces, spread = 1) {
  const out = [];
  for (let k = 0; k < pieces; k++) {
    const a = (k / pieces) * Math.PI * 2 + (k % 2 ? 0.25 : -0.1);
    const d = (30 + (k % 3) * 13) * spread;
    out.push({ dx: Math.round(Math.cos(a) * d), dy: Math.round(Math.sin(a) * d - 8), rot: (k * 67) % 360, delay: (k % 4) * 40 });
  }
  return out;
}

export function placeBursts(root) {
  root.querySelectorAll('.burst:not([data-placed])').forEach((b) => {
    const pieces = b.querySelectorAll('i');
    burstOffsets(pieces.length, Number(b.dataset.spread) || 1).forEach((o, k) => {
      const p = pieces[k].style;
      p.setProperty('--dx', o.dx + 'px');
      p.setProperty('--dy', o.dy + 'px');
      p.setProperty('--rot', o.rot + 'deg');
      p.setProperty('--delay', o.delay + 'ms');
    });
    b.dataset.placed = '';
  });
}
