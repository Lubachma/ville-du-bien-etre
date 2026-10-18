/* =========================================================================
   Ville : rendu, pointeur, clavier
   ========================================================================= */
/* Ciel et lumière de la ville selon le moment de la journée et la météo. */
const SKY = { night: ['#0b1424', '#1a2b37'], dawn: ['#f2b8a2', '#f8e4d2'], day: ['#bcdff1', '#eef6ef'], golden: ['#f4c98c', '#fbe9c8'], dusk: ['#6f5f9e', '#ee9f7a'] };
// Passages en douceur : nuit, aube puis journée le matin ; journée, fin d'après-midi, crépuscule puis nuit le soir.
function skyPair(moment) {
  const t = moment.t || 0, lerp = (a, b, k) => [mix(a[0], b[0], k), mix(a[1], b[1], k)];
  switch (moment.name) {
    case 'dawn': return t < .5 ? lerp(SKY.night, SKY.dawn, t * 2) : lerp(SKY.dawn, SKY.day, t * 2 - 1);
    case 'golden': return lerp(SKY.day, SKY.golden, t);
    case 'dusk': return t < .5 ? lerp(SKY.golden, SKY.dusk, t * 2) : lerp(SKY.dusk, SKY.night, t * 2 - 1);
    default: return SKY[moment.name] || SKY.day;
  }
}
// Couleurs du ciel : grisé par les nuages, le brouillard, la pluie ou la neige (un gris qui s'assombrit la nuit), étoiles la nuit.
function skyColors(amb) {
  const dark = darkness(amb.moment), grey = mix('#9aa5ad', '#252b33', dark), k = { clouds: .25, fog: .25, rain: .45, snow: .45 }[amb.weather] || 0;
  const [top, bottom] = skyPair(amb.moment);
  return { top: k ? mix(top, grey, k) : top, bottom: k ? mix(bottom, grey, k) : bottom, stars: Math.max(0, dark - .6) / .4 * (amb.weather === 'sun' ? 1 : .3) };
}
// Teinte posée sur la ville : rosée à l'aube, chaude en fin d'après-midi, violette au crépuscule.
function lightTint(amb) {
  return { dawn: 'rgba(255,170,150,.14)', golden: 'rgba(255,190,110,.14)', dusk: 'rgba(130,100,190,.16)' }[amb.moment.name] || null;
}
// Ciel « selon l'heure » posé sur la carte de la ville ; « selon l'apparence », celui du thème.
function applySky(amb, byTime) {
  const sky = $('#sky');
  if (!sky) return;
  if (!byTime) { for (const name of ['--sky-top', '--sky-bottom', '--star-opacity']) sky.style.removeProperty(name); return; }
  const c = skyColors(amb);
  sky.style.setProperty('--sky-top', c.top);
  sky.style.setProperty('--sky-bottom', c.bottom);
  sky.style.setProperty('--star-opacity', c.stars.toFixed(2));
}

const City = (() => {
  const canvas = $('#city');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, TW = 40, ox = 0, oy = 0, N = 7;
  let hover = null;
  let raf = 0;
  let keyboard = false;
  const cursor = { x: 3, y: 3 };
  // Effets de pose : chantier, déplacement, étape, inauguration (par case), étincelles d'un ensemble découvert.
  const effects = new Map();
  let sparkles = [];
  const FX_TIME = { build: 1000, stage: 1000, move: 600, inaugurate: 1400, sparkle: 900 };
  // Ville vivante : une image environ toutes les 83 ms (12 par seconde), seulement quand on la regarde.
  const AMBIENT_MS = 83;
  let ambientTimer = 0, frames = 0, onScreen = true;
  function ambientRunning() {
    return S.settings.ambient !== false && !reducedMotion() && currentTab === 'ville' && document.visibilityState === 'visible'
      && $('#sheet').hidden && $('#session').hidden && onScreen;
  }
  // Prochaine image : pleine vitesse pendant un effet de pose, cadence douce pour l'ambiance, sinon rien.
  function schedule(effects) {
    if (effects) { raf = requestAnimationFrame(draw); return; }
    if (ambientRunning()) ambientTimer = setTimeout(() => { ambientTimer = 0; raf = requestAnimationFrame(draw); }, AMBIENT_MS);
  }
  // Relance la ville (retour sur l'onglet, fenêtre fermée, réglage changé…) : une image, puis la bonne cadence.
  function wake() { if (!raf && !ambientTimer) draw(); }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { onScreen = entries[entries.length - 1].isIntersecting; if (onScreen) wake(); }).observe(canvas);
  }

  function layout() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(240, rect.width || canvas.parentElement.clientWidth || 360);
    N = S.city.size;
    TW = Math.min(76, (W - 28) / N);
    const top = TW * 1.35 + 8;
    H = Math.round(top + N * TW / 2 + TW * .45 + 14);
    dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.height = H + 'px';
    ox = W / 2;
    oy = top;
    cursor.x = clamp(cursor.x, 0, N - 1);
    cursor.y = clamp(cursor.y, 0, N - 1);
  }
  function tileAt(px, py) {
    const a = (px - ox) / (TW / 2), b = (py - oy) / (TW / 4);
    const x = Math.floor((a + b) / 2), y = Math.floor((b - a) / 2);
    if (x < 0 || y < 0 || x >= N || y >= N) return null;
    return { x, y };
  }
  function tileOf(x, y) { return S.city.tiles.find(t => t.x === x && t.y === y) || null; }
  function pickBuilding(px, py) {
    const t = tileAt(px, py);
    if (t) { const hit = tileOf(t.x, t.y); if (hit) return hit; }
    const hw = TW / 2, hh = TW / 4;
    const sorted = [...S.city.tiles].sort((p, q) => (q.x + q.y) - (p.x + p.y) || q.x - p.x);
    for (const tl of sorted) {
      const it = ITEMS[tl.item];
      const cx = ox + (tl.x - tl.y) * hw, cy = oy + (tl.x + tl.y + 1) * hh;
      if (px > cx - hw * .7 && px < cx + hw * .7 && py < cy + hh && py > cy - it.hf * TW) return tl;
    }
    return null;
  }
  function hexA(hex, a) { const { r, g, b } = hexToRgb(hex); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }
  // L'élément sort du sol (chantier, étape) puis rebondit ; un déplacement ou une inauguration rebondit tout de suite.
  function effectTransform(g, t, kind, k) {
    const [cx, cy] = g.P(t.x + .5, t.y + .5);
    let sx = 1, sy = 1;
    if (kind === 'build' || kind === 'stage') sy = k < .15 ? 0 : k < .8 ? 1 - Math.pow(1 - (k - .15) / .65, 3) : 1;
    const [from, span] = kind === 'move' ? [0, 1] : kind === 'inaugurate' ? [0, .4] : [.8, .2];
    if (k >= from) { const b = Math.sin(Math.PI * Math.min(1, (k - from) / span)); sx *= 1 + .06 * b; sy *= 1 - .06 * b; }
    ctx.translate(cx, cy); ctx.scale(sx, Math.max(sy, .001)); ctx.translate(-cx, -cy);
  }
  // Échafaudage et poussière de part et d'autre de l'élément (« back » avant lui, « front » après lui), confettis devant.
  function effectOverlay(g, t, kind, k, layer) {
    if ((kind === 'build' || kind === 'stage') && k < .8 && scaffoldOnBuild(t.item)) {
      ctx.globalAlpha = k < .35 ? k / .35 : k > .65 ? (.8 - k) / .15 : 1;
      g.scaffold(t.x, t.y, g.tw * .5, layer);
    }
    const dust = kind === 'move' ? k : (kind === 'build' || kind === 'stage') && k >= .5 ? (k - .5) / .5 : -1;
    if (dust >= 0) {
      ctx.globalAlpha = .9 * (1 - dust);
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2 + .4, u = Math.cos(a), v = Math.sin(a), r = .32 + .24 * dust;
        if ((u + v < 0) !== (layer === 'back')) continue;
        const [px, py] = g.P(t.x + .5 + u * r, t.y + .5 + v * r, g.tw * .05 * dust);
        g.circle(px, py, g.tw * (.05 + .03 * dust), g.night ? '#8b8070' : '#f1e7d3');
      }
    }
    if (kind === 'inaugurate' && layer === 'front') {
      const cols = CAT_ORDER.map(c => g.cat(c)), top = g.tw * (ITEMS[t.item].hf + .3);
      for (let i = 0; i < 16; i++) {
        const q = clamp((k - rnd(i, 9) * .3) / .7, 0, 1);
        if (!q) continue;
        const [px, py] = g.P(t.x + .5 + (rnd(i, 3) - .5) * .9, t.y + .5 + (rnd(7, i) - .5) * .9, top * (1 - q * q));
        ctx.globalAlpha = 1 - Math.max(0, q - .7) / .3;
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(px - g.tw * .015, py - g.tw * .025, g.tw * .03, g.tw * .05);
      }
    }
    ctx.globalAlpha = 1;
  }
  // Étoile à quatre branches, pour les étincelles d'un ensemble.
  function star(g, x, y, r) {
    if (r <= 0) return;
    g.poly([[x, y - r], [x + r * .3, y - r * .3], [x + r, y], [x + r * .3, y + r * .3], [x, y + r], [x - r * .3, y + r * .3], [x - r, y], [x - r * .3, y - r * .3]], g.night ? '#ffe7a6' : '#f6c94f');
  }

  function draw(options) {
    const clean = options && options.clean === true;
    cancelAnimationFrame(raf);
    clearTimeout(ambientTimer);
    raf = 0; ambientTimer = 0;
    if (!W) layout();
    // Ambiance du moment : saison toujours ; obscurité, ciel et teinte selon l'heure, sauf « ciel selon l'apparence ».
    const pal = readPalette(), amb = typeof ambientAt === 'function' ? ambientAt() : null, byTime = !!amb && S.settings.sky !== 'theme';
    if (amb) { pal.season = amb.season; if (byTime) pal.dark = darkness(amb.moment); }
    pal.time = performance.now() / 1000;
    pal.anim = !clean && ambientRunning();
    applySky(amb, byTime);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const g = makePainter(ctx, TW, ox, oy, pal);
    const night = g.night;

    const slab = TW * .32;
    const L = g.P(0, N), B = g.P(N, N), R = g.P(N, 0);
    g.poly([L, B, [B[0], B[1] + slab], [L[0], L[1] + slab]], night ? '#4a3c2c' : '#b89a72');
    g.poly([B, R, [R[0], R[1] + slab], [B[0], B[1] + slab]], night ? '#3b2f22' : '#9f835d');
    g.poly([[L[0], L[1] + slab * .28], [B[0], B[1] + slab * .28], B, L], night ? '#2f4a36' : '#86b26c');
    g.poly([[B[0], B[1] + slab * .28], [R[0], R[1] + slab * .28], R, B], night ? '#283f2e' : '#78a35f');
    const ground = groundColors(amb ? amb.season : 'spring', g.dark);
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) g.tile(x, y, 0, ground[(x + y) % 2], night ? 'rgba(0,0,0,.12)' : 'rgba(40,70,30,.06)', 1);
    }
    // Ensembles formés : un pavage commun sous leurs éléments.
    const paved = pavedTileIds();
    for (const tl of S.city.tiles) if (paved.has(tl.id)) g.paving(tl.x, tl.y);
    if (!clean && Mode.state) {
      for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
        const occ = tileOf(x, y);
        const moving = Mode.state.type === 'move' && occ && occ.id === Mode.state.tileId;
        if (!occ || moving) g.tile(x, y, .06, null, night ? 'rgba(140,220,170,.35)' : 'rgba(46,111,78,.28)', 1);
      }
      const tg = Mode.state.target || hover;
      if (tg) {
        const occ = tileOf(tg.x, tg.y);
        const ok = !occ || (Mode.state.type === 'move' && occ.id === Mode.state.tileId);
        g.tile(tg.x, tg.y, 0, ok ? hexA(pal.accent, .32) : hexA(pal.danger, .32));
      }
    }
    if (!clean && Selection.id) {
      const sel = S.city.tiles.find(t => t.id === Selection.id);
      if (sel) g.tile(sel.x, sel.y, 0, hexA(pal.accent, .22), pal.accent, 2);
    }
    const list = S.city.tiles.map(t => ({ t, ghost: false }));
    if (!clean && Mode.state && Mode.state.target) {
      const moving = Mode.state.type === 'move' ? S.city.tiles.find(t => t.id === Mode.state.tileId) || {} : null;
      const key = moving ? moving.item : Mode.state.item;
      // Une merveille qu'on pose apparaît en chantier ; déplacée, elle garde son étape.
      if (key) list.push({ t: { id: '__ghost', item: key, x: Mode.state.target.x, y: Mode.state.target.y, stage: moving ? moving.stage : 1 }, ghost: true });
    }
    const hiddenId = !clean && Mode.state && Mode.state.type === 'move' && Mode.state.target ? Mode.state.tileId : null;
    list.sort((p, q) => (p.t.x + p.t.y) - (q.t.x + q.t.y) || p.t.x - q.t.x);
    const now = performance.now();
    let animating = false;
    for (const { t, ghost } of list) {
      if (t.id === hiddenId || !isItem(t.item)) continue;
      const fx = clean ? null : effects.get(t.id);
      const k = fx ? clamp((now - fx.start) / FX_TIME[fx.kind], 0, 1) : 1;
      if (fx) { if (k >= 1) effects.delete(t.id); else animating = true; }
      const overlay = layer => { ctx.save(); try { effectOverlay(g, t, fx.kind, k, layer); } catch (e) { /* effet ignoré */ } ctx.restore(); };
      if (fx && k < 1) overlay('back');
      ctx.save();
      try {
        if (ghost) ctx.globalAlpha = .62;
        if (fx) effectTransform(g, t, fx.kind, k);
        DRAW[t.item](g, t.x, t.y, t);
        drawGrowth(g, t.item, t.x, t.y);
      } catch (e) { /* un bâtiment illisible ne bloque pas le reste de la ville */ }
      ctx.restore();
      if (fx && k < 1) overlay('front');
    }
    // Teinte du moment, posée seulement sur ce qui est dessiné (l'île et ses éléments).
    const tint = byTime ? lightTint(amb) : null;
    if (tint) { ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    // Étincelles sur les cases d'un ensemble qu'on vient de découvrir.
    sparkles = clean ? sparkles : sparkles.filter(s => now - s.start < FX_TIME.sparkle);
    for (const s of clean ? [] : sparkles) {
      const q = (now - s.start) / FX_TIME.sparkle;
      animating = true;
      for (const tl of S.city.tiles.filter(tile => s.ids.includes(tile.id))) {
        for (let i = 0; i < 3; i++) {
          const [px, py] = g.P(tl.x + .25 + rnd(i, tl.x) * .5, tl.y + .25 + rnd(tl.y, i) * .5, g.tw * (.25 + rnd(i * 5, 7) * .5));
          star(g, px, py, g.tw * .06 * Math.sin(Math.PI * clamp(q * 1.4 - i * .15, 0, 1)));
        }
      }
    }
    if (!clean && keyboard && document.activeElement === canvas) {
      g.tile(cursor.x, cursor.y, 0, null, night ? '#ffffff' : '#1d2721', 2.5);
    }
    frames++;
    schedule(animating);
  }

  // Practice adds planters, then a golden pennant to buildings in that domain.
  function drawGrowth(g, key, x, y) {
    const level = buildingLevel(key);
    if (level < 2) return;
    for (const u of [.18, .75]) {
      g.box(x + u - .06, y + .82, x + u + .06, y + .94, 0, g.tw * .05, g.c('#bf7653'));
      const p = g.P(x + u, y + .88, g.tw * .1);
      g.circle(p[0], p[1], g.tw * .05, g.c('#68a55a'));
      g.circle(p[0], p[1] - g.tw * .02, g.tw * .025, g.c('#f5ca69'));
    }
    if (level >= 3) {
      const bottom = g.P(x + .84, y + .2), top = g.P(x + .84, y + .2, g.tw * .45);
      g.ctx.beginPath(); g.ctx.moveTo(...bottom); g.ctx.lineTo(...top);
      g.ctx.strokeStyle = g.c('#94704b'); g.ctx.lineWidth = Math.max(1, g.tw * .025); g.ctx.stroke();
      g.poly([top, [top[0] + g.tw * .16, top[1] + g.tw * .06], [top[0], top[1] + g.tw * .13]], g.c('#efc451'));
    }
  }
  function snapshot(minWidth = 1200) {
    const original = { width: canvas.width, height: canvas.height, dpr };
    try {
      dpr = Math.max(dpr, minWidth / W);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      draw({ clean: true });
      const result = document.createElement('canvas');
      result.width = canvas.width; result.height = canvas.height;
      result.getContext('2d').drawImage(canvas, 0, 0);
      return result;
    } finally {
      dpr = original.dpr; canvas.width = original.width; canvas.height = original.height;
      draw();
    }
  }

  // opts.stage : étape d'une merveille (la merveille terminée par défaut).
  function thumb(cv, key, size = 64, opts = {}) {
    if (!isItem(key)) return;
    const it = ITEMS[key];
    const d = Math.min(3, window.devicePixelRatio || 1);
    cv.width = size * d; cv.height = size * d;
    const c = cv.getContext('2d');
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, size, size);
    const tw = Math.min(size * .9, (size * .86) / (it.hf + .25));
    const pal = readPalette();
    const g = makePainter(c, tw, size / 2, size - 3 - tw / 2, pal), ground = () => g.tile(0, 0, 0, pal.night ? '#2d4a3a' : '#acd292');
    if (!opts.silhouette) {
      ground();
      try { DRAW[key](g, 0, 0, { stage: opts.stage || 4 }); drawGrowth(g, key, 0, 0); } catch (e) { /* vignette vide */ }
      return;
    }
    // Silhouette : l'élément en ombre unie, puis sa case glissée dessous, sans autre canvas.
    try { DRAW[key](g, 0, 0, { stage: opts.stage || 4 }); } catch (e) { /* silhouette vide */ }
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = pal.night ? 'rgba(255,255,255,.3)' : 'rgba(40,60,50,.38)';
    c.fillRect(0, 0, size, size);
    c.globalCompositeOperation = 'destination-over';
    ground();
    c.globalCompositeOperation = 'source-over';
  }
  // Aucun effet quand le système demande de réduire les animations.
  function effect(id, kind) { if (reducedMotion()) return; effects.set(id, { kind, start: performance.now() }); draw(); }
  function sparkle(ids) { if (reducedMotion() || !ids.length) return; sparkles.push({ ids, start: performance.now() }); draw(); }
  function effectCount() { return effects.size + sparkles.length; }
  function relayout() { layout(); draw(); }
  function point(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function describe(x, y) {
    const tile = tileOf(x, y);
    const params = { x: x + 1, y: y + 1, item: tile ? itemName(tile.item) : '' };
    if (Mode.state) {
      const free = !tile || (Mode.state.type === 'move' && tile.id === Mode.state.tileId);
      return free ? t('city.descFreePick', params) : t('city.descTaken', params);
    }
    return tile ? t('city.descBuilding', params) : t('city.descFree', params);
  }

  canvas.addEventListener('pointermove', e => {
    if (!Mode.state || e.pointerType === 'touch') return;
    const t = tileAt(...point(e));
    if ((t && hover && t.x === hover.x && t.y === hover.y) || (!t && !hover)) return;
    hover = t; draw();
  });
  canvas.addEventListener('pointerleave', () => { if (hover) { hover = null; draw(); } });
  canvas.addEventListener('pointerdown', () => { keyboard = false; });
  canvas.addEventListener('click', e => {
    const [px, py] = point(e);
    if (Mode.state) { Mode.pickTile(tileAt(px, py)); return; }
    const b = pickBuilding(px, py);
    if (b) openBuildingSheet(b);
  });
  canvas.addEventListener('focus', () => { if (keyboard) draw(); });
  canvas.addEventListener('blur', () => draw());
  canvas.addEventListener('keydown', e => {
    const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (moves[e.key]) {
      e.preventDefault();
      keyboard = true;
      cursor.x = clamp(cursor.x + moves[e.key][0], 0, N - 1);
      cursor.y = clamp(cursor.y + moves[e.key][1], 0, N - 1);
      if (Mode.state) hover = { x: cursor.x, y: cursor.y };
      draw();
      announce(describe(cursor.x, cursor.y));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      keyboard = true;
      if (Mode.state) {
        const tg = Mode.state.target;
        if (tg && tg.x === cursor.x && tg.y === cursor.y) Mode.confirm();
        else Mode.pickTile({ x: cursor.x, y: cursor.y });
      } else {
        const t = tileOf(cursor.x, cursor.y);
        if (t) openBuildingSheet(t); else announce(describe(cursor.x, cursor.y));
      }
    } else if (e.key === 'Escape' && Mode.state) {
      e.preventDefault();
      Mode.cancel();
    }
  });

  return { layout, draw, relayout, thumb, effect, sparkle, effectCount, tileOf, snapshot, wake, frames: () => frames, focus: () => { keyboard = true; canvas.focus(); draw(); } };
})();

/* Placement / déplacement de bâtiments */
const Mode = {
  state: null,
  startPlace(key) {
    this.state = { type: 'place', item: key, target: null };
    go('ville');
    this.render();
    City.draw();
    if (kbdMode) setTimeout(() => City.focus(), 60);
    announce(t('city.choosePlace', { item: itemName(key) }));
  },
  startMove(tile) {
    this.state = { type: 'move', tileId: tile.id, target: null };
    go('ville');
    this.render();
    City.draw();
    if (kbdMode) setTimeout(() => City.focus(), 60);
    announce(t('city.chooseMove', { item: itemName(tile.item) }));
  },
  isFree(t, exceptId) {
    const occ = City.tileOf(t.x, t.y);
    return !occ || occ.id === exceptId;
  },
  pickTile(spot) {
    if (!this.state || !spot) return;
    if (!this.isFree(spot, this.state.type === 'move' ? this.state.tileId : null)) { toast(t('city.taken')); return; }
    this.state.target = spot;
    this.render();
    City.draw();
    announce(t('city.picked', { x: spot.x + 1, y: spot.y + 1, button: this.state.type === 'place' ? t('city.placeHere') : t('city.moveHere') }));
  },
  confirm() {
    const st = this.state;
    if (!st || !st.target) return;
    if (st.type === 'place') {
      const name = { item: itemName(st.item), g: itemGender(st.item) };
      const price = priceOf(st.item);
      const lock = lockInfo(st.item);
      if (lock) { toast(t('city.stillLocked', name)); this.cancel(); return; }
      if (isWonder(st.item) && wonderTile(st.item)) { toast(t('wonder.already', name)); this.cancel(); return; }
      if (S.coins < price) { toast(t('shop.missingToast', { coins: fmt(price - S.coins) })); return; }
      if (!this.isFree(st.target)) { toast(t('city.taken')); return; }
      S.coins -= price;
      const tile = { id: uid(), item: st.item, x: st.target.x, y: st.target.y, at: Date.now(), paid: price };
      if (isWonder(st.item)) tile.stage = 1;
      S.city.tiles.push(tile);
      const fresh = noticeProgress();
      this.state = null;
      City.effect(tile.id, 'build');
      Chime.place('build');
      commit();
      bump();
      // Un ensemble ou un succès : le message de fête remplace celui de la pose.
      if (fresh.sets.length || fresh.achievements.length) celebrate(fresh); else toast(t('city.built', name));
    } else {
      const tile = S.city.tiles.find(t => t.id === st.tileId);
      if (!tile) { this.cancel(); return; }
      if (!this.isFree(st.target, tile.id)) { toast(t('city.taken')); st.target = null; this.render(); City.draw(); return; }
      this.state = null;
      tile.x = st.target.x;
      tile.y = st.target.y;
      const fresh = noticeProgress();
      City.effect(tile.id, 'move');
      Chime.place('move');
      commit();
      if (fresh.sets.length || fresh.achievements.length) celebrate(fresh); else toast(t('city.moved'));
    }
  },
  cancel() { this.state = null; this.render(); City.draw(); },
  render() {
    const bar = $('#placebar'), txt = $('#placeText'), ok = $('#placeConfirm');
    const st = this.state;
    bar.hidden = !st;
    if (!st) return;
    if (st.type === 'place') {
      txt.textContent = frTypo(st.target ? itemName(st.item) + ' · ' + fmt(priceOf(st.item)) : t('city.tapToPlace', { item: itemName(st.item), price: fmt(priceOf(st.item)) }));
      ok.textContent = t('city.placeHere');
    } else {
      const tile = S.city.tiles.find(t => t.id === st.tileId);
      txt.textContent = frTypo(st.target ? t('city.newSpot') : t('city.tapToMove', { item: tile ? itemName(tile.item) : '' }));
      ok.textContent = t('city.moveHere');
    }
    ok.hidden = !st.target;
  },
};
const Selection = { id: null };

