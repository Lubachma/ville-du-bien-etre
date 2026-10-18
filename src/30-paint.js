/* =========================================================================
   Ville isométrique (canvas)
   ========================================================================= */
function readPalette() {
  const p = { night: cssVar('--night') === '1' };
  for (const c of [...CAT_ORDER, 'prestige', 'decor']) p[c] = cssVar('--cat-' + c) || '#888888';
  p.accent = cssVar('--accent') || '#2e6f4e';
  p.danger = cssVar('--danger') || '#b4452e';
  return p;
}

function makePainter(ctx, tw, ox, oy, pal) {
  const hw = tw / 2, hh = tw / 4;
  const night = pal.night;
  const P = (x, y, z = 0) => [ox + (x - y) * hw, oy + (x + y) * hh - z];
  const g = { ctx, tw, hw, hh, P, night, pal };
  g.c = (hex, k = .42) => (night ? mix(hex, NIGHT_TINT, k) : hex);
  g.cat = (c) => (night ? mix(pal[c], NIGHT_TINT, .18) : pal[c]);
  g.win = night ? '#ffd47a' : '#cfe3ec';
  g.winR = night ? '#f0bf5c' : '#b7cfda';
  g.door = night ? '#3b2c22' : '#7a5a43';
  g.poly = (pts, fill, stroke, lw) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  };
  g.circle = (x, y, r, fill) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); };
  g.tile = (x, y, inset, fill, stroke, lw) => {
    const i = inset || 0;
    g.poly([P(x + i, y + i), P(x + 1 - i, y + i), P(x + 1 - i, y + 1 - i), P(x + i, y + 1 - i)], fill, stroke, lw);
  };
  g.box = (x0, y0, x1, y1, z0, h, color, o = {}) => {
    const left = o.left || color, right = o.right || shade(color, -.17), top = o.top || shade(color, .14);
    const a = P(x0, y1, z0), b = P(x1, y1, z0), c = P(x1, y0, z0);
    const a2 = P(x0, y1, z0 + h), b2 = P(x1, y1, z0 + h), c2 = P(x1, y0, z0 + h), d2 = P(x0, y0, z0 + h);
    g.poly([a, b, b2, a2], left);
    g.poly([b, c, c2, b2], right);
    if (!o.noTop) g.poly([d2, c2, b2, a2], top);
    return { x0, y0, x1, y1, z0, h };
  };
  g.fL = (b, u, v) => P(b.x0 + u * (b.x1 - b.x0), b.y1, b.z0 + v * b.h);
  g.fR = (b, u, v) => P(b.x1, b.y1 - u * (b.y1 - b.y0), b.z0 + v * b.h);
  g.onFace = (b, face, u, v, w, hgt, fill) => {
    const f = face === 'L' ? g.fL : g.fR;
    g.poly([f(b, u, v), f(b, u + w, v), f(b, u + w, v + hgt), f(b, u, v + hgt)], fill);
  };
  g.windows = (b, face, n, v, hgt, w) => {
    const ww = w || Math.min(.2, .66 / n);
    const gap = (1 - n * ww) / (n + 1);
    if (night) { ctx.save(); ctx.shadowColor = 'rgba(255,200,100,.65)'; ctx.shadowBlur = tw * .12; }
    for (let i = 0; i < n; i++) g.onFace(b, face, gap + i * (ww + gap), v, ww, hgt, face === 'L' ? g.win : g.winR);
    if (night) ctx.restore();
  };
  g.faceDisc = (b, face, uc, vc, ru, rv, fill) => {
    const f = face === 'L' ? g.fL : g.fR;
    const pts = [];
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; pts.push(f(b, uc + Math.cos(a) * ru, vc + Math.sin(a) * rv)); }
    g.poly(pts, fill);
  };
  g.hipRoof = (x0, y0, x1, y1, z, rh, color) => {
    const apex = P((x0 + x1) / 2, (y0 + y1) / 2, z + rh);
    const A = P(x0, y1, z), B = P(x1, y1, z), C = P(x1, y0, z), D = P(x0, y0, z);
    g.poly([D, A, apex], shade(color, .12));
    g.poly([D, C, apex], shade(color, .04));
    g.poly([A, B, apex], color);
    g.poly([B, C, apex], shade(color, -.2));
  };
  g.gableX = (x0, y0, x1, y1, z, rh, color, endColor) => {
    const ym = (y0 + y1) / 2;
    const R0 = P(x0, ym, z + rh), R1 = P(x1, ym, z + rh);
    const A = P(x0, y1, z), B = P(x1, y1, z), C = P(x1, y0, z), D = P(x0, y0, z);
    g.poly([D, C, R1, R0], shade(color, .12));
    g.poly([A, B, R1, R0], color);
    g.poly([B, C, R1], endColor || shade(color, -.2));
  };
  g.gableY = (x0, y0, x1, y1, z, rh, color, endColor) => {
    const xm = (x0 + x1) / 2;
    const R0 = P(xm, y0, z + rh), R1 = P(xm, y1, z + rh);
    const A = P(x0, y1, z), B = P(x1, y1, z), C = P(x1, y0, z), D = P(x0, y0, z);
    g.poly([D, A, R1, R0], shade(color, .12));
    g.poly([C, B, R1, R0], shade(color, -.18));
    g.poly([A, B, R1], endColor || color);
  };
  g.shed = (x0, y0, x1, y1, z, rh, color, sideColor) => {
    const A = P(x0, y1, z), B = P(x1, y1, z), C = P(x1, y0, z), C2 = P(x1, y0, z + rh), D2 = P(x0, y0, z + rh);
    g.poly([B, C, C2], sideColor);
    g.poly([A, B, C2, D2], color);
  };
  g.ell = (cx, cy, r, z, fill, stroke, lw) => {
    const [sx, sy] = P(cx, cy, z);
    ctx.beginPath();
    ctx.ellipse(sx, sy, r * Math.SQRT2 * hw, r * Math.SQRT2 * hh, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  };
  g.cyl = (cx, cy, r, z0, h, color, topColor) => {
    const [sx, sy0] = P(cx, cy, z0);
    const sy1 = sy0 - h, rx = r * Math.SQRT2 * hw, ry = r * Math.SQRT2 * hh;
    const grad = ctx.createLinearGradient(sx - rx, 0, sx + rx, 0);
    grad.addColorStop(0, shade(color, .05));
    grad.addColorStop(1, shade(color, -.24));
    ctx.beginPath();
    ctx.moveTo(sx - rx, sy1);
    ctx.lineTo(sx - rx, sy0);
    ctx.ellipse(sx, sy0, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(sx + rx, sy1);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(sx, sy1, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = topColor || shade(color, .14);
    ctx.fill();
  };
  g.cone = (cx, cy, r, z, h, color) => {
    const [sx, sy] = P(cx, cy, z);
    const rx = r * Math.SQRT2 * hw, ry = r * Math.SQRT2 * hh;
    const grad = ctx.createLinearGradient(sx - rx, 0, sx + rx, 0);
    grad.addColorStop(0, shade(color, .12));
    grad.addColorStop(.55, color);
    grad.addColorStop(1, shade(color, -.24));
    ctx.beginPath();
    ctx.moveTo(sx - rx, sy);
    ctx.lineTo(sx, sy - h);
    ctx.lineTo(sx + rx, sy);
    ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  };
  g.dome = (cx, cy, r, z, color) => {
    const [sx, sy] = P(cx, cy, z);
    const rx = r * Math.SQRT2 * hw, ry = r * Math.SQRT2 * hh;
    const grad = ctx.createRadialGradient(sx - rx * .35, sy - rx * .55, rx * .1, sx, sy - rx * .2, rx * 1.1);
    grad.addColorStop(0, shade(color, .35));
    grad.addColorStop(1, shade(color, -.22));
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx, rx * .9, 0, Math.PI, Math.PI * 2, false);
    ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  };
  g.shadow = (cx, cy, r) => g.ell(cx + .04, cy + .06, r, 0, night ? 'rgba(0,0,0,.28)' : 'rgba(40,60,30,.16)');
  // Échafaudage en bois autour de la case, haut de « height » px : « back » avant le bâtiment, « front » après lui.
  g.scaffold = (x, y, height, side = 'both') => {
    const wood = g.c('#a77b4f'), i = .1, lw = Math.max(1.2, tw * .022);
    const pole = (u, v) => g.box(x + u - .018, y + v - .018, x + u + .018, y + v + .018, 0, height, wood);
    const plank = (u0, v0, u1, v1) => {
      for (let k = 1; k <= 3; k++) g.poly([P(x + u0, y + v0, height * k * .3), P(x + u1, y + v1, height * k * .3)], null, wood, lw);
    };
    if (side !== 'front') {
      pole(i, i); plank(i, i, 1 - i, i); plank(i, i, i, 1 - i);
      pole(1 - i, i); pole(i, 1 - i);
    }
    if (side !== 'back') {
      plank(i, 1 - i, 1 - i, 1 - i); plank(1 - i, i, 1 - i, 1 - i);
      g.poly([P(x + i, y + 1 - i, 0), P(x + 1 - i, y + 1 - i, height)], null, wood, lw);
      pole(1 - i, 1 - i);
    }
  };
  g.glow = (sx, sy, r, alpha) => {
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, 'rgba(255,214,128,' + alpha + ')');
    grad.addColorStop(1, 'rgba(255,214,128,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
  };
  return g;
}

const DRAW = {
  arbre(g, x, y) {
    const s = .85 + rnd(x, y) * .3, cx = x + .5, cy = y + .5;
    g.shadow(cx, cy, .22 * s);
    const trunkH = g.tw * .14 * s;
    g.box(cx - .04, cy - .04, cx + .04, cy + .04, 0, trunkH, g.c('#8a5f3c'));
    if (rnd(y + 3, x + 7) > .55) {
      const [sx, sy] = g.P(cx, cy, trunkH);
      const w = g.tw * .2 * s;
      for (let i = 0; i < 3; i++) {
        const yy = sy - i * g.tw * .14 * s, ww = w * (1 - i * .22);
        g.poly([[sx - ww, yy], [sx, yy - g.tw * .26 * s], [sx + ww, yy]], g.c(i % 2 ? '#3f7f4a' : '#4a8c52'));
        g.poly([[sx, yy], [sx, yy - g.tw * .26 * s], [sx + ww, yy]], g.c('#356b3e'));
      }
      return;
    }
    const [sx, sy] = g.P(cx, cy, trunkH + g.tw * .16 * s);
    const R = g.tw * .19 * s;
    g.circle(sx + R * .1, sy + R * .1, R, g.c('#4a8540'));
    g.circle(sx - R * .3, sy - R * .25, R * .7, g.c('#62a352'));
    g.circle(sx + R * .38, sy - R * .05, R * .6, g.c('#579a49'));
    g.circle(sx - R * .1, sy - R * .55, R * .45, g.c('#78b862'));
  },
  fleurs(g, x, y) {
    g.tile(x, y, .14, g.c('#8cbd70'));
    const cols = ['#f28db2', '#ffd35c', '#ffffff', '#b48df0', '#ff8a5c'];
    for (let i = 0; i < 16; i++) {
      const u = .22 + rnd(x * 7 + i, y * 3 + i) * .56, v = .22 + rnd(y * 5 + i, x * 11 - i) * .56;
      const [sx, sy] = g.P(x + u, y + v, 2);
      g.circle(sx, sy + 1.5, g.tw * .02, g.c('#4f8a3f'));
      g.circle(sx, sy, g.tw * .03, g.c(cols[i % cols.length], .5));
    }
  },
  chemin(g, x, y) {
    g.tile(x, y, 0, g.c('#e2d4b6', .55));
    for (let i = 0; i < 6; i++) {
      const u = .15 + rnd(x + i, y - i) * .7, v = .15 + rnd(y + i * 3, x + i) * .7;
      const [sx, sy] = g.P(x + u, y + v, 0);
      g.ctx.beginPath();
      g.ctx.ellipse(sx, sy, g.tw * .05, g.tw * .022, 0, 0, Math.PI * 2);
      g.ctx.fillStyle = g.c('#cdbc97', .55);
      g.ctx.fill();
    }
  },
  banc(g, x, y) {
    const wood = g.c('#a0693f'), metal = g.c('#4b4f52');
    g.shadow(x + .5, y + .5, .2);
    g.box(x + .28, y + .39, x + .72, y + .43, g.tw * .07, g.tw * .14, shade(wood, -.06));
    g.box(x + .3, y + .52, x + .34, y + .56, 0, g.tw * .07, metal);
    g.box(x + .66, y + .52, x + .7, y + .56, 0, g.tw * .07, metal);
    g.box(x + .28, y + .43, x + .72, y + .58, g.tw * .07, g.tw * .03, wood);
  },
  lampadaire(g, x, y) {
    const cx = x + .5, cy = y + .5, h = g.tw * .62;
    if (g.night) { const [gx, gy] = g.P(cx, cy, 0); g.ctx.save(); g.ctx.scale(1, .5); g.glow(gx, gy * 2, g.tw * .55, .28); g.ctx.restore(); }
    g.box(cx - .028, cy - .028, cx + .028, cy + .028, 0, h, g.c('#3f4a50'));
    const [sx, sy] = g.P(cx, cy, h + g.tw * .05);
    if (g.night) g.glow(sx, sy, g.tw * .32, .55);
    g.circle(sx, sy, g.tw * .065, g.night ? '#ffe7a6' : '#f6f2e4');
    g.ctx.strokeStyle = g.c('#3f4a50'); g.ctx.lineWidth = 1; g.ctx.stroke();
  },
  etang(g, x, y) {
    g.ell(x + .5, y + .5, .4, 0, g.c('#cfc6ae'));
    g.ell(x + .5, y + .5, .34, 0, g.c('#5fb9d8', .5));
    g.ell(x + .44, y + .44, .2, 0, g.c('#7fcbe4', .5));
    const pads = [[.36, .58], [.6, .62], [.58, .38]];
    for (const [u, v] of pads) g.ell(x + u, y + v, .05, 0, g.c('#5c9d4a'));
    if (g.night) g.ell(x + .5, y + .45, .05, 0, 'rgba(255,248,220,.7)');
  },
  maison(g, x, y) {
    const C = g.cat('foyer'), wall = g.c('#f2ece1');
    g.shadow(x + .5, y + .5, .4);
    const b = g.box(x + .2, y + .26, x + .8, y + .74, 0, g.tw * .3, wall);
    g.windows(b, 'L', 1, .34, .32, .2);
    g.onFace(b, 'L', .66, 0, .2, .58, g.door);
    g.windows(b, 'R', 2, .36, .3);
    g.box(x + .6, y + .36, x + .68, y + .44, g.tw * .42, g.tw * .16, g.c('#b4573e'));
    g.gableX(x + .16, y + .22, x + .84, y + .78, g.tw * .3, g.tw * .24, C, shade(wall, -.18));
  },
  boulangerie(g, x, y) {
    const C = g.cat('foyer'), wall = g.c('#f4e7d3');
    g.shadow(x + .5, y + .5, .4);
    g.box(x + .3, y + .3, x + .4, y + .4, g.tw * .3, g.tw * .18, g.c('#c9b9a0'));
    const b = g.box(x + .18, y + .22, x + .82, y + .78, 0, g.tw * .32, wall);
    g.windows(b, 'L', 1, .16, .4, .5);
    g.onFace(b, 'L', .7, 0, .18, .56, g.door);
    for (let i = 0; i < 6; i++) g.onFace(b, 'L', i / 6, .64, 1 / 6, .18, i % 2 ? g.c('#ffffff') : C);
    g.windows(b, 'R', 2, .4, .3);
    g.onFace(b, 'R', 0, .64, 1, .18, shade(C, -.12));
  },
  serre(g, x, y) {
    const C = g.cat('foyer');
    g.shadow(x + .5, y + .5, .4);
    for (let i = 0; i < 4; i++) {
      const [sx, sy] = g.P(x + .3 + i * .13, y + .48 + (i % 2) * .08, g.tw * .07);
      g.circle(sx, sy, g.tw * .075, g.c(i % 2 ? '#5aa04a' : '#6fb35a'));
    }
    const glass = g.night ? 'rgba(255,214,128,.42)' : 'rgba(198,230,238,.62)';
    const glassR = g.night ? 'rgba(232,190,108,.48)' : 'rgba(176,212,224,.66)';
    const b = g.box(x + .2, y + .26, x + .8, y + .74, 0, g.tw * .22, glass, { left: glass, right: glassR, top: glass });
    const frame = shade(C, -.1);
    for (let i = 1; i < 4; i++) {
      g.poly([g.fL(b, i / 4, 0), g.fL(b, i / 4, 1)], null, frame, 1);
      g.poly([g.fR(b, i / 4, 0), g.fR(b, i / 4, 1)], null, frame, 1);
    }
    g.gableX(x + .2, y + .26, x + .8, y + .74, g.tw * .22, g.tw * .18, glass, glassR);
    const ym = .5;
    g.poly([g.P(x + .2, y + ym, g.tw * .4), g.P(x + .8, y + ym, g.tw * .4)], null, frame, 1.5);
    g.poly([g.P(x + .2, y + .74, 0), g.P(x + .8, y + .74, 0), g.P(x + .8, y + .26, 0)], null, frame, 1.5);
  },
  bibliotheque(g, x, y) {
    const C = g.cat('esprit'), stone = g.c('#ece6da');
    g.shadow(x + .5, y + .5, .45);
    g.box(x + .1, y + .16, x + .9, y + .86, 0, g.tw * .05, g.c('#d6cfc0'));
    const b = g.box(x + .14, y + .2, x + .86, y + .8, g.tw * .05, g.tw * .3, stone);
    g.onFace(b, 'L', .05, 0, .9, .8, shade(stone, -.3));
    for (let i = 0; i < 5; i++) g.onFace(b, 'L', .07 + i * .185, 0, .09, .8, stone);
    g.onFace(b, 'L', 0, .8, 1, .2, shade(stone, .06));
    g.windows(b, 'R', 3, .3, .38);
    g.gableY(x + .12, y + .18, x + .88, y + .82, g.tw * .35, g.tw * .17, C, shade(stone, .04));
  },
  ecole(g, x, y) {
    const C = g.cat('esprit'), wall = g.c('#ead6c4');
    g.shadow(x + .5, y + .5, .45);
    const b = g.box(x + .14, y + .22, x + .86, y + .78, 0, g.tw * .34, wall);
    g.windows(b, 'L', 3, .5, .3);
    g.onFace(b, 'L', .42, 0, .16, .4, g.door);
    g.windows(b, 'R', 2, .45, .32);
    g.hipRoof(x + .1, y + .18, x + .9, y + .82, g.tw * .34, g.tw * .17, C);
    g.box(x + .44, y + .44, x + .56, y + .56, g.tw * .44, g.tw * .14, g.c('#f4efe6'));
    g.hipRoof(x + .42, y + .42, x + .58, y + .58, g.tw * .58, g.tw * .13, C);
  },
  observatoire(g, x, y) {
    const C = g.cat('esprit');
    g.shadow(x + .5, y + .5, .42);
    g.cyl(x + .5, y + .5, .32, 0, g.tw * .3, g.c('#e8e3d8'));
    const [dx, dy0] = g.P(x + .5, y + .5, 0);
    const dy = dy0 + .32 * Math.SQRT2 * g.hh;
    g.ctx.fillStyle = g.door;
    g.ctx.fillRect(dx - g.tw * .045, dy - g.tw * .17, g.tw * .09, g.tw * .17);
    g.ell(x + .5, y + .5, .32, g.tw * .3, null, C, Math.max(2, g.tw * .04));
    g.dome(x + .5, y + .5, .29, g.tw * .3, g.c('#dbe1ea'));
    const [sx, sy] = g.P(x + .5, y + .5, g.tw * .3);
    g.ctx.save();
    g.ctx.strokeStyle = g.night ? '#ffd47a' : '#3b4650';
    g.ctx.lineWidth = Math.max(2, g.tw * .05);
    g.ctx.lineCap = 'round';
    g.ctx.beginPath(); g.ctx.moveTo(sx - g.tw * .02, sy - g.tw * .36); g.ctx.lineTo(sx - g.tw * .1, sy - g.tw * .08); g.ctx.stroke();
    g.ctx.restore();
  },
  terrain(g, x, y) {
    const C = g.cat('corps');
    g.tile(x, y, .05, g.c('#d8cfb9'));
    g.tile(x, y, .1, g.c(mix(C, '#ffffff', .12), .3));
    const line = g.night ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.9)';
    g.tile(x, y, .15, null, line, 1.2);
    g.poly([g.P(x + .5, y + .15), g.P(x + .5, y + .85)], null, line, 1.2);
    g.ell(x + .5, y + .5, .1, 0, null, line, 1.2);
    g.box(x + .11, y + .44, x + .15, y + .56, 0, g.tw * .1, '#f4f4f0');
    g.box(x + .85, y + .44, x + .89, y + .56, 0, g.tw * .1, '#f4f4f0');
  },
  piscine(g, x, y) {
    const C = g.cat('corps');
    g.tile(x, y, .05, g.c('#ebe6da'));
    g.tile(x, y, .14, g.c('#47b2da', .5));
    g.tile(x, y, .2, null, 'rgba(255,255,255,.35)', 1);
    for (let i = 0; i < 2; i++) {
      const [a, b] = [g.P(x + .3 + i * .2, y + .35), g.P(x + .42 + i * .2, y + .38)];
      g.poly([a, b], null, 'rgba(255,255,255,.7)', 1.2);
    }
    g.box(x + .17, y + .78, x + .2, y + .81, 0, g.tw * .26, g.c('#d9d9d9'));
    g.cone(x + .185, y + .795, .14, g.tw * .24, g.tw * .1, C);
  },
  stade(g, x, y) {
    const C = g.cat('corps');
    g.shadow(x + .5, y + .5, .5);
    for (const [u, v] of [[.08, .08], [.92, .1], [.1, .9]]) {
      g.box(x + u - .02, y + v - .02, x + u + .02, y + v + .02, 0, g.tw * .5, g.c('#5b6268'));
      const [sx, sy] = g.P(x + u, y + v, g.tw * .54);
      if (g.night) g.glow(sx, sy, g.tw * .25, .5);
      g.ctx.fillStyle = g.night ? '#fff1c4' : '#eef0f2';
      g.ctx.fillRect(sx - g.tw * .05, sy - g.tw * .03, g.tw * .1, g.tw * .05);
    }
    g.cyl(x + .5, y + .5, .46, 0, g.tw * .2, C, shade(C, .22));
    g.ell(x + .5, y + .5, .4, g.tw * .2, null, shade(C, -.12), 1.5);
    g.ell(x + .5, y + .5, .33, g.tw * .2, g.c('#5fae55'));
    g.ell(x + .5, y + .5, .2, g.tw * .2, null, 'rgba(255,255,255,.75)', 1.2);
  },
  jardin(g, x, y) {
    const C = g.cat('calme'), sand = g.c('#ebdfc4');
    g.tile(x, y, .08, sand);
    for (const r of [.1, .16, .22]) g.ell(x + .38, y + .44, r, 0, null, shade(sand, -.12), 1);
    g.ell(x + .38, y + .44, .07, 2, g.c('#8f8d86'));
    g.ell(x + .36, y + .42, .035, 4, g.c('#aeaca5'));
    g.ell(x + .68, y + .66, .05, 2, g.c('#8f8d86'));
    g.box(x + .64, y + .26, x + .72, y + .34, 0, g.tw * .16, C);
    g.hipRoof(x + .62, y + .24, x + .74, y + .36, g.tw * .16, g.tw * .06, shade(C, -.1));
    const [bx, by] = g.P(x + .74, y + .76, g.tw * .06);
    g.circle(bx, by, g.tw * .07, g.c('#5a9a4a'));
  },
  fontaine(g, x, y) {
    const C = g.cat('calme'), stone = g.c('#d8d1c2');
    g.cyl(x + .5, y + .5, .36, 0, g.tw * .08, stone);
    g.ell(x + .5, y + .5, .3, g.tw * .08, g.c(mix(C, '#5fc0e0', .55), .45));
    g.cyl(x + .5, y + .5, .05, g.tw * .08, g.tw * .2, stone);
    g.cyl(x + .5, y + .5, .13, g.tw * .28, g.tw * .03, stone);
    const [sx, sy] = g.P(x + .5, y + .5, g.tw * .36);
    const ctx = g.ctx;
    ctx.save();
    ctx.strokeStyle = g.night ? 'rgba(170,230,255,.75)' : 'rgba(255,255,255,.9)';
    ctx.lineWidth = Math.max(1.2, g.tw * .025);
    for (const [u, v] of [[.22, .5], [.78, .5], [.5, .22], [.5, .78]]) {
      const [ex, ey] = g.P(x + u, y + v, g.tw * .08);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + ex) / 2, sy - g.tw * .12, ex, ey); ctx.stroke();
    }
    ctx.restore();
  },
  pavillon(g, x, y) {
    const C = g.cat('calme'), wood = g.c('#b9875a');
    g.shadow(x + .5, y + .5, .45);
    g.box(x + .14, y + .14, x + .86, y + .86, 0, g.tw * .05, g.c('#d4cbb8'));
    const b = g.box(x + .28, y + .28, x + .72, y + .72, g.tw * .05, g.tw * .2, wood);
    g.onFace(b, 'L', .3, 0, .4, .72, shade(wood, -.38));
    g.windows(b, 'R', 1, .3, .4, .3);
    g.hipRoof(x + .12, y + .12, x + .88, y + .88, g.tw * .25, g.tw * .12, C);
    g.box(x + .38, y + .38, x + .62, y + .62, g.tw * .33, g.tw * .08, wood);
    g.hipRoof(x + .27, y + .27, x + .73, y + .73, g.tw * .41, g.tw * .15, C);
  },
  kiosque(g, x, y) {
    const C = g.cat('crea');
    g.shadow(x + .5, y + .5, .44);
    g.cyl(x + .5, y + .5, .4, 0, g.tw * .06, g.c('#e3dccd'));
    const posts = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; posts.push([.5 + Math.cos(a) * .3, .5 + Math.sin(a) * .3]); }
    posts.sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]));
    for (const [u, v] of posts) g.box(x + u - .025, y + v - .025, x + u + .025, y + v + .025, g.tw * .06, g.tw * .26, g.c('#f4efe6'));
    g.cone(x + .5, y + .5, .44, g.tw * .32, g.tw * .24, C);
    const [sx, sy] = g.P(x + .5, y + .5, g.tw * .58);
    g.circle(sx, sy, g.tw * .03, g.c('#f3c552'));
  },
  atelier(g, x, y) {
    const C = g.cat('crea'), wall = g.c('#efe7e9');
    g.shadow(x + .5, y + .5, .42);
    const b = g.box(x + .18, y + .24, x + .82, y + .76, 0, g.tw * .3, wall);
    g.windows(b, 'L', 1, .22, .62, .56);
    for (let i = 1; i < 3; i++) g.poly([g.fL(b, .22 + i * .187, .22), g.fL(b, .22 + i * .187, .84)], null, shade(wall, -.25), 1);
    g.onFace(b, 'R', .58, 0, .24, .58, g.door);
    g.windows(b, 'R', 1, .4, .3, .24);
    g.shed(x + .15, y + .2, x + .85, y + .8, g.tw * .3, g.tw * .2, C, shade(wall, -.18));
  },
  theatre(g, x, y) {
    const C = g.cat('crea'), wall = g.c('#f1e4d6');
    g.shadow(x + .5, y + .5, .46);
    const b = g.box(x + .14, y + .18, x + .86, y + .82, 0, g.tw * .42, wall);
    g.onFace(b, 'L', .3, 0, .4, .46, g.c('#9e2f3c'));
    g.onFace(b, 'L', .1, .52, .8, .16, C);
    for (let i = 0; i < 7; i++) {
      const [sx, sy] = g.fL(b, .14 + i * .12, .6);
      if (g.night) g.glow(sx, sy, g.tw * .06, .7);
      g.circle(sx, sy, Math.max(1, g.tw * .014), g.night ? '#fff3c4' : '#fff7dc');
    }
    g.windows(b, 'R', 2, .3, .5);
    g.gableY(x + .12, y + .16, x + .88, y + .84, g.tw * .42, g.tw * .18, C, shade(wall, .04));
  },
  horloge(g, x, y) {
    const Pc = g.cat('prestige'), stone = g.c('#e8e1d2');
    g.shadow(x + .5, y + .5, .32);
    const b = g.box(x + .3, y + .3, x + .7, y + .7, 0, g.tw * .95, stone);
    for (const f of ['L', 'R']) {
      g.onFace(b, f, .38, .1, .24, .14, g.door);
      g.onFace(b, f, .4, .36, .2, .2, f === 'L' ? g.win : g.winR);
      g.faceDisc(b, f, .5, .8, .3, .1, g.night ? '#fff3cf' : '#fbf8ef');
      const [cx, cy] = (f === 'L' ? g.fL : g.fR)(b, .5, .8);
      g.ctx.strokeStyle = '#3b3b3b';
      g.ctx.lineWidth = Math.max(1, g.tw * .018);
      g.ctx.beginPath(); g.ctx.moveTo(cx, cy); g.ctx.lineTo(cx, cy - g.tw * .05); g.ctx.moveTo(cx, cy); g.ctx.lineTo(cx + (f === 'L' ? -1 : 1) * g.tw * .035, cy + g.tw * .01); g.ctx.stroke();
    }
    g.hipRoof(x + .26, y + .26, x + .74, y + .74, g.tw * .95, g.tw * .42, Pc);
    const [sx, sy] = g.P(x + .5, y + .5, g.tw * 1.4);
    g.circle(sx, sy, g.tw * .03, g.c('#f3c552'));
  },
};

