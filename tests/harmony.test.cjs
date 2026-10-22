const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

// Étape 5 : souhaits des habitants, harmonie de la ville, réglages de l'ambiance.
const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js',
  '28-harmony.js', '46-features.js'];
const EXPOSE = ['defaultState', 'normalize', 'merge3', 'clone', 'giftAmount', 'harmonyCriteria', 'claimStars', 'starsEarned',
  'wishCandidates', 'townWishTile', 'drawTownWish', 'claimTownWish', 'skipTownWish'];
const T0 = Date.parse('2026-10-18T12:00:00Z');
function app(now = '2026-10-21T10:00:00Z') {
  const a = loadApp(FILES, { expose: EXPOSE, now });
  a.state.clock.tz = 'Europe/Zurich'; a.state.clock.maxSeen = 0;
  return a;
}

test('étape 5 : réglages par défaut et validés, souhait validé', () => {
  const a = app(), d = a.defaultState();
  assert.deepEqual(plain([d.settings.ambience, d.settings.ambienceVolume, d.settings.townWishes, d.townWish]), ['none', 'normal', true, null]);
  const s = a.normalize({ settings: { ambience: 'jazz', ambienceVolume: 'max', townWishes: false }, townWish: { day: '2026-10-18', tile: 't1', item: 'banc' } });
  assert.deepEqual(plain([s.settings.ambience, s.settings.ambienceVolume, s.settings.townWishes]), ['none', 'normal', false]);
  assert.deepEqual(plain(s.townWish), { day: '2026-10-18', tile: 't1', item: 'banc' });
  assert.deepEqual(plain([a.normalize({ settings: { ambience: 'rain', ambienceVolume: 'soft' } }).settings.ambience, a.normalize({ settings: { ambienceVolume: 'soft' } }).settings.ambienceVolume]), ['rain', 'soft']);
  for (const bad of [{ day: '2026-10-18', tile: 't1', item: 'licorne' }, { day: '2026-10-18', tile: 't1', item: 'maison' }, { day: 'hier', tile: 't1', item: 'banc' },
    { day: '2026-10-18', tile: '', item: 'banc' }, 'x']) assert.equal(a.normalize({ townWish: bad }).townWish, null, JSON.stringify(bad));
  assert.deepEqual(plain(a.normalize({ townWish: { day: '2026-10-18', tile: 't1', item: 'banc', done: T0 } }).townWish), { day: '2026-10-18', tile: 't1', item: 'banc', done: T0 });
  assert.deepEqual(plain(a.normalize({ townWish: { day: '2026-10-18', tile: 't1', item: 'banc', done: 'hier', skipped: 'oui' } }).townWish), { day: '2026-10-18', tile: 't1', item: 'banc' });
  assert.equal(a.normalize({ townWish: { day: '2026-10-18', tile: 't1', item: 'banc', skipped: true } }).townWish.skipped, true);
});

test('étape 5 : cadeaux d’un souhait (3 M) et d’une étoile (10 M), clés validées', () => {
  const a = app();
  assert.deepEqual([a.giftAmount('wish:2026-10-18'), a.giftAmount('star:verdure')], [3e6, 10e6]);
  const s = a.normalize({ gifts: { 'wish:2026-10-18': T0, 'star:verdure': T0, 'star:licorne': T0, 'wish:hier': T0 } });
  assert.deepEqual(Object.keys(s.gifts).sort(), ['star:verdure', 'wish:2026-10-18']);
});

test('étape 5 : fusion du souhait, cadeau en double remboursé', () => {
  const a = app();
  const B = a.normalize({ ...a.defaultState(), coins: 10e6 });
  let L = a.clone(B), R = a.clone(B);
  L.townWish = { day: '2026-10-18', tile: 't1', item: 'banc' }; R.townWish = { day: '2026-10-19', tile: 't2', item: 'fleurs' };
  assert.deepEqual([a.merge3(B, L, R).townWish.day, a.merge3(B, R, L).townWish.day], ['2026-10-19', '2026-10-19']);
  L = a.clone(B); R = a.clone(B);
  L.townWish = { day: '2026-10-18', tile: 't1', item: 'banc', done: T0 }; R.townWish = { day: '2026-10-18', tile: 't1', item: 'banc' };
  assert.deepEqual([a.merge3(B, L, R).townWish.done, a.merge3(B, R, L).townWish.done], [T0, T0]);
  L.gifts['wish:2026-10-18'] = T0; L.coins += 3e6;
  R.gifts['wish:2026-10-18'] = T0 + 1; R.coins += 3e6;
  assert.equal(a.merge3(B, L, R).coins, 10e6 + 3e6);
});

// Une ville de 7 × 7 faite des éléments donnés : [élément, x, y].
const cityOf = list => ({ size: 7, tiles: list.map(([item, x, y], i) => ({ id: 't' + i, item, x, y, at: T0, paid: 0 })) });
// Un critère, sans la clé de son conseil (vérifiée à part).
const crit = (a, list, id) => { const { hint, ...rest } = plain(a.harmonyCriteria(cityOf(list)).find(c => c.id === id)); return rest; };
// Six bâtiments de la ligne du haut, et un septième.
const SIX = [['maison', 0, 0], ['boulangerie', 1, 0], ['bibliotheque', 2, 0], ['terrain', 3, 0], ['jardin', 4, 0], ['kiosque', 5, 0]];
const SEVEN = [...SIX, ['maison', 6, 0]];

test('harmonie : les cinq critères, dans l’ordre', () => {
  assert.deepEqual(plain(app().harmonyCriteria(cityOf([])).map(c => c.id)), ['verdure', 'variete', 'details', 'quartiers', 'lumieres']);
});

test('harmonie : verdure, juste avant et au seuil', () => {
  const a = app();
  assert.deepEqual(crit(a, [...SIX, ['arbre', 0, 6]], 'verdure'), { id: 'verdure', met: false, missing: 1 });
  assert.deepEqual(crit(a, [...SIX, ['arbre', 0, 6], ['fleurs', 1, 6]], 'verdure'), { id: 'verdure', met: true, missing: 0 });
  assert.deepEqual(crit(a, [...SEVEN, ['arbre', 0, 6], ['fleurs', 1, 6]], 'verdure'), { id: 'verdure', met: false, missing: 1 });
  assert.equal(crit(a, [...SEVEN, ['arbre', 0, 6], ['fleurs', 1, 6], ['haie', 2, 6]], 'verdure').met, true);
});

test('harmonie : variété', () => {
  const a = app();
  assert.deepEqual(crit(a, [['maison', 0, 0], ['boulangerie', 2, 0], ['bibliotheque', 4, 0]], 'variete'), { id: 'variete', met: false, missing: 1 });
  assert.equal(crit(a, [['maison', 0, 0], ['bibliotheque', 2, 0], ['terrain', 4, 0]], 'variete').met, true);
});

test('harmonie : petits détails (un décor voisin, diagonale comprise)', () => {
  const a = app(), four = [['maison', 0, 0], ['bibliotheque', 3, 0], ['terrain', 6, 0], ['jardin', 0, 3]];
  assert.deepEqual(crit(a, [...four, ['banc', 1, 1], ['banc', 4, 0]], 'details'), { id: 'details', met: false, missing: 1 });
  assert.equal(crit(a, [...four, ['banc', 1, 1], ['banc', 4, 0], ['lampadaire', 5, 1]], 'details').met, true);
  assert.deepEqual(crit(a, [['maison', 0, 0], ['bibliotheque', 3, 0], ['terrain', 6, 0], ['banc', 1, 0], ['banc', 4, 0], ['banc', 5, 0]], 'details'),
    { id: 'details', met: false, missing: 1 });
});

test('harmonie : quartiers', () => {
  const a = app(), lecture = [['bibliotheque', 0, 0], ['banc', 1, 0], ['arbre', 2, 0]];
  assert.deepEqual(crit(a, lecture, 'quartiers'), { id: 'quartiers', met: false, missing: 1 });
  assert.equal(crit(a, [...lecture, ['maison', 4, 4], ['fleurs', 5, 4], ['haie', 6, 4]], 'quartiers').met, true);
});

test('harmonie : lumières du soir', () => {
  const a = app(), five = SIX.slice(0, 5);
  assert.deepEqual(crit(a, five, 'lumieres'), { id: 'lumieres', met: false, missing: 1 });
  assert.equal(crit(a, [...five, ['lampadaire', 0, 6]], 'lumieres').met, true);
  assert.deepEqual(crit(a, [...SIX, ['lanterne', 0, 6]], 'lumieres'), { id: 'lumieres', met: false, missing: 1 });
  assert.equal(crit(a, [...SIX, ['lanterne', 0, 6], ['lampadaire', 1, 6]], 'lumieres').met, true);
});

test('harmonie : le conseil de « Petits détails » parle de bâtiments tant qu’il y en a moins de 4', () => {
  const a = app(), details = list => plain(a.harmonyCriteria(cityOf(list)).find(c => c.id === 'details'));
  assert.deepEqual(details([['maison', 0, 0], ['bibliotheque', 3, 0], ['terrain', 6, 0], ['banc', 1, 0], ['banc', 4, 0], ['banc', 5, 0]]),
    { id: 'details', met: false, missing: 1, hint: 'harmony.details.buildings' });
  assert.deepEqual(details([['maison', 0, 0], ['bibliotheque', 3, 0]]), { id: 'details', met: false, missing: 2, hint: 'harmony.details.buildings' });
  assert.deepEqual(details([['maison', 0, 0], ['bibliotheque', 3, 0], ['terrain', 6, 0], ['jardin', 0, 3], ['banc', 1, 1]]),
    { id: 'details', met: false, missing: 2, hint: 'harmony.details.hint' });
  assert.equal(plain(a.harmonyCriteria(cityOf([])).find(c => c.id === 'verdure')).hint, 'harmony.verdure.hint');
});

test('étoiles : 10 M une seule fois, gardées après un retrait', () => {
  const a = app(), s = a.state;
  s.city = cityOf([['arbre', 0, 0], ['fleurs', 2, 2]]);
  const coins = s.coins;
  assert.deepEqual(plain(a.claimStars()), ['verdure']);
  assert.equal(s.coins, coins + 10e6);
  assert.ok(s.gifts['star:verdure'] > 0);
  assert.deepEqual(plain(a.claimStars()), []);
  s.city.tiles = [];
  assert.deepEqual(plain(a.starsEarned()), ['verdure']);
  assert.equal(s.coins, coins + 10e6);
});

// Une ville amorcée pour les souhaits : date de création fixe, aucune minute (haie, potager… pas encore débloqués).
function wishTown(list) {
  const a = app();
  a.state.createdAt = Date.parse('2026-05-04T09:00:00Z');
  a.state.city = cityOf(list);
  return a;
}
const put = (a, item, x, y) => a.state.city.tiles.push({ id: 'p' + x + y, item, x, y, at: T0, paid: 0 });

test('souhaits : candidats — décors aimés, débloqués, absents, avec une case libre', () => {
  assert.deepEqual(plain(wishTown([['maison', 3, 3], ['banc', 2, 3]]).wishCandidates()), [{ tile: 't0', item: 'fleurs' }]);
  const ring = [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]].map(([x, y]) => ['chemin', x, y]);
  assert.deepEqual(plain(wishTown([['maison', 1, 1], ...ring]).wishCandidates()), []);
});

test('ambiance : le garde-fou garde le son tel quel sous 0,6 et toutes ses crêtes sous 0,9', () => {
  const curve = loadApp(['00-core.js', '51-ambience.js'], { expose: ['SOFT_LIMIT'] }).SOFT_LIMIT, n = curve.length;
  curve.forEach((y, i) => {
    const x = i / (n - 1) * 2 - 1;
    if (Math.abs(x) <= .6) assert.ok(Math.abs(y - x) < 1e-6, x + ' → ' + y);
    assert.ok(Math.abs(y) < .9 && (!i || y > curve[i - 1]), x + ' → ' + y);
  });
});

test('souhaits : un jour sans souhait possible, la recherche attend que la ville change', () => {
  const ring = [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]].map(([x, y]) => ['chemin', x, y]);
  const a = wishTown([['maison', 1, 1], ...ring]), s = a.state;
  let searches = 0;
  s.city.tiles = new Proxy(s.city.tiles, { get(target, key, receiver) { if (key === 'filter') searches++; return Reflect.get(target, key, receiver); } });
  assert.deepEqual([a.drawTownWish('2026-10-20'), a.drawTownWish('2026-10-20')], [false, false]);
  assert.equal(searches, 1);
  // Un chemin enlevé et enregistré (nouvelle révision) : la maison a une case libre, le souhait vient le jour même.
  s.city.tiles = s.city.tiles.filter(tile => !(tile.x === 2 && tile.y === 2));
  s.revision = 'apres';
  assert.equal(a.drawTownWish('2026-10-20'), true);
});

test('souhaits : même tirage pour un même jour, un seul par jour', () => {
  const list = [['maison', 1, 1], ['bibliotheque', 5, 5], ['kiosque', 1, 5]];
  const a = wishTown(list), b = wishTown(list);
  assert.deepEqual([a.drawTownWish('2026-10-20'), b.drawTownWish('2026-10-20')], [true, true]);
  assert.deepEqual(plain(a.state.townWish), plain(b.state.townWish));
  assert.equal(a.state.townWish.day, '2026-10-20');
  assert.equal(a.drawTownWish('2026-10-20'), false);
});

test('souhaits : exaucé par un décor en diagonale, 3 M une fois, le suivant le lendemain', () => {
  const a = wishTown([['maison', 3, 3]]), s = a.state;
  assert.equal(a.drawTownWish('2026-10-20'), true);
  const item = s.townWish.item, coins = s.coins;
  assert.ok(['fleurs', 'banc'].includes(item), item);
  assert.equal(a.claimTownWish(), null);
  put(a, item, 4, 4);
  assert.deepEqual(plain(a.claimTownWish()), { tile: 't0', item, day: '2026-10-20', building: 'maison', paid: true });
  assert.equal(s.coins, coins + 3e6);
  assert.ok(s.gifts['wish:2026-10-20'] > 0 && s.townWish.done > 0);
  assert.equal(a.claimTownWish(), null);
  assert.equal(s.coins, coins + 3e6);
  assert.deepEqual([a.drawTownWish('2026-10-20'), a.drawTownWish('2026-10-21')], [false, true]);
  assert.equal(s.townWish.day, '2026-10-21');
});

test('souhaits : « Pas maintenant », bâtiment démoli, réglage coupé', () => {
  const a = wishTown([['maison', 1, 1], ['bibliotheque', 5, 5]]), s = a.state;
  a.drawTownWish('2026-10-20');
  assert.equal(a.skipTownWish(), true);
  assert.equal(s.townWish.skipped, true);
  assert.equal(a.townWishTile(), null);
  assert.deepEqual([a.drawTownWish('2026-10-20'), a.drawTownWish('2026-10-21')], [false, true]);
  // Le bâtiment qui souhaite est démoli : plus de souhait ce jour-là, un autre le lendemain.
  s.city.tiles = s.city.tiles.filter(tile => tile.id !== s.townWish.tile);
  assert.equal(a.townWishTile(), null);
  assert.deepEqual([a.drawTownWish('2026-10-21'), a.drawTownWish('2026-10-22')], [false, true]);
  s.settings.townWishes = false;
  assert.deepEqual([a.townWishTile(), a.claimTownWish(), a.drawTownWish('2026-10-23')], [null, null, false]);
});

test('souhaits : le bâtiment déplacé emporte son souhait', () => {
  const a = wishTown([['maison', 1, 1]]), s = a.state;
  a.drawTownWish('2026-10-20');
  const item = s.townWish.item;
  Object.assign(s.city.tiles[0], { x: 5, y: 5 });
  put(a, item, 0, 0);
  assert.equal(a.claimTownWish(), null);
  put(a, item, 6, 6);
  assert.equal(plain(a.claimTownWish()).tile, 't0');
});

// Un souhait exaucé sans cadeau (d'un jour antérieur au dernier souhait récompensé, voir clock.test.cjs) n'a rien à fêter : ni « +3 M »
// annoncé, ni étincelles, et il ne compte pas comme une nouvelle (le message de la pose reste). Il est tout de même rangé. Payé, il est fêté.
test('souhaits : exaucé sans cadeau, rien n’est annoncé', () => {
  const grant = rewarded => {
    const calls = [], sparkles = [];
    const a = loadApp([...FILES, '52-carnet.js'], { expose: [...EXPOSE, 'noticeProgress', 'hasNews', 'celebrate'], now: '2026-10-21T10:00:00Z',
      globals: { toast: msg => calls.push(msg), City: { sparkle: tiles => sparkles.push(...tiles) }, Chime: { place() {} } } });
    const s = a.state;
    s.clock.tz = 'Europe/Zurich'; s.clock.maxSeen = 0;
    s.createdAt = Date.parse('2026-05-04T09:00:00Z');
    s.city = cityOf([['maison', 3, 3]]);
    s.townWish = { day: '2026-10-21', tile: 't0', item: 'fleurs' };
    s.gifts['wish:' + rewarded] = T0;
    const coins = s.coins;
    put(a, 'fleurs', 4, 3);
    const fresh = a.noticeProgress();
    a.celebrate(fresh);
    return { a, s, coins, fresh, calls, sparkles };
  };
  // Le dernier souhait récompensé date du 25 (une heure avancée, puis remise) : celui du 21 est exaucé sans cadeau.
  const refused = grant('2026-10-25');
  assert.equal(refused.fresh.townWish, null);
  assert.equal(refused.a.hasNews({ townWish: refused.fresh.townWish }), false);
  assert.equal(refused.s.coins, refused.coins);
  assert.ok(refused.s.townWish.done > 0, 'souhait rangé');
  assert.equal(refused.s.gifts['wish:2026-10-21'], undefined);
  assert.deepEqual(refused.calls.filter(msg => /Souhait exaucé/.test(msg)), []);
  assert.deepEqual(refused.sparkles, []);
  // Le dernier date du 20 : celui du 21 est payé, annoncé et fêté.
  const paid = grant('2026-10-20');
  assert.deepEqual(plain(paid.fresh.townWish), { tile: 't0', item: 'fleurs', day: '2026-10-21', building: 'maison', paid: true });
  assert.equal(paid.s.coins, paid.coins + 3e6);
  assert.ok(paid.calls.some(msg => /Souhait exaucé · Maison.*\+3\sM/.test(msg)), paid.calls.join(' | '));
  assert.deepEqual(paid.sparkles, ['t0']);
});
