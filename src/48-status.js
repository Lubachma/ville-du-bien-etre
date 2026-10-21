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
  actions.append(h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: saveBackupFile }, t('storage.export')));
  if (Store.recoveryRaw) actions.append(h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => {
    downloadText(Store.recoveryRaw, 'ville-donnees-a-recuperer-' + today() + '.txt');
    toast(t('storage.rawSaved'));
  } }, t('storage.keepRaw')));
  if (error) actions.append(h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => {
    const saved = Store.migrationPending ? Store.retryMigration() : Store.repairLocal();
    renderStorageStatus(); renderSyncStatus();
    toast(saved ? t('storage.repaired') : Store.migrationPending && Store.migrationReason === 'session' ? t('storage.retryAfterSession') : Store.migrationPending ? t('storage.retryNoSpace') : t('storage.stillFailing'));
  } }, migrating ? Store.migrationReason === 'session' ? t('storage.resumeAfterSession') : t('storage.retryCopy') : t('storage.retrySave')));
  banner.append(h('strong', {}, error ? t('storage.protectTitle') : t('storage.recoveredTitle')), h('p', { class: 'note' }, error || warning), actions);
}

function pwaText() {
  const pwa = window.VillePWA;
  if (!pwa || pwa.state === 'loading') return t('pwa.loading');
  if (pwa.state === 'ready') return pwa.version ? t('pwa.readyVersion', { version: pwa.version }) : t('pwa.ready');
  if (pwa.state === 'error') return t('pwa.error');
  return t('pwa.unavailable');
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
  banner.append(h('strong', {}, t('pwa.updateTitle')),
    h('p', { class: 'note' }, S.active ? t('pwa.updateAfterSession') : t('pwa.updateKeeps')),
    h('button', { class: 'btn btn-secondary btn-sm', type: 'button', disabled: !!S.active, onclick: () => {
      if (S.active || run) { toast(t('pwa.updateFinishSession')); return; }
      pwa.activate();
    } }, t('pwa.updateButton')));
}
// Un onglet resté sur l'ancienne version (la mise à jour a été acceptée dans un autre onglet) se recharge de lui-même dès qu'il est au repos.
// Une séance qui tourne ou démarre ici le retient. Page visible, il attend aussi qu'il n'y ait plus ni fenêtre, ni écran de séance, ni vue en
// grand (donc ni visite d'une ville amie), ni pose ; en arrière-plan, seule la séance le retient. Le bandeau « Mettre à jour » reste affiché.
function reloadWhenIdle() {
  const pwa = window.VillePWA;
  if (!pwa || !pwa.reloadAvailable || pwa.reloading) return;
  if (run || beginning) return;
  if (document.visibilityState === 'visible' && ['#sheet', '#session', '#cityBig', '#placebar'].some(selector => !$(selector).hidden)) return;
  pwa.activate();
}

function openHelp() {
  openSheet(t('help.title'), body => {
    body.append(
      h('p', {}, t('help.intro')),
      h('div', { class: 'setting' }, h('h3', {}, t('help.modesTitle')),
        h('p', { class: 'note' }, t('help.modesText'))),
      h('div', { class: 'setting' }, h('h3', {}, t('help.installTitle')),
        h('p', { class: 'note' }, t('help.installText')),
        h('p', { class: 'note' }, t('help.installFirst'))),
      h('div', { class: 'setting' }, h('h3', {}, t('help.personalTitle')),
        h('p', { class: 'note' }, t('help.personalText'))),
      h('div', { class: 'setting' }, h('h3', {}, t('help.offlineTitle')),
        h('p', { class: 'note' }, pwaText()),
        h('p', { class: 'note' }, t('help.offlineText')))
    );
  });
}
