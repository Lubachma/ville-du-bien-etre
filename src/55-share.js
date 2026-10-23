/* =========================================================================
   Partage (interface) : la ville d'un ami ouverte par un lien, sa carte postale, et la visite qui attend la fin d'une séance.
   ========================================================================= */
let pendingVisit = '';   // lien reçu pendant une séance : la ville amie s'ouvre quand la séance est finie
let visiting = null;     // ville montrée en grand : { snapshot, code }

// Ouvre la ville d'un code. Lien illisible : un message doux. Pendant une séance : le lien attend la fin de la séance.
// Une pose en cours s'annule et une fenêtre ouverte se ferme : la ville amie prend la place, comme annoncé. back : ce que la
// fermeture de la visite rouvre (le carnet, pour une de ses cartes postales).
// Pour un nouveau venu (une ville sans séance), la visite dit ce qu'est ce jeu et offre « Faire grandir ma ville » en bouton principal ;
// « Partager ma ville en retour » disparaît, puisqu'il n'y a encore rien à partager. Fermée, la visite amène le focus sur le premier pas de la
// Ville (focusFirstStep), sauf si l'appelant a son propre retour (le carnet).
function openVisitFromCode(code, { back = null } = {}) {
  const snapshot = decodeCity(code);
  if (!snapshot) { toast(t('visit.badLink')); return false; }
  if (S.active || (typeof run !== 'undefined' && run) || !$('#session').hidden) {
    pendingVisit = code;
    toast(t('visit.afterSession'));
    return false;
  }
  if (Mode.state) Mode.cancel();
  if (!$('#sheet').hidden) closeSheet();
  // La barre est refaite à chaque ouverture, et avant la mise en page de la visite, qui la mesure : la ville a pu faire sa première séance
  // depuis la visite d'avant. « Garder la carte postale » est le bouton principal, sauf pour un nouveau venu, qui a « Faire grandir ma ville ».
  const newcomer = isNewTown(), keep = $('#visitKeep');
  $('#visitGrow').hidden = !newcomer;
  $('#visitShare').hidden = newcomer;
  keep.classList.toggle('btn-primary', !newcomer);
  keep.classList.toggle('btn-secondary', newcomer);
  keep.textContent = frTypo(t('visit.keep'));
  keep.removeAttribute('aria-disabled');
  if (!City.openVisit(snapshot, { own: snapshot.id === S.shareId, back: back || (newcomer ? focusFirstStep : null), pitch: newcomer })) return false;
  visiting = { snapshot, code };
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
// Fenêtre « Partager ma ville » : ce que l'ami verra, le lien (par le partage du téléphone, ou copié), puis « Visiter une
// ville amie » : dans l'app installée sur iPhone, un lien reçu s'ouvre dans le navigateur, d'où l'on vient le coller ici.
function openShareSheet() {
  const unnamed = cityName() === t('city.defaultName'), link = shareLink(encodeCity());
  commit({ silent: true });   // l'identifiant de partage vient peut-être d'être créé
  openSheet(t('share.title'), body => {
    const field = h('input', { id: 'shareLinkField', class: 'input', type: 'text', readonly: true, value: link, 'aria-label': t('share.link'), onfocus: e => e.target.select() });
    const copy = () => {
      const fallback = () => { field.focus(); field.select(); toast(t('share.copyFallback')); };
      try { navigator.clipboard.writeText(link).then(() => toast(t('share.copied')), fallback); } catch (e) { fallback(); }
    };
    const send = () => navigator.share({ title: cityName(), text: t('share.text'), url: link }).catch(e => { if (!e || e.name !== 'AbortError') copy(); });
    const visitField = h('input', { id: 'visitLinkField', class: 'input', type: 'text', inputmode: 'url', autocomplete: 'off', placeholder: t('share.visitHint'), 'aria-label': t('share.visitHint') });
    body.append(h('p', {}, t('share.privacy')));
    if (unnamed) {
      body.append(h('div', { class: 'feature-between share-unnamed' }, h('p', { class: 'note' }, t('share.unnamed')),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: openCityPersonalization }, icon('pencil'), t('city.personalize'))));
    }
    body.append(field, h('div', { class: 'share-actions' },
      typeof navigator.share === 'function' ? h('button', { class: 'btn btn-primary', type: 'button', onclick: send }, icon('share'), t('share.send')) : null,
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: copy }, icon('copy'), t('share.copy'))),
    h('section', { class: 'recap-part share-visit' }, h('h3', { class: 'section-title' }, t('share.visitTitle')), visitField,
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => openVisitFromCode(codeFromText(visitField.value)) }, t('share.visit'))));
  });
}
function bindShare() {
  window.addEventListener('hashchange', handleVisitHash);
  $('#shareCity').addEventListener('click', openShareSheet);
  $('#visitKeep').addEventListener('click', e => {
    if (!visiting || e.currentTarget.getAttribute('aria-disabled') === 'true' || !keepPostcard(visiting.snapshot, visiting.code)) return;
    const progress = progressNow();   // le succès « Carte postale », gagné tout de suite
    commit();
    e.currentTarget.textContent = frTypo(t('visit.keptShort'));
    e.currentTarget.setAttribute('aria-disabled', 'true');
    cheer(progress, t('visit.kept'));
  });
  $('#visitShare').addEventListener('click', openShareSheet);
  $('#visitGrow').addEventListener('click', () => City.closeBig());
}
