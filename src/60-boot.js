/* =========================================================================
   Événements et démarrage
   ========================================================================= */
function catOptions(sel) { return CAT_ORDER.map(c => h('option', { value: c, selected: c === sel ? true : null }, catName(c) + ' (' + catHint(c) + ')')); }
// Durées proposées, plus la durée actuelle si elle n'en fait pas partie (sauvegarde ancienne).
function minOptions(sel) {
  const durs = !sel || DURATIONS.includes(sel) ? DURATIONS : [...DURATIONS, sel].sort((a, b) => a - b);
  return durs.map(d => h('option', { value: String(d), selected: d === sel ? true : null }, d + NB + 'min'));
}
function fillSelects() {
  $('#actCat').replaceChildren(...catOptions());
  $('#actMin').replaceChildren(...minOptions(15));
  for (const f of [$('#addWish'), $('#addChore')]) {
    f.elements.cat.replaceChildren(...catOptions());
    f.elements.min.replaceChildren(...minOptions(15));
  }
}
let bound = false;
let kbdMode = false;
function bindEvents() {
  if (bound) return;
  bound = true;
  for (const tab of $$('.tab')) tab.addEventListener('click', () => { if (Mode.state && tab.dataset.tab !== 'ville') Mode.cancel(); go(tab.dataset.tab); });
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#personalizeCity').addEventListener('click', openCityPersonalization);
  $('#buildBtn').addEventListener('click', openShop);
  $('#ctaStart').addEventListener('click', () => go('activites', true));
  $('#ctaDraw').addEventListener('click', () => go('tirage', true));
  $('#placeCancel').addEventListener('click', () => Mode.cancel());
  $('#placeConfirm').addEventListener('click', () => Mode.confirm());
  $('#backdrop').addEventListener('click', closeSheet);
  $('#sheetClose').addEventListener('click', closeSheet);
  document.addEventListener('keydown', e => { if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Enter') kbdMode = true; }, true);
  document.addEventListener('pointerdown', () => { kbdMode = false; }, true);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('#sheet').hidden) closeSheet();
    else if (Mode.state) Mode.cancel();
  });
  $('#editActs').addEventListener('click', () => { editingActs = !editingActs; renderActivities(); });
  $('#addActForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#actName').value.trim().slice(0, 40);
    if (!name) return;
    if (S.activities.length >= LIST_MAX) { toast(t('act.listFull', { max: LIST_MAX })); return; }
    S.activities.push(Object.assign({ id: uid(), name, cat: $('#actCat').value, min: Number($('#actMin').value) }, readActivityFields($('#addActForm'))));
    $('#actName').value = '';
    commit();
    toast(t('act.added'));
  });
  for (const f of [$('#addWish'), $('#addChore')]) {
    f.addEventListener('submit', e => {
      e.preventDefault();
      const name = f.elements.name.value.trim().slice(0, 40);
      if (!name) return;
      const key = f.dataset.list;
      if (S[key].length >= LIST_MAX) { toast(t('draw.listFull', { max: LIST_MAX })); return; }
      S[key].push(Object.assign({ id: uid(), name, cat: f.elements.cat.value, min: Number(f.elements.min.value) }, readActivityFields(f)));
      f.elements.name.value = '';
      commit();
      toast(t('draw.added'));
    });
  }
  for (const b of $$('#poolSeg button')) b.addEventListener('click', () => { if (S.draw.pool !== b.dataset.pool) { S.draw.pool = b.dataset.pool; commit(); } });
  $('#strictBtn').addEventListener('click', openStrict);
  twoStep($('#abandonBtn'), () => t('session.abandon'), () => t('session.abandonConfirm'), abandon);

  // Présence pendant une session + resynchronisation au retour
  document.addEventListener('visibilitychange', () => {
    updatePresence();
    if (document.visibilityState === 'hidden') Store.flush();
    else { Store.pull(); checkActive(); refreshDay(); }
  });
  setInterval(refreshDay, 60000);
  window.addEventListener('blur', e => { if (e.target === window) updatePresence(); });
  window.addEventListener('focus', e => { if (e.target === window) { updatePresence(); Store.pull(); } });
  // Page fermée ou rechargée : la session ne peut plus finir, inutile de la faire attendre ailleurs.
  window.addEventListener('pagehide', e => { onLeave(); if (!e.persisted && run) clearBeat(); });
  window.addEventListener('pageshow', () => updatePresence());
  window.addEventListener('storage', e => {
    if (e.key === LS_KEY) Store.pullLocal();
    else if (e.key === LEGACY_LS_KEY && Store.migrationPending) Store.retryMigration();
    else if (e.key === LS_BEAT && !run) { if (currentTab === 'ville') renderVille(); }
  });

  let observedWidth = -1, resizeFrame = 0;
  const ro = new ResizeObserver(entries => {
    const width = entries[0].contentRect.width;
    if (width === observedWidth) return;
    observedWidth = width;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { if (currentTab === 'ville') City.relayout(); });
  });
  ro.observe($('#sky'));
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const redraw = () => City.draw();
  if (mq.addEventListener) mq.addEventListener('change', redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => City.relayout());
}

function boot(hotData) {
  // Une ville neuve reçoit ses exemples dans la langue du téléphone, puis la ville choisit.
  setLang('auto');
  Store.init();
  setLang(S.settings.lang);
  applyStaticText();
  fillSelects();
  enhanceActivityForms();
  setupAccessibility();
  window.addEventListener('ville:pwa', renderPwaStatus);
  bindEvents();
  City.layout();
  renderAll();
  const hotRun = hotData && hotData.run;
  if (S.active && hotRun && hotRun.id === S.active.id) startSession(null, hotRun);
  else checkActive();
  Store.connect();
  try {
    const hot = window.claude && window.claude.hot;
    if (hot && typeof hot.snapshot === 'function') hot.snapshot(() => (run && !run.ended ? { run: { id: run.id, elapsed: run.elapsed, exits: run.exits } } : {}));
  } catch (e) { /* pas de rechargement à chaud ici */ }
  if (window.__VILLE_DEBUG__ || location.hash === '#debug') window.__ville = { get state() { return S; }, Store, activeState, log: [] };
}

let booted = false;
function bootOnce(data) {
  if (booted) return;
  booted = true;
  boot(data || {});
}
try {
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.ready === 'function') hot.ready(bootOnce);
  else bootOnce((hot && hot.data) || {});
} catch (e) {
  bootOnce({});
}
setTimeout(() => bootOnce({}), 1500);
