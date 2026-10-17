/* ---------- Tirage contextualisé ---------- */
const ACT_DRAW_TIMES = [0, 5, 10, 15, 20, 30, 60, 180];
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
        announce(S.draw.current ? 'Filtres enregistrés pour le prochain tirage. Le tirage actuel est conservé.' : 'Filtres mis à jour.');
      } }, options));
    root = h('section', { class: 'card draw-filters', id: 'drawFilters', 'aria-label': 'Adapter le tirage à ma disponibilité' },
      h('h3', {}, 'Ce qui me convient maintenant'),
      h('div', { class: 'draw-filter-fields' },
        field('drawMaxMin', 'Mon temps', ACT_DRAW_TIMES.map(t => h('option', { value: t }, t ? t + NB + 'min maximum' : 'Sans limite'))),
        field('drawEnergy', 'Mon énergie', activityOptions([['any', 'Peu importe'], ['low', 'Basse'], ['medium', 'Moyenne'], ['high', 'Haute']], 'any')),
        field('drawPlace', 'Mon lieu', activityOptions(ACT_PLACES, 'any'))),
      h('div', { class: 'draw-filter-actions' }, h('span', { class: 'draw-filter-count', id: 'drawFilterCount', 'aria-live': 'polite' }),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => {
          S.draw.filters = { maxMin: 0, energy: 'any', place: 'any' }; commit(); announce('Filtres réinitialisés.');
        } }, 'Tout proposer')),
      h('p', { class: 'note', id: 'drawFilterNote' }));
    $('#drawCard').before(root);
  }
  const f = drawFilters();
  $('#drawMaxMin').value = String(f.maxMin);
  $('#drawEnergy').value = f.energy;
  $('#drawPlace').value = f.place;
  $('#drawFilterCount').textContent = frTypo(plural(poolItems(S.draw.pool).length, 'idée disponible', 'idées disponibles'));
  $('#drawFilterNote').textContent = frTypo(S.draw.current
    ? 'Ces filtres s’appliquent au prochain tirage. Le tirage actuel, son bonus et le prix de sa relance sont conservés.'
    : 'Les idées demandant moins d’énergie restent proposées. Le bonus nécessite au moins ' + DRAW_MIN_POOL + ' idées disponibles avec ces filtres.');
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
    const note = !count ? 'Aucune idée disponible avec ces critères. Ajuste les filtres ou ajoute une idée.'
      : count < DRAW_MIN_POOL ? 'Tirage parmi ' + plural(count, 'idée', 'idées') + '. Il faut au moins ' + DRAW_MIN_POOL + ' idées disponibles avec ces filtres pour gagner le bonus.'
      : 'Tirage parmi ' + count + ' idées. Le premier tirage est gratuit.';
    card.append(h('div', { class: 'draw-empty' }, icon('dice')),
      h('p', { class: 'draw-name' }, 'Que faire maintenant ?'), h('p', { class: 'sub' }, note),
      h('div', { class: 'draw-actions' }, h('button', { class: 'btn btn-primary btn-lg', type: 'button', disabled: count ? null : true, onclick: doDraw }, icon('dice'), 'Tirer au sort')));
    return;
  }
  const r = rewardFor(cur.min, cur.bonus), cost = rerollCost();
  const short = cost > S.coins, canReroll = drawAlternatives(items, cur).length > 0;
  const available = currentDrawAvailable(cur);
  const outsideFilters = !matchesDrawFilters(cur) || (S.draw.pool !== 'both' && cur.kind !== S.draw.pool);
  const bonusNote = cur.bonus ? null
    : cur.pool < DRAW_MIN_POOL ? 'Pas de bonus : moins de ' + DRAW_MIN_POOL + ' idées étaient disponibles lors de ce tirage.'
    : 'Plus de bonus après ces relances.';
  card.append(...[
    h('p', { class: 'draw-kind' }, cur.kind === 'chores' ? 'Obligation tirée' : 'Envie tirée'),
    h('p', { class: 'draw-name' }, cur.name),
    h('div', { class: 'draw-meta' }, h('span', { class: 'pill' }, cur.min + NB + 'min'),
      h('span', { class: 'pill' }, catDot(cur.cat), CATS[cur.cat].name),
      h('span', { class: 'pill' }, activityModeLabel(cur.mode)),
      cur.bonus ? h('span', { class: 'pill bonus' }, 'Bonus +' + cur.bonus + NB + '%') : null),
    h('p', { class: 'sub' }, 'Gain à la fin : ' + fmt(r.total)),
    bonusNote ? h('p', { class: 'note' }, bonusNote) : null,
    outsideFilters ? h('p', { class: 'note' }, 'Ce tirage ne correspond plus aux filtres choisis. Tu peux le garder ; les filtres seront utilisés à la prochaine relance.') : null,
    !available ? h('p', { class: 'note' }, 'Cette tâche a été terminée depuis le tirage. Elle redeviendra disponible à sa prochaine échéance, ou via « Remettre disponible » dans sa liste.') : null,
    h('div', { class: 'draw-actions' },
      h('button', { class: 'btn btn-primary btn-lg', type: 'button', disabled: available ? null : true, onclick: acceptDraw }, icon('play'), 'C’est parti'),
      h('button', { class: 'btn btn-secondary', type: 'button', disabled: short || !canReroll ? true : null, onclick: doDraw }, icon('reroll'), 'Relancer · ' + fmt(cost))),
    !canReroll ? h('p', { class: 'note' }, 'Aucune autre idée disponible avec ces filtres. Ajuste-les pour relancer ; aucune pièce n’est dépensée.')
      : short ? h('p', { class: 'note' }, 'Il te manque ' + fmt(cost - S.coins) + ' pour relancer.')
      : h('p', { class: 'note' }, 'Chaque relance coûte des pièces et divise le bonus par deux.'),
  ].filter(Boolean));
}
function doDraw() {
  if (drawAnim || performance.now() < drawBusyUntil) return;
  const items = poolItems(S.draw.pool), cur = S.draw.current;
  if (!items.length) { toast('Aucune idée disponible. Ajuste les filtres ou ajoute une idée.'); return; }
  const candidates = drawAlternatives(items, cur);
  if (!candidates.length) { toast('Aucune autre idée disponible : aucune pièce dépensée.'); return; }
  const cost = rerollCost();
  if (cost > S.coins) { toast('Il te manque ' + fmt(cost - S.coins) + ' pour relancer.'); return; }
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
  if (reducedMotion() || items.length < 2) { drawAnim = null; renderDraw(); announce('Tirage : ' + pick.name + '.'); return; }
  const nameEl = h('p', { class: 'draw-name spinning', 'aria-hidden': 'true' });
  card.setAttribute('aria-busy', 'true');
  card.replaceChildren(h('p', { class: 'draw-kind' }, 'Tirage en cours'), nameEl);
  let i = Math.floor(Math.random() * items.length), delay = 45;
  const step = () => {
    if (delay > 230) { drawAnim = null; renderDraw(); announce('Tirage : ' + pick.name + '.'); return; }
    nameEl.textContent = items[i++ % items.length].name;
    delay *= 1.17; drawAnim = setTimeout(step, delay);
  };
  step();
}
function acceptDraw() {
  const cur = S.draw.current;
  if (!cur) return;
  if (!currentDrawAvailable(cur)) { toast('Cette tâche est terminée ou en attente.'); return; }
  openStartSheet(cur, { source: cur.kind, drawPct: cur.bonus, draw: clone(cur), drawRerolls: S.draw.rerolls, fixedDuration: true });
}
function renderList(key, ul) {
  ul.replaceChildren();
  const arr = S[key];
  if (!arr.length) ul.append(h('li', {}, h('span', { class: 'empty' }, 'La liste est vide. Ajoute une idée ci-dessous.')));
  for (const it of arr) {
    const available = taskAvailable(it), status = taskStatus(it);
    ul.append(h('li', { class: available ? null : 'task-waiting' },
      h('div', { class: 'row-main' }, h('span', { class: 'row-title' }, it.name),
        h('span', { class: 'row-sub' }, catDot(it.cat), CATS[it.cat].name + ' · ' + it.min + NB + 'min' + (it.ex ? ' · exemple' : '')),
        h('span', { class: 'task-status' }, activityModeLabel(it.mode) + ' · énergie ' + (ACT_ENERGIES.find(([value]) => value === (it.energy || 'medium')) || ACT_ENERGIES[1])[1].toLowerCase()),
        status ? h('span', { class: 'task-status' }, status) : null,
        !available ? h('button', { class: 'btn btn-ghost btn-sm task-reset', type: 'button', 'aria-label': 'Remettre disponible : ' + it.name, onclick: () => resetTask(key, it.id) }, 'Remettre disponible') : null),
      h('div', { class: 'task-actions' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Modifier ' + it.name, onclick: () => openEditSheet(key, it.id) }, icon('pencil')),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Supprimer ' + it.name, onclick: () => removeWithUndo(key, it.id) }, icon('trash')))));
  }
}
