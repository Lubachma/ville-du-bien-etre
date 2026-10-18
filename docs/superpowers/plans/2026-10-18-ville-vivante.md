# Étape 3 — Ville vivante : plan d'implémentation

> **Pour les agents :** sous-compétence REQUISE : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans, tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**But :** une ville qui suit l'heure, les saisons et une météo du jour, avec des habitants qui font comme toi, des éléments qui bougent, douze visiteurs, six fêtes, un onglet « Visites » du carnet, cinq succès et trois réglages.

**Architecture :**
- **Données dans `src/00-core.js`** : saisons, moments, météos et leurs probabilités, fuseaux du sud, visiteurs, fêtes, montants des cadeaux, cinq succès de plus.
- **Règles pures dans le nouveau `src/24-ambient.js`** : horloge de la ville, saison, soleil, moment, météo, fêtes, visiteur du jour, habitants. Aucun accès au DOM. Tout tirage passe par `chance(clé)`, graine comprise.
- **Pinceau (`src/30-paint.js`)** : obscurité progressive, feuillage de saison, neige sur les toits, temps d'animation. Les dessins existants l'utilisent.
- **Vie de la ville dans le nouveau `src/34-paint-life.js`** : météo, petites vies, fumée, faisceau du phare, habitants, visiteurs, décors de fête. Uniquement des fonctions de dessin.
- **Ville (`src/35-city.js`)** : ciel, teinte, couches de vie, habitants et visiteur rangés en profondeur, boucle sobre.
- **Interface dans le nouveau `src/53-visits.js`** : fiche du visiteur, cadeaux, fêtes, saisons vues, légende, onglet Visites. Le reste vient en petites retouches.

**Pile technique :** JavaScript sans framework (IIFE assemblée par `scripts/build.mjs`), canevas 2D, `node:test` dans une machine virtuelle Node, Playwright.

**Spécification :** `docs/superpowers/specs/2026-10-18-ville-vivante-design.md`. Tous ses choix sont ceux de Claude (Ludovic a demandé de faire ce qui est recommandé). La lire avant chaque tâche : ses règles ne sont pas toutes répétées ici.

**Branche :** `etape-3-ville-vivante`, qui porte déjà la spécification.

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
  - apostrophe droite `'` en français, tutoiement ;
  - aucun mot de perte (« perdu », « raté », « lost », « missed »).
- **Sans réseau ni localisation.** La météo et les heures du soleil sont calculées ; aucun appel réseau, aucune API de position.
- **Le même jour donne la même ville partout** :
  - tout tirage du jour passe par `chance(clé)` (`24-ambient.js`), dont la graine est `S.createdAt` ;
  - jamais de `Math.random` dans `24-ambient.js`.
- **Heure de la ville** : jour et minutes viennent de `cityClock(nowTs())`, dans le fuseau `S.clock.tz`. Avancer ou reculer l'horloge du téléphone ne donne pas de cadeau de plus, car `nowTs()` garde l'heure la plus avancée.
- **Animation sobre** :
  - au plus 12 images par seconde pour l'ambiance ; seuls les effets de pose de l'étape 2 gardent la pleine vitesse le temps de leur seconde ;
  - aucune image hors de l'onglet Ville, app en arrière-plan, ville hors de l'écran, fenêtre ou session ouverte ;
  - aucune animation avec `prefers-reduced-motion: reduce` ni avec le réglage « Ville animée » coupé : la ville est alors redessinée chaque minute.
- **Vignettes inchangées** : `City.thumb` garde l'été, l'apparence de l'interface et l'horloge à 10 h 10.
- **Économie** :
  - les seuls nouveaux gains sont ceux de `GIFTS` (2 M, 5 M, 10 M) ;
  - un cadeau se reçoit une fois par clé, même avec deux onglets ;
  - les succès ne donnent jamais de pièces.
- **Dessins** :
  - uniquement avec le peintre de `makePainter` ;
  - les éléments restent dans leur case, à toute heure, en toute saison et à tout instant de leur animation ;
  - fumée, faisceau, météo et ciel se dessinent dans les couches de vie, pas dans `DRAW`.
- **Mise en page** : textes contenus à 320, 390 et 768 px, en français comme en anglais.
- **Modules optionnels** : `tests/state-session.test.cjs` et `tests/backup.test.cjs` chargent `10-state.js`, `45-settings.js` et `50-session.js` sans les nouveaux modules. Tout appel vers `24-ambient.js` ou `53-visits.js` depuis ces fichiers garde le motif `if (typeof f === 'function')`.

## Points de vigilance

Cinq situations que la spécification implique sans les nommer. Chacune a son test dans la tâche indiquée.

1. **Minuit avec l'app ouverte** : la ville passe d'elle-même à la météo, au visiteur et aux fêtes du lendemain, et le cadeau du nouveau jour est neuf (Tasks 7 et 12).
2. **Ville pleine** : plus aucune case libre. Les visiteurs qui ont besoin d'une case ne viennent pas, les habitants restent sur les chemins, et rien ne plante (Tasks 5 et 11).
3. **App en arrière-plan ou ville hors de l'écran** : la boucle s'arrête, puis repart au retour (Task 8).
4. **Animations réduites activées pendant que la ville tourne** : l'animation s'arrête aussitôt (Task 8).
5. **Horloge du téléphone reculée d'un jour** : pas de second cadeau de visiteur pour un jour déjà passé (Task 12).

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/00-core.js` | `SEASONS`, `MOMENTS`, `WEATHERS`, `WEATHER_ODDS`, `SOUTH_TZ`, `VISITORS`, `VISIT_ODDS`, `FESTIVALS`, `GIFTS`, cinq succès |
| `src/24-ambient.js` (nouveau) | horloge, saison, soleil, moment, météo, fêtes, visiteur, habitants, `ambientAt` |
| `src/10-state.js` | réglages `sky`, `hemisphere`, `ambient` ; `visits`, `gifts`, `seasons` : valeurs par défaut, validation, fusion |
| `src/23-achievements.js` | conditions `visitors`, `festivals`, `seasons` |
| `src/30-paint.js` | obscurité, `leaf`, `bloom`, `roof`, `time`, `anim`, `clock` ; dessins d'origine retouchés |
| `src/31-paint-buildings.js`, `32-paint-decor.js`, `33-paint-wonders.js` | feuillage, moulin, Grande Roue, fanions |
| `src/34-paint-life.js` (nouveau) | météo, petites vies, fumée, faisceau, habitants, visiteurs, fêtes |
| `src/35-city.js` | ciel, teinte, couches, profondeur, boucle, visiteur touché, compteurs de test |
| `src/40-ui.js` | légende, ligne du visiteur dans la liste de la ville |
| `src/45-settings.js` | trois réglages dans Apparence |
| `src/52-carnet.js` | onglet Visites, ligne de la carte |
| `src/53-visits.js` (nouveau) | fiche du visiteur, cadeaux, fêtes, saisons vues, légende |
| `src/60-boot.js` | boucle, rafraîchissement à la minute, crochets de test |
| `styles.css` | fiche du visiteur, onglet Visites |
| `tests/ambient.test.cjs` (nouveau) | règles pures |
| `tests/live-state.test.cjs` (nouveau) | données, fusion, cadeaux, succès, légende |
| `tests/life-paint.test.cjs` (nouveau) | dessins de la vie de la ville |
| `tests/ambient-browser.cjs` (nouveau) | parcours navigateur, branchés dans `tests/browser.cjs` |
| `tests/board.cjs`, `README.md`, `README.fr.md` | planche et documentation |

---

### Task 1 : Horloge de la ville, hémisphère, saisons et moments

**Files:**
- Create: `src/24-ambient.js`, `tests/ambient.test.cjs`
- Modify: `src/00-core.js`, `tests/i18n.test.cjs` (`CLEAN_FILES`)

**Interfaces:**
- Produces (`00-core.js`) :
  - `SEASONS = ['spring', 'summer', 'autumn', 'winter']` ;
  - `MOMENTS = ['night', 'dawn', 'day', 'golden', 'dusk']` ;
  - `SOUTH_TZ` : la liste de la spécification, les préfixes finissant par `/` (`'Australia/'`, `'Antarctica/'`, `'America/Argentina/'`), les autres exacts.
- Produces (`24-ambient.js`) :
  - `cityClock(ts = nowTs()): { day: string, minutes: number }` : date `AAAA-MM-JJ` et minutes depuis minuit, dans `S.clock.tz` ;
  - `southern(): boolean` : `S.settings.hemisphere` vaut `'south'` ou `'north'`, sinon le fuseau dit le sud ;
  - `seasonOf(day: string): string` : saisons météorologiques, décalées de six mois au sud ;
  - `sunTimes(day: string): { rise: number, set: number }`, en minutes ;
  - `momentOf(day: string, minutes: number): { name: string, t: number }`, `t` étant l'avancée dans le moment (0 la nuit).

L'algorithme du soleil, que les tests ne dictent pas entièrement :

```js
// j = jour de l'année (1 à 366) ; au sud, la courbe est décalée d'une demi-année.
const hours = 12 + 3.6 * Math.cos(2 * Math.PI * (j - 172 - (southern() ? 182.5 : 0)) / 365);
return { rise: 780 - hours * 30, set: 780 + hours * 30 };
```

Bornes des moments :
- aube : `[rise − 30, rise + 45)` ;
- journée : `[rise + 45, set − 60)` ;
- fin d'après-midi (`golden`) : `[set − 60, set)` ;
- crépuscule (`dusk`) : `[set, set + 45)` ;
- nuit : le reste.

- [ ] **Step 1 : Écrire les tests** dans `tests/ambient.test.cjs` :

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js', '46-features.js'];
// Chaque tâche ajoute ici les noms qu'elle crée.
const EXPOSE = ['cityClock', 'southern', 'seasonOf', 'sunTimes', 'momentOf'];
const T0 = Date.parse('2026-10-18T12:00:00Z');
function app(tz = 'Europe/Zurich', createdAt = Date.parse('2026-01-15T09:00:00Z')) {
  const a = loadApp(FILES, { expose: EXPOSE });
  a.state.clock.tz = tz; a.state.createdAt = createdAt; a.state.clock.maxSeen = 0;
  return a;
}

test('horloge de la ville : jour et minutes dans son fuseau', () => {
  const a = app();
  assert.deepEqual(plain(a.cityClock(Date.parse('2026-07-01T20:30:00Z'))), { day: '2026-07-01', minutes: 22 * 60 + 30 });
  assert.deepEqual(plain(a.cityClock(Date.parse('2026-07-01T22:30:00Z'))), { day: '2026-07-02', minutes: 30 });
});

test("hémisphère : deviné d'après le fuseau, réglable", () => {
  const a = app();
  assert.equal(a.southern(), false);
  for (const tz of ['Australia/Sydney', 'America/Argentina/Buenos_Aires', 'Pacific/Auckland', 'Africa/Johannesburg']) {
    a.state.clock.tz = tz;
    assert.equal(a.southern(), true, tz);
  }
  a.state.settings.hemisphere = 'north';
  assert.equal(a.southern(), false);
  a.state.clock.tz = 'Europe/Zurich'; a.state.settings.hemisphere = 'south';
  assert.equal(a.southern(), true);
});

test('saisons météorologiques, décalées de six mois au sud', () => {
  const a = app();
  assert.deepEqual(['2026-03-01', '2026-05-31', '2026-06-01', '2026-09-01', '2026-11-30', '2026-12-01', '2026-02-28'].map(a.seasonOf),
    ['spring', 'spring', 'summer', 'autumn', 'autumn', 'winter', 'winter']);
  a.state.clock.tz = 'Australia/Sydney';
  assert.deepEqual(['2026-01-15', '2026-07-15', '2026-10-01'].map(a.seasonOf), ['summer', 'winter', 'spring']);
});

test("lever et coucher : longs jours en été, courts en hiver, à l'envers au sud", () => {
  const a = app();
  const near = (value, want, delta = 3) => assert.ok(Math.abs(value - want) <= delta, `${value} au lieu de ${want}`);
  const june = a.sunTimes('2026-06-21'), dec = a.sunTimes('2026-12-21'), march = a.sunTimes('2026-03-20');
  near(june.rise, 312); near(june.set, 1248); near(dec.rise, 528); near(dec.set, 1032);
  near(march.rise, 420, 8); near(march.set, 1140, 8);
  a.state.clock.tz = 'Australia/Sydney';
  near(a.sunTimes('2026-06-21').rise, 528);
});

test('moments de la journée aux bornes', () => {
  const a = app();
  const { rise, set } = a.sunTimes('2026-06-21'), m = n => a.momentOf('2026-06-21', n).name;
  assert.deepEqual([m(rise - 31), m(rise - 30), m(rise + 44), m(rise + 45), m(set - 61), m(set - 60), m(set - 1), m(set), m(set + 44), m(set + 45)],
    ['night', 'dawn', 'dawn', 'day', 'day', 'golden', 'golden', 'dusk', 'dusk', 'night']);
  const half = a.momentOf('2026-06-21', set + 22.5).t;
  assert.ok(half > .45 && half < .55, String(half));
});
```

- [ ] **Step 2 : Le voir échouer** — Run: `npm test`. Expected: FAIL, `cityClock is not defined` (le fichier `24-ambient.js` n'existe pas).
- [ ] **Step 3 : Implémenter** les constantes et `24-ambient.js`. L'horloge réutilise un `Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })` mis en cache par fuseau, comme `hourIn` dans `23-achievements.js`, et `dayOf` pour la date. Ajouter `'24-ambient.js'` à `CLEAN_FILES`.
- [ ] **Step 4 : Vérifier** — `npm run check && npm test`. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(ambiance): horloge, saisons et moments de la ville`.

### Task 2 : La météo du jour et l'arc-en-ciel

**Files:**
- Modify: `src/00-core.js`, `src/24-ambient.js`, `tests/ambient.test.cjs`

**Interfaces:**
- Consumes : `seasonOf`, `cityClock` (Task 1) ; `shiftDay`, `hash53`.
- Produces (`00-core.js`) :
  - `WEATHERS = ['sun', 'clouds', 'rain', 'snow', 'fog']` ;
  - `WEATHER_ODDS = { spring: [45, 30, 25, 0, 0], summer: [60, 25, 15, 0, 0], autumn: [35, 30, 25, 0, 10], winter: [30, 30, 10, 20, 10] }`, dans l'ordre de `WEATHERS`.
- Produces (`24-ambient.js`) :
  - `chance(key: string): number` dans [0, 1[ : `parseInt(hash53(key + '|' + S.createdAt), 36) / 2 ** 53` ;
  - `dayWeather(day): string` : le tirage du jour, brouillard compris (clé `day + ':weather'`) ;
  - `weatherOf(day, minutes): string` : `'fog'` devient `'clouds'` à partir de 660 minutes (11 h) ;
  - `rainbowOn(day, minutes): boolean` : vrai si `dayWeather(day) === 'sun'`, `dayWeather(veille) === 'rain'`, `minutes < 720` et `chance(day + ':rainbow') < 1 / 3`.

- [ ] **Step 1 : Écrire les tests** (ajouter `'chance', 'dayWeather', 'weatherOf', 'rainbowOn', 'shiftDay', 'WEATHER_ODDS'` à `EXPOSE`) :

```js
test('météo du jour : reproductible, propre à chaque ville', () => {
  const a = app(), b = app(), c = app('Europe/Zurich', Date.parse('2025-05-05T05:05:00Z'));
  const days = Array.from({ length: 60 }, (_, i) => a.shiftDay('2026-01-01', i));
  assert.deepEqual(days.map(a.dayWeather), days.map(b.dayWeather));
  assert.notDeepEqual(days.map(a.dayWeather), days.map(c.dayWeather));
});

test('météo selon la saison : proportions du tableau sur quatre ans', () => {
  const a = app(), count = {}, weathers = ['sun', 'clouds', 'rain', 'snow', 'fog'];
  for (let i = 0; i < 1461; i++) {
    const day = a.shiftDay('2026-01-01', i), season = a.seasonOf(day), weather = a.dayWeather(day);
    count[season] = count[season] || { n: 0 };
    count[season][weather] = (count[season][weather] || 0) + 1;
    count[season].n++;
  }
  for (const [season, odds] of Object.entries(plain(a.WEATHER_ODDS))) {
    weathers.forEach((weather, i) => {
      const share = 100 * (count[season][weather] || 0) / count[season].n;
      if (odds[i] === 0) assert.equal(share, 0, `${season} ${weather}`);
      else assert.ok(Math.abs(share - odds[i]) <= 6, `${season} ${weather} : ${share.toFixed(1)} %`);
    });
  }
});

test('brouillard le matin seulement, puis des nuages', () => {
  const a = app();
  const day = Array.from({ length: 400 }, (_, i) => a.shiftDay('2026-01-01', i)).find(d => a.dayWeather(d) === 'fog');
  assert.ok(day);
  assert.deepEqual([a.weatherOf(day, 659), a.weatherOf(day, 660)], ['fog', 'clouds']);
});

test("arc-en-ciel : le matin ensoleillé qui suit un jour de pluie, environ une fois sur trois", () => {
  const a = app();
  let eligible = 0, shown = 0;
  for (let i = 1; i < 1461; i++) {
    const day = a.shiftDay('2026-01-01', i);
    if (a.dayWeather(day) !== 'sun' || a.dayWeather(a.shiftDay(day, -1)) !== 'rain') { assert.equal(a.rainbowOn(day, 600), false, day); continue; }
    eligible++;
    if (a.rainbowOn(day, 600)) { shown++; assert.equal(a.rainbowOn(day, 720), false, 'après midi'); }
  }
  assert.ok(eligible > 50, String(eligible));
  assert.ok(Math.abs(shown / eligible - 1 / 3) < .12, String(shown / eligible));
});
```

- [ ] **Step 2 : Le voir échouer** — Run: `npm test`. Expected: FAIL, `dayWeather is not defined`.
- [ ] **Step 3 : Implémenter.** Le tirage parcourt les cumuls de `WEATHER_ODDS[seasonOf(day)]` avec `chance(day + ':weather') * 100`.
- [ ] **Step 4 : Vérifier** — `npm test`. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(ambiance): une météo par jour`.

### Task 3 : Les fêtes et les montants des cadeaux

**Files:**
- Modify: `src/00-core.js`, `src/24-ambient.js`, `tests/ambient.test.cjs`

**Interfaces:**
- Consumes : `southern` (Task 1), `dayOf`, `keyToUTC`.
- Produces (`00-core.js`) :
  - `FESTIVALS`, chaque fête avec ses jours `MM-JJ` au nord et au sud :
    - `nouvel-an` : `['12-31', '01-01']`, aux deux ;
    - `printemps` : nord `['03-20', '03-21', '03-22']`, sud `['09-22', '09-23', '09-24']` ;
    - `ete` : nord `['06-20', '06-21', '06-22']`, sud `['12-20', '12-21', '12-22']` ;
    - `recoltes` : nord `['09-22', '09-23', '09-24']`, sud `['03-20', '03-21', '03-22']` ;
    - `lumieres` : nord `['12-20', '12-21', '12-22']`, sud `['06-20', '06-21', '06-22']` ;
    - `anniversaire`, sans jours : calculé ;
  - `GIFTS = { visit: 2e6, fest: 5e6, birthday: 10e6 }`.
- Produces (`24-ambient.js`) :
  - `festivalsOn(day): Array<{ id, key, age? }>`, dans l'ordre de `FESTIVALS` :
    - la clé est `fest:<id>:<année>` ;
    - le 31 décembre du Nouvel An porte l'année suivante ;
    - l'anniversaire tombe le même `MM-JJ` que `dayOf(S.createdAt)`, seulement les années suivant la création, avec `age = année − année de création`. Un 29 février se fête le 28 les années non bissextiles ;
  - `giftAmount(key): number` : `visit:` → `GIFTS.visit`, `fest:anniversaire:` → `GIFTS.birthday`, `fest:` → `GIFTS.fest`, sinon 0 ;
  - `nextFestival(id, day): string` : le premier jour de la fête qui tombe le jour donné ou après.

- [ ] **Step 1 : Écrire les tests** (ajouter `'festivalsOn', 'giftAmount', 'nextFestival'` à `EXPOSE`) :

```js
test('fêtes aux dates des deux hémisphères', () => {
  const a = app(), ids = day => a.festivalsOn(day).map(f => f.id);
  assert.deepEqual(['2026-03-21', '2026-06-20', '2026-09-24', '2026-12-22', '2026-12-31', '2027-01-01', '2026-03-23'].map(ids),
    [['printemps'], ['ete'], ['recoltes'], ['lumieres'], ['nouvel-an'], ['nouvel-an'], []]);
  a.state.clock.tz = 'Australia/Sydney';
  assert.deepEqual(['2026-03-21', '2026-09-23', '2026-12-21', '2026-06-21'].map(ids), [['recoltes'], ['printemps'], ['ete'], ['lumieres']]);
});

test("une fête, un cadeau par an : le Nouvel An porte l'année qui commence", () => {
  const a = app();
  assert.deepEqual([a.festivalsOn('2026-12-31')[0].key, a.festivalsOn('2027-01-01')[0].key], ['fest:nouvel-an:2027', 'fest:nouvel-an:2027']);
  assert.equal(a.festivalsOn('2027-03-20')[0].key, 'fest:printemps:2027');
  assert.deepEqual(['visit:2026-10-18', 'fest:printemps:2027', 'fest:anniversaire:2027', 'autre'].map(a.giftAmount), [2e6, 5e6, 10e6, 0]);
});

test('anniversaire de la ville : dès la première année, avec son âge', () => {
  const a = app('Europe/Zurich', Date.parse('2026-01-15T09:00:00Z'));
  assert.deepEqual(a.festivalsOn('2026-01-15').map(f => f.id), []);
  assert.deepEqual(plain(a.festivalsOn('2028-01-15')), [{ id: 'anniversaire', key: 'fest:anniversaire:2028', age: 2 }]);
  const leap = app('Europe/Zurich', Date.parse('2028-02-29T12:00:00Z'));
  assert.deepEqual(leap.festivalsOn('2029-02-28').map(f => f.age), [1]);
});

test("prochaine date d'une fête, pour le carnet", () => {
  const a = app();
  assert.deepEqual([a.nextFestival('printemps', '2026-10-18'), a.nextFestival('nouvel-an', '2026-10-18'), a.nextFestival('ete', '2026-06-21'), a.nextFestival('anniversaire', '2026-10-18')],
    ['2027-03-20', '2026-12-31', '2026-06-21', '2027-01-15']);
});
```

- [ ] **Step 2 : Le voir échouer** — Run: `npm test`. Expected: FAIL, `festivalsOn is not defined`.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier** — `npm test`. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(ambiance): les fêtes de l'année`.

### Task 4 : Données : réglages, visites, cadeaux et saisons vues

**Files:**
- Modify: `src/00-core.js` (`VISITORS`, `VISIT_ODDS`), `src/10-state.js`
- Create: `tests/live-state.test.cjs`

**Interfaces:**
- Consumes : `giftAmount`, `FESTIVALS` (Task 3), `SEASONS` (Task 1). `10-state.js` appelle `giftAmount` avec le motif `typeof giftAmount === 'function'`.
- Produces (`00-core.js`) :

```js
// Visiteurs : saisons où ils viennent, météo qu'ils aiment, neige récente, endroit où ils se placent.
const VISITORS = [
  { id: 'chat', weather: ['sun', 'clouds', 'fog'], spot: 'bench' },
  { id: 'herisson', seasons: ['spring', 'summer', 'autumn'], spot: 'nature' },
  { id: 'ecureuil', seasons: ['autumn', 'winter'], spot: 'tree' },
  { id: 'cigogne', seasons: ['spring', 'summer'], spot: 'roof' },
  { id: 'canards', seasons: ['spring', 'summer', 'autumn'], spot: 'pond' },
  { id: 'renard', seasons: ['autumn', 'winter'], spot: 'edge' },
  { id: 'chouette', seasons: ['autumn', 'winter'], spot: 'tree' },
  { id: 'montgolfiere', seasons: ['spring', 'summer', 'autumn'], weather: ['sun', 'clouds'], spot: 'sky' },
  { id: 'bonhomme', seasons: ['winter'], snow: true, spot: 'free' },
  { id: 'glaces', seasons: ['summer'], weather: ['sun', 'clouds'], spot: 'path' },
  { id: 'accordeon', weather: ['sun', 'clouds', 'fog'], spot: 'kiosk' },
  { id: 'artiste', seasons: ['spring', 'summer', 'autumn'], weather: ['sun', 'clouds'], spot: 'free' },
];
const VISIT_ODDS = .7;
```

- Produces (`10-state.js`) :
  - dans les réglages : `sky: 'time'` (ou `'theme'`), `hemisphere: 'auto'` (ou `'north'`, `'south'`), `ambient: true` ;
  - à la racine de l'état : `visits: {}`, `gifts: {}`, `seasons: {}` ;
  - validation :
    - une visite garde un visiteur connu, un `first` valide et un `last` en `AAAA-MM-JJ` ; son `count` est borné à 1–100 000 ;
    - un cadeau garde une clé `visit:AAAA-MM-JJ` ou `fest:<fête connue>:<AAAA>`, avec une date valide ;
    - une saison vue garde une saison connue, avec une date valide ;
  - fusion : pour chaque visiteur, la plus ancienne `first`, le plus grand `count` et la plus récente `last`. `gifts` et `seasons` passent par `mergeDates`. Une clé de cadeau absente de B mais présente dans L et dans R retire `giftAmount(clé)` une fois aux pièces fusionnées.

- [ ] **Step 1 : Écrire les tests** dans `tests/live-state.test.cjs` :

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js', '46-features.js'];
// Chaque tâche ajoute ici les noms qu'elle crée.
const EXPOSE = ['defaultState', 'normalize', 'merge3', 'clone', 'VISITORS'];
const T0 = Date.parse('2026-10-18T12:00:00Z');
const app = (globals = {}) => loadApp(FILES, { expose: EXPOSE, globals });

test('réglages et données de la ville vivante, par défaut', () => {
  const a = app(), s = a.defaultState();
  assert.deepEqual([s.settings.sky, s.settings.hemisphere, s.settings.ambient], ['time', 'auto', true]);
  assert.deepEqual(plain([s.visits, s.gifts, s.seasons]), [{}, {}, {}]);
});

test('validation : visiteurs, cadeaux et saisons inconnus ignorés, nombres bornés', () => {
  const a = app();
  const s = a.normalize({ settings: { sky: 'disco', hemisphere: 'west', ambient: false },
    visits: { chat: { first: T0, count: 3, last: '2026-10-18' }, licorne: { first: T0, count: 1, last: '2026-10-18' }, renard: { first: 'hier', count: -4, last: 'demain' }, canards: { first: T0, count: 1e9, last: '2026-10-18' } },
    gifts: { 'visit:2026-10-18': T0, 'fest:printemps:2027': T0, 'fest:carnaval:2027': T0, 'visit:hier': T0, cadeau: T0 },
    seasons: { winter: T0, monsoon: T0 } });
  assert.deepEqual([s.settings.sky, s.settings.hemisphere, s.settings.ambient], ['time', 'auto', false]);
  assert.deepEqual(plain(s.visits), { chat: { first: T0, count: 3, last: '2026-10-18' }, canards: { first: T0, count: 100000, last: '2026-10-18' } });
  assert.deepEqual(Object.keys(s.gifts), ['visit:2026-10-18', 'fest:printemps:2027']);
  assert.deepEqual(plain(s.seasons), { winter: T0 });
});

test("fusion de deux onglets : rencontres, saisons, et un cadeau reçu deux fois ne compte qu'une fois", () => {
  const a = app();
  const B = a.normalize({ ...a.defaultState(), coins: 10e6, visits: { chat: { first: T0 - 864e5, count: 2, last: '2026-10-17' } } });
  const L = a.clone(B), R = a.clone(B);
  L.visits.chat = { first: T0 - 864e5, count: 3, last: '2026-10-18' }; L.gifts['visit:2026-10-18'] = T0; L.coins += 2e6;
  R.visits.chat = { first: T0 - 864e5, count: 3, last: '2026-10-18' }; R.gifts['visit:2026-10-18'] = T0 + 5000; R.coins += 2e6;
  R.visits.renard = { first: T0, count: 1, last: '2026-10-18' };
  L.seasons.autumn = T0 - 1000; R.seasons.autumn = T0;
  L.gifts['fest:printemps:2027'] = T0; L.coins += 5e6;
  const M = a.merge3(B, L, R);
  assert.equal(M.coins, 10e6 + 2e6 + 5e6);
  assert.deepEqual(plain(M.visits), { chat: { first: T0 - 864e5, count: 3, last: '2026-10-18' }, renard: { first: T0, count: 1, last: '2026-10-18' } });
  assert.deepEqual(plain(M.gifts), { 'visit:2026-10-18': T0, 'fest:printemps:2027': T0 });
  assert.equal(M.seasons.autumn, T0 - 1000);
});
```

- [ ] **Step 2 : Le voir échouer** — Run: `npm test`. Expected: FAIL sur les réglages (`undefined` au lieu de `'time'`).
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier** — `npm test` puis la suite navigateur. Expected: `ℹ fail 0` ; ligne finale de la suite navigateur inchangée.
- [ ] **Step 5 : Commit** — `feat(ambiance): visites, cadeaux et saisons dans l'état`.

### Task 5 : Le visiteur du jour

**Files:**
- Modify: `src/24-ambient.js`, `tests/ambient.test.cjs`

**Interfaces:**
- Consumes : `chance`, `dayWeather`, `seasonOf` (Tasks 1–2) ; `VISITORS`, `VISIT_ODDS` (Task 4) ; `scaffoldOnBuild`-like test of a building (`group !== 'decor'`, pas `ground`, pas `wonder`).
- Produces :
  - `visitorSpot(visitor, day): { x, y, on? } | { sky: true } | null`. Les cases libres sont celles de la ville (taille `S.city.size`) sans élément, parcourues ligne par ligne (`y`, puis `x`). Parmi plusieurs places, le choix est `Math.floor(chance(day + ':' + id + ':spot') * n)`. Places selon `spot` :

| `spot` | place |
|---|---|
| `bench` | un `banc` (`on: 'banc'`), sinon une case libre |
| `nature` | une case libre voisine (8 voisins) d'un `arbre`, `cerisier`, `haie` ou `fleurs` ; sinon aucune |
| `tree` | un `arbre`, `cerisier` ou `grandarbre` (`on`) ; sinon aucune |
| `roof` | un bâtiment (`on`) ; sinon aucune |
| `pond` | un `etang` (`on`) ; sinon aucune |
| `edge` | une case libre au bord ; sinon aucune |
| `sky` | `{ sky: true }` |
| `free` | une case libre ; sinon aucune |
| `path` | un `chemin` ou des `pasjaponais` (`on`), sinon une case libre |
| `kiosk` | une case libre voisine du `kiosque`, sinon une case libre |

  - `visitorOf(day): { id, spot } | null` :
    1. aucun visiteur si `chance(day + ':visit') >= VISIT_ODDS` ;
    2. candidats : saisons et météo de `dayWeather(day)` respectées, neige du jour ou de la veille pour `snow`, et une place ;
    3. on écarte celui dont `S.visits[id].last` est la veille, sauf s'il ne reste personne ;
    4. poids 1 si `dayOf(S.visits[id].first) < day`, sinon 3 ;
    5. tirage pondéré avec `chance(day + ':who')`.

- [ ] **Step 1 : Écrire les tests** (ajouter `'visitorSpot', 'visitorOf', 'VISITORS', 'keyToUTC'` à `EXPOSE`, et le placeur `const place = (a, tiles, size = 7) => { a.state.city = { size, tiles: tiles.map(([item, x, y], i) => ({ id: 't' + i, item, x, y, at: T0, paid: 0 })) }; };`) :

```js
const visitor = (a, id) => a.VISITORS.find(v => v.id === id);

test('visiteur : rien sans sa place, et une ville pleine garde ses toits et ses arbres', () => {
  const a = app();
  place(a, []);
  assert.equal(a.visitorSpot(visitor(a, 'canards'), '2026-07-01'), null);
  place(a, [['etang', 2, 3]]);
  assert.deepEqual(plain(a.visitorSpot(visitor(a, 'canards'), '2026-07-01')), { x: 2, y: 3, on: 'etang' });
  assert.deepEqual(plain(a.visitorSpot(visitor(a, 'montgolfiere'), '2026-07-01')), { sky: true });
  place(a, Array.from({ length: 49 }, (_, i) => [i === 0 ? 'arbre' : 'maison', i % 7, Math.floor(i / 7)]));
  for (const id of ['chat', 'herisson', 'renard', 'bonhomme', 'artiste']) assert.equal(a.visitorSpot(visitor(a, id), '2026-07-01'), null, id);
  assert.deepEqual(plain(a.visitorSpot(visitor(a, 'ecureuil'), '2026-07-01')), { x: 0, y: 0, on: 'arbre' });
  assert.equal(a.visitorSpot(visitor(a, 'cigogne'), '2026-07-01').on, 'maison');
});

test('visiteur du jour : reproductible, conditions respectées, environ 5 jours sur 7', () => {
  const a = app();
  place(a, [['etang', 1, 1], ['arbre', 3, 1], ['maison', 5, 1], ['banc', 1, 4], ['kiosque', 4, 4], ['chemin', 6, 6]]);
  let present = 0;
  for (let i = 0; i < 730; i++) {
    const day = a.shiftDay('2026-01-01', i), v = a.visitorOf(day);
    assert.deepEqual(plain(v), plain(a.visitorOf(day)));
    if (!v) continue;
    present++;
    const def = visitor(a, v.id), season = a.seasonOf(day), weather = a.dayWeather(day);
    if (def.seasons) assert.ok(def.seasons.includes(season), `${v.id} en ${season}`);
    if (def.weather) assert.ok(def.weather.includes(weather), `${v.id} par ${weather}`);
    if (def.snow) assert.ok(weather === 'snow' || a.dayWeather(a.shiftDay(day, -1)) === 'snow', `${v.id} sans neige`);
  }
  assert.ok(Math.abs(present / 730 - .7) < .06, String(present / 730));
});

test("visiteur : plus souvent ceux pas encore rencontrés, jamais celui d'hier quand un autre peut venir", () => {
  const a = app();
  place(a, [['etang', 1, 1], ['arbre', 3, 1], ['maison', 5, 1], ['banc', 1, 4], ['kiosque', 4, 4]]);
  const days = Array.from({ length: 1095 }, (_, i) => a.shiftDay('2026-01-01', i));
  const chats = () => days.map(a.visitorOf).filter(v => v && v.id === 'chat').length;
  const before = chats();
  const long = Date.parse('2025-01-01T12:00:00Z');
  a.state.visits = Object.fromEntries(a.VISITORS.filter(v => v.id !== 'chat').map(v => [v.id, { first: long, count: 1, last: '2025-01-01' }]));
  const after = chats();
  assert.ok(after > before * 1.5, `${before} → ${after}`);
  const day = days.find(d => (a.visitorOf(d) || {}).id === 'chat');
  a.state.visits.chat = { first: long, count: 1, last: a.shiftDay(day, -1) };
  assert.notEqual((a.visitorOf(day) || {}).id, 'chat');
});

test('rencontrer le visiteur du jour ne le change pas', () => {
  const a = app();
  place(a, [['etang', 1, 1], ['arbre', 3, 1], ['banc', 1, 4]]);
  const day = Array.from({ length: 60 }, (_, i) => a.shiftDay('2026-07-01', i)).find(d => a.visitorOf(d));
  const v = plain(a.visitorOf(day));
  a.state.visits[v.id] = { first: a.keyToUTC(day), count: 1, last: day };
  assert.deepEqual(plain(a.visitorOf(day)), v);
});
```

- [ ] **Step 2 : Le voir échouer** — Run: `npm test`. Expected: FAIL, `visitorSpot is not defined`.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier** — `npm test`. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(ambiance): le visiteur du jour`.

### Task 6 : Le pinceau des saisons et de la nuit

**Files:**
- Modify: `src/30-paint.js`, `src/31-paint-buildings.js` (`labyrinthe`), `src/32-paint-decor.js` (`haie`, `cerisier`), `src/33-paint-wonders.js` (`grandarbre`), `tests/paint.test.cjs`

**Interfaces:**
- Produces (`makePainter(ctx, tw, ox, oy, pal)`), avec `pal` qui accepte en plus :
  - `dark` (0 à 1, sinon `night ? 1 : 0`) ;
  - `season` (`'summer'` par défaut) ;
  - `time` (secondes, 0 par défaut), `anim` (`false`), `clock` (minutes depuis minuit, 610 par défaut).
- Le peintre gagne :
  - `g.dark` ; `g.night = dark >= .5` ; `g.c(hex, k)` mélange vers `NIGHT_TINT` de `k × dark` ; `g.cat` de `.18 × dark` ;
  - `g.season`, `g.snow` (1 en hiver, sinon 0), `g.time`, `g.anim`, `g.clock` ;
  - `g.leaf(hex)` : au printemps `mix(hex, '#b9e27a', .3)`, en été `hex`, en automne `mix(hex, AUTUMN[i], .75)` avec `AUTUMN = ['#d98a2b', '#c4572f', '#e2b33c']` et `i = parseInt(hex.slice(1), 16) % 3`, en hiver `mix(hex, '#eef3f6', .62)`, puis `g.c` ;
  - `g.bloom(hex)` : inchangé au printemps et en été, `mix(hex, '#d0703a', .7)` en automne, `mix(hex, '#eef3f6', .62)` en hiver, puis `g.c` ;
  - `g.roof(color)` : en hiver `mix(color, g.c('#f3f6f9'), .72)`, sinon `color`. Il est appliqué par `hipRoof`, `gableX`, `gableY`, `shed` (pan principal), `cone`, `dome` et par la face du dessus de `box`.
- Produces (fonction de premier niveau) : `groundColors(season, dark): [string, string]`, les deux teintes du damier. Chaque teinte va de celle de jour à celle de nuit de sa saison, selon `dark` :

| Saison | Jour | Nuit |
|---|---|---|
| printemps | `['#acd292', '#a5cc8b']` (actuelles) | `['#2d4a3a', '#2a4536']` (actuelles) |
| été | `['#a6cf84', '#9fc97d']` | `['#2c4a37', '#294433']` |
| automne | `['#c3c98a', '#bcc283']` | `['#3d4834', '#394330']` |
| hiver | `['#e8eff2', '#e1e9ed']` | `['#46566a', '#425165']` |
- **Feuillage** : `arbre`, `fleurs` (feuilles), `etang` (roseaux), `stade` (pelouse), `jardin` (gazon), `labyrinthe`, `haie`, `grandarbre` passent leurs verts par `g.leaf`. `cerisier` passe ses roses par `g.bloom`.

- [ ] **Step 1 : Écrire les tests** dans `tests/paint.test.cjs` :
  - `paint(a, key, look)` et `assertInTile(a, key, stage, look = {})` transmettent `look` (`night`, `dark`, `season`, `time`, `anim`, `clock`) au peintre ;
  - ajouter `'groundColors'` à l'exposition ;
  - deux aides de test : `luma(hex)` (luminance 0–1) et `hue(hex)` (teinte 0–360).

```js
const ALL = ['31-paint-buildings.js', '32-paint-decor.js', '33-paint-wonders.js'];

test('saisons : chaque élément reste dans sa case, dans les quatre saisons, de jour comme de nuit', () => {
  const a = app(ALL);
  for (const key of Object.keys(a.ITEMS)) for (const season of ['spring', 'summer', 'autumn', 'winter']) for (const dark of [0, 1]) assertInTile(a, key, undefined, { season, dark });
});

test('feuillage : inchangé en été, roux en automne, blanchi en hiver, plus tendre au printemps', () => {
  const a = app([]), leaf = season => a.makePainter(fakeContext(), 100, 0, 0, { ...PALETTE, season }).leaf('#4a8540');
  assert.equal(leaf('summer'), '#4a8540');
  assert.ok(hue(leaf('autumn')) < 50, leaf('autumn'));
  assert.ok(luma(leaf('winter')) > .7, leaf('winter'));
  assert.ok(luma(leaf('spring')) > luma('#4a8540'));
});

test('neige sur les toits en hiver seulement', () => {
  const a = app([]), g = season => a.makePainter(fakeContext(), 100, 0, 0, { ...PALETTE, season });
  assert.equal(g('summer').roof('#c0392b'), '#c0392b');
  assert.ok(luma(g('winter').roof('#c0392b')) > .75);
});

test("obscurité progressive : à 1, la nuit d'avant ; à 0, le jour", () => {
  const a = app([]), g = pal => a.makePainter(fakeContext(), 100, 0, 0, { ...PALETTE, ...pal });
  assert.equal(g({ dark: 1 }).c('#ffffff'), g({ night: true }).c('#ffffff'));
  assert.equal(g({ dark: 0 }).c('#ffffff'), '#ffffff');
  assert.ok(luma(g({ dark: .5 }).c('#ffffff')) > luma(g({ night: true }).c('#ffffff')));
  assert.deepEqual([g({ dark: .6 }).night, g({ dark: .4 }).night], [true, false]);
  assert.deepEqual(plain([a.groundColors('spring', 0), a.groundColors('spring', 1)]), [['#acd292', '#a5cc8b'], ['#2d4a3a', '#2a4536']]);
  assert.ok(luma(a.groundColors('winter', 0)[0]) > .85);
});
```

- [ ] **Step 2 : Le voir échouer** — Run: `npm test`. Expected: FAIL, `leaf is not a function`.
- [ ] **Step 3 : Implémenter** le peintre, `groundColors`, puis les dessins de feuillage. `35-city.js` dessine le damier avec `groundColors('spring', night ? 1 : 0)`, ce qui garde exactement l'apparence actuelle ; Task 7 branche la saison et l'heure.
- [ ] **Step 4 : Vérifier** — `npm test`, puis la suite navigateur. Expected: `ℹ fail 0` ; ligne finale inchangée.
- [ ] **Step 5 : Commit** — `feat(dessins): saisons, neige sur les toits et nuit progressive`.

### Task 7 : Lumière et ciel selon l'heure

**Files:**
- Modify: `src/24-ambient.js`, `src/35-city.js`, `src/60-boot.js` (crochet de test), `tests/ambient.test.cjs`
- Create: `tests/ambient-browser.cjs` ; Modify: `tests/browser.cjs` (le branche après `runContent`)

**Interfaces:**
- Consumes : Tasks 1 à 6.
- Produces (`24-ambient.js`) :
  - `ambientAt(ts = nowTs()): { day, minutes, season, moment, weather, rainbow, festivals, visitor }`, complété par les champs de `ambientForce` s'il est défini ;
  - `let ambientForce = null`, réservé aux tests et à la planche ;
  - `darkness(moment): number` : nuit 1, journée 0, aube `1 − t`, fin d'après-midi `.15 × t`, crépuscule `.15 + .85 × t`.
- Produces (`35-city.js`) :
  - `SKY = { night: ['#0b1424', '#1a2b37'], dawn: ['#f2b8a2', '#f8e4d2'], day: ['#bcdff1', '#eef6ef'], golden: ['#f4c98c', '#fbe9c8'], dusk: ['#6f5f9e', '#ee9f7a'] }` ;
  - `skyColors(amb): { top, bottom, stars }` :
    - pendant l'aube et le crépuscule, mélange vers le moment suivant selon `t` ;
    - grisé vers `'#9aa5ad'` de `.25` (nuages, brouillard) ou `.45` (pluie, neige) ;
    - `stars` est l'obscurité au-delà de `.6` ramenée à 0–1, multipliée par 1 au soleil et par `.3` sinon ;
  - `lightTint(amb): string | null` : aube `'rgba(255,170,150,.14)'`, fin d'après-midi `'rgba(255,190,110,.14)'`, crépuscule `'rgba(130,100,190,.16)'`, sinon `null`.
- **Ce que fait la ville :**
  - **ciel « Selon l'heure »** :
    - `draw()` prend `pal.dark = darkness(amb.moment)` et `pal.season = amb.season` ;
    - il pose `--sky-top`, `--sky-bottom` et `--star-opacity` en style sur `#sky` ;
    - il étend la teinte avec `globalCompositeOperation = 'source-atop'` après les éléments, avant curseur et sélection ;
  - **ciel « Selon l'apparence »** : l'obscurité vient du thème (0 ou 1), les variables en style sont retirées et il n'y a pas de teinte, mais la saison s'applique ;
  - le damier utilise `groundColors(amb.season, pal.dark)` ;
  - **l'export PNG** (`snapshot`) dessine l'ambiance du moment, immobile (`anim` faux), sans curseur ni sélection.
- Produces (`60-boot.js`, mode débogage) : `window.__ville.ambient = { at: ambientAt, force: f => { ambientForce = f; City.draw(); }, sky: skyColors }`.

- [ ] **Step 1 : Écrire les tests.**
  - **Unitaires** (ajouter `'ambientAt', 'darkness'` à `EXPOSE`) :

```js
test('ambiance à un instant : jour, moment, saison, météo, fêtes et visiteur', () => {
  const a = app(), amb = a.ambientAt(Date.parse('2026-03-21T11:00:00Z'));
  assert.deepEqual([amb.day, amb.minutes, amb.season, amb.moment.name, amb.weather, amb.festivals.map(f => f.id)],
    ['2026-03-21', 720, 'spring', 'day', a.weatherOf('2026-03-21', 720), ['printemps']]);
  assert.deepEqual(plain(amb.visitor), plain(a.visitorOf('2026-03-21')));
});

test('à minuit, la ville passe à la météo et au visiteur du lendemain', () => {
  const a = app(), before = a.ambientAt(Date.parse('2026-07-01T21:59:00Z')), after = a.ambientAt(Date.parse('2026-07-01T22:01:00Z'));
  assert.deepEqual([before.day, after.day], ['2026-07-01', '2026-07-02']);
  assert.equal(after.weather, a.weatherOf('2026-07-02', 1));
  assert.deepEqual(plain(after.visitor), plain(a.visitorOf('2026-07-02')));
});

test('obscurité : nuit 1, journée 0, aube et crépuscule progressifs', () => {
  const a = app();
  assert.deepEqual([a.darkness({ name: 'night', t: 0 }), a.darkness({ name: 'day', t: .5 })], [1, 0]);
  assert.ok(a.darkness({ name: 'dusk', t: .2 }) < a.darkness({ name: 'dusk', t: .8 }));
  assert.ok(a.darkness({ name: 'dawn', t: .2 }) > a.darkness({ name: 'dawn', t: .8 }));
});
```

  - **Navigateur** : `tests/ambient-browser.cjs` exporte `runAmbient(browser, baseURL)`. Il reprend les aides `newTown` et `town` de `content-browser.cjs`, qui gagne un export `{ newTown, town }`. Avant `goto`, un fuseau `Europe/Zurich` et `page.clock.setFixedTime(...)` :

```js
const skyTop = page => page.evaluate(() => getComputedStyle(document.querySelector('#sky')).getPropertyValue('--sky-top').trim());
const luma = hex => { const n = parseInt(hex.slice(1), 16); return (.2126 * (n >> 16) + .7152 * (n >> 8 & 255) + .0722 * (n & 255)) / 255; };
// Ciel selon l'heure : nuit à 22 h, journée à midi (Zurich, 1er juillet).
// à 2026-07-01T20:00:00Z : luma(await skyTop(page)) < .2
// à 2026-07-01T10:00:00Z : luma(await skyTop(page)) > .6
// Réglage « Selon l'apparence » (S.settings.sky = 'theme', puis commit) : await skyTop(page) vaut la valeur du thème clair, '#d3e8e0'.
```

- [ ] **Step 2 : Le voir échouer** — Run: `npm test`, puis `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Expected: FAIL, `ambientAt is not defined`, puis la valeur du ciel de nuit.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` « Ciel selon l'heure » ; ligne finale habituelle.
- [ ] **Step 5 : Commit** — `feat(ville): lumière et ciel selon l'heure et la saison`.

### Task 8 : Une boucle d'animation sobre

**Files:**
- Modify: `src/35-city.js`, `src/40-ui.js` (`go`, `closeSheet`), `src/50-session.js` (fermeture de session), `src/60-boot.js`, `tests/ambient-browser.cjs`

**Interfaces:**
- Produces (`35-city.js`) :
  - `City.wake()` : relance la bonne cadence. Pleine vitesse tant qu'un effet ou des étincelles durent ; sinon une image au plus toutes les 83 ms si `ambientRunning()` ; sinon rien ;
  - `ambientRunning(): boolean` : toutes ces conditions à la fois :
    - `S.settings.ambient` et pas `reducedMotion()` ;
    - `currentTab === 'ville'` et `document.visibilityState === 'visible'` ;
    - `#sheet` et `#session` cachés ;
    - la ville à l'écran, d'après un `IntersectionObserver` sur `#city` ;
  - `City.frames(): number` : nombre d'images dessinées depuis le chargement, pour les tests ;
  - le peintre reçoit `time` (secondes depuis le chargement) et `anim: ambientRunning()`.
- **Qui relance la boucle** (`City.wake()`) :
  - `go('ville')`, `closeSheet()`, la fermeture d'une session ;
  - `visibilitychange` vers `visible` ;
  - un changement de `prefers-reduced-motion` ;
  - le réglage « Ville animée ».
- **Ville immobile** : l'intervalle de 60 s de `60-boot.js` redessine la ville quand l'onglet Ville est affiché.

- [ ] **Step 1 : Parcours navigateur** dans `runAmbient` (ville amorcée de 9 éléments, horloge réelle) :
  1. **ville à l'écran** : `frames()` augmente de 6 à 20 en 1 s ;
  2. **fenêtre ouverte** (boutique) : aucune image en 500 ms ;
  3. **onglet Journal** : aucune image ;
  4. **arrière-plan** : `Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })` puis l'événement `visibilitychange`. Aucune image ; même chose en retour à `visible` et l'animation reprend ;
  5. **ville hors de l'écran** : sur un écran de 390 × 420 px, on fait défiler `#main` jusqu'à ce que `#city` soit entièrement hors de l'écran (vérifié par `getBoundingClientRect`). Aucune image ;
  6. **animations réduites** : `page.emulateMedia({ reducedMotion: 'reduce' })` pendant l'animation. Elle s'arrête aussitôt ;
  7. **réglage coupé** : `S.settings.ambient = false` puis `commit()`. Aucune image en 1 s.
- [ ] **Step 2 : Le voir échouer** — Run: `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Expected: FAIL, `__ville.City.frames is not a function`.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` « Boucle sobre » ; ligne finale habituelle.
- [ ] **Step 5 : Commit** — `feat(ville): une boucle d'animation sobre`.

### Task 9 : Ce qui bouge dans la ville

**Files:**
- Modify: `src/30-paint.js` (`horloge`, `fontaine`), `src/31-paint-buildings.js` (`moulin`, `source`), `src/32-paint-decor.js` (`fanions`), `src/33-paint-wonders.js` (`granderoue`)
- Create: `src/34-paint-life.js`, `tests/life-paint.test.cjs`
- Modify: `src/35-city.js` (couche de vie), `tests/i18n.test.cjs` (`CLEAN_FILES`)

**Interfaces:**
- Consumes : `g.time`, `g.anim`, `g.clock`, `g.dark`, `g.season` (Task 6).
- **Dessins animés**, immobiles quand `g.anim` est faux :
  - `moulin` : angle des ailes `π/4 + 0,9 × time` ;
  - `granderoue` (étape 4) : rotation `0,25 × time` ;
  - `fontaine`, `source` : scintillement ou vapeur, avec la phase `time` ;
  - `fanions` : ondulation `sin(3 × time + i)`.
- **Horloge** : `horloge` montre `g.clock`, petite aiguille `((clock / 60) % 12) / 12 × 2π` et grande aiguille `(clock % 60) / 60 × 2π`.
- Produces (`34-paint-life.js`) :
  - `drawSmoke(g, x, y, t)` : trois bouffées qui montent au-dessus de la case ;
  - `drawBeam(g, x, y, t)` : un faisceau translucide qui tourne autour de la lanterne.
- **Quand la ville les dessine** (après les éléments) :
  - **fumée** : `maison` et `boulangerie` en automne et en hiver, et `boulangerie` avant 10 h ;
  - **faisceau** : un `phare` à l'étape 4 quand l'obscurité dépasse `.5`.

- [ ] **Step 1 : Écrire les tests.**
  - Dans `tests/paint.test.cjs`, un test « éléments animés : dans leur case à tout instant » :
    - pour `moulin`, `granderoue` (étape 4), `fontaine`, `source`, `fanions` et `horloge` ;
    - avec `time` à 0, 1,7, 3,3 et 10, `anim: true` : `assertInTile` ;
    - et les points de `horloge` diffèrent entre `clock: 0` et `clock: 360`.
  - Dans `tests/life-paint.test.cjs` (chargement de `PAINT` + `34-paint-life.js`, exposition `['drawSmoke', 'drawBeam', 'makePainter']`), un test « fumée et faisceau : dessinés, la fumée au-dessus de sa case » :
    - `drawSmoke` donne des points ;
    - tous ont `x` entre 150 et 250, et `y` sous 225.
- [ ] **Step 2 : Le voir échouer** — Run: `npm test`. Expected: FAIL (points de l'horloge identiques ; `drawSmoke is not defined`).
- [ ] **Step 3 : Implémenter.** Ajouter `'34-paint-life.js'` à `CLEAN_FILES`.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(dessins): le moulin tourne, l'horloge donne l'heure`.

### Task 10 : Météo et petites vies

**Files:**
- Modify: `src/34-paint-life.js`, `src/35-city.js`, `tests/life-paint.test.cjs`

**Interfaces:**
- Produces (`34-paint-life.js`), avec `area = { w, h, ground }`, où `ground` est le haut de l'île en pixels :
  - `drawWeather(g, amb, t, area, alpha = 1)`. Rien au soleil, sauf l'arc-en-ciel si `amb.rainbow` :
    - nuages : 2 à 4 ellipses claires qui glissent dans le tiers haut ;
    - pluie : 60 traits fins inclinés ;
    - neige : 50 flocons ;
    - brouillard : trois bandes blanches dégradées au niveau de l'île ;
  - `drawSeasonLife(g, amb, t, area, tiles)` :
    - pétales au printemps et feuilles à l'automne, 12 au plus ;
    - lucioles les nuits d'été sur les cases d'un `etang` ou d'un `jardin` ;
    - un vol d'oiseaux de jour, sauf pluie et neige : 5 oiseaux qui traversent toutes les 40 s.
- **Positions** : elles se calculent de l'indice et de `t`, sans état ni `Math.random`. En ville immobile, `t = 0`.
- **Pendant une pose** (`Mode.state`), la ville passe `alpha = .25` à la pluie et à la neige.

- [ ] **Step 1 : Écrire les tests** dans `tests/life-paint.test.cjs` :
  - au soleil sans arc-en-ciel, `drawWeather` ne donne aucun point ;
  - pluie, neige, nuages et brouillard donnent des points, tous dans la zone (`0 ≤ x ≤ w`, `0 ≤ y ≤ h`) ;
  - avec `amb.rainbow`, le soleil donne des points ;
  - `drawSeasonLife` en été la nuit, avec un `etang` dans `tiles`, donne des points ; en hiver, sans oiseau la nuit, aucun.
- [ ] **Step 2 : Le voir échouer** — Run: `npm test`. Expected: FAIL, `drawWeather is not defined`.
- [ ] **Step 3 : Implémenter**, puis brancher les deux couches dans `draw()`.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0`.
- [ ] **Step 5 : Commit** — `feat(ville): météo, oiseaux, pétales et lucioles`.

### Task 11 : Les habitants

**Files:**
- Modify: `src/24-ambient.js`, `src/34-paint-life.js`, `src/35-city.js`, `src/60-boot.js` (crochet), `tests/ambient.test.cjs`, `tests/life-paint.test.cjs`, `tests/ambient-browser.cjs`

**Interfaces:**
- Produces (`24-ambient.js`) :
  - `walkableTiles(): Array<{ x, y }>` : cases libres, `chemin` et `pasjaponais`, ligne par ligne ;
  - `walkerCount(moment): number` : `Math.min(6, Math.floor(S.city.tiles.length / 3))`, divisé par deux (à l'entier inférieur) la nuit, et 0 sans case où marcher ;
  - `todayDomains(): string[]` : les domaines de `CAT_ORDER` pratiqués aujourd'hui, d'après `S.stats.dailyCats[today()]`.
- Produces (`34-paint-life.js`) :
  - `drawWalker(g, sx, sy, look)`, avec `look = { lantern, umbrella, hat, color }` ;
  - `drawDoer(g, x, y, cat, t)` : lecteur (`esprit`), coureur (`corps`), méditant (`calme`), arroseur (`foyer`), peintre (`crea`).
- Produces (`35-city.js`) :
  - les promeneurs vont d'une case à sa voisine en 2,5 s puis s'arrêtent 1 à 3 s, de façon reproductible à partir de leur indice et du temps ;
  - un habitant par domaine pratiqué aujourd'hui, sur une case libre voisine d'un bâtiment de ce domaine, sinon sur une case où marcher ;
  - tous sont rangés en profondeur avec les éléments, à la clé `x + y` ;
  - `City.walkers(): { walkers: number, doers: string[] }`, pour les tests.

- [ ] **Step 1 : Écrire les tests.**
  - **Unitaires** (ajouter `'walkableTiles', 'walkerCount', 'todayDomains', 'today'` à `EXPOSE`) :

```js
test('habitants : un pour trois éléments, six au plus, moitié moins la nuit, aucun sans case où marcher', () => {
  const a = app();
  place(a, []);
  assert.equal(a.walkerCount({ name: 'day' }), 0);
  place(a, Array.from({ length: 9 }, (_, i) => ['maison', i % 7, Math.floor(i / 7)]));
  assert.deepEqual([a.walkerCount({ name: 'day' }), a.walkerCount({ name: 'night' })], [3, 1]);
  place(a, Array.from({ length: 30 }, (_, i) => ['maison', i % 7, Math.floor(i / 7)]));
  assert.equal(a.walkerCount({ name: 'day' }), 6);
  place(a, Array.from({ length: 49 }, (_, i) => [i === 3 ? 'chemin' : 'maison', i % 7, Math.floor(i / 7)]));
  assert.deepEqual(plain(a.walkableTiles()), [{ x: 3, y: 0 }]);
  place(a, Array.from({ length: 49 }, (_, i) => ['maison', i % 7, Math.floor(i / 7)]));
  assert.equal(a.walkerCount({ name: 'day' }), 0);
});

test("les habitants font comme toi : les domaines pratiqués aujourd'hui", () => {
  const a = app();
  a.state.stats.dailyCats[a.today()] = { calme: 10, esprit: 5, corps: 0 };
  assert.deepEqual(plain(a.todayDomains()), ['esprit', 'calme']);
});
```

  - **Dessin** : `drawWalker` et chaque `drawDoer` dessinent dans un carré de 60 px de côté autour de leur point, à `t` = 0 et 2.
  - **Navigateur** : ville de 9 éléments, Esprit pratiqué aujourd'hui (`dailyCats`), à 12 h ; `__ville.City.walkers()` vaut `{ walkers: 3, doers: ['esprit'] }`.
- [ ] **Step 2 : Le voir échouer** — Run: `npm test`. Expected: FAIL, `walkableTiles is not defined`.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` « Habitants ».
- [ ] **Step 5 : Commit** — `feat(ville): des habitants qui font comme toi`.

### Task 12 : Les visiteurs, dans la ville et dans leur fiche

**Files:**
- Modify: `src/34-paint-life.js`, `src/35-city.js`, `src/40-ui.js` (liste de la ville), `src/06-lang-fr.js`, `src/07-lang-en.js`, `styles.css`
- Create: `src/53-visits.js` ; Modify: `tests/i18n.test.cjs` (`CLEAN_FILES`), `tests/live-state.test.cjs`, `tests/life-paint.test.cjs`, `tests/ambient-browser.cjs`

**Interfaces:**
- Consumes : `visitorOf` (Task 5), `ambientAt` (Task 7), `GIFTS`, `celebrate`, `noticeProgress` (étape 2).
- Produces (`34-paint-life.js`) : `VISITOR_DRAW[id](g, spot, look, t)`, un dessin par visiteur :
  - `spot` est la place de `visitorSpot`, ou `{ sky: true, sx, sy }` avec la position à l'écran ;
  - `look = { night, season }` ;
  - variante de nuit : le chat dort, la montgolfière allume son brûleur, etc.
- Produces (`35-city.js`) :
  - le visiteur est dessiné à sa place : rangé en profondeur pour une case, juste après l'élément qu'il occupe (`on`), en dernier dans le ciel ;
  - un scintillement tant que `S.visits[id].last` n'est pas aujourd'hui ;
  - `City.visitorBox(): { x, y, w, h } | null` : la zone touchable à l'écran ;
  - toucher cette zone appelle `openVisitor()` ;
  - `City.visitorThumb(cv, id, size, { silhouette })`, comme `thumb`.
- Produces (`53-visits.js`) :
  - `meetVisitor(id, day): { first: boolean }` : une rencontre par jour, qui met à jour `S.visits[id]` ;
  - `claimVisitGift(day): boolean` :
    - refuse si `S.gifts['visit:' + day]` existe ou si `day !== today()` ;
    - sinon ajoute `GIFTS.visit` aux pièces et note la date ;
  - `openVisitor()` : rencontre, puis fenêtre avec :
    - la vignette ;
    - `visitor.<id>.name` et l'une des phrases `visitor.<id>.line1` à `line3`, tirée avec `chance(day + ':line')` ;
    - `visit.count` (pluriel) ;
    - le bouton `visit.gift` (« Recevoir 2 M ») s'il reste à recevoir, sinon `visit.giftDone` ;
    - à la première rencontre, `celebrate(noticeProgress(), t('visit.new', { name }))`.
- Produces (`53-visits.js`) : `lowerFirst(text)`, la première lettre en minuscule (« Le hérisson » → « le hérisson »), pour un nom au milieu d'une phrase (`visit.new`, `city.listVisitor`).
- Produces (`40-ui.js`) : en tête de `#cityList`, une ligne `city.listVisitor` (« Visiteur du jour : le chat voyageur ») qui ouvre la fiche.
- **Textes** (FR et EN) :
  - pour chacun des 12 visiteurs : `visitor.<id>.name`, `line1` à `line3` et `hint` (l'indice du carnet) ;
  - `visit.count`, `visit.gift`, `visit.giftDone`, `visit.thanks`, `visit.new`, `city.listVisitor`.

- [ ] **Step 1 : Écrire les tests.**
  - **Unitaires** (`live-state.test.cjs`, ajouter `'53-visits.js'` aux fichiers chargés et `'meetVisitor', 'claimVisitGift', 'today'` à `EXPOSE`, avec `commit` et `toast` remplacés) :

```js
test('rencontre : une par jour, la première se remarque', () => {
  const a = app({ commit: () => true, toast() {} });
  assert.deepEqual(plain(a.meetVisitor('chat', '2026-10-18')), { first: true });
  assert.deepEqual(plain(a.meetVisitor('chat', '2026-10-18')), { first: false });
  a.meetVisitor('chat', '2026-10-19');
  assert.deepEqual([a.state.visits.chat.count, a.state.visits.chat.last], [2, '2026-10-19']);
});

test("cadeau du visiteur : une fois par jour, et pas pour un jour déjà passé", () => {
  const a = app({ commit: () => true, toast() {} });
  a.state.clock.tz = 'Europe/Zurich'; a.state.clock.maxSeen = 0;
  const day = a.today(), coins = a.state.coins;
  assert.equal(a.claimVisitGift(day), true);
  assert.equal(a.claimVisitGift(day), false);
  assert.equal(a.state.coins, coins + 2e6);
  // Horloge reculée d'un jour : la veille est déjà passée, rien de plus.
  assert.equal(a.claimVisitGift(a.shiftDay(day, -1)), false);
  assert.equal(a.state.coins, coins + 2e6);
});
```

    (ajouter aussi `'shiftDay'` à `EXPOSE`).
  - **Dessin** : chacun des 12 visiteurs, posé au sol sur une case en (0, 0), de jour et de nuit, a tous ses points avec `x` entre 140 et 260 et `y` entre 115 et 255 ; la montgolfière, dans le ciel, reste dans sa zone.
  - **Navigateur** :
    1. ville amorcée avec un `banc` ;
    2. `__ville.ambient.force({ visitor: { id: 'chat', spot: { x: 2, y: 2, on: 'banc' } } })`, avec le banc en (2, 2) ;
    3. on touche le centre de `__ville.City.visitorBox()` : la fiche montre « Le chat voyageur » et « Recevoir 2 M » ;
    4. un toucher donne +2 M ;
    5. on rouvre : plus de bouton de cadeau ;
    6. la liste de la ville commence par « Visiteur du jour : le chat voyageur ».
- [ ] **Step 2 : Le voir échouer** — Run: `npm test`. Expected: FAIL, `meetVisitor is not defined`.
- [ ] **Step 3 : Implémenter.** Ajouter `'53-visits.js'` à `CLEAN_FILES`.
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` « Visiteur ».
- [ ] **Step 5 : Commit** — `feat(visiteurs): douze visiteurs et leur cadeau`.

### Task 13 : Les fêtes dans la ville

**Files:**
- Modify: `src/34-paint-life.js`, `src/35-city.js`, `src/53-visits.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/live-state.test.cjs`, `tests/life-paint.test.cjs`, `tests/ambient-browser.cjs`

**Interfaces:**
- Consumes : `festivalsOn`, `giftAmount` (Task 3).
- Produces (`34-paint-life.js`) :
  - `drawBunting(g, size, colors, t)` : fanions le long des deux bords avant de l'île ;
  - `drawFestival(g, fest, amb, t, area, spots)`, avec `spots` les cases libres du bord :
    - `nouvel-an` : feux d'artifice la nuit, confettis le jour ;
    - `printemps` : pétales et guirlandes de fleurs ;
    - `ete` : notes de musique, lampions la nuit ;
    - `recoltes` : citrouilles et bottes de paille sur `spots` ;
    - `lumieres` : guirlandes lumineuses ;
    - `anniversaire` : ballons et confettis.
- Produces (`53-visits.js`) : `greetFestivals(day): string[]`.
  - Pour chaque fête du jour sans cadeau, il ajoute `giftAmount(key)` aux pièces, note la date et renvoie la clé.
  - Le message est `fest.greet` (`'Bonne {name} ! Cadeau : {coins}'`), ou `fest.birthday` (`{ one: 'Ta ville a {n}\u00a0an ! Cadeau : {coins}', other: 'Ta ville a {n}\u00a0ans ! Cadeau : {coins}' }`).
  - Les succès passent par `celebrate(noticeProgress(), message)`.
- **Textes** (FR et EN) : `fest.<id>.name` pour les six fêtes, `fest.greet`, `fest.birthday`, `fest.next`, `fest.lived`.

- [ ] **Step 1 : Écrire les tests.**
  - **Unitaires** (ajouter `'greetFestivals'` à `EXPOSE`) :

```js
test('fête : un cadeau une fois par an, 10 M pour l’anniversaire', () => {
  const messages = [], a = app({ commit: () => true, toast: m => messages.push(m) });
  a.state.clock.tz = 'Europe/Zurich'; a.state.createdAt = Date.parse('2026-03-21T09:00:00Z');
  const coins = a.state.coins;
  assert.deepEqual(plain(a.greetFestivals('2027-03-21')), ['fest:printemps:2027', 'fest:anniversaire:2027']);
  assert.deepEqual(plain(a.greetFestivals('2027-03-21')), []);
  assert.equal(a.state.coins, coins + 5e6 + 10e6);
  assert.ok(messages.some(m => /Fête du printemps/.test(m)) && messages.some(m => /1 an/.test(m)), messages.join(' | '));
});
```

  - **Dessin** : chaque fête dessine des points dans sa zone, de jour et de nuit, et `drawBunting` reste entre les bords de l'île.
  - **Navigateur** :
    1. `page.clock.setFixedTime(new Date('2027-03-21T10:00:00Z'))`, ville amorcée (créée en 2026, un autre jour) ;
    2. au chargement, le message contient « Bonne Fête du printemps » et les pièces augmentent de 5 M ;
    3. après un rechargement, plus de message de fête et pièces inchangées.
- [ ] **Step 2 : Le voir échouer** — Run: `npm test`. Expected: FAIL, `greetFestivals is not defined`.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` « Fête ».
- [ ] **Step 5 : Commit** — `feat(fêtes): six fêtes et l'anniversaire de la ville`.

### Task 14 : Carnet « Visites », succès, saisons vues et légende

**Files:**
- Modify: `src/00-core.js` (succès), `src/23-achievements.js`, `src/52-carnet.js`, `src/53-visits.js`, `src/40-ui.js` (légende), `src/06-lang-fr.js`, `src/07-lang-en.js`, `styles.css`, `tests/live-state.test.cjs`, `tests/carnet.test.cjs`, `tests/ambient-browser.cjs`, `tests/i18n-browser.cjs` (largeurs de l'onglet Visites)

**Interfaces:**
- Produces (`00-core.js`) : cinq succès de la famille `life` :
  - `{ id: 'premiere-visite', kind: 'visitors', n: 1 }` ;
  - `{ id: 'bon-accueil', kind: 'visitors', n: 6 }` ;
  - `{ id: 'ville-hospitaliere', kind: 'visitors', n: 12 }` ;
  - `{ id: 'jour-de-fete', kind: 'festivals', n: 1 }` ;
  - `{ id: 'quatre-saisons', kind: 'seasons', n: 4 }`.
- Produces (`23-achievements.js`) :
  - conditions : `visitors` sur le nombre de clés de `S.visits`, `festivals` sur les clés `fest:` de `S.gifts`, `seasons` sur les clés de `S.seasons` ;
  - progression en `n` ; date de rattrapage 0.
- Produces (`53-visits.js`) :
  - `noteSeason(day): boolean` : note la saison si elle est nouvelle ;
  - `liveTick()`, appelé par `renderVille` :
    - `noteSeason` puis `greetFestivals` sur `ambientAt().day` ;
    - s'il y a du neuf, un seul `commit()` puis `celebrate` ;
  - `ambientCaption(amb): string` :
    - `life.moment.<name>` et `life.weather.<weather>` (avec `life.rainbow` si arc-en-ciel) ;
    - `visit.here` (« {name} est de passage ») ;
    - les noms des fêtes ;
    - le tout joint par ` · `.
- Produces (`52-carnet.js`) :
  - un quatrième onglet `['visits', 'carnet.tabVisits']` et `carnetVisits()` :
    - visiteurs rencontrés : vignette, nom, `visit.count`, `carnet.metSince` ;
    - les autres : silhouette, `carnet.visitorUnknown`, `visitor.<id>.hint` ;
    - fêtes : nom, années vécues (`fest.lived`) ou prochaine date (`fest.next`) ;
  - `carnetCounts()` gagne `visits: { have, total: 12 }`, et la carte une ligne `carnet.tabVisits`.
- Produces (`40-ui.js`) : la légende de la ville commence par `ambientCaption(ambientAt())`.
- **Textes** :
  - `ach.<id>.name` et `ach.<id>.desc` des cinq succès ;
  - `life.moment.*`, `life.weather.*`, `life.rainbow`, `visit.here` ;
  - `carnet.tabVisits`, `carnet.metSince`, `carnet.visitorUnknown`.

- [ ] **Step 1 : Écrire les tests.**
  - **Unitaires** :
    - **succès** : `checkAchievements()` donne `premiere-visite` avec une visite, `bon-accueil` avec six, `jour-de-fete` avec une clé `fest:`, `quatre-saisons` avec quatre saisons, et rien de cela sur une ville vide ;
    - **carnet** (`carnet.test.cjs`) : `ACHIEVEMENTS.length` vaut 38 et `carnetCounts().visits` vaut `{ have: 1, total: 12 }` après une visite ;
    - **saisons** : `noteSeason` note la saison une fois puis renvoie `false` ;
    - **légende** : `ambientCaption` avec `{ moment: { name: 'dusk' }, weather: 'rain', rainbow: false, visitor: { id: 'herisson' }, festivals: [{ id: 'printemps' }] }` vaut, en français, « Crépuscule · Pluie · Le hérisson est de passage · Fête du printemps ».
  - **Navigateur** :
    - le carnet a 4 onglets ;
    - « Visites » montre 12 visiteurs, dont 11 « Visiteur à découvrir » après une rencontre, et les 6 fêtes ;
    - rien ne déborde à 320 px ;
    - la légende de la ville commence par le moment.
- [ ] **Step 2 : Le voir échouer** — Run: `npm test`. Expected: FAIL (`ACHIEVEMENTS.length` vaut 33).
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` « Carnet des visites ».
- [ ] **Step 5 : Commit** — `feat(carnet): onglet Visites, cinq succès et légende vivante`.

### Task 15 : Les réglages de la ville vivante

**Files:**
- Modify: `src/45-settings.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/ambient-browser.cjs`

**Interfaces:**
- Produces, dans `settingsTheme()`, après le thème :
  - **Ciel de la ville** (`settings.sky`, `settings.skyTime`, `settings.skyTheme`) : un `.seg` de deux boutons, comme le thème ;
  - **Saisons** (`settings.seasons`, `settings.seasonsAuto`, `settings.seasonsNorth`, `settings.seasonsSouth`) : un `.seg` de trois boutons ;
  - **Ville animée** (`settings.ambient`, `settings.ambientNote`) : un interrupteur `role="switch"`, comme « Garder l'écran allumé ».
- Chaque changement : `commit({ silent: true })`, `City.draw()` et `City.wake()`.

- [ ] **Step 1 : Parcours navigateur** :
  1. **« Selon l'apparence »** : `--sky-top` en style disparaît de `#sky` ;
  2. **« Hémisphère sud »** en juillet (horloge fixée) : `__ville.ambient.at().season` vaut `'winter'` ;
  3. **« Ville animée » coupée** : `frames()` n'augmente plus ;
  4. **rechargement** : les trois réglages restent ;
  5. **en anglais**, la section Apparence ne déborde pas à 320 px.
- [ ] **Step 2 : Le voir échouer** — Run: `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Expected: FAIL, bouton « Selon l'apparence » introuvable.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` « Réglages de la ville vivante ».
- [ ] **Step 5 : Commit** — `feat(réglages): ciel, saisons et ville animée`.

### Task 16 : Planche, documentation et vérification d'ensemble

**Files:**
- Modify: `tests/board.cjs`, `README.md`, `README.fr.md`

- [ ] **Step 1 : Planche.** Avec `__ville.ambient.force`, de nouvelles images dans `test-results/planche/` :
  - `moments.png` : les cinq moments d'une même ville, côte à côte ;
  - `saisons.png` : les quatre saisons à midi ;
  - `meteo.png` : soleil, nuages, pluie, neige, brouillard, arc-en-ciel ;
  - `visiteurs.png` : les 12 visiteurs, de jour puis de nuit ;
  - `fetes.png` : les six fêtes ;
  - **mesure** : le temps moyen de dessin d'une image sur la ville 11 × 11 pleine, avec 4 fois moins de puissance (`Emulation.setCPUThrottlingRate`). Écrit dans la console de `npm run board`.
- [ ] **Step 2 : Relecture.**
  - Regarder chaque image et corriger ce qui est illisible.
  - Le temps de dessin doit rester sous 16 ms à 4 fois moins de puissance. Au-delà, mettre en cache le damier et les éléments immobiles.
- [ ] **Step 3 : Documentation.**
  - Tableau des fonctions des deux README : lignes Ville vivante, Visiteurs, Fêtes.
  - Structure : `24-ambient.js`, `34-paint-life.js`, `53-visits.js`.
  - Réglages : Ciel de la ville, Saisons, Ville animée.
- [ ] **Step 4 : Vérification d'ensemble** — Run: `npm run check && npm test && npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser && git status --short`. Expected :
  - syntaxe valide ;
  - `ℹ fail 0` ;
  - ligne finale habituelle ;
  - aucun fichier modifié hors du commit.
- [ ] **Step 5 : Commit** — `docs: étape 3 dans les README, planche de la ville vivante`.

### Task 17 : Voir la ville en grand

Ajoutée pendant la réalisation, à la demande de Ludovic (spécification, partie J).

**Files:**
- Modify: `index.html` (bouton `#cityExpand` dans `.sky` ; fenêtre `#cityBig`), `styles.css`, `src/35-city.js`, `src/06-lang-fr.js`, `src/07-lang-en.js`, `tests/ambient-browser.cjs`

**Interfaces:**
- Consumes : la boucle et `ambientRunning` (Task 8), `City.visitorBox` et `openVisitor` (Task 12).
- Produces (`index.html`) : `<div class="city-big" id="cityBig" role="dialog" aria-modal="true" aria-labelledby="cityBigTitle" hidden>` avec :
  - un titre caché `#cityBigTitle` ;
  - un canevas `#cityBigCanvas` ;
  - les boutons `#cityBigIn`, `#cityBigOut` et `#cityBigClose`.
- Produces (`35-city.js`) :
  - `City.openBig()`, `City.closeBig()` et `City.bigState(): { open, zoom }`, pour les tests ;
  - le rendu suit un seul canevas à la fois : `#cityBigCanvas` tant que la vue est ouverte, `#city` sinon ;
  - la vue remplit l'écran : la case n'est plus plafonnée à 76 px, et le zoom la multiplie, de 1 à 3 (× 1,5 par bouton). La molette et le pincement zooment autour du point visé ; le glissement déplace la vue, bornée pour que la ville reste visible ;
  - `ambientRunning()` vaut aussi vrai vue ouverte (fenêtres et session mises à part) ;
  - à l'ouverture, `history.pushState({ cityBig: true }, '')` ; `popstate` ferme la vue ; le bouton × revient en arrière dans l'historique.
- **Toucher la ville** hors pose et hors bâtiment appelle `City.openBig()`.
- **Textes** : `city.expand` (« Voir ma ville en grand »), `city.bigTitle` (« Ta ville en grand »), `city.zoomIn`, `city.zoomOut`, `city.bigClose`.

- [ ] **Step 1 : Parcours navigateur** dans `runAmbient` :
  1. **toucher une case vide** de `#city` : `#cityBig` est visible et le focus est sur `#cityBigClose` ;
  2. **zoom** : `#cityBigIn` donne `bigState().zoom === 1.5` ; une molette vers le haut sur le canevas l'augmente encore ; jamais au-delà de 3 ;
  3. **Échap** ferme la vue et rend le focus à `#cityExpand` ;
  4. **retour** : rouvrir avec `#cityExpand`, puis `page.goBack()` ferme la vue sans quitter la page (`#city` toujours là) ;
  5. **bâtiment** : toucher un bâtiment de la carte ouvre toujours sa fiche, pas la vue en grand ;
  6. **à 320 px**, rien ne déborde et les trois boutons restent visibles.
- [ ] **Step 2 : Le voir échouer** — Run: `npm run build && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Expected: FAIL, `#cityBig` introuvable.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier** — les trois commandes. Expected: `ℹ fail 0` ; une ligne `PASS` « Ville en grand ».
- [ ] **Step 5 : Commit** — `feat(ville): voir sa ville en grand`.
