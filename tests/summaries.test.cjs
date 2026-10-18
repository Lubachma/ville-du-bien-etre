const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js',
  '25-challenges.js', '26-summaries.js', '46-features.js'];
const EXPOSE = ['periodSummary', 'weekReview', 'recapSummary', 'periodRange', 'monthKey', 'shiftDay', 'pendingRitual', 'markRitual', 'setMood'];
function app(now = '2026-10-27T12:00:00Z') {
  const a = loadApp(FILES, { expose: EXPOSE, now });
  a.state.clock.tz = 'Europe/Zurich'; a.state.clock.maxSeen = 0; a.state.createdAt = Date.parse('2026-05-04T09:00:00Z');
  for (const tile of a.state.city.tiles) tile.at = a.state.createdAt;
  return a;
}
// La semaine du lundi 19 octobre 2026, et 20 min la semaine d'avant.
function week(a) {
  const s = a.state, add = (day, cat, min, extra = {}) => {
    s.history.push({ id: day + cat + min, name: 'Séance ' + cat, cat, min, ok: true, reward: min * 1e6, at: Date.parse(day + 'T10:00:00Z'), day, source: 'direct', mode: 'focus', ...extra });
    for (const stats of [s.stats, s.stats.effort]) stats.days[day] = (stats.days[day] || 0) + min;
    const dc = s.stats.dailyCats[day] || (s.stats.dailyCats[day] = {}); dc[cat] = (dc[cat] || 0) + min;
  };
  add('2026-10-13', 'esprit', 20);
  add('2026-10-19', 'calme', 30, { mood: 5 }); add('2026-10-21', 'corps', 45, { mood: 4 }); add('2026-10-21', 'calme', 10, { mood: 2 }); add('2026-10-24', 'esprit', 15);
  s.city.tiles.push({ id: 'n1', item: 'banc', x: 0, y: 0, at: Date.parse('2026-10-22T09:00:00Z'), paid: 2e6 });
  s.visits.chat = { first: Date.parse('2026-10-20T08:00:00Z'), count: 1, last: '2026-10-20' };
  s.gifts['chal:2026-10-19:long'] = Date.parse('2026-10-21T10:00:00Z');
  s.achievements['premier-pas'] = Date.parse('2026-10-19T10:00:00Z');
  s.goals = { minutes: 90, days: 3, cat: 'all', building: '' };
}

test('bilan de la semaine : chiffres, beaux moments et phrase d’accueil', () => {
  const a = app(); week(a);
  const r = plain(a.weekReview('2026-10-19'));
  assert.deepEqual([r.from, r.to, r.minutes, r.activeDays, r.sessions], ['2026-10-19', '2026-10-25', 100, 3, 4]);
  assert.deepEqual([r.cats, r.favorite, r.longest], [['esprit', 'corps', 'calme'], 'corps', { name: 'Séance corps', min: 45 }]);
  assert.deepEqual([r.built, r.visitors, r.challenges, r.achievements], [1, 1, 1, 1]);
  assert.deepEqual(r.moods, { good: 2, total: 3 });
  assert.deepEqual([r.goal.done, r.gain, r.headline], [true, 80, 'great']);
  a.state.goals.minutes = 200;
  assert.equal(a.weekReview('2026-10-19').headline, 'full');
  assert.equal(a.weekReview('2026-10-12').headline, 'gentle');
});

test('bilan : une semaine vide dit « Bon retour », et le progrès n’est jamais négatif', () => {
  const a = app(); week(a);
  const empty = plain(a.weekReview('2026-10-26'));
  assert.deepEqual([empty.minutes, empty.headline, empty.gain], [0, 'back', 0]);
});

test('récapitulatifs : bornes du mois et de l’année, chiffres du mois, pas de séances pour l’année', () => {
  const a = app(); week(a);
  assert.deepEqual(plain(a.periodRange('month', '2024-02')), { from: '2024-02-01', to: '2024-02-29' });
  assert.deepEqual(plain(a.periodRange('year', '2026')), { from: '2026-01-01', to: '2026-12-31' });
  assert.equal(a.monthKey('2026-10-27'), '2026-10');
  const m = plain(a.recapSummary('month', '2026-10'));
  assert.deepEqual([m.minutes, m.activeDays, m.sessions, m.favorite, m.bestDay], [120, 4, 5, 'corps', { day: '2026-10-21', minutes: 55 }]);
  assert.equal(a.recapSummary('year', '2026').sessions, null);
});

test('bilan dû : une fois par semaine, jamais pour une ville de la semaine, ni deux fois en changeant le début de semaine', () => {
  const a = app('2026-10-27T12:00:00Z'); week(a);
  assert.deepEqual(plain(a.pendingRitual('2026-10-27')), { kind: 'week', key: '2026-10-19' });
  a.markRitual('week', '2026-10-19');
  assert.equal(a.pendingRitual('2026-10-27'), null);
  a.state.settings.weekStart = 'sun';
  assert.equal(a.pendingRitual('2026-10-27'), null);
  const b = app('2026-10-27T12:00:00Z'); b.state.createdAt = Date.parse('2026-10-26T08:00:00Z');
  assert.equal(b.pendingRitual('2026-10-27'), null);
  const c = app('2026-10-27T12:00:00Z'); week(c); c.state.settings.rituals = false;
  assert.equal(c.pendingRitual('2026-10-27'), null);
});

test('bilan dû : le mois avant la semaine, l’année en janvier, rien pour un mois sans activité', () => {
  const a = app('2026-11-02T12:00:00Z'); week(a);
  assert.deepEqual(plain(a.pendingRitual('2026-11-02')), { kind: 'month', key: '2026-10' });
  a.markRitual('month', '2026-10');
  assert.deepEqual(plain(a.pendingRitual('2026-11-02')), { kind: 'week', key: '2026-10-26' });
  const j = app('2027-01-04T12:00:00Z'); week(j);
  assert.deepEqual(plain(j.pendingRitual('2027-01-04')), { kind: 'year', key: '2026' });
  j.markRitual('year', '2026');
  assert.equal(j.state.rituals.month, '2026-12');
  const e = app('2026-12-01T12:00:00Z'); week(e); e.markRitual('week', '2026-11-23');
  assert.equal(e.pendingRitual('2026-12-01'), null);
});

test('humeur : notée sur une séance, changée, retirée ; rien pour une séance inconnue ou hors bornes', () => {
  const a = app(); week(a);
  const id = a.state.history[1].id;
  assert.equal(a.setMood(id, 3), true);
  assert.equal(a.state.history[1].mood, 3);
  assert.equal(a.setMood(id, 0), true);
  assert.equal('mood' in a.state.history[1], false);
  assert.deepEqual([a.setMood('inconnue', 3), a.setMood(id, 9)], [false, false]);
});
