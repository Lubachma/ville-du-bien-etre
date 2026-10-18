/* =========================================================================
   Ville : rendu, pointeur, clavier
   ========================================================================= */
const City = (() => {
  const canvas = $('#city');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, TW = 40, ox = 0, oy = 0, N = 7;
  let hover = null;
  let raf = 0;
  let keyboard = false;
  const cursor = { x: 3, y: 3 };
  const pops = new Map();

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
  function easeOutBack(k) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); }

  function draw(options) {
    const clean = options && options.clean === true;
    cancelAnimationFrame(raf);
    raf = 0;
    if (!W) layout();
    const pal = readPalette();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const g = makePainter(ctx, TW, ox, oy, pal);
    const night = pal.night;

    const slab = TW * .32;
    const L = g.P(0, N), B = g.P(N, N), R = g.P(N, 0);
    g.poly([L, B, [B[0], B[1] + slab], [L[0], L[1] + slab]], night ? '#4a3c2c' : '#b89a72');
    g.poly([B, R, [R[0], R[1] + slab], [B[0], B[1] + slab]], night ? '#3b2f22' : '#9f835d');
    g.poly([[L[0], L[1] + slab * .28], [B[0], B[1] + slab * .28], B, L], night ? '#2f4a36' : '#86b26c');
    g.poly([[B[0], B[1] + slab * .28], [R[0], R[1] + slab * .28], R, B], night ? '#283f2e' : '#78a35f');
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        const alt = (x + y) % 2 === 0;
        g.tile(x, y, 0, night ? (alt ? '#2d4a3a' : '#2a4536') : (alt ? '#acd292' : '#a5cc8b'), night ? 'rgba(0,0,0,.12)' : 'rgba(40,70,30,.06)', 1);
      }
    }
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
      ctx.save();
      try {
        if (ghost) ctx.globalAlpha = .62;
        const start = clean ? null : pops.get(t.id);
        if (start != null) {
          const k = clamp((now - start) / 360, 0, 1);
          if (k >= 1) pops.delete(t.id); else animating = true;
          const s = easeOutBack(k);
          const [cx, cy] = g.P(t.x + .5, t.y + .5);
          ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
        }
        DRAW[t.item](g, t.x, t.y, t);
        drawGrowth(g, t.item, t.x, t.y);
      } catch (e) { /* un bâtiment illisible ne bloque pas le reste de la ville */ }
      ctx.restore();
    }
    if (!clean && keyboard && document.activeElement === canvas) {
      g.tile(cursor.x, cursor.y, 0, null, night ? '#ffffff' : '#1d2721', 2.5);
    }
    if (animating) raf = requestAnimationFrame(draw);
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
    const g = makePainter(c, tw, size / 2, size - 3 - tw / 2, pal);
    g.tile(0, 0, 0, pal.night ? '#2d4a3a' : '#acd292');
    try { DRAW[key](g, 0, 0, { stage: opts.stage || 4 }); drawGrowth(g, key, 0, 0); } catch (e) { /* vignette vide */ }
  }
  function pop(id) { if (!reducedMotion()) pops.set(id, performance.now()); }
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

  return { layout, draw, relayout, thumb, pop, tileOf, snapshot, focus: () => { keyboard = true; canvas.focus(); draw(); } };
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
      this.state = null;
      City.pop(tile.id);
      commit();
      bump();
      toast(t('city.built', name));
    } else {
      const tile = S.city.tiles.find(t => t.id === st.tileId);
      if (!tile) { this.cancel(); return; }
      if (!this.isFree(st.target, tile.id)) { toast(t('city.taken')); st.target = null; this.render(); City.draw(); return; }
      this.state = null;
      tile.x = st.target.x;
      tile.y = st.target.y;
      City.pop(tile.id);
      commit();
      toast(t('city.moved'));
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

