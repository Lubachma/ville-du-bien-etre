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
// Ciel « selon l'heure » posé sur la carte de la ville et sur la vue en grand ; « selon l'apparence », celui du thème.
function applySky(amb, byTime) {
  const skies = [$('#sky'), $('#cityBig')].filter(Boolean), c = byTime ? skyColors(amb) : null;
  for (const sky of skies) {
    if (!c) { for (const name of ['--sky-top', '--sky-bottom', '--star-opacity']) sky.style.removeProperty(name); continue; }
    sky.style.setProperty('--sky-top', c.top);
    sky.style.setProperty('--sky-bottom', c.bottom);
    sky.style.setProperty('--star-opacity', c.stars.toFixed(2));
  }
}

const City = (() => {
  // Un seul canevas dessiné à la fois : la carte de la ville, ou la vue en grand tant qu'elle est ouverte.
  const small = $('#city'), bigCanvas = $('#cityBigCanvas');
  let canvas = small, ctx = small.getContext('2d');
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
    return S.settings.ambient !== false && !reducedMotion() && document.visibilityState === 'visible'
      && $('#sheet').hidden && $('#session').hidden && (big.open || (currentTab === 'ville' && onScreen));
  }
  // Prochaine image : pleine vitesse pendant un effet de pose, cadence douce pour l'ambiance, sinon rien.
  function schedule(effects) {
    if (effects) { raf = requestAnimationFrame(draw); return; }
    if (ambientRunning()) ambientTimer = setTimeout(() => { ambientTimer = 0; raf = requestAnimationFrame(draw); }, AMBIENT_MS);
  }
  // Relance la ville (retour sur l'onglet, fenêtre fermée, réglage changé…) : une image, puis la bonne cadence.
  function wake() { if (!raf && !ambientTimer) draw(); }
  // Promeneurs : chacun suit, aller et retour, un petit chemin de 12 pas sur les cases où l'on marche, tiré une fois
  // pour toutes de son indice ; un pas toutes les 4 s (2,5 s de marche, puis une pause).
  const WALK_STEPS = 12, STEP_S = 4, MOVE_S = 2.5, WALKER_COLORS = ['#d9573b', '#3f78c4', '#e3a12f', '#3a9a7a', '#d0628f', '#7a8b6e'];
  let walkCache = { key: '', paths: [] }, lastPeople = { walkers: 0, doers: [] }, visitorBox = null, wishBox = null, companionBox = null, lastCompanion = null;
  // Boutons posés sur le canevas, en points du canevas : « Construire » et la vue en grand, ou les boutons de la vue en grand.
  function overlayBoxes() {
    const box = canvas.getBoundingClientRect(), els = canvas === small ? [$('#buildBtn'), $('#cityExpand'), $('#companionBtn')] : [$('.city-big-tools')];
    return els.filter(el => el && el.getClientRects().length).map(el => {
      const r = el.getBoundingClientRect();
      return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
    });
  }
  // Centre de la bulle (rayon r) : à sa place si aucun bouton ne la cache ; sinon glissée de côté, au plus près, hors des
  // boutons ; sinon juste sous eux. Toujours entière dans le canevas.
  function bubbleSpot(x, y, r) {
    const m = 4, zones = overlayBoxes();
    const under = (px, py) => zones.find(z => px + r > z.x - m && px - r < z.x + z.w + m && py + r > z.y - m && py - r < z.y + z.h + m);
    x = clamp(x, r + m, W - r - m);
    y = Math.max(y, r + m);
    const z = under(x, y);
    if (!z) return [x, y];
    const sides = [z.x - m - r, z.x + z.w + m + r].filter(px => px >= r + m && px <= W - r - m && !under(px, y));
    if (sides.length) return [sides.sort((a, b) => Math.abs(a - x) - Math.abs(b - x))[0], y];
    return [x, z.y + z.h + m + r];
  }
  // Souhait d'habitant : une bulle blanche au-dessus du bâtiment, le décor souhaité dessiné en petit dedans. Sa zone (wishBox)
  // ouvre la fiche du bâtiment, comme la case du visiteur.
  function drawWishBubble(g, pal) {
    const tile = typeof townWishTile === 'function' ? townWishTile() : null, item = tile && S.townWish.item;
    if (!tile || !isItem(item)) return;
    const r = Math.max(13, g.tw * .32), [ax, ay] = g.P(tile.x + .5, tile.y + .5, g.tw * ((ITEMS[tile.item].hf || .5) + .28));
    const [bx, cy] = bubbleSpot(ax, ay - r * 1.25, r), ctx = g.ctx;
    ctx.beginPath();
    ctx.arc(bx, cy, r, 0, Math.PI * 2);
    // La pointe vers le bâtiment, quand il est sous la bulle ; tracée dans le même sens que le rond, pour qu'ils se remplissent ensemble.
    if (ay > cy + r) { ctx.moveTo(bx + r * .32, cy + r * .9); ctx.lineTo(ax, ay); ctx.lineTo(bx - r * .32, cy + r * .9); }
    ctx.fillStyle = g.night ? 'rgba(236,242,236,.92)' : 'rgba(255,255,255,.95)';
    ctx.strokeStyle = 'rgba(30,50,40,.25)'; ctx.lineWidth = 1;
    ctx.fill(); ctx.stroke();
    // Le décor, en couleurs de jour, centré sur le milieu de son dessin (du sol de sa case jusqu'à son sommet).
    const tw = r * 1.6, mini = makePainter(ctx, tw, bx, cy - tw / 4 + tw * (ITEMS[item].hf || .3) / 2, { ...pal, night: false, dark: 0 });
    DRAW[item](mini, 0, 0, {});
    wishBox = { x: bx - r, y: cy - r, w: r * 2, h: Math.max(r * 2, ay - (cy - r)), tile: tile.id };
  }
  // Compagnon : le jour, sur son chemin de promenade à demi-vitesse ; la nuit, endormi à côté de la première Cabane posée (une case
  // voisine où marcher, sinon sa propre case), ou sans Cabane près du centre. Pour qu'aucun élément ne le cache, la case choisie a
  // d'abord le moins d'éléments sur les trois cases devant elle, puis est la plus en avant (ou la plus proche du centre). Rien sans
  // compagnon affiché ni case où marcher.
  function companionSpot(cells, night, t) {
    if (!S.companion || S.settings.companionShown === false || !cells.length) return null;
    if (!night) { const p = walkerPos(walkPaths(cells)[5], 5, t / 2); return { x: p.x, y: p.y, pose: 'walk' }; }
    const hut = S.city.tiles.find(tile => tile.item === 'cabane'), centre = (N - 1) / 2;
    const hidden = cell => S.city.tiles.filter(tile => tile.x - cell.x >= 0 && tile.x - cell.x <= 1 && tile.y - cell.y >= 0 && tile.y - cell.y <= 1 && (tile.x !== cell.x || tile.y !== cell.y)).length;
    const rank = hut ? cell => -(cell.x + cell.y) : cell => Math.abs(cell.x - centre) + Math.abs(cell.y - centre);
    const pool = hut ? cells.filter(other => Math.abs(other.x - hut.x) <= 1 && Math.abs(other.y - hut.y) <= 1) : cells;
    const cell = [...pool].sort((a, b) => hidden(a) - hidden(b) || rank(a) - rank(b))[0] || hut;
    return { x: cell.x + .5, y: cell.y + .5, pose: 'sleep' };
  }
  // Le compagnon, un peu plus grand que les habitants, et sa zone touchable (au moins 32 points de côté).
  function drawCompanionAt(g, spot, time) {
    const c = S.companion, [sx, sy] = g.P(spot.x, spot.y), u = g.tw * .22 * 1.35, w = Math.max(32, u * 1.1), hgt = Math.max(32, u * 1.3);
    drawCompanion(g, sx, sy, { species: c.species, wear: c.wear, pose: spot.pose, scale: 1.35 }, time);
    companionBox = { x: sx - w / 2, y: sy - hgt + u * .1, w, h: hgt };
    lastCompanion = { pose: spot.pose, x: Math.floor(spot.x), y: Math.floor(spot.y) };
  }
  // Point sous le visiteur : sol, assise du banc, branche, toit, eau, ou ciel (qui dérive doucement).
  function visitorAnchor(g, spot, t) {
    if (spot.sky) return [W * .26 + Math.sin(t * .05) * W * .04, H * .36];
    if (!spot.on) return g.P(spot.x + .5, spot.y + .5);
    const hf = (ITEMS[spot.on] || { hf: .3 }).hf;
    const z = spot.on === 'banc' ? .12 : spot.on === 'etang' ? .02 : ['arbre', 'cerisier', 'grandarbre'].includes(spot.on) ? hf * .72 : hf * .85;
    return g.P(spot.x + .5, spot.y + .5, g.tw * z);
  }
  // Le visiteur, sa zone touchable et, tant qu'on ne l'a pas salué aujourd'hui, une étoile qui scintille au-dessus.
  function drawVisitor(g, amb, t) {
    const v = amb.visitor, [sx, sy] = visitorAnchor(g, v.spot, t), sky = !!v.spot.sky, tw = g.tw;
    VISITOR_DRAW[v.id](g, sx, sy, { season: amb.season }, t);
    visitorBox = sky ? { x: sx - tw * .3, y: sy - tw * .68, w: tw * .6, h: tw * .72 } : { x: sx - tw * .3, y: sy - tw * .5, w: tw * .6, h: tw * .6 };
    const met = S.visits && S.visits[v.id] && S.visits[v.id].last === amb.day;
    if (!met) star(g, sx + tw * .12, sy - tw * (sky ? .7 : .38), tw * .045 * (.7 + .3 * Math.sin(t * 3)));
  }
  function walkPaths(cells) {
    const key = cells.map(c => c.x + ',' + c.y).join(';');
    if (walkCache.key === key) return walkCache.paths;
    const open = new Set(cells.map(c => c.x + ',' + c.y)), paths = [];
    for (let i = 0; i < 6; i++) {
      let cur = cells[Math.floor(rnd(i, 1) * cells.length)], prev = null;
      const path = [cur];
      for (let s = 1; s <= WALK_STEPS; s++) {
        const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: cur.x + dx, y: cur.y + dy }))
          .filter(c => open.has(c.x + ',' + c.y) && !(prev && c.x === prev.x && c.y === prev.y));
        const step = next.length ? next[Math.floor(rnd(i * 31 + s, 7) * next.length)] : prev || cur;
        prev = cur; cur = step; path.push(cur);
      }
      paths.push(path);
    }
    walkCache = { key, paths };
    return paths;
  }
  // Position (en cases) du promeneur i au temps t : aller puis retour sur son chemin, pas à pas.
  function walkerPos(path, i, t) {
    const L = path.length - 1, time = t + rnd(i, 3) * STEP_S, k = Math.floor(time / STEP_S) % (2 * L);
    const [from, to] = k < L ? [path[k], path[k + 1]] : [path[2 * L - k], path[2 * L - k - 1]];
    const u = Math.min(1, (time % STEP_S) / MOVE_S), e = u * u * (3 - 2 * u);
    return { x: from.x + (to.x - from.x) * e + .5 + (rnd(i, 5) - .5) * .3, y: from.y + (to.y - from.y) * e + .5 + (rnd(i, 6) - .5) * .3 };
  }
  // Habitant d'un domaine pratiqué aujourd'hui : une case libre voisine d'un bâtiment de ce domaine, sinon une case où marcher.
  function doerCells(cells) {
    return todayDomains().map((cat, i) => {
      const near = cells.filter(c => S.city.tiles.some(t => ITEMS[t.item].group === cat && Math.abs(t.x - c.x) <= 1 && Math.abs(t.y - c.y) <= 1));
      const pool = near.length ? near : cells;
      return pool.length ? { cat, cell: pool[Math.floor(rnd(i, 13) * pool.length)] } : null;
    }).filter(Boolean);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { onScreen = entries[entries.length - 1].isIntersecting; if (onScreen) wake(); }).observe(small);
  }

  // Ville en grand : zoom voulu (1 à 3) et zoom montré pendant la transition, décalage du glissement, doigts posés.
  const big = { open: false, zoom: 1, shown: 1, pan: [0, 0], base: null, anim: null, pointers: new Map(), moved: 0, lastTap: null };
  // Visite : la ville d'un ami (ou la sienne, telle que les amis la voient), montrée en grand et en lecture seule. Seul le dessin
  // la lit ; sa propre ville n'est jamais touchée.
  let visit = null;
  const town = () => (visit ? visit.city : S.city);
  function layout() {
    N = town().size;
    if (big.open) { layoutBig(); return; }
    const rect = canvas.getBoundingClientRect();
    W = Math.max(240, rect.width || canvas.parentElement.clientWidth || 360);
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
  // Vue en grand : au zoom 1, l'île entière tient sous la barre de boutons ; le zoom l'agrandit autour du centre de l'écran.
  function layoutBig() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(240, rect.width || innerWidth);
    H = Math.max(240, rect.height || innerHeight);
    dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    // En visite, l'île tient entre le nom de la ville et les boutons du bas.
    const top = visit ? Math.max(64, $('#cityVisitHead').getBoundingClientRect().bottom - rect.top + 8) : 64;
    const bottom = visit ? Math.max(16, rect.bottom - $('#cityVisitBar').getBoundingClientRect().top + 8) : 16;
    const room = H - top - bottom, tw = Math.min((W - 28) / N, room / (N / 2 + 1.8));
    big.base = { tw, ox: W / 2, oy: top + (room - tw * (N / 2 + 1.8)) / 2 + tw * 1.35 };
    big.pan = keepInView(big.pan, big.shown);
    applyView();
  }
  function applyView() {
    const b = big.base, z = big.shown;
    TW = b.tw * z;
    ox = W / 2 + (b.ox - W / 2) * z + big.pan[0];
    oy = H / 2 + (b.oy - H / 2) * z + big.pan[1];
  }
  // Point de la ville (en cases, non arrondi) sous un point de l'écran, pour un zoom et un décalage donnés.
  function cellUnder(px, py, z, pan) {
    const b = big.base, tw = b.tw * z, x0 = W / 2 + (b.ox - W / 2) * z + pan[0], y0 = H / 2 + (b.oy - H / 2) * z + pan[1];
    const a = (px - x0) / (tw / 2), c = (py - y0) / (tw / 4);
    return [(a + c) / 2, (c - a) / 2];
  }
  // Le centre de l'écran reste sur l'île : on ne perd jamais la ville de vue.
  function keepInView(pan, z) {
    const [x, y] = cellUnder(W / 2, H / 2, z, pan), cx = clamp(x, 0, N), cy = clamp(y, 0, N), tw = big.base.tw * z;
    return [pan[0] - ((cx - cy) - (x - y)) * tw / 2, pan[1] - ((cx + cy) - (x + y)) * tw / 4];
  }
  // Zoom vers z autour d'un point de l'écran, qui reste sous le doigt ; en douceur avec les boutons, sauf animations réduites.
  function zoomAt(z, px, py, smooth) {
    const to = clamp(z, 1, 3), k = to / big.shown;
    const pan = keepInView([px - W / 2 - (px - W / 2 - big.pan[0]) * k, py - H / 2 - (py - H / 2 - big.pan[1]) * k], to);
    big.zoom = to;
    $('#cityBigIn').setAttribute('aria-disabled', String(to >= 3));
    $('#cityBigOut').setAttribute('aria-disabled', String(to <= 1));
    if (smooth && !reducedMotion()) big.anim = { start: performance.now(), from: { z: big.shown, pan: big.pan }, to: { z: to, pan } };
    else { big.anim = null; big.shown = to; big.pan = pan; applyView(); }
    draw();
  }
  function panBy(dx, dy) {
    // Pendant un zoom en douceur, le glissement s'ajoute aux deux bouts de la transition, qui sinon l'écraserait.
    const a = big.anim;
    if (a) { a.from.pan = [a.from.pan[0] + dx, a.from.pan[1] + dy]; a.to.pan = keepInView([a.to.pan[0] + dx, a.to.pan[1] + dy], a.to.z); }
    big.pan = keepInView([big.pan[0] + dx, big.pan[1] + dy], big.shown);
    applyView();
    if (!raf) { clearTimeout(ambientTimer); ambientTimer = 0; raf = requestAnimationFrame(draw); }
  }
  function openBig() {
    if (big.open || Mode.state) return;
    big.open = true;
    big.zoom = big.shown = 1; big.pan = [0, 0]; big.anim = null; big.pointers.clear();
    $('#cityBig').hidden = false;
    renderCityCaption();
    canvas = bigCanvas; ctx = canvas.getContext('2d');
    layout();
    $('#cityBigIn').setAttribute('aria-disabled', 'false');
    $('#cityBigOut').setAttribute('aria-disabled', 'true');
    updateInert();
    // Le geste retour du téléphone ferme la vue sans quitter l'app.
    try { history.pushState({ cityBig: true }, ''); } catch (e) { /* historique indisponible */ }
    draw();
    $('#cityBigClose').focus({ preventScroll: true });
  }
  // Fermer revient en arrière dans l'historique ; popstate referme alors la vue pour de bon.
  function closeBig(fromHistory) {
    if (!big.open) return;
    if (!fromHistory && history.state && history.state.cityBig) { history.back(); return; }
    // La fiche du visiteur ouverte par-dessus se ferme avec la vue : le geste retour ferme tout.
    if (!$('#sheet').hidden) closeSheet();
    big.open = false; big.anim = null; big.pointers.clear();
    if (visit) {
      visit = null;
      $('#cityVisitHead').hidden = $('#cityVisitBar').hidden = true;
      $('#cityBigTitle').textContent = frTypo(t('city.bigTitle'));
    }
    $('#cityBig').hidden = true;
    canvas = small; ctx = small.getContext('2d');
    updateInert();
    layout(); draw();
    $('#cityExpand').focus({ preventScroll: true });
  }
  // Visite : la ville d'un code s'ouvre en grand, avec son nom, son nombre d'éléments et la taille de son terrain. Si la vue
  // est déjà ouverte, la ville change sans nouvelle entrée d'historique. Pas pendant une pose.
  function openVisit(snapshot, { own = false } = {}) {
    if (Mode.state) return false;
    visit = { city: snapshot, own };
    const name = own ? cityName() : snapshot.name || t('visit.friendCity'), meta = t('visit.cityMeta', { n: snapshot.tiles.length, size: snapshot.size });
    $('#cityVisitHead').replaceChildren(h('p', { class: 'visit-name' }, name), h('p', { class: 'visit-meta' }, meta), ...(own ? [h('p', { class: 'visit-meta' }, t('visit.ownCity'))] : []));
    $('#cityVisitHead').hidden = $('#cityVisitBar').hidden = false;
    $('#visitKeep').hidden = own;
    $('#cityBigTitle').textContent = frTypo(own ? t('visit.ownCity') : name);
    if (big.open) { big.zoom = big.shown = 1; big.pan = [0, 0]; big.anim = null; layout(); draw(); }
    else openBig();
    $('#cityBigCanvas').setAttribute('aria-label', frTypo(name + ' · ' + meta));
    return true;
  }
  // Un toucher sur la bulle du souhait ouvre la fiche du bâtiment qui souhaite.
  // Toucher le compagnon ouvre sa fiche.
  function openCompanionAt(px, py) {
    const cb = companionBox;
    if (!cb || px < cb.x || px > cb.x + cb.w || py < cb.y || py > cb.y + cb.h || typeof openCompanionSheet !== 'function') return false;
    openCompanionSheet();
    return true;
  }
  function openWishAt(px, py) {
    const wb = wishBox, tile = wb && px >= wb.x && px <= wb.x + wb.w && py >= wb.y && py <= wb.y + wb.h && S.city.tiles.find(other => other.id === wb.tile);
    if (!tile) return false;
    openBuildingSheet(tile);
    return true;
  }
  window.addEventListener('popstate', () => { if (big.open) closeBig(true); });
  window.addEventListener('resize', () => { if (big.open) { layout(); draw(); } });
  $('#cityExpand').addEventListener('click', openBig);
  $('#cityBigClose').addEventListener('click', () => closeBig());
  $('#cityBigIn').addEventListener('click', () => zoomAt(big.zoom * 1.5, W / 2, H / 2, true));
  $('#cityBigOut').addEventListener('click', () => zoomAt(big.zoom / 1.5, W / 2, H / 2, true));
  // Molette : Firefox compte en lignes (deltaMode 1), parfois en pages (2) ; ramené en pixels.
  bigCanvas.addEventListener('wheel', e => {
    e.preventDefault();
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1);
    zoomAt(big.zoom * Math.exp(-dy * .0015), ...point(e), false);
  }, { passive: false });
  // Au clavier, dans la vue en grand : les flèches déplacent la vue, + et − zooment.
  $('#cityBig').addEventListener('keydown', e => {
    const step = 48, moves = { ArrowUp: [0, step], ArrowDown: [0, -step], ArrowLeft: [step, 0], ArrowRight: [-step, 0] };
    if (moves[e.key]) { e.preventDefault(); panBy(...moves[e.key]); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(big.zoom * 1.5, W / 2, H / 2, true); }
    else if (e.key === '-' || e.key === '−') { e.preventDefault(); zoomAt(big.zoom / 1.5, W / 2, H / 2, true); }
  });
  // Un doigt glisse, deux doigts pincent ; un toucher bref ouvre le visiteur, deux touchers rapprochés zooment sur ce point.
  bigCanvas.addEventListener('pointerdown', e => {
    bigCanvas.setPointerCapture(e.pointerId);
    big.pointers.set(e.pointerId, point(e));
    if (big.pointers.size === 1) big.moved = 0;
  });
  bigCanvas.addEventListener('pointermove', e => {
    const last = big.pointers.get(e.pointerId);
    if (!last) return;
    const now = point(e);
    if (big.pointers.size === 1) { big.moved += Math.hypot(now[0] - last[0], now[1] - last[1]); panBy(now[0] - last[0], now[1] - last[1]); }
    else {
      // Deux doigts : l'écart zoome autour de leur milieu, le milieu qui bouge fait glisser la vue.
      const other = [...big.pointers].find(([id]) => id !== e.pointerId)[1];
      const before = Math.hypot(last[0] - other[0], last[1] - other[1]), after = Math.hypot(now[0] - other[0], now[1] - other[1]);
      const mid = [(now[0] + other[0]) / 2, (now[1] + other[1]) / 2];
      big.moved = Infinity;
      if (before > 4) zoomAt(big.zoom * after / before, ...mid, false);
      panBy(mid[0] - (last[0] + other[0]) / 2, mid[1] - (last[1] + other[1]) / 2);
    }
    big.pointers.set(e.pointerId, now);
  });
  const lift = e => {
    const at = big.pointers.get(e.pointerId);
    big.pointers.delete(e.pointerId);
    if (!at || e.type === 'pointercancel' || big.pointers.size || big.moved > 8) return;
    const vb = visitorBox;
    if (vb && at[0] >= vb.x && at[0] <= vb.x + vb.w && at[1] >= vb.y && at[1] <= vb.y + vb.h) { big.lastTap = null; openVisitor(); return; }
    if (openCompanionAt(at[0], at[1])) { big.lastTap = null; return; }
    if (openWishAt(at[0], at[1])) { big.lastTap = null; return; }
    const prev = big.lastTap, time = performance.now();
    big.lastTap = { at, time };
    if (prev && time - prev.time < 320 && Math.hypot(at[0] - prev.at[0], at[1] - prev.at[1]) < 30) {
      big.lastTap = null;
      zoomAt(big.zoom >= 3 ? 1 : big.zoom * 1.5, ...at, true);
    }
  };
  bigCanvas.addEventListener('pointerup', lift);
  bigCanvas.addEventListener('pointercancel', lift);
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

  // Ambiance du moment, et couches de vie dessinées à part : une donnée ou un dessin illisible (visiteur inconnu…) est sauté,
  // la ville continue de se dessiner et de vivre.
  function ambientSafe() { try { return typeof ambientAt === 'function' ? ambientAt() : null; } catch (e) { return null; } }
  // En visite, la ville amie est sous son propre ciel (heure, saison, météo d'ici), sans le visiteur du jour ni l'anniversaire
  // de sa propre ville.
  function visitAmbient(amb) { return amb && visit ? { ...amb, visitor: null, festivals: amb.festivals.filter(f => f.id !== 'anniversaire') } : amb; }
  function layer(fn) { ctx.save(); try { fn(); } catch (e) { /* couche ignorée */ } ctx.restore(); }

  function draw(options) {
    const clean = options && options.clean === true;
    cancelAnimationFrame(raf);
    clearTimeout(ambientTimer);
    raf = 0; ambientTimer = 0;
    if (!W) layout();
    // Vue en grand : la transition du zoom avance d'une image.
    let zooming = false;
    if (big.open && big.anim) {
      const a = big.anim, k = clamp((performance.now() - a.start) / 200, 0, 1), e = k * k * (3 - 2 * k);
      big.shown = a.from.z + (a.to.z - a.from.z) * e;
      big.pan = [a.from.pan[0] + (a.to.pan[0] - a.from.pan[0]) * e, a.from.pan[1] + (a.to.pan[1] - a.from.pan[1]) * e];
      applyView();
      if (k >= 1) big.anim = null; else zooming = true;
    }
    // Ambiance du moment : saison toujours ; obscurité, ciel et teinte selon l'heure, sauf « ciel selon l'apparence ».
    const pal = readPalette(), amb = visitAmbient(ambientSafe()), byTime = !!amb && S.settings.sky !== 'theme', city = town();
    if (amb) { pal.season = amb.season; if (byTime) pal.dark = darkness(amb.moment); }
    pal.time = performance.now() / 1000;
    pal.anim = !clean && ambientRunning();
    if (amb) pal.clock = amb.minutes;
    applySky(amb, byTime);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const g = makePainter(ctx, TW, ox, oy, pal);
    const night = g.night;

    // L'arc-en-ciel se dessine d'abord : il reste derrière l'île et ses éléments.
    if (amb && amb.rainbow) layer(() => drawRainbow(g, { w: W, h: H, ground: oy }));
    drawIsland(g, city, amb ? amb.season : 'spring');
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
    if (!clean && Selection.id && !visit) {
      const sel = S.city.tiles.find(t => t.id === Selection.id);
      if (sel) g.tile(sel.x, sel.y, 0, hexA(pal.accent, .22), pal.accent, 2);
    }
    const list = city.tiles.map(t => ({ t, ghost: false }));
    if (!clean && Mode.state && Mode.state.target) {
      const moving = Mode.state.type === 'move' ? S.city.tiles.find(t => t.id === Mode.state.tileId) || {} : null;
      const key = moving ? moving.item : Mode.state.item;
      // Une merveille qu'on pose apparaît en chantier ; déplacée, elle garde son étape.
      if (key) list.push({ t: { id: '__ghost', item: key, x: Mode.state.target.x, y: Mode.state.target.y, stage: moving ? moving.stage : 1 }, ghost: true });
    }
    const hiddenId = !clean && Mode.state && Mode.state.type === 'move' && Mode.state.target ? Mode.state.tileId : null;
    // Habitants, rangés en profondeur avec les éléments : promeneurs, puis ceux qui font comme toi. Personne en visite.
    if (amb && !visit) {
      const cells = walkableTiles(), n = walkerCount(amb.moment), paths = n ? walkPaths(cells) : [], tt = g.anim ? pal.time : 0;
      const people = Array.from({ length: n }, (_, i) => ({ walker: i, pos: walkerPos(paths[i], i, tt) }));
      for (const d of cells.length ? doerCells(cells) : []) people.push({ doer: d.cat, cell: d.cell, pos: { x: d.cell.x + .5, y: d.cell.y + .5 } });
      lastPeople = { walkers: n, doers: people.filter(p => p.doer).map(p => p.doer) };
      // Profondeur d'un habitant : celle de la case sous ses pieds. Les éléments occupent des cases entières, donc cet ordre reste
      // juste partout où les dessins se chevauchent, même en pleine marche d'une case à l'autre.
      for (const p of people) list.push({ t: { id: '__person', x: Math.floor(p.pos.x) + .25, y: Math.floor(p.pos.y) + .25 }, person: p });
      // Visiteur sur une case : juste après l'élément qu'il occupe, sinon au milieu de sa case.
      const sp = amb.visitor && amb.visitor.spot;
      if (sp && !sp.sky) list.push({ t: { id: '__visitor', x: sp.x + (sp.on ? .05 : .3), y: sp.y + (sp.on ? .05 : .3) }, visitor: true });
      const pet = companionSpot(cells, g.night, tt);
      if (pet) list.push({ t: { id: '__companion', x: Math.floor(pet.x) + .25, y: Math.floor(pet.y) + .25 }, companion: pet });
    }
    list.sort((p, q) => (p.t.x + p.t.y) - (q.t.x + q.t.y) || p.t.x - q.t.x);
    const now = performance.now();
    let animating = false;
    visitorBox = null; companionBox = null; lastCompanion = null;
    for (const { t, ghost, person, visitor, companion } of list) {
      if (visitor) { layer(() => drawVisitor(g, amb, g.anim ? pal.time : 0)); continue; }
      if (companion) { layer(() => drawCompanionAt(g, companion, g.anim ? pal.time : 0)); continue; }
      if (person) {
        layer(() => {
          if (person.doer) { drawDoer(g, person.cell.x, person.cell.y, person.doer, g.anim ? pal.time : 0); return; }
          const [sx, sy] = g.P(person.pos.x, person.pos.y);
          drawWalker(g, sx, sy, { color: WALKER_COLORS[person.walker % WALKER_COLORS.length], lantern: g.night, umbrella: amb.weather === 'rain', hat: amb.season === 'winter' });
        });
        continue;
      }
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
        drawGrowth(g, t.item, t.x, t.y, visit ? t.level : buildingLevel(t.item));
      } catch (e) { /* un bâtiment illisible ne bloque pas le reste de la ville */ }
      ctx.restore();
      if (fx && k < 1) overlay('front');
    }
    // Visiteur dans le ciel (la montgolfière), par-dessus la ville.
    if (amb && amb.visitor && amb.visitor.spot.sky) layer(() => drawVisitor(g, amb, g.anim ? pal.time : 0));
    // Couche de vie : fumée des cheminées (automne, hiver, matin de la boulangerie), faisceau du phare inauguré la nuit.
    if (amb) {
      const t = g.anim ? pal.time : 0, smoky = amb.season === 'autumn' || amb.season === 'winter';
      layer(() => {
        for (const tile of city.tiles) {
          if (CHIMNEYS[tile.item] && (smoky || (tile.item === 'boulangerie' && amb.minutes < 600))) drawSmoke(g, tile.x, tile.y, t, CHIMNEYS[tile.item]);
          if (tile.item === 'phare' && (tile.stage || 4) >= 4 && g.dark > .5) drawBeam(g, tile.x, tile.y, t);
        }
      });
    }
    // Fêtes du jour : une guirlande de fanions pour toutes, puis le décor de chacune. Les cases libres des bords avant
    // (hors celle du visiteur) reçoivent citrouilles ou lanternes, sauf pendant une pose où elles doivent rester lisibles.
    if (amb && amb.festivals.length) {
      const t = g.anim ? pal.time : 0, sp = amb.visitor && amb.visitor.spot;
      const spots = !clean && Mode.state ? [] : freeCells(city).filter(c => (c.x === N - 1 || c.y === N - 1) && !(sp && sp.x === c.x && sp.y === c.y));
      layer(() => drawBunting(g, N, [...new Set(amb.festivals.flatMap(f => FEST_COLORS[f.id]))], t));
      for (const fest of amb.festivals) layer(() => drawFestival(g, fest, amb, t, { w: W, h: H, ground: oy, size: N }, spots));
    }
    // Teinte du moment, posée seulement sur ce qui est dessiné (l'île et ses éléments).
    const tint = byTime ? lightTint(amb) : null;
    if (tint) { ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    // Petites vies et météo, par-dessus tout ; pluie et neige s'estompent pendant une pose.
    if (amb) {
      const area = { w: W, h: H, ground: oy }, t = g.anim ? pal.time : 0;
      layer(() => drawSeasonLife(g, amb, t, area, city.tiles));
      layer(() => drawWeather(g, { ...amb, rainbow: false }, t, area, !clean && Mode.state ? .25 : 1));
    }
    // Étincelles sur les cases d'un ensemble qu'on vient de découvrir.
    sparkles = clean ? sparkles : sparkles.filter(s => now - s.start < FX_TIME.sparkle);
    for (const s of clean ? [] : sparkles) {
      const q = (now - s.start) / FX_TIME.sparkle;
      animating = true;
      for (const tl of city.tiles.filter(tile => s.ids.includes(tile.id))) {
        for (let i = 0; i < 3; i++) {
          const [px, py] = g.P(tl.x + .25 + rnd(i, tl.x) * .5, tl.y + .25 + rnd(tl.y, i) * .5, g.tw * (.25 + rnd(i * 5, 7) * .5));
          star(g, px, py, g.tw * .06 * Math.sin(Math.PI * clamp(q * 1.4 - i * .15, 0, 1)));
        }
      }
    }
    // Bulle du souhait du jour, par-dessus tout (jamais en visite ni dans une image).
    wishBox = null;
    if (!clean && !visit) layer(() => drawWishBubble(g, pal));
    if (!clean && keyboard && document.activeElement === canvas) {
      g.tile(cursor.x, cursor.y, 0, null, night ? '#ffffff' : '#1d2721', 2.5);
    }
    frames++;
    schedule(animating || zooming);
  }

  // L'île d'une ville : son socle, son sol en damier, puis le pavage commun des ensembles formés (la vue et les vignettes).
  function drawIsland(g, city, season) {
    const n = city.size, night = g.night, slab = g.tw * .32;
    const L = g.P(0, n), B = g.P(n, n), R = g.P(n, 0);
    g.poly([L, B, [B[0], B[1] + slab], [L[0], L[1] + slab]], night ? '#4a3c2c' : '#b89a72');
    g.poly([B, R, [R[0], R[1] + slab], [B[0], B[1] + slab]], night ? '#3b2f22' : '#9f835d');
    g.poly([[L[0], L[1] + slab * .28], [B[0], B[1] + slab * .28], B, L], night ? '#2f4a36' : '#86b26c');
    g.poly([[B[0], B[1] + slab * .28], [R[0], R[1] + slab * .28], R, B], night ? '#283f2e' : '#78a35f');
    const ground = groundColors(season, g.dark);
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) g.tile(x, y, 0, ground[(x + y) % 2], night ? 'rgba(0,0,0,.12)' : 'rgba(40,70,30,.06)', 1);
    }
    const paved = pavedTileIds(city);
    for (const tl of city.tiles) if (paved.has(tl.id)) g.paving(tl.x, tl.y);
  }
  // Vignette d'une ville entière (cartes postales) : son île et ses éléments en profondeur, sans ambiance. La place au-dessus
  // de l'île laisse dépasser les éléments du fond.
  function townThumb(cv, city, size = 48) {
    const d = Math.min(3, window.devicePixelRatio || 1);
    cv.width = size * d; cv.height = size * d;
    const c = cv.getContext('2d');
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, size, size);
    const n = city.size, tw = (size - 4) / n, above = tw * 1.2;
    const g = makePainter(c, tw, size / 2, above + (size - above - n * tw / 2 - tw * .32) / 2, readPalette());
    drawIsland(g, city, 'spring');
    for (const tile of [...city.tiles].sort((p, q) => (p.x + p.y) - (q.x + q.y) || p.x - q.x)) {
      try { if (isItem(tile.item)) DRAW[tile.item](g, tile.x, tile.y, tile); } catch (e) { /* un élément illisible est sauté */ }
    }
  }
  // Practice adds planters, then a golden pennant to buildings in that domain. En visite, le niveau vient du lien.
  function drawGrowth(g, key, x, y, level) {
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
      try { DRAW[key](g, 0, 0, { stage: opts.stage || 4 }); drawGrowth(g, key, 0, 0, buildingLevel(key)); } catch (e) { /* vignette vide */ }
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
  // Vignette d'un visiteur, posé sur sa case (la montgolfière au-dessus) ; en silhouette pour un visiteur pas encore rencontré.
  function visitorThumb(cv, id, size = 64, opts = {}) {
    const d = Math.min(3, window.devicePixelRatio || 1);
    cv.width = size * d; cv.height = size * d;
    const c = cv.getContext('2d');
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, size, size);
    // Le sol sur une petite case, le visiteur dessiné plus grand pour qu'on le voie bien.
    const pal = readPalette(), sky = id === 'montgolfiere', floor = makePainter(c, size * .8, size / 2, size * .5, pal);
    const g = makePainter(c, size * (sky ? 1.25 : 1.7), size / 2, size * .5, pal), ground = () => floor.tile(0, 0, 0, pal.night ? '#2d4a3a' : '#acd292');
    const [sx, sy] = sky ? [size / 2, size * .97] : floor.P(.5, .5);
    if (!opts.silhouette) { ground(); VISITOR_DRAW[id](g, sx, sy, { season: 'summer' }, 0); return; }
    VISITOR_DRAW[id](g, sx, sy, { season: 'summer' }, 0);
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
  // Visiteur du jour posé sur cette case (pas celui du ciel), s'il y en a un.
  function visitorOn(x, y) {
    const amb = ambientSafe(), v = amb && amb.visitor;
    return v && !v.spot.sky && v.spot.x === x && v.spot.y === y ? v : null;
  }
  function describe(x, y) {
    const tile = tileOf(x, y);
    const params = { x: x + 1, y: y + 1, item: tile ? itemName(tile.item) : '' };
    if (Mode.state) {
      const free = !tile || (Mode.state.type === 'move' && tile.id === Mode.state.tileId);
      return free ? t('city.descFreePick', params) : t('city.descTaken', params);
    }
    // Le visiteur s'annonce sur sa case ; sur une case libre, Entrée le salue (sur un élément, Entrée ouvre l'élément).
    const v = visitorOn(x, y), who = v && { name: t('visitor.' + v.id + '.name'), n: (VISITORS.find(d => d.id === v.id) || {}).plural ? 2 : 1 };
    if (tile) return t('city.descBuilding', params) + (who ? ' ' + t('visit.here', who) + '.' : '');
    return t('city.descFree', params) + (who ? ' ' + t('city.descVisitor', who) : '');
  }

  small.addEventListener('pointermove', e => {
    if (!Mode.state || e.pointerType === 'touch') return;
    const t = tileAt(...point(e));
    if ((t && hover && t.x === hover.x && t.y === hover.y) || (!t && !hover)) return;
    hover = t; draw();
  });
  small.addEventListener('pointerleave', () => { if (hover) { hover = null; draw(); } });
  small.addEventListener('pointerdown', () => { keyboard = false; });
  small.addEventListener('click', e => {
    const [px, py] = point(e);
    if (Mode.state) { Mode.pickTile(tileAt(px, py)); return; }
    const vb = visitorBox;
    if (vb && px >= vb.x && px <= vb.x + vb.w && py >= vb.y && py <= vb.y + vb.h) { openVisitor(); return; }
    if (openCompanionAt(px, py)) return;
    if (openWishAt(px, py)) return;
    const b = pickBuilding(px, py);
    if (b) openBuildingSheet(b); else openBig();
  });
  small.addEventListener('focus', () => { if (keyboard) draw(); });
  small.addEventListener('blur', () => draw());
  small.addEventListener('keydown', e => {
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
        if (t) openBuildingSheet(t); else if (visitorOn(cursor.x, cursor.y)) openVisitor(); else announce(describe(cursor.x, cursor.y));
      }
    } else if (e.key === 'Escape' && Mode.state) {
      e.preventDefault();
      Mode.cancel();
    }
  });

  return { layout, draw, relayout, thumb, townThumb, effect, sparkle, effectCount, tileOf, snapshot, wake, frames: () => frames, walkers: () => lastPeople, visitorBox: () => visitorBox, wishBox: () => wishBox, companionBox: () => companionBox, companionSpot: () => lastCompanion, visitorThumb,
    focus: () => { keyboard = true; small.focus(); draw(); }, openBig, closeBig, openVisit,
    // Pour les tests : état de la vue en grand (et la case sous le centre de l'écran), centre d'une case sur le canevas dessiné.
    bigState: () => ({ open: big.open, zoom: big.zoom, visit: !!visit, focus: big.open && big.base ? cellUnder(W / 2, H / 2, big.shown, big.pan) : null }),
    cellPoint: (x, y) => [ox + (x - y) * TW / 2, oy + (x + y + 1) * TW / 4] };
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
      // Un ensemble, un succès, un défi, un souhait exaucé ou une étoile : le message de fête remplace celui de la pose.
      if (hasNews(fresh)) celebrate(fresh); else toast(t('city.built', name));
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
      if (hasNews(fresh)) celebrate(fresh); else toast(t('city.moved'));
    }
  },
  cancel() { this.state = null; this.render(); City.draw(); },
  render() {
    const bar = $('#placebar'), txt = $('#placeText'), ok = $('#placeConfirm');
    const st = this.state;
    bar.hidden = !st;
    $('#cityExpand').hidden = $('#shareCity').hidden = !!st;
    if (typeof renderCompanionButton === 'function') renderCompanionButton();
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

