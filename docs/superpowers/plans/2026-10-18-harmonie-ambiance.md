# Étape 5 — Harmonie et ambiance : plan d'implémentation

> **Pour les agents :** sous-compétence REQUISE : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans, tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**But :** un souhait d'habitant par jour (un décor juste à côté d'un bâtiment), cinq étoiles d'harmonie gagnées pour toujours, des sons d'ambiance pendant les séances, trois succès et l'Arche fleurie.

**Architecture :**
- **Données dans `src/00-core.js`** : `GIFTS.townWish` et `GIFTS.star`, listes `HARMONY`, `WISH_LIKES`, `AMBIENCES`, trois succès, l'élément `arche` (et `SHARE_ITEMS`).
- **Règles pures, sans DOM** : `src/28-harmony.js` (nouveau) — critères et étoiles d'harmonie, souhaits (candidats, tirage, exaucement, « Pas maintenant »).
- **Son** : `src/51-ambience.js` (nouveau) — moteur des ambiances sur le contexte audio de `Chime`, et la petite fenêtre de choix pendant la séance. Branchement dans `src/50-session.js`.
- **Interface** : `src/56-harmony.js` (nouveau) — carte « Souhait du jour », bouton et fenêtre « Harmonie de ta ville ». La bulle du souhait est dessinée par `src/35-city.js`.
- **Annonces** : `noticeProgress` et `celebrate` (`src/52-carnet.js`) portent aussi le souhait exaucé et les étoiles ; `liveTick` (`src/53-visits.js`) tire le souhait du jour et vérifie tout à chaque affichage de la Ville.

**Pile technique :** JavaScript sans framework (IIFE assemblée par `scripts/build.mjs`), canevas 2D, Web Audio, `node:test` dans une machine virtuelle Node, Playwright.

**Spécification :** `docs/superpowers/specs/2026-10-18-harmonie-ambiance-design.md`. Tous ses choix sont ceux de Claude (Ludovic a demandé de faire ce qui est recommandé). La lire avant chaque tâche : ses règles ne sont pas toutes répétées ici.

**Branche :** `etape-5-harmonie-ambiance`, qui porte déjà la spécification.

## Contraintes globales

- **Fichiers générés** : ne jamais modifier `app.js` ni `sw.js` à la main. Après tout changement de `src/`, `index.html` ou des feuilles de style, lancer `npm run build` et committer `app.js` et `sw.js` régénérés.
- **Vérifications de chaque tâche** : `npm run check` ; `npm test` ; `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`, dont la dernière ligne doit être `chromium: browser checks passed; no application JavaScript errors.`
- **Commits** : `git commit -F -` avec le message indiqué, suivi d'une ligne vide puis de :
  - `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  - `Claude-Session: https://claude.ai/code/session_01Y9ewUx6m7dMVmKYTE9Txwf`
- **Nouveaux fichiers de `src/`** : chacun est ajouté à `CLEAN_FILES` (`tests/i18n.test.cjs`) dans la tâche qui le crée ; aucun texte en dur, tout passe par `t()`.
- **Dictionnaires** :
  - chaque nouvelle clé existe en français et en anglais ;
  - espaces insécables écrits `\u00a0`, apostrophe droite `'` en français, tutoiement, aucun accord de genre envers la personne ;
  - les bâtiments parlent à la première personne, sans article devant leur nom (pas de « le / la / l' » à accorder) ;
  - aucun mot de reproche ou de perte (« raté », « perdu », « manqué », « il manque » dans un conseil, « missed », « lost ») ; un conseil dit ce qui ferait plaisir.
- **Caractères invisibles** : jamais écrits tels quels dans `src/` (un test le vérifie) ; toujours en `\u…`.
- **Reproductible** : le souhait du jour se tire avec `chance(jour + ':souhait')` (`24-ambient.js`), jamais avec `Math.random`. Seul le bruit des ambiances utilise `Math.random`.
- **Économie** : `GIFTS.townWish = 3e6` par clé `wish:<jour du souhait>` ; `GIFTS.star = 10e6` par clé `star:<critère>`. Un cadeau en double venu de deux onglets est remboursé par `merge3`, comme les autres.
- **Gardé pour toujours** : une étoile gagnée (sa clé `star:` dans `S.gifts`) ne se reprend jamais ; un souhait n'expire jamais.
- **Silence par défaut** : `settings.ambience` vaut `none` ; aucun son ne démarre hors d'une séance, sauf l'aperçu de 3 s pendant un geste dans les réglages.
- **Mise en page** : textes contenus à 320, 390 et 768 px, en français comme en anglais (Linux affiche les mots un peu plus larges) ; pas de mot long dans un `.seg` de trois colonnes ou plus.
- **Modules optionnels** : `tests/state-session.test.cjs` et `tests/backup.test.cjs` chargent `10-state.js`, `45-settings.js` et `50-session.js` sans les nouveaux modules. Tout appel vers `28-harmony.js`, `51-ambience.js` ou `56-harmony.js` depuis ces fichiers, ou depuis `52-carnet.js`, `53-visits.js` et `35-city.js`, garde le motif `typeof f === 'function'` (ou `typeof Ambience !== 'undefined'`).
- **Débogage** : `window.__ville` gagne `harmony: { criteria: () => harmonyCriteria(), wish: () => S.townWish, stars: () => starsEarned() }` et `ambience: { kind: () => Ambience.kind, measure: kind => Ambience.measure(kind) }`.

## Points de vigilance

Cinq situations que la spécification implique sans les nommer ; chacune a son test dans la tâche indiquée.

1. **Ville d'avant l'étape 5, à sa première ouverture** : les étoiles déjà méritées arrivent en un seul message et sont payées une fois ; rien au rechargement (Task 4).
2. **Son de fin coupé, ambiance choisie** : l'ambiance démarre quand même (le contexte audio s'ouvre pendant le geste de départ) (Task 9).
3. **Rechargement pendant une séance avec ambiance** : pas d'erreur ; l'ambiance reprend au premier toucher sur l'écran de la séance (Task 9).
4. **Souhait d'un décor trop cher** : le bouton « Placer » est désactivé et dit ce qu'il faut encore (« Il te manque 1 M »), sans autre message (Task 5).
5. **Bâtiment déplacé** : son souhait le suit, la bulle aussi, et un décor posé à côté de sa nouvelle place l'exauce (Tasks 3 et 6).

## Fichiers

- Create : `src/28-harmony.js`, `src/51-ambience.js`, `src/56-harmony.js`, `tests/harmony.test.cjs`, `tests/harmony-browser.cjs`.
- Modify : `src/00-core.js`, `src/10-state.js`, `src/23-achievements.js`, `src/24-ambient.js`, `src/32-paint-decor.js`, `src/35-city.js`, `src/40-ui.js`, `src/44-shop.js`, `src/45-settings.js`, `src/50-session.js`, `src/52-carnet.js`, `src/53-visits.js`, `src/60-boot.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `index.html`, `styles-features.css`, `tests/i18n.test.cjs`, `tests/browser.cjs`, `tests/achievements.test.cjs`, `tests/collection-state.test.cjs`, `tests/carnet.test.cjs`, `tests/content-browser.cjs`, `tests/share.test.cjs`, `tests/board.cjs`, `README.md`, `README.fr.md`.

---

### Task 1 : Données de l'étape 5

**Files:**
- Modify: `src/00-core.js`, `src/10-state.js`, `src/24-ambient.js`
- Create: `tests/harmony.test.cjs`

**Interfaces:**
- Produces (`00-core.js`) :
  - `GIFTS.townWish = 3e6`, `GIFTS.star = 10e6` ;
  - `HARMONY = ['verdure', 'variete', 'details', 'quartiers', 'lumieres']` ;
  - `WISH_LIKES = { foyer: ['fleurs', 'haie', 'banc', 'potager'], esprit: ['banc', 'arbre', 'livres', 'lanterne'], corps: ['arbre', 'fanions', 'banc', 'fleurs'], calme: ['cerisier', 'etang', 'pasjaponais', 'lanterne'], crea: ['lampadaire', 'fanions', 'statue', 'fleurs'] }` ;
  - `AMBIENCES = ['none', 'rain', 'waves', 'fire', 'wind', 'brown']`.
- Produces (`10-state.js`) :
  - réglages par défaut `ambience: 'none'`, `ambienceVolume: 'normal'`, `townWishes: true`, validés (`AMBIENCES`, clés de `SOUND_GAIN`, booléen) ;
  - `townWish: null` par défaut ; validé : `{ day (jour valide), tile (texte de 1 à 40 caractères), item (un décor présent dans WISH_LIKES), done? (date valide), skipped? (true) }`, sinon `null` ;
  - `GIFT_KEY` accepte `wish:AAAA-MM-JJ` et `star:<id de HARMONY>` ;
  - `merge3` : `townWish` du jour le plus récent ; le même jour, un souhait `done` ou `skipped` gagne sur un souhait en cours.
- Produces (`24-ambient.js`) : `giftAmount('wish:…') = GIFTS.townWish`, `giftAmount('star:…') = GIFTS.star`.

- [ ] **Step 1 : Écrire les tests** dans `tests/harmony.test.cjs` (FILES : `00-core`, `05-i18n`, `06-lang-fr`, `07-lang-en`, `10-state`, `20-rules`, `22-sets`, `23-achievements`, `24-ambient`, `46-features`) :
  - `'étape 5 : réglages par défaut et validés, souhait validé'` : `defaultState()` donne `['none', 'normal', true]` et `townWish === null` ; `normalize` ramène `ambience: 'jazz'` à `'none'`, `ambienceVolume: 'max'` à `'normal'` ; garde `{ day: '2026-10-18', tile: 't1', item: 'banc' }` ; rend `null` pour `item: 'licorne'`, `item: 'maison'` et `day: 'hier'` ; ne garde `done` que si c'est une date valide ;
  - `'étape 5 : cadeaux d’un souhait (3 M) et d’une étoile (10 M), clés validées'` : montants de `giftAmount` ; `normalize` garde `wish:2026-10-18` et `star:verdure`, écarte `star:licorne` et `wish:hier` ;
  - `'étape 5 : fusion du souhait, cadeau en double remboursé'` : le jour le plus récent gagne ; le même jour, `done` gagne sur un souhait en cours ; deux onglets qui paient `wish:2026-10-18` ne gagnent que 3 M en tout.
- [ ] **Step 2 : Le voir échouer** — Run: `node --test tests/harmony.test.cjs`. Expected: FAIL.
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(données): souhaits, étoiles et ambiance de l'étape 5`.

### Task 2 : Harmonie — critères et étoiles

**Files:**
- Create: `src/28-harmony.js`
- Modify: `tests/harmony.test.cjs`, `tests/i18n.test.cjs` (`CLEAN_FILES`)

**Interfaces:**
- Consumes : `HARMONY`, `NATURE_ITEMS`, `formedSets(city)` (`22-sets.js`), `GIFTS.star`.
- Produces (`28-harmony.js`) :
  - `isDomainItem(key): boolean` — un élément d'un des cinq domaines (au sol ou non) ;
  - `neighbourTiles(city, tile): Tile[]` — les éléments des huit cases voisines ;
  - `harmonyCriteria(city = S.city): Array<{ id, met: boolean, missing: number }>`, dans l'ordre de `HARMONY` ; `missing` est le nombre qui manque encore pour le conseil (0 quand le critère est rempli) ;
  - `claimStars(city = S.city): string[]` — les étoiles nouvellement gagnées : clé `star:<id>` datée de `nowTs()`, `GIFTS.star` chacune ; n'enregistre pas ;
  - `starsEarned(): string[]` — les ids de `HARMONY` dont la clé `star:` existe.
- Règles (spécification, partie B) — « bâtiments » = `isDomainItem` :
  - **verdure** : `nature >= 2 && nature * 3 >= bâtiments` ; `missing = max(2, ceil(bâtiments / 3)) - nature` ;
  - **variete** : au moins 3 domaines parmi les bâtiments ; `missing = 3 - domaines` ;
  - **details** : `bâtiments >= 4` et, parmi eux, au moins les trois quarts ont un décor (`group === 'decor'`) dans une case voisine ; `missing = ceil(max(bâtiments, 4) * 3 / 4) - ornés` ;
  - **quartiers** : `formedSets(city).size >= 2` ; `missing = 2 - formés` ;
  - **lumieres** : lampadaires + lanternes `>= max(1, ceil(bâtiments / 5))` ; `missing` = la différence.

- [ ] **Step 1 : Écrire les tests** (ajouter `28-harmony.js` aux FILES ; un utilitaire `cityOf(list)` construit `{ size: 7, tiles }` depuis `[item, x, y]`) :
  - `'harmonie : verdure, juste avant et au seuil'` : 6 bâtiments et 1 élément de nature → faux, `missing 1` ; 2 → vrai ; 7 bâtiments et 2 → faux ; 3 → vrai ;
  - `'harmonie : variété'` : 2 domaines → faux ; 3 → vrai ;
  - `'harmonie : petits détails'` : 4 bâtiments dont 2 ornés → faux, `missing 1` ; 3 ornés (un en diagonale) → vrai ; 3 bâtiments tous ornés → faux ;
  - `'harmonie : quartiers'` : un ensemble formé (`coin-lecture`) → faux ; deux (`+ cocon`) → vrai ;
  - `'harmonie : lumières du soir'` : 5 bâtiments sans lumière → faux ; un lampadaire → vrai ; 6 bâtiments et une lanterne → faux ; deux → vrai ;
  - `'étoiles : 10 M une seule fois, gardées après un retrait'` : `claimStars()` rend `['verdure']` et ajoute 10 M ; un second appel rend `[]` ; après le retrait des éléments de nature, `starsEarned()` contient toujours `'verdure'`.
- [ ] **Step 2 : Le voir échouer** — Run: `node --test tests/harmony.test.cjs`. Expected: FAIL (`harmonyCriteria is not defined`).
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(harmonie): cinq critères, cinq étoiles gagnées pour toujours`.

### Task 3 : Souhaits — tirage, exaucement, « Pas maintenant »

**Files:**
- Modify: `src/28-harmony.js`, `tests/harmony.test.cjs`

**Interfaces:**
- Consumes : `WISH_LIKES`, `lockInfo(key)` (`20-rules.js`, `null` = débloqué), `chance(key)`, `neighbourTiles`, `isDomainItem`.
- Produces (`28-harmony.js`) :
  - `wishCandidates(city = S.city): Array<{ tile: string, item: string }>` — pour chaque bâtiment, dans l'ordre (y, puis x), qui a au moins une case voisine libre dans le terrain : chaque décor aimé de son domaine, débloqué et absent de ses cases voisines, dans l'ordre de `WISH_LIKES` ;
  - `townWishTile(): Tile | null` — le bâtiment du souhait en cours (ni `done`, ni `skipped`), s'il existe encore et si le réglage est actif ;
  - `drawTownWish(day = today()): boolean` — tire un souhait (`floor(chance(day + ':souhait') * candidats)`) quand il n'y a pas de souhait en cours et que le dernier souhait (exaucé, laissé de côté, ou dont le bâtiment a disparu) date d'un jour antérieur ; `false` sans candidat, réglage coupé ou souhait déjà tiré ce jour ; n'enregistre pas ;
  - `claimTownWish(): { tile, item, day, building } | null` — exauce le souhait en cours si un décor `item` est dans une case voisine de son bâtiment : `done = nowTs()`, cadeau `wish:<day>` et `GIFTS.townWish` (une seule fois) ; `building` est la clé de l'élément du bâtiment ;
  - `skipTownWish(): boolean` — `skipped = true` sur le souhait en cours.

- [ ] **Step 1 : Écrire les tests** :
  - `'souhaits : candidats — décors aimés, débloqués, absents, avec une case libre'` : une maison avec un banc voisin et moins de 30 min au total → `[{ tile, item: 'fleurs' }]` (haie et potager pas encore débloqués, banc déjà là) ; une maison entourée de huit éléments → aucun candidat ;
  - `'souhaits : même tirage pour un même jour, un seul par jour'` : deux villes identiques tirent le même souhait le `2026-10-20` ; un second tirage le même jour rend `false` ;
  - `'souhaits : exaucé par un décor en diagonale, 3 M une fois, le suivant le lendemain'` : décor posé en `(x + 1, y + 1)` → `claimTownWish()` rend le souhait, +3 M, clé `wish:2026-10-20` ; un second appel rend `null` ; `drawTownWish('2026-10-20')` rend `false`, `drawTownWish('2026-10-21')` rend `true` ;
  - `'souhaits : « Pas maintenant », bâtiment démoli, réglage coupé'` : `skipTownWish()` → plus de souhait en cours, rien de nouveau le même jour, un nouveau le lendemain ; bâtiment retiré → `townWishTile() === null`, un nouveau le lendemain ; `townWishes: false` → `drawTownWish` rend `false` et `townWishTile()` rend `null` ;
  - *Point de vigilance 5* `'souhaits : le bâtiment déplacé emporte son souhait'` : le bâtiment change de place, le décor posé à côté de la nouvelle place l'exauce.
- [ ] **Step 2 : Le voir échouer** — Run: `node --test tests/harmony.test.cjs`. Expected: FAIL (`wishCandidates is not defined`).
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(souhaits): un souhait d'habitant par jour, jamais d'expiration`.

### Task 4 : Annonces — souhait exaucé et étoiles, à la pose et à l'ouverture

**Files:**
- Modify: `src/52-carnet.js`, `src/53-visits.js`, `src/35-city.js`, `src/44-shop.js`, `src/60-boot.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/browser.cjs`
- Create: `tests/harmony-browser.cjs`

**Interfaces:**
- Consumes : `claimTownWish`, `claimStars`, `drawTownWish` (Tasks 2–3).
- Produces (`52-carnet.js`) :
  - `noticeProgress()` rend `{ sets, achievements, challenges, townWish, stars }` ; ordre : défis, souhait, étoiles, ensembles, puis succès (ceux qui en dépendent suivent dans le même message) ;
  - `hasNews(fresh): boolean` — vrai s'il y a un ensemble, un succès, un défi, un souhait exaucé ou une étoile (tolère `{}`) ;
  - `celebrate(fresh, lead)` ajoute après le texte d'ouverture et les défis : la ligne `wish.granted` (`{ building: itemName(fresh.townWish.building), coins }`), puis une ligne `harmony.star` par étoile (`{ name: t('harmony.' + id), coins }`) ; des étincelles (`City.sparkle([tile])`) sur le bâtiment remercié.
- Produces (`53-visits.js`) : `liveTick(day)` — saison, tirage du souhait du jour (`drawTownWish`), fêtes (retour si une fête a été saluée), puis `progressNow()` ; enregistre si la saison, le tirage ou une nouvelle le demandent (visiblement s'il y a une nouvelle, discrètement sinon), puis `cheer(progress, '')`.
- Les quatre messages de pose, déplacement, agrandissement (`35-city.js`, `44-shop.js`) utilisent `hasNews(fresh)`.
- Débogage : `__ville.harmony` (voir Contraintes globales).
- **Textes** :
  - `wish.granted` : « Souhait exaucé · {building} : « Merci, c'est parfait ! » · +{coins} » / « Wish granted · {building}: “Thank you, it's perfect!” · +{coins} » ;
  - `harmony.star` : « Nouvelle étoile d'harmonie : {name} · +{coins} » / « New harmony star: {name} · +{coins} » ;
  - `harmony.verdure|variete|details|quartiers|lumieres` : « Verdure », « Variété », « Petits détails », « Quartiers », « Lumières du soir » / « Greenery », « Variety », « Little touches », « Neighbourhoods », « Evening lights ».

- [ ] **Step 1 : Parcours navigateur** dans `tests/harmony-browser.cjs` (même structure que `rituals-browser.cjs` : `SCENARIOS`, `runHarmony`, branché dans `tests/browser.cjs` après les rituels) :
  - `wishGrantedOnBuild` : une ville amorcée (date de création fixe, horloge fixée au `2026-10-21T10:00:00Z`, une maison seule près du centre) ; `__ville.harmony.wish()` donne le souhait du jour ; la pose de ce décor dans une case voisine (boutique, flèches, Entrée, « Placer ici ») affiche « Souhait exaucé » et le nom du bâtiment, et ajoute 3 M ;
  - *Point de vigilance 1* `starsAtFirstOpen` : une ville déjà verte, variée et éclairée s'ouvre : un seul message avec trois « Nouvelle étoile d'harmonie », +30 M ; au rechargement, aucun message de plus et les pièces ne bougent pas.
- [ ] **Step 2 : Le voir échouer** — Run: `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Expected: FAIL (aucun « Souhait exaucé »).
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` avec « Souhait exaucé ».
- [ ] **Step 5 : Commit** — `feat(souhaits): souhait exaucé et étoiles annoncés, à la pose comme à l'ouverture`.

### Task 5 : Carte « Souhait du jour », fiche du bâtiment et réglage

**Files:**
- Create: `src/56-harmony.js`
- Modify: `src/40-ui.js` (`renderVille`), `src/44-shop.js` (`openBuildingSheet`), `src/45-settings.js` (`settingsRituals`), `styles-features.css`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/harmony-browser.cjs`, `tests/i18n.test.cjs` (`CLEAN_FILES`)

**Interfaces:**
- Consumes : `townWishTile`, `skipTownWish`, `S.townWish`, `Mode.startPlace(key)`, `priceOf(key)`.
- Produces (`56-harmony.js`) :
  - `renderTownWishCard()` : la carte `#townWishCard` (`section.card.wish-card`), juste après `.city-tools`, cachée sans souhait en cours ; elle montre la vignette du bâtiment (`City.thumb`, 48 px), son nom, `wish.line`, `wish.hint`, un bouton « Placer » (`wish.place`, `Mode.startPlace(item)`) et un bouton `wish.skip` ;
  - le bouton « Placer » est désactivé quand les pièces ne suffisent pas, avec `shop.missing` en note (*Point de vigilance 4*) ;
  - `wish.skip` appelle `skipTownWish()` puis `commit()`, sans autre message ;
  - `townWishBlock(tile): HTMLElement | null` — le même rappel dans la fiche du bâtiment qui souhaite.
- `renderVille()` appelle `renderTownWishCard()` après `liveTick()` ; `openBuildingSheet` insère `townWishBlock(tile)` sous la vignette.
- `settingsRituals()` gagne l'interrupteur `settings.townWishes`.
- **Textes** :
  - `wish.title` « Souhait du jour » / « Wish of the day » ;
  - `wish.line` « « J'aimerais {thing} juste à côté. » » / « “I'd love {thing} right next to me.” » ;
  - `wish.hint` « À poser dans une case voisine, même en diagonale. » / « In a neighbouring square, diagonals included. » ;
  - `wish.place` « Placer {thing} · {price} » / « Place {thing} · {price} » ;
  - `wish.skip` « Pas maintenant » / « Not now » ;
  - `wish.thing.<décor>` pour les 13 décors de `WISH_LIKES` : « des fleurs », « une haie », « un banc », « un carré potager », « un arbre », « une boîte à livres », « une lanterne de pierre », « un mât à fanions », « un cerisier », « un étang », « des pas japonais », « un lampadaire », « une statue » (et l'anglais : « flowers », « a hedge », « a bench »…) ;
  - `settings.townWishes` « Souhaits des habitants » / « Residents' wishes ».

- [ ] **Step 1 : Parcours navigateur** (`tests/harmony-browser.cjs`) :
  - `wishCard` : la carte montre le nom du bâtiment, « J'aimerais … juste à côté. » et « Placer … · … » ; « Pas maintenant » la cache, et elle reste cachée au rechargement ; la fiche du bâtiment montre le souhait ; à 320 px, en français puis en anglais, rien ne déborde ;
  - *Point de vigilance 4* : avec 0 pièce, le bouton « Placer » est désactivé et la note dit « Il te manque » ;
  - réglage « Souhaits des habitants » coupé : plus de carte.
- [ ] **Step 2 : Le voir échouer** — Run: `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Expected: FAIL (`#townWishCard` introuvable).
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` avec « Souhait du jour ».
- [ ] **Step 5 : Commit** — `feat(souhaits): la carte du souhait du jour et la fiche du bâtiment`.

### Task 6 : La bulle du souhait dans la ville

**Files:**
- Modify: `src/35-city.js`, `tests/harmony-browser.cjs`

**Interfaces:**
- Consumes : `townWishTile()`, `S.townWish.item`, `openBuildingSheet(tile)`.
- Produces (`35-city.js`) :
  - dans `draw()`, sauf en visite et en dessin propre (`clean`) : une bulle blanche arrondie au-dessus du bâtiment qui souhaite, avec le décor souhaité dessiné en petit dedans ;
  - `wishBox` (comme `visitorBox`) : sa zone en pixels, remise à `null` à chaque dessin ; `City.wishBox()` pour les tests ;
  - toucher la bulle (petite ville comme vue en grand) ouvre la fiche du bâtiment.

- [ ] **Step 1 : Parcours navigateur** :
  - `wishBubble` : sur la Ville, `City.wishBox()` n'est pas nul ; un clic en son centre ouvre la fiche du bâtiment qui souhaite ; dans la vue en grand, la bulle se touche aussi ; dans la visite de sa propre ville (`__ville.share.open(code)`), `wishBox()` est nul ;
  - *Point de vigilance 5* : après le déplacement du bâtiment (« Déplacer »), la bulle est au-dessus de sa nouvelle case (`cellPoint`).
- [ ] **Step 2 : Le voir échouer.** Expected: FAIL (`City.wishBox is not a function`).
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(souhaits): une bulle au-dessus du bâtiment qui souhaite`.

### Task 7 : « Harmonie de ta ville »

**Files:**
- Modify: `src/56-harmony.js`, `src/40-ui.js`, `index.html` (bouton `#harmonyBtn` dans `.city-tools`, icône `i-star`), `styles-features.css`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/harmony-browser.cjs`

**Interfaces:**
- Consumes : `harmonyCriteria()`, `starsEarned()`, `S.gifts['star:' + id]` (date).
- Produces (`56-harmony.js`) :
  - `renderHarmonyButton()` : libellé `harmony.button` avec les étoiles (`★` gagnée, `☆` à venir), nom accessible `harmony.buttonLabel` ; appelé par `renderVille()` ;
  - `openHarmonySheet()` : fenêtre `harmony.title` ; une ligne par critère, dans l'ordre de `HARMONY` : l'étoile, le nom, puis `harmony.earnedOn` (date) ou le conseil `harmony.<id>.hint` (pluriel sur `missing`).
- **Textes** :
  - `harmony.button` « Harmonie {stars} » / « Harmony {stars} » ; `harmony.buttonLabel` « Harmonie : {n} étoiles sur 5 » (pluriel) / « Harmony: {n} of 5 stars » ;
  - `harmony.title` « Harmonie de ta ville » / « Your town's harmony » ; `harmony.note` « Une étoile gagnée le reste, même si la ville change. » / « A star you earn stays yours, even if the town changes. » ;
  - `harmony.earnedOn` « Gagnée le {date} » / « Earned on {date} » ;
  - conseils (un et plusieurs) : verdure « Encore {n} élément de nature apporterait de la verdure » ; variete « Des bâtiments d'un domaine de plus apporteraient de la variété » ; details « Un décor à côté d'un bâtiment de plus ajouterait un petit détail » ; quartiers « Un ensemble de voisinage de plus formerait un quartier » ; lumieres « Un lampadaire ou une lanterne de plus ferait briller ta ville le soir » — et leurs formes au pluriel, en français comme en anglais.

- [ ] **Step 1 : Parcours navigateur** :
  - `harmonySheet` : une ville à deux étoiles montre « Harmonie ★★☆☆☆ » (nom accessible « Harmonie : 2 étoiles sur 5 ») ; la fenêtre liste les cinq noms, « Gagnée le » pour les deux premières, un conseil chiffré pour les autres ; aucun texte ne contient « manque » ; à 320 px, en français puis en anglais, rien ne déborde.
- [ ] **Step 2 : Le voir échouer.** Expected: FAIL (`#harmonyBtn` introuvable).
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` avec « Harmonie ».
- [ ] **Step 5 : Commit** — `feat(harmonie): la fenêtre de l'harmonie et son bouton sous la ville`.

### Task 8 : Moteur des ambiances

**Files:**
- Create: `src/51-ambience.js`
- Modify: `src/60-boot.js` (débogage), `tests/harmony-browser.cjs`, `tests/i18n.test.cjs` (`CLEAN_FILES`)

**Interfaces:**
- Consumes : `Chime.ctx` et `Chime.unlock(force)` (`50-session.js`), `SOUND_GAIN`, `AMBIENCES`.
- Produces (`51-ambience.js`) :
  - `buildAmbience(ctx, kind, gain): { output: AudioNode, stop(when): void } | null` — le graphe d'une ambiance (bruit filtré, modulations lentes, crépitements), branché par l'appelant ; `null` pour `none` ;
  - `Ambience` : `kind` (en cours, ou `'none'`), `start(kind = S.settings.ambience)` (fondu d'entrée de 3 s), `fadeOut(seconds)`, `stop()` (fondu de 0,1 s, puis arrêt), `switch(kind)` (fondu croisé court), `preview(kind)` (3 s, pendant un geste), `measure(kind): Promise<{ peak, rms }>` (rendu de 4 s au volume `normal` avec `OfflineAudioContext`).
- Recette de chaque ambiance laissée au constructeur (spécification, partie C), dans ces bornes, vérifiées par le test.

- [ ] **Step 1 : Parcours navigateur** :
  - `ambienceLevels` : pour `rain`, `waves`, `fire`, `wind` et `brown`, `__ville.ambience.measure(kind)` rend `peak < 0.9` et `0.01 <= rms <= 0.25` ; pour `none`, `{ peak: 0, rms: 0 }`.
- [ ] **Step 2 : Le voir échouer.** Expected: FAIL (`__ville.ambience` indéfini).
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(ambiance): cinq ambiances fabriquées par le navigateur`.

### Task 9 : L'ambiance pendant la séance

**Files:**
- Modify: `src/50-session.js`, `src/51-ambience.js`, `tests/harmony-browser.cjs`

**Interfaces:**
- Consumes : `Ambience` (Task 8).
- Produces :
  - `beginSession` ouvre le contexte audio pendant le geste aussi quand une ambiance est choisie et que le son de fin est coupé : `Chime.unlock(S.settings.ambience !== 'none')` (*Point de vigilance 2*) ;
  - fin de `startSessionLocked` : `Ambience.start()` ;
  - `tick()` : à 1,5 s de la fin, `Ambience.fadeOut(1.5)` une seule fois ;
  - `endRun()` : `Ambience.stop()` (fin, abandon, interruption, séance finie ailleurs) ;
  - après un rechargement, si le contexte audio n'est pas ouvert, l'ambiance attend le premier `pointerdown` ou `keydown` sur la page (une seule fois) pour s'ouvrir et démarrer, si la séance tourne encore (*Point de vigilance 3*).

- [ ] **Step 1 : Parcours navigateur** — espions posés avant le chargement : `AudioBufferSourceNode.prototype.start` et `stop` comptent les sources de plus d'une seconde (`window.__sources = { started, stopped }`) :
  - `ambienceWithSession` : ambiance « Pluie » et *son de fin coupé* ; une activité libre de 5 min démarre une source ; à la fin (horloge avancée), toutes sont arrêtées ;
  - `ambienceStopsOnAbandon` : une séance Concentration avec « Vagues », puis « Abandonner » (deux touchers) : arrêtée ;
  - `ambienceNone` : avec « Aucune », aucune source ;
  - *Point de vigilance 3* `ambienceAfterReload` : séance avec « Feu de camp », rechargement : aucune erreur, aucune source avant un toucher ; après un toucher sur l'écran de la séance, une source démarre.
- [ ] **Step 2 : Le voir échouer.** Expected: FAIL (aucune source démarrée).
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` avec « Ambiance ».
- [ ] **Step 5 : Commit** — `feat(ambiance): elle accompagne la séance, du début à la fin`.

### Task 10 : Choisir l'ambiance

**Files:**
- Modify: `src/45-settings.js` (`settingsSessions`), `src/51-ambience.js`, `src/50-session.js` (`showRun`), `index.html` (bouton `#ambienceBtn` dans `.sess-foot`, icône `i-sound`), `styles-features.css`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/harmony-browser.cjs`, `tests/i18n-browser.cjs` (si l'ordre des titres des réglages change)

**Interfaces:**
- Produces :
  - Réglages › Sessions : `settings.ambience` (puces, une par ambiance, rôle `radio`), `settings.ambienceVolume` (`.seg` de trois : doux, normal, fort) et la note `settings.ambienceNote` ; chaque choix enregistre (`commit({ silent: true })`) et fait entendre `Ambience.preview` ;
  - `renderAmbienceButton()` : `#ambienceBtn`, libellé `ambience.button` (`{ name: t('ambience.' + kind) }`) ; mis à jour par `showRun` ;
  - `openAmbienceSheet()` : fenêtre `ambience.title` avec les six puces ; un choix enregistre le réglage (il devient le choix par défaut), appelle `Ambience.switch(kind)` et met le bouton à jour.
- **Textes** : `ambience.none|rain|waves|fire|wind|brown` « Aucune », « Pluie », « Vagues », « Feu de camp », « Vent », « Bruit doux » / « None », « Rain », « Waves », « Campfire », « Wind », « Soft noise » ; `ambience.button` « Ambiance : {name} » / « Ambience: {name} » ; `ambience.title` « Ambiance » / « Ambience » ; `settings.ambience` « Ambiance pendant les séances » / « Ambience during sessions » ; `settings.ambienceVolume` « Volume de l'ambiance » / « Ambience volume » ; `settings.ambienceNote` « Sur iPhone, l'ambiance s'arrête quand l'écran se verrouille. » / « On iPhone, the ambience stops when the screen locks. »

- [ ] **Step 1 : Parcours navigateur** :
  - `ambienceSettings` : choisir « Vagues » l'enregistre (gardé au rechargement) et fait entendre un aperçu (une source démarre, puis s'arrête dans les 4 s) ; à 320 px, en français puis en anglais, les réglages ne débordent pas ;
  - `ambienceDuringSession` : pendant une séance, « Ambiance : Vagues » ouvre la fenêtre ; choisir « Pluie » change le bouton en « Ambiance : Pluie », enregistre `rain` et démarre une nouvelle source.
- [ ] **Step 2 : Le voir échouer.** Expected: FAIL (« Ambiance pendant les séances » introuvable).
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(ambiance): la choisir dans les réglages ou pendant la séance`.

### Task 11 : Trois succès et l'Arche fleurie

**Files:**
- Modify: `src/00-core.js`, `src/23-achievements.js`, `src/32-paint-decor.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/achievements.test.cjs`, `tests/collection-state.test.cjs`, `tests/carnet.test.cjs`, `tests/content-browser.cjs`, `tests/share.test.cjs`

**Interfaces:**
- Produces (`00-core.js`) :
  - succès de la famille `town`, à la fin de la table : `{ id: 'premier-souhait', kind: 'townWishes', n: 1 }`, `{ id: 'habitants-combles', kind: 'townWishes', n: 10 }`, `{ id: 'ville-harmonieuse', kind: 'stars', n: 5, reward: 'arche' }` ;
  - `ITEMS.arche = { group: 'decor', price: 4e6, reward: 'ville-harmonieuse', fem: true, hf: .9 }` ; `'arche'` ajouté **à la fin** de `SHARE_ITEMS`.
- Produces (`23-achievements.js`) : conditions `townWishes` (nombre de clés `wish:`) et `stars` (nombre de clés `star:`), avec leur progression en `n` ; date de rattrapage 0.
- Produces (`32-paint-decor.js`) : `DRAW.arche` — deux montants et un arc couverts de fleurs aux couleurs des cinq domaines (`g.cat(cat)`).
- **Textes** : `ach.premier-souhait` « Premier souhait » / « Exauce le souhait d'un habitant. » ; `ach.habitants-combles` « Habitants comblés » / « Exauce 10 souhaits d'habitants. » ; `ach.ville-harmonieuse` « Ville harmonieuse » / « Gagne les cinq étoiles d'harmonie. » ; anglais « First wish », « Happy residents », « Harmonious town » ; `item.arche` « Arche fleurie » / « Flower arch ».

- [ ] **Step 1 : Écrire les tests** :
  - seuils (`achievements.test.cjs`) : `premier-souhait` (0 ou 1 clé `wish:`), `habitants-combles` (9 ou 10), `ville-harmonieuse` (4 ou 5 clés `star:`) ; progression en `n` pour les deux premiers ;
  - compte : 45 succès (`collection-state.test.cjs`, `carnet.test.cjs`, `content-browser.cjs`) et 51 éléments ;
  - lien de ville : `share.test.cjs` ajoute `arche` à la liste de l'aller-retour.
- [ ] **Step 2 : Le voir échouer** — Run: `npm test`. Expected: FAIL (42 succès).
- [ ] **Step 3 : Implémenter** selon Interfaces ; vérifier aussi `tests/pacing.test.cjs`.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(harmonie): trois succès et l'Arche fleurie`.

### Task 12 : Planche, documentation et vérification d'ensemble

**Files:**
- Modify: `tests/board.cjs`, `README.md`, `README.fr.md`

- [ ] **Step 1 : Planche** (`test-results/planche/`, horloge fixée, ville amorcée) : `souhait.png` (la Ville avec la bulle et la carte), `harmonie.png` (la fenêtre), `arche.png` (l'Arche fleurie dans une ville), `ambiance.png` (l'écran de la séance avec son bouton).
- [ ] **Step 2 : Relecture** : regarder chaque image et corriger ce qui est illisible ou mal placé.
- [ ] **Step 3 : Documentation**, dans les deux README : fonctions (Souhaits, Harmonie, Ambiance), récompenses (souhaits et étoiles), réglages (Sessions, Rituels), 45 succès et 51 éléments, structure (`28-harmony.js`, `51-ambience.js`, `56-harmony.js`), scripts (tests et planche).
- [ ] **Step 4 : Vérification d'ensemble** — Run: `npm run check && npm test && npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser && git status --short`. Expected : syntaxe valide, `ℹ fail 0`, ligne finale habituelle, aucun fichier modifié hors du commit.
- [ ] **Step 5 : Commit** — `docs: étape 5 dans les README, planche de l'harmonie et de l'ambiance`.
