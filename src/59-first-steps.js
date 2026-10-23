/* =========================================================================
   Premiers pas : la carte « Bienvenue » d'une ville sans séance, puis la carte « Garde ta ville à l'abri » une fois la première séance faite
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

/* -------------------------------------------------------------------------
   Garde ta ville à l'abri : la carte d'installation, après la première séance
   ------------------------------------------------------------------------- */
// Le navigateur d'Android (Chrome) propose d'installer l'app : l'événement est gardé pour le bouton « Installer ». promptSeen retient qu'il est
// venu sur un téléphone (pointeur tactile) et le reste une fois l'invite lancée : la carte demeure alors. installButtonHidden : le bouton a
// servi (l'invite ne se lance qu'une fois). installHelpShown : l'aide (le menu du navigateur) s'affiche, et reste. installed : l'app a été
// installée depuis cette page. shelterHiddenHere : « Ne plus afficher » tient pour cette page même si le stockage refuse d'écrire.
let installPrompt = null, promptSeen = false, installed = false, installButtonHidden = false, installHelpShown = false, shelterHiddenHere = false;

// Posés dès le chargement du fichier : le navigateur peut proposer l'installation sans attendre le démarrage de la ville.
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();   // pas de bannière du navigateur : la carte propose l'installation, après la première séance
  installPrompt = e;
  installButtonHidden = false;   // une proposition neuve : le bouton « Installer » revient, l'aide reste (comme avant)
  if (window.matchMedia('(pointer: coarse)').matches) promptSeen = true;
  renderShelter();
});
window.addEventListener('appinstalled', () => { installed = true; renderShelter(); });

// Quelle carte : sur iPhone et iPad le navigateur ne propose rien, la carte explique et copie la ville ('ios') ; ailleurs elle n'existe que
// si le navigateur a proposé d'installer l'app sur un téléphone ('prompt'). Lu à chaque dessin, jamais au chargement du fichier.
function shelterKind() { return isIOS() ? 'ios' : promptSeen ? 'prompt' : ''; }
// « Ne plus afficher » : rangé sur l'appareil ('1'), et tenu pour cette page tout de suite (le stockage peut refuser d'écrire).
function shelterHidden() {
  if (shelterHiddenHere) return true;
  try { return localStorage.getItem(LS_INSTALL_HINT) === '1'; } catch (e) { return false; }
}
// Une ville qui a vécu une séance, réussie ou non (isNewTown : lu dans les compteurs, jamais dans l'historique). Jamais dans l'app installée,
// ni hors d'un contexte sûr (HTTPS ou localhost : là où l'app s'installe), ni une fois cachée pour de bon ou installée.
function shelterShown(kind = shelterKind()) {
  return !!kind && !isNewTown() && !isStandalone() && window.isSecureContext && !shelterHidden() && !installed;
}

// La carte, juste après l'accueil (index.html), remplie ici comme le rappel de sauvegarde et refaite à chaque rendu de la Ville, mais aussi quand
// le navigateur parle (proposition d'installer, app installée), hors de renderVille et de son keepFocus. Ses boutons ont une clé de focus :
// redessinée sous un focus (au clavier), la carte le rend elle-même au bouton de même clé ; disparue avec lui, elle le passe à « Lancer une
// activité ».
function renderShelter() {
  const card = $('#installCard');
  if (!card) return;
  const kind = shelterKind(), held = card.contains(document.activeElement), key = held ? focusKeyOf(document.activeElement) : null;
  card.hidden = !shelterShown(kind);
  if (card.hidden) {
    card.replaceChildren();
    if (held) $('#ctaStart').focus({ preventScroll: true });
    return;
  }
  const button = (act, cls, label) => h('button', { class: 'btn ' + cls + ' btn-sm', type: 'button', 'data-act': act, 'data-focus-key': 'install:' + act }, label);
  card.replaceChildren(
    h('img', { src: 'icons/icon-192.png', alt: '', width: '48', height: '48' }),
    h('div', { class: 'install-main' },
      h('h3', { id: 'installTitle' }, t('install.title')),
      kind === 'ios' ? [h('p', {}, t('install.iosWhy')), h('p', {}, t('install.ios')), h('p', {}, t('install.iosCopy'))] : h('p', {}, t('install.prompt')),
      h('div', { class: 'install-actions' },
        kind === 'ios' && button('copy', 'btn-primary', t('install.copy')),
        kind === 'prompt' && !installButtonHidden && button('install', 'btn-primary', t('install.install')),
        button('hide', 'btn-ghost', t('install.hide'))),
      installHelpShown && h('p', { class: 'note install-help' }, t('install.help'))));
  if (held) focusByKey(key);
}

// « Copier ma ville » : le texte de sauvegarde, à coller à la première ouverture de l'app installée. Il compte comme une sauvegarde (markBackup).
// Le presse-papiers peut manquer ou refuser : le message reste alors, avec la porte de Réglages → Sauvegarde. Le focus revient au bouton, que
// la Ville redessinée ait ou non remplacé celui qu'on a cliqué (Safari ne donne pas le focus à un bouton cliqué).
async function copyTown() {
  let copied = false;
  try { await navigator.clipboard.writeText(exportBackup()); copied = true; } catch (e) { /* refusé, ou pas de presse-papiers : le message d'échec */ }
  if (copied) { markBackup(); toast(t('install.copied')); }
  else toast(t('install.copyFailed'), { label: t('backup.openSection'), run: openBackupSettings }, undefined, { keep: true });
  focusByKey('install:copy');
}

// « Installer » : l'aide s'affiche tout de suite (l'invite du navigateur ne se lance qu'une fois, et peut ne rien dire), le focus reste dans la
// carte, puis l'invite. Accepter ferme la carte.
async function installApp() {
  const prompt = installPrompt;
  if (!prompt) return;
  installPrompt = null;
  installButtonHidden = true;
  installHelpShown = true;
  renderShelter();
  focusByKey('install:hide');
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice && choice.outcome === 'accepted') { installed = true; renderShelter(); }
  } catch (e) { /* le navigateur n'a pas pu lancer l'invite : l'aide dit comment installer à la main */ }
}

// « Ne plus afficher » : pour de bon sur cet appareil, et tout de suite pour cette page. Le focus passe à « Lancer une activité », sous la
// ville, même quand le navigateur ne l'avait pas donné au bouton cliqué.
function hideShelter() {
  shelterHiddenHere = true;
  try { localStorage.setItem(LS_INSTALL_HINT, '1'); } catch (e) { /* stockage indisponible : cachée pour cette page seulement */ }
  renderShelter();
  $('#ctaStart').focus({ preventScroll: true });
}

// Les boutons fixes de la carte « Bienvenue » (les boutons de langue sont créés par renderWelcome), puis ceux de la carte d'installation,
// qui se refait : les clics sont reçus par la carte.
function bindFirstSteps() {
  $('#welcomeClose').addEventListener('click', closeWelcome);
  $('#welcomeChoose').addEventListener('click', () => go('activites', true));
  $('#welcomeStart').addEventListener('click', () => startFirstCalm());
  $('#installCard').addEventListener('click', e => {
    const act = e.target.closest('button[data-act]')?.dataset.act;
    if (act === 'copy') copyTown();
    else if (act === 'install') installApp();
    else if (act === 'hide') hideShelter();
  });
}
