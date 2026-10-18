const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/app.cjs');
const { fakeContext } = require('./helpers/fake-canvas.cjs');

const PAINT = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '46-features.js', '30-paint.js'];
const PALETTE = { night: false, esprit: '#3f78c4', corps: '#d9573b', calme: '#3a9a7a', foyer: '#e3a12f', crea: '#d0628f', prestige: '#b8862b', decor: '#7a8b6e', accent: '#2e6f4e', danger: '#b4452e' };
const app = extra => loadApp([...PAINT, ...extra], { expose: ['ITEMS', 'DRAW', 'makePainter', 'groundColors'] });
// Une case de 100 px dont le sommet est en (200, 200) : centre en (200, 225), bas en 250.
// look : night, dark, season, time, anim, clock, transmis au peintre.
function paint(a, key, { stage, ...look } = {}) {
  const ctx = fakeContext();
  a.DRAW[key](a.makePainter(ctx, 100, 200, 200, { ...PALETTE, night: false, ...look }), 0, 0, stage ? { stage } : undefined);
  return ctx.points;
}
// La case elle-même monte à 0,25 largeur au-dessus de son centre : un élément au sol peut donc avoir un hf plus petit.
function assertInTile(a, key, stage, look = {}) {
  const points = paint(a, key, { stage, ...look }), top = 225 - Math.max(a.ITEMS[key].hf, .25) * 100 - 2;
  const label = key + (stage ? ' étape ' + stage : '') + Object.entries(look).map(([k, v]) => ` ${k}=${v}`).join('');
  assert.ok(points.length > 0, label + ' ne dessine rien');
  for (const [x, y] of points) {
    assert.ok(x >= 148 && x <= 252, `${label} déborde sur le côté : x=${x.toFixed(1)}`);
    assert.ok(y >= top && y <= 254, `${label} déborde : y=${y.toFixed(1)}, haut permis ${top}`);
  }
  // La nuit, les halos de lumière débordent exprès sur les cases voisines : on vérifie seulement que le dessin se fait.
  assert.doesNotThrow(() => paint(a, key, { stage, ...look, night: true, dark: 1 }), label + ' de nuit');
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

// Luminance (0 à 1) et teinte (0 à 360) d'une couleur #rrggbb.
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
const luma = hex => { const [r, g, b] = rgb(hex); return .2126 * r + .7152 * g + .0722 * b; };
function hue(hex) {
  const [r, g, b] = rgb(hex), max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
const ALL = ['31-paint-buildings.js', '32-paint-decor.js', '33-paint-wonders.js'];

test('saisons : chaque élément reste dans sa case dans les quatre saisons, et se dessine aussi de nuit', () => {
  const a = app(ALL);
  for (const key of Object.keys(a.ITEMS)) for (const season of ['spring', 'summer', 'autumn', 'winter']) assertInTile(a, key, undefined, { season });
});

test('feuillage : inchangé en été, roux en automne, blanchi en hiver, plus tendre au printemps', () => {
  const a = app([]), leaf = season => a.makePainter(fakeContext(), 100, 0, 0, { ...PALETTE, season }).leaf('#4a8540');
  assert.equal(leaf('summer'), '#4a8540');
  assert.ok(hue(leaf('autumn')) < 50, leaf('autumn'));
  assert.ok(luma(leaf('winter')) > .7, leaf('winter'));
  assert.ok(luma(leaf('spring')) > luma('#4a8540'));
});

test('neige sur les toits en hiver seulement', () => {
  const a = app([]), g = season => a.makePainter(fakeContext(), 100, 0, 0, { ...PALETTE, season });
  assert.equal(g('summer').roof('#c0392b'), '#c0392b');
  assert.ok(luma(g('winter').roof('#c0392b')) > .75);
});

test("obscurité progressive : à 1, la nuit d'avant ; à 0, le jour", () => {
  const a = app([]), g = pal => a.makePainter(fakeContext(), 100, 0, 0, { ...PALETTE, ...pal });
  assert.equal(g({ dark: 1 }).c('#ffffff'), g({ night: true }).c('#ffffff'));
  assert.equal(g({ dark: 0 }).c('#ffffff'), '#ffffff');
  assert.ok(luma(g({ dark: .5 }).c('#ffffff')) > luma(g({ night: true }).c('#ffffff')));
  assert.deepEqual([g({ dark: .6 }).night, g({ dark: .4 }).night], [true, false]);
  assert.deepEqual(JSON.parse(JSON.stringify([a.groundColors('spring', 0), a.groundColors('spring', 1)])), [['#acd292', '#a5cc8b'], ['#2d4a3a', '#2a4536']]);
  assert.ok(luma(a.groundColors('winter', 0)[0]) > .85);
});

test('éléments animés : dans leur case à tout instant, et l’horloge donne l’heure', () => {
  const a = app(ALL);
  // 4,363 s : une aile du moulin pointe droit vers le haut.
  for (const time of [0, 1.7, 3.3, 4.363, 10]) {
    for (const key of ['moulin', 'fontaine', 'source', 'fanions', 'horloge']) assertInTile(a, key, undefined, { time, anim: true });
    assertInTile(a, 'granderoue', 4, { time, anim: true });
  }
  assert.notDeepEqual(paint(a, 'horloge', { clock: 0 }), paint(a, 'horloge', { clock: 360 }));
  assert.notDeepEqual(paint(a, 'moulin', { time: 1, anim: true }), paint(a, 'moulin', { time: 1, anim: false }));
});

module.exports = { app, assertInTile, paint };
