/* =========================================================================
   Partage (interface) : la ville d'un ami ouverte par un lien, sa carte postale, et la visite qui attend la fin d'une séance.
   ========================================================================= */
let pendingVisit = '';   // lien reçu pendant une séance : la ville amie s'ouvre quand la séance est finie
let visiting = null;     // ville montrée en grand : { snapshot, code }

// Ouvre la ville d'un code. Lien illisible : un message doux. Pendant une séance : le lien attend la fin de la séance.
// Une pose en cours s'annule et une fenêtre ouverte se ferme : la ville amie prend la place, comme annoncé.
function openVisitFromCode(code) {
  const snapshot = decodeCity(code);
  if (!snapshot) { toast(t('visit.badLink')); return false; }
  if (S.active || (typeof run !== 'undefined' && run) || !$('#session').hidden) {
    pendingVisit = code;
    toast(t('visit.afterSession'));
    return false;
  }
  if (Mode.state) Mode.cancel();
  if (!$('#sheet').hidden) closeSheet();
  if (!City.openVisit(snapshot, { own: snapshot.id === S.shareId })) return false;
  visiting = { snapshot, code };
  const keep = $('#visitKeep');
  keep.textContent = frTypo(t('visit.keep'));
  keep.removeAttribute('aria-disabled');
  return true;
}
// La visite gardée pendant une séance s'ouvre dès que la séance et son écran de fin sont fermés.
function openPendingVisit() {
  if (!pendingVisit || S.active || (typeof run !== 'undefined' && run) || !$('#session').hidden) return false;
  const code = pendingVisit;
  pendingVisit = '';
  return openVisitFromCode(code);
}
// Lien #ville=… : le fragment est retiré de l'adresse (un rechargement ne rouvre pas la visite), puis la ville s'ouvre.
function handleVisitHash() {
  if (!/ville=/.test(location.hash)) return false;
  const code = codeFromText(location.hash) || '';
  try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* adresse gardée */ }
  return openVisitFromCode(code);
}
function bindShare() {
  window.addEventListener('hashchange', handleVisitHash);
  $('#visitKeep').addEventListener('click', e => {
    if (!visiting || e.currentTarget.getAttribute('aria-disabled') === 'true' || !keepPostcard(visiting.snapshot, visiting.code)) return;
    commit();
    toast(t('visit.kept'));
    e.currentTarget.textContent = frTypo(t('visit.keptShort'));
    e.currentTarget.setAttribute('aria-disabled', 'true');
  });
  $('#visitShare').addEventListener('click', () => { if (typeof openShareCity === 'function') openShareCity(); });
}
