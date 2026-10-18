# Étape 6 — Un compagnon : il fait tes séances avec toi, respire avec toi et grandit avec le temps passé ensemble

Date : 18 octobre 2026. Projet : Ville du bien-être (`Lubachma/ville-du-bien-etre`). Les quinze idées du classement de départ sont toutes en ligne depuis l'étape 5 ; cette étape part d'une idée nouvelle.

## Intention

Ludovic veut que les gens aient envie de revenir dans leur ville plus longtemps, et que le jeu soit plus amusant. Pour cette étape, il a demandé à Claude de choisir : **tous les choix de ce document sont donc ceux de Claude**. Tout reste gratuit, sans serveur ni compte.

Les étapes 1 à 5 donnent des raisons de revenir : la série, le contenu, la ville vivante, les rituels, les souhaits et l'harmonie. Il manque encore deux choses :
- **un personnage auquel s'attacher** : la ville a des habitants anonymes et des visiteurs de passage, mais personne qui soit « à soi » ;
- **de la compagnie pendant la séance**, le moment principal de l'app : l'écran ne montre qu'un minuteur.

Cette étape ajoute donc **un compagnon** : un petit animal qu'on choisit et qu'on nomme, qui vit dans la ville, **fait chaque séance avec toi**, propose de **respirer avec toi** pendant les séances de calme, et reçoit des accessoires au fil du temps passé ensemble.

Ce que font les autres, et ce que dit la recherche :
- **Focus Friend** (Hank Green, 2025) : un petit haricot tricote pendant qu'on se concentre ; ce qu'il tricote décore sa chambre. L'app est montée au 4e rang des apps gratuites peu après sa sortie. On reprend l'idée d'un compagnon qui travaille avec toi.
- **Finch** : un oiseau grandit quand on prend soin de soi, reçoit des tenues et part en petites aventures ; les récompenses sont seulement positives. On reprend la complicité qui grandit, les accessoires et le petit mot.
- **Study Bunny, Forest** : un compagnon ou un arbre qui accompagne la séance.
- **Être accompagné pendant une tâche** (« body doubling ») aide beaucoup de gens, mais les études sont encore minces : on le présente comme une compagnie, sans promettre d'effet.
- **Respirer lentement, vers 6 respirations par minute**, améliore de façon fiable plusieurs mesures cardiovasculaires à court terme et diminue modestement les émotions négatives (revue systématique préenregistrée, *Mindfulness*, 2023). On le propose, sans promesse.
- **À ne pas reprendre** : l'animal qui a faim, qui est triste ou malade quand on s'absente (Tamagotchi), l'arbre qui meurt (Forest), le compagnon qui « laisse tomber son tricot » quand on quitte l'app, les tenues payantes.

Trois principes guident tout le reste :
- **Jamais triste, jamais affamé.** Le compagnon n'a aucun besoin. Après une absence, il est simplement content de te revoir.
- **Proposé, jamais imposé.** On peut refuser le compagnon, le masquer, et la respiration guidée reste un choix.
- **Doux pour l'attention.** Pas de son, des mouvements lents, rien qui clignote pendant la séance ; tout s'arrête quand l'écran est caché ou que les animations sont réduites.

## Objectifs

- **Un compagnon à soi** : trois animaux au choix (lapin, marmotte, ourson) et un nom.
- **Des séances accompagnées** : le compagnon fait l'activité du domaine de la séance.
- **Respirer ensemble**, au choix, pendant les séances de calme : 5 s pour inspirer, 5 s pour expirer.
- **Une complicité qui grandit** avec le temps passé ensemble, en dix niveaux, avec **neuf accessoires** à gagner. Elle ne baisse jamais.
- **Un petit mot chaque jour**, gentil et lié à la journée.
- **Trois succès** et **un nouveau décor**, la Cabane.
- **Tout existe en français et en anglais.**

## Hors périmètre

- **Pas de besoins** : ni faim, ni fatigue, ni humeur qui baisse.
- **Pas de compagnon dans les liens de ville ni dans les visites** : la ville d'un ami se montre sans compagnon. *Une étape à part si besoin.*
- **Un seul compagnon par ville.**
- **Pas de son** pour le compagnon (les ambiances de l'étape 5 existent déjà).
- **Pas d'accessoire à acheter** : ils sont offerts par la complicité.
- **Pas de rattrapage** : la complicité commence à l'arrivée du compagnon, même dans une ville ancienne.
- **Pas de nouvelle langue.**

## À éviter absolument

- **Un mot de reproche ou de manque** : « Pompon s'ennuie », « tu as manqué à Pompon », « Pompon t'attend ».
- **Un accord en genre**, pour le compagnon comme pour la personne : son nom est libre, donc les phrases utilisent son nom et des verbes, sans adjectif qui s'accorde (« Bienvenue à Pompon ! », pas « Pompon est ravi »). Le compagnon parle à la première personne, aussi sans adjectif sur lui-même.
- **Une pression** : pas de rendez-vous à tenir, pas de pastille qui insiste, pas d'invitation qui revient d'elle-même après un refus.
- **Une distraction pendant la séance** : rien de rapide ni de clignotant.
- **Des textes qui débordent à 320 px**, en français comme en anglais.

## Contraintes

- Gratuit, sans serveur, sans compte, utilisable hors connexion.
- Même architecture : fichiers `src/NN-*.js` assemblés par `npm run build`, sans dépendance.
- **Dessins** faits par le navigateur (canvas), dans le style des visiteurs : formes simples, aucune image.
- **Données** : format v2 inchangé, nouveaux champs facultatifs (voir « Données et compatibilité »). Une ancienne version de l'app ignore ces champs sans erreur.
- **Animations** : le compagnon ne bouge que si la ville peut s'animer (réglage « Ville animée » activé, mouvements non réduits, page visible). Sur l'écran de la séance, son geste change quelques fois par seconde au plus.
- **Liens de ville** : la Cabane s'ajoute à la fin de `SHARE_ITEMS` ; les liens déjà envoyés restent lisibles.
- **Tests** : `npm run check`, `npm test` et `npm run test:browser` passent en local et dans le workflow de publication, qui tourne sous Linux (polices un peu plus larges).

## Partie A — L'arrivée du compagnon

### Ce qui est décidé

**Quand** : l'invitation apparaît dans la Ville **dès qu'une séance a été réussie**. Dans une ville existante, c'est donc à la première ouverture après la mise à jour ; pour une nouvelle personne, après sa première séance, pour que le premier contact avec l'app reste simple.

**L'invitation** : une carte « Un compagnon pour ta ville » sous les outils de la ville (au-dessus de la carte du souhait s'il y en a un), avec la phrase « Un petit animal aimerait s'installer dans ta ville et faire tes séances avec toi. » et deux boutons :
- **« Faire connaissance »** ouvre le choix ;
- **« Pas maintenant »** range la carte, qui ne revient pas d'elle-même. Le compagnon reste possible dans Réglages › Compagnon.

**Le choix** (fenêtre « Ton compagnon ») :
- **trois animaux**, dessinés côte à côte, à choisir comme des boutons radio : **Lapin**, **Marmotte**, **Ourson** (*Rabbit*, *Marmot*, *Bear cub*). La marmotte et l'ourson font un clin d'œil à la Suisse ;
- **un champ « Son nom »**, prérempli avec une suggestion qui suit l'animal choisi tant qu'on ne l'a pas modifiée : Pompon, Noisette, Caramel (*Pompom*, *Hazel*, *Toffee*) ;
- **le nom** : de 1 à 20 caractères, espaces du début et de la fin retirés ; vide, c'est la suggestion qui compte ;
- **le bouton « Accueillir Pompon »**, qui suit le nom tapé.

**Bienvenue** : le message « Bienvenue à Pompon ! », et le succès « Première rencontre ».

**Changer plus tard** : la fiche du compagnon (Partie B) a un bouton « Modifier », qui rouvre le même choix, prérempli. Changer d'animal ou de nom garde la complicité et les accessoires.

### Laissé au constructeur

La mise en page de la carte et de la fenêtre du choix, dans les règles ci-dessus.

## Partie B — Le compagnon dans la ville

### Ce qui est décidé

**Où il est** :
- **le jour**, il se promène lentement sur quelques cases libres ou de chemin, près du centre de la ville, comme les promeneurs ;
- **la nuit**, il dort roulé en boule, avec quelques « z » : à côté de sa Cabane si elle est posée (la première, s'il y en a plusieurs), sinon près du centre.

**Le bouton du compagnon** : un petit bouton rond posé dans le coin bas gauche de la ville, avec le visage du compagnon dessiné dedans, et pour nom « Pompon, ton compagnon ». Il ouvre la fiche. Toucher le compagnon dans la ville (petite carte ou vue en grand) ouvre aussi la fiche, comme pour un visiteur. La bulle du souhait évite ce bouton, comme les autres boutons posés sur la ville.

**La fiche « Pompon »** :
- le compagnon en grand, avec son accessoire ;
- « Lapin · complicité niveau 3 » ;
- le temps passé ensemble et la suite : « 1 h 10 ensemble · prochain cadeau dans 50 min : un bonnet » ; au niveau 10, seulement le temps passé ensemble ;
- **le mot du jour** ;
- **la garde-robe** : « Aucun » et les neuf accessoires. Ceux déjà gagnés se choisissent ; les suivants montrent leur niveau (« Niveau 6 »), sans rien de plus ;
- le bouton « Modifier » (Partie A).

**Le mot du jour** : une phrase du compagnon, à la première personne, la même toute la journée (tirage par `chance(jour + ':compagnon')`, comme les visiteurs), choisie parmi celles qui vont avec la journée :
- **le domaine de la dernière séance d'hier** (« Hier, on a lu ensemble : j'ai encore la tête dans l'histoire. ») ;
- **la météo du jour** (pluie, neige, soleil, brouillard) ;
- **la saison** ;
- **le visiteur du jour** (« J'ai salué le hérisson ce matin. ») ;
- **le souhait en cours** (« La Bibliothèque aimerait une boîte à livres juste à côté, tu as vu ? ») ;
- **une fête du jour** ;
- **le retour après au moins 2 jours sans séance** : « Quelle joie de te revoir ! J'ai gardé ta ville bien au chaud. » Ce mot passe avant tous les autres ;
- sinon, **des petites choses** (« J'ai trouvé un joli caillou près du chemin. »).

Jamais une demande, jamais un reproche, jamais un accord en genre. Il se lit dans la fiche, et sur l'écran de fin de la première séance du jour (Partie C).

**Visites** : la ville d'un ami, ou la sienne vue comme les amis la voient, se montre sans compagnon.

**Masqué** (réglage « Afficher Pompon » coupé) : ni dessin dans la ville, ni bouton, ni compagnon pendant les séances. La complicité continue de grandir, sans rien montrer.

### Laissé au constructeur

Le chemin de promenade, la place exacte du sommeil, la mise en page de la fiche et le texte des mots du jour (au moins 20 par langue), dans les règles ci-dessus.

## Partie C — Pendant les séances

### Ce qui est décidé

**Sur l'écran de la séance**, dans l'anneau, sous le minuteur, le compagnon fait l'activité du domaine de la séance :
- **Esprit** : il lit un livre et tourne une page de temps en temps ;
- **Corps** : il s'étire, les bras en haut puis en bas ;
- **Calme** : il médite, les yeux fermés ;
- **Foyer** : il arrose une petite plante ;
- **Créativité** : il peint sur une petite toile.

En Concentration comme en Activité libre ; dans une routine, chaque étape montre le geste de son domaine. L'animation est lente ; sans animation (réglage « Ville animée » coupé ou mouvements réduits), le compagnon reste dans la pose de son activité.

**À la fin d'une séance réussie**, l'écran de fin montre le compagnon qui se réjouit (un petit saut, quelques étincelles ; immobile sans animation), puis :
- le temps ajouté : « +20 min ensemble » ;
- **le mot du jour**, si c'est la première séance du jour ;
- **un nouveau niveau** : « Complicité niveau 3 : Pompon reçoit un bonnet », avec le bouton **« Lui mettre »**, qui l'enfile aussitôt.

**Séance interrompue ou abandonnée** : les minutes faites comptent quand même pour la complicité (comme pour l'objectif de la semaine) ; le compagnon est simplement assis, sans un mot de plus.

### Laissé au constructeur

Les dessins des cinq gestes et du saut de joie, la taille du compagnon dans l'anneau et la mise en page de l'écran de fin.

## Partie D — Respirer ensemble

### Ce qui est décidé

**Seulement dans les séances du domaine Calme**, un bouton sur l'écran de la séance, à côté de « Ambiance » : « Respirer avec Pompon », ou « Respiration guidée » sans compagnon (ou s'il est masqué).

**Le rythme** : **5 s pour inspirer, 5 s pour expirer** (6 respirations par minute), tant que la respiration est allumée :
- le compagnon gonfle doucement puis se dégonfle ; sans compagnon, un disque léger grandit et rétrécit derrière le minuteur ;
- sous le minuteur, « Inspire » et « Expire » remplacent le petit texte habituel, en alternance ;
- la progression de l'anneau ne change pas.

**Le choix est retenu** : allumée une fois, la respiration guidée revient dans les séances Calme suivantes, jusqu'à ce qu'on l'éteigne. Le même choix existe dans Réglages › Sessions, **éteint par défaut**.

**Mouvements réduits** : rien ne grandit ; seuls les mots alternent, en fondu.

**Lecteurs d'écran** : les mots ne sont pas annoncés toutes les 5 s. Le bouton dit son état (activé ou non), et une description unique explique le rythme : « 5 secondes pour inspirer, 5 pour expirer ».

**Ni son, ni vibration.**

### Laissé au constructeur

La forme du disque, la place exacte du bouton et la façon d'animer (CSS ou canvas), dans les règles ci-dessus.

## Partie E — Complicité et accessoires

### Ce qui est décidé

**La complicité**, c'est le temps des séances faites ensemble depuis l'arrivée du compagnon, réussies ou interrompues. Elle ne baisse jamais.

**Dix niveaux** (minutes ensemble) :

| Niveau | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Dès | 0 | 20 | 60 | 120 | 240 | 420 | 660 | 960 | 1320 | 1800 |

**Neuf accessoires**, un par niveau à partir du 2 :

| Niveau | Accessoire | Accessory |
|---|---|---|
| 2 | Écharpe | Scarf |
| 3 | Bonnet | Beanie |
| 4 | Lunettes rondes | Round glasses |
| 5 | Couronne de fleurs | Flower crown |
| 6 | Nœud papillon | Bow tie |
| 7 | Chapeau de paille | Straw hat |
| 8 | Sac à dos | Backpack |
| 9 | Casque audio | Headphones |
| 10 | Cape étoilée | Starry cape |

- **Un accessoire porté à la fois**, ou aucun ; choisi dans la garde-robe (Partie B), ou avec « Lui mettre » à la fin d'une séance.
- **Dessinés sur les trois animaux**, et visibles partout où l'est le compagnon : ville, séance, fiche, bouton du compagnon.
- Les noms d'accessoires s'écrivent avec leur article dans les phrases (« reçoit un bonnet », « reçoit des lunettes rondes »), comme les décors des souhaits.

## Partie F — Succès et Cabane

### Ce qui est décidé

**Trois succès de plus**, dans une nouvelle famille « Compagnon » :

| Succès | Achievement | Condition |
|---|---|---|
| Première rencontre | First meeting | accueillir un compagnon |
| Complices | Close friends | complicité niveau 5 |
| Inséparables | Inseparable | complicité niveau 10 ; offre la Cabane |

Le carnet compte donc **48 succès**. Ils ne se rattrapent pas, sauf « Première rencontre », qui se gagne à l'arrivée du compagnon.

**La Cabane** est un nouveau décor, le 52e élément :
- offerte par « Inséparables », comme les autres décors offerts par un succès ; ensuite, elle s'achète 3 M ;
- **son dessin** : une petite cabane en bois, un toit en pente, une porte ronde et un pot de fleurs ;
- la nuit, le compagnon dort à côté (Partie B) ;
- elle compte comme un décor (pour les souhaits et « Petits détails »), pas comme un élément de nature.

La collection du carnet compte donc **52 éléments**.

## Partie G — Réglages

- **Nouvelle section « Compagnon »**, après « Rituels » :
  - avec un compagnon : « Afficher Pompon » (activé par défaut ; dans la ville et pendant les séances) et le bouton « Modifier » ;
  - sans compagnon : le bouton « Accueillir un compagnon », qui ouvre le choix (Partie A).
- **Sessions** : « Respiration guidée pendant les séances Calme » (Partie D), éteint par défaut.

## Rythme et économie

- **Complicité** : à 30 min de séances par jour, le niveau 2 arrive le premier jour, le niveau 5 en un peu plus d'une semaine, le niveau 10 en deux mois environ.
- **Aucune pièce** en plus : les accessoires sont des cadeaux de complicité. La Cabane coûte 3 M une fois débloquée, comme les autres décors offerts.

## Données et compatibilité

**Nouveaux champs, tous facultatifs** :
- **`companion`** : `null` sans compagnon, sinon `{ species, name, since, minutes, wear }` :
  - `species` : `lapin`, `marmotte` ou `ourson` ;
  - `name` : le nom choisi (1 à 20 caractères) ;
  - `since` : la date d'arrivée ;
  - `minutes` : le temps passé ensemble (la complicité) ;
  - `wear` : l'accessoire porté, ou `''` ;
- **`companionLater`** : la date du « Pas maintenant » de l'invitation, ou 0 ;
- **réglages** : `companionShown` (activé par défaut), `breathing` (éteint par défaut).

**Les accessoires gagnés** ne sont pas enregistrés : ils se déduisent du niveau.

**Succès** : deux nouvelles sortes, « compagnon accueilli » et « niveau de complicité ».

**Fusion de deux onglets** :
- un compagnon accueilli gagne sur l'absence de compagnon ;
- deux compagnons différents (arrivés à des dates différentes) : celui arrivé le premier reste ;
- même compagnon : les minutes s'additionnent comme les pièces (ce que chaque onglet a ajouté depuis la dernière synchronisation) ; l'animal, le nom et l'accessoire changés d'un seul côté prennent ce changement, changés des deux côtés gardent celui de l'onglet courant ;
- `companionLater` : la date la plus récente.

**Validation** :
- un animal inconnu : pas de compagnon ;
- un nom vide ou trop long : la suggestion de l'animal ;
- des minutes négatives ou invalides : 0 ;
- un accessoire inconnu ou pas encore gagné : aucun ;
- les réglages hors liste reprennent leur valeur par défaut.

## Tests attendus

- **complicité** : chaque seuil de niveau, juste avant et juste au seuil ; les minutes d'une séance réussie ou interrompue s'ajoutent après l'arrivée seulement ; les accessoires gagnés suivent le niveau ; un accessoire pas encore gagné ne se porte pas ;
- **arrivée** : l'invitation n'apparaît qu'après une séance réussie ; « Pas maintenant » la range pour de bon ; nom vide, nom trop long, suggestion qui suit l'animal ; « Première rencontre » ;
- **mot du jour** : le même toute la journée ; celui du retour passe en premier ; un mot pour chaque cas ; jamais vide, en français comme en anglais ;
- **ville** : le compagnon dessiné le jour et endormi la nuit ; le bouton et le compagnon ouvrent la fiche ; rien en visite ni quand il est masqué ;
- **séance** : le compagnon dans l'anneau pour chacun des cinq domaines ; l'écran de fin avec le temps ajouté, le nouveau niveau et « Lui mettre » ;
- **respiration** : le bouton seulement en Calme ; « Inspire » et « Expire » alternent toutes les 5 s ; le choix est retenu ; rien ne grandit avec les mouvements réduits ;
- **succès** : les trois seuils ; 48 succès ; la Cabane offerte, dessinée dans ses limites ; 52 éléments ; lien de ville avec la Cabane lisible ;
- **fusion et validation** : les cas ci-dessus ;
- **mise en page** : invitation, choix, fiche, écran de séance et écran de fin à 320 px, en français et en anglais.

## Risques connus

- **Le charme d'un dessin ne se teste pas** : les dessins restent simples (formes rondes), et une planche montre chaque animal, chaque geste et chaque accessoire pour les relire d'un coup d'œil.
- **Un compagnon peut sembler enfantin** à certaines personnes : l'invitation se refuse, et le compagnon se masque en un geste.
- **Sur iPhone**, les animations s'arrêtent quand l'écran se verrouille : rien n'en dépend.
- **La batterie** : l'animation reste lente, et s'arrête quand l'écran est caché.
