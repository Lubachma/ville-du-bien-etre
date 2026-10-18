/* =========================================================================
   Compagnon (règles) : arrivée, complicité et accessoires, invitation, geste de chaque domaine. Sans DOM.
   ========================================================================= */
// Niveau de complicité du compagnon (1 à 10) ; 0 sans compagnon.
function companionLevel(c = S.companion) { return c ? companionLevelOf(c.minutes) : 0; }
// Le prochain niveau, les minutes qui restent et l'accessoire qu'il offre ; rien au niveau 10 ni sans compagnon.
function companionNext(c = S.companion) {
  const level = companionLevel(c);
  if (!level || level >= COMPANION_LEVELS.length) return null;
  return { level: level + 1, left: COMPANION_LEVELS[level] - c.minutes, wear: COMPANION_WEAR[level - 1] };
}
// Les accessoires gagnés à ce niveau, dans l'ordre de la garde-robe.
function wearUnlocked(level) { return COMPANION_WEAR.filter((id, i) => i + 2 <= level); }
// Le nom du compagnon, ou celui que suggère son animal dans la langue affichée.
function companionName(c = S.companion) { return c ? c.name || t('companion.suggest.' + c.species) : ''; }
// Accueillir un compagnon : il arrive maintenant, sans complicité ni accessoire. N'enregistre pas.
function adoptCompanion(species, name) {
  if (!COMPANION_SPECIES.includes(species)) return null;
  S.companion = { species, name: cleanCompanionName(name), since: nowTs(), minutes: 0, wear: '' };
  return S.companion;
}
// Changer d'animal ou de nom : la complicité et l'accessoire restent. N'enregistre pas.
function editCompanion(species, name) {
  if (!S.companion || !COMPANION_SPECIES.includes(species)) return;
  Object.assign(S.companion, { species, name: cleanCompanionName(name) });
}
// Le temps d'une séance faite ensemble, réussie ou interrompue : les niveaux avant et après. N'enregistre pas.
function addCompanionMinutes(min) {
  if (!S.companion || !(min > 0)) return null;
  const before = companionLevel();
  S.companion.minutes = Math.min(1e7, S.companion.minutes + min);
  return { gained: min, before, after: companionLevel() };
}
// Porter un accessoire déjà gagné, ou aucun ('') ; un autre est refusé sans rien changer. N'enregistre pas.
function wearCompanion(id) {
  if (!S.companion || (id !== '' && !wearUnlocked(companionLevel()).includes(id))) return false;
  S.companion.wear = id;
  return true;
}
// L'invitation : après une première séance réussie, tant qu'aucun compagnon n'est arrivé et qu'elle n'a pas été laissée de côté.
function companionInvite() { return S.stats.ok >= 1 && !S.companion && !S.companionLater; }
// Ce que fait le compagnon pendant une séance de ce domaine.
const COMPANION_POSES = { esprit: 'read', corps: 'stretch', calme: 'meditate', foyer: 'water', crea: 'paint' };
function companionPose(cat) { return COMPANION_POSES[cat] || 'idle'; }
