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
  $('#app').inert = sheetOpen || sessOpen;
  $('#session').inert = sheetOpen;
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
}
function announce(msg) {
  const live = $('#live');
  live.textContent = '';
  setTimeout(() => { live.textContent = frTypo(msg); }, 40);
}
let toastTimer = 0;
function toast(msg, action) {
  const t = $('#toast');
  t.replaceChildren(h('span', {}, msg));
  if (action) t.append(h('button', { class: 'toast-btn', type: 'button', onclick: () => { hideToast(); action.run(); } }, action.label));
  t.hidden = false;
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
  announce(msg);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 6000 : 2800);
}
function hideToast() { $('#toast').hidden = true; }
function bump() { const c = $('#balanceChip'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
function twoStep(btn, label, confirmLabel, action) {
  let armed = false, t = 0;
  const reset = () => { armed = false; btn.textContent = label; btn.classList.remove('btn-danger'); };
  btn.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      btn.textContent = confirmLabel;
      btn.classList.add('btn-danger');
      announce(confirmLabel + ' : touche encore pour confirmer.');
      t = setTimeout(reset, 4000);
      return;
    }
    clearTimeout(t);
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
  toast('Supprimé : « ' + item.name + ' ».', { label: 'Annuler', run: () => {
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
function refreshDay() { if (today() !== renderedDay) renderAll(); }
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
  $('.brand-name').textContent = S.personal && S.personal.name ? S.personal.name : 'Ville du bien-être';
  $('#balance').textContent = fmt(S.coins);
  const st = streak();
  $('#streak').textContent = st + NB + 'j';
  $('#streakChip').title = st ? 'Série : ' + plural(st, 'jour', 'jours') + " d'affilée" : 'Aucune série en cours';
}
function renderView(tab) {
  if (tab === 'ville') renderVille();
  else if (tab === 'activites') renderActivities();
  else if (tab === 'tirage') renderTirage();
  else if (tab === 'journal') renderJournal();
}

function renderVille() {
  const n = S.city.tiles.length, N = S.city.size;
  const parts = [plural(n, 'construction', 'constructions'), 'terrain ' + N + '×' + N];
  if (todayMinutes() > 0) parts.push("aujourd'hui : " + fmtMin(todayMinutes()));
  $('#cityCaption').textContent = frTypo(parts.join(' · '));
  const ew = $('#elsewhere');
  ew.replaceChildren();
  ew.hidden = activeState() !== 'elsewhere';
  if (!ew.hidden) {
    const a = S.active;
    ew.append(icon('timer'), h('div', { class: 'ew-main' },
      h('p', {}, 'Une session « ' + a.name + ' » est en cours sur un autre écran.'),
      h('p', { class: 'note' }, 'Tu pourras en lancer une autre quand elle sera terminée. Si cet écran a été fermé, la session sera récupérée automatiquement.')));
  }
  renderRemind();
  const card = $('#nextCard');
  card.replaceChildren();
  const nu = nextUnlock();
  const affordable = Object.keys(ITEMS).filter(k => !lockInfo(k) && ITEMS[k].group !== 'decor' && priceOf(k) <= S.coins && !ownedCount(k));
  const box = h('div', { class: 'next-main' });
  if (affordable.length) {
    const k = affordable.sort((a, b) => priceOf(b) - priceOf(a))[0];
    box.append(h('p', {}, 'Tu as assez pour : ', h('strong', {}, ITEMS[k].name), ' (' + fmt(priceOf(k)) + ').'));
  }
  if (nu) {
    const pct = clamp(nu.l.have / nu.l.need * 100, 0, 100);
    const what = nu.l.need === 1 ? 'après ta première session ' + CATS[nu.l.cat].name
      : 'encore ' + fmtMin(nu.rem) + ' ' + (nu.l.cat ? CATS[nu.l.cat].de : "d'activités");
    box.append(h('p', {}, 'Prochain déblocage : ', h('strong', {}, ITEMS[nu.key].name), ', ' + what + '.'));
    if (nu.l.need > 1) box.append(h('div', { class: 'meter', vars: { '--c': nu.l.cat ? catVar(nu.l.cat) : 'var(--cat-prestige)' }, role: 'progressbar', 'aria-label': 'Progression vers ' + ITEMS[nu.key].name, 'aria-valuemin': '0', 'aria-valuemax': String(nu.l.need), 'aria-valuenow': String(Math.round(nu.l.have)) }, h('span', { style: 'width:' + pct + '%' })));
  } else {
    box.append(h('p', {}, 'Tous les bâtiments sont débloqués. Bravo !'));
  }
  card.append(icon('sparkle'), box);
  box.append(h('button', { class: 'btn btn-ghost btn-sm goal-choice', type: 'button', onclick: openGoals }, 'Choisir mon objectif'));
  const list = $('#cityList');
  list.replaceChildren(...[...S.city.tiles].sort((a, b) => a.y - b.y || a.x - b.x).map(t =>
    h('li', {}, h('button', { type: 'button', onclick: () => openBuildingSheet(t) }, ITEMS[t.item].name + ', case ' + (t.x + 1) + ', ' + (t.y + 1) + (buildingLevel(t.item) > 1 ? ' · niveau ' + buildingLevel(t.item) : '')))));
}

