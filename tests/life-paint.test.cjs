const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/app.cjs');
const { fakeContext } = require('./helpers/fake-canvas.cjs');

const PAINT = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js', '46-features.js',
  '30-paint.js', '31-paint-buildings.js', '32-paint-decor.js', '33-paint-wonders.js', '34-paint-life.js'];
const PALETTE = { night: false, esprit: '#3f78c4', corps: '#d9573b', calme: '#3a9a7a', foyer: '#e3a12f', crea: '#d0628f', prestige: '#b8862b', decor: '#7a8b6e', accent: '#2e6f4e', danger: '#b4452e' };
// Chaque tâche ajoute ici les noms qu'elle crée.
const EXPOSE = ['makePainter', 'drawSmoke', 'drawBeam', 'drawWeather', 'drawSeasonLife'];
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

module.exports = { app, draw, PALETTE };
