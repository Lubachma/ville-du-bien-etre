const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '46-features.js'];
function app() {
  const a = loadApp(FILES, { expose: ['wonderTile', 'wonderNext', 'buildWonderStage', 'nextUnlock', 'weekCats'] });
  a.state.clock.tz = 'UTC';
  return a;
}
function withWonder(a, item, stage, calme, coins) {
  a.state.city.tiles.push({ id: 'w-' + item, item, x: 0, y: 0, at: Date.now(), stage, paid: 0 });
  a.state.stats.byCat.calme = calme; a.state.coins = coins;
  return a.state.city.tiles.at(-1);
}

test("étape suivante : minutes totales et pièces, au seuil exact", () => {
  const a = app(), tile = withWonder(a, 'grandarbre', 1, 1799, 250e6);
  assert.deepEqual(plain(a.wonderNext(tile)), { stage: 2, need: 1800, have: 1799, price: 250e6, ready: false, affordable: true });
  assert.equal(a.buildWonderStage(tile), false);
  a.state.stats.byCat.calme = 1800; a.state.coins = 250e6 - 1;
  assert.equal(a.wonderNext(tile).affordable, false);
  assert.equal(a.buildWonderStage(tile), false);
  a.state.coins = 250e6;
  assert.equal(a.buildWonderStage(tile), true);
  assert.deepEqual([tile.stage, tile.paid, a.state.coins], [2, 450e6, 0]);
});

test("après l'inauguration, plus d'étape", () => {
  const a = app(), tile = withWonder(a, 'grandarbre', 4, 9999, 9e9);
  assert.equal(a.wonderNext(tile), null);
  assert.equal(a.buildWonderStage(tile), false);
  assert.equal(a.wonderTile('grandarbre'), tile);
  assert.equal(a.wonderTile('phare'), null);
});

test("prochain objectif : l'étape de merveille quand elle est la plus proche", () => {
  const a = app();
  Object.assign(a.state.stats.byCat, { esprit: 1600, corps: 1600, calme: 1600, foyer: 1600, crea: 1000 });
  a.state.city.tiles.push({ id: 'r', item: 'granderoue', x: 0, y: 0, at: Date.now(), stage: 3, paid: 0 });
  const next = a.nextUnlock();
  assert.deepEqual([next.key, next.stage, next.rem], ['granderoue', 4, 200]);
});

test('Grand Arbre : les domaines pratiqués cette semaine', () => {
  const a = app();      // dimanche 18 octobre 2026, semaine du lundi 12
  a.state.stats.dailyCats = { '2026-10-11': { corps: 10 }, '2026-10-12': { esprit: 5 }, '2026-10-18': { calme: 10, crea: 0 } };
  assert.deepEqual(plain(a.weekCats()), ['esprit', 'calme']);
});
