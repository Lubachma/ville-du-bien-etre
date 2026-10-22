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
// critère n'est pas rempli, 0 ensuite), et « hint » la clé du conseil. Avec moins de 4 bâtiments, « Petits détails » demande
// d'abord des bâtiments : un décor de plus n'y suffirait pas.
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
    details: [n >= 4 && adorned * 4 >= n * 3, n < 4 ? 4 - n : Math.ceil(n * 3 / 4) - adorned, n < 4 ? 'harmony.details.buildings' : ''],
    quartiers: [sets >= 2, 2 - sets],
    lumieres: [lights >= Math.max(1, Math.ceil(n / 5)), Math.max(1, Math.ceil(n / 5)) - lights],
  };
  return HARMONY.map(id => {
    const [met, missing, hint] = rules[id];
    return { id, met, missing: met ? 0 : Math.max(1, missing), hint: hint || 'harmony.' + id + '.hint' };
  });
}
// Étoiles gagnées : une clé « star:<critère> » dans les cadeaux, datée du jour où elle a été gagnée.
function starsEarned() { return HARMONY.filter(id => S.gifts && S.gifts['star:' + id]); }
// Nouvelles étoiles : chaque critère rempli pour la première fois rapporte 10 M, une seule fois. N'enregistre pas.
function claimStars(city = S.city) {
  const fresh = harmonyCriteria(city).filter(c => c.met && !S.gifts['star:' + c.id]).map(c => c.id);
  for (const id of fresh) {
    S.gifts['star:' + id] = nowTs();
    S.coins = clamp(S.coins + GIFTS.star, 0, COINS_MAX);
  }
  return fresh;
}

// Souhaits : pour chaque bâtiment qui a au moins une case voisine libre (lignes, puis colonnes), chaque décor aimé de son
// domaine, déjà débloqué et absent de ses cases voisines.
function wishCandidates(city = S.city) {
  const taken = new Set(city.tiles.map(tile => tile.x + ',' + tile.y)), out = [];
  const free = tile => [-1, 0, 1].some(dy => [-1, 0, 1].some(dx => {
    const x = tile.x + dx, y = tile.y + dy;
    return (dx || dy) && x >= 0 && y >= 0 && x < city.size && y < city.size && !taken.has(x + ',' + y);
  }));
  for (const tile of city.tiles.filter(other => isDomainItem(other.item)).sort((a, b) => a.y - b.y || a.x - b.x)) {
    if (!free(tile)) continue;
    const near = new Set(neighbourTiles(city, tile).map(other => other.item));
    for (const item of WISH_LIKES[ITEMS[tile.item].group]) if (!lockInfo(item) && !near.has(item)) out.push({ tile: tile.id, item });
  }
  return out;
}
// Le bâtiment du souhait en cours (ni exaucé, ni laissé de côté), s'il existe encore ; rien quand les souhaits sont coupés.
function townWishTile() {
  const w = S.townWish;
  if (S.settings.townWishes === false || !w || w.done || w.skipped) return null;
  return S.city.tiles.find(tile => tile.id === w.tile) || null;
}
// Jour sans souhait possible : la recherche ne reprend qu'au changement suivant de l'état (sa révision), ou le lendemain.
let wishless = '';
// Souhait du jour, tiré pour la journée (le même dans tous les onglets) quand aucun n'est en cours et que le dernier date d'un
// jour antérieur : un seul par jour. Il commence le lendemain de la première séance réussie : tant qu'aucune n'a eu lieu un jour antérieur
// (stats.days ne compte que les séances réussies), la ville n'a encore rien fait et le souhait inviterait à dépenser. N'enregistre pas.
function drawTownWish(day = today()) {
  if (S.settings.townWishes === false || townWishTile() || (S.townWish && S.townWish.day >= day)
    || !Object.keys(S.stats.days).some(d => d < day)) return false;
  const key = day + '|' + (S.revision || '');
  if (wishless === key) return false;
  const list = wishCandidates();
  if (!list.length) { wishless = key; return false; }
  const pick = list[Math.floor(chance(day + ':souhait') * list.length)];
  S.townWish = { day, tile: pick.tile, item: pick.item };
  return true;
}
// Souhait exaucé quand le décor voulu est dans une case voisine du bâtiment : 3 M, une seule fois, et jamais pour un jour antérieur
// au dernier souhait récompensé (exaucé quand même, sans cadeau : paid est faux). N'enregistre pas.
function claimTownWish() {
  const tile = townWishTile(), w = S.townWish;
  if (!tile || !neighbourTiles(S.city, tile).some(other => other.item === w.item)) return null;
  w.done = nowTs();
  const key = 'wish:' + w.day, paid = lastGiftDay('wish:') < w.day;
  if (paid) {
    S.gifts[key] = w.done;
    S.coins = clamp(S.coins + GIFTS.townWish, 0, COINS_MAX);
  }
  return { tile: tile.id, item: w.item, day: w.day, building: tile.item, paid };
}
// « Pas maintenant » : le souhait est rangé, sans rien de plus ; un autre viendra le lendemain. N'enregistre pas.
function skipTownWish() {
  if (!townWishTile()) return false;
  S.townWish.skipped = true;
  return true;
}
