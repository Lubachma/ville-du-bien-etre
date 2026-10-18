const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js'];
const app = () => loadApp(FILES, { expose: ['ACHIEVEMENTS', 'SETS', 'NATURE_ITEMS', 'ITEMS', 'DICT', 'normalize', 'defaultState', 'merge3', 'clone', 'setLang', 'lockInfo'] });
const T0 = 1.8e12;
// Base commune B, et deux copies : L (cet onglet) et R (l'autre).
function towns(a, tiles, coins = 2e9) {
  const B = a.normalize({ ...a.defaultState(), coins, city: { size: 7, tiles } });
  return [B, a.clone(B), a.clone(B)];
}

test('38 succès, 12 ensembles, et leurs textes dans chaque langue', () => {
  const a = app();
  assert.equal(new Set(a.ACHIEVEMENTS.map(x => x.id)).size, 38);
  assert.equal(a.SETS.length, 12);
  for (const lang of Object.keys(a.DICT)) {
    for (const x of a.ACHIEVEMENTS) for (const k of ['name', 'desc']) assert.ok(a.DICT[lang]['ach.' + x.id + '.' + k], lang + ' ' + x.id + ' ' + k);
    assert.ok(a.DICT[lang]['ach.sur-ta-lancee.descHidden'], lang);
    for (const s of a.SETS) assert.ok(a.DICT[lang]['set.' + s.id + '.name'], lang + ' ' + s.id);
    for (const w of ['grandarbre', 'phare', 'granderoue']) for (let i = 1; i <= 4; i++) assert.ok(a.DICT[lang]['wonder.' + w + '.stage' + i], lang + ' ' + w + i);
  }
  for (const s of a.SETS) for (const item of s.items) assert.ok(a.ITEMS[item], s.id + ' ' + item);
  for (const [key, it] of Object.entries(a.ITEMS)) if (it.reward) assert.equal(a.ACHIEVEMENTS.find(x => x.id === it.reward).reward, key, key);
  for (const item of a.NATURE_ITEMS) assert.ok(a.ITEMS[item], item);
  a.setLang('fr');
  assert.match(a.lockInfo('cadran').text, /Lève-tôt/);
});

test('normalize : succès et ensembles connus, dates valides', () => {
  const a = app();
  const s = a.normalize({ achievements: { 'leve-tot': T0, inconnu: T0, hameau: 'hier', 'cent-heures': 12 }, sets: { cocon: T0, autre: T0 } });
  assert.deepEqual(plain([s.achievements, s.sets]), [{ 'leve-tot': T0 }, { cocon: T0 }]);
  assert.deepEqual(plain([a.defaultState().achievements, a.defaultState().sets]), [{}, {}]);
});

test("normalize : étape bornée, prix payé recalculé, une seule merveille de chaque", () => {
  const a = app();
  const s = a.normalize({ city: { size: 7, tiles: [
    { id: 'w1', item: 'phare', x: 0, y: 0, at: T0, stage: 7, paid: 1 },
    { id: 'w2', item: 'phare', x: 1, y: 0, at: T0 - 1, stage: 2 },
    { id: 'w3', item: 'grandarbre', x: 2, y: 0, at: T0 },
    { id: 'b1', item: 'banc', x: 3, y: 0, at: T0, stage: 3 }] } });
  const by = Object.fromEntries(s.city.tiles.map(tile => [tile.id, tile]));
  assert.deepEqual([by.w1.stage, by.w1.paid, by.w2, by.w3.stage, by.w3.paid, 'stage' in by.b1], [4, 1.7e9, undefined, 1, 200e6, false]);
});

test('fusion : succès additionnés, date la plus ancienne, rien ne revient après une remise à zéro', () => {
  const a = app(), [B, L, R] = towns(a, []);
  B.achievements = { hameau: T0 };
  L.achievements = { hameau: T0, 'leve-tot': T0 + 50 };
  R.achievements = { 'leve-tot': T0 + 10 };          // l'autre onglet a tout recommencé, puis obtenu Lève-tôt
  L.sets = { cocon: T0 + 5 }; R.sets = { cocon: T0 + 9 };
  const M = a.merge3(B, L, R);
  assert.deepEqual(plain([M.achievements, M.sets]), [{ 'leve-tot': T0 + 10 }, { cocon: T0 + 5 }]);
});

test("fusion : une merveille déplacée ici et agrandie là garde les deux changements", () => {
  const a = app(), [B, L, R] = towns(a, [{ id: 'w', item: 'grandarbre', x: 2, y: 2, at: T0, stage: 1 }]);
  L.city.tiles[0].x = 4; L.city.tiles[0].y = 4;
  R.city.tiles[0].stage = 2; R.coins -= 250e6;
  const M = a.merge3(B, L, R);
  assert.deepEqual([M.city.tiles[0].x, M.city.tiles[0].y, M.city.tiles[0].stage, M.coins], [4, 4, 2, 2e9 - 250e6]);
});

test('fusion : une étape payée deux fois est remboursée une fois', () => {
  const a = app(), [B, L, R] = towns(a, [{ id: 'w', item: 'grandarbre', x: 2, y: 2, at: T0, stage: 1 }]);
  for (const s of [L, R]) { s.city.tiles[0].stage = 2; s.coins -= 250e6; }
  const M = a.merge3(B, L, R);
  assert.deepEqual([M.city.tiles[0].stage, M.coins], [2, 2e9 - 250e6]);
});

test('fusion : une même merveille commencée deux fois, la plus avancée reste', () => {
  const a = app(), [B, L, R] = towns(a, []);
  L.city.tiles.push({ id: 'a', item: 'phare', x: 1, y: 1, at: T0, stage: 2, paid: 750e6 }); L.coins -= 750e6;
  R.city.tiles.push({ id: 'b', item: 'phare', x: 5, y: 5, at: T0 + 1, stage: 1, paid: 350e6 }); R.coins -= 350e6;
  const M = a.merge3(B, L, R);
  assert.deepEqual(plain(M.city.tiles.filter(tile => tile.item === 'phare').map(tile => [tile.id, tile.stage])), [['a', 2]]);
  assert.equal(M.coins, 2e9 - 750e6);
});

test("étape d'une merveille : bornée par son propre nombre d'étapes", () => {
  const a = app();
  a.ITEMS.phare.wonder.push([5000, 550e6]);                                     // une cinquième étape
  const st = a.defaultState();
  st.city.tiles = [{ id: 'p', item: 'phare', x: 0, y: 0, at: T0, stage: 5, paid: 0 }, { id: 'g', item: 'grandarbre', x: 1, y: 0, at: T0, stage: 9, paid: 0 }];
  assert.deepEqual(plain(a.normalize(st).city.tiles.map(tile => tile.stage)), [5, 4]);
});
