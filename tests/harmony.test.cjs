const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

// Étape 5 : souhaits des habitants, harmonie de la ville, réglages de l'ambiance.
const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js', '46-features.js'];
const EXPOSE = ['defaultState', 'normalize', 'merge3', 'clone', 'giftAmount'];
const T0 = Date.parse('2026-10-18T12:00:00Z');
function app(now = '2026-10-21T10:00:00Z') {
  const a = loadApp(FILES, { expose: EXPOSE, now });
  a.state.clock.tz = 'Europe/Zurich'; a.state.clock.maxSeen = 0;
  return a;
}

test('étape 5 : réglages par défaut et validés, souhait validé', () => {
  const a = app(), d = a.defaultState();
  assert.deepEqual(plain([d.settings.ambience, d.settings.ambienceVolume, d.settings.townWishes, d.townWish]), ['none', 'normal', true, null]);
  const s = a.normalize({ settings: { ambience: 'jazz', ambienceVolume: 'max', townWishes: false }, townWish: { day: '2026-10-18', tile: 't1', item: 'banc' } });
  assert.deepEqual(plain([s.settings.ambience, s.settings.ambienceVolume, s.settings.townWishes]), ['none', 'normal', false]);
  assert.deepEqual(plain(s.townWish), { day: '2026-10-18', tile: 't1', item: 'banc' });
  assert.deepEqual(plain([a.normalize({ settings: { ambience: 'rain', ambienceVolume: 'soft' } }).settings.ambience, a.normalize({ settings: { ambienceVolume: 'soft' } }).settings.ambienceVolume]), ['rain', 'soft']);
  for (const bad of [{ day: '2026-10-18', tile: 't1', item: 'licorne' }, { day: '2026-10-18', tile: 't1', item: 'maison' }, { day: 'hier', tile: 't1', item: 'banc' },
    { day: '2026-10-18', tile: '', item: 'banc' }, 'x']) assert.equal(a.normalize({ townWish: bad }).townWish, null, JSON.stringify(bad));
  assert.deepEqual(plain(a.normalize({ townWish: { day: '2026-10-18', tile: 't1', item: 'banc', done: T0 } }).townWish), { day: '2026-10-18', tile: 't1', item: 'banc', done: T0 });
  assert.deepEqual(plain(a.normalize({ townWish: { day: '2026-10-18', tile: 't1', item: 'banc', done: 'hier', skipped: 'oui' } }).townWish), { day: '2026-10-18', tile: 't1', item: 'banc' });
  assert.equal(a.normalize({ townWish: { day: '2026-10-18', tile: 't1', item: 'banc', skipped: true } }).townWish.skipped, true);
});

test('étape 5 : cadeaux d’un souhait (3 M) et d’une étoile (10 M), clés validées', () => {
  const a = app();
  assert.deepEqual([a.giftAmount('wish:2026-10-18'), a.giftAmount('star:verdure')], [3e6, 10e6]);
  const s = a.normalize({ gifts: { 'wish:2026-10-18': T0, 'star:verdure': T0, 'star:licorne': T0, 'wish:hier': T0 } });
  assert.deepEqual(Object.keys(s.gifts).sort(), ['star:verdure', 'wish:2026-10-18']);
});

test('étape 5 : fusion du souhait, cadeau en double remboursé', () => {
  const a = app();
  const B = a.normalize({ ...a.defaultState(), coins: 10e6 });
  let L = a.clone(B), R = a.clone(B);
  L.townWish = { day: '2026-10-18', tile: 't1', item: 'banc' }; R.townWish = { day: '2026-10-19', tile: 't2', item: 'fleurs' };
  assert.deepEqual([a.merge3(B, L, R).townWish.day, a.merge3(B, R, L).townWish.day], ['2026-10-19', '2026-10-19']);
  L = a.clone(B); R = a.clone(B);
  L.townWish = { day: '2026-10-18', tile: 't1', item: 'banc', done: T0 }; R.townWish = { day: '2026-10-18', tile: 't1', item: 'banc' };
  assert.deepEqual([a.merge3(B, L, R).townWish.done, a.merge3(B, R, L).townWish.done], [T0, T0]);
  L.gifts['wish:2026-10-18'] = T0; L.coins += 3e6;
  R.gifts['wish:2026-10-18'] = T0 + 1; R.coins += 3e6;
  assert.equal(a.merge3(B, L, R).coins, 10e6 + 3e6);
});
