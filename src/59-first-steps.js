/* =========================================================================
   Premiers pas : la carte « Bienvenue » d'une ville sans séance
   ========================================================================= */
const FIRST_CALM_MIN = 2;   // la première séance proposée : deux minutes de calme

// Fermée par la croix : rangée sur cet appareil ('1') jusqu'à « Tout recommencer » (45-settings.js), pas dans la ville.
function welcomeClosed() { try { return localStorage.getItem(LS_WELCOME) === '1'; } catch (e) { return false; } }
// Pour une ville sans séance que personne n'a fermée. Une première séance qui tourne (menée dans un autre onglet, ou ici) la cache aussi.
function welcomeShown() { return isNewTown() && !S.active && !welcomeClosed(); }

// La carte, première de la Ville (index.html). Cachée dès qu'une séance est comptée ou en cours, ou une fois fermée. Visible, elle propose
// un bouton par langue connue autre que la langue affichée, écrite dans sa propre langue : il change la langue de l'app sans ouvrir les
// Réglages. Refaits à chaque rendu de la Ville, ces boutons ont une clé de focus (keepFocus) ; le clic redonne aussi le focus à celui qui
// reste, car tous les navigateurs ne le donnent pas au bouton cliqué (Safari) et applyLang redessine la carte.
function renderWelcome() {
  const card = $('#welcomeCard'), box = $('#welcomeLangs');
  if (!card || !box) return;
  card.hidden = !welcomeShown();
  if (card.hidden) { box.replaceChildren(); return; }
  box.replaceChildren(...langs().filter(code => code !== LANG).map(code => h('button', {
    class: 'btn btn-ghost btn-sm', type: 'button', lang: code, 'data-focus-key': 'welcome:lang',
    onclick: () => { applyLang(code); focusByKey('welcome:lang'); },
  }, DICT[code]['lang.self'] || code)));
}

// La croix : l'accueil ne revient plus sur cet appareil. La carte disparaît, le focus passe à « Lancer une activité » sous la ville.
function closeWelcome() {
  lsSet(LS_WELCOME, '1');
  renderWelcome();
  $('#ctaStart').focus({ preventScroll: true });
}

// « Commencer par 2 minutes de calme » : la première séance, en Calme et en Concentration. Son nom est rangé dans la langue du moment
// (displayName le traduit ensuite comme les exemples d'une ville neuve). Rend la promesse de beginSession.
function startFirstCalm() {
  return beginSession({ name: t('tpl.breathe'), cat: 'calme', min: FIRST_CALM_MIN, mode: 'focus' });
}

// Les boutons fixes de la carte (les boutons de langue sont créés par renderWelcome).
function bindFirstSteps() {
  $('#welcomeClose').addEventListener('click', closeWelcome);
  $('#welcomeChoose').addEventListener('click', () => go('activites', true));
  $('#welcomeStart').addEventListener('click', () => startFirstCalm());
}
