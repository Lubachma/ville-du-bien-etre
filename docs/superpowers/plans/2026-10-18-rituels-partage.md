# Étape 4 — Rituels et partage : plan d'implémentation

> **Pour les agents :** sous-compétence REQUISE : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans, tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**But :** trois défis de la semaine à la mesure de chacun, un bilan au début de chaque semaine, l'humeur après une séance, la visite de la ville d'un ami par un lien (avec cartes postales), des récapitulatifs du mois et de l'année, quatre succès et trois réglages.

**Architecture :**
- **Données dans `src/00-core.js`** : défis (`CHALLENGES`), `GIFTS.challenge`, ordre figé des éléments pour les liens (`SHARE_ITEMS`), `POSTCARDS_MAX`, clé `LS_MOOD_CARD`, quatre succès.
- **Règles pures, sans DOM** :
  - `src/25-challenges.js` (nouveau) : semaine, cibles, tirage, progression, récompense, changement ;
  - `src/26-summaries.js` (nouveau) : résumé d'une période, bilan de la semaine, récapitulatifs, bilan dû, humeurs ;
  - `src/27-share.js` (nouveau) : code d'une ville, lien, lien collé, cartes postales.
- **Ville (`src/35-city.js`)** : la vue en grand montre aussi la ville d'un ami (mode visite), et sait dessiner la vignette d'une ville entière.
- **Interface** :
  - `src/54-rituals.js` (nouveau) : carte des défis, bilan, récapitulatifs et leur image, humeur, cartes du Journal ;
  - `src/55-share.js` (nouveau) : partage, visite, lien reçu à l'ouverture.

**Pile technique :** JavaScript sans framework (IIFE assemblée par `scripts/build.mjs`), canevas 2D, `node:test` dans une machine virtuelle Node, Playwright.

**Spécification :** `docs/superpowers/specs/2026-10-18-rituels-partage-design.md`. Tous ses choix sont ceux de Claude (Ludovic a demandé de faire ce qui est recommandé). La lire avant chaque tâche : ses règles ne sont pas toutes répétées ici.

**Branche :** `etape-4-rituels-partage`, qui porte déjà la spécification.

## Contraintes globales

- **Fichiers générés** : ne jamais modifier `app.js` ni `sw.js` à la main. Après tout changement de `src/`, `index.html` ou `styles.css`, lancer `npm run build` et committer `app.js` et `sw.js` régénérés.
- **Vérifications de chaque tâche** :
  - `npm run check` ;
  - `npm test` ;
  - `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`, dont la dernière ligne doit être `chromium: browser checks passed; no application JavaScript errors.`
- **Commits** : `git commit -F -` avec le message indiqué, suivi d'une ligne vide puis de ces deux lignes :
  - `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  - `Claude-Session: https://claude.ai/code/session_01Y9ewUx6m7dMVmKYTE9Txwf`
- **Nouveaux fichiers de `src/`** : chacun est ajouté à `CLEAN_FILES` dans `tests/i18n.test.cjs`, dans la tâche qui le crée. Il ne contient aucun texte en dur : tout passe par `t()`.
- **Dictionnaires** :
  - chaque nouvelle clé existe en français et en anglais ;
  - les espaces insécables s'écrivent ` ` ;
  - apostrophe droite `'` en français, tutoiement, aucun accord de genre envers la personne (« tu te sentais bien », jamais « tu étais content·e ») ;
  - aucun mot de reproche ou de perte : « raté », « échoué », « perdu », « manqué », « dommage », « failed », « missed », « lost ».
- **Reproductible** :
  - tout tirage passe par `chance(clé)` (`24-ambient.js`), dont la graine est `S.createdAt` ;
  - jamais de `Math.random` dans `25-challenges.js` ni dans `26-summaries.js`. Seul `ensureShareId` (`27-share.js`) tire au hasard, avec `crypto.getRandomValues`.
- **Semaine** : `weekStartOf(day)` (réglage « début de semaine »). **Jour** : `today()`.
- **Vie privée** :
  - le code d'une ville ne contient que : nom personnalisé, taille, éléments (type, place, étape, niveau), fleurs du Grand Arbre, identifiant de partage ;
  - jamais de pièces, de minutes, de journal, d'humeur, de succès, d'activités ni de réglages ;
  - l'image d'un récapitulatif ne contient jamais l'humeur.
- **Fenêtres qui s'ouvrent seules** (bilan, récapitulatif) :
  - au plus une par ouverture de l'app, une seule fois par période ;
  - jamais pendant une séance ni quand une autre fenêtre est ouverte, jamais hors de l'onglet Ville ;
  - jamais avec le réglage `rituals` coupé ;
  - un lien de ville reçu passe avant.
- **Humeur** : facultative, jamais récompensée (ni pièce ni succès), jamais partagée.
- **Économie** :
  - le seul nouveau gain est `GIFTS.challenge` (5 M), au plus 3 fois par période de 7 jours, un cadeau par clé `chal:<semaine>:<défi>` ;
  - un cadeau en double venu de deux onglets est remboursé par `merge3`, comme ceux des étapes précédentes.
- **Mise en page** :
  - textes contenus à 320, 390 et 768 px, en français comme en anglais ;
  - le workflow de publication tourne sous Linux, où les mots s'affichent un peu plus larges : pas de mot long dans un `.seg` de trois colonnes ou plus.
- **Modules optionnels** : `tests/state-session.test.cjs` et `tests/backup.test.cjs` chargent `10-state.js`, `45-settings.js` et `50-session.js` sans les nouveaux modules. Tout appel vers `25-challenges.js`, `26-summaries.js`, `27-share.js`, `54-rituals.js` ou `55-share.js` depuis ces fichiers, ou depuis `52-carnet.js`, garde le motif `if (typeof f === 'function')`.
- **Débogage** : `window.__ville` (mode `#debug`, ou `window.__VILLE_DEBUG__` avant le chargement) gagne :
  - `rituals: { challenges: () => weekChallenges(), pending: () => pendingRitual() }` ;
  - `share: { encode: () => encodeCity(), decode: decodeCity }`.

## Points de vigilance

Cinq situations que la spécification implique sans les nommer. Chacune a son test dans la tâche indiquée.

1. **Début de semaine changé en cours de semaine** (lundi ↔ dimanche) : ni second bilan, ni défis payés deux fois (Tasks 3 et 5).
2. **Lien de ville ouvert pendant une séance** : la séance continue ; la visite s'ouvre juste après le bilan de la séance (Task 11).
3. **Lien de sa propre ville** : la vue dit « Ta ville, telle que tes amis la voient », sans carte postale de soi-même (Task 13).
4. **Activité libre terminée pendant que l'app était fermée** : l'humeur demandée au retour s'enregistre sur cette séance-là (Task 6).
5. **Ville d'avant l'étape 4, ou sauvegarde restaurée** : aucun défi payé pour une semaine passée, aucun récapitulatif pour un mois sans activité (Tasks 3 et 5).

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/00-core.js` | `CHALLENGES`, `GIFTS.challenge`, `SHARE_ITEMS`, `POSTCARDS_MAX`, `LS_MOOD_CARD`, quatre succès |
| `src/10-state.js` | réglages `rituals`, `challenges`, `mood` ; `challenges`, `postcards`, `rituals`, `shareId`, `history[].mood` : valeurs par défaut, validation, fusion ; clés `chal:` |
| `src/24-ambient.js` | `giftAmount` des défis ; `freeCells(city)` |
| `src/25-challenges.js` (nouveau) | semaine, cibles, tirage, progression, récompense, changement |
| `src/26-summaries.js` (nouveau) | résumé d'une période, bilan, récapitulatifs, bilan dû, humeurs |
| `src/27-share.js` (nouveau) | code d'une ville, lien, lien collé, identifiant, cartes postales |
| `src/23-achievements.js` | conditions `challenges`, `fullWeek`, `postcards` |
| `src/33-paint-wonders.js` | fleurs du Grand Arbre d'une ville visitée |
| `src/35-city.js` | mode visite de la vue en grand, vignette d'une ville entière |
| `src/40-ui.js`, `src/43-journal.js` | cartes du Journal, bouton Partager, ouverture des rituels |
| `src/45-settings.js` | section « Rituels » |
| `src/50-session.js` | humeur et défis sur l'écran de fin |
| `src/52-carnet.js` | défis dans les célébrations ; « Villes amies » dans l'onglet Visites |
| `src/53-visits.js` | cadeau du visiteur avec les défis |
| `src/54-rituals.js` (nouveau) | interface des défis, bilans, récapitulatifs, image, humeur |
| `src/55-share.js` (nouveau) | partage, visite, lien à l'ouverture |
| `src/60-boot.js` | rituels et lien de ville au démarrage, débogage |
| `index.html`, `styles.css` | bouton Partager, visages, bandeau et barre de visite, cartes |
| `src/06-lang-fr.js`, `src/07-lang-en.js` | textes |
| `tests/rituals-state.test.cjs`, `tests/challenges.test.cjs`, `tests/summaries.test.cjs`, `tests/share.test.cjs` (nouveaux) | tests unitaires |
| `tests/rituals-browser.cjs` (nouveau), `tests/browser.cjs` | parcours navigateur, branchés après `minors-browser.cjs` |
| `tests/board.cjs`, `README.md`, `README.fr.md` | planche et documentation |

---

### Task 1 : Données des rituels et du partage

**Files:**
- Modify: `src/00-core.js`, `src/10-state.js`, `src/24-ambient.js`
- Create: `tests/rituals-state.test.cjs`

**Interfaces:**
- Produces (`00-core.js`) :
  - `GIFTS.challenge = 5e6` ;
  - `CHALLENGE_FAMILIES = ['practice', 'moment', 'discovery']` ;
  - `CHALLENGES`, dans cet ordre, `{ id, family }` :
    - practice : `domains`, `comeback`, `long`, `twoAreas` ;
    - moment : `morning`, `evening`, `weekend` ;
    - discovery : `draw`, `routine`, `visitors`, `build`, `focus` ;
  - `SHARE_ITEMS` : les 50 clés de `ITEMS` dans leur ordre actuel, figées. On ajoute toujours à la fin, on ne retire ni ne déplace jamais ;
  - `POSTCARDS_MAX = 50` ;
  - `LS_MOOD_CARD = 'ville-bien-etre/v1:mood-card'`.
- Produces (`10-state.js`) :
  - valeurs par défaut :
    - réglages `rituals`, `challenges` et `mood` à `true` ;
    - `challenges: { week: '', swapped: -1 }` ;
    - `postcards: {}` ;
    - `rituals: { week: '', month: '', year: '' }` ;
    - `shareId: ''` ;
  - validation :
    - **humeur** `history[].mood` : un entier de 1 à 5, sinon absente ;
    - **cartes postales** : clé `/^[0-9a-f]{12}$/`, `{ code: /^[A-Za-z0-9_-]{4,4000}$/, name: str 40, size ∈ SIZES, count: 0–121, at: date }` ; seules les 50 plus récentes restent ;
    - **marqueurs des rituels** : `week` est une date ou `''`, `month` est `AAAA-MM` ou `''`, `year` est `AAAA` ou `''` ;
    - **défis** : `challenges.week` est une date ou `''`, `challenges.swapped` va de -1 à 2 ;
    - **identifiant** : `shareId` vérifie `/^[0-9a-f]{12}$/`, sinon `''` ;
  - `GIFT_KEY` accepte `chal:AAAA-MM-JJ:<id de CHALLENGES>` ;
  - `merge3` :
    - cartes postales réunies, la plus récente (`at`) gagne ;
    - `rituals` : le maximum de chaque champ ;
    - `challenges` : la semaine la plus récente, puis le plus grand `swapped` ;
    - `shareId` : celui de R, sinon celui de L ;
    - humeur : celle de L quand L l'a notée ou changée par rapport à B, même pour une séance que B connaît déjà.
- Produces (`24-ambient.js`) : `giftAmount('chal:…') === GIFTS.challenge`.

- [ ] **Step 1 : Écrire les tests** dans `tests/rituals-state.test.cjs` :

```js
const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js'];
const EXPOSE = ['defaultState', 'normalize', 'merge3', 'clone', 'giftAmount', 'SHARE_ITEMS', 'ITEMS', 'CHALLENGES'];
const T0 = Date.parse('2026-10-18T12:00:00Z');
const app = () => loadApp(FILES, { expose: EXPOSE });

test('rituels : réglages et données par défaut', () => {
  const s = app().defaultState();
  assert.deepEqual([s.settings.rituals, s.settings.challenges, s.settings.mood], [true, true, true]);
  assert.deepEqual(plain([s.challenges, s.postcards, s.rituals, s.shareId]), [{ week: '', swapped: -1 }, {}, { week: '', month: '', year: '' }, '']);
});

test('rituels : douze défis en trois familles, leur montant, un ordre figé des éléments', () => {
  const a = app();
  assert.deepEqual(plain(a.CHALLENGES.map(c => c.family + ':' + c.id)), ['practice:domains', 'practice:comeback', 'practice:long', 'practice:twoAreas',
    'moment:morning', 'moment:evening', 'moment:weekend', 'discovery:draw', 'discovery:routine', 'discovery:visitors', 'discovery:build', 'discovery:focus']);
  assert.equal(a.giftAmount('chal:2026-10-19:domains'), 5e6);
  assert.deepEqual(plain([...a.SHARE_ITEMS].sort()), plain(Object.keys(a.ITEMS).sort()));
});

test('rituels : validation des défis, humeurs, cartes postales, marqueurs et identifiant', () => {
  const a = app(), code = 'AQcAAA';
  const cards = Object.fromEntries(Array.from({ length: 52 }, (_, i) => [i.toString(16).padStart(12, '0'), { code, name: 'Ville ' + i, size: 7, count: 3, at: T0 + i }]));
  cards.zz = { code, name: 'x', size: 7, count: 1, at: T0 };
  cards['0000000000ff'] = { code: 'pas un code !', name: 'y', size: 7, count: 1, at: T0 + 99 };
  const s = a.normalize({ ...a.defaultState(), settings: { rituals: false, challenges: 'non', mood: false },
    challenges: { week: '2026-10-19', swapped: 7 }, rituals: { week: '2026-10-12', month: '2026-9', year: '2026' }, shareId: 'ABC',
    gifts: { 'chal:2026-10-19:domains': T0, 'chal:2026-10-19:licorne': T0, 'chal:hier:long': T0 }, postcards: cards,
    history: [{ id: 'a', name: 'x', cat: 'esprit', min: 10, ok: true, at: T0, mood: 4 }, { id: 'b', name: 'x', cat: 'esprit', min: 10, ok: true, at: T0 - 1, mood: 9 }] });
  assert.deepEqual([s.settings.rituals, s.settings.challenges, s.settings.mood], [false, true, false]);
  assert.deepEqual(plain([s.challenges, s.rituals, s.shareId]), [{ week: '2026-10-19', swapped: -1 }, { week: '2026-10-12', month: '', year: '2026' }, '']);
  assert.deepEqual(plain(Object.keys(s.gifts)), ['chal:2026-10-19:domains']);
  assert.deepEqual(plain(s.history.map(e => e.mood)), [4, undefined]);
  assert.equal(Object.keys(s.postcards).length, 50);
  for (const gone of ['000000000000', '000000000001', 'zz', '0000000000ff']) assert.ok(!(gone in s.postcards), gone);
});

test('rituels : fusion de deux onglets', () => {
  const a = app();
  const B = a.normalize({ ...a.defaultState(), coins: 10e6, history: [{ id: 'h1', name: 'x', cat: 'calme', min: 10, ok: true, at: T0 }] });
  const L = a.clone(B), R = a.clone(B);
  L.history[0].mood = 5;
  L.postcards['00000000000a'] = { code: 'AQcAAA', name: 'Léa', size: 7, count: 2, at: T0 };
  R.postcards['00000000000a'] = { code: 'AQkAAA', name: 'Léa', size: 9, count: 5, at: T0 + 5000 };
  R.postcards['00000000000b'] = { code: 'AQcAAA', name: 'Tom', size: 7, count: 1, at: T0 };
  L.rituals = { week: '2026-10-12', month: '2026-09', year: '' }; R.rituals = { week: '2026-10-05', month: '2026-10', year: '2025' };
  L.gifts['chal:2026-10-19:long'] = T0; L.coins += 5e6;
  R.gifts['chal:2026-10-19:long'] = T0 + 1; R.coins += 5e6;
  const M = a.merge3(B, L, R);
  assert.equal(M.history[0].mood, 5);
  assert.deepEqual(plain(Object.keys(M.postcards).sort()), ['00000000000a', '00000000000b']);
  assert.equal(M.postcards['00000000000a'].size, 9);
  assert.deepEqual(plain(M.rituals), { week: '2026-10-12', month: '2026-10', year: '2025' });
  assert.equal(M.coins, 10e6 + 5e6);
});
```

- [ ] **Step 2 : Le voir échouer** — Run: `node --test tests/rituals-state.test.cjs`. Expected: FAIL (`CHALLENGES is not defined`).
- [ ] **Step 3 : Implémenter** les données, la validation et la fusion décrites dans Interfaces. Les nouveaux champs suivent les motifs de `visits`, `gifts` et `seasons` (étape 3).
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; ligne finale habituelle du navigateur.
- [ ] **Step 5 : Commit** — `feat(données): défis, humeurs, cartes postales et marqueurs des rituels`.

### Task 2 : Défis — tirage, cibles et progression

**Files:**
- Create: `src/25-challenges.js`, `tests/challenges.test.cjs`
- Modify: `tests/i18n.test.cjs` (`CLEAN_FILES`)

**Interfaces:**
- Consumes : `CHALLENGES`, `CHALLENGE_FAMILIES` (Task 1) ; `chance`, `shiftDay`, `weekStartOf`, `hourIn`, `dayOf`, `keyToUTC`.
- Produces (`25-challenges.js`) :
  - `challengeWeek(day = today()): string`, qui vaut `weekStartOf(day)` ;
  - `challengeTargets(week): { domains: number, comeback: string, long: number }`, calculé sur les 28 jours avant `week` :
    - **domains** : nombre moyen de domaines différents par semaine sur ces 4 semaines (semaines vides comprises), arrondi, plus 1, borné entre 2 et 5 ;
    - **comeback** : un domaine sans minute dans `stats.dailyCats` les 7 jours avant `week`, tiré par `chance(week + ':comeback')`. S'il n'y en a aucun, le domaine le moins pratiqué ces 7 jours, en cas d'égalité le premier de `CAT_ORDER` ;
    - **long** : médiane des durées des séances réussies de ces 28 jours × 1,5, arrondie à 5, bornée entre 10 et 60. Sans séance, 15 ;
  - `weekChallenges(week = challengeWeek()): Array<{ id, family, n?, cat?, m? }>` :
    - une liste par famille, dans l'ordre de `CHALLENGE_FAMILIES` ;
    - dans chaque famille, les défis rangés par `chance(week + ':chal:' + id)` croissant, et le premier possible est retenu ;
    - `routine` n'est possible que si `S.routines.length > 0` ;
    - si `S.challenges.week === week`, le défi d'indice `S.challenges.swapped` est le deuxième possible de sa famille ;
    - `domains` reçoit `n`, `comeback` reçoit `cat`, `long` reçoit `m`, venus de `challengeTargets(week)` ;
  - `challengeProgress(ch, week = challengeWeek()): { have, need, done }`.
    - **Les séances comptées** sont les séances réussies de `S.history` dont le jour `e.day` est dans `[week, week + 6]`.
    - **domains** : `have` = domaines différents de ces séances, `need` = `n` ;
    - **comeback** : une séance de `cat`, donc `have` = 0 ou 1 et `need` = 1 ;
    - **long** : `have` = durée de la plus longue séance, `need` = `m` ;
    - **twoAreas** : `have` = nombre maximal de domaines différents un même jour, borné à 2, et `need` = 2 ;
    - **heure et jour** : `morning` (`hourIn(e.at) < 9`), `evening` (`hourIn(e.at) >= 20`), `weekend` (samedi ou dimanche), avec `need` = 1 ;
    - **source et mode** : `draw` (`source` vaut `wishes` ou `chores`) et `focus` (`mode === 'focus'`), avec `need` = 1 ;
    - **routine** : `S.routineRun.status === 'done'` et `finishedAt` cette semaine, `need` = 1 ;
    - **visitors** : clés `visit:<jour>` de `S.gifts` cette semaine, `need` = 2 ;
    - **build** : éléments de `S.city.tiles` posés cette semaine, avec `at > S.createdAt + 60000` pour écarter ceux du départ, `need` = 1 ;
    - **done** vaut `have >= need` ;
  - `challengeKey(ch, week): string`, qui vaut `'chal:' + week + ':' + ch.id`.
- *Précision* : « deux visiteurs salués » se mesure aux cadeaux de visiteur reçus, car le jeu ne garde pas la date de chaque rencontre. Il est toujours possible : couper « Ville animée » arrête l'animation, pas les visiteurs.

- [ ] **Step 1 : Écrire les tests** dans `tests/challenges.test.cjs` :

```js
const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js', '25-challenges.js'];
const EXPOSE = ['CHALLENGES', 'challengeWeek', 'challengeTargets', 'weekChallenges', 'challengeProgress', 'challengeKey', 'shiftDay'];
// Mercredi 21 octobre 2026 : la semaine commence le lundi 19.
function app(now = '2026-10-21T12:00:00Z') {
  const a = loadApp(FILES, { expose: EXPOSE, now });
  a.state.clock.tz = 'Europe/Zurich'; a.state.clock.maxSeen = 0; a.state.createdAt = Date.parse('2026-01-15T09:00:00Z');
  for (const tile of a.state.city.tiles) tile.at = a.state.createdAt;
  return a;
}
const entry = (day, extra = {}) => ({ id: 'h' + day + (extra.cat || 'esprit') + (extra.min || 10) + (extra.ok === false ? 'x' : ''), name: 'x', cat: 'esprit', min: 10, ok: true, reward: 1,
  at: Date.parse(day + 'T10:00:00Z'), day, source: 'direct', mode: 'focus', ...extra });
// Une semaine (lundi 19 – dimanche 25 octobre) où chaque défi est relevé ; une séance de la semaine d'avant et une échouée ne comptent pas.
function fill(a) {
  const s = a.state;
  s.history.push(entry('2026-10-19', { at: Date.parse('2026-10-19T06:00:00Z') }), entry('2026-10-20', { cat: 'corps', min: 60, at: Date.parse('2026-10-20T19:30:00Z') }),
    entry('2026-10-24', { cat: 'calme', source: 'wishes', mode: 'free' }), entry('2026-10-24', { cat: 'foyer' }),
    entry('2026-10-18', { cat: 'crea' }), entry('2026-10-22', { cat: 'crea', ok: false }));
  s.routines = [{ id: 'r', name: 'R', steps: [] }];
  s.routineRun = { id: 'run', status: 'done', finishedAt: Date.parse('2026-10-22T10:00:00Z') };
  s.gifts['visit:2026-10-20'] = Date.parse('2026-10-20T08:00:00Z'); s.gifts['visit:2026-10-23'] = Date.parse('2026-10-23T08:00:00Z');
  s.city.tiles.push({ id: 'n', item: 'banc', x: 0, y: 0, at: Date.parse('2026-10-21T09:00:00Z'), paid: 2e6 });
}
const family = (a, id) => a.CHALLENGES.find(c => c.id === id).family;

test('défis : trois par semaine, un par famille, les mêmes pour une même semaine', () => {
  const a = app(), list = a.weekChallenges('2026-10-19');
  assert.deepEqual(plain(list.map(c => family(a, c.id))), ['practice', 'moment', 'discovery']);
  assert.deepEqual(plain(a.weekChallenges('2026-10-19')), plain(list));
  const weeks = Array.from({ length: 10 }, (_, i) => a.weekChallenges(a.shiftDay('2026-10-19', 7 * i)).map(c => c.id).join());
  assert.ok(new Set(weeks).size > 1);
});

test('défis : une routine seulement s’il en existe une', () => {
  const a = app(), weeks = Array.from({ length: 30 }, (_, i) => a.shiftDay('2026-01-05', 7 * i));
  assert.ok(weeks.every(w => !a.weekChallenges(w).some(c => c.id === 'routine')));
  a.state.routines = [{ id: 'r', name: 'R', steps: [] }];
  assert.ok(weeks.some(w => a.weekChallenges(w).some(c => c.id === 'routine')));
});

test('défis : cibles de départ, puis à la mesure des quatre semaines passées', () => {
  const a = app();
  const start = plain(a.challengeTargets('2026-10-19'));
  assert.deepEqual([start.domains, start.long], [2, 15]);
  for (let w = 0; w < 4; w++) ['esprit', 'corps', 'calme'].forEach((cat, i) => {
    const day = a.shiftDay('2026-09-21', 7 * w + i);
    a.state.history.push(entry(day, { cat, min: 20 }));
    a.state.stats.dailyCats[day] = { [cat]: 20 };
  });
  const t = plain(a.challengeTargets('2026-10-19'));
  assert.deepEqual([t.domains, t.long], [4, 30]);
  assert.ok(['foyer', 'crea'].includes(t.comeback), t.comeback);
});

test('défis : la progression de chacun dans la semaine, sans la semaine d’avant ni les séances échouées', () => {
  const a = app(), week = '2026-10-19';
  const all = [{ id: 'domains', n: 4 }, { id: 'comeback', cat: 'calme' }, { id: 'long', m: 60 }, { id: 'twoAreas' }, { id: 'morning' }, { id: 'evening' },
    { id: 'weekend' }, { id: 'draw' }, { id: 'routine' }, { id: 'visitors' }, { id: 'build' }, { id: 'focus' }];
  assert.deepEqual(plain(all.filter(c => a.challengeProgress(c, week).done).map(c => c.id)), []);
  fill(a);
  assert.deepEqual(plain(all.filter(c => !a.challengeProgress(c, week).done).map(c => c.id)), []);
  assert.deepEqual(plain(a.challengeProgress({ id: 'domains', n: 5 }, week)), { have: 4, need: 5, done: false });
  assert.equal(a.challengeProgress({ id: 'comeback', cat: 'crea' }, week).done, false);
  assert.deepEqual(plain(a.challengeProgress({ id: 'long', m: 65 }, week)), { have: 60, need: 65, done: false });
});

test('défis : le défi changé est le suivant de sa famille', () => {
  const a = app(), before = plain(a.weekChallenges('2026-10-19'));
  a.state.challenges = { week: '2026-10-19', swapped: 1 };
  const after = plain(a.weekChallenges('2026-10-19'));
  assert.notEqual(after[1].id, before[1].id);
  assert.equal(family(a, after[1].id), 'moment');
  assert.deepEqual([after[0], after[2]], [before[0], before[2]]);
});
```

- [ ] **Step 2 : Le voir échouer** — Run: `node --test tests/challenges.test.cjs`. Expected: FAIL (`weekChallenges is not defined`).
- [ ] **Step 3 : Implémenter** `src/25-challenges.js` selon Interfaces ; ajouter `25-challenges.js` à `CLEAN_FILES`.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(défis): tirage reproductible, cibles à la mesure de chacun et progression`.

### Task 3 : Défis — récompense, changement, carte du Journal et messages

**Files:**
- Modify: `src/25-challenges.js`, `src/52-carnet.js`, `src/50-session.js`, `src/53-visits.js`, `src/43-journal.js`, `src/60-boot.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `styles.css`, `tests/challenges.test.cjs`, `tests/browser.cjs`
- Create: `src/54-rituals.js`, `tests/rituals-browser.cjs`

**Interfaces:**
- Consumes : Task 2.
- Produces (`25-challenges.js`) :
  - `claimChallenges(day = today()): Array<{ id, family, n?, cat?, m?, key }>`, c'est-à-dire chaque défi payé avec sa clé :
    - rien si `S.settings.challenges === false` ;
    - sinon, pour chaque défi de `weekChallenges(challengeWeek(day))`, relevé, dont la clé n'est pas dans `S.gifts` : `S.gifts[key] = nowTs()` et `S.coins += GIFTS.challenge` (borné par `COINS_MAX`) ;
    - **garde** : un défi n'est pas payé si une clé `chal:<w>:<même id>` existe avec `w` à 6 jours ou moins de la semaine ;
    - **garde** : aucun défi n'est payé quand 3 clés `chal:` ont déjà une date de semaine à 6 jours ou moins (Point de vigilance 1) ;
    - aucun enregistrement ni affichage : l'appelant s'en charge ;
  - `swapChallenge(index, day = today()): boolean` :
    - une fois par semaine : `S.challenges = { week, swapped: index }` ;
    - `false` si un défi a déjà été changé cette semaine, si l'indice est déjà relevé, ou s'il n'y a pas de deuxième défi possible dans la famille.
- Produces (interface) :
  - **`noticeProgress()`** (`52-carnet.js`) :
    - elle renvoie `{ sets, achievements, challenges }` ;
    - elle appelle `claimChallenges()` avant `checkAchievements()`, pour que « Semaine complète » (Task 14) suive dans le même message ;
  - **`celebrate(fresh, lead)`** ajoute pour chaque défi la ligne `chal.done` : « Défi relevé : {text} · +{coins} » ;
  - **`completeSession()`** appelle `claimChallenges(day)` avant `checkAchievements()` et passe la liste à `showSuccess(a, total, fresh, earned, challenges)`, qui l'affiche comme les succès ;
  - **le cadeau du visiteur** (`53-visits.js`) relève le progrès avec `progressNow()` avant son enregistrement et l'annonce par `cheer(progress, thanks)` ;
  - **la carte du Journal** (`54-rituals.js`) :
    - `challengeText(ch): string`, qui vaut `t('chal.' + ch.id, { n, cat: catName(cat), m })` ;
    - `renderChallengesCard()` affiche la carte `#challengesCard`, placée après `#goalsCard` ;
    - la carte a le titre `chal.title` et une note `chal.note` ;
    - chaque défi occupe une ligne : son texte, sa progression (`have / need`, ou `m` min pour `long`) et sa récompense (`chal.reward`) ou `chal.relieved` ;
    - un bouton `chal.swap` par défi non relevé, tant qu'aucun défi n'a été changé cette semaine ;
    - la carte est absente avec le réglage `challenges` coupé ;
  - `renderJournal()` appelle `renderChallengesCard()` ;
  - débogage : `__ville.rituals.challenges`.
- **Textes** :
  - `chal.<id>` pour les 12 défis, aux formulations de la spécification (pluriels avec `{ one, other }` pour `domains`) ;
  - `chal.title`, `chal.note` (« Trois défis à ta mesure, renouvelés chaque semaine. ») ;
  - `chal.reward` (« +{coins} »), `chal.relieved` (« Relevé »), `chal.swap` (« Changer ») ;
  - `chal.done` (« Défi relevé : {text} · +{coins} »).

- [ ] **Step 1 : Écrire les tests.**
  - **Unitaires** (`challenges.test.cjs`, ajouter `'claimChallenges'` et `'swapChallenge'` à `EXPOSE`) :

```js
test('défis : 5 M par défi relevé, une seule fois, et rien de plus en changeant le début de semaine', () => {
  const a = app(); fill(a);
  const coins = a.state.coins, got = plain(a.claimChallenges('2026-10-21'));
  assert.equal(got.length, 3);
  assert.ok(got.every(c => c.key.startsWith('chal:2026-10-19:')));
  assert.equal(a.state.coins, coins + 15e6);
  assert.deepEqual(plain(a.claimChallenges('2026-10-21')), []);
  a.state.settings.weekStart = 'sun';
  assert.deepEqual(plain(a.claimChallenges('2026-10-21')), []);
  assert.equal(a.state.coins, coins + 15e6);
});
test('défis : coupés dans les réglages, ni défi ni pièce', () => {
  const a = app(); fill(a); a.state.settings.challenges = false;
  assert.deepEqual(plain(a.claimChallenges('2026-10-21')), []);
});
test('défis : rien pour une semaine passée', () => {
  const a = app('2026-10-28T12:00:00Z'); fill(a);
  assert.deepEqual(plain(a.claimChallenges('2026-10-28')), []);
});
test('défis : un seul changement par semaine, dans la même famille', () => {
  const a = app(), before = plain(a.weekChallenges('2026-10-19'));
  assert.equal(a.swapChallenge(1, '2026-10-21'), true);
  const after = plain(a.weekChallenges('2026-10-19'));
  assert.notEqual(after[1].id, before[1].id);
  assert.equal(a.swapChallenge(0, '2026-10-21'), false);
});
```

  - **Navigateur** (`tests/rituals-browser.cjs`, nouveau module `runRituals(browser, baseURL)` branché dans `tests/browser.cjs` après `runMinors`). Ses villes s'amorcent avec `cityAt` (`ambient-browser.cjs`) et `town` (`content-browser.cjs`).
    1. **Défis relevés à l'ouverture** :
       - horloge fixée au mercredi `2026-10-21T10:00:00Z` ;
       - la ville amorcée contient les données de `fill` ;
       - au chargement, le message contient « Défi relevé » et les pièces augmentent de 15 M ;
       - au rechargement, ni nouveau message ni nouvelle pièce ;
       - le Journal montre 3 lignes « Relevé ».
    2. **Changer un défi** :
       - dans une ville neuve, la carte montre 3 défis et 3 boutons « Changer » ;
       - en toucher un change ce défi et fait disparaître les boutons ;
       - au rechargement, le défi changé est toujours là.
    3. **Défi relevé sur l'écran de fin** :
       - ville neuve, `page.clock.install` au mercredi `2026-10-21T10:00:00Z`, activités d'une minute dans chaque domaine ;
       - lire le défi de la famille practice avec `__ville.rituals.challenges()` ;
       - faire les séances qui le relèvent : `comeback` → une séance de `cat` ; `domains` ou `twoAreas` → deux séances de domaines différents ; `long` → une activité de 15 min ;
       - la dernière séance montre « Défi relevé » sur l'écran de fin.
- [ ] **Step 2 : Le voir échouer** — Run: `npm test` puis `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Expected: FAIL (`claimChallenges is not defined`, puis `#challengesCard` introuvable).
- [ ] **Step 3 : Implémenter** selon Interfaces ; ajouter `54-rituals.js` à `CLEAN_FILES`.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` avec « Défis ».
- [ ] **Step 5 : Commit** — `feat(défis): récompense, changement et carte du Journal`.

### Task 4 : Résumé d'une période et bilan de la semaine (règles)

**Files:**
- Create: `src/26-summaries.js`, `tests/summaries.test.cjs`
- Modify: `tests/i18n.test.cjs` (`CLEAN_FILES`)

**Interfaces:**
- Consumes : `goalProgress(state, day)` (`46-features.js`), `CAT_ORDER`, `GIFT_KEY` (Task 1).
- Produces (`26-summaries.js`) :
  - `periodSummary(from, to): Summary`, avec `Summary` = `{ from, to, minutes, activeDays, sessions, cats, favorite, longest, bestDay, built, sets, visitors, festivals, challenges, achievements, moods }`. Les champs :
    - **`minutes`** : somme de `(S.stats.effort || S.stats).days` sur la période ;
    - **`activeDays`** : jours de la période avec au moins 1 minute ;
    - **`sessions`** : séances réussies dont `day` est dans la période ;
    - **`cats`** : domaines avec des minutes dans `stats.dailyCats`, dans l'ordre de `CAT_ORDER` ;
    - **`favorite`** : le domaine qui a le plus de minutes, ou `null` ;
    - **`longest`** : `{ name, min }` de la plus longue séance réussie, ou `null` ;
    - **`bestDay`** : `{ day, minutes }` du jour qui a le plus de minutes, ou `null` ;
    - **`built`** : éléments posés dans la période (`at > S.createdAt + 60000`) ;
    - **`sets`** : ensembles découverts ;
    - **`visitors`** : visiteurs rencontrés pour la première fois (`first`) ;
    - **`festivals`** : clés `fest:` reçues ;
    - **`challenges`** : clés `chal:` reçues ;
    - **`achievements`** : succès gagnés ;
    - **`moods`** : `{ good, total }` des humeurs des séances de la période, `good` comptant les humeurs ≥ 4 ;
  - `weekReview(week): Summary & { goal, gain, headline }` :
    - **`goal`** : `{ minutes, days, done }`, venu de `goalProgress(S, week)` ;
    - **`gain`** : minutes de la semaine moins celles de la semaine d'avant, ou 0 si ce n'est pas positif ;
    - **`headline`** : `'great'` si l'objectif est atteint, `'full'` si `activeDays >= 3`, `'gentle'` si `minutes > 0`, `'back'` sinon ;
  - `monthKey(day): 'AAAA-MM'` ;
  - `periodRange(kind, key): { from, to }`, pour `kind` valant `'month'` ou `'year'` ;
  - `recapSummary(kind, key): Summary & { kind, key }`. Pour une année, `sessions` vaut `null`, car le journal ne garde que les 150 dernières séances.
- *Précision* : les étapes de merveilles ne figurent pas dans les récapitulatifs, car le jeu ne date pas les étapes. Les succès de merveille, eux, y sont.

- [ ] **Step 1 : Écrire les tests** dans `tests/summaries.test.cjs` :

```js
const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js',
  '25-challenges.js', '26-summaries.js', '46-features.js'];
const EXPOSE = ['periodSummary', 'weekReview', 'recapSummary', 'periodRange', 'monthKey', 'shiftDay'];
function app(now = '2026-10-27T12:00:00Z') {
  const a = loadApp(FILES, { expose: EXPOSE, now });
  a.state.clock.tz = 'Europe/Zurich'; a.state.clock.maxSeen = 0; a.state.createdAt = Date.parse('2026-05-04T09:00:00Z');
  for (const tile of a.state.city.tiles) tile.at = a.state.createdAt;
  return a;
}
// La semaine du lundi 19 octobre 2026, et 20 min la semaine d'avant.
function week(a) {
  const s = a.state, add = (day, cat, min, extra = {}) => {
    s.history.push({ id: day + cat + min, name: 'Séance ' + cat, cat, min, ok: true, reward: min * 1e6, at: Date.parse(day + 'T10:00:00Z'), day, source: 'direct', mode: 'focus', ...extra });
    for (const stats of [s.stats, s.stats.effort]) stats.days[day] = (stats.days[day] || 0) + min;
    const dc = s.stats.dailyCats[day] || (s.stats.dailyCats[day] = {}); dc[cat] = (dc[cat] || 0) + min;
  };
  add('2026-10-13', 'esprit', 20);
  add('2026-10-19', 'calme', 30, { mood: 5 }); add('2026-10-21', 'corps', 45, { mood: 4 }); add('2026-10-21', 'calme', 10, { mood: 2 }); add('2026-10-24', 'esprit', 15);
  s.city.tiles.push({ id: 'n1', item: 'banc', x: 0, y: 0, at: Date.parse('2026-10-22T09:00:00Z'), paid: 2e6 });
  s.visits.chat = { first: Date.parse('2026-10-20T08:00:00Z'), count: 1, last: '2026-10-20' };
  s.gifts['chal:2026-10-19:long'] = Date.parse('2026-10-21T10:00:00Z');
  s.achievements['premier-pas'] = Date.parse('2026-10-19T10:00:00Z');
  s.goals = { minutes: 90, days: 3, cat: 'all', building: '' };
}

test('bilan de la semaine : chiffres, beaux moments et phrase d’accueil', () => {
  const a = app(); week(a);
  const r = plain(a.weekReview('2026-10-19'));
  assert.deepEqual([r.from, r.to, r.minutes, r.activeDays, r.sessions], ['2026-10-19', '2026-10-25', 100, 3, 4]);
  assert.deepEqual([r.cats, r.favorite, r.longest], [['esprit', 'corps', 'calme'], 'corps', { name: 'Séance corps', min: 45 }]);
  assert.deepEqual([r.built, r.visitors, r.challenges, r.achievements], [1, 1, 1, 1]);
  assert.deepEqual(r.moods, { good: 2, total: 3 });
  assert.deepEqual([r.goal.done, r.gain, r.headline], [true, 80, 'great']);
  a.state.goals.minutes = 200;
  assert.equal(a.weekReview('2026-10-19').headline, 'full');
  assert.equal(a.weekReview('2026-10-12').headline, 'gentle');
});

test('bilan : une semaine vide dit « Bon retour », et le progrès n’est jamais négatif', () => {
  const a = app(); week(a);
  const empty = plain(a.weekReview('2026-10-26'));
  assert.deepEqual([empty.minutes, empty.headline, empty.gain], [0, 'back', 0]);
});

test('récapitulatifs : bornes du mois et de l’année, chiffres du mois, pas de séances pour l’année', () => {
  const a = app(); week(a);
  assert.deepEqual(plain(a.periodRange('month', '2024-02')), { from: '2024-02-01', to: '2024-02-29' });
  assert.deepEqual(plain(a.periodRange('year', '2026')), { from: '2026-01-01', to: '2026-12-31' });
  assert.equal(a.monthKey('2026-10-27'), '2026-10');
  const m = plain(a.recapSummary('month', '2026-10'));
  assert.deepEqual([m.minutes, m.activeDays, m.sessions, m.favorite, m.bestDay], [120, 4, 5, 'corps', { day: '2026-10-21', minutes: 55 }]);
  assert.equal(a.recapSummary('year', '2026').sessions, null);
});
```

- [ ] **Step 2 : Le voir échouer** — Run: `node --test tests/summaries.test.cjs`. Expected: FAIL (`weekReview is not defined`).
- [ ] **Step 3 : Implémenter** `src/26-summaries.js` selon Interfaces ; ajouter `26-summaries.js` à `CLEAN_FILES`.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(bilans): résumé d'une période et bilan de la semaine`.

### Task 5 : Bilan de la semaine — fenêtre, une seule fois, carte du Journal

**Files:**
- Modify: `src/26-summaries.js`, `src/54-rituals.js`, `src/43-journal.js`, `src/40-ui.js`, `src/60-boot.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `styles.css`, `tests/summaries.test.cjs`, `tests/rituals-browser.cjs`

**Interfaces:**
- Consumes : Task 4 ; `weekChallenges`, `challengeText` (Tasks 2–3) ; `openGoals` (`46-features.js`).
- Produces (`26-summaries.js`) :
  - `pendingRitual(day = today()): { kind: 'year'|'month'|'week', key } | null`, qui vaut `null` si `S.settings.rituals === false`. Sinon, dans cet ordre :
    - **year** : en janvier, si `S.rituals.year` est avant l'année passée, que la ville existait avant cette année et que l'année passée a des minutes ;
    - **month** : si `S.rituals.month` est avant le mois passé, que la ville existait avant ce mois et que le mois passé a des minutes ;
    - **week** : la semaine passée (`key` = son premier jour), si la ville existait avant la semaine en cours. Le marqueur `S.rituals.week` doit être vide ou antérieur à `shiftDay(key, -6)`, ce qui garde le Point de vigilance 1 ;
  - `markRitual(kind, key)` :
    - `S.rituals[kind] = key` ;
    - pour une année, `S.rituals.month` devient aussi `key + '-12'`.
- Produces (`54-rituals.js`) :
  - `maybeOpenRitual(): boolean` :
    - seulement sur l'onglet Ville, page visible, sans fenêtre ni séance (`!S.active && !run`) ;
    - elle appelle `markRitual`, puis `commit({ silent: true })`, puis ouvre la fenêtre due ;
  - `openWeekReview(week)` : la fenêtre « Ta semaine », dans l'ordre de la spécification (partie B) :
    - les chiffres sont absents si `minutes === 0` ;
    - le progrès est affiché seulement si `gain > 0` ;
    - « Cette semaine » montre `weekChallenges()` (sauf défis coupés), un bouton `review.goal` qui ouvre `openGoals()`, et `review.go` qui ferme ;
  - `renderRitualCards()` : en haut du Journal (`#ritualCards`, après `#kpis`), la carte « Ta semaine dernière » toute la semaine, avec un bouton `review.again`. Les cartes du mois et de l'année viennent à la Task 8.
- **Appels** :
  - débogage : `__ville.rituals.pending` ;
  - au démarrage, après `flushCarnetNote()` ;
  - à `refreshDay()`, quand le jour change ;
  - `renderJournal()` appelle `renderRitualCards()`.
- **Textes `review.*`** :
  - `review.title` (« Ta semaine »), `review.range` ;
  - les quatre phrases d'accueil `review.great`, `review.full`, `review.gentle`, `review.back` ;
  - les chiffres et beaux moments : `review.minutes`, `review.days`, `review.sessions`, `review.longest`, `review.favorite`, `review.built`, `review.visitors`, `review.festivals`, `review.challenges`, `review.mood`, `review.goalDone`, `review.goalSoFar`, `review.gain` ;
  - la suite : `review.next`, `review.goal`, `review.go`, `review.card`, `review.again`.

- [ ] **Step 1 : Écrire les tests.**
  - **Unitaires** (`summaries.test.cjs`, ajouter `'pendingRitual'` et `'markRitual'` à `EXPOSE`) :

```js
test('bilan dû : une fois par semaine, jamais pour une ville de la semaine, ni deux fois en changeant le début de semaine', () => {
  const a = app('2026-10-27T12:00:00Z'); week(a);
  assert.deepEqual(plain(a.pendingRitual('2026-10-27')), { kind: 'week', key: '2026-10-19' });
  a.markRitual('week', '2026-10-19');
  assert.equal(a.pendingRitual('2026-10-27'), null);
  a.state.settings.weekStart = 'sun';
  assert.equal(a.pendingRitual('2026-10-27'), null);
  const b = app('2026-10-27T12:00:00Z'); b.state.createdAt = Date.parse('2026-10-26T08:00:00Z');
  assert.equal(b.pendingRitual('2026-10-27'), null);
  const c = app('2026-10-27T12:00:00Z'); week(c); c.state.settings.rituals = false;
  assert.equal(c.pendingRitual('2026-10-27'), null);
});
test('bilan dû : le mois avant la semaine, l’année en janvier, rien pour un mois sans activité', () => {
  const a = app('2026-11-02T12:00:00Z'); week(a);
  assert.deepEqual(plain(a.pendingRitual('2026-11-02')), { kind: 'month', key: '2026-10' });
  a.markRitual('month', '2026-10');
  assert.deepEqual(plain(a.pendingRitual('2026-11-02')), { kind: 'week', key: '2026-10-26' });
  const j = app('2027-01-04T12:00:00Z'); week(j);
  assert.deepEqual(plain(j.pendingRitual('2027-01-04')), { kind: 'year', key: '2026' });
  j.markRitual('year', '2026');
  assert.equal(j.state.rituals.month, '2026-12');
  const e = app('2026-12-01T12:00:00Z'); week(e); e.markRitual('week', '2026-11-23');
  assert.equal(e.pendingRitual('2026-12-01'), null);
});
```

  - **Navigateur** (`rituals-browser.cjs`) :
    - horloge fixée au mardi `2026-10-27T09:00:00Z` ;
    - ville créée le 4 mai avec des séances le 21 octobre ;
    - au chargement, la fenêtre « Ta semaine » s'ouvre ;
    - au rechargement, aucune fenêtre ;
    - le Journal montre « Ta semaine dernière », et son bouton rouvre la fenêtre ;
    - rien ne déborde à 320 px, en français puis en anglais.
- [ ] **Step 2 : Le voir échouer** — Run: `npm test`. Expected: FAIL (`pendingRitual is not defined`).
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` avec « Bilan de la semaine ».
- [ ] **Step 5 : Commit** — `feat(bilans): bilan de la semaine, une fois au début de la semaine`.

### Task 6 : Humeur après une séance

**Files:**
- Modify: `src/26-summaries.js`, `src/54-rituals.js`, `src/50-session.js`, `index.html` (cinq visages `i-mood-1` à `i-mood-5`), `styles.css`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/summaries.test.cjs`, `tests/rituals-browser.cjs`

**Interfaces:**
- Produces :
  - `setMood(entryId, level): boolean` (`26-summaries.js`) :
    - `level` va de 1 à 5, ou vaut 0 pour retirer ;
    - `false` pour une séance inconnue ou une valeur hors bornes ;
    - n'enregistre pas ;
  - `moodPicker(entryId): HTMLElement` (`54-rituals.js`) :
    - un groupe de boutons radio (`role="radiogroup"`, nom `mood.question`) ;
    - cinq visages, chacun avec le nom `mood.<n>` ;
    - un bouton `mood.skip` qui retire le groupe ;
    - chaque choix appelle `setMood` puis `commit({ silent: true })` ;
  - `showSuccess` ajoute `moodPicker(a.id)` sous les lignes de gain, sauf si `S.settings.mood === false`.
- **Textes** :
  - `mood.question` (« Comment te sens-tu ? ») ;
  - `mood.1` à `mood.5` (« Pas bien du tout », « Pas trop », « Comme ci, comme ça », « Bien », « Très bien ») ;
  - `mood.skip` (« Passer »).

- [ ] **Step 1 : Écrire les tests.**
  - **Unitaires** (ajouter `'setMood'` à `EXPOSE`) :

```js
test('humeur : notée sur une séance, changée, retirée ; rien pour une séance inconnue ou hors bornes', () => {
  const a = app(); week(a);
  const id = a.state.history[1].id;
  assert.equal(a.setMood(id, 3), true);
  assert.equal(a.state.history[1].mood, 3);
  assert.equal(a.setMood(id, 0), true);
  assert.equal('mood' in a.state.history[1], false);
  assert.deepEqual([a.setMood('inconnue', 3), a.setMood(id, 9)], [false, false]);
});
```

  - **Navigateur** :
    1. horloge simulée (`page.clock.install`) et une activité Concentration d'une minute ; à la fin, « Comment te sens-tu ? » est là ; toucher « Bien » le coche, puis `history[0].mood === 4`, même après rechargement ;
    2. avec le réglage `mood` coupé (ville amorcée), l'écran de fin ne la demande pas ;
    3. *Point de vigilance 4* : une activité libre d'une minute, l'app passée en arrière-plan (`visibilitychange`) pendant deux minutes ; au retour, l'humeur est demandée, « Très bien » s'enregistre sur cette séance (`mood === 5` pour son `id`).
- [ ] **Step 2 : Le voir échouer** — Run: `npm test`. Expected: FAIL (`setMood is not defined`).
- [ ] **Step 3 : Implémenter** selon Interfaces. Les visages sont des symboles SVG au trait, comme les autres icônes.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` avec « Humeur ».
- [ ] **Step 5 : Commit** — `feat(humeur): un geste après une séance`.

### Task 7 : Ce qui te fait du bien, et les moments difficiles

**Files:**
- Modify: `src/26-summaries.js`, `src/54-rituals.js`, `src/43-journal.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `styles.css`, `tests/summaries.test.cjs`, `tests/rituals-browser.cjs`

**Interfaces:**
- Produces (`26-summaries.js`) :
  - `moodInsights(): { total, rows: Array<{ cat, good, total }>, top } | null` :
    - `null` sous 5 humeurs notées ;
    - `rows` : les domaines avec au moins 2 humeurs, dans l'ordre de `CAT_ORDER` ;
    - `top` : la ligne qui a la plus forte part de bonnes humeurs, la première en cas d'égalité ;
  - `moodDifficult(day = today()): boolean` : vrai si au moins 3 des 5 dernières humeurs notées dans les 14 jours valent 2 ou moins.
- Produces (`54-rituals.js`) :
  - `renderMoodCards()`, placée après `#meters` ;
  - **la carte `#moodCard`** « Ce qui te fait du bien » : une phrase `mood.top` et une barre par ligne ;
  - **la carte `#moodSupport`** : le texte `mood.support` de la spécification et un bouton `mood.thanks` ;
    - toucher le bouton écrit `Date.now()` dans `LS_MOOD_CARD` ;
    - la carte reste cachée 7 jours.
- **Textes** :
  - `mood.cardTitle`, `mood.top` (« Après {cat}, tu te sentais bien {good} fois sur {total} »), `mood.row` ;
  - `mood.support`, `mood.thanks`.

- [ ] **Step 1 : Écrire les tests** (ajouter `'moodInsights'` et `'moodDifficult'` à `EXPOSE`) :

```js
const moodAt = (a, id, cat, mood, at) => a.state.history.push({ id, name: 'x', cat, min: 10, ok: true, reward: 1, at, day: '2026-10-20', source: 'direct', mode: 'focus', mood });
test('humeur : ce qui te fait du bien, dès 5 humeurs notées', () => {
  const a = app(), at = Date.parse('2026-10-20T10:00:00Z');
  [['calme', 5], ['calme', 4], ['corps', 1], ['calme', 2]].forEach(([cat, mood], i) => moodAt(a, 'm' + i, cat, mood, at - i));
  assert.equal(a.moodInsights(), null);
  moodAt(a, 'm4', 'calme', 4, at - 4);
  assert.deepEqual(plain(a.moodInsights()), { total: 5, rows: [{ cat: 'calme', good: 3, total: 4 }], top: { cat: 'calme', good: 3, total: 4 } });
});
test('humeur : les moments difficiles, sur les 5 dernières humeurs des 14 derniers jours', () => {
  const a = app('2026-10-21T12:00:00Z'), now = Date.parse('2026-10-21T10:00:00Z');
  [2, 1, 4].forEach((m, i) => moodAt(a, 'd' + i, 'calme', m, now - (i + 1) * 864e5));
  assert.equal(a.moodDifficult('2026-10-21'), false);
  moodAt(a, 'd3', 'calme', 2, now - 4 * 864e5);
  assert.equal(a.moodDifficult('2026-10-21'), true);
  const b = app('2026-10-21T12:00:00Z');
  [2, 1, 2].forEach((m, i) => moodAt(b, 'o' + i, 'calme', m, now - (20 + i) * 864e5));
  assert.equal(b.moodDifficult('2026-10-21'), false);
});
```

  - **Navigateur** :
    - une ville amorcée avec 5 humeurs montre « Ce qui te fait du bien » et la phrase du domaine en tête ;
    - une ville aux humeurs difficiles montre la carte douce ;
    - « Merci » la cache, et elle reste cachée au rechargement.
- [ ] **Step 2 : Le voir échouer** — Run: `npm test`. Expected: FAIL (`moodInsights is not defined`).
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` avec « Ce qui te fait du bien ».
- [ ] **Step 5 : Commit** — `feat(humeur): ce qui te fait du bien et les moments difficiles`.

### Task 8 : Récapitulatifs du mois et de l'année

**Files:**
- Modify: `src/54-rituals.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `styles.css`, `tests/rituals-browser.cjs`

**Interfaces:**
- Consumes : `recapSummary`, `periodRange`, `pendingRitual`, `markRitual` (Tasks 4–5).
- Produces (`54-rituals.js`) :
  - `openRecap(kind, key)` ouvre la fenêtre du récapitulatif :
    - **titre** : le mois et l'année avec majuscule (« Octobre 2026 »), ou l'année (« 2026 ») ;
    - **phrase** sous le titre : `recap.leadMonth` (« Ton mois en un coup d'œil ») ou `recap.leadYear` ;
    - **contenu** : celui de la spécification (partie E), avec les domaines en barres ;
    - **bouton** `recap.share`, qui appelle `shareRecapImage` à la Task 9 ;
  - `maybeOpenRitual()` ouvre aussi `openRecap` pour `month` et `year` ;
  - `renderRitualCards()` ajoute les cartes « Ton mois » (jusqu'à la fin du mois suivant) et « Ton année » (en janvier), quand ces périodes ont eu des minutes.
- *Précision* : le titre nomme le mois sans « de » ni « d' », pour éviter l'élision (« d'octobre », « de mars »).
- **Textes** : `recap.leadMonth`, `recap.leadYear`, `recap.bestDay`, `recap.cats`, `recap.city`, `recap.share`, `recap.cardMonth`, `recap.cardYear`, `recap.open`. Les chiffres et beaux moments réutilisent `review.*`.

- [ ] **Step 1 : Parcours navigateur** (`rituals-browser.cjs`) :
  1. au lundi `2026-11-02T09:00:00Z`, dans une ville active en octobre, « Octobre 2026 » s'ouvre ;
  2. au rechargement, c'est « Ta semaine » qui s'ouvre : une seule fenêtre par ouverture ;
  3. le Journal montre la carte du mois ;
  4. au lundi `2027-01-04T09:00:00Z`, « 2026 » s'ouvre ;
  5. rien ne déborde à 320 px, en français puis en anglais.
- [ ] **Step 2 : Le voir échouer** — Run: `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Expected: FAIL (fenêtre « Octobre 2026 » introuvable).
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` avec « Récapitulatif ».
- [ ] **Step 5 : Commit** — `feat(bilans): récapitulatifs du mois et de l'année`.

### Task 9 : Image du récapitulatif

**Files:**
- Modify: `src/54-rituals.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/rituals-browser.cjs`

**Interfaces:**
- Consumes : `City.snapshot()`, `cityName()`, le ciel (`cssVar`), comme `exportCityImage` (`46-features.js`).
- Produces :
  - `recapCanvas(summary): Promise<HTMLCanvasElement>` dessine une image de 1080 × 1350 px :
    - **contenu** : le titre, `cityName()`, trois chiffres (temps de pratique, jours actifs, éléments posés), le domaine favori et l'image de la ville ;
    - **polices** : Young Serif et Figtree, chargées avant le dessin ;
  - `shareRecapImage(summary): Promise<'shared'|'downloaded'|'failed'>` :
    - `navigator.share({ files })` si `navigator.canShare({ files })` l'accepte ;
    - sinon un téléchargement `mon-mois-AAAA-MM.png` ou `mon-annee-AAAA.png` ;
    - messages `png.downloaded` ou `png.failed`.
- **Textes** : `recap.imageMinutes`, `recap.imageDays`, `recap.imageBuilt`, `recap.imageFavorite`, `recap.imageFooter`.

- [ ] **Step 1 : Parcours navigateur** :
  - **espions** posés avant le chargement :
    - `navigator.canShare = () => true` et `navigator.share = async d => { window.__shared = d; }` ;
    - `CanvasRenderingContext2D.prototype.fillText` enveloppé pour noter les textes écrits ;
  - **partage** :
    - dans le récapitulatif d'octobre, « Partager l'image » partage un seul fichier `image/png` ;
    - `createImageBitmap` mesure l'image à 1080 × 1350 ;
    - les textes écrits contiennent le temps de pratique et aucun texte d'humeur (`/sentais/`) ;
  - **sans partage de fichiers** (`canShare` faux), un lien `download` est cliqué.
- [ ] **Step 2 : Le voir échouer** — Run: `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Expected: FAIL (aucun fichier partagé).
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` avec « Image du récapitulatif ».
- [ ] **Step 5 : Commit** — `feat(bilans): l'image du mois ou de l'année, à partager`.

### Task 10 : Lien de ville et cartes postales (règles)

**Files:**
- Create: `src/27-share.js`, `tests/share.test.cjs`
- Modify: `tests/i18n.test.cjs` (`CLEAN_FILES`)

**Interfaces:**
- Consumes : `SHARE_ITEMS`, `POSTCARDS_MAX` (Task 1) ; `buildingLevel` (`46-features.js`), `weekCats` (`20-rules.js`).
- Nom par défaut : la règle de `cityName()` (`05-i18n.js`). Un nom égal à `city.defaultName` dans l'une des langues compte comme vide.
- Produces (`27-share.js`) :
  - `ensureShareId(): string` : il crée `S.shareId` une fois, avec 12 chiffres hexadécimaux venus de `crypto.getRandomValues` ;
  - `encodeCity(state = S): string`. Le code en base64url sans `=` suit ce format d'octets :
    - `[1]` (version) ;
    - `[taille]` ;
    - `[L]` octets du nom en UTF-8, au plus 60 et coupés sur un caractère entier, puis le nom ;
    - les 6 octets de `shareId` ;
    - `[T]`, le nombre d'éléments ;
    - puis T × 3 octets : indice dans `SHARE_ITEMS`, `(x << 4) | y`, `(niveau << 3) | étape` ;
    - enfin 1 octet de fleurs, un bit par domaine de `CAT_ORDER` ;
    - le nom est vide quand la ville porte son nom par défaut ;
  - `decodeCity(code): { id, name, size, tiles: Array<{ id, item, x, y, stage?, level, flowers? }>, flowers } | null` :
    - **refus** (renvoie `null`, ne lève jamais d'erreur) : texte de plus de 4 000 caractères, base64url invalide, version inconnue, taille hors de `SIZES`, octets manquants ;
    - **éléments écartés** sans refuser le code : inconnus, hors du terrain, ou en double à la même place ;
    - **nom** nettoyé : caractères de contrôle retirés, au plus 40 caractères ;
    - **Grand Arbre** : ses cases reçoivent `flowers` ;
  - `shareLink(code): string`, qui vaut `location.origin + location.pathname + '#ville=' + code` ;
  - `codeFromText(text): string | null` : le code d'un lien `#ville=…` trouvé dans le texte, ou un code collé seul ;
  - `keepPostcard(snapshot, code): boolean` :
    - `S.postcards[snapshot.id] = { code, name, size, count, at: nowTs() }` ;
    - `false` pour sa propre ville (`snapshot.id === S.shareId`) ;
    - au-delà de `POSTCARDS_MAX`, la plus ancienne part.

- [ ] **Step 1 : Écrire les tests** dans `tests/share.test.cjs`. Le chargement passe `globals: { btoa, atob, crypto: require('node:crypto').webcrypto, location: { origin: 'https://lubachma.github.io', pathname: '/ville-du-bien-etre/' } }`.
  - **aller-retour fidèle** :
    - nom « Ville d'Élodie 🌸 », taille 9, les 50 éléments ;
    - une merveille à l'étape 2, des niveaux 3 (minutes hautes), des fleurs ;
    - `decodeCity(encodeCity())` rend les mêmes nom, taille, éléments (type, place, étape, niveau) et fleurs, avec `id === S.shareId` ;
  - **ville 11 × 11 pleine** :
    - `shareLink(encodeCity())` fait moins de 1 000 caractères ;
    - le résultat décodé n'a que les clés `id`, `name`, `size`, `tiles` et `flowers` ;
    - la longueur en octets vaut `3 + L + 6 + 1 + 3 × 121 + 1` ;
  - **un nom par défaut s'encode vide** ;
  - **lien abîmé refusé sans erreur** : `null` pour `''`, `'xx'`, `'!!!!'`, `'A'.repeat(5000)`, un code de version 2 et un code tronqué ;
  - **un nom avec des balises** (`<b>Ville</b>`) reste du texte ;
  - **lien collé** :
    - le code se retrouve dans « Regarde ma ville https://…/#ville=CODE ! » ou collé seul ;
    - `codeFromText('bonjour') === null` ;
  - **cartes postales** :
    - une par ville : une même ville revisitée met sa carte à jour ;
    - au plus 50 : avec 51 villes, la plus ancienne part ;
    - pas de carte de sa propre ville ;
  - **identifiant** : créé une seule fois, de forme `/^[0-9a-f]{12}$/`.
- [ ] **Step 2 : Le voir échouer** — Run: `node --test tests/share.test.cjs`. Expected: FAIL (`encodeCity is not defined`).
- [ ] **Step 3 : Implémenter** `src/27-share.js` selon Interfaces ; ajouter `27-share.js` à `CLEAN_FILES`.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(partage): le code d'une ville, son lien et les cartes postales`.

### Task 11 : Visite — la vue en grand montre la ville d'un ami

**Files:**
- Modify: `src/35-city.js`, `src/24-ambient.js`, `src/33-paint-wonders.js`, `src/50-session.js`, `src/60-boot.js`, `index.html`, `styles.css`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/rituals-browser.cjs`
- Create: `src/55-share.js`

**Interfaces:**
- Consumes : `decodeCity`, `keepPostcard`, `shareLink` (Task 10) ; la vue en grand (étape 3).
- Produces (`35-city.js`) :
  - `City.openVisit(snapshot, { own = false } = {})` ouvre la vue en grand en mode visite :
    - **ville dessinée** : `snapshot` remplace `S.city` (taille, éléments, pavage avec `pavedTileIds(snapshot)`) ;
    - **niveaux** : ceux du code (`drawGrowth(…, level)`) ;
    - **Grand Arbre** : `DRAW.grandarbre` utilise `tile.flowers || weekCats()` ;
    - **ambiance** : celle de `ambientAt()`, sans visiteur ni anniversaire, et sans habitants ;
    - **fêtes** : les décors des cases utilisent `freeCells(snapshot)` ;
  - **en-tête `#cityVisitHead`** :
    - « {name} » et `visit.cityMeta`, ou `visit.friendCity` si le nom est vide ;
    - `visit.ownCity` (« Ta ville, telle que tes amis la voient ») si `own` ;
  - **barre `#cityVisitBar`** : `#visitKeep` (`visit.keep`, caché si `own`) et `#visitShare` (`visit.shareBack`) ;
  - fermer la vue rend sa propre ville ;
  - `City.bigState()` ajoute `visit: boolean`.
- Produces (`24-ambient.js`) : `freeCells(city = S.city)`.
- Produces (`55-share.js`) :
  - `openVisitFromCode(code): boolean` :
    - code illisible → message `visit.badLink`, `false` ;
    - séance en cours (`S.active || run`) → le code est gardé, message `visit.afterSession` ; la visite s'ouvre quand la séance se ferme (`closeSession`) (Point de vigilance 2) ;
    - sinon `City.openVisit` (avec `own` pour sa propre ville) ;
  - `handleVisitHash()` :
    - elle lit `#ville=…` ;
    - elle retire le fragment par `history.replaceState` ;
    - elle appelle `openVisitFromCode` ;
    - elle est appelée au démarrage, avant `maybeOpenRitual` (qui ne s'ouvre pas alors), et à `hashchange` ;
  - `#visitKeep` appelle `keepPostcard` puis `commit()`, et affiche `visit.kept` (« Carte postale gardée dans ton carnet ») ; le bouton devient « Gardée » ;
  - `#visitShare` est en place, branché à la Task 12 ;
  - débogage : `__ville.share`.
- **Textes** : `visit.cityMeta` (« {n} éléments · terrain {size}×{size} »), `visit.friendCity`, `visit.ownCity`, `visit.keep`, `visit.kept`, `visit.keptShort`, `visit.shareBack`, `visit.badLink` (« Ce lien de ville n'est pas lisible »), `visit.afterSession` (« Ta séance d'abord : la ville amie s'ouvrira juste après »).

- [ ] **Step 1 : Parcours navigateur** (`rituals-browser.cjs`) :
  - **préparer le lien** :
    - un premier contexte amorce une ville amie (nom « Léa », six éléments dont un Grand Arbre) ;
    - il lit `__ville.share.encode()` ;
  - **ouvrir la visite** :
    - dans un second contexte, avec `window.__VILLE_DEBUG__ = true` posé avant le chargement, `page.goto(baseURL + '#ville=' + code)` ;
    - `#cityBig` s'ouvre avec « Léa » dans l'en-tête, et `location.hash` est vide ;
    - `__ville.state.city` est identique à l'amorce ;
    - `+` zoome, `×` ferme, et `bigState().visit` vaut `false` ;
  - **lien abîmé** : `#ville=abc` → le message `visit.badLink` s'affiche, et aucune vue ;
  - **pendant une séance** (Point de vigilance 2) :
    - une séance d'une minute en cours (`page.clock.install`), puis `location.hash = '#ville=' + code` → message `visit.afterSession`, aucune vue ;
    - la séance finie et son bilan fermé, la ville de « Léa » s'ouvre.
- [ ] **Step 2 : Le voir échouer** — Run: `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Expected: FAIL (`#cityVisitHead` introuvable).
- [ ] **Step 3 : Implémenter** selon Interfaces ; ajouter `55-share.js` à `CLEAN_FILES`.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` avec « Visite d'une ville amie ».
- [ ] **Step 5 : Commit** — `feat(partage): visiter la ville d'un ami par un lien`.

### Task 12 : Partager ma ville, et visiter une ville amie en collant un lien

**Files:**
- Modify: `src/55-share.js`, `index.html` (bouton `#shareCity` dans `.city-tools`, icône `i-share`), `src/60-boot.js`, `styles.css`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/rituals-browser.cjs`

**Interfaces:**
- Produces (`55-share.js`) : `openShareSheet()` ouvre la fenêtre `share.title`, avec dans l'ordre :
  - **la phrase de vie privée** `share.privacy` de la spécification ;
  - **`share.unnamed`**, si le nom est celui par défaut, avec un bouton `city.personalize` ;
  - **le lien** dans un champ en lecture seule `#shareLinkField` ;
  - **les boutons** :
    - `share.send`, qui appelle `navigator.share({ title, text: share.text, url })` quand il existe ;
    - `share.copy`, qui passe par `navigator.clipboard.writeText` et affiche `share.copied`. Si la copie échoue, le champ est sélectionné et `share.copyFallback` s'affiche ;
  - **« Visiter une ville amie »** : un titre `share.visitTitle`, un champ `#visitLinkField` et un bouton `share.visit` qui appelle `openVisitFromCode(codeFromText(valeur))`.
- `#shareCity` (`share.button`, « Partager ma ville ») et `#visitShare` (Task 11) ouvrent cette fenêtre. `#shareCity` est masqué pendant une pose, comme `#cityExpand`.
- **Textes** : `share.button`, `share.title`, `share.privacy`, `share.unnamed`, `share.text` (« Viens voir ma ville du bien-être ! »), `share.send`, `share.copy`, `share.copied`, `share.copyFallback`, `share.visitTitle`, `share.visitHint`, `share.visit`.

- [ ] **Step 1 : Parcours navigateur** :
  1. **avec `navigator.share` remplacé par un espion**, « Partager ma ville » puis « Envoyer » partage une adresse qui contient `#ville=` ;
  2. **sans `navigator.share`**, « Copier le lien » écrit le même lien dans le presse-papiers remplacé, et le message s'affiche ;
  3. **visiter en collant** : coller le lien de « Léa » dans « Visiter une ville amie », puis « Visiter », ouvre sa ville ;
  4. **à 320 px**, en français et en anglais, la fenêtre ne déborde pas.
- [ ] **Step 2 : Le voir échouer** — Run: `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Expected: FAIL (`#shareCity` introuvable).
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` avec « Partager ma ville ».
- [ ] **Step 5 : Commit** — `feat(partage): partager sa ville et visiter en collant un lien`.

### Task 13 : Cartes postales dans le carnet

**Files:**
- Modify: `src/35-city.js`, `src/52-carnet.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `styles.css`, `tests/rituals-browser.cjs`

**Interfaces:**
- Produces :
  - `City.townThumb(cv, snapshot, size)` dessine toute une ville, petite, sans ambiance :
    - le socle et le sol de l'île, le pavage, puis les éléments en profondeur ;
    - le dessin du socle et du sol est mis en commun avec `draw()` ;
  - `carnetVisits()` ajoute, après les fêtes, la partie `carnet.friendsHead` (« Villes amies ») :
    - une ligne par carte postale, de la plus récente à la plus ancienne ;
    - chaque ligne a une vignette (`townThumb`, 48 px), le nom (ou `visit.friendCity`) et `carnet.visitedOn` ;
    - toucher la ligne ferme le carnet et appelle `City.openVisit(decodeCity(code))` ;
    - sans carte postale, une note `carnet.friendsEmpty`.
- **Textes** : `carnet.friendsHead`, `carnet.visitedOn` (« Visitée le {date} »), `carnet.friendsEmpty` (« Les villes de tes amis apparaîtront ici. »).

- [ ] **Step 1 : Parcours navigateur** :
  1. **garder la carte** :
     - dans la visite de « Léa », « Garder la carte postale » affiche le message ;
     - le carnet, onglet Visites, montre « Léa » avec une vignette (un seul canevas) ;
     - toucher la ligne rouvre sa ville ;
  2. **revisiter une ville** avec un code plus récent garde une seule carte, mise à jour ;
  3. *Point de vigilance 3* : ouvrir le lien de sa propre ville montre « Ta ville, telle que tes amis la voient », sans bouton « Garder la carte postale » ;
  4. **à 320 px**, l'onglet Visites ne déborde pas.
- [ ] **Step 2 : Le voir échouer** — Run: `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Expected: FAIL (« Villes amies » introuvable).
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` avec « Cartes postales ».
- [ ] **Step 5 : Commit** — `feat(carnet): les cartes postales des villes amies`.

### Task 14 : Succès et réglages des rituels

**Files:**
- Modify: `src/00-core.js`, `src/23-achievements.js`, `src/45-settings.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/achievements.test.cjs`, `tests/collection-state.test.cjs`, `tests/carnet.test.cjs`, `tests/content-browser.cjs`, `tests/rituals-browser.cjs`

**Interfaces:**
- Produces (`00-core.js`) : quatre succès de la famille `rituals`, sans cadeau :
  - `{ id: 'premier-defi', kind: 'challenges', n: 1 }` ;
  - `{ id: 'defis-en-serie', kind: 'challenges', n: 12 }` ;
  - `{ id: 'semaine-complete', kind: 'fullWeek', n: 3 }` ;
  - `{ id: 'carte-postale', kind: 'postcards', n: 1 }`.
- Produces (`23-achievements.js`) :
  - conditions :
    - `challenges` : nombre de clés `chal:` ;
    - `fullWeek` : une même date de semaine porte 3 clés `chal:` ;
    - `postcards` : nombre de cartes postales ;
  - progression en `n` pour `challenges` et `postcards` ;
  - date de rattrapage 0.
- Produces (`45-settings.js`) : `settingsRituals()`, après `settingsWeek()`.
  - Trois interrupteurs `role="switch"` : `settings.rituals` (note `settings.ritualsNote`), `settings.challenges` et `settings.mood`.
  - Chaque changement appelle `commit()`.
- **Textes** : `ach.<id>.name` et `ach.<id>.desc` des quatre succès (noms de la spécification), `settings.ritualsTitle`, `settings.rituals`, `settings.ritualsNote`, `settings.challenges`, `settings.mood`.

- [ ] **Step 1 : Écrire les tests.**
  - **seuils** : le test des seuils (`achievements.test.cjs`) reçoit quatre cas.
    - `premier-defi` : 0 ou 1 clé `chal:` ;
    - `defis-en-serie` : 11 ou 12 clés sur des semaines différentes ;
    - `semaine-complete` : 2 ou 3 clés de la même semaine ;
    - `carte-postale` : 0 ou 1 carte ;
  - **compte** : 42 succès dans `collection-state.test.cjs`, `carnet.test.cjs` et `content-browser.cjs` ;
  - **navigateur** :
    - les trois interrupteurs de « Rituels » gardent leur valeur au rechargement ;
    - « Défis de la semaine » coupé retire `#challengesCard` du Journal.
- [ ] **Step 2 : Le voir échouer** — Run: `npm test`. Expected: FAIL (`ACHIEVEMENTS.length` vaut 38).
- [ ] **Step 3 : Implémenter** selon Interfaces.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` avec « Réglages des rituels ».
- [ ] **Step 5 : Commit** — `feat(rituels): quatre succès et les réglages des rituels`.

### Task 15 : Planche, documentation et vérification d'ensemble

**Files:**
- Modify: `tests/board.cjs`, `README.md`, `README.fr.md`

- [ ] **Step 1 : Planche.** De nouvelles images dans `test-results/planche/`, avec une horloge fixée et une ville amorcée :
  - `bilan.png` : la fenêtre « Ta semaine » ;
  - `recap.png` : la fenêtre du mois ;
  - `recap-image.png` : l'image partagée ;
  - `visite.png` : la ville d'un ami en grand ;
  - `journal-rituels.png` : les cartes du Journal (défis, semaine, mois, humeur).
- [ ] **Step 2 : Relecture.** Regarder chaque image et corriger ce qui est illisible.
- [ ] **Step 3 : Documentation**, dans les deux README :
  - **fonctions** : lignes Défis de la semaine, Bilans, Humeur, Ville d'un ami, Récapitulatifs ;
  - **réglages** : la section Rituels ;
  - **structure** : `25-challenges.js`, `26-summaries.js`, `27-share.js`, `54-rituals.js`, `55-share.js` ;
  - **scripts** : tests et planche complétés ;
  - **données et vie privée** : ce que contient un lien de ville.
- [ ] **Step 4 : Vérification d'ensemble** — Run: `npm run check && npm test && npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser && git status --short`. Expected :
  - syntaxe valide ;
  - `ℹ fail 0` ;
  - ligne finale habituelle ;
  - aucun fichier modifié hors du commit.
- [ ] **Step 5 : Commit** — `docs: étape 4 dans les README, planche des rituels`.
