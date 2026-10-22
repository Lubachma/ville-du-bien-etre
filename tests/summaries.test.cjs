const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js',
  '25-challenges.js', '26-summaries.js', '46-features.js'];
const EXPOSE = ['periodSummary', 'weekReview', 'recapSummary', 'periodRange', 'monthKey', 'shiftDay', 'pendingRitual', 'markRitual', 'setMood', 'moodInsights', 'moodDifficult', 'periodActive', 'HISTORY_MAX'];
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
  assert.deepEqual(m.byCat, { esprit: 35, corps: 45, calme: 40 });
  assert.deepEqual([a.periodActive('month', '2026-10'), a.periodActive('month', '2026-09')], [true, false]);
  assert.equal(a.recapSummary('year', '2026').sessions, null);
});

// Octobre 2026 à 6 séances de 10 min par jour (« count » séances en tout, depuis le 1er). Comme dans l'app, chaque séance s'ajoute en tête
// du journal, qui ne garde que les HISTORY_MAX dernières, et aux statistiques, qui gardent tout.
function busyMonth(a, count) {
  const s = a.state;
  for (let i = 0; i < count; i++) {
    const day = '2026-10-' + String(1 + Math.floor(i / 6)).padStart(2, '0');
    s.history.unshift({ id: 's' + i, name: 'Séance ' + i, cat: 'calme', min: 10, ok: true, reward: 1e7, at: Date.parse(day + 'T10:00:00Z') + (i % 6) * 6e5, day,
      source: 'direct', mode: 'focus', ...(i % 5 === 0 ? { mood: 5 } : {}) });
    if (s.history.length > a.HISTORY_MAX) s.history.length = a.HISTORY_MAX;
    for (const stats of [s.stats, s.stats.effort]) stats.days[day] = (stats.days[day] || 0) + 10;
    const dc = s.stats.dailyCats[day] || (s.stats.dailyCats[day] = {}); dc.calme = (dc.calme || 0) + 10;
  }
}
test('récapitulatif : un journal plein ne donne pas de chiffres faux', () => {
  const a = app('2026-11-02T12:00:00Z'); busyMonth(a, 186);
  // 186 séances ont eu lieu, le journal en garde 150 : la plus ancienne est du 7 octobre.
  assert.deepEqual([a.state.history.length, a.state.history[149].day], [a.HISTORY_MAX, '2026-10-07']);
  const m = plain(a.recapSummary('month', '2026-10'));
  assert.deepEqual([m.sessions, m.longest, m.moods], [null, null, null]);
  // Le reste ne dépend pas du journal : il vient des statistiques, et reste complet.
  assert.deepEqual([m.minutes, m.activeDays, m.byCat, m.favorite], [1860, 31, { calme: 1860 }, 'calme']);
  // Avec 20 séances seulement, le journal couvre tout le mois : il garde ses chiffres.
  const b = app('2026-11-02T12:00:00Z'); busyMonth(b, 20);
  const few = plain(b.recapSummary('month', '2026-10'));
  assert.equal(few.sessions, 20);
  assert.equal(few.longest && few.longest.min, 10);
  assert.deepEqual(few.moods, { good: 4, total: 4 });
  assert.equal(few.minutes, 200);
});
test('bilan : une semaine que le journal plein ne couvre plus suit la même règle', () => {
  const a = app('2026-11-02T12:00:00Z'); busyMonth(a, 186);
  // Le journal remonte au 7 octobre : la semaine du 5 n'y est qu'en partie, celle du 12 y est en entier.
  const partial = plain(a.weekReview('2026-10-05')), whole = plain(a.weekReview('2026-10-12'));
  assert.deepEqual([partial.sessions, partial.longest, partial.moods], [null, null, null]);
  assert.deepEqual([partial.minutes, partial.activeDays], [420, 7]);
  assert.deepEqual([whole.sessions, whole.minutes, whole.moods], [42, 420, { good: 8, total: 8 }]);
});
test('récapitulatif : plein, le journal couvre une période si sa plus ancienne séance la précède strictement', () => {
  const entry = (id, day) => ({ id, name: id, cat: 'calme', min: 10, ok: true, reward: 1, at: Date.parse(day + 'T10:00:00Z'), day, source: 'direct', mode: 'focus' });
  // « count » séances du 20 octobre, la plus ancienne datée « oldest » ; la période est tout octobre.
  const sessions = (count, oldest) => {
    const a = app('2026-11-02T12:00:00Z');
    a.state.history = [...Array.from({ length: count - 1 }, (_, i) => entry('n' + i, '2026-10-20')), entry('old', oldest)];
    return a.periodSummary('2026-10-01', '2026-10-31').sessions;
  };
  assert.equal(sessions(150, '2026-09-30'), 149);   // la veille : rien d'octobre n'a pu sortir (la séance du 30 septembre n'en fait pas partie)
  assert.equal(sessions(150, '2026-10-01'), null);   // le premier jour : des séances de ce jour ont pu sortir
  assert.equal(sessions(150, '2026-10-02'), null);
  assert.equal(sessions(149, '2026-10-01'), 149);    // pas plein : le journal n'a rien perdu
  assert.equal(sessions(1, '2026-10-01'), 1);
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

const moodAt = (a, id, cat, mood, at) => a.state.history.push({ id, name: 'x', cat, min: 10, ok: true, reward: 1, at, day: '2026-10-20', source: 'direct', mode: 'focus', mood });
test('humeur : ce qui te fait du bien, dès 5 humeurs notées', () => {
  const a = app(), at = Date.parse('2026-10-20T10:00:00Z');
  [['calme', 5], ['calme', 4], ['corps', 1], ['calme', 2]].forEach(([cat, mood], i) => moodAt(a, 'm' + i, cat, mood, at - i));
  assert.equal(a.moodInsights(), null);
  moodAt(a, 'm4', 'calme', 4, at - 4);
  assert.deepEqual(plain(a.moodInsights()), { total: 5, rows: [{ cat: 'calme', good: 3, total: 4 }], top: { cat: 'calme', good: 3, total: 4 } });
});
test('humeur : les moments difficiles, sur les 5 dernières humeurs des 14 derniers jours', () => {
  const a = app('2026-10-21T12:00:00Z'), now = Date.parse('2026-10-21T10:00:00Z');
  [2, 1, 4].forEach((m, i) => moodAt(a, 'd' + i, 'calme', m, now - (i + 1) * 864e5));
  assert.equal(a.moodDifficult('2026-10-21'), false);
  moodAt(a, 'd3', 'calme', 2, now - 4 * 864e5);
  assert.equal(a.moodDifficult('2026-10-21'), true);
  const b = app('2026-10-21T12:00:00Z');
  [2, 1, 2].forEach((m, i) => moodAt(b, 'o' + i, 'calme', m, now - (20 + i) * 864e5));
  assert.equal(b.moodDifficult('2026-10-21'), false);
});
