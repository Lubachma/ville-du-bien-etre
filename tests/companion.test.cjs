const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

// Étape 6 : le compagnon (données, règles, mot du jour).
const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js',
  '28-harmony.js', '29-companion.js', '46-features.js'];
const EXPOSE = ['defaultState', 'normalize', 'merge3', 'clone', 'companionLevelOf', 'setLang', 'achievementMet', 'achievementProgress',
  'companionLevel', 'companionNext', 'wearUnlocked', 'companionName', 'adoptCompanion', 'editCompanion', 'addCompanionMinutes', 'wearCompanion',
  'companionInvite', 'companionPose', 'checkAchievements', 'lockInfo', 'ITEMS', 'NATURE_ITEMS', 'companionWord', 'chance', 'dayWeather', 'seasonOf', 'visitorOf', 'festivalsOn', 'shiftDay', 't', 'DICT'];
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

// Étape 7 (C4) : le même nettoyage que les noms de ville. Les caractères invisibles s'écrivent \u{…}.
test('compagnon : un nom sans rien de visible donne la suggestion de l’animal', () => {
  const a = app(), known = raw => plain(a.normalize({ companion: raw }).companion);
  a.setLang('fr');
  for (const hidden of ['\u{2800}', '\u{3164}', '\u{115f}\u{1160}', '\u{ffa0}', '\u{2028}', '\u{E0041}', '\u{ad}', '\u{FE0F}', '\u{FE0E}\u{200D}']) {
    assert.equal(known(pal('lapin', { name: hidden })).name, '', JSON.stringify(hidden));
    a.adoptCompanion('lapin', hidden);
    assert.deepEqual([a.state.companion.name, a.companionName()], ['', 'Pompon'], JSON.stringify(hidden));
    a.editCompanion('ourson', hidden);
    assert.deepEqual([a.state.companion.name, a.companionName()], ['', 'Caramel'], JSON.stringify(hidden));
  }
  // Les invisibles à l'intérieur d'un nom s'en vont, les blancs en série n'en font qu'un, un émoji reste entier.
  assert.equal(known(pal('lapin', { name: 'Lu\u{200b}ne\u{2800}' })).name, 'Lune');
  assert.equal(known(pal('lapin', { name: ' Petit   Lu\u{2028}ne ' })).name, 'Petit Lune');
  assert.equal(known(pal('lapin', { name: 'Lune 🌙' })).name, 'Lune 🌙');
  assert.equal(known(pal('lapin', { name: 'Lune \u{2764}\u{FE0F}' })).name, 'Lune \u{2764}\u{FE0F}');
  // Vingt points de code au plus : 20 émojis (40 unités) tiennent, un 21e fait revenir la suggestion.
  assert.equal(known(pal('lapin', { name: '🌙'.repeat(20) })).name, '🌙'.repeat(20));
  assert.equal(known(pal('lapin', { name: '🌙'.repeat(21) })).name, '');
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

// Un jour où le mot du jour tombe sur la place k (sur 14), cherché dans l'ordre à partir de « from », et qui remplit « ok ».
function dayFor(a, k, ok = () => true, from = '2026-01-01', days = 6000) {
  for (let i = 0; i < days; i++) {
    const day = a.shiftDay(from, i);
    if (Math.floor(a.chance(day + ':compagnon') * 14) === k && ok(day)) return day;
  }
  throw new Error('aucun jour pour la place ' + k);
}
const entry = (day, cat, extra = {}) => ({ id: 'h' + day + cat, name: 'Lecture', cat, min: 10, mode: 'focus', elapsedSec: 600, ok: true, reward: 0, at: Date.parse(day + 'T08:00:00Z'), day, ...extra });

test('mot du jour : le même toute la journée, un autre jour peut changer', () => {
  const a = app();
  assert.equal(a.companionWord('2026-10-20'), '');
  a.adoptCompanion('lapin', '');
  const word = a.companionWord('2026-10-20');
  assert.ok(word.length > 10, word);
  assert.equal(a.companionWord('2026-10-20'), word);
  a.setLang('en');
  assert.ok(a.companionWord('2026-10-20').length > 10);
  assert.notEqual(a.companionWord('2026-10-20'), word);
  a.setLang('fr');
  const month = new Set(Array.from({ length: 30 }, (_, i) => a.companionWord(a.shiftDay('2026-10-01', i))));
  assert.ok(month.size >= 5, [...month].join(' | '));
});

test('mot du jour : le retour passe en premier', () => {
  // Arrivée le 21 octobre (l'horloge de l'app) ; les séances d'avant ne comptent pas.
  const a = app();
  a.adoptCompanion('lapin', '');
  a.state.history = [entry('2026-10-22', 'esprit')];
  assert.equal(a.companionWord('2026-10-25'), a.t('companion.word.back'));
  a.state.history = [entry('2026-10-23', 'esprit'), entry('2026-10-18', 'corps')];
  assert.notEqual(a.companionWord('2026-10-25'), a.t('companion.word.back'));
  // Une séance interrompue sans rien de fait ne compte pas ; avec du temps fait, si.
  a.state.history = [entry('2026-10-24', 'calme', { ok: false, elapsedSec: 0 }), entry('2026-10-21', 'corps')];
  assert.equal(a.companionWord('2026-10-25'), a.t('companion.word.back'));
  a.state.history = [entry('2026-10-24', 'calme', { ok: false, elapsedSec: 240 })];
  assert.notEqual(a.companionWord('2026-10-25'), a.t('companion.word.back'));
});

test('mot du jour : chaque contexte a sa phrase', () => {
  const a = app();
  a.adoptCompanion('lapin', '');
  // Place 0 : le domaine de la dernière séance d'hier (faite avec le compagnon, arrivé le 21 octobre) ; sans séance hier, une petite
  // phrase.
  let day = dayFor(a, 0, () => true, '2026-10-22');
  a.state.history = [entry(a.shiftDay(day, -1), 'calme'), entry(a.shiftDay(day, -1), 'corps', { at: Date.parse(a.shiftDay(day, -1) + 'T06:00:00Z') })];
  assert.equal(a.companionWord(day), a.t('companion.word.cat.calme'));
  a.state.history = [entry(a.shiftDay(day, -2), 'calme')];
  assert.equal(a.companionWord(day), a.t('companion.word.small1'));
  // Les autres places : une séance la veille (sur le domaine Corps), pour qu'un jour d'après l'arrivée ne soit pas un retour.
  const word = d => { a.state.history = [entry(a.shiftDay(d, -1), 'corps')]; return a.companionWord(d); };
  // Places 1 et 2 : la météo et la saison du jour.
  day = dayFor(a, 1);
  assert.equal(word(day), a.t('companion.word.weather.' + a.dayWeather(day)));
  day = dayFor(a, 2);
  assert.equal(word(day), a.t('companion.word.season.' + a.seasonOf(day)));
  // Place 3 : le visiteur du jour (au pluriel pour les canards).
  day = dayFor(a, 3, d => !!a.visitorOf(d));
  const v = a.visitorOf(day);
  assert.equal(word(day), a.t('companion.word.visitor', { visitor: a.t('visitor.' + v.id + '.name'), n: v.id === 'canards' ? 2 : 1 }));
  // Place 4 : le souhait en cours, dont la bulle est dans la ville ; exaucé, laissé de côté ou réglage coupé, une petite phrase.
  day = dayFor(a, 4);
  a.state.city.tiles.push({ id: 't1', item: 'maison', x: 5, y: 5, at: T0, paid: 0 });
  a.state.townWish = { day, tile: 't1', item: 'banc' };
  assert.equal(word(day), a.t('companion.word.wish'));
  for (const [wish, setting] of [[{ done: T0 }, true], [{ skipped: true }, true], [{}, false]]) {
    a.state.townWish = { day, tile: 't1', item: 'banc', ...wish };
    a.state.settings.townWishes = setting;
    assert.equal(word(day), a.t('companion.word.small5'), JSON.stringify([wish, setting]));
  }
  a.state.settings.townWishes = true;
  a.state.townWish = { day, tile: 'disparu', item: 'banc' };
  assert.equal(word(day), a.t('companion.word.small5'));
  a.state.townWish = null;
  // Place 5 : une fête du jour.
  day = dayFor(a, 5, d => a.festivalsOn(d).length > 0);
  assert.equal(word(day), a.t('companion.word.festival', { name: a.t('fest.' + a.festivalsOn(day)[0].id + '.name') }));
  // Places 6 à 13 : les huit petites phrases.
  for (let k = 6; k < 14; k++) assert.equal(word(dayFor(a, k)), a.t('companion.word.small' + (k - 5)));
});

test('mot du jour : jamais un reproche ni un accord', () => {
  const a = app(), texts = lang => Object.entries(a.DICT[lang]).filter(([key]) => key.startsWith('companion.word.'))
    .flatMap(([, v]) => (typeof v === 'string' ? [v] : Object.values(v)));
  assert.ok(texts('fr').length >= 26 && texts('en').length >= 26);
  for (const text of texts('fr')) assert.doesNotMatch(text, /triste|ennuie|manqu|attend|content|ravi|heureu|fier|fière|seul|perdu/i, text);
  for (const text of texts('en')) assert.doesNotMatch(text, /sad|bored|miss|waiting|lonely|\bhe\b|\bshe\b|lost/i, text);
});

test('compagnon : trois succès et la Cabane', () => {
  const a = app();
  assert.deepEqual(plain(a.ITEMS.cabane), { ...plain(a.ITEMS.cabane), group: 'decor', price: 3e6, reward: 'inseparables' });
  assert.equal(a.NATURE_ITEMS.includes('cabane'), false);
  const fresh = () => plain(a.checkAchievements()).filter(id => ['premiere-rencontre', 'complices', 'inseparables'].includes(id));
  assert.deepEqual(fresh(), []);
  a.adoptCompanion('lapin', '');
  assert.deepEqual(fresh(), ['premiere-rencontre']);
  assert.ok(a.lockInfo('cabane'));
  a.addCompanionMinutes(239);
  assert.deepEqual(fresh(), []);
  a.addCompanionMinutes(1);
  assert.deepEqual(fresh(), ['complices']);
  a.addCompanionMinutes(1559);
  assert.deepEqual(fresh(), []);
  a.addCompanionMinutes(1);
  assert.deepEqual(fresh(), ['inseparables']);
  assert.equal(a.lockInfo('cabane'), null);
});

test('mot du jour : pas de « Quelle joie de te revoir ! » le jour de l’arrivée, ni pour les séances d’avant', () => {
  // Arrivée le 21 octobre (l'horloge de l'app), dernière séance le 10 : rien ne compte avant l'arrivée.
  const a = app(), back = () => a.t('companion.word.back');
  a.state.history = [entry('2026-10-10', 'esprit')];
  a.adoptCompanion('lapin', '');
  assert.notEqual(a.companionWord('2026-10-21'), back());
  assert.notEqual(a.companionWord('2026-10-23'), back());
  // Trois jours après l'arrivée, sans séance depuis : le retour.
  assert.equal(a.companionWord('2026-10-24'), back());
  // Une séance le 22 : le 24, ce n'est pas encore un retour ; le 25, si.
  a.state.history.unshift(entry('2026-10-22', 'corps'));
  assert.notEqual(a.companionWord('2026-10-24'), back());
  assert.equal(a.companionWord('2026-10-25'), back());
});
