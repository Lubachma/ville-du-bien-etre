const test = require('node:test');
const assert = require('node:assert/strict');
const { storage, stateApp, FILES } = require('./helpers/state-vm.cjs');

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
