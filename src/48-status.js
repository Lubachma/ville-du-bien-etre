let storageStatusSignature = '';
function downloadText(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = h('a', { href: url, download: name, hidden: true });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function renderStorageStatus() {
  const banner = $('#storageStatus');
  if (!banner) return;
  const migrating = !!Store.migrationPending;
  for (const view of $$('.view')) view.inert = migrating;
  $('.tabbar').inert = migrating;
  $('#settingsBtn').disabled = migrating;
  const error = Store.localError || '', warning = Store.localWarning || '';
  const signature = error + '|' + warning + '|' + !!Store.recoveryRaw + '|' + migrating + '|' + Store.migrationReason;
  if (signature === storageStatusSignature) return;
  storageStatusSignature = signature;
  banner.hidden = !error && !warning;
  banner.replaceChildren();
  if (banner.hidden) return;
  const actions = h('div', { class: 'status-actions' });
  actions.append(h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: saveBackupFile }, 'Exporter ma progression'));
  if (Store.recoveryRaw) actions.append(h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => {
    downloadText(Store.recoveryRaw, 'ville-donnees-a-recuperer-' + today() + '.txt');
    toast('Copie des données originales préparée. Conserve ce fichier pour une récupération.');
  } }, 'Conserver les données originales'));
  if (error) actions.append(h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => {
    const saved = Store.migrationPending ? Store.retryMigration() : Store.repairLocal();
    renderStorageStatus(); renderSyncStatus();
    toast(saved ? 'La progression actuelle est maintenant enregistrée.' : Store.migrationPending && Store.migrationReason === 'session' ? 'Termine ou abandonne la session dans l’ancienne fenêtre, puis réessaie.' : Store.migrationPending ? 'Libère de l’espace ou réactive le stockage puis réessaie. Tu peux aussi exporter ta progression.' : "L'enregistrement reste impossible. Exporte ta progression avant de fermer.");
  } }, migrating ? Store.migrationReason === 'session' ? 'Reprendre après la session' : 'Réessayer la copie' : "Réessayer l'enregistrement"));
  banner.append(h('strong', {}, error ? 'Ta progression doit être protégée' : 'Données récupérées'), h('p', { class: 'note' }, error || warning), actions);
}

function pwaText() {
  const pwa = window.VillePWA;
  if (!pwa || pwa.state === 'loading') return 'Préparation du mode hors connexion…';
  if (pwa.state === 'ready') return 'Disponible hors connexion' + (pwa.version ? ' · version ' + pwa.version : '') + '.';
  if (pwa.state === 'error') return "Le mode hors connexion n'a pas pu être préparé. Vérifie ta connexion puis rouvre l'app.";
  return "Pour l'installation et le mode hors connexion, ouvre le lien HTTPS de l'app dans ton navigateur.";
}
function renderPwaStatus() {
  const status = $('#pwaStatus');
  if (status) status.textContent = pwaText();
  const banner = $('#updateNotice');
  if (!banner) return;
  const pwa = window.VillePWA;
  banner.hidden = !pwa || !pwa.update;
  banner.replaceChildren();
  if (banner.hidden) return;
  banner.append(h('strong', {}, 'Une nouvelle version est prête'),
    h('p', { class: 'note' }, S.active ? 'Tu pourras la charger après ta session.' : 'Ta progression sera conservée.'),
    h('button', { class: 'btn btn-secondary btn-sm', type: 'button', disabled: !!S.active, onclick: () => {
      if (S.active || run) { toast('Termine ta session avant de mettre à jour.'); return; }
      pwa.activate();
    } }, 'Mettre à jour'));
}

function openHelp() {
  openSheet('Bien démarrer', body => {
    body.append(
      h('p', {}, 'Choisis une activité, prends un moment pour toi, puis utilise tes pièces pour construire ta ville.'),
      h('div', { class: 'setting' }, h('h3', {}, 'Deux façons de pratiquer'),
        h('p', { class: 'note' }, 'Concentration : garde cette app affichée pendant le chrono. Activité libre : tu peux verrouiller le téléphone ou utiliser une autre app. Le bilan apparaît à ton retour.')),
      h('div', { class: 'setting' }, h('h3', {}, 'Installer sur ton téléphone'),
        h('p', { class: 'note' }, 'iPhone : ouvre le lien dans Safari, puis Partager → Sur l’écran d’accueil → Ajouter. Android : ouvre le menu de Chrome, puis Installer l’application ou Ajouter à l’écran d’accueil. Les libellés peuvent varier.'),
        h('p', { class: 'note' }, 'Installe l’app avant de commencer. Si ta ville est déjà dans un autre navigateur, exporte-la puis restaure-la dans l’app installée.')),
      h('div', { class: 'setting' }, h('h3', {}, 'Ta ville reste personnelle'),
        h('p', { class: 'note' }, 'Sur ce site, chaque personne a sa propre ville, enregistrée sur son appareil. Elle ne se synchronise pas entre téléphones. Effacer les données du navigateur peut la supprimer : garde une copie dans Réglages → Sauvegarde.')),
      h('div', { class: 'setting' }, h('h3', {}, 'Hors connexion'),
        h('p', { class: 'note' }, pwaText()),
        h('p', { class: 'note' }, 'En activité libre, le téléphone peut suspendre la page : le chrono est retrouvé à ton retour, mais le son de fin n’est pas garanti quand l’app est fermée.'))
    );
  });
}
