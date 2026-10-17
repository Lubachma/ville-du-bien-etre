# Étape 1 — Langue, réglages et série bienveillante

Date : 18 octobre 2026. Projet : Ville du bien-être (`Lubachma/ville-du-bien-etre`).

## Intention

Ludovic veut que les gens aient envie de revenir dans leur ville plus longtemps, et que le jeu soit plus amusant. Il a demandé un classement des améliorations possibles, appuyé sur une analyse des concurrents (Forest, SleepTown, Focus Friend, Finch, Duolingo, Animal Crossing…). Il suit les recommandations, quitte à retirer après coup ce qui ne lui plaît pas. Contraintes posées : tout reste gratuit, sans serveur, et il veut pouvoir **changer la langue du jeu**.

Le travail est découpé en 4 étapes, publiables une à une :

1. **Langue, réglages et série bienveillante** (ce document).
2. Contenu : nouveaux bâtiments et décors, merveilles, succès, ensembles de voisinage, pose plus vivante.
3. Ville vivante : lumière selon l'heure, saisons, météo, vie ambiante, visiteurs, fêtes.
4. Rituels et partage : défis de la semaine, bilan du lundi, humeur, visite de la ville d'un ami, récapitulatifs.

La traduction passe en premier pour que tout le contenu des étapes suivantes soit créé directement en deux langues.

La série bienveillante arrive dès l'étape 1 parce que c'est la mécanique la mieux prouvée pour faire revenir sans culpabiliser, pour un coût minime :
- Duolingo : pouvoir geler sa série augmente le nombre d'utilisateurs actifs chaque jour, sans augmenter les jours sautés.
- Une méga-étude de Wharton (61 293 personnes, 54 programmes) : le meilleur programme offrait un petit bonus quand on revient après une séance manquée, avec +27 % de visites.
- La recherche (Silverman et Barasch, 2023) montre qu'une série visiblement cassée fait décrocher, surtout si on s'en blâme.

## Objectifs

- Jouer entièrement en **français ou en anglais**, au choix, avec une architecture qui permet d'ajouter d'autres langues (allemand, italien) en ajoutant seulement un dictionnaire.
- Une **série qui pardonne** : des jours de repos automatiques, une pause pour les vacances ou la maladie, aucun message de perte, et un cadeau quand on revient après une absence.
- De **nouveaux réglages utiles** : son de fin (choix, volume, vibration), début de semaine, série (repos, pause, masquer), rappel quotidien ajouté à l'agenda.

## Hors périmètre (étapes suivantes)

- Aucun nouveau bâtiment, succès, défi, visiteur, ni effet de saison ou de météo.
- Aucune autre langue que le français et l'anglais, et aucune traduction du manifeste (nom de l'app sur l'écran d'accueil).
- Aucune modification des règles de gain hormis la série et le cadeau de bon retour.

## À éviter absolument

- Tout message de perte ou de reproche (« série perdue », « tu as raté… »), même en anglais.
- Une interface anglaise qui garde des morceaux de français, ou l'inverse.
- Une régression pour les villes existantes : données perdues, série actuelle qui diminue, textes cassés.
- Des textes anglais plus longs qui débordent à 320 px de large.
- Tout ce qui demande un serveur, un compte ou un paiement.

## Contraintes

- **Technique** : JavaScript sans framework ni dépendance à l'exécution. Les sources sont dans `src/NN-*.js`, assemblées dans l'ordre des noms par `scripts/build.mjs`.
  - `app.js` et `sw.js` sont générés : ne pas les modifier à la main, lancer `npm run build`.
- **Données** : l'état reste au format v2 (clé `ville-bien-etre/v2`, sauvegardes `VBE2`). Les nouveaux champs sont facultatifs.
  - `normalize()` leur donne une valeur par défaut, et une ancienne version de l'app qui les lit les ignore sans erreur.
  - Les sauvegardes `VBE1` et `VBE2` existantes restent importables.
- **Tests** : `npm run check`, `npm test` et `npm run test:browser` doivent passer en local et dans le workflow de publication.
  - Les tests navigateur actuels cherchent des textes français. Playwright démarre en `en-US` par défaut, et la langue automatique afficherait donc l'anglais.
  - Les contextes de test existants doivent forcer le français (`locale: 'fr-FR'`) ; les nouveaux tests couvrent l'anglais.
  - Les tests unitaires chargent certains fichiers de `src/` dans une machine virtuelle Node. Le module de traduction doit y être chargé partout où des textes sont produits.
- **Hors connexion** : rien ne change au service worker, en dehors de ce que le build régénère.

## Partie A — Langue

### Ce qui est décidé

**Langues et réglage.** Le réglage « Langue » (dans les Réglages) propose **Automatique**, **Français** et **English**, chaque langue écrite dans sa propre langue. Il est stocké dans `S.settings.lang` (`'auto'`, `'fr'` ou `'en'`) et vaut `'auto'` par défaut.

**Mode automatique.** La première langue de `navigator.languages` (à défaut `navigator.language`) qui commence par `fr` donne le français, par `en` l'anglais. Si aucune ne correspond, l'app passe en anglais. *Choix de Claude : l'anglais est la langue de repli internationale, par exemple pour un ami germanophone.*

**Villes existantes.** Une ville enregistrée sans champ `lang` existait avant cette mise à jour : `normalize()` lui donne `'fr'`, et la personne garde donc son app en français. Seule une ville neuve (`defaultState()`) démarre en `'auto'`. Le cas s'applique aussi aux sauvegardes importées qui n'ont pas ce champ. *Choix de Claude : la mise à jour ne doit faire changer la langue de personne sans qu'on le demande.*

**Changement immédiat.** Changer de langue s'applique tout de suite, sans recharger :
- l'en-tête, la vue en cours, la barre d'onglets, les textes fixes de la page et la fenêtre des Réglages (re-rendue dans la nouvelle langue) ;
- `<html lang>` est mis à jour ;
- la ville est redessinée si nécessaire.

**Tout est traduit :**
- textes fixes de `index.html` : boutons, titres, introductions, `aria-label`, `placeholder`, `title` ;
- textes générés en JavaScript : vues, fenêtres, toasts, annonces aux lecteurs d'écran, bandeaux de stockage et de mise à jour, aide, mode strict, avertissement de veille ;
- écrans de session, carte d'installation (`70-install.js`) et messages de sauvegarde ;
- noms des 22 bâtiments et décors, noms des 5 domaines, niveaux de bâtiment, légende de l'export PNG.

**Ce qui ne change pas :**
- le nom de l'app « Ville du bien-être » (titre de la page, manifeste) reste identique dans les deux langues ;
- les noms de fichiers exportés peuvent rester en français.

**Noms des domaines en anglais.** Esprit → Mind, Corps → Body, Calme → Calm, Foyer → Home, Créativité → Creativity.

**Formats.**
- Nombres :
  - en français, virgule décimale et suffixes `k`, `M`, `Md` (actuel) ;
  - en anglais, point décimal et suffixes `k`, `M`, `B` (milliard) ;
  - même espacement insécable dans les deux langues.
- Dates et heures :
  - `fr-CH` en français, `en-GB` en anglais (24 h, jour avant mois) ;
  - les formats aujourd'hui créés une seule fois au chargement de `20-rules.js` doivent suivre la langue courante.
- Pluriels :
  - français : singulier pour 0 et 1 ;
  - anglais : singulier pour 1 seulement ;
  - utiliser `Intl.PluralRules` ou une règle équivalente par langue.
- Typographie : la typographie française (espaces insécables avant `: ; ! ? »` et après `«`, fonction `frTypo`) ne s'applique qu'en français.

**Genre grammatical.** Les messages français qui s'accordent avec le bâtiment (« construite / construit », « démolie / démoli », « verrouillée », « Construite le ») utilisent le genre du bâtiment, déjà connu (`fem`). L'anglais n'en a pas besoin.

**Ton.**
- Français : tutoiement, comme aujourd'hui.
- Anglais : naturel et chaleureux, avec « you », sans traduction mot à mot.
- Pas de termes techniques.

**Exemples par défaut.** Les activités, envies et obligations créées pour une nouvelle ville (« Lecture », « Faire la vaisselle »…) existent dans les deux langues.
- Une nouvelle ville les reçoit dans la langue courante.
- Tant qu'un élément porte exactement un nom par défaut (en français ou en anglais), il s'affiche dans la langue choisie, y compris dans l'historique et le tirage en cours.
- Dès que l'utilisateur le renomme, son nom reste tel quel.
- La fenêtre de modification se pré-remplit avec le nom affiché.

**Nom de la ville.**
- Le nom par défaut s'affiche « Ma ville » en français et « My town » en anglais.
- Un nom vide, ou exactement « Ma ville » (ancienne valeur par défaut), est considéré comme le nom par défaut.
- Un nom choisi par l'utilisateur ne change jamais.

**Garde-fou de traduction.** Un test vérifie que :
- chaque clé utilisée dans le code existe dans les deux dictionnaires ;
- aucune clé n'existe dans un dictionnaire seulement.

### Laissé au constructeur

- L'organisation des dictionnaires : un fichier `src/05-i18n.js` ou un dictionnaire par langue, le nommage des clés, la façon d'interpoler (`{name}`) et de marquer les textes fixes du HTML (attributs `data-i18n`, par exemple).
- La formulation anglaise exacte, dans le ton décrit plus haut.
- La façon d'exposer la traduction à `70-install.js`, qui s'exécute hors de l'IIFE principale. Par exemple un petit objet global en lecture seule.

## Partie B — Série bienveillante

### Ce qui est décidé

**Jours de repos automatiques.**
- Réglage « Jours de repos par semaine » : 0, 1 ou 2. Valeur par défaut : **2**.
  - *Choix de Claude : SleepTown accorde 2 jours de repos par semaine. Cela permet de garder sa série en pratiquant 5 jours sur 7.*
- Un jour sans session réussie ne casse pas la série tant que le nombre de jours de repos de sa semaine n'est pas dépassé.
- Un jour de repos ne compte pas dans la longueur de la série : il fait seulement le pont.
- La semaine suit le réglage « La semaine commence le » (voir partie C).

**Calcul de la série.** Il remplace `streak()` et `streakFrom()`. La série d'un jour J est le nombre de **jours actifs** (au moins une session réussie, c'est-à-dire `S.stats.days[jour] > 0`) de la chaîne qui se termine à J. On remonte les jours à partir de J :

1. Si le jour est **aujourd'hui** et qu'il n'a pas encore de session, on passe au jour précédent sans rien compter ni casser. C'est déjà le comportement actuel.
2. Un jour actif ajoute 1.
3. Un jour **en pause** (voir plus bas) fait le pont, sans compter ni consommer de repos.
4. Un jour inactif fait le pont s'il reste des jours de repos dans **sa** semaine. Le décompte des repos se fait semaine par semaine.
5. Sinon, on s'arrête.

Les ponts situés au-delà du dernier jour actif trouvé ne changent rien au résultat. `streakIfDoneOn(jour)` donne la série obtenue si ce jour devient actif. Le bonus reste `(série − 1) × 10 %`, plafonné à +50 %.

**Les règles s'appliquent aussi au passé.** La série est toujours recalculée à partir de l'historique des jours actifs et des pauses, avec les réglages **actuels**. Aucun historique des réglages n'est conservé. *Choix de Claude, pour rester simple et généreux :*
- **À la mise à jour**, une série existante ne peut que s'allonger, puisque les 2 jours de repos par défaut font le pont sur d'anciens trous. C'est une bonne surprise, pas une régression.
- **Augmenter les jours de repos ou changer le premier jour de la semaine** peut prolonger une série. Ce pardon a posteriori est accepté : il reste borné à 2 jours par semaine.
- **Diminuer les jours de repos** peut raccourcir la série en cours. Sous ce réglage, une note le dit clairement : « S'applique aussi à ta série en cours ».
- **La pause, elle, reste impossible dans le passé**, car elle n'a pas de limite de durée.

**Mode pause.**
- Un bouton « Mettre ma série en pause » dans les Réglages. La pause commence **aujourd'hui** et dure jusqu'à ce que l'utilisateur la reprenne.
- On ne peut pas mettre en pause des jours déjà passés : pas de réparation après coup.
- Pendant une pause, une session réussie compte normalement comme jour actif.
- Les pauses sont enregistrées dans `S.pauses`, une liste de `{ from: 'AAAA-MM-JJ', to: 'AAAA-MM-JJ' | '' }`. Une valeur `''` signifie « en cours ». On garde les 20 dernières.
- Reprendre fixe `to` à hier si la pause a duré au moins un jour complet. Si elle commençait aujourd'hui même, elle est simplement supprimée.

**Cadeau de bon retour.**
- La **première session réussie d'une journée** donne **+20 %** si les deux conditions suivantes sont réunies :
  - elle **commence une nouvelle série**, parce que la précédente s'est arrêtée (`streakIfDoneOn(aujourd'hui)` vaut 1) ;
  - au moins **2 jours d'affilée sans session réussie** la séparent du dernier jour actif.
- Les jours en pause ne comptent pas comme absence.
- Il faut avoir déjà eu au moins un jour actif : pas de cadeau pour une ville neuve.
- Le cadeau ne côtoie donc jamais une série entretenue : un week-end couvert par les jours de repos ne le déclenche pas.
- *Choix de Claude : le cadeau et la série sont des alternatives. +20 % reste inférieur à ce que rapporte une série entretenue (+10 à +50 % chaque jour). Il n'y a donc aucun intérêt à s'absenter exprès.*
- Le cadeau s'ajoute au bonus de tirage.
- Il apparaît dans l'aperçu de gain de la fenêtre de lancement et dans le détail du résultat, avec une ligne « Bon retour ! +20 % » ou « Welcome back! +20% ».
- Comme les autres bonus, il est fixé au lancement de la session (`a.promised`) et enregistré avec elle (`returnPct`, par exemple), pour rester exact si la session se termine le lendemain.

**Messages.**
- Plus aucune formulation de perte.
- Série active sans session aujourd'hui : le Journal indique ce qu'apporte une session (« Une session aujourd'hui : N + 1 jours ») et les jours de repos restants cette semaine.
- Série à 0 : un message d'élan (« Une session aujourd'hui lance ta série »).
- En pause : « En pause depuis le … » ; l'icône de la pastille d'en-tête montre la pause.

**Masquer la série.**
- Interrupteur dans les Réglages.
- Une fois masquée :
  - la pastille de série disparaît de l'en-tête ;
  - la carte « Série » du Journal est remplacée par « Jours actifs cette semaine » ;
  - le détail des gains dit « Bonus de régularité +x % », sans nombre de jours.
- Le bonus continue de s'appliquer.

### Laissé au constructeur

- La mise en page exacte des messages et de la carte du Journal.
- Les noms internes des fonctions.

## Partie C — Réglages

### Ce qui est décidé

La fenêtre des Réglages est réorganisée en sections, dans cet ordre (*choix de Claude*) :

1. **Bien démarrer** : aide, état hors connexion, recherche de mise à jour (existant).
2. **Langue** : sélecteur à 3 choix.
3. **Sessions** :
   - tolérance de sortie (existant) ;
   - garder l'écran allumé (existant) ;
   - son de fin : activé ou non, type, volume ;
   - vibration.
4. **Série** : jours de repos par semaine, pause, masquer.
5. **Semaine et rappel** : début de la semaine, rappel quotidien.
6. **Apparence** (existant).
7. **Mode strict** (existant).
8. **Sauvegarde** (existant).
9. **Tout recommencer** et rappel des règles de gain (existant, mis à jour avec les jours de repos et le cadeau de bon retour).

**Son de fin.**
- 3 sons synthétisés avec Web Audio, sans fichier audio. *Choix de Claude :* « Carillon » (l'actuel), « Bol chantant » (grave, long, apaisant) et « Clochettes » (léger, aigu).
- 3 volumes : Doux, Normal, Fort (gain environ ×0,5, ×1 et ×1,6).
- Chaque changement de son ou de volume joue un aperçu, dans le geste de l'utilisateur.
- Les réglages sont stockés dans `S.settings` (`soundType`, `soundVolume`).

**Vibration.**
- Interrupteur séparé (`S.settings.vibrate`, vrai par défaut).
- Affiché seulement si l'appareil sait vibrer (`navigator.vibrate`), ce qui exclut l'iPhone.
- Aujourd'hui, la vibration est liée au son : elle en devient indépendante.

**Début de semaine.**
- « Lundi » ou « Dimanche » (`S.settings.weekStart`, lundi par défaut).
- Il s'applique à l'objectif hebdomadaire (`goalWeek`, aujourd'hui fixé au lundi) et au décompte des jours de repos.

**Rappel quotidien.**
- Un champ heure (18:00 par défaut) et deux boutons. L'heure choisie peut être mémorisée sur l'appareil.
- **« Ajouter à mon agenda »** produit un fichier `.ics` :
  - un événement quotidien récurrent (`RRULE:FREQ=DAILY`) de 10 à 15 minutes, à l'heure locale choisie (heure flottante, sans fuseau) ;
  - une alerte à l'heure de l'événement ;
  - un titre et une description dans la langue courante.
  - Le fichier est partagé sur iPhone (feuille de partage, comme les sauvegardes) et téléchargé ailleurs.
- **« Google Agenda »** ouvre un lien de création d'événement pré-rempli (`calendar.google.com/calendar/render?action=TEMPLATE`), récurrent chaque jour. Il couvre Android, où l'app Google Agenda n'ouvre souvent pas un `.ics` téléchargé, ainsi que les ordinateurs. Le texte du rappel n'est envoyé à Google que si l'utilisateur touche ce bouton.
- **Aucun lien vers l'app dans l'événement.** Sur iPhone, un lien touché depuis l'agenda ouvre Safari, qui a un stockage séparé de l'app installée : la personne tomberait sur une ville vide. La description dit plutôt : « Ouvre la Ville du bien-être depuis l'icône de ton écran d'accueil. » *Choix de Claude.*
- Une note explique que l'app ne peut pas envoyer de notifications elle-même et que le rappel vit dans l'agenda.

### Laissé au constructeur

- Le dessin des sons, dans l'esprit décrit.
- La présentation des contrôles : segments ou listes, en restant cohérent avec l'existant.
- Les détails du fichier `.ics`, qui doit s'importer sans erreur dans Apple Calendrier et Google Agenda.

## Données et compatibilité

- Nouveaux champs de `S.settings` (avec valeur par défaut dans `defaultState()` et `normalize()`) : `lang`, `restDays`, `hideStreak`, `weekStart`, `soundType`, `soundVolume`, `vibrate`.
- Nouveau champ racine : `S.pauses` (liste, 20 éléments au plus, dates valides).
- Champ de session : un pourcentage de bon retour, conservé par `cleanActive()` et l'historique (comme `drawPct` et `streakPct`).
- Fusion entre onglets (`merge3`) :
  - les réglages passent déjà champ par champ (`mergeFields`) ;
  - pour `S.pauses`, la version locale l'emporte si elle a changé, comme pour `S.draw`.
- Aucune migration de stockage : la clé et le format restent ceux de la v2.

## Tests attendus

- **Unitaires :**
  - traduction : clés présentes dans les deux langues, interpolation, pluriels français et anglais, langue de repli, typographie française seulement en français ;
  - formats de nombres et de dates dans chaque langue ;
  - série : jours de repos par semaine (frontière de semaine selon `weekStart`), aujourd'hui sans session, pause en cours ou terminée, impossibilité de pause rétroactive, `streakIfDoneOn`, recalcul quand les réglages changent ;
  - cadeau de bon retour : nouvelle série après au moins 2 jours d'absence (cadeau), week-end couvert par les jours de repos (pas de cadeau), absence couverte par une pause (pas de cadeau), ville neuve (pas de cadeau), seulement la première session du jour, montant fixé au lancement ;
  - langue d'une ville existante sans champ `lang` : français ; ville neuve : automatique.
- **Navigateur :**
  - les parcours existants restent en français, avec un contexte `fr-FR` ;
  - nouveau parcours en `en-US` : interface automatiquement en anglais ;
  - passage en français puis retour en anglais depuis les Réglages, sans rechargement ;
  - persistance après rechargement ;
  - aucun débordement horizontal à 320, 390 et 768 px en anglais ;
  - un échantillon de mots français typiques absent des 4 vues et des Réglages en anglais ;
  - le fichier `.ics` téléchargé contient la règle de récurrence et l'alerte, sans lien vers l'app ;
  - le lien Google Agenda contient la récurrence quotidienne et l'heure choisie.

## Risques connus

- Le volume de traduction est le gros du travail : plusieurs centaines de textes répartis dans tous les fichiers.
- Le comportement exact d'iOS face à un fichier `.ics` partagé depuis une app installée ne peut être vérifié que sur un vrai iPhone.
