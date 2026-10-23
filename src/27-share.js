/* =========================================================================
   Partage : le code d'une ville dans un lien, et les cartes postales des villes amies.
   Règles pures, sans DOM. Le lien ne contient que le nom de la ville, la taille du terrain, les éléments (type, place,
   étape d'une merveille, niveau), les fleurs du Grand Arbre et un identifiant tiré au hasard.
   ========================================================================= */
const SHARE_VERSION = 1;
const SHARE_NAME_BYTES = 60;
const SHARE_NAME_CHARS = 40;
const SHARE_CODE_MAX = 4000;
const SHARE_ID = /^[0-9a-f]{12}$/;

// Identifiant de partage, tiré au hasard une seule fois : il reconnaît la même ville d'une visite à l'autre.
function ensureShareId() {
  if (!SHARE_ID.test(S.shareId || '')) S.shareId = [...crypto.getRandomValues(new Uint8Array(6))].map(b => b.toString(16).padStart(2, '0')).join('');
  return S.shareId;
}
// Octets ↔ base64url sans « = ».
const toBase64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function fromBase64url(code) {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64 + '==='.slice((b64.length + 3) % 4)), c => c.charCodeAt(0));
}
// Le nom de la ville en UTF-8, au plus 60 octets coupés sur un caractère entier ; vide quand c'est le nom par défaut.
function shareNameBytes(state) {
  const raw = String((state.personal && state.personal.name) || '');
  if (!raw || langs().some(lang => DICT[lang]['city.defaultName'] === raw)) return [];
  const encoder = new TextEncoder(), out = [];
  for (const ch of raw) {
    const b = encoder.encode(ch);
    if (out.length + b.length > SHARE_NAME_BYTES) break;
    out.push(...b);
  }
  return out;
}
// Code d'une ville. Octets : version, taille, longueur du nom puis le nom, les 6 octets de l'identifiant, le nombre
// d'éléments, puis 3 octets par élément (rang dans SHARE_ITEMS, x << 4 | y, niveau << 3 | étape), enfin les fleurs du Grand
// Arbre, un bit par domaine — à zéro sans Grand Arbre en fleurs, pour ne rien dire de plus que ce que la ville montre.
function encodeCity(state = S) {
  const id = state === S ? ensureShareId() : SHARE_ID.test(state.shareId || '') ? state.shareId : '000000000000';
  const tiles = state.city.tiles.filter(tile => SHARE_ITEMS.includes(tile.item)), name = shareNameBytes(state);
  const blooming = state.city.tiles.some(tile => tile.item === 'grandarbre' && tile.stage >= ITEMS.grandarbre.wonder.length);
  const flowers = blooming ? weekCats(today(), state).reduce((bits, cat) => bits | (1 << CAT_ORDER.indexOf(cat)), 0) : 0;
  const bytes = [SHARE_VERSION, state.city.size, name.length, ...name, ...id.match(/../g).map(hex => parseInt(hex, 16)), tiles.length];
  for (const tile of tiles) bytes.push(SHARE_ITEMS.indexOf(tile.item), (tile.x << 4) | tile.y, (buildingLevelInfo(tile.item, state).level << 3) | (tile.stage || 0));
  bytes.push(flowers);
  return toBase64url(bytes);
}
// Ville lue dans un code, ou null s'il n'est pas lisible (jamais d'erreur). Les éléments inconnus, hors du terrain ou en
// double à la même place sont écartés sans refuser le reste. Le nom est nettoyé par cleanName : sans caractères invisibles, de 40 caractères au plus.
function decodeCity(code) {
  try {
    if (typeof code !== 'string' || !code || code.length > SHARE_CODE_MAX || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
    const bytes = fromBase64url(code);
    let at = 0;
    const take = n => { if (at + n > bytes.length) throw new RangeError('court'); at += n; return bytes.subarray(at - n, at); };
    const next = () => take(1)[0];
    if (next() !== SHARE_VERSION) return null;
    const size = next();
    if (!SIZES.includes(size)) return null;
    // Le même nettoyage que pour nos propres noms (cleanName) : un nom sans rien de visible est vide, et la visite montre alors « Une ville amie ».
    const name = cleanName(new TextDecoder().decode(take(next())), SHARE_NAME_CHARS);
    const id = [...take(6)].map(b => b.toString(16).padStart(2, '0')).join('');
    const count = next(), tiles = [], used = new Set();
    for (let k = 0; k < count; k++) {
      const [rank, place, info] = take(3), item = SHARE_ITEMS[rank], x = place >> 4, y = place & 15;
      if (!item || !ITEMS[item] || x >= size || y >= size || used.has(place)) continue;
      used.add(place);
      const tile = { id: 'v' + k, item, x, y, level: Math.min(3, info >> 3) };
      if (isWonder(item)) tile.stage = clamp(info & 7, 1, ITEMS[item].wonder.length);
      tiles.push(tile);
    }
    const bits = next(), flowers = CAT_ORDER.filter((cat, i) => bits & (1 << i));
    for (const tile of tiles) if (tile.item === 'grandarbre') tile.flowers = flowers;
    return { id, name, size, tiles, flowers };
  } catch (e) { return null; }
}
const shareLink = code => location.origin + location.pathname + '#ville=' + code;
// L'adresse de l'app comme on la tape, pour les images partagées (lubachma.github.io/ville-du-bien-etre) : l'hôte et le chemin de la page, sans
// protocole, sans « index.html » ni barre finale. C'est le seul endroit qui sait comment l'écrire ; shareLink garde l'adresse entière.
const appAddress = () => (location.origin + location.pathname).replace(/^[^:/]+:\/\//, '').replace(/\/index\.html$/i, '').replace(/\/+$/, '');
// Le code d'un lien de ville trouvé dans un texte collé, ou un code collé seul (qui doit alors se lire).
function codeFromText(text) {
  const value = String(text || ''), link = value.match(/#ville=([A-Za-z0-9_-]*)/);
  if (link) return link[1];
  const bare = value.trim();
  return /^[A-Za-z0-9_-]+$/.test(bare) && decodeCity(bare) ? bare : null;
}
// Carte postale d'une ville visitée : une par ville (une nouvelle visite la met à jour), 50 au plus (la plus ancienne
// part), jamais sa propre ville. N'enregistre pas.
function keepPostcard(snapshot, code) {
  if (!snapshot || !SHARE_ID.test(snapshot.id) || snapshot.id === S.shareId) return false;
  S.postcards = { ...(S.postcards || {}), [snapshot.id]: { code, name: snapshot.name, size: snapshot.size, count: snapshot.tiles.length, at: nowTs() } };
  const ids = Object.keys(S.postcards).sort((a, b) => S.postcards[a].at - S.postcards[b].at);
  while (ids.length > POSTCARDS_MAX) delete S.postcards[ids.shift()];
  return true;
}
