/* =========================================================================
   Succès : conditions, progression, dates et attribution. Rien ne s'affiche ici.
   Un succès obtenu l'est pour toujours ; seules les sessions réussies comptent.
   ========================================================================= */
function achievementDef(id) { return ACHIEVEMENTS.find(def => def.id === id); }
function achName(id) { return t('ach.' + id + '.name'); }

// Heure de fin d'une session, lue dans le fuseau de la ville.
const hourFmtCache = new Map();
function hourIn(ts) {
  const tz = S.clock.tz;
  if (!hourFmtCache.has(tz)) hourFmtCache.set(tz, new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }));
  return Number(hourFmtCache.get(tz).formatToParts(ts).find(part => part.type === 'hour').value);
}
const sortedDays = obj => Object.keys(obj || {}).filter(isDayKey).sort();
const activeDays = () => sortedDays(S.stats.days).filter(d => S.stats.days[d] > 0);
const catsOn = d => Object.keys(S.stats.dailyCats[d] || {}).filter(c => S.stats.dailyCats[d][c] > 0);
// Entrées réussies de l'historique qui remplissent la condition d'un succès « moment » ou du tirage.
function historyMatches(def) {
  return (S.history || []).filter(e => e.ok && (
    def.kind === 'endHour' ? (h => h >= def.from && h < def.to)(hourIn(e.at))
      : def.kind === 'sessionMin' ? e.min >= def.min && e.min <= def.max
        : e.source === 'wishes' || e.source === 'chores'));
}
const natureCount = () => S.city.tiles.filter(tile => NATURE_ITEMS.includes(tile.item)).length;
// Construction de la n-ième case encore posée : à cette date, la ville en comptait déjà n ; 0 sinon.
const nthBuilt = (tiles, n) => tiles.map(tile => tile.at).filter(validTs).sort((a, b) => a - b)[n - 1] || 0;
const wondersDone = () => S.city.tiles.filter(tile => isWonder(tile.item) && tile.stage >= ITEMS[tile.item].wonder.length).length;
// Ville vivante : visiteurs rencontrés, fêtes vécues (leurs cadeaux) et saisons vues.
const visitorsMet = () => Object.keys(S.visits || {}).length;
const festivalsLived = () => Object.keys(S.gifts || {}).filter(key => key.startsWith('fest:')).length;
const seasonsSeen = () => Object.keys(S.seasons || {}).length;
// Premier jour (dans l'ordre) où la série atteint n ; null sinon.
function streakDay(n) { return activeDays().find(d => streakDetail(d).days >= n) || null; }
// Premier jour où, semaine par semaine, n domaines ont été pratiqués ; null sinon.
function weekCatsDay(n) {
  const weeks = new Map();
  for (const d of sortedDays(S.stats.dailyCats)) {
    const seen = weeks.get(weekStartOf(d)) || new Set();
    catsOn(d).forEach(c => seen.add(c));
    weeks.set(weekStartOf(d), seen);
    if (seen.size >= n) return d;
  }
  return null;
}

function achievementMet(def) {
  switch (def.kind) {
    case 'sessions': return S.stats.ok >= def.n;
    case 'bought': return S.city.tiles.some(tile => tile.paid > 0);
    case 'draw': case 'endHour': case 'sessionMin': return historyMatches(def).length > 0;
    case 'routine': return !!(S.routineRun && S.routineRun.status === 'done');
    case 'catMinutes': return (S.stats.byCat[def.cat] || 0) >= def.n;
    case 'weekCats': return !!weekCatsDay(def.n);
    case 'dayMinutes': return Object.values(S.stats.days).some(min => min >= def.n);
    case 'dayCats': return sortedDays(S.stats.dailyCats).some(d => catsOn(d).length >= def.n);
    case 'activeDays': return activeDays().length >= def.n;
    case 'streak': return !!streakDay(def.n);
    case 'totalMinutes': return totalMinutes() >= def.n;
    case 'tiles': return S.city.tiles.length >= def.n;
    case 'citySize': return S.city.size >= def.n;
    case 'nature': return natureCount() >= def.n;
    case 'level': return S.city.tiles.some(tile => buildingLevelInfo(tile.item).level >= def.n);
    case 'sets': return Object.keys(S.sets || {}).length >= def.n;
    case 'wonders': return wondersDone() >= def.n;
    case 'visitors': return visitorsMet() >= def.n;
    case 'festivals': return festivalsLived() >= def.n;
    case 'seasons': return seasonsSeen() >= def.n;
    default: return false;
  }
}

// Progression montrée dans le carnet, quand elle se compte.
function achievementProgress(def) {
  const have = {
    catMinutes: () => S.stats.byCat[def.cat] || 0, totalMinutes: () => totalMinutes(),
    activeDays: () => activeDays().length, tiles: () => S.city.tiles.length, nature: natureCount,
    sets: () => Object.keys(S.sets || {}).length, wonders: wondersDone,
    visitors: visitorsMet, festivals: festivalsLived, seasons: seasonsSeen,
  }[def.kind];
  if (!have) return null;
  return { have: Math.min(have(), def.n), need: def.n, unit: def.kind === 'catMinutes' || def.kind === 'totalMinutes' ? 'min' : 'n' };
}

// Date à laquelle le succès a vraiment été mérité, quand les données la donnent ; 0 sinon.
function achievementDate(def) {
  const day = d => (d ? keyToUTC(d) : 0);
  const crossing = (list, value) => { let sum = 0; return list.find(d => (sum += value(d)) >= def.n); };
  switch (def.kind) {
    case 'sessions': return def.n === 1 ? day(activeDays()[0]) : 0;
    case 'catMinutes': return day(crossing(sortedDays(S.stats.dailyCats), d => S.stats.dailyCats[d][def.cat] || 0));
    case 'totalMinutes': return day(crossing(sortedDays(S.stats.days), d => S.stats.days[d] || 0));
    case 'activeDays': return day(activeDays()[def.n - 1]);
    case 'dayMinutes': return day(sortedDays(S.stats.days).find(d => S.stats.days[d] >= def.n));
    case 'dayCats': return day(sortedDays(S.stats.dailyCats).find(d => catsOn(d).length >= def.n));
    case 'weekCats': return day(weekCatsDay(def.n));
    case 'streak': return day(streakDay(def.n));
    case 'draw': case 'endHour': case 'sessionMin': {
      const at = historyMatches(def).map(e => e.at).filter(validTs);
      return at.length ? Math.min(...at) : 0;
    }
    case 'routine': return S.routineRun && validTs(S.routineRun.finishedAt) ? S.routineRun.finishedAt : 0;
    case 'bought': {
      const at = S.city.tiles.filter(tile => tile.paid > 0 && validTs(tile.at)).map(tile => tile.at);
      return at.length ? Math.min(...at) : 0;
    }
    case 'tiles': return nthBuilt(S.city.tiles, def.n);
    case 'nature': return nthBuilt(S.city.tiles.filter(tile => NATURE_ITEMS.includes(tile.item)), def.n);
    default: return 0;
  }
}

// Inscrit les succès nouvellement mérités, dans l'ordre de la table, et les renvoie.
// En rattrapage (ville d'avant la mise à jour, sauvegarde restaurée), la date est la vraie quand elle se déduit.
function checkAchievements(now = Date.now(), { retro = false } = {}) {
  if (!S.achievements) S.achievements = {};
  const fresh = [];
  for (const def of ACHIEVEMENTS) {
    if (S.achievements[def.id] || !achievementMet(def)) continue;
    S.achievements[def.id] = retro ? Math.min(achievementDate(def) || now, now) : now;
    fresh.push(def.id);
  }
  return fresh;
}
