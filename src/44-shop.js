function openShop() {
  openSheet(t('shop.title'), body => {
    body.append(h('p', { class: 'note' }, t('shop.intro', { coins: fmt(S.coins) })));
    for (const gk of GROUPS) {
      const sec = h('section', { class: 'shop-group' }, h('h3', {}, isCat(gk) ? catDot(gk) : null, isCat(gk) ? catName(gk) : groupName(gk)));
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
          const extra = owned && it.group !== 'decor' ? ' · ' + t('shop.owned', { n: owned, pct: Math.round(DUP_STEP * 100 * owned) }) : '';
          sub.append(h('span', {}, (short ? t('shop.missing', { coins: fmt(price - S.coins) }) : t('shop.available')) + extra));
          action = h('button', { class: 'btn ' + (short ? 'btn-secondary' : 'btn-primary') + ' btn-sm', type: 'button', disabled: short ? true : null, 'aria-label': t('shop.placeFor', { item: itemName(key), price: fmt(price) }), onclick: () => { closeSheet(); Mode.startPlace(key); } }, fmt(price));
        }
        sec.append(h('div', { class: 'shop-item' + (lock ? ' locked' : '') }, cv, h('div', { class: 'si-text' }, h('span', { class: 'si-name' }, itemName(key)), sub), action));
      }
      body.append(sec);
    }
    const ns = nextSize();
    const land = h('section', { class: 'shop-group' }, h('h3', {}, t('shop.land')));
    if (ns) {
      const price = EXPAND_PRICE[ns];
      const short = price > S.coins;
      land.append(h('div', { class: 'shop-item' },
        h('div', { class: 'si-icon' }, icon('expand')),
        h('div', { class: 'si-text' }, h('span', { class: 'si-name' }, t('shop.expandTo', { size: ns })), h('div', { class: 'si-sub' }, h('span', {}, short ? t('shop.missing', { coins: fmt(price - S.coins) }) : t('shop.expandHint')))),
        h('button', { class: 'btn ' + (short ? 'btn-secondary' : 'btn-primary') + ' btn-sm', type: 'button', disabled: short ? true : null, onclick: expandCity }, fmt(price))));
    } else {
      land.append(h('p', { class: 'note' }, t('shop.maxSize', { size: S.city.size })));
    }
    body.append(land);
  });
}
// Calculé à partir de l'état actuel : une fenêtre ouverte avant une synchronisation ne peut pas faire payer pour rien.
function expandCity() {
  const ns = nextSize();
  if (!ns) { closeSheet(); toast(t('shop.alreadyMax')); return; }
  const price = EXPAND_PRICE[ns];
  if (S.coins < price) { toast(t('shop.missingToast', { coins: fmt(price - S.coins) })); return; }
  S.coins -= price;
  const shift = (ns - S.city.size) / 2;
  S.city.size = ns;
  for (const tile of S.city.tiles) { tile.x += shift; tile.y += shift; }
  Mode.state = null;
  closeSheet();
  commit();
  City.relayout();
  bump();
  toast(t('shop.expanded', { size: ns }));
}
function openBuildingSheet(tile) {
  if (!tile || !isItem(tile.item)) return;
  const it = ITEMS[tile.item];
  Selection.id = tile.id;
  City.draw();
  openSheet(itemName(tile.item), body => {
    const cv = h('canvas', { 'aria-hidden': 'true', style: 'width:96px;height:96px' });
    City.thumb(cv, tile.item, 96);
    const g = itemGender(tile.item);
    const del = h('button', { class: 'btn btn-ghost', type: 'button' }, t('shop.demolish'));
    twoStep(del, t('shop.demolish'), t('shop.demolishConfirm'), () => {
      S.city.tiles = S.city.tiles.filter(other => other.id !== tile.id);
      closeSheet();
      commit();
      toast(t('shop.demolished', { item: itemName(tile.item), g }));
    });
    const built = validTs(tile.at) ? t('shop.builtOn', { date: dayFmt('short').format(keyToUTC(dayOf(tile.at))), g }) : '';
    body.append(
      h('div', { class: 'bsheet' }, cv,
        h('div', { class: 'bsheet-text' },
          isCat(it.group) ? catLabel(it.group) : h('span', { class: 'cat-label' }, groupName(it.group)),
          built ? h('span', { class: 'note' }, built) : null,
          isCat(it.group) ? h('span', { class: 'note' }, buildingLevelText(tile.item)) : null,
          h('span', { class: 'note' }, t('city.square', { x: tile.x + 1, y: tile.y + 1 })))),
      h('button', { class: 'btn btn-secondary btn-block', type: 'button', onclick: () => { closeSheet(); Mode.startMove(tile); } }, icon('move'), t('shop.move')),
      del,
      h('p', { class: 'note' }, t('shop.noRefund')));
  }, { onClose: () => { Selection.id = null; City.draw(); } });
}
