# Visibilité et premiers pas — plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la Ville du bien-être trouvable (indexation, aperçu des liens, adresse sur les images) et accueillir le nouveau venu : carte « Bienvenue », première séance de 2 minutes, ville à l'abri, lien d'un ami, habitants divers.

**Architecture:** Tout reste du JavaScript sans dépendance dans `src/`, concaténé dans `app.js` par `npm run build`. Un nouveau fichier `src/59-first-steps.js` (dans la fermeture de l'app, évalué avant `60-boot.js`) porte la carte « Bienvenue » et la carte « Garde ta ville à l'abri ». Cette dernière quitte `src/70-install.js`, qui est hors de la fermeture et ne voit pas `S` ; il ne garde que le service worker. Les règles touchées restent où elles vivent : souhait dans `28-harmony.js`, étoile de départ dans `53-visits.js`, rappel dans `45-settings.js`, séance dans `50-session.js` et `58-companion-session.js`, dessin dans `34-paint-life.js`. Les images d'aperçu sont produites par un script Playwright et committées dans `apercu/`, hors du cache hors connexion.

**Tech Stack:** JavaScript de navigateur sans dépendance ; Node ≥ 20 (`node:test`, VM de `tests/helpers/`) ; Playwright 1.62.1 (en local : `PLAYWRIGHT_CHANNEL=chrome` pour Chromium, `BROWSER=webkit`) ; GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-22-visibilite-premiers-pas-design.md`

## Global Constraints

- **Fichiers générés** : ne jamais modifier `app.js` ni `sw.js` à la main. Lancer `npm run build` après tout changement de `src/`, `index.html`, `styles*.css`, `manifest.webmanifest`, `icons/` ou `fonts/`, puis committer `app.js` et `sw.js` avec les sources (« Vérifier » fait `git diff --exit-code app.js sw.js`).
- **Avant chaque commit** :
  - toujours `npm run check` et `npm test` ;
  - pour toute tâche qui touche l'interface : `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` puis `BROWSER=webkit npm run test:browser`.
  - Tout doit passer. Un test existant ne change que si la conception change ce qu'il vérifie ; le message de commit le dit. Aucune assertion n'est retirée pour faire passer un test.
- **Ville sans séance** = `isNewTown()` (`S.stats.ok + S.stats.ko === 0`, tâche 3), jamais `S.history.length` : les villes amorcées des tests ont `stats.ok: 1` et un historique vide.
- **Données** : un seul nouveau champ enregistré, `S.active.breathing` (booléen facultatif). Les clés propres à l'appareil sont des chaînes complètes `ville-bien-etre/v1:…`, lues et écrites sous `try/catch` (`lsNum`/`lsSet` de `45-settings.js` ou équivalent).
- **Textes** :
  - toute clé existe dans `src/06-lang-fr.js` ET `src/07-lang-en.js` ;
  - tutoiement, aucun accord en genre envers la personne ;
  - espaces ordinaires avant `: ; ! ? »` dans les dictionnaires (`frTypo` les rend insécables à l'affichage) ;
  - aucun des mots `perdu(e)(s)`, `raté`, `lost`, `missed` ; aucun « (s) » ; pas de « area » en anglais ;
  - en anglais, aucun texte ne contient un mot français surveillé par `tests/i18n-browser.cjs:4` (dont « Commencer », « Langue », « Sauvegarde »).
- **Piège d'outil** : un échappement ` ` tapé dans un fichier devient le caractère lui-même. Vérifier par `grep` ce qui est écrit.
- **HTML** : tout texte fixe d'`index.html` est dans un élément feuille qui porte `data-i18n` ; tout `aria-label` a son `data-i18n-aria-label`.
- **JS** : tout nouveau fichier `src/NN-*.js` entre dans `CLEAN_FILES` (`tests/i18n.test.cjs:129`). Aucune chaîne qui ressemble à du texte : tout passe par `t()`.
- **Mise en page** : à 320 px, rien ne déborde, en français et en anglais.
- **Ni animation ni son nouveaux.**
- **Hors connexion** : rien de l'app ne vient du réseau. Ne jamais poser d'image dans `icons/` (tout `.png` d'`icons/` entre dans le précache) ; les images d'aperçu vont dans `apercu/`.
- **Focus** : les éléments redessinés portent `data-focus-key` (le focus est gardé par `keepFocus`).
- **Commits** : en français, préfixés comme l'historique (`feat(…)`, `fix(…)`, `test(…)`, `docs:`), terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Jamais de push, de fusion ni de publication.
- **Parcours navigateur de l'étape** : `tests/premiers-pas-browser.cjs` (créé en tâche 3).
  - Chaque tâche y ajoute ses scénarios : fonctions `async (browser, baseURL)` qui renvoient leur libellé, ferment leur contexte dans `finally` et vérifient `assert.deepEqual(errors, [])`.
  - Le fichier exporte `{ runPremiersPas, SCENARIOS, IPHONE_UA, freshTown }`.
- **Simuler l'iPhone** :
  - option de contexte `userAgent: IPHONE_UA`, avec `IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'` ;
  - l'app installée : `addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }))` ;
  - le presse-papiers : un faux `navigator.clipboard` posé par `addInitScript`.
  - Le WebKit de Playwright se présente comme un Safari de Mac : sans ces options, `isIOS()` est faux.

## Review Focus

1. **Une ville qui a des séances mais un historique vide** (villes amorcées, vieilles sauvegardes) ne voit jamais l'accueil, et garde son souhait, son étoile et sa visite comme avant. Tests : tâche 3 (accueil caché pour `town({}, [])`), tâche 5 (souhait tiré pour `ok: 1` avec un jour antérieur), tâche 9 (visite inchangée).
2. **La respiration de la première séance suit la séance** : « Recommencer » après une interruption (un rechargement interrompt toute séance en Concentration) et la reprise d'une séance la gardent ; le réglage de la personne reste éteint. Test : tâche 4.
3. **Changer de langue depuis l'accueil à 320 px** : rien ne déborde, le focus reste sur le lien de langue, les Réglages ne s'ouvrent pas. Test : tâche 3.
4. **Un presse-papiers vide, refusé ou abîmé** : un message doux qui mène à Réglages → Sauvegarde, rien n'est remplacé, aucune feuille ne s'ouvre. Tests : tâche 7 (et tâche 6 pour une copie refusée).
5. **Un nouveau venu qui ferme la visite d'un ami** par Échap ou le geste retour arrive sur l'accueil. Le fragment `#ville=` est retiré : un rechargement ne rouvre pas la visite. Test : tâche 9.

---

### Task 1 — Être trouvable : en-tête de la page, garde de publication

**Files:**
- Modify: `index.html:5-25` (le `<head>`), `manifest.webmanifest` (`description`), `scripts/package.mjs:12-13`
- Create: `scripts/page-guard.mjs`, `tests/visibilite.test.cjs`
- Modify: `README.md:134`, `README.fr.md:134`
- Regenerate: `sw.js` (`npm run build`)

**Interfaces:**
- Produces:
  - `strayAddresses(html: string) → string[]`, export ESM de `scripts/page-guard.mjs`. Il renvoie les adresses `http://` ou `https://` trouvées hors des balises permises : `<meta property="og:…">`, `<meta name="twitter:…">` et `<link rel="canonical">`.
  - `tests/visibilite.test.cjs`, que la tâche 11 complète.

- [ ] **Step 1: Write the failing tests** dans `tests/visibilite.test.cjs` (`node:test`, lecture directe des fichiers). Constantes :
  - `SITE = 'https://lubachma.github.io/ville-du-bien-etre/'` ;
  - `DESCRIPTION = 'Une app gratuite de bien-être : chaque minute de lecture, de sport ou de calme fait grandir ta ville. Sans compte, sans pub, même hors connexion.'`.

  Tests :
  - `page : indexable, avec adresse canonique et aperçu des liens`.
    - Aucun `noindex`.
    - `link[rel=canonical]` = `SITE`.
    - `meta[name=description]` = `og:description` = `DESCRIPTION`.
    - `og:type` = `website`, `og:site_name` = `Ville du bien-être`, `og:title` = `Ville du bien-être — prends soin de toi, ta ville grandit`.
    - `og:url` = `SITE`, `og:image` = `SITE + 'apercu/ville-1200x630.png'`, `og:image:width` = `1200`, `og:image:height` = `630`, `og:image:alt` non vide.
    - `og:locale` = `fr_CH`, `og:locale:alternate` = `en_GB`, `twitter:card` = `summary_large_image`.
    - `<title>` reste `Ville du bien-être`.
  - `manifeste : même description que la page` : `JSON.parse(manifest).description === DESCRIPTION`.
  - `publication : une adresse absolue n'est permise que dans les métadonnées` (test `async`, `const { strayAddresses } = await import('../scripts/page-guard.mjs')`).
    - `strayAddresses(index.html)` → `[]`.
    - `<script src="https://cdn.example/x.js"></script>` → `['https://cdn.example/x.js']`.
    - `<a href="http://exemple.ch">` → `['http://exemple.ch']`.
    - `<meta property="og:image" content="https://x.ch/y.png">`, `<meta name="twitter:card" content="https://x.ch">` et `<link rel="canonical" href="https://x.ch/">` → `[]` chacun.

- [ ] **Step 2: Run** `node --test tests/visibilite.test.cjs`. Expected: FAIL (noindex présent, balises absentes, module introuvable).

- [ ] **Step 3: Implement**
  - Dans `index.html`, retirer `<meta name="robots" content="noindex">` et remplacer la description.
  - Après la description, ajouter dans cet ordre :
    - `<link rel="canonical" href="https://lubachma.github.io/ville-du-bien-etre/">` ;
    - les balises `og:*` du test, avec `og:image:alt` = « Une petite ville colorée en fin d'après-midi, avec ses habitants » ;
    - `<meta name="twitter:card" content="summary_large_image">`.
  - Même description dans le manifeste.
  - `scripts/page-guard.mjs` : retirer d'abord les balises permises, puis relever chaque `https?://[^\s"'<>)]+` restant.
  - `scripts/package.mjs` : importer `strayAddresses` ; lever `Error('Unexpected absolute network dependency in index.html: ' + liste)` si la liste n'est pas vide.

- [ ] **Step 4: README** (`README.md:134`, `README.fr.md:134`) : la phrase « All paths are relative… » / « Tous les chemins sont relatifs… » devient « Les fichiers de l'app sont en chemins relatifs ; seules trois adresses de `index.html` (canonical, `og:url`, `og:image`) nomment le site publié : les changer pour publier ailleurs. » (et l'équivalent anglais).

- [ ] **Step 5: Run** `npm run build && npm run check && npm test && npm run package`. Expected: tout PASS, `dist/` préparé sans erreur.

- [ ] **Step 6: Commit** `git add index.html manifest.webmanifest scripts/page-guard.mjs scripts/package.mjs tests/visibilite.test.cjs README.md README.fr.md sw.js` puis `git commit -m "feat(visibilité): page indexable, adresse canonique et aperçu des liens"` (message terminé par la ligne Co-Authored-By).

---

### Task 2 — Habitants divers : cinq couleurs de peau, canne et fauteuil roulant

**Files:**
- Modify: `src/34-paint-life.js:129-180` (`drawPerson`, `drawWalker`, `drawDoer`) et `:300-325` (visiteurs `accordeon`, `artiste`), `src/35-city.js:583-585`
- Test: `tests/life-paint.test.cjs`
- Regenerate: `app.js`, `sw.js`

**Interfaces:**
- Consumes: `chance(key) → [0, 1)`, la seule graine par ville (`24-ambient.js:47`, dérivée de `S.createdAt`) ; `CAT_ORDER` (`00-core.js:36`).
- Produces (dans `src/34-paint-life.js`) :
  - `SKINS` : 5 couleurs hexadécimales, de la plus claire à la plus foncée, toutes différentes. Point de départ : `['#f6d5bf', '#e6b28c', '#c58a5c', '#8e5a3a', '#5b3a28']` ; le constructeur peut les ajuster à la planche.
  - `personSkin(n: number) → string` = `SKINS[(n + décalage de la ville) % 5]`, avec un décalage `Math.floor(chance('habitants') * 5)`.
  - `walkerLook(i: number) → { skin: string, aid: '' | 'cane' | 'chair' }`.
    - `skin = personSkin(i)`.
    - `aid` vaut `'chair'` quand `(i + Math.floor(chance('fauteuil') * 7)) % 7 === 0`, sinon `'cane'` quand `(i + Math.floor(chance('canne') * 5)) % 5 === 0`, sinon `''`.
  - `drawPerson(g, sx, sy, color, pose = 'stand', skin = SKINS[0])` : poses `'stand' | 'sit' | 'chair'`. Elle renvoie toujours le point d'épaule où s'accrochent les accessoires.
  - `drawWalker(g, sx, sy, look)` lit en plus `look.skin` et `look.aid`.
    - Canne : un trait du point de la main au sol, à côté du corps.
    - Fauteuil : pose `'chair'`, soit le corps assis, une roue (cercle tracé) et un dossier.
- Les habitants qui font une activité prennent `personSkin(10 + CAT_ORDER.indexOf(cat))`. Les visiteurs `accordeon` et `artiste` prennent chacun une couleur fixe par identité (par ex. `personSkin(20)` et `personSkin(21)`).

- [ ] **Step 1: Write the failing tests** dans `tests/life-paint.test.cjs`. Ajouter `SKINS`, `personSkin`, `walkerLook`, `drawPerson` à `EXPOSE`. Pour changer de ville, réaffecter `state.createdAt`.
  - `habitants : cinq promeneurs ont cinq couleurs de peau différentes, stables pour une ville`.
    - `SKINS.length === 5`, valeurs toutes différentes.
    - Pour 30 valeurs de `createdAt` : `new Set([0,1,2,3,4].map(i => walkerLook(i).skin)).size === 5`, et deux appels de `walkerLook(i)` donnent le même résultat.
  - `habitants : environ un promeneur sur sept en fauteuil et un sur cinq avec une canne`. Sur 300 villes × promeneurs 0 à 5, la part de `'chair'` est dans [0,10 ; 0,19] et celle de `'cane'` dans [0,13 ; 0,25].
  - `habitants : canne et fauteuil restent dans le cadre de la personne`.
    - Avec le `fakeContext` existant et une case de 100 px, `drawWalker` est appelé avec `aid` ∈ {`'cane'`, `'chair'`}, chacun combiné à `hat`, `umbrella` et `lantern`.
    - Chaque point tracé reste à ±30 px du pied, comme le test existant des quatre `look`.
  - `habitants : la tête prend la couleur de peau donnée`. `drawPerson` remplit la tête avec `g.c(skin)` : sans nuit (`g.dark = 0`), la couleur de remplissage de la tête est la peau passée.

- [ ] **Step 2: Run** `node --test tests/life-paint.test.cjs`. Expected: FAIL (`walkerLook is not defined`, etc.).

- [ ] **Step 3: Implement** les interfaces ci-dessus. Dans `35-city.js:585`, `drawWalker` reçoit `{ color, lantern, umbrella, hat, ...walkerLook(person.walker) }`.

- [ ] **Step 4: Run** `npm run build && npm run check && npm test`. Expected: PASS.

- [ ] **Step 5: Planche.** Lancer `PLAYWRIGHT_CHANNEL=chrome npm run board`, puis regarder `test-results/planche/ville-320.png`, `moments.png`, `saisons.png` et `ville-nuit.png`.
  - Les habitants doivent rester lisibles à 35 px par case, de jour comme de nuit.
  - La roue et la canne doivent se distinguer du corps.
  - Ajuster les teintes ou les tracés si besoin, et le dire dans le rapport.

- [ ] **Step 6: Run** `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` et `BROWSER=webkit npm run test:browser`. Expected: PASS.

- [ ] **Step 7: Commit** `git add src/34-paint-life.js src/35-city.js tests/life-paint.test.cjs app.js sw.js` puis `git commit -m "feat(habitants): cinq couleurs de peau, une canne et un fauteuil roulant"`.

---

### Task 3 — La carte « Bienvenue »

**Files:**
- Modify: `index.html` (carte `#welcomeCard`, premier enfant de `#view-ville`, `index.html:82`), `styles.css` (près de `.install-card`, `styles.css:751`)
- Modify: `src/00-core.js:5-15` (`LS_WELCOME`), `src/10-state.js` (`isNewTown`, près de `defaultState`), `src/45-settings.js:158-166` (`applyLang`) et `:437-452` (« Tout recommencer »), `src/40-ui.js:297-314` (`renderVille`), `src/60-boot.js` (`bindEvents` appelle `bindFirstSteps`), `src/06-lang-fr.js`, `src/07-lang-en.js`
- Create: `src/59-first-steps.js`, `tests/premiers-pas.test.cjs`, `tests/premiers-pas-browser.cjs`
- Modify: `tests/i18n.test.cjs:129` (`CLEAN_FILES`), `tests/browser.cjs:265-268` (brancher le groupe, après `fiabilite`), `README.md:123` et `README.fr.md:123` (sujets de `test:browser`)
- Regenerate: `app.js`, `sw.js`

**Interfaces:**
- Produces :
  - `isNewTown() → boolean` (`src/10-state.js`) : `S.stats.ok + S.stats.ko === 0`.
  - `LS_WELCOME = 'ville-bien-etre/v1:welcome-closed'` (`src/00-core.js`).
  - `applyLang(pref: 'auto' | 'fr' | 'en')` (`src/45-settings.js`). C'est le cœur de `changeLang` : `S.settings.lang = pref`, `commit({ silent: true })`, `refreshLang()`, `renderAll()`. `changeLang(pref)` devient `applyLang(pref)` puis, comme aujourd'hui, `openSettings()` et le focus du bouton radio.
  - Dans `src/59-first-steps.js` :
    - `FIRST_CALM_MIN = 2` ;
    - `welcomeShown() → boolean` = `isNewTown() && !S.active && LS_WELCOME ≠ '1'` ;
    - `renderWelcome()` ;
    - `closeWelcome()` ;
    - `startFirstCalm()` ;
    - `bindFirstSteps()` (clics des boutons fixes, appelée par `bindEvents`).
  - Identifiants HTML : `#welcomeCard` (`section.card.welcome-card`, `aria-labelledby="welcomeTitle"`, `hidden`), `#welcomeTitle` (`h3`), `#welcomeStart`, `#welcomeChoose`, `#welcomePaste` (caché ; tâche 7), `#welcomeLangs` (`role="group"`, `aria-label`), `#welcomeClose` (`icon-btn`, icône `#i-close`).
  - Clé de focus des boutons de langue : `welcome:lang`.
  - `tests/premiers-pas-browser.cjs` exporte :
    - `runPremiersPas(browser, baseURL) → { scenarios }` et `SCENARIOS` ;
    - `IPHONE_UA` ;
    - `freshTown(browser, baseURL, options = {}) → { context, page, errors }`. Elle ouvre une ville vraiment neuve : `page.clock.install({ time: new Date('2026-10-21T10:00:00Z') })`, `addInitScript` qui pose `window.__VILLE_DEBUG__ = true`, `goto(baseURL)`, attente de `window.__ville`. `options` va au contexte.
- Textes (FR / EN) :
  - `welcome.title` « Bienvenue dans ta ville » / « Welcome to your town » ;
  - `welcome.lede` « Ici, chaque moment pour toi fait grandir une ville : un livre, une marche, quelques minutes de calme. » / « Here, every moment you take for yourself grows a town: a book, a walk, a few minutes of calm. » ;
  - `welcome.step1` « Lance un chrono pour une vraie activité. » / « Start a timer for a real activity. » ;
  - `welcome.step2` « Chaque minute terminée te rapporte des pièces. » / « Every minute you complete earns you coins. » ;
  - `welcome.step3` « Construis ta ville avec tes pièces. » / « Build your town with your coins. » ;
  - `welcome.start` « Commencer par 2 minutes de calme » / « Start with 2 minutes of calm » ;
  - `welcome.choose` « Choisir une activité » / « Choose an activity » ;
  - `welcome.note` « Gratuit, sans compte ni pub. Ta ville reste sur cet appareil. » / « Free, no account, no ads. Your town stays on this device. » ;
  - `welcome.close` « Fermer l'accueil » / « Close the welcome » ;
  - `welcome.langs` « Langue de l'app » / « App language » ;
  - `welcome.paste` « J'avais commencé dans Safari : coller ma ville » / « I started in Safari: paste my town » ;
  - `tpl.breathe` « Respirer » / « Breathe ».

- [ ] **Step 1: Write the failing unit test** `tests/premiers-pas.test.cjs`, sur `stateApp` (`tests/helpers/state-vm.cjs`) avec `expose: ['isNewTown']`. Test `ville sans séance : ni réussie ni interrompue, l'historique ne compte pas` :
  - une ville neuve donne `true` ;
  - `stats.ok = 1` avec `history = []` donne `false` ;
  - `stats.ko = 1` donne `false`.

- [ ] **Step 2: Write the failing browser scenarios** dans `tests/premiers-pas-browser.cjs` (forme des groupes existants, voir `tests/fiabilite-browser.cjs:1461-1472`). Brancher le groupe dans `tests/browser.cjs` après le bloc `fiabilite` (4 lignes, même forme).
  - `welcomeForNewTown`.
    - `freshTown` : `#welcomeCard` visible, `#welcomeTitle` = « Bienvenue dans ta ville », `#welcomePaste` caché.
    - Une ville amorcée par `cityAt(browser, baseURL, town({}, []), NOW)` (`stats.ok: 1`, historique vide) : `#welcomeCard` caché.
  - `welcomeCloseStays`.
    - Clic `#welcomeClose` : la carte est cachée et le focus est sur `#ctaStart`.
    - Après `page.reload()`, elle est toujours cachée.
    - Réglages → « Tout recommencer », deux clics (`twoStep`) : elle revient.
  - `welcomeLanguage` (390 px puis 320 × 568).
    - Clic sur le bouton « English » de `#welcomeLangs` : `#welcomeTitle` = « Welcome to your town », `document.documentElement.lang === 'en'`, `#sheet` caché, `__ville.state.settings.lang === 'en'`.
    - `document.activeElement` est le bouton « Français » de `#welcomeLangs`.
    - À 320 px, en anglais puis en français : `document.documentElement.scrollWidth <= 320` et chaque bouton de `#welcomeCard` tient dans la largeur (`getBoundingClientRect().right <= 320`).
  - `welcomeChoose` : clic `#welcomeChoose` : la vue Activités est visible et le focus est sur son `h2`.
  - `welcomeGoneAfterFirstSession`.
    - Clic `#welcomeStart`. Accepter la fenêtre de verrouillage si elle s'ouvre : `#sheet:not([hidden]) #wakeAck`, puis « C'est réglé, commencer ». Recopier l'assistant `confirmStart` de `tests/fiabilite-browser.cjs:24`.
    - La séance a le nom « Respirer », 2 min, domaine `calme`, mode `focus` (lus dans `__ville.state.active`).
    - `page.clock.runFor('02:03')`, « Session réussie », « Retour à la ville » : `#welcomeCard` est caché.
    - Une autre ville neuve dont la première séance est interrompue (`clock.fastForward` au-delà de la tolérance, comme `interrupt` de `fiabilite-browser.cjs:53`) : carte cachée aussi.

- [ ] **Step 3: Run** `node --test tests/premiers-pas.test.cjs` et `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Expected: FAIL.

- [ ] **Step 4: Implement**
  - La carte dans `index.html`, cachée par défaut, texte français dans les éléments `data-i18n` :
    - titre ;
    - phrase ;
    - `ol` des trois étapes ;
    - boutons `#welcomeStart` (`btn btn-primary`), `#welcomeChoose` (`btn btn-secondary`), `#welcomePaste` (`btn btn-ghost`, `hidden`) ;
    - note ;
    - `#welcomeLangs` vide ;
    - `#welcomeClose`.
  - `renderWelcome()`, appelée dans `renderVille()` après `liveTick()` :
    - `card.hidden = !welcomeShown()` ;
    - si la carte est visible, `#welcomeLangs` reçoit un bouton par langue connue autre que `LANG` : libellé `DICT[code]['lang.self']`, attribut `lang`, `data-focus-key="welcome:lang"`, clic `applyLang(code)`.
  - Les autres boutons :
    - `closeWelcome()` pose `LS_WELCOME = '1'`, cache la carte et met le focus sur `#ctaStart` ;
    - `#welcomeChoose` appelle `go('activites', true)` ;
    - `startFirstCalm()` appelle `beginSession({ name: t('tpl.breathe'), cat: 'calme', min: FIRST_CALM_MIN, mode: 'focus' })`. La tâche 4 y ajoute la respiration.
  - « Tout recommencer » efface `LS_WELCOME` (`try/catch`).
  - CSS : la carte en colonne, la croix en haut à droite, des boutons pleine largeur à 320 px, la liste numérotée lisible.

- [ ] **Step 5: Existing tests.** Les villes neuves de `tests/browser.cjs` (blocs des lignes 66, 103, 121, 134, 147, 166, 198), `tests/i18n-browser.cjs:33-39`, `tests/settings-browser.cjs:22-31`, `tests/features-browser.cjs:6-18` et `tests/ambient-browser.cjs:299` montrent désormais l'accueil. Lancer toute la suite sur les deux moteurs. Si un test échoue parce que la carte déplace ce qu'il mesure, il ferme l'accueil (`#welcomeClose`) avant sa mesure, sans rien retirer d'autre. Le message de commit le dit.

- [ ] **Step 6: Run** `npm run build && npm run check && npm test`, `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`, `BROWSER=webkit npm run test:browser`. Expected: PASS.

- [ ] **Step 7: Commit** les sources, les tests, `README*.md`, `app.js` et `sw.js`, avec le message `feat(premiers pas): carte Bienvenue pour une ville sans séance`.

---

### Task 4 — La respiration guidée de la première séance

**Files:**
- Modify: `src/10-state.js:118-140` (`cleanActive`), `src/50-session.js:292-358` (`startSessionLocked`) et `:690-710` (« Recommencer » de `showFail`), `src/58-companion-session.js:58-76` (`renderBreathing`, `setBreathing`), `src/59-first-steps.js` (`startFirstCalm`)
- Test: `tests/premiers-pas.test.cjs`, `tests/premiers-pas-browser.cjs`
- Regenerate: `app.js`, `sw.js`

**Interfaces:**
- Consumes: `startFirstCalm()` et `freshTown` (tâche 3).
- Produces :
  - `cleanActive(a)` garde `breathing` quand c'est un booléen, et seulement alors : pas de clé `breathing` sinon.
  - `beginSession(o)` / `startSessionLocked(o)` reportent `o.breathing === true` dans `S.active.breathing`.
  - `setSessionBreathing(on: boolean)` (`58-companion-session.js`) : `S.active.breathing = on`, `commit({ silent: true })`, `aria-pressed` du bouton, départ ou arrêt de la respiration. Le réglage `S.settings.breathing` n'est pas touché.
  - `renderBreathing(a)`. L'état effectif est `typeof a.breathing === 'boolean' ? a.breathing : S.settings.breathing === true`. Il sert à `aria-pressed` et au départ de la respiration. Le clic appelle `setSessionBreathing(!effectif)` si la séance porte `breathing`, sinon `setBreathing(!effectif)`, comme aujourd'hui.
  - « Recommencer » relance avec le même `breathing` que la séance interrompue.
  - `startFirstCalm()` ajoute `breathing: true`.

- [ ] **Step 1: Write the failing unit tests** (`tests/premiers-pas.test.cjs`, `stateApp` avec `expose: ['cleanActive']`).
  - `séance : le champ breathing n'est gardé que s'il est booléen`. À partir d'une séance valide (`name`, `cat: 'calme'`, `startedAt`) : `breathing: true` donne `true`, `breathing: false` donne `false`, l'absence de champ donne `'breathing' in result === false`, `breathing: 'oui'` donne `'breathing' in result === false`.
  - `première séance : respiration de la séance, réglage inchangé, 2 M gagnés`.
    - `await a.startSession({ name: 'Respirer', cat: 'calme', min: 2, mode: 'focus', breathing: true })`.
    - `a.api.state.active.breathing === true` et `a.api.state.settings.breathing === false`.
    - Avancer de 2 minutes, `tick()`, attendre la fin comme `tests/clock.test.cjs:31-35`.
    - `a.api.state.history[0].reward === 2e6`, `a.api.state.stats.byCat.calme === 2`, `a.api.state.settings.breathing === false`.

- [ ] **Step 2: Write the failing browser scenario** `firstCalmBreathes` (`freshTown` ; il tourne sur les deux moteurs).
  - Clic `#welcomeStart` (accepter la fenêtre de verrouillage si elle s'ouvre) : `#breathBtn` visible avec `aria-pressed="true"`, et `__ville.state.settings.breathing === false`.
  - `page.reload()` : la séance en Concentration est interrompue (règle existante) ; « Recommencer » relance une séance dont `#breathBtn` a `aria-pressed="true"`. Une séance libre reprise après un rechargement garde aussi sa respiration (scénario `resumedSessionKeepsBreathing`).
  - Clic `#breathBtn` : `aria-pressed="false"`, `__ville.state.active.breathing === false`, `settings.breathing` toujours `false`. Second clic : de nouveau `true`.
  - `clock.runFor('02:03')` : `#sessResult` contient « Jardin zen » et « Premier pas ».
  - « Retour à la ville » : `history[0].reward === 2e6`, `__ville.state.coins === 17e6 + 5e6 × (nombre de cadeaux « chal: »)` (un défi de la semaine peut être relevé), `#nextCard` contient « Jardin zen (8 M) », `settings.breathing === false`.

- [ ] **Step 3: Run** les tests. Expected: FAIL.

- [ ] **Step 4: Implement** les interfaces ci-dessus.

- [ ] **Step 5: Run** `npm run build && npm run check && npm test` et les deux suites navigateur. Expected: PASS.

- [ ] **Step 6: Commit** avec le message `feat(premiers pas): la première séance respire, sans changer le réglage`.

---

### Task 5 — Avant la première séance : étoile sans message, souhait du lendemain, aide

**Files:**
- Modify: `src/53-visits.js:94-101` (`liveTick`), `src/28-harmony.js:70-79` (`drawTownWish`), `src/06-lang-fr.js:679` et `src/07-lang-en.js:679` (`help.installFirst`), `README.md:84`, `README.fr.md:84`
- Test: `tests/harmony.test.cjs`, `tests/live-state.test.cjs`, `tests/premiers-pas-browser.cjs`
- Regenerate: `app.js`, `sw.js`

**Interfaces:**
- Consumes: `isNewTown()` (tâche 3) ; `claimStars()` (`28-harmony.js:36`, verse et renvoie les étoiles nouvelles).
- Produces :
  - `liveTick(day)` : pour une ville sans séance, les étoiles déjà méritées sont versées sans message, avant le reste du tic. Les fichiers chargés par les tests n'ont pas tous `28-harmony.js`, d'où la garde `typeof`. Ce versement compte comme un changement à enregistrer :
    ```js
    const quiet = isNewTown() && typeof claimStars === 'function' && claimStars().length > 0;
    ...
    if (!season && !drawn && !news && !quiet) return;
    ```
    L'enregistrement de ce versement est visible, `commit(news || quiet ? {} : { silent: true })` : l'en-tête est dessiné avant le tic, il doit montrer les 15 M (correction de la relecture). Une étoile gagnée ensuite en posant un bâtiment garde son message, par `noticeProgress` comme aujourd'hui.
  - `drawTownWish(day)` ne tire rien tant qu'aucune séance réussie n'existe un jour antérieur : condition `!Object.keys(S.stats.days).some(d => d < day)` ajoutée à la garde de la ligne 71.
  - `help.installFirst` :
    - FR : « Tu peux commencer ici, sans rien installer. Sur iPhone, installe l'app quand tu veux : copie ta ville avec « Copier ma ville », puis colle-la à la première ouverture de l'app. »
    - EN : « You can start right here, with nothing to install. On iPhone, install the app whenever you like: copy your town with “Copy my town”, then paste it the first time you open the app. »

- [ ] **Step 1: Write the failing unit tests**
  - `tests/harmony.test.cjs`, test `souhait du jour : il commence le lendemain de la première séance réussie`.
    - Une ville neuve : `drawTownWish('2026-10-21') === false`.
    - `stats.ok = 1`, `stats.days = { '2026-10-21': 2 }` : `false`.
    - `stats.days = { '2026-10-20': 2 }` : `true`.
  - Les tests de souhait existants (`tests/harmony.test.cjs:140-205`) partent d'un état neuf : leur assistant (`wishTown`) reçoit `stats.ok = 1` et `stats.days = { '2026-10-01': 5 }`, et leurs assertions restent les mêmes.
  - Test `ville sans séance : l'étoile de départ est versée sans message`. Il a besoin de `28-harmony.js`, `52-carnet.js` et `53-visits.js` : le placer dans `tests/harmony.test.cjs` en chargeant `[...FILES, '52-carnet.js', '53-visits.js']` comme `:216`, ou dans `tests/live-state.test.cjs` en ajoutant ces fichiers.
    - État neuf (ville de départ), `commit` et `toast` espionnés comme `tests/live-state.test.cjs:104-114`, `liveTick('2026-10-21')` : `state.gifts['star:verdure']` est posé, `state.coins === 15e6`, aucun message, un enregistrement.
    - Même chose avec `stats.ok = 1` : un message qui contient le texte de `harmony.star`.
  - Le test existant `:104-114` (fête et saison) garde ses comptes : le vérifier.

- [ ] **Step 2: Write the failing browser scenario** `quietFirstOpen` (`freshTown`).
  - Pendant 1,5 s, `#toast` ne contient jamais « étoile ».
  - `__ville.state.coins === 15e6` et `#townWishCard` absent ou caché.
  - Réglages → « Bien démarrer et installer l'app » : la feuille contient « Tu peux commencer ici ».

- [ ] **Step 3: Run** les tests. Expected: FAIL.

- [ ] **Step 4: Implement** ; aligner `README.md:84` / `README.fr.md:84` sur le nouveau conseil (« commencer ici, puis copier la ville vers l'app installée sur iPhone »).

- [ ] **Step 5: Run** `npm run build && npm run check && npm test` et les deux suites navigateur. Expected: PASS.

- [ ] **Step 6: Commit** avec le message `feat(premiers pas): une première ouverture calme, le souhait vient le lendemain`.

---

### Task 6 — La carte « Garde ta ville à l'abri »

**Files:**
- Modify: `src/70-install.js` (retirer tout ce qui touche la carte : `HINT_KEY`, `ua`, `ios`, `hidden`, `hideForGood`, `t`, `node`, `applyState`, `fill`, `installHelp`, `show`, `remove`, les écouteurs `beforeinstallprompt`, `appinstalled` et `ville:lang`. Il garde le service worker, `VillePWA` et la classe `standalone`.)
- Modify: `index.html` (conteneur `#installCard` vide et caché, juste après `#welcomeCard`), `src/00-core.js` (`LS_INSTALL_HINT`), `src/59-first-steps.js`, `src/40-ui.js` (`renderVille` appelle `renderShelter`), `src/45-settings.js` (`openBackupSettings`), `src/06-lang-fr.js`, `src/07-lang-en.js`, `styles.css:751-757` si besoin
- Test: `tests/browser.cjs:269-305`, `tests/i18n-browser.cjs:96-108`, `tests/premiers-pas-browser.cjs`
- Regenerate: `app.js`, `sw.js`

**Interfaces:**
- Consumes: `isNewTown()`, `isIOS()` / `isStandalone()` (`45-settings.js:117`, `:22`), `exportBackup()` (`45-settings.js:30`), `markBackup()` (`:90`), `lsSet` / `lsNum`, `toast(msg, action, spoken, { keep })` (`40-ui.js:113`).
- Produces :
  - `LS_INSTALL_HINT = 'ville-bien-etre/v1:install-hint'` (même clé qu'aujourd'hui, `'1'` = masquée pour de bon).
  - `openBackupSettings()` (`45-settings.js`) : `openSettings()`, puis la section `#settingsBackup` est amenée à l'écran avec le focus sur son titre.
  - Dans `59-first-steps.js` :
    - **État**. `let installPrompt = null, promptSeen = false, installed = false, installHelpShown = false`.
    - **Écouteurs**, posés à l'évaluation du fichier comme aujourd'hui.
      - `beforeinstallprompt` : `preventDefault()`, garder l'événement. Si `(pointer: coarse)`, alors `promptSeen = true`. Puis `renderShelter()`.
      - `appinstalled` : `installed = true` puis `renderShelter()`.
    - `shelterKind() → 'ios' | 'prompt' | ''` : `isIOS()` donne `'ios'`, sinon `promptSeen` donne `'prompt'`, sinon `''`.
    - `renderShelter()`.
      - La carte est visible si `shelterKind() && !isNewTown() && !isStandalone() && window.isSecureContext && LS_INSTALL_HINT ≠ '1' && !installed`.
      - Contenu (fait par `h()`, donc avec `frTypo`) : l'icône 48 px, puis `.install-main` avec `h3#installTitle` (`install.title`).
      - Variante `'ios'` : `install.iosWhy`, `install.ios`, `install.iosCopy`, et un bouton `data-act="copy"` (`btn btn-primary btn-sm`, `install.copy`).
      - Variante `'prompt'` : `install.prompt`, et le bouton `data-act="install"` (`install.install`), caché quand `installHelpShown`.
      - Puis `data-act="hide"` (`btn btn-ghost btn-sm`, `install.hide`), et `p.note.install-help` (`install.help`) quand `installHelpShown`.
      - Clés de focus : `install:copy`, `install:install`, `install:hide`.
    - **Clics**, délégués sur `#installCard` dans `bindFirstSteps()`.
      - `copy` : `copyTown()`.
      - `install` : `installHelpShown = true`, `renderShelter()`, puis `prompt()` / `userChoice` de l'événement gardé (`installPrompt = null`). `accepted` donne `installed = true`.
      - `hide` : `LS_INSTALL_HINT = '1'`, `renderShelter()`. Le focus va sur `#ctaStart` s'il était dans la carte.
    - `copyTown()`.
      - `navigator.clipboard.writeText(exportBackup())`. En cas de succès : `markBackup()` puis `toast(t('install.copied'))`.
      - En cas d'échec, ou sans `navigator.clipboard` : `toast(t('install.copyFailed'), { label: t('backup.openSection'), run: openBackupSettings }, undefined, { keep: true })`.
- Textes (FR / EN) :
  - `install.title` devient « Garde ta ville à l'abri » / « Keep your town safe » ;
  - `install.prompt` devient « Installée, l'app s'ouvre depuis ton écran d'accueil et garde ta ville sur ce téléphone. » / « Once installed, the app opens from your home screen and keeps your town on this phone. » ;
  - nouveau `install.iosWhy` « Sur iPhone, le navigateur peut effacer les données d'un site resté sept jours sans visite. Une app ajoutée à l'écran d'accueil garde les siennes. » / « On iPhone, the browser may erase a site's data after seven days without a visit. An app added to the Home Screen keeps its own. » ;
  - nouveau `install.iosCopy` « Ensuite, copie ta ville ici et colle-la à la première ouverture de l'app. » / « Then copy your town here and paste it the first time you open the app. » ;
  - nouveau `install.copy` « Copier ma ville » / « Copy my town » ;
  - nouveau `install.copied` « Ville copiée : colle-la à la première ouverture de l'app. » / « Town copied: paste it the first time you open the app. » ;
  - nouveau `install.copyFailed` « La copie n'a pas marché. Tu peux copier ta ville dans Réglages → Sauvegarde. » / « The copy didn't work. You can copy your town in Settings → Backup. » ;
  - nouveau `backup.openSection` « Aller à la sauvegarde » / « Go to Backup » ;
  - `install.personal` est supprimé des deux dictionnaires.

- [ ] **Step 1: Write the failing browser scenarios** (`tests/premiers-pas-browser.cjs`). Faux presse-papiers posé par `addInitScript` : `writeText` range le texte dans `window.__copied` et répond, ou rejette quand `window.__clipboardFails` vaut vrai.
  - `shelterAfterFirstSession` (`IPHONE_UA`).
    - `freshTown` : `#installCard` caché.
    - Une ville amorcée avec une séance (`cityAt(…, town({}, []), NOW, { userAgent: IPHONE_UA })`) : la carte est visible, `#installTitle` = « Garde ta ville à l'abri », le texte contient « sept jours », pas de bouton `install`.
    - Clic `[data-act="copy"]` : `window.__copied` commence par `VBE2.`, `localStorage['ville-bien-etre/v1:backup-at']` est un nombre récent, et le message contient « Ville copiée ».
  - `shelterNeverInstalled` (`IPHONE_UA` + `navigator.standalone = true`, ville amorcée) : `#installCard` caché.
  - `shelterHideForGood` : clic `[data-act="hide"]`, puis la carte est cachée, le focus est sur `#ctaStart`, et elle reste cachée après `page.reload()`.
  - `shelterCopyRefused` (`__clipboardFails = true`) : le message reste affiché avec le bouton « Aller à la sauvegarde ». Son clic ouvre les Réglages avec `#settingsBackup` visible.

- [ ] **Step 2: Update the existing tests**
  - `tests/browser.cjs:269-305` (ville neuve, Android simulé par l'événement synthétique) :
    - envoyer l'événement au début, puis vérifier que `#installCard` reste caché ;
    - après la séance libre déjà présente dans le bloc et « Retour à la ville », vérifier que la carte est visible, puis faire les vérifications actuelles : clic `[data-act="install"]`, bouton caché, aide « menu de ton navigateur », un seul appel à `prompt` ;
    - continuer ensuite avec « Mettre à jour » comme aujourd'hui.
  - `tests/i18n-browser.cjs:96-108` :
    - avant l'événement, donner une séance à la ville (`__ville.state.stats.ok = 1; __ville.renderAll()`) ;
    - titres attendus : « Keep your town safe », puis « Garde ta ville à l'abri ».

- [ ] **Step 3: Run** `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Expected: FAIL.

- [ ] **Step 4: Implement** les interfaces ci-dessus. Vérifier par `grep -n "install-card\|installCard\|install\." src/70-install.js` qu'il ne reste rien de la carte dans `70-install.js`.

- [ ] **Step 5: Run** `npm run build && npm run check && npm test` et les deux suites navigateur. Expected: PASS.

- [ ] **Step 6: Commit** avec le message `feat(abri): la carte d'installation vient après la première séance et copie la ville sur iPhone`.

---

### Task 7 — « Coller ma ville » dans l'app installée

**Files:**
- Modify: `src/59-first-steps.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`
- Test: `tests/premiers-pas-browser.cjs`
- Regenerate: `app.js`, `sw.js`

**Interfaces:**
- Consumes: `#welcomePaste` et `renderWelcome()` (tâche 3) ; `openBackupSettings()` (tâche 6) ; `readBackup(text) → { error } | { state }`, `summary(st)` et `restoreBackup(st)` (`45-settings.js:36`, `:48`, `:52`). `restoreBackup` refuse déjà pendant une séance (`backup.finishSessionFirst`).
- Produces :
  - `renderWelcome()` : `#welcomePaste.hidden = !(isIOS() && isStandalone())`.
  - `pasteTown()` (clic de `#welcomePaste`).
    - `text` = `await navigator.clipboard.readText()`. Un refus ou une erreur donne `''`.
    - Un texte sans `VBE1.` ni `VBE2.` donne `toast(t('welcome.pasteNone'), { label: t('backup.openSection'), run: openBackupSettings }, undefined, { keep: true })`.
    - Sinon `readBackup(text)`. Une erreur donne le même toast, avec le message `res.error`.
    - Sinon `openSheet(t('welcome.pasteTitle'), body => …)` avec :
      - `p` (`welcome.pasteLine`) ;
      - `p > strong` (`summary(res.state)`) ;
      - `div.review-actions` : bouton principal `welcome.pasteRestore` → `restoreBackup(res.state)`, bouton `btn btn-ghost` `common.cancel` → `closeSheet()`.
- Textes (FR / EN) :
  - `welcome.pasteTitle` « Reprendre ma ville » / « Bring back my town » ;
  - `welcome.pasteLine` « Ville trouvée dans le presse-papiers : » / « Town found on the clipboard: » ;
  - `welcome.pasteRestore` « Reprendre cette ville » / « Bring back this town » ;
  - `welcome.pasteNone` « Pas de ville dans le presse-papiers. Copie-la d'abord dans Safari, ou colle-la dans Réglages → Sauvegarde. » / « No town on the clipboard. Copy it in Safari first, or paste it in Settings → Backup. ».

- [ ] **Step 1: Write the failing browser scenarios**. Toutes sur `freshTown(browser, baseURL, { userAgent: IPHONE_UA })`, avec `navigator.standalone = true` et un faux `navigator.clipboard.readText` qui répond `window.__clip` (ou rejette si `window.__clipRefused`).
  - `pasteFromSafari`.
    - `__clip` = une sauvegarde signée par `signBackup` (exporté par `tests/content-browser.cjs` ; voir son usage à la ligne 268) d'une ville à `coins: 42e6` et `stats.ok: 3`.
    - `#welcomePaste` est visible.
    - Clic : la feuille « Reprendre ma ville » montre « 42 M ». Clic « Reprendre cette ville » : `__ville.state.coins === 42e6`, `#welcomeCard` caché, message « Sauvegarde restaurée et enregistrée. ».
  - `pasteNothing`.
    - `__clip = ''` : message « Pas de ville dans le presse-papiers », avec son bouton.
    - `__clipRefused = true` : même message.
    - Une sauvegarde dont un caractère du milieu est changé : message de `backup.tampered`.
    - Dans chaque cas, la ville n'a pas changé (`coins === 15e6`) et la feuille n'est pas ouverte.
  - `pasteHiddenOutsideApp` : même ville, sans `standalone`, donc `#welcomePaste` caché ; et sans `IPHONE_UA`, caché aussi.

- [ ] **Step 2: Run**. Expected: FAIL.

- [ ] **Step 3: Implement**.

- [ ] **Step 4: Run** `npm run build && npm run check && npm test` et les deux suites navigateur. Expected: PASS.

- [ ] **Step 5: Commit** avec le message `feat(abri): dans l'app installée sur iPhone, coller la ville commencée dans Safari`.

---

### Task 8 — Le rappel de sauvegarde sur iPhone, et « Sauvegarder ma ville » dans les récapitulatifs

**Files:**
- Modify: `src/00-core.js:16` (`IOS_BACKUP_EVERY`), `src/45-settings.js:97-102` (`backupDue`), `src/54-rituals.js:191-197` (`openRecap`), `src/06-lang-fr.js`, `src/07-lang-en.js`
- Test: `tests/premiers-pas.test.cjs`, `tests/premiers-pas-browser.cjs`
- Regenerate: `app.js`, `sw.js`

**Interfaces:**
- Produces :
  - `IOS_BACKUP_EVERY = 5 * 86400000`.
  - `backupDue()` :
    ```js
    function backupDue() {
      if (Store.mode === 'cloud' || Date.now() < lsNum(LS_REMIND)) return false;
      const at = lsNum(LS_BACKUP_AT);
      if (S.updatedAt <= at) return false;
      // Onglet sur iPhone ou iPad : le navigateur peut effacer un site resté sept jours sans visite.
      if (isIOS() && !isStandalone()) return S.stats.ok >= 1 && Date.now() - Math.max(at, S.createdAt) > IOS_BACKUP_EVERY;
      return S.stats.ok >= 3 && Date.now() - at > BACKUP_EVERY;
    }
    ```
  - Récapitulatif : dans `.review-actions`, un bouton `btn btn-secondary` (`icon('download')`, `t('recap.backup')`) entre « Partager l'image » et « Fermer ». Son clic appelle `saveBackupFile()`.
  - Texte : `recap.backup` « Sauvegarder ma ville » / « Back up my town ».

- [ ] **Step 1: Write the failing unit tests** (`tests/premiers-pas.test.cjs`).
  - Chargement : `loadApp` avec les fichiers de `tests/backup.test.cjs:6-13` et `expose: ['backupDue', 'lsSet']`.
  - Globaux : `navigator: { userAgent: IPHONE_UA, platform: 'iPhone', maxTouchPoints: 5, languages: ['fr-CH'] }`, `window: { matchMedia: () => ({ matches: false }) }`. Un autre jeu de globaux simule un Mac (agent de Chrome sur Mac, `maxTouchPoints: 0`).
  - Test `rappel de sauvegarde : sur iPhone dès la première séance, après 5 jours`. Ville avec `stats.ok = 1`, `createdAt` au 2026-10-10, `updatedAt` récent, `now` réglé à :
    - 2026-10-14 → `false` ;
    - 2026-10-16 → `true` ;
    - 2026-10-16 avec `backup-at` au 2026-10-13 → `false` ;
    - 2026-10-16 avec `navigator.standalone = true` → `false` (règle ordinaire, `ok < 3`).
  - Test `rappel de sauvegarde : ailleurs, la règle reste 3 séances et 14 jours`. Mac, `stats.ok = 1`, le 2026-10-16 → `false` ; `stats.ok = 3`, jamais sauvegardé → `true` ; `backup-at` 10 jours plus tôt → `false`.

- [ ] **Step 2: Write the failing browser scenario** `recapBackupButton`.
  - Ouvrir le récapitulatif d'un mois comme `tests/rituals-browser.cjs:315`. Le bouton « Sauvegarder ma ville » est dans `#sheetBody`.
  - Chromium : son clic déclenche un téléchargement nommé `ville-du-bien-etre-*.txt`, puis le message « Téléchargement demandé ».
  - WebKit : vérifier seulement le message.

- [ ] **Step 3: Run**. Expected: FAIL.

- [ ] **Step 4: Implement**.

- [ ] **Step 5: Run** `npm run build && npm run check && npm test` et les deux suites navigateur. Expected: PASS.

- [ ] **Step 6: Commit** avec le message `feat(abri): rappel de sauvegarde adapté à l'iPhone, sauvegarde depuis les récapitulatifs`.

---

### Task 9 — Le lien d'un ami, pour un nouveau venu

**Files:**
- Modify: `index.html:227-230` (`#visitGrow`, premier bouton de `#cityVisitBar`), `src/35-city.js:346-359` (`openVisit`), `src/55-share.js:10-26` (`openVisitFromCode`) et `:66-78` (`bindShare`), `src/59-first-steps.js` (`focusFirstStep`), `src/06-lang-fr.js`, `src/07-lang-en.js`
- Test: `tests/premiers-pas-browser.cjs`
- Regenerate: `app.js`, `sw.js`

**Interfaces:**
- Consumes: `isNewTown()`, `#welcomeStart` (tâche 3) ; `City.closeBig()` passe par `history.back()` puis `popstate`. L'option `back` d'`openVisit` est appelée après chaque fermeture, après le focus par défaut.
- Produces :
  - `focusFirstStep()` : focus sur `#welcomeStart` s'il peut le prendre, sinon sur `#ctaStart`.
  - `City.openVisit(snapshot, { own, back, pitch })` : avec `pitch`, `#cityVisitHead` reçoit après la ligne de taille un `p.visit-meta.visit-pitch` (`visit.pitch`). La tête est remplie avant la mise en page, comme les autres lignes.
  - `openVisitFromCode(code, { back })`, avec `newcomer = isNewTown()` :
    - `City.openVisit(…, { own, back: back || (newcomer ? focusFirstStep : null), pitch: newcomer })` ;
    - `#visitGrow.hidden = !newcomer` et `#visitShare.hidden = newcomer` ;
    - `#visitKeep` porte `btn-secondary` quand `newcomer`, sinon `btn-primary`, comme aujourd'hui.
  - `#visitGrow` (`btn btn-primary`, `data-i18n="visit.grow"`, `hidden`) : son clic appelle `City.closeBig()`.
- Textes (FR / EN) :
  - `visit.pitch` « Cette ville grandit avec de vrais moments : lire, bouger, respirer, ranger, créer. » / « This town grows with real moments: reading, moving, breathing, tidying, creating. » ;
  - `visit.grow` « Faire grandir ma ville » / « Grow my own town ».

- [ ] **Step 1: Write the failing browser scenarios**. Le lien vient de `leaCode` (`tests/rituals-browser.cjs`). La ville neuve est ouverte sur `baseURL.replace(/#.*$/, '') + '#ville=' + code`, avec l'horloge et `__VILLE_DEBUG__` comme `freshTown`.
  - `friendLinkForNewcomer`.
    - `#cityVisitHead` contient la ligne « Cette ville grandit avec de vrais moments », après « 6 éléments · terrain 7×7 ».
    - `#visitGrow` est visible, `#visitShare` caché, et `#visitKeep` a la classe `btn-secondary`.
    - Clic `#visitGrow` : `#cityBig` est caché, `location.hash === ''`, et le focus est sur `#welcomeStart`.
    - `page.reload()` : la visite ne se rouvre pas.
  - `friendLinkEscape` : même départ. `Escape` : la visite se ferme et le focus est sur `#welcomeStart`.
  - `friendLinkWelcomeClosed` : `LS_WELCOME = '1'` avant le chargement ; clic `#visitGrow`, puis focus sur `#ctaStart`.
  - `friendLinkUnchanged` : ville amorcée avec une séance (`sessionTown`). Pas de ligne, `#visitGrow` caché, `#visitShare` visible, `#visitKeep` a la classe `btn-primary`. Les tests ancrés de `tests/rituals-browser.cjs:345-390` passent toujours.

- [ ] **Step 2: Run**. Expected: FAIL.

- [ ] **Step 3: Implement**.

- [ ] **Step 4: Run** `npm run build && npm run check && npm test` et les deux suites navigateur. Expected: PASS.

- [ ] **Step 5: Commit** avec le message `feat(partage): un nouveau venu qui visite la ville d'un ami peut commencer la sienne`.

---

### Task 10 — L'adresse de l'app sur les images partagées

**Files:**
- Modify: `src/27-share.js:77` (près de `shareLink`), `src/54-rituals.js:238-239` (`recapCanvas`), `src/46-features.js:286-304` (`cityImageCanvas`), `src/06-lang-fr.js:1136`, `src/07-lang-en.js:1136`
- Test: `tests/share.test.cjs`, `tests/premiers-pas-browser.cjs`
- Regenerate: `app.js`, `sw.js`

**Interfaces:**
- Produces :
  - `appAddress() → string` : `location.origin + location.pathname`, sans protocole, sans `/index.html` final et sans barre finale. Exemple : `lubachma.github.io/ville-du-bien-etre`.
  - `recap.imageFooter` devient « Ville du bien-être · {address} » (FR et EN), dessiné avec `{ address: appAddress() }`.
  - Image de la ville : le pied passe à deux lignes (la ligne `png.footer` actuelle, puis `appAddress()`, même police, couleur `muted`). La hauteur `foot` grandit pour les deux lignes. Le titre reste le premier `fillText`.

- [ ] **Step 1: Write the failing tests**
  - `tests/share.test.cjs`, test `adresse de l'app : hôte et chemin, sans protocole ni barre finale`. Simuler `location` comme `tests/share.test.cjs:9-10` :
    - `{ origin: 'https://lubachma.github.io', pathname: '/ville-du-bien-etre/' }` → `'lubachma.github.io/ville-du-bien-etre'` ;
    - `pathname: '/ville-du-bien-etre/index.html'` → même résultat ;
    - `{ origin: 'http://127.0.0.1:8766', pathname: '/' }` → `'127.0.0.1:8766'`.
  - Scénario navigateur `imagesShowAddress`. Intercepter `CanvasRenderingContext2D.prototype.fillText` comme `tests/fiabilite-browser.cjs:563-640`.
    - L'adresse attendue est `location.host + location.pathname` sans barre finale, calculée dans la page.
    - Récapitulatif du mois (`noShare`, comme la planche) : un texte égal à « Ville du bien-être · » + adresse, et le premier texte dessiné reste le titre.
    - Image de la ville (`__ville.png.canvas()`) : un texte égal à l'adresse, dessiné après le titre.

- [ ] **Step 2: Run**. Expected: FAIL.

- [ ] **Step 3: Implement**. Les tests existants de `tests/fiabilite-browser.cjs:563-640` (titre en premier, encres, pixel du ciel) doivent passer sans changement.

- [ ] **Step 4: Run** `npm run build && npm run check && npm test` et les deux suites navigateur. Expected: PASS. Regarder `test-results/planche/recap-image.png` après `PLAYWRIGHT_CHANNEL=chrome npm run board` : l'adresse est lisible et ne touche pas la ligne au-dessus.

- [ ] **Step 5: Commit** avec le message `feat(partage): l'adresse de l'app sur l'image du récapitulatif et celle de la ville`.

---

### Task 11 — Images d'aperçu et captures du manifeste

**Files:**
- Create: `scripts/apercu.cjs`, `apercu/ville-1200x630.png`, `apercu/ecran-ville.png`, `apercu/ecran-seance.png`, `apercu/ecran-carnet.png`
- Modify: `package.json` (script `apercu`), `manifest.webmanifest` (`screenshots`), `scripts/package.mjs:11` (copier `apercu`), `tests/visibilite.test.cjs`, `README.md` et `README.fr.md` (tableau des scripts l.118-126, structure l.186-187)
- Regenerate: `sw.js` (le manifeste est précaché)

**Interfaces:**
- Consumes: `app.js` déjà construit. Pour `tests/board.cjs` :
  - même serveur statique sous `/ville-du-bien-etre/` (l.319-331) ;
  - `freeze(page, amb)` et `__ville.ambient.force(amb)` (l.39-41) ;
  - moment `golden` = fin d'après-midi ;
  - amorce par `addInitScript` sur `ville-bien-etre/v2` ;
  - `serviceWorkers: 'block'`.
- Produces :
  - `npm run apercu` (= `node scripts/apercu.cjs`, Chromium, `PLAYWRIGHT_CHANNEL` lu comme la planche) écrit les quatre fichiers.
  - `apercu/ville-1200x630.png` : 1200 × 630.
    - Une ville vivante (une trentaine d'éléments, compagnon, habitants) dessinée par l'app, au moment `golden`, en été, au soleil, sans fête.
    - Le nom « Ville du bien-être » (Young Serif) et « Prends soin de toi, ta ville grandit » (Figtree), lisibles en petit.
  - Trois captures de 780 × 1688 (fenêtre 390 × 844, échelle 2, `isMobile`, `locale: 'fr-FR'`, `timezoneId: 'Europe/Zurich'`, sans carte d'accueil ni d'installation) :
    - `ecran-ville.png` : la vue Ville ;
    - `ecran-seance.png` : une séance Calme en cours avec le compagnon et la respiration ;
    - `ecran-carnet.png` : le carnet ouvert.
  - Manifeste, `"screenshots"` (une entrée par capture, `"sizes": "780x1688"`, `"type": "image/png"`, `"form_factor": "narrow"`) :
    - « Ta ville grandit à chaque moment pour toi » ;
    - « Une séance de calme avec ton compagnon » ;
    - « Le carnet de ta ville ».

- [ ] **Step 1: Write the failing tests** (`tests/visibilite.test.cjs`). Les dimensions sont lues dans l'en-tête PNG : largeur et hauteur en octets 16 à 23, big-endian.
  - `aperçu : image des liens en 1200 × 630, à l'adresse annoncée par la page`. Le fichier existe, aux bonnes dimensions, et `og:image` se termine par `apercu/ville-1200x630.png`.
  - `manifeste : trois captures étroites qui existent, à leur taille`. Trois entrées, `form_factor` « narrow », `label` non vide. Pour chacune, le fichier existe et ses dimensions égalent `sizes`. Le rapport largeur / hauteur reste ≤ 2,3.
  - `publication : apercu est copié dans dist/`. Le test lit `scripts/package.mjs` et vérifie que `'apercu'` figure dans la liste copiée.

- [ ] **Step 2: Run** `node --test tests/visibilite.test.cjs`. Expected: FAIL.

- [ ] **Step 3: Implement** le script et lancer `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run apercu`. Regarder les quatre images (outil de lecture d'image) : texte lisible, aucune carte d'accueil ni d'installation, ville belle et diverse. Puis le manifeste, la copie dans `package.mjs`, et le README :
  - une ligne `apercu` dans le tableau des scripts (« relancer quand l'apparence change ») ;
  - une ligne `apercu/` dans la structure.

- [ ] **Step 4: Run** `npm run build && npm run check && npm test && npm run package`, puis vérifier que `dist/apercu/ville-1200x630.png` existe ; ensuite les deux suites navigateur. Expected: PASS.

- [ ] **Step 5: Commit** `git add scripts/apercu.cjs apercu package.json manifest.webmanifest scripts/package.mjs tests/visibilite.test.cjs README.md README.fr.md sw.js` puis `git commit -m "feat(visibilité): image d'aperçu des liens et captures pour l'installation"`.
