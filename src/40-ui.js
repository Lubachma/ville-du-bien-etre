/* =========================================================================
   Navigation, fenêtres, annonces
   ========================================================================= */
let currentTab = 'ville';
function go(tab, focusDestination = false) {
  const origin = document.activeElement;
  currentTab = tab;
  for (const v of $$('.view')) v.hidden = v.id !== 'view-' + tab;
  for (const t of $$('.tab')) { if (t.dataset.tab === tab) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); }
  $('#main').scrollTop = 0;
  renderView(tab);
  if (focusDestination || origin && origin.closest('.view') && origin.closest('.view').hidden) {
    const heading = $('#view-' + tab + ' h2') || $('#view-' + tab);
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
  if (tab === 'ville') requestAnimationFrame(() => City.relayout());
}

function updateInert() {
  const sheetOpen = !$('#sheet').hidden;
  const sessOpen = !$('#session').hidden;
  const bigOpen = !$('#cityBig').hidden;
  $('#app').inert = sheetOpen || sessOpen || bigOpen;
  $('#session').inert = sheetOpen;
  $('#cityBig').inert = sheetOpen || sessOpen;
}
let sheetOnClose = null, sheetOpener = null, sheetKeepOnSync = false;
function openSheet(title, build, opts = {}) {
  if ($('#sheet').hidden) sheetOpener = document.activeElement;
  $('#sheetTitle').textContent = frTypo(title);
  const body = $('#sheetBody');
  body.replaceChildren();
  build(body);
  $('#backdrop').hidden = false;
  $('#sheet').hidden = false;
  sheetOnClose = opts.onClose || null;
  sheetKeepOnSync = !!opts.keep;
  body.scrollTop = 0;
  updateInert();
  setTimeout(() => $('#sheetTitle').focus({ preventScroll: true }), 30);
}
function closeSheet() {
  if ($('#sheet').hidden) return;
  $('#backdrop').hidden = true;
  $('#sheet').hidden = true;
  updateInert();
  const cb = sheetOnClose, op = sheetOpener;
  sheetOnClose = null; sheetOpener = null; sheetKeepOnSync = false;
  if (cb) cb();
  if (op && op.isConnected && typeof op.focus === 'function' && !op.closest('[inert]')) op.focus({ preventScroll: true });
  City.wake();
  // Un onglet en retard se recharge juste après ce que le même geste lance ensuite (une autre fenêtre, une séance), s'il est alors au repos.
  if (typeof reloadWhenIdle === 'function') setTimeout(reloadWhenIdle, 0);
}
function announce(msg) {
  const live = $('#live');
  live.textContent = '';
  setTimeout(() => { live.textContent = frTypo(msg); }, 40);
}
let toastTimer = 0;
// « spoken » : ce que les lecteurs d'écran entendent, quand il dit plus que le message affiché.
function toast(msg, action, spoken = msg) {
  const t = $('#toast');
  t.replaceChildren(h('span', {}, msg));
  if (action) t.append(h('button', { class: 'toast-btn', type: 'button', onclick: () => { hideToast(); action.run(); } }, action.label));
  t.hidden = false;
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
  announce(spoken);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 6000 : 2800);
}
function hideToast() { $('#toast').hidden = true; }
function bump() { const c = $('#balanceChip'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
// Les libellés peuvent être des fonctions : un bouton créé au démarrage suit alors la langue affichée.
function twoStep(btn, label, confirmLabel, action) {
  const text = value => (typeof value === 'function' ? value() : value);
  let armed = false, timer = 0;
  const reset = () => { armed = false; btn.textContent = text(label); btn.classList.remove('btn-danger'); };
  btn.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      btn.textContent = text(confirmLabel);
      btn.classList.add('btn-danger');
      announce(t('ui.confirmAgain', { action: text(confirmLabel) }));
      timer = setTimeout(reset, 4000);
      return;
    }
    clearTimeout(timer);
    reset();
    action();
  });
  return btn;
}
function removeWithUndo(key, id) {
  const idx = S[key].findIndex(x => x.id === id);
  if (idx < 0) return;
  const [item] = S[key].splice(idx, 1);
  commit();
  toast(t('ui.deleted', { name: displayName(item.name) }), { label: t('common.undo'), run: () => {
    if (S[key].some(x => x.id === item.id)) return;
    S[key].splice(Math.min(idx, S[key].length), 0, item);
    commit();
  } });
}

/* =========================================================================
   Rendu des vues
   ========================================================================= */
// Jour pour lequel l'écran a été dessiné : série, minutes du jour et graphique changent à minuit.
let renderedDay = '';
function renderAll() {
  renderedDay = today();
  applyTheme();
  renderHeader();
  renderStorageStatus();
  renderPwaStatus();
  renderView(currentTab);
  Mode.render();
  if (currentTab === 'ville') City.draw();
}
// Au retour dans l'app et chaque minute : on redessine si la date a changé depuis.
function refreshDay() {
  if (today() === renderedDay) return;
  renderAll();
  // Un nouveau jour peut ouvrir une nouvelle semaine ou un nouveau mois : son bilan, une fois.
  if (typeof maybeOpenRitual === 'function') maybeOpenRitual();
}
function applyTheme() {
  const root = document.documentElement;
  const want = S.settings.theme === 'light' || S.settings.theme === 'dark' ? S.settings.theme : '';
  if ((root.getAttribute('data-theme') || '') === want) return;
  if (want) root.setAttribute('data-theme', want); else root.removeAttribute('data-theme');
  for (const m of $$('meta[name="theme-color"]')) {
    const dark = want ? want === 'dark' : /dark/.test(m.getAttribute('media') || '');
    m.setAttribute('content', dark ? '#0f171b' : '#edf1e7');
  }
}
function renderHeader() {
  $('.brand-name').textContent = frTypo(cityName());
  $('#balance').textContent = fmtBalance(S.coins);
  const chip = $('#streakChip');
  chip.hidden = S.settings.hideStreak;
  if (chip.hidden) return;
  const st = streak(), pause = pauseActive();
  $('#streak').textContent = t('unit.streakDays', { n: st });
  $('use', chip).setAttribute('href', pause ? '#i-pause' : '#i-flame');
  chip.title = pause ? t('streak.pausedSince', { date: dayLabel(pause.from) }) : st ? t('header.streakTitle', { n: st }) : t('header.noStreak');
}
function renderView(tab) {
  if (tab === 'ville') renderVille();
  else if (tab === 'activites') renderActivities();
  else if (tab === 'tirage') renderTirage();
  else if (tab === 'journal') renderJournal();
}

// Légende de la ville : ce qui s'y passe (moment, météo, visiteur, fête), puis les constructions, le terrain et le temps du jour.
// Le moment et la météo changent dans la journée : le tic de la minute la refait aussi, comme la description de la vue en grand.
function renderCityCaption() {
  const n = S.city.tiles.length, N = S.city.size;
  const parts = [ambientCaption(ambientAt()), t('city.captionBuildings', { n }), t('city.captionLand', { size: N })];
  if (todayMinutes() > 0) parts.push(t('city.captionToday', { time: fmtMin(todayMinutes()) }));
  const text = frTypo(parts.join(' · '));
  $('#cityCaption').textContent = text;
  // En visite, la vue en grand décrit la ville amie.
  if (!$('#cityBig').hidden && $('#cityVisitHead').hidden) $('#cityBigCanvas').setAttribute('aria-label', text);
}
function renderVille() {
  // Saison vue et jour de fête (cadeau et message à la première ouverture, ou au passage de minuit l'appli ouverte).
  liveTick();
  renderCityCaption();
  if (typeof renderCompanionInvite === 'function') { renderCompanionInvite(); renderCompanionButton(); }
  if (typeof renderTownWishCard === 'function') renderTownWishCard();
  if (typeof renderHarmonyButton === 'function') renderHarmonyButton();
  const ew = $('#elsewhere');
  ew.replaceChildren();
  ew.hidden = activeState() !== 'elsewhere';
  if (!ew.hidden) {
    const a = S.active;
    ew.append(icon('timer'), h('div', { class: 'ew-main' },
      h('p', {}, t('city.elsewhere', { name: displayName(a.name) })),
      h('p', { class: 'note' }, t('city.elsewhereNote'))));
  }
  renderRemind();
  const card = $('#nextCard');
  card.replaceChildren();
  const nu = nextUnlock();
  const affordable = Object.keys(ITEMS).filter(k => !lockInfo(k) && ITEMS[k].group !== 'decor' && priceOf(k) <= S.coins && !ownedCount(k));
  const box = h('div', { class: 'next-main' });
  // Une étape de merveille prête et payable : la ville le dit aussi.
  const readyStage = S.city.tiles.filter(tile => isWonder(tile.item)).map(tile => [tile, wonderNext(tile)]).find(([, next]) => next && next.ready && next.affordable);
  if (affordable.length) {
    const k = affordable.sort((a, b) => priceOf(b) - priceOf(a))[0];
    box.append(h('p', {}, tParts('city.affordable', { item: h('strong', {}, itemName(k)), price: fmt(priceOf(k)) })));
  } else if (readyStage) {
    const [tile, next] = readyStage;
    box.append(h('p', {}, tParts('city.stageReady', { stage: next.stage, item: h('strong', {}, itemName(tile.item)), g: itemGender(tile.item) })));
  }
  if (nu) {
    const pct = clamp(nu.l.have / nu.l.need * 100, 0, 100);
    const params = { item: h('strong', {}, itemName(nu.key)), time: fmtMin(nu.rem), cat: nu.l.cat ? catName(nu.l.cat) : '', of: nu.l.cat ? catOf(nu.l.cat) : '', g: itemGender(nu.key) };
    box.append(h('p', {}, nu.stage ? tParts('city.nextStage', params) : nu.l.need === 1 ? tParts('city.nextFirst', params) : nu.l.cat ? tParts('city.nextCat', params) : tParts('city.nextTotal', params)));
    if (nu.l.need > 1) box.append(h('div', { class: 'meter', vars: { '--c': nu.l.cat ? catVar(nu.l.cat) : 'var(--cat-prestige)' }, role: 'progressbar', 'aria-label': t('city.progressTo', { item: itemName(nu.key) }), 'aria-valuemin': '0', 'aria-valuemax': String(nu.l.need), 'aria-valuenow': String(Math.round(nu.l.have)) }, h('span', { style: 'width:' + pct + '%' })));
  } else {
    box.append(h('p', {}, t('city.allUnlocked')));
  }
  card.append(icon('sparkle'), box);
  box.append(h('button', { class: 'btn btn-ghost btn-sm goal-choice', type: 'button', onclick: openGoals }, t('goal.choose')));
  const list = $('#cityList'), amb = typeof ambientAt === 'function' ? ambientAt() : null;
  // En tête, le visiteur du jour : sa fiche s'ouvre aussi d'ici (clavier, lecteur d'écran).
  const visitorRow = amb && amb.visitor ? [h('li', {}, h('button', { type: 'button', onclick: () => openVisitor() },
    t('city.listVisitor', { name: lowerFirst(t('visitor.' + amb.visitor.id + '.name')) })))] : [];
  list.replaceChildren(...visitorRow, ...[...S.city.tiles].sort((a, b) => a.y - b.y || a.x - b.x).map(tile => {
    const params = { item: itemName(tile.item), x: tile.x + 1, y: tile.y + 1, level: buildingLevel(tile.item) };
    const label = isWonder(tile.item) ? t('city.listItemStage', { ...params, stage: tile.stage || 1 }) : params.level > 1 ? t('city.listItemLevel', params) : t('city.listItem', params);
    return h('li', {}, h('button', { type: 'button', onclick: () => openBuildingSheet(tile) }, label));
  }));
}

