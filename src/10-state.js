/* =========================================================================
   État, validation et fusion
   ========================================================================= */
function currentTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; }
}
function validTz(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch (e) { return false; }
}

function defaultState() {
  const now = Date.now();
  // Les exemples prennent les noms de la langue affichée ; displayName() les traduit tant qu'ils ne sont pas renommés.
  const ex = (key, cat, min) => ({ id: uid(), name: t(key), cat, min, mode: cat === 'corps' ? 'free' : 'focus', energy: key === 'tpl.wish.walk' || cat === 'calme' ? 'low' : 'medium', place: key === 'tpl.wish.walk' ? 'outside' : 'any', repeat: 'always', completedAt: 0, ex: true });
  return {
    v: 2, createdAt: now, updatedAt: 0, revision: '',
    coins: 5e6, earned: 0,
    settings: { grace: 10, keepAwake: true, sound: true, theme: 'auto', lang: 'auto', restDays: 2, weekStart: 'mon', hideStreak: false, soundType: 'chime', soundVolume: 'normal', vibrate: true },
    clock: { tz: currentTz(), maxSeen: now, lastDay: '' },
    activities: [
      { id: uid(), name: t('tpl.act.reading'), cat: 'esprit', min: 10 },
      { id: uid(), name: t('tpl.act.sport'), cat: 'corps', min: 20, mode: 'free', energy: 'high' },
      { id: uid(), name: t('tpl.act.meditation'), cat: 'calme', min: 10, energy: 'low' },
      { id: uid(), name: t('tpl.act.tidying'), cat: 'foyer', min: 15 },
      { id: uid(), name: t('tpl.act.music'), cat: 'crea', min: 20 },
      { id: uid(), name: t('tpl.act.homework'), cat: 'esprit', min: 25 },
      { id: uid(), name: t('tpl.act.walk'), cat: 'corps', min: 20, mode: 'free', place: 'outside', energy: 'low' },
      { id: uid(), name: t('tpl.act.drawing'), cat: 'crea', min: 15 },
    ],
    wishes: [
      ex('tpl.wish.chapter', 'esprit', 15), ex('tpl.wish.music', 'crea', 20),
      ex('tpl.wish.walk', 'corps', 20), ex('tpl.wish.meditate', 'calme', 10), ex('tpl.wish.draw', 'crea', 15),
    ],
    chores: [
      ex('tpl.chore.tidy', 'foyer', 15), ex('tpl.chore.dishes', 'foyer', 10),
      ex('tpl.chore.study', 'esprit', 30), ex('tpl.chore.mail', 'foyer', 15),
    ],
    draw: { pool: 'wishes', current: null, rerolls: 0, filters: { maxMin: 0, energy: 'any', place: 'any' } },
    goals: { minutes: 60, days: 3, cat: 'all', building: '' },
    personal: { name: '' }, routines: [], routineRun: null, pauses: [], achievements: {}, sets: {},
    city: {
      size: 7,
      tiles: [
        { id: uid(), item: 'maison', x: 3, y: 3, at: now, paid: 0 },
        { id: uid(), item: 'arbre', x: 2, y: 3, at: now, paid: 0 },
        { id: uid(), item: 'arbre', x: 3, y: 2, at: now, paid: 0 },
        { id: uid(), item: 'chemin', x: 4, y: 3, at: now, paid: 0 },
        { id: uid(), item: 'chemin', x: 5, y: 3, at: now, paid: 0 },
        { id: uid(), item: 'fleurs', x: 4, y: 4, at: now, paid: 0 },
      ],
    },
    stats: { byCat: { esprit: 0, corps: 0, calme: 0, foyer: 0, crea: 0 }, ok: 0, ko: 0, days: {}, dailyCats: {}, effort: { byCat: { esprit: 0, corps: 0, calme: 0, foyer: 0, crea: 0 }, days: {}, dailyCats: {} } },
    history: [],
    active: null,
  };
}

function cleanItem(x) {
  if (!x || typeof x !== 'object') return null;
  const name = str(x.name, 40);
  if (!name || !isCat(x.cat)) return null;
  const it = {
    id: idOf(x.id), name, cat: x.cat, min: int(x.min, 1, 180, 10),
    mode: x.mode === 'free' ? 'free' : 'focus',
    energy: ['low', 'medium', 'high'].includes(x.energy) ? x.energy : 'medium',
    place: ['inside', 'outside'].includes(x.place) ? x.place : 'any',
    repeat: ['once', 'daily', 'weekly'].includes(x.repeat) ? x.repeat : 'always',
    completedAt: validTs(x.completedAt) ? x.completedAt : 0,
  };
  if (x.ex === true) it.ex = true;
  return it;
}
function cleanList(arr) {
  const out = [], ids = new Set();
  for (const x of arr.slice(0, LIST_MAX)) {
    const c = cleanItem(x);
    if (!c) continue;
    if (ids.has(c.id)) c.id = uid();
    ids.add(c.id);
    out.push(c);
  }
  return out;
}
function cleanDraw(c) {
  const it = cleanItem(c);
  if (!it || (c.kind !== 'wishes' && c.kind !== 'chores')) return null;
  delete it.ex;
  it.kind = c.kind;
  it.bonus = int(c.bonus, 0, DRAW_BONUS[c.kind], 0);
  it.pool = int(c.pool, 0, LIST_MAX * 2, 0);
  return it;
}
function cleanHistory(e) {
  if (!e || typeof e !== 'object' || !validTs(e.at) || !isCat(e.cat)) return null;
  const out = {
    id: idOf(e.id), name: str(e.name, 60) || t('history.unnamed'), cat: e.cat,
    min: int(e.min, 1, 180, 1), ok: e.ok === true,
    reward: Math.round(num(e.reward, 0, COINS_MAX, 0)), at: e.at,
    source: ['direct', 'wishes', 'chores', 'routine'].includes(e.source) ? e.source : 'direct',
    mode: e.mode === 'free' ? 'free' : 'focus',
    elapsedSec: num(e.elapsedSec, 0, int(e.min, 1, 180, 1) * 60, e.ok === true ? int(e.min, 1, 180, 1) * 60 : null),
    routineRunId: str(e.routineRunId, 40), routineStep: int(e.routineStep, 0, 5, 0),
    returnPct: int(e.returnPct, 0, 50, 0),
  };
  if (!out.ok) {
    out.reward = 0;
    out.reason = ['away', 'closed', 'abandon'].includes(e.reason) ? e.reason : 'abandon';
    out.away = int(e.away, 0, 1e7, 0);
  }
  if (isDayKey(e.day)) out.day = e.day;
  return out;
}
function cleanActive(a) {
  if (!a || typeof a !== 'object') return null;
  const name = str(a.name, 60);
  if (!name || !isCat(a.cat) || !validTs(a.startedAt)) return null;
  return {
    id: idOf(a.id), name, cat: a.cat, min: int(a.min, 1, 180, 10),
    source: ['direct', 'wishes', 'chores', 'routine'].includes(a.source) ? a.source : 'direct',
    sourceId: str(a.sourceId, 40), mode: a.mode === 'free' ? 'free' : 'focus',
    owner: str(a.owner, 40), elapsedSec: num(a.elapsedSec, 0, int(a.min, 1, 180, 10) * 60, 0),
    checkpointAt: validTs(a.checkpointAt) ? a.checkpointAt : a.startedAt,
    deadline: a.mode === 'free' ? a.startedAt + int(a.min, 1, 180, 10) * 60000 : 0,
    routineRunId: str(a.routineRunId, 40), routineStep: int(a.routineStep, 0, 5, 0),
    drawPct: int(a.drawPct, 0, 50, 0),
    startedAt: a.startedAt,
    day: isDayKey(a.day) ? a.day : '',
    promised: Math.round(num(a.promised, 0, COINS_MAX, 0)),
    streakPct: int(a.streakPct, 0, 50, 0),
    streakDays: int(a.streakDays, 0, 1e5, 0),
    returnPct: int(a.returnPct, 0, 50, 0),
    dev: typeof a.dev === 'string' ? a.dev.slice(0, 40) : '',
    draw: cleanDraw(a.draw),
    drawRerolls: int(a.drawRerolls, 0, 10, 0),
  };
}

// Toute donnée venue de l'extérieur (stockage, compte, sauvegarde) passe par ici.
function normalize(raw) {
  const s = defaultState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return s;
  s.createdAt = validTs(raw.createdAt) ? raw.createdAt : s.createdAt;
  s.updatedAt = num(raw.updatedAt, 0, 9e15, 0);
  s.revision = str(raw.revision, 80);
  s.coins = Math.round(num(raw.coins, 0, COINS_MAX, s.coins));
  s.earned = Math.round(num(raw.earned, 0, COINS_MAX, 0));
  const st = obj(raw.settings);
  s.settings = {
    grace: GRACE_CHOICES.includes(st.grace) ? st.grace : 10, keepAwake: st.keepAwake !== false,
    sound: st.sound !== false, theme: THEMES.includes(st.theme) ? st.theme : 'auto',
    // Une ville d'avant la traduction reste en français ; une ville neuve suit le téléphone.
    lang: ['auto', ...langs()].includes(st.lang) ? st.lang : 'fr',
    // Série : 2 jours de repos par semaine, semaine du lundi, série visible.
    restDays: [0, 1, 2].includes(st.restDays) ? st.restDays : 2,
    weekStart: st.weekStart === 'sun' ? 'sun' : 'mon',
    hideStreak: st.hideStreak === true,
    soundType: SOUND_TYPES.includes(st.soundType) ? st.soundType : 'chime',
    soundVolume: own(SOUND_GAIN, st.soundVolume) ? st.soundVolume : 'normal',
    // Avant ce réglage, la vibration suivait le son : une ville au son coupé reste silencieuse.
    vibrate: typeof st.vibrate === 'boolean' ? st.vibrate : st.sound !== false,
  };
  s.pauses = Array.isArray(raw.pauses) ? raw.pauses
    .filter(p => p && typeof p === 'object' && isDayKey(p.from) && (p.to === '' || (isDayKey(p.to) && p.to >= p.from)))
    .slice(-20).map(p => ({ from: p.from, to: p.to })) : [];
  // Succès et ensembles obtenus : identifiants connus, dates valides.
  s.achievements = knownDates(raw.achievements, ACHIEVEMENTS);
  s.sets = knownDates(raw.sets, SETS);
  const ck = obj(raw.clock);
  s.clock = {
    tz: validTz(ck.tz) ? ck.tz : s.clock.tz,
    maxSeen: num(ck.maxSeen, 0, 9e15, 0),
    lastDay: isDayKey(ck.lastDay) ? ck.lastDay : '',
  };
  for (const k of ['activities', 'wishes', 'chores']) if (Array.isArray(raw[k])) s[k] = cleanList(raw[k]);
  const dr = obj(raw.draw);
  s.draw = { pool: ['wishes', 'chores', 'both'].includes(dr.pool) ? dr.pool : 'wishes', current: cleanDraw(dr.current), rerolls: int(dr.rerolls, 0, 10, 0), filters: {
    maxMin: int(obj(dr.filters).maxMin, 0, 180, 0),
    energy: ['low', 'medium', 'high'].includes(obj(dr.filters).energy) ? dr.filters.energy : 'any',
    place: ['inside', 'outside'].includes(obj(dr.filters).place) ? dr.filters.place : 'any',
  } };
  const goals = obj(raw.goals);
  s.goals = { minutes: int(goals.minutes, 5, 1260, 60), days: int(goals.days, 1, 7, 3), cat: isCat(goals.cat) ? goals.cat : 'all', building: isItem(goals.building) ? goals.building : '' };
  s.personal = { name: str(obj(raw.personal).name, 40) };
  if (Array.isArray(raw.routines)) {
    const ids = new Set();
    s.routines = raw.routines.slice(0, 20).filter(r => r && typeof r === 'object' && str(r.name, 40) && Array.isArray(r.activityIds)).map(r => ({ id: idOf(r.id), name: str(r.name, 40), activityIds: r.activityIds.filter(id => typeof id === 'string' && /^[\w-]{1,40}$/.test(id)).slice(0, 6) })).filter(r => !ids.has(r.id) && ids.add(r.id));
  }
  const rr = obj(raw.routineRun);
  if (str(rr.id, 40) && Array.isArray(rr.steps)) {
    const steps = rr.steps.slice(0, 6).map(x => { const c = cleanItem(x); return c ? { activityId: str(x.activityId, 40), name: c.name, cat: c.cat, min: c.min, mode: c.mode } : null; }).filter(Boolean);
    if (steps.length >= 2) s.routineRun = { id: idOf(rr.id), routineId: str(rr.routineId, 40), name: str(rr.name, 40) || 'Routine', steps, next: int(rr.next, 0, steps.length, 0), completed: int(rr.next, 0, steps.length, 0), minutes: num(rr.minutes, 0, 1080, 0), reward: num(rr.reward, 0, COINS_MAX, 0), startedAt: validTs(rr.startedAt) ? rr.startedAt : s.createdAt, finishedAt: validTs(rr.finishedAt) ? rr.finishedAt : 0, status: int(rr.next, 0, steps.length, 0) >= steps.length ? 'done' : 'paused' };
  }
  const city = obj(raw.city);
  if (Array.isArray(city.tiles)) {
    const size = SIZES.includes(city.size) ? city.size : 7;
    const cells = new Set(), ids = new Set(), tiles = [];
    for (const t of city.tiles.slice(0, size * size * 2)) {
      if (!t || typeof t !== 'object' || !isItem(t.item)) continue;
      const { x, y } = t;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size) continue;
      const cell = x + ',' + y;
      if (cells.has(cell)) continue;
      let id = idOf(t.id);
      if (ids.has(id)) id = uid();
      cells.add(cell);
      ids.add(id);
      const tile = { id, item: t.item, x, y, at: validTs(t.at) ? t.at : 0, paid: Math.round(num(t.paid, 0, COINS_MAX, 0)) };
      // Merveille : étape de 1 à 4, pièces payées recalculées d'après l'étape.
      if (isWonder(t.item)) { tile.stage = int(t.stage, 1, ITEMS[t.item].wonder.length, 1); tile.paid = wonderPaid(t.item, tile.stage); }
      tiles.push(tile);
    }
    s.city = { size, tiles: splitWonders(tiles).kept };
  }
  const sts = obj(raw.stats), bc = obj(sts.byCat), days = obj(sts.days);
  s.stats = { byCat: {}, ok: int(sts.ok, 0, 1e7, 0), ko: int(sts.ko, 0, 1e7, 0), days: {}, dailyCats: {} };
  for (const c of CAT_ORDER) s.stats.byCat[c] = num(bc[c], 0, 1e7, 0);
  for (const k of Object.keys(days)) {
    if (!isDayKey(k)) continue;
    const v = num(days[k], 0, 2880, 0);
    if (v > 0) s.stats.days[k] = v;
  }
  for (const [day, cats] of Object.entries(obj(sts.dailyCats))) {
    if (!isDayKey(day)) continue;
    const values = {};
    for (const c of CAT_ORDER) { const value = num(obj(cats)[c], 0, 2880, 0); if (value) values[c] = value; }
    if (Object.keys(values).length) s.stats.dailyCats[day] = values;
  }
  if (Array.isArray(raw.history)) {
    const ids = new Set();
    s.history = raw.history.slice(0, HISTORY_MAX * 2).map(cleanHistory).filter(e => e && !ids.has(e.id) && ids.add(e.id)).slice(0, HISTORY_MAX);
  }
  const historyDays = new Intl.DateTimeFormat('en-CA', { timeZone: s.clock.tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  for (const e of s.history) {
    if (!e.day) e.day = historyDays.format(e.at);
    if (!e.ok || own(obj(sts.dailyCats), e.day)) continue;
    const cats = s.stats.dailyCats[e.day] || (s.stats.dailyCats[e.day] = {});
    cats[e.cat] = (cats[e.cat] || 0) + e.min;
  }
  const effort = obj(sts.effort);
  s.stats.effort = { byCat: {}, days: {}, dailyCats: {} };
  if (sts.effort && typeof sts.effort === 'object') {
    for (const c of CAT_ORDER) s.stats.effort.byCat[c] = num(obj(effort.byCat)[c], 0, 1e7, s.stats.byCat[c]);
    for (const [day, value] of Object.entries(obj(effort.days))) if (isDayKey(day) && num(value, 0, 2880, 0) > 0) s.stats.effort.days[day] = num(value, 0, 2880, 0);
    for (const [day, cats] of Object.entries(obj(effort.dailyCats))) {
      if (!isDayKey(day)) continue;
      const values = {};
      for (const c of CAT_ORDER) { const value = num(obj(cats)[c], 0, 2880, 0); if (value) values[c] = value; }
      if (Object.keys(values).length) s.stats.effort.dailyCats[day] = values;
    }
  } else {
    s.stats.effort = { byCat: clone(s.stats.byCat), days: clone(s.stats.days), dailyCats: clone(s.stats.dailyCats) };
    for (const e of s.history) {
      if (e.ok || !e.elapsedSec) continue;
      const minutes = e.elapsedSec / 60;
      s.stats.effort.byCat[e.cat] += minutes;
      if (e.day) {
        s.stats.effort.days[e.day] = (s.stats.effort.days[e.day] || 0) + minutes;
        const cats = s.stats.effort.dailyCats[e.day] || (s.stats.effort.dailyCats[e.day] = {});
        cats[e.cat] = (cats[e.cat] || 0) + minutes;
      }
    }
  }
  s.active = cleanActive(raw.active);
  return s;
}

/* Fusion à trois voies : on rejoue les changements faits ici (local − base) par-dessus l'autre version.
   Les compteurs s'additionnent, les listes et la ville se fusionnent par identifiant. */
// Une suppression gagne sur une édition concurrente. Pour un même champ édité
// des deux côtés, le maximum JSON est un départage stable, indépendant de l'onglet.
// Dates d'obtention (succès, ensembles) dont l'identifiant figure dans la table donnée.
function knownDates(raw, table) {
  const ids = new Set(table.map(x => x.id));
  return Object.fromEntries(Object.entries(obj(raw)).filter(([id, at]) => ids.has(id) && validTs(at)));
}
// Une case par merveille : l'étape la plus haute, puis la plus ancienne, puis le plus petit identifiant.
function splitWonders(tiles) {
  const rank = (a, b) => (b.stage - a.stage) || (a.at - b.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const best = new Map(), dropped = [];
  for (const tile of tiles) {
    if (!isWonder(tile.item)) continue;
    const cur = best.get(tile.item);
    if (!cur) best.set(tile.item, tile);
    else if (rank(tile, cur) < 0) { dropped.push(cur); best.set(tile.item, tile); }
    else dropped.push(tile);
  }
  return { kept: tiles.filter(tile => !dropped.includes(tile)), dropped };
}
// Dates d'obtention : on part de l'autre version et on y ajoute ce que cet onglet a obtenu depuis la base.
// Une date des deux côtés garde la plus ancienne ; ce qu'une remise à zéro a effacé ne revient pas.
function mergeDates(B, L, R) {
  const out = Object.assign({}, R || {});
  for (const [id, at] of Object.entries(L || {})) {
    if ((B || {})[id] === at) continue;
    out[id] = id in out ? Math.min(out[id], at) : at;
  }
  return out;
}
function mergeFields(B, L, R, conflicts = [], label = '') {
  const out = clone(R), equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const key of new Set([...Object.keys(B || {}), ...Object.keys(L || {})])) {
    const b = B && B[key], l = L && L[key], r = R && R[key];
    if (equal(l, b)) continue;
    if (equal(r, b) || equal(l, r)) { if (l === undefined) delete out[key]; else out[key] = clone(l); }
    else {
      conflicts.push(label + '.' + key);
      const winner = (JSON.stringify(l) || '') > (JSON.stringify(r) || '') ? l : r;
      if (winner === undefined) delete out[key]; else out[key] = clone(winner);
    }
  }
  return out;
}
function mergeList(B, L, R, conflicts = []) {
  const bm = new Map(B.map(x => [x.id, x])), lm = new Map(L.map(x => [x.id, x])), rm = new Map(R.map(x => [x.id, x]));
  const out = [];
  for (const [id, remote] of rm) {
    const base = bm.get(id), local = lm.get(id);
    if (base && !local) continue;
    out.push(local ? mergeFields(base || {}, local, remote, conflicts, id) : clone(remote));
  }
  for (const [id, local] of lm) if (!bm.has(id) && !rm.has(id)) out.push(clone(local));
  return out.slice(0, LIST_MAX);
}
function mergeCity(B, L, R) {
  const N = Math.max(L.size, R.size);
  const off = s => (s - 1) / 2;
  const rel = c => new Map(c.tiles.map(t => [t.id, Object.assign({}, t, { rx: t.x - off(c.size), ry: t.y - off(c.size) })]));
  const bm = rel(B), lm = rel(L), out = rel(R);
  const lim = off(N);
  const inside = (rx, ry) => Math.abs(rx) <= lim && Math.abs(ry) <= lim;
  const taken = (rx, ry, except) => { for (const t of out.values()) if (t.id !== except && t.rx === rx && t.ry === ry) return true; return false; };
  const freeSpot = () => { for (let ry = -lim; ry <= lim; ry++) for (let rx = -lim; rx <= lim; rx++) if (!taken(rx, ry)) return [rx, ry]; return null; };
  for (const id of bm.keys()) if (!lm.has(id)) out.delete(id);
  let refund = 0;
  for (const [id, lt] of lm) {
    const bt = bm.get(id), cur = out.get(id);
    if (bt && cur && (bt.rx !== lt.rx || bt.ry !== lt.ry) && inside(lt.rx, lt.ry) && !taken(lt.rx, lt.ry, id)) out.set(id, Object.assign({}, cur, { rx: lt.rx, ry: lt.ry }));
    // Une merveille agrandie ici garde l'étape la plus haute ; une étape payée des deux côtés est rendue une fois.
    const now = out.get(id), sb = bt ? bt.stage || 0 : 0, sl = lt.stage || 0;
    if (bt && now && sl > sb) {
      const sr = now.stage || 0;
      if (sr > sb) refund += wonderPaid(lt.item, Math.min(sl, sr)) - wonderPaid(lt.item, sb);
      out.set(id, Object.assign({}, now, { stage: Math.max(sl, sr) }));
    }
  }
  for (const [id, lt] of lm) {
    if (bm.has(id) || out.has(id)) continue;
    const spot = inside(lt.rx, lt.ry) && !taken(lt.rx, lt.ry) ? [lt.rx, lt.ry] : freeSpot();
    if (spot) out.set(id, Object.assign({}, lt, { rx: spot[0], ry: spot[1] }));
    else refund += lt.paid || 0;
  }
  const tiles = [...out.values()].map(t => Object.assign({ id: t.id, item: t.item, x: t.rx + off(N), y: t.ry + off(N), at: t.at, paid: t.paid || 0 }, t.stage ? { stage: t.stage } : {}));
  // Une même merveille commencée sur deux onglets : la plus avancée reste, l'autre est remboursée.
  const { kept, dropped } = splitWonders(tiles);
  for (const tile of dropped) refund += tile.paid || 0;
  return { size: N, tiles: kept, refund };
}
function mergeEffort(B, L, R) {
  const out = clone(R), delta = (l, b) => (l || 0) - (b || 0);
  for (const c of CAT_ORDER) out.byCat[c] = Math.max(0, (R.byCat[c] || 0) + delta(L.byCat[c], B.byCat[c]));
  for (const day of new Set([...Object.keys(L.days), ...Object.keys(B.days)])) {
    const value = (R.days[day] || 0) + delta(L.days[day], B.days[day]);
    if (value > 0) out.days[day] = value; else delete out.days[day];
  }
  for (const day of new Set([...Object.keys(L.dailyCats), ...Object.keys(B.dailyCats)])) {
    const cats = out.dailyCats[day] || (out.dailyCats[day] = {});
    for (const c of CAT_ORDER) {
      const value = (cats[c] || 0) + delta(obj(L.dailyCats[day])[c], obj(B.dailyCats[day])[c]);
      if (value > 0) cats[c] = value; else delete cats[c];
    }
    if (!Object.keys(cats).length) delete out.dailyCats[day];
  }
  return out;
}
function subtractEffort(stats, e, minutes) {
  stats.byCat[e.cat] = Math.max(0, (stats.byCat[e.cat] || 0) - minutes);
  if (e.day) {
    stats.days[e.day] = Math.max(0, (stats.days[e.day] || 0) - minutes);
    if (!stats.days[e.day]) delete stats.days[e.day];
    const cats = stats.dailyCats[e.day] || (stats.dailyCats[e.day] = {});
    cats[e.cat] = Math.max(0, (cats[e.cat] || 0) - minutes);
    if (!cats[e.cat]) delete cats[e.cat];
    if (!Object.keys(cats).length) delete stats.dailyCats[e.day];
  }
}
function merge3(B, L, R) {
  const M = clone(R), conflicts = [];
  const d = (l, b) => (l || 0) - (b || 0);
  M.coins = clamp(R.coins + d(L.coins, B.coins), 0, COINS_MAX);
  M.earned = clamp(R.earned + d(L.earned, B.earned), 0, COINS_MAX);
  M.stats.ok = Math.max(0, R.stats.ok + d(L.stats.ok, B.stats.ok));
  M.stats.ko = Math.max(0, R.stats.ko + d(L.stats.ko, B.stats.ko));
  for (const c of CAT_ORDER) M.stats.byCat[c] = Math.max(0, R.stats.byCat[c] + d(L.stats.byCat[c], B.stats.byCat[c]));
  for (const k of new Set([...Object.keys(L.stats.days), ...Object.keys(B.stats.days)])) {
    const v = (R.stats.days[k] || 0) + d(L.stats.days[k], B.stats.days[k]);
    if (v > 0) M.stats.days[k] = v; else delete M.stats.days[k];
  }
  M.stats.dailyCats = clone(R.stats.dailyCats || {});
  for (const day of new Set([...Object.keys(L.stats.dailyCats || {}), ...Object.keys(B.stats.dailyCats || {})])) {
    const values = M.stats.dailyCats[day] || (M.stats.dailyCats[day] = {});
    for (const c of CAT_ORDER) {
      const value = (values[c] || 0) + d(obj(L.stats.dailyCats[day])[c], obj(B.stats.dailyCats[day])[c]);
      if (value > 0) values[c] = value; else delete values[c];
    }
    if (!Object.keys(values).length) delete M.stats.dailyCats[day];
  }
  M.stats.effort = mergeEffort(B.stats.effort, L.stats.effort, R.stats.effort);
  const have = new Map(M.history.map(e => [e.id, e])), bIds = new Set(B.history.map(e => e.id));
  for (const e of L.history) {
    if (bIds.has(e.id)) continue;
    const twin = have.get(e.id);
    if (!twin) { M.history.push(clone(e)); continue; }
    // Une même session ne contribue qu'une fois. Un résultat réussi gagne sur
    // une clôture tardive ; entre échecs on conserve le temps effectué le plus long.
    const elapsed = entry => entry.elapsedSec == null ? (entry.ok ? entry.min * 60 : 0) : entry.elapsedSec;
    const winner = [e, twin].sort((a, b) => Number(b.ok) - Number(a.ok) || elapsed(b) - elapsed(a) || a.at - b.at || JSON.stringify(a).localeCompare(JSON.stringify(b)))[0];
    const adjust = (entry, sign) => {
      if (entry.ok) {
        M.stats.ok = Math.max(0, M.stats.ok + sign);
        M.coins = clamp(M.coins + sign * entry.reward, 0, COINS_MAX);
        M.earned = clamp(M.earned + sign * entry.reward, 0, COINS_MAX);
        subtractEffort(M.stats, entry, -sign * entry.min);
      } else M.stats.ko = Math.max(0, M.stats.ko + sign);
      subtractEffort(M.stats.effort, entry, -sign * elapsed(entry) / 60);
    };
    adjust(e, -1);
    if (winner === e && JSON.stringify(e) !== JSON.stringify(twin)) {
      adjust(twin, -1);
      adjust(e, 1);
      M.history[M.history.findIndex(entry => entry.id === e.id)] = clone(e);
    }
  }
  M.history.sort((a, b) => b.at - a.at);
  M.history = M.history.slice(0, HISTORY_MAX);
  for (const key of ['settings', 'goals', 'personal']) M[key] = mergeFields(B[key] || {}, L[key] || {}, R[key] || {}, conflicts, key);
  M.clock.maxSeen = Math.max(L.clock.maxSeen, R.clock.maxSeen);
  M.clock.lastDay = [L.clock.lastDay, R.clock.lastDay].sort().pop() || '';
  for (const k of ['activities', 'wishes', 'chores']) M[k] = mergeList(B[k], L[k], R[k], conflicts);
  M.routines = mergeList(B.routines || [], L.routines || [], R.routines || [], conflicts);
  if (JSON.stringify(L.routineRun) !== JSON.stringify(B.routineRun)) {
    if (L.routineRun && R.routineRun && L.routineRun.id === R.routineRun.id) M.routineRun = clone(L.routineRun.next >= R.routineRun.next ? L.routineRun : R.routineRun);
    else if (JSON.stringify(R.routineRun) === JSON.stringify(B.routineRun)) M.routineRun = clone(L.routineRun);
    else M.routineRun = clone([L.routineRun, R.routineRun].filter(Boolean).sort((a,b) => b.startedAt - a.startedAt || b.id.localeCompare(a.id))[0] || null);
  }
  if (JSON.stringify(L.draw) !== JSON.stringify(B.draw)) M.draw = clone(L.draw);
  if (JSON.stringify(L.pauses) !== JSON.stringify(B.pauses)) M.pauses = clone(L.pauses);
  const city = mergeCity(B.city, L.city, R.city);
  M.city = { size: city.size, tiles: city.tiles };
  M.achievements = mergeDates(B.achievements, L.achievements, R.achievements);
  M.sets = mergeDates(B.sets, L.sets, R.sets);
  M.coins = clamp(M.coins + city.refund, 0, COINS_MAX);
  const la = L.active, ba = B.active, ra = R.active;
  const ended = new Set(M.history.map(e => e.id));
  const candidates = [la, ra].filter(a => a && !ended.has(a.id) && !(ba && a.id === ba.id && (!la || !ra)));
  candidates.sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id));
  M.active = candidates.length ? clone(candidates[0]) : null;
  if (la && ra && la.id === ra.id && M.active) {
    M.active.elapsedSec = Math.max(la.elapsedSec || 0, ra.elapsedSec || 0);
    M.active.checkpointAt = Math.max(la.checkpointAt || 0, ra.checkpointAt || 0);
    M.active.owner = ra.owner || la.owner;
  }
  if (conflicts.length) Store.localWarning = t('storage.conflicts', { n: conflicts.length });
  M.createdAt = Math.min(L.createdAt, R.createdAt);
  return normalize(M);
}

let S = defaultState();

/* =========================================================================
   Stockage : ce navigateur (immédiat) + compte claude.ai (base privée) quand disponible.
   Règles : rien n'est envoyé au compte avant de l'avoir lu ; on relit avant d'écrire ;
   une version plus récente n'est jamais écrasée, elle est fusionnée.
   ========================================================================= */
function parseDoc(snap) {
  try {
    if (!snap || !snap.exists) return null;
    const d = snap.data();
    if (!d || typeof d.json !== 'string') return null;
    return normalize(JSON.parse(d.json));
  } catch (e) { return null; }
}

function sameVersion(a, b) {
  if (!a || !b) return false;
  if (a.revision || b.revision) return !!a.revision && a.revision === b.revision;
  // Anciennes sauvegardes : le contenu départage également les horloges identiques.
  return a.updatedAt === b.updatedAt && JSON.stringify(a) === JSON.stringify(b);
}
function markChanged(after = 0) {
  S.updatedAt = Math.max(Date.now(), S.updatedAt + 1, after + 1);
  S.revision = uid() + '-' + uid();
}

const Store = {
  mode: 'local',          // 'local' | 'connecting' | 'cloud'
  status: 'local',        // 'local' | 'connecting' | 'ok' | 'retrying' | 'error'
  error: '',
  localError: '', localWarning: '', recoveryRaw: '', recoveryKey: '',
  migrationPending: false, migrationReason: '', migrationSnapshot: null, lastReadFailed: false,
  ref: null, legacyRef: null, cloudMigrationPending: false,
  unsub: null,
  base: null,             // dernier état connu du compte
  bootState: null,
  lsAt: -1,
  lsBase: null,
  writing: 0,
  busy: false,
  again: false,
  timer: 0,
  retry: 0,
  lastOk: 0,
  lastPull: 0,
  device: '',
  tab: uid(),

  init() {
    try {
      this.device = localStorage.getItem(LS_DEVICE) || '';
      if (!this.device) { this.device = uid() + uid(); localStorage.setItem(LS_DEVICE, this.device); }
    } catch (e) { this.device = 'tmp-' + uid(); }
    const local = this.readLocal();
    S = local || defaultState();
    this.lsBase = clone(S);
    this.lsAt = local ? S.updatedAt : -1;
    this.bootState = clone(S);
    try {
      const rawBase = localStorage.getItem(LS_BASE);
      if (rawBase) this.base = normalize(JSON.parse(rawBase));
    } catch (e) { this.base = null; }
    touchClock();
  },
  reportLocal(message) {
    this.localError = message;
    if (typeof renderStorageStatus === 'function') renderStorageStatus();
  },
  decodeLocal(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid-state');
      return normalize(parsed);
    } catch (e) {
      this.recoveryRaw = raw;
      this.localWarning = t('storage.legacyUnreadable');
      this.reportLocal(t('storage.localUnreadable'));
      return null;
    }
  },
  legacySessionIsLive(state) {
    const a = state && state.active;
    if (!a || state.history.some(e => e.id === a.id)) return false;
    let beat = {};
    try { beat = obj(JSON.parse(localStorage.getItem(LEGACY_LS_KEY + ':beat') || 'null')); } catch (e) { /* ancien battement absent */ }
    const grace = state.settings.grace * 1000 + 3000;
    if (beat.id === a.id && Date.now() - (beat.at || 0) < grace) return true;
    if (!a.dev || a.dev === this.device) return Date.now() - a.startedAt < grace;
    return Date.now() < a.startedAt + a.min * 60000 + 120000;
  },
  reportMigration() {
    this.reportLocal(this.migrationReason === 'session'
      ? t('storage.migrationWaitSession')
      : t('storage.migrationNoSpace'));
  },
  migrateLegacy() {
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    if (!raw) return null;
    const legacy = this.decodeLocal(raw);
    if (!legacy) {
      // Le document v1 reste à son emplacement exact, même si la v2 est réparée.
      this.recoveryKey = LEGACY_LS_KEY;
      this.localWarning = t('storage.v1Unreadable');
      return null;
    }
    this.migrationSnapshot = clone(legacy);
    this.migrationPending = true;
    this.migrationReason = 'storage';
    if (this.legacySessionIsLive(legacy)) {
      this.migrationReason = 'session';
      this.reportMigration();
      return legacy;
    }
    // Une copie change le format, pas la date de la dernière action : cette
    // date sert encore à choisir entre les anciennes copies locale et du compte.
    legacy.revision = uid() + '-' + uid();
    try {
      const json = JSON.stringify(legacy);
      localStorage.setItem(LS_KEY, json);
      if (localStorage.getItem(LS_KEY) !== json) throw new Error('migration-not-confirmed');
    } catch (e) { this.reportMigration(); return legacy; }
    this.migrationPending = false;
    this.migrationReason = '';
    this.migrationSnapshot = null;
    this.localWarning = t('storage.migrated');
    this.reportLocal('');
    return legacy;
  },
  readLocal() {
    this.lastReadFailed = false;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const wasPending = this.migrationPending;
        const local = this.decodeLocal(raw);
        if (local) { this.migrationPending = false; this.migrationReason = ''; this.migrationSnapshot = null; }
        if (local && wasPending) this.reportLocal('');
        return local;
      }
      return this.migrateLegacy();
    } catch (e) {
      this.lastReadFailed = true;
      this.migrationPending = true;
      this.migrationReason = 'storage';
      this.reportLocal(t('storage.unreadable'));
      return this.migrationSnapshot ? clone(this.migrationSnapshot) : null;
    }
  },
  retryMigration() {
    let local = this.readLocal();
    if (!local && !this.lastReadFailed && this.migrationReason === 'storage') {
      this.migrationPending = false;
      this.migrationReason = '';
      if (!this.saveLocal()) return false;
      local = clone(S);
    }
    if (this.migrationPending || !local) return false;
    S = local;
    this.lsBase = clone(local);
    this.lsAt = local.updatedAt;
    this.bootState = clone(local);
    afterReplace();
    if (this.mode === 'local') this.connect();
    return true;
  },
  preserveRecovery(raw) {
    if (!raw) return true;
    this.recoveryRaw = raw;
    try {
      // Une seule copie identique suffit, mais ne jamais remplacer une autre récupération.
      if (this.recoveryKey && localStorage.getItem(this.recoveryKey) === raw) return true;
      const key = LS_KEY + ':recovery:' + Date.now() + ':' + uid();
      localStorage.setItem(key, raw);
      if (localStorage.getItem(key) !== raw) throw new Error('recovery-not-written');
      this.recoveryKey = key;
      return true;
    } catch (e) {
      this.reportLocal(t('storage.preserveFailed'));
      return false;
    }
  },
  repairLocal() { return this.migrationPending ? this.retryMigration() : this.saveLocal(); },
  // Écrit seulement après préservation d'un éventuel document illisible.
  saveLocal() {
    if (this.migrationPending) {
      this.reportMigration();
      return false;
    }
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const other = this.decodeLocal(raw);
        if (!other) { if (!this.preserveRecovery(raw)) return false; }
        else if (!sameVersion(other, this.lsBase) && !sameVersion(other, S)) {
          S = merge3(this.lsBase || other, S, other);
          markChanged(other.updatedAt);
          afterReplace();
        }
      }
      const json = JSON.stringify(S);
      localStorage.setItem(LS_KEY, json);
      if (localStorage.getItem(LS_KEY) !== json) throw new Error('write-not-confirmed');
      this.lsBase = clone(S);
      this.lsAt = S.updatedAt;
      this.reportLocal('');
      return true;
    } catch (e) {
      this.reportLocal(t('storage.cannotSave'));
      return false;
    }
  },
  // Un autre onglet a écrit : on récupère son état (fusionné avec nos changements éventuels).
  pullLocal() {
    const other = this.readLocal();
    dbg('pullLocal ' + (other && other.updatedAt) + ' active=' + !!(other && other.active));
    if (this.migrationPending) return;
    if (!other || sameVersion(other, S) || sameVersion(other, this.lsBase)) return;
    if (sameVersion(S, this.lsBase)) {
      S = other;
      this.lsBase = clone(other);
      this.lsAt = other.updatedAt;
    } else {
      S = merge3(this.lsBase || other, S, other);
      markChanged(other.updatedAt);
      this.lsBase = clone(other);
      this.lsAt = other.updatedAt;
      this.saveLocal();
      this.schedule(400);
    }
    afterReplace();
  },
  setBase(R) {
    this.base = clone(R);
    try { localStorage.setItem(LS_BASE, JSON.stringify(R)); } catch (e) { /* ignore */ }
  },
  // Intègre une version venue du compte. Renvoie true si l'état affiché a changé.
  absorb(R) {
    if (!R) return false;
    if (sameVersion(R, S)) { this.setBase(R); return false; }
    if (this.base && sameVersion(R, this.base)) return false;
    const B = this.base || this.bootState;
    const localChanged = !sameVersion(S, B);
    if (!localChanged) {
      if (!this.base && S.updatedAt > R.updatedAt) { this.setBase(R); return false; } // copie locale plus récente (ancienne version de l'app)
      S = R;
    } else {
      S = merge3(B, S, R);
      markChanged(R.updatedAt);
    }
    this.setBase(R);
    this.saveLocal();
    afterReplace();
    return true;
  },
  async connect() {
    if (this.migrationPending) return;
    const c = window.claude;
    if (!c || typeof c.use !== 'function') { this.mode = 'local'; this.status = 'local'; renderSyncStatus(); return; }
    this.mode = 'connecting';
    this.status = 'connecting';
    renderSyncStatus();
    try {
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      if (!db || !user) throw new Error('no-db');
      const id = await user.id();
      if (!id) throw new Error('no-id');
      this.ref = db.doc('data/users/' + id + '/state-v2');
      let R = parseDoc(await this.ref.get()), fromLegacy = false;
      if (!R) {
        this.legacyRef = db.doc('data/users/' + id + '/state');
        const legacy = parseDoc(await this.legacyRef.get());
        if (legacy && this.legacySessionIsLive(legacy)) {
          this.cloudMigrationPending = true;
          this.localWarning = t('storage.cloudSessionWait');
        } else { R = legacy; fromLegacy = !!legacy; }
      }
      this.mode = 'cloud';
      this.status = this.cloudMigrationPending ? 'retrying' : 'ok';
      this.lastOk = Date.now();
      this.absorb(R);
      if (fromLegacy) { markChanged(); this.saveLocal(); }
      this.subscribe();
      this.schedule(0);
    } catch (e) {
      this.ref = null;
      this.mode = 'local';
      this.status = 'local';
    }
    renderSyncStatus();
    if (typeof renderStorageStatus === 'function') renderStorageStatus();
    checkActive();
  },
  subscribe() {
    if (!this.ref || this.unsub || typeof this.ref.onSnapshot !== 'function') return;
    try {
      this.unsub = this.ref.onSnapshot(snap => {
        if (snap && snap.metadata && snap.metadata.hasPendingWrites) return;
        const R = parseDoc(snap);
        if (!R || (R.revision && R.revision === this.writing)) return;
        setTimeout(() => { this.cloudMigrationPending = false; if (this.absorb(R)) this.schedule(400); }, 0);
      }, () => { this.unsub = null; });
    } catch (e) { this.unsub = null; }
  },
  // Relit le compte (retour au premier plan, focus).
  async pull() {
    if (this.mode !== 'cloud' || !this.ref || this.busy) return;
    if (Date.now() - this.lastPull < 4000) return;
    this.lastPull = Date.now();
    try {
      if (this.cloudMigrationPending && this.legacyRef) {
        const migrated = parseDoc(await this.ref.get());
        if (migrated) {
          this.cloudMigrationPending = false;
          this.absorb(migrated);
        } else {
          const legacy = parseDoc(await this.legacyRef.get());
          if (legacy && this.legacySessionIsLive(legacy)) return;
          this.cloudMigrationPending = false;
          this.absorb(legacy);
          markChanged();
          this.saveLocal();
        }
        this.status = 'ok';
        this.localWarning = t('storage.cloudMigrated');
        this.schedule(0);
        renderSyncStatus();
        if (typeof renderStorageStatus === 'function') renderStorageStatus();
      }
      const R = parseDoc(await this.ref.get());
      if (this.absorb(R)) this.schedule(400);
    } catch (e) { /* réessai au prochain retour */ }
  },
  schedule(delay) {
    if (this.mode !== 'cloud' || !this.ref || this.cloudMigrationPending) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), delay);
  },
  async flush() {
    if (this.mode !== 'cloud' || !this.ref || this.cloudMigrationPending) return;
    if (this.busy) { this.again = true; return; }
    if (!S.updatedAt || (this.base && sameVersion(S, this.base))) return;
    this.busy = true;
    try {
      const R = parseDoc(await this.ref.get());
      if (R && !sameVersion(R, S) && (!this.base || !sameVersion(R, this.base))) this.absorb(R);
      const snapshot = clone(S);
      this.writing = snapshot.revision;
      await this.ref.set({ v: 2, updatedAt: snapshot.updatedAt, by: this.tab, json: JSON.stringify(snapshot) });
      this.setBase(snapshot);
      this.status = 'ok';
      this.error = '';
      this.retry = 0;
      this.lastOk = Date.now();
    } catch (e) {
      const code = e && e.code;
      if (code === 'invalid_argument' || code === 'quota_exceeded' || code === 'transform_error') {
        this.status = 'error';
        this.error = 'refused';
        toast(t('storage.cloudSaveFailed'));
      } else if (code === 'revoked' || code === 'not_granted' || code === 'capability_disabled' || code === 'capability_removed') {
        this.mode = 'local';
        this.ref = null;
        this.status = 'error';
        this.error = 'off';
      } else {
        this.status = 'retrying';
        this.retry = Math.min(this.retry + 1, 6);
        const wait = Math.min(60000, 1500 * Math.pow(2, this.retry)) * (0.7 + Math.random() * 0.6);
        setTimeout(() => this.schedule(0), wait);
      }
    } finally {
      this.busy = false;
      this.writing = 0;
      renderSyncStatus();
      if (this.again) { this.again = false; this.flush(); }
    }
  },
};

function touchClock() {
  const now = Date.now();
  if (now > S.clock.maxSeen) S.clock.maxSeen = now;
}
function commit(opts = {}) {
  if (Store.migrationPending) { Store.reportMigration(); return false; }
  markChanged();
  touchClock();
  const saved = Store.saveLocal();
  Store.schedule(opts.flush ? 0 : 1200);
  if (!opts.silent) renderAll();
  return saved;
}
// Après un remplacement de l'état par une autre version (compte ou autre onglet).
let replacePending = false;
function afterReplace() {
  if (run && !run.ended && (!S.active || S.active.id !== run.id || (S.active.owner && S.active.owner !== Store.tab))) {
    // Le résultat ou le propriétaire partagé fait autorité. Ne jamais ressusciter
    // un chrono local : deux onglets pourraient sinon se réécrire sans fin.
    endRun();
    clearBeat();
    const session = $('#session');
    if (session) session.hidden = true;
    if (typeof updateInert === 'function') updateInert();
    setTimeout(() => toast(t('session.endedElsewhere')), 0);
  }
  if (replacePending) return;
  replacePending = true;
  setTimeout(() => {
    replacePending = false;
    Mode.state = null;
    Selection.id = null;
    if (!$('#sheet').hidden && !sheetKeepOnSync) closeSheet();
    // Langue changée sur un autre écran : celui-ci suit.
    if (typeof refreshLang === 'function' && resolveLang(S.settings.lang) !== LANG) refreshLang();
    City.relayout();
    renderAll();
    checkActive();
  }, 0);
}

