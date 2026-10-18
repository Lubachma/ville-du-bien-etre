const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Ville figée à midi (UTC) du jour donné, avec ses jours actifs et ses réglages.
function app(day = '2026-10-17', days = {}, settings = {}) {
  const wall = Date.parse(day + 'T12:00:00Z');
  class Clock extends Date { constructor(...a) { super(...(a.length ? a : [wall])); } static now() { return wall; } }
  const context = vm.createContext({ console, Date: Clock, Intl, Math, JSON,
    window: {}, document: { documentElement: {} }, navigator: { languages: ['fr-CH'] } });
  const source = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '46-features.js']
    .map(file => fs.readFileSync(path.join(__dirname, '../src', file), 'utf8')).join('\n');
  vm.runInContext(source + `\nthis.api = { normalize, defaultState, streak, streakIfDoneOn, streakDetail, restDaysLeft, isPaused, pauseActive,
    startPause, endPause, weekStartOf, goalWeek, returnBonusFor, rewardFor, get state() { return S; }, set state(v) { S = v; } };`, context);
  const a = context.api;
  a.state.clock.tz = 'UTC';
  a.state.clock.maxSeen = 0;
  a.state.stats.days = { ...days };
  Object.assign(a.state.settings, settings);
  return a;
}
const week = { '2026-10-12': 10, '2026-10-14': 15, '2026-10-16': 20 };   // lundi, mercredi, vendredi

test('repos par semaine', () => {
  const a = app('2026-10-17', week);
  assert.equal(a.state.settings.restDays, 2);
  assert.equal(a.state.settings.weekStart, 'mon');
  assert.equal(a.streak(), 3);
  assert.equal(a.streakIfDoneOn('2026-10-17'), 4);
  assert.equal(a.restDaysLeft(), 0);
  a.state.settings.restDays = 1;
  assert.equal(a.streak(), 2);
  a.state.settings.restDays = 0;
  assert.equal(a.streak(), 1);
});

test('frontière de semaine', () => {
  const a = app('2026-10-13', { '2026-10-08': 10, '2026-10-12': 10 });
  assert.equal(a.streak(), 1);
  a.state.settings.weekStart = 'sun';
  assert.equal(a.streak(), 2);
});

test('pause terminée et pause en cours', () => {
  const a = app('2026-10-17', { '2026-10-10': 10 }, { restDays: 0 });
  a.state.pauses = [{ from: '2026-10-11', to: '2026-10-16' }];
  assert.equal(a.streak(), 1);
  a.state.pauses = [];
  assert.equal(a.streak(), 0);
  const b = app('2026-10-17', { '2026-10-14': 10 }, { restDays: 0 });
  b.state.pauses = [{ from: '2026-10-15', to: '' }];
  assert.equal(b.streak(), 1);
  assert.deepEqual({ ...b.pauseActive() }, { from: '2026-10-15', to: '' });
});

test('pause impossible dans le passé', () => {
  const a = app('2026-10-17');
  a.startPause();
  assert.equal(a.isPaused('2026-10-16'), false);
  assert.equal(a.isPaused('2026-10-17'), true);
  a.endPause();
  assert.deepEqual([...a.state.pauses], []);
  assert.equal(a.pauseActive(), null);
  a.state.pauses = [{ from: '2026-10-15', to: '' }];
  a.endPause();
  assert.equal(a.state.pauses[0].to, '2026-10-16');
  assert.equal(a.isPaused('2026-10-17'), false);
});

test("les réglages s'appliquent au passé", () => {
  const a = app('2026-10-17', week);
  assert.equal(a.streak(), 3);
  a.state.settings.restDays = 0;
  assert.equal(a.streak(), 1);
});

test('les jours de repos comptés sont ceux de la série en cours', () => {
  const a = app('2026-10-17', week);
  assert.deepEqual([...a.streakDetail('2026-10-17').rests].sort(), ['2026-10-13', '2026-10-15']);
  const b = app('2026-10-17', { '2026-10-16': 10 });
  assert.equal(b.restDaysLeft(), 2);
});

test('objectif de la semaine selon le début de semaine', () => {
  const a = app('2026-10-17');
  assert.equal(a.goalWeek('2026-10-17').start, '2026-10-12');
  assert.equal(a.weekStartOf('2026-10-17'), '2026-10-12');
  a.state.settings.weekStart = 'sun';
  assert.equal(a.goalWeek('2026-10-17').start, '2026-10-11');
  assert.equal(a.weekStartOf('2026-10-11'), '2026-10-11');
});

test('ville existante après la mise à jour', () => {
  const a = app('2026-10-17');
  const before = a.defaultState();
  delete before.settings.restDays; delete before.settings.weekStart; delete before.settings.hideStreak; delete before.settings.lang;
  delete before.pauses;
  before.stats.days = { '2026-10-15': 10, '2026-10-16': 10, '2026-10-17': 10 };
  before.clock = { tz: 'UTC', maxSeen: 0, lastDay: '2026-10-17' };
  a.state = a.normalize(JSON.parse(JSON.stringify(before)));
  assert.equal(a.state.settings.restDays, 2);
  assert.equal(a.state.settings.weekStart, 'mon');
  assert.equal(a.state.settings.hideStreak, false);
  assert.equal(a.state.settings.lang, 'fr');
  assert.deepEqual([...a.state.pauses], []);
  assert.ok(a.streak() >= 3);
});

test('pauses invalides écartées, 20 au plus', () => {
  const a = app('2026-10-17');
  const raw = a.defaultState();
  raw.pauses = [{ from: 'hier', to: '' }, { from: '2026-10-10', to: '2026-10-09' }, ...Array.from({ length: 25 }, (_, i) => ({ from: '2026-01-' + String(i + 1).padStart(2, '0'), to: '2026-01-' + String(i + 1).padStart(2, '0') }))];
  const pauses = a.normalize(JSON.parse(JSON.stringify(raw))).pauses;
  assert.equal(pauses.length, 20);
  assert.equal(pauses[19].from, '2026-01-25');
});

test('cadeau de bon retour', () => {
  const day = '2026-10-17';
  assert.equal(app(day, { '2026-10-14': 10 }).returnBonusFor(day), 0, 'les jours de repos couvrent l’absence');
  const back = app(day, { '2026-10-10': 10 });
  assert.equal(back.returnBonusFor(day), 20);
  assert.equal(back.rewardFor(10, 0, day).returnPct, 20);
  assert.equal(back.rewardFor(10, 0, day).total, 12e6);
  const paused = app(day, { '2026-10-10': 10 });
  paused.state.pauses = [{ from: '2026-10-11', to: '2026-10-16' }];
  assert.equal(paused.returnBonusFor(day), 0, 'la pause n’est pas une absence');
  assert.equal(app(day, {}).returnBonusFor(day), 0, 'pas de cadeau pour une ville neuve');
  assert.equal(app(day, { '2026-10-10': 10, '2026-10-17': 5 }).returnBonusFor(day), 0, 'une seule fois par jour');
  assert.equal(app(day, { '2026-10-15': 10 }, { restDays: 0 }).returnBonusFor(day), 0, 'un seul jour d’absence');
  assert.equal(app(day, { '2026-10-14': 10 }, { restDays: 0 }).returnBonusFor(day), 20);
  assert.equal(app(day, { '2026-10-16': 10 }).rewardFor(10, 0, day).returnPct, 0);
});

test('masquer la série garde son bonus', () => {
  const a = app('2026-10-17', week, { hideStreak: true });
  assert.equal(a.rewardFor(10, 0, '2026-10-17').streakPct, 30);
});

test('une ville au son coupé ne se met pas à vibrer après la mise à jour', () => {
  const a = app('2026-10-17');
  assert.equal(a.normalize({ settings: { sound: false } }).settings.vibrate, false);
  assert.equal(a.normalize({ settings: { sound: true } }).settings.vibrate, true);
  assert.equal(a.normalize({ settings: { sound: false, vibrate: true } }).settings.vibrate, true);
  assert.equal(a.normalize({ settings: { vibrate: false } }).settings.vibrate, false);
  assert.equal(a.defaultState().settings.vibrate, true);
});
