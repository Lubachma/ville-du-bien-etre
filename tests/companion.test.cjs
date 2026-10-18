const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

// Étape 6 : le compagnon (données, règles, mot du jour).
const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js',
  '29-companion.js', '46-features.js'];
const EXPOSE = ['defaultState', 'normalize', 'merge3', 'clone', 'companionLevelOf', 'setLang', 'achievementMet', 'achievementProgress',
  'companionLevel', 'companionNext', 'wearUnlocked', 'companionName', 'adoptCompanion', 'editCompanion', 'addCompanionMinutes', 'wearCompanion',
  'companionInvite', 'companionPose'];
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

test('compagnon : arrivée, nom nettoyé, nom suggéré selon la langue', () => {
  const a = app(), c = plain(a.adoptCompanion('lapin', '  Pompon  '));
  assert.deepEqual([c.species, c.name, c.minutes, c.wear, a.companionLevel()], ['lapin', 'Pompon', 0, '', 1]);
  assert.ok(c.since > 0);
  assert.equal(a.adoptCompanion('chat', 'Minou'), null);
  // Jamais renommé : le nom suggéré par l'animal, dans la langue affichée.
  a.adoptCompanion('ourson', '');
  a.setLang('fr');
  assert.equal(a.companionName(), 'Caramel');
  a.setLang('en');
  assert.equal(a.companionName(), 'Toffee');
  a.setLang('fr');
  a.state.companion.minutes = 75;
  const since = a.state.companion.since;
  a.editCompanion('marmotte', 'Mélèze');
  assert.deepEqual(plain(a.state.companion), { species: 'marmotte', name: 'Mélèze', since, minutes: 75, wear: '' });
});

test('compagnon : minutes, niveaux et accessoires', () => {
  const a = app();
  assert.deepEqual([a.addCompanionMinutes(30), a.companionLevel(), a.companionNext()], [null, 0, null]);
  a.adoptCompanion('lapin', 'Pompon');
  assert.equal(a.addCompanionMinutes(0), null);
  assert.deepEqual(plain(a.addCompanionMinutes(25)), { gained: 25, before: 1, after: 2 });
  assert.deepEqual(plain([a.wearUnlocked(1), a.wearUnlocked(2), a.wearUnlocked(10)]),
    [[], ['echarpe'], ['echarpe', 'bonnet', 'lunettes', 'couronne', 'noeud', 'paille', 'sac', 'casque', 'cape']]);
  assert.deepEqual(plain(a.companionNext()), { level: 3, left: 35, wear: 'bonnet' });
  assert.deepEqual([a.wearCompanion('bonnet'), a.state.companion.wear], [false, '']);
  assert.deepEqual([a.wearCompanion('echarpe'), a.state.companion.wear], [true, 'echarpe']);
  assert.deepEqual([a.wearCompanion('licorne'), a.state.companion.wear], [false, 'echarpe']);
  assert.deepEqual([a.wearCompanion(''), a.state.companion.wear], [true, '']);
  a.state.companion.minutes = 1800;
  assert.deepEqual([a.companionLevel(), a.companionNext()], [10, null]);
});

test('compagnon : invitation après une séance réussie, jamais après « Pas maintenant »', () => {
  const a = app();
  a.state.stats.ok = 0;
  assert.equal(a.companionInvite(), false);
  a.state.stats.ok = 1;
  assert.equal(a.companionInvite(), true);
  a.state.companionLater = T0;
  assert.equal(a.companionInvite(), false);
  a.state.companionLater = 0;
  a.adoptCompanion('lapin', '');
  assert.equal(a.companionInvite(), false);
});

test('compagnon : un geste par domaine', () => {
  const a = app();
  assert.deepEqual(['esprit', 'corps', 'calme', 'foyer', 'crea'].map(cat => a.companionPose(cat)), ['read', 'stretch', 'meditate', 'water', 'paint']);
});

test('compagnon : succès d’arrivée et de niveau', () => {
  const a = app(), met = { kind: 'companion', n: 1 }, level = { kind: 'companionLevel', n: 5 };
  assert.deepEqual([a.achievementMet(met), a.achievementMet(level)], [false, false]);
  a.adoptCompanion('lapin', '');
  a.addCompanionMinutes(25);
  assert.deepEqual([a.achievementMet(met), a.achievementMet(level)], [true, false]);
  assert.deepEqual(plain(a.achievementProgress(level)), { have: 2, need: 5, unit: 'n' });
  a.addCompanionMinutes(215);
  assert.equal(a.achievementMet(level), true);
});
