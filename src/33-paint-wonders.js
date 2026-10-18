/* =========================================================================
   Merveilles : quatre étapes visibles sur la même case.
   Étapes 1 à 3 en chantier (tuteurs ou échafaudage), étape 4 terminée.
   ========================================================================= */
Object.assign(DRAW, {
  grandarbre(g, x, y, tile) {
    const stage = (tile && tile.stage) || 4, cx = x + .5, cy = y + .5, ctx = g.ctx;
    const [trunkH, trunkW, R] = [[.12, .015, .08], [.3, .03, .19], [.48, .05, .33], [.5, .055, .36]][stage - 1];
    g.shadow(cx, cy, Math.max(.12, R * .9));
    if (stage === 4) { g.ell(cx, cy, .2, 0, g.c('#cfc6b4')); g.ell(cx, cy, .16, 2, g.leaf('#8fbf6a')); }
    // Tuteurs en bois jusqu'à la troisième étape : ceux de derrière avant le tronc, les autres après
    const stakes = stage < 4 ? [[-.14, -.02], [.1, -.12], [.06, .14]] : [];
    const stakeH = g.tw * (stage === 3 ? .14 : trunkH * .9 + .04);
    const stake = ([du, dv]) => g.box(cx + du - .012, cy + dv - .012, cx + du + .012, cy + dv + .012, 0, stakeH, g.c('#a77b4f'));
    stakes.filter(([du, dv]) => du + dv < 0).forEach(stake);
    g.box(cx - trunkW, cy - trunkW, cx + trunkW, cy + trunkW, 0, g.tw * trunkH, g.c('#7a5236'));
    stakes.filter(([du, dv]) => du + dv >= 0).forEach(stake);
    // Feuillage en boules
    const [sx, sy] = g.P(cx, cy, g.tw * (trunkH + R * .75)), r = g.tw * R;
    const blobs = [[0, 0, 1, '#4a8540'], [-.55, .1, .72, '#579a49'], [.55, .05, .7, '#4f9044'], [-.2, -.5, .65, '#62a352'], [.3, -.42, .6, '#6cae5a'], [0, -.75, .45, '#78b862']];
    for (const [dx, dy, k, col] of blobs.slice(0, stage === 1 ? 2 : 6)) g.circle(sx + dx * r, sy + dy * r, r * k * .8, g.leaf(col));
    if (stage < 4) return;
    // Fleurs aux couleurs des domaines pratiqués cette semaine
    weekCats().forEach((cat, i) => {
      for (let k = 0; k < 3; k++) {
        const a = rnd(i * 7 + k, 11) * Math.PI * 2, d = .3 + rnd(k, i + 5) * .5;
        g.circle(sx + Math.cos(a) * d * r, sy - .25 * r + Math.sin(a) * d * r * .8, g.tw * .022, g.cat(cat));
      }
    });
    // Lanternes, allumées la nuit
    for (const [dx, dy] of [[-.75, .55], [.7, .6], [-.25, .85], [.35, .3]]) {
      const lx = sx + dx * r, ly = sy + dy * r;
      if (g.night) g.glow(lx, ly, g.tw * .08, .6);
      g.circle(lx, ly, g.tw * .022, g.night ? '#ffd47a' : g.c('#f2c14e'));
    }
    // Balançoire sous une branche
    const [bx, by] = g.P(cx + .2, cy - .12, g.tw * (trunkH + .02)), seat = by + g.tw * .24;
    ctx.save();
    ctx.strokeStyle = g.c('#6b5a44'); ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx - g.tw * .03, by); ctx.lineTo(bx - g.tw * .03, seat);
    ctx.moveTo(bx + g.tw * .03, by); ctx.lineTo(bx + g.tw * .03, seat);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = g.c('#a77b4f');
    ctx.fillRect(bx - g.tw * .045, seat, g.tw * .09, g.tw * .018);
  },
  phare(g, x, y, tile) {
    const stage = (tile && tile.stage) || 4, cx = x + .5, cy = y + .5, red = g.c('#cf4a3c'), white = g.c('#f4f1ea');
    const scaffold = g.tw * [.3, .55, .3, 0][stage - 1], segH = g.tw * .16;
    g.shadow(cx, cy, .34);
    if (scaffold) g.scaffold(x, y, scaffold, 'back');
    g.cyl(cx, cy, .3, 0, g.tw * .06, g.c('#cfc6b4'));
    // Tour rayée, de plus en plus fine
    let z = g.tw * .06;
    for (let i = 0; i < [1, 3, 5, 5][stage - 1]; i++) { g.cyl(cx, cy, .2 - i * .012, z, segH, i % 2 ? red : white); z += segH; }
    if (stage >= 2) {
      const [dx, dy] = g.P(cx, cy, g.tw * .06), front = dy + .2 * Math.SQRT2 * g.hh;
      g.ctx.fillStyle = g.door;
      g.ctx.fillRect(dx - g.tw * .035, front - g.tw * .12, g.tw * .07, g.tw * .12);
    }
    if (stage >= 3) {
      g.cyl(cx, cy, .19, z, g.tw * .025, g.c('#3f4a50'));
      z += g.tw * .025;
      const glass = g.night ? '#ffe7a6' : g.c('#cfe3ec');
      g.cyl(cx, cy, .1, z, g.tw * .11, glass, glass);
      const [lx, ly] = g.P(cx, cy, z + g.tw * .055);
      if (g.night && stage === 4) g.glow(lx, ly, g.tw * .4, .55);
      z += g.tw * .11;
    }
    if (stage === 4) {
      g.cone(cx, cy, .13, z, g.tw * .1, red);
      const [tx, ty] = g.P(cx, cy, z + g.tw * .1);
      g.circle(tx, ty - g.tw * .02, g.tw * .02, g.c('#3f4a50'));
    }
    if (scaffold) g.scaffold(x, y, scaffold, 'front');
  },
  granderoue(g, x, y, tile) {
    const stage = (tile && tile.stage) || 4, ctx = g.ctx, cx = x + .5, cy = y + .5;
    const [hx, hy] = g.P(cx, cy, g.tw * .6), R = g.tw * .36, steel = g.c('#8a8f96'), rim = g.c('#efe9dc');
    // Pylônes en A, une paire derrière la roue et une devant
    const legs = (dx, col) => {
      const [lx, ly] = g.P(x + .15, y + .85), [rx, ry] = g.P(x + .85, y + .15);
      ctx.beginPath(); ctx.moveTo(lx + dx, ly); ctx.lineTo(hx + dx, hy); ctx.lineTo(rx + dx, ry);
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, g.tw * .035); ctx.stroke();
    };
    g.shadow(cx, cy, .4);
    if (stage < 3) g.scaffold(x, y, g.tw * .3, 'back');
    legs(-g.tw * .03, shade(steel, -.15));
    // Une fois inaugurée, la roue tourne lentement.
    const rot = stage === 4 && g.anim ? g.time * .25 : 0;
    if (stage >= 2) {
      // Moitié de roue à l'étape 2, roue entière ensuite
      const full = stage >= 3, a0 = full ? 0 : Math.PI / 2, a1 = full ? Math.PI * 2 : Math.PI * 1.5;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = steel; ctx.lineWidth = Math.max(1, g.tw * .012);
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2 + rot;
        if (!full && (a < a0 || a > a1)) continue;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * R, hy + Math.sin(a) * R); ctx.stroke();
      }
      ctx.strokeStyle = rim; ctx.lineWidth = Math.max(2, g.tw * .03);
      ctx.beginPath(); ctx.arc(hx, hy, R, a0, a1); ctx.stroke();
      ctx.lineWidth = Math.max(1, g.tw * .015);
      ctx.beginPath(); ctx.arc(hx, hy, R * .7, a0, a1); ctx.stroke();
      ctx.restore();
    }
    if (stage === 4) {
      // Nacelles aux couleurs des cinq domaines
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * Math.PI * 2 + rot, px = hx + Math.cos(a) * R, py = hy + Math.sin(a) * R;
        g.poly([[px, py], [px, py + g.tw * .03]], null, steel, 1);
        ctx.fillStyle = g.cat(CAT_ORDER[i % CAT_ORDER.length]);
        ctx.fillRect(px - g.tw * .035, py + g.tw * .03, g.tw * .07, g.tw * .055);
      }
      // Ampoules, allumées la nuit
      for (let i = 0; i < 20; i++) {
        const a = i / 20 * Math.PI * 2 + rot, px = hx + Math.cos(a) * R, py = hy + Math.sin(a) * R;
        if (g.night) g.glow(px, py, g.tw * .04, .5);
        g.circle(px, py, Math.max(.8, g.tw * .01), g.night ? '#fff3c4' : '#fffaf0');
      }
    }
    g.circle(hx, hy, g.tw * .03, g.c('#5b6268'));
    legs(g.tw * .03, steel);
    g.box(cx - .08, cy + .12, cx + .08, cy + .26, 0, g.tw * .05, g.c('#cfc6b4'));
    if (stage < 3) g.scaffold(x, y, g.tw * .3, 'front');
  },
});
