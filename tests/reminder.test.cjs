// Fuseau de ces tests : le passage à l'heure d'été en fait partie. À régler avant que quoi que ce soit ne crée une Date.
process.env.TZ = 'Europe/Zurich';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function app() {
  const context = vm.createContext({ console, Date, Intl, Math, JSON, encodeURIComponent,
    window: {}, document: { documentElement: {} }, navigator: { languages: ['fr-CH'] } });
  const source = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '49-reminder.js']
    .map(file => fs.readFileSync(path.join(__dirname, '../src', file), 'utf8')).join('\n');
  vm.runInContext(source + '\nsetLang("fr");\nthis.api = { DICT, setLang, buildReminderIcs, googleCalendarUrl, nextReminder, addMinutes };', context);
  return context.api;
}

test('fichier d’agenda : rappel quotidien de 10 minutes, sans lien', () => {
  const { buildReminderIcs } = app();
  const ics = buildReminderIcs('18:00', new Date(2026, 9, 17, 9, 30));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  for (const line of ['RRULE:FREQ=DAILY', 'DURATION:PT10M', 'BEGIN:VALARM', 'TRIGGER:PT0M', 'DTSTART:20261017T180000']) assert.ok(ics.includes(line + '\r\n'), line);
  assert.match(ics, /\r\nDTSTAMP:\d{8}T\d{6}Z\r\n/);
  assert.ok(!/https?:/.test(ics));
  assert.ok(ics.includes('SUMMARY:Ville du bien-être : un moment pour toi'));
  assert.ok(buildReminderIcs('18:00', new Date(2026, 9, 17, 19, 0)).includes('DTSTART:20261018T180000'));
});

test('fichier d’agenda : lignes de 75 octets au plus, textes échappés', () => {
  const a = app();
  a.DICT.fr['reminder.summary'] = 'a,b;c';
  const ics = a.buildReminderIcs('07:30', new Date(2026, 9, 17, 9, 30));
  assert.ok(ics.includes('SUMMARY:a\\,b\\;c\r\n'));
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, line);
  // Une ligne repliée se recolle sans perte (RFC 5545 : retour à la ligne puis une espace).
  assert.ok(ics.replace(/\r\n /g, '').includes("DESCRIPTION:Ouvre la Ville du bien-être depuis l'icône de ton écran d'accueil."));
});

test('lien Google Agenda', () => {
  const { googleCalendarUrl } = app();
  const url = googleCalendarUrl('18:00', new Date(2026, 9, 17, 9, 30));
  assert.ok(url.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'));
  assert.ok(url.includes('dates=20261017T180000%2F20261017T181000'));
  assert.ok(url.includes('recur=RRULE%3AFREQ%3DDAILY'));
  assert.ok(url.includes('&text=') && url.includes('&details='));
});

test('ajouter le rappel une deuxième fois le remplace : même identifiant, version plus récente', () => {
  const { buildReminderIcs } = app();
  const first = buildReminderIcs('18:00', new Date(2026, 9, 17, 9, 30), 'tel-1');
  const second = buildReminderIcs('07:30', new Date(2026, 9, 18, 9, 30), 'tel-1');
  const uid = ics => (ics.match(/\r\nUID:([^\r]+)\r\n/) || [])[1], seq = ics => Number((ics.match(/\r\nSEQUENCE:(\d+)\r\n/) || [])[1]);
  assert.ok(uid(first) && uid(first) === uid(second), uid(first) + ' / ' + uid(second));
  assert.ok(seq(second) > seq(first), seq(first) + ' / ' + seq(second));
  assert.notEqual(uid(buildReminderIcs('18:00', new Date(2026, 9, 17, 9, 30), 'tel-2')), uid(first));
});

// Ce que l'agenda lira : la ligne DTSTART du fichier, et le paramètre « dates » du lien (encore encodé).
const dtstart = ics => (ics.match(/\r\nDTSTART:([^\r]+)\r\n/) || [])[1];
const dates = url => (url.match(/[?&]dates=([^&]+)/) || [])[1];

test('rappel : passage à l\'heure d\'été', () => {
  // Le 29 mars 2026 à Zurich, 02:00 saute à 03:00 : 02:30 n'existe pas ce jour-là. Si le test ne tourne pas dans ce fuseau, il ne prouve rien.
  assert.equal(new Date(2026, 2, 29, 2, 30).getHours(), 3, 'le fuseau du test doit être Europe/Zurich');
  const { buildReminderIcs, googleCalendarUrl } = app();
  const now = new Date(2026, 2, 28, 12, 0);
  assert.equal(dtstart(buildReminderIcs('02:30', now)), '20260329T023000');
  assert.equal(dates(googleCalendarUrl('02:30', now)), '20260329T023000%2F20260329T024000');
});

test('rappel : fin après minuit', () => {
  const { googleCalendarUrl } = app();
  assert.equal(dates(googleCalendarUrl('23:55', new Date(2026, 2, 28, 12, 0))), '20260328T235500%2F20260329T000500');
});

test('rappel : le prochain passage est aujourd\'hui s\'il reste à venir, demain sinon', () => {
  const { nextReminder } = app();
  const next = (time, now) => JSON.stringify(nextReminder(time, now));
  assert.equal(next('18:00', new Date(2026, 9, 17, 9, 30)), '{"day":"20261017","hhmm":"1800"}');
  assert.equal(next('18:00', new Date(2026, 9, 17, 17, 59, 59, 999)), '{"day":"20261017","hhmm":"1800"}');
  // À l'heure dite, même quelques secondes plus tard : demain.
  assert.equal(next('18:00', new Date(2026, 9, 17, 18, 0)), '{"day":"20261018","hhmm":"1800"}');
  assert.equal(next('18:00', new Date(2026, 9, 17, 18, 0, 59)), '{"day":"20261018","hhmm":"1800"}');
  assert.equal(next('00:00', new Date(2026, 9, 17, 0, 0)), '{"day":"20261018","hhmm":"0000"}');
  assert.equal(next('23:59', new Date(2026, 9, 17, 23, 58)), '{"day":"20261017","hhmm":"2359"}');
});

test('rappel : le lendemain se compte en jours, jamais en heures', () => {
  const { buildReminderIcs } = app();
  const first = (time, now) => dtstart(buildReminderIcs(time, now));
  // Fin de mois, fin d'année, 29 février.
  assert.equal(first('18:00', new Date(2026, 9, 31, 19, 0)), '20261101T180000');
  assert.equal(first('18:00', new Date(2026, 11, 31, 19, 0)), '20270101T180000');
  assert.equal(first('18:00', new Date(2028, 1, 28, 19, 0)), '20280229T180000');
  assert.equal(first('18:00', new Date(2026, 1, 28, 19, 0)), '20260301T180000');
  // À Zurich en 2026, le 29 mars dure 23 h et le 25 octobre 25 h : ajouter 24 h sauterait un jour, ou n'en changerait pas.
  assert.equal(first('18:00', new Date(2026, 2, 28, 23, 30)), '20260329T180000');
  assert.equal(first('00:15', new Date(2026, 9, 25, 0, 30)), '20261026T001500');
});

test('rappel : créé autour d\'un changement d\'heure', () => {
  const { buildReminderIcs } = app();
  // 29 mars 2026 : 02:00 saute à 03:00. Avant le saut, 02:30 est encore à venir ; après, c'est demain.
  assert.equal(dtstart(buildReminderIcs('02:30', new Date(2026, 2, 29, 1, 0))), '20260329T023000');
  assert.equal(dtstart(buildReminderIcs('02:30', new Date(2026, 2, 29, 12, 0))), '20260330T023000');
  // 25 octobre 2026 : 03:00 revient à 02:00, 02:30 passe deux fois. L'agenda garde la même heure.
  assert.equal(dtstart(buildReminderIcs('02:30', new Date(2026, 9, 24, 12, 0))), '20261025T023000');
  assert.equal(dtstart(buildReminderIcs('02:30', new Date(2026, 9, 25, 12, 0))), '20261026T023000');
});

test('rappel : la fin se compte sur l\'horloge écrite, minuit compris', () => {
  const { addMinutes } = app();
  const end = (day, hhmm, n) => { const r = addMinutes({ day, hhmm }, n); return r.day + 'T' + r.hhmm; };
  assert.equal(end('20261017', '1800', 10), '20261017T1810');
  assert.equal(end('20261017', '2358', 1), '20261017T2359');
  assert.equal(end('20261017', '2359', 1), '20261018T0000');
  assert.equal(end('20261017', '2350', 10), '20261018T0000');
  assert.equal(end('20261031', '2355', 10), '20261101T0005');
  assert.equal(end('20261231', '2355', 10), '20270101T0005');
  assert.equal(end('20280228', '2355', 10), '20280229T0005');
  assert.equal(end('20260228', '2355', 10), '20260301T0005');
  // Aucun fuseau dans le calcul : 02:05 n'existe pas le 29 mars à Zurich, la fin s'écrit quand même ainsi.
  assert.equal(end('20260329', '0155', 10), '20260329T0205');
});
