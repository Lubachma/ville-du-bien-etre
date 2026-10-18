/* =========================================================================
   Vie de la ville : ce qui se dessine par-dessus les éléments (fumée, faisceau…).
   Uniquement des dessins, avec le peintre de makePainter ; t est le temps en secondes.
   ========================================================================= */
// Haut des cheminées : position sur la case et hauteur (en largeurs de case).
const CHIMNEYS = { maison: [.64, .4, .58], boulangerie: [.35, .35, .48] };
// Trois bouffées qui montent, s'élargissent et s'effacent au-dessus de la cheminée.
function drawSmoke(g, x, y, t, chimney = CHIMNEYS.maison) {
  const [u, v, z] = chimney, [sx, sy] = g.P(x + u, y + v, g.tw * z);
  for (let i = 0; i < 3; i++) {
    const k = (t * .35 + i / 3) % 1;
    g.ctx.globalAlpha = .5 * (1 - k);
    g.circle(sx + g.tw * .08 * k, sy - g.tw * (.06 + .4 * k), g.tw * (.035 + .05 * k), g.c('#eef0f2', .55));
  }
  g.ctx.globalAlpha = 1;
}
// Faisceau du phare la nuit : un pinceau de lumière qui tourne autour de la lanterne.
function drawBeam(g, x, y, t) {
  const [lx, ly] = g.P(x + .5, y + .5, g.tw * .94), a = t * .8, len = g.tw * 1.1, spread = .18;
  const end = d => [lx + Math.cos(a + d) * len, ly + Math.sin(a + d) * len * .5], far = end(0);
  const light = g.ctx.createLinearGradient(lx, ly, far[0], far[1]);
  light.addColorStop(0, 'rgba(255,240,180,.55)');
  light.addColorStop(1, 'rgba(255,240,180,0)');
  g.poly([[lx, ly], end(-spread), end(spread)], light);
}

/* Météo et petites vies. area = { w, h, ground } : taille de la zone et haut de l'île, en pixels.
   Les positions viennent de l'indice et du temps t (0 pour une ville immobile), jamais du hasard. */
// Nuages : chacun glisse très lentement autour de sa place, sans jamais sortir de la carte.
function drawClouds(g, area, t, n, grey) {
  const { w, h } = area, night = g.dark > .5, r = w * .05;
  const color = night ? (grey ? 'rgba(70,78,92,.6)' : 'rgba(90,100,115,.5)') : (grey ? 'rgba(225,230,236,.85)' : 'rgba(255,255,255,.8)');
  for (let i = 0; i < n; i++) {
    const cx = w * (.2 + .6 * i / Math.max(1, n - 1)) + Math.sin(t * .02 + i * 2) * w * .06, cy = h * (.08 + .08 * (i % 2)) + r;
    for (const [dx, dy, k] of [[-1, .2, .8], [0, 0, 1], [1, .25, .75]]) g.circle(cx + dx * r * 1.1, cy + dy * r, r * k, color);
  }
}
// Arc-en-ciel : six bandes en demi-cercle, tracées point par point au-dessus de l'horizon.
function drawRainbow(g, area) {
  const { w, h } = area, ctx = g.ctx, cx = w * .62, cy = Math.min(h, area.ground + h * .25);
  const colors = ['rgba(232,90,90,.35)', 'rgba(240,170,70,.35)', 'rgba(240,225,90,.35)', 'rgba(110,190,110,.35)', 'rgba(90,150,230,.35)', 'rgba(150,110,210,.35)'];
  ctx.lineWidth = Math.max(2, w * .012);
  colors.forEach((color, i) => {
    const r = Math.min(cx, w - cx, cy) * (.9 - i * .035);
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let k = 0; k <= 24; k++) {
      const a = Math.PI + Math.PI * k / 24, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  });
}
// Météo par-dessus la ville ; rien au soleil, sauf l'arc-en-ciel qui suit la pluie. alpha estompe pluie et neige pendant une pose.
function drawWeather(g, amb, t, area, alpha = 1) {
  const ctx = g.ctx, { w, h } = area, night = g.dark > .5;
  ctx.save();
  if (amb.rainbow) drawRainbow(g, area);
  const clouds = { clouds: 3, rain: 4, snow: 4 }[amb.weather];
  if (clouds) drawClouds(g, area, t, clouds, amb.weather !== 'clouds');
  if (amb.weather === 'rain') {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = night ? 'rgba(170,190,215,.45)' : 'rgba(110,140,180,.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 60; i++) {
      const x = 4 + (rnd(i, 1) * w + t * 30) % (w - 4), y = (rnd(i, 2) * h + t * 220 * (.8 + rnd(i, 3) * .4)) % (h - 12);
      ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 10);
    }
    ctx.stroke();
  }
  if (amb.weather === 'snow') {
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 50; i++) {
      const r = 1.2 + rnd(i, 4), x = r + 3 + (rnd(i, 1) * w + Math.sin(t * .8 + i) * 6 + w) % (w - 2 * r - 6), y = r + (rnd(i, 2) * h + t * 25 * (.7 + rnd(i, 3) * .6)) % (h - 2 * r);
      g.circle(x, y, r, 'rgba(255,255,255,.85)');
    }
  }
  if (amb.weather === 'fog') {
    for (let i = 0; i < 3; i++) {
      const y = Math.max(0, Math.min(h - 24, area.ground + h * .12 * i)), band = ctx.createLinearGradient(0, y, 0, y + 24);
      band.addColorStop(0, 'rgba(255,255,255,0)');
      band.addColorStop(.5, night ? 'rgba(200,210,220,.22)' : 'rgba(255,255,255,.4)');
      band.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = band;
      ctx.fillRect(0, y, w, 24);
    }
  }
  ctx.restore();
}
// Petites vies : pétales au printemps et feuilles à l'automne, lucioles les nuits d'été près de l'étang et des jardins,
// et un vol d'oiseaux qui traverse le ciel de jour toutes les 40 s, sauf sous la pluie ou la neige.
function drawSeasonLife(g, amb, t, area, tiles) {
  const { w, h } = area, ctx = g.ctx, name = amb.moment.name, night = name === 'night' || (name === 'dusk' && amb.moment.t > .5);
  if (amb.season === 'spring' || amb.season === 'autumn') {
    const colors = amb.season === 'spring' ? ['#f6b3c8', '#fbe0ea'] : ['#d98a2b', '#c4572f', '#e2b33c'];
    for (let i = 0; i < 10; i++) {
      const x = 6 + (rnd(i, 7) * w + Math.sin(t * .6 + i) * 18 + w) % (w - 12), y = 6 + (rnd(i, 8) * h + t * 14 * (.6 + rnd(i, 9) * .5)) % (h - 12);
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 1.3 + i);
      g.poly([[-3, 0], [0, -1.6], [3, 0], [0, 1.6]], g.c(colors[i % colors.length], .5));
      ctx.restore();
    }
  }
  if (amb.season === 'summer' && night) {
    for (const tile of tiles.filter(tl => tl.item === 'etang' || tl.item === 'jardin')) {
      for (let i = 0; i < 5; i++) {
        const [px, py] = g.P(tile.x + .5 + Math.sin(t * .7 + i * 2.1) * .3, tile.y + .5 + Math.cos(t * .5 + i * 1.3) * .3, g.tw * (.15 + .1 * Math.sin(t + i)));
        const glow = .5 + .5 * Math.sin(t * 3 + i * 1.7);
        g.glow(px, py, g.tw * .05, .5 * glow);
        g.circle(px, py, Math.max(1, g.tw * .012), `rgba(255,240,150,${(.4 + .6 * glow).toFixed(2)})`);
      }
    }
  }
  if (!night && amb.weather !== 'rain' && amb.weather !== 'snow') {
    const phase = (t % 40) / 40;
    if (phase < .4) {
      const x0 = -30 + phase / .4 * (w + 60), y0 = h * .12;
      ctx.strokeStyle = g.c('#4a4f57');
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 5; i++) {
        const bx = x0 - i * 9, by = y0 + (i % 2) * 6 + Math.sin(t * 6 + i) * 1.5, flap = Math.sin(t * 9 + i) * 2;
        ctx.beginPath(); ctx.moveTo(bx - 4, by - flap); ctx.lineTo(bx, by); ctx.lineTo(bx + 4, by - flap); ctx.stroke();
      }
    }
  }
}

/* Habitants. Un personnage mesure environ 0,18 largeur de case ; (sx, sy) est le point sous ses pieds. */
function drawPerson(g, sx, sy, color, pose = 'stand') {
  const s = g.tw * .18, head = g.c('#f1c9a5'), body = color;
  if (pose === 'sit') {
    g.poly([[sx - s * .3, sy], [sx + s * .3, sy], [sx + s * .2, sy - s * .45], [sx - s * .2, sy - s * .45]], body);
    g.circle(sx, sy - s * .6, s * .17, head);
    return [sx, sy - s * .45];
  }
  g.poly([[sx - s * .18, sy], [sx + s * .18, sy], [sx + s * .14, sy - s * .62], [sx - s * .14, sy - s * .62]], body);
  g.circle(sx, sy - s * .78, s * .17, head);
  return [sx, sy - s * .62];
}
// Promeneur : lanterne la nuit, parapluie sous la pluie, bonnet en hiver.
function drawWalker(g, sx, sy, look = {}) {
  const s = g.tw * .18, [hx, hy] = drawPerson(g, sx, sy, g.c(look.color || '#7a8b6e'));
  if (look.hat) g.circle(sx, hy - s * .28, s * .14, g.c('#c4572f'));
  if (look.umbrella) {
    g.ctx.beginPath(); g.ctx.ellipse(sx, hy - s * .5, s * .45, s * .25, 0, Math.PI, Math.PI * 2);
    g.ctx.fillStyle = g.c('#3f78c4'); g.ctx.fill();
  }
  if (look.lantern) {
    g.glow(hx + s * .3, hy + s * .15, s * .5, .45);
    g.circle(hx + s * .3, hy + s * .15, s * .08, '#ffd47a');
  }
}
// Habitant qui fait comme toi : lecture, course, méditation, arrosage ou peinture, au centre de sa case.
function drawDoer(g, x, y, cat, t) {
  const s = g.tw * .18, ctx = g.ctx;
  if (cat === 'corps') {
    const a = t * 2, [sx, sy] = g.P(x + .5 + Math.cos(a) * .2, y + .5 + Math.sin(a) * .2);
    drawPerson(g, sx, sy, g.cat('corps'));
    return;
  }
  const [sx, sy] = g.P(x + .5, y + .5), color = g.cat(cat);
  if (cat === 'esprit') {
    const [bx, by] = drawPerson(g, sx, sy, color, 'sit');
    g.poly([[bx - s * .22, by + s * .05], [bx, by + s * .12], [bx + s * .22, by + s * .05], [bx, by - s * .02]], g.c('#ffffff'));
  } else if (cat === 'calme') {
    drawPerson(g, sx, sy, color, 'sit');
    g.ell(x + .5, y + .5, .12, 0, null, 'rgba(255,255,255,.55)', 1);
  } else if (cat === 'foyer') {
    drawPerson(g, sx - s * .2, sy, color);
    g.poly([[sx + s * .05, sy - s * .3], [sx + s * .35, sy - s * .3], [sx + s * .3, sy - s * .05], [sx + s * .1, sy - s * .05]], g.c('#8a8f96'));
    for (let i = 0; i < 3; i++) g.circle(sx + s * (.45 + .08 * i), sy - s * (.2 - .12 * ((t * 2 + i / 3) % 1)), s * .04, g.c('#5fc0e0'));
  } else {
    drawPerson(g, sx - s * .25, sy, color);
    ctx.strokeStyle = g.c('#8a6a4a'); ctx.lineWidth = Math.max(1, g.tw * .012);
    ctx.beginPath(); ctx.moveTo(sx + s * .1, sy); ctx.lineTo(sx + s * .3, sy - s * .7); ctx.lineTo(sx + s * .5, sy); ctx.stroke();
    g.poly([[sx + s * .12, sy - s * .75], [sx + s * .48, sy - s * .75], [sx + s * .48, sy - s * .38], [sx + s * .12, sy - s * .38]], g.c('#fbf8ef'));
    g.circle(sx + s * .3, sy - s * .56, s * .07, g.c(t % 2 < 1 ? '#e87ba4' : '#2a78d6'));
  }
}

/* Visiteurs. (sx, sy) est le point sous le visiteur : sol, banc, branche, toit ou eau ; s est la largeur de case.
   look = { season } ; la nuit vient du peintre (le chat dort, la montgolfière allume son brûleur…). */
const ellipseFill = (g, x, y, rx, ry, fill, rot = 0) => { g.ctx.beginPath(); g.ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.ctx.fillStyle = fill; g.ctx.fill(); };
const line = (g, pts, stroke, width) => {
  const ctx = g.ctx;
  ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p);
  ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, width); ctx.stroke();
};
const VISITOR_DRAW = {
  chat(g, sx, sy, look, t) {
    const s = g.tw, fur = g.c('#e0a15a'), dark = g.c('#a8692f');
    if (g.night) {
      // La nuit, le chat dort roulé en boule.
      ellipseFill(g, sx, sy - s * .04, s * .1, s * .055, fur);
      g.circle(sx + s * .07, sy - s * .07, s * .04, fur);
      line(g, [[sx - s * .09, sy - s * .03], [sx - s * .02, sy + s * .01], [sx + s * .05, sy - s * .01]], dark, s * .02);
      return;
    }
    const wag = g.anim ? Math.sin(t * 2) * s * .025 : 0;
    line(g, [[sx + s * .04, sy - s * .03], [sx + s * .1, sy - s * .06], [sx + s * .11, sy - s * .12 + wag]], dark, s * .02);
    ellipseFill(g, sx, sy - s * .07, s * .055, s * .075, fur);
    g.circle(sx, sy - s * .17, s * .048, fur);
    for (const k of [-1, 1]) g.poly([[sx + k * s * .045, sy - s * .19], [sx + k * s * .035, sy - s * .25], [sx + k * s * .01, sy - s * .21]], fur);
    for (const k of [-1, 1]) g.circle(sx + k * s * .018, sy - s * .175, s * .007, g.c('#2c2c2c'));
  },
  herisson(g, sx, sy, look, t) {
    const s = g.tw, step = g.anim ? Math.sin(t * 3) * s * .015 : 0, x = sx + step, body = g.c('#7d5e3f');
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI + Math.PI * i / 8, cx = x + Math.cos(a) * s * .09, cy = sy - s * .02 + Math.sin(a) * s * .06;
      g.poly([[cx - s * .015, cy + s * .01], [x + Math.cos(a) * s * .13, sy - s * .02 + Math.sin(a) * s * .09], [cx + s * .015, cy + s * .01]], g.c('#4f3a26'));
    }
    g.ctx.beginPath(); g.ctx.ellipse(x, sy - s * .02, s * .1, s * .065, 0, Math.PI, Math.PI * 2); g.ctx.closePath(); g.ctx.fillStyle = body; g.ctx.fill();
    g.poly([[x + s * .08, sy - s * .05], [x + s * .15, sy - s * .015], [x + s * .08, sy - s * .005]], g.c('#c9a27a'));
    g.circle(x + s * .15, sy - s * .015, s * .012, g.c('#2c2c2c'));
  },
  ecureuil(g, sx, sy, look, t) {
    const s = g.tw, fur = g.c('#c4572f'), flick = g.anim ? Math.sin(t * 3) * s * .01 : 0;
    g.circle(sx - s * .06, sy - s * .1 + flick, s * .055, fur);
    g.circle(sx - s * .07, sy - s * .16 + flick, s * .04, fur);
    ellipseFill(g, sx, sy - s * .06, s * .035, s * .05, fur);
    g.circle(sx + s * .02, sy - s * .12, s * .028, fur);
    g.poly([[sx + s * .015, sy - s * .14], [sx + s * .025, sy - s * .175], [sx + s * .035, sy - s * .145]], fur);
    g.circle(sx + s * .03, sy - s * .125, s * .006, g.c('#2c2c2c'));
    g.circle(sx + s * .035, sy - s * .07, s * .015, g.c('#8a5f3c'));
  },
  cigogne(g, sx, sy, look, t) {
    const s = g.tw, nod = g.anim ? Math.sin(t * 1.5) * s * .008 : 0;
    ellipseFill(g, sx, sy, s * .1, s * .035, g.c('#8a6a4a'));
    line(g, [[sx - s * .015, sy - s * .08], [sx - s * .015, sy - s * .01]], g.c('#d9573b'), s * .01);
    line(g, [[sx + s * .015, sy - s * .08], [sx + s * .015, sy - s * .01]], g.c('#d9573b'), s * .01);
    ellipseFill(g, sx, sy - s * .12, s * .065, s * .045, g.c('#f6f6f2'));
    ellipseFill(g, sx - s * .035, sy - s * .11, s * .04, s * .025, g.c('#2c2c2c'));
    line(g, [[sx + s * .04, sy - s * .14], [sx + s * .05, sy - s * .23 + nod]], g.c('#f6f6f2'), s * .02);
    g.circle(sx + s * .05, sy - s * .24 + nod, s * .022, g.c('#f6f6f2'));
    line(g, [[sx + s * .065, sy - s * .24 + nod], [sx + s * .12, sy - s * .22 + nod]], g.c('#d9573b'), s * .012);
  },
  canards(g, sx, sy, look, t) {
    const s = g.tw;
    for (const [dx, dy, white] of [[-.12, .02, true], [0, -.02, false], [.12, .03, true]]) {
      const x = sx + dx * s + (g.anim ? Math.sin(t * .6 + dx * 10) * s * .02 : 0), y = sy + dy * s + (g.anim ? Math.sin(t * 2 + dx * 7) * s * .005 : 0);
      ellipseFill(g, x, y - s * .025, s * .045, s * .025, g.c(white ? '#f4f1e8' : '#8a6a4a'));
      g.circle(x + s * .035, y - s * .06, s * .018, g.c(white ? '#f4f1e8' : '#3f7f4a'));
      g.poly([[x + s * .05, y - s * .065], [x + s * .075, y - s * .058], [x + s * .05, y - s * .052]], g.c('#f2c14e'));
    }
  },
  renard(g, sx, sy, look, t) {
    const s = g.tw, fur = g.c('#d9822b'), white = g.c('#f6f1e7'), sway = g.anim ? Math.sin(t * 1.2) * .25 : 0;
    ellipseFill(g, sx - s * .085, sy - s * .03, s * .075, s * .03, fur, .35 + sway);
    g.circle(sx - s * .15, sy - s * .045, s * .022, white);
    ellipseFill(g, sx, sy - s * .08, s * .05, s * .08, fur);
    ellipseFill(g, sx + s * .015, sy - s * .08, s * .025, s * .05, white);
    g.circle(sx + s * .01, sy - s * .18, s * .045, fur);
    for (const k of [-1, 1]) g.poly([[sx + s * .01 + k * s * .04, sy - s * .2], [sx + s * .01 + k * s * .035, sy - s * .26], [sx + s * .01 + k * s * .01, sy - s * .22]], fur);
    g.poly([[sx + s * .03, sy - s * .19], [sx + s * .08, sy - s * .17], [sx + s * .03, sy - s * .15]], white);
    g.circle(sx + s * .08, sy - s * .17, s * .008, g.c('#2c2c2c'));
    g.circle(sx + s * .02, sy - s * .19, s * .007, g.c('#2c2c2c'));
  },
  chouette(g, sx, sy, look, t) {
    const s = g.tw, blink = g.anim && Math.floor(t / .4) % 12 === 0;
    ellipseFill(g, sx, sy - s * .08, s * .05, s * .075, g.c('#8a6a4a'));
    ellipseFill(g, sx, sy - s * .06, s * .032, s * .05, g.c('#c9a27a'));
    for (const k of [-1, 1]) g.poly([[sx + k * s * .045, sy - s * .14], [sx + k * s * .05, sy - s * .18], [sx + k * s * .025, sy - s * .15]], g.c('#6b4f35'));
    for (const k of [-1, 1]) {
      const ex = sx + k * s * .022, ey = sy - s * .125;
      if (g.night) g.glow(ex, ey, s * .04, .35);
      g.circle(ex, ey, s * .02, g.night ? '#ffe9a0' : '#f6f1e7');
      if (blink) line(g, [[ex - s * .015, ey], [ex + s * .015, ey]], g.c('#2c2c2c'), s * .008);
      else g.circle(ex, ey, s * .009, g.c('#2c2c2c'));
    }
    g.poly([[sx - s * .008, sy - s * .11], [sx + s * .008, sy - s * .11], [sx, sy - s * .095]], g.c('#e2b33c'));
  },
  montgolfiere(g, sx, sy, look, t) {
    const s = g.tw, y = sy + (g.anim ? Math.sin(t * .8) * s * .02 : 0), cols = ['#d9573b', '#f2c14e', '#3f78c4'];
    line(g, [[sx - s * .12, y - s * .24], [sx - s * .045, y - s * .07]], g.c('#6b5a44'), s * .006);
    line(g, [[sx + s * .12, y - s * .24], [sx + s * .045, y - s * .07]], g.c('#6b5a44'), s * .006);
    ellipseFill(g, sx, y - s * .38, s * .19, s * .23, g.c(cols[0]));
    ellipseFill(g, sx, y - s * .38, s * .12, s * .23, g.c(cols[1]));
    ellipseFill(g, sx, y - s * .38, s * .05, s * .23, g.c(cols[2]));
    if (g.night) g.glow(sx, y - s * .12, s * .12, .6);
    g.poly([[sx - s * .045, y - s * .07], [sx + s * .045, y - s * .07], [sx + s * .04, y], [sx - s * .04, y]], g.c('#a3714a'));
  },
  bonhomme(g, sx, sy, look, t) {
    const s = g.tw, snow = g.c('#f7f9fb', .3);
    g.circle(sx, sy - s * .065, s * .07, snow);
    g.circle(sx, sy - s * .17, s * .05, snow);
    g.circle(sx, sy - s * .25, s * .036, snow);
    line(g, [[sx - s * .045, sy - s * .17], [sx - s * .12, sy - s * .22]], g.c('#6b4f35'), s * .012);
    line(g, [[sx + s * .045, sy - s * .17], [sx + s * .12, sy - s * .21]], g.c('#6b4f35'), s * .012);
    g.poly([[sx - s * .035, sy - s * .28], [sx + s * .035, sy - s * .28], [sx + s * .028, sy - s * .34], [sx - s * .028, sy - s * .34]], g.c('#2c2c2c'));
    line(g, [[sx - s * .05, sy - s * .28], [sx + s * .05, sy - s * .28]], g.c('#2c2c2c'), s * .012);
    g.poly([[sx, sy - s * .255], [sx + s * .06, sy - s * .245], [sx, sy - s * .238]], g.c('#e07a2f'));
    for (const k of [-1, 1]) g.circle(sx + k * s * .014, sy - s * .262, s * .006, g.c('#2c2c2c'));
    for (const dy of [.15, .19]) g.circle(sx, sy - s * dy, s * .006, g.c('#2c2c2c'));
  },
  glaces(g, sx, sy, look, t) {
    const s = g.tw, pink = g.c('#e87ba4'), cream = g.c('#fbf6ec');
    g.poly([[sx - s * .1, sy - s * .03], [sx + s * .1, sy - s * .03], [sx + s * .1, sy - s * .13], [sx - s * .1, sy - s * .13]], cream);
    g.poly([[sx - s * .1, sy - s * .08], [sx + s * .1, sy - s * .08], [sx + s * .1, sy - s * .1], [sx - s * .1, sy - s * .1]], pink);
    for (const k of [-1, 1]) g.circle(sx + k * s * .07, sy - s * .025, s * .025, g.c('#3b3b3b'));
    line(g, [[sx + s * .07, sy - s * .13], [sx + s * .07, sy - s * .3]], g.c('#8a8f96'), s * .01);
    for (let i = 0; i < 4; i++) {
      const a0 = Math.PI + Math.PI * i / 4, a1 = Math.PI + Math.PI * (i + 1) / 4, cx = sx + s * .07, cy = sy - s * .3, r = s * .13;
      g.poly([[cx, cy], [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r * .55], [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r * .55]], i % 2 ? cream : pink);
    }
    g.poly([[sx - s * .05, sy - s * .13], [sx - s * .02, sy - s * .13], [sx - s * .035, sy - s * .09]], g.c('#d9a45a'));
    g.circle(sx - s * .035, sy - s * .145, s * .022, pink);
  },
  accordeon(g, sx, sy, look, t) {
    const s = g.tw, [cx, cy] = drawPerson(g, sx - s * .03, sy, g.c('#3f78c4'));
    const squeeze = g.anim ? (1 + Math.sin(t * 4)) * s * .01 : s * .01;
    g.poly([[cx - s * .05 - squeeze, cy + s * .01], [cx + s * .05 + squeeze, cy + s * .01], [cx + s * .05 + squeeze, cy + s * .07], [cx - s * .05 - squeeze, cy + s * .07]], g.c('#c4572f'));
    for (const k of [-.02, 0, .02]) line(g, [[cx + k * s, cy + s * .015], [cx + k * s, cy + s * .065]], g.c('#f6f1e7'), s * .005);
    for (let i = 0; i < 2; i++) {
      const k = g.anim ? (t * .4 + i / 2) % 1 : .3 + i * .35, nx = sx + s * (.08 + .08 * k), ny = sy - s * (.18 + .14 * k);
      g.circle(nx, ny, s * .014, g.c('#2c2c2c'));
      line(g, [[nx + s * .012, ny], [nx + s * .012, ny - s * .045]], g.c('#2c2c2c'), s * .006);
    }
  },
  artiste(g, sx, sy, look, t) {
    const s = g.tw;
    const [hx, hy] = drawPerson(g, sx - s * .08, sy, g.c('#7a5aa8'));
    ellipseFill(g, hx + s * .005, hy - s * .062, s * .03, s * .012, g.c('#2c2c2c'));
    line(g, [[sx + s * .02, sy], [sx + s * .07, sy - s * .24], [sx + s * .12, sy]], g.c('#8a6a4a'), s * .01);
    g.poly([[sx + s * .015, sy - s * .27], [sx + s * .125, sy - s * .27], [sx + s * .125, sy - s * .13], [sx + s * .015, sy - s * .13]], g.c('#fbf8ef'));
    const dab = g.anim ? Math.floor(t) % 3 : 0;
    ['#3f78c4', '#3a9a7a', '#e2b33c'].forEach((col, i) => g.circle(sx + s * (.04 + .03 * i), sy - s * (.22 - .03 * ((i + dab) % 3)), s * .014, g.c(col)));
  },
};
