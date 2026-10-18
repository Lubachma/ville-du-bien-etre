const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js'];
const EXPOSE = ['defaultState', 'normalize', 'merge3', 'clone', 'giftAmount', 'SHARE_ITEMS', 'ITEMS', 'CHALLENGES'];
const T0 = Date.parse('2026-10-18T12:00:00Z');
const app = () => loadApp(FILES, { expose: EXPOSE });

test('rituels : réglages et données par défaut', () => {
  const s = app().defaultState();
  assert.deepEqual([s.settings.rituals, s.settings.challenges, s.settings.mood], [true, true, true]);
  assert.deepEqual(plain([s.challenges, s.postcards, s.rituals, s.shareId]), [{ week: '', swapped: -1 }, {}, { week: '', month: '', year: '' }, '']);
});

test('rituels : douze défis en trois familles, leur montant, un ordre figé des éléments', () => {
  const a = app();
  assert.deepEqual(plain(a.CHALLENGES.map(c => c.family + ':' + c.id)), ['practice:domains', 'practice:comeback', 'practice:long', 'practice:twoAreas',
    'moment:morning', 'moment:evening', 'moment:weekend', 'discovery:draw', 'discovery:routine', 'discovery:visitors', 'discovery:build', 'discovery:focus']);
  assert.equal(a.giftAmount('chal:2026-10-19:domains'), 5e6);
  assert.deepEqual(plain([...a.SHARE_ITEMS].sort()), plain(Object.keys(a.ITEMS).sort()));
});

test('rituels : validation des défis, humeurs, cartes postales, marqueurs et identifiant', () => {
  const a = app(), code = 'AQcAAA';
  const cards = Object.fromEntries(Array.from({ length: 52 }, (_, i) => [i.toString(16).padStart(12, '0'), { code, name: 'Ville ' + i, size: 7, count: 3, at: T0 + i }]));
  cards.zz = { code, name: 'x', size: 7, count: 1, at: T0 };
  cards['0000000000ff'] = { code: 'pas un code !', name: 'y', size: 7, count: 1, at: T0 + 99 };
  const s = a.normalize({ ...a.defaultState(), settings: { rituals: false, challenges: 'non', mood: false },
    challenges: { week: '2026-10-19', swapped: 7 }, rituals: { week: '2026-10-12', month: '2026-9', year: '2026' }, shareId: 'ABC',
    gifts: { 'chal:2026-10-19:domains': T0, 'chal:2026-10-19:licorne': T0, 'chal:hier:long': T0 }, postcards: cards,
    history: [{ id: 'a', name: 'x', cat: 'esprit', min: 10, ok: true, at: T0, mood: 4 }, { id: 'b', name: 'x', cat: 'esprit', min: 10, ok: true, at: T0 - 1, mood: 9 }] });
  assert.deepEqual([s.settings.rituals, s.settings.challenges, s.settings.mood], [false, true, false]);
  assert.deepEqual(plain([s.challenges, s.rituals, s.shareId]), [{ week: '2026-10-19', swapped: -1 }, { week: '2026-10-12', month: '', year: '2026' }, '']);
  assert.deepEqual(plain(Object.keys(s.gifts)), ['chal:2026-10-19:domains']);
  assert.deepEqual(plain(s.history.map(e => e.mood)), [4, undefined]);
  assert.equal(Object.keys(s.postcards).length, 50);
  for (const gone of ['000000000000', '000000000001', 'zz', '0000000000ff']) assert.ok(!(gone in s.postcards), gone);
});

test('rituels : fusion de deux onglets', () => {
  const a = app();
  const B = a.normalize({ ...a.defaultState(), coins: 10e6, history: [{ id: 'h1', name: 'x', cat: 'calme', min: 10, ok: true, at: T0 }] });
  const L = a.clone(B), R = a.clone(B);
  L.history[0].mood = 5;
  L.postcards['00000000000a'] = { code: 'AQcAAA', name: 'Léa', size: 7, count: 2, at: T0 };
  R.postcards['00000000000a'] = { code: 'AQkAAA', name: 'Léa', size: 9, count: 5, at: T0 + 5000 };
  R.postcards['00000000000b'] = { code: 'AQcAAA', name: 'Tom', size: 7, count: 1, at: T0 };
  L.rituals = { week: '2026-10-12', month: '2026-09', year: '' }; R.rituals = { week: '2026-10-05', month: '2026-10', year: '2025' };
  L.gifts['chal:2026-10-19:long'] = T0; L.coins += 5e6;
  R.gifts['chal:2026-10-19:long'] = T0 + 1; R.coins += 5e6;
  const M = a.merge3(B, L, R);
  assert.equal(M.history[0].mood, 5);
  assert.deepEqual(plain(Object.keys(M.postcards).sort()), ['00000000000a', '00000000000b']);
  assert.equal(M.postcards['00000000000a'].size, 9);
  assert.deepEqual(plain(M.rituals), { week: '2026-10-12', month: '2026-10', year: '2025' });
  assert.equal(M.coins, 10e6 + 5e6);
});
