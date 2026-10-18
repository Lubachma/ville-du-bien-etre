# Étape 3 — Ville vivante : lumière, saisons, météo, habitants, visiteurs et fêtes

Date : 18 octobre 2026. Projet : Ville du bien-être (`Lubachma/ville-du-bien-etre`). Suite de la feuille de route décrite dans `2026-10-18-langue-reglages-serie-design.md` ; les étapes 1 et 2 sont en ligne depuis le 18 octobre.

## Intention

Ludovic veut que les gens aient envie de revenir dans leur ville plus longtemps, et que le jeu soit plus amusant. Il suit les recommandations, quitte à retirer après coup ce qui ne lui plaît pas. Pour cette étape, il a demandé de faire directement ce qui est recommandé, sans questions : **tous les choix de ce document sont donc ceux de Claude**. Tout reste gratuit, sans serveur ni compte.

Après l'étape 2, la ville a de quoi occuper un an, mais elle reste figée : on la retrouve toujours identique. Cette étape la rend vivante, pour que chaque ouverture soit un peu différente :
1. **la lumière suit l'heure** : aube, journée, fin d'après-midi, crépuscule, nuit ;
2. **les saisons passent** : feuillage, neige sur les toits ;
3. **une météo par jour** : soleil, nuages, pluie, neige, brouillard ;
4. **des habitants** se promènent, et ceux qui font **les mêmes activités que toi aujourd'hui** apparaissent ;
5. **des visiteurs** passent certains jours, avec un petit cadeau ;
6. **des fêtes** marquent l'année, dont l'anniversaire de ta ville.

Ce que font les concurrents, et ce qu'on en garde :
- **Animal Crossing** : l'horloge réelle, les saisons, un visiteur différent selon les jours et des fêtes qui reviennent chaque année. C'est le plus fort pour donner envie de revenir chaque jour. Mais l'île punit l'absence (mauvaises herbes, villageois qui partent) : on ne le reprend pas.
- **Neko Atsume** : des visiteurs qui passent, laissent un cadeau, et un carnet pour les collectionner, sans aucune perte si on ne vient pas.
- **Stardew Valley** : saisons, météo du jour et calendrier de fêtes.
- **Finch** : des événements de saison doux, dans une app de bien-être.
- **Habitica** : ses objets de fête à durée limitée créent la peur de rater quelque chose. C'est l'exemple à ne pas suivre.
- **Townscaper, Tiny Glade** : le plaisir des petits détails qui vivent : oiseaux, fumée, mouvements discrets.

Deux principes guident tout le reste :
- **Rien ne se dégrade et rien ne se rate pour toujours.** Une ville où l'on n'est pas venu reste belle, les visiteurs reviennent, les fêtes reviennent chaque année.
- **Une ville vivante doit rester légère** : peu d'images par seconde, arrêt quand on ne la regarde pas, et une ville immobile pour qui demande moins d'animations.

## Objectifs

- **Chaque ouverture est un peu différente** : le moment de la journée, la saison, la météo et qui est en ville.
- **Les activités du jour se voient dans la ville** : un habitant fait la même chose que toi.
- **Une raison douce de revenir** : un visiteur environ 5 jours sur 7, à collectionner, et une fête de temps en temps.
- **Sobre** : environ 12 images par seconde, seulement quand la ville est à l'écran. Un réglage arrête l'animation, et le réglage « animations réduites » du téléphone est respecté.
- **Accessible** : la légende de la ville dit le moment, la météo et qui est de passage. Le visiteur s'ouvre aussi au clavier, et depuis la liste de la ville.
- **Tout existe en français et en anglais.**

## Hors périmètre

- **Pas de vraie météo ni de vrai lever du soleil** : ni réseau, ni localisation. La météo est tirée au sort chaque jour et les heures du soleil sont celles d'une latitude moyenne.
- **Rien de l'étape 4** : défis de la semaine, bilan du lundi, humeur, visite de la ville d'un ami, récapitulatifs.
- **Pas de nouvel élément à acheter.** Visiteurs et décorations de fête ne s'achètent pas et ne se posent pas.
- **Pas de son d'ambiance** (pluie, oiseaux). *Choix de Claude : le silence par défaut, on pourra l'ajouter plus tard.*
- **Pas d'habitants à nourrir ni à loger**, et pas de besoins.

## À éviter absolument

- **Une ville triste, vide ou abîmée** parce qu'on n'a pas pratiqué ou pas ouvert l'app.
- **Une chose ratée pour toujours** : aucune récompense de fête qu'on ne pourrait plus jamais obtenir.
- **Des pièces sans activité en quantité qui compte** : les cadeaux restent minimes (partie I).
- **Une batterie qui fond** ou un téléphone qui chauffe.
- **Du mouvement** quand le téléphone demande des animations réduites.
- **Une ville illisible** : nuit trop sombre, pluie trop dense, particules qui cachent la case où l'on pose.
- **Toute donnée de localisation.**

## Contraintes

- Gratuit, sans serveur, sans compte, utilisable hors connexion.
- Même architecture : fichiers `src/NN-*.js` assemblés par `npm run build`, sans dépendance.
- **Le même jour donne la même ville partout.** La météo, le visiteur et les fêtes sont les mêmes dans tous les onglets et sur tous les appareils d'une même ville. Le tirage au sort part de la date du jour et d'une graine propre à la ville : sa date de création.
- **L'heure et la date sont celles du fuseau de la ville** (`S.clock.tz`), comme pour les journées et les succès.
- Les textes sont dans les dictionnaires, en français et en anglais, avec le tutoiement en français.

## Partie A — Lumière selon l'heure

### Ce qui est décidé

**Cinq moments** : nuit, aube, journée, fin d'après-midi, crépuscule. Les heures du soleil changent avec la saison, pour une latitude moyenne :
- **durée du jour** : 12 h + 3 h 36 × cos(2π × (jour de l'année − 172) / 365), dans l'hémisphère nord ;
- **dans l'hémisphère sud**, la même courbe est décalée de six mois ;
- **le soleil est au plus haut à 13 h**. Le lever tombe donc vers 5 h 10 au cœur de l'été, 7 h aux équinoxes et 8 h 50 au cœur de l'hiver, et le coucher vers 20 h 50, 19 h et 17 h 10.

| Moment | Quand |
|---|---|
| aube | de 30 min avant le lever à 45 min après |
| journée | ensuite, jusqu'à 1 h avant le coucher |
| fin d'après-midi | la dernière heure avant le coucher |
| crépuscule | du coucher à 45 min après |
| nuit | le reste |

**Ce qu'on voit :**
- **un ciel propre à chaque moment** : bleu clair la journée, doré en fin d'après-midi, rose et violet au crépuscule, pêche à l'aube, bleu nuit la nuit, avec étoiles et lune ;
- **une teinte légère sur la ville** : chaude en fin d'après-midi, rosée à l'aube, violette au crépuscule ;
- **les fenêtres et les lampadaires** s'allument du crépuscule à l'aube.

**Passages en douceur.** Pendant l'aube et le crépuscule, le ciel et la teinte passent progressivement d'un moment au suivant, sans saut d'une image à l'autre.

**Réglage « Ciel de la ville »** :
- **Selon l'heure** (par défaut) ;
- **Selon l'apparence** : le comportement actuel, jour en thème clair et nuit en thème sombre.

*Choix de Claude :* l'interface garde son thème (clair, sombre ou automatique) ; seule la ville suit l'heure. Une ville de nuit dans une interface claire, c'est simplement une scène.

**Ce qui ne change pas :**
- **les vignettes** de la boutique et du carnet gardent l'apparence de l'interface : ni saison, ni heure ;
- **l'export PNG** montre la ville telle qu'elle est à l'instant (moment, saison, météo, fête, visiteur), sans curseur ni sélection.

### Laissé au constructeur

Les couleurs exactes du ciel et des teintes, et la façon de mélanger les moments pendant les passages.

## Partie B — Saisons

### Ce qui est décidé

**Saisons « météorologiques »** : printemps de mars à mai, été de juin à août, automne de septembre à novembre, hiver de décembre à février. Dans l'hémisphère sud, elles sont décalées de six mois.

**Hémisphère.**
- Il est **deviné d'après le fuseau de la ville**. Sont au sud : `Australia/*`, `Antarctica/*`, `Pacific/Auckland`, `Pacific/Chatham`, `Pacific/Fiji`, `Pacific/Tongatapu`, `Pacific/Noumea`, `Pacific/Port_Moresby`, `America/Argentina/*`, `America/Santiago`, `America/Punta_Arenas`, `America/Sao_Paulo`, `America/Montevideo`, `America/Asuncion`, `America/La_Paz`, `America/Lima`, `Africa/Johannesburg`, `Africa/Maputo`, `Africa/Harare`, `Africa/Lusaka`, `Africa/Windhoek`, `Africa/Gaborone`, `Indian/Mauritius`, `Indian/Reunion`, `Indian/Antananarivo`.
- **Tous les autres fuseaux sont au nord.**
- **Réglage « Saisons »** : *Automatiques* (par défaut), *Hémisphère nord*, *Hémisphère sud*.

**Ce qu'on voit :**

| | Sol | Feuillage | Autres |
|---|---|---|---|
| Printemps | vert tendre | vert clair | pétales qui volent |
| Été | vert plus doré | vert franc | lucioles les nuits claires |
| Automne | vert-jaune | orange, roux et jaune | feuilles qui tombent |
| Hiver | blanc de neige | blanchi par la neige | neige sur les toits |

**Précisions :**
- **Le feuillage** couvre les arbres, les haies, le labyrinthe, le gazon du jardin et des terrains, les massifs et le Grand Arbre.
- **Le cerisier** est rose au printemps et en été, roux en automne, enneigé en hiver.
- **Le Grand Arbre** garde ses fleurs aux couleurs des domaines pratiqués dans la semaine (étape 2), en toute saison.
- **Ne changent pas** : les couleurs des domaines (toits), les plantes de la serre et du carré potager, l'eau.
- **Neige sur les toits** : en hiver, les pans de toit et les toits plats blanchissent. Les murs, les fenêtres et les portes gardent leurs couleurs.

### Laissé au constructeur

Les teintes exactes de chaque saison, et la façon de blanchir les toits dans le pinceau isométrique.

## Partie C — Météo

### Ce qui est décidé

**Une météo par jour**, tirée au sort à partir de la date et de la graine de la ville :

| Saison | Soleil | Nuages | Pluie | Neige | Brouillard |
|---|---|---|---|---|---|
| Printemps | 45 % | 30 % | 25 % | — | — |
| Été | 60 % | 25 % | 15 % | — | — |
| Automne | 35 % | 30 % | 25 % | — | 10 % |
| Hiver | 30 % | 30 % | 10 % | 20 % | 10 % |

- **Le brouillard** ne dure que le matin : à partir de 11 h, il laisse place aux nuages.
- **Arc-en-ciel.** Le matin qui suit un jour de pluie, s'il fait soleil, un arc-en-ciel apparaît une fois sur trois, jusqu'à midi. *Choix de Claude : une petite surprise rare.*

**Ce qu'on voit :**

| Météo | Ciel | Dans la ville |
|---|---|---|
| Soleil | ciel du moment | — |
| Nuages | un peu plus gris | 2 à 4 nuages qui glissent lentement |
| Pluie | gris | traits de pluie fins et transparents |
| Neige | — | flocons qui tombent |
| Brouillard | — | voile blanc près du sol |

**Lisibilité :**
- particules fines et semi-transparentes : la ville et la case visée restent lisibles ;
- **pendant une pose ou un déplacement**, la pluie et la neige s'estompent, puis reviennent à la fin.

## Partie D — Habitants et vie de la ville

### Ce qui est décidé

**Les promeneurs.**
- **Combien** : un pour trois éléments posés, au plus 6. Une ville vide n'en a aucun.
- **Où** : ils marchent d'une case à une case voisine, sur les cases libres, les chemins et les pas japonais, et s'arrêtent un peu entre deux pas. Ils passent derrière les bâtiments qui sont devant eux.
- **Selon le moment** : la nuit, la moitié rentre ; ceux qui restent portent une petite lanterne.
- **Selon la météo et la saison** : parapluie sous la pluie, bonnet en hiver.

**« Les habitants font comme toi. »** Pour chaque domaine pratiqué aujourd'hui, un habitant fait la même activité, près d'un bâtiment de ce domaine (ou n'importe où s'il n'y en a pas) :

| Domaine | Activité |
|---|---|
| Esprit | lit un livre |
| Corps | court autour de la ville |
| Calme | médite dans l'herbe |
| Foyer | arrose les fleurs |
| Créativité | peint ou joue de la musique |

Le lendemain, ils laissent la place aux activités du nouveau jour. Si l'on n'a rien fait, il ne manque rien : les promeneurs habituels sont là, et aucun message ne le fait remarquer.

**Ce qui bouge dans la ville :**
- **le moulin** : les ailes tournent ;
- **la Grande Roue**, une fois inaugurée, tourne ;
- **le phare**, une fois inauguré, balaie la nuit de son faisceau ;
- **la Tour de l'horloge** donne l'heure réelle de la ville ;
- **la fontaine et la source chaude** : l'eau scintille, la vapeur monte ;
- **les maisons et la boulangerie** : fumée de cheminée en automne et en hiver, et le matin à la boulangerie ;
- **les mâts à fanions** : les fanions flottent.

**Animaux et petits détails :**
- des oiseaux traversent parfois le ciel de jour, sauf sous la pluie ;
- des lucioles les nuits d'été, près de l'étang et des jardins ;
- des pétales au printemps, des feuilles qui tombent en automne.

**Rythme et économie d'énergie.** La ville est dessinée environ **12 fois par seconde**, et seulement quand toutes ces conditions sont réunies :
- l'onglet Ville est affiché et l'app est au premier plan ;
- la ville est visible à l'écran ;
- aucune fenêtre ni aucune session ne la couvre.

Les effets de pose de l'étape 2 gardent leur pleine vitesse le temps de leur seconde.

**Ville immobile.** Quand le réglage « Ville animée » est coupé, ou quand le téléphone demande des animations réduites :
- **plus aucun mouvement continu** ;
- **on voit toujours** le moment, la saison, la météo (gouttes et flocons figés), les habitants arrêtés, le visiteur et la fête ;
- **la ville est redessinée chaque minute**, pour la lumière et les aiguilles de l'horloge.

### Laissé au constructeur

Le dessin des habitants et des animaux, leurs couleurs, le nombre de particules, la façon de choisir les promenades.

## Partie E — Visiteurs

### Ce qui est décidé

**Un visiteur environ 5 jours sur 7.** Il passe la journée entière en ville, de minuit à minuit. Le visiteur du jour est tiré au sort à partir de la date et de la graine de la ville, parmi ceux dont les conditions sont remplies :
- **plus de chances pour ceux qu'on n'a pas encore rencontrés** : leur poids est triplé ;
- **pas le même deux jours de suite**, quand un autre est possible ;
- **s'il ne trouve pas de place**, il n'est pas candidat ce jour-là.

**Douze visiteurs :**

| Visiteur | Visitor | Quand | Où |
|---|---|---|---|
| Le chat voyageur | The wandering cat | toute l'année, sans pluie ni neige | sur un banc, sinon une case libre |
| Le hérisson | The hedgehog | printemps, été, automne | près d'un arbre, d'une haie ou d'un massif |
| L'écureuil | The squirrel | automne, hiver | dans un arbre ou un cerisier |
| La cigogne | The stork | printemps, été | sur le toit d'un bâtiment |
| Les canards | The ducks | toute l'année sauf l'hiver | sur l'étang |
| Le renard | The fox | automne, hiver | sur une case libre au bord de la ville |
| La chouette | The owl | automne, hiver | dans un arbre |
| La montgolfière | The hot-air balloon | soleil ou nuages, hors hiver | dans le ciel |
| Le bonhomme de neige | The snowman | hiver, le jour où il neige et le lendemain | sur une case libre |
| Le chariot de glaces | The ice-cream cart | été, sans pluie | sur un chemin, sinon une case libre |
| L'accordéoniste | The accordionist | sans pluie ni neige | près du kiosque à musique, sinon une case libre |
| L'artiste peintre | The painter | printemps à automne, soleil ou nuages | sur une case libre, chevalet tourné vers la ville |

**Ce qu'on voit.**
- **Le dessin du visiteur** a une variante de nuit : le chat dort, la montgolfière allume son brûleur, etc.
- **Un petit scintillement** le signale tant qu'on ne l'a pas salué aujourd'hui.
- **La légende de la ville** dit qui est de passage.

**Le saluer.** On touche le visiteur, ou on le choisit au clavier ou dans la liste de la ville. Une fenêtre s'ouvre avec :
- son nom et une phrase douce liée au moment (deux ou trois phrases par visiteur) ;
- le nombre de rencontres ;
- **un cadeau : 2 M**, une fois par jour, comme un merci pour deux minutes d'activité.

La première rencontre l'ajoute au carnet, avec un message « Nouveau visiteur : le hérisson ! ».

**Rencontre.** Ouvrir la fenêtre du visiteur compte comme une rencontre, une seule par jour. Recevoir le cadeau n'est pas obligatoire pour l'avoir rencontré.

### Laissé au constructeur

Le dessin des visiteurs, leurs phrases, et le tirage exact des cases où ils se placent.

## Partie F — Fêtes

### Ce qui est décidé

**Six fêtes par an**, aux mêmes dates chaque année :

| Fête | Festival | Nord | Sud | Décor |
|---|---|---|---|---|
| Nouvel An | New Year | 31 décembre – 1er janvier | idem | feux d'artifice la nuit, confettis le jour |
| Fête du printemps | Spring festival | 20 – 22 mars | 22 – 24 septembre | pétales, guirlandes de fleurs |
| Fête de l'été | Midsummer festival | 20 – 22 juin | 20 – 22 décembre | notes de musique, lampions la nuit |
| Fête des récoltes | Harvest festival | 22 – 24 septembre | 20 – 22 mars | citrouilles, bottes de paille |
| Fête des lumières | Festival of lights | 20 – 22 décembre | 20 – 22 juin | guirlandes lumineuses, lanternes |
| Anniversaire de ta ville | Your town's birthday | chaque année à la date de création de la ville, dès la première | idem | ballons, confettis |

**Pendant une fête :**
- **décorations** : une guirlande de fanions court le long des deux bords avant de la ville, avec le décor propre à la fête ;
- **la légende** la nomme ;
- **à la première ouverture**, un message et un cadeau, une fois par fête et par an : « Bonne Fête du printemps ! Cadeau : 5 M ». Pour l'anniversaire : « Ta ville a 2 ans ! Cadeau : 10 M ».

**Aucun objet à durée limitée.** Les mêmes fêtes reviennent chaque année. Le carnet garde les années où on les a vécues.

**Fêtes qui se chevauchent.** Quand deux fêtes tombent le même jour, par exemple l'anniversaire pendant le Nouvel An, les deux sont fêtées : décors, messages et cadeaux.

## Partie G — Carnet, succès et légende

### Ce qui est décidé

**Un quatrième onglet du carnet, « Visites »** :
- **les visiteurs rencontrés** : dessin, nom, nombre de rencontres et date de la première ;
- **les autres** : en silhouette, avec un indice sur le moment où ils viennent (« Vient parfois en hiver, quand il neige ») ;
- **les fêtes** : celles qu'on a vécues, avec leurs années, et la date de la prochaine.

**Carte Carnet du Journal** : une ligne de plus, « Visites : 3 sur 12 ».

**Cinq succès de plus**, dans une nouvelle famille « Ville vivante » :

| Succès | Achievement | Condition |
|---|---|---|
| Première visite | First visitor | rencontrer un visiteur |
| Bon accueil | Warm welcome | rencontrer 6 visiteurs différents |
| Ville hospitalière | Open house | rencontrer les 12 visiteurs |
| Jour de fête | Festive day | vivre une première fête |
| Quatre saisons | Four seasons | voir sa ville au fil des quatre saisons |

Le carnet compte donc 38 succès. Ces cinq ne se rattrapent pas : rien avant cette étape ne les mesure.

**Légende de la ville.** Elle commence par le moment, la météo et ce qui se passe, par exemple « Mardi soir · Pluie · Le hérisson est de passage », puis garde les informations actuelles (éléments, terrain, minutes du jour).

## Partie H — Réglages

Dans la section **Apparence** :
- **Ciel de la ville** : *Selon l'heure* (par défaut) ou *Selon l'apparence*.
- **Saisons** : *Automatiques* (par défaut), *Hémisphère nord* ou *Hémisphère sud*.
- **Ville animée** : un interrupteur, activé par défaut. Sa note dit : « Coupe les mouvements continus pour économiser la batterie. »

## Partie I — Rythme et économie

| Cadeau | Montant | Fréquence |
|---|---|---|
| Visiteur | 2 M | environ 5 jours sur 7 |
| Fête | 5 M | 5 fois par an |
| Anniversaire de la ville | 10 M | une fois par an |

Pour un joueur à 30 min par jour (environ 30 M par jour), les visiteurs ajoutent en moyenne 1,4 M par jour, soit **environ 5 % de ses gains**, et les fêtes 35 M par an. Le rythme de l'étape 2 ne change presque pas.

*Choix de Claude :* l'étape 2 a lié les pièces aux vraies activités, et les succès ne donnent que des décors. Les cadeaux de visiteurs et de fêtes font une petite exception, assumée : ils restent symboliques, et c'est le plaisir de la rencontre qui fait revenir, pas le montant.

## Partie J — Voir la ville en grand

Demandée par Ludovic pendant la réalisation : « qu'on puisse cliquer sur la ville et la voir en grand ».

### Ce qui est décidé

**Ouvrir la vue en grand :**
- en touchant la ville hors d'un bâtiment, quand on ne pose rien. Aujourd'hui, ce toucher ne fait rien ;
- ou avec un bouton « Agrandir », dans le coin haut droit de la carte de la ville, accessible au clavier.

Toucher un bâtiment ouvre toujours sa fiche, comme avant.

**La vue en grand :**
- elle prend tout l'écran, avec le ciel, et la ville le remplit ;
- **zoom** jusqu'à × 3, en pinçant, à la molette ou avec les boutons + et − ;
- un double toucher zoome sur ce point ;
- on se déplace en faisant glisser, sans pouvoir perdre la ville de vue ;
- la ville y vit comme dans sa carte : même boucle et même sobriété ;
- **toucher le visiteur** ouvre sa fiche. *Choix de Claude : les bâtiments ne s'y ouvrent pas, la vue sert à regarder.*

**La fermer :** bouton ×, touche Échap, ou le geste retour du téléphone, qui ferme la vue sans quitter l'app.

**Accessibilité :**
- la vue est une fenêtre, avec un titre lu par les lecteurs d'écran (« Ta ville en grand ») ;
- le focus va sur le bouton de fermeture et revient au bouton « Agrandir » à la fermeture ;
- avec les animations réduites, le zoom se fait sans transition.

## Données et compatibilité

**Nouveaux champs :**
- **réglages** : `sky` (`time` ou `theme`), `hemisphere` (`auto`, `north` ou `south`), `ambient` (oui ou non) ;
- **`visits`** : pour chaque visiteur, `first` (date de la première rencontre), `count` (nombre de jours de rencontre) et `last` (dernier jour, `AAAA-MM-JJ`) ;
- **`gifts`** : les cadeaux reçus, chacun avec sa date. Les clés sont `visit:AAAA-MM-JJ` pour un visiteur et `fest:<fête>:<année>` pour une fête ;
- **`seasons`** : pour chaque saison, la date où la ville l'a vue pour la première fois.

**Validation.** Les visiteurs, fêtes et saisons inconnus sont ignorés, et les nombres bornés.

**Fusion de deux onglets :**
- **`visits`** : la première date la plus ancienne, le plus grand nombre de rencontres, le dernier jour le plus récent ;
- **`gifts` et `seasons`** : on garde tout, à la date la plus ancienne ;
- **un cadeau reçu dans deux onglets à la fois ne compte qu'une fois** : la fusion reprend les pièces données en double.

**Villes existantes et sauvegardes** : rien à rattraper. Les saisons vues commencent à la mise à jour.

## Tests attendus

**Tests unitaires**
- moment de la journée selon l'heure, la saison et l'hémisphère (lever et coucher aux solstices et aux équinoxes) ;
- saison selon la date et l'hémisphère, hémisphère deviné d'après le fuseau ;
- météo reproductible pour une date et une graine, conforme aux saisons (neige seulement en hiver, brouillard seulement le matin), proportions proches du tableau sur plusieurs années ;
- visiteur du jour reproductible, conditions respectées, poids des visiteurs pas encore rencontrés, jamais deux jours de suite quand c'est évitable, absent quand il n'a pas de place ;
- fêtes aux bonnes dates dans les deux hémisphères, anniversaire seulement dès la première année ;
- cadeaux reçus une seule fois, même après une fusion de deux onglets ;
- cinq nouveaux succès ;
- légende de la ville.

**Tests de dessin** : chaque visiteur, chaque décor de fête et chaque élément animé reste dans sa case, à plusieurs instants et dans les quatre saisons.

**Tests navigateur :**
- **animation** : elle tourne quand la ville est à l'écran, s'arrête quand elle est cachée (autre onglet, fenêtre ouverte, session) et ne démarre jamais avec les animations réduites ;
- **visiteur** : on le salue, on reçoit le cadeau une seule fois, il entre dans le carnet ;
- **fête** : le jour d'une fête (horloge simulée), message et cadeau arrivent une seule fois ;
- **réglages** : ils restent après un rechargement ;
- **largeurs** : rien ne déborde à 320 px.

**Planche visuelle** : les cinq moments, les quatre saisons, les cinq météos, les douze visiteurs et les six fêtes.

## Risques connus

- **Batterie et téléphones modestes.** Les garde-fous sont les 12 images par seconde, l'arrêt hors écran et le réglage. La planche mesure aussi le temps de dessin d'une image.
- **Lisibilité la nuit et sous la pluie** : la planche sert à la vérifier.
- **Heures du soleil approchées.** À Zurich, une soirée d'hiver à 17 h 30 est déjà la nuit, alors que le modèle dit encore crépuscule. C'est accepté.
- **Hémisphère mal deviné** pour un fuseau rare : le réglage le corrige.
- **Visiteur qui change en cours de journée** : si l'on construit l'étang le jour où les canards auraient pu venir, le tirage peut changer. C'est accepté.
- **Un onglet resté sur l'ancienne version** ne connaît pas les nouveaux champs, comme aux étapes précédentes : le bandeau de mise à jour invite à recharger.
