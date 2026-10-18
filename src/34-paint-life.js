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
