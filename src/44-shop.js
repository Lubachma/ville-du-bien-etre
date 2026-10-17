function openShop() {
  openSheet('Construire', body => {
    body.append(h('p', { class: 'note' }, 'Solde : ' + fmt(S.coins) + '. Choisis un élément, puis une case libre de ta ville.'));
    for (const [gk, gname] of GROUPS) {
      const sec = h('section', { class: 'shop-group' }, h('h3', {}, gk === 'decor' || gk === 'prestige' ? null : catDot(gk), gname));
      for (const key of Object.keys(ITEMS).filter(k => ITEMS[k].group === gk)) {
        const it = ITEMS[key];
        const lock = lockInfo(key);
        const price = priceOf(key);
        const owned = ownedCount(key);
        const cv = h('canvas', { 'aria-hidden': 'true' });
        City.thumb(cv, key);
        const sub = h('div', { class: 'si-sub' });
        let action;
        if (lock) {
          sub.append(h('span', {}, icon('lock'), ' ', lock.text));
          if (lock.need > 1) sub.append(h('div', { class: 'meter', vars: { '--c': lock.cat ? catVar(lock.cat) : 'var(--cat-prestige)' } }, h('span', { style: 'width:' + clamp(lock.have / lock.need * 100, 0, 100) + '%' })));
          action = h('span', { class: 'pill' }, fmt(price));
        } else {
          const short = price > S.coins;
          const extra = owned && it.group !== 'decor' ? ' · tu en as ' + owned + ', +' + Math.round(DUP_STEP * 100 * owned) + NB + '%' : '';
          sub.append(h('span', {}, (short ? 'Il te manque ' + fmt(price - S.coins) : 'Disponible') + extra));
          action = h('button', { class: 'btn ' + (short ? 'btn-secondary' : 'btn-primary') + ' btn-sm', type: 'button', disabled: short ? true : null, 'aria-label': 'Placer ' + it.name + ' pour ' + fmt(price), onclick: () => { closeSheet(); Mode.startPlace(key); } }, fmt(price));
        }
        sec.append(h('div', { class: 'shop-item' + (lock ? ' locked' : '') }, cv, h('div', { class: 'si-text' }, h('span', { class: 'si-name' }, it.name), sub), action));
      }
      body.append(sec);
    }
    const ns = nextSize();
    const land = h('section', { class: 'shop-group' }, h('h3', {}, 'Terrain'));
    if (ns) {
      const price = EXPAND_PRICE[ns];
      const short = price > S.coins;
      land.append(h('div', { class: 'shop-item' },
        h('div', { class: 'si-icon' }, icon('expand')),
        h('div', { class: 'si-text' }, h('span', { class: 'si-name' }, 'Agrandir à ' + ns + '×' + ns), h('div', { class: 'si-sub' }, h('span', {}, short ? 'Il te manque ' + fmt(price - S.coins) : 'Plus de place pour construire'))),
        h('button', { class: 'btn ' + (short ? 'btn-secondary' : 'btn-primary') + ' btn-sm', type: 'button', disabled: short ? true : null, onclick: expandCity }, fmt(price))));
    } else {
      land.append(h('p', { class: 'note' }, 'Ton terrain a atteint sa taille maximale (' + S.city.size + '×' + S.city.size + ').'));
    }
    body.append(land);
  });
}
// Calculé à partir de l'état actuel : une fenêtre ouverte avant une synchronisation ne peut pas faire payer pour rien.
function expandCity() {
  const ns = nextSize();
  if (!ns) { closeSheet(); toast('Ton terrain a déjà sa taille maximale.'); return; }
  const price = EXPAND_PRICE[ns];
  if (S.coins < price) { toast('Il te manque ' + fmt(price - S.coins) + '.'); return; }
  S.coins -= price;
  const shift = (ns - S.city.size) / 2;
  S.city.size = ns;
  for (const t of S.city.tiles) { t.x += shift; t.y += shift; }
  Mode.state = null;
  closeSheet();
  commit();
  City.relayout();
  bump();
  toast('Terrain agrandi à ' + ns + '×' + ns + '.');
}
function openBuildingSheet(tile) {
  if (!tile || !isItem(tile.item)) return;
  const it = ITEMS[tile.item];
  Selection.id = tile.id;
  City.draw();
  openSheet(it.name, body => {
    const cv = h('canvas', { 'aria-hidden': 'true', style: 'width:96px;height:96px' });
    City.thumb(cv, tile.item, 96);
    const del = h('button', { class: 'btn btn-ghost', type: 'button' }, 'Démolir');
    twoStep(del, 'Démolir', 'Confirmer la démolition', () => {
      S.city.tiles = S.city.tiles.filter(t => t.id !== tile.id);
      closeSheet();
      commit();
      toast(it.name + (it.fem ? ' démolie.' : ' démoli.'));
    });
    const built = validTs(tile.at) ? (it.fem ? 'Construite le ' : 'Construit le ') + fmtDayShortUTC.format(keyToUTC(dayOf(tile.at))) : '';
    body.append(
      h('div', { class: 'bsheet' }, cv,
        h('div', { class: 'bsheet-text' },
          isCat(it.group) ? catLabel(it.group) : h('span', { class: 'cat-label' }, groupName(it.group)),
          built ? h('span', { class: 'note' }, built) : null,
          isCat(it.group) ? h('span', { class: 'note' }, buildingLevelText(tile.item)) : null,
          h('span', { class: 'note' }, 'Case ' + (tile.x + 1) + ', ' + (tile.y + 1)))),
      h('button', { class: 'btn btn-secondary btn-block', type: 'button', onclick: () => { closeSheet(); Mode.startMove(tile); } }, icon('move'), 'Déplacer'),
      del,
      h('p', { class: 'note' }, 'Démolir ne rembourse pas les pièces.'));
  }, { onClose: () => { Selection.id = null; City.draw(); } });
}
