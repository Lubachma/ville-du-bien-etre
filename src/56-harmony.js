/* =========================================================================
   Harmonie et souhaits (interface) : carte « Souhait du jour », rappel dans la fiche du bâtiment.
   ========================================================================= */
// Le décor d'un souhait, avec sa tournure (« un banc », « des fleurs »).
const wishThing = item => t('wish.thing.' + item);
// De quoi exaucer le souhait : « Placer un banc · 2 M », qui lance la pose. Sans assez de pièces, le bouton est désactivé et la
// note dit ce qu'il faut encore, sans rien de plus.
function wishPlaceButton(item) {
  const price = priceOf(item), short = price > S.coins, thing = wishThing(item);
  return [h('button', { class: 'btn btn-primary btn-sm', type: 'button', disabled: short ? true : null, onclick: () => { closeSheet(); Mode.startPlace(item); } },
    price ? t('wish.place', { thing, price: fmt(price) }) : t('wish.placeFree', { thing })),
  short ? h('p', { class: 'note' }, t('shop.missing', { coins: fmt(price - S.coins) })) : null].filter(Boolean);
}
// Carte « Souhait du jour », juste sous les outils de la ville : le bâtiment qui souhaite, sa phrase, et de quoi l'exaucer ou le
// laisser de côté. Cachée sans souhait en cours.
function renderTownWishCard() {
  const tools = $('.city-tools');
  if (!tools) return;
  let card = $('#townWishCard');
  if (!card) { card = h('section', { id: 'townWishCard', class: 'card wish-card', 'aria-labelledby': 'townWishTitle' }); tools.after(card); }
  const tile = typeof townWishTile === 'function' ? townWishTile() : null;
  card.hidden = !tile;
  if (!tile) { card.replaceChildren(); return; }
  const item = S.townWish.item, cv = h('canvas', { 'aria-hidden': 'true' });
  City.thumb(cv, tile.item, 48);
  card.replaceChildren(h('h3', { id: 'townWishTitle' }, t('wish.title')),
    h('div', { class: 'wish-main' }, cv, h('div', { class: 'wish-text' },
      h('strong', {}, itemName(tile.item)), h('p', {}, t('wish.line', { thing: wishThing(item) })), h('p', { class: 'note' }, t('wish.hint')))),
    h('div', { class: 'wish-actions' }, ...wishPlaceButton(item),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => {
        if (!skipTownWish()) return;
        commit();
        $('#personalizeCity').focus({ preventScroll: true });   // la carte disparaît : le focus reste sous la ville
      } }, t('wish.skip'))));
}
// Le même rappel dans la fiche du bâtiment qui souhaite ; rien pour les autres.
function townWishBlock(tile) {
  const wishing = typeof townWishTile === 'function' ? townWishTile() : null;
  if (!wishing || wishing.id !== tile.id) return null;
  return h('div', { class: 'wish-block' }, h('p', {}, t('wish.line', { thing: wishThing(S.townWish.item) })), h('p', { class: 'note' }, t('wish.hint')),
    ...wishPlaceButton(S.townWish.item));
}
