const test = require('node:test');
const assert = require('node:assert/strict');
const { storage, lockManager, stateApp } = require('./helpers/state-vm.cjs');

// L'horloge de la ville (A3, A4) : seules les fins de séance la font avancer, le ciel suit l'heure du téléphone, et une date
// impossible (sauvegarde modifiée, horloge déréglée) ne bloque plus l'app.
const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '24-ambient.js', '50-session.js'];
const EXPOSE = ['today', 'ambientAt', 'streak', 'isDayKey'];
// Instants à Zurich, le fuseau de la ville : heure d'été jusqu'au 25 octobre 2026 à 3 h, heure d'hiver ensuite.
const OCT21 = '2026-10-21T10:00:00+02:00', BACK = '2026-10-21T10:05:00+02:00', OCT25 = '2026-10-25T10:00:00+01:00';
const VISITS = { files: ['53-visits.js'], expose: ['claimVisitGift'] };
const settle = () => new Promise(resolve => setTimeout(resolve, 10));

// Le stockage d'une ville de Zurich : une série de 10 jours finie le 20 octobre, une dernière séance vue le 21 à 10 h.
// `clock` remplace des parties de son horloge, `extra` d'autres champs.
function town(clock = {}, extra = {}) {
  const disk = storage(), raw = { ...stateApp().defaultState(), ...extra };
  raw.clock = { tz: 'Europe/Zurich', maxSeen: Date.parse(OCT21), lastDay: '2026-10-20', ...clock };
  for (let day = 11; day <= 20; day++) raw.stats.days['2026-10-' + day] = 20;
  disk.setItem('ville-bien-etre/v2', JSON.stringify(raw));
  return disk;
}
// Un onglet ouvert sur ce stockage à l'instant `now` ; `files` et `expose` ajoutent des fichiers de src/ et les noms à rendre.
function open(disk = town(), { now = OCT21, files = [], expose = [] } = {}) {
  const a = stateApp(disk, lockManager(), { files: [...FILES, ...files].sort(), expose: [...EXPOSE, ...expose] });
  a.setNow(now);
  a.init();
  return a;
}
// Une Activité libre menée au bout, terminée au tic qui suit sa durée ; renvoie son entrée du journal.
async function session(a, min = 10) {
  await a.startSession({ name: 'Lecture', cat: 'esprit', min, mode: 'free' });
  a.advance(min * 60000);
  a.tick(); await settle(); await settle();
  const entry = a.api.state.history[0];
  assert.equal(entry.ok, true);
  return entry;
}

test("horloge : une sauvegarde à 9e15 ne bloque plus l'app", () => {
  // 9e15 dépasse la plus grande date que JavaScript sait représenter (8,64e15) : chaque calcul du jour levait une RangeError.
  const a = open(town({ maxSeen: 9e15 }, { updatedAt: 9e15 }));
  assert.equal(a.today(), '2026-10-21');
  const s = a.normalize({ clock: { maxSeen: 9e15 }, updatedAt: 9e15 });
  assert.equal(s.clock.maxSeen, 0);
  assert.equal(s.updatedAt, 0);
});

test('horloge : une heure vue après 2099 ne fait rien repayer', () => {
  // Au-delà des dates valides (2099), l'horloge de la ville datait les cadeaux d'une date que la relecture refuse : oubliés,
  // ils étaient repayés à chaque rechargement.
  const disk = town({ maxSeen: 4.2e12 }), a = open(disk, VISITS);
  assert.equal(a.today(), '2026-10-21');
  assert.equal(a.claimVisitGift(a.today()), true);
  a.commit({ silent: true });
  const b = open(disk, VISITS);
  assert.equal(b.claimVisitGift(b.today()), false);
});

test('horloge : un lastDay de 2099 est ramené', () => {
  const a = open();
  assert.equal(a.normalize({ clock: { tz: 'Europe/Zurich', lastDay: '2099-12-31' } }).clock.lastDay, '2026-10-21');
  // Un jour déjà passé reste, et la borne suit l'heure la plus avancée vue à une fin de séance.
  assert.equal(a.normalize({ clock: { tz: 'Europe/Zurich', lastDay: '2026-10-20' } }).clock.lastDay, '2026-10-20');
  assert.equal(a.normalize({ clock: { tz: 'Europe/Zurich', maxSeen: Date.parse(OCT25), lastDay: '2026-10-25' } }).clock.lastDay, '2026-10-25');
});

test('horloge : les vraies dates seulement', () => {
  const a = open();
  assert.equal(a.isDayKey('2026-02-30'), false);
  assert.equal(a.isDayKey('9999-99-99'), false);
  assert.equal(a.isDayKey('2024-02-29'), true);
  for (const day of ['2026-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-10-00', '2026-10-32']) assert.equal(a.isDayKey(day), false, day);
  for (const day of ['2000-02-29', '2026-02-28', '2026-04-30', '2026-12-31', '9999-12-31']) assert.equal(a.isDayKey(day), true, day);
  assert.equal(a.normalize({ clock: { lastDay: '2026-02-30' } }).clock.lastDay, '');
});

test('horloge : avancée puis remise sans séance, rien ne fige', async () => {
  const a = open();
  assert.equal(a.streak(), 10);
  // Le téléphone est avancé au 25 par erreur : un réglage est enregistré, puis l'heure est remise.
  a.setNow(OCT25);
  a.api.state.settings.sound = false;
  a.commit({ silent: true });
  a.setNow(BACK);
  assert.equal(a.today(), '2026-10-21');
  assert.equal(a.ambientAt().minutes, 605);
  assert.equal((await session(a)).day, '2026-10-21');
  assert.equal(a.streak(), 11);
});

test("horloge : une séance pendant l'avance garde son jour", async () => {
  const a = open();
  a.setNow(OCT25);
  assert.equal((await session(a)).day, '2026-10-25');
  a.setNow(BACK);
  assert.equal(a.today(), '2026-10-25');
  assert.equal((await session(a)).day, '2026-10-25');
});

test("horloge : le ciel suit l'heure réelle", () => {
  const a = open(town(), { now: '2026-10-21T12:00:00+02:00' });
  a.api.state.clock.maxSeen = Date.parse('2026-10-25T22:00:00+01:00');
  // Le jour garde l'anti-recul (météo, visiteur, fêtes) ; la lumière, le moment et la tour de l'horloge suivent l'heure réelle.
  assert.equal(a.ambientAt().day, '2026-10-25');
  assert.equal(a.ambientAt().minutes, 720);
});

test('horloge : aucun cadeau deux fois', () => {
  const disk = town(), a = open(disk, VISITS), coins = a.api.state.coins;
  // Cadeau du visiteur reçu le 25 pendant l'avance. L'heure remise au 21, celui du 21 n'est plus offert : jamais un jour
  // antérieur au dernier cadeau reçu, et la fiche du visiteur ne propose pas de bouton.
  a.setNow(OCT25);
  assert.equal(a.claimVisitGift('2026-10-25'), true);
  a.commit({ silent: true });
  a.setNow(BACK);
  assert.equal(a.today(), '2026-10-21');
  assert.equal(a.claimVisitGift('2026-10-21'), false);
  assert.equal(a.context.visitGiftOpen('2026-10-21'), false);
  // Le vrai 25 arrive : le cadeau de ce jour est déjà reçu ; celui du lendemain est de nouveau offert.
  const b = open(disk, { now: '2026-10-25T12:00:00+01:00', ...VISITS });
  assert.equal(b.claimVisitGift('2026-10-25'), false);
  b.setNow('2026-10-26T12:00:00+01:00');
  assert.equal(b.claimVisitGift('2026-10-26'), true);
  assert.equal(b.api.state.coins, coins + 2 * 2e6);
});

test('horloge : aucun cadeau de souhait à rebours', () => {
  // Même règle que pour le visiteur : un souhait d'un jour antérieur au dernier souhait récompensé est exaucé, sans cadeau. Un
  // tirage ne donne jamais un tel souhait (il suit toujours le précédent) : la règle est une garde.
  const grant = rewarded => {
    const a = open(town(), { files: ['28-harmony.js'], expose: ['claimTownWish'] }), s = a.api.state;
    s.city.tiles = [{ id: 'maison', item: 'maison', x: 3, y: 3, at: Date.parse(OCT21), paid: 0 }];
    s.townWish = { day: '2026-10-21', tile: 'maison', item: 'fleurs' };
    s.gifts['wish:' + rewarded] = Date.parse(OCT21);
    const coins = s.coins;
    s.city.tiles.push({ id: 'fleurs', item: 'fleurs', x: 4, y: 3, at: Date.parse(OCT21), paid: 1e6 });
    assert.ok(a.claimTownWish());
    return { paid: s.coins - coins, rewarded: !!s.gifts['wish:2026-10-21'] };
  };
  assert.deepEqual(grant('2026-10-25'), { paid: 0, rewarded: false });
  assert.deepEqual(grant('2026-10-20'), { paid: 3e6, rewarded: true });
});

test("horloge : une ville figée par l'étape 6 se répare", () => {
  // Un enregistrement fait pendant l'avance avait poussé l'horloge au 25, sans séance ce jour-là.
  assert.equal(open(town({ maxSeen: Date.parse(OCT25), lastDay: '2026-10-20' })).today(), '2026-10-21');
  // Une séance réussie ce jour-là n'est pas une ville figée : elle garde son jour (risque accepté d'A4), et la ville aussi.
  assert.equal(open(town({ maxSeen: Date.parse(OCT25), lastDay: '2026-10-25' })).today(), '2026-10-25');
});

test("horloge : une séance future n'est pas mise en banque", async () => {
  // Pendant l'avance, une séance réussie le 24, puis une séance abandonnée le 25. L'heure est remise au 21 ; l'app est rouverte,
  // un réglage enregistré, puis rouverte encore.
  const disk = town(), a = open(disk);
  a.setNow('2026-10-24T10:00:00+02:00');
  assert.equal((await session(a)).day, '2026-10-24');
  a.setNow('2026-10-25T10:02:00+01:00');
  await a.startSession({ name: 'Lecture', cat: 'esprit', min: 10, mode: 'free' });
  await a.failSession('abandon', 0);
  assert.deepEqual([a.api.state.history[0].ok, a.api.state.history[0].day], [false, '2026-10-25']);
  const b = open(disk, { now: '2026-10-21T10:03:00+02:00' });
  b.api.state.settings.sound = false;
  b.commit({ silent: true });
  // La ville reste au jour de la dernière fin de séance, l'abandon du 25 : rien ne se date avant la séance réussie du 24, et
  // les jours du 21 au 23 ne peuvent plus se remplir derrière elle.
  const c = open(disk, { now: '2026-10-21T10:04:00+02:00' });
  assert.equal(c.today(), '2026-10-25');
  assert.equal((await session(c)).day, '2026-10-25');
  assert.equal(c.api.state.stats.days['2026-10-24'], 10);
  assert.deepEqual(['2026-10-21', '2026-10-22', '2026-10-23'].filter(day => c.api.state.stats.days[day]), []);
});

test('horloge : une heure reculée pendant une séance ne fait rien dater avant elle', async () => {
  // Une Concentration commence le 22 à 0 h 01 ; pendant la séance, l'heure du téléphone recule au 21 à 23 h 50, et y reste.
  // Le chrono de la séance, lui, ne recule pas.
  const disk = town(), a = open(disk, { now: '2026-10-22T00:01:00+02:00' });
  let chrono = 0;
  a.context.performance.now = () => chrono;
  await a.startSession({ name: 'Lecture', cat: 'esprit', min: 5, mode: 'focus' });
  a.setNow('2026-10-21T23:50:00+02:00');
  for (let second = 0; second < 5 * 60; second++) { chrono += 1000; a.advance(1000); a.tick(); }
  await settle(); await settle();
  assert.deepEqual([a.api.state.history[0].ok, a.api.state.history[0].day], [true, '2026-10-22']);
  // L'app rouverte, l'heure toujours en retard : la séance suivante ne se date pas du 21, la veille de la dernière séance.
  const b = open(disk, { now: '2026-10-21T23:57:00+02:00' });
  assert.equal(b.api.state.clock.lastDay, '2026-10-22');
  assert.equal((await session(b)).day, '2026-10-22');
});

test("horloge : restauration d'une sauvegarde datée du futur", () => {
  const BACKUP = { files: ['45-settings.js'], expose: ['exportBackup', 'readBackup', 'restoreBackup'] };
  const base64 = { atob, btoa, TextEncoder, TextDecoder };
  // La sauvegarde vient d'un téléphone en avance : d'un mois, puis de deux heures.
  const backup = later => {
    const other = open(town(), BACKUP);
    Object.assign(other.context, base64);
    other.api.state.clock.maxSeen = Date.parse(OCT21) + later;
    other.api.state.clock.lastDay = new Date(Date.parse(OCT21) + later).toISOString().slice(0, 10);
    return other.exportBackup();
  };
  const restore = text => {
    const a = open(town(), BACKUP);
    Object.assign(a.context, base64, { refreshLang() {} });
    a.setNow('2026-10-21T10:30:00+02:00');
    const { state } = a.readBackup(text);
    a.restoreBackup(state);
    return a;
  };
  const a = restore(backup(30 * 864e5));
  assert.equal(a.api.state.clock.maxSeen, Date.parse('2026-10-21T10:30:00+02:00'));
  assert.equal(a.api.state.clock.lastDay, a.today());
  assert.equal(a.today(), '2026-10-21');
  // Moins d'un jour d'avance (un autre téléphone un peu en avance) : son heure reste.
  assert.equal(restore(backup(2 * 3600000)).api.state.clock.maxSeen, Date.parse(OCT21) + 2 * 3600000);
});
