/* =========================================================================
   Rappel quotidien. Sans serveur, l'app ne peut pas envoyer de notification :
   le rappel vit dans l'agenda (fichier .ics ou modèle Google Agenda).
   ========================================================================= */
const REMINDER_MINUTES = 10;
function isClockTime(value) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')); }
function reminderTime() {
  try { const value = localStorage.getItem(LS_REMINDER); return isClockTime(value) ? value : '18:00'; } catch (e) { return '18:00'; }
}
function setReminderTime(value) {
  if (!isClockTime(value)) return;
  try { localStorage.setItem(LS_REMINDER, value); } catch (e) { /* pas de stockage */ }
}
// Prochain passage de l'heure « time » (HH:MM) à partir de « now » : aujourd'hui, en heure locale, si elle est encore à venir, sinon demain.
// Le résultat est un jour et une heure écrits (« AAAAMMJJ », « HHMM »), jamais un instant Date : le jour du passage à l'heure d'été,
// 02:30 n'existe pas à Zurich, et un Date l'aurait décalé à 03:30 pour toujours.
function nextReminder(time, now) {
  const hhmm = time.replace(':', ''), today = now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate());
  return { day: hhmm > pad2(now.getHours()) + pad2(now.getMinutes()) ? today : icsAddDays(today, 1), hhmm };
}
// L'heure plus « n » minutes, sur l'horloge écrite : après 23:59, c'est le jour suivant.
function addMinutes({ day, hhmm }, n) {
  const [h, m] = hhmm.match(/../g).map(Number), total = h * 60 + m + n, days = Math.floor(total / 1440), minutes = total - days * 1440;
  return { day: days ? icsAddDays(day, days) : day, hhmm: pad2(Math.floor(minutes / 60)) + pad2(minutes % 60) };
}
// Jour « AAAAMMJJ » décalé de « n » jours. Le calcul porte sur la date seule, en UTC : un jour local ne dure pas toujours 24 heures.
function icsAddDays(day, n) {
  const [y, m, d] = day.match(/^(\d{4})(\d\d)(\d\d)$/).slice(1).map(Number), date = new Date(Date.UTC(y, m - 1, d + n));
  return date.getUTCFullYear() + pad2(date.getUTCMonth() + 1) + pad2(date.getUTCDate());
}
// Heure « flottante » : l'agenda garde la même heure locale, quel que soit le fuseau.
function icsLocal({ day, hhmm }) { return day + 'T' + hhmm + '00'; }
function icsUtc(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
// RFC 5545 : textes échappés, lignes repliées à 75 octets (retour à la ligne puis une espace).
function icsText(text) { return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function icsFold(line) {
  let out = '', size = 0;
  for (const ch of line) {
    const code = ch.codePointAt(0), bytes = code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
    if (size + bytes > 75) { out += '\r\n '; size = 1; }
    out += ch; size += bytes;
  }
  return out;
}
// Un identifiant par appareil et une version qui monte : ajouté de nouveau, le rappel remplace l'ancien
// dans les agendas qui le reconnaissent.
function buildReminderIcs(time, now, device = 'appareil') {
  const start = nextReminder(time, now), summary = icsText(t('reminder.summary'));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ville-du-bien-etre//rappel//' + LANG.toUpperCase(), 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', 'UID:rappel-' + device + '@ville-du-bien-etre', 'SEQUENCE:' + Math.floor(now.getTime() / 60000), 'DTSTAMP:' + icsUtc(now), 'DTSTART:' + icsLocal(start),
    'DURATION:PT' + REMINDER_MINUTES + 'M', 'RRULE:FREQ=DAILY', 'SUMMARY:' + summary, 'DESCRIPTION:' + icsText(t('reminder.description')),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + summary, 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].map(icsFold).join('\r\n') + '\r\n';
}
function googleCalendarUrl(time, now) {
  const start = nextReminder(time, now), end = addMinutes(start, REMINDER_MINUTES);
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + '&text=' + encodeURIComponent(t('reminder.summary'))
    + '&details=' + encodeURIComponent(t('reminder.description'))
    + '&dates=' + encodeURIComponent(icsLocal(start) + '/' + icsLocal(end))
    + '&recur=' + encodeURIComponent('RRULE:FREQ=DAILY');
}
