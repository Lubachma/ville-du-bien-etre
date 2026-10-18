/* =========================================================================
   Bâtiments de l'étape 2 : trois de plus par domaine.
   Même peintre que 30-paint.js : toit à la couleur du domaine, fenêtres allumées la nuit.
   ========================================================================= */
Object.assign(DRAW, {
  lavoir(g, x, y) {
    const C = g.cat('foyer'), wood = g.c('#8f6342');
    // Toit à une seule pente : poteaux hauts au fond, bas devant
    const post = (u, v) => g.box(x + u - .025, y + v - .025, x + u + .025, y + v + .025, 0, g.tw * (v < .5 ? .4 : .26), wood);
    g.shadow(x + .5, y + .5, .42);
    post(.18, .2);
    // Bassin de pierre et son eau claire
    g.box(x + .22, y + .26, x + .78, y + .74, 0, g.tw * .06, g.c('#d8cfbf'));
    g.poly([g.P(x + .27, y + .31, g.tw * .06), g.P(x + .73, y + .31, g.tw * .06), g.P(x + .73, y + .69, g.tw * .06), g.P(x + .27, y + .69, g.tw * .06)], g.c('#69bfdc', .5));
    post(.82, .2);
    post(.18, .8);
    // Corde à linge sous l'avant-toit
    g.poly([g.P(x + .18, y + .8, g.tw * .2), g.P(x + .82, y + .8, g.tw * .2)], null, g.c('#6b6b6b'), 1);
    ['#f2f2f2', '#9cc3e6', '#f6c95c'].forEach((col, i) => {
      const [px, py] = g.P(x + .32 + i * .17, y + .8, g.tw * .2);
      g.ctx.fillStyle = g.c(col);
      g.ctx.fillRect(px - g.tw * .03, py, g.tw * .06, g.tw * .07);
    });
    post(.82, .8);
    g.shed(x + .12, y + .14, x + .88, y + .86, g.tw * .26, g.tw * .16, C, shade(C, -.22));
  },
  moulin(g, x, y) {
    const C = g.cat('foyer'), cx = x + .5, cy = y + .5, ctx = g.ctx;
    g.shadow(cx, cy, .32);
    g.cyl(cx, cy, .24, 0, g.tw * .44, g.c('#efe6d6'));
    const [sx, sy] = g.P(cx, cy, 0), front = sy + .24 * Math.SQRT2 * g.hh;
    ctx.fillStyle = g.door;
    ctx.fillRect(sx - g.tw * .04, front - g.tw * .13, g.tw * .08, g.tw * .13);
    ctx.fillStyle = g.night ? g.win : g.c('#9fc3d4');
    ctx.fillRect(sx - g.tw * .03, front - g.tw * .32, g.tw * .06, g.tw * .07);
    g.cone(cx, cy, .28, g.tw * .44, g.tw * .22, C);
    // Quatre ailes en croix, devant la tour
    const [hx, hy0] = g.P(cx, cy, g.tw * .52), hy = hy0 + g.tw * .06, len = g.tw * .4, w = g.tw * .09;
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2, dx = Math.cos(a), dy = Math.sin(a), nx = -dy * w, ny = dx * w;
      const ax = hx + dx * g.tw * .05, ay = hy + dy * g.tw * .05, bx = hx + dx * len, by = hy + dy * len;
      g.poly([[ax, ay], [bx, by], [bx + nx, by + ny], [ax + nx, ay + ny]], g.c('#f3ede0'), g.c('#7a5a43'), 1);
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(bx, by);
      ctx.strokeStyle = g.c('#6d4c35'); ctx.lineWidth = Math.max(1, g.tw * .02); ctx.stroke();
    }
    g.circle(hx, hy, g.tw * .03, g.c('#6d4c35'));
  },
  marche(g, x, y) {
    const C = g.cat('foyer'), wood = g.c('#8a5e3f');
    const post = (u, v) => g.box(x + u - .022, y + v - .022, x + u + .022, y + v + .022, 0, g.tw * .28, wood);
    g.shadow(x + .5, y + .5, .46);
    g.tile(x, y, .1, g.c('#ddd2bd'));
    for (const u of [.16, .5, .84]) post(u, .2);
    // Étals colorés sous la halle
    [['#e2694f', .26, .34], ['#f0bf48', .56, .34], ['#79b45e', .26, .56], ['#e2694f', .56, .56]].forEach(([col, u, v]) => {
      g.box(x + u, y + v, x + u + .16, y + v + .12, 0, g.tw * .08, g.c('#b98a5c'), { top: g.c(col) });
    });
    for (const u of [.16, .5, .84]) post(u, .8);
    g.gableX(x + .08, y + .12, x + .92, y + .88, g.tw * .28, g.tw * .2, C, shade(C, -.22));
  },
  musee(g, x, y) {
    const C = g.cat('esprit'), stone = g.c('#ece5d6');
    g.shadow(x + .5, y + .45, .46);
    // Long bâtiment au fond, corniche à la couleur du domaine
    const b = g.box(x + .1, y + .1, x + .9, y + .42, 0, g.tw * .3, stone);
    g.windows(b, 'L', 4, .3, .45);
    g.windows(b, 'R', 1, .3, .45);
    g.box(x + .08, y + .08, x + .92, y + .44, g.tw * .3, g.tw * .04, C);
    // Parvis et pyramide de verre
    g.poly([g.P(x + .12, y + .48), g.P(x + .88, y + .48), g.P(x + .88, y + .9), g.P(x + .12, y + .9)], g.c('#e4dccb'));
    g.hipRoof(x + .32, y + .52, x + .68, y + .88, 0, g.tw * .3, g.night ? '#f5cf7a' : '#b9dcea');
    const apex = g.P(x + .5, y + .7, g.tw * .3), frame = g.night ? 'rgba(90,60,20,.6)' : 'rgba(70,110,130,.7)';
    for (const [u, v] of [[.32, .88], [.5, .88], [.68, .88], [.68, .7], [.68, .52]]) g.poly([apex, g.P(x + u, y + v)], null, frame, 1);
    if (g.night) g.glow(apex[0], apex[1] + g.tw * .12, g.tw * .22, .35);
  },
  universite(g, x, y) {
    const C = g.cat('esprit'), brick = g.c('#dcc0a4'), light = g.c('#eadbc8');
    g.shadow(x + .5, y + .5, .46);
    const b = g.box(x + .12, y + .2, x + .88, y + .7, 0, g.tw * .3, brick);
    g.windows(b, 'L', 4, .55, .28);
    g.windows(b, 'L', 4, .12, .28);
    g.windows(b, 'R', 2, .55, .28);
    g.windows(b, 'R', 2, .12, .28);
    g.gableX(x + .1, y + .18, x + .9, y + .72, g.tw * .3, g.tw * .14, shade(C, -.08), shade(brick, -.18));
    // Deux tours à flèche, l'entrée entre elles
    g.onFace(b, 'L', .42, 0, .16, .34, g.door);
    for (const u of [.24, .76]) {
      const t = g.box(x + u - .08, y + .64, x + u + .08, y + .8, 0, g.tw * .46, light);
      g.windows(t, 'L', 1, .58, .22, .45);
      g.windows(t, 'L', 1, .2, .22, .45);
      g.cone(x + u, y + .72, .1, g.tw * .46, g.tw * .26, C);
    }
  },
  planetarium(g, x, y) {
    const C = g.cat('esprit'), cx = x + .5, cy = y + .5;
    g.shadow(cx, cy, .46);
    g.cyl(cx, cy, .42, 0, g.tw * .16, g.c('#e7e2d8'));
    g.ell(cx, cy, .42, g.tw * .16, null, C, Math.max(2, g.tw * .035));
    g.dome(cx, cy, .38, g.tw * .16, g.night ? '#24305a' : g.c('#3e4f86'));
    // Étoiles dorées sur la coupole
    const [sx, sy] = g.P(cx, cy, g.tw * .16), rx = .38 * Math.SQRT2 * g.hw;
    for (const [u, v] of [[-.5, .35], [-.15, .7], [.25, .5], [.55, .25], [.05, .3], [-.35, .1], [.35, .12]]) {
      g.circle(sx + u * rx, sy - v * rx * .8, Math.max(1, g.tw * .018), g.night ? '#ffe39a' : '#f6d36b');
    }
    const [ex, ey] = g.P(cx, cy, 0), front = ey + .42 * Math.SQRT2 * g.hh;
    g.ctx.fillStyle = g.door;
    g.ctx.fillRect(ex - g.tw * .05, front - g.tw * .12, g.tw * .1, g.tw * .12);
  },
  skatepark(g, x, y) {
    const C = g.cat('corps'), concrete = g.c('#c6cacf'), rise = g.tw * .18;
    g.tile(x, y, .05, concrete);
    // Rampe en quart de cercle le long du fond
    const prof = [];
    for (let k = 0; k <= 6; k++) { const th = Math.PI / 2 * k / 6; prof.push([y + .42 - .32 * Math.sin(th), rise * (1 - Math.cos(th))]); }
    g.poly([...prof.map(([v, z]) => g.P(x + .9, v, z)), g.P(x + .9, y + .1, 0)], shade(concrete, -.2));
    for (let k = 5; k >= 0; k--) {
      const [v0, z0] = prof[k], [v1, z1] = prof[k + 1];
      g.poly([g.P(x + .1, v0, z0), g.P(x + .9, v0, z0), g.P(x + .9, v1, z1), g.P(x + .1, v1, z1)], shade(concrete, .06 - k * .025));
    }
    g.poly([g.P(x + .1, y + .1, rise), g.P(x + .9, y + .1, rise)], null, C, Math.max(2, g.tw * .03));
    // Rail de glisse
    for (const u of [.3, .66]) g.box(x + u, y + .66, x + u + .04, y + .7, 0, g.tw * .05, g.c('#5b6268'));
    g.box(x + .26, y + .66, x + .74, y + .7, g.tw * .05, g.tw * .015, C);
  },
  escalade(g, x, y) {
    const C = g.cat('corps');
    g.shadow(x + .5, y + .45, .34);
    const b = g.box(x + .22, y + .32, x + .78, y + .5, 0, g.tw * .6, g.c('#d9dee4'), { top: shade(C, .05), right: g.c('#a9b1ba') });
    // Prises aux couleurs des cinq domaines
    const cols = CAT_ORDER.map(c => g.cat(c));
    for (let i = 0; i < 14; i++) {
      const [sx, sy] = g.fL(b, .08 + rnd(i * 3, 7) * .84, .06 + i / 14 * .88);
      g.circle(sx, sy, Math.max(1.2, g.tw * .022), cols[i % cols.length]);
    }
    // Tapis de réception
    g.box(x + .2, y + .54, x + .8, y + .82, 0, g.tw * .04, g.c('#4e6fb3'));
  },
  gymnase(g, x, y) {
    const C = g.cat('corps'), wall = g.c('#eceae4'), h0 = g.tw * .22, rise = g.tw * .2;
    g.shadow(x + .5, y + .5, .48);
    const b = g.box(x + .1, y + .2, x + .9, y + .8, 0, h0, wall, { noTop: true });
    g.windows(b, 'L', 3, .2, .6, .22);
    g.onFace(b, 'R', .38, 0, .24, .55, g.door);
    // Toit en voûte, en bandes
    const n = 8, arc = k => { const a = Math.PI * k / n; return [y + .5 - Math.cos(a) * .3, h0 + Math.sin(a) * rise]; };
    for (let k = 0; k < n; k++) {
      const [v0, z0] = arc(k), [v1, z1] = arc(k + 1);
      g.poly([g.P(x + .1, v0, z0), g.P(x + .9, v0, z0), g.P(x + .9, v1, z1), g.P(x + .1, v1, z1)], k % 2 ? C : shade(C, .12));
    }
    const cap = [g.P(x + .9, y + .2, h0)];
    for (let k = 0; k <= n; k++) { const [v, z] = arc(k); cap.push(g.P(x + .9, v, z)); }
    cap.push(g.P(x + .9, y + .8, h0));
    g.poly(cap, shade(wall, -.12));
  },
  labyrinthe(g, x, y) {
    const ctx = g.ctx, [sx, sy] = g.P(x + .5, y + .5), hedge = g.c('#4b8a43'), leaf = g.c('#69a95a');
    g.tile(x, y, .04, g.c('#e5dcc3'));
    // Haies basses en anneaux, chacune ouverte d'un côté
    ctx.save();
    ctx.lineCap = 'round';
    for (const [r, gap] of [[.39, .4], [.28, 3.6], [.17, 1.9]]) {
      const rx = r * Math.SQRT2 * g.hw, ry = r * Math.SQRT2 * g.hh;
      for (const [dz, col, lw] of [[0, hedge, .07], [g.tw * .035, leaf, .045]]) {
        ctx.beginPath();
        ctx.ellipse(sx, sy - dz, rx, ry, 0, gap + .45, gap + Math.PI * 2 - .45);
        ctx.strokeStyle = col; ctx.lineWidth = g.tw * lw; ctx.stroke();
      }
    }
    ctx.restore();
    g.ell(x + .5, y + .5, .07, 0, g.c('#bcb4a1'));
    g.cyl(x + .5, y + .5, .03, 0, g.tw * .1, g.c('#a39b8a'));
  },
  source(g, x, y) {
    const C = g.cat('calme'), ctx = g.ctx, wood = g.c('#a3714a');
    g.shadow(x + .5, y + .5, .42);
    // Cabane en bois au fond
    const cb = g.box(x + .6, y + .1, x + .86, y + .3, 0, g.tw * .18, wood);
    g.onFace(cb, 'L', .3, 0, .35, .65, g.door);
    g.gableY(x + .58, y + .08, x + .88, y + .32, g.tw * .18, g.tw * .1, C, shade(wood, .05));
    // Bassin bordé de rochers
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2, [px, py] = g.P(x + .45 + Math.cos(a) * .27, y + .57 + Math.sin(a) * .27, 2);
      g.circle(px, py, g.tw * .045, g.c(i % 2 ? '#9a948a' : '#b5afa5'));
    }
    g.ell(x + .45, y + .57, .25, 2, g.c('#55c3bf', .5));
    g.ell(x + .41, y + .53, .12, 2, g.c('#8edbd5', .5));
    // Volutes de vapeur
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.2, g.tw * .022);
    ctx.strokeStyle = g.night ? 'rgba(210,228,255,.5)' : 'rgba(255,255,255,.9)';
    for (const [dx, k] of [[-.1, .9], [0, 1.1], [.1, .8]]) {
      const [px, py] = g.P(x + .45 + dx, y + .57 - dx, 4), hgt = g.tw * .3 * k;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px - g.tw * .06, py - hgt * .3, px, py - hgt * .55);
      ctx.quadraticCurveTo(px + g.tw * .06, py - hgt * .8, px, py - hgt);
      ctx.stroke();
    }
    ctx.restore();
  },
  pagode(g, x, y) {
    const C = g.cat('calme'), wall = g.c('#b04a3c'), gold = g.c('#e8b84a');
    g.shadow(x + .5, y + .5, .4);
    g.box(x + .16, y + .16, x + .84, y + .84, 0, g.tw * .04, g.c('#d6cdbb'));
    let z = g.tw * .04;
    // Quatre étages de plus en plus petits, aux toits relevés
    for (const [s, h] of [[.24, .16], [.2, .13], [.16, .11], [.12, .1]]) {
      const b = g.box(x + .5 - s, y + .5 - s, x + .5 + s, y + .5 + s, z, g.tw * h, wall);
      g.windows(b, 'L', 1, .2, .55, .34);
      g.windows(b, 'R', 1, .2, .55, .34);
      z += g.tw * h;
      const e = s + .1;
      g.hipRoof(x + .5 - e, y + .5 - e, x + .5 + e, y + .5 + e, z, g.tw * .07, C);
      for (const [u, v, side] of [[-e, e, -1], [e, e, 0], [e, -e, 1]]) {
        const [px, py] = g.P(x + .5 + u, y + .5 + v, z);
        g.poly([[px - g.tw * .03, py], [px + g.tw * .03, py], [px + side * g.tw * .04, py - g.tw * .05]], shade(C, -.15));
      }
      z += g.tw * .025;
    }
    // Flèche dorée
    g.box(x + .49, y + .49, x + .51, y + .51, z, g.tw * .16, gold);
    for (let i = 1; i <= 3; i++) {
      const [px, py] = g.P(x + .5, y + .5, z + g.tw * .04 * i);
      g.circle(px, py, g.tw * (.03 - i * .005), gold);
    }
  },
  galerie(g, x, y) {
    const C = g.cat('crea'), wall = g.c('#f7f5f0');
    g.shadow(x + .5, y + .5, .44);
    const b = g.box(x + .16, y + .2, x + .84, y + .8, 0, g.tw * .34, wall, { top: g.c('#e7e3da') });
    // Grand tableau encadré sur la façade
    g.onFace(b, 'L', .1, .24, .52, .62, C);
    g.onFace(b, 'L', .13, .3, .46, .5, g.c('#2f5d8a'));
    g.onFace(b, 'L', .18, .56, .12, .16, g.c('#f2c14e'));
    g.onFace(b, 'L', .13, .3, .46, .14, g.c('#7bb662'));
    g.onFace(b, 'L', .72, 0, .2, .56, g.night ? g.win : g.c('#9fc3d4'));
    g.windows(b, 'R', 2, .45, .35);
    // Verrière sur le toit
    g.gableX(x + .3, y + .38, x + .7, y + .62, g.tw * .34, g.tw * .08, g.night ? 'rgba(255,214,128,.6)' : 'rgba(190,225,240,.85)');
  },
  cinema(g, x, y) {
    const C = g.cat('crea'), wall = g.c('#eadccb');
    g.shadow(x + .5, y + .5, .44);
    const b = g.box(x + .16, y + .18, x + .84, y + .78, 0, g.tw * .38, wall);
    g.box(x + .14, y + .16, x + .86, y + .8, g.tw * .38, g.tw * .03, shade(wall, -.12));
    g.onFace(b, 'L', .36, 0, .28, .36, g.door);
    g.onFace(b, 'L', .08, .08, .2, .4, g.c('#f2c14e'));
    g.onFace(b, 'L', .72, .08, .2, .4, g.c('#7fb1d8'));
    g.windows(b, 'R', 2, .55, .3);
    // Marquise d'ampoules, allumées la nuit
    const m = g.box(x + .24, y + .78, x + .76, y + .9, g.tw * .17, g.tw * .06, C);
    for (let i = 0; i <= 8; i++) {
      const [sx, sy] = g.fL(m, i / 8, 0);
      if (g.night) g.glow(sx, sy, g.tw * .05, .6);
      g.circle(sx, sy + 1, Math.max(1, g.tw * .014), g.night ? '#fff3c4' : '#fff8e1');
    }
    // Enseigne verticale au coin
    const s = g.box(x + .84, y + .74, x + .88, y + .8, g.tw * .16, g.tw * .38, C);
    for (let i = 0; i < 4; i++) {
      const [sx, sy] = g.fL(s, .5, .15 + i * .22);
      g.circle(sx, sy, Math.max(1, g.tw * .016), g.night ? '#fff3c4' : '#ffffff');
    }
  },
  chapiteau(g, x, y) {
    const C = g.cat('crea'), white = g.c('#f8f3ea'), ctx = g.ctx, cx = x + .5, cy = y + .5, r = .4, h = g.tw * .2, top = g.tw * .38;
    g.shadow(cx, cy, .44);
    g.cyl(cx, cy, r, 0, h, white);
    // Rayures de la paroi, sur la moitié visible
    const [sx, sy] = g.P(cx, cy, 0), rx = r * Math.SQRT2 * g.hw, ry = r * Math.SQRT2 * g.hh;
    const wallAt = (a, dz) => [sx + Math.cos(a) * rx, sy + Math.sin(a) * ry - dz];
    for (let i = 0; i < 8; i += 2) {
      const a0 = Math.PI * i / 8, a1 = Math.PI * (i + 1) / 8;
      g.poly([wallAt(a0, 0), wallAt(a1, 0), wallAt(a1, h), wallAt(a0, h)], C);
    }
    g.poly([[sx - g.tw * .06, sy + ry], [sx + g.tw * .06, sy + ry], [sx, sy + ry - g.tw * .16]], g.night ? '#ffd47a' : g.c('#3b2c22'));
    // Toit conique rayé
    g.cone(cx, cy, r + .04, h, top, C);
    const [ax, ay] = g.P(cx, cy, h + top), [bx, by] = g.P(cx, cy, h), brx = (r + .04) * Math.SQRT2 * g.hw, bry = (r + .04) * Math.SQRT2 * g.hh;
    for (let i = 1; i < 10; i += 2) {
      const a0 = Math.PI * i / 10, a1 = Math.PI * (i + 1) / 10;
      g.poly([[ax, ay], [bx + Math.cos(a0) * brx, by + Math.sin(a0) * bry], [bx + Math.cos(a1) * brx, by + Math.sin(a1) * bry]], white);
    }
    // Mât et fanion
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay - g.tw * .14);
    ctx.strokeStyle = g.c('#6b4f3a'); ctx.lineWidth = Math.max(1, g.tw * .02); ctx.stroke();
    g.poly([[ax, ay - g.tw * .14], [ax + g.tw * .1, ay - g.tw * .11], [ax, ay - g.tw * .08]], g.cat('foyer'));
  },
});
