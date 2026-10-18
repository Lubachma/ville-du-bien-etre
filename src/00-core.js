/* =========================================================================
   Constantes du jeu
   ========================================================================= */
const RATE = 1000000;              // pièces gagnées par minute d'activité (10 min = 10 M)
const LS_KEY = 'ville-bien-etre/v2';
const LEGACY_LS_KEY = 'ville-bien-etre/v1';
const LS_BASE = 'ville-bien-etre/v2:base';       // dernier état connu du compte (base des fusions)
const LS_DEVICE = 'ville-bien-etre/v1:device';
const LS_BEAT = 'ville-bien-etre/v2:beat';       // battement de la session en cours (onglets)
const LS_WAKE_ACK = 'ville-bien-etre/v1:wake-ok';
const LS_BACKUP_AT = 'ville-bien-etre/v1:backup-at';     // dernière sauvegarde faite depuis cet appareil
const LS_REMIND = 'ville-bien-etre/v1:backup-later';     // rappel de sauvegarde reporté jusqu'à cette date
const LS_REMINDER = 'ville-bien-etre/v1:reminder-time';   // heure du rappel quotidien (agenda), propre à l'appareil
const LS_CARNET_SEEN = 'ville-bien-etre/v1:carnet-seen';  // succès et ensembles déjà vus dans le carnet, sur cet appareil
const LS_MOOD_CARD = 'ville-bien-etre/v1:mood-card';      // carte des moments difficiles : quand elle a été fermée, sur cet appareil
const BACKUP_EVERY = 14 * 86400000;                       // rappel quand la dernière sauvegarde a plus de 14 jours
const HISTORY_MAX = 150;
const LIST_MAX = 60;
const DURATIONS = [5, 10, 15, 20, 25, 30, 45, 60];
const DRAW_BONUS = { wishes: 20, chores: 50 };   // bonus en % quand on accepte le premier tirage
const DRAW_MIN_POOL = 3;                          // idées minimum pour qu'un tirage donne un bonus
const RETURN_BONUS = 20;                          // cadeau de bon retour en %, après au moins 2 jours d'absence
const GRACE_CHOICES = [5, 10, 20];
const THEMES = ['auto', 'light', 'dark'];
const SOUND_TYPES = ['chime', 'bowl', 'bells'];                 // sons de fin proposés
const SOUND_GAIN = { soft: .5, normal: 1, loud: 1.6 };          // volume : multiplicateur du son
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];  // notes des poses enchaînées (Hz)
const SIZES = [7, 9, 11];
const EXPAND_PRICE = { 9: 120e6, 11: 400e6 };
const DUP_STEP = 0.5;                             // chaque exemplaire supplémentaire coûte 50 % de plus
const COINS_MAX = 1e13;
const NIGHT_TINT = '#16233a';
const SVGNS = 'http://www.w3.org/2000/svg';
const BACKUP_SALT = 'vbe/2026/ville-du-bien-etre/sauvegarde';

const CAT_ORDER = ['esprit', 'corps', 'calme', 'foyer', 'crea'];
// Rubriques de la boutique, dans l'ordre ; noms dans les dictionnaires (cat.* et group.*).
const GROUPS = ['decor', 'foyer', 'esprit', 'corps', 'calme', 'crea', 'prestige'];

// Prix des 22 éléments d'origine : au moins 1,5 M par minute exigée pour débloquer, pour que les pièces gardent leur valeur.
// Ceux de l'étape 2 suivent la simulation de rythme (tests/pacing.test.cjs) : environ un an à 30 min par jour.
// hf = hauteur approximative du dessin (en largeurs de case) pour les vignettes et la sélection.
const ITEMS = {
  arbre:        { group: 'decor', price: 2e6, hf: .62 },
  fleurs:       { group: 'decor', price: 1e6, hf: .12, ground: true },
  chemin:       { group: 'decor', price: 5e5, hf: .06, ground: true },
  banc:         { group: 'decor', price: 2e6, hf: .28 },
  lampadaire:   { group: 'decor', price: 3e6, hf: .78 },
  etang:        { group: 'decor', price: 6e6, hf: .1, ground: true },
  maison:       { group: 'foyer', price: 5e6, need: 0, fem: true, hf: .72 },
  boulangerie:  { group: 'foyer', price: 15e6, need: 1, fem: true, hf: .56 },
  serre:        { group: 'foyer', price: 180e6, need: 120, fem: true, hf: .5 },
  bibliotheque: { group: 'esprit', price: 10e6, need: 1, fem: true, hf: .58 },
  ecole:        { group: 'esprit', price: 90e6, need: 60, fem: true, hf: .78 },
  observatoire: { group: 'esprit', price: 450e6, need: 300, hf: .66 },
  terrain:      { group: 'corps', price: 10e6, need: 1, hf: .12, ground: true },
  piscine:      { group: 'corps', price: 140e6, need: 90, fem: true, hf: .38, ground: true },
  stade:        { group: 'corps', price: 600e6, need: 400, hf: .76 },
  jardin:       { group: 'calme', price: 8e6, need: 1, hf: .3, ground: true },
  fontaine:     { group: 'calme', price: 70e6, need: 45, fem: true, hf: .46 },
  pavillon:     { group: 'calme', price: 230e6, need: 150, hf: .62 },
  kiosque:      { group: 'crea', price: 10e6, need: 1, hf: .62 },
  atelier:      { group: 'crea', price: 90e6, need: 60, hf: .65 },
  theatre:      { group: 'crea', price: 360e6, need: 240, hf: .72 },
  horloge:      { group: 'prestige', price: 1.5e9, needTotal: 1000, fem: true, hf: 1.5 },
  // Étape 2 : trois bâtiments de plus par domaine (prix tirés de la simulation de rythme).
  lavoir:      { group: 'foyer', price: 250e6, need: 500, hf: .62 },
  moulin:      { group: 'foyer', price: 450e6, need: 1000, hf: .85 },
  marche:      { group: 'foyer', price: 700e6, need: 1600, hf: .6 },
  musee:       { group: 'esprit', price: 250e6, need: 500, hf: .56 },
  universite:  { group: 'esprit', price: 450e6, need: 1000, fem: true, hf: .74 },
  planetarium: { group: 'esprit', price: 700e6, need: 1600, hf: .42 },
  skatepark:   { group: 'corps', price: 250e6, need: 500, hf: .39, ground: true },
  escalade:    { group: 'corps', price: 450e6, need: 1000, hf: .73 },
  gymnase:     { group: 'corps', price: 700e6, need: 1600, hf: .55 },
  labyrinthe:  { group: 'calme', price: 250e6, need: 500, hf: .15, ground: true },
  source:      { group: 'calme', price: 450e6, need: 1000, fem: true, hf: .38 },
  pagode:      { group: 'calme', price: 700e6, need: 1600, fem: true, hf: .82 },
  galerie:     { group: 'crea', price: 250e6, need: 500, fem: true, hf: .51 },
  cinema:      { group: 'crea', price: 450e6, need: 1000, hf: .6 },
  chapiteau:   { group: 'crea', price: 700e6, need: 1600, hf: .73 },
  // Décors débloqués aux minutes totales, puis décors offerts par un succès (reward).
  haie:        { group: 'decor', price: 1e6, needTotal: 30, fem: true, hf: .3 },
  cerisier:    { group: 'decor', price: 3e6, needTotal: 90, hf: .5 },
  livres:      { group: 'decor', price: 2e6, needTotal: 150, fem: true, hf: .5 },
  lanterne:    { group: 'decor', price: 3e6, needTotal: 240, fem: true, hf: .41 },
  potager:     { group: 'decor', price: 2e6, needTotal: 360, hf: .12, ground: true },
  cadran:      { group: 'decor', price: 3e6, reward: 'leve-tot', hf: .33 },
  pasjaponais: { group: 'decor', price: 2e6, reward: 'petit-a-petit', hf: .08, ground: true },
  fanions:     { group: 'decor', price: 3e6, reward: 'semaine-equilibree', hf: .82 },
  nichoir:     { group: 'decor', price: 2e6, reward: 'main-verte', hf: .65 },
  statue:      { group: 'decor', price: 4e6, reward: 'cent-heures', fem: true, hf: .57 },
  arche:       { group: 'decor', price: 4e6, reward: 'ville-harmonieuse', fem: true, hf: .95 },
  // Merveilles : 4 étapes [minutes totales, prix] ; price est le prix de la première étape.
  grandarbre:  { group: 'prestige', price: 200e6, wonder: [[1500, 200e6], [1800, 250e6], [2100, 300e6], [2400, 350e6]], hf: 1.19 },
  phare:       { group: 'prestige', price: 350e6, wonder: [[3000, 350e6], [3500, 400e6], [4000, 450e6], [4500, 500e6]], hf: 1.16 },
  granderoue:  { group: 'prestige', price: 500e6, wonder: [[5500, 500e6], [6200, 600e6], [6900, 700e6], [7600, 800e6]], fem: true, hf: 1 },
};

// Succès : famille, condition (kind et ses paramètres) et décor offert. Les conditions sont dans 23-achievements.js.
const ACHIEVEMENTS = [
  { id: 'premier-pas', family: 'start', kind: 'sessions', n: 1 },
  { id: 'premiere-pierre', family: 'start', kind: 'bought', n: 1 },
  { id: 'coup-de-pouce', family: 'start', kind: 'draw', n: 1 },
  { id: 'bien-rode', family: 'start', kind: 'routine', n: 1 },
  { id: 'esprit-curieux', family: 'domains', kind: 'catMinutes', cat: 'esprit', n: 60 },
  { id: 'corps-en-mouvement', family: 'domains', kind: 'catMinutes', cat: 'corps', n: 60 },
  { id: 'grand-calme', family: 'domains', kind: 'catMinutes', cat: 'calme', n: 60 },
  { id: 'nid-douillet', family: 'domains', kind: 'catMinutes', cat: 'foyer', n: 60 },
  { id: 'mains-creatives', family: 'domains', kind: 'catMinutes', cat: 'crea', n: 60 },
  { id: 'semaine-equilibree', family: 'domains', kind: 'weekCats', n: 5, reward: 'fanions' },
  { id: 'leve-tot', family: 'moments', kind: 'endHour', from: 5, to: 8, reward: 'cadran' },
  { id: 'douce-soiree', family: 'moments', kind: 'endHour', from: 20, to: 23 },
  { id: 'petit-a-petit', family: 'moments', kind: 'sessionMin', min: 5, max: 5, reward: 'pasjaponais' },
  { id: 'plongee-profonde', family: 'moments', kind: 'sessionMin', min: 45, max: 180 },
  { id: 'belle-journee', family: 'moments', kind: 'dayMinutes', n: 60 },
  { id: 'journee-variee', family: 'moments', kind: 'dayCats', n: 3 },
  { id: 'sept-jours', family: 'regular', kind: 'activeDays', n: 7 },
  { id: 'trente-jours', family: 'regular', kind: 'activeDays', n: 30 },
  { id: 'cent-jours', family: 'regular', kind: 'activeDays', n: 100 },
  { id: 'sur-ta-lancee', family: 'regular', kind: 'streak', n: 7 },
  { id: 'dix-heures', family: 'time', kind: 'totalMinutes', n: 600 },
  { id: 'cinquante-heures', family: 'time', kind: 'totalMinutes', n: 3000 },
  { id: 'cent-heures', family: 'time', kind: 'totalMinutes', n: 6000, reward: 'statue' },
  { id: 'hameau', family: 'town', kind: 'tiles', n: 10 },
  { id: 'village', family: 'town', kind: 'tiles', n: 25 },
  { id: 'petite-ville', family: 'town', kind: 'tiles', n: 50 },
  { id: 'grands-espaces', family: 'town', kind: 'citySize', n: 11 },
  { id: 'main-verte', family: 'town', kind: 'nature', n: 10, reward: 'nichoir' },
  { id: 'ca-rayonne', family: 'town', kind: 'level', n: 3 },
  { id: 'bon-voisinage', family: 'town', kind: 'sets', n: 1 },
  { id: 'urbaniste', family: 'town', kind: 'sets', n: 12 },
  { id: 'premiere-merveille', family: 'town', kind: 'wonders', n: 1 },
  { id: 'trois-merveilles', family: 'town', kind: 'wonders', n: 3 },
  { id: 'premiere-visite', family: 'life', kind: 'visitors', n: 1 },
  { id: 'bon-accueil', family: 'life', kind: 'visitors', n: 6 },
  { id: 'ville-hospitaliere', family: 'life', kind: 'visitors', n: 12 },
  { id: 'jour-de-fete', family: 'life', kind: 'festivals', n: 1 },
  { id: 'quatre-saisons', family: 'life', kind: 'seasons', n: 4 },
  { id: 'premier-defi', family: 'rituals', kind: 'challenges', n: 1 },
  { id: 'defis-en-serie', family: 'rituals', kind: 'challenges', n: 12 },
  { id: 'semaine-complete', family: 'rituals', kind: 'fullWeek', n: 3 },
  { id: 'carte-postale', family: 'rituals', kind: 'postcards', n: 1 },
  { id: 'premier-souhait', family: 'town', kind: 'townWishes', n: 1 },
  { id: 'habitants-combles', family: 'town', kind: 'townWishes', n: 10 },
  { id: 'ville-harmonieuse', family: 'town', kind: 'stars', n: 5, reward: 'arche' },
];
const NATURE_ITEMS = ['arbre', 'cerisier', 'haie', 'fleurs', 'potager'];
// Ensembles : trois éléments dans un même carré de 3 × 3 cases.
const SETS = [
  { id: 'coin-lecture', items: ['bibliotheque', 'banc', 'arbre'] },
  { id: 'cocon', items: ['maison', 'fleurs', 'haie'] },
  { id: 'place-concert', items: ['kiosque', 'banc', 'lampadaire'] },
  { id: 'place-marche', items: ['boulangerie', 'fontaine', 'lampadaire'] },
  { id: 'jardin-japonais', items: ['pavillon', 'etang', 'cerisier'] },
  { id: 'quartier-artistes', items: ['atelier', 'galerie', 'fleurs'] },
  { id: 'parc-sportif', items: ['terrain', 'piscine', 'skatepark'] },
  { id: 'campus', items: ['ecole', 'bibliotheque', 'universite'] },
  { id: 'petite-ferme', items: ['serre', 'potager', 'moulin'] },
  { id: 'oasis', items: ['source', 'fontaine', 'jardin'] },
  { id: 'nuit-etoilee', items: ['observatoire', 'planetarium', 'lanterne'] },
  { id: 'fete-foraine', items: ['chapiteau', 'granderoue', 'lampadaire'] },
];

// Ville vivante : saisons, moments de la journée et fuseaux de l'hémisphère sud (préfixes terminés par « / »).
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const MOMENTS = ['night', 'dawn', 'day', 'golden', 'dusk'];
// Météo du jour : probabilités (sur 100) par saison, dans l'ordre de WEATHERS.
const WEATHERS = ['sun', 'clouds', 'rain', 'snow', 'fog'];
const WEATHER_ODDS = { spring: [45, 30, 25, 0, 0], summer: [60, 25, 15, 0, 0], autumn: [35, 30, 25, 0, 10], winter: [30, 30, 10, 20, 10] };
// Fêtes de l'année : leurs jours (MM-JJ) au nord et au sud ; l'anniversaire de la ville se calcule.
const FESTIVALS = [
  { id: 'nouvel-an', north: ['12-31', '01-01'], south: ['12-31', '01-01'] },
  { id: 'printemps', north: ['03-20', '03-21', '03-22'], south: ['09-22', '09-23', '09-24'] },
  { id: 'ete', north: ['06-20', '06-21', '06-22'], south: ['12-20', '12-21', '12-22'] },
  { id: 'recoltes', north: ['09-22', '09-23', '09-24'], south: ['03-20', '03-21', '03-22'] },
  { id: 'lumieres', north: ['12-20', '12-21', '12-22'], south: ['06-20', '06-21', '06-22'] },
  { id: 'anniversaire' },
];
// Cadeaux en pièces : visiteur du jour, fête, anniversaire de la ville, défi de la semaine relevé, souhait d'habitant exaucé,
// étoile d'harmonie gagnée.
const GIFTS = { visit: 2e6, fest: 5e6, birthday: 10e6, challenge: 5e6, townWish: 3e6, star: 10e6 };
// Visiteurs : saisons où ils viennent, météo qu'ils aiment, neige récente, endroit où ils se placent (24-ambient.js) ;
// plural pour un nom au pluriel (les canards), qui accorde la légende.
const VISITORS = [
  { id: 'chat', weather: ['sun', 'clouds', 'fog'], spot: 'bench' },
  { id: 'herisson', seasons: ['spring', 'summer', 'autumn'], spot: 'nature' },
  { id: 'ecureuil', seasons: ['autumn', 'winter'], spot: 'tree' },
  { id: 'cigogne', seasons: ['spring', 'summer'], spot: 'roof' },
  { id: 'canards', seasons: ['spring', 'summer', 'autumn'], spot: 'pond', plural: true },
  { id: 'renard', seasons: ['autumn', 'winter'], spot: 'edge' },
  { id: 'chouette', seasons: ['autumn', 'winter'], spot: 'tree' },
  { id: 'montgolfiere', seasons: ['spring', 'summer', 'autumn'], weather: ['sun', 'clouds'], spot: 'sky' },
  { id: 'bonhomme', seasons: ['winter'], snow: true, spot: 'free' },
  { id: 'glaces', seasons: ['summer'], weather: ['sun', 'clouds'], spot: 'path' },
  { id: 'accordeon', weather: ['sun', 'clouds', 'fog'], spot: 'kiosk' },
  { id: 'artiste', seasons: ['spring', 'summer', 'autumn'], weather: ['sun', 'clouds'], spot: 'free' },
];
const VISIT_ODDS = .7;               // un visiteur environ 5 jours sur 7
// Rituels : les défis de la semaine, par famille ; chaque semaine en tire un par famille (25-challenges.js).
const CHALLENGE_FAMILIES = ['practice', 'moment', 'discovery'];
const CHALLENGES = [
  { id: 'domains', family: 'practice' }, { id: 'comeback', family: 'practice' }, { id: 'long', family: 'practice' }, { id: 'twoAreas', family: 'practice' },
  { id: 'morning', family: 'moment' }, { id: 'evening', family: 'moment' }, { id: 'weekend', family: 'moment' },
  { id: 'draw', family: 'discovery' }, { id: 'routine', family: 'discovery' }, { id: 'visitors', family: 'discovery' }, { id: 'build', family: 'discovery' }, { id: 'focus', family: 'discovery' },
];
// Lien de ville : chaque élément s'y écrit par son rang dans cette liste. On ajoute toujours à la fin, sans rien retirer ni déplacer,
// pour que les liens déjà envoyés restent lisibles.
const SHARE_ITEMS = Object.freeze(['arbre', 'fleurs', 'chemin', 'banc', 'lampadaire', 'etang', 'maison', 'boulangerie', 'serre', 'bibliotheque', 'ecole', 'observatoire',
  'terrain', 'piscine', 'stade', 'jardin', 'fontaine', 'pavillon', 'kiosque', 'atelier', 'theatre', 'horloge', 'lavoir', 'moulin', 'marche', 'musee', 'universite',
  'planetarium', 'skatepark', 'escalade', 'gymnase', 'labyrinthe', 'source', 'pagode', 'galerie', 'cinema', 'chapiteau', 'haie', 'cerisier', 'livres', 'lanterne',
  'potager', 'cadran', 'pasjaponais', 'fanions', 'nichoir', 'statue', 'grandarbre', 'phare', 'granderoue', 'arche']);
const POSTCARDS_MAX = 50;            // cartes postales des villes amies gardées dans le carnet
// Harmonie : les cinq étoiles, une par critère (28-harmony.js).
const HARMONY = ['verdure', 'variete', 'details', 'quartiers', 'lumieres'];
// Souhaits des habitants : les décors que les bâtiments de chaque domaine aimeraient avoir juste à côté.
const WISH_LIKES = {
  foyer: ['fleurs', 'haie', 'banc', 'potager'], esprit: ['banc', 'arbre', 'livres', 'lanterne'], corps: ['arbre', 'fanions', 'banc', 'fleurs'],
  calme: ['cerisier', 'etang', 'pasjaponais', 'lanterne'], crea: ['lampadaire', 'fanions', 'statue', 'fleurs'],
};
// Ambiances sonores pendant les séances (51-ambience.js) ; « none » par défaut.
const AMBIENCES = ['none', 'rain', 'waves', 'fire', 'wind', 'brown'];
// Compagnon : trois animaux, dix niveaux de complicité (minutes de séances ensemble), neuf accessoires (COMPANION_WEAR[i] au
// niveau i + 2), un nom de 20 caractères au plus ; respiration guidée des séances Calme : 5 s pour inspirer, 5 s pour expirer.
const COMPANION_SPECIES = ['lapin', 'marmotte', 'ourson'];
const COMPANION_LEVELS = [0, 20, 60, 120, 240, 420, 660, 960, 1320, 1800];
const COMPANION_WEAR = ['echarpe', 'bonnet', 'lunettes', 'couronne', 'noeud', 'paille', 'sac', 'casque', 'cape'];
const COMPANION_NAME_MAX = 20;
const BREATH_MS = 5000;
const SOUTH_TZ = ['Australia/', 'Antarctica/', 'America/Argentina/', 'Pacific/Auckland', 'Pacific/Chatham', 'Pacific/Fiji', 'Pacific/Tongatapu',
  'Pacific/Noumea', 'Pacific/Port_Moresby', 'America/Santiago', 'America/Punta_Arenas', 'America/Sao_Paulo', 'America/Montevideo', 'America/Asuncion',
  'America/La_Paz', 'America/Lima', 'Africa/Johannesburg', 'Africa/Maputo', 'Africa/Harare', 'Africa/Lusaka', 'Africa/Windhoek', 'Africa/Gaborone',
  'Indian/Mauritius', 'Indian/Reunion', 'Indian/Antananarivo'];

/* =========================================================================
   Utilitaires
   ========================================================================= */
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isItem = k => typeof k === 'string' && own(ITEMS, k);
const isCat = k => typeof k === 'string' && CAT_ORDER.includes(k);
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const NB = ' ';
// Langue affichée et sa règle typographique ('fr' : espaces insécables du français), fixées par setLang() (05-i18n.js).
let LANG = 'fr';
let TYPO = 'fr';
const frTypo = t => (TYPO === 'fr' ? String(t).replace(/ ([:;!?»])/g, ' $1').replace(/« /g, '« ') : String(t));

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = frTypo(v);
      else if (k === 'vars') { for (const [n, val] of Object.entries(v)) el.style.setProperty(n, val); }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(frTypo(kid)));
  }
  return el;
}
function icon(name, cls) {
  const s = document.createElementNS(SVGNS, 'svg');
  s.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
  s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS(SVGNS, 'use');
  u.setAttribute('href', '#i-' + name);
  s.append(u);
  return s;
}
function catVar(cat) { return 'var(--cat-' + (isCat(cat) || cat === 'prestige' || cat === 'decor' ? cat : 'decor') + ')'; }
function catDot(cat) { return h('span', { class: 'cat-dot', vars: { '--c': catVar(cat) }, 'aria-hidden': 'true' }); }
function catLabel(cat) { return h('span', { class: 'cat-label' }, catDot(cat), isCat(cat) ? catName(cat) : groupName(cat)); }

function dec1(x) {
  const r = Math.round(x * 10) / 10;
  if (Math.abs(r) >= 100) return String(Math.round(x));
  const s = Number.isInteger(r) ? String(r) : r.toFixed(1);
  return s.replace('.', t('fmt.decimal'));
}
function fmt(n) {
  if (!Number.isFinite(n)) return '0';
  const a = Math.abs(n);
  if (a >= 1e9) return dec1(n / 1e9) + NB + t('fmt.billion');
  if (a >= 1e6) return dec1(n / 1e6) + NB + t('fmt.million');
  if (a >= 1e3) return Math.round(n / 1e3) + NB + t('fmt.thousand');
  return String(Math.round(n));
}
function fmtMin(m) {
  m = Math.round(m);
  if (m < 60) return t('fmt.min', { n: m });
  const hh = Math.floor(m / 60), mm = m % 60;
  return mm ? t('fmt.hoursMinutes', { h: hh, mm: pad2(mm) }) : t('fmt.hours', { h: hh });
}
function fmtAway(ms) {
  const s = Math.max(1, Math.round(ms / 1000));
  return s >= 60 ? fmtMin(s / 60) : s + NB + 's';
}
function pad2(n) { return String(n).padStart(2, '0'); }
function dbg(msg) { if (window.__ville && window.__ville.log) window.__ville.log.push((Date.now() % 100000) + ' ' + msg); }
function rnd(a, b) { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }

/* Validation des données (sauvegardes, compte, autres onglets) */
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const num = (v, lo, hi, def) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : def);
const int = (v, lo, hi, def) => (typeof v === 'number' && Number.isFinite(v) ? clamp(Math.round(v), lo, hi) : def);
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
// Noms tapés (ville partagée, compagnon) : caractères de contrôle, de direction et invisibles retirés ; les liants des émojis
// composés (U+200C, U+200D) restent, et un nom sans rien de visible compte comme vide.
const HIDDEN_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g;
const VISIBLE_CHAR = /[^\s\u200c\u200d]/;
const idOf = v => (typeof v === 'string' && v.length > 0 && v.length <= 40 && /^[\w-]+$/.test(v) ? v : uid());
const isDayKey = k => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);
const validTs = v => typeof v === 'number' && Number.isFinite(v) && v > 1.5e12 && v < 4.1e12;

/* Empreinte non cryptographique (cyrb53) : rend visible une sauvegarde modifiée à la main */
function hash53(text) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
function b64encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64decode(b64) {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/* Couleurs */
function hexToRgb(hex) {
  hex = String(hex).trim();
  if (hex.startsWith('rgb')) { const m = hex.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2] }; }
  if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  const n = parseInt(hex.slice(1, 7), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex({ r, g, b }) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function mix(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t }); }
function shade(c, amt) { if (String(c).startsWith('rgba')) return c; return amt >= 0 ? mix(c, '#ffffff', amt) : mix(c, '#000000', -amt); }
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

