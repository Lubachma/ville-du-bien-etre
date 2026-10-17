# Étape 1 — Langue, réglages et série bienveillante : plan d'implémentation

> **Pour les agents :** sous-compétence REQUISE : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans, tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**But :** jouer en français ou en anglais (réglage « Automatique / Français / English »), avec une série qui pardonne (jours de repos, pause, cadeau de bon retour) et de nouveaux réglages (son, vibration, début de semaine, rappel d'agenda).

**Architecture :**
- La traduction tient dans trois fichiers chargés juste après `00-core.js` : `src/05-i18n.js` pour les fonctions, `src/06-lang-fr.js` et `src/07-lang-en.js` pour les dictionnaires.
- Tous les textes passent par `t(clé, paramètres)`. Les textes fixes de `index.html` portent des attributs `data-i18n*`.
- La série devient un parcours des jours à rebours (`streakDetail`) qui tient compte des jours de repos et des pauses. Les nouveaux réglages vivent dans `S.settings`.

**Pile technique :** JavaScript sans framework (IIFE assemblée par `scripts/build.mjs`), `Intl` (`DateTimeFormat`, `PluralRules`), Web Audio, `node:test` dans une machine virtuelle Node, Playwright.

**Spécification :** `docs/superpowers/specs/2026-10-18-langue-reglages-serie-design.md` (approuvée). Lire la spécification avant chaque tâche : les règles qui y sont fixées ne sont pas répétées ici.

**Branche :** travailler sur `etape-1-langue-reglages`, créée depuis `main`.

## Contraintes globales

- Ne jamais modifier `app.js` ni `sw.js` à la main. Après tout changement de `src/`, `index.html` ou des CSS : `npm run build`, puis committer `app.js` et `sw.js` régénérés.
- Commandes de vérification, à faire passer à chaque tâche :
  - `npm run check` : syntaxe valide ;
  - `npm test` : tous les tests unitaires passent ;
  - `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` : tous les parcours navigateur passent.
- Données : clé `ville-bien-etre/v2`, sauvegardes `VBE2` ; les `VBE1` restent importables. Aucun nouveau champ n'est obligatoire : `normalize()` donne toujours une valeur par défaut.
- Valeurs par défaut :
  - **ville neuve** : `lang: 'auto'`, `restDays: 2`, `hideStreak: false`, `weekStart: 'mon'`, `soundType: 'chime'`, `soundVolume: 'normal'`, `vibrate: true` ;
  - **ville existante sans `lang`** : `'fr'`.
- Cadeau de bon retour : 20 % (`RETURN_BONUS = 20`). Gains de volume : `soft` 0,5, `normal` 1, `loud` 1,6. Types de son : `chime`, `bowl`, `bells`.
- Locales `Intl` : `fr-CH` en français, `en-GB` en anglais.
- Nombres en anglais : point décimal et suffixe `B` (milliard). En français : virgule et `Md`.
- Unités de durée :
  - français : `fmtMin(90)` donne `1 h 30` ;
  - anglais : `fmtMin(90)` donne `1 h 30 min` ;
  - pastille de série : `3 j` en français, `3 d` en anglais.
- `frTypo` ne transforme le texte qu'en français.
- Ton :
  - français : tutoiement, sans aucune formulation de perte (« série perdue », « tu as raté ») ;
  - anglais : « you », naturel et chaleureux.
- Le nom « Ville du bien-être » ne se traduit pas.
- Rappel : fichier `.ics` (`RRULE:FREQ=DAILY`, `DURATION:PT10M`, alerte `TRIGGER:PT0M`) **sans aucun lien**, et lien Google Agenda.
- Heure du rappel : `localStorage['ville-bien-etre/v1:reminder-time']`, `18:00` par défaut.
- Mise en page : aucun débordement horizontal à 320, 390 et 768 px, dans les deux langues.
- Tests navigateur existants : ils restent en français, avec un contexte `locale: 'fr-FR'`.

## Points de vigilance

Les cinq situations les plus susceptibles de gêner un utilisateur réel, chacune couverte par un test dans la tâche indiquée :

1. **Ville existante après la mise à jour** : elle reste en français, sa série ne raccourcit pas avec les nouveaux défauts, et les nouveaux réglages prennent leurs valeurs par défaut (tâche 9).
2. **Textes anglais plus longs** : ils ne débordent pas à 320 px dans les Réglages, la fenêtre de lancement ni la boutique (tâche 8).
3. **Éléments construits une seule fois** : les filtres du tirage, les options d'ajout d'activité et la carte d'installation se mettent bien à jour quand on change de langue sans recharger (tâche 8).
4. **Sauvegarde d'avant la mise à jour** (`VBE1` ou `VBE2` sans les nouveaux champs) : elle s'importe sans erreur, en français, sans pause (tâche 1).
5. **Deux sessions réussies un jour de « bon retour »** : seule la première reçoit le cadeau (tâche 10).

---

### Task 1 : Socle de traduction

**Fichiers :**
- Créer :
  - `src/05-i18n.js` ;
  - `src/06-lang-fr.js` (`DICT.fr = {…}`) ;
  - `src/07-lang-en.js` (`DICT.en = {…}`) ;
  - `tests/i18n.test.cjs`.
- Modifier :
  - `src/00-core.js` : ajouter `let LANG = 'fr';` et rendre `frTypo`, `dec1`, `fmt`, `fmtMin` et `plural` dépendants de `LANG` ;
  - `src/20-rules.js` : formats de date ;
  - `src/10-state.js` : `settings.lang`, exemples par défaut, nom de ville ;
  - `src/60-boot.js` : ordre de démarrage ;
  - les quatre tests unitaires existants, pour charger les fichiers i18n.

**Interfaces produites :**
- `DICT: { fr: object, en: object }`, `LANGS = ['fr', 'en']`.
- `t(key: string, params?: object): string`
  - Entrée texte : interpolation `{nom}`.
  - Entrée `{ one, other }` : choix par `Intl.PluralRules(locale()).select(params.n)`.
  - Entrée `{ m, f }` : choix par `params.g === 'f'`.
  - Repli : `DICT[LANG]`, puis `DICT.fr`, puis la clé elle-même.
- `resolveLang(pref: 'auto'|'fr'|'en', langs?: string[]): 'fr'|'en'`
  - Avec `pref` à `'auto'`, la première entrée de `langs` (par défaut `navigator.languages`) qui commence par `fr` ou `en` décide.
  - Sinon : `'en'`.
- `setLang(pref): void`
  - Met à jour `LANG` et `<html lang>`, et vide les caches de formats.
  - Émet `window.dispatchEvent(new CustomEvent('ville:lang'))` si `window` existe.
  - Est sans effet sur `document`/`window` dans les tests en machine virtuelle.
- `locale(): 'fr-CH'|'en-GB'`
- `applyStaticText(root = document): void`
  - Remplit `[data-i18n]` (textContent, avec `frTypo`).
  - Remplit `[data-i18n-aria-label]`, `[data-i18n-placeholder]` et `[data-i18n-title]` (attribut correspondant).
- `displayName(name: string): string`
  - Si `name` est exactement le texte d'une clé `tpl.*` dans **n'importe quelle** langue, renvoie `t(cette clé)`.
  - Sinon, renvoie `name`.
- `cityName(): string`
  - `S.personal.name` s'il n'est ni vide ni égal à `'Ma ville'`.
  - Sinon, `t('city.defaultName')`.
- `dayFmt(kind: 'long'|'short'|'weekday'): Intl.DateTimeFormat`
  - Mis en cache par langue, en UTC.
  - Remplace `fmtDayLong`, `fmtDayShortUTC` et `fmtWeekday`, que l'on supprime en mettant leurs appelants à jour.
  - Le cache de `fmtTime` devient indexé par fuseau et par langue.
- `window.VilleI18n = Object.freeze({ t, lang: () => LANG })`.

**Clés fixées par cette tâche (texte exact) :**

| Clé | Français | Anglais |
|---|---|---|
| `lang.auto` | `Automatique` | `Automatic` |
| `lang.fr` | `Français` | `Français` |
| `lang.en` | `English` | `English` |
| `city.defaultName` | `Ma ville` | `My town` |
| `when.today` | `aujourd'hui, {time}` | `today, {time}` |
| `when.yesterday` | `hier, {time}` | `yesterday, {time}` |
| `when.other` | `{date}, {time}` | `{date}, {time}` |

**Modèles d'exemples (`tpl.*`) :** le français reprend les noms actuels de `defaultState()`. Chaque nom doit être unique sur l'ensemble des 17 modèles, toutes langues confondues.

| Clé | Français | Anglais |
|---|---|---|
| `tpl.act.reading` | Lecture | Reading |
| `tpl.act.sport` | Sport | Sport |
| `tpl.act.meditation` | Méditation | Meditation |
| `tpl.act.tidying` | Rangement | Tidying up |
| `tpl.act.music` | Musique | Music |
| `tpl.act.homework` | Devoirs / travail | Homework / work |
| `tpl.act.walk` | Marche dehors | Walk outside |
| `tpl.act.drawing` | Dessin | Drawing |
| `tpl.wish.chapter` | Lire un chapitre | Read a chapter |
| `tpl.wish.music` | Jouer de la musique | Play music |
| `tpl.wish.walk` | Aller marcher | Go for a walk |
| `tpl.wish.meditate` | Méditer | Meditate |
| `tpl.wish.draw` | Dessiner | Draw something |
| `tpl.chore.tidy` | Ranger | Tidy up |
| `tpl.chore.dishes` | Faire la vaisselle | Do the dishes |
| `tpl.chore.study` | Réviser / travailler | Study / work |
| `tpl.chore.mail` | Trier le courrier | Sort the mail |

`defaultState()` construit ses exemples à partir de ces clés. Les cas particuliers aujourd'hui repérés par le nom (`name === 'Aller marcher'`) le sont désormais par la clé `tpl.wish.walk`.

**Démarrage (`boot()`) :**
1. `setLang('auto')` avant `Store.init()`, pour qu'une ville neuve reçoive des exemples dans la langue du téléphone.
2. `Store.init()`.
3. `setLang(S.settings.lang)`.
4. `applyStaticText()`.
5. Supprimer `document.documentElement.lang = 'fr'`.

**État :**
- `defaultState().settings.lang = 'auto'`.
- `normalize()` : `lang` vaut `st.lang` s'il est dans `['auto', 'fr', 'en']`, sinon `'fr'`.
- `personal.name` : chaîne vide par défaut, et `normalize()` accepte `''`.

- [ ] **Étape 1 : écrire les tests qui échouent** dans `tests/i18n.test.cjs`. Ils chargent dans une machine virtuelle `00-core.js`, `05-i18n.js`, `06-lang-fr.js`, `07-lang-en.js`, `10-state.js` et `20-rules.js`, avec un `window` et un `document` réduits à de simples objets.
  - `les deux dictionnaires ont exactement les mêmes clés` : `assert.deepEqual(Object.keys(DICT.fr).sort(), Object.keys(DICT.en).sort())`.
  - `chaque clé utilisée existe dans les deux langues`. Le test parcourt :
    - les fichiers `src/*.js` autres que `06-lang-fr.js` et `07-lang-en.js`, avec `/\bt\(\s*'([^']+)'\s*[,)]/g` ;
    - `index.html`, avec `/data-i18n(?:-(?:aria-label|placeholder|title))?="([^"]+)"/g`.
    
    Chaque clé trouvée doit être présente dans `DICT.fr` et `DICT.en`.
  - `resolveLang` :
    ```js
    assert.equal(resolveLang('auto', ['de-CH', 'fr-FR']), 'fr');
    assert.equal(resolveLang('auto', ['en-US', 'fr']), 'en');
    assert.equal(resolveLang('auto', ['de-CH']), 'en');
    assert.equal(resolveLang('fr', ['en-US']), 'fr');
    assert.equal(resolveLang('en', ['fr-FR']), 'en');
    ```
  - `t : interpolation, pluriels et genre`. Le test ajoute à `DICT.fr` et `DICT.en` des clés temporaires `test.n` (`{ one: '{n} jour', other: '{n} jours' }` et `{ one: '{n} day', other: '{n} days' }`) et `test.g` (`{ m: 'construit', f: 'construite' }`), puis vérifie :
    ```js
    setLang('fr'); assert.equal(t('test.n', { n: 0 }), '0 jour'); assert.equal(t('test.n', { n: 2 }), '2 jours');
    assert.equal(t('test.g', { g: 'f' }), 'construite');
    setLang('en'); assert.equal(t('test.n', { n: 0 }), '0 days'); assert.equal(t('test.n', { n: 1 }), '1 day');
    assert.equal(t('absent.key'), 'absent.key');
    ```
  - `formats selon la langue` :
    ```js
    setLang('fr'); assert.equal(fmt(1.5e6), '1,5 M'); assert.equal(fmt(2e9), '2 Md'); assert.equal(fmtMin(90), '1 h 30');
    assert.equal(frTypo('Bonjour !'), 'Bonjour !');
    setLang('en'); assert.equal(fmt(1.5e6), '1.5 M'); assert.equal(fmt(2e9), '2 B'); assert.equal(fmtMin(90), '1 h 30 min');
    assert.equal(frTypo('Hello !'), 'Hello !');
    ```
  - `langue d'une ville existante et d'une ville neuve` :
    ```js
    assert.equal(normalize({ settings: { grace: 10 } }).settings.lang, 'fr');
    assert.equal(defaultState().settings.lang, 'auto');
    ```
  - `exemples par défaut et nom de ville traduits tant qu'ils ne sont pas renommés`. Le test vérifie aussi que, sous `setLang('en')`, `defaultState()` renvoie des activités nommées `Reading` et `Walk outside` :
    ```js
    setLang('en'); assert.equal(displayName('Lecture'), 'Reading'); assert.equal(displayName('Mon roman'), 'Mon roman');
    setLang('fr'); assert.equal(displayName('Go for a walk'), 'Aller marcher');
    S.personal.name = 'Ma ville'; setLang('en'); assert.equal(cityName(), 'My town');
    S.personal.name = 'Lausanne'; assert.equal(cityName(), 'Lausanne');
    ```
  - `sauvegarde d'avant la mise à jour`. Dans `tests/backup.test.cjs` : un état d'export sans `lang`, encodé en `VBE2` (avec `v: 2`) puis en `VBE1` (avec `v: 1`), doit être relu par `readBackup` sans erreur. On vérifie `settings.lang === 'fr'`.

- [ ] **Étape 2 :** `npm test`. Résultat attendu : ÉCHEC, car `resolveLang` et `t` ne sont pas définis.

- [ ] **Étape 3 :** implémenter les interfaces ci-dessus.
  - Ajouter `'05-i18n.js'`, `'06-lang-fr.js'` et `'07-lang-en.js'`, juste après `'00-core.js'`, dans les listes de fichiers de `tests/activities.test.cjs`, `tests/backup.test.cjs`, `tests/features.test.cjs` et `tests/state-session.test.cjs`.
  - Remplacer `whenLabel` par les clés `when.*`.

- [ ] **Étape 4 :** `npm test`, puis `npm run build && npm run check && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Résultat attendu : tout passe, et l'interface est inchangée en français.

- [ ] **Étape 5 :** committer avec le message `feat(i18n): socle de traduction FR/EN`.

### Task 2 : Noms des bâtiments, domaines et groupes

**Fichiers :**
- Modifier :
  - `src/00-core.js` :
    - retirer `name`, `de` et `hint` de `CATS`, et `name` de `ITEMS` ;
    - `groupName` utilise désormais `t` ;
  - `06-lang-fr.js` et `07-lang-en.js` ;
  - tous les fichiers qui lisent `ITEMS[…].name`, `CATS[…].name`, `.de`, `.hint` ou `groupName`.
- Test : `tests/i18n.test.cjs`.

**Interfaces produites (dans `05-i18n.js`) :**
- `itemName(key: string): string`, qui renvoie `t('item.' + key)`.
- `itemGender(key: string): 'f'|'m'`, qui renvoie `ITEMS[key].fem ? 'f' : 'm'`.
- `catName(c)`, `catOf(c)` et `catHint(c)`, qui renvoient `t('cat.' + c)`, `t('cat.' + c + '.of')` et `t('cat.' + c + '.hint')`.
- `groupName(g)`, qui renvoie `t('group.' + g)`.

**Textes exacts :**
- Domaines :
  - français : `Esprit`, `Corps`, `Calme`, `Foyer`, `Créativité` ;
  - formes `.of` en français : « d'Esprit », « de Corps »… (reprises de l'ancien champ `de`) ;
  - anglais : `Mind`, `Body`, `Calm`, `Home`, `Creativity` ;
  - formes `.of` en anglais : `of Mind`, `of Body`… ;
  - indices : repris de `hint` en français, traduits en anglais.
- Groupes : `group.decor` (`Décor` / `Decorations`), `group.prestige` (`Prestige` / `Landmarks`).
- Bâtiments en anglais :

  | Clé | Anglais | Clé | Anglais |
  |---|---|---|---|
  | `arbre` | Tree | `stade` | Stadium |
  | `fleurs` | Flower bed | `jardin` | Zen garden |
  | `chemin` | Path | `fontaine` | Fountain |
  | `banc` | Bench | `pavillon` | Tea pavilion |
  | `lampadaire` | Street lamp | `kiosque` | Bandstand |
  | `etang` | Pond | `atelier` | Artist's studio |
  | `maison` | House | `theatre` | Theatre |
  | `boulangerie` | Bakery | `horloge` | Clock tower |
  | `serre` | Greenhouse | | |
  | `bibliotheque` | Library | | |
  | `ecole` | School | | |
  | `observatoire` | Observatory | | |
  | `terrain` | Sports field | | |
  | `piscine` | Swimming pool | | |

- [ ] **Étape 1 :** test qui échoue, `noms dynamiques présents`. Pour chaque clé `k` de `ITEMS` : `item.k` existe dans les deux langues. Pour chaque `c` de `CAT_ORDER` : `cat.c`, `cat.c.of` et `cat.c.hint` existent. `group.decor` et `group.prestige` existent. Et `assert.equal(fs.readFileSync(...).match(/(ITEMS|CATS)\[[^\]]+\]\.(name|de|hint)/g), null)`, appliqué à chaque `src/*.js`.
- [ ] **Étape 2 :** `npm test`. Résultat attendu : ÉCHEC.
- [ ] **Étape 3 :** remplacer tous les usages par les fonctions ci-dessus. Les accords du français passent par `{ m, f }` avec `g: itemGender(k)`.
- [ ] **Étape 4 :** `npm test`, puis `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Résultat attendu : tout passe.
- [ ] **Étape 5 :** committer avec le message `feat(i18n): noms traduits des bâtiments et domaines`.

### Procédure commune aux tâches 3 à 7 : traduire l'interface existante, fichier par fichier

Chacune de ces cinq tâches suit **la même procédure** sur sa liste de fichiers. Une tâche est terminée quand ses fichiers rejoignent la liste `CLEAN_FILES` du test anti-texte-en-dur.

**Procédure :**
- Remplacer chaque texte visible, `aria-label`, `title`, `placeholder`, toast ou annonce par `t('<domaine>.<nom>', paramètres)`.
- Recopier le texte français **tel quel** dans `06-lang-fr.js`, y compris les corrections récentes : « interrompue », accords, « 0 min ».
- Écrire la version anglaise dans `07-lang-en.js`.
- Pluriels : entrées `{ one, other }`. Accords avec un bâtiment : `{ m, f }`.
- Pas de concaténation de morceaux de phrase : une phrase par clé, avec ses paramètres.
- Noms d'activités, d'idées, d'historique, de tirage et d'étapes de routine : toujours affichés via `displayName(...)`.
- Nom de ville : toujours via `cityName()`.
- Préfixes de clés suggérés : `nav`, `city`, `shop`, `act`, `draw`, `journal`, `goal`, `routine`, `level`, `session`, `result`, `wake`, `strict`, `settings`, `backup`, `storage`, `pwa`, `help`, `install`, `lock`, `png`.

**Le test commun, à ajouter dans la tâche 3.** `tests/i18n.test.cjs` reçoit le test `aucun texte en dur dans les fichiers traduits`. Pour chaque fichier de `const CLEAN_FILES = [...]` :
1. Retirer les commentaires (`/* … */` et `// …`).
2. Extraire les chaînes `'…'`, `"…"` et `` `…` ``.
3. Signaler une chaîne si elle contient une lettre accentuée (`/[à-ÿœÀ-ŸŒ]/`), ou deux mots séparés par une espace ou une apostrophe (`/[A-Za-zÀ-ÿ]{2,}[ '’][A-Za-zÀ-ÿ]{2,}/`).

Exceptions de départ :
- listes de classes CSS (`/^[a-z0-9-]+( [a-z0-9-]+)+$/`) ;
- polices (`/px|serif|system-ui/`) ;
- clés de stockage (`/^ville-(du-)?bien-etre/`) ;
- `'Ville du bien-être'`.

Toute nouvelle exception doit rester purement technique et être commentée. Pour `index.html`, la règle est différente : chaque texte visible se trouve dans un élément `data-i18n`. Le texte d'un bouton qui contient une icône va dans un `<span data-i18n>`.

### Task 3 : Navigation, ville et boutique

Suivre la procédure commune ci-dessus.

- Fichiers : `index.html` (tous les textes fixes), `src/40-ui.js`, `src/44-shop.js`, `src/35-city.js`, `src/20-rules.js` (`lockInfo`) et `src/47-accessibility.js`.
- Le test commun est créé avec ces fichiers dans `CLEAN_FILES`.
- Pastille de série : clé `unit.streakDays` (`{n} j` / `{n} d`).
- Committer avec le message `feat(i18n): navigation, ville et boutique`.

- [ ] Ajouter les fichiers de la tâche à `CLEAN_FILES`, puis `npm test`. Résultat attendu : ÉCHEC, avec la liste des textes encore en dur.
- [ ] Traduire les fichiers.
- [ ] `npm test`, puis `npm run build && npm run check && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Résultat attendu : tout passe. Les tests navigateur sont en français : ils prouvent qu'aucun texte français n'a changé.
- [ ] Committer.

### Task 4 : Activités et tirage

Suivre la procédure commune ci-dessus.

- Fichiers : `src/41-activities.js`, `src/42-draw.js` et `src/60-boot.js` (toasts des formulaires).
- `catOptions` affiche `catName(c) + ' (' + catHint(c) + ')'`.
- La fenêtre de modification se pré-remplit avec `displayName(it.name)`.
- Committer avec le message `feat(i18n): activités et tirage`.

- [ ] Ajouter les fichiers de la tâche à `CLEAN_FILES`, puis `npm test`. Résultat attendu : ÉCHEC, avec la liste des textes encore en dur.
- [ ] Traduire les fichiers.
- [ ] `npm test`, puis `npm run build && npm run check && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Résultat attendu : tout passe. Les tests navigateur sont en français : ils prouvent qu'aucun texte français n'a changé.
- [ ] Committer.

### Task 5 : Journal, objectifs, routines, niveaux, personnalisation

Suivre la procédure commune ci-dessus.

- Fichiers : `src/43-journal.js` et `src/46-features.js`.
- La légende du PNG devient la clé `png.footer` (`Ville du bien-être · {time} pour prendre soin de moi` / `Ville du bien-être · {time} of self-care`).
- La plage de la semaine utilise `dayFmt('short')`.
- Committer avec le message `feat(i18n): journal et fonctions`.

- [ ] Ajouter les fichiers de la tâche à `CLEAN_FILES`, puis `npm test`. Résultat attendu : ÉCHEC, avec la liste des textes encore en dur.
- [ ] Traduire les fichiers.
- [ ] `npm test`, puis `npm run build && npm run check && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Résultat attendu : tout passe. Les tests navigateur sont en français : ils prouvent qu'aucun texte français n'a changé.
- [ ] Committer.

### Task 6 : Sessions

Suivre la procédure commune ci-dessus.

- Fichiers : `src/50-session.js`, ainsi que les messages de `src/10-state.js` (`localWarning`, `localError`, migration).
- Committer avec le message `feat(i18n): sessions et messages de stockage`.

- [ ] Ajouter les fichiers de la tâche à `CLEAN_FILES`, puis `npm test`. Résultat attendu : ÉCHEC, avec la liste des textes encore en dur.
- [ ] Traduire les fichiers.
- [ ] `npm test`, puis `npm run build && npm run check && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Résultat attendu : tout passe. Les tests navigateur sont en français : ils prouvent qu'aucun texte français n'a changé.
- [ ] Committer.

### Task 7 : Réglages, sauvegarde, état, aide, installation

Suivre la procédure commune ci-dessus.

- Fichiers : `src/45-settings.js`, `src/48-status.js` et `src/70-install.js`.
- `70-install.js` lit `window.VilleI18n.t`. Sur l'événement `ville:lang`, il reconstruit le contenu de sa carte si elle est affichée, en gardant sa variante (`ios` ou `prompt`).
- Committer avec le message `feat(i18n): réglages, aide et installation`.

- [ ] Ajouter les fichiers de la tâche à `CLEAN_FILES`, puis `npm test`. Résultat attendu : ÉCHEC, avec la liste des textes encore en dur.
- [ ] Traduire les fichiers.
- [ ] `npm test`, puis `npm run build && npm run check && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Résultat attendu : tout passe. Les tests navigateur sont en français : ils prouvent qu'aucun texte français n'a changé.
- [ ] Committer.

À la fin de la tâche 7, `CLEAN_FILES` contient tous les fichiers `src/*.js` sauf `06-lang-fr.js` et `07-lang-en.js`. Le test le vérifie : `assert.deepEqual(CLEAN_FILES.sort(), srcFilesExceptDictionaries.sort())`.

### Task 8 : Réglage de la langue et changement en direct

**Fichiers :**
- Modifier :
  - `src/45-settings.js` : `openSettings` est découpé en sections ;
  - `src/41-activities.js` : `enhanceActivityForms(force)` ;
  - `src/42-draw.js` ;
  - `tests/browser.cjs` : `locale: 'fr-FR'` dans `newPage` ;
  - `tests/features-browser.cjs` : `locale: 'fr-FR'` dans son contexte.
- Créer : `tests/i18n-browser.cjs`, qui exporte `runI18n(browser, baseURL)` et est appelé depuis `tests/browser.cjs`.

**Interfaces :**
- Consomme : `setLang` et `applyStaticText` (tâche 1).
- Produit :
  - `openSettings()` assemble des sections dans l'ordre de la spécification. Les sections n'existent que si leur tâche est faite :
    1. Bien démarrer ;
    2. Langue ;
    3. Sessions ;
    4. Série ;
    5. Semaine et rappel ;
    6. Apparence ;
    7. Mode strict ;
    8. Sauvegarde ;
    9. Tout recommencer et règles.
  - Chaque section vient d'une fonction `settings<Nom>(): HTMLElement`. Les tâches 11 à 13 en ajoutent.
  - `changeLang(pref: 'auto'|'fr'|'en'): void`, qui enchaîne :
    1. mise à jour de `S.settings.lang` et `commit({ silent: true })` ;
    2. `setLang(pref)` et `applyStaticText()` ;
    3. `fillSelects()` et `enhanceActivityForms(true)` (on retire puis recrée les blocs `.activity-options`) ;
    4. retrait de `#drawFilters` (recréé au prochain rendu) ;
    5. `renderAll()`, puis réouverture des Réglages via `openSettings()`.
- Section Langue : segments `Automatique / Français / English`, avec `role="radiogroup"` comme le reste des Réglages.

- [ ] **Étape 1 : écrire `tests/i18n-browser.cjs`.** Une ville neuve dans un contexte `locale: 'en-US'`, à 390 px, doit vérifier :
  - La première page est en anglais.
    - Pour les 4 vues, la fenêtre des Réglages, la boutique et la fenêtre de lancement d'une activité, on collecte `document.body.innerText` ainsi que les valeurs `aria-label`, `placeholder` et `title`. Aucun de ces mots ne doit y figurer : `['Lancer une activité', 'Je ne sais pas quoi faire', 'Réglages', 'Construire', 'Prochain déblocage', 'Envies', 'Obligations', 'Tirage au sort', 'Sauvegarde', 'Langue', 'Personnaliser', 'Commencer']`.
    - `document.documentElement.lang === 'en'`.
    - L'en-tête affiche `My town`.
    - La première activité s'appelle `Reading`.
  - Aux largeurs 320, 390 et 768 px, avec la fenêtre des Réglages ouverte puis la boutique ouverte : `document.documentElement.scrollWidth <= innerWidth`, et `#sheetBody.scrollWidth <= #sheetBody.clientWidth + 1`.
  - Dans les Réglages, choisir `Français`.
    - Sans recharger : le bouton `Lancer une activité` est visible.
    - L'onglet Tirage affiche `Ce qui me convient maintenant`.
    - Les options d'ajout d'activité affichent `Mode, fréquence et contexte`.
  - Revenir à `English`, puis recharger : la page est toujours en anglais. Revenir à `Automatique` : la page reste en anglais, car le contexte est `en-US`.
  - Carte d'installation : simuler un `beforeinstallprompt` comme dans le test d'installation existant. Le titre de la carte est en anglais. Il passe en français après `changeLang('fr')`, sans recharger.
  - Changer de langue n'ajoute aucune erreur JavaScript.
- [ ] **Étape 2 :** `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Résultat attendu : ÉCHEC, car il n'y a pas encore de section Langue.
- [ ] **Étape 3 :** implémenter les interfaces.
- [ ] **Étape 4 :** `npm test && npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Résultat attendu : tout passe.
- [ ] **Étape 5 :** committer avec le message `feat(i18n): réglage de la langue et changement en direct`.

### Task 9 : Calcul de la série, jours de repos, pause, début de semaine

**Fichiers :**
- Modifier :
  - `src/20-rules.js` : série et semaine ;
  - `src/10-state.js` : `settings.restDays`, `weekStart`, `hideStreak`, `S.pauses`, `normalize` et `merge3` ;
  - `src/46-features.js` : `goalWeek` utilise `weekStartOf`.
- Créer : `tests/streak.test.cjs`.

**Interfaces produites (dans `20-rules.js`) :**
- `weekStartOf(day: string): string` : premier jour de la semaine de `day`, selon `S.settings.weekStart` (`'mon'` ou `'sun'`).
- `isPaused(day: string): boolean`.
  - Vrai si une pause couvre le jour : `from <= day` et, soit `to` est vide et `day <= today()`, soit `day <= to`.
- `streakDetail(endDay: string, assumeActive = false): { days: number, rests: string[] }`.
  - Applique l'algorithme de la spécification, partie B, étapes 1 à 5.
  - `assumeActive` traite `endDay` comme actif.
  - `rests` ne contient que les jours de repos situés après le plus ancien jour actif compté.
  - Limite de sécurité : 4 000 itérations.
- `streak()`, qui renvoie `streakDetail(today()).days`.
- `streakIfDoneOn(day)`, qui renvoie `streakDetail(day, true).days`.
- `restDaysLeft(): number`.
  - Vaut `S.settings.restDays` moins le nombre de jours de `streakDetail(today()).rests` situés dans la semaine d'aujourd'hui.
  - Ne descend jamais sous 0.
- `pauseActive(): { from, to } | null`.
- `startPause(): void`, qui ajoute `{ from: today(), to: '' }`.
- `endPause(): void`.
  - Si la pause a commencé aujourd'hui, elle est supprimée.
  - Sinon, `to` prend la date d'hier.
  - Ces fonctions modifient `S` sans `commit`.
- `S.pauses` : 20 éléments au plus, dates validées par `isDayKey`.
- Dans `merge3` : `if (JSON.stringify(L.pauses) !== JSON.stringify(B.pauses)) M.pauses = clone(L.pauses)`.

- [ ] **Étape 1 : écrire les tests dans `tests/streak.test.cjs`.** Machine virtuelle avec `00`, `05`, `06`, `07`, `10` et `20`. `today()` vaut `2026-10-17`, un samedi. Par défaut : `restDays` vaut 2 et `weekStart` vaut `'mon'`.
  - `repos par semaine`.
    - Jours actifs : 12, 14 et 16 octobre. Jours inactifs : 13 et 15. Le 17 est vide.
    - `streak()` vaut 3 avec `restDays` 2, 2 avec `restDays` 1 et 1 avec `restDays` 0.
    - `streakIfDoneOn('2026-10-17')` vaut 4 avec `restDays` 2.
    - `restDaysLeft()` vaut 0.
  - `frontière de semaine`.
    - `today()` vaut `2026-10-13`. Jours actifs : 8 et 12 octobre. Jours inactifs : 9, 10 et 11.
    - `streak()` vaut 1 avec `weekStart: 'mon'`, et 2 avec `weekStart: 'sun'`.
  - `pause terminée et pause en cours`.
    - `restDays` 0, jour actif le 10, pause du 11 au 16 : `streak()` vaut 1. Sans la pause : 0.
    - Pause `{ from: '2026-10-15', to: '' }` avec un jour actif le 14 : 1.
  - `pause impossible dans le passé`.
    - Après `startPause()` : `isPaused('2026-10-16')` vaut `false`, et `isPaused('2026-10-17')` vaut `true`.
    - `endPause()` le même jour : `S.pauses` vaut `[]`.
    - Pause commencée le 15 puis `endPause()` : `to` vaut `'2026-10-16'`.
  - `les réglages s'appliquent au passé`. Avec le cas « repos par semaine », passer `restDays` de 2 à 0 fait passer `streak()` de 3 à 1.
  - `objectif de la semaine selon le début de semaine`. `goalWeek('2026-10-17').start` vaut `'2026-10-12'` avec `'mon'`, et `'2026-10-11'` avec `'sun'`.
  - `ville existante après la mise à jour` (point de vigilance 1).
    - Un état v2 d'avant la mise à jour, sans `restDays`, avec des jours actifs les 15, 16 et 17 octobre : après `normalize`, `settings.restDays` vaut 2, `settings.lang` vaut `'fr'` et `S.pauses` vaut `[]`.
    - `streak()` vaut au moins l'ancienne valeur : 3.
    - Dans `tests/backup.test.cjs`, la sauvegarde d'avant la mise à jour de la tâche 1 se relit avec `pauses` égal à `[]` et `restDays` égal à 2.
- [ ] **Étape 2 :** `npm test`. Résultat attendu : ÉCHEC.
- [ ] **Étape 3 :** implémenter. Supprimer l'ancien `streakFrom`.
- [ ] **Étape 4 :** `npm test && npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Résultat attendu : tout passe.
- [ ] **Étape 5 :** committer avec le message `feat(série): jours de repos, pause et début de semaine`.

### Task 10 : Cadeau de bon retour

**Fichiers :**
- Modifier :
  - `src/00-core.js` : `const RETURN_BONUS = 20` ;
  - `src/20-rules.js` ;
  - `src/10-state.js` : `cleanActive` et `cleanHistory` gardent `returnPct`, borné entre 0 et 50 ;
  - `src/50-session.js` : `startSessionLocked` stocke `returnPct`, et `showSuccess` affiche sa ligne ;
  - `src/41-activities.js` : aperçu de gain.
- Test : `tests/streak.test.cjs`.

**Interfaces :**
- Consomme : `streakIfDoneOn` et `isPaused` (tâche 9).
- Produit :
  - `returnBonusFor(day: string): 0 | 20`.
    - Il faut que ce soit la première session réussie du jour : `!(S.stats.days[day] > 0)`.
    - Qu'il existe un jour actif avant `day` : soit `last` le plus récent.
    - Que `streakIfDoneOn(day)` vaille 1.
    - Et que les jours strictement compris entre `last` et `day`, hors pause, soient au moins 2.
  - `rewardFor(min, drawPct, day)` renvoie `{ base, drawPct, streakPct, streakDays, returnPct, total }`, avec `total = Math.round(min × RATE × (1 + (drawPct + streakPct + returnPct) / 100))`.
  - Clé `result.welcomeBack` : `Bon retour !` / `Welcome back!`. Elle sert à la ligne de résultat et à l'aperçu.

- [ ] **Étape 1 : écrire les tests.** `today()` vaut `2026-10-17`, avec `restDays` à 2 sauf mention contraire.
  - Dernier jour actif le 14, inactifs les 15 et 16 : 0, car les jours de repos couvrent l'absence.
  - Dernier jour actif le 10, inactifs du 11 au 16 : 20.
  - Même cas, mais une pause couvre du 11 au 16 : 0.
  - Ville sans aucun jour actif : 0.
  - `S.stats.days['2026-10-17'] = 5` : 0. C'est le point de vigilance 5 : une deuxième session le même jour ne reçoit rien.
  - Avec `restDays` 0, dernier jour actif le 15 et le 16 inactif : 0, car l'absence ne dure qu'un jour.
  - Avec `restDays` 0, dernier jour actif le 14 et inactifs les 15 et 16 : 20.
  - `rewardFor(10, 0, '2026-10-17').total` vaut `12e6` dans le cas qui donne 20.
  - Dans `tests/state-session.test.cjs` : une session lancée un jour de bon retour garde `active.returnPct === 20`. Une fois terminée, l'historique a `returnPct === 20` et la récompense vaut `promised`, même si elle se termine après minuit.
- [ ] **Étape 2 :** `npm test`. Résultat attendu : ÉCHEC.
- [ ] **Étape 3 :** implémenter. L'aperçu de la fenêtre de lancement et la liste des gains du résultat affichent une ligne `Bon retour !` avec `+20 %` quand `returnPct > 0`.
- [ ] **Étape 4 :** `npm test && npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Résultat attendu : tout passe.
- [ ] **Étape 5 :** committer avec le message `feat(série): cadeau de bon retour`.

### Task 11 : Interface de la série

**Fichiers :**
- Modifier :
  - `src/45-settings.js` : `settingsStreak()` ;
  - `src/40-ui.js` : pastille d'en-tête ;
  - `src/43-journal.js` : carte « Série » ou « Jours actifs cette semaine » ;
  - `src/50-session.js` : libellé de la ligne de série ;
  - `index.html` : symbole `i-pause` ;
  - les dictionnaires.
- Créer : `tests/streak-browser.cjs`, appelé depuis `tests/browser.cjs`.

**Interfaces :**
- Consomme : `streak`, `restDaysLeft`, `pauseActive`, `startPause` et `endPause` (tâche 9).
- Section Série :
  - segments `0 / 1 / 2` jours de repos, avec la note `settings.restNote` : « S'applique aussi à ta série en cours. » ;
  - bouton `Mettre ma série en pause`. En pause, le texte « En pause depuis le {date} » s'affiche, avec un bouton `Reprendre ma série` ;
  - interrupteur `Masquer la série`.
- Journal, série visible :
  - en pause : « En pause depuis le {date} » ;
  - série de N jours sans session aujourd'hui : « Une session aujourd'hui : {n} jours » (avec N + 1), suivi des repos restants s'il en reste ;
  - série en cours avec session aujourd'hui : « Bonus actuel +{pct} % » ;
  - série à 0 : « Une session aujourd'hui lance ta série. »
- Série masquée :
  - aucune pastille dans l'en-tête ;
  - la carte devient « Jours actifs cette semaine », avec le nombre de jours actifs de la semaine courante selon `weekStartOf` ;
  - la ligne de résultat dit `Bonus de régularité` / `Consistency bonus`.
- Aucun texte des deux dictionnaires ne contient « perdu », « perdue », « raté », « lost » ni « missed ». Le test unitaire de la tâche 1 le vérifie.

- [ ] **Étape 1 : écrire les tests.**
  - **Unitaire**, dans `tests/i18n.test.cjs` : aucune valeur des dictionnaires ne correspond à `/\b(perdue?s?|raté|lost|missed)\b/i`.
  - **Unitaire**, dans `tests/streak.test.cjs` : avec `hideStreak: true` et le cas « repos par semaine », `rewardFor(10, 0, '2026-10-17').streakPct` vaut toujours 30. Le bonus continue de s'appliquer.
  - **Navigateur**, dans `tests/streak-browser.cjs`, en français, avec une ville préparée qui a des jours actifs les 15 et 16 :
    - Pastille `2 j`.
    - Dans les Réglages, choisir 0 jour de repos : la pastille reste `2 j`, car hier est actif.
    - Activer la pause : la pastille montre l'icône de pause, et le Journal dit « En pause depuis le ».
    - Reprendre la série.
    - Masquer la série : `#streakChip` est caché, et la carte « Jours actifs cette semaine » est présente.
    - Recharger : l'état est conservé.
- [ ] **Étape 2 :** `npm test && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Résultat attendu : ÉCHEC.
- [ ] **Étape 3 :** implémenter.
- [ ] **Étape 4 :** tout relancer. Résultat attendu : tout passe.
- [ ] **Étape 5 :** committer avec le message `feat(série): réglages, journal et en-tête`.

### Task 12 : Son de fin et vibration

**Fichiers :**
- Modifier :
  - `src/50-session.js` : `Chime` ;
  - `src/45-settings.js` : dans `settingsSessions()`, interrupteur son, segments type et volume, interrupteur vibration ;
  - `src/10-state.js` : `soundType`, `soundVolume` et `vibrate` dans `defaultState` et `normalize` ;
  - les dictionnaires.
- Test : `tests/streak-browser.cjs`, ou un nouveau `tests/settings-browser.cjs`.

**Interfaces :**
- `SOUND_TYPES = ['chime', 'bowl', 'bells']` et `SOUND_GAIN = { soft: .5, normal: 1, loud: 1.6 }`, dans `00-core.js`.
- `Chime.play()` :
  - si `S.settings.sound`, joue `S.settings.soundType`, avec un volume multiplié par `SOUND_GAIN[soundVolume]` ;
  - si `S.settings.vibrate` et que `navigator.vibrate` existe, fait vibrer `[160, 90, 160]`, **même si le son est coupé**.
- `Chime.preview()` : joue le son choisi, sans vibrer. Elle est appelée dans le geste quand on change le type ou le volume.
- Dessin des sons (libre) :
  - `chime` : l'actuel ;
  - `bowl` : grave, autour de 220 Hz, extinction en 4 s environ ;
  - `bells` : 3 notes aiguës brèves.
- L'interrupteur Vibration n'est affiché que si `typeof navigator.vibrate === 'function'`.

- [ ] **Étape 1 : écrire le test navigateur.** Un script d'initialisation espionne `AudioContext.prototype.createOscillator` et `AudioParam.prototype.exponentialRampToValueAtTime`.
  - Choisir chaque type dans les Réglages crée au moins un oscillateur.
  - Pour un même type, le gain maximal demandé suit l'ordre `soft` < `normal` < `loud`.
  - Sans `navigator.vibrate`, l'interrupteur Vibration est absent.
  - Avec un `navigator.vibrate` simulé, il est présent. Une session gratuite de 1 min terminée avec le son coupé appelle quand même `vibrate`.
- [ ] **Étape 2 :** lancer. Résultat attendu : ÉCHEC.
- [ ] **Étape 3 :** implémenter.
- [ ] **Étape 4 :** tout relancer. Résultat attendu : tout passe.
- [ ] **Étape 5 :** committer avec le message `feat(réglages): choix du son, volume et vibration`.

### Task 13 : Rappel quotidien dans l'agenda

**Fichiers :**
- Créer : `src/49-reminder.js` et `tests/reminder.test.cjs`.
- Modifier :
  - `src/45-settings.js` : `settingsWeek()`, qui regroupe le début de semaine et le rappel. Extraire de `saveBackupFile` une fonction `shareOrDownload` ;
  - les dictionnaires.

**Interfaces produites :**
- `buildReminderIcs(time: 'HH:MM', now: Date): string`.
  - Lignes séparées par `\r\n`.
  - Contenu : `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID`, `BEGIN:VEVENT`, `UID`, `DTSTAMP`, `DTSTART`, `DURATION:PT10M`, `RRULE:FREQ=DAILY`, `SUMMARY`, `DESCRIPTION`, puis l'alerte `BEGIN:VALARM`, `ACTION:DISPLAY`, `DESCRIPTION`, `TRIGGER:PT0M`, `END:VALARM`, `END:VEVENT` et `END:VCALENDAR`.
  - `DTSTAMP` est en UTC (`…Z`).
  - `DTSTART` est en heure locale flottante (`AAAAMMJJTHHMM00`), au prochain passage de `time` à partir de `now`.
  - Les virgules, points-virgules et retours à la ligne des textes sont échappés selon la RFC 5545.
- `googleCalendarUrl(time: 'HH:MM', now: Date): string`.
  - Commence par `https://calendar.google.com/calendar/render?action=TEMPLATE`.
  - Paramètres `text`, `details`, `dates=DEBUT/FIN` (10 min, heure flottante) et `recur=RRULE:FREQ=DAILY`, avec un encodage URL.
- `shareOrDownload(text: string, filename: string, mime: string): Promise<'shared'|'downloaded'|'cancelled'>`.
  - Se comporte comme l'actuel `saveBackupFile` : partage sur iPhone, téléchargement ailleurs.
  - `saveBackupFile` l'utilise désormais.
- Textes exacts :
  - `reminder.summary` : `Ville du bien-être : un moment pour toi` / `Ville du bien-être: a moment for you` ;
  - `reminder.description` : `Ouvre la Ville du bien-être depuis l'icône de ton écran d'accueil.` / `Open Ville du bien-être from your home screen icon.`
- L'heure choisie est lue et écrite dans `localStorage['ville-bien-etre/v1:reminder-time']`, avec `18:00` par défaut.

- [ ] **Étape 1 : écrire `tests/reminder.test.cjs`.** Machine virtuelle avec `00`, `05`, `06`, `07` et `49` ; `setLang('fr')`.
  ```js
  const ics = buildReminderIcs('18:00', new Date(2026, 9, 17, 9, 30));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n')); assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  for (const line of ['RRULE:FREQ=DAILY', 'DURATION:PT10M', 'BEGIN:VALARM', 'TRIGGER:PT0M', 'DTSTART:20261017T180000']) assert.ok(ics.includes(line + '\r\n'));
  assert.ok(!/https?:/.test(ics));
  assert.ok(ics.includes('SUMMARY:Ville du bien-être : un moment pour toi'));
  assert.ok(buildReminderIcs('18:00', new Date(2026, 9, 17, 19, 0)).includes('DTSTART:20261018T180000'));
  const url = googleCalendarUrl('18:00', new Date(2026, 9, 17, 9, 30));
  assert.ok(url.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'));
  assert.ok(url.includes('dates=20261017T180000%2F20261017T181000'));
  assert.ok(url.includes('recur=RRULE%3AFREQ%3DDAILY'));
  ```
  Ajouter un test d'échappement, avec un résumé de test contenant `a,b;c` qui doit devenir `a\,b\;c`.
- [ ] **Étape 2 : ajouter au test navigateur de la tâche 12.**
  - Choisir 07:30 dans les Réglages puis toucher `Ajouter à mon agenda` déclenche un téléchargement `.ics` qui contient `DTSTART` et se termine par `T073000`.
  - Le bouton Google Agenda est un lien qui contient `recur=RRULE`.
  - Recharger : l'heure 07:30 est conservée.
  - Choisir `Dimanche` comme début de semaine : la carte d'objectif du Journal affiche une plage qui commence un dimanche. `S.settings.weekStart` vaut `'sun'`, y compris après rechargement.
- [ ] **Étape 3 :** `npm test && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Résultat attendu : ÉCHEC.
- [ ] **Étape 4 :** implémenter.
  - La section contient le champ heure (`input type="time"`), les deux boutons, et la note `reminder.note` : « L'app ne peut pas t'envoyer de notification : le rappel vit dans ton agenda. »
  - Le lien Google s'ouvre dans un nouvel onglet (`target="_blank"`, `rel="noopener"`).
- [ ] **Étape 5 :** tout relancer. Résultat attendu : tout passe.
- [ ] **Étape 6 :** committer avec le message `feat(réglages): rappel quotidien dans l'agenda`.

### Task 14 : Vérification d'ensemble et documentation

**Fichiers :**
- Modifier :
  - `README.md` et `README.fr.md` : ajouter dans le tableau des fonctions une ligne « Languages / Langues » et une ligne « Kind streak / Série bienveillante » ; compléter la section Réglages ;
  - `src/45-settings.js` : la note des règles de gain mentionne les jours de repos et le cadeau de bon retour (`settings.rules`).

- [ ] **Étape 1 :** `npm run build && npm run check && npm test && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Résultat attendu : tout passe, sans erreur JavaScript.
- [ ] **Étape 2 :** vérifier que les sections des Réglages sont présentes **dans l'ordre de la spécification**, en français puis en anglais. Le test navigateur de la tâche 8 vérifie l'ordre des titres de section.
- [ ] **Étape 3 :** faire des captures en anglais et en français, à 320 et 390 px, de la ville, des activités, du tirage, du journal, des Réglages et du résultat d'une session de bon retour. Les relire à la recherche de traductions maladroites ou de textes tronqués, et corriger.
- [ ] **Étape 4 :** committer avec le message `docs: étape 1 dans les README`, puis passer à superpowers:finishing-a-development-branch.
