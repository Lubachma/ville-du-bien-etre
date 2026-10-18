/* =========================================================================
   Décors de l'étape 2 : cinq en boutique, cinq offerts par un succès.
   ========================================================================= */
Object.assign(DRAW, {
  haie(g, x, y) {
    const leaf = g.leaf('#4f8f45'), light = g.leaf('#68a856');
    g.shadow(x + .5, y + .52, .4);
    g.box(x + .1, y + .38, x + .9, y + .62, 0, g.tw * .14, leaf, { top: light, right: shade(leaf, -.15) });
    // Feuillage en touches : dessus arrondi et face avant
    for (let i = 0; i < 9; i++) {
      const [sx, sy] = g.P(x + .14 + i * .09, y + .5, g.tw * .15);
      g.circle(sx, sy, g.tw * .05, i % 2 ? light : shade(light, .08));
    }
    for (let i = 0; i < 6; i++) {
      const [sx, sy] = g.P(x + .16 + i * .13, y + .62, g.tw * (.05 + rnd(i, 2) * .06));
      g.circle(sx, sy, g.tw * .025, shade(leaf, .15));
    }
  },
  cerisier(g, x, y) {
    const cx = x + .5, cy = y + .5, s = .9 + rnd(x, y) * .2, trunkH = g.tw * .18 * s;
    g.shadow(cx, cy, .24 * s);
    // Pétales tombés
    for (let i = 0; i < 7; i++) {
      const [px, py] = g.P(x + .25 + rnd(i, x + 3) * .5, y + .25 + rnd(y + 5, i) * .5);
      g.circle(px, py, g.tw * .012, g.bloom('#f6b3c8', .5));
    }
    g.box(cx - .035, cy - .035, cx + .035, cy + .035, 0, trunkH, g.c('#7b4f36'));
    // Houppier rose en boules, quelques fleurs blanches
    const [sx, sy] = g.P(cx, cy, trunkH + g.tw * .14 * s), R = g.tw * .18 * s;
    g.circle(sx, sy, R, g.bloom('#e98fae'));
    g.circle(sx - R * .5, sy - R * .15, R * .75, g.bloom('#f3a9c2'));
    g.circle(sx + R * .5, sy - R * .1, R * .7, g.bloom('#ee9cb8'));
    g.circle(sx - R * .05, sy - R * .6, R * .6, g.bloom('#f8c3d5'));
    for (const [dx, dy] of [[-.4, -.3], [.3, -.5], [.5, .1], [-.2, .3]]) g.circle(sx + dx * R, sy + dy * R, g.tw * .015, g.c('#ffffff', .3));
  },
  livres(g, x, y) {
    const C = g.cat('esprit'), wood = g.c('#a8743f');
    g.shadow(x + .5, y + .5, .16);
    g.box(x + .48, y + .48, x + .52, y + .52, 0, g.tw * .2, g.c('#6d4c35'));
    const b = g.box(x + .38, y + .4, x + .62, y + .6, g.tw * .2, g.tw * .18, wood);
    // Porte vitrée, livres colorés derrière
    g.onFace(b, 'L', .12, .12, .76, .76, g.night ? '#f5d38a' : g.c('#cfe3ec'));
    ['#d9573b', '#3f78c4', '#e3a12f', '#3a9a7a', '#d0628f'].forEach((col, i) => g.onFace(b, 'L', .18 + i * .13, .18, .09, .4, g.c(col)));
    g.gableY(x + .36, y + .38, x + .64, y + .62, g.tw * .38, g.tw * .08, C, shade(wood, .1));
  },
  lanterne(g, x, y) {
    const stone = g.c('#a9a296'), dark = shade(stone, -.2);
    g.shadow(x + .5, y + .5, .18);
    g.box(x + .4, y + .4, x + .6, y + .6, 0, g.tw * .04, stone);
    g.box(x + .46, y + .46, x + .54, y + .54, g.tw * .04, g.tw * .14, stone);
    // Chambre de lumière : ses ouvertures s'allument la nuit
    const ch = g.box(x + .41, y + .41, x + .59, y + .59, g.tw * .18, g.tw * .1, stone);
    g.onFace(ch, 'L', .3, .2, .4, .6, g.night ? '#ffd47a' : dark);
    g.onFace(ch, 'R', .3, .2, .4, .6, g.night ? '#f0bf5c' : shade(dark, -.1));
    if (g.night) { const [lx, ly] = g.P(x + .5, y + .5, g.tw * .23); g.glow(lx, ly, g.tw * .3, .5); }
    g.hipRoof(x + .34, y + .34, x + .66, y + .66, g.tw * .28, g.tw * .07, stone);
    const [tx, ty] = g.P(x + .5, y + .5, g.tw * .37);
    g.circle(tx, ty, g.tw * .025, stone);
  },
  potager(g, x, y) {
    const wood = g.c('#9c6b44');
    const plank = (x0, y0, x1, y1) => g.box(x + x0, y + y0, x + x1, y + y1, 0, g.tw * .05, wood);
    g.tile(x, y, .1, g.c('#7d5a3c'));
    plank(.1, .1, .9, .14);
    plank(.1, .14, .14, .86);
    // Rangées : salades, carottes, tomates
    [['#5aa04a', '#3f8a3a'], ['#e88a3a', '#5aa04a'], ['#d64b3b', '#5aa04a']].forEach(([fruit, leaf], r) => {
      for (let i = 0; i < 5; i++) {
        const [px, py] = g.P(x + .24 + i * .13, y + .3 + r * .2, g.tw * .04);
        g.circle(px, py - g.tw * .015, g.tw * .03, g.c(leaf));
        g.circle(px, py, g.tw * .022, g.c(fruit));
      }
    });
    plank(.86, .14, .9, .86);
    plank(.1, .86, .9, .9);
  },
  cadran(g, x, y) {
    const stone = g.c('#d8d0c0');
    g.shadow(x + .5, y + .5, .2);
    g.box(x + .38, y + .38, x + .62, y + .62, 0, g.tw * .04, shade(stone, -.08));
    g.cyl(x + .5, y + .5, .07, g.tw * .04, g.tw * .12, stone);
    g.cyl(x + .5, y + .5, .2, g.tw * .16, g.tw * .03, stone, g.c('#f3ecdc'));
    // Heures et gnomon
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, [px, py] = g.P(x + .5 + Math.cos(a) * .15, y + .5 + Math.sin(a) * .15, g.tw * .19);
      g.circle(px, py, Math.max(.8, g.tw * .008), g.c('#6b5a44'));
    }
    g.poly([g.P(x + .42, y + .5, g.tw * .19), g.P(x + .58, y + .5, g.tw * .19), g.P(x + .42, y + .5, g.tw * .3)], g.c('#b08a3c'));
  },
  pasjaponais(g, x, y) {
    // Pierres posées en travers de la case, en léger zigzag
    for (const [u, v, r] of [[.16, .78, .08], [.32, .7, .09], [.48, .5, .1], [.64, .42, .09], [.8, .24, .08]]) {
      g.ell(x + u, y + v + .01, r, 0, g.c('#6f6a60'));
      g.ell(x + u, y + v, r, 2, g.c('#b9b3a6'));
      g.ell(x + u - .02, y + v - .02, r * .5, 2, g.c('#cbc6ba'));
    }
  },
  fanions(g, x, y) {
    const ctx = g.ctx, cols = CAT_ORDER.map(c => g.cat(c)), pole = g.c('#8a6a4a');
    g.shadow(x + .3, y + .56, .1);
    g.box(x + .28, y + .54, x + .32, y + .58, 0, g.tw * .74, pole);
    g.box(x + .83, y + .41, x + .85, y + .43, 0, g.tw * .07, pole);
    const top = g.P(x + .3, y + .56, g.tw * .72), end = g.P(x + .84, y + .42, g.tw * .06);
    const mid = [(top[0] + end[0]) / 2, (top[1] + end[1]) / 2 + g.tw * .08];
    ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.quadraticCurveTo(mid[0], mid[1], end[0], end[1]);
    ctx.strokeStyle = g.c('#6b5a44'); ctx.lineWidth = 1; ctx.stroke();
    // Cinq fanions aux couleurs des domaines
    for (let i = 0; i < 5; i++) {
      const t = (i + .7) / 6, q = 1 - t;
      const px = q * q * top[0] + 2 * q * t * mid[0] + t * t * end[0], py = q * q * top[1] + 2 * q * t * mid[1] + t * t * end[1];
      const wave = g.anim ? Math.sin(g.time * 3 + i) * g.tw * .015 : 0;
      g.poly([[px - g.tw * .035, py], [px + g.tw * .035, py], [px + wave, py + g.tw * .08]], cols[i]);
    }
    g.circle(top[0], top[1] - g.tw * .03, g.tw * .025, g.c('#e8b84a'));
  },
  nichoir(g, x, y) {
    const C = g.cat('calme'), wood = g.c('#c08a55');
    g.shadow(x + .5, y + .5, .12);
    g.box(x + .48, y + .48, x + .52, y + .52, 0, g.tw * .4, g.c('#7a5a3e'));
    const b = g.box(x + .42, y + .42, x + .58, y + .58, g.tw * .4, g.tw * .12, wood);
    g.faceDisc(b, 'L', .5, .55, .18, .2, g.c('#3b2c22'));
    g.gableY(x + .4, y + .4, x + .6, y + .6, g.tw * .52, g.tw * .09, C, shade(wood, .08));
    // Un petit oiseau sur le toit
    const [bx, by] = g.P(x + .5, y + .54, g.tw * .6);
    g.circle(bx, by, g.tw * .03, g.c('#e07a4f'));
    g.circle(bx + g.tw * .025, by - g.tw * .025, g.tw * .018, g.c('#e07a4f'));
    g.poly([[bx + g.tw * .04, by - g.tw * .03], [bx + g.tw * .06, by - g.tw * .022], [bx + g.tw * .04, by - g.tw * .016]], g.c('#f2c14e'));
  },
  // Arche fleurie (offerte par « Ville harmonieuse ») : deux montants de bois et un arc de feuillage couvert de fleurs aux couleurs
  // des cinq domaines.
  arche(g, x, y) {
    // Face à nous : les deux montants sur la diagonale qui court de gauche à droite de l'écran, l'arc bien rond entre eux.
    const ctx = g.ctx, wood = g.c('#a77b4f'), cols = CAT_ORDER.map(c => g.cat(c)), h = g.tw * .52;
    g.shadow(x + .5, y + .5, .32);
    g.box(x + .16, y + .76, x + .24, y + .84, 0, h, wood);
    g.box(x + .76, y + .16, x + .84, y + .24, 0, h, wood);
    const a = g.P(x + .2, y + .8, h), b = g.P(x + .8, y + .2, h), top = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - g.tw * .34];
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(top[0], top[1], b[0], b[1]);
    ctx.strokeStyle = g.leaf('#5f9a4c'); ctx.lineWidth = Math.max(2, g.tw * .08); ctx.lineCap = 'round'; ctx.stroke();
    // Fleurs le long de l'arc, puis sur les montants
    for (let i = 0; i < 11; i++) {
      const t = (i + .5) / 11, q = 1 - t;
      g.circle(q * q * a[0] + 2 * q * t * top[0] + t * t * b[0], q * q * a[1] + 2 * q * t * top[1] + t * t * b[1] - g.tw * .01, g.tw * .034, cols[i % 5]);
    }
    for (const [ux, uy, shift] of [[.2, .8, 0], [.8, .2, 2]]) for (let k = 1; k <= 2; k++) {
      const p = g.P(x + ux, y + uy, h * k / 3);
      g.circle(p[0] + g.tw * .03, p[1], g.tw * .024, cols[(k + shift) % 5]);
    }
  },
  // Cabane (offerte par « Inséparables ») : une petite cabane de bois au toit en pente, une porte ronde et un pot de fleurs ; le
  // compagnon dort à côté, la nuit.
  cabane(g, x, y) {
    const h = g.tw * .24;
    g.shadow(x + .5, y + .5, .34);
    const b = g.box(x + .26, y + .26, x + .74, y + .74, 0, h, g.c('#b07a4a'));
    g.faceDisc(b, 'L', .5, .38, .16, .34, g.door);
    g.hipRoof(x + .2, y + .2, x + .8, y + .8, h, g.tw * .22, g.c('#8a5a35'));
    g.box(x + .78, y + .6, x + .9, y + .72, 0, g.tw * .06, g.c('#c8693e'));
    const [fx, fy] = g.P(x + .84, y + .66, g.tw * .08);
    for (const [dx, dy, color] of [[-.025, 0, '#e87ba4'], [.02, -.01, '#f2c14e'], [0, -.03, '#7fb3e0']]) g.circle(fx + dx * g.tw, fy + dy * g.tw, g.tw * .022, g.bloom(color));
  },
  statue(g, x, y) {
    const stone = g.c('#d9d2c4'), bronze = g.c('#9a7446');
    g.shadow(x + .5, y + .5, .26);
    g.box(x + .3, y + .3, x + .7, y + .7, 0, g.tw * .05, shade(stone, -.06));
    g.box(x + .36, y + .36, x + .64, y + .64, g.tw * .05, g.tw * .05, stone);
    g.box(x + .41, y + .41, x + .59, y + .59, g.tw * .1, g.tw * .16, stone);
    // Silhouette abstraite : corps et tête ronde, couleur bronze
    g.cyl(x + .5, y + .5, .07, g.tw * .26, g.tw * .2, bronze);
    const [hx, hy] = g.P(x + .5, y + .5, g.tw * .5);
    g.circle(hx, hy, g.tw * .06, shade(bronze, .1));
  },
});
