/* =========================================================================
   Premiers pas : la carte « Bienvenue » d'une ville sans séance (avec, dans l'app installée sur iPhone, le collage de la ville commencée dans
   Safari), puis la carte « Garde ta ville à l'abri » une fois la première séance faite
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
// reste, car tous les navigateurs ne le donnent pas au bouton cliqué (Safari) et applyLang redessine la carte. applyLang ferme le message en cours
// (celui de la première ouverture) : il parle l'ancienne langue.
// « J'avais commencé dans Safari : coller ma ville » n'est montré que dans l'app installée sur iPhone, dont le stockage n'est pas celui de Safari :
// la ville commencée là-bas n'y est pas. Ailleurs (Safari, Android, un ordinateur), le stockage est celui du navigateur : rien à reprendre. Lu à
// chaque dessin, jamais au chargement du fichier.
function renderWelcome() {
  const card = $('#welcomeCard'), box = $('#welcomeLangs'), paste = $('#welcomePaste');
  if (!card || !box) return;
  card.hidden = !welcomeShown();
  if (card.hidden) { box.replaceChildren(); return; }
  if (paste) paste.hidden = !(isIOS() && isStandalone());
  box.replaceChildren(...langs().filter(code => code !== LANG).map(code => h('button', {
    class: 'btn btn-ghost btn-sm', type: 'button', lang: code, 'data-focus-key': 'welcome:lang',
    onclick: () => { applyLang(code); focusByKey('welcome:lang'); },
  }, DICT[code]['lang.self'] || code)));
}

// La croix : l'accueil ne revient plus sur cet appareil, et même si le stockage refuse l'écriture, il ne revient plus sur cette page.
// La carte disparaît, le focus passe à « Lancer une activité » sous la ville.
function focusStart() { $('#ctaStart').focus({ preventScroll: true }); }
function closeWelcome() {
  welcomeHiddenHere = true;
  try { localStorage.setItem(LS_WELCOME, '1'); } catch (e) { /* stockage indisponible : fermée pour cette page seulement */ }
  renderWelcome();
  focusStart();
}
// « Tout recommencer » : une ville neuve, l'accueil revient, pour la page comme pour l'appareil.
function resetWelcome() {
  welcomeHiddenHere = false;
  try { localStorage.removeItem(LS_WELCOME); } catch (e) { /* stockage indisponible */ }
}

// Le premier pas de la Ville : le bouton principal de l'accueil, ou « Lancer une activité » quand l'accueil n'y est pas (fermé). C'est là que va le
// focus quand un nouveau venu referme la visite d'un ami (openVisitFromCode). La visite se ferme sur un geste de la personne : le bouton est
// montré s'il était hors de vue, comme la carte postale d'où l'on revient. Vrai si l'un des deux a pris le focus ; quand la Ville n'est pas
// affichée, aucun ne le peut et rien ne bouge.
function focusFirstStep() {
  return tryFocus($('#welcomeStart'), true) || tryFocus($('#ctaStart'), true);
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
    if (held) focusStart();
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
  focusStart();
}

/* -------------------------------------------------------------------------
   Coller ma ville : dans l'app installée sur iPhone, la ville commencée dans Safari
   ------------------------------------------------------------------------- */
// « J'avais commencé dans Safari : coller ma ville ». L'app installée a son propre stockage : sa ville est neuve, celle de Safari n'y est pas. « Copier
// ma ville » (la carte d'installation, dans Safari) a mis la sauvegarde dans le presse-papiers ; le bouton l'y lit. Safari ne laisse lire le
// presse-papiers que dans le geste de la personne : readText() part tout de suite, avant tout await. Un presse-papiers refusé ou absent vaut un
// presse-papiers vide. Rien à reprendre (vide, autre texte, sauvegarde coupée ou abîmée) : un message doux qui reste, avec la porte de Réglages →
// Sauvegarde ; rien n'est remplacé et aucune feuille ne s'ouvre. Un texte sans « VBE1. » ni « VBE2. » n'est pas une sauvegarde : le message dit comment
// faire ; sinon readBackup dit lui-même ce qui ne va pas. Une sauvegarde lue ouvre la feuille « Reprendre ma ville » : la ville trouvée, et un geste.
async function pasteTown() {
  let text = '';
  try { text = String(await navigator.clipboard.readText() || ''); } catch (e) { /* refusé, ou pas de presse-papiers : comme s'il était vide */ }
  const res = /VBE[12]\./.test(text) ? readBackup(text) : { error: t('welcome.pasteNone') };
  if (res.error) {
    toast(res.error, { label: t('backup.openSection'), run: openBackupSettings }, undefined, { keep: true });
    return;
  }
  // Safari ne donne pas le focus à un bouton cliqué : le bouton le prend ici, avant la feuille, et c'est à lui que la feuille le rend en se fermant
  // (« Annuler », la croix, Échap).
  $('#welcomePaste').focus({ preventScroll: true });
  openSheet(t('welcome.pasteTitle'), body => body.append(
    h('p', {}, t('welcome.pasteLine')),
    h('p', {}, h('strong', {}, summary(res.state))),
    h('div', { class: 'review-actions' },
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => restorePastedTown(res.state) }, t('welcome.pasteRestore')),
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: closeSheet }, t('common.cancel')))));
}
// « Reprendre cette ville » : la sauvegarde remplace la ville neuve (restoreBackup ferme la feuille, enregistre, la compte comme une sauvegarde faite
// ici et le dit ; pendant une séance, il refuse et la feuille reste). La ville reprise a presque toujours des séances : l'accueil disparaît alors avec
// son bouton ; la sauvegarde d'une ville qui n'a fait aucune séance les laisse tous deux. Dans les deux cas le focus passe à « Lancer une activité », sous
// la ville, que le navigateur ait ou non donné le focus au bouton cliqué. Il est posé après restoreBackup, donc après les dessins qu'il a faits.
function restorePastedTown(state) {
  restoreBackup(state);
  if ($('#sheet').hidden) focusStart();
}

// Les boutons fixes de la carte « Bienvenue » (les boutons de langue sont créés par renderWelcome), puis ceux de la carte d'installation,
// qui se refait : les clics sont reçus par la carte.
function bindFirstSteps() {
  $('#welcomeClose').addEventListener('click', closeWelcome);
  $('#welcomeChoose').addEventListener('click', () => go('activites', true));
  $('#welcomeStart').addEventListener('click', () => startFirstCalm());
  $('#welcomePaste').addEventListener('click', pasteTown);
  $('#installCard').addEventListener('click', e => {
    const act = e.target.closest('button[data-act]')?.dataset.act;
    if (act === 'copy') copyTown();
    else if (act === 'install') installApp();
    else if (act === 'hide') hideShelter();
  });
}
