/* =========================================================================
   Premiers pas : la carte « Bienvenue » d'une ville sans séance
   ========================================================================= */
const FIRST_CALM_MIN = 2;   // la première séance proposée : deux minutes de calme

// Fermée par la croix : sur cette page tout de suite (le stockage peut refuser d'écrire), et rangée sur cet appareil ('1') jusqu'à
// « Tout recommencer » (resetWelcome), pas dans la ville.
let welcomeHiddenHere = false;
function welcomeDismissed() {
  if (welcomeHiddenHere) return true;
  try { return localStorage.getItem(LS_WELCOME) === '1'; } catch (e) { return false; }
}
// Pour une ville sans séance que personne n'a fermée. Une première séance qui tourne (menée dans un autre onglet, ou ici) la cache aussi.
function welcomeShown() { return isNewTown() && !S.active && !welcomeDismissed(); }

// La carte, première de la Ville (index.html). Cachée dès qu'une séance est comptée ou en cours, ou une fois fermée. Visible, elle propose
// un bouton par langue connue autre que la langue affichée, écrite dans sa propre langue : il change la langue de l'app sans ouvrir les
// Réglages. Refaits à chaque rendu de la Ville, ces boutons ont une clé de focus (keepFocus) ; le clic redonne aussi le focus à celui qui
// reste, car tous les navigateurs ne le donnent pas au bouton cliqué (Safari) et applyLang redessine la carte. Il ferme avant le message
// en cours (celui de la première ouverture) : il parle l'ancienne langue. hideToast() sans argument : hideToast(true) ne ferme que le
// message qui reste, pas un message qui a son minuteur.
function renderWelcome() {
  const card = $('#welcomeCard'), box = $('#welcomeLangs');
  if (!card || !box) return;
  card.hidden = !welcomeShown();
  if (card.hidden) { box.replaceChildren(); return; }
  box.replaceChildren(...langs().filter(code => code !== LANG).map(code => h('button', {
    class: 'btn btn-ghost btn-sm', type: 'button', lang: code, 'data-focus-key': 'welcome:lang',
    onclick: () => { hideToast(); applyLang(code); focusByKey('welcome:lang'); },
  }, DICT[code]['lang.self'] || code)));
}

// La croix : l'accueil ne revient plus sur cet appareil, et même si le stockage refuse l'écriture, il ne revient plus sur cette page.
// La carte disparaît, le focus passe à « Lancer une activité » sous la ville.
function closeWelcome() {
  welcomeHiddenHere = true;
  try { localStorage.setItem(LS_WELCOME, '1'); } catch (e) { /* stockage indisponible : fermée pour cette page seulement */ }
  renderWelcome();
  $('#ctaStart').focus({ preventScroll: true });
}
// « Tout recommencer » : une ville neuve, l'accueil revient, pour la page comme pour l'appareil.
function resetWelcome() {
  welcomeHiddenHere = false;
  try { localStorage.removeItem(LS_WELCOME); } catch (e) { /* stockage indisponible */ }
}

// « Commencer par 2 minutes de calme » : la première séance, en Calme et en Concentration, avec la respiration guidée allumée pour cette
// séance seulement (`breathing` de la séance en cours : le réglage de la personne ne change pas). Son nom est rangé dans la langue du moment
// (displayName le traduit ensuite comme les exemples d'une ville neuve). Rend la promesse de beginSession.
function startFirstCalm() {
  return beginSession({ name: t('tpl.breathe'), cat: 'calme', min: FIRST_CALM_MIN, mode: 'focus', breathing: true });
}

// Les boutons fixes de la carte (les boutons de langue sont créés par renderWelcome).
function bindFirstSteps() {
  $('#welcomeClose').addEventListener('click', closeWelcome);
  $('#welcomeChoose').addEventListener('click', () => go('activites', true));
  $('#welcomeStart').addEventListener('click', () => startFirstCalm());
}
