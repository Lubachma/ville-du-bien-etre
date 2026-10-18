const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '46-features.js'];
const app = () => loadApp(FILES, { expose: ['ITEMS', 'lockInfo', 'priceOf', 'nextUnlock', 'collectionCount', 'nextInGroup', 'isRevealed',
  'isWonder', 'wonderPaid', 'buildingLevelInfo', 'setLang', 'itemName', 'itemGender'] });
const practice = (a, byCat) => Object.assign(a.state.stats.byCat, byCat);
const ORIGINAL = { arbre: [2e6], fleurs: [1e6], chemin: [5e5], banc: [2e6], lampadaire: [3e6], etang: [6e6], maison: [5e6, 0],
  boulangerie: [15e6, 1], serre: [180e6, 120], bibliotheque: [10e6, 1], ecole: [90e6, 60], observatoire: [450e6, 300], terrain: [10e6, 1],
  piscine: [140e6, 90], stade: [600e6, 400], jardin: [8e6, 1], fontaine: [70e6, 45], pavillon: [230e6, 150], kiosque: [10e6, 1],
  atelier: [90e6, 60], theatre: [360e6, 240], horloge: [1.5e9, undefined, 1000] };
const BUILDINGS = { foyer: ['lavoir', 'moulin', 'marche'], esprit: ['musee', 'universite', 'planetarium'], corps: ['skatepark', 'escalade', 'gymnase'],
  calme: ['labyrinthe', 'source', 'pagode'], crea: ['galerie', 'cinema', 'chapiteau'] };

test("les 22 éléments d'origine gardent leurs prix et leurs seuils", () => {
  const { ITEMS } = app();
  for (const [key, [price, need, needTotal]] of Object.entries(ORIGINAL)) {
    assert.deepEqual([ITEMS[key].price, ITEMS[key].need, ITEMS[key].needTotal], [price, need, needTotal], key);
  }
});

test('15 bâtiments : 500, 1 000 et 1 600 min du domaine, pour 250, 450 et 700 M', () => {
  const { ITEMS } = app();
  for (const [cat, keys] of Object.entries(BUILDINGS)) keys.forEach((key, i) => {
    assert.deepEqual([ITEMS[key].group, ITEMS[key].need, ITEMS[key].price], [cat, [500, 1000, 1600][i], [250e6, 450e6, 700e6][i]], key);
  });
  for (const key of ['skatepark', 'labyrinthe', 'potager', 'pasjaponais']) assert.equal(ITEMS[key].ground, true, key);
  assert.equal(Object.keys(ITEMS).length, 50);
});

test('décors : minutes totales, ou succès pour les décors offerts', () => {
  const a = app();
  const decor = { haie: [30, 1e6], cerisier: [90, 3e6], livres: [150, 2e6], lanterne: [240, 3e6], potager: [360, 2e6] };
  for (const [key, [needTotal, price]] of Object.entries(decor)) assert.deepEqual([a.ITEMS[key].group, a.ITEMS[key].needTotal, a.ITEMS[key].price], ['decor', needTotal, price], key);
  const gifts = { cadran: 'leve-tot', pasjaponais: 'petit-a-petit', fanions: 'semaine-equilibree', nichoir: 'main-verte', statue: 'cent-heures' };
  for (const [key, id] of Object.entries(gifts)) {
    assert.equal(a.ITEMS[key].reward, id, key);
    assert.ok(a.ITEMS[key].price >= 2e6 && a.ITEMS[key].price <= 4e6, key);
  }
  practice(a, { esprit: 29 });
  assert.ok(a.lockInfo('haie'));
  practice(a, { esprit: 30 });
  assert.equal(a.lockInfo('haie'), null);
});

test("un décor offert : verrouillé avant son succès, gratuit tant qu'on n'en a aucun", () => {
  const a = app();
  assert.equal(a.lockInfo('cadran').reward, 'leve-tot');
  a.state.achievements = { 'leve-tot': Date.now() };
  assert.equal(a.lockInfo('cadran'), null);
  assert.equal(a.priceOf('cadran'), 0);
  a.state.city.tiles.push({ id: 'c1', item: 'cadran', x: 0, y: 0, at: Date.now(), paid: 0 });
  assert.equal(a.priceOf('cadran'), 3e6);
  a.state.city.tiles = a.state.city.tiles.filter(tile => tile.id !== 'c1');     // démoli : le suivant est de nouveau offert
  assert.equal(a.priceOf('cadran'), 0);
});

test("le prochain objectif n'est jamais un décor offert", () => {
  const a = app();
  practice(a, { esprit: 5000, corps: 5000, calme: 5000, foyer: 5000, crea: 5000 });
  assert.equal(a.nextUnlock(), null);
});

test('merveilles : débloquées aux minutes totales de leur première étape, sans niveau', () => {
  const a = app();
  assert.deepEqual(plain(a.ITEMS.grandarbre.wonder), [[1500, 200e6], [1800, 250e6], [2100, 300e6], [2400, 350e6]]);
  assert.deepEqual(plain(a.ITEMS.phare.wonder), [[3000, 350e6], [3500, 400e6], [4000, 450e6], [4500, 500e6]]);
  assert.deepEqual(plain(a.ITEMS.granderoue.wonder), [[5500, 500e6], [6200, 600e6], [6900, 700e6], [7600, 800e6]]);
  for (const key of ['grandarbre', 'phare', 'granderoue']) assert.deepEqual([a.ITEMS[key].group, a.isWonder(key)], ['prestige', true], key);
  assert.equal(a.isWonder('horloge'), false);
  practice(a, { calme: 1499 });
  assert.ok(a.lockInfo('grandarbre'));
  practice(a, { calme: 1500 });
  assert.equal(a.lockInfo('grandarbre'), null);
  assert.equal(a.priceOf('grandarbre'), 200e6);
  assert.deepEqual([a.wonderPaid('phare', 0), a.wonderPaid('phare', 2), a.wonderPaid('phare', 4)], [0, 750e6, 1.7e9]);
  assert.equal(a.buildingLevelInfo('grandarbre').level, 0);
});

test('collection : les éléments débloqués, sur 50', () => {
  const a = app();
  assert.deepEqual(plain(a.collectionCount()), { have: 7, total: 50 });
  a.state.achievements = { 'leve-tot': Date.now() };
  assert.deepEqual(plain(a.collectionCount()), { have: 8, total: 50 });
});

test('élément dévoilé : débloqué, prochain de sa rubrique ou objectif choisi', () => {
  const a = app();
  assert.deepEqual([a.nextInGroup('decor'), a.nextInGroup('corps'), a.nextInGroup('prestige')], ['haie', 'terrain', 'horloge']);
  assert.deepEqual([a.isRevealed('haie'), a.isRevealed('cerisier'), a.isRevealed('cadran'), a.isRevealed('stade')], [true, false, false, false]);
  a.state.goals.building = 'stade';
  assert.equal(a.isRevealed('stade'), true);
});

test('noms en français et en anglais', () => {
  const a = app();
  a.setLang('fr');
  assert.deepEqual([a.itemName('source'), a.itemGender('source'), a.itemName('granderoue'), a.itemGender('moulin')], ['Source chaude', 'f', 'Grande Roue', 'm']);
  a.setLang('en');
  assert.deepEqual([a.itemName('chapiteau'), a.itemName('granderoue'), a.itemName('lavoir')], ['Big top', 'Big Wheel', 'Wash house']);
});
