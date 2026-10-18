const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/app.cjs');
const { fakeContext } = require('./helpers/fake-canvas.cjs');

const PAINT = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '46-features.js', '30-paint.js'];
const PALETTE = { night: false, esprit: '#3f78c4', corps: '#d9573b', calme: '#3a9a7a', foyer: '#e3a12f', crea: '#d0628f', prestige: '#b8862b', decor: '#7a8b6e', accent: '#2e6f4e', danger: '#b4452e' };
const app = extra => loadApp([...PAINT, ...extra], { expose: ['ITEMS', 'DRAW', 'makePainter'] });
// Une case de 100 px dont le sommet est en (200, 200) : centre en (200, 225), bas en 250.
function paint(a, key, { night = false, stage } = {}) {
  const ctx = fakeContext();
  a.DRAW[key](a.makePainter(ctx, 100, 200, 200, { ...PALETTE, night }), 0, 0, stage ? { stage } : undefined);
  return ctx.points;
}
// La case elle-même monte à 0,25 largeur au-dessus de son centre : un élément au sol peut donc avoir un hf plus petit.
function assertInTile(a, key, stage) {
  const points = paint(a, key, { stage }), top = 225 - Math.max(a.ITEMS[key].hf, .25) * 100 - 2, label = key + (stage ? ' étape ' + stage : '');
  assert.ok(points.length > 0, label + ' ne dessine rien');
  for (const [x, y] of points) {
    assert.ok(x >= 148 && x <= 252, `${label} déborde sur le côté : x=${x.toFixed(1)}`);
    assert.ok(y >= top && y <= 254, `${label} déborde : y=${y.toFixed(1)}, haut permis ${top}`);
  }
  assert.doesNotThrow(() => paint(a, key, { night: true, stage }), label + ' de nuit');
}
const BUILDINGS = ['lavoir', 'moulin', 'marche', 'musee', 'universite', 'planetarium', 'skatepark', 'escalade', 'gymnase',
  'labyrinthe', 'source', 'pagode', 'galerie', 'cinema', 'chapiteau'];

test('les 15 bâtiments se dessinent dans leur case, de jour comme de nuit', () => {
  const a = app(['31-paint-buildings.js']);
  for (const key of BUILDINGS) assertInTile(a, key);
});

const DECOR = ['haie', 'cerisier', 'livres', 'lanterne', 'potager', 'cadran', 'pasjaponais', 'fanions', 'nichoir', 'statue'];
test('les 10 décors se dessinent dans leur case, de jour comme de nuit', () => {
  const a = app(['31-paint-buildings.js', '32-paint-decor.js']);
  for (const key of DECOR) assertInTile(a, key);
});

test('les merveilles se dessinent dans leur case à chaque étape, et chaque élément a son dessin', () => {
  const a = app(['31-paint-buildings.js', '32-paint-decor.js', '33-paint-wonders.js']);
  for (const key of ['grandarbre', 'phare', 'granderoue']) for (const stage of [1, 2, 3, 4]) assertInTile(a, key, stage);
  assert.deepEqual(Object.keys(a.ITEMS).filter(key => typeof a.DRAW[key] !== 'function'), []);
});

test('chantier de pose : un échafaudage pour les bâtiments, pas pour le décor, le sol ni les merveilles', () => {
  const a = loadApp(PAINT, { expose: ['scaffoldOnBuild'] });
  const keys = ['maison', 'musee', 'stade', 'arbre', 'banc', 'chemin', 'piscine', 'skatepark', 'grandarbre'];
  assert.deepEqual(keys.map(key => a.scaffoldOnBuild(key)), [true, true, true, false, false, false, false, false, false]);
});

module.exports = { app, assertInTile, paint };
