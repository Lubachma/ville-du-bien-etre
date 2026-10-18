/* =========================================================================
   Ville vivante : l'heure, la saison et le moment de la journée dans la ville.
   Règles pures, sans DOM. L'heure est celle du fuseau de la ville.
   ========================================================================= */
const clockFmtCache = new Map();
// Jour (AAAA-MM-JJ) et minutes depuis minuit, dans le fuseau de la ville.
function cityClock(ts = nowTs()) {
  const tz = S.clock.tz;
  if (!clockFmtCache.has(tz)) {
    let f;
    try { f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
    catch (e) { f = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
    clockFmtCache.set(tz, f);
  }
  const parts = clockFmtCache.get(tz).formatToParts(ts), part = type => Number(parts.find(p => p.type === type).value);
  return { day: dayOf(ts), minutes: part('hour') * 60 + part('minute') };
}
// Hémisphère sud : choisi dans les réglages, sinon deviné d'après le fuseau de la ville.
function southern() {
  const choice = S.settings.hemisphere;
  if (choice === 'south' || choice === 'north') return choice === 'south';
  const tz = S.clock.tz || '';
  return SOUTH_TZ.some(zone => (zone.endsWith('/') ? tz.startsWith(zone) : tz === zone));
}
// Saisons météorologiques (printemps de mars à mai…), décalées de six mois au sud.
function seasonOf(day) {
  const month = (Number(day.slice(5, 7)) + (southern() ? 6 : 0) - 1) % 12 + 1;
  return month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
}
function dayOfYear(day) { return Math.round((keyToUTC(day) - keyToUTC(day.slice(0, 4) + '-01-01')) / 86400000) + 1; }
// Lever et coucher (minutes) d'une latitude moyenne : le soleil est au plus haut à 13 h.
function sunTimes(day) {
  const hours = 12 + 3.6 * Math.cos(2 * Math.PI * (dayOfYear(day) - 172 - (southern() ? 182.5 : 0)) / 365);
  return { rise: 780 - hours * 30, set: 780 + hours * 30 };
}
// Moment de la journée, et son avancée t (0 à 1) ; la nuit, t vaut 0.
function momentOf(day, minutes) {
  const { rise, set } = sunTimes(day);
  const windows = [['dawn', rise - 30, rise + 45], ['day', rise + 45, set - 60], ['golden', set - 60, set], ['dusk', set, set + 45]];
  for (const [name, from, to] of windows) if (minutes >= from && minutes < to) return { name, t: (minutes - from) / (to - from) };
  return { name: 'night', t: 0 };
}

// Tirage reproductible dans [0, 1[ : le même jour donne la même ville partout, propre à chaque ville (sa date de création).
function chance(key) { return parseInt(hash53(key + '|' + S.createdAt), 36) / 2 ** 53; }
// Météo tirée pour la journée, brouillard compris.
function dayWeather(day) {
  const odds = WEATHER_ODDS[seasonOf(day)], roll = chance(day + ':weather') * 100;
  let sum = 0;
  for (let i = 0; i < WEATHERS.length; i++) { sum += odds[i]; if (roll < sum) return WEATHERS[i]; }
  return WEATHERS[0];
}
// Météo à une heure donnée : le brouillard se lève à 11 h et laisse des nuages.
function weatherOf(day, minutes) {
  const weather = dayWeather(day);
  return weather === 'fog' && minutes >= 660 ? 'clouds' : weather;
}
// Arc-en-ciel : le matin ensoleillé qui suit un jour de pluie, une fois sur trois, jusqu'à midi.
function rainbowOn(day, minutes) {
  return minutes < 720 && dayWeather(day) === 'sun' && dayWeather(shiftDay(day, -1)) === 'rain' && chance(day + ':rainbow') < 1 / 3;
}
