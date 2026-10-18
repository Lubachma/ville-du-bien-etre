const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '46-features.js', '52-carnet.js'];
const T0 = Date.parse('2026-10-18T12:00:00Z');
const app = (globals = {}) => loadApp(FILES, { expose: ['carnetCounts', 'hasNewInCarnet', 'markCarnetSeen'], globals });

test('compteurs du carnet', () => {
  const a = app();
  a.state.achievements = { 'premier-pas': T0, hameau: T0 };
  a.state.sets = { cocon: T0 };
  assert.deepEqual(plain(a.carnetCounts()), { achievements: { have: 2, total: 42 }, collection: { have: 7, total: 50 }, sets: { have: 1, total: 12 }, visits: { have: 0, total: 12 } });
  a.state.visits = { chat: { first: T0, count: 2, last: '2026-10-18' } };
  assert.deepEqual(plain(a.carnetCounts().visits), { have: 1, total: 12 });
});

test("repère Nouveau : ce qui n'a pas encore été vu sur cet appareil", () => {
  const a = app();
  assert.equal(a.hasNewInCarnet(), false);
  a.state.achievements = { 'premier-pas': T0 };
  assert.equal(a.hasNewInCarnet(), true);
  a.markCarnetSeen();
  assert.equal(a.hasNewInCarnet(), false);
  a.state.sets = { cocon: T0 + 1 };
  assert.equal(a.hasNewInCarnet(), true);
});

test("repère Nouveau : succès rendus par une sauvegarde plus ancienne, ou regagnés après « Tout recommencer »", () => {
  const a = app();
  a.state.achievements = { 'premier-pas': T0 };
  a.markCarnetSeen();
  a.state.achievements = { 'premier-pas': T0, hameau: T0 - 30 * 86400000 };     // restauration : un succès daté d'avant
  assert.equal(a.hasNewInCarnet(), true);
  a.markCarnetSeen();
  a.state.achievements = { 'premier-pas': T0 + 60000 };                         // ville neuve : le même succès, regagné
  assert.equal(a.hasNewInCarnet(), true);
});

test('rattrapage : un seul message pour tout ce que la ville avait déjà', () => {
  const calls = [];
  const a = loadApp(FILES, { expose: ['catchUpCarnet'], globals: { toast: (msg, action) => calls.push([msg, !!action]), commit: () => true } });
  a.state.clock.tz = 'Europe/Zurich';
  Object.assign(a.state.stats, { ok: 3, days: { '2026-10-01': 30, '2026-10-02': 40 } });
  a.state.stats.byCat.esprit = 70;
  a.state.city.tiles = [{ id: 'b', item: 'bibliotheque', x: 0, y: 0, at: T0, paid: 10e6 }, { id: 'c', item: 'banc', x: 1, y: 0, at: T0, paid: 2e6 }, { id: 'd', item: 'arbre', x: 0, y: 1, at: T0, paid: 2e6 }];
  const got = a.catchUpCarnet();
  assert.deepEqual(plain(got.sets), ['coin-lecture']);
  assert.ok(got.achievements.includes('bon-voisinage') && got.achievements.includes('premiere-pierre'), got.achievements.join());
  assert.equal(calls.length, 1);
  assert.match(calls[0][0], /^Ta ville a déjà \d+ succès/);
  assert.equal(calls[0][1], true);
  a.catchUpCarnet();
  assert.equal(calls.length, 1);
});

test("plusieurs succès d'un coup : un message court, et le nom de chacun pour les lecteurs d'écran", () => {
  const calls = [];
  const a = loadApp(FILES, { expose: ['celebrate'], globals: { toast: (msg, action, spoken) => calls.push([msg, spoken]) } });
  a.celebrate({ achievements: ['hameau', 'main-verte'] });
  assert.equal(calls.length, 1);
  assert.match(calls[0][0], /^2\snouveaux\ssuccès$/);
  assert.match(String(calls[0][1]), /Hameau.*Main verte/);
});

test('rattrapage rapide pour une ville très remplie', () => {
  const a = loadApp(FILES, { expose: ['catchUpCarnet'], globals: { toast() {}, commit: () => true } });
  a.state.clock.tz = 'UTC';
  for (let i = 0; i < 1000; i++) {
    const day = new Date(Date.UTC(2023, 0, 1) + i * 86400000).toISOString().slice(0, 10);
    a.state.stats.days[day] = 30; a.state.stats.dailyCats[day] = { esprit: 10, corps: 10, calme: 10 };
  }
  a.state.history = Array.from({ length: 150 }, (_, i) => ({ id: 'h' + i, name: 'x', cat: 'esprit', min: 10, ok: true, reward: 1, at: T0 - i * 86400000, source: 'direct', mode: 'focus' }));
  const start = performance.now();
  a.catchUpCarnet();
  assert.ok(performance.now() - start < 1500, 'rattrapage trop lent');
});

module.exports = { FILES, T0 };

test("rattrapage au démarrage : son message attend, puis rejoint le premier message de la ville ou s'affiche seul", () => {
  const calls = [], globals = { toast: (msg, action) => calls.push([msg, !!action]), commit: () => true };
  const old = a => { a.state.clock.tz = 'Europe/Zurich'; Object.assign(a.state.stats, { ok: 1, days: { '2026-10-01': 30 } }); };
  const a = loadApp(FILES, { expose: ['catchUpCarnet', 'celebrate', 'flushCarnetNote'], globals });
  old(a);
  a.catchUpCarnet({ defer: true });
  assert.equal(calls.length, 0);
  a.celebrate({}, 'Bonne Fête du printemps ! Cadeau : 5 M');
  assert.equal(calls.length, 1);
  assert.match(calls[0][0], /^Bonne Fête du printemps ! Cadeau : 5 M · Ta ville a déjà 1 succès/);
  assert.equal(calls[0][1], true);
  a.flushCarnetNote();
  assert.equal(calls.length, 1);
  // Sans autre message, il s'affiche seul après le premier affichage.
  const b = loadApp(FILES, { expose: ['catchUpCarnet', 'celebrate', 'flushCarnetNote'], globals });
  old(b);
  b.catchUpCarnet({ defer: true });
  b.celebrate({}, '');
  assert.equal(calls.length, 1);
  b.flushCarnetNote();
  assert.equal(calls.length, 2);
  assert.match(calls[1][0], /^Ta ville a déjà 1 succès/);
});
