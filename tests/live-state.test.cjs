const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js', '46-features.js'];
// Chaque tâche ajoute ici les noms qu'elle crée.
const EXPOSE = ['defaultState', 'normalize', 'merge3', 'clone', 'VISITORS'];
const T0 = Date.parse('2026-10-18T12:00:00Z');
const app = (globals = {}) => loadApp(FILES, { expose: EXPOSE, globals });

test('réglages et données de la ville vivante, par défaut', () => {
  const a = app(), s = a.defaultState();
  assert.deepEqual([s.settings.sky, s.settings.hemisphere, s.settings.ambient], ['time', 'auto', true]);
  assert.deepEqual(plain([s.visits, s.gifts, s.seasons]), [{}, {}, {}]);
});

test('validation : visiteurs, cadeaux et saisons inconnus ignorés, nombres bornés', () => {
  const a = app();
  const s = a.normalize({ settings: { sky: 'disco', hemisphere: 'west', ambient: false },
    visits: { chat: { first: T0, count: 3, last: '2026-10-18' }, licorne: { first: T0, count: 1, last: '2026-10-18' }, renard: { first: 'hier', count: -4, last: 'demain' }, canards: { first: T0, count: 1e9, last: '2026-10-18' } },
    gifts: { 'visit:2026-10-18': T0, 'fest:printemps:2027': T0, 'fest:carnaval:2027': T0, 'visit:hier': T0, cadeau: T0 },
    seasons: { winter: T0, monsoon: T0 } });
  assert.deepEqual([s.settings.sky, s.settings.hemisphere, s.settings.ambient], ['time', 'auto', false]);
  assert.deepEqual(plain(s.visits), { chat: { first: T0, count: 3, last: '2026-10-18' }, canards: { first: T0, count: 100000, last: '2026-10-18' } });
  assert.deepEqual(plain(Object.keys(s.gifts)), ['visit:2026-10-18', 'fest:printemps:2027']);
  assert.deepEqual(plain(s.seasons), { winter: T0 });
});

test("fusion de deux onglets : rencontres, saisons, et un cadeau reçu deux fois ne compte qu'une fois", () => {
  const a = app();
  const B = a.normalize({ ...a.defaultState(), coins: 10e6, visits: { chat: { first: T0 - 864e5, count: 2, last: '2026-10-17' } } });
  const L = a.clone(B), R = a.clone(B);
  L.visits.chat = { first: T0 - 864e5, count: 3, last: '2026-10-18' }; L.gifts['visit:2026-10-18'] = T0; L.coins += 2e6;
  R.visits.chat = { first: T0 - 864e5, count: 3, last: '2026-10-18' }; R.gifts['visit:2026-10-18'] = T0 + 5000; R.coins += 2e6;
  R.visits.renard = { first: T0, count: 1, last: '2026-10-18' };
  L.seasons.autumn = T0 - 1000; R.seasons.autumn = T0;
  L.gifts['fest:printemps:2027'] = T0; L.coins += 5e6;
  const M = a.merge3(B, L, R);
  assert.equal(M.coins, 10e6 + 2e6 + 5e6);
  assert.deepEqual(plain(M.visits), { chat: { first: T0 - 864e5, count: 3, last: '2026-10-18' }, renard: { first: T0, count: 1, last: '2026-10-18' } });
  assert.deepEqual(plain(M.gifts), { 'visit:2026-10-18': T0, 'fest:printemps:2027': T0 });
  assert.equal(M.seasons.autumn, T0 - 1000);
});
