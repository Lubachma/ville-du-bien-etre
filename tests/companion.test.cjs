const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

// Étape 6 : le compagnon (données, règles, mot du jour).
const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js',
  '46-features.js'];
const EXPOSE = ['defaultState', 'normalize', 'merge3', 'clone', 'companionLevelOf'];
const T0 = Date.parse('2026-10-18T12:00:00Z');
function app(now = '2026-10-21T10:00:00Z') {
  const a = loadApp(FILES, { expose: EXPOSE, now });
  a.state.clock.tz = 'Europe/Zurich'; a.state.clock.maxSeen = 0;
  return a;
}
// Un compagnon tel qu'enregistré, avec ce qui change d'un test à l'autre.
const pal = (species, extra = {}) => ({ species, name: 'Pompon', since: T0, minutes: 0, wear: '', ...extra });

test('compagnon : rien par défaut, réglages par défaut et validés', () => {
  const a = app(), d = a.defaultState();
  assert.deepEqual(plain([d.companion, d.companionLater, d.settings.companionShown, d.settings.breathing]), [null, 0, true, false]);
  const s = a.normalize({ settings: { breathing: 'oui', companionShown: 0 }, companionLater: 'hier' });
  assert.deepEqual(plain([s.settings.breathing, s.settings.companionShown, s.companionLater]), [false, true, 0]);
  const k = a.normalize({ settings: { breathing: true, companionShown: false }, companionLater: T0 });
  assert.deepEqual(plain([k.settings.breathing, k.settings.companionShown, k.companionLater]), [true, false, T0]);
});

test('compagnon : validation', () => {
  const a = app(), known = raw => plain(a.normalize({ companion: raw }).companion), zw = String.fromCharCode(0x200b);
  assert.deepEqual(known({ species: 'lapin', name: ' Pompon ', since: T0, minutes: 75, wear: 'bonnet' }), { species: 'lapin', name: 'Pompon', since: T0, minutes: 75, wear: 'bonnet' });
  for (const bad of [pal('chat'), pal('lapin', { since: 'hier' }), 'lapin', null]) assert.equal(known(bad), null, JSON.stringify(bad));
  // Un nom vide, trop long ou sans rien de visible devient '' : l'app montre alors le nom suggéré par l'animal.
  assert.equal(known(pal('lapin', { name: 'W'.repeat(21) })).name, '');
  assert.equal(known(pal('lapin', { name: 'W'.repeat(20) })).name, 'W'.repeat(20));
  assert.equal(known(pal('lapin', { name: ' ' + zw + ' ' })).name, '');
  assert.equal(known(pal('lapin', { name: zw + 'Lune' + zw })).name, 'Lune');
  assert.equal(known(pal('lapin', { name: 42 })).name, '');
  assert.deepEqual([known(pal('ourson', { minutes: -5 })).minutes, known(pal('ourson', { minutes: 'beaucoup' })).minutes], [0, 0]);
  // Un accessoire ne se porte qu'une fois gagné : l'écharpe au niveau 2, le bonnet au niveau 3, la cape au niveau 10.
  assert.deepEqual(['bonnet', 'echarpe'].map(wear => known(pal('marmotte', { minutes: 30, wear })).wear), ['', 'echarpe']);
  assert.deepEqual(['cape', 'licorne'].map(wear => known(pal('marmotte', { minutes: 1800, wear })).wear), ['cape', '']);
});

test('compagnon : niveaux aux seuils', () => {
  const a = app();
  assert.deepEqual([0, 19.9, 20, 59, 60, 1799, 1800, 99999].map(m => a.companionLevelOf(m)), [1, 1, 2, 2, 3, 9, 10, 10]);
});

test('compagnon : fusion de deux onglets', () => {
  const a = app(), B = a.normalize(a.defaultState());
  let L = a.clone(B), R = a.clone(B);
  L.companion = pal('lapin');
  assert.deepEqual([a.merge3(B, L, R).companion.species, a.merge3(B, R, L).companion.species], ['lapin', 'lapin']);
  // Deux compagnons accueillis dans deux onglets : le premier arrivé reste.
  R.companion = pal('ourson', { since: T0 + 1000 });
  assert.deepEqual([a.merge3(B, L, R).companion.species, a.merge3(B, R, L).companion.species], ['lapin', 'lapin']);
  // Le même compagnon : le temps ajouté par chaque onglet s'additionne ; un changement d'un seul côté est gardé.
  const base = a.clone(B);
  base.companion = pal('lapin', { minutes: 20 });
  L = a.clone(base); R = a.clone(base);
  L.companion.minutes = 50; L.companion.name = 'Lune';
  R.companion.minutes = 30; R.companion.wear = 'echarpe';
  const m = plain(a.merge3(base, L, R).companion);
  assert.deepEqual([m.minutes, m.name, m.wear], [60, 'Lune', 'echarpe']);
  // Sans ce compagnon dans la base : le plus grand temps.
  assert.equal(a.merge3(B, L, R).companion.minutes, 50);
  L.companionLater = T0; R.companionLater = T0 + 5;
  assert.equal(a.merge3(B, L, R).companionLater, T0 + 5);
});
