# Étape 2 — Contenu : bâtiments, merveilles, succès et ensembles

Date : 18 octobre 2026. Projet : Ville du bien-être (`Lubachma/ville-du-bien-etre`). Suite de la feuille de route décrite dans `2026-10-18-langue-reglages-serie-design.md` ; l'étape 1 est en ligne depuis le 18 octobre.

## Intention

Ludovic veut que les gens aient envie de revenir dans leur ville plus longtemps, et que le jeu soit plus amusant. Il suit les recommandations, quitte à retirer après coup ce qui ne lui plaît pas. Tout reste gratuit, sans serveur ni compte.

La ville compte aujourd'hui 22 éléments. À 30 min par jour, un joueur a tout acheté en moins de quatre mois, puis n'a plus rien à viser. Les concurrents en proposent bien plus : SleepTown plus de 70 bâtiments et des merveilles, Forest plus de 90 arbres, Islanders 44 types de bâtiments.

Cette étape apporte, dans l'ordre du classement validé :
1. **25 nouveaux éléments et 3 merveilles** construites par étapes visibles (SleepTown, le Centre communautaire de Stardew) ;
2. **des succès et un carnet de collection**, avec des décors exclusifs en récompense (Forest, SleepTown) ;
3. **des ensembles de voisinage** à découvrir, avec des silhouettes « ? » (Islanders, Townscaper, les combos de Kairosoft) ;
4. **une pose plus vivante** : chantier d'une seconde, poussière, petit son (Dorfromantik, Tiny Glade).

Deux principes tirés des recherches guident tout le reste. Succès et ensembles ne donnent que des récompenses de décoration : les pièces restent liées aux vraies activités. Et rien ne se perd ni ne se dégrade : c'est l'arbre qui meurt dans Forest, ou le bâtiment détruit dans SleepTown, qui fait fuir.

## Objectifs

- **Environ un an de découvertes** pour un joueur à 30 min par jour, réparties sur les cinq domaines. Il débloque tout vers le 9e mois et a tout construit au bout d'environ un an (partie H).
- **Des nouveautés fréquentes au début** :
  - un nouveau décor tous les quelques jours pendant les deux premières semaines ;
  - plusieurs succès dès la première semaine.
- **Chaque achat devient un petit moment.**
- **Des objectifs variés qui ne se perdent jamais** : succès, collection, ensembles, merveilles.
- **Tout le nouveau contenu existe d'emblée en français et en anglais.** Une troisième langue ne demande plus que son dictionnaire.

## Hors périmètre (étapes suivantes)

- **Rien qui bouge en continu dans la ville** : ni oiseaux, ni faisceau de phare qui tourne, ni aiguilles à l'heure. Pas d'heure réelle, de saisons, de météo, de visiteurs ni de fêtes (étape 3).
- **Rien de l'étape 4** : défis de la semaine, bilan du lundi, humeur, visite de la ville d'un ami, récapitulatifs.
- **Pas de nouvelle forme de terrain** :
  - pas de bâtiment sur plusieurs cases ;
  - pas de nouveau terrain (rivière, colline) ;
  - pas de ville plus grande que 11 × 11.
- **Pas de note d'harmonie de la ville.**
- **Aucune nouvelle langue**, seulement la préparation.
- Les autres points différés de l'étape 1 restent à décider à part.

## À éviter absolument

- **Tout ce qui punit ou culpabilise** : succès « raté », compte à rebours, contenu à durée limitée, peur de manquer.
- **Des succès qui poussent à l'excès, à de mauvaises heures ou à l'absence** : rien au-delà d'une heure par jour, rien entre 23 h et 5 h, aucune longue série, aucun succès qui demande de s'absenter.
- **Gagner des pièces autrement qu'en faisant ses activités.**
- **Un succès ou un ensemble qu'on pourrait perdre** une fois obtenu. Seuls deux gestes voulus ramènent le carnet en arrière : « Tout recommencer » et la restauration d'une sauvegarde plus ancienne.
- **Une régression pour les villes existantes** :
  - bâtiments perdus ;
  - prix qui changent pour les 22 éléments actuels ;
  - ville plus lente à s'afficher.
- **Des textes qui débordent à 320 px**, ou des morceaux d'une langue dans l'autre.
- **Du son quand le son est coupé**, ou une animation quand le système demande de réduire les animations.

## Contraintes

- **Comme à l'étape 1** :
  - JavaScript sans dépendance, sources dans `src/NN-*.js` ;
  - `app.js` et `sw.js` générés par `npm run build`, jamais modifiés à la main ;
  - état au format v2, dont les nouveaux champs sont facultatifs ;
  - `npm run check`, `npm test` et `npm run test:browser` passent en local et dans le workflow de publication.
- **Dessins** :
  - uniquement par code, avec le peintre isométrique existant (`makePainter` : blocs, toits, cylindres, cônes, dômes, ellipses), comme les 22 éléments actuels ;
  - chaque élément tient sur une case ;
  - il reste reconnaissable à 35 px de large (ville de 7 × 7 sur un téléphone de 320 px) et en vignette de 56 px, de jour comme de nuit.
- **Économie inchangée** :
  - 1 M de pièces par minute ;
  - bonus de série (jusqu'à +50 %), de tirage et de bon retour ;
  - +50 % par exemplaire supplémentaire d'un bâtiment, les décors gardant leur prix.

## Préalable — Une troisième langue sans code

Promis à la fin de l'étape 1, et à retirer si Ludovic préfère.

- **La liste des langues vient des dictionnaires chargés.** Chaque dictionnaire donne en plus :
  - son propre nom (« Deutsch ») et sa locale (`de-CH`) ;
  - son séparateur décimal, son abréviation des milliards (« Md », « B ») et sa façon d'écrire les durées ;
  - sa règle typographique (espaces avant « : ; ! ? » en français).
- **Les libellés que le code passe en minuscules** (`toLowerCase` dans `41-activities.js` et `42-draw.js`) reçoivent une forme « dans la phrase » dans chaque dictionnaire.
- **La fonction `plural()`, inutilisée, disparaît.**
- **Test** : un faux dictionnaire `xx`, ajouté seulement dans le test, apparaît dans le réglage Langue et s'affiche sans autre changement de code.

## Partie A — Nouveaux bâtiments et décors

### Ce qui est décidé

**15 bâtiments**, trois par domaine, qui prolongent les trois actuels. Les règles ne changent pas : déblocage aux minutes du domaine, et +50 % par exemplaire supplémentaire.

| Domaine | Après 500 min · 250 M | Après 1 000 min · 450 M | Après 1 600 min · 700 M |
|---|---|---|---|
| Foyer | Lavoir | Moulin | Marché couvert |
| Esprit | Musée | Université | Planétarium |
| Corps | Skatepark (au sol) | Mur d'escalade | Gymnase |
| Calme | Labyrinthe (au sol) | Source chaude | Pagode |
| Créativité | Galerie d'art | Cinéma | Chapiteau |

*Choix de Claude : le code dit « au moins 1,5 M par minute exigée ». Avec cette règle, ces 15 bâtiments coûteraient environ 11 milliards, et il faudrait deux ans pour tout construire. Leurs prix suivent donc la simulation (partie H). La règle reste vraie pour les 22 éléments actuels, qui ne changent pas.*

**5 nouveaux décors en boutique**, débloqués aux minutes totales pour qu'il y ait souvent du nouveau au début :

| Décor | Débloqué après | Prix |
|---|---|---|
| Haie | 30 min | 1 M |
| Cerisier | 90 min | 3 M |
| Boîte à livres | 150 min | 2 M |
| Lanterne de pierre (allumée la nuit) | 240 min | 3 M |
| Carré potager (au sol) | 360 min | 2 M |

**5 décors exclusifs**, chacun offert par un succès (partie C). Un exemplaire est gratuit tant qu'on n'en possède aucun ; les autres coûtent un prix de décor, entre 2 et 4 M. Aucun champ n'est ajouté pour cela : le prix dépend du nombre d'exemplaires posés.

| Décor | Succès qui l'offre |
|---|---|
| Cadran solaire | Lève-tôt |
| Pas japonais (au sol) | Petit à petit |
| Mât à fanions, aux couleurs des cinq domaines | Semaine équilibrée |
| Nichoir | Main verte |
| Statue | Cent heures |

**Dessins.** Le style ne change pas : toits à la couleur du domaine, fenêtres allumées la nuit, ombre portée. Chaque élément a une silhouette qu'on reconnaît en vignette, par exemple :
- les ailes du moulin ;
- les toits empilés de la pagode ;
- les rayures du chapiteau ;
- les prises colorées du mur d'escalade ;
- la coupole du planétarium, plus grande que celle de l'observatoire.

Comme aujourd'hui, les bâtiments gagnent des jardinières puis un fanion doré quand on pratique leur domaine.

**Noms anglais** :
- bâtiments : Wash house, Windmill, Covered market, Museum, University, Planetarium, Skate park, Climbing wall, Sports hall, Labyrinth, Hot spring, Pagoda, Art gallery, Cinema, Big top ;
- décors : Hedge, Cherry tree, Little library, Stone lantern, Vegetable patch, Sundial, Stepping stones, Bunting pole, Birdhouse, Statue.

Les noms français ont tous un genre grammatical simple et sont au singulier : les messages qui s'accordent (« construite », « démolie ») restent justes.

### Laissé au constructeur
- Le détail des dessins, les couleurs et la hauteur de chaque élément (`hf`).
- Les clés techniques des éléments.

## Partie B — Merveilles

### Ce qui est décidé

**Trois merveilles**, une seule de chaque par ville, rangées dans la rubrique Prestige avec la Tour de l'horloge. Chacune se construit en **4 étapes visibles** sur la même case. Chaque étape demande des minutes au total (tous domaines confondus) et des pièces :

| Merveille | Étape 1 | Étape 2 | Étape 3 | Étape 4 |
|---|---|---|---|---|
| Grand Arbre | 1 500 min · 200 M | 1 800 min · 250 M | 2 100 min · 300 M | 2 400 min · 350 M |
| Phare | 3 000 min · 350 M | 3 500 min · 400 M | 4 000 min · 450 M | 4 500 min · 500 M |
| Grande Roue | 5 500 min · 500 M | 6 200 min · 600 M | 6 900 min · 700 M | 7 600 min · 800 M |

*Choix de Claude : aucune exigence par domaine, pour ne bloquer personne qui ne peut pas pratiquer un domaine. Le Grand Arbre célèbre l'équilibre sans l'exiger.*

**Déroulé.**
- **Commencer.** Dans la boutique, une merveille débloquée propose « Commencer le chantier » au prix de l'étape 1. On choisit sa case comme pour un bâtiment, et la merveille apparaît en chantier.
- **Suivre.** On ouvre la fiche de la merveille en la touchant sur la carte, dans la liste de la ville, ou par « Continuer » dans la boutique. La fiche montre l'étape atteinte et la suivante : son exigence avec une jauge, et son prix. Le bouton « Construire l'étape » s'active quand les deux sont réunis.
- **Construire.** Chaque étape joue l'effet de chantier (partie G) sur la case.
- **Inaugurer.** La 4e étape est une inauguration : effet plus marqué (confettis aux couleurs des domaines), message de fête et succès.
- **Déplacer, pas démolir.** Une merveille se déplace mais ne se démolit pas : la fiche n'a pas de bouton Démolir. *Choix de Claude : on ne peut pas perdre par erreur des centaines de millions.*
- **Prix fixes.** Le prix d'une étape ne dépend de rien d'autre.

**Apparence.** Pendant les étapes 1 à 3, un échafaudage en bois entoure le chantier.
- **Grand Arbre** : pousse, jeune arbre, grand arbre, puis arbre en fleurs avec une balançoire et des lanternes allumées la nuit. Ses fleurs prennent les couleurs des domaines pratiqués pendant la semaine en cours, sinon le feuillage reste vert. C'est un miroir de la semaine, jamais un reproche : aucun texte n'en parle.
- **Phare** : chantier, tour qui monte, lanterne, puis phare rayé dont la lanterne brille la nuit. La lumière est fixe ; le faisceau qui tourne viendra à l'étape 3.
- **Grande Roue** : pylônes, roue, puis nacelles aux couleurs des cinq domaines et ampoules allumées la nuit.

**Prochain objectif.** Quand plus aucun élément ne reste à débloquer, ou qu'une étape de merveille est l'objectif le plus proche, la carte « Prochain déblocage » de la Ville montre l'étape suivante. La merveille peut aussi être choisie comme objectif, comme un bâtiment.

### Laissé au constructeur
- Les dessins de chaque étape.
- Le nom des étapes, par exemple « Fondations », « Structure », « Finitions », « Inauguration » (« Pousse », « Jeune arbre »… pour l'arbre).
- Le texte de l'inauguration.

## Partie C — Succès

### Ce qui est décidé

**33 succès en six familles.** Tous sont visibles dès le départ avec leur condition ; aucun n'est secret. Un succès obtenu l'est pour toujours. Toutes les durées comptent les sessions réussies, et les heures sont celles du fuseau de la ville.

| Famille | Succès (FR / EN) | Condition |
|---|---|---|
| Premiers pas | Premier pas / First step | une session réussie |
| | Première pierre / First stone | acheter un premier élément |
| | Coup de pouce du hasard / A nudge from chance | réussir une session acceptée au tirage au sort |
| | Bien rodé / Like clockwork | terminer une routine entière |
| Domaines | Esprit curieux / Curious mind | 60 min en Esprit |
| | Corps en mouvement / Body in motion | 60 min en Corps |
| | Grand calme / Deep calm | 60 min en Calme |
| | Nid douillet / Cosy nest | 60 min en Foyer |
| | Mains créatives / Creative hands | 60 min en Créativité |
| | Semaine équilibrée / Balanced week | les cinq domaines pendant la même semaine |
| Moments | Lève-tôt / Early bird | une session réussie terminée entre 5 h et 8 h |
| | Douce soirée / Quiet evening | une session réussie terminée entre 20 h et 23 h |
| | Petit à petit / Little by little | une session réussie de 5 min |
| | Plongée profonde / Deep dive | une session réussie de 45 min ou plus |
| | Belle journée / A good day | 60 min en une journée |
| | Journée variée / Varied day | trois domaines en une journée |
| Régularité | Sept jours pour soi / Seven days for you | 7 jours avec une session, consécutifs ou non |
| | Trente jours pour soi / Thirty days for you | 30 jours avec une session |
| | Cent jours pour soi / A hundred days for you | 100 jours avec une session |
| | Sur ta lancée / On a roll | la série atteint 7, comme sur la pastille : 7 jours actifs, les jours de repos faisant le pont sans compter |
| Temps | Dix heures pour soi / Ten hours for you | 10 h au total |
| | Cinquante heures / Fifty hours | 50 h au total |
| | Cent heures / A hundred hours | 100 h au total |
| Ville | Hameau / Hamlet | 10 éléments dans la ville |
| | Village / Village | 25 éléments |
| | Petite ville / Small town | 50 éléments |
| | Grands espaces / Wide open spaces | une ville de 11 × 11 |
| | Main verte / Green thumb | 10 éléments de nature dans la ville (Arbre, Cerisier, Haie, Massif de fleurs, Carré potager) |
| | Ça rayonne / Shining | un bâtiment au niveau 3 |
| | Bon voisinage / Good neighbours | un premier ensemble découvert |
| | Urbaniste / Town planner | les 12 ensembles découverts |
| | Première merveille / First wonder | une merveille inaugurée |
| | Les trois merveilles / All three wonders | les trois merveilles inaugurées |

Les cinq succès qui offrent un décor exclusif sont indiqués dans la partie A.

**Précisions.**
- **Éléments de la ville** : toutes les cases posées comptent, y compris une merveille en chantier.
- **Pas de « Bon retour ».** Aucun succès ne récompense le cadeau de bon retour : il faudrait s'absenter exprès pour l'obtenir, ce que l'étape 1 a voulu éviter. Le bilan de session fête déjà ce retour. *Choix de Claude, à la suite de la relecture : « Main verte » prend sa place et offre le Nichoir.*
- **Série masquée.** Quand la série est masquée, le carnet décrit « Sur ta lancée » sans le mot « série » (« 7 jours actifs rapprochés »), comme le « bonus de régularité » de l'étape 1.

**Quand on obtient un succès.**
- **Après une session**, le bilan l'affiche sous les déblocages, avec son décor offert s'il y en a un.
- **Ailleurs** (pose, agrandissement…), un message court « Succès : Hameau » propose d'ouvrir le carnet.
- **Plusieurs succès à la fois** forment un seul message.
- Les lecteurs d'écran annoncent chaque succès.

**Villes existantes.** Au premier lancement après la mise à jour, les succès déjà mérités sont accordés d'un coup, avec un seul message : « Ta ville a déjà 9 succès : découvre-les dans ton carnet. »
- **Date d'obtention** : la vraie date quand elle se déduit des données (minutes par jour, historique des 150 dernières sessions, date de construction des bâtiments), sinon la date de la mise à jour.
- **Exceptions** : les succès du tirage et des routines ne se déduisent pas des données conservées. Ils ne s'obtiennent qu'à partir de la mise à jour.

### Laissé au constructeur
- L'apparence des badges, qui ne demande aucune nouvelle illustration.
- La phrase qui décrit chaque succès, avec un ton encourageant (« Cinq minutes, c'est déjà prendre soin de soi »).
- L'ordre d'affichage dans le carnet.

## Partie D — Ensembles de voisinage

### Ce qui est décidé

**12 ensembles de 3 éléments.** Un ensemble est formé quand ses 3 éléments se trouvent tous dans un même carré de 3 × 3 cases, n'importe où dans la ville. Un même élément peut compter pour plusieurs ensembles. Une merveille compte dès le début de son chantier : la Grande Roue peut former la « Fête foraine » dès qu'on la pose.

| Ensemble (FR / EN) | Éléments |
|---|---|
| Coin lecture / Reading nook | Bibliothèque, Banc, Arbre |
| Cocon / Cosy corner | Maison, Massif de fleurs, Haie |
| Place du concert / Concert square | Kiosque à musique, Banc, Lampadaire |
| Place du marché / Market square | Boulangerie, Fontaine, Lampadaire |
| Jardin japonais / Japanese garden | Pavillon de thé, Étang, Cerisier |
| Quartier des artistes / Artists' quarter | Atelier d'artiste, Galerie d'art, Massif de fleurs |
| Parc sportif / Sports park | Terrain de sport, Piscine, Skatepark |
| Campus / Campus | École, Bibliothèque, Université |
| Petite ferme / Little farm | Serre potagère, Carré potager, Moulin |
| Oasis / Oasis | Source chaude, Fontaine, Jardin zen |
| Nuit étoilée / Starry night | Observatoire, Planétarium, Lanterne de pierre |
| Fête foraine / Funfair | Chapiteau, Grande Roue, Lampadaire |

**Découverte.** La première fois qu'une pose ou un déplacement forme un ensemble, la ville fête la découverte : étincelles sur ses cases, petit son et message « Nouvel ensemble : Coin lecture ! ». L'ensemble entre dans le carnet. Il reste découvert pour toujours, même si on le défait ensuite.

**Dans la ville.** Tant qu'un ensemble est formé, les cases de ses éléments reçoivent un léger pavage, de jour comme de nuit. On voit ainsi les quartiers qu'on a composés. *Choix de Claude : un pavage commun plutôt qu'un détail dessiné pour chaque ensemble (un livre ouvert sur le banc…), pour limiter les dessins ; ces détails pourront venir plus tard.*

**Aucun bonus de pièces**, comme pour les succès.

**Indices.** Dans le carnet, un ensemble pas encore trouvé s'appelle « Ensemble à découvrir ». Il montre la silhouette de ses trois éléments et la règle du carré de 3 × 3. Son nom apparaît à la découverte.

**Villes existantes.** Les ensembles déjà formés au premier lancement sont découverts d'un coup, dans le même message unique que les succès.

### Laissé au constructeur
- L'aspect du pavage et des étincelles.

## Partie E — Carnet

### Ce qui est décidé

- **Dans le Journal**, une carte « Carnet » montre trois compteurs (succès 12 sur 33, collection 28 sur 50, ensembles 3 sur 12) et un bouton pour l'ouvrir.
- **Compteur de collection** : il compte les éléments débloqués. Un décor exclusif compte dès que son succès est obtenu, une merveille dès qu'on peut commencer son chantier. *Choix de Claude : on peut le calculer sans nouveau champ, et il ne recule pas quand on change d'objectif.*
- **Repère « Nouveau »** : il apparaît quand un succès ou un ensemble a été obtenu depuis la dernière ouverture du carnet sur cet appareil.
- **Le carnet** s'ouvre en fenêtre, avec trois onglets :
  - **Succès** : d'abord ceux obtenus (date, décor offert), puis les autres avec leur condition et, quand c'est utile, la progression (« 42 sur 60 min ») ;
  - **Collection** : les 50 éléments en vignettes, en couleur avec leur nom s'ils sont dévoilés, sinon en silhouette avec leur condition ;
  - **Ensembles** : ceux découverts (nom, trois vignettes, date), puis ceux à découvrir.
- **Élément dévoilé** : un élément est dévoilé s'il est débloqué, s'il est le prochain à débloquer dans sa rubrique, ou s'il est l'objectif choisi. La boutique suit la même règle. C'est seulement une règle d'affichage : un élément dévoilé mais pas débloqué ne compte pas dans la collection.
- **Noms anglais** : Notebook, Achievements, Collection, Sets.

### Laissé au constructeur
- La mise en page exacte, dans le style des fenêtres existantes.

## Partie F — Boutique

### Ce qui est décidé

- **Raccourcis vers les rubriques.** En haut, une rangée de raccourcis (Décor, Foyer, Esprit, Corps, Calme, Créativité, Prestige) fait défiler jusqu'à la rubrique choisie. À 320 px, la rangée défile horizontalement.
- **Ordre dans chaque rubrique** :
  - les éléments débloqués, comme aujourd'hui ;
  - le prochain à débloquer, dévoilé, avec sa condition et sa jauge ;
  - les autres éléments verrouillés, en silhouettes compactes.
- **Décors exclusifs** : « Offert » pour le premier exemplaire. Avant le succès, ils apparaissent en silhouette avec « Récompense du succès « Lève-tôt » ».
- **Merveilles**, selon leur état :
  - « Commencer le chantier » ;
  - « Étape 2 sur 4 · Continuer », qui ouvre la fiche ;
  - « Inaugurée ».

## Partie G — Pose plus vivante

### Ce qui est décidé

- **Chantier d'une seconde.** À la pose, un échafaudage apparaît et le bâtiment sort du sol. Une bouffée de poussière (6 à 8 particules) suit, puis le petit rebond actuel.
- **Son.** Un « plop » doux, joué par le moteur audio du son de fin. Si on pose plusieurs éléments à la suite, la note monte sur une gamme pentatonique. Il respecte l'interrupteur du son et le volume choisi.
- **Vibration.** Une vibration brève, si elle est activée et que l'appareil sait vibrer.
- **Autres gestes** :
  - déplacement : poussière et rebond, sans échafaudage ;
  - étape de merveille : effet complet, avec des confettis en plus pour l'inauguration ;
  - découverte d'un ensemble : étincelles (partie D).
- **Animations réduites.** Si le système demande de réduire les animations, l'élément apparaît directement, sans mouvement ; le son reste s'il est activé.
- **Fluidité.** La ville n'est redessinée en continu que pendant l'effet, puis redevient une image fixe.

## Données et compatibilité

- **Nouveaux champs facultatifs** :
  - `S.achievements` : `{ identifiant: date }` ;
  - `S.sets` : `{ identifiant: date de découverte }` ;
  - `stage`, de 1 à 4, sur la case d'une merveille.
- **`normalize()`** ignore les identifiants inconnus et les dates invalides, et borne `stage`. S'il trouve deux fois la même merveille, il garde la plus avancée.
- **Fusion entre onglets** :
  - succès et ensembles s'additionnent, en gardant la date la plus ancienne ;
  - une merveille garde l'étape la plus haute ;
  - si deux onglets construisent la même étape au même moment, l'étape compte une fois et les pièces payées en double sont rendues ;
  - si deux onglets commencent la même merveille, la plus avancée reste et les pièces de l'autre sont rendues.
- **Restauration d'une sauvegarde** : comme aujourd'hui, elle remplace toute la ville par celle du fichier (bâtiments, merveilles, pièces, carnet). Les succès et ensembles qui se déduisent des données sont ensuite recalculés, avec le message unique s'il y en a de nouveaux. Les fichiers VBE2 portent les nouveaux champs, et une sauvegarde plus ancienne s'importe comme une ville existante.
- **« Tout recommencer »** efface tout, carnet compris : c'est une ville neuve, et la confirmation dit déjà « tout effacer ». *Choix de Claude : la remise à zéro sert aussi à passer le téléphone à quelqu'un d'autre.*
- **Éléments existants** : les 22 éléments actuels gardent leurs prix et leurs seuils, et rien de ce qui est construit ne change.

## Partie H — Rythme

Simulation d'un joueur qui fait la même durée chaque jour, répartie à parts égales sur les cinq domaines, avec environ +45 % de bonus (série et tirages). Il achète un exemplaire de chaque chose dès qu'il le peut, et agrandit sa ville quand la place manque.

| Joueur | Tout débloqué | Tout construit |
|---|---|---|
| 20 min par jour | vers le jour 400 | vers le jour 560 |
| 30 min par jour | vers le jour 267 | vers le jour 375 |
| 45 min par jour | vers le jour 178 | vers le jour 250 |

- **Joueur concentré.** Quelqu'un qui se concentre sur deux domaines débloque plus vite leurs bâtiments, et plus lentement ceux des autres. Les merveilles, qui comptent toutes les minutes, restent à la portée de tous.
- **Fin de partie.** Dans les derniers mois, les achats s'espacent de deux à cinq semaines, le temps d'épargner pour les dernières étapes de merveille. Les étapes 3 et 4 apporteront des nouveautés qui ne s'achètent pas.
- **Test de rythme.** Un test unitaire rejoue cette simulation avec les vraies tables du jeu. À 30 min par jour, il vérifie que tout est débloqué entre les jours 240 et 300, et construit entre les jours 340 et 410.

*Choix de Claude : ces chiffres sont un point de départ, réunis dans une seule table pour pouvoir les ajuster après les premiers retours.*

## Tests attendus

**Tests unitaires**
- **Contenu** : chaque élément a un dessin, un nom en français et en anglais, une rubrique et un prix. Les 22 éléments actuels gardent prix et seuils.
- **Merveilles** :
  - exigences et prix des étapes ;
  - une seule merveille de chaque par ville, sans démolition ;
  - `stage` normalisé ;
  - fusion : étape la plus haute, double paiement rendu, doublon rendu.
- **Succès** :
  - chaque condition est fausse juste avant son seuil et vraie au seuil ;
  - les plages horaires 5–8 h et 20–23 h sont lues dans le fuseau de la ville ;
  - l'attribution rétroactive est datée ;
  - rien n'est accordé deux fois ;
  - la fusion garde la date la plus ancienne.
- **Ensembles** :
  - carrés de 3 × 3 aux bords et dans les coins ;
  - éléments en plusieurs exemplaires ;
  - deux ensembles qui partagent un élément ;
  - une merveille en chantier compte ;
  - découverte unique ;
  - pavage seulement tant que l'ensemble est formé.
- **Décors exclusifs** : verrouillés avant le succès, gratuits tant qu'on n'en possède aucun, les suivants au prix.
- **Carnet** :
  - le compteur de collection compte les éléments débloqués ;
  - « Tout recommencer » efface le carnet ;
  - une restauration remplace la ville puis recalcule ce qui se déduit.
- **Rythme** : la simulation de la partie H, sur les vraies tables.
- **Traduction** :
  - les nouvelles clés existent dans les deux langues ;
  - aucun mot de perte ;
  - le faux dictionnaire `xx` du préalable fonctionne.

**Tests navigateur**
- **Achat et pose** : le chantier et la poussière s'affichent, le son est créé. Rien ne sonne quand le son est coupé, et rien ne bouge quand les animations sont réduites.
- **Merveille** : commencer le chantier, construire une étape, inaugurer ; la fiche n'a pas de bouton Démolir.
- **Ensemble** :
  - poser trois éléments dans un carré de 3 × 3 donne le message, l'entrée au carnet et le pavage ;
  - les séparer retire le pavage, mais la découverte reste.
- **Mise en page** : le carnet et la boutique, en français et en anglais, ne débordent pas à 320, 390 et 768 px.
- **Ville existante** : une ville au format d'avant la mise à jour reçoit un seul message de succès rétroactifs.

**Planche visuelle**
- Tous les éléments et toutes les étapes de merveille, de jour et de nuit, à 35 px et en vignette.
- Relue avant la fin, et montrée à Ludovic.

## Risques connus

- **Un onglet resté sur l'ancienne version** pendant la mise à jour ne connaît ni les nouveaux éléments ni les nouveaux champs. Il peut effacer les éléments posés dans un onglet à jour. C'est rare, et le bandeau « Une nouvelle version est prête » invite à recharger.
- **Lisibilité des dessins à 35 px.** Le risque est réel avec 28 nouveaux dessins ; la planche visuelle sert à le vérifier.
- **Les 50 vignettes** du carnet et de la boutique ne doivent pas ralentir un téléphone modeste.
- **Ensembles formés par hasard.** Dans une ville dense, des ensembles se formeront sans qu'on le cherche. C'est accepté : c'est une bonne surprise.
- **Rythme.** Les chiffres sont des estimations, réglables dans une seule table.
