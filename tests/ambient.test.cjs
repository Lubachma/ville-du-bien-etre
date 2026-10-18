const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js', '46-features.js'];
// Chaque tâche ajoute ici les noms qu'elle crée.
const EXPOSE = ['cityClock', 'southern', 'seasonOf', 'sunTimes', 'momentOf', 'chance', 'dayWeather', 'weatherOf', 'rainbowOn', 'shiftDay', 'WEATHER_ODDS'];
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
