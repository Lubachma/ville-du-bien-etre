/* =========================================================================
   Défis de la semaine : trois défis doux, un par famille, à la mesure de chacun.
   Règles pures, sans DOM. Le tirage part de la semaine et de la graine de la ville (chance).
   ========================================================================= */
function challengeWeek(day = today()) { return weekStartOf(day); }
const weekDays = week => Array.from({ length: 7 }, (_, i) => shiftDay(week, i));
// Séances réussies dont le jour est dans la période (bornes comprises).
const okSessions = (from, to) => S.history.filter(e => e.ok && e.day >= from && e.day <= to);

// Cibles de la semaine, calculées sur les 28 jours d'avant : elles ne bougent plus pendant la semaine.
function challengeTargets(week) {
  const daily = S.stats.dailyCats || {}, minutesOn = (day, cat) => obj(daily[day])[cat] || 0;
  // Domaines variés : la moyenne des domaines différents par semaine (semaines vides comprises), plus un.
  let seen = 0;
  for (let w = 1; w <= 4; w++) {
    const days = weekDays(shiftDay(week, -7 * w));
    seen += CAT_ORDER.filter(cat => days.some(day => minutesOn(day, cat) > 0)).length;
  }
  const domains = clamp(Math.round(seen / 4) + 1, 2, 5);
  // Domaine retrouvé : un domaine absent la semaine passée, sinon le moins pratiqué.
  const last = weekDays(shiftDay(week, -7)), lastMinutes = cat => last.reduce((sum, day) => sum + minutesOn(day, cat), 0);
  const absent = CAT_ORDER.filter(cat => !lastMinutes(cat));
  const comeback = absent.length ? absent[Math.floor(chance(week + ':comeback') * absent.length)]
    : CAT_ORDER.reduce((best, cat) => (lastMinutes(cat) < lastMinutes(best) ? cat : best), CAT_ORDER[0]);
  // Longue séance : la durée médiane des séances réussies, une fois et demie, arrondie à 5 minutes.
  const lengths = okSessions(shiftDay(week, -28), shiftDay(week, -1)).map(e => e.min).sort((a, b) => a - b), mid = lengths.length >> 1;
  const median = lengths.length % 2 ? lengths[mid] : (lengths[mid - 1] + lengths[mid]) / 2;
  const long = lengths.length ? clamp(Math.round(median * 1.5 / 5) * 5, 10, 60) : 15;
  return { domains, comeback, long };
}

// Un défi possible cette semaine : la routine seulement s'il en existe une.
const challengePossible = ch => ch.id !== 'routine' || (S.routines || []).length > 0;
// Les trois défis de la semaine, un par famille, avec leurs cibles ; un défi changé laisse sa place au suivant de sa famille.
function weekChallenges(week = challengeWeek()) {
  const targets = challengeTargets(week), swapped = S.challenges && S.challenges.week === week ? S.challenges.swapped : -1;
  return CHALLENGE_FAMILIES.map((family, i) => {
    const order = CHALLENGES.filter(ch => ch.family === family && challengePossible(ch))
      .sort((p, q) => chance(week + ':chal:' + p.id) - chance(week + ':chal:' + q.id));
    const ch = (i === swapped && order[1]) || order[0];
    const params = ch.id === 'domains' ? { n: targets.domains } : ch.id === 'comeback' ? { cat: targets.comeback } : ch.id === 'long' ? { m: targets.long } : {};
    return { id: ch.id, family: ch.family, ...params };
  });
}

// Où en est un défi cette semaine : ce qui est fait, ce qu'il demande.
function challengeProgress(ch, week = challengeWeek()) {
  const end = shiftDay(week, 6), done = okSessions(week, end), inWeek = ts => validTs(ts) && dayOf(ts) >= week && dayOf(ts) <= end;
  const any = test => (done.some(test) ? 1 : 0);
  let have = 0, need = 1;
  switch (ch.id) {
    case 'domains': have = new Set(done.map(e => e.cat)).size; need = ch.n; break;
    case 'comeback': have = any(e => e.cat === ch.cat); break;
    case 'long': have = done.reduce((max, e) => Math.max(max, e.min), 0); need = ch.m; break;
    case 'twoAreas': {
      const byDay = new Map();
      for (const e of done) byDay.set(e.day, (byDay.get(e.day) || new Set()).add(e.cat));
      have = Math.min(2, Math.max(0, ...[...byDay.values()].map(cats => cats.size))); need = 2;
      break;
    }
    case 'morning': have = any(e => hourIn(e.at) < 9); break;
    case 'evening': have = any(e => hourIn(e.at) >= 20); break;
    case 'weekend': have = any(e => [0, 6].includes(new Date(keyToUTC(e.day)).getUTCDay())); break;
    case 'draw': have = any(e => e.source === 'wishes' || e.source === 'chores'); break;
    case 'focus': have = any(e => e.mode === 'focus'); break;
    case 'routine': have = S.routineRun && S.routineRun.status === 'done' && inWeek(S.routineRun.finishedAt) ? 1 : 0; break;
    // Deux visiteurs salués : leurs cadeaux reçus cette semaine (le jeu ne garde pas la date de chaque rencontre).
    case 'visitors': have = Object.keys(S.gifts || {}).filter(key => key.startsWith('visit:') && key.slice(6) >= week && key.slice(6) <= end).length; need = 2; break;
    // Un nouvel élément : posé cette semaine, sauf ceux du départ de la ville.
    case 'build': have = S.city.tiles.filter(tile => tile.at > S.createdAt + 60000 && inWeek(tile.at)).length; break;
    default: break;
  }
  return { have, need, done: have >= need };
}
function challengeKey(ch, week) { return 'chal:' + week + ':' + ch.id; }

// Défis relevés pas encore payés : 5 M chacun, une seule fois, pour la semaine du jour seulement (rien pour une semaine passée).
// Changer le début de semaine ne fait pas payer deux fois : ni le même défi, ni plus de trois, à moins de 7 jours d'une semaine payée.
function claimChallenges(day = today()) {
  if (S.settings.challenges === false) return [];
  const week = challengeWeek(day), near = Object.keys(S.gifts || {}).filter(key => key.startsWith('chal:'))
    .map(key => ({ week: key.slice(5, 15), id: key.slice(16) })).filter(g => Math.abs(keyToUTC(g.week) - keyToUTC(week)) <= 6 * 86400000);
  const paid = [];
  for (const ch of weekChallenges(week)) {
    const key = challengeKey(ch, week);
    if (S.gifts[key] || near.length >= 3 || near.some(g => g.id === ch.id) || !challengeProgress(ch, week).done) continue;
    S.gifts[key] = nowTs();
    S.coins = clamp(S.coins + GIFTS.challenge, 0, COINS_MAX);
    near.push({ week, id: ch.id });
    paid.push({ ...ch, key });
  }
  return paid;
}
// Changer un défi : une fois par semaine, un défi pas encore relevé qui a un suivant dans sa famille.
function swapChallenge(index, day = today()) {
  const week = challengeWeek(day);
  if (S.challenges && S.challenges.week === week && S.challenges.swapped >= 0) return false;
  const ch = weekChallenges(week)[index];
  if (!ch || S.gifts[challengeKey(ch, week)] || challengeProgress(ch, week).done) return false;
  if (CHALLENGES.filter(other => other.family === ch.family && challengePossible(other)).length < 2) return false;
  S.challenges = { week, swapped: index };
  return true;
}
