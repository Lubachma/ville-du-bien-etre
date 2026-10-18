const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js'];
const app = () => loadApp(FILES, { expose: ['formedSets', 'pavedTileIds', 'discoverSets'] });
const T0 = Date.parse('2026-10-18T12:00:00Z');
function town(a, list, size = 7) {
  a.state.city = { size, tiles: list.map(([item, x, y], i) => ({ id: item + i, item, x, y, at: T0, paid: 0, ...(item === 'granderoue' ? { stage: 1 } : {}) })) };
}

test('un ensemble : ses trois éléments dans un même carré de 3 × 3', () => {
  const a = app();
  town(a, [['bibliotheque', 0, 0], ['banc', 2, 2], ['arbre', 1, 0]]);
  assert.deepEqual([...a.formedSets().keys()], ['coin-lecture']);
  town(a, [['bibliotheque', 0, 0], ['banc', 3, 0], ['arbre', 1, 1]]);
  assert.equal(a.formedSets().size, 0);
  town(a, [['bibliotheque', 4, 4], ['banc', 6, 6], ['arbre', 5, 6]]);
  assert.ok(a.formedSets().has('coin-lecture'));
});

test('pièces en double, élément partagé, merveille en chantier', () => {
  const a = app();
  town(a, [['arbre', 6, 0], ['bibliotheque', 2, 2], ['banc', 3, 3], ['arbre', 4, 2], ['kiosque', 1, 3], ['lampadaire', 2, 4]]);
  const found = a.formedSets();
  assert.ok(found.has('coin-lecture') && found.has('place-concert'));
  assert.deepEqual([...found.get('coin-lecture')].sort(), ['arbre3', 'banc2', 'bibliotheque1']);
  town(a, [['chapiteau', 0, 0], ['granderoue', 1, 1], ['lampadaire', 2, 0]]);
  assert.ok(a.formedSets().has('fete-foraine'));
});

test('pavage : seulement les éléments des ensembles formés', () => {
  const a = app();
  town(a, [['bibliotheque', 0, 0], ['banc', 1, 0], ['arbre', 0, 1], ['etang', 6, 6]]);
  assert.deepEqual([...a.pavedTileIds()].sort(), ['arbre2', 'banc1', 'bibliotheque0']);
});

test('découverte unique, gardée quand on défait ou démolit', () => {
  const a = app();
  town(a, [['bibliotheque', 0, 0], ['banc', 1, 0], ['arbre', 0, 1]]);
  assert.deepEqual(plain(a.discoverSets(T0)), ['coin-lecture']);
  assert.deepEqual(plain(a.discoverSets(T0 + 1)), []);
  a.state.city.tiles = a.state.city.tiles.filter(tile => tile.item !== 'banc');
  assert.equal(a.pavedTileIds().size, 0);
  a.state.city.tiles.push({ id: 'loin', item: 'banc', x: 6, y: 6, at: T0, paid: 0 });
  assert.equal(a.formedSets().size, 0);
  assert.deepEqual(plain(a.state.sets), { 'coin-lecture': T0 });
});
