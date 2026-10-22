/* =========================================================================
   Navigation, fenêtres, annonces
   ========================================================================= */
let currentTab = 'ville';
function go(tab, focusDestination = false) {
  const origin = document.activeElement;
  hideToast(true);
  currentTab = tab;
  for (const v of $$('.view')) v.hidden = v.id !== 'view-' + tab;
  for (const t of $$('.tab')) { if (t.dataset.tab === tab) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); }
  $('#main').scrollTop = 0;
  renderView(tab);
  if (focusDestination || origin && origin.closest('.view') && origin.closest('.view').hidden) focusViewHeading();
  if (tab === 'ville') requestAnimationFrame(() => City.relayout());
}

/* Focus : un élément redessiné porte la même clé que celui qu'il remplace (data-focus-key="nom:id"). Le focus parti avec l'ancien va
   au nouveau, sinon au titre de la vue : jamais sur body. */
const focusKeyOf = el => (el && el.dataset && el.dataset.focusKey) || null;
// Peut prendre le focus : dans la page, affiché, hors [inert].
const focusable = el => !!el && el !== document.body && el.isConnected && typeof el.focus === 'function' && !el.closest('[inert]') && el.getClientRects().length > 0;
// Met le focus sur el s'il peut le prendre ; vrai s'il l'a (un bouton désactivé le refuse). scroll : montré s'il est hors de vue.
function tryFocus(el, scroll = false) {
  if (!focusable(el)) return false;
  el.focus({ preventScroll: !scroll });
  return document.activeElement === el;
}
// Le premier élément de cette clé qui peut prendre le focus le reçoit ; vrai s'il l'a. La page ne défile pas : un remplaçant est à la
// place de l'ancien, et un rendu de fond ne doit pas ramener la page à lui. scroll : pour un geste de la personne dont la cible peut
// être hors de vue (le voisin d'un élément supprimé, l'élément revenu par « Annuler », la carte postale d'où l'on revient).
function focusByKey(key, { scroll = false } = {}) {
  return !!key && $$('[data-focus-key]').some(el => el.dataset.focusKey === key && tryFocus(el, scroll));
}
// Le titre de la vue affichée (la Ville n'en a pas : la vue elle-même).
function focusViewHeading() {
  const heading = $('#view-' + currentTab + ' h2') || $('#view-' + currentTab);
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}
// Une fenêtre, l'écran de séance et la vue en grand ont leur propre focus.
const LAYERS = '#sheet, #session, #cityBig';
const layerOpen = () => $$(LAYERS).some(el => !el.hidden);
// Après un dessin : le focus perdu en route (élément retiré ou caché, focus retombé sur body) va au remplaçant de même clé, sans faire
// défiler la page, sinon au titre de la vue quand rien ne la couvre. Rien ne bouge pour un focus qui était, ou qui est, dans une
// fenêtre, l'écran de séance ou la vue en grand, ni pour un focus déjà sur body avant le dessin : rien n'avait le focus.
function keepFocus(before, key) {
  if (!before || before === document.body || before.closest(LAYERS)) return;
  const now = document.activeElement;
  if (now && now !== document.body && (now !== before || focusable(before))) return;
  if (!focusByKey(key) && !layerOpen()) focusViewHeading();
}

function updateInert() {
  const sheetOpen = !$('#sheet').hidden;
  const sessOpen = !$('#session').hidden;
  const bigOpen = !$('#cityBig').hidden;
  $('#app').inert = sheetOpen || sessOpen || bigOpen;
  $('#session').inert = sheetOpen;
  $('#cityBig').inert = sheetOpen || sessOpen;
  // Le message qui reste (« Annuler » après une suppression) ne couvre pas la séance ni la vue en grand, qui s'ouvrent sans passer par
  // go() ni par openSheet() (le « Lancer » d'une routine, par exemple).
  if (sessOpen || bigOpen) hideToast(true);
}
let sheetOnClose = null, sheetOpener = null, sheetKeepOnSync = false;
function openSheet(title, build, opts = {}) {
  hideToast(true);
  if ($('#sheet').hidden) sheetOpener = document.activeElement;
  // Une fenêtre qui en remplace une autre : ce que l'ancienne devait faire à sa fermeture est fait d'abord (son indicateur retiré…).
  else if (sheetOnClose) { const cb = sheetOnClose; sheetOnClose = null; cb(); }
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
  // Le titre prend le focus, sauf si un élément de la fenêtre l'a pris entre-temps : un champ refusé à l'envoi, mis en avant dans ces
  // 30 ms, ou la carte postale du carnet rouvert au retour d'une visite.
  setTimeout(() => { if (!body.contains(document.activeElement)) $('#sheetTitle').focus({ preventScroll: true }); }, 30);
}
function closeSheet() {
  if ($('#sheet').hidden) return;
  $('#backdrop').hidden = true;
  $('#sheet').hidden = true;
  updateInert();
  const cb = sheetOnClose, op = sheetOpener;
  sheetOnClose = null; sheetOpener = null; sheetKeepOnSync = false;
  if (cb) cb();
  // Le focus revient à ce qui a ouvert la fenêtre ; redessiné entre-temps (la carte du carnet, refaite à sa fermeture), à son remplaçant
  // de même clé ; sinon au titre de la vue, si rien d'autre n'est ouvert.
  if (!tryFocus(op) && !focusByKey(focusKeyOf(op)) && !layerOpen()) focusViewHeading();
  City.wake();
  // Un onglet en retard se recharge juste après ce que le même geste lance ensuite (une autre fenêtre, une séance), s'il est alors au repos.
  if (typeof reloadWhenIdle === 'function') setTimeout(reloadWhenIdle, 0);
}
function announce(msg) {
  const live = $('#live');
  live.textContent = '';
  setTimeout(() => { live.textContent = frTypo(msg); }, 40);
}
// Le message affiché : son minuteur, sa durée en ms (0 : il reste), et ce qui le retient (souris, focus ; null s'il ne peut pas l'être).
let toastTimer = 0, toastMs = 0, toastHeld = null;
// « spoken » : ce que les lecteurs d'écran entendent, quand il dit plus que le message affiché.
// opts.keep : aucun minuteur, le message reste jusqu'au prochain message, à go() ou à openSheet() (« Annuler » après une suppression).
// Sinon il dure 6 s avec une action, 2,8 s sans ; un message avec action ne se ferme pas tant qu'il a le focus ou la souris, et ses 6 s
// repartent quand les deux l'ont quitté.
function toast(msg, action, spoken = msg, opts = {}) {
  const t = $('#toast');
  t.replaceChildren(h('span', {}, msg));
  if (action) t.append(h('button', { class: 'toast-btn', type: 'button', onclick: () => { hideToast(); action.run(); } }, action.label));
  t.hidden = false;
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
  announce(spoken);
  toastMs = opts.keep ? 0 : action ? 6000 : 2800;
  toastHeld = action && !opts.keep ? { mouse: false, focus: false } : null;
  armToast();
}
function armToast() {
  clearTimeout(toastTimer);
  if (toastMs) toastTimer = setTimeout(hideToast, toastMs);
}
// La souris ou le focus arrive sur le message (on) ou le quitte : le minuteur s'arrête tant que l'un des deux y est, puis repart de zéro.
function holdToast(by, on) {
  if (!toastHeld || toastHeld[by] === on) return;
  toastHeld[by] = on;
  clearTimeout(toastTimer);
  if (!toastHeld.mouse && !toastHeld.focus) armToast();
}
$('#toast').addEventListener('mouseenter', () => holdToast('mouse', true));
$('#toast').addEventListener('mouseleave', () => holdToast('mouse', false));
$('#toast').addEventListener('focusin', () => holdToast('focus', true));
$('#toast').addEventListener('focusout', () => holdToast('focus', false));
// keptOnly : go(), openSheet() et l'ouverture d'une séance ne ferment que le message qui reste ; les autres gardent leur minuteur (« Un
// nouveau jour commence », écrit juste avant que la fiche du visiteur ne se rouvre, doit encore se voir).
function hideToast(keptOnly = false) {
  if (keptOnly && toastMs) return;
  clearTimeout(toastTimer);
  toastHeld = null;
  $('#toast').hidden = true;
}
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
// Bouton de suppression de chaque liste (renderActivities, renderList) : celui du voisin reprend le focus.
const DELETE_KEYS = { activities: 'act-del', wishes: 'task-del', chores: 'task-del' };
function removeWithUndo(key, id) {
  const idx = S[key].findIndex(x => x.id === id);
  if (idx < 0) return;
  // Le voisin qui prendra le focus, noté avant la suppression : le suivant, sinon le précédent.
  const near = S[key][idx + 1] || S[key][idx - 1], del = DELETE_KEYS[key];
  const [item] = S[key].splice(idx, 1);
  commit();
  if (!focusByKey(near && del && del + ':' + near.id, { scroll: true }) && !layerOpen()) focusViewHeading();
  // Le message reste jusqu'à l'action suivante, et l'annonce dit qu'on peut annuler.
  const name = displayName(item.name);
  toast(t('ui.deleted', { name }), { label: t('common.undo'), run: () => {
    if (S[key].some(x => x.id === item.id)) return;
    S[key].splice(Math.min(idx, S[key].length), 0, item);
    commit();
    // Revenu, il reprend le focus sur son bouton de suppression.
    if (del) focusByKey(del + ':' + item.id, { scroll: true });
  } }, t('ui.deletedUndo', { name }), { keep: true });
}

/* =========================================================================
   Rendu des vues
   ========================================================================= */
// Jour pour lequel l'écran a été dessiné : série, minutes du jour et graphique changent à minuit.
let renderedDay = '';
function renderAll() {
  // Le focus d'avant le dessin et sa clé : redessiné, il passe au remplaçant (keepFocus).
  const before = document.activeElement, key = focusKeyOf(before);
  renderedDay = today();
  applyTheme();
  renderHeader();
  renderStorageStatus();
  renderPwaStatus();
  renderView(currentTab);
  Mode.render();
  if (currentTab === 'ville') City.draw();
  keepFocus(before, key);
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
  box.append(h('button', { class: 'btn btn-ghost btn-sm goal-choice', type: 'button', 'data-focus-key': 'goals:edit', onclick: openGoals }, t('goal.choose')));
  const list = $('#cityList'), amb = typeof ambientAt === 'function' ? ambientAt() : null;
  // En tête, le visiteur du jour : sa fiche s'ouvre aussi d'ici (clavier, lecteur d'écran). La liste est refaite à chaque rendu : ses
  // boutons ont une clé, pour y garder le focus.
  const visitorRow = amb && amb.visitor ? [h('li', {}, h('button', { type: 'button', 'data-focus-key': 'visitor:open', onclick: () => openVisitor() },
    t('city.listVisitor', { name: lowerFirst(t('visitor.' + amb.visitor.id + '.name')) })))] : [];
  list.replaceChildren(...visitorRow, ...[...S.city.tiles].sort((a, b) => a.y - b.y || a.x - b.x).map(tile => {
    const params = { item: itemName(tile.item), x: tile.x + 1, y: tile.y + 1, level: buildingLevel(tile.item) };
    const label = isWonder(tile.item) ? t('city.listItemStage', { ...params, stage: tile.stage || 1 }) : params.level > 1 ? t('city.listItemLevel', params) : t('city.listItem', params);
    return h('li', {}, h('button', { type: 'button', 'data-focus-key': 'tile:' + tile.id, onclick: () => openBuildingSheet(tile) }, label));
  }));
}

