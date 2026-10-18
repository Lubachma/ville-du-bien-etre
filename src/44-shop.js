function openShop() {
  openSheet(t('shop.title'), body => {
    body.append(h('p', { class: 'note' }, t('shop.intro', { coins: fmt(S.coins) })));
    // Raccourcis vers les rubriques, sur une ligne qui défile
    const nav = h('div', { class: 'chips shop-nav', role: 'navigation', 'aria-label': t('shop.nav') });
    for (const gk of GROUPS) {
      nav.append(h('button', { class: 'chip', type: 'button', onclick: () => {
        const sec = $('#shop-' + gk);
        if (sec) sec.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
      } }, isCat(gk) ? catName(gk) : groupName(gk)));
    }
    body.append(nav);
    for (const gk of GROUPS) {
      const sec = h('section', { class: 'shop-group', id: 'shop-' + gk }, h('h3', {}, isCat(gk) ? catDot(gk) : null, isCat(gk) ? catName(gk) : groupName(gk)));
      const view = groupView(gk);
      for (const key of [...view.open, ...view.revealed]) sec.append(shopItem(key));
      for (const key of view.hidden) sec.append(shopMystery(key));
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
// Un élément de la boutique : débloqué (avec son bouton), ou verrouillé mais dévoilé (sa condition et sa jauge).
function shopItem(key) {
  const it = ITEMS[key], lock = lockInfo(key), price = priceOf(key), owned = ownedCount(key);
  const cv = h('canvas', { 'aria-hidden': 'true' });
  City.thumb(cv, key);
  const sub = h('div', { class: 'si-sub' });
  let action;
  if (lock) {
    sub.append(h('span', {}, icon('lock'), ' ', lock.text));
    if (lock.need > 1) sub.append(h('div', { class: 'meter', vars: { '--c': lock.cat ? catVar(lock.cat) : 'var(--cat-prestige)' } }, h('span', { style: 'width:' + clamp(lock.have / lock.need * 100, 0, 100) + '%' })));
    action = h('span', { class: 'pill' }, fmt(price));
  } else if (isWonder(key)) {
    action = wonderShopAction(key, sub);
  } else if (!price) {
    // Décor offert par un succès : le premier exemplaire ne coûte rien.
    sub.append(h('span', {}, t('shop.available')));
    action = h('button', { class: 'btn btn-primary btn-sm', type: 'button', 'aria-label': t('shop.placeFree', { item: itemName(key) }), onclick: () => { closeSheet(); Mode.startPlace(key); } }, t('shop.free'));
  } else {
    const short = price > S.coins;
    const extra = owned && it.group !== 'decor' ? ' · ' + t('shop.owned', { n: owned, pct: Math.round(DUP_STEP * 100 * owned) }) : '';
    sub.append(h('span', {}, (short ? t('shop.missing', { coins: fmt(price - S.coins) }) : t('shop.available')) + extra));
    action = h('button', { class: 'btn ' + (short ? 'btn-secondary' : 'btn-primary') + ' btn-sm', type: 'button', disabled: short ? true : null, 'aria-label': t('shop.placeFor', { item: itemName(key), price: fmt(price) }), onclick: () => { closeSheet(); Mode.startPlace(key); } }, fmt(price));
  }
  return h('div', { class: 'shop-item' + (lock ? ' locked' : '') + (isWonder(key) && !lock ? ' wonder' : '') }, cv, h('div', { class: 'si-text' }, h('span', { class: 'si-name' }, itemName(key)), sub), action);
}
// Élément encore à découvrir : une ligne compacte, sa silhouette et sa condition.
function shopMystery(key) {
  const cv = h('canvas', { 'aria-hidden': 'true' });
  City.thumb(cv, key, 40, { silhouette: true });
  return h('div', { class: 'shop-item hidden' }, cv, h('div', { class: 'si-text' }, h('span', { class: 'si-name' }, t('carnet.mystery')),
    h('div', { class: 'si-sub' }, h('span', {}, icon('lock'), ' ', lockInfo(key).text))));
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
  const fresh = noticeProgress();
  closeSheet();
  commit();
  City.relayout();
  bump();
  if (hasNews(fresh)) celebrate(fresh); else toast(t('shop.expanded', { size: ns }));
}
// Bouton d'une merveille dans la boutique : commencer le chantier, le continuer, ou rien une fois inaugurée.
function wonderShopAction(key, sub) {
  const tile = wonderTile(key), price = priceOf(key);
  if (!tile) {
    const short = price > S.coins;
    sub.append(h('span', {}, (short ? t('shop.missing', { coins: fmt(price - S.coins) }) : t('shop.available')) + ' · ' + fmt(price)));
    return h('button', { class: 'btn ' + (short ? 'btn-secondary' : 'btn-primary') + ' btn-sm', type: 'button', disabled: short ? true : null,
      'aria-label': t('shop.startWonderFor', { item: itemName(key), price: fmt(price) }), onclick: () => { closeSheet(); Mode.startPlace(key); } }, t('shop.startWonder'));
  }
  const stage = tile.stage || 1;
  sub.append(h('span', {}, t('wonder.stageOf', { stage, name: t('wonder.' + key + '.stage' + stage) })));
  if (stage >= ITEMS[key].wonder.length) return h('span', { class: 'pill' }, t('shop.wonderDone', { g: itemGender(key) }));
  return h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { closeSheet(); openBuildingSheet(tile); } }, t('shop.wonderContinue', { stage }));
}
// Fiche d'une merveille : son étape, la suivante avec sa jauge et son prix. Elle se déplace mais ne se démolit pas.
function openWonderSheet(tile) {
  const key = tile.item, stage = tile.stage || 1, next = wonderNext(tile), stageName = n => t('wonder.' + key + '.stage' + n);
  Selection.id = tile.id;
  City.draw();
  openSheet(itemName(key), body => {
    const cv = h('canvas', { 'aria-hidden': 'true', style: 'width:96px;height:96px' });
    City.thumb(cv, key, 96, { stage });
    body.append(h('div', { class: 'bsheet' }, cv,
      h('div', { class: 'bsheet-text' }, h('span', { class: 'cat-label' }, groupName(ITEMS[key].group)),
        h('span', { class: 'note' }, t('wonder.stageOf', { stage, name: stageName(stage) })),
        h('span', { class: 'note' }, t('city.square', { x: tile.x + 1, y: tile.y + 1 })))));
    if (next) {
      const need = t('wonder.need', { have: fmtMin(next.have), need: fmtMin(next.need) });
      body.append(...[h('p', {}, t('wonder.next', { name: stageName(next.stage) })),
        h('div', { class: 'meter', vars: { '--c': 'var(--cat-prestige)' }, role: 'progressbar', 'aria-label': need, 'aria-valuemin': '0', 'aria-valuemax': String(next.need), 'aria-valuenow': String(Math.round(Math.min(next.have, next.need))) },
          h('span', { style: 'width:' + clamp(next.have / next.need * 100, 0, 100) + '%' })),
        h('p', { class: 'note' }, need),
        next.ready && !next.affordable ? h('p', { class: 'note' }, t('shop.missing', { coins: fmt(next.price - S.coins) })) : null,
        h('button', { class: 'btn btn-primary btn-block', type: 'button', disabled: next.ready && next.affordable ? null : true, onclick: () => {
          if (!buildWonderStage(tile)) return;
          const fresh = noticeProgress(), kind = tile.stage >= ITEMS[key].wonder.length ? 'inaugurate' : 'stage';
          closeSheet();
          City.effect(tile.id, kind);
          Chime.place(kind);
          commit();
          bump();
          const params = { item: itemName(key), stage: tile.stage, g: itemGender(key) };
          celebrate(fresh, tile.stage >= ITEMS[key].wonder.length ? t('wonder.inaugurated', params) : t('wonder.stageBuilt', params));
        } }, t('wonder.build', { price: fmt(next.price) }))].filter(Boolean));
    }
    body.append(h('button', { class: 'btn btn-secondary btn-block', type: 'button', onclick: () => { closeSheet(); Mode.startMove(tile); } }, icon('move'), t('shop.move')),
      h('p', { class: 'note' }, t('wonder.noDemolish')));
  }, { onClose: () => { Selection.id = null; City.draw(); } });
}
function openBuildingSheet(tile) {
  if (!tile || !isItem(tile.item)) return;
  if (isWonder(tile.item)) { openWonderSheet(tile); return; }
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
      ...[typeof townWishBlock === 'function' ? townWishBlock(tile) : null].filter(Boolean),
      h('button', { class: 'btn btn-secondary btn-block', type: 'button', onclick: () => { closeSheet(); Mode.startMove(tile); } }, icon('move'), t('shop.move')),
      del,
      h('p', { class: 'note' }, t('shop.noRefund')));
  }, { onClose: () => { Selection.id = null; City.draw(); } });
}
