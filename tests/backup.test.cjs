const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { storage, stateApp, FILES } = require('./helpers/state-vm.cjs');
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
    assert.equal(restored.state.settings.restDays, 2);
    assert.deepEqual([...restored.state.pauses], []);
  }
});
test('damaged or unsupported backups are rejected, active sessions are excluded from exports', () => {
  const a = api(); a.state.active = { id: 'active' };
  assert.equal(a.readBackup(a.exportBackup()).state.active, null);
  assert.ok(a.readBackup(a.exportBackup().slice(0, -1) + '!').error);
  assert.ok(a.readBackup(a.sign({ v: 1 }, 2)).error);
  assert.ok(a.readBackup('un texte sans sauvegarde').error);
});
test('sauvegarde : un texte coupé en lignes est accepté', () => {
  const a = api();
  a.state.personal.name = 'La ville des amis';
  a.state.goals = { minutes: 90, days: 4, cat: 'esprit', building: 'ecole' };
  const text = a.exportBackup(), whole = a.readBackup(text);
  assert.equal(whole.error, undefined);
  assert.ok(text.length > 76 * 10, 'assez long pour être coupé en plusieurs lignes');
  // Coupé tous les 76 caractères, comme le font un courriel ou une messagerie ; puis avec des espaces, des tabulations et des
  // retours de ligne Windows autour et entre les lignes, y compris une espace insécable.
  const lines = text.match(/.{1,76}/g), cut = lines.join('\n'), spaced = '  \n' + lines.map((line, i) => (i % 2 ? '\t' : '  ') + line + ' ').join('\r\n') + '\u00a0\n\n';
  assert.ok(cut.split('\n').length > 10 && /\s/.test(spaced));
  for (const pasted of [cut, spaced]) {
    const res = a.readBackup(pasted);
    assert.equal(res.error, undefined);
    // Même état, pièce par pièce : rien n'a été perdu en route.
    assert.deepEqual(Object.keys(res.state), Object.keys(whole.state));
    assert.equal(res.state.personal.name, 'La ville des amis');
    assert.deepEqual(res.state.goals, whole.state.goals);
    assert.equal(JSON.stringify(res.state), JSON.stringify(whole.state));
  }
  // Les blancs retirés ne désarment pas la vérification : un caractère changé en route reste refusé.
  const damaged = cut.replace(/(?<=\n\w{10})\w/, ch => (ch === 'A' ? 'B' : 'A'));
  assert.notEqual(damaged, cut);
  assert.ok(a.readBackup(damaged).error);
  assert.ok(a.readBackup('VBE2.\n.\n').error);
  assert.ok(a.readBackup(' \n\t ').error);
  assert.ok(a.readBackup(null).error);
});
// Une ville reprise d'une sauvegarde égale une sauvegarde que la personne détient : elle compte comme faite sur cet appareil (sa date est rangée, le
// rappel de sauvegarde n'est plus dû). Seulement si elle a pu être enregistrée : sinon la personne ne l'a pas encore, et le rappel reste dû.
test('restauration : une ville reprise et enregistrée compte comme une sauvegarde faite sur cet appareil', () => {
  const AT = 'ville-bien-etre/v1:backup-at', KEY = 'ville-bien-etre/v2';
  // Un onglet sur une ville de trois séances que l'appareil n'a jamais exportée : le rappel est dû tant qu'elle ne compte pas comme sauvegardée.
  const open = disk => {
    const a = stateApp(disk, undefined, { files: [...FILES, '45-settings.js'], expose: ['restoreBackup', 'backupDue'] });
    a.init();
    Object.assign(a.context, { refreshLang() {} });   // les textes fixes et les listes de la page : rien à refaire dans la VM
    a.api.state.stats.ok = 3;
    a.commit({ silent: true });
    assert.equal(a.backupDue(), true, 'le rappel est dû');
    return a;
  };
  const backupOf = a => a.normalize({ ...JSON.parse(JSON.stringify(a.api.state)), coins: 42e6 });

  const disk = storage(), a = open(disk);
  a.restoreBackup(backupOf(a));
  assert.equal(a.api.state.coins, 42e6);
  assert.ok(Number(disk.getItem(AT)) > 0, 'la date de la sauvegarde est rangée');
  assert.equal(a.backupDue(), false, "le rappel n'est plus dû");

  // Reprise mais pas enregistrée (le stockage refuse la ville) : elle ne compte pas, le rappel reste dû.
  const full = storage(), b = open(full), write = full.setItem.bind(full);
  full.setItem = (key, value) => { if (key === KEY) throw new Error('QuotaExceededError'); return write(key, value); };
  b.restoreBackup(backupOf(b));
  assert.equal(b.api.state.coins, 42e6);
  assert.equal(full.getItem(AT), null, "rien n'est rangé");
  assert.equal(b.backupDue(), true, 'le rappel reste dû');
});
