const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '46-features.js'];
const T0 = Date.parse('2026-10-18T12:00:00Z');
function app(tz = 'Europe/Zurich') {
  const a = loadApp(FILES, { expose: ['ACHIEVEMENTS', 'SETS', 'achievementMet', 'achievementProgress', 'checkAchievements', 'lockInfo', 'keyToUTC'] });
  a.state.clock.tz = tz; a.state.clock.maxSeen = 0; a.state.city.tiles = [];
  a.def = id => a.ACHIEVEMENTS.find(x => x.id === id);
  return a;
}
const entry = (at, extra = {}) => ({ id: 'h' + at, name: 'x', cat: 'esprit', min: 10, ok: true, reward: 1, at, source: 'direct', mode: 'focus', ...extra });
const days = n => Object.fromEntries(Array.from({ length: n }, (_, i) => [new Date(Date.UTC(2026, 6, 1 + i, 12)).toISOString().slice(0, 10), 10]));
const tiles = (item, n, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: item + i, item, x: i % 11, y: Math.floor(i / 11), at: T0, paid: 0, ...extra }));
// Chaque cas prépare la ville juste avant le seuil (at = false) ou au seuil (at = true).
const CASES = {
  'premier-pas': (s, at) => { s.stats.ok = at ? 1 : 0; },
  'premiere-pierre': (s, at) => { s.city.tiles = tiles('banc', 1, { paid: at ? 2e6 : 0 }); },
  'coup-de-pouce': (s, at) => { s.history = [entry(T0, { source: at ? 'wishes' : 'direct' })]; },
  'bien-rode': (s, at) => { s.routineRun = { status: at ? 'done' : 'paused', finishedAt: T0 }; },
  'esprit-curieux': (s, at) => { s.stats.byCat.esprit = at ? 60 : 59; },
  'corps-en-mouvement': (s, at) => { s.stats.byCat.corps = at ? 60 : 59; },
  'grand-calme': (s, at) => { s.stats.byCat.calme = at ? 60 : 59; },
  'nid-douillet': (s, at) => { s.stats.byCat.foyer = at ? 60 : 59; },
  'mains-creatives': (s, at) => { s.stats.byCat.crea = at ? 60 : 59; },
  'semaine-equilibree': (s, at) => { s.stats.dailyCats = { '2026-10-12': { esprit: 5, corps: 5 }, '2026-10-14': { calme: 5, foyer: 5 }, [at ? '2026-10-18' : '2026-10-19']: { crea: 5 } }; },
  'leve-tot': (s, at) => { s.history = [entry(Date.parse(at ? '2026-10-17T05:59:00Z' : '2026-10-17T06:00:00Z'))]; },     // 7 h 59 / 8 h 00 à Zurich
  'douce-soiree': (s, at) => { s.history = [entry(Date.parse(at ? '2026-10-17T20:59:00Z' : '2026-10-17T21:00:00Z'))]; },  // 22 h 59 / 23 h 00
  'petit-a-petit': (s, at) => { s.history = [entry(T0, { min: at ? 5 : 6 })]; },
  'plongee-profonde': (s, at) => { s.history = [entry(T0, { min: at ? 45 : 44 })]; },
  'belle-journee': (s, at) => { s.stats.days = { '2026-10-17': at ? 60 : 59 }; },
  'journee-variee': (s, at) => { s.stats.dailyCats = { '2026-10-17': at ? { esprit: 5, corps: 5, calme: 5 } : { esprit: 5, corps: 5 } }; },
  'sept-jours': (s, at) => { s.stats.days = days(at ? 7 : 6); },
  'trente-jours': (s, at) => { s.stats.days = days(at ? 30 : 29); },
  'cent-jours': (s, at) => { s.stats.days = days(at ? 100 : 99); },
  'sur-ta-lancee': (s, at) => { s.settings.restDays = 0; s.stats.days = days(at ? 7 : 6); },
  'dix-heures': (s, at) => { s.stats.byCat.esprit = at ? 600 : 599; },
  'cinquante-heures': (s, at) => { s.stats.byCat.esprit = at ? 3000 : 2999; },
  'cent-heures': (s, at) => { s.stats.byCat.esprit = at ? 6000 : 5999; },
  'hameau': (s, at) => { s.city.tiles = tiles('banc', at ? 10 : 9); },
  'village': (s, at) => { s.city.size = 11; s.city.tiles = tiles('banc', at ? 25 : 24); },
  'petite-ville': (s, at) => { s.city.size = 11; s.city.tiles = tiles('banc', at ? 50 : 49); },
  'grands-espaces': (s, at) => { s.city.size = at ? 11 : 9; },
  'main-verte': (s, at) => { s.city.tiles = [...tiles('arbre', 8), ...tiles('potager', at ? 2 : 1).map(tile => ({ ...tile, id: 'p' + tile.id, y: 6 }))]; },
  'ca-rayonne': (s, at) => { s.city.tiles = tiles('bibliotheque', 1); s.stats.byCat.esprit = at ? 360 : 359; },
  'bon-voisinage': (s, at) => { s.sets = at ? { cocon: T0 } : {}; },
  'urbaniste': (s, at, a) => { s.sets = Object.fromEntries(a.SETS.slice(0, at ? 12 : 11).map(x => [x.id, T0])); },
  'premiere-merveille': (s, at) => { s.city.tiles = [{ id: 'w', item: 'phare', x: 0, y: 0, at: T0, paid: 0, stage: at ? 4 : 3 }]; },
  'trois-merveilles': (s, at) => { s.city.tiles = ['grandarbre', 'phare', 'granderoue'].map((item, i) => ({ id: item, item, x: i, y: 0, at: T0, paid: 0, stage: i === 2 && !at ? 3 : 4 })); },
};

test('chaque succès est faux juste avant son seuil et vrai au seuil', () => {
  const ids = app().ACHIEVEMENTS.map(x => x.id);
  assert.deepEqual(Object.keys(CASES).sort(), [...ids].sort());
  for (const id of ids) for (const at of [false, true]) {
    const a = app();
    CASES[id](a.state, at, a);
    assert.equal(a.achievementMet(a.def(id)), at, id + (at ? ' au seuil' : ' avant le seuil'));
  }
});

test('heures lues dans le fuseau de la ville, sessions réussies seulement', () => {
  const a = app('America/New_York');
  a.state.history = [entry(Date.parse('2026-10-17T11:30:00Z'))];        // 7 h 30 à New York, 13 h 30 à Zurich
  assert.equal(a.achievementMet(a.def('leve-tot')), true);
  a.state.clock.tz = 'Europe/Zurich';
  assert.equal(a.achievementMet(a.def('leve-tot')), false);
  for (const [iso, expected] of [['2026-10-17T02:59:00Z', false], ['2026-10-17T03:00:00Z', true]]) {   // 4 h 59 / 5 h 00 à Zurich
    a.state.history = [entry(Date.parse(iso))];
    assert.equal(a.achievementMet(a.def('leve-tot')), expected, iso);
  }
  a.state.history = [entry(Date.parse('2026-10-17T17:59:00Z'))];        // 19 h 59
  assert.equal(a.achievementMet(a.def('douce-soiree')), false);
  a.state.history = [entry(Date.parse('2026-10-17T05:00:00Z'), { ok: false })];
  assert.equal(a.achievementMet(a.def('leve-tot')), false);
});

test('rattrapage : la vraie date quand elle se déduit, rien deux fois', () => {
  const a = app();
  a.state.stats.ok = 2;
  a.state.stats.days = { '2026-10-01': 30, '2026-10-02': 40 };
  a.state.stats.dailyCats = { '2026-10-01': { esprit: 30 }, '2026-10-02': { esprit: 40 } };
  a.state.stats.byCat.esprit = 70;
  const early = Date.parse('2026-10-02T04:30:00Z');                     // 6 h 30 à Zurich, session de 5 min
  a.state.history = [entry(early, { min: 5 })];
  a.state.routineRun = { status: 'done', finishedAt: early };
  assert.deepEqual(plain(a.checkAchievements(T0, { retro: true })), ['premier-pas', 'bien-rode', 'esprit-curieux', 'leve-tot', 'petit-a-petit']);
  assert.deepEqual(plain(a.state.achievements), { 'premier-pas': a.keyToUTC('2026-10-01'), 'bien-rode': early, 'esprit-curieux': a.keyToUTC('2026-10-02'), 'leve-tot': early, 'petit-a-petit': early });
  assert.deepEqual(plain(a.checkAchievements(T0, { retro: true })), []);
});

test('rattrapage : Hameau et Main verte datés de la construction de leur dixième case', () => {
  const a = app();
  const day = i => Date.parse('2026-09-01T10:00:00Z') + i * 86400000;
  a.state.city.tiles = [...tiles('arbre', 10).map((tile, i) => ({ ...tile, at: day(i) })),
    ...tiles('banc', 2).map((tile, i) => ({ ...tile, id: 'b' + i, x: i, y: 5, at: day(20 + i) }))];
  a.checkAchievements(T0, { retro: true });
  assert.deepEqual([a.state.achievements.hameau, a.state.achievements['main-verte']], [day(9), day(9)]);
});

test('sans rattrapage, la date est maintenant ; le succès ouvre son décor, série masquée ou non', () => {
  const a = app();
  a.state.settings.hideStreak = true;
  a.state.history = [entry(Date.parse('2026-10-17T05:30:00Z'))];
  CASES['sur-ta-lancee'](a.state, true, a);
  const got = a.checkAchievements(T0);
  assert.ok(got.includes('leve-tot') && got.includes('sur-ta-lancee'), got.join());
  assert.equal(a.state.achievements['leve-tot'], T0);
  assert.equal(a.lockInfo('cadran'), null);
});

test('progression montrée dans le carnet', () => {
  const a = app();
  a.state.stats.byCat.esprit = 42; a.state.stats.days = days(3);
  assert.deepEqual(plain(a.achievementProgress(a.def('esprit-curieux'))), { have: 42, need: 60, unit: 'min' });
  assert.deepEqual(plain(a.achievementProgress(a.def('sept-jours'))), { have: 3, need: 7, unit: 'n' });
  assert.equal(a.achievementProgress(a.def('leve-tot')), null);
});
