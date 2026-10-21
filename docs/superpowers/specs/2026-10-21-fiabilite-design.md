# Étape 7 — Fiabilité : rien ne se perd, rien ne se casse

Date : 21 octobre 2026. Projet : Ville du bien-être (`Lubachma/ville-du-bien-etre`). Les étapes 1 à 6 sont en ligne depuis le 18 octobre (version du commit `43a5adf`).

## Intention

Ludovic a demandé une analyse du projet : ce qu'il faut corriger et améliorer, puis ce qu'il serait intéressant d'ajouter pour attirer et garder des joueurs. Il a choisi de commencer par la fiabilité (« oui go ») : **tous les choix de ce document sont donc ceux de Claude**. Tout reste gratuit, sans serveur ni compte.

L'analyse a réuni cinq audits menés en parallèle (données et règles, séance et plateforme, interface et accessibilité, ville et rendu, recherche produit), un parcours de nouveau venu et la suite de tests sur Chromium et WebKit. Elle a relevé une quarantaine de défauts, chacun reproduit par un script. Plusieurs touchent les principes mêmes du jeu :
- **« Rien ne se perd »** : quatre chemins, rares mais définitifs, font perdre des données. Ce sont un onglet resté sur l'ancienne version, une écriture refusée, une sauvegarde modifiée et une horloge avancée par erreur.
- **« La séance d'abord »** :
  - un « null » s'affiche sur l'écran de fin de chaque nouveau venu ;
  - une ambiance peut tourner en boucle dans la ville ;
  - l'écran peut s'éteindre pendant une séance Concentration.
- **« Pour tout le monde »** : le focus clavier se perd, l'option choisie se voit à peine, et l'en-tête se casse à 320 px.

Cette étape corrige ces défauts **avant toute nouveauté**, pour deux raisons :
- les étapes suivantes (visibilité, premiers pas, diffusion) vont amener de nouvelles personnes ;
- elles vont aussi ajouter des champs, et la protection des champs inconnus doit être en ligne avant.

Le reste de l'analyse (performance, acquisition, rétention) est classé pour les étapes suivantes.

## Objectifs

- **Aucune perte de données** dans les cas trouvés, et une protection générale : un onglet en retard d'une version ne peut plus effacer ce qu'il ne connaît pas.
- **Aucun texte technique visible** (« null », « undefined », « NaN »).
- **Des séances qui tiennent leurs promesses**, sur iPhone aussi :
  - aucun son hors séance ;
  - l'écran reste allumé ;
  - le son revient après une interruption.
- **Les bonnes images** : l'image exportée montre sa propre ville, sous le ciel du moment.
- **Accessibilité** au niveau WCAG 2.2 AA sur les points relevés : focus, contraste, annonces, temps pour annuler.
- **Des tests qui veillent** : à chaque push, et aussi sur WebKit, le moteur de Safari.

## Hors périmètre

- **Aucune nouvelle fonction.** Les seuls nouveaux textes sont ceux qu'exigent les corrections.
- **Aucun nouveau champ enregistré** : un onglet encore sur l'étape 6 n'a donc rien de nouveau à effacer.
- **La performance**, réservée à une étape « Batterie » :
  - mise en cache de la ville par vignettes ;
  - point de reprise léger pendant les séances ;
  - cache des couleurs calculées ;
  - passages progressifs entre les moments de la journée ;
  - changement de densité d'écran.

  Seul le pincement, qui dessine trois fois par image, est corrigé ici, car c'est un défaut. L'anneau de la séance l'est aussi : la correction tient en une ligne.
- **D'autres points laissés pour plus tard** :
  - l'horloge corrigée pendant une séance (saut de quelques secondes) ;
  - le fuseau modifiable ;
  - le mode « compte claude.ai » ;
  - les empreintes par fichier du précache.
- **Rien de l'étape 8** : page d'accueil, aperçus de lien, premiers pas, ville mise à l'abri, habitants variés.

## À éviter absolument

- **Une régression pour les villes existantes** : pièces, série, succès, compagnon ou ville modifiés à l'ouverture de la nouvelle version.
- **Changer une règle du jeu** (gains, prix, série, cadeaux) au-delà de ce que dit ce document.
- **Rendre la triche à l'horloge plus facile** qu'aujourd'hui pour les cadeaux. Pour la série, voir le prix accepté d'A4.
- **Un rechargement automatique qui interrompt une séance** ou efface une saisie en cours.
- **Des textes qui débordent à 320 px**, en français comme en anglais.

## Contraintes

- **Architecture inchangée** :
  - JavaScript sans dépendance à l'exécution, sources dans `src/NN-*.js` ;
  - `app.js` et `sw.js` générés par `npm run build`, jamais modifiés à la main.
- **Format v2 inchangé.** Les sauvegardes `VBE1` et `VBE2` restent importables.
- **Tests** : `npm run check`, `npm test` et `npm run test:browser` passent en local, dans le nouveau workflow de vérification et dans le workflow de publication.
- **Textes** : dans les deux dictionnaires, avec le tutoiement en français.

## Partie A — Rien ne se perd

### A1. Un onglet en retard ne peut plus effacer ce qu'il ne connaît pas

Aujourd'hui, `normalize()` reconstruit l'état à partir de `defaultState()`. Tout ce qu'une version ne connaît pas disparaît donc à sa première écriture :
- une clé ;
- un réglage ;
- un succès ou un ensemble ;
- un cadeau ;
- une case dont l'élément n'existe pas encore pour elle ;
- un champ ajouté au journal.

Un onglet resté sur l'étape 5 efface ainsi le compagnon de l'étape 6, pour de bon.

**Ce qui est décidé**

- **Inconnu, c'est ce que `normalize()` retire du document enregistré.** À chaque écriture locale, ces parties sont reprises du document enregistré et remises telles quelles dans le texte écrit :
  - clés inconnues, à tous les niveaux d'objet ;
  - entrées inconnues des tables : succès, ensembles, cadeaux, visites, saisons, cartes postales ;
  - éléments inconnus des listes à identifiant : cases de la ville, activités, envies, obligations, routines, journal ;
  - champs inconnus des éléments de ces listes.
- **Rien de tout cela n'entre dans l'état en mémoire** : le code qui parcourt les succès ou les cases ne voit jamais d'identifiant inconnu.
- **Seulement pour la même ville** : le document enregistré doit avoir le même `createdAt` que l'état écrit.
- **Une valeur posée par cette version l'emporte toujours.** Les parties inconnues ne remplissent que les places vides : une clé absente, un objet présent des deux côtés. Un objet devenu `null` de ce côté (une séance terminée, par exemple) le reste.
- **Listes sans identifiant** (pauses, étapes d'une routine) : la version courante l'emporte. C'est noté pour les étapes futures : ne pas y ranger de données qui comptent.
- **Restauration d'une sauvegarde et « Tout recommencer » remplacent tout** :
  - aucune fusion avec ce qu'un autre onglet aurait écrit entre-temps ;
  - aucune reprise des parties inconnues de l'ancienne ville.
- **Fusion entre onglets** :
  - quand l'une des deux versions est une autre ville (date de création différente de celle de la base), cette ville l'emporte entière ;
  - les autres parties de la fusion ne changent pas. Une remise à zéro ne fait donc plus revenir le terrain, les visiteurs, les cartes postales ou le compagnon de l'ancienne ville.
- **Un onglet en retard se recharge de lui-même.** C'est le cas d'un onglet dont le service worker a changé sans qu'il l'ait demandé, quand l'utilisateur a mis à jour ailleurs. Il se recharge dès qu'il est au repos, c'est-à-dire :
  - qu'aucune séance ne tourne dans cet onglet ;
  - qu'aucune fenêtre n'y est ouverte, ou qu'il passe en arrière-plan.

  En attendant, le bandeau « Mettre à jour » reste affiché, comme aujourd'hui.
- **Une règle notée pour les étapes suivantes** (README, partie « Données »), parce que la protection repose sur elle : ne jamais changer le sens d'un champ existant. Pour une nouvelle donnée, ajouter un champ.

**Laissé au constructeur** : la forme des « parties inconnues » et leur calcul, fait une fois par lecture du document. Il est souhaitable que le cas courant (aucune partie inconnue) ne coûte ni copie ni temps.

**Limite** : seules les écritures faites par cette version et les suivantes sont protégées. Comme l'étape 7 n'ajoute aucun champ, un onglet encore sur l'étape 6 n'a rien à effacer.

### A2. Une écriture refusée ne fait plus compter deux fois

Quand `saveLocal()` fusionne avec la version d'un autre onglet puis que l'écriture échoue (stockage plein, écriture non confirmée), la base n'est pas mise à jour. La fusion suivante rejoue alors une seconde fois les changements de l'autre onglet : achats débités deux fois, complicité comptée deux fois.

**Ce qui est décidé** : juste après la fusion, la base devient la version lue, comme dans `pullLocal()`, que l'écriture réussisse ou non.

### A3. Une date impossible ne bloque plus l'app

Aujourd'hui, `maxSeen` et `updatedAt` sont bornés à 9e15, au-delà de la plus grande date que JavaScript sait représenter. Une sauvegarde modifiée, ou une horloge réglée après 2099, bloque alors l'app pour toujours, même après « Tout recommencer ». Une variante fait aussi repayer les étoiles à chaque rechargement.

**Ce qui est décidé**
- **Bornes** :
  - `maxSeen` et `updatedAt` : une date valide (`validTs`), sinon 0 ;
  - `lastDay` : au plus le jour de la plus grande des deux valeurs entre maintenant et `maxSeen` ;
  - une clé de jour doit être une vraie date : « 2026-02-30 » ne l'est pas.
- **Restauration** : un `maxSeen` situé plus d'un jour dans le futur est ramené à maintenant, et `lastDay` au plus au jour d'aujourd'hui.
- **Réparation** : une ville déjà bloquée se répare d'elle-même à l'ouverture, puisque `normalize()` corrige ces valeurs.

### A4. Une horloge avancée par erreur ne fige plus la ville

Aujourd'hui, tout enregistrement fait avancer l'horloge de la ville jusqu'à l'heure du téléphone (`touchClock()` dans `commit()`) : une saison vue, un souhait, un réglage. Si l'heure est avancée par erreur, puis corrigée, deux choses arrivent :
- la ville reste figée à cet instant futur (ciel, tour de l'horloge, météo, visiteur) jusqu'à ce que la vraie heure le rattrape ;
- les séances des jours suivants sont toutes comptées ce jour-là, et la série retombe de 15 à 1.

**Ce qui est décidé**
- **Seules les fins de séance font avancer l'horloge de la ville** (`maxSeen`) : réussie, interrompue, abandonnée ou reprise après fermeture. Les autres enregistrements n'y touchent plus.
- **Le ciel suit toujours l'heure réelle du téléphone** : la lumière, le moment de la journée et la tour de l'horloge. **Le jour garde l'anti-recul** : météo, visiteur, fêtes et date des séances.
- **Conséquence voulue** : une séance ne se date jamais avant la dernière séance, et un cadeau de visiteur ou de souhait ne se reçoit jamais pour un jour antérieur au dernier cadeau du même genre. Une horloge avancée puis remise ne fige plus rien si aucune séance n'a eu lieu entre-temps.
- **Prix accepté** : reculer la date du téléphone permet de dater une séance d'un jour manqué après la dernière séance, même si l'app a été ouverte entre-temps (avant cette étape, seulement si elle ne l'avait pas été). Toute protection plus forte ramènerait la ville figée ; le jeu est solo et sans classement.
- **Risque accepté** : une séance faite pendant que l'horloge était en avance garde ce jour-là. Les suivantes s'y rattachent jusqu'à ce que la vraie date le rattrape, comme aujourd'hui.

### A5. Les chiffres disent vrai

- **Le solde**
  - Il est arrondi vers le bas : « 3 M » s'affiche seulement si l'on a au moins 3 M.
  - On passe à l'unité suivante après l'arrondi : « 999 k », puis « 1 M », jamais « 1000 k ».
  - Les prix gardent l'arrondi actuel.
- **Le récapitulatif du mois**
  - Il montre le nombre de séances, la plus longue séance et les humeurs seulement si le journal (150 dernières séances) couvre tout le mois, comme c'est déjà le cas pour l'année.
  - Le temps de pratique, les jours actifs et les domaines, qui ne dépendent pas du journal, restent toujours affichés.
- **Une sauvegarde collée** est acceptée même coupée en lignes, ou avec des espaces : on les ignore.

## Partie B — Les séances

### B1. Aucun « null » sur l'écran de fin

Sans compagnon visible, l'écran de fin (réussite ou interruption) écrit « null ». Cela touche chaque nouveau venu dès sa première récompense, et toute personne qui a refusé ou masqué le compagnon. Les deux appels de `src/50-session.js` passent `null` à `append()`, qui l'écrit en texte.

**Ce qui est décidé** : ces deux appels ne passent plus jamais `null`. Une garde dans les tests vérifie qu'aucun écran ne montre « null », « undefined » ou « NaN » (Partie E).

### B2. Aucune ambiance hors séance

La fenêtre « Ambiance », ouverte pendant la séance, reste ouverte sur l'écran de fin. Toucher une ambiance y lance alors des boucles sans arrêt programmé, qui continuent dans la ville.

**Ce qui est décidé**
- La fin d'une séance ferme la fenêtre « Ambiance ».
- Hors séance, choisir une ambiance enregistre seulement le choix. L'aperçu des réglages reste un aperçu, qui s'arrête de lui-même.

### B3. L'écran reste allumé

Une courte sortie, que seul le tic du chrono remarque, ne redemande pas l'écran allumé. Si iOS a relâché le verrou pendant ce temps, le téléphone se verrouille environ 30 s plus tard, et la séance Concentration échoue sans faute de la personne.

**Ce qui est décidé**
- **Redemander le verrou** : pendant une séance Concentration, page visible et écran allumé demandé, un verrou absent ou relâché est redemandé, au plus une fois toutes les 5 s.
- **Statut fidèle** : le statut affiché suit l'état réel du verrou.
- **Réponse tardive** : une réponse qui arrive après la fin de la séance relâche aussitôt le verrou.

### B4. Le son revient après une interruption

Un appel, Siri ou le verrouillage peuvent mettre le son en état « interrompu ». Il n'est jamais relancé pendant la séance.

**Ce qui est décidé**
- **Relance** : au retour au premier plan, ou quand l'état du son change pendant une séance, on demande la relance.
- **Repli au toucher** : si le navigateur refuse sans geste, on relance au premier toucher. Ce toucher compte aussi à la fin du geste (`pointerup`, `click`), car un doigt n'active pas le son dès `pointerdown`.
- **Son de fin préparé** : quand une Activité libre reprend après réouverture de l'app, le son de fin est préparé au premier toucher, même sans ambiance.

### B5. Les autres onglets restent utilisables pendant une séance

Toutes les 5 s, la séance enregistre son point de reprise. L'autre onglet ferme alors sa fenêtre ouverte et annule une pose en cours.

**Ce qui est décidé** : quand seule la séance en cours a changé (point de reprise, propriétaire, révision), l'autre onglet met son état à jour sans fermer sa fenêtre ni annuler une pose.

### B6. Un anneau sobre

L'anneau de la séance relance sa transition toutes les 250 ms : il se repeint sans arrêt, écran allumé.

**Ce qui est décidé** : il avance une fois par seconde, sans transition.

### B7. Un rappel à l'heure choisie

Un rappel à 02:30, créé autour du passage à l'heure d'été, sonne aujourd'hui à 03:30 pour toujours.

**Ce qui est décidé** : la date et l'heure choisies sont écrites telles quelles, en heure flottante, dans le fichier `.ics` et dans le lien Google Agenda, sans passer par un instant `Date`.

## Partie C — La ville et ses images

### C1. L'image de ma ville est ma ville

Pendant une visite, « Enregistrer une image » exporte la ville de l'ami, avec ton nom et tes chiffres.

**Ce qui est décidé** : l'image dessine toujours sa propre ville, sur un canevas à part, avec la mise en page de la carte de la ville. C'est vrai quelle que soit la vue ouverte : visite ou vue en grand.

### C2. Sous le ciel du moment

L'image exportée et celle du récapitulatif prennent le ciel du thème : une ville de nuit sous un ciel de jour à 22 h, par exemple.

**Ce qui est décidé**
- Quand le réglage « Ciel de la ville » suit l'heure, ces images prennent le ciel du moment : sa lumière, son assombrissement par la pluie ou les nuages, et ses étoiles la nuit, comme la ville affichée. Sinon, elles gardent le ciel du thème.
- Une seule fonction sert aux deux images.

### C3. Un zoom fluide

Dans la vue en grand, un pincement dessine trois fois par image affichée, et chaque cran de molette dessine tout de suite.

**Ce qui est décidé** : la vue change aussitôt, mais le dessin attend l'image suivante. Il n'y a qu'un seul dessin par image.

### C4. Des noms reçus propres

Certains noms reçus par lien s'affichent vides alors qu'ils semblent visibles : remplissage hangeul, blanc braille, étiquettes invisibles. Un séparateur de ligne coupe le nom en deux, et une coupure peut laisser une moitié d'émoji.

**Ce qui est décidé**
- **Un seul nettoyage** pour les noms de ville partagée et du compagnon.
- **Caractères retirés** : les caractères de format et ignorables, les séparateurs de ligne et de paragraphe, et les blancs qui ressemblent à un caractère.
- **Nom valable** : il contient au moins une lettre, un chiffre, un symbole, une ponctuation ou un émoji.
- **Coupure** : un nom trop long est coupé entre deux caractères entiers, jamais au milieu d'un émoji.

## Partie D — Interface et accessibilité

### D1. Le focus ne se perd plus

Après la plupart des actions qui redessinent l'écran, le focus tombe sur `body` : enregistrer, supprimer, tirer au sort, relancer, accueillir le compagnon, fermer le Carnet, changer un défi, démolir.

**Ce qui est décidé**
- **Après une action** : le focus revient sur l'élément d'origine. S'il a été redessiné, il va sur son remplaçant, qui porte la même clé ; sinon, sur le titre de la vue.
- **Après une suppression** : le focus va sur l'élément voisin de la liste.
- **Vue en grand** : à sa fermeture, le focus revient à ce qui l'avait ouverte, y compris une carte postale du Carnet.
- **Fenêtre qui vient de s'ouvrir** : elle ne vole plus le focus d'un champ mis en avant entre-temps. C'est la course des 30 ms qui fait échouer la suite de tests sur WebKit.

### D2. Le temps d'annuler

Après une suppression, « Annuler » disparaît au bout de 6 s, l'annonce n'en parle pas, et le bouton est loin au clavier.

**Ce qui est décidé**
- **Durée** : le message d'une suppression reste jusqu'à l'action suivante (un autre message, un changement d'onglet, une fenêtre qui s'ouvre), et non plus 6 s.
- **Annonce** : elle dit qu'on peut annuler.
- **Survol et focus** : tant que le message a le focus ou la souris, rien ne le ferme.

### D3. Ce qui est choisi se voit

**Ce qui est décidé**
- **Contrôles segmentés** (Envies / Obligations / Les deux, la dizaine de réglages, les onglets du Carnet) : l'option choisie se distingue à au moins 3:1, en thème clair comme en sombre, avec un fond foncé et un texte clair comme les puces.
- **Textes**
  - Le texte indicatif des champs atteint au moins 4,5:1.
  - La note du bandeau « séance en cours ailleurs » atteint au moins 4,5:1 en thème sombre.
- **Contour de focus** : il reste entier dans la barre des rubriques de la boutique.

### D4. L'en-tête à 320 px

Un nom de ville long se coupe au milieu des mots, sur 5 à 7 lignes.

**Ce qui est décidé** : sur un écran étroit, les pastilles du solde et de la série passent sous le nom quand il ne tient pas. Le nom ne se coupe qu'entre les mots, sauf un mot plus long que la ligne.

### D5. Les petites annonces

**Ce qui est décidé**
- **Pastille de série** : elle est lue « 7 jours de série », et non « 7 j ».
- **Éditeur de routine** : l'ajout d'une étape est annoncé.
- **Carte des défis** : son nom suit la langue choisie.
- **Nom fait seulement d'espaces** (envie, obligation, activité, routine, ville) : il affiche le message « champ requis », comme un champ vide, au lieu de ne rien faire.

## Partie E — Des tests qui veillent

**Ce qui est décidé**
- **Un workflow « Vérifier »** tourne à chaque push et à chaque pull request :
  - `npm run build`, suivi d'une vérification que `app.js` et `sw.js` sont à jour dans le dépôt ;
  - `npm run check` et `npm test` ;
  - `npm run test:browser` sur Chromium, puis sur WebKit dans une tâche séparée.

  Le workflow de publication reste manuel.
- **La suite navigateur passe sur WebKit** : la molette y est simulée par un événement quand Playwright ne la permet pas, et le défaut de focus D1 est corrigé.
- **Compatibilité entre versions** :
  - un état « du futur », avec des champs inconnus à tous les niveaux, passe par lecture, fusion, écriture et nouvelle lecture sans rien perdre ;
  - une restauration et une remise à zéro ne reprennent rien de l'ancienne ville.
- **Garde générique** : aucun « null », « undefined » ou « NaN » visible sur les écrans de fin, la ville, le Journal, la boutique et les réglages.
- **Horloge** : les tests couvrent une horloge avancée puis reculée, une sauvegarde datée du futur et un `maxSeen` invalide. Aujourd'hui, presque tous les tests posent `maxSeen = 0`.
- **Focus** : après les actions de D1, il n'est jamais sur `body`.

## Données et compatibilité

- **Aucun nouveau champ.** Le format v2 est inchangé. `maxSeen`, `updatedAt` et `lastDay` sont seulement mieux validés.
- **Le texte écrit peut désormais contenir des parties inconnues** venues d'une version plus récente. Les versions actuelles les ignorent à la lecture, comme toute clé inconnue.
- **Les sauvegardes VBE1 et VBE2 restent importables.** Une sauvegarde datée du futur s'importe avec une horloge ramenée à aujourd'hui.

## Tests attendus

- **Parties inconnues**
  - Les clés inconnues sont gardées, à la racine, dans les réglages et dans un objet imbriqué.
  - Dans les tables, les succès, ensembles et cadeaux inconnus sont gardés.
  - Dans les listes à identifiant, une case dont l'élément est inconnu est gardée, ainsi qu'un champ inconnu sur une activité ou une entrée du journal.
  - Une valeur posée par cette version l'emporte.
  - Le cas courant ne coûte pas de copie.
  - Rien n'est gardé quand la ville est autre, ni après une restauration ou une remise à zéro.
- **Fusion**
  - Une écriture refusée suivie d'une écriture réussie donne les bons chiffres : 83 M et non 68 M ; la complicité est juste.
  - Une remise à zéro faite dans un autre onglet l'emporte.
- **Horloge**
  - `maxSeen` à 9e15 : l'app s'ouvre, et rien n'est repayé.
  - `lastDay` en 2099 : il est ramené.
  - Une horloge avancée puis reculée sans séance ne fige rien, et la série est gardée.
  - Une séance pendant l'avance garde son jour.
  - Le ciel suit l'heure réelle.
  - Aucun cadeau n'est reçu deux fois.
- **Chiffres**
  - Le solde est arrondi vers le bas, y compris aux passages d'unité.
  - Au-delà de 150 séances dans le mois, le récapitulatif n'affiche pas de chiffres faux.
  - Une sauvegarde coupée en lignes est acceptée.
- **Séances**
  - Aucun « null » sur l'écran de fin, sans compagnon comme avec un compagnon masqué.
  - L'ambiance est fermée à la fin, et aucun son ne suit.
  - Le verrou d'écran est redemandé.
  - Un verrou arrivé après la fin est relâché.
  - Le son est relancé.
  - L'autre onglet garde sa fenêtre pendant une séance.
  - Un rappel posé autour du passage à l'heure d'été garde l'heure choisie.
- **Images et ville**
  - L'export pendant une visite montre sa propre ville.
  - Le ciel de nuit est sur l'image en thème clair à 22 h.
  - Le pincement ne fait qu'un dessin par image.
  - Les noms invisibles ou coupés sont refusés ou réparés.
- **Interface**
  - Le focus est restitué après chaque action de D1.
  - Le message d'une suppression reste et l'annonce parle de l'annulation.
  - Les contrastes de D3 sont mesurés sur les variables CSS, dans les deux thèmes.
  - L'en-tête tient à 320 px avec un nom long, en français et en anglais.
- **WebKit** : la suite entière passe.

## Risques connus

- **Parties inconnues gardées telles quelles.** Une donnée invalide venue d'une version future reste dans le stockage tant que cette version l'ignore. C'est sans gravité : chaque version la retire de sa lecture.
- **Rechargement automatique.** Il n'a lieu qu'au repos. Une fenêtre ouverte le retarde, et le bandeau reste en attendant.
- **Horloge.** Une séance faite pendant que l'horloge était en avance garde ce jour-là (A4).
- **Horloge réparée au démarrage seulement.** Une fusion avec un onglet resté sur l'étape 6 peut refiger la ville jusqu'au démarrage suivant.
- **WebKit dans le workflow.** La vérification est plus longue, environ 5 minutes de plus. Si la tâche WebKit devient instable, elle reste séparée et n'empêche pas de publier.
- **Focus restitué.** Un élément redessiné sans clé stable ramène le focus au titre de la vue : c'est mieux que `body`, mais moins précis. Les tests couvrent les actions listées en D1.
