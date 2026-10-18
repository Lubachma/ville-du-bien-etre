/* ---------- Tirage contextualisé ---------- */
const ACT_DRAW_TIMES = [0, 5, 10, 15, 20, 30, 60, 180];
const drawEnergies = () => [['any', t('draw.energyAny')], ['low', t('draw.energyLow')], ['medium', t('draw.energyMedium')], ['high', t('draw.energyHigh')]];
let drawAnim = null;
let drawBusyUntil = 0;
function drawFilters() {
  const f = S.draw.filters || {};
  return {
    maxMin: ACT_DRAW_TIMES.includes(f.maxMin) ? f.maxMin : 0,
    energy: ['low', 'medium', 'high'].includes(f.energy) ? f.energy : 'any',
    place: ['inside', 'outside'].includes(f.place) ? f.place : 'any',
  };
}
function matchesDrawFilters(it, filters = drawFilters()) {
  if (filters.maxMin && it.min > filters.maxMin) return false;
  const levels = { low: 1, medium: 2, high: 3 };
  if (filters.energy !== 'any' && (levels[it.energy] || 2) > levels[filters.energy]) return false;
  return filters.place === 'any' || !it.place || it.place === 'any' || it.place === filters.place;
}
function poolItems(pool, at = nowTs()) {
  const w = S.wishes.map(x => Object.assign({}, x, { kind: 'wishes' }));
  const c = S.chores.map(x => Object.assign({}, x, { kind: 'chores' }));
  return (pool === 'wishes' ? w : pool === 'chores' ? c : w.concat(c))
    .filter(it => taskAvailable(it, at) && matchesDrawFilters(it));
}
function sameDrawItem(a, b) { return a.id === b.id && a.kind === b.kind; }
function drawAlternatives(items, current) { return current ? items.filter(item => !sameDrawItem(item, current)) : items; }
function currentDrawAvailable(cur) {
  const source = S[cur.kind] && S[cur.kind].find(item => item.id === cur.id);
  return !source || taskAvailable(source);
}
function rerollCost() { return S.draw.current ? Math.min(16, Math.pow(2, S.draw.rerolls)) * 1e6 : 0; }
function renderDrawFilters() {
  let root = $('#drawFilters');
  if (!root) {
    const field = (id, label, options) => h('div', { class: 'field' }, h('label', { for: id }, label),
      h('select', { class: 'select', id, onchange: () => {
        S.draw.filters = { maxMin: Number($('#drawMaxMin').value), energy: $('#drawEnergy').value, place: $('#drawPlace').value };
        commit();
        announce(S.draw.current ? t('draw.filtersSavedKeep') : t('draw.filtersUpdated'));
      } }, options));
    // Repliés par défaut : le bouton « Tirer au sort » reste visible sans faire défiler.
    root = h('details', { class: 'card draw-filters', id: 'drawFilters' },
      h('summary', {}, h('span', { class: 'draw-filter-head' },
        h('span', { class: 'draw-filter-title' }, t('draw.filtersTitle')),
        h('span', { class: 'draw-filter-summary', id: 'drawFilterSummary' }))),
      h('div', { class: 'draw-filter-body' },
        h('div', { class: 'draw-filter-fields' },
          field('drawMaxMin', t('draw.myTime'), ACT_DRAW_TIMES.map(m => h('option', { value: m }, m ? t('draw.maxMinutes', { n: m }) : t('draw.noLimit')))),
          field('drawEnergy', t('draw.myEnergy'), activityOptions(drawEnergies(), 'any')),
          field('drawPlace', t('draw.myPlace'), activityOptions(actPlaces(), 'any'))),
        h('div', { class: 'draw-filter-actions' }, h('span', { class: 'draw-filter-count', id: 'drawFilterCount', 'aria-live': 'polite' }),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => {
            S.draw.filters = { maxMin: 0, energy: 'any', place: 'any' }; commit(); announce(t('draw.filtersReset'));
          } }, t('draw.showAll'))),
        h('p', { class: 'note', id: 'drawFilterNote' })));
    $('#drawCard').before(root);
  }
  const f = drawFilters(), count = poolItems(S.draw.pool).length;
  $('#drawMaxMin').value = String(f.maxMin);
  $('#drawEnergy').value = f.energy;
  $('#drawPlace').value = f.place;
  const active = [f.maxMin ? t('draw.summaryMax', { n: f.maxMin }) : '',
    f.energy !== 'any' ? t('draw.summaryEnergy', { energy: drawEnergies().find(([value]) => value === f.energy)[1].toLowerCase() }) : '',
    f.place !== 'any' ? actPlaces().find(([value]) => value === f.place)[1].toLowerCase() : ''].filter(Boolean);
  $('#drawFilterSummary').textContent = frTypo((active.length ? active.join(' · ') : t('draw.summaryDefault')) + ' · ' + t('draw.ideas', { n: count }));
  $('#drawFilterCount').textContent = frTypo(t('draw.ideasAvailable', { n: count }));
  $('#drawFilterNote').textContent = frTypo(S.draw.current ? t('draw.filtersNoteCurrent') : t('draw.filtersNote', { min: DRAW_MIN_POOL }));
}
function renderTirage() {
  for (const b of $$('#poolSeg button')) b.setAttribute('aria-checked', String(b.dataset.pool === S.draw.pool));
  renderDrawFilters();
  renderDraw();
  renderList('wishes', $('#wishList'));
  renderList('chores', $('#choreList'));
}
function renderDraw() {
  if (drawAnim) return;
  const card = $('#drawCard');
  card.removeAttribute('aria-busy'); card.replaceChildren();
  const cur = S.draw.current;
  const items = poolItems(S.draw.pool);
  const count = items.length;
  if (!cur) {
    const note = !count ? t('draw.noneAvailable')
      : count < DRAW_MIN_POOL ? t('draw.fewIdeas', { n: count, min: DRAW_MIN_POOL })
      : t('draw.manyIdeas', { n: count });
    card.append(h('div', { class: 'draw-empty' }, icon('dice')),
      h('p', { class: 'draw-name' }, t('draw.whatNow')), h('p', { class: 'sub' }, note),
      h('div', { class: 'draw-actions' }, h('button', { class: 'btn btn-primary btn-lg', type: 'button', disabled: count ? null : true, onclick: doDraw }, icon('dice'), t('draw.drawButton'))));
    return;
  }
  const r = rewardFor(cur.min, cur.bonus), cost = rerollCost();
  const short = cost > S.coins, canReroll = drawAlternatives(items, cur).length > 0;
  const available = currentDrawAvailable(cur);
  const outsideFilters = !matchesDrawFilters(cur) || (S.draw.pool !== 'both' && cur.kind !== S.draw.pool);
  const bonusNote = cur.bonus ? null
    : cur.pool < DRAW_MIN_POOL ? t('draw.noBonusFew', { min: DRAW_MIN_POOL })
    : t('draw.noBonusRerolls');
  card.append(...[
    h('p', { class: 'draw-kind' }, cur.kind === 'chores' ? t('draw.kindChore') : t('draw.kindWish')),
    h('p', { class: 'draw-name' }, displayName(cur.name)),
    h('div', { class: 'draw-meta' }, h('span', { class: 'pill' }, cur.min + NB + 'min'),
      h('span', { class: 'pill' }, catDot(cur.cat), catName(cur.cat)),
      h('span', { class: 'pill' }, activityModeLabel(cur.mode)),
      cur.bonus ? h('span', { class: 'pill bonus' }, t('draw.bonusPill', { pct: cur.bonus })) : null),
    h('p', { class: 'sub' }, t('draw.gain', { coins: fmt(r.total) })),
    bonusNote ? h('p', { class: 'note' }, bonusNote) : null,
    outsideFilters ? h('p', { class: 'note' }, t('draw.outsideFilters')) : null,
    !available ? h('p', { class: 'note' }, t('draw.doneSince', { button: t('act.makeAvailable') })) : null,
    h('div', { class: 'draw-actions' },
      h('button', { class: 'btn btn-primary btn-lg', type: 'button', disabled: available ? null : true, onclick: acceptDraw }, icon('play'), t('draw.accept')),
      h('button', { class: 'btn btn-secondary', type: 'button', disabled: short || !canReroll ? true : null, onclick: doDraw }, icon('reroll'), t('draw.reroll', { coins: fmt(cost) }))),
    !canReroll ? h('p', { class: 'note' }, t('draw.noOther'))
      : short ? h('p', { class: 'note' }, t('draw.shortReroll', { coins: fmt(cost - S.coins) }))
      : h('p', { class: 'note' }, t('draw.rerollNote')),
  ].filter(Boolean));
}
function doDraw() {
  if (drawAnim || performance.now() < drawBusyUntil) return;
  const items = poolItems(S.draw.pool), cur = S.draw.current;
  if (!items.length) { toast(t('draw.noneToast')); return; }
  const candidates = drawAlternatives(items, cur);
  if (!candidates.length) { toast(t('draw.noOtherToast')); return; }
  const cost = rerollCost();
  if (cost > S.coins) { toast(t('draw.shortReroll', { coins: fmt(cost - S.coins) })); return; }
  drawBusyUntil = performance.now() + 700;
  if (cost) { S.coins -= cost; S.draw.rerolls += 1; }
  const arr = new Uint32Array(1);
  if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(arr); else arr[0] = Math.floor(Math.random() * 4294967295);
  const pick = candidates[arr[0] % candidates.length];
  const bonus = items.length >= DRAW_MIN_POOL ? Math.floor(DRAW_BONUS[pick.kind] / Math.pow(2, S.draw.rerolls)) : 0;
  S.draw.current = { id: pick.id, name: pick.name, cat: pick.cat, min: pick.min, kind: pick.kind, bonus, pool: items.length,
    mode: pick.mode || 'focus', energy: pick.energy || 'medium', place: pick.place || 'any', repeat: pick.repeat || 'always', completedAt: pick.completedAt || null };
  drawAnim = true;
  commit();
  if (cost) bump();
  animateDraw(items, pick);
}
function animateDraw(items, pick) {
  const card = $('#drawCard');
  if (reducedMotion() || items.length < 2) { drawAnim = null; renderDraw(); announce(t('draw.result', { name: displayName(pick.name) })); return; }
  const nameEl = h('p', { class: 'draw-name spinning', 'aria-hidden': 'true' });
  card.setAttribute('aria-busy', 'true');
  card.replaceChildren(h('p', { class: 'draw-kind' }, t('draw.spinning')), nameEl);
  let i = Math.floor(Math.random() * items.length), delay = 45;
  const step = () => {
    if (delay > 230) { drawAnim = null; renderDraw(); announce(t('draw.result', { name: displayName(pick.name) })); return; }
    nameEl.textContent = displayName(items[i++ % items.length].name);
    delay *= 1.17; drawAnim = setTimeout(step, delay);
  };
  step();
}
function acceptDraw() {
  const cur = S.draw.current;
  if (!cur) return;
  if (!currentDrawAvailable(cur)) { toast(t('draw.taskUnavailable')); return; }
  openStartSheet(cur, { source: cur.kind, drawPct: cur.bonus, draw: clone(cur), drawRerolls: S.draw.rerolls, fixedDuration: true });
}
function renderList(key, ul) {
  ul.replaceChildren();
  const arr = S[key];
  if (!arr.length) ul.append(h('li', {}, h('span', { class: 'empty' }, t('draw.listEmpty'))));
  for (const it of arr) {
    const available = taskAvailable(it), status = taskStatus(it);
    const name = displayName(it.name), energies = actEnergies();
    ul.append(h('li', { class: available ? null : 'task-waiting' },
      h('div', { class: 'row-main' }, h('span', { class: 'row-title' }, name),
        h('span', { class: 'row-sub' }, catDot(it.cat), catName(it.cat) + ' · ' + it.min + NB + 'min' + (it.ex ? ' · ' + t('draw.example') : '')),
        h('span', { class: 'task-status' }, t('draw.modeEnergy', { mode: activityModeLabel(it.mode), energy: (energies.find(([value]) => value === (it.energy || 'medium')) || energies[1])[1].toLowerCase() })),
        status ? h('span', { class: 'task-status' }, status) : null,
        !available ? h('button', { class: 'btn btn-ghost btn-sm task-reset', type: 'button', 'aria-label': t('act.makeAvailableNamed', { name }), onclick: () => resetTask(key, it.id) }, t('act.makeAvailable')) : null),
      h('div', { class: 'task-actions' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('act.editNamed', { name }), onclick: () => openEditSheet(key, it.id) }, icon('pencil')),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('act.deleteNamed', { name }), onclick: () => removeWithUndo(key, it.id) }, icon('trash')))));
  }
}
