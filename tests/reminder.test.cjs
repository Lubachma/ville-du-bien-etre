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
  vm.runInContext(source + '\nsetLang("fr");\nthis.api = { DICT, setLang, buildReminderIcs, googleCalendarUrl };', context);
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
