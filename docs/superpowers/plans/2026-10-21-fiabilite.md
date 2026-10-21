# Étape 7, Fiabilité : plan d'implémentation

> **Pour les agents :** compétence requise : superpowers:subagent-driven-development (recommandée) ou superpowers:executing-plans, tâche par tâche. Les étapes se cochent (`- [ ]`).

**But :** corriger les défauts relevés par l'analyse du 21 octobre 2026, sans aucune nouvelle fonction. Ce sont des pertes de données rares, des écrans de séance, des images, l'accessibilité et l'absence de tests continus.

**Architecture :** on corrige dans les fichiers `src/NN-*.js` existants, sans nouveau fichier source.
- Le stockage (`10-state.js`) apprend à garder ce qu'il ne connaît pas.
- L'horloge n'avance plus qu'avec les séances.
- Le reste est fait de corrections locales.
- Les tests : un fichier unitaire par thème, un groupe navigateur `tests/fiabilite-browser.cjs`, et un workflow GitHub « Vérifier ».

**Pile :** JavaScript sans dépendance à l'exécution, Canvas 2D, service worker, `node:test`, Playwright 1.62.1 (Chromium et WebKit).

**Conception :** `docs/superpowers/specs/2026-10-21-fiabilite-design.md`. Lire les deux documents avant de commencer.

## Contraintes globales

- **Fichiers générés** : ne jamais modifier `app.js` ni `sw.js` à la main. Lancer `npm run build`, puis committer les fichiers générés avec les sources.
- **Format d'état v2 inchangé** : **aucun nouveau champ enregistré** dans l'état (`defaultState()` ne gagne aucune clé). Les sauvegardes `VBE1` et `VBE2` restent importables.
- **Textes**
  - Tout nouveau texte va dans `src/06-lang-fr.js` **et** `src/07-lang-en.js`, avec la même clé et les mêmes `{paramètres}`, et le tutoiement en français.
  - Ajouter le moins de textes possible : seulement `ui.deletedUndo`, `streak.spoken` et `routine.stepAdded` (définis plus bas).
- **Mise en page** : rien ne déborde à 320 px de large, en français comme en anglais.
- **Mouvements et son** : rien ne bouge quand les mouvements sont réduits, et aucun son ne sort sans un choix de la personne.
- **Avant chaque commit** : `npm run build && npm run check && npm test` passent. À la fin de chaque tâche qui touche l'interface : `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` passe (Chrome installé sur cette machine).
- **Messages de commit** :
  - en français, au format du dépôt : `fix(domaine): …`, `test(…): …`, `ci: …`, `docs: …` ;
  - terminés par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Branche** : `etape-7-fiabilite`. Pas de push, pas de déploiement.
- **Scripts de l'audit** : des scripts de reproduction existent dans `/private/tmp/claude-501/-Users-ludob07-Documents-ville-du-bien-etre/aa84eb43-8e21-4b92-a380-557addfc0b6b/scratchpad/` (`audit-donnees/`, `audit-seance/`, `audit-interface/`, `audit-ville/`). Ils peuvent servir de modèle aux tests. Ils ne sont pas dans le dépôt, et les tests du dépôt ne doivent pas en dépendre.

## Points de vigilance

Ce sont les cas où une erreur toucherait directement la personne. Chacun a son test dans la tâche indiquée :

1. **Ville d'un an** (150 séances, 121 cases, 48 succès) : le calcul des parties inconnues prend moins de 30 ms dans Node, et n'est pas refait pour un document que l'onglet vient lui-même d'écrire. → Tâche 2.
2. **Ville déjà figée par l'étape 6** (`maxSeen` dans le futur sans séance ce jour-là) : elle se répare à l'ouverture. → Tâche 5.
3. **Rechargement automatique** : jamais pendant une séance, avec une fenêtre ouverte, ou dans la vue en grand et la visite d'une ville amie. → Tâche 4.
4. **Focus restitué** : il ne sort jamais d'une fenêtre ouverte ni de l'écran de séance quand l'arrière-plan se redessine. → Tâche 14.
5. **Prix** : ils gardent l'arrondi actuel (« 7,5 M », « 500 k ») ; seul le solde est arrondi vers le bas. → Tâche 6.

---

### Tâche 1 : aucun « null » sur l'écran de fin, et une garde dans les tests

**Fichiers :**
- Modifier : `src/50-session.js` (`showSuccess` vers la ligne 600, `showFail` vers la ligne 640)
- Créer : `tests/fiabilite-browser.cjs`
- Modifier : `tests/browser.cjs` (bloc des groupes, après `companion-browser.cjs`)

**Interfaces :**
- Produit : `tests/fiabilite-browser.cjs`, qui exporte `runFiabilite(browser, baseURL) → { scenarios: string[] }`.
  - Il suit le modèle de `tests/companion-browser.cjs` : chaque scénario est une fonction `async (browser, baseURL)`, et les helpers `town` (de `content-browser.cjs`) et `cityAt` (de `ambient-browser.cjs`) sont réutilisés.
  - Il exporte aussi `assertNoTechText(page, selector)` : il échoue si le texte visible de `selector` contient `null`, `undefined` ou `NaN` comme mot entier (`/\b(null|undefined|NaN)\b/`).
- Les tâches suivantes ajoutent leurs scénarios navigateur à ce fichier.

- [ ] **Étape 1 : écrire le test navigateur qui échoue.** Créer `tests/fiabilite-browser.cjs` avec le scénario « Écran de fin : aucun texte technique, sans compagnon » :
  - une ville amorcée sans compagnon, ouverte en français avec `cityAt(browser, baseURL, town({}, []), '2026-10-21T10:00:00Z')`, comme dans `companion-browser.cjs` ;
  - séance Méditation de 5 min en Concentration, `page.clock.runFor('05:03')` ;
  - `assertNoTechText(page, '#sessResult')`, puis « Recommencer » ;
  - nouvelle séance, `page.clock.fastForward('05:02')` (interruption) ;
  - de nouveau `assertNoTechText(page, '#sessResult')` ;
  - même chose avec un compagnon masqué (`settings.companionShown: false`, `companion` posé avec `pet()` comme dans `companion-browser.cjs`) ;
  - enfin `assertNoTechText` sur `#view-ville`, `#view-journal`, la boutique ouverte et les Réglages ouverts.

  Brancher le groupe dans `tests/browser.cjs` comme les autres : `require('./fiabilite-browser.cjs').runFiabilite(browser, baseURL + '#debug')`.
- [ ] **Étape 2 : vérifier l'échec.** `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Attendu : échec sur `#sessResult`, avec « null » trouvé.
- [ ] **Étape 3 : corriger `showSuccess` et `showFail`.** Ne plus jamais passer `null` à `res.append(...)` natif : filtrer les enfants (`[...].filter(Boolean)`) comme le font déjà `42-draw.js:100` et `44-shop.js:113`.
- [ ] **Étape 4 : vérifier.** `npm run build && npm run check && npm test && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Attendu : PASS, avec « Écran de fin : aucun texte technique » dans la sortie.
- [ ] **Étape 5 : committer.** `fix(séances): plus de « null » sur l'écran de fin sans compagnon`.

### Tâche 2 : un onglet en retard garde ce qu'il ne connaît pas (A1)

**Fichiers :**
- Créer : `tests/helpers/state-vm.cjs` (déplacer `storage()`, `lockManager()` et `app()` depuis `tests/state-session.test.cjs:8-30`)
- Modifier : `tests/state-session.test.cjs` (importer le helper ; aucun test changé)
- Modifier : `src/10-state.js` (nouvelles fonctions près de `merge3`, `Store.decodeLocal`, `Store.saveLocal`, `commit`)
- Modifier : `src/45-settings.js` (`restoreBackup`, `settingsReset`)
- Créer : `tests/compat.test.cjs`

**Interfaces :**
- `tests/helpers/state-vm.cjs` exporte :
  - `storage()` : stockage en mémoire avec `fail`, comme aujourd'hui ;
  - `lockManager()` ;
  - `stateApp(localStorage?, locks?, { files?, expose? })` : la VM actuelle de `state-session.test.cjs`, avec les mêmes bouchons. `files` vaut par défaut la liste actuelle ; `expose` ajoute des noms à `this.api`. Le résultat garde `advance(ms)` et ajoute `setNow(iso)`, qui fixe l'horloge murale.
- Dans `src/10-state.js` :
  - `unknownParts(raw, known) → Patch | undefined` : ce que `normalize()` a retiré de `raw`.
    - Les clés d'objet absentes de `known` sont copiées telles quelles. Les objets présents des deux côtés sont parcourus récursivement.
    - Pour une liste dont les éléments sont des objets à `id` texte : un `ListPatch { extra: [éléments dont l'id manque dans known], inside: { id: Patch } }`.
    - Un objet de `raw` que `known` remplace par `null` devient un `Rejected { value }`.
    - Les listes sans `id` et les valeurs simples ne donnent rien.
    - La clé `__proto__` est toujours ignorée.
  - `graftUnknown(target, patch) → target` : remet les parties inconnues dans une copie JSON de l'état, **sans jamais remplacer une valeur posée par cette version**.
    - Une clé absente est ajoutée.
    - Un `Rejected` n'est remis que si `target[k]` vaut `null` ou est absent.
    - Les éléments `extra` sont ajoutés à la fin si leur `id` manque.
    - Les patchs `inside` vont dans l'élément de même `id`, s'il existe encore.
  - `Store.saveLocal(opts = {})` : `opts.replace` sert à la restauration et à « Tout recommencer ». Il écrit l'état tel quel, sans fusion ni reprise des parties inconnues.
  - `commit(opts)` transmet `opts.replace` à `saveLocal`.
  - `Store.unknownFor(raw, parsed, normalized) → Patch | undefined` : mis en cache par chaîne. Après une écriture réussie, le cache prend le texte écrit et le patch qu'on y a remis : relire son propre texte ne recalcule rien.

- [ ] **Étape 1 : déplacer le helper.** Créer `tests/helpers/state-vm.cjs` à partir de `tests/state-session.test.cjs:8-30`, avec les options ci-dessus, et faire importer ce helper par `state-session.test.cjs`. Lancer `npm test`. Attendu : 253 tests PASS, aucun changé.
- [ ] **Étape 2 : écrire les tests qui échouent** dans `tests/compat.test.cjs`, avec `stateApp(..., { expose: ['unknownParts', 'graftUnknown', 'normalize'] })`. Utiliser un « document du futur » `future` : l'état par défaut sérialisé, augmenté de ce qui suit.
  - Une clé racine `journalNotes: [{ id: 'n1', text: 'merci' }]`.
  - Deux réglages : `settings.onboarded: true` et `settings.extra: { a: 1 }`.
  - Un succès inconnu `achievements['nouveau-succes']: 1.8e12` et un cadeau `gifts['quest:2026-10-21']: 1.8e12`.
  - Une case `{ id: 'tx', item: 'serre', x: 6, y: 6, at: 1.8e12, paid: 1e6 }` (élément inconnu).
  - Un champ `anchor: 'après le café'` sur `activities[0]` et `note: 'bien'` sur une entrée du journal.
  - Un compagnon d'espèce inconnue `{ species: 'renard', name: 'Roux', since: 1.8e12, minutes: 300, wear: '' }`.

  Tests à écrire :
  - **`compat : un onglet en retard ne perd rien de ce qu'il ne connaît pas`** : écrire `future` dans le stockage, `init()`, changer le nom de la ville, `commit({ silent: true })`. Relire le JSON stocké. Vérifier que toutes les parties ci-dessus sont présentes, à l'identique, et que `personal.name` a changé. L'état en mémoire n'a ni `journalNotes`, ni `achievements['nouveau-succes']`, ni la case `tx`.
  - **`compat : une valeur posée par cette version l'emporte`** : `future.settings.sound = 'fort'`, valeur invalide pour cette version qui la remet à `true`. Après un commit qui met `sound` à `false`, le stockage contient `false`.
  - **`compat : rien n'est repris pour une autre ville, ni après une restauration ou une remise à zéro`** : avec `future` stocké, un `S` d'une autre `createdAt` écrit par `commit()` ne contient pas `journalNotes`. Après `commit({ replace: true })` sur la même ville, `journalNotes` a disparu.
  - **`compat : coût d'une ville d'un an`** : une ville avec 150 entrées de journal, une grille 11 × 11 pleine et 48 succès. `unknownParts(parsed, normalize(parsed))` prend moins de 30 ms (médiane de 5 mesures). Après une écriture, un second `saveLocal()` ne rappelle pas `unknownParts` (l'espionner par un compteur exposé).
- [ ] **Étape 3 : vérifier l'échec.** `node --test tests/compat.test.cjs`. Attendu : FAIL, parties inconnues absentes du stockage.
- [ ] **Étape 4 : implémenter** `unknownParts`, `graftUnknown`, `Store.unknownFor` et l'option `replace`.
  - Dans `saveLocal`, la reprise ne se fait que si `!opts.replace`, que le document lu est décodable et que `other.createdAt === S.createdAt`.
  - Le cas courant (aucun patch) écrit `JSON.stringify(S)` sans copie.
  - `restoreBackup` et le bouton de `settingsReset` appellent `commit({ flush: true, replace: true })`.
- [ ] **Étape 5 : vérifier.** `npm run build && npm run check && npm test`. Attendu : tout PASS.
- [ ] **Étape 6 : documenter.** Ajouter au-dessus de `unknownParts` un commentaire qui donne la règle des étapes futures : ne jamais changer le sens d'un champ existant, ajouter un champ ; ne pas ranger de données qui comptent dans une liste sans `id`.
- [ ] **Étape 7 : committer.** `fix(données): un onglet en retard ne peut plus effacer ce qu'il ne connaît pas`.

### Tâche 3 : ville remplacée ailleurs, et écriture refusée (A1 fusion, A2)

**Fichiers :**
- Modifier : `src/10-state.js` (`Store.saveLocal`, `Store.pullLocal`)
- Modifier : `tests/compat.test.cjs`

**Interfaces :**
- Consomme : `stateApp`, `storage().fail` (tâche 2).
- Règles :
  - **Écriture refusée** : dans `saveLocal`, juste après `merge3`, on fixe `this.lsBase = clone(other); this.lsAt = other.updatedAt`, même si l'écriture échoue ensuite.
  - **Ville remplacée** : quand `this.lsAt !== -1` et `other.createdAt !== this.lsBase.createdAt`, la ville a été remplacée ailleurs.
    - Dans `pullLocal` comme dans `saveLocal`, on adopte `other` : `S = other`, la base devient `other`, et on appelle `afterReplace()`.
    - Il n'y a pas de fusion, et `saveLocal` renvoie `true` sans écrire.
    - Une ville jamais écrite (`lsAt === -1`) garde la fusion actuelle.

- [ ] **Étape 1 : écrire les tests qui échouent.**
  - **`fusion : une écriture refusée ne compte pas deux fois`.** Deux onglets A et B sur le même stockage, à 100 M, avec un compagnon. A achète une case à 15 M et ajoute 30 min de complicité, puis `commit`. On met `storage.fail = true` : B achète une case à 2 M et son `commit` renvoie `false`. On met `storage.fail = false` : B fait un `commit`. Le stockage contient alors `coins === 83e6` et `companion.minutes === 130` (100 + 30). Reprendre le scénario de `audit-donnees/02-savelocal-merge-fail.cjs`.
  - **`fusion : une remise à zéro faite ailleurs l'emporte`.** A et B sur la ville V (terrain 11, une carte postale, un compagnon). B fait un changement non encore écrit. A fait « Tout recommencer », puis `commit({ replace: true })`. B reçoit ensuite `pullLocal()`. L'état de B est la ville neuve : terrain 7, aucune carte postale, aucun compagnon, `createdAt` de la ville neuve. Reprendre `audit-donnees/08-reset-race.cjs`.
  - **`fusion : deux onglets neufs gardent la fusion actuelle`.** Deux `stateApp` sur un stockage vide, tous deux après `init()`, donc avec `lsAt === -1`. A fait un `commit()`, puis B, une milliseconde plus tard (`advance(1)`), ajoute une envie et fait un `commit()`. Le stockage contient la ville de A (`createdAt` de A) **et** l'envie de B.
- [ ] **Étape 2 : vérifier l'échec.** `node --test tests/compat.test.cjs`. Attendu : FAIL, 68 M au lieu de 83 M, et le terrain 11 revient.
- [ ] **Étape 3 : implémenter les deux règles.**
- [ ] **Étape 4 : vérifier.** `npm run build && npm run check && npm test`. Attendu : tout PASS.
- [ ] **Étape 5 : committer.** `fix(données): une écriture refusée ne compte plus deux fois, une ville remplacée l'emporte`.

### Tâche 4 : un onglet en retard se recharge au repos (A1)

**Fichiers :**
- Modifier : `src/48-status.js` (nouvelle fonction après `renderPwaStatus`)
- Modifier : `src/40-ui.js` (`closeSheet`, à la fin)
- Modifier : `src/50-session.js` (`closeSession`, à la fin)
- Modifier : `src/35-city.js` (fermeture de la vue en grand, après `closeBig`)
- Modifier : `src/60-boot.js` (écouteur `ville:pwa`, `visibilitychange` caché)
- Modifier : `tests/browser.cjs` (scénario « installation dismissal fallback and deferred service-worker update », page `other`)
- Modifier : `tests/fiabilite-browser.cjs`

**Interfaces :**
- `reloadWhenIdle()` est défini dans `48-status.js`.
  - **Quand il agit** : si `window.VillePWA` a `reloadAvailable === true` et `reloading === false`.
  - **Quand il attend** : si une séance tourne dans cet onglet (`run`), ou si la page est visible avec `#sheet`, `#session` ou `#cityBig` ouvert.
  - **Ce qu'il fait** : sinon, il appelle `VillePWA.activate()`, qui recharge.
- Il est appelé :
  - par l'écouteur `ville:pwa`, à côté de `renderPwaStatus` ;
  - à la fin de `closeSheet`, de `closeSession` et de la fermeture de la vue en grand ;
  - quand la page passe en arrière-plan.

  Utiliser la forme `if (typeof reloadWhenIdle === 'function') reloadWhenIdle()`, comme ailleurs dans le code.

- [ ] **Étape 1 : écrire le test qui échoue** dans `tests/fiabilite-browser.cjs`, scénario « Onglet en retard : rechargé au repos seulement ».
  - Ouvrir une fenêtre (Réglages), poser `VillePWA.reloadAvailable = true; VillePWA.update = true`, et envoyer `ville:pwa` : pas de rechargement (`window.marker` reste).
  - Fermer la fenêtre : rechargement (`page.waitForNavigation`).
  - Recommencer pendant une séance libre (horloge Playwright) : pas de rechargement tant que la séance tourne. À sa fin, « Retour à la ville » déclenche le rechargement.
  - Recommencer pendant la visite d'une ville amie : rechargement à sa fermeture seulement.
- [ ] **Étape 2 : vérifier l'échec.** `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Attendu : FAIL, aucun rechargement.
- [ ] **Étape 3 : implémenter** `reloadWhenIdle()` et ses appels.
- [ ] **Étape 4 : adapter le test existant de `tests/browser.cjs`.** La page `other` se recharge désormais d'elle-même dès qu'elle est au repos.
  - Remplacer le clic sur « Mettre à jour » de `other` et l'assertion `keepThisPage === true` par l'attente de sa navigation.
  - Vérifier ensuite qu'elle est sur la nouvelle version : `VillePWA.version` se termine par `-test-update`, et `stats.ok === 1`.
- [ ] **Étape 5 : vérifier.** `npm run build && npm run check && npm test && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Attendu : tout PASS.
- [ ] **Étape 6 : committer.** `fix(mise à jour): un onglet resté sur l'ancienne version se recharge dès qu'il est au repos`.

### Tâche 5 : l'horloge de la ville (A3, A4)

**Fichiers :**
- Modifier : `src/00-core.js` (`isDayKey`)
- Modifier : `src/10-state.js` (`normalize` : `updatedAt`, `clock` ; `commit` ; `Store.init` ; nouvelle `healClock`)
- Modifier : `src/50-session.js` (`pushHistory`)
- Modifier : `src/24-ambient.js` (`cityClock`, `ambientAt`)
- Modifier : `src/45-settings.js` (`restoreBackup`)
- Créer : `tests/clock.test.cjs`

**Interfaces :**
- **`isDayKey(k)`** : vrai seulement pour une vraie date du calendrier. `'2026-02-30'` et `'9999-99-99'` donnent `false`, `'2024-02-29'` donne `true`.
- **`normalize`**
  - `updatedAt` et `clock.maxSeen` valent leur valeur si elle passe `validTs`, sinon `0`.
  - `clock.lastDay` est borné au jour, dans `clock.tz`, de `Math.max(Date.now(), maxSeen)`. Un `lastDay` plus récent est ramené à ce jour.
- **`touchClock()`** n'est plus appelé dans `commit()` ni dans `Store.init()`. Il l'est dans `pushHistory(e)`, par où passe chaque fin de séance.
- **`healClock()`**, appelé à la fin de `Store.init()` : si `S.clock.maxSeen > Date.now() + 60000` et que le jour de `maxSeen` est postérieur à `S.clock.lastDay`, alors `S.clock.maxSeen = Date.now()`.
- **`cityClock(ts)` et `ambientAt(ts)`** : appelés **sans** argument, le jour vient de `today()` et les minutes de `Date.now()` dans `clock.tz`. Avec un `ts` explicite, rien ne change.
- **`restoreBackup`**
  - Un `maxSeen` de la sauvegarde situé plus de 24 h après `Date.now()` est remplacé par `Date.now()`.
  - Le `lastDay` obtenu est borné à `dayOf(Math.max(Date.now(), S.clock.maxSeen))`.

- [ ] **Étape 1 : écrire les tests qui échouent** dans `tests/clock.test.cjs`. On y utilise `stateApp` avec les fichiers `00`, `05`, `06`, `07`, `10`, `20`, `24` et `50`, `setNow`, et l'exposition de `today`, `ambientAt` et `streak` (la série en jours, `src/20-rules.js:83`).
  - **`horloge : une sauvegarde à 9e15 ne bloque plus l'app`** : `normalize({ clock: { maxSeen: 9e15 }, updatedAt: 9e15 })` donne `maxSeen === 0` et `updatedAt === 0`, et `today()` ne lève pas d'erreur.
  - **`horloge : un lastDay de 2099 est ramené`** : avec `lastDay: '2099-12-31'` et une horloge au 2026-10-21, `normalize(...).clock.lastDay === '2026-10-21'`.
  - **`horloge : les vraies dates seulement`** : `isDayKey('2026-02-30') === false`, `isDayKey('2024-02-29') === true`.
  - **`horloge : avancée puis remise sans séance, rien ne fige`**
    - Départ : une série de 10 jours finissant le 2026-10-20, l'horloge au 2026-10-21 à 10:00.
    - On passe au 2026-10-25, puis `commit()` d'un réglage, puis retour au 2026-10-21 à 10:05.
    - Attendu : `today() === '2026-10-21'`, et `ambientAt().minutes === 605` (10:05 à Zurich, `tz` de l'état : `Europe/Zurich`).
    - Une séance réussie de 10 min est datée du 2026-10-21, et la série vaut 11.
  - **`horloge : une séance pendant l'avance garde son jour`** : même départ, une séance terminée pendant le 2026-10-25, puis retour au 21. La séance suivante est datée du 2026-10-25, comme aujourd'hui.
  - **`horloge : le ciel suit l'heure réelle`** : avec `maxSeen` au 2026-10-25 à 22:00 et l'horloge au 2026-10-21 à 12:00, on a `ambientAt().minutes === 720`.
  - **`horloge : aucun cadeau deux fois`** : un cadeau de visiteur reçu le 25 pendant l'avance, puis retour au 21 et cadeau du 21, puis passage au 25. `claimVisitGift('2026-10-25')` donne `false`. Charger `53-visits.js` avec les bouchons nécessaires, ou tester la règle par la clé `visit:` directement.
  - **`horloge : une ville figée par l'étape 6 se répare`** : un stockage avec `maxSeen` au 2026-10-25 et `lastDay: '2026-10-20'`, l'horloge au 2026-10-21. Après `init()`, `today() === '2026-10-21'`.
  - **`horloge : restauration d'une sauvegarde datée du futur`** : une sauvegarde VBE2 avec `maxSeen` dans 30 jours et `lastDay` dans 30 jours. Après `restoreBackup`, `S.clock.maxSeen === Date.now()` et `lastDay === today()`. Charger `45-settings.js`, ou extraire la règle en `restoredClock(current, backup)` dans `45-settings.js` et la tester seule.
- [ ] **Étape 2 : vérifier l'échec.** `node --test tests/clock.test.cjs`. Attendu : FAIL, `RangeError` et jour figé au 25.
- [ ] **Étape 3 : implémenter** les interfaces ci-dessus. Dans `normalize`, le formateur de jour est créé avant `clock`, au fuseau `s.clock.tz` (celui de `historyDays`, remonté).
- [ ] **Étape 4 : vérifier.** `npm run build && npm run check && npm test && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Attendu : tout PASS. Les tests existants qui posent `maxSeen = 0` ne changent pas.
- [ ] **Étape 5 : committer.** `fix(horloge): seules les séances font avancer l'horloge de la ville, et une date impossible ne bloque plus`.

### Tâche 6 : les chiffres disent vrai (A5)

**Fichiers :**
- Modifier : `src/00-core.js` (`fmt`, nouvelle `fmtBalance`)
- Modifier : `src/40-ui.js` (solde de l'en-tête, vers la ligne 141)
- Modifier : `src/44-shop.js` (ligne du solde de la boutique)
- Modifier : `src/50-session.js` (ligne `result.newBalance` de `showSuccess`)
- Modifier : `src/26-summaries.js` (`periodSummary`)
- Modifier : `src/54-rituals.js` (affichage des bilans et récapitulatifs quand `sessions`, `longest` ou `moods` valent `null`)
- Modifier : `src/45-settings.js` (`readBackup`)
- Créer : `tests/format.test.cjs`
- Modifier : `tests/summaries.test.cjs`, `tests/backup.test.cjs`

**Interfaces :**
- **`fmt(n)`** : l'arrondi ne change pas, mais on passe à l'unité suivante quand l'arrondi atteint 1000 : `fmt(999500) === '1 M'` et `fmt(999960000) === '1 Md'` en français.
- **`fmtBalance(n)`** : même présentation que `fmt`, mais arrondie **vers le bas** à la précision affichée.
- **`periodSummary(from, to)`** : `sessions`, `longest` et `moods` valent `null` quand le journal ne couvre pas toute la période, c'est-à-dire quand `S.history.length >= HISTORY_MAX` et que le jour de l'entrée la plus ancienne n'est pas strictement antérieur à `from`.
- **`readBackup(text)`** : retire tout blanc (`/\s+/g`) avant de lire.

Valeurs exactes (avec `NB`, l'espace insécable de `00-core.js`) :

| Appel | Français | Anglais |
|---|---|---|
| `fmtBalance(2950000)` | `'2,9 M'` | `'2.9 M'` |
| `fmtBalance(3000000)` | `'3 M'` | |
| `fmtBalance(999500)` | `'999 k'` | |
| `fmtBalance(999960000)` | `'999,9 M'` | |
| `fmtBalance(100.6e6)` | `'100 M'` | |
| `fmtBalance(1999)` | `'1 k'` | |
| `fmtBalance(999)` | `'999'` | |

Ces cas ne changent pas : `fmt(7.5e6) === '7,5 M'` et `fmt(5e5) === '500 k'`.

- [ ] **Étape 1 : écrire les tests qui échouent**
  - **`format : solde arrondi vers le bas, prix inchangés`** : les valeurs du tableau, dans les deux langues (`setLang`).
  - **`récapitulatif : un journal plein ne donne pas de chiffres faux`** : 186 séances réussies en octobre 2026, à 6 par jour de 10 min. `recapSummary('month', '2026-10')` donne `sessions`, `longest` et `moods` à `null`, et `minutes === 1860`, venu de `stats`. Avec 20 séances seulement, `sessions === 20`.
  - **`sauvegarde : un texte coupé en lignes est accepté`** : `exportBackup()`, coupé tous les 76 caractères par `'\n'`, avec des espaces ajoutées. `readBackup(...)` ne renvoie pas d'erreur, et son état a les mêmes pièces.
- [ ] **Étape 2 : vérifier l'échec.** `node --test tests/format.test.cjs tests/summaries.test.cjs tests/backup.test.cjs`. Attendu : FAIL.
- [ ] **Étape 3 : implémenter.** Utiliser `fmtBalance` uniquement pour les trois soldes listés. Dans `54-rituals.js`, une partie absente (`null`) ne s'affiche pas. Exemple : `r.moods && r.moods.good && …`.
- [ ] **Étape 4 : vérifier.** `npm run build && npm run check && npm test && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Attendu : tout PASS.
- [ ] **Étape 5 : committer.** `fix(chiffres): solde arrondi vers le bas, récapitulatif juste, sauvegarde collée avec des retours à la ligne`.

### Tâche 7 : aucune ambiance hors séance (B2)

**Fichiers :**
- Modifier : `src/51-ambience.js` (`openAmbienceSheet`, nouvelle `closeAmbienceSheet`)
- Modifier : `src/50-session.js` (`endRun`)
- Modifier : `tests/fiabilite-browser.cjs`

**Interfaces :**
- **`closeAmbienceSheet()`** : ferme `#sheet` si c'est la fenêtre d'ambiance qui est ouverte. Un indicateur est posé à l'ouverture et retiré par `onClose`.
- **`endRun()`** appelle `closeAmbienceSheet()`.
- **Hors séance (`!run`)**, un choix dans cette fenêtre l'enregistre et met à jour le bouton, sans `Chime.unlock` ni `Ambience.switch`.

- [ ] **Étape 1 : écrire le test qui échoue**, scénario « Ambiance : fermée à la fin, aucun son hors séance ».
  - Séance libre de 5 min (horloge Playwright). Ouvrir la fenêtre « Ambiance » depuis la séance, puis `fastForward(301000)`. Attendu : `#sheet` est caché.
  - Hors séance, rouvrir cette fenêtre (l'exposer par `__ville.ambience.open()`) et choisir « Vagues ». Attendu : `__ville.ambience.kind() === 'none'`, et `S.settings.ambience === 'waves'`.
- [ ] **Étape 2 : vérifier l'échec.** Attendu : FAIL, la fenêtre reste ouverte et l'ambiance joue.
- [ ] **Étape 3 : implémenter.**
- [ ] **Étape 4 : vérifier.** `npm run build && npm run check && npm test && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Attendu : PASS.
- [ ] **Étape 5 : committer.** `fix(ambiance): plus aucun son dans la ville une fois la séance finie`.

### Tâche 8 : écran allumé, son relancé, anneau sobre (B3, B4, B6)

**Fichiers :**
- Modifier : `src/50-session.js` (`acquireWake`, `tick`, `endRun`, `renderTimer`, reprise d'une Activité libre dans `startSessionLocked`)
- Modifier : `src/51-ambience.js` (`waitForGesture` ; nouvelles `resumeSound`, `armSoundGesture`)
- Modifier : `src/60-boot.js` (`visibilitychange`, retour visible)
- Modifier : `styles.css` (`.ring-fill`, retirer `transition`)
- Créer : `tests/session-platform.test.cjs`

**Interfaces :**
- **Écran allumé**
  - `wakeGen` : un compteur au niveau du module, incrémenté par `endRun()`. `acquireWake()` relâche aussitôt un verrou obtenu après un changement de génération.
  - Dans `tick()` (Concentration, page présente) : si `S.settings.keepAwake` est vrai, que le verrou est absent ou relâché, et que la dernière demande date de plus de 5000 ms (`run.wakeAskedAt`), on appelle `requestWake()`.
  - L'écouteur `release` fait la même demande, limitée de la même façon, quand la page est visible et qu'une séance tourne.
- **Son**
  - `resumeSound()` : si `Chime.ctx` existe, qu'une séance tourne et que le contexte n'est pas `running`, on appelle `resume()`. En cas d'échec, ou si le contexte n'est toujours pas `running`, `armSoundGesture()`.
  - `armSoundGesture()` : écouteurs à usage unique `pointerup`, `click` et `keydown`, qui appellent `Chime.unlock(true)` puis relancent l'ambiance si `Ambience.wanted()`.
  - `waitForGesture` écoute aussi `pointerup` et `click`.
  - `Chime.ctx.onstatechange` appelle `resumeSound()` quand la page est visible.
  - Une Activité libre reprise après réouverture appelle `armSoundGesture()` quand `S.settings.sound` est vrai.
- **Anneau** : `renderTimer` met à jour `strokeDashoffset` seulement quand la seconde affichée change, ou si `force`.

- [ ] **Étape 1 : écrire les tests qui échouent** dans `tests/session-platform.test.cjs`, avec `stateApp`. Ajouter les fichiers `51-ambience.js` et un faux `navigator.wakeLock` et un faux `AudioContext` sur le modèle de `audit-seance/harness.cjs`. **Ne pas** bouchonner `setWake` ni `acquireWake` pour ces tests.
  - **`écran allumé : redemandé au tic si iOS l'a relâché`** : séance Concentration ; le faux verrou se relâche ; on avance de 6 s par tics de 250 ms. Attendu : une deuxième demande de verrou au moins, et au plus une demande par 5 s.
  - **`écran allumé : un verrou arrivé après la fin est relâché`** : la demande reste en attente, on abandonne la séance, puis la demande aboutit. Attendu : le verrou est relâché, rien n'est tenu.
  - **`son : relancé au retour, ou au premier toucher`** : le faux contexte passe à `interrupted`. Un `visibilitychange` visible appelle `resume()`. Si `resume` échoue, un `pointerup` déclenche `Chime.unlock(true)`.
  - **`son de fin : préparé après réouverture d'une Activité libre`** : une séance libre reprise par `checkActive`, puis un `pointerup`. Attendu : un contexte audio est créé.
  - **`anneau : une mise à jour par seconde`** : 8 tics de 250 ms. Attendu : 2 écritures de `strokeDashoffset`.
- [ ] **Étape 2 : vérifier l'échec.** `node --test tests/session-platform.test.cjs`. Attendu : FAIL.
- [ ] **Étape 3 : implémenter.** Retirer `transition: stroke-dashoffset .3s linear` de `.ring-fill` dans `styles.css`.
- [ ] **Étape 4 : vérifier.** `npm run build && npm run check && npm test && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Attendu : tout PASS.
- [ ] **Étape 5 : committer.** `fix(séances): l'écran reste allumé, le son revient après une interruption, l'anneau avance chaque seconde`.

### Tâche 9 : les autres onglets restent utilisables pendant une séance (B5)

**Fichiers :**
- Modifier : `src/10-state.js` (`Store.pullLocal`, `afterReplace`)
- Modifier : `tests/compat.test.cjs`

**Interfaces :**
- **`onlySessionMoved(a, b) → boolean`** : vrai quand deux états ne diffèrent que par `updatedAt`, `revision`, `active.elapsedSec`, `active.checkpointAt` ou `active.owner`.
- **`afterReplace({ light } = {})`** : avec `light`, il ne remet à zéro ni `Mode.state` ni `Selection.id`, et ne ferme pas la fenêtre. Le reste ne change pas : `refreshLang`, `City.relayout`, `renderAll` et `checkActive`.
- **`pullLocal`** appelle `afterReplace({ light: onlySessionMoved(previous, S) })`.

- [ ] **Étape 1 : écrire le test qui échoue.** **`onglets : un point de reprise ne ferme pas la fenêtre de l'autre onglet`**. A tient une séance libre et appelle `persistRun(true)` 6 fois, à 5 s d'écart. B fait `pullLocal()` après chaque appel. Le bouchon `closeSheet` de B n'est jamais appelé, et `Mode.state` de B n'est pas remis à `null`. Bouchons : `$('#sheet').hidden = false`, `Mode.state = { kind: 'place' }`.
- [ ] **Étape 2 : vérifier l'échec.** Attendu : FAIL, `closeSheet` est appelé 6 fois.
- [ ] **Étape 3 : implémenter.**
- [ ] **Étape 4 : vérifier.** `npm run build && npm run check && npm test`. Attendu : tout PASS.
- [ ] **Étape 5 : committer.** `fix(onglets): une séance dans un onglet ne ferme plus les fenêtres de l'autre`.

### Tâche 10 : un rappel à l'heure choisie (B7)

**Fichiers :**
- Modifier : `src/49-reminder.js` (`nextReminder`, `icsLocal`, `buildReminderIcs`, `googleCalendarUrl`)
- Modifier : `tests/reminder.test.cjs`

**Interfaces :**
- **`nextReminder(time, now)`** : renvoie `{ day: 'AAAAMMJJ', hhmm: 'HHMM' }`.
  - Le jour est celui de `now`, en heure locale, si `time` est après l'heure de `now`. Sinon, c'est le lendemain, calculé sur la date seule (`Date.UTC` sur l'année, le mois et le jour locaux, plus un jour).
  - L'heure est `time` sans les deux-points.
- **`addMinutes({ day, hhmm }, n) → { day, hhmm }`** : passe au jour suivant après 23:59.
- **`DTSTART`** devient `day + 'T' + hhmm + '00'`, et le lien Google utilise les mêmes valeurs.

- [ ] **Étape 1 : écrire les tests qui échouent.** Au début du fichier : `process.env.TZ = 'Europe/Zurich'`.
  - **`rappel : passage à l'heure d'été`** : `buildReminderIcs('02:30', new Date(2026, 2, 28, 12, 0))` contient `DTSTART:20260329T023000`. `googleCalendarUrl` contient `dates=20260329T023000%2F20260329T024000`.
  - **`rappel : fin après minuit`** : pour `'23:55'`, à la même date, la fin vaut `20260329T000500`.
- [ ] **Étape 2 : vérifier l'échec.** `node --test tests/reminder.test.cjs`. Attendu : FAIL, `T033000`.
- [ ] **Étape 3 : implémenter.**
- [ ] **Étape 4 : vérifier.** `npm run build && npm run check && npm test`. Attendu : tout PASS, anciens tests du rappel compris.
- [ ] **Étape 5 : committer.** `fix(rappel): l'heure choisie reste la même autour du passage à l'heure d'été`.

### Tâche 11 : l'image de ma ville, sous le ciel du moment (C1, C2)

**Fichiers :**
- Modifier : `src/35-city.js`
  - nouvelles `imageSky`, `paintImageSky` ;
  - nouvelle `cardGeometry`, utilisée par `layout` ;
  - `snapshot` réécrit.
- Modifier : `src/46-features.js` (`exportCityImage` est découpé en `cityImageCanvas` et la partie qui partage ou télécharge)
- Modifier : `src/54-rituals.js` (`recapCanvas` utilise `paintImageSky`)
- Modifier : `src/60-boot.js` (debug : `__ville.png = { canvas: () => cityImageCanvas() }`, `__ville.rituals.recapCanvas`, `__ville.ambient.imageSky`)
- Modifier : `tests/fiabilite-browser.cjs`

**Interfaces :**
- **`imageSky() → { top, bottom, stars }`**
  - Si `S.settings.sky === 'theme'` : les valeurs CSS `--sky-top` et `--sky-bottom`, et `stars` vaut 1 si `--night` vaut `'1'`, 0 sinon.
  - Sinon : `skyColors(ambientAt())`.
- **`paintImageSky(ctx, width, height, area)`** : un dégradé vertical sur tout le canevas, puis les 8 étoiles actuelles de `exportCityImage`, aux positions relatives de `area = { x, y, w, h }`, avec l'opacité `stars`.
- **`cardGeometry(width) → { W, H, TW, ox, oy }`** : les calculs actuels de `layout()`, pour une largeur donnée. `layout()` l'utilise.
- **`City.snapshot(minWidth = 1200) → HTMLCanvasElement`**
  - Il dessine **toujours** `S.city` (jamais `visit`), dans `cardGeometry(largeur de #city ou 360)`, sur un canevas créé pour l'occasion.
  - `dpr` vaut `max(dpr, minWidth / W)`.
  - Il sauve puis restaure tout l'état du module (`canvas`, `ctx`, `W`, `H`, `dpr`, `TW`, `ox`, `oy`, `N`, `visit`, `big.open`), puis redessine la vue courante.
- **`cityImageCanvas() → Promise<HTMLCanvasElement>`** : l'image exportée actuelle, ciel compris, par `paintImageSky`.

- [ ] **Étape 1 : écrire les tests qui échouent**, scénario « Images : ma ville, sous le ciel du moment ».
  - **Ville propre** : ville propre 7 × 7 ; ouvrir la visite d'une ville 9 × 9 par `__ville.share.open(code)`, où `code` est l'encodage d'une ville 9 × 9 d'un autre `createdAt`. Alors `__ville.City.snapshot()` a le même rapport largeur/hauteur que celui pris hors visite, à 0,01 près.
  - **Ciel du moment** : thème clair, ciel selon l'heure, horloge Playwright au 2026-10-21 à 22:00 (Zurich, `tz` de l'état). Le pixel (4,4) de `await __ville.png.canvas()` a une luminance inférieure à 60, et celui du récapitulatif (`__ville.rituals.recapCanvas('month', '2026-09')`) aussi.
  - **Ciel du thème** : avec `sky: 'theme'`, ce pixel a une luminance supérieure à 180.
- [ ] **Étape 2 : vérifier l'échec.** Attendu : FAIL, rapport différent en visite, pixel clair à 22 h.
- [ ] **Étape 3 : implémenter.**
- [ ] **Étape 4 : vérifier.** `npm run build && npm run check && npm test && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Attendu : tout PASS, y compris « Nom de ville persistant et export PNG ».
- [ ] **Étape 5 : committer.** `fix(images): l'image exportée montre sa propre ville, sous le ciel du moment`.

### Tâche 12 : un zoom fluide (C3)

**Fichiers :**
- Modifier : `src/35-city.js` (`zoomAt`, `panBy`, molette, compteur de debug)
- Modifier : `tests/fiabilite-browser.cjs`

**Interfaces :**
- **`requestFrame()`** : définie dans le module `City`. Elle demande une seule image (`raf`), comme le fait aujourd'hui `panBy`. `panBy` l'utilise, ainsi que `zoomAt` sans transition et la molette. Le zoom en douceur des boutons ne change pas.
- **`City.drawCount()`** : renvoie le nombre d'appels à `draw()`. Réservé aux tests.

- [ ] **Étape 1 : écrire le test qui échoue**, scénario « Zoom : un seul dessin par image ».
  - **Pincement** : dans la vue en grand, deux `pointerdown` synthétiques, puis 10 paires de `pointermove` envoyées dans le même `page.evaluate`, puis attente de deux `requestAnimationFrame`. L'écart de `drawCount()` doit être d'au plus 2.
  - **Molette** : 20 `wheel` synthétiques dans le même `evaluate`, avec la même borne d'au plus 2.
- [ ] **Étape 2 : vérifier l'échec.** Attendu : FAIL, environ 30 et 20 dessins.
- [ ] **Étape 3 : implémenter.**
- [ ] **Étape 4 : vérifier.** `npm run build && npm run check && npm test && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Attendu : tout PASS, y compris « Ville en grand » et « Vue en grand au clavier ».
- [ ] **Étape 5 : committer.** `fix(ville): un seul dessin par image pendant un pincement ou un zoom à la molette`.

### Tâche 13 : des noms reçus propres (C4)

**Fichiers :**
- Modifier : `src/00-core.js` (nouvelle `cleanName`, à la place de l'usage direct de `HIDDEN_CHARS` et `VISIBLE_CHAR`)
- Modifier :
  - `src/10-state.js` : `cleanCompanionName`, et `personal.name` dans `normalize` ;
  - `src/27-share.js` : décodage du nom, vers la ligne 61 ;
  - `src/55-share.js` : ligne 19 ;
  - `src/46-features.js` : enregistrement du nom de ville ;
  - `src/57-companion.js` : enregistrement du nom.
- Modifier : `tests/share.test.cjs`, `tests/companion.test.cjs`

**Interfaces :**
- **`cleanName(raw, max) → string`**
  - Il retire :
    - les caractères `\p{Cf}`, sauf U+200C et U+200D ;
    - ceux de `\p{Default_Ignorable_Code_Point}`, sauf U+200C et U+200D ;
    - U+2028, U+2029, U+3164, U+2800, U+115F, U+1160, U+FFA0 ;
    - les caractères de contrôle.
  - Il réduit les blancs en série à une espace, puis supprime les blancs au début et à la fin.
  - Il coupe à `max` **points de code** (`Array.from`).
  - Il renvoie `''` s'il ne reste aucun caractère `[\p{L}\p{N}\p{S}\p{P}]`.

- [ ] **Étape 1 : écrire les tests qui échouent.** **`noms : invisibles retirés, coupure entière`** :

  | Appel | Résultat attendu |
  |---|---|
  | `cleanName('ㅤ', 40)` | `''` |
  | `cleanName('⠀⠀', 40)` | `''` |
  | `cleanName('­', 40)` | `''` |
  | `cleanName('Jardin؜', 40)` | `'Jardin'` |
  | `cleanName('a b', 40)` | `'ab'` |
  | `cleanName('Ville \u{E0041}🌳', 40)` | `'Ville 🌳'` |
  | `cleanName('😀'.repeat(45), 40)` | 40 points de code, aucune moitié de paire (`/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/` ne trouve rien) |

  Il faut aussi qu'un lien de ville au nom `'ㅤ'` s'affiche avec le nom par défaut (« Une ville amie »), et qu'un nom de compagnon `'⠀'` donne la suggestion de l'animal.
- [ ] **Étape 2 : vérifier l'échec.** `node --test tests/share.test.cjs tests/companion.test.cjs`. Attendu : FAIL.
- [ ] **Étape 3 : implémenter**, et utiliser `cleanName` partout où l'on retenait `HIDDEN_CHARS` et `VISIBLE_CHAR`.
- [ ] **Étape 4 : vérifier.** `npm run build && npm run check && npm test && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Attendu : tout PASS.
- [ ] **Étape 5 : committer.** `fix(noms): les noms reçus ou tapés gardent seulement des caractères visibles, coupés entre deux caractères`.

### Tâche 14 : le focus ne se perd plus (D1)

**Fichiers :**
- Modifier : `src/40-ui.js` (nouvelles fonctions de focus ; `renderAll` ; `closeSheet` ; `openSheet`, la course des 30 ms ; `removeWithUndo`)
- Modifier : `src/41-activities.js`, `src/42-draw.js`, `src/43-journal.js`, `src/44-shop.js`, `src/46-features.js`, `src/52-carnet.js`, `src/54-rituals.js`, `src/57-companion.js` (attributs `data-focus-key`)
- Modifier : `src/35-city.js` (élément qui ouvre la vue en grand, et focus rendu à la fermeture)
- Modifier : `tests/fiabilite-browser.cjs`

**Interfaces :**
- **`focusKeyOf(el) → string | null`** : renvoie `el.dataset.focusKey`.
- **`focusByKey(key) → boolean`** : met le focus sur le premier `[data-focus-key="…"]` visible et hors `[inert]`.
- **`focusViewHeading()`** : le comportement actuel de `go()`, c'est-à-dire le `h2` de la vue courante avec `tabIndex = -1`. `go()` l'utilise.
- **`renderAll()`** : il retient l'élément focalisé et sa clé avant de dessiner. Après le dessin, si cet élément n'est plus dans le document, ou si le focus est sur `body` :
  - on essaie `focusByKey` ;
  - sinon, si aucune fenêtre, séance ou vue en grand n'est ouverte, `focusViewHeading()`.

  Il ne déplace **jamais** un focus qui se trouve dans `#sheet`, `#session` ou `#cityBig`.
- **`closeSheet()`** : si l'élément qui avait ouvert la fenêtre n'est plus dans le document, il essaie `focusByKey(sa clé)`, puis `focusViewHeading()`.
- **`openSheet()`** : la mise au point du titre, 30 ms plus tard, n'a lieu que si le focus n'est pas déjà sur un champ de `#sheetBody` (`input`, `select` ou `textarea`). Correctif déjà validé sur WebKit pendant l'analyse.
- **`removeWithUndo(key, id)`** : avant de retirer l'élément, il calcule la clé du voisin (élément suivant, sinon précédent). Après `commit()`, il appelle `focusByKey`, sinon `focusViewHeading()`.
- **Vue en grand** : elle retient l'élément qui l'a ouverte (bouton « en grand », carte postale du Carnet, visite) et lui rend le focus à la fermeture s'il est encore là. Sinon : `#cityExpand` en vue Ville, ou `focusViewHeading()`.
- **Clés à poser** (format `nom:id`) :

  | Élément | Clé |
  |---|---|
  | carte d'activité | `act:<id>` |
  | bouton de modification d'une activité | `act-edit:<id>` |
  | bouton de suppression d'une activité | `act-del:<id>` |
  | envie ou obligation | `task:<id>`, `task-del:<id>` |
  | « Tirer au sort » | `draw:go` |
  | « Relancer » | `draw:reroll` |
  | bouton de l'objectif | `goals:edit` |
  | changement de défi | `chal-swap:<index>` |
  | routine | `routine:<id>` |
  | bouton du Carnet | `carnet:open` |
  | bouton du compagnon | `companion:open` |
  | bouton de la boutique | `shop:open` |

- [ ] **Étape 1 : écrire les tests qui échouent**, scénario « Focus : jamais perdu ». Pour chaque action, au clavier (`press('Enter')` sur l'élément focalisé), vérifier `document.activeElement !== document.body` et sa clé attendue :
  - « Tirer au sort » → `draw:go` ;
  - « Relancer » → `draw:reroll` ;
  - « Enregistrer » dans « Modifier l'activité » → `act-edit:<id>` ;
  - « Enregistrer » de l'objectif → `goals:edit` ;
  - « Accueillir » le compagnon → `companion:open`, ou titre de la vue ;
  - fermer le Carnet par Échap → `carnet:open` ;
  - supprimer la 2ᵉ activité → `act-del:<id de la 3ᵉ>` ;
  - supprimer la dernière → `act-del:<id de l'avant-dernière>` ;
  - changer un défi → `chal-swap:<index>` ;
  - Journal › Carnet › Visites › une carte postale › Échap → la carte postale ;
  - fenêtre « Mon objectif » ouverte puis valeur hors bornes envoyée en moins de 30 ms (`fill` puis `click` dans le même `evaluate`) → `goalMinutes`.

  **Garde** : `renderAll()` appelé pendant qu'une fenêtre est ouverte laisse le focus dans `#sheet`.
- [ ] **Étape 2 : vérifier l'échec.** Attendu : FAIL, `BODY`.
- [ ] **Étape 3 : implémenter.**
- [ ] **Étape 4 : vérifier.** `npm run build && npm run check && npm test && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Attendu : tout PASS, y compris « mobile/tablet layouts, keyboard focus/radios » et « Vue en grand au clavier ».
- [ ] **Étape 5 : committer.** `fix(accessibilité): le focus revient sur l'élément d'origine ou son voisin après chaque action`.

### Tâche 15 : le temps d'annuler (D2)

**Fichiers :**
- Modifier : `src/40-ui.js` (`toast`, `hideToast`, `removeWithUndo`, `go`, `openSheet`)
- Modifier : `src/06-lang-fr.js`, `src/07-lang-en.js` (clé `ui.deletedUndo`)
- Modifier : `tests/fiabilite-browser.cjs`

**Interfaces :**
- **`toast(msg, action, spoken = msg, opts = {})`**
  - Avec `opts.keep`, aucun minuteur : le message reste jusqu'au prochain `toast()`, à `go()` ou à `openSheet()`. Ces deux fonctions appellent `hideToast()`.
  - Sans `keep`, un message avec action garde ses 6 s, mais le minuteur s'arrête tant que le message a le focus ou la souris (`focusin`/`mouseenter`), et reprend ensuite pour 6 s (`focusout`/`mouseleave`).
- **`removeWithUndo`** appelle `toast(t('ui.deleted', …), action, t('ui.deletedUndo', { name }), { keep: true })`.
- **Textes**
  - Français : `'ui.deletedUndo': 'Supprimé : « {name} ». Tu peux annuler avec le bouton Annuler, en bas de l\'écran.'`
  - Anglais : `'ui.deletedUndo': 'Deleted: “{name}”. You can undo it with the Undo button at the bottom of the screen.'`

- [ ] **Étape 1 : écrire le test qui échoue**, scénario « Annuler : le temps qu'il faut ».
  - Supprimer une activité, puis `page.clock.fastForward(10000)`. Attendu : `#toast` est visible, et le texte de `#live` contient « Tu peux annuler ».
  - « Annuler » : l'activité revient.
  - Supprimer de nouveau, puis changer d'onglet. Attendu : `#toast` est caché.
- [ ] **Étape 2 : vérifier l'échec.** Attendu : FAIL, le message est caché après 6 s.
- [ ] **Étape 3 : implémenter.**
- [ ] **Étape 4 : vérifier.** `npm run build && npm run check && npm test && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Attendu : tout PASS, y compris « Long message : son bouton sur une ligne, même à 320 px ».
- [ ] **Étape 5 : committer.** `fix(accessibilité): après une suppression, « Annuler » reste et l'annonce le dit`.

### Tâche 16 : ce qui est choisi se voit, l'en-tête à 320 px (D3, D4)

**Fichiers :**
- Modifier : `styles.css` (`.seg button[aria-checked="true"]`, `.input::placeholder`, `.elsewhere .note`, `.shop-nav`, en-tête `.brand-name` et sa rangée)
- Créer : `tests/contrast.test.cjs`
- Modifier : `tests/fiabilite-browser.cjs`

**Interfaces :**
- **Option choisie** : `.seg button[aria-checked="true"] { background: var(--ink); color: var(--surface); box-shadow: none; }`.
- **Texte indicatif** : `.input::placeholder { color: var(--muted); opacity: 1; }`.
- **Bandeau « séance ailleurs »** : `.elsewhere .note { color: var(--ink-2); }`.
- **Barre des rubriques** : `.shop-nav` reçoit une marge intérieure verticale de 5 px, compensée par une marge extérieure négative pour ne pas changer la mise en page.
- **En-tête**
  - La rangée de l'en-tête passe à la ligne (`flex-wrap: wrap`) quand le nom et les pastilles ne tiennent pas.
  - `.brand-name` prend `overflow-wrap: break-word` (au lieu de `anywhere`) et une base de 12ch.
  - Les pastilles restent groupées avec le bouton des Réglages.

- [ ] **Étape 1 : écrire les tests qui échouent**
  - **`contraste : couleurs des réglages`** dans `tests/contrast.test.cjs`. Lire les variables de `:root` et du thème sombre dans `styles.css` (les deux blocs `--ink`…). Calculer les contrastes WCAG :

    | Paire | Seuil |
    |---|---|
    | fond choisi `--ink` contre fond du contrôle `--surface-2` | ≥ 3 |
    | `--surface` sur `--ink` | ≥ 4,5 |
    | `--muted` sur `--surface` | ≥ 4,5 |
    | `--ink-2` sur `--accent-soft` | ≥ 4,5 |

    Chaque paire est vérifiée dans les deux thèmes. Vérifier aussi que la règle `.seg button[aria-checked="true"]` utilise bien `var(--ink)`.
  - **« En-tête : un nom long tient à 320 px »**, scénario navigateur. À 320 × 568, avec « Les Jardins de Montreux », 1,2 Md (`coins: 1.2e9`) et une série de 40 jours :
    - `.brand-name` mesure au moins 150 px de large ;
    - sa hauteur est d'au plus 2 fois sa `line-height` ;
    - aucun débordement (`scrollWidth <= innerWidth`).

    En anglais, même chose avec « Riverside Gardens Town ».
  - **« Boutique : contour de focus entier »** : focaliser une puce de `.shop-nav`. Le bas du contour (rectangle de la puce, plus 4 px) reste dans le rectangle de `.shop-nav`.
- [ ] **Étape 2 : vérifier l'échec.** `node --test tests/contrast.test.cjs`, puis la suite navigateur. Attendu : FAIL, 1,08:1 et nom de 51 px.
- [ ] **Étape 3 : implémenter.**
- [ ] **Étape 4 : vérifier.** `npm run build && npm run check && npm test && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Attendu : tout PASS, y compris les largeurs à 320, 390 et 768 px.
- [ ] **Étape 5 : committer.** `fix(lisibilité): l'option choisie se voit, l'en-tête tient à 320 px, le contour de focus est entier`.

### Tâche 17 : les petites annonces (D5)

**Fichiers :**
- Modifier : `index.html` (pastille de série), `src/40-ui.js` (`renderHeader`)
- Modifier : `src/46-features.js` (éditeur de routine)
- Modifier : `src/54-rituals.js` (carte des défis : `aria-labelledby` vers son `h3`, avec un `id`)
- Modifier : `src/60-boot.js`, `src/41-activities.js`, `src/46-features.js` (noms faits d'espaces)
- Modifier : `src/06-lang-fr.js`, `src/07-lang-en.js` (`streak.spoken`, `routine.stepAdded`)
- Modifier : `tests/fiabilite-browser.cjs`

**Interfaces :**
- **Pastille de série** (`#streakChip`, `index.html:74`)
  - Le texte visible `#streak` (« 7 j ») reçoit `aria-hidden="true"`.
  - Un `span.visually-hidden`, la classe déjà utilisée pour « pièces » dans `#balanceChip`, contient `t('streak.spoken', { n })`. `renderHeader` le tient à jour.
  - Le pluriel suit le format des dictionnaires, comme `unit.days`.
  - Français : `'streak.spoken': { one: '{n} jour de série', other: '{n} jours de série' }`.
  - Anglais : `'streak.spoken': { one: '{n}-day streak', other: '{n}-day streak' }`.
- **Éditeur de routine** : `announce(t('routine.stepAdded', { n, name }))` à chaque étape ajoutée.
  - Français : `'Étape {n} ajoutée : {name}.'`
  - Anglais : `'Step {n} added: {name}.'`
- **Noms faits d'espaces** : dans chaque formulaire de nom (envie et obligation dans `60-boot.js:47-59`, activité dans `41-activities.js`, routine dans `46-features.js`, ville dans `46-features.js`), un nom vide après `trim()` vide le champ et appelle `form.reportValidity()`. Le gestionnaire `invalid` de `47-accessibility.js` affiche alors le message.

- [ ] **Étape 1 : écrire le test qui échoue**, scénario « Annonces ».
  - **Série** : avec une série de 7 jours, le texte lu de `#streakChip` est exactement « 7 jours de série » en français, et « 7-day streak » en anglais. On le mesure sur une copie de la pastille dont on retire les nœuds `[aria-hidden="true"]` : `textContent.trim()`, avec l'espace insécable remplacée par une espace.
  - **Routine** : ajouter une étape dans l'éditeur de routine. `#live` contient « Étape 3 ajoutée ».
  - **Langue** : après le passage en English, la région des défis s'appelle « Weekly challenges ».
  - **Espaces** : taper `'   '` dans « Ajouter une envie » et envoyer. Un `.field-error` est visible, et rien n'est ajouté.
- [ ] **Étape 2 : vérifier l'échec.** Attendu : FAIL.
- [ ] **Étape 3 : implémenter.**
- [ ] **Étape 4 : vérifier.** `npm run build && npm run check && npm test && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Attendu : tout PASS, y compris l'ordre des clés des réglages dans les tests i18n.
- [ ] **Étape 5 : committer.** `fix(accessibilité): série lue en entier, étapes de routine annoncées, nom des défis traduit, noms vides signalés`.

### Tâche 18 : des tests à chaque push, et sur WebKit (E)

**Fichiers :**
- Créer : `.github/workflows/verify.yml`
- Modifier : `tests/ambient-browser.cjs` (molette, ligne 237 et suivantes)

**Interfaces :**
- **`wheelAt(page, dy)`**, dans `tests/ambient-browser.cjs` : il essaie `page.mouse.wheel(0, dy)`. Si l'erreur contient `not supported`, il envoie un `WheelEvent` (`deltaY: dy`, `deltaMode: 0`, centre de `#cityBigCanvas`). Version déjà validée pendant l'analyse.
- **Workflow « Vérifier »**, déclenché par `on: [push, pull_request]`, avec la permission `contents: read`.
  - **Tâche `unit`** (Node 24, `npm ci`) :
    - `npm run build` ;
    - `git diff --exit-code app.js sw.js` (fichiers générés à jour) ;
    - `npm run check` et `npm test`.
  - **Tâche `chromium`**, qui dépend de `unit` : `npx playwright install --with-deps chromium`, puis `npm run test:browser`.
  - **Tâche `webkit`**, qui dépend de `unit` : `npx playwright install --with-deps webkit`, puis `BROWSER=webkit npm run test:browser`.
  - Mêmes versions d'actions que `pages.yml` : `actions/checkout@v6` et `actions/setup-node@v7`, avec `cache: npm`.
  - `pages.yml` ne change pas.

- [ ] **Étape 1 : vérifier l'échec actuel sur WebKit.** `npx playwright install webkit` si besoin, puis `npm run build && BROWSER=webkit npm run test:browser`. Attendu avant `wheelAt` : FAIL, « Mouse wheel is not supported in mobile WebKit ». La course du focus est déjà corrigée par la tâche 14.
- [ ] **Étape 2 : implémenter** `wheelAt` et le workflow.
- [ ] **Étape 3 : vérifier en local.**
  - `npm run build && git diff --exit-code app.js sw.js && npm run check && npm test` ;
  - `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` ;
  - `BROWSER=webkit npm run test:browser`.

  Attendu : tout PASS, avec « webkit: browser checks passed; no application JavaScript errors. ». Valider la syntaxe YAML : `node -e "require('fs').readFileSync('.github/workflows/verify.yml','utf8')"` et une relecture.
- [ ] **Étape 4 : committer.** `ci: les tests à chaque push, sur Chromium et WebKit`.

### Tâche 19 : les README

**Fichiers :**
- Modifier : `README.fr.md`, `README.md`

**Interfaces :** aucune.

- [ ] **Étape 1 : mettre à jour les deux README, à l'identique sur le fond.**
  - **Données et confidentialité** :
    - un onglet resté sur une ancienne version garde ce qu'il ne connaît pas, et se recharge au repos ;
    - l'horloge de la ville n'avance qu'avec les séances, et le ciel suit l'heure réelle ;
    - la règle des étapes futures : ne jamais changer le sens d'un champ, ajouter un champ.
  - **Scripts** : la ligne `npm run test:browser` mentionne WebKit, avec `BROWSER=webkit`.
  - **Publication** : le workflow « Vérifier » tourne à chaque push. `pages.yml` reste manuel.
  - **Structure** : `tests/helpers/state-vm.cjs` et les nouveaux fichiers de tests, si la section liste les tests.
- [ ] **Étape 2 : vérifier.** Relire les deux README et chercher les mots qui ne vont pas avec `grep -n "noindex\|TODO" README*.md` (aucun résultat attendu pour ces mots). Puis `npm run check && npm test`.
- [ ] **Étape 3 : committer.** `docs: étape 7 dans les README, fiabilité et vérification continue`.

---

## Vérification finale

1. `npm run build && git diff --exit-code app.js sw.js && npm run check && npm test` : tout PASS.
2. `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`, puis `BROWSER=webkit npm run test:browser` : tout PASS, sans erreur JavaScript de l'app.
3. `npm run board` : la planche se génère, et le temps de dessin d'une image ne monte pas par rapport à `main`.
4. Relecture de toute la branche (`git diff main...etape-7-fiabilite`) au regard de la conception.
5. À vérifier sur appareil avant publication (hors CI) :
   - sur iPhone : écran allumé après une courte sortie, son relancé après un appel, son de fin après réouverture d'une Activité libre ;
   - sur Android : app installée plus onglet Chrome, mise à jour acceptée dans l'un et l'autre qui se recharge au repos.
