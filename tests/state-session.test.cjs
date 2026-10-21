const test = require('node:test');
const assert = require('node:assert/strict');
const { storage, lockManager, stateApp: app } = require('./helpers/state-vm.cjs');

const copy = obj => JSON.parse(JSON.stringify(obj));
const settle = () => new Promise(resolve => setTimeout(resolve, 10));

test('migration preserves v1 activities and gives free mode only to new defaults', () => {
  const a = app();
  const old = { activities: [{ id: 'walk', name: 'Marche', cat: 'corps', min: 20 }] };
  assert.equal(a.normalize(old).activities[0].mode, 'focus');
  assert.equal(a.defaultState().activities.find(x => x.name === 'Marche dehors').mode, 'free');
  assert.equal(a.normalize(old).draw.filters.energy, 'any');
});

test('three-way list merge preserves independent field edits and converges on conflicts', () => {
  const a = app(), base = [{ id: 'read', name: 'Lecture', cat: 'esprit', min: 10 }];
  const local = copy(base), remote = copy(base);
  local[0].name = 'Roman'; remote[0].min = 30;
  const merged = a.mergeList(base, local, remote);
  assert.equal(merged[0].name, 'Roman'); assert.equal(merged[0].min, 30);
  remote[0].name = 'Livre';
  const conflicts = [];
  assert.deepEqual(copy(a.mergeList(base, local, remote, conflicts)), copy(a.mergeList(base, remote, local)));
  assert.deepEqual(conflicts, ['read.name']);
  assert.equal(a.mergeList(base, [], remote).length, 0);
  assert.equal(a.mergeList(base, local, []).length, 0);
});

test('corrupt raw data is preserved before repair, and successful restore can persist', () => {
  const disk = storage(); disk.setItem('ville-bien-etre/v2', '{broken');
  const a = app(disk); a.init();
  assert.match(a.Store.localError, /illisibles/);
  a.api.state.activities = [];
  assert.equal(a.api.commit({ silent: true }), true);
  assert.equal(disk.getItem(a.Store.recoveryKey), '{broken');
  assert.deepEqual(JSON.parse(disk.getItem('ville-bien-etre/v2')).activities, []);
  assert.equal(a.Store.localError, '');
});

test('quota failure never overwrites corrupt raw data and exposes the persistence error', () => {
  const disk = storage(); disk.setItem('ville-bien-etre/v2', '{broken'); disk.fail = true;
  const a = app(disk); a.init();
  assert.equal(a.api.commit({ silent: true }), false);
  assert.equal(disk.getItem('ville-bien-etre/v2'), '{broken');
  assert.equal(a.Store.recoveryRaw, '{broken');
  assert.match(a.Store.localError, /récupération/);
  disk.fail = false;
  assert.equal(a.Store.repairLocal(), true);
});

test('simultaneous start confirmations produce exactly one session owner', async () => {
  const disk = storage(), locks = lockManager(), a = app(disk, locks), b = app(disk, locks);
  a.init(); a.api.commit({ silent: true }); b.init();
  const options = { name: 'Marche', cat: 'corps', min: 5, mode: 'free' };
  await Promise.all([a.startSession(options), b.startSession(options)]);
  assert.equal(Number(!!a.api.run) + Number(!!b.api.run), 1);
  const state = JSON.parse(disk.getItem('ville-bien-etre/v2'));
  assert.equal(state.active.owner, a.api.run ? a.Store.tab : b.Store.tab);
  const owner = a.api.run ? a : b;
  owner.endRun();
});

test('fallback reservation also rejects one of two concurrent confirmations', async () => {
  const disk = storage(), a = app(disk, null), b = app(disk, null);
  a.init(); a.api.commit({ silent: true }); b.init();
  await Promise.all([a.startSession({ name: 'Lecture', cat: 'esprit', min: 5 }), b.startSession({ name: 'Sport', cat: 'corps', min: 5 })]);
  assert.equal(Number(!!a.api.run) + Number(!!b.api.run), 1);
  (a.api.run ? a : b).endRun();
});

test('free session survives background and reload, with one reward across two tabs', async () => {
  const disk = storage(), locks = lockManager(), a = app(disk, locks);
  a.init(); await a.startSession({ name: 'Marche', cat: 'corps', min: 5, mode: 'free' });
  const id = a.api.state.active.id;
  a.advance(100000); a.context.document.visibilityState = 'hidden'; a.onLeave();
  assert.ok(a.api.run); assert.equal(a.api.state.history.length, 0);
  a.endRun(); disk.removeItem('ville-bien-etre/v2:beat');
  const b = app(disk, locks), c = app(disk, locks); b.advance(310000); c.advance(310000); b.init(); c.init();
  b.checkActive(); c.checkActive(); await settle(); await settle();
  const state = JSON.parse(disk.getItem('ville-bien-etre/v2'));
  assert.equal(state.active, null); assert.equal(state.history.filter(x => x.id === id).length, 1);
  assert.equal(state.stats.ok, 1); assert.equal(state.earned, 5000000);
  assert.equal(state.stats.byCat.corps, 5); assert.equal(state.history[0].elapsedSec, 300);
});

test('failed focus retains actual effort but awards no coins', async () => {
  const a = app(); a.init();
  await a.startSession({ name: 'Lecture', cat: 'esprit', min: 5, mode: 'focus' });
  a.api.run.elapsed = 119000;
  await a.failSession('abandon', 0);
  assert.equal(a.api.state.stats.ko, 1); assert.equal(a.api.state.earned, 0);
  assert.equal(a.api.state.history[0].elapsedSec, 119);
  assert.equal(a.api.state.stats.byCat.esprit, 0);
  assert.equal(a.api.state.stats.effort.byCat.esprit, 119 / 60);
  assert.equal(a.api.state.stats.effort.days[a.api.state.history[0].day], 119 / 60);
  assert.equal(a.api.state.stats.days[a.api.state.history[0].day], undefined);
});

test('focus checkpoint survives closing and is counted once on recovery', async () => {
  const disk = storage(), locks = lockManager(), a = app(disk, locks);
  a.init(); await a.startSession({ name: 'Lecture', cat: 'esprit', min: 5, mode: 'focus' });
  a.api.run.elapsed = 67000; a.persistRun(true); a.endRun(); disk.removeItem('ville-bien-etre/v2:beat');
  const b = app(disk, locks); b.init(); b.checkActive(); await settle();
  assert.equal(b.api.state.stats.ko, 1); assert.equal(b.api.state.history[0].elapsedSec, 67);
  b.checkActive(); await settle(); assert.equal(b.api.state.history.length, 1);
});

test('merge deduplicates completed session rewards and never resurrects active history', () => {
  const a = app(), base = a.defaultState();
  base.active = { id: 'once', name: 'Lecture', cat: 'esprit', min: 5, startedAt: Date.now(), mode: 'free' };
  const completed = a.normalize(base);
  completed.coins += 5000000; completed.earned += 5000000; completed.stats.ok = 1; completed.stats.byCat.esprit = 5;
  completed.history = [{ id: 'once', name: 'Lecture', cat: 'esprit', min: 5, elapsedSec: 300, at: Date.now(), ok: true, reward: 5000000, source: 'direct' }]; completed.active = null;
  const result = a.merge3(a.normalize(base), completed, copy(completed));
  assert.equal(result.stats.ok, 1); assert.equal(result.earned, 5000000); assert.equal(result.stats.byCat.esprit, 5); assert.equal(result.active, null);
});

test('different edits in the same millisecond keep both versions through unique revisions', () => {
  const disk = storage(), a = app(disk), b = app(disk);
  a.init(); a.api.commit({ silent: true }); b.init();
  a.advance(1000); b.advance(1000);
  a.api.state.activities[0].name = 'Edited by A'; a.api.commit({ silent: true });
  b.api.state.activities[1].name = 'Edited by B'; b.api.commit({ silent: true });
  const persisted = JSON.parse(disk.getItem('ville-bien-etre/v2'));
  assert.equal(persisted.activities[0].name, 'Edited by A');
  assert.equal(persisted.activities[1].name, 'Edited by B');
  a.Store.pullLocal();
  assert.equal(a.api.state.activities[1].name, 'Edited by B');
});

test('legacy effort migration keeps successful totals and known failed effort separate', () => {
  const a = app(), raw = a.defaultState(); delete raw.stats.effort;
  raw.stats.byCat.esprit = 10; raw.stats.days['2026-10-17'] = 10;
  raw.history = [{ id: 'partial', name: 'Lecture', cat: 'esprit', min: 5, elapsedSec: 90, ok: false, at: Date.now(), day: '2026-10-17' }];
  const result = a.normalize(raw);
  assert.equal(result.stats.byCat.esprit, 10);
  assert.equal(result.stats.effort.byCat.esprit, 11.5);
  assert.equal(result.stats.effort.days['2026-10-17'], 11.5);
  assert.equal(a.normalize(result).stats.effort.byCat.esprit, 11.5);
});

test('conflicting success and interruption converge to one successful result and reward', () => {
  const a = app(), base = a.defaultState(), success = copy(base), failure = copy(base), day = '2026-10-17';
  const event = { id: 'session-one', name: 'Lecture', cat: 'esprit', min: 5, at: Date.now(), source: 'direct', day };
  success.history = [{ ...event, ok: true, reward: 5000000, elapsedSec: 300 }];
  failure.history = [{ ...event, ok: false, reward: 0, elapsedSec: 120, reason: 'closed' }];
  success.stats.ok = 1; success.coins += 5000000; success.earned = 5000000;
  success.stats.byCat.esprit = 5; success.stats.days[day] = 5; success.stats.dailyCats[day] = { esprit: 5 };
  success.stats.effort.byCat.esprit = 5; success.stats.effort.days[day] = 5; success.stats.effort.dailyCats[day] = { esprit: 5 };
  failure.stats.ko = 1; failure.stats.effort.byCat.esprit = 2; failure.stats.effort.days[day] = 2; failure.stats.effort.dailyCats[day] = { esprit: 2 };
  for (const result of [a.merge3(base, success, failure), a.merge3(base, failure, success)]) {
    assert.equal(result.stats.ok, 1); assert.equal(result.stats.ko, 0); assert.equal(result.earned, 5000000);
    assert.equal(result.history.length, 1); assert.equal(result.history[0].ok, true);
    assert.equal(result.stats.byCat.esprit, 5); assert.equal(result.stats.effort.byCat.esprit, 5);
    assert.equal(result.stats.effort.days[day], 5);
  }
});

test('another tab respects the full configured focus grace period', async () => {
  const disk = storage(), locks = lockManager(), a = app(disk, locks);
  a.init(); a.api.state.settings.grace = 20;
  await a.startSession({ name: 'Lecture', cat: 'esprit', min: 5, mode: 'focus' });
  a.context.document.visibilityState = 'hidden'; a.onLeave();
  const b = app(disk, locks); b.advance(11000); b.init();
  assert.equal(b.activeState(), 'elsewhere');
  b.checkActive(); await settle();
  assert.equal(b.api.state.history.length, 0); assert.ok(b.api.state.active);
  a.endRun();
});

test('v2 migration preserves v1 and old-version writes cannot erase new features', () => {
  const disk = storage(), creator = app(), old = creator.defaultState(); old.v = 1;
  delete old.goals; delete old.personal; delete old.routines; delete old.routineRun; delete old.stats.effort;
  const raw = JSON.stringify(old); disk.setItem('ville-bien-etre/v1', raw);
  const a = app(disk); a.init();
  assert.equal(a.api.state.v, 2); assert.equal(disk.getItem('ville-bien-etre/v1'), raw);
  a.api.state.personal.name = 'Jardin calme'; a.api.commit({ silent: true });
  old.activities[0].name = 'Changed by old app'; old.updatedAt += 20000; disk.setItem('ville-bien-etre/v1', JSON.stringify(old));
  a.Store.pullLocal();
  assert.equal(a.api.state.personal.name, 'Jardin calme');
  assert.equal(a.api.state.activities[0].name, 'Lecture');
  assert.equal(JSON.parse(disk.getItem('ville-bien-etre/v2')).personal.name, 'Jardin calme');
});

test('migration waits for a live v1 session and imports its final result on retry', async () => {
  const disk = storage(), creator = app(), old = creator.defaultState(); old.v = 1;
  delete old.stats.effort;
  old.active = { id: 'legacy-live', name: 'Lecture', cat: 'esprit', min: 5, startedAt: Date.parse('2026-10-17T12:00:00Z'), dev: 'old-device' };
  disk.setItem('ville-bien-etre/v1', JSON.stringify(old));
  const a = app(disk); a.init();
  assert.equal(a.Store.migrationPending, true); assert.equal(disk.getItem('ville-bien-etre/v2'), null);
  assert.equal(a.api.commit({ silent: true }), false);
  a.checkActive(); await settle(); assert.equal(a.api.state.history.length, 0);
  await a.startSession({ name: 'Sport', cat: 'corps', min: 5, mode: 'free' }); assert.equal(a.api.run, null);
  old.active = null; old.stats.ok = 1; old.stats.byCat.esprit = 5; old.coins += 5000000; old.earned = 5000000;
  old.history = [{ id: 'legacy-live', name: 'Lecture', cat: 'esprit', min: 5, ok: true, reward: 5000000, at: Date.parse('2026-10-17T12:05:00Z') }];
  disk.setItem('ville-bien-etre/v1', JSON.stringify(old));
  assert.equal(a.Store.retryMigration(), true);
  assert.equal(a.Store.migrationPending, false); assert.equal(a.api.state.earned, 5000000);
  assert.equal(a.api.state.history[0].id, 'legacy-live'); assert.equal(a.api.state.stats.effort.byCat.esprit, 5);
});

test('invalid legacy raw data remains intact while v2 can be saved separately', () => {
  const disk = storage(); disk.setItem('ville-bien-etre/v1', '{invalid-v1');
  const a = app(disk); a.init();
  assert.equal(a.Store.recoveryRaw, '{invalid-v1');
  assert.equal(a.api.commit({ silent: true }), true);
  assert.equal(disk.getItem('ville-bien-etre/v1'), '{invalid-v1');
  assert.equal(JSON.parse(disk.getItem('ville-bien-etre/v2')).v, 2);
});

test('closed legacy session on this device migrates after grace rather than its full duration', () => {
  const disk = storage(), creator = app(), old = creator.defaultState(); old.v = 1; delete old.stats.effort;
  disk.setItem('ville-bien-etre/v1:device', 'this-device');
  old.active = { id: 'legacy-closed', name: 'Lecture', cat: 'esprit', min: 120, startedAt: Date.parse('2026-10-17T11:59:00Z'), dev: 'this-device' };
  disk.setItem('ville-bien-etre/v1', JSON.stringify(old));
  const a = app(disk); a.init();
  assert.equal(a.Store.migrationPending, false);
  assert.ok(disk.getItem('ville-bien-etre/v2'));
  assert.equal(a.api.state.active.id, 'legacy-closed');
  assert.equal(a.activeState(), 'stale');
});

test('cloud migration reads old account state and writes exclusively the v2 document', async () => {
  const a = app(); a.init();
  const legacy = a.defaultState(); legacy.v = 1; legacy.updatedAt = Date.parse('2026-10-17T11:00:00Z'); legacy.coins = 42000000; delete legacy.stats.effort;
  const docs = new Map([['data/users/test/state', { json: JSON.stringify(legacy) }]]), writes = [];
  const db = { doc(key) { return { async get() { return { exists: docs.has(key), data: () => docs.get(key) }; }, async set(value) { writes.push(key); docs.set(key, value); } }; } };
  a.context.window.claude = { use: async name => name === 'db' ? db : { id: async () => 'test' } };
  await a.Store.connect(); await a.Store.flush(); clearTimeout(a.Store.timer);
  assert.equal(a.api.state.coins, 42000000);
  assert.ok(writes.length); assert.ok(writes.every(key => key === 'data/users/test/state-v2'));
  assert.equal(docs.get('data/users/test/state').json, JSON.stringify(legacy));
  assert.equal(JSON.parse(docs.get('data/users/test/state-v2').json).v, 2);
});

test('failed legacy copy keeps original progress in memory and retries that same city', () => {
  const disk = storage(), creator = app(), legacy = creator.defaultState(); legacy.v = 1; legacy.coins = 42000000;
  legacy.personal.name = 'Ville conservée';
  const raw = JSON.stringify(legacy); disk.setItem('ville-bien-etre/v1', raw); disk.fail = true;
  const a = app(disk); a.init();
  assert.equal(a.api.state.coins, 42000000); assert.equal(a.api.state.personal.name, 'Ville conservée');
  assert.equal(a.Store.migrationPending, true); assert.equal(a.Store.migrationReason, 'storage');
  assert.equal(a.api.commit({ silent: true }), false); assert.equal(disk.getItem('ville-bien-etre/v2'), null);
  disk.fail = false;
  assert.equal(a.Store.repairLocal(), true); assert.equal(a.Store.migrationPending, false);
  assert.equal(JSON.parse(disk.getItem('ville-bien-etre/v2')).coins, 42000000);
  assert.equal(disk.getItem('ville-bien-etre/v1'), raw);
});

test('an old failed session keeps unknown elapsed time distinct from measured zero', () => {
  const a = app(), raw = a.defaultState();
  raw.history = [
    { id: 'unknown', name: 'Lecture', cat: 'esprit', min: 5, ok: false, at: Date.now() },
    { id: 'zero', name: 'Sport', cat: 'corps', min: 5, elapsedSec: 0, ok: false, at: Date.now() },
  ];
  const normalized = a.normalize(raw);
  assert.equal(normalized.history[0].elapsedSec, null); assert.equal(normalized.history[1].elapsedSec, 0);
  assert.equal(a.normalize(normalized).history[0].elapsedSec, null);
});

test('local format migration does not make old progress newer than a fresher legacy account', async () => {
  const disk = storage(), creator = app(), local = creator.defaultState(), remote = creator.defaultState();
  local.v = remote.v = 1;
  local.updatedAt = Date.parse('2026-10-17T10:00:00Z'); local.coins = 10000000;
  remote.updatedAt = Date.parse('2026-10-17T11:00:00Z'); remote.coins = 42000000;
  disk.setItem('ville-bien-etre/v1', JSON.stringify(local));
  const a = app(disk); a.init();
  assert.equal(a.api.state.updatedAt, local.updatedAt);
  const docs = new Map([['data/users/test/state', { json: JSON.stringify(remote) }]]);
  const db = { doc(key) { return { async get() { return { exists: docs.has(key), data: () => docs.get(key) }; }, async set(value) { docs.set(key, value); } }; } };
  a.context.window.claude = { use: async name => name === 'db' ? db : { id: async () => 'test' } };
  await a.Store.connect(); await a.Store.flush(); clearTimeout(a.Store.timer);
  assert.equal(a.api.state.coins, 42000000);
  assert.equal(JSON.parse(docs.get('data/users/test/state-v2').json).coins, 42000000);
});

test('an unreadable store cannot be replaced with defaults before its previous city is read', () => {
  const disk = storage(), creator = app(), legacy = creator.defaultState(); legacy.v = 1; legacy.coins = 42000000;
  disk.setItem('ville-bien-etre/v1', JSON.stringify(legacy));
  const read = disk.getItem.bind(disk); let inaccessible = true;
  disk.getItem = key => { if (inaccessible) throw new Error('SecurityError'); return read(key); };
  const a = app(disk); a.init();
  assert.equal(a.Store.migrationPending, true); assert.equal(a.api.commit({ silent: true }), false);
  inaccessible = false;
  assert.equal(a.Store.repairLocal(), true);
  assert.equal(a.api.state.coins, 42000000);
  assert.equal(JSON.parse(disk.getItem('ville-bien-etre/v2')).coins, 42000000);
});

test('le cadeau de bon retour est fixé au lancement et garde sa valeur après minuit', async () => {
  const a = app(); a.init();
  a.api.state.clock.tz = 'UTC';
  a.api.state.stats.days = { '2026-10-10': 10 };
  a.api.commit({ silent: true });
  a.advance((11 * 60 + 58) * 60000);   // 23 h 58, heure UTC de la ville
  await a.startSession({ name: 'Marche', cat: 'corps', min: 5, mode: 'free' });
  assert.equal(a.api.state.active.returnPct, 20);
  assert.equal(a.api.state.active.promised, 6e6);
  a.advance(6 * 60000);
  a.tick(); await settle(); await settle();
  const e = a.api.state.history[0];
  assert.equal(e.ok, true);
  assert.equal(e.day, '2026-10-17');
  assert.equal(e.returnPct, 20);
  assert.equal(e.reward, 6e6);
});

test("activité libre finie app fermée : l'historique garde l'heure réelle de fin", async () => {
  const disk = storage(), locks = lockManager(), a = app(disk, locks);
  a.init(); await a.startSession({ name: 'Marche', cat: 'corps', min: 5, mode: 'free' });
  const startedAt = a.api.state.active.startedAt;
  a.endRun(); disk.removeItem('ville-bien-etre/v2:beat');
  const b = app(disk, locks); b.advance(25 * 60000); b.init();
  b.checkActive(); await settle(); await settle();
  const entry = JSON.parse(disk.getItem('ville-bien-etre/v2')).history[0];
  assert.deepEqual([entry.ok, entry.at], [true, startedAt + 5 * 60000]);
});

test('un message de stockage se lit dans la langue affichée, même posé avant de la connaître', () => {
  const disk = storage(); disk.setItem('ville-bien-etre/v2', '{broken');
  const a = app(disk); a.init();
  assert.match(a.Store.localError, /illisibles/);
  a.context.setLang('en');
  assert.match(a.Store.localError, /unreadable/);
  assert.match(a.Store.localWarning, /unreadable/i);
});
