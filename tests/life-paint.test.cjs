const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/app.cjs');
const { fakeContext } = require('./helpers/fake-canvas.cjs');

const PAINT = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js', '46-features.js',
  '30-paint.js', '31-paint-buildings.js', '32-paint-decor.js', '33-paint-wonders.js', '34-paint-life.js'];
const PALETTE = { night: false, esprit: '#3f78c4', corps: '#d9573b', calme: '#3a9a7a', foyer: '#e3a12f', crea: '#d0628f', prestige: '#b8862b', decor: '#7a8b6e', accent: '#2e6f4e', danger: '#b4452e' };
// Chaque tâche ajoute ici les noms qu'elle crée.
const EXPOSE = ['makePainter', 'drawSmoke', 'drawBeam', 'drawWeather', 'drawSeasonLife', 'drawWalker', 'drawDoer', 'VISITOR_DRAW', 'VISITORS', 'drawBunting', 'drawFestival', 'FESTIVALS'];
const app = () => loadApp(PAINT, { expose: EXPOSE });
// Une case de 100 px dont le sommet est en (200, 200) : centre en (200, 225), bas en 250.
function draw(a, fn, look = {}) {
  const ctx = fakeContext();
  fn(a.makePainter(ctx, 100, 200, 200, { ...PALETTE, ...look }));
  return ctx.points;
}

test('fumée et faisceau : dessinés, la fumée au-dessus de sa case', () => {
  const a = app();
  for (const t of [0, 1.3, 7]) {
    const smoke = draw(a, g => a.drawSmoke(g, 0, 0, t));
    assert.ok(smoke.length > 0, 'pas de fumée');
    for (const [x, y] of smoke) assert.ok(x >= 150 && x <= 250 && y < 225, `fumée hors de sa colonne : ${x.toFixed(1)}, ${y.toFixed(1)}`);
    assert.ok(draw(a, g => a.drawBeam(g, 0, 0, t), { dark: 1 }).length > 0, 'pas de faisceau');
  }
});

const AREA = { w: 400, h: 300, ground: 150 };
const amb = (weather, extra = {}) => ({ season: 'spring', moment: { name: 'day', t: .5 }, weather, rainbow: false, ...extra });
function inArea(points, label) {
  assert.ok(points.length > 0, label + ' : rien');
  for (const [x, y] of points) assert.ok(x >= 0 && x <= AREA.w && y >= 0 && y <= AREA.h, `${label} hors de la zone : ${x.toFixed(1)}, ${y.toFixed(1)}`);
}

test('météo : rien au soleil ; pluie, neige, nuages et brouillard dans leur zone ; arc-en-ciel après la pluie', () => {
  const a = app();
  for (const t of [0, 2.5, 30]) {
    assert.equal(draw(a, g => a.drawWeather(g, amb('sun'), t, AREA)).length, 0, 'soleil');
    for (const weather of ['rain', 'snow', 'clouds', 'fog']) inArea(draw(a, g => a.drawWeather(g, amb(weather, weather === 'snow' ? { season: 'winter' } : {}), t, AREA)), weather + ' à ' + t + ' s');
    inArea(draw(a, g => a.drawWeather(g, amb('sun', { rainbow: true }), t, AREA)), 'arc-en-ciel');
  }
});

test("petites vies : lucioles les nuits d'été près de l'étang, rien la nuit en hiver", () => {
  const a = app(), night = { name: 'night', t: 0 }, tiles = [{ item: 'etang', x: 0, y: 0 }];
  assert.ok(draw(a, g => a.drawSeasonLife(g, { season: 'summer', moment: night, weather: 'sun' }, 1, AREA, tiles), { dark: 1 }).length > 0, 'lucioles');
  assert.equal(draw(a, g => a.drawSeasonLife(g, { season: 'winter', moment: night, weather: 'sun' }, 1, AREA, tiles), { dark: 1 }).length, 0, 'hiver la nuit');
});

test('habitants : chacun dessiné près de son point, promeneurs et habitants qui font comme toi', () => {
  const a = app();
  const near = (points, x0, y0, label) => {
    assert.ok(points.length > 0, label + ' : rien');
    for (const [x, y] of points) assert.ok(Math.abs(x - x0) <= 30 && Math.abs(y - y0) <= 30, `${label} trop loin : ${x.toFixed(1)}, ${y.toFixed(1)}`);
  };
  for (const look of [{}, { lantern: true }, { umbrella: true }, { hat: true }]) near(draw(a, g => a.drawWalker(g, 200, 220, { color: '#d9573b', ...look })), 200, 220, 'promeneur ' + JSON.stringify(look));
  const [cx, cy] = [200, 225];
  for (const cat of ['esprit', 'corps', 'calme', 'foyer', 'crea']) for (const t of [0, 2]) near(draw(a, g => a.drawDoer(g, 0, 0, cat, t)), cx, cy, `${cat} à ${t} s`);
});

test('visiteurs : chacun dessiné sur sa case, de jour comme de nuit ; la montgolfière dans le ciel', () => {
  const a = app();
  assert.deepEqual(Object.keys(a.VISITOR_DRAW).sort(), [...a.VISITORS.map(v => v.id)].sort());
  for (const v of a.VISITORS) for (const dark of [0, 1]) for (const t of [0, 3]) {
    const points = draw(a, g => a.VISITOR_DRAW[v.id](g, 200, 225, { season: 'summer' }, t), { dark });
    assert.ok(points.length > 0, v.id + ' ne dessine rien');
    const box = v.id === 'montgolfiere' ? [100, 300, 0, 300] : [140, 260, 115, 255];
    for (const [x, y] of points) assert.ok(x >= box[0] && x <= box[1] && y >= box[2] && y <= box[3], `${v.id} déborde : ${x.toFixed(1)}, ${y.toFixed(1)}`);
  }
});

test('fêtes : chaque décor se dessine dans sa zone, de jour comme de nuit, et les fanions suivent les bords de l’île', () => {
  const a = app(), area = { ...AREA, size: 1 }, spots = [{ x: 0, y: 0 }];
  for (const fest of a.FESTIVALS) for (const name of ['day', 'night']) for (const t of [0, 2, 9]) {
    const ambience = { season: 'spring', moment: { name, t: 0 }, weather: 'sun' };
    inArea(draw(a, g => a.drawFestival(g, { id: fest.id, age: 2 }, ambience, t, area, spots), { dark: name === 'night' ? 1 : 0 }), `${fest.id} ${name} ${t} s`);
  }
  const bunting = draw(a, g => a.drawBunting(g, 1, ['#d9573b', '#3f78c4'], 1));
  assert.ok(bunting.length > 0);
  for (const [x, y] of bunting) assert.ok(x >= 148 && x <= 252 && y >= 190 && y <= 255, `fanions hors des bords : ${x.toFixed(1)}, ${y.toFixed(1)}`);
});

module.exports = { app, draw, PALETTE };
