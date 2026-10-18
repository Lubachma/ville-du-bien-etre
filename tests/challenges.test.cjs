const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js', '25-challenges.js'];
const EXPOSE = ['CHALLENGES', 'challengeWeek', 'challengeTargets', 'weekChallenges', 'challengeProgress', 'challengeKey', 'shiftDay'];
// Mercredi 21 octobre 2026 : la semaine commence le lundi 19.
function app(now = '2026-10-21T12:00:00Z') {
  const a = loadApp(FILES, { expose: EXPOSE, now });
  a.state.clock.tz = 'Europe/Zurich'; a.state.clock.maxSeen = 0; a.state.createdAt = Date.parse('2026-01-15T09:00:00Z');
  for (const tile of a.state.city.tiles) tile.at = a.state.createdAt;
  return a;
}
const entry = (day, extra = {}) => ({ id: 'h' + day + (extra.cat || 'esprit') + (extra.min || 10) + (extra.ok === false ? 'x' : ''), name: 'x', cat: 'esprit', min: 10, ok: true, reward: 1,
  at: Date.parse(day + 'T10:00:00Z'), day, source: 'direct', mode: 'focus', ...extra });
// Une semaine (lundi 19 – dimanche 25 octobre) où chaque défi est relevé ; une séance de la semaine d'avant et une échouée ne comptent pas.
function fill(a) {
  const s = a.state;
  s.history.push(entry('2026-10-19', { at: Date.parse('2026-10-19T06:00:00Z') }), entry('2026-10-20', { cat: 'corps', min: 60, at: Date.parse('2026-10-20T19:30:00Z') }),
    entry('2026-10-24', { cat: 'calme', source: 'wishes', mode: 'free' }), entry('2026-10-24', { cat: 'foyer' }),
    entry('2026-10-18', { cat: 'crea' }), entry('2026-10-22', { cat: 'crea', ok: false }));
  s.routines = [{ id: 'r', name: 'R', steps: [] }];
  s.routineRun = { id: 'run', status: 'done', finishedAt: Date.parse('2026-10-22T10:00:00Z') };
  s.gifts['visit:2026-10-20'] = Date.parse('2026-10-20T08:00:00Z'); s.gifts['visit:2026-10-23'] = Date.parse('2026-10-23T08:00:00Z');
  s.city.tiles.push({ id: 'n', item: 'banc', x: 0, y: 0, at: Date.parse('2026-10-21T09:00:00Z'), paid: 2e6 });
}
const family = (a, id) => a.CHALLENGES.find(c => c.id === id).family;

test('défis : trois par semaine, un par famille, les mêmes pour une même semaine', () => {
  const a = app(), list = a.weekChallenges('2026-10-19');
  assert.deepEqual(plain(list.map(c => family(a, c.id))), ['practice', 'moment', 'discovery']);
  assert.deepEqual(plain(a.weekChallenges('2026-10-19')), plain(list));
  const weeks = Array.from({ length: 10 }, (_, i) => a.weekChallenges(a.shiftDay('2026-10-19', 7 * i)).map(c => c.id).join());
  assert.ok(new Set(weeks).size > 1);
});

test('défis : une routine seulement s’il en existe une', () => {
  const a = app(), weeks = Array.from({ length: 30 }, (_, i) => a.shiftDay('2026-01-05', 7 * i));
  assert.ok(weeks.every(w => !a.weekChallenges(w).some(c => c.id === 'routine')));
  a.state.routines = [{ id: 'r', name: 'R', steps: [] }];
  assert.ok(weeks.some(w => a.weekChallenges(w).some(c => c.id === 'routine')));
});

test('défis : cibles de départ, puis à la mesure des quatre semaines passées', () => {
  const a = app();
  const start = plain(a.challengeTargets('2026-10-19'));
  assert.deepEqual([start.domains, start.long], [2, 15]);
  for (let w = 0; w < 4; w++) ['esprit', 'corps', 'calme'].forEach((cat, i) => {
    const day = a.shiftDay('2026-09-21', 7 * w + i);
    a.state.history.push(entry(day, { cat, min: 20 }));
    a.state.stats.dailyCats[day] = { [cat]: 20 };
  });
  const t = plain(a.challengeTargets('2026-10-19'));
  assert.deepEqual([t.domains, t.long], [4, 30]);
  assert.ok(['foyer', 'crea'].includes(t.comeback), t.comeback);
});

test('défis : la progression de chacun dans la semaine, sans la semaine d’avant ni les séances échouées', () => {
  const a = app(), week = '2026-10-19';
  const all = [{ id: 'domains', n: 4 }, { id: 'comeback', cat: 'calme' }, { id: 'long', m: 60 }, { id: 'twoAreas' }, { id: 'morning' }, { id: 'evening' },
    { id: 'weekend' }, { id: 'draw' }, { id: 'routine' }, { id: 'visitors' }, { id: 'build' }, { id: 'focus' }];
  assert.deepEqual(plain(all.filter(c => a.challengeProgress(c, week).done).map(c => c.id)), []);
  fill(a);
  assert.deepEqual(plain(all.filter(c => !a.challengeProgress(c, week).done).map(c => c.id)), []);
  assert.deepEqual(plain(a.challengeProgress({ id: 'domains', n: 5 }, week)), { have: 4, need: 5, done: false });
  assert.equal(a.challengeProgress({ id: 'comeback', cat: 'crea' }, week).done, false);
  assert.deepEqual(plain(a.challengeProgress({ id: 'long', m: 65 }, week)), { have: 60, need: 65, done: false });
});

test('défis : le défi changé est le suivant de sa famille', () => {
  const a = app(), before = plain(a.weekChallenges('2026-10-19'));
  a.state.challenges = { week: '2026-10-19', swapped: 1 };
  const after = plain(a.weekChallenges('2026-10-19'));
  assert.notEqual(after[1].id, before[1].id);
  assert.equal(family(a, after[1].id), 'moment');
  assert.deepEqual([after[0], after[2]], [before[0], before[2]]);
});
