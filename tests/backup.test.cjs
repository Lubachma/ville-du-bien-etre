const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function api() {
  const context = vm.createContext({ Intl, Date, Math, JSON, TextEncoder, TextDecoder,
    btoa: text => Buffer.from(text, 'binary').toString('base64'), atob: text => Buffer.from(text, 'base64').toString('binary'),
    window: {}, document: { querySelector() {} } });
  const source = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '45-settings.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n');
  vm.runInContext(source + '\nthis.api = { exportBackup, readBackup, normalize, get state() { return S; }, sign(raw,version) { const body=b64encode(JSON.stringify(raw)); return "VBE"+version+"."+body+"."+hash53(BACKUP_SALT+body); } };', context);
  return context.api;
}
test('new backups preserve modes, goals, routine definitions and city name', () => {
  const a = api();
  a.state.personal.name = 'La ville des amis';
  a.state.activities[0].mode = 'free';
  a.state.goals = { minutes: 90, days: 4, cat: 'esprit', building: 'ecole' };
  a.state.routines = [{ id: 'routine-a', name: 'Matin', activityIds: a.state.activities.slice(0, 2).map(x => x.id) }];
  const text = a.exportBackup();
  assert.match(text, /^VBE2\./);
  const restored = a.readBackup(text).state;
  assert.equal(restored.v, 2); assert.equal(restored.personal.name, 'La ville des amis');
  assert.equal(restored.activities[0].mode, 'free'); assert.equal(restored.goals.minutes, 90);
  assert.equal(restored.routines[0].activityIds.length, 2);
});
test('legacy VBE1 backups are accepted without altering earned coins or existing lists', () => {
  const a = api();
  const old = { v: 1, coins: 12500000, earned: 7500000, activities: [{ id: 'old-act', name: 'Marche ancienne', cat: 'corps', min: 15 }], history: [], stats: { ok: 1, ko: 0, byCat: { corps: 15 }, days: { '2026-10-17': 15 } } };
  const restored = a.readBackup(a.sign(old, 1)).state;
  assert.equal(restored.v, 2); assert.equal(restored.coins, old.coins);
  assert.equal(restored.activities[0].mode, 'focus'); assert.equal(restored.stats.effort.byCat.corps, 15);
});
test("une sauvegarde d'avant la mise à jour reste en français", () => {
  const a = api();
  const old = { coins: 3e6, settings: { grace: 20, keepAwake: true, sound: true, theme: 'auto' }, history: [] };
  for (const version of [2, 1]) {
    const restored = a.readBackup(a.sign(Object.assign({ v: version }, old), version));
    assert.equal(restored.error, undefined);
    assert.equal(restored.state.settings.lang, 'fr');
    assert.equal(restored.state.settings.grace, 20);
  }
});
test('damaged or unsupported backups are rejected, active sessions are excluded from exports', () => {
  const a = api(); a.state.active = { id: 'active' };
  assert.equal(a.readBackup(a.exportBackup()).state.active, null);
  assert.ok(a.readBackup(a.exportBackup().slice(0, -1) + '!').error);
  assert.ok(a.readBackup(a.sign({ v: 1 }, 2)).error);
  assert.ok(a.readBackup('un texte sans sauvegarde').error);
});
