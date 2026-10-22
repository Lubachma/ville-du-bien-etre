const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/app.cjs');
const { fakeContext } = require('./helpers/fake-canvas.cjs');

const PAINT = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js', '46-features.js',
  '30-paint.js', '31-paint-buildings.js', '32-paint-decor.js', '33-paint-wonders.js', '34-paint-life.js'];
const PALETTE = { night: false, esprit: '#3f78c4', corps: '#d9573b', calme: '#3a9a7a', foyer: '#e3a12f', crea: '#d0628f', prestige: '#b8862b', decor: '#7a8b6e', accent: '#2e6f4e', danger: '#b4452e' };
// Chaque tâche ajoute ici les noms qu'elle crée.
const EXPOSE = ['makePainter', 'drawSmoke', 'drawBeam', 'drawWeather', 'drawSeasonLife', 'drawWalker', 'drawDoer', 'VISITOR_DRAW', 'VISITORS', 'drawBunting', 'drawFestival', 'FESTIVALS',
  'SKINS', 'personSkin', 'walkerLook', 'drawPerson', 'CAT_ORDER', 'chance'];
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

test("petites vies : la nuit est celle du dessin, même quand le ciel suit l'apparence", () => {
  const a = app(), tiles = [{ item: 'etang', x: 0, y: 0 }], summer = name => ({ season: 'summer', moment: { name, t: .5 }, weather: 'sun' });
  const birds = points => points.some(([, y]) => y < 60), fireflies = points => points.some(([, y]) => y > 150);
  // Thème Nuit en pleine journée : des lucioles près de l'étang, pas d'oiseaux.
  const dark = draw(a, g => a.drawSeasonLife(g, summer('day'), 1, AREA, tiles), { dark: 1 });
  assert.ok(fireflies(dark) && !birds(dark), 'ville sombre');
  // Thème Jour en pleine nuit : des oiseaux, pas de lucioles.
  const light = draw(a, g => a.drawSeasonLife(g, summer('night'), 1, AREA, tiles), { dark: 0 });
  assert.ok(birds(light) && !fireflies(light), 'ville claire');
});

// Chaque point tracé reste à 30 px du pied d'une personne (case de 100 px).
const near = (points, x0, y0, label) => {
  assert.ok(points.length > 0, label + ' : rien');
  for (const [x, y] of points) assert.ok(Math.abs(x - x0) <= 30 && Math.abs(y - y0) <= 30, `${label} trop loin : ${x.toFixed(1)}, ${y.toFixed(1)}`);
};
test('habitants : chacun dessiné près de son point, promeneurs et habitants qui font comme toi', () => {
  const a = app();
  for (const look of [{}, { lantern: true }, { umbrella: true }, { hat: true }]) near(draw(a, g => a.drawWalker(g, 200, 220, { color: '#d9573b', ...look })), 200, 220, 'promeneur ' + JSON.stringify(look));
  const [cx, cy] = [200, 225];
  for (const cat of ['esprit', 'corps', 'calme', 'foyer', 'crea']) for (const t of [0, 2]) near(draw(a, g => a.drawDoer(g, 0, 0, cat, t)), cx, cy, `${cat} à ${t} s`);
});

// Habitants divers : cinq peaux qui tournent selon la ville, et au besoin une canne ou un fauteuil roulant.
// Une autre ville : seule sa date de création change, et avec elle tous les tirages.
const townNo = (a, k) => { a.state.createdAt = 1.7e12 + k * 7919e5; };
// Couleurs de remplissage et de trait dans l'ordre du tracé (le contexte factice ne les garde pas), et le peintre qui les a produites.
function fillColors(a, fn, look = {}) {
  const ctx = fakeContext(), colors = [], strokes = [];
  ctx.fill = () => { colors.push(ctx.fillStyle); };
  ctx.stroke = () => { strokes.push(ctx.strokeStyle); };
  const g = a.makePainter(ctx, 100, 200, 200, { ...PALETTE, ...look });
  fn(g);
  return { colors, strokes, g };
}
// Clarté d'une couleur « #rrggbb » : la somme de ses trois canaux, de quoi ordonner des teintes.
const light = hex => [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0);

test('habitants : cinq promeneurs ont cinq couleurs de peau différentes, stables pour une ville', () => {
  const a = app(), firstSkins = new Set();
  assert.equal(a.SKINS.length, 5);
  assert.equal(new Set(a.SKINS).size, 5, 'cinq couleurs toutes différentes');
  a.SKINS.forEach((hex, i) => { if (i) assert.ok(light(a.SKINS[i - 1]) > light(hex), `${hex} n'est pas plus foncée que ${a.SKINS[i - 1]}`); });
  for (let k = 0; k < 30; k++) {
    townNo(a, k);
    const skins = [0, 1, 2, 3, 4].map(i => a.walkerLook(i).skin);
    assert.equal(new Set(skins).size, 5, `ville ${k} : ${skins}`);
    for (let i = 0; i < 6; i++) assert.deepEqual(a.walkerLook(i), a.walkerLook(i), `ville ${k}, promeneur ${i} : change d'un appel à l'autre`);
    firstSkins.add(skins[0]);
  }
  assert.ok(firstSkins.size > 1, 'toutes les villes ont les mêmes peaux');
});

test('habitants : environ un promeneur sur sept en fauteuil et un sur cinq avec une canne', () => {
  const a = app(), seen = { chair: 0, cane: 0, '': 0 }, towns = 300, walkers = 6;
  for (let k = 0; k < towns; k++) {
    townNo(a, k);
    for (let i = 0; i < walkers; i++) seen[a.walkerLook(i).aid]++;
  }
  const chair = seen.chair / (towns * walkers), cane = seen.cane / (towns * walkers);
  assert.equal(seen.chair + seen.cane + seen[''], towns * walkers, 'une aide inconnue');
  // Le tirage est déterministe : ces 300 villes donnent 246 fauteuils et 323 cannes sur 1 800 promeneurs (.137 et .179), à .03 près.
  assert.ok(Math.abs(chair - .137) <= .03, `fauteuils : ${chair.toFixed(3)}`);
  assert.ok(Math.abs(cane - .179) <= .03, `cannes : ${cane.toFixed(3)}`);
});

test("habitants : quand les deux règles tombent sur le même promeneur, c'est le fauteuil qui l'emporte", () => {
  const a = app();
  let both = 0;
  for (let k = 0; k < 300; k++) {
    townNo(a, k);
    for (let i = 0; i < 6; i++) {
      // Les deux règles du cahier des charges, lues sans passer par walkerLook.
      const chairRule = (i + Math.floor(a.chance('fauteuil') * 7)) % 7 === 0, caneRule = (i + Math.floor(a.chance('canne') * 5)) % 5 === 0;
      if (!chairRule || !caneRule) continue;
      both++;
      assert.equal(a.walkerLook(i).aid, 'chair', `ville ${k}, promeneur ${i} : fauteuil et canne tirés ensemble`);
    }
  }
  assert.ok(both > 0, "aucun promeneur n'a les deux règles : le test ne prouve rien");
});

test('habitants : canne et fauteuil restent dans le cadre de la personne', () => {
  const a = app(), base = { color: '#d9573b', skin: a.SKINS[2] };
  for (const aid of ['cane', 'chair']) {
    // Seule, l'aide est vraiment dessinée, et elle pose sur le sol : son point le plus bas est celui des pieds, et rien ne passe dessous.
    const bare = draw(a, g => a.drawWalker(g, 200, 220, base)), points = draw(a, g => a.drawWalker(g, 200, 220, { ...base, aid }));
    const added = points.filter(([x, y]) => !bare.some(([bx, by]) => bx === x && by === y));
    assert.ok(added.length > 0, aid + ' : rien de dessiné en plus');
    assert.ok(Math.abs(Math.max(...added.map(p => p[1])) - 220) < 1e-6, aid + ' : ne touche pas le sol');
    assert.ok(points.every(p => p[1] <= 220 + 1e-6), aid + ' : passe sous le sol');
    for (const extra of [{}, { hat: true }, { umbrella: true }, { lantern: true }, { hat: true, umbrella: true, lantern: true }]) {
      near(draw(a, g => a.drawWalker(g, 200, 220, { ...base, ...extra, aid })), 200, 220, `${aid} ${JSON.stringify(extra)}`);
    }
  }
});

test('habitants : la roue et la canne sont plus claires la nuit que le jour, pour rester visibles sur le sol sombre', () => {
  const a = app(), skin = a.SKINS[2];
  // Le seul trait que dessine un promeneur avec cette aide est la roue, ou la canne.
  const strokeAt = (aid, dark) => {
    const { strokes } = fillColors(a, g => a.drawWalker(g, 200, 220, { color: '#d9573b', skin, aid }), { dark });
    assert.equal(strokes.length, 1, `${aid}, obscurité ${dark} : un seul trait attendu, vu ${strokes}`);
    return strokes[0];
  };
  for (const [aid, name] of [['chair', 'roue'], ['cane', 'canne']]) {
    const day = strokeAt(aid, 0), night = strokeAt(aid, 1);
    assert.ok(light(night) > light(day), `${name} : ${day} le jour, ${night} la nuit`);
  }
});

test("habitants : assis dans son fauteuil, l'épaule reste à moins d'un dixième de s de l'épaule debout", () => {
  const a = app(), g = a.makePainter(fakeContext(), 100, 200, 200, PALETTE), s = g.tw * .18;
  const stand = a.drawPerson(g, 200, 220, '#d9573b'), chair = a.drawPerson(g, 200, 220, '#d9573b', 'chair');
  assert.ok(Math.abs(chair[0] - stand[0]) <= .1 * s, `épaule en x : ${chair[0]} au lieu de ${stand[0]}`);
  assert.ok(Math.abs(chair[1] - stand[1]) <= .1 * s, `épaule en y : ${chair[1]} au lieu de ${stand[1]}`);
});

test('habitants : la tête prend la couleur de peau donnée', () => {
  const a = app(), skin = '#8e5a3a';
  for (const pose of ['stand', 'sit', 'chair']) for (const dark of [0, 1]) {
    const { colors, g } = fillColors(a, p => a.drawPerson(p, 200, 220, '#d9573b', pose, skin), { dark });
    const head = g.c(skin);
    // Sans nuit, la peau passée telle quelle ; la nuit, teintée comme le reste du dessin.
    if (!dark) assert.equal(head, skin);
    else assert.notEqual(head, skin, 'la nuit ne teinte pas la peau');
    assert.equal(colors.filter(c => c === head).length, 1, `${pose}, obscurité ${dark} : une seule tête de couleur ${head}, vu ${colors}`);
  }
  assert.ok(fillColors(a, g => a.drawPerson(g, 200, 220, '#d9573b')).colors.includes(a.SKINS[0]), 'sans peau donnée, la plus claire');
});

test('habitants : le promeneur porte la peau de son look, avec ou sans aide, de jour comme de nuit', () => {
  const a = app(), skin = a.SKINS[3];
  for (const aid of ['', 'cane', 'chair']) for (const dark of [0, 1]) {
    const { colors, g } = fillColors(a, p => a.drawWalker(p, 200, 220, { color: '#d9573b', skin, aid }), { dark });
    const head = g.c(skin);
    assert.equal(colors.filter(c => c === head).length, 1, `${aid || 'sans aide'}, obscurité ${dark} : une seule tête de couleur ${head}, vu ${colors}`);
  }
});

test('habitants : ceux qui font comme toi et les deux musiciens de passage ont chacun leur peau', () => {
  const a = app();
  for (let k = 0; k < 30; k++) {
    townNo(a, k);
    a.CAT_ORDER.forEach((cat, i) => {
      const skin = a.personSkin(10 + i);
      assert.ok(fillColors(a, g => a.drawDoer(g, 0, 0, cat, 0)).colors.includes(skin), `ville ${k}, ${cat} : peau ${skin} attendue`);
    });
    for (const [id, n] of [['accordeon', 20], ['artiste', 21]]) {
      const skin = a.personSkin(n);
      assert.ok(fillColors(a, g => a.VISITOR_DRAW[id](g, 200, 225, { season: 'summer' }, 0)).colors.includes(skin), `ville ${k}, ${id} : peau ${skin} attendue`);
    }
  }
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
