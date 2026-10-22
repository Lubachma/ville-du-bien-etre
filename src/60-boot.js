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
  $('#harmonyBtn').addEventListener('click', openHarmonySheet);
  $('#ambienceBtn').addEventListener('click', openAmbienceSheet);
  $('#buildBtn').addEventListener('click', openShop);
  $('#buildBtn').dataset.focusKey = 'shop:open';
  $('#ctaStart').addEventListener('click', () => go('activites', true));
  $('#ctaDraw').addEventListener('click', () => go('tirage', true));
  $('#placeCancel').addEventListener('click', () => Mode.cancel());
  $('#placeConfirm').addEventListener('click', () => Mode.confirm());
  $('#backdrop').addEventListener('click', closeSheet);
  $('#sheetClose').addEventListener('click', closeSheet);
  bindShare();
  document.addEventListener('keydown', e => { if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Enter') kbdMode = true; }, true);
  document.addEventListener('pointerdown', () => { kbdMode = false; }, true);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('#sheet').hidden) closeSheet();
    else if (City.bigState().open) City.closeBig();
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
  // Un formulaire envoyé a vidé son champ : l'onglet en retard qui attendait cette saisie se recharge, s'il est alors au repos.
  document.addEventListener('submit', () => setTimeout(reloadWhenIdle, 0));
  for (const b of $$('#poolSeg button')) b.addEventListener('click', () => { if (S.draw.pool !== b.dataset.pool) { S.draw.pool = b.dataset.pool; commit(); } });
  $('#strictBtn').addEventListener('click', openStrict);
  twoStep($('#abandonBtn'), () => t('session.abandon'), () => t('session.abandonConfirm'), abandon);

  // Présence pendant une session + resynchronisation au retour
  document.addEventListener('visibilitychange', () => {
    updatePresence();
    // En arrière-plan, l'état est enregistré, puis un onglet resté sur l'ancienne version se recharge (hors séance).
    if (document.visibilityState === 'hidden') { Store.flush(); reloadWhenIdle(); }
    // Un onglet ouvert en arrière-plan : le bilan dû s'ouvre quand il devient visible. Le son d'une séance, interrompu entre-temps, est relancé.
    else { Store.pull(); checkActive(); refreshDay(); City.wake(); maybeOpenRitual(); resumeSound(); }
  });
  // Chaque minute : la date, la légende (moment et météo) et la lumière et l'horloge d'une ville immobile.
  setInterval(() => {
    refreshDay();
    if (document.visibilityState !== 'visible') return;
    if (currentTab === 'ville' || City.bigState().open) { renderCityCaption(); City.draw(); }
  }, 60000);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.addEventListener) motion.addEventListener('change', () => City.wake());
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
  window.addEventListener('ville:pwa', () => { renderPwaStatus(); reloadWhenIdle(); });
  bindEvents();
  City.layout();
  // Ville d'avant la mise à jour : ses succès et ses ensembles déjà mérités, datés, avant le premier affichage de la Ville
  // (qui note la saison et les donnerait sinon à la date du jour). Leur message rejoint celui d'une fête, ou s'affiche seul.
  catchUpCarnet({ defer: true });
  renderAll();
  flushCarnetNote();
  // Lien de ville amie (#ville=…) : sa visite, avant tout bilan (qui attend alors la prochaine ouverture).
  handleVisitHash();
  // Début de semaine ou de mois : son bilan, une seule fois.
  maybeOpenRitual();
  const hotRun = hotData && hotData.run;
  if (S.active && hotRun && hotRun.id === S.active.id) startSession(null, hotRun);
  else checkActive();
  Store.connect();
  try {
    const hot = window.claude && window.claude.hot;
    if (hot && typeof hot.snapshot === 'function') hot.snapshot(() => (run && !run.ended ? { run: { id: run.id, elapsed: run.elapsed, exits: run.exits } } : {}));
  } catch (e) { /* pas de rechargement à chaud ici */ }
  if (window.__VILLE_DEBUG__ || location.hash === '#debug') window.__ville = { get state() { return S; }, Store, activeState, City, renderAll, log: [],
    ambient: { at: () => ambientAt(), force: f => { ambientForce = f; City.draw(); }, sky: skyColors, imageSky: () => imageSky() },
    rituals: { challenges: () => weekChallenges(), pending: () => pendingRitual(), recapCanvas: (kind, key) => recapCanvas(recapSummary(kind, key)) },
    png: { canvas: () => cityImageCanvas() },
    share: { encode: () => encodeCity(), decode: decodeCity, open: openVisitFromCode, pending: () => pendingVisit },
    harmony: { criteria: () => harmonyCriteria(), wish: () => S.townWish, stars: () => starsEarned() },
    ambience: { kind: () => Ambience.kind, measure: (kind, volume) => Ambience.measure(kind, volume), open: () => openAmbienceSheet() },
    companion: { state: () => S.companion, name: () => companionName(), level: () => companionLevel(), word: day => companionWord(day), spot: () => City.companionSpot(), box: () => City.companionBox(), session: () => sessionCompanionState(), bounds: (look, size) => companionBounds(look, size), paint: (cv, look, size, opts) => paintCompanion(cv, look, size, opts) } };
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
