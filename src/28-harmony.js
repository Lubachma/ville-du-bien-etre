/* =========================================================================
   Harmonie et souhaits des habitants : règles pures, sans DOM.
   Cinq étoiles d'harmonie, une par critère, gagnées pour toujours ; un souhait d'habitant par jour, qui n'expire jamais.
   ========================================================================= */
// Un élément d'un des cinq domaines, au sol ou non : ce sont eux, les « bâtiments » de l'harmonie et des souhaits.
function isDomainItem(key) { return !!ITEMS[key] && CAT_ORDER.includes(ITEMS[key].group); }
// Les éléments des huit cases voisines, diagonales comprises.
function neighbourTiles(city, tile) {
  return city.tiles.filter(other => other !== tile && Math.abs(other.x - tile.x) <= 1 && Math.abs(other.y - tile.y) <= 1);
}
// Les cinq critères, dans l'ordre de HARMONY ; « missing » dit ce qu'il faudrait encore pour le conseil (au moins 1 tant que le
// critère n'est pas rempli, 0 ensuite).
function harmonyCriteria(city = S.city) {
  const buildings = city.tiles.filter(tile => isDomainItem(tile.item)), n = buildings.length;
  const count = items => city.tiles.filter(tile => items.includes(tile.item)).length;
  const nature = count(NATURE_ITEMS), lights = count(['lampadaire', 'lanterne']);
  const domains = new Set(buildings.map(tile => ITEMS[tile.item].group)).size;
  const adorned = buildings.filter(tile => neighbourTiles(city, tile).some(other => ITEMS[other.item] && ITEMS[other.item].group === 'decor')).length;
  const sets = formedSets(city).size;
  const rules = {
    verdure: [nature >= 2 && nature * 3 >= n, Math.max(2, Math.ceil(n / 3)) - nature],
    variete: [domains >= 3, 3 - domains],
    details: [n >= 4 && adorned * 4 >= n * 3, Math.ceil(Math.max(n, 4) * 3 / 4) - adorned],
    quartiers: [sets >= 2, 2 - sets],
    lumieres: [lights >= Math.max(1, Math.ceil(n / 5)), Math.max(1, Math.ceil(n / 5)) - lights],
  };
  return HARMONY.map(id => { const [met, missing] = rules[id]; return { id, met, missing: met ? 0 : Math.max(1, missing) }; });
}
// Étoiles gagnées : une clé « star:<critère> » dans les cadeaux, datée du jour où elle a été gagnée.
function starsEarned() { return HARMONY.filter(id => S.gifts && S.gifts['star:' + id]); }
// Nouvelles étoiles : chaque critère rempli pour la première fois rapporte 10 M, une seule fois. N'enregistre pas.
function claimStars(city = S.city) {
  if (!S.gifts) S.gifts = {};
  const fresh = harmonyCriteria(city).filter(c => c.met && !S.gifts['star:' + c.id]).map(c => c.id);
  for (const id of fresh) {
    S.gifts['star:' + id] = nowTs();
    S.coins = clamp(S.coins + GIFTS.star, 0, COINS_MAX);
  }
  return fresh;
}
