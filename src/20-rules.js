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
// Premier jour de la semaine de « day », selon le réglage (lundi par défaut).
function weekStartOf(day) {
  const weekday = new Date(keyToUTC(day)).getUTCDay();
  return shiftDay(day, -(S.settings.weekStart === 'sun' ? weekday : (weekday + 6) % 7));
}
// Une pause commence au plus tôt le jour où on la lance : aucune pause ne couvre le passé.
function isPaused(day) {
  return (S.pauses || []).some(p => p.from <= day && (p.to ? day <= p.to : day <= today()));
}
/* Série : on remonte les jours depuis endDay. Un jour actif compte ; une pause fait le pont ;
   un jour inactif fait le pont tant qu'il reste des repos dans sa semaine, sinon on s'arrête.
   Aujourd'hui sans session ne casse rien. Les réglages actuels s'appliquent aussi au passé.
   rests : jours de repos utilisés entre les jours actifs comptés. */
function streakDetail(endDay, assumeActive = false) {
  const now = today(), used = new Map(), rests = [];
  let days = 0, pending = [], d = endDay;
  for (let i = 0; i < 4000; i++, d = shiftDay(d, -1)) {
    if ((assumeActive && d === endDay) || S.stats.days[d] > 0) { days++; rests.push(...pending); pending = []; continue; }
    if (d === now || isPaused(d)) continue;
    const week = weekStartOf(d), n = used.get(week) || 0;
    if (n >= S.settings.restDays) break;
    used.set(week, n + 1);
    pending.push(d);
  }
  return { days, rests };
}
function streak() { return streakDetail(today()).days; }
// Série obtenue si une session est validée le jour « day ».
function streakIfDoneOn(day) { return streakDetail(day, true).days; }
function restDaysLeft() {
  const now = today(), week = weekStartOf(now);
  return Math.max(0, S.settings.restDays - streakDetail(now).rests.filter(d => weekStartOf(d) === week).length);
}
function pauseActive() { return (S.pauses || []).find(p => !p.to) || null; }
// Ces deux fonctions modifient S sans l'enregistrer : l'appelant fait commit().
function startPause() {
  if (pauseActive()) return;
  S.pauses = [...(S.pauses || []), { from: today(), to: '' }].slice(-20);
}
function endPause() {
  const p = pauseActive(), now = today();
  if (!p) return;
  if (p.from >= now) S.pauses = S.pauses.filter(x => x !== p);
  else p.to = shiftDay(now, -1);
}
function streakBonus(n) { return clamp((n - 1) * 10, 0, 50); }
/* Cadeau de bon retour : la première session réussie du jour, quand elle lance une nouvelle série
   après au moins 2 jours sans session (les jours en pause ne comptent pas). Jamais pour une ville
   neuve, et jamais en plus d'une série entretenue : les deux bonus sont des alternatives. */
function returnBonusFor(day) {
  if (S.stats.days[day] > 0) return 0;
  const last = Object.keys(S.stats.days).filter(k => k < day && S.stats.days[k] > 0).sort().pop();
  if (!last || streakIfDoneOn(day) !== 1) return 0;
  let away = 0;
  for (let d = shiftDay(last, 1); d < day; d = shiftDay(d, 1)) if (!isPaused(d) && ++away >= 2) return RETURN_BONUS;
  return 0;
}
function rewardFor(min, drawPct, day) {
  const d = day || effectiveDay();
  const days = streakIfDoneOn(d);
  const sp = streakBonus(days);
  const dp = drawPct || 0;
  const rp = returnBonusFor(d);
  return { base: min * RATE, drawPct: dp, streakPct: sp, streakDays: days, returnPct: rp, total: Math.round(min * RATE * (1 + (dp + sp + rp) / 100)) };
}

function isWonder(key) { return !!(ITEMS[key] && ITEMS[key].wonder); }
// Un bâtiment : ni décor, ni élément au sol, ni merveille.
function isBuilding(key) { const it = ITEMS[key]; return !!it && it.group !== 'decor' && !it.ground && !it.wonder; }
// Somme payée pour une merveille arrivée à l'étape « stage » (0 : rien de construit).
function wonderPaid(key, stage) { return ITEMS[key].wonder.slice(0, stage).reduce((sum, [, price]) => sum + price, 0); }
function lockInfo(key) {
  const it = ITEMS[key];
  // Un décor offert attend son succès.
  if (it.reward) {
    if ((S.achievements || {})[it.reward]) return null;
    return { have: 0, need: 1, cat: null, reward: it.reward, text: t('lock.reward', { name: t('ach.' + it.reward + '.name') }) };
  }
  // Minutes de toutes les activités : décors de l'étape 2, tour de l'horloge, première étape d'une merveille.
  const needTotal = it.needTotal || (it.wonder && it.wonder[0][0]);
  if (needTotal) {
    const have = totalMinutes();
    return have >= needTotal ? null : { have, need: needTotal, cat: null, text: t('lock.total', { min: needTotal }) };
  }
  if (!it.need) return null;
  const have = S.stats.byCat[it.group] || 0;
  if (have >= it.need) return null;
  const text = it.need === 1 ? t('lock.first', { cat: catName(it.group) }) : t('lock.need', { min: it.need, cat: catName(it.group), of: catOf(it.group) });
  return { have, need: it.need, cat: it.group, text };
}
function unlockedSet() { return new Set(Object.keys(ITEMS).filter(k => !lockInfo(k))); }
// Collection du carnet : les éléments débloqués (un décor offert l'est par son succès).
function collectionCount() { return { have: unlockedSet().size, total: Object.keys(ITEMS).length }; }
// Prochain objectif : l'élément le plus proche, jamais un décor offert (il ne dépend pas des minutes).
function nextUnlock() {
  const chosen = S.goals && S.goals.building;
  if (chosen && isItem(chosen) && !ITEMS[chosen].reward) {
    const l = lockInfo(chosen);
    if (l) return { key: chosen, rem: l.need - l.have, l };
    // Merveille choisie dont le chantier a commencé : son étape suivante reste l'objectif.
    const step = isWonder(chosen) && wonderTile(chosen) ? stageGoal(wonderTile(chosen)) : null;
    if (step) return step;
  }
  let best = null;
  for (const k of Object.keys(ITEMS)) {
    const l = ITEMS[k].reward ? null : lockInfo(k);
    if (!l) continue;
    const rem = l.need - l.have;
    if (!best || rem < best.rem || (rem === best.rem && ITEMS[k].price < ITEMS[best.key].price)) best = { key: k, rem, l };
  }
  // L'étape suivante d'une merveille posée compte aussi.
  for (const tile of S.city.tiles) {
    const step = isWonder(tile.item) ? stageGoal(tile) : null;
    if (step && (!best || step.rem < best.rem)) best = step;
  }
  return best;
}
// L'étape suivante d'une merveille posée, quand elle attend encore des minutes.
function stageGoal(tile) {
  const next = wonderNext(tile);
  if (!next || next.ready) return null;
  return { key: tile.item, rem: next.need - next.have, l: { have: next.have, need: next.need, cat: null }, stage: next.stage };
}
// Prochain élément à débloquer d'une rubrique : le moins de minutes restantes, puis le moins cher, puis l'ordre de la table.
function nextInGroup(group) {
  let best = null;
  for (const k of Object.keys(ITEMS)) {
    if (ITEMS[k].group !== group || ITEMS[k].reward) continue;
    const l = lockInfo(k);
    if (!l) continue;
    const rem = l.need - l.have;
    if (!best || rem < best.rem || (rem === best.rem && ITEMS[k].price < ITEMS[best.key].price)) best = { key: k, rem };
  }
  return best ? best.key : null;
}
// Rubrique de la boutique : les éléments débloqués, puis les verrouillés dévoilés (le prochain, puis l'objectif), puis les autres.
function groupView(group) {
  const keys = Object.keys(ITEMS).filter(k => ITEMS[k].group === group), locked = keys.filter(k => lockInfo(k));
  const revealed = [nextInGroup(group), S.goals && S.goals.building].filter((k, i, list) => k && locked.includes(k) && list.indexOf(k) === i);
  return { open: keys.filter(k => !locked.includes(k)), revealed, hidden: locked.filter(k => !revealed.includes(k)) };
}
// Un élément dévoilé se montre en couleur : débloqué, prochain de sa rubrique, ou objectif choisi.
function isRevealed(key) { return !lockInfo(key) || nextInGroup(ITEMS[key].group) === key || (S.goals && S.goals.building) === key; }
function ownedCount(key) { return S.city.tiles.filter(t => t.item === key).length; }
// Merveilles : une seule de chaque par ville, construite en quatre étapes sur la même case.
function wonderTile(key) { return S.city.tiles.find(t => t.item === key) || null; }
function wonderNext(tile) {
  const stages = ITEMS[tile.item].wonder, stage = tile.stage || 1;
  if (stage >= stages.length) return null;
  const [need, price] = stages[stage], have = totalMinutes();
  return { stage: stage + 1, need, have, price, ready: have >= need, affordable: S.coins >= price };
}
// Construit l'étape suivante si elle est prête et payable ; l'appelant enregistre et affiche.
function buildWonderStage(tile) {
  const next = wonderNext(tile);
  if (!next || !next.ready || !next.affordable) return false;
  S.coins -= next.price;
  tile.stage = next.stage;
  tile.paid = wonderPaid(tile.item, tile.stage);
  return true;
}
// Domaines pratiqués depuis le début de la semaine : les fleurs du Grand Arbre en prennent les couleurs.
function weekCats(day = today(), state = S) {
  const seen = new Set();
  for (let d = weekStartOf(day); d <= day; d = shiftDay(d, 1)) {
    for (const [cat, min] of Object.entries(state.stats.dailyCats[d] || {})) if (min > 0) seen.add(cat);
  }
  return CAT_ORDER.filter(cat => seen.has(cat));
}
// Chaque exemplaire supplémentaire d'un bâtiment coûte 50 % de plus (le décor garde son prix).
// Un décor offert est gratuit tant qu'aucun n'est posé ; une merveille, unique, coûte le prix de sa première étape.
function priceOf(key) {
  const it = ITEMS[key];
  if (it.reward && !ownedCount(key)) return 0;
  if (it.wonder) return it.wonder[0][1];
  if (it.group === 'decor') return it.price;
  return Math.round(it.price * (1 + DUP_STEP * ownedCount(key)) / 1e5) * 1e5;
}
function nextSize() { return SIZES[SIZES.indexOf(S.city.size) + 1] || null; }

