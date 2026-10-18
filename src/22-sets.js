/* =========================================================================
   Ensembles de voisinage : trois éléments dans un même carré de 3 × 3 cases.
   Un ensemble découvert le reste, même si on le défait ensuite.
   ========================================================================= */
function setName(id) { return t('set.' + id + '.name'); }
// Pour chaque ensemble formé, ses cases : le premier carré trouvé (lignes puis colonnes),
// et dans ce carré la première case de chaque élément.
function formedSets(city = S.city) {
  const found = new Map(), at = new Map();
  for (const tile of city.tiles) at.set(tile.x + ',' + tile.y, tile);
  for (const set of SETS) {
    search: for (let y0 = 0; y0 <= city.size - 3; y0++) {
      for (let x0 = 0; x0 <= city.size - 3; x0++) {
        const ids = [];
        for (const item of set.items) {
          let hit = null;
          for (let dy = 0; dy < 3 && !hit; dy++) for (let dx = 0; dx < 3 && !hit; dx++) {
            const tile = at.get((x0 + dx) + ',' + (y0 + dy));
            if (tile && tile.item === item) hit = tile;
          }
          if (!hit) break;
          ids.push(hit.id);
        }
        if (ids.length === set.items.length) { found.set(set.id, ids); break search; }
      }
    }
  }
  return found;
}
// Cases à paver : celles des ensembles formés en ce moment.
function pavedTileIds(city = S.city) {
  const ids = new Set();
  for (const list of formedSets(city).values()) list.forEach(id => ids.add(id));
  return ids;
}
// Inscrit les ensembles formés pas encore découverts, dans l'ordre de la table, et les renvoie.
function discoverSets(now = Date.now()) {
  if (!S.sets) S.sets = {};
  const fresh = [...formedSets().keys()].filter(id => !S.sets[id]);
  for (const id of fresh) S.sets[id] = now;
  return fresh;
}
