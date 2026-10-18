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

// Bouton « Harmonie ★★☆☆☆ » sous la ville : les étoiles gagnées, pleines, puis celles à venir ; son nom les compte.
function renderHarmonyButton() {
  const btn = $('#harmonyBtn');
  if (!btn) return;
  const n = typeof starsEarned === 'function' ? starsEarned().length : 0;
  btn.lastChild.textContent = t('harmony.button', { stars: t('harmony.starOn').repeat(n) + t('harmony.starOff').repeat(HARMONY.length - n) });
  btn.setAttribute('aria-label', t('harmony.buttonLabel', { n }));
}
// Fenêtre « Harmonie de ta ville » : les cinq étoiles, chacune avec sa date si elle est gagnée, sinon un conseil doux et chiffré.
function openHarmonySheet() {
  openSheet(t('harmony.title'), body => {
    body.append(h('p', { class: 'note' }, t('harmony.note')), h('ul', { class: 'harmony-list' }, ...harmonyCriteria().map(c => {
      const at = S.gifts && S.gifts['star:' + c.id];
      return h('li', { class: 'harmony-row' + (at ? ' earned' : '') },
        h('span', { class: 'harmony-star', 'aria-hidden': 'true' }, t(at ? 'harmony.starOn' : 'harmony.starOff')),
        h('span', { class: 'harmony-text' }, h('strong', {}, t('harmony.' + c.id)),
          h('span', { class: 'note' }, at ? t('harmony.earnedOn', { date: carnetDate(at) }) : t(c.hint, { n: c.missing }))));
    })));
  });
}
