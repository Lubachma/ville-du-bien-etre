const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js', '46-features.js'];
// Chaque tâche ajoute ici les noms qu'elle crée.
const EXPOSE = ['cityClock', 'southern', 'seasonOf', 'sunTimes', 'momentOf', 'chance', 'dayWeather', 'weatherOf', 'rainbowOn', 'shiftDay', 'WEATHER_ODDS', 'festivalsOn', 'giftAmount', 'nextFestival', 'visitorSpot', 'visitorOf', 'VISITORS', 'keyToUTC', 'ambientAt', 'darkness', 'walkableTiles', 'walkerCount', 'todayDomains', 'today'];
const T0 = Date.parse('2026-10-18T12:00:00Z');
const place = (a, tiles, size = 7) => { a.state.city = { size, tiles: tiles.map(([item, x, y], i) => ({ id: 't' + i, item, x, y, at: T0, paid: 0 })) }; };
const visitor = (a, id) => a.VISITORS.find(v => v.id === id);
function app(tz = 'Europe/Zurich', createdAt = Date.parse('2026-01-15T09:00:00Z')) {
  const a = loadApp(FILES, { expose: EXPOSE });
  a.state.clock.tz = tz; a.state.createdAt = createdAt; a.state.clock.maxSeen = 0;
  return a;
}

test('horloge de la ville : jour et minutes dans son fuseau', () => {
  const a = app();
  assert.deepEqual(plain(a.cityClock(Date.parse('2026-07-01T20:30:00Z'))), { day: '2026-07-01', minutes: 22 * 60 + 30 });
  assert.deepEqual(plain(a.cityClock(Date.parse('2026-07-01T22:30:00Z'))), { day: '2026-07-02', minutes: 30 });
});

test("hémisphère : deviné d'après le fuseau, réglable", () => {
  const a = app();
  assert.equal(a.southern(), false);
  for (const tz of ['Australia/Sydney', 'America/Argentina/Buenos_Aires', 'Pacific/Auckland', 'Africa/Johannesburg']) {
    a.state.clock.tz = tz;
    assert.equal(a.southern(), true, tz);
  }
  a.state.settings.hemisphere = 'north';
  assert.equal(a.southern(), false);
  a.state.clock.tz = 'Europe/Zurich'; a.state.settings.hemisphere = 'south';
  assert.equal(a.southern(), true);
});

test('saisons météorologiques, décalées de six mois au sud', () => {
  const a = app();
  assert.deepEqual(['2026-03-01', '2026-05-31', '2026-06-01', '2026-09-01', '2026-11-30', '2026-12-01', '2026-02-28'].map(a.seasonOf),
    ['spring', 'spring', 'summer', 'autumn', 'autumn', 'winter', 'winter']);
  a.state.clock.tz = 'Australia/Sydney';
  assert.deepEqual(['2026-01-15', '2026-07-15', '2026-10-01'].map(a.seasonOf), ['summer', 'winter', 'spring']);
});

test("lever et coucher : longs jours en été, courts en hiver, à l'envers au sud", () => {
  const a = app();
  const near = (value, want, delta = 3) => assert.ok(Math.abs(value - want) <= delta, `${value} au lieu de ${want}`);
  const june = a.sunTimes('2026-06-21'), dec = a.sunTimes('2026-12-21'), march = a.sunTimes('2026-03-20');
  near(june.rise, 312); near(june.set, 1248); near(dec.rise, 528); near(dec.set, 1032);
  near(march.rise, 420, 8); near(march.set, 1140, 8);
  a.state.clock.tz = 'Australia/Sydney';
  near(a.sunTimes('2026-06-21').rise, 528);
});

test('moments de la journée aux bornes', () => {
  const a = app();
  const { rise, set } = a.sunTimes('2026-06-21'), m = n => a.momentOf('2026-06-21', n).name;
  assert.deepEqual([m(rise - 31), m(rise - 30), m(rise + 44), m(rise + 45), m(set - 61), m(set - 60), m(set - 1), m(set), m(set + 44), m(set + 45)],
    ['night', 'dawn', 'dawn', 'day', 'day', 'golden', 'golden', 'dusk', 'dusk', 'night']);
  const half = a.momentOf('2026-06-21', set + 22.5).t;
  assert.ok(half > .45 && half < .55, String(half));
});

test('météo du jour : reproductible, propre à chaque ville', () => {
  const a = app(), b = app(), c = app('Europe/Zurich', Date.parse('2025-05-05T05:05:00Z'));
  const days = Array.from({ length: 60 }, (_, i) => a.shiftDay('2026-01-01', i));
  assert.deepEqual(days.map(a.dayWeather), days.map(b.dayWeather));
  assert.notDeepEqual(days.map(a.dayWeather), days.map(c.dayWeather));
});

test('météo selon la saison : proportions du tableau sur quatre ans', () => {
  const a = app(), count = {}, weathers = ['sun', 'clouds', 'rain', 'snow', 'fog'];
  for (let i = 0; i < 1461; i++) {
    const day = a.shiftDay('2026-01-01', i), season = a.seasonOf(day), weather = a.dayWeather(day);
    count[season] = count[season] || { n: 0 };
    count[season][weather] = (count[season][weather] || 0) + 1;
    count[season].n++;
  }
  for (const [season, odds] of Object.entries(plain(a.WEATHER_ODDS))) {
    weathers.forEach((weather, i) => {
      const share = 100 * (count[season][weather] || 0) / count[season].n;
      if (odds[i] === 0) assert.equal(share, 0, `${season} ${weather}`);
      else assert.ok(Math.abs(share - odds[i]) <= 6, `${season} ${weather} : ${share.toFixed(1)} %`);
    });
  }
});

test('brouillard le matin seulement, puis des nuages', () => {
  const a = app();
  const day = Array.from({ length: 400 }, (_, i) => a.shiftDay('2026-01-01', i)).find(d => a.dayWeather(d) === 'fog');
  assert.ok(day);
  assert.deepEqual([a.weatherOf(day, 659), a.weatherOf(day, 660)], ['fog', 'clouds']);
});

test("arc-en-ciel : le matin ensoleillé qui suit un jour de pluie, environ une fois sur trois", () => {
  const a = app();
  let eligible = 0, shown = 0;
  for (let i = 1; i < 1461; i++) {
    const day = a.shiftDay('2026-01-01', i);
    if (a.dayWeather(day) !== 'sun' || a.dayWeather(a.shiftDay(day, -1)) !== 'rain') { assert.equal(a.rainbowOn(day, 600), false, day); continue; }
    eligible++;
    if (a.rainbowOn(day, 600)) { shown++; assert.equal(a.rainbowOn(day, 720), false, 'après midi'); }
  }
  assert.ok(eligible > 50, String(eligible));
  assert.ok(Math.abs(shown / eligible - 1 / 3) < .12, String(shown / eligible));
});

test('fêtes aux dates des deux hémisphères', () => {
  const a = app(), ids = day => plain(a.festivalsOn(day).map(f => f.id));
  assert.deepEqual(['2026-03-21', '2026-06-20', '2026-09-24', '2026-12-22', '2026-12-31', '2027-01-01', '2026-03-23'].map(ids),
    [['printemps'], ['ete'], ['recoltes'], ['lumieres'], ['nouvel-an'], ['nouvel-an'], []]);
  a.state.clock.tz = 'Australia/Sydney';
  assert.deepEqual(['2026-03-21', '2026-09-23', '2026-12-21', '2026-06-21'].map(ids), [['recoltes'], ['printemps'], ['ete'], ['lumieres']]);
});

test("une fête, un cadeau par an : le Nouvel An porte l'année qui commence", () => {
  const a = app();
  assert.deepEqual([a.festivalsOn('2026-12-31')[0].key, a.festivalsOn('2027-01-01')[0].key], ['fest:nouvel-an:2027', 'fest:nouvel-an:2027']);
  assert.equal(a.festivalsOn('2027-03-20')[0].key, 'fest:printemps:2027');
  assert.deepEqual(['visit:2026-10-18', 'fest:printemps:2027', 'fest:anniversaire:2027', 'autre'].map(a.giftAmount), [2e6, 5e6, 10e6, 0]);
});

test('anniversaire de la ville : dès la première année, avec son âge', () => {
  const a = app('Europe/Zurich', Date.parse('2026-01-15T09:00:00Z'));
  assert.deepEqual(plain(a.festivalsOn('2026-01-15')), []);
  assert.deepEqual(plain(a.festivalsOn('2028-01-15')), [{ id: 'anniversaire', key: 'fest:anniversaire:2028', age: 2 }]);
  const leap = app('Europe/Zurich', Date.parse('2028-02-29T12:00:00Z'));
  assert.deepEqual(plain(leap.festivalsOn('2029-02-28').map(f => f.age)), [1]);
});

test("prochaine date d'une fête, pour le carnet", () => {
  const a = app();
  assert.deepEqual([a.nextFestival('printemps', '2026-10-18'), a.nextFestival('nouvel-an', '2026-10-18'), a.nextFestival('ete', '2026-06-21'), a.nextFestival('anniversaire', '2026-10-18')],
    ['2027-03-20', '2026-12-31', '2026-06-21', '2027-01-15']);
});

test('visiteur : rien sans sa place, et une ville pleine garde ses toits et ses arbres', () => {
  const a = app();
  place(a, []);
  assert.equal(a.visitorSpot(visitor(a, 'canards'), '2026-07-01'), null);
  place(a, [['etang', 2, 3]]);
  assert.deepEqual(plain(a.visitorSpot(visitor(a, 'canards'), '2026-07-01')), { x: 2, y: 3, on: 'etang' });
  assert.deepEqual(plain(a.visitorSpot(visitor(a, 'montgolfiere'), '2026-07-01')), { sky: true });
  place(a, Array.from({ length: 49 }, (_, i) => [i === 0 ? 'arbre' : 'maison', i % 7, Math.floor(i / 7)]));
  for (const id of ['chat', 'herisson', 'renard', 'bonhomme', 'artiste']) assert.equal(a.visitorSpot(visitor(a, id), '2026-07-01'), null, id);
  assert.deepEqual(plain(a.visitorSpot(visitor(a, 'ecureuil'), '2026-07-01')), { x: 0, y: 0, on: 'arbre' });
  assert.equal(a.visitorSpot(visitor(a, 'cigogne'), '2026-07-01').on, 'maison');
});

test('visiteur du jour : reproductible, conditions respectées, environ 5 jours sur 7', () => {
  const a = app();
  place(a, [['etang', 1, 1], ['arbre', 3, 1], ['maison', 5, 1], ['banc', 1, 4], ['kiosque', 4, 4], ['chemin', 6, 6]]);
  let present = 0;
  for (let i = 0; i < 730; i++) {
    const day = a.shiftDay('2026-01-01', i), v = a.visitorOf(day);
    assert.deepEqual(plain(v), plain(a.visitorOf(day)));
    if (!v) continue;
    present++;
    const def = visitor(a, v.id), season = a.seasonOf(day), weather = a.dayWeather(day);
    if (def.seasons) assert.ok(def.seasons.includes(season), `${v.id} en ${season}`);
    if (def.weather) assert.ok(def.weather.includes(weather), `${v.id} par ${weather}`);
    if (def.snow) assert.ok(weather === 'snow' || a.dayWeather(a.shiftDay(day, -1)) === 'snow', `${v.id} sans neige`);
  }
  assert.ok(Math.abs(present / 730 - .7) < .06, String(present / 730));
});

test("visiteur : plus souvent ceux pas encore rencontrés, jamais celui d'hier quand un autre peut venir", () => {
  const a = app();
  place(a, [['etang', 1, 1], ['arbre', 3, 1], ['maison', 5, 1], ['banc', 1, 4], ['kiosque', 4, 4]]);
  const days = Array.from({ length: 1095 }, (_, i) => a.shiftDay('2026-01-01', i));
  const chats = () => days.map(a.visitorOf).filter(v => v && v.id === 'chat').length;
  const before = chats();
  const long = Date.parse('2025-01-01T12:00:00Z');
  a.state.visits = Object.fromEntries(a.VISITORS.filter(v => v.id !== 'chat').map(v => [v.id, { first: long, count: 1, last: '2025-01-01' }]));
  const after = chats();
  assert.ok(after > before * 1.5, `${before} → ${after}`);
  const day = days.find(d => (a.visitorOf(d) || {}).id === 'chat');
  a.state.visits.chat = { first: long, count: 1, last: a.shiftDay(day, -1) };
  assert.notEqual((a.visitorOf(day) || {}).id, 'chat');
});

test('rencontrer le visiteur du jour ne le change pas', () => {
  const a = app();
  place(a, [['etang', 1, 1], ['arbre', 3, 1], ['banc', 1, 4]]);
  const day = Array.from({ length: 60 }, (_, i) => a.shiftDay('2026-07-01', i)).find(d => a.visitorOf(d));
  const v = plain(a.visitorOf(day));
  a.state.visits[v.id] = { first: a.keyToUTC(day), count: 1, last: day };
  assert.deepEqual(plain(a.visitorOf(day)), v);
});

test('ambiance à un instant : jour, moment, saison, météo, fêtes et visiteur', () => {
  const a = app(), amb = a.ambientAt(Date.parse('2026-03-21T11:00:00Z'));
  assert.deepEqual(plain([amb.day, amb.minutes, amb.season, amb.moment.name, amb.weather, amb.festivals.map(f => f.id)]),
    ['2026-03-21', 720, 'spring', 'day', a.weatherOf('2026-03-21', 720), ['printemps']]);
  assert.deepEqual(plain(amb.visitor), plain(a.visitorOf('2026-03-21')));
});

test('à minuit, la ville passe à la météo et au visiteur du lendemain', () => {
  const a = app(), before = a.ambientAt(Date.parse('2026-07-01T21:59:00Z')), after = a.ambientAt(Date.parse('2026-07-01T22:01:00Z'));
  assert.deepEqual([before.day, after.day], ['2026-07-01', '2026-07-02']);
  assert.equal(after.weather, a.weatherOf('2026-07-02', 1));
  assert.deepEqual(plain(after.visitor), plain(a.visitorOf('2026-07-02')));
});

test('obscurité : nuit 1, journée 0, aube et crépuscule progressifs', () => {
  const a = app();
  assert.deepEqual([a.darkness({ name: 'night', t: 0 }), a.darkness({ name: 'day', t: .5 })], [1, 0]);
  assert.ok(a.darkness({ name: 'dusk', t: .2 }) < a.darkness({ name: 'dusk', t: .8 }));
  assert.ok(a.darkness({ name: 'dawn', t: .2 }) > a.darkness({ name: 'dawn', t: .8 }));
});

test('habitants : un pour trois éléments, six au plus, moitié moins la nuit, aucun sans case où marcher', () => {
  const a = app();
  place(a, []);
  assert.equal(a.walkerCount({ name: 'day' }), 0);
  place(a, Array.from({ length: 9 }, (_, i) => ['maison', i % 7, Math.floor(i / 7)]));
  assert.deepEqual([a.walkerCount({ name: 'day' }), a.walkerCount({ name: 'night' })], [3, 1]);
  place(a, Array.from({ length: 30 }, (_, i) => ['maison', i % 7, Math.floor(i / 7)]));
  assert.equal(a.walkerCount({ name: 'day' }), 6);
  place(a, Array.from({ length: 49 }, (_, i) => [i === 3 ? 'chemin' : 'maison', i % 7, Math.floor(i / 7)]));
  assert.deepEqual(plain(a.walkableTiles()), [{ x: 3, y: 0 }]);
  place(a, Array.from({ length: 49 }, (_, i) => ['maison', i % 7, Math.floor(i / 7)]));
  assert.equal(a.walkerCount({ name: 'day' }), 0);
});

test("les habitants font comme toi : les domaines pratiqués aujourd'hui", () => {
  const a = app();
  a.state.stats.dailyCats[a.today()] = { calme: 10, esprit: 5, corps: 0 };
  assert.deepEqual(plain(a.todayDomains()), ['esprit', 'calme']);
});
