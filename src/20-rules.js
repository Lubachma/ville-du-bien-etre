/* =========================================================================
   Règles : jours, séries, gains, déblocages, prix
   Les jours se calculent dans le fuseau choisi à la création de la ville et avec une horloge
   qui ne recule jamais : changer la date ou le fuseau du téléphone ne fabrique pas de série.
   ========================================================================= */
const dayFmtCache = new Map();
function dayFormatter(tz) {
  if (!dayFmtCache.has(tz)) {
    let f;
    try { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }); }
    catch (e) { f = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }); }
    dayFmtCache.set(tz, f);
  }
  return dayFmtCache.get(tz);
}
function dayOf(ts) { return dayFormatter(S.clock.tz).format(ts); }
function nowTs() { return Math.max(Date.now(), S.clock.maxSeen || 0); }
function today() { return dayOf(nowTs()); }
function maxDay(a, b) { return (a || '') > (b || '') ? a : b; }
function effectiveDay() { return maxDay(today(), S.clock.lastDay); }
function keyToUTC(key) { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d, 12); }
function shiftDay(key, n) { const t = new Date(keyToUTC(key) + n * 86400000); return t.getUTCFullYear() + '-' + pad2(t.getUTCMonth() + 1) + '-' + pad2(t.getUTCDate()); }
// Dates d'un jour (clé AAAA-MM-JJ lue en UTC), une mise en forme par langue.
const DAY_FMT_OPTIONS = {
  long: { weekday: 'long', day: 'numeric', month: 'long' },
  short: { weekday: 'short', day: 'numeric', month: 'short' },
  weekday: { weekday: 'short' },
};
const dayLabelCache = new Map();
function dayFmt(kind) {
  const id = LANG + ':' + kind;
  if (!dayLabelCache.has(id)) dayLabelCache.set(id, new Intl.DateTimeFormat(locale(), { ...DAY_FMT_OPTIONS[kind], timeZone: 'UTC' }));
  return dayLabelCache.get(id);
}
const timeFmtCache = new Map();
function fmtTime(ts) {
  const tz = S.clock.tz, id = LANG + ':' + tz;
  if (!timeFmtCache.has(id)) {
    let f;
    try { f = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit', timeZone: tz }); }
    catch (e) { f = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }); }
    timeFmtCache.set(id, f);
  }
  return timeFmtCache.get(id).format(ts);
}
function dayLabel(key) { return dayFmt('long').format(keyToUTC(key)); }
function whenLabel(ts) {
  if (!validTs(ts)) return '';
  const k = dayOf(ts), now = today(), time = fmtTime(ts);
  if (k === now) return t('when.today', { time });
  if (k === shiftDay(now, -1)) return t('when.yesterday', { time });
  return t('when.other', { date: dayFmt('short').format(keyToUTC(k)), time });
}

function totalMinutes() { return CAT_ORDER.reduce((a, c) => a + (S.stats.byCat[c] || 0), 0); }
function todayMinutes() { return S.stats.days[today()] || 0; }
function streakFrom(key) {
  let n = 0, d = key;
  while (S.stats.days[d] > 0) { n++; d = shiftDay(d, -1); }
  return n;
}
function streak() {
  const t = today();
  return S.stats.days[t] > 0 ? streakFrom(t) : streakFrom(shiftDay(t, -1));
}
// Série obtenue si une session est validée le jour « day ».
function streakIfDoneOn(day) {
  return S.stats.days[day] > 0 ? streakFrom(day) : 1 + streakFrom(shiftDay(day, -1));
}
function streakBonus(n) { return clamp((n - 1) * 10, 0, 50); }
function rewardFor(min, drawPct, day) {
  const days = streakIfDoneOn(day || effectiveDay());
  const sp = streakBonus(days);
  const dp = drawPct || 0;
  return { base: min * RATE, drawPct: dp, streakPct: sp, streakDays: days, total: Math.round(min * RATE * (1 + (dp + sp) / 100)) };
}

function lockInfo(key) {
  const it = ITEMS[key];
  if (it.needTotal) {
    const have = totalMinutes();
    return have >= it.needTotal ? null : { have, need: it.needTotal, cat: null, text: it.needTotal + NB + "min d'activités au total" };
  }
  if (!it.need) return null;
  const have = S.stats.byCat[it.group] || 0;
  if (have >= it.need) return null;
  const text = it.need === 1 ? 'Après ta première session ' + CATS[it.group].name : it.need + NB + 'min ' + CATS[it.group].de;
  return { have, need: it.need, cat: it.group, text };
}
function unlockedSet() { return new Set(Object.keys(ITEMS).filter(k => !lockInfo(k))); }
function nextUnlock() {
  const chosen = S.goals && S.goals.building;
  if (chosen && isItem(chosen)) {
    const l = lockInfo(chosen);
    if (l) return { key: chosen, rem: l.need - l.have, l };
  }
  let best = null;
  for (const k of Object.keys(ITEMS)) {
    const l = lockInfo(k);
    if (!l) continue;
    const rem = l.need - l.have;
    if (!best || rem < best.rem || (rem === best.rem && ITEMS[k].price < ITEMS[best.key].price)) best = { key: k, rem, l };
  }
  return best;
}
function ownedCount(key) { return S.city.tiles.filter(t => t.item === key).length; }
// Chaque exemplaire supplémentaire d'un bâtiment coûte 50 % de plus (le décor garde son prix).
function priceOf(key) {
  const it = ITEMS[key];
  if (it.group === 'decor') return it.price;
  return Math.round(it.price * (1 + DUP_STEP * ownedCount(key)) / 1e5) * 1e5;
}
function nextSize() { return SIZES[SIZES.indexOf(S.city.size) + 1] || null; }

