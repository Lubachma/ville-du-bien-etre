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
// et un vol d'oiseaux qui traverse le ciel de jour toutes les 40 s, sauf sous la pluie ou la neige. La nuit est celle du dessin :
// l'heure de la ville, ou le thème quand le ciel suit l'apparence.
function drawSeasonLife(g, amb, t, area, tiles) {
  const { w, h } = area, ctx = g.ctx, night = g.dark > .5;
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
// Cinq peaux, de la plus claire à la plus foncée. Chaque ville les fait tourner d'un cran qui lui est propre.
const SKINS = ['#f6d5bf', '#e6b28c', '#c58a5c', '#8e5a3a', '#5b3a28'];
// Peau de la personne n° n : cinq numéros qui se suivent ont cinq peaux différentes, dans toutes les villes.
function personSkin(n) { return SKINS[(n + Math.floor(chance('habitants') * SKINS.length)) % SKINS.length]; }
// Promeneur n° i : sa peau et son aide à la marche, tirées pour la ville : environ un promeneur sur sept va en fauteuil roulant,
// et un sur cinq a une canne (le fauteuil l'emporte).
function walkerLook(i) {
  const chair = (i + Math.floor(chance('fauteuil') * 7)) % 7 === 0, cane = (i + Math.floor(chance('canne') * 5)) % 5 === 0;
  return { skin: personSkin(i), aid: chair ? 'chair' : cane ? 'cane' : '' };
}
// pose : 'stand' debout, 'sit' assis par terre, 'chair' assis dans un fauteuil roulant. Renvoie l'épaule, où s'accrochent les accessoires.
function drawPerson(g, sx, sy, color, pose = 'stand', skin = SKINS[0]) {
  const s = g.tw * .18, head = g.c(skin), body = color;
  if (pose === 'chair') {
    // Fauteuil roulant, de profil : dossier et poignée à gauche, jambes vers l'avant, et la grande roue, tracée en cercle pour qu'on voie le corps
    // à travers. Le cadre est gris foncé le jour et gris clair la nuit : un gris foncé disparaîtrait sur le sol sombre.
    // at() place des points donnés en s, x vers la droite et y vers le haut depuis les pieds.
    const frame = mix('#4b5159', '#707882', g.dark), ctx = g.ctx, at = pts => pts.map(([x, y]) => [sx + x * s, sy - y * s]);
    g.poly(at([[-.27, .2], [-.17, .2], [-.17, .72], [-.35, .72], [-.35, .66], [-.27, .66]]), frame);
    g.poly(at([[-.1, .3], [.34, .3], [.34, .04], [.26, .04], [.26, .22], [-.1, .22]]), shade(body, -.2));
    g.poly(at([[-.17, .3], [.17, .3], [.14, .6], [-.14, .6]]), body);
    ctx.beginPath(); ctx.arc(sx, sy - s * .25, s * .25, 0, Math.PI * 2);
    ctx.strokeStyle = frame; ctx.lineWidth = Math.max(1, s * .09); ctx.stroke();
    g.circle(sx, sy - s * .76, s * .17, head);
    return [sx, sy - s * .6];
  }
  if (pose === 'sit') {
    g.poly([[sx - s * .3, sy], [sx + s * .3, sy], [sx + s * .2, sy - s * .45], [sx - s * .2, sy - s * .45]], body);
    g.circle(sx, sy - s * .6, s * .17, head);
    return [sx, sy - s * .45];
  }
  g.poly([[sx - s * .18, sy], [sx + s * .18, sy], [sx + s * .14, sy - s * .62], [sx - s * .14, sy - s * .62]], body);
  g.circle(sx, sy - s * .78, s * .17, head);
  return [sx, sy - s * .62];
}
// Promeneur : lanterne la nuit, parapluie sous la pluie, bonnet en hiver ; look.aid = 'cane' ou 'chair' (voir walkerLook).
function drawWalker(g, sx, sy, look = {}) {
  const s = g.tw * .18, [hx, hy] = drawPerson(g, sx, sy, g.c(look.color || '#7a8b6e'), look.aid === 'chair' ? 'chair' : 'stand', look.skin);
  // La canne, tenue à la hanche du côté opposé à la lanterne, plantée au sol un peu plus loin ; plus claire la nuit, comme le fauteuil.
  if (look.aid === 'cane') line(g, [[sx - s * .09, sy - s * .37], [sx - s * .18, sy - s * .37], [sx - s * .3, sy]], mix('#7a5a3a', '#9b7a55', g.dark), s * .09);
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
  const s = g.tw * .18, ctx = g.ctx, skin = personSkin(10 + CAT_ORDER.indexOf(cat));
  if (cat === 'corps') {
    const a = t * 2, [sx, sy] = g.P(x + .5 + Math.cos(a) * .2, y + .5 + Math.sin(a) * .2);
    drawPerson(g, sx, sy, g.cat('corps'), 'stand', skin);
    return;
  }
  const [sx, sy] = g.P(x + .5, y + .5), color = g.cat(cat);
  if (cat === 'esprit') {
    const [bx, by] = drawPerson(g, sx, sy, color, 'sit', skin);
    g.poly([[bx - s * .22, by + s * .05], [bx, by + s * .12], [bx + s * .22, by + s * .05], [bx, by - s * .02]], g.c('#ffffff'));
  } else if (cat === 'calme') {
    drawPerson(g, sx, sy, color, 'sit', skin);
    g.ell(x + .5, y + .5, .12, 0, null, 'rgba(255,255,255,.55)', 1);
  } else if (cat === 'foyer') {
    drawPerson(g, sx - s * .2, sy, color, 'stand', skin);
    g.poly([[sx + s * .05, sy - s * .3], [sx + s * .35, sy - s * .3], [sx + s * .3, sy - s * .05], [sx + s * .1, sy - s * .05]], g.c('#8a8f96'));
    for (let i = 0; i < 3; i++) g.circle(sx + s * (.45 + .08 * i), sy - s * (.2 - .12 * ((t * 2 + i / 3) % 1)), s * .04, g.c('#5fc0e0'));
  } else {
    drawPerson(g, sx - s * .25, sy, color, 'stand', skin);
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
    const s = g.tw, [cx, cy] = drawPerson(g, sx - s * .03, sy, g.c('#3f78c4'), 'stand', personSkin(20));
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
    const [hx, hy] = drawPerson(g, sx - s * .08, sy, g.c('#7a5aa8'), 'stand', personSkin(21));
    ellipseFill(g, hx + s * .005, hy - s * .062, s * .03, s * .012, g.c('#2c2c2c'));
    line(g, [[sx + s * .02, sy], [sx + s * .07, sy - s * .24], [sx + s * .12, sy]], g.c('#8a6a4a'), s * .01);
    g.poly([[sx + s * .015, sy - s * .27], [sx + s * .125, sy - s * .27], [sx + s * .125, sy - s * .13], [sx + s * .015, sy - s * .13]], g.c('#fbf8ef'));
    const dab = g.anim ? Math.floor(t) % 3 : 0;
    ['#3f78c4', '#3a9a7a', '#e2b33c'].forEach((col, i) => g.circle(sx + s * (.04 + .03 * i), sy - s * (.22 - .03 * ((i + dab) % 3)), s * .014, g.c(col)));
  },
};

/* Fêtes. Les fanions courent d'un poteau à l'autre le long des deux bords avant de l'île (un poteau toutes les deux cases environ) ;
   chaque fête ajoute son décor. Les hauteurs sont en largeurs de case. */
const FEST_COLORS = {
  'nouvel-an': ['#f2c14e', '#3f78c4', '#d0628f', '#f6f1e7'],
  printemps: ['#f6b3c8', '#9fd18b', '#fbe0ea', '#f2c14e'],
  ete: ['#f2c14e', '#d9573b', '#3f78c4'],
  recoltes: ['#d98a2b', '#c4572f', '#e2b33c', '#7a8b3e'],
  lumieres: ['#f2c14e', '#d9573b', '#3a9a7a', '#3f78c4'],
  anniversaire: ['#d0628f', '#3f78c4', '#f2c14e', '#3a9a7a'],
};
const POLE_Z = .26;
// Pieds des poteaux, du coin gauche au coin avant puis au coin droit.
function festPoles(size) {
  const spans = Math.max(1, Math.round(size / 2)), out = [];
  for (let i = 0; i <= spans; i++) out.push([size * i / spans, size]);
  for (let i = 1; i <= spans; i++) out.push([size, size - size * i / spans]);
  return out;
}
// Points d'un cordon tendu entre les poteaux à la hauteur z, qui pend de sag au milieu de chaque travée : n points par travée,
// chacun avec la direction du cordon.
function festCord(g, size, z, sag, n) {
  const poles = festPoles(size), pts = [];
  for (let i = 0; i + 1 < poles.length; i++) {
    const [ax, ay] = g.P(poles[i][0], poles[i][1], g.tw * z), [bx, by] = g.P(poles[i + 1][0], poles[i + 1][1], g.tw * z), len = Math.hypot(bx - ax, by - ay);
    for (let k = 0; k < n; k++) {
      const u = (k + .5) / n;
      pts.push([ax + (bx - ax) * u, ay + (by - ay) * u + 4 * g.tw * sag * u * (1 - u), (bx - ax) / len, (by - ay) / len]);
    }
  }
  return pts;
}
function strokeCord(g, size, z, sag, color) {
  const poles = festPoles(size), ctx = g.ctx;
  ctx.beginPath();
  for (let i = 0; i + 1 < poles.length; i++) {
    const [ax, ay] = g.P(poles[i][0], poles[i][1], g.tw * z), [bx, by] = g.P(poles[i + 1][0], poles[i + 1][1], g.tw * z);
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 2 * g.tw * sag, bx, by);
  }
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, g.tw * .008); ctx.stroke();
}
// Guirlande de fanions : des triangles aux couleurs de la fête, qui flottent un peu au vent.
function drawBunting(g, size, colors, t) {
  const tw = g.tw, pw = tw * .035, len = tw * .075;
  for (const [x, y] of festPoles(size)) line(g, [g.P(x, y), g.P(x, y, tw * POLE_Z)], g.c('#8a6a4a'), tw * .015);
  strokeCord(g, size, POLE_Z, .05, g.c('#6b5a44'));
  festCord(g, size, POLE_Z, .05, Math.max(2, Math.round(size / Math.max(1, Math.round(size / 2)) * 4.5))).forEach(([x, y, dx, dy], i) => {
    const flutter = g.anim ? Math.sin(t * 3 + i * .9) * tw * .012 : 0;
    g.poly([[x - dx * pw, y - dy * pw], [x + dx * pw, y + dy * pw], [x + flutter, y + len]], g.c(colors[i % colors.length], .3));
  });
}

// Confettis qui tombent sur toute la carte, en tournant.
function drawConfetti(g, area, t, colors) {
  const { w, h } = area, ctx = g.ctx;
  for (let i = 0; i < 18; i++) {
    const x = 6 + (rnd(i, 21) * w + Math.sin(t * .9 + i) * 10 + w) % (w - 12), y = 6 + (rnd(i, 22) * h + t * 22 * (.6 + rnd(i, 23) * .5)) % (h - 12);
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 2 + i);
    g.poly([[-2.2, -1], [2.2, -1], [2.2, 1], [-2.2, 1]], g.c(colors[i % colors.length], .3));
    ctx.restore();
  }
}
// Feux d'artifice : trois gerbes qui s'ouvrent tour à tour dans le ciel, à droite du bouton Construire, chacune à une place nouvelle.
// Sans animation, elles restent ouvertes à des moments différents.
function drawFireworks(g, area, t) {
  const { w, h } = area, ctx = g.ctx, R = Math.min(w, h) * .11, colors = ['#ffd36e', '#ff8fa3', '#8fd3ff'];
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const p = t * .45 + .35 + i * .2, k = p % 1, round = Math.floor(p);
    const cx = w * (.42 + .2 * i) + (rnd(round, i) - .5) * w * .06, cy = h * .12 + R + rnd(round, i + 5) * Math.max(0, area.ground * .5 - R);
    const r = R * (1 - (1 - Math.min(1, k / .7)) ** 2), fall = k * k * R * .3;
    g.glow(cx, cy, R * .5, (.2 * (1 - k)).toFixed(2));
    ctx.globalAlpha = 1 - k * k;
    ctx.strokeStyle = colors[i];
    ctx.lineWidth = Math.max(1, R * .04);
    ctx.beginPath();
    for (let j = 0; j < 14; j++) {
      const a = j / 14 * Math.PI * 2 + i, c = Math.cos(a), s = Math.sin(a) * .9;
      ctx.moveTo(cx + c * r * .55, cy + s * r * .55 + fall); ctx.lineTo(cx + c * r, cy + s * r + fall);
    }
    ctx.stroke();
    for (let j = 0; j < 14; j++) {
      const a = j / 14 * Math.PI * 2 + i;
      g.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r * .9 + fall, Math.max(1.2, R * .05), '#fff6dc');
    }
    ctx.globalAlpha = 1;
  }
}
// Pétales de la fête du printemps, plus nombreux que ceux de la saison.
function drawPetals(g, area, t) {
  const { w, h } = area, ctx = g.ctx;
  for (let i = 0; i < 14; i++) {
    const x = 6 + (rnd(i, 31) * w + Math.sin(t * .5 + i) * 16 + w) % (w - 12), y = 6 + (rnd(i, 32) * h + t * 12 * (.6 + rnd(i, 33) * .5)) % (h - 12);
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 1.1 + i);
    g.poly([[-3, 0], [0, -1.7], [3, 0], [0, 1.7]], g.c(i % 3 ? '#f6b3c8' : '#fbe0ea', .5));
    ctx.restore();
  }
}
// Notes de musique qui montent de l'île et s'effacent.
function drawNotes(g, size, t) {
  const tw = g.tw, ink = g.night ? '#f6f1e7' : '#2c2c2c';
  for (let i = 0; i < 6; i++) {
    const k = (t * .3 + i / 6) % 1, [x, y] = g.P(rnd(i, 41) * size, rnd(i, 42) * size, tw * (.2 + .6 * k));
    const nx = x + Math.sin(t * 1.5 + i) * tw * .03;
    g.ctx.globalAlpha = Math.sin(Math.PI * k);
    g.circle(nx, y, tw * .022, ink);
    line(g, [[nx + tw * .02, y], [nx + tw * .02, y - tw * .07], [nx + tw * .045, y - tw * .05]], ink, tw * .008);
  }
  g.ctx.globalAlpha = 1;
}
// Lampions de papier pendus au cordon des fanions, allumés la nuit.
function drawLampions(g, size, t) {
  const tw = g.tw;
  festCord(g, size, POLE_Z, .05, 2).forEach(([x, y], i) => {
    const sway = g.anim ? Math.sin(t * 1.4 + i) * tw * .006 : 0, cy = y + tw * .06;
    line(g, [[x, y], [x + sway, cy - tw * .035]], g.c('#6b5a44'), tw * .006);
    g.glow(x + sway, cy, tw * .1, .45);
    ellipseFill(g, x + sway, cy, tw * .03, tw * .038, i % 2 ? '#f2a23c' : '#e8604c');
  });
}
// Citrouille posée en (sx, sy), de rayon r.
function drawPumpkin(g, sx, sy, r) {
  ellipseFill(g, sx, sy - r * .8, r * 1.25, r * .85, g.c('#e07a2f'));
  ellipseFill(g, sx, sy - r * .8, r * .5, r * .85, g.c('#c4572f'));
  line(g, [[sx, sy - r * 1.6], [sx + r * .2, sy - r * 2]], g.c('#5f7a3a'), r * .3);
}
// Fête des récoltes : une citrouille au pied de chaque poteau, une botte de paille et ses citrouilles sur les cases libres.
function drawHarvest(g, size, spots) {
  const tw = g.tw;
  for (const [x, y] of festPoles(size)) {
    const [sx, sy] = g.P(clamp(x, .15, size - .15) - (x === size ? .12 : 0), clamp(y, .15, size - .15) - (y === size ? .12 : 0));
    drawPumpkin(g, sx, sy, tw * .04);
  }
  for (const s of spots) {
    g.box(s.x + .3, s.y + .3, s.x + .7, s.y + .58, 0, tw * .12, '#e2c26a');
    const [sx, sy] = g.P(s.x + .62, s.y + .78);
    drawPumpkin(g, sx, sy, tw * .05);
    const [px, py] = g.P(s.x + .3, s.y + .75);
    drawPumpkin(g, px, py, tw * .035);
  }
}
// Fête des lumières : une guirlande d'ampoules sous les fanions, qui scintille la nuit, et des lanternes sur les cases libres.
function drawLights(g, size, spots, t) {
  const tw = g.tw, colors = FEST_COLORS.lumieres;
  strokeCord(g, size, .17, .04, g.c('#4a4f57'));
  festCord(g, size, .17, .04, 6).forEach(([x, y], i) => {
    const on = g.night ? .6 + .4 * Math.sin(t * 2 + i * 1.7) : 0, color = colors[i % colors.length];
    if (on) g.glow(x, y + tw * .02, tw * .065, (.5 * on).toFixed(2));
    g.circle(x, y + tw * .02, Math.max(1.2, tw * .018), on ? color : g.c(color, .3));
  });
  for (const s of spots) {
    const [bx, by] = g.P(s.x + .5, s.y + .5), top = by - tw * .2;
    line(g, [[bx, by], [bx, top]], g.c('#4a4f57'), tw * .012);
    if (g.night) g.glow(bx, top - tw * .03, tw * .14, .5);
    g.poly([[bx - tw * .025, top], [bx + tw * .025, top], [bx + tw * .025, top - tw * .06], [bx - tw * .025, top - tw * .06]], g.night ? '#ffd47a' : g.c('#f6e7b8'));
    g.poly([[bx - tw * .035, top - tw * .06], [bx + tw * .035, top - tw * .06], [bx, top - tw * .09]], g.c('#3b3b3b'));
  }
}
// Anniversaire : un bouquet de ballons attaché à chacun des deux poteaux des coins, penché vers l'île pour rester dans le cadre.
function drawBalloons(g, size, t) {
  const tw = g.tw, colors = FEST_COLORS.anniversaire;
  [[0, size, 1], [size, 0, -1]].forEach(([x, y, lean], side) => {
    const [px, py] = g.P(x, y, tw * POLE_Z);
    [[.03, -.4], [.11, -.5], [.18, -.38]].forEach(([dx, dy], i) => {
      const bob = g.anim ? Math.sin(t * 1.2 + i + side * 2) * tw * .012 : 0, bx = px + lean * dx * tw, by = py + dy * tw + bob;
      line(g, [[px, py], [bx, by + tw * .085]], g.c('#6b5a44'), tw * .006);
      ellipseFill(g, bx, by, tw * .065, tw * .08, g.c(colors[(i + side * 2) % colors.length], .3));
      g.poly([[bx - tw * .012, by + tw * .09], [bx + tw * .012, by + tw * .09], [bx, by + tw * .075]], g.c(colors[(i + side * 2) % colors.length], .3));
      g.circle(bx - lean * tw * .022, by - tw * .03, tw * .014, 'rgba(255,255,255,.55)');
    });
  });
}
// Décor d'une fête, par-dessus la ville. area = { w, h, ground, size } ; spots = cases libres des bords avant (trois au plus servent).
function drawFestival(g, fest, amb, t, area, spots = []) {
  const N = area.size, few = spots.length <= 3 ? spots : [0, 1, 2].map(k => spots[Math.round(k * (spots.length - 1) / 2)]);
  g.ctx.save();
  switch (fest.id) {
    case 'nouvel-an': if (g.night) drawFireworks(g, area, t); else drawConfetti(g, area, t, FEST_COLORS['nouvel-an']); break;
    case 'printemps': drawPetals(g, area, t); strokeCord(g, N, .15, .04, g.c('#5f8f4a'));
      festCord(g, N, .15, .04, 5).forEach(([x, y], i) => { g.circle(x, y, g.tw * .022, g.c(i % 2 ? '#f6b3c8' : '#fbf6ec', .3)); g.circle(x, y, g.tw * .009, g.c('#f2c14e', .3)); });
      break;
    case 'ete': drawNotes(g, N, t); if (g.night) drawLampions(g, N, t); break;
    case 'recoltes': drawHarvest(g, N, few); break;
    case 'lumieres': drawLights(g, N, few, t); break;
    case 'anniversaire': drawBalloons(g, N, t); drawConfetti(g, area, t, FEST_COLORS.anniversaire); break;
  }
  g.ctx.restore();
}
