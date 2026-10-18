const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js', '46-features.js', '53-visits.js'];
// Chaque tâche ajoute ici les noms qu'elle crée.
const EXPOSE = ['defaultState', 'normalize', 'merge3', 'clone', 'VISITORS', 'meetVisitor', 'claimVisitGift', 'today', 'shiftDay', 'greetFestivals',
  'checkAchievements', 'noteSeason', 'liveTick', 'ambientCaption'];
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

test('rencontre : une par jour, la première se remarque', () => {
  const a = app({ commit: () => true, toast() {} });
  assert.deepEqual(plain(a.meetVisitor('chat', '2026-10-18')), { first: true });
  assert.deepEqual(plain(a.meetVisitor('chat', '2026-10-18')), { first: false });
  a.meetVisitor('chat', '2026-10-19');
  assert.deepEqual([a.state.visits.chat.count, a.state.visits.chat.last], [2, '2026-10-19']);
});

test('cadeau du visiteur : une fois par jour, et pas pour un jour déjà passé', () => {
  const a = app({ commit: () => true, toast() {} });
  a.state.clock.tz = 'Europe/Zurich'; a.state.clock.maxSeen = 0;
  const day = a.today(), coins = a.state.coins;
  assert.equal(a.claimVisitGift(day), true);
  assert.equal(a.claimVisitGift(day), false);
  assert.equal(a.state.coins, coins + 2e6);
  // Horloge reculée d'un jour : la veille est déjà passée, rien de plus.
  assert.equal(a.claimVisitGift(a.shiftDay(day, -1)), false);
  assert.equal(a.state.coins, coins + 2e6);
});

test("fête : un cadeau une fois par an, 10 M pour l'anniversaire, un seul message", () => {
  const messages = [], a = app({ commit: () => true, toast: m => messages.push(m) });
  a.state.clock.tz = 'Europe/Zurich'; a.state.createdAt = Date.parse('2026-03-21T09:00:00Z');
  const coins = a.state.coins;
  assert.deepEqual(plain(a.greetFestivals('2027-03-21')), ['fest:printemps:2027', 'fest:anniversaire:2027']);
  assert.deepEqual(plain(a.greetFestivals('2027-03-21')), []);
  assert.equal(a.state.coins, coins + 5e6 + 10e6);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /Fête du printemps.*1\u00a0an/);
  a.greetFestivals('2026-12-31');
  assert.match(messages[1], /^Bonne année/);
});

test('succès de la ville vivante : visiteurs, première fête et quatre saisons ; rien sur une ville vide', () => {
  const a = app();
  assert.deepEqual(plain(a.checkAchievements()), []);
  const met = { first: T0, count: 1, last: '2026-10-18' };
  a.state.visits = { chat: met };
  a.state.gifts['visit:2026-10-18'] = T0;
  assert.deepEqual(plain(a.checkAchievements()), ['premiere-visite']);
  for (const id of ['herisson', 'ecureuil', 'cigogne', 'canards', 'renard']) a.state.visits[id] = met;
  assert.deepEqual(plain(a.checkAchievements()), ['bon-accueil']);
  a.state.gifts['fest:printemps:2027'] = T0;
  assert.deepEqual(plain(a.checkAchievements()), ['jour-de-fete']);
  a.state.seasons = { spring: T0, summer: T0, autumn: T0 };
  assert.deepEqual(plain(a.checkAchievements()), []);
  a.state.seasons.winter = T0;
  assert.deepEqual(plain(a.checkAchievements()), ['quatre-saisons']);
});

test('saisons vues : chacune notée une seule fois', () => {
  const a = app();
  a.state.clock.tz = 'Europe/Zurich';
  assert.equal(a.noteSeason('2026-10-18'), true);
  assert.equal(a.noteSeason('2026-11-02'), false);
  assert.deepEqual(plain(Object.keys(a.state.seasons)), ['autumn']);
});

test("tic de la ville vivante : saison nouvelle et fête le même jour, un seul enregistrement et un seul message", () => {
  let commits = 0;
  const messages = [], a = app({ commit: () => { commits++; return true; }, toast: m => messages.push(m) });
  a.state.clock.tz = 'Europe/Zurich';
  a.liveTick('2027-03-21');
  assert.deepEqual([commits, messages.length, plain(Object.keys(a.state.seasons))], [1, 1, ['spring']]);
  a.liveTick('2027-03-21');
  assert.equal(commits, 1);
  // Une saison nouvelle sans fête : enregistrée, sans message.
  a.liveTick('2027-06-01');
  assert.deepEqual([commits, messages.length, plain(Object.keys(a.state.seasons))], [2, 1, ['spring', 'summer']]);
});

test('légende : le moment, la météo, le visiteur de passage et la fête', () => {
  const a = app();
  assert.equal(a.ambientCaption({ moment: { name: 'dusk' }, weather: 'rain', rainbow: false, visitor: { id: 'herisson' }, festivals: [{ id: 'printemps' }] }),
    'Crépuscule · Pluie · Le hérisson est de passage · Fête du printemps');
  assert.equal(a.ambientCaption({ moment: { name: 'day', t: .5 }, weather: 'sun', rainbow: true, visitor: null, festivals: [] }), 'Journée · Soleil · Arc-en-ciel');
});
