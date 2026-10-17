const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function harness(at = '2026-10-17T12:00:00Z') {
  const now = Date.parse(at);
  class TestDate extends Date { static now() { return now; } }
  const state = {
    activities: [], wishes: [], chores: [], coins: 100e6,
    clock: { tz: 'Europe/Zurich', maxSeen: now, lastDay: '' },
    draw: { pool: 'both', current: null, rerolls: 0, filters: { maxMin: 0, energy: 'any', place: 'any' } },
  };
  let saves = 0;
  const messages = [];
  const sandbox = { S: state, Date: TestDate, Intl, performance: { now: () => 10000 },
    window: { crypto: { getRandomValues: arr => { arr[0] = 0; return arr; } } },
    commit: () => { saves++; }, bump: () => {}, toast: value => messages.push(value), setTimeout };
  vm.createContext(sandbox);
  const source = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '20-rules.js', '41-activities.js', '42-draw.js']
    .map(file => fs.readFileSync(path.join(root, 'src', file), 'utf8')).join('\n');
  vm.runInContext(source + `\n animateDraw = () => { drawAnim = null; };
    globalThis.api = { taskAvailable, taskNextDay, completeTask, resetTask, matchesDrawFilters, poolItems, drawAlternatives, doDraw, drawFilters,
      unlockDraw: () => { drawBusyUntil = 0; drawAnim = null; } };`, sandbox);
  return { state, api: sandbox.api, messages, saves: () => saves };
}
function item(id, extra = {}) {
  return { id, name: id, cat: 'corps', min: 10, mode: 'focus', energy: 'medium', place: 'any', repeat: 'always', completedAt: null, ...extra };
}

test('une obligation ponctuelle réussie quitte le pool sans supprimer sa source', () => {
  const h = harness();
  h.state.chores.push(item('task', { repeat: 'once' }));
  assert.equal(h.api.poolItems('chores').length, 1);
  h.api.completeTask({ source: 'chores', sourceId: 'task' });
  assert.equal(h.api.poolItems('chores').length, 0);
  assert.equal(h.state.chores.length, 1);
  assert.equal(h.saves(), 0, 'la session doit pouvoir enregistrer complétion et récompense ensemble');
  h.api.resetTask('chores', 'task');
  assert.equal(h.api.poolItems('chores').length, 1);
  assert.equal(h.saves(), 1);
});

test('complétion directe et ancien snapshot de tirage retrouvent la source', () => {
  const h = harness();
  h.state.activities.push(item('a', { repeat: 'once' }));
  h.state.wishes.push(item('w', { repeat: 'once' }));
  h.api.completeTask({ source: 'direct', sourceId: 'a' });
  h.api.completeTask({ source: 'wishes', draw: { id: 'w' } });
  assert.equal(h.api.taskAvailable(h.state.activities[0]), false);
  assert.equal(h.api.taskAvailable(h.state.wishes[0]), false);
  assert.doesNotThrow(() => h.api.completeTask({ source: 'routine', sourceId: 'a' }));
});

test('une activité quotidienne revient à minuit dans le fuseau de la ville', () => {
  const h = harness('2026-10-17T21:59:59Z');
  const it = item('d', { repeat: 'daily', completedAt: Date.parse('2026-10-17T10:00:00Z') });
  assert.equal(h.api.taskAvailable(it, Date.parse('2026-10-17T21:59:59Z')), false);
  assert.equal(h.api.taskAvailable(it, Date.parse('2026-10-17T22:00:00Z')), true);
  assert.equal(h.api.taskNextDay(it), '2026-10-18');
});

test('fréquence hebdomadaire respecte sept jours calendaires malgré le changement d’heure', () => {
  const h = harness();
  const it = item('w', { repeat: 'weekly', completedAt: Date.parse('2026-10-24T22:30:00Z') });
  assert.equal(h.api.taskNextDay(it), '2026-11-01');
  assert.equal(h.api.taskAvailable(it, Date.parse('2026-10-31T22:59:59Z')), false);
  assert.equal(h.api.taskAvailable(it, Date.parse('2026-10-31T23:00:00Z')), true);
});

test('les éléments existants et toujours disponibles restent éligibles après réussite', () => {
  const h = harness();
  assert.equal(h.api.taskAvailable(item('a', { completedAt: Date.now() })), true);
  assert.equal(h.api.taskAvailable({ id: 'old', min: 10 }), true);
});

test('temps, budget d’énergie et lieu filtrent ensemble et acceptent les idées sans lieu imposé', () => {
  const h = harness();
  h.state.draw.filters = { maxMin: 15, energy: 'medium', place: 'inside' };
  h.state.wishes = [item('low', { energy: 'low', place: 'inside' }), item('any'),
    item('hard', { energy: 'high' }), item('long', { min: 20 }), item('out', { place: 'outside' }),
    item('done', { repeat: 'once', completedAt: Date.now() })];
  assert.deepEqual(Array.from(h.api.poolItems('wishes'), it => it.id), ['low', 'any']);
});

test('le bonus est calculé sur les seuls candidats éligibles', () => {
  const h = harness();
  h.state.draw.pool = 'chores';
  h.state.chores = [item('a'), item('b'), item('c', { min: 30 })];
  h.state.draw.filters.maxMin = 15;
  h.api.doDraw();
  assert.equal(h.state.draw.current.pool, 2);
  assert.equal(h.state.draw.current.bonus, 0);
  assert.equal(h.state.coins, 100e6);
  assert.equal(h.saves(), 1);
});

test('trois obligations éligibles donnent le bonus et conservent le mode dans le snapshot', () => {
  const h = harness();
  h.state.draw.pool = 'chores';
  h.state.chores = [item('a', { mode: 'free' }), item('b'), item('c')];
  h.api.doDraw();
  assert.equal(h.state.draw.current.bonus, 50);
  assert.equal(h.state.draw.current.mode, 'free');
});

test('une relance sans alternative ne débite jamais les pièces ou le compteur', () => {
  const h = harness();
  h.state.wishes = [item('a')];
  h.state.draw.current = { ...item('a'), kind: 'wishes', bonus: 20, pool: 5 };
  h.state.draw.rerolls = 2;
  const before = JSON.stringify(h.state);
  h.api.doDraw();
  assert.equal(JSON.stringify(h.state), before);
  assert.equal(h.saves(), 0);
  assert.match(h.messages[0], /aucune pièce/i);
});

test('un pool vide après filtrage conserve le tirage et ses coûts sans débit', () => {
  const h = harness();
  h.state.wishes = [item('a', { min: 30 })];
  h.state.draw.current = { ...item('a'), kind: 'wishes', bonus: 20, pool: 5 };
  h.state.draw.filters.maxMin = 5;
  const before = JSON.stringify(h.state);
  h.api.doDraw();
  assert.equal(JSON.stringify(h.state), before);
  assert.equal(h.saves(), 0);
});

test('un seul candidat différent du tirage exclu reste une alternative facturée au coût existant', () => {
  const h = harness();
  h.state.wishes = [item('a', { min: 30 }), item('b', { min: 5 })];
  h.state.draw.current = { ...h.state.wishes[0], kind: 'wishes', bonus: 10, pool: 5 };
  h.state.draw.rerolls = 2;
  h.state.draw.filters.maxMin = 5;
  h.api.doDraw();
  assert.equal(h.state.draw.current.id, 'b');
  assert.equal(h.state.coins, 96e6);
  assert.equal(h.state.draw.rerolls, 3);
  assert.equal(h.state.draw.current.bonus, 0);
});

test('deux éléments avec le même identifiant dans deux listes restent distincts', () => {
  const h = harness();
  const alternatives = h.api.drawAlternatives([{ id: 'a', kind: 'wishes' }, { id: 'a', kind: 'chores' }], { id: 'a', kind: 'wishes' });
  assert.equal(alternatives.length, 1);
  assert.equal(alternatives[0].kind, 'chores');
});


test('une quotidienne libre terminée hier est déjà disponible à la réouverture du lendemain', () => {
  const h = harness('2026-10-18T08:00:00Z');
  h.state.chores = [item('daily', { repeat: 'daily' })];
  const startedAt = Date.parse('2026-10-17T16:00:00Z');
  const deadline = startedAt + 5 * 60000;
  h.api.completeTask({ source: 'chores', sourceId: 'daily', mode: 'free', startedAt, deadline });
  assert.equal(h.state.chores[0].completedAt, deadline);
  assert.equal(h.api.taskAvailable(h.state.chores[0]), true);
  assert.equal(h.api.taskNextDay(h.state.chores[0]), '2026-10-18');
});

test('la date de complétion libre reste bornée entre le début et maintenant', () => {
  const h = harness('2026-10-18T08:00:00Z');
  h.state.chores = [item('daily', { repeat: 'daily' })];
  const startedAt = Date.parse('2026-10-18T07:55:00Z');
  h.api.completeTask({ source: 'chores', sourceId: 'daily', mode: 'free', startedAt, deadline: startedAt + 20 * 60000 });
  assert.equal(h.state.chores[0].completedAt, Date.parse('2026-10-18T08:00:00Z'));
});
