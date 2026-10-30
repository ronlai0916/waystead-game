// The small celebration for a Star word's +5 and the end screen: pieces that
// burst outward. Each style draws the pieces (css/styles/*.css); with reduced
// motion the CSS hides them. No inline styles (CSP): positions are set here
// with el.style.setProperty.

export const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';

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
