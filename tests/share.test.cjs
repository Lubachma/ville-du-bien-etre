const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { loadApp, plain } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js',
  '25-challenges.js', '26-summaries.js', '27-share.js', '46-features.js'];
const EXPOSE = ['encodeCity', 'decodeCity', 'shareLink', 'codeFromText', 'keepPostcard', 'ensureShareId', 'buildingLevel'];
const app = () => loadApp(FILES, { expose: EXPOSE,
  globals: { btoa, atob, crypto: webcrypto, location: { origin: 'https://lubachma.github.io', pathname: '/ville-du-bien-etre/' } } });
const ITEMS_ORDER = ['arbre', 'fleurs', 'chemin', 'banc', 'lampadaire', 'etang', 'maison', 'boulangerie', 'serre', 'bibliotheque', 'ecole', 'observatoire',
  'terrain', 'piscine', 'stade', 'jardin', 'fontaine', 'pavillon', 'kiosque', 'atelier', 'theatre', 'horloge', 'lavoir', 'moulin', 'marche', 'musee', 'universite',
  'planetarium', 'skatepark', 'escalade', 'gymnase', 'labyrinthe', 'source', 'pagode', 'galerie', 'cinema', 'chapiteau', 'haie', 'cerisier', 'livres', 'lanterne',
  'potager', 'cadran', 'pasjaponais', 'fanions', 'nichoir', 'statue', 'grandarbre', 'phare', 'granderoue', 'arche'];
const STAGES = { grandarbre: 4, phare: 2, granderoue: 1 };
// Une ville de la taille voulue, ses cases remplies dans l'ordre par les éléments donnés.
function town(a, size, items, name) {
  const s = a.state;
  s.city.size = size;
  s.city.tiles = items.map((item, i) => ({ id: 't' + i, item, x: i % size, y: Math.floor(i / size), at: s.createdAt, paid: 0, ...(STAGES[item] ? { stage: STAGES[item] } : {}) }));
  s.personal = { ...s.personal, name };
  return s;
}
const bytes = code => Buffer.from(code, 'base64url');

test('lien de ville : aller-retour fidèle (nom, taille, éléments, étapes, niveaux, fleurs)', () => {
  const a = app(), s = town(a, 9, ITEMS_ORDER, 'Ville d’Élodie 🌸');
  for (const cat of ['esprit', 'corps', 'calme', 'foyer', 'crea']) s.stats.byCat[cat] = 20000;
  s.stats.dailyCats['2026-10-14'] = { calme: 10, crea: 5 };
  const city = plain(a.decodeCity(a.encodeCity()));
  assert.equal(city.id, s.shareId);
  assert.deepEqual([city.name, city.size, city.flowers], ['Ville d’Élodie 🌸', 9, ['calme', 'crea']]);
  assert.deepEqual(city.tiles.map(({ item, x, y, stage, level }) => ({ item, x, y, stage, level })),
    s.city.tiles.map(({ item, x, y, stage }) => ({ item, x, y, stage, level: a.buildingLevel(item) })));
  assert.ok(city.tiles.some(tile => tile.level === 3));
  assert.deepEqual(city.tiles.find(tile => tile.item === 'grandarbre').flowers, ['calme', 'crea']);
  assert.equal(city.tiles.find(tile => tile.item === 'phare').stage, 2);
});

test('lien de ville : une ville de 11 × 11 pleine tient en moins de 1 000 caractères, sans rien d’autre', () => {
  const a = app(), name = 'Ma très belle ville au bord du lac';
  town(a, 11, Array.from({ length: 121 }, (_, i) => ITEMS_ORDER[i % 47]), name);
  const code = a.encodeCity(), link = a.shareLink(code);
  assert.ok(link.length < 1000, link.length + ' caractères');
  assert.ok(link.startsWith('https://lubachma.github.io/ville-du-bien-etre/#ville='));
  assert.deepEqual(Object.keys(a.decodeCity(code)).sort(), ['flowers', 'id', 'name', 'size', 'tiles']);
  assert.equal(bytes(code).length, 3 + Buffer.byteLength(name) + 6 + 1 + 3 * 121 + 1);
  assert.doesNotMatch(code, /=/);
});

test('lien de ville : un nom par défaut s’encode vide, et pas de fleurs sans Grand Arbre fleuri', () => {
  for (const name of ['Ma ville', 'My town', '']) {
    const a = app(), s = town(a, 7, ['banc'], name);
    s.stats.dailyCats['2026-10-14'] = { calme: 10 };
    const city = a.decodeCity(a.encodeCity());
    assert.deepEqual([city.name, plain(city.flowers)], ['', []], name);
  }
});

test('lien abîmé : refusé sans erreur ; éléments inconnus, hors terrain ou en double écartés', () => {
  const a = app();
  town(a, 7, ['banc', 'arbre'], 'Ici');
  const code = a.encodeCity(), raw = bytes(code);
  const v2 = Buffer.from(raw); v2[0] = 2;
  for (const bad of ['', 'xx', '!!!!', 'A'.repeat(5000), v2.toString('base64url'), code.slice(0, -6), null, 42]) assert.equal(a.decodeCity(bad), null, String(bad).slice(0, 20));
  // Un élément inconnu (indice 250), un hors du terrain (x = 9 sur 7), un en double sur la première case.
  const L = raw[2], at = 3 + L + 6, extra = Buffer.from([250, 0x11, 0, 0, 0x90, 0, 3, (raw[at + 2]), 0]);
  const forged = Buffer.concat([raw.subarray(0, at), Buffer.from([raw[at] + 3]), raw.subarray(at + 1, raw.length - 1), extra, raw.subarray(raw.length - 1)]);
  assert.deepEqual(plain(a.decodeCity(forged.toString('base64url')).tiles.map(tile => tile.item)), ['banc', 'arbre']);
});

test('lien de ville : un nom avec des balises reste du texte, sans caractères de contrôle, et coupé à 40 caractères', () => {
  const a = app();
  town(a, 7, [], '<b>Ville</b>');
  assert.equal(a.decodeCity(a.encodeCity()).name, '<b>Ville</b>');
  town(a, 7, [], 'A\u0007B\u202eC' + 'x'.repeat(50));
  assert.equal(a.decodeCity(a.encodeCity()).name, 'ABC' + 'x'.repeat(37));
  // À l'envoi, le nom tient en 60 octets, coupé sur un caractère entier.
  town(a, 7, [], 'é'.repeat(40));
  assert.equal(a.decodeCity(a.encodeCity()).name, 'é'.repeat(30));
});

test('lien de ville : un nom fait de caractères invisibles compte comme vide ; les émojis composés restent entiers', () => {
  const a = app();
  town(a, 7, [], '\u200b\u200d\ufeff\u2060 ');
  assert.equal(a.decodeCity(a.encodeCity()).name, '');
  town(a, 7, [], '\u200eVille\u200f');
  assert.equal(a.decodeCity(a.encodeCity()).name, 'Ville');
  town(a, 7, [], 'Atelier \u{1F469}\u200d\u{1F4BB}');
  assert.equal(a.decodeCity(a.encodeCity()).name, 'Atelier \u{1F469}\u200d\u{1F4BB}');
});

test('sources : aucun caractère invisible ou de direction écrit tel quel (ils s’écrivent \\u…)', () => {
  const fs = require('node:fs'), path = require('node:path'), dir = path.join(__dirname, '..', 'src');
  const hidden = /[\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/;
  const found = fs.readdirSync(dir).filter(name => hidden.test(fs.readFileSync(path.join(dir, name), 'utf8')));
  assert.deepEqual(found, []);
});

test('lien collé : le code se retrouve dans un message ou seul ; un mot n’est pas un code', () => {
  const a = app();
  town(a, 7, ['banc'], 'Ici');
  const code = a.encodeCity();
  assert.equal(a.codeFromText('Regarde ma ville https://lubachma.github.io/ville-du-bien-etre/#ville=' + code + ' !'), code);
  assert.equal(a.codeFromText('  ' + code + '\n'), code);
  assert.equal(a.codeFromText('bonjour'), null);
  assert.equal(a.codeFromText(''), null);
});

test('cartes postales : une par ville, mise à jour à chaque visite ; 50 au plus ; jamais sa propre ville', () => {
  const a = app(), s = a.state, base = Date.parse('2026-10-18T12:00:00Z');
  const card = (i, name = 'Ville ' + i) => ({ id: i.toString(16).padStart(12, '0'), name, size: 7, tiles: [{ id: 'v0', item: 'banc', x: 0, y: 0, level: 0 }] });
  for (let i = 1; i <= 51; i++) { s.clock.maxSeen = base + i * 1000; assert.equal(a.keepPostcard(card(i), 'code' + i), true); }
  assert.equal(Object.keys(s.postcards).length, 50);
  assert.equal(card(1).id in s.postcards, false);
  s.clock.maxSeen = base + 99000;
  a.keepPostcard(card(2, 'Ville renommée'), 'nouveau');
  assert.deepEqual(plain(s.postcards[card(2).id]), { code: 'nouveau', name: 'Ville renommée', size: 7, count: 1, at: base + 99000 });
  assert.equal(Object.keys(s.postcards).length, 50);
  const own = { ...card(60), id: a.ensureShareId() };
  assert.equal(a.keepPostcard(own, 'moi'), false);
  assert.equal(own.id in s.postcards, false);
});

test('identifiant de partage : créé une seule fois, 12 chiffres hexadécimaux', () => {
  const a = app();
  assert.equal(a.state.shareId, '');
  const id = a.ensureShareId();
  assert.match(id, /^[0-9a-f]{12}$/);
  assert.equal(a.ensureShareId(), id);
  assert.equal(a.state.shareId, id);
});
