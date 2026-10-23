const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { storage, lockManager, stateApp, FILES } = require('./helpers/state-vm.cjs');
const { loadApp } = require('./helpers/app.cjs');

// Étape 8, les premiers pas : « ville sans séance » se lit dans les compteurs (S.stats), jamais dans l'historique.
// Les villes amorcées des tests, et les vieilles sauvegardes, ont des séances comptées et un historique vide.
const app = () => stateApp(undefined, undefined, { expose: ['isNewTown'] });

test("ville sans séance : ni réussie ni interrompue, l'historique ne compte pas", () => {
  const a = app();
  assert.equal(a.isNewTown(), true, 'une ville neuve est sans séance');

  // Une séance réussie, et rien dans l'historique : la ville a déjà vécu une séance.
  a.api.state.stats.ok = 1;
  assert.equal(a.api.state.history.length, 0);
  assert.equal(a.isNewTown(), false);

  // Une séance interrompue compte aussi.
  a.api.state = a.defaultState();
  assert.equal(a.isNewTown(), true);
  a.api.state.stats.ko = 1;
  assert.equal(a.isNewTown(), false);

  // Des lignes d'historique sans séance comptée ne changent rien : seuls les compteurs décident.
  a.api.state = a.defaultState();
  a.api.state.history = [{ id: 'x', name: 'Lecture', cat: 'esprit', min: 5, ok: true, at: 1 }];
  assert.equal(a.isNewTown(), true);
});

// La carte « Bienvenue » : montrée à une ville sans séance que personne n'a fermée, tant qu'aucune séance ne tourne.
// La VM charge les fichiers par défaut du helper, et celui de la carte.
const CLOSED = 'ville-bien-etre/v1:welcome-closed';
const welcomeApp = disk => stateApp(disk, undefined, { files: [...FILES, '59-first-steps.js'], expose: ['welcomeShown', 'closeWelcome', 'resetWelcome'] });

test("accueil : une ville sans séance, ni fermée sur l'appareil, ni en séance", () => {
  const disk = storage();
  const a = welcomeApp(disk);
  assert.equal(a.welcomeShown(), true, 'une ville neuve');

  // La croix range « 1 » sur l'appareil, et rien d'autre ne ferme la carte.
  disk.setItem(CLOSED, '1');
  assert.equal(a.welcomeShown(), false, 'fermée');
  disk.setItem(CLOSED, '0');
  assert.equal(a.welcomeShown(), true, 'seule la valeur « 1 » la ferme');
  disk.removeItem(CLOSED);
  assert.equal(a.welcomeShown(), true, '« Tout recommencer » efface la clé : la carte revient');

  // Une séance en cours (ici ou dans un autre onglet) la cache, même sans séance comptée.
  a.api.state.active = { id: 'premiere', name: 'Respirer', cat: 'calme', min: 2 };
  assert.equal(a.welcomeShown(), false, 'séance en cours');
  a.api.state.active = null;
  assert.equal(a.welcomeShown(), true);

  // Une séance comptée la cache pour de bon, réussie ou interrompue.
  a.api.state.stats.ok = 1;
  assert.equal(a.welcomeShown(), false, 'une séance réussie');
  a.api.state = a.defaultState();
  a.api.state.stats.ko = 1;
  assert.equal(a.welcomeShown(), false, 'une séance interrompue');

  // Un stockage qu'on ne peut pas lire ne dit pas que la carte est fermée.
  a.api.state = a.defaultState();
  disk.getItem = () => { throw new Error('SecurityError'); };
  assert.equal(a.welcomeShown(), true, 'stockage illisible');
});

test("accueil : la croix cache la carte pour la page même si le stockage refuse l'écriture, « Tout recommencer » la rend", () => {
  const disk = storage();
  const a = welcomeApp(disk);
  disk.fail = true;   // stockage plein : setItem lève une erreur
  assert.equal(a.welcomeShown(), true);
  a.closeWelcome();
  assert.equal(disk.data.size, 0, "rien n'a pu être rangé");
  assert.equal(a.welcomeShown(), false, 'cachée pour le reste de la page');
  assert.equal(a.welcomeShown(), false, 'et au rendu suivant');
  a.resetWelcome();
  assert.equal(a.welcomeShown(), true, '« Tout recommencer » la rend à la page');

  // Avec un stockage qui marche : la croix range « 1 », « Tout recommencer » l'efface, et la page l'oublie aussi.
  disk.fail = false;
  a.closeWelcome();
  assert.equal(disk.getItem(CLOSED), '1');
  assert.equal(a.welcomeShown(), false);
  a.resetWelcome();
  assert.equal(disk.getItem(CLOSED), null);
  assert.equal(a.welcomeShown(), true);

  // Un stockage qui refuse d'effacer ne fait pas échouer « Tout recommencer ».
  disk.removeItem = () => { throw new Error('SecurityError'); };
  assert.doesNotThrow(() => a.resetWelcome());
});

// La première séance respire : la respiration guidée est un champ facultatif de la séance en cours (S.active.breathing), posé par la
// première séance de l'accueil. Le réglage de la personne (S.settings.breathing) n'est jamais touché.
const START = Date.parse('2026-10-17T12:00:00Z');   // l'instant où part l'horloge de la VM (state-vm.cjs), valide pour une séance
const settle = () => new Promise(resolve => setTimeout(resolve, 10));
// Une séance de Concentration menée jusqu'à sa fin, une seconde à la fois : un saut de deux minutes compterait comme une sortie.
async function runToEnd(a, min) {
  for (let second = 0; second < min * 60; second++) { a.advance(1000); a.tick(); }
  await settle(); await settle();
}
// Un onglet ouvert sur une ville neuve, où la séance donnée vient de démarrer.
async function started(options) {
  const a = stateApp(); a.init();
  await a.startSession(options);
  return a;
}

test("séance : le champ breathing n'est gardé que s'il est booléen", () => {
  const a = stateApp(undefined, undefined, { expose: ['cleanActive'] });
  const clean = extra => a.cleanActive({ name: 'Respirer', cat: 'calme', startedAt: START, ...extra });
  assert.equal(clean({ breathing: true }).breathing, true);
  assert.equal(clean({ breathing: false }).breathing, false);
  assert.equal('breathing' in clean({}), false, 'sans le champ : pas de clé');
  for (const odd of ['oui', 'true', 1, 0, null, {}, []]) assert.equal('breathing' in clean({ breathing: odd }), false, `${JSON.stringify(odd)} n'est pas un booléen`);
  // Relue du stockage, la séance garde le champ de la même façon.
  assert.equal(a.normalize({ active: { name: 'Respirer', cat: 'calme', startedAt: START, breathing: true } }).active.breathing, true);
  assert.equal('breathing' in a.normalize({ active: { name: 'Respirer', cat: 'calme', startedAt: START, breathing: 'oui' } }).active, false);
});

test('première séance : respiration de la séance, réglage inchangé, 2 M gagnés', async () => {
  const a = await started({ name: 'Respirer', cat: 'calme', min: 2, mode: 'focus', breathing: true });
  assert.equal(a.api.state.active.breathing, true);
  assert.equal(a.api.state.settings.breathing, false);
  await runToEnd(a, 2);
  assert.equal(a.api.state.active, null, 'la séance est finie');
  assert.equal(a.api.state.history[0].ok, true);
  assert.equal(a.api.state.history[0].reward, 2e6);
  assert.equal(a.api.state.stats.byCat.calme, 2);
  assert.equal(a.api.state.settings.breathing, false, 'le réglage de la personne reste éteint');
});

test("séance : sans respiration propre, aucun champ ; un « non » de la séance reste un choix", async () => {
  // Une séance ordinaire ne porte rien : c'est le réglage de la personne qui décide, comme avant.
  assert.equal('breathing' in (await started({ name: 'Lecture', cat: 'esprit', min: 5, mode: 'focus' })).api.state.active, false);
  assert.equal('breathing' in (await started({ name: 'Respirer', cat: 'calme', min: 5, mode: 'focus' })).api.state.active, false);
  // Ce qui n'est pas un booléen n'est pas une respiration de séance.
  assert.equal('breathing' in (await started({ name: 'Respirer', cat: 'calme', min: 5, mode: 'focus', breathing: 'oui' })).api.state.active, false);
  // « Recommencer » redonne le choix de la séance interrompue, y compris quand la personne l'avait éteint pour cette séance.
  assert.equal((await started({ name: 'Respirer', cat: 'calme', min: 5, mode: 'focus', breathing: false })).api.state.active.breathing, false);
  assert.equal((await started({ name: 'Respirer', cat: 'calme', min: 5, mode: 'focus', breathing: true })).api.state.active.breathing, true);
});

test("séance : la respiration de la séance est enregistrée avec elle, et un rechargement la relit", async () => {
  const disk = storage(), locks = lockManager(), a = stateApp(disk, locks);
  a.init();
  await a.startSession({ name: 'Respirer', cat: 'calme', min: 2, mode: 'free', breathing: true });
  assert.equal(JSON.parse(disk.getItem('ville-bien-etre/v2')).active.breathing, true, 'écrite avec la séance');
  const reloaded = stateApp(disk, locks);
  reloaded.init();
  assert.equal(reloaded.api.state.active.breathing, true, 'relue après un rechargement');
  assert.equal(reloaded.api.state.settings.breathing, false, 'le réglage de la personne reste éteint');
  // Le bouton de la séance change la séance, enregistrée aussitôt : un rechargement relit ce choix-là.
  a.api.state.active.breathing = false;
  a.api.commit({ silent: true });
  const again = stateApp(disk, locks);
  again.init();
  assert.equal(again.api.state.active.breathing, false);
  assert.equal(again.api.state.settings.breathing, false);
});

// L'aide « Bien démarrer » ne demande plus d'installer l'app avant de commencer : on commence ici, sans rien installer, et sur iPhone on
// copie sa ville vers l'app installée pour la coller à sa première ouverture (« Copier ma ville » est le bouton de la carte d'installation).
test("aide : on peut commencer ici, sans rien installer ; sur iPhone, la ville se copie vers l'app installée", () => {
  const { DICT } = stateApp(undefined, undefined, { expose: ['DICT'] });
  const fr = DICT.fr['help.installFirst'], en = DICT.en['help.installFirst'];
  assert.equal(fr, 'Tu peux commencer ici, sans rien installer. Sur iPhone, installe l’app quand tu veux : copie ta ville avec « Copier ma ville », puis colle-la à la première ouverture de l’app.');
  assert.equal(en, 'You can start right here, with nothing to install. On iPhone, install the app whenever you like: copy your town with “Copy my town”, then paste it the first time you open the app.');
  for (const text of [fr, en]) assert.doesNotMatch(text, /avant de commencer|before you start/);
});

// Les textes français de l'étape 8 s'écrivent avec l'apostrophe typographique (’, U+2019), comme leurs voisins (help.*, install.ios) : jamais
// l'apostrophe droite. L'anglais garde sa convention.
const STAGE8_FR = ['help.installFirst', 'backup.openSection', 'tpl.breathe', 'install.title', 'install.iosWhy', 'install.ios', 'install.iosCopy', 'install.copy',
  'install.copied', 'install.copyFailed', 'install.prompt', 'install.install', 'install.hide', 'install.help', 'welcome.title', 'welcome.lede', 'welcome.step1',
  'welcome.step2', 'welcome.step3', 'welcome.start', 'welcome.choose', 'welcome.note', 'welcome.close', 'welcome.langs', 'welcome.paste',
  'welcome.pasteTitle', 'welcome.pasteLine', 'welcome.pasteRestore', 'welcome.pasteNone', 'recap.backup', 'visit.pitch', 'visit.grow'];
test("textes français de l'étape 8 : l'apostrophe typographique, jamais l'apostrophe droite", () => {
  const { DICT } = stateApp(undefined, undefined, { expose: ['DICT'] });
  for (const key of STAGE8_FR) {
    assert.equal(typeof DICT.fr[key], 'string', key);
    assert.doesNotMatch(DICT.fr[key], /'/, key);
  }
  // Le bouton des récapitulatifs du mois et de l'année.
  assert.equal(DICT.fr['recap.backup'], 'Sauvegarder ma ville');
  assert.equal(DICT.en['recap.backup'], 'Back up my town');
  // La visite d'un ami, pour un nouveau venu : la ligne sous le nom et la taille, et le bouton qui ferme la visite.
  assert.deepEqual(Object.fromEntries(['visit.pitch', 'visit.grow'].map(key => [key, DICT.fr[key]])), {
    'visit.pitch': 'Cette ville grandit avec de vrais moments : lire, bouger, respirer, ranger, créer.',
    'visit.grow': 'Faire grandir ma ville',
  });
  assert.deepEqual(Object.fromEntries(['visit.pitch', 'visit.grow'].map(key => [key, DICT.en[key]])), {
    'visit.pitch': 'This town grows with real moments: reading, moving, breathing, tidying, creating.',
    'visit.grow': 'Grow my own town',
  });
  // Le texte entier, apostrophes comprises (U+2019).
  assert.deepEqual(Object.fromEntries(['install.title', 'install.iosWhy', 'install.iosCopy', 'install.prompt', 'install.copied', 'install.copyFailed',
    'welcome.close', 'welcome.langs', 'welcome.paste', 'welcome.pasteNone'].map(key => [key, DICT.fr[key]])), {
    'install.title': 'Garde ta ville à l’abri',
    'install.iosWhy': 'Sur iPhone, le navigateur peut effacer un site resté sept jours sans visite, mais pas une app ajoutée à l’écran d’accueil.',
    'install.iosCopy': 'Puis copie ta ville ici et colle-la à la première ouverture de l’app.',
    'install.prompt': 'Installée, l’app s’ouvre depuis ton écran d’accueil et garde ta ville sur ce téléphone.',
    'install.copied': 'Ville copiée : colle-la à la première ouverture de l’app.',
    'install.copyFailed': 'La copie n’a pas marché. Tu peux copier ta ville dans Réglages → Sauvegarde.',
    'welcome.close': 'Fermer l’accueil',
    'welcome.langs': 'Langue de l’app',
    'welcome.paste': 'J’avais commencé dans Safari : coller ma ville',
    'welcome.pasteNone': 'Pas de ville dans le presse-papiers. Copie-la d’abord dans Safari, ou colle-la dans Réglages → Sauvegarde.',
  });
  assert.equal(DICT.en['install.iosWhy'], "On iPhone, the browser may erase a site left seven days without a visit, but not an app added to the Home Screen.");
  assert.equal(DICT.en['install.iosCopy'], 'Then copy your town here and paste it the first time you open the app.');
  assert.deepEqual(Object.fromEntries(['welcome.pasteTitle', 'welcome.pasteLine', 'welcome.pasteRestore', 'welcome.pasteNone'].map(key => [key, DICT.en[key]])), {
    'welcome.pasteTitle': 'Bring back my town',
    'welcome.pasteLine': 'Town found on the clipboard:',
    'welcome.pasteRestore': 'Bring back this town',
    'welcome.pasteNone': 'No town on the clipboard. Copy it in Safari first, or paste it in Settings → Backup.',
  });
});

// Le texte français fixe de la carte « Bienvenue » (index.html, lu avant que le script ne le remplace, ou sans lui) dit la même chose que le
// dictionnaire, apostrophes comprises : texte, et aria-label.
test("carte Bienvenue : le texte français fixe d'index.html est celui du dictionnaire", () => {
  const { DICT } = stateApp(undefined, undefined, { expose: ['DICT'] });
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('<section class="card welcome-card"'), card = html.slice(start, html.indexOf('</section>', start));
  assert.ok(start > 0 && card.includes('id="welcomeTitle"'), 'la carte est dans la page');
  assert.doesNotMatch(card, /'/, 'aucune apostrophe droite dans la carte');
  const decode = text => text.replace(/&nbsp;/g, '\u00a0');
  const pairs = [...card.matchAll(/data-i18n="([^"]+)"[^>]*>([^<]*)</g)].map(m => [m[1], decode(m[2])]);
  pairs.push(...[...card.matchAll(/aria-label="([^"]*)"\s+data-i18n-aria-label="([^"]+)"/g)].map(m => [m[2], decode(m[1])]));
  assert.deepEqual(pairs.map(([key]) => key).sort(), ['welcome.choose', 'welcome.close', 'welcome.langs', 'welcome.lede', 'welcome.note', 'welcome.paste', 'welcome.start',
    'welcome.step1', 'welcome.step2', 'welcome.step3', 'welcome.title']);
  for (const [key, text] of pairs) assert.equal(text, DICT.fr[key], key);
});

// La barre de la visite d'une ville amie (index.html) : « Faire grandir ma ville » est son premier bouton, caché (hidden) tant que l'app ne
// sait pas que la visite est celle d'un nouveau venu, et chaque texte fixe dit la même chose que le dictionnaire.
test("barre de la visite : « Faire grandir ma ville » est le premier bouton, caché, au texte du dictionnaire", () => {
  const { DICT } = stateApp(undefined, undefined, { expose: ['DICT'] });
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('<div class="city-visit-bar"'), bar = html.slice(start, html.indexOf('</div>', start));
  assert.ok(start > 0 && bar.includes('id="visitKeep"'), 'la barre est dans la page');
  const buttons = [...bar.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)].map(m => ({ id: /\bid="([^"]+)"/.exec(m[1])[1],
    key: /\bdata-i18n="([^"]+)"/.exec(m[1])[1], hidden: /\shidden(\s|$)/.test(m[1]), text: m[2] }));
  assert.deepEqual(buttons.map(({ id, key, hidden }) => [id, key, hidden]),
    [['visitGrow', 'visit.grow', true], ['visitKeep', 'visit.keep', false], ['visitShare', 'visit.shareBack', false]]);
  for (const { key, text } of buttons) assert.equal(text, DICT.fr[key], key);
});

// Le rappel de sauvegarde. Dans un onglet de navigateur sur iPhone ou iPad, le navigateur peut effacer un site resté sept jours sans visite : le rappel
// vient dès la première séance réussie, quand la ville et la dernière sauvegarde ont plus de 5 jours. Ailleurs (un autre appareil, l'app installée), la
// règle reste 3 séances réussies et 14 jours. backupDue lit l'horloge, le navigateur et le stockage de l'appareil : un chargement par date, avec les
// fichiers de backup.test.cjs, et le navigateur donné (loadApp remplace navigator et window).
const BACKUP_FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '45-settings.js'];
const BACKUP_AT = 'ville-bien-etre/v1:backup-at', BACKUP_LATER = 'ville-bien-etre/v1:backup-later';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const SAFARI_MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const CHROME_MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
// Les globaux d'un appareil : son navigateur, et si la page y est ouverte comme une app (display-mode: standalone).
const device = (navigator, { displayStandalone = false } = {}) => ({ navigator: { languages: ['fr-CH'], ...navigator }, window: { matchMedia: () => ({ matches: displayStandalone }) } });
const iphone = (extra, options) => device({ userAgent: IPHONE_UA, platform: 'iPhone', maxTouchPoints: 5, ...extra }, options);
const ipad = () => device({ userAgent: SAFARI_MAC_UA, platform: 'MacIntel', maxTouchPoints: 5 });   // l'iPad se présente comme un Mac, mais il a un écran tactile
const mac = () => device({ userAgent: CHROME_MAC_UA, platform: 'MacIntel', maxTouchPoints: 0 });
// Une ville née le 10 octobre 2026, de `ok` séances réussies, changée pour la dernière fois une heure avant `now` (ou à `changed`), regardée à la date `now`
// depuis l'appareil donné. backedUp : la dernière sauvegarde faite depuis cet appareil ; later : « Plus tard » appuyé jusqu'à cette date ; cloud : la
// ville est synchronisée avec un compte ; undated : une ville sans date de création (elle ne peut pas exister : normalize en donne toujours une).
function backupDueOn(now, globals, { ok = 1, backedUp, changed, later, cloud, undated } = {}) {
  const a = loadApp(BACKUP_FILES, { now, expose: ['backupDue', 'lsSet', 'Store'], globals });
  a.state.stats.ok = ok;
  a.state.createdAt = Date.parse('2026-10-10T10:00:00Z');
  if (undated) delete a.state.createdAt;
  a.state.updatedAt = changed ? Date.parse(changed) : Date.parse(now) - 3600000;
  if (backedUp) a.lsSet(BACKUP_AT, Date.parse(backedUp));
  if (later) a.lsSet(BACKUP_LATER, Date.parse(later));
  if (cloud) a.Store.mode = 'cloud';
  return a.backupDue();
}

test('rappel de sauvegarde : sur iPhone dès la première séance, après 5 jours', () => {
  const due = (now, options, globals = iphone()) => backupDueOn(now, globals, options);
  // Une seule séance réussie, une ville née le 10 octobre : à quatre jours rien ne presse, à six le rappel vient (sans attendre trois séances ni 14 jours).
  assert.equal(due('2026-10-14T12:00:00Z'), false, 'quatre jours');
  assert.equal(due('2026-10-16T12:00:00Z'), true, 'six jours');
  // Au-delà de cinq jours seulement : cinq jours pile, non ; une milliseconde de plus, oui.
  assert.equal(due('2026-10-15T10:00:00Z'), false, 'cinq jours pile');
  assert.equal(due('2026-10-15T10:00:00.001Z'), true, 'cinq jours et une milliseconde');
  // Une sauvegarde faite le 13 repart de là : trois jours seulement. Dépassé de nouveau cinq jours après elle, le rappel revient.
  assert.equal(due('2026-10-16T12:00:00Z', { backedUp: '2026-10-13T10:00:00Z' }), false, 'sauvegardée il y a trois jours');
  assert.equal(due('2026-10-19T12:00:00Z', { backedUp: '2026-10-13T10:00:00Z' }), true, 'sauvegardée il y a six jours, la ville a changé depuis');
  // Une ville inchangée depuis sa dernière sauvegarde n'a rien à sauvegarder, même vieille de dix jours.
  assert.equal(due('2026-10-20T12:00:00Z', { backedUp: '2026-10-12T10:00:00Z', changed: '2026-10-12T09:00:00Z' }), false, 'inchangée depuis la sauvegarde');
  // L'iPad aussi (il se présente comme un Mac, mais il a un écran tactile).
  assert.equal(due('2026-10-16T12:00:00Z', {}, ipad()), true, 'iPad, six jours');
  assert.equal(due('2026-10-14T12:00:00Z', {}, ipad()), false, 'iPad, quatre jours');
  // Sans date de création (impossible, mais le calcul reste un nombre) : jamais sauvegardée, la ville est rappelée ; sauvegardée il y a trois jours, non.
  assert.equal(due('2026-10-16T12:00:00Z', { undated: true }), true, 'sans date de création, jamais sauvegardée');
  assert.equal(due('2026-10-16T12:00:00Z', { undated: true, backedUp: '2026-10-13T10:00:00Z' }), false, 'sans date de création, sauvegardée il y a trois jours');
  // Il faut au moins une séance réussie, et le rappel reporté ou une ville synchronisée avec un compte le font taire.
  assert.equal(due('2026-10-16T12:00:00Z', { ok: 0 }), false, 'aucune séance réussie');
  assert.equal(due('2026-10-16T12:00:00Z', { later: '2026-10-20T12:00:00Z' }), false, '« Plus tard »');
  assert.equal(due('2026-10-16T12:00:00Z', { cloud: true }), false, 'ville synchronisée');
  // L'app installée (navigator.standalone, ou display-mode: standalone) n'est pas effacée au bout de sept jours : la règle ordinaire, qui veut trois séances.
  assert.equal(due('2026-10-16T12:00:00Z', {}, iphone({ standalone: true })), false, 'app installée, une séance');
  assert.equal(due('2026-10-16T12:00:00Z', {}, iphone({}, { displayStandalone: true })), false, 'app installée (display-mode), une séance');
  assert.equal(due('2026-10-16T12:00:00Z', { ok: 3 }, iphone({ standalone: true })), true, 'app installée, trois séances');
});

test('rappel de sauvegarde : ailleurs, la règle reste 3 séances et 14 jours', () => {
  const due = (now, options, globals = mac()) => backupDueOn(now, globals, options);
  // Une ville de six jours et une seule séance : hors de l'iPhone, rien ne presse.
  assert.equal(due('2026-10-16T12:00:00Z'), false, 'une séance, jamais sauvegardée');
  assert.equal(due('2026-10-16T12:00:00Z', { ok: 2 }), false, 'deux séances, jamais sauvegardée');
  // Trois séances réussies et jamais sauvegardée : le rappel vient.
  assert.equal(due('2026-10-16T12:00:00Z', { ok: 3 }), true, 'trois séances, jamais sauvegardée');
  // Une sauvegarde de dix jours est récente ; de quinze jours, non. La limite est à plus de 14 jours : 14 jours pile, non ; une milliseconde de plus, oui.
  assert.equal(due('2026-10-16T12:00:00Z', { ok: 3, backedUp: '2026-10-06T12:00:00Z' }), false, 'sauvegardée il y a dix jours');
  assert.equal(due('2026-10-16T12:00:00Z', { ok: 3, backedUp: '2026-10-01T10:00:00Z' }), true, 'sauvegardée il y a quinze jours');
  assert.equal(due('2026-10-16T12:00:00Z', { ok: 3, backedUp: '2026-10-02T12:00:00Z' }), false, 'sauvegardée il y a 14 jours pile');
  assert.equal(due('2026-10-16T12:00:00Z', { ok: 3, backedUp: '2026-10-02T11:59:59.999Z' }), true, 'sauvegardée il y a 14 jours et une milliseconde');
  // Un téléphone Android, tactile lui aussi, suit la même règle : seul l'iPhone ou l'iPad dans un onglet a un navigateur qui efface un site au bout de sept jours.
  const android = device({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', platform: 'Linux armv81', maxTouchPoints: 5 });
  assert.equal(due('2026-10-16T12:00:00Z', {}, android), false, 'Android, une séance');
  assert.equal(due('2026-10-16T12:00:00Z', { ok: 3 }, android), true, 'Android, trois séances');
});
