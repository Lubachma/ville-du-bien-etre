/* =========================================================================
   Bilans : résumé d'une période (semaine, mois, année), bilan de la semaine et récapitulatifs.
   Règles pures, sans DOM.
   ========================================================================= */
// Jours d'une période, bornes comprises.
function periodDays(from, to) {
  const days = [];
  for (let day = from; day <= to; day = shiftDay(day, 1)) days.push(day);
  return days;
}
const inPeriod = (day, from, to) => typeof day === 'string' && day >= from && day <= to;
const tsInPeriod = (ts, from, to) => validTs(ts) && inPeriod(dayOf(ts), from, to);

// Ce qu'une période a apporté : temps de pratique, jours actifs, séances, domaines, beaux moments, nouveautés de la ville,
// défis et succès, humeurs notées (sur l'écran seulement).
function periodSummary(from, to) {
  const stats = S.stats.effort || S.stats, daily = S.stats.dailyCats || {}, days = periodDays(from, to);
  const minutesOn = day => stats.days[day] || 0, catMinutes = cat => days.reduce((sum, day) => sum + (obj(daily[day])[cat] || 0), 0);
  const sessions = S.history.filter(e => e.ok && inPeriod(e.day, from, to)), cats = CAT_ORDER.filter(cat => catMinutes(cat) > 0);
  const longest = sessions.reduce((best, e) => (!best || e.min > best.min ? e : best), null);
  const bestDay = days.reduce((best, day) => (minutesOn(day) > (best ? best.minutes : 0) ? { day, minutes: minutesOn(day) } : best), null);
  const gifts = prefix => Object.entries(S.gifts || {}).filter(([key, at]) => key.startsWith(prefix) && tsInPeriod(at, from, to)).length;
  const moods = sessions.filter(e => e.mood);
  return {
    from, to,
    minutes: days.reduce((sum, day) => sum + minutesOn(day), 0),
    activeDays: days.filter(day => minutesOn(day) >= 1).length,
    sessions: sessions.length, cats,
    favorite: cats.length ? cats.reduce((best, cat) => (catMinutes(cat) > catMinutes(best) ? cat : best)) : null,
    longest: longest ? { name: longest.name, min: longest.min } : null, bestDay,
    // Éléments posés (sauf ceux du départ), ensembles découverts, visiteurs rencontrés pour la première fois.
    built: S.city.tiles.filter(tile => tile.at > S.createdAt + 60000 && tsInPeriod(tile.at, from, to)).length,
    sets: Object.values(S.sets || {}).filter(at => tsInPeriod(at, from, to)).length,
    visitors: Object.values(S.visits || {}).filter(v => tsInPeriod(v.first, from, to)).length,
    festivals: gifts('fest:'), challenges: gifts('chal:'),
    achievements: Object.values(S.achievements || {}).filter(at => tsInPeriod(at, from, to)).length,
    moods: { good: moods.filter(e => e.mood >= 4).length, total: moods.length },
  };
}

// Bilan d'une semaine : son résumé, l'objectif de la semaine, le progrès sur la semaine d'avant (jamais négatif)
// et la phrase d'accueil, toujours positive.
function weekReview(week) {
  const summary = periodSummary(week, shiftDay(week, 6)), before = periodSummary(shiftDay(week, -7), shiftDay(week, -1)), p = goalProgress(S, week);
  const goal = { minutes: p.minutes, activeDays: p.activeDays, targetMinutes: p.goal.minutes, targetDays: p.goal.days, cat: p.goal.cat, done: p.done };
  const headline = goal.done ? 'great' : summary.activeDays >= 3 ? 'full' : summary.minutes > 0 ? 'gentle' : 'back';
  return { ...summary, goal, gain: Math.max(0, summary.minutes - before.minutes), headline };
}

// Mois et année : clé (AAAA-MM ou AAAA) et bornes.
const monthKey = day => day.slice(0, 7);
function periodRange(kind, key) {
  if (kind === 'year') return { from: key + '-01-01', to: key + '-12-31' };
  const [year, month] = key.split('-').map(Number), last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: key + '-01', to: key + '-' + String(last).padStart(2, '0') };
}
// Récapitulatif d'un mois ou d'une année. Pour une année, pas de nombre de séances : le journal n'en garde que les dernières.
function recapSummary(kind, key) {
  const { from, to } = periodRange(kind, key), summary = periodSummary(from, to);
  return { ...summary, kind, key, sessions: kind === 'year' ? null : summary.sessions };
}

// Bilan ou récapitulatif dû à l'ouverture, une seule fois chacun : l'année passée en janvier, puis le mois passé, puis la
// semaine passée. Jamais pour une période où la ville n'existait pas encore ; mois et année seulement s'ils ont eu de l'activité.
// Un marqueur de semaine à moins de 7 jours compte encore (changer le début de semaine ne rouvre pas le bilan).
function pendingRitual(day = today()) {
  if (S.settings.rituals === false) return null;
  const born = dayOf(S.createdAt), marks = S.rituals || {}, year = day.slice(0, 4), month = monthKey(day);
  const lastYear = String(Number(year) - 1), lastMonth = monthKey(shiftDay(month + '-01', -1));
  const active = (kind, key) => { const { from, to } = periodRange(kind, key); return periodSummary(from, to).minutes > 0; };
  if (month.endsWith('-01') && (marks.year || '') < lastYear && born < year + '-01-01' && active('year', lastYear)) return { kind: 'year', key: lastYear };
  if ((marks.month || '') < lastMonth && born < month + '-01' && active('month', lastMonth)) return { kind: 'month', key: lastMonth };
  const week = weekStartOf(day), lastWeek = shiftDay(week, -7);
  if (born < week && (!marks.week || marks.week < shiftDay(lastWeek, -6))) return { kind: 'week', key: lastWeek };
  return null;
}
// Humeur notée après une séance réussie : de 1 à 5, ou 0 pour la retirer. N'enregistre pas.
function setMood(entryId, level) {
  const entry = S.history.find(e => e.id === entryId && e.ok);
  if (!entry || !Number.isInteger(level) || level < 0 || level > 5) return false;
  if (level) entry.mood = level; else delete entry.mood;
  return true;
}
// Note qu'un bilan a été montré ; l'année montrée couvre aussi son mois de décembre.
function markRitual(kind, key) {
  S.rituals = { week: '', month: '', year: '', ...S.rituals, [kind]: key };
  if (kind === 'year') S.rituals.month = key + '-12';
}
