const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '46-features.js', '52-carnet.js'];
const T0 = Date.parse('2026-10-18T12:00:00Z');
const app = (globals = {}) => loadApp(FILES, { expose: ['carnetCounts', 'hasNewInCarnet'], globals });

test('compteurs du carnet', () => {
  const a = app();
  a.state.achievements = { 'premier-pas': T0, hameau: T0 };
  a.state.sets = { cocon: T0 };
  assert.deepEqual(plain(a.carnetCounts()), { achievements: { have: 2, total: 33 }, collection: { have: 7, total: 50 }, sets: { have: 1, total: 12 } });
});

test('repère Nouveau : un succès ou un ensemble depuis la dernière ouverture', () => {
  const a = app();
  assert.equal(a.hasNewInCarnet(0), false);
  a.state.achievements = { 'premier-pas': T0 };
  assert.deepEqual([a.hasNewInCarnet(0), a.hasNewInCarnet(T0)], [true, false]);
  a.state.sets = { cocon: T0 + 1 };
  assert.equal(a.hasNewInCarnet(T0), true);
});

module.exports = { FILES, T0 };
