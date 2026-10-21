/* =========================================================================
   Ville vivante : l'heure, la saison et le moment de la journée dans la ville.
   Règles pures, sans DOM. L'heure est celle du fuseau de la ville.
   ========================================================================= */
const clockFmtCache = new Map();
// Jour (AAAA-MM-JJ) et minutes depuis minuit, dans le fuseau de la ville. Sans instant donné, c'est maintenant : le jour de la
// ville (today(), qui ne recule pas avant la dernière fin de séance) et l'heure du téléphone, que suivent la lumière, le moment
// de la journée et la tour de l'horloge.
function cityClock(ts) {
  const tz = S.clock.tz, live = ts === undefined;
  if (!clockFmtCache.has(tz)) {
    let f;
    try { f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
    catch (e) { f = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
    clockFmtCache.set(tz, f);
  }
  const parts = clockFmtCache.get(tz).formatToParts(live ? Date.now() : ts), part = type => Number(parts.find(p => p.type === type).value);
  return { day: live ? today() : dayOf(ts), minutes: part('hour') * 60 + part('minute') };
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

// Fêtes du jour, chacune avec sa clé de cadeau (une par an) ; le 31 décembre du Nouvel An porte l'année qui commence.
// L'anniversaire tombe à la date de création de la ville, dès l'année suivante ; un 29 février se fête le 28 hors années bissextiles.
function festivalsOn(day) {
  const year = Number(day.slice(0, 4)), md = day.slice(5), side = southern() ? 'south' : 'north', out = [];
  for (const fest of FESTIVALS) {
    if (fest.id === 'anniversaire') {
      const born = dayOf(S.createdAt), bornYear = Number(born.slice(0, 4)), bornMd = born.slice(5);
      const date = bornMd === '02-29' && !leapYear(year) ? '02-28' : bornMd;
      if (year > bornYear && md === date) out.push({ id: fest.id, key: 'fest:anniversaire:' + year, age: year - bornYear });
    } else if (fest[side].includes(md)) {
      out.push({ id: fest.id, key: 'fest:' + fest.id + ':' + (fest.id === 'nouvel-an' && md === '12-31' ? year + 1 : year) });
    }
  }
  return out;
}
// Fête d'en face : celle qui tombe aux mêmes dates dans l'autre hémisphère (printemps et récoltes, été et lumières).
function mirrorOf(id) {
  const fest = FESTIVALS.find(f => f.id === id), other = fest && fest.north && FESTIVALS.find(f => f !== fest && f.south && f.south.join() === fest.north.join());
  return other ? other.id : null;
}
// Montant d'un cadeau d'après sa clé.
function giftAmount(key) {
  const k = String(key);
  return k.startsWith('visit:') ? GIFTS.visit : k.startsWith('fest:anniversaire:') ? GIFTS.birthday : k.startsWith('fest:') ? GIFTS.fest
    : k.startsWith('chal:') ? GIFTS.challenge : k.startsWith('wish:') ? GIFTS.townWish : k.startsWith('star:') ? GIFTS.star : 0;
}
// Premier jour de la fête, ce jour-là ou après.
function nextFestival(id, day) {
  for (let i = 0; i < 400; i++) { const d = shiftDay(day, i); if (festivalsOn(d).some(f => f.id === id)) return d; }
  return '';
}

// Visiteurs : où ils se placent dans la ville. Une place libre est une case sans élément, parcourue ligne par ligne.
const VISITOR_TREES = ['arbre', 'cerisier', 'grandarbre'], VISITOR_NATURE = ['arbre', 'cerisier', 'haie', 'fleurs'];
const nearAny = (cell, tiles) => tiles.some(t => Math.abs(t.x - cell.x) <= 1 && Math.abs(t.y - cell.y) <= 1);
function freeCells(city = S.city) {
  const N = city.size, taken = new Set(city.tiles.map(t => t.x + ',' + t.y)), out = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!taken.has(x + ',' + y)) out.push({ x, y });
  return out;
}
// Place du visiteur ce jour-là : { x, y, on } sur un élément, { x, y } sur une case libre, { sky: true }, ou null s'il n'a pas de place.
function visitorSpot(visitor, day) {
  const N = S.city.size, free = freeCells(), tiles = [...S.city.tiles].sort((a, b) => a.y - b.y || a.x - b.x);
  const on = keep => tiles.filter(t => keep(t.item)).map(t => ({ x: t.x, y: t.y, on: t.item }));
  const pick = list => (list.length ? list[Math.floor(chance(day + ':' + visitor.id + ':spot') * list.length)] : null);
  const near = items => free.filter(c => nearAny(c, tiles.filter(t => items.includes(t.item))));
  switch (visitor.spot) {
    case 'sky': return { sky: true };
    case 'bench': return pick(on(item => item === 'banc')) || pick(free);
    case 'nature': return pick(near(VISITOR_NATURE));
    case 'tree': return pick(on(item => VISITOR_TREES.includes(item)));
    case 'roof': return pick(on(isBuilding));
    case 'pond': return pick(on(item => item === 'etang'));
    case 'edge': return pick(free.filter(c => c.x === 0 || c.y === 0 || c.x === N - 1 || c.y === N - 1));
    case 'path': return pick(on(item => item === 'chemin' || item === 'pasjaponais')) || pick(free);
    case 'kiosk': return pick(near(['kiosque'])) || pick(free);
    default: return pick(free);
  }
}
// Visiteurs possibles un jour donné : saison, météo, neige récente et place respectées. Ils ne changent qu'avec la ville,
// l'hémisphère ou la graine : on les garde, jour par jour, tant que ces données restent les mêmes.
let visitorMemo = { sig: '', days: new Map(), picks: new Map() };
function visitorMemoFor() {
  const sig = [S.createdAt, S.clock.tz, S.settings.hemisphere, S.city.size, S.city.tiles.map(t => t.item + ':' + t.x + ',' + t.y).join(';')].join('|');
  if (visitorMemo.sig !== sig) visitorMemo = { sig, days: new Map(), picks: new Map() };
  return visitorMemo;
}
function visitorCandidates(day, memo = visitorMemoFor()) {
  if (memo.days.has(day)) return memo.days.get(day);
  const season = seasonOf(day), weather = dayWeather(day), snowy = weather === 'snow' || dayWeather(shiftDay(day, -1)) === 'snow', out = [];
  for (const v of VISITORS) {
    if ((v.seasons && !v.seasons.includes(season)) || (v.weather && !v.weather.includes(weather)) || (v.snow && !snowy)) continue;
    const spot = visitorSpot(v, day);
    if (spot) out.push({ id: v.id, spot });
  }
  memo.days.set(day, out);
  return out;
}
// Tirage d'un jour (environ 5 jours sur 7), sans le visiteur à éviter ni celui rencontré la veille quand un autre peut venir ;
// trois fois plus de chances pour ceux qu'on n'avait pas encore rencontrés avant ce jour.
function pickVisitor(day, avoid, memo) {
  if (chance(day + ':visit') >= VISIT_ODDS) return null;
  const base = visitorCandidates(day, memo), visits = S.visits || {}, yesterday = shiftDay(day, -1);
  const others = base.filter(c => c.id !== avoid && !(visits[c.id] && visits[c.id].last === yesterday)), list = others.length ? others : base;
  if (!list.length) return null;
  const weight = c => (visits[c.id] && dayOf(visits[c.id].first) < day ? 1 : 3);
  let roll = chance(day + ':who') * list.reduce((sum, c) => sum + weight(c), 0);
  for (const c of list) { roll -= weight(c); if (roll < 0) return c; }
  return list[list.length - 1];
}
// Visiteur du jour : jamais celui de la veille quand un autre peut venir, même si on ne l'a pas rencontré. La veille se retrouve
// en refaisant les tirages des 30 jours précédents, chacun sans le visiteur du jour d'avant : deux calculs faits à un jour
// d'écart s'accordent alors sur la veille. Le résultat est gardé tant que la ville et les rencontres ne changent pas.
const VISITOR_CHAIN = 30;
function visitorOf(day) {
  const memo = visitorMemoFor(), key = day + '|' + JSON.stringify(S.visits || {});
  if (memo.picks.has(key)) return memo.picks.get(key);
  let prev = null;
  for (let i = VISITOR_CHAIN; i >= 1; i--) prev = pickVisitor(shiftDay(day, -i), prev && prev.id, memo);
  const v = pickVisitor(day, prev && prev.id, memo);
  memo.picks.set(key, v);
  return v;
}

// L'ambiance de la ville à un instant (maintenant par défaut, voir cityClock) : jour, minutes, saison, moment, météo,
// arc-en-ciel, fêtes et visiteur. ambientForce impose certains champs, pour les tests et la planche.
let ambientForce = null;
function ambientAt(ts) {
  const { day, minutes } = cityClock(ts);
  const amb = { day, minutes, season: seasonOf(day), moment: momentOf(day, minutes), weather: weatherOf(day, minutes),
    rainbow: rainbowOn(day, minutes), festivals: festivalsOn(day), visitor: visitorOf(day) };
  return ambientForce ? Object.assign(amb, ambientForce) : amb;
}
// Obscurité de la ville (0 en journée, 1 la nuit), progressive à l'aube, en fin d'après-midi et au crépuscule.
function darkness(moment) {
  const t = moment.t || 0;
  switch (moment.name) {
    case 'night': return 1;
    case 'dawn': return 1 - t;
    case 'golden': return .15 * t;
    case 'dusk': return .15 + .85 * t;
    default: return 0;
  }
}

// Habitants : cases où l'on marche (libres, chemins, pas japonais), ligne par ligne.
function walkableTiles() {
  const paths = S.city.tiles.filter(t => t.item === 'chemin' || t.item === 'pasjaponais').map(t => ({ x: t.x, y: t.y }));
  return [...freeCells(), ...paths].sort((a, b) => a.y - b.y || a.x - b.x);
}
// Un promeneur pour trois éléments, six au plus ; la nuit, la moitié rentre ; aucun sans case où marcher.
function walkerCount(moment) {
  if (!walkableTiles().length) return 0;
  const n = Math.min(6, Math.floor(S.city.tiles.length / 3));
  return moment.name === 'night' ? Math.floor(n / 2) : n;
}
// Domaines pratiqués aujourd'hui : un habitant de la ville fait la même activité.
function todayDomains() {
  const cats = S.stats.dailyCats[today()] || {};
  return CAT_ORDER.filter(cat => cats[cat] > 0);
}
