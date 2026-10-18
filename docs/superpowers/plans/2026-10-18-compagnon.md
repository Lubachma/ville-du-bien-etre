# Étape 6 — Un compagnon : plan d'implémentation

> **Pour les agents :** sous-compétence REQUISE : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans, tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**But :** un compagnon à choisir et à nommer (lapin, marmotte, ourson) qui vit dans la ville, fait chaque séance avec toi, propose la respiration guidée en Calme, gagne neuf accessoires au fil de la complicité, avec trois succès et la Cabane.

**Architecture :**
- **Données dans `src/00-core.js`** : `COMPANION_SPECIES`, `COMPANION_LEVELS`, `COMPANION_WEAR`, `COMPANION_NAME_MAX`, `BREATH_MS` ; plus tard trois succès, l'élément `cabane` (et `SHARE_ITEMS`).
- **Règles pures, sans DOM** : `src/29-companion.js` (nouveau) — niveaux, accessoires gagnés, arrivée, minutes, mot du jour.
- **Dessins** : `src/36-paint-companion.js` (nouveau) — `drawCompanion` (trois animaux, neuf gestes, neuf accessoires) et `paintCompanion` (un canevas à part : choix, fiche, bouton, séance, écran de fin).
- **Ville** : `src/35-city.js` place et dessine le compagnon (promenade le jour, sommeil la nuit) et ouvre sa fiche quand on le touche.
- **Interface** : `src/57-companion.js` (nouveau) — invitation, choix, fiche, bouton du compagnon, section des réglages ; `src/58-companion-session.js` (nouveau) — compagnon dans l'anneau, respiration guidée, bloc de l'écran de fin. Branchement dans `src/50-session.js`.

**Pile technique :** JavaScript sans framework (IIFE assemblée par `scripts/build.mjs`), canevas 2D, `node:test` dans une machine virtuelle Node, Playwright.

**Spécification :** `docs/superpowers/specs/2026-10-18-compagnon-design.md`. Tous ses choix sont ceux de Claude (Ludovic a demandé que Claude choisisse). La lire avant chaque tâche : ses règles ne sont pas toutes répétées ici.

**Branche :** `etape-6-compagnon`, qui porte déjà la spécification.

## Contraintes globales

- **Fichiers générés** : ne jamais modifier `app.js` ni `sw.js` à la main. Après tout changement de `src/`, `index.html` ou des feuilles de style, lancer `npm run build` et committer `app.js` et `sw.js` régénérés.
- **Vérifications de chaque tâche** : `npm run check` ; `npm test` ; `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`, dont la dernière ligne doit être `chromium: browser checks passed; no application JavaScript errors.`
- **Commits** : `git commit -F -` avec le message indiqué, suivi d'une ligne vide puis de :
  - `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  - `Claude-Session: https://claude.ai/code/session_01Y9ewUx6m7dMVmKYTE9Txwf`
- **Nouveaux fichiers de `src/`** : chacun est ajouté à `CLEAN_FILES` (`tests/i18n.test.cjs`) dans la tâche qui le crée ; aucun texte en dur, tout passe par `t()`.
- **Dictionnaires** :
  - chaque nouvelle clé existe en français et en anglais ; espaces insécables écrits ` `, apostrophe droite `'` en français, tutoiement ;
  - **aucun accord de genre**, ni pour la personne, ni pour le compagnon (son nom est libre) : son nom et des verbes, jamais d'adjectif ou de participe qui s'accorde avec lui (« Bienvenue à Pompon ! », « Pompon reçoit un bonnet », « Lui mettre ») ; en anglais, le nom plutôt que « he / she » ;
  - aucun mot de reproche, de manque ou d'attente (« triste », « s'ennuie », « manqué », « t'attend », « sad », « missed », « waiting ») ;
  - le compagnon parle à la première personne dans ses mots du jour, sans adjectif sur lui-même.
- **Caractères invisibles** : jamais écrits tels quels dans `src/` (un test le vérifie) ; toujours en `\u…`.
- **Reproductible** : le mot du jour se tire avec `chance(jour + ':compagnon')` (`24-ambient.js`), jamais avec `Math.random`.
- **Animations** : le compagnon ne bouge que si `S.settings.ambient !== false`, sans mouvements réduits (`reducedMotion()`) et page visible ; dans l'anneau, au plus une image toutes les 400 ms. La respiration guidée change d'état toutes les `BREATH_MS` (5000) ms ; avec les mouvements réduits, rien ne grandit (seul le mot change).
- **Silence** : aucun son, aucune vibration ajoutés par cette étape.
- **Mise en page** : textes contenus à 320, 390 et 768 px, en français comme en anglais (Linux affiche les mots un peu plus larges), y compris avec un nom de 20 caractères sans espace.
- **Modules optionnels** : `tests/state-session.test.cjs` et `tests/backup.test.cjs` chargent `10-state.js`, `45-settings.js` et `50-session.js` sans les nouveaux modules. Tout appel vers `29-companion.js`, `36-paint-companion.js`, `57-companion.js` ou `58-companion-session.js` depuis `35-city.js`, `40-ui.js`, `45-settings.js`, `50-session.js` ou `52-carnet.js` garde le motif `typeof f === 'function'`.
- **Lancer un scénario seul** : un petit script hors du dépôt charge `SCENARIOS` de `tests/companion-browser.cjs` et lance ceux nommés contre le serveur local (`PORT=8799 node scripts/serve.mjs`, après `npm run build`), comme pour l'étape 5. C'est « le lanceur » des tâches ci-dessous.
- **Débogage** (il s'étoffe tâche après tâche, chaque entrée arrivant avec sa fonction) : `window.__ville` gagne `companion: { state: () => S.companion, level: () => companionLevel(), word: day => companionWord(day), spot: () => City.companionSpot(), box: () => City.companionBox(), session: () => sessionCompanionState(), bounds: (look, size) => companionBounds(look, size) }`.

## Points de vigilance

Cinq situations que la spécification implique sans les nommer ; chacune a son test dans la tâche indiquée.

1. **Un nom de 20 caractères sans espace** (« Wwwwwwwwwwwwwwwwwwww ») : rien ne déborde à 320 px, ni dans le bouton « Accueillir … », ni dans la fiche, ni sur l'écran de fin (Tasks 5, 7, 8).
2. **Le nom suggéré suit la langue** : un compagnon jamais renommé s'appelle Pompon en français et Pompom en anglais (le nom enregistré est `''`) (Tasks 2 et 5).
3. **Une séance interrompue qui fait passer un niveau** : les minutes comptent, l'écran d'interruption reste sans mot de plus, et l'accessoire attend dans la garde-robe (Task 8).
4. **Routine qui passe du Calme à un autre domaine** : le bouton de respiration disparaît et le guide s'arrête ; il revient à l'étape Calme suivante (Task 9).
5. **Compagnon masqué, respiration allumée** : le bouton dit « Respiration guidée » et le disque respire à sa place (Task 9).

## Fichiers

- Create : `src/29-companion.js`, `src/36-paint-companion.js`, `src/57-companion.js`, `src/58-companion-session.js`, `tests/companion.test.cjs`, `tests/companion-browser.cjs`.
- Modify : `src/00-core.js`, `src/10-state.js`, `src/23-achievements.js`, `src/32-paint-decor.js`, `src/35-city.js`, `src/40-ui.js`, `src/45-settings.js`, `src/50-session.js`, `src/60-boot.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `index.html`, `styles-features.css`, `tests/i18n.test.cjs`, `tests/browser.cjs`, `tests/harmony-browser.cjs`, `tests/carnet.test.cjs`, `tests/collection-state.test.cjs`, `tests/content.test.cjs`, `tests/content-browser.cjs`, `tests/share.test.cjs`, `tests/board.cjs`, `README.md`, `README.fr.md`.

---

### Task 1 : Données du compagnon

**Files:**
- Modify: `src/00-core.js`, `src/10-state.js`
- Create: `tests/companion.test.cjs`

**Interfaces:**
- Produces (`00-core.js`) :
  - `COMPANION_SPECIES = ['lapin', 'marmotte', 'ourson']` ;
  - `COMPANION_LEVELS = [0, 20, 60, 120, 240, 420, 660, 960, 1320, 1800]` (minutes du niveau 1 au niveau 10) ;
  - `COMPANION_WEAR = ['echarpe', 'bonnet', 'lunettes', 'couronne', 'noeud', 'paille', 'sac', 'casque', 'cape']` (`COMPANION_WEAR[i]` s'obtient au niveau `i + 2`) ;
  - `COMPANION_NAME_MAX = 20` ; `BREATH_MS = 5000`.
- Produces (`10-state.js`) :
  - par défaut : `companion: null`, `companionLater: 0`, réglages `companionShown: true`, `breathing: false` (validés : booléens, `companionShown` vrai sauf `false`, `breathing` faux sauf `true`) ;
  - `companionLevelOf(minutes): number` — le plus grand niveau dont le seuil est atteint (défini ici, car `normalize` et `merge3` en ont besoin) ;
  - `knownCompanion(raw): Companion | null` — `{ species, name, since, minutes, wear }` : espèce de `COMPANION_SPECIES` sinon `null` ; `since` date valide sinon `null` ; `name` texte nettoyé (espaces des bords retirés, caractères de contrôle et invisibles retirés), gardé s'il fait de 1 à 20 caractères, sinon `''` ; `minutes` nombre fini entre 0 et 1e7, sinon 0 ; `wear` un accessoire déjà gagné au niveau de `minutes`, sinon `''` ;
  - `companionLater` : date valide, sinon 0 ;
  - `mergeCompanion(B, L, R): Companion | null` — un compagnon gagne sur `null` ; deux `since` différents : le plus ancien reste tel quel ; même `since` : `minutes = R.minutes + (L.minutes - B.minutes)` si B a le même `since`, sinon `max(L.minutes, R.minutes)` ; `species`, `name`, `wear` : celui de L s'il diffère de B (même `since`), sinon celui de R ; le résultat repasse par `knownCompanion` ;
  - `merge3` : `M.companion = mergeCompanion(…)`, `M.companionLater = max(L, R)`.

- [ ] **Step 1 : Écrire les tests** dans `tests/companion.test.cjs` (FILES : `00-core`, `05-i18n`, `06-lang-fr`, `07-lang-en`, `10-state`, `20-rules`, `22-sets`, `23-achievements`, `24-ambient`, `46-features`) :
  - `'compagnon : rien par défaut, réglages par défaut et validés'` : `defaultState()` donne `companion === null`, `companionLater === 0`, `companionShown === true`, `breathing === false` ; `normalize` ramène `breathing: 'oui'` à `false` et `companionShown: 0` à `true` ;
  - `'compagnon : validation'` : garde `{ species: 'lapin', name: ' Pompon ', since: T0, minutes: 75, wear: 'bonnet' }` avec le nom `'Pompon'` ; `species: 'chat'` → `null` ; nom de 21 caractères → `''` ; nom fait seulement d'espaces ou de caractères invisibles → `''` ; `minutes: -5` → 0 ; `wear: 'bonnet'` avec 30 minutes (niveau 2) → `''` ; `wear: 'cape'` avec 1800 minutes → `'cape'` ; `wear: 'licorne'` → `''` ;
  - `'compagnon : niveaux aux seuils'` : `companionLevelOf` de `[0, 19.9, 20, 59, 60, 1799, 1800, 99999]` → `[1, 1, 2, 2, 3, 9, 10, 10]` ;
  - `'compagnon : fusion de deux onglets'` : `null` et un compagnon → le compagnon ; deux compagnons de `since` différents → le plus ancien ; même compagnon, B à 20 min, L à 50, R à 30 → 60 ; nom changé dans L seulement → celui de L ; accessoire changé dans R seulement → celui de R ; `companionLater` → le plus récent.
- [ ] **Step 2 : Le voir échouer** — Run: `node --test tests/companion.test.cjs`. Expected: FAIL.
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(données): le compagnon, ses niveaux et ses accessoires`.

### Task 2 : Règles du compagnon

**Files:**
- Create: `src/29-companion.js`
- Modify: `src/23-achievements.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/companion.test.cjs`, `tests/i18n.test.cjs` (`CLEAN_FILES`)

**Interfaces:**
- Consumes : `companionLevelOf`, `COMPANION_*`, `nowTs()`.
- Produces (`29-companion.js`) :
  - `companionLevel(c = S.companion): number` — 0 sans compagnon ;
  - `companionNext(c = S.companion): { level, left, wear } | null` — le prochain niveau, les minutes qui restent et son accessoire ; `null` au niveau 10 ou sans compagnon ;
  - `wearUnlocked(level): string[]` — les accessoires gagnés à ce niveau, dans l'ordre de `COMPANION_WEAR` ;
  - `companionName(c = S.companion): string` — le nom, ou `t('companion.suggest.' + species)` si le nom est `''` ;
  - `cleanCompanionName(raw): string` — même nettoyage que `knownCompanion` ;
  - `adoptCompanion(species, name): Companion` — `{ species, name: cleanCompanionName(name), since: nowTs(), minutes: 0, wear: '' }` dans `S.companion` ; n'enregistre pas ;
  - `editCompanion(species, name): void` — change l'animal et le nom, garde le reste ;
  - `addCompanionMinutes(min): { gained, before, after } | null` — ajoute `min > 0` aux minutes s'il y a un compagnon ; `before` et `after` sont les niveaux ; n'enregistre pas ;
  - `wearCompanion(id): boolean` — `''` ou un accessoire gagné ; sinon `false` sans rien changer ;
  - `companionInvite(): boolean` — `S.stats.ok >= 1 && !S.companion && !S.companionLater` ;
  - `companionPose(cat): string` — `esprit → 'read'`, `corps → 'stretch'`, `calme → 'meditate'`, `foyer → 'water'`, `crea → 'paint'`.
- Produces (`23-achievements.js`) : deux sortes de succès, `companion` (rempli avec un compagnon) et `companionLevel` (`companionLevel() >= def.n`, avec sa progression dans `achievementProgress`, unité `'n'`), protégées par `typeof companionLevel === 'function'`.
- Dictionnaires : `companion.species.<espèce>` (Lapin, Marmotte, Ourson / Rabbit, Marmot, Bear cub), `companion.suggest.<espèce>` (Pompon, Noisette, Caramel / Pompom, Hazel, Toffee), `companion.wear.<id>` (Écharpe…, pour la garde-robe) et `companion.wearThing.<id>` (« une écharpe », « un bonnet », « des lunettes rondes », « une couronne de fleurs », « un nœud papillon », « un chapeau de paille », « un sac à dos », « un casque audio », « une cape étoilée » / « a scarf », « a beanie », « round glasses », « a flower crown », « a bow tie », « a straw hat », « a backpack », « headphones », « a starry cape »).

- [ ] **Step 1 : Écrire les tests** (ajouter `29-companion.js` aux FILES) :
  - `'compagnon : arrivée, nom nettoyé, nom suggéré selon la langue'` : `adoptCompanion('lapin', '  Pompon  ')` → nom `'Pompon'`, 0 min, niveau 1 ; `adoptCompanion('ourson', '')` → `companionName()` vaut `'Caramel'` en français et `'Toffee'` après `setLang('en')` ; `editCompanion('marmotte', 'Mélèze')` garde `since` et les minutes ;
  - `'compagnon : minutes, niveaux et accessoires'` : sans compagnon, `addCompanionMinutes(30)` → `null` ; avec, `addCompanionMinutes(25)` → `{ gained: 25, before: 1, after: 2 }` ; `wearUnlocked(2)` → `['echarpe']`, `wearUnlocked(10)` → les neuf ; `companionNext()` à 25 min → `{ level: 3, left: 35, wear: 'bonnet' }` ; à 1800 → `null` ; `wearCompanion('bonnet')` → `false` au niveau 2, `wearCompanion('echarpe')` → `true`, `wearCompanion('')` → `true` ;
  - `'compagnon : invitation après une séance réussie, jamais après « Pas maintenant »'` : `stats.ok` 0 → `false` ; 1 → `true` ; `companionLater` posé → `false` ; compagnon accueilli → `false` ;
  - `'compagnon : un geste par domaine'` : les cinq valeurs de `companionPose` ;
  - `'compagnon : succès d’arrivée et de niveau'` : avec des succès factices `{ kind: 'companion', n: 1 }` et `{ kind: 'companionLevel', n: 5 }`, `achievementMet` faux sans compagnon, vrai après l'arrivée pour le premier, vrai à 240 min pour le second ; `achievementProgress` du second rend `{ have: 2, need: 5, unit: 'n' }` à 25 min.
- [ ] **Step 2 : Le voir échouer** — Run: `node --test tests/companion.test.cjs`. Expected: FAIL (`adoptCompanion is not defined`).
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(compagnon): arrivée, complicité, accessoires et succès`.

### Task 3 : Le mot du jour

**Files:**
- Modify: `src/29-companion.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/companion.test.cjs`

**Interfaces:**
- Consumes : `chance`, `dayWeather(day)`, `seasonOf(day)`, `visitorOf(day)`, `festivalsOn(day)` (`24-ambient.js`), `S.history` (entrées `{ day, cat, ok, elapsedSec }`), `S.townWish`.
- Produces (`29-companion.js`) : `companionWord(day = today()): string` — `''` sans compagnon. Sinon :
  - **retour** : si la dernière séance d'un jour antérieur (réussie, ou interrompue avec du temps fait) date d'au moins 3 jours (au moins 2 jours sans séance entre les deux), `t('companion.word.back')`, avant tout le reste ;
  - sinon une liste de **14 places**, dans cet ordre : le domaine de la dernière séance d'hier (`companion.word.cat.<cat>`), la météo du jour (`companion.word.weather.<météo>`), la saison (`companion.word.season.<saison>`), le visiteur du jour (`companion.word.visitor`, `{ visitor, n }` avec `n = 2` pour un visiteur au pluriel), le souhait du jour (`companion.word.wish` quand `S.townWish.day === day`), une fête du jour (`companion.word.festival`, `{ name }`), puis `companion.word.small1` à `small8` ; une place sans son contexte prend la petite phrase `small<k>` (k = 1 + son rang modulo 8) ; le mot est la place `floor(chance(day + ':compagnon') * 14)`.
- Dictionnaires : `companion.word.back`, `companion.word.cat.{esprit,corps,calme,foyer,crea}`, `companion.word.weather.{sun,clouds,rain,snow,fog}` (selon les valeurs que rend `dayWeather`), `companion.word.season.{spring,summer,autumn,winter}`, `companion.word.visitor` (forme `{ one, other }`), `companion.word.wish` (« Quelqu'un aimerait un décor juste à côté : tu as vu la bulle ? », sans nom de bâtiment), `companion.word.festival`, `companion.word.small1…8`. Le retour dit : « Quelle joie de te revoir ! J'ai gardé ta ville bien au chaud. »

- [ ] **Step 1 : Écrire les tests** :
  - `'mot du jour : le même toute la journée, un autre jour peut changer'` : deux appels pour `2026-10-20` rendent le même texte, non vide, en français comme en anglais ; sur 30 jours, au moins 5 mots différents ;
  - `'mot du jour : le retour passe en premier'` : dernière séance le `2026-10-16`, jour `2026-10-19` → le mot du retour ; dernière séance le `2026-10-17` → pas lui ;
  - `'mot du jour : chaque contexte a sa phrase'` : pour chaque place, un jour où `chance` la choisit (cherché dans la boucle du test) donne le texte attendu quand son contexte existe ; sans séance hier, la place du domaine donne une petite phrase ;
  - `'mot du jour : jamais un reproche ni un accord'` : aucun des textes français ne contient `triste|ennuie|manqu|attend|content|ravi|heureu|fier|fière|seul` ; aucun des textes anglais ne contient `sad|bored|miss|waiting|lonely| he | she `.
- [ ] **Step 2 : Le voir échouer** — Run: `node --test tests/companion.test.cjs`. Expected: FAIL (`companionWord is not defined`).
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(compagnon): un mot gentil chaque jour`.

### Task 4 : Dessins du compagnon

**Files:**
- Create: `src/36-paint-companion.js`, `tests/companion-browser.cjs`
- Modify: `src/60-boot.js`, `tests/browser.cjs`, `tests/i18n.test.cjs` (`CLEAN_FILES`)

**Interfaces:**
- Consumes : `makePainter(ctx, tw, ox, oy, pal)`, `readPalette()` (`30-paint.js`), `ellipseFill` et `line` (`34-paint-life.js`).
- Produces (`36-paint-companion.js`) :
  - `drawCompanion(g, sx, sy, look, t): void` — `(sx, sy)` le point sous le compagnon, taille d'environ `0,22 × g.tw` de haut ; `look = { species, wear, pose }` ; poses `'idle'` (assis), `'walk'`, `'sleep'` (roulé en boule, quelques « z »), `'read'`, `'stretch'`, `'meditate'` (yeux fermés), `'water'`, `'paint'`, `'cheer'` ; `t` (secondes) choisit l'image d'animation : 0 donne la pose de repos de chaque geste ;
  - `paintCompanion(cv, look, size, opts = {}): void` — dessine dans le canevas `cv` (côté `size` px, densité de l'écran jusqu'à 3), compagnon centré, sans sol ; `opts.face` cadre la tête (bouton du compagnon) ; `opts.t` le temps d'animation ;
  - `companionBounds(look, size): { empty: boolean, x0, y0, x1, y1 }` — la boîte des pixels dessinés par `paintCompanion` (pour les tests).
- Les trois animaux partagent un même corps rond ; ils diffèrent par les oreilles (longues pour le lapin, petites et rondes pour la marmotte et l'ourson), la queue, les couleurs et le museau. Chaque accessoire se place sur des points d'ancrage communs (haut de la tête, yeux, cou, dos).
- `tests/companion-browser.cjs` exporte `{ runCompanion, SCENARIOS, seed, tile, NOW }` comme `harmony-browser.cjs` ; `tests/browser.cjs` l'appelle après l'harmonie.

- [ ] **Step 1 : Écrire le test** `paintAll` dans `tests/companion-browser.cjs` : pour chaque animal, chaque pose et chaque accessoire (et aucun), `__ville.companion.bounds({ species, pose, wear }, 96)` n'est pas vide et reste dans `[1, 95]` sur les deux axes ; le visage seul (`face`) aussi ; aucune erreur de page.
- [ ] **Step 2 : Le voir échouer** — Run: `npm run build && node <lanceur des scénarios> paintAll`. Expected: FAIL (`__ville.companion` absent).
- [ ] **Step 3 : Implémenter** les dessins, puis `companion.bounds` dans le débogage de `60-boot.js`.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` et la dernière ligne du navigateur.
- [ ] **Step 5 : Commit** — `feat(compagnon): trois animaux, neuf gestes, neuf accessoires`.

### Task 5 : L'arrivée — invitation et choix

**Files:**
- Create: `src/57-companion.js`
- Modify: `src/40-ui.js`, `src/60-boot.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `styles-features.css`, `tests/companion-browser.cjs`, `tests/i18n.test.cjs` (`CLEAN_FILES`)

**Interfaces:**
- Consumes : `companionInvite`, `adoptCompanion`, `editCompanion`, `companionName`, `paintCompanion`, `progressNow()` et `cheer(fresh, lead)` (`53-visits.js`), `openSheet(title, build)`, `h()`.
- Produces (`57-companion.js`) :
  - `renderCompanionInvite(): void` — carte `#companionInvite` (`class: 'card companion-invite'`) juste après `.city-tools`, avant `#townWishCard` ; cachée sans invitation ; boutons « Faire connaissance » (`openCompanionChoice()`) et « Pas maintenant » (`S.companionLater = nowTs()`, `commit()`, le focus va sur `#personalizeCity`) ;
  - `openCompanionChoice({ edit = false } = {}): void` — fenêtre « Ton compagnon » : `radiogroup` des trois animaux (un canevas `paintCompanion` de 72 px et le nom de l'animal dans chaque bouton), champ `#companionName` (`maxlength` 20, étiquette « Son nom »), bouton principal « Accueillir {name} » (« Enregistrer » en modification) qui suit le nom tapé ou la suggestion ; tant que le champ n'a pas été modifié, il prend la suggestion de l'animal choisi ;
  - à l'arrivée : `adoptCompanion`, puis `const fresh = progressNow(); commit(); cheer(fresh, t('companion.welcome', { name }))` ;
  - en modification : `editCompanion`, `commit()`, message `companion.saved`.
- `renderVille` (`40-ui.js`) appelle `renderCompanionInvite()` avant `renderTownWishCard()`.

- [ ] **Step 1 : Écrire les tests** (scénarios de `tests/companion-browser.cjs`) :
  - `inviteAfterFirstSession` : ville sans séance réussie → pas de carte ; avec `stats.ok: 1` → la carte, avec sa phrase, contenue à 320 px en français et en anglais ; « Pas maintenant » → la carte disparaît, et toujours rien après un rechargement ;
  - `adoptDefault` : « Faire connaissance », animal Marmotte → le champ vaut « Noisette » et le bouton « Accueillir Noisette » ; Lapin → « Pompon » ; nom tapé « Lune » puis animal Ourson → « Lune » reste ; « Accueillir Lune » → message « Bienvenue à Lune ! », `__ville.companion.state()` vaut `{ species: 'ourson', name: 'Lune', minutes: 0, wear: '' }` (et `since`) ; la carte a disparu ;
  - *Point de vigilance 1* `adoptLongName` : à 320 px, nom « Wwwwwwwwwwwwwwwwwwww » → la fenêtre ne déborde pas (`#sheetBody` et la page), en français puis en anglais ;
  - *Point de vigilance 2* `suggestedNameFollowsLanguage` : arrivée avec le champ vidé → le nom affiché est « Pompon », puis « Pompom » après le passage à l'anglais.
- [ ] **Step 2 : Le voir échouer** — Run: le lanceur sur ces scénarios. Expected: FAIL.
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` et la dernière ligne du navigateur.
- [ ] **Step 5 : Commit** — `feat(compagnon): l'invitation et le choix de l'animal et du nom`.

### Task 6 : Le compagnon dans la ville

**Files:**
- Modify: `src/35-city.js`, `src/57-companion.js`, `src/60-boot.js`, `index.html`, `styles-features.css`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/companion-browser.cjs`, `tests/harmony-browser.cjs`

**Interfaces:**
- Consumes : `drawCompanion`, `paintCompanion`, `walkableTiles()`, `walkPaths(cells)`, `walkerPos(path, i, t)` (`35-city.js`), `companionName`.
- Produces (`35-city.js`) :
  - le compagnon s'ajoute à la liste triée en profondeur (comme les habitants), si `S.companion && S.settings.companionShown !== false && !visit` : **le jour**, sur un chemin de promenade à demi-vitesse (`walkerPos(paths[5], 5, t / 2)`), pose `'walk'` ; **la nuit** (`g.night`), pose `'sleep'`, à côté de la première Cabane posée (une case voisine libre, sinon sa propre case) ou, sans Cabane, sur la case de promenade la plus proche du centre ;
  - `companionBox` (zone touchable, comme `visitorBox`) ; le toucher (petite carte et vue en grand) ouvre `openCompanionSheet()` avant la bulle du souhait et les bâtiments ;
  - `City.companionBox()` et `City.companionSpot(): { pose, x, y } | null` (case et pose du dernier dessin) ;
  - `overlayBoxes()` compte aussi `#companionBtn` sur la petite carte.
- Produces (`index.html`, `57-companion.js`) : bouton `#companionBtn` (`class: 'icon-btn companion-btn'`, un canevas `aria-hidden`) dans `#sky`, en bas à gauche ; `renderCompanionButton()` le montre avec un compagnon visible et hors du mode de pose, y dessine le visage (`paintCompanion(…, { face: true })`) et lui donne pour nom `t('companion.buttonLabel', { name })` (« {name}, ton compagnon ») ; il ouvre `openCompanionSheet()` (une fenêtre provisoire, remplie à la Task 7). `Mode.render` et `renderVille` l'appellent.

- [ ] **Step 1 : Écrire les tests** :
  - `townDayNight` : à 10 h, `__ville.companion.spot()` a la pose `'walk'` et une case du terrain ; à 23 h, la pose `'sleep'` ; avec une Cabane posée en `(1, 1)` (élément `cabane` ajouté à la Task 11 : ce test arrive à cette tâche-là), une case voisine ;
  - `townTapAndButton` : `#companionBtn` porte le nom « Pompon, ton compagnon » et ouvre la fiche ; un toucher au centre de `__ville.companion.box()` l'ouvre aussi, sur la petite carte et dans la vue en grand ;
  - `townHiddenAndVisit` : `companionShown: false` → pas de bouton, `spot()` vaut `null` ; visite de sa propre ville (`share.open(share.encode())`) → `spot()` vaut `null` ;
  - `harmony-browser.cjs` `wishBubbleClear` : avec un compagnon, la bulle évite aussi `#companionBtn`.
- [ ] **Step 2 : Le voir échouer** — Run: le lanceur sur ces scénarios. Expected: FAIL.
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` et la dernière ligne du navigateur.
- [ ] **Step 5 : Commit** — `feat(compagnon): il se promène le jour, dort la nuit, et ouvre sa fiche`.

### Task 7 : La fiche du compagnon

**Files:**
- Modify: `src/57-companion.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `styles-features.css`, `tests/companion-browser.cjs`

**Interfaces:**
- Consumes : `companionLevel`, `companionNext`, `wearUnlocked`, `wearCompanion`, `companionWord`, `companionName`, `paintCompanion`, `fmtMin`.
- Produces (`57-companion.js`) : `openCompanionSheet(): void` — fenêtre au nom du compagnon :
  - le compagnon en grand (pose `'idle'`, son accessoire) ;
  - `t('companion.levelLine', { species, level })` (« Lapin · complicité niveau 3 ») ;
  - `t('companion.progress', { time, next, thing })` (« 1 h 10 ensemble · prochain cadeau dans 50 min : un bonnet ») ; au niveau 10, `t('companion.progressMax', { time })` ;
  - le mot du jour, en citation ;
  - la garde-robe : `radiogroup` « Garde-robe » de dix boutons (« Aucun » et les neuf accessoires, chacun avec son petit dessin) ; un accessoire pas encore gagné est désactivé et montre `t('companion.wearLevel', { level })` (« Niveau 6 ») ; choisir enregistre aussitôt (`wearCompanion`, `commit()`) et redessine ;
  - le bouton « Modifier » → `openCompanionChoice({ edit: true })`.

- [ ] **Step 1 : Écrire les tests** :
  - `sheetContent` : compagnon à 70 min (niveau 3) → « Lapin · complicité niveau 3 », « 1 h 10 ensemble · prochain cadeau dans 50 min : un bonnet », le mot du jour (`__ville.companion.word()`) ; à 1800 min → « 30 h ensemble » sans « prochain cadeau » ;
  - `wardrobe` : au niveau 3, « Écharpe » et « Bonnet » se choisissent, « Lunettes rondes » est désactivé avec « Niveau 4 » ; choisir « Bonnet » → `state().wear === 'bonnet'`, gardé après un rechargement ; « Aucun » → `''` ;
  - *Point de vigilance 1* `sheetLongName` : nom de 20 caractères à 320 px, en français et en anglais → rien ne déborde.
- [ ] **Step 2 : Le voir échouer** — Run: le lanceur sur ces scénarios. Expected: FAIL.
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` et la dernière ligne du navigateur.
- [ ] **Step 5 : Commit** — `feat(compagnon): sa fiche, son mot du jour et sa garde-robe`.

### Task 8 : Pendant la séance et à la fin

**Files:**
- Create: `src/58-companion-session.js`
- Modify: `src/50-session.js`, `src/60-boot.js`, `index.html`, `styles-features.css`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/companion-browser.cjs`, `tests/i18n.test.cjs` (`CLEAN_FILES`)

**Interfaces:**
- Consumes : `companionPose`, `addCompanionMinutes`, `companionWord`, `wearCompanion`, `paintCompanion`, `companionName`.
- Produces (`index.html`) : `<canvas id="sessCompanion" aria-hidden="true" hidden>` dans `.ring-center`, après `#timerSub`.
- Produces (`58-companion-session.js`) :
  - `renderSessionCompanion(a): void` — appelé par `showRun(a)` : montre `#sessCompanion` avec un compagnon visible, dessiné dans la pose `companionPose(a.cat)` ; si la ville peut s'animer, une image toutes les 400 ms (`opts.t`), sinon une seule ;
  - `stopSessionCompanion(): void` — appelé par `endRun()` : arrête l'animation ;
  - `sessionCompanionState(): { shown, pose, animated } ` (débogage) ;
  - `companionResult(gain, firstToday): Node | null` — bloc de l'écran de fin : le compagnon en pose `'cheer'`, `t('companion.together', { min })` (« +20 min ensemble »), le mot du jour si `firstToday`, et si `gain.after > gain.before` : `t('companion.levelUp', { level, name, thing })` (« Complicité niveau 3 : Pompon reçoit un bonnet ») avec le bouton « Lui mettre » (`wearCompanion`, `commit()`, le bouton devient « C'est fait » désactivé) ; plusieurs niveaux d'un coup : le plus haut, avec son accessoire ;
  - `companionFail(): Node | null` — le compagnon assis (pose `'idle'`), sans texte.
- Modifie (`50-session.js`) :
  - `completeSession` : `const gain = typeof addCompanionMinutes === 'function' ? addCompanionMinutes(a.min) : null`, **avant** `checkAchievements()` ; `firstToday` vrai si c'est la seule séance réussie de son jour dans l'historique ; `showSuccess(…, gain, firstToday)` ajoute `companionResult` avant les actions ;
  - `failSession` et `failInterrupted` : `addCompanionMinutes(elapsedSec / 60)` avant `commit` ; `showFail` ajoute `companionFail()` sous l'icône.

- [ ] **Step 1 : Écrire les tests** :
  - `sessionPoses` : pour chaque domaine, une séance lancée montre `#sessCompanion` et `__ville.companion.session()` donne la pose attendue ; à 320 px, le compagnon reste dans l'anneau et la page ne déborde pas ; `ambient: false` → `animated: false` ; `companionShown: false` → `#sessCompanion` caché ;
  - `successScreen` : compagnon à 15 min, séance de 10 min réussie (horloge avancée) → « +10 min ensemble », « Complicité niveau 2 : Pompon reçoit une écharpe », « Lui mettre » → `state().wear === 'echarpe'` et le bouton dit « C'est fait » ; la première séance du jour montre le mot du jour, la deuxième non ; avec `companionShown: false`, les minutes s'ajoutent quand même, sans bloc du compagnon ;
  - *Point de vigilance 3* `interruptedCounts` : compagnon à 15 min, séance abandonnée après 6 min → `state().minutes` ≈ 21, l'écran d'interruption montre le compagnon sans texte de complicité ;
  - *Point de vigilance 1* `successLongName` : nom de 20 caractères, écran de fin à 320 px → rien ne déborde.
- [ ] **Step 2 : Le voir échouer** — Run: le lanceur sur ces scénarios. Expected: FAIL.
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` et la dernière ligne du navigateur.
- [ ] **Step 5 : Commit** — `feat(compagnon): il fait ta séance avec toi et se réjouit à la fin`.

### Task 9 : Respirer ensemble

**Files:**
- Modify: `src/58-companion-session.js`, `src/50-session.js`, `src/45-settings.js`, `index.html`, `styles-features.css`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/companion-browser.cjs`

**Interfaces:**
- Produces (`index.html`) : `<div class="breath-disc" id="breathDisc" aria-hidden="true">` dans `.ring-wrap`, derrière `.ring-center` ; `<span class="breath-word" id="breathWord" aria-hidden="true" hidden>` dans `.ring-center` ; bouton `#breathBtn` (`class: 'btn btn-ghost'`, `aria-pressed`, `aria-describedby="breathHelp"`) dans `.sess-foot`, avant `#ambienceBtn` ; `<p class="visually-hidden" id="breathHelp" data-i18n="breath.help">`.
- Produces (`58-companion-session.js`) :
  - `renderBreathing(a): void` — appelé par `showRun(a)` : `#breathBtn` visible seulement si `a.cat === 'calme'` ; son texte `t('breath.with', { name })` avec un compagnon visible, sinon `t('breath.guided')` ; allume le guide si `S.settings.breathing` ;
  - `setBreathing(on): void` — `S.settings.breathing = on`, `commit({ silent: true })` ; allume ou éteint ;
  - le guide allumé : classe `breathing` sur `.ring-wrap`, puis toutes les `BREATH_MS` ms la classe alterne entre `inhale` et `exhale` et `#breathWord` entre `t('breath.in')` (« Inspire ») et `t('breath.out')` (« Expire ») ; `#timerSub` est caché tant que le guide tourne ; le compagnon (ou `#breathDisc` sans compagnon visible) grandit en `inhale` (CSS `transform: scale(1.12)`, transition de 5 s) ; `@media (prefers-reduced-motion: reduce)` : pas de transformation, le mot change en fondu ;
  - `stopBreathing(): void` — appelé par `endRun()` et au changement d'étape d'une routine.
- `45-settings.js` (`settingsSessions`) : interrupteur `t('settings.breathing')` (« Respiration guidée pendant les séances Calme »).

- [ ] **Step 1 : Écrire les tests** :
  - `breathOnlyCalm` : séance Esprit → `#breathBtn` caché ; séance Calme → visible, « Respirer avec Pompon », `aria-pressed="false"`, décrit par « 5 secondes pour inspirer, 5 pour expirer » ;
  - `breathCycle` (horloge installée) : on allume → « Inspire » visible, `.ring-wrap.inhale` ; après 5 s → « Expire », `.exhale` ; `#timerSub` caché ; la séance Calme suivante démarre avec le guide allumé (`S.settings.breathing === true`) ; l'interrupteur des réglages l'éteint ;
  - `breathReducedMotion` : `reducedMotion: 'reduce'` → la transformation calculée du compagnon reste `none` en `inhale`, le mot change toujours ;
  - *Point de vigilance 4* `breathRoutine` : routine Calme puis Corps → le guide s'arrête et le bouton disparaît à l'étape Corps ;
  - *Point de vigilance 5* `breathHidden` : `companionShown: false` → « Respiration guidée », et `#breathDisc` grandit en `inhale`.
- [ ] **Step 2 : Le voir échouer** — Run: le lanceur sur ces scénarios. Expected: FAIL.
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` et la dernière ligne du navigateur.
- [ ] **Step 5 : Commit** — `feat(respiration): respirer avec le compagnon pendant les séances Calme`.

### Task 10 : Réglages du compagnon

**Files:**
- Modify: `src/45-settings.js`, `src/57-companion.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/companion-browser.cjs`

**Interfaces:**
- Produces (`45-settings.js`) : `settingsCompanion()`, placée après `settingsRituals()` dans `openSettings` : titre « Compagnon » ; avec un compagnon : interrupteur `t('settings.companionShown', { name })` (« Afficher Pompon ») et bouton « Modifier » (`openCompanionChoice({ edit: true })`) ; sans compagnon : bouton « Accueillir un compagnon » (`openCompanionChoice()`). Appel protégé par `typeof openCompanionChoice === 'function'`.

- [ ] **Step 1 : Écrire les tests** :
  - `settingsLater` : après « Pas maintenant », Réglages › Compagnon › « Accueillir un compagnon » ouvre le choix, et l'arrivée fonctionne ;
  - `settingsHide` : « Afficher Pompon » coupé → plus de bouton ni de compagnon dans la ville ; rallumé → ils reviennent ; « Modifier » change l'animal et garde les minutes ;
  - la section tient à 320 px en français et en anglais.
- [ ] **Step 2 : Le voir échouer** — Run: le lanceur sur ces scénarios. Expected: FAIL.
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` et la dernière ligne du navigateur.
- [ ] **Step 5 : Commit** — `feat(réglages): la section Compagnon`.

### Task 11 : Trois succès et la Cabane

**Files:**
- Modify: `src/00-core.js`, `src/32-paint-decor.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/companion.test.cjs`, `tests/companion-browser.cjs`, `tests/carnet.test.cjs`, `tests/collection-state.test.cjs`, `tests/content.test.cjs`, `tests/content-browser.cjs`, `tests/share.test.cjs`

**Interfaces:**
- Produces (`00-core.js`) :
  - succès `{ id: 'premiere-rencontre', family: 'companion', kind: 'companion', n: 1 }`, `{ id: 'complices', family: 'companion', kind: 'companionLevel', n: 5 }`, `{ id: 'inseparables', family: 'companion', kind: 'companionLevel', n: 10, reward: 'cabane' }`, à la fin de `ACHIEVEMENTS` ;
  - `ITEMS.cabane = { group: 'decor', price: 3e6, reward: 'inseparables', fem: true, hf: <selon le dessin, au plus .95> }` ;
  - `'cabane'` à la fin de `SHARE_ITEMS`.
- Produces (`32-paint-decor.js`) : `DRAW.cabane` — petite cabane en bois, toit en pente, porte ronde, pot de fleurs.
- Dictionnaires : `ach.premiere-rencontre.*`, `ach.complices.*`, `ach.inseparables.*`, `item.cabane` (« Cabane » / « Hut ») et sa description si les autres décors en ont une.

- [ ] **Step 1 : Écrire les tests** :
  - `'compagnon : trois succès et la Cabane'` : « Première rencontre » à l'arrivée ; « Complices » à 240 min ; « Inséparables » à 1800 min, qui débloque `cabane` (`lockInfo('cabane') === null`) ; la Cabane est un décor (`group: 'decor'`), absent de `NATURE_ITEMS` ;
  - mettre à jour les nombres : 48 succès (`collection-state`, `carnet` : `total: 48`), 52 éléments (`content` et `carnet` : `total: 52`), le carnet du navigateur (« sur 48 », 52 cases et 52 canevas), et le nombre de décors offerts cachés s'il est compté ;
  - `share.test.cjs` : un lien avec une Cabane se relit ;
  - `townDayNight` (Task 6) : la Cabane posée → le compagnon dort à côté ;
  - le dessin de la Cabane reste dans ses limites (test des dessins existant).
- [ ] **Step 2 : Le voir échouer** — Run: `npm test`. Expected: FAIL.
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` et la dernière ligne du navigateur.
- [ ] **Step 5 : Commit** — `feat(compagnon): trois succès et la Cabane`.

### Task 12 : Planche et README

**Files:**
- Modify: `tests/board.cjs`, `README.md`, `README.fr.md`

**Interfaces:**
- Produces (`tests/board.cjs`) : `companionBoards()` — `compagnons.png` (trois animaux × neuf poses), `accessoires.png` (trois animaux × neuf accessoires), `seance-compagnon.png` (écran de séance Esprit avec compagnon, et Calme avec respiration), `fin-compagnon.png` (écran de fin avec niveau gagné), `ville-compagnon.png` (ville de jour avec le bouton, et de nuit avec la Cabane), à 390 px.
- README : l'étape 6 dans les fonctionnalités et la structure (`29-companion.js`, `36-paint-companion.js`, `57-companion.js`, `58-companion-session.js`), en français et en anglais.

- [ ] **Step 1 : Générer la planche** — Run: `npm run build && node tests/board.cjs` (ou la commande de planche existante). Expected: les cinq images dans `test-results/planche/`.
- [ ] **Step 2 : Relire les images** une à une : rien de coupé, rien qui déborde, chaque accessoire à sa place sur les trois animaux.
- [ ] **Step 3 : Mettre à jour les deux README.**
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` et la dernière ligne du navigateur.
- [ ] **Step 5 : Commit** — `docs: étape 6 dans les README, planche du compagnon`.
