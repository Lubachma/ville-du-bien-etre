const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { storage, lockManager, stateApp, FILES } = require('./helpers/state-vm.cjs');

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
  'welcome.step2', 'welcome.step3', 'welcome.start', 'welcome.choose', 'welcome.note', 'welcome.close', 'welcome.langs', 'welcome.paste'];
test("textes français de l'étape 8 : l'apostrophe typographique, jamais l'apostrophe droite", () => {
  const { DICT } = stateApp(undefined, undefined, { expose: ['DICT'] });
  for (const key of STAGE8_FR) {
    assert.equal(typeof DICT.fr[key], 'string', key);
    assert.doesNotMatch(DICT.fr[key], /'/, key);
  }
  // Le texte entier, apostrophes comprises (U+2019).
  assert.deepEqual(Object.fromEntries(['install.title', 'install.iosWhy', 'install.iosCopy', 'install.prompt', 'install.copied', 'install.copyFailed',
    'welcome.close', 'welcome.langs', 'welcome.paste'].map(key => [key, DICT.fr[key]])), {
    'install.title': 'Garde ta ville à l’abri',
    'install.iosWhy': 'Sur iPhone, le navigateur peut effacer un site resté sept jours sans visite, mais pas une app ajoutée à l’écran d’accueil.',
    'install.iosCopy': 'Puis copie ta ville ici et colle-la à la première ouverture de l’app.',
    'install.prompt': 'Installée, l’app s’ouvre depuis ton écran d’accueil et garde ta ville sur ce téléphone.',
    'install.copied': 'Ville copiée : colle-la à la première ouverture de l’app.',
    'install.copyFailed': 'La copie n’a pas marché. Tu peux copier ta ville dans Réglages → Sauvegarde.',
    'welcome.close': 'Fermer l’accueil',
    'welcome.langs': 'Langue de l’app',
    'welcome.paste': 'J’avais commencé dans Safari : coller ma ville',
  });
  assert.equal(DICT.en['install.iosWhy'], "On iPhone, the browser may erase a site left seven days without a visit, but not an app added to the Home Screen.");
  assert.equal(DICT.en['install.iosCopy'], 'Then copy your town here and paste it the first time you open the app.');
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
