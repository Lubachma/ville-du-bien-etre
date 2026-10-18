/* =========================================================================
   Compagnon (dessins) : lapin, marmotte ou ourson, dans un de ses neuf gestes, avec un de ses neuf accessoires. Des formes simples
   et rondes, comme les visiteurs. (sx, sy) est le point sous ses pieds ; assis, il mesure environ 0,22 largeur de case de haut.
   ========================================================================= */
// Pelage, ventre et museau, dedans des oreilles, détails (nez, queue de la marmotte).
const COMPANION_LOOKS = {
  lapin: { fur: '#ece4d8', belly: '#fbf7f0', inner: '#f2b6be', dark: '#7a6658' },
  marmotte: { fur: '#b47c4b', belly: '#e6caa2', inner: '#8a5a35', dark: '#5e3f28' },
  ourson: { fur: '#8c5b3d', belly: '#d2a275', inner: '#d2a275', dark: '#4a3022' },
};
const COMPANION_STANDING = ['walk', 'stretch', 'water', 'paint', 'cheer'];
const CROWN_FLOWERS = ['#e87ba4', '#f2c14e', '#7fb3e0', '#ffffff', '#e87ba4', '#f2c14e', '#a8d38a'];

// look = { species, wear, pose, face } ; face ne dessine que la tête (bouton du compagnon). t (secondes) choisit l'image.
function drawCompanion(g, sx, sy, look = {}, t = 0) {
  const u = g.tw * .22, kind = COMPANION_LOOKS[look.species] || COMPANION_LOOKS.lapin, pose = look.pose || 'idle', wear = look.wear || '';
  const ctx = g.ctx, X = x => sx + x * u, Y = y => sy - y * u, c = hex => g.c(hex), fur = c(kind.fur), arm = c(shade(kind.fur, -.1));
  const oval = (x, y, rx, ry, fill, rot = 0) => ellipseFill(g, X(x), Y(y), rx * u, ry * u, fill, rot);
  const dot = (x, y, r, fill) => g.circle(X(x), Y(y), r * u, fill);
  const stroke = (pts, color, w) => line(g, pts.map(([x, y]) => [X(x), Y(y)]), color, w * u);
  const poly = (pts, fill) => g.poly(pts.map(([x, y]) => [X(x), Y(y)]), fill);
  const half = (x, y, rx, ry, fill) => { ctx.beginPath(); ctx.ellipse(X(x), Y(y), rx * u, ry * u, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  const sparkle = (x, y, r) => poly([[x, y + r], [x + r * .3, y + r * .3], [x + r, y], [x + r * .3, y - r * .3], [x, y - r], [x - r * .3, y - r * .3], [x - r, y], [x - r * .3, y + r * .3]], '#f2c14e');
  const f = Math.floor(t / .4) % 2;   // deux images qui alternent

  // Oreilles (derrière la tête), tête, visage : yeux ouverts, fermés (méditation, sommeil) ou rieurs (joie).
  function ears(hx, hy, s) {
    for (const k of [-1, 1]) {
      if (look.species === 'marmotte') dot(hx + k * .17 * s, hy + .18 * s, .065 * s, c(kind.inner));
      else if (look.species === 'ourson') { dot(hx + k * .19 * s, hy + .19 * s, .085 * s, fur); dot(hx + k * .19 * s, hy + .19 * s, .045 * s, c(kind.inner)); }
      else { oval(hx + k * .1 * s, hy + .3 * s, .065 * s, .2 * s, fur, k * .2); oval(hx + k * .1 * s, hy + .3 * s, .03 * s, .14 * s, c(kind.inner), k * .2); }
    }
  }
  function head(hx, hy, s, eyes) {
    ears(hx, hy, s);
    dot(hx, hy, .25 * s, fur);
    oval(hx, hy - .08 * s, .12 * s, .08 * s, c(kind.belly));
    oval(hx, hy - .05 * s, .035 * s, .025 * s, c(kind.dark));
    stroke([[hx - .03 * s, hy - .1 * s], [hx, hy - .12 * s], [hx + .03 * s, hy - .1 * s]], c(kind.dark), .012 * s);
    for (const k of [-1, 1]) {
      const ex = hx + k * .09 * s, ey = hy + .03 * s;
      if (eyes === 'closed') stroke([[ex - .035 * s, ey], [ex, ey - .02 * s], [ex + .035 * s, ey]], '#2c2c2c', .016 * s);
      else if (eyes === 'happy') stroke([[ex - .035 * s, ey - .01 * s], [ex, ey + .02 * s], [ex + .035 * s, ey - .01 * s]], '#2c2c2c', .016 * s);
      else { dot(ex, ey, .033 * s, '#2c2c2c'); dot(ex + .012 * s, ey + .015 * s, .011 * s, '#ffffff'); }
      dot(hx + k * .16 * s, hy - .06 * s, .045 * s, 'rgba(236,120,120,.35)');
    }
    headWear(hx, hy, s);
  }
  // Ce qui se porte sur la tête.
  function headWear(hx, hy, s) {
    if (wear === 'lunettes') {
      for (const k of [-1, 1]) { ctx.beginPath(); ctx.arc(X(hx + k * .09 * s), Y(hy + .03 * s), .06 * s * u, 0, Math.PI * 2); ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = Math.max(1, .014 * s * u); ctx.stroke(); }
      stroke([[hx - .03 * s, hy + .035 * s], [hx + .03 * s, hy + .035 * s]], '#2c2c2c', .014 * s);
    } else if (wear === 'bonnet') {
      half(hx, hy + .1 * s, .26 * s, .2 * s, c('#3f78c4'));
      poly([[hx - .26 * s, hy + .1 * s], [hx + .26 * s, hy + .1 * s], [hx + .25 * s, hy + .16 * s], [hx - .25 * s, hy + .16 * s]], c('#6f9bd6'));
      dot(hx, hy + .32 * s, .055 * s, c('#f6f6f2'));
    } else if (wear === 'couronne') {
      stroke(Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (.85 - .7 * i / 8); return [hx + .24 * s * Math.cos(a), hy + .04 * s + .2 * s * Math.sin(a)]; }), c('#4f9a54'), .02 * s);
      CROWN_FLOWERS.forEach((color, i) => {
        const a = Math.PI * (.85 - .7 * i / 6), x = hx + .24 * s * Math.cos(a), y = hy + .04 * s + .2 * s * Math.sin(a);
        dot(x, y, .042 * s, c(color)); dot(x, y, .015 * s, c('#e3a12f'));
      });
    } else if (wear === 'paille') {
      oval(hx, hy + .14 * s, .4 * s, .08 * s, c('#e7c56a'));
      half(hx, hy + .14 * s, .22 * s, .2 * s, c('#d9b35a'));
      poly([[hx - .22 * s, hy + .15 * s], [hx + .22 * s, hy + .15 * s], [hx + .21 * s, hy + .21 * s], [hx - .21 * s, hy + .21 * s]], c('#d9573b'));
    } else if (wear === 'casque') {
      ctx.beginPath(); ctx.arc(X(hx), Y(hy), .29 * s * u, Math.PI, Math.PI * 2); ctx.strokeStyle = c('#2f3a44'); ctx.lineWidth = Math.max(1, .045 * s * u); ctx.stroke();
      for (const k of [-1, 1]) { oval(hx + k * .28 * s, hy - .02 * s, .065 * s, .1 * s, c('#2f3a44')); dot(hx + k * .28 * s, hy - .02 * s, .04 * s, c('#5c8fd6')); }
    }
  }
  // Ce qui se porte au cou ; la queue de l'écharpe pend sur le côté.
  function neckWear(y, tail) {
    if (wear === 'echarpe') {
      oval(0, y, .22, .065, c('#d9573b'));
      if (tail) poly([[-.15, y], [-.06, y - .03], [-.11, y - .25], [-.2, y - .23]], c('#b8452e'));
    } else if (wear === 'noeud') {
      for (const k of [-1, 1]) poly([[0, y], [k * .11, y + .06], [k * .11, y - .06]], c('#d0628f'));
      dot(0, y, .03, c('#a84a72'));
    } else if (wear === 'cape') dot(0, y, .035, c('#f2c14e'));
  }

  if (look.face) { head(0, .76, 1, 'open'); neckWear(.5, false); return; }

  // Endormi : roulé en boule, la tête posée, quelques « z » qui montent ; la cape devient une couverture.
  if (pose === 'sleep') {
    if (look.species === 'marmotte') oval(-.38, .12, .14, .06, c(kind.dark), .3);
    else dot(-.36, .14, look.species === 'ourson' ? .05 : .075, look.species === 'ourson' ? fur : c(kind.belly));
    oval(-.02, .17, .36, .19, fur);
    if (wear === 'cape') { oval(-.06, .19, .33, .15, c('#2b3a6b')); sparkle(-.2, .22, .04); sparkle(.04, .26, .03); }
    if (wear === 'echarpe') oval(.1, .14, .1, .05, c('#d9573b'));
    head(.26, .22, .76, 'closed');
    for (let i = 0; i < 3; i++) {
      const r = .035 + i * .012, x = .38 + i * .06, y = .52 + i * .1 + (g.anim ? (t * .2) % .05 : 0);
      stroke([[x - r, y + r], [x + r, y + r], [x - r, y - r], [x + r, y - r]], c(kind.dark), .015);
    }
    return;
  }

  const stand = COMPANION_STANDING.includes(pose);
  const lift = pose === 'cheer' ? .12 + .08 * Math.abs(Math.sin(t * 4)) : pose === 'walk' ? .025 * Math.abs(Math.sin(t * 6)) : 0;
  const by = (stand ? .36 : .31) + lift, brx = stand ? .23 : .27, bry = stand ? .27 : .3, hy = .76 + lift;
  // Derrière le corps : la cape, le sac, la queue.
  if (wear === 'cape') {
    poly([[-.18, .58 + lift], [.18, .58 + lift], [.36, .02 + lift], [-.36, .02 + lift]], c('#2b3a6b'));
    sparkle(-.29, .12 + lift, .035); sparkle(.3, .2 + lift, .03);
  }
  if (wear === 'sac') oval(.24, by + .02, .14, .18, c('#3a9a7a'));
  if (look.species === 'marmotte') oval(.27, .12 + lift, .14, .06, c(kind.dark), -.6);
  else dot(.25, .12 + lift, look.species === 'ourson' ? .05 : .075, look.species === 'ourson' ? fur : c(kind.belly));
  // Les pieds, le corps et le ventre.
  const step = pose === 'walk' ? (f ? .03 : -.03) : 0;
  for (const k of [-1, 1]) {
    if (stand) oval(k * .09 + k * step, .03 + lift, .075, .045, arm);
    else oval(k * .13, .04, .1, .055, c(kind.belly));
  }
  oval(0, by, brx, bry, fur);
  oval(0, by - .04, brx * .62, bry * .6, c(kind.belly));
  if (wear === 'sac') for (const k of [-1, 1]) stroke([[k * .13, by + .24], [k * .15, by - .1]], c('#2f7a60'), .035);
  // Les bras, et ce qu'ils tiennent.
  const rest = k => oval(k * .2, by - .02, .07, .1, arm, k * -.3);
  if (pose === 'idle') { rest(-1); rest(1); }
  else if (pose === 'walk') for (const k of [-1, 1]) oval(k * .22, by + k * (f ? .03 : -.03), .06, .1, arm, k * -.2);
  else if (pose === 'read') {
    poly([[-.22, by - .18], [.22, by - .18], [.22, by + .1], [-.22, by + .1]], c('#c4572f'));
    for (const k of [-1, 1]) poly([[0, by - .16], [k * .2, by - .12], [k * .2, by + .12], [0, by + .08]], c('#fbf8ef'));
    for (const k of [-1, 1]) for (let i = 0; i < 3; i++) stroke([[k * .05, by + .02 - i * .05], [k * .16, by + .05 - i * .05]], c('#b9b2a2'), .01);
    if (t % 3 < .5) poly([[0, by - .16], [.12, by - .1], [.1, by + .16], [0, by + .08]], c('#ffffff'));
    for (const k of [-1, 1]) oval(k * .2, by - .12, .06, .07, arm);
  } else if (pose === 'stretch') {
    for (const k of [-1, 1]) {
      if (f) oval(k * .34, by + .12, .13, .06, arm, k * -.2);
      else oval(k * .27, hy + .2, .055, .14, arm, k * -.15);
    }
  } else if (pose === 'meditate') for (const k of [-1, 1]) oval(k * .06, by - .08, .07, .055, arm);
  else if (pose === 'water') {
    rest(-1);
    poly([[.48, .12], [.64, .12], [.6, 0], [.52, 0]], c('#c8693e'));
    oval(.53, .17, .04, .07, c('#4f9a54'), .5); oval(.6, .19, .04, .07, c('#4f9a54'), -.5);
    oval(.34, by - .02, .09, .08, c('#8fa3ad'));
    stroke([[.42, by], [.52, by + .06]], c('#8fa3ad'), .03);
    for (let i = 0; i < 3; i++) { const k = (t * 1.5 + i / 3) % 1; dot(.53 + k * .02, by + .04 - k * (by - .2), .015, c('#5fc0e0')); }
    oval(.26, by, .06, .07, arm);
  } else if (pose === 'paint') {
    rest(-1);
    stroke([[.42, 0], [.5, .55]], c('#8a6a4a'), .025); stroke([[.62, 0], [.54, .55]], c('#8a6a4a'), .025);
    poly([[.4, .3], [.64, .3], [.64, .58], [.4, .58]], c('#fbf8ef'));
    dot(.47, .5, .04, c('#e87ba4')); dot(.56, .44, .035, c('#2a78d6')); dot(.5, .38, .03, c('#f2c14e'));
    const b = f ? .03 : 0;
    stroke([[.27, by + .06 + b], [.38, by + .14 + b]], c('#8a6a4a'), .02);
    dot(.385, by + .145 + b, .018, c('#e87ba4'));
    oval(.26, by + .04 + b, .06, .07, arm);
  } else if (pose === 'cheer') {
    for (const k of [-1, 1]) oval(k * .3, hy + .2, .055, .14, arm, k * -.45);
    const tw = .04 + .015 * Math.sin(t * 6);
    sparkle(-.44, hy + .18, tw); sparkle(.44, hy + .14, tw); sparkle(-.5, hy - .18, tw * .8); sparkle(.5, hy - .2, tw * .8);
  }
  // La tête, puis ce qui se porte au cou.
  head(0, hy, 1, pose === 'meditate' ? 'closed' : pose === 'cheer' ? 'happy' : 'open');
  neckWear(.5 + lift, true);
}

// Le compagnon dans un canevas à part (choix, fiche, bouton, séance, écran de fin), centré, sans sol, ses accessoires et ce qu'il
// tient compris. opts.face : la tête seule, en grand ; opts.t : le temps d'animation.
function paintCompanion(cv, look, size, opts = {}) {
  const d = Math.min(3, window.devicePixelRatio || 1), face = !!(opts.face || look.face);
  cv.width = Math.round(size * d); cv.height = Math.round(size * d);
  const c = cv.getContext('2d');
  c.setTransform(d, 0, 0, d, 0, 0);
  c.clearRect(0, 0, size, size);
  // Assis, il mesure environ 0,22 largeur de case : en entier, 1,51 de haut (oreilles du lapin en plein saut) sur 1,32 de large
  // (plante, chevalet) ; la tête seule, 0,88 sur 0,84.
  const u = face ? size * 1.08 : size * .62, g = makePainter(c, u / .22, 0, 0, { ...readPalette(), night: false, dark: 0 });
  drawCompanion(g, size / 2, face ? size * 1.43 : size * .956, { ...look, face }, opts.t || 0);
}
// La boîte des pixels dessinés (pour les tests) : rien, ou ses bords en points CSS.
function companionBounds(look, size) {
  const cv = document.createElement('canvas');
  paintCompanion(cv, look, size);
  const w = cv.width, h = cv.height, d = w / size, data = cv.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] < 8) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return x1 < 0 ? { empty: true, x0: 0, y0: 0, x1: 0, y1: 0 } : { empty: false, x0: x0 / d, y0: y0 / d, x1: (x1 + 1) / d, y1: (y1 + 1) / d };
}
