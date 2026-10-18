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
// Prochain passage de l'heure « time » à partir de « now », en heure locale.
function nextReminder(time, now) {
  const [hh, mm] = time.split(':').map(Number);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
  if (start <= now) start.setDate(start.getDate() + 1);
  return start;
}
// Heure « flottante » : l'agenda garde la même heure locale, quel que soit le fuseau.
function icsLocal(d) { return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + pad2(d.getMinutes()) + '00'; }
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
function buildReminderIcs(time, now) {
  const start = nextReminder(time, now), summary = icsText(t('reminder.summary'));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ville-du-bien-etre//rappel//' + LANG.toUpperCase(), 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', 'UID:rappel-' + now.getTime() + '@ville-du-bien-etre', 'DTSTAMP:' + icsUtc(now), 'DTSTART:' + icsLocal(start),
    'DURATION:PT' + REMINDER_MINUTES + 'M', 'RRULE:FREQ=DAILY', 'SUMMARY:' + summary, 'DESCRIPTION:' + icsText(t('reminder.description')),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + summary, 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].map(icsFold).join('\r\n') + '\r\n';
}
function googleCalendarUrl(time, now) {
  const start = nextReminder(time, now), end = new Date(start.getTime() + REMINDER_MINUTES * 60000);
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + '&text=' + encodeURIComponent(t('reminder.summary'))
    + '&details=' + encodeURIComponent(t('reminder.description'))
    + '&dates=' + encodeURIComponent(icsLocal(start) + '/' + icsLocal(end))
    + '&recur=' + encodeURIComponent('RRULE:FREQ=DAILY');
}
