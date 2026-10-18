# Étape 4 — Rituels et partage : défis de la semaine, bilan, humeur, ville d'un ami et récapitulatifs

Date : 18 octobre 2026. Projet : Ville du bien-être (`Lubachma/ville-du-bien-etre`). Dernière étape de la feuille de route décrite dans `2026-10-18-langue-reglages-serie-design.md` ; les étapes 1 à 3 sont en ligne depuis le 18 octobre.

## Intention

Ludovic veut que les gens aient envie de revenir dans leur ville plus longtemps, et que le jeu soit plus amusant. Pour cette étape, il a demandé de faire directement ce qui est recommandé, sans questions : **tous les choix de ce document sont donc ceux de Claude**. Tout reste gratuit, sans serveur ni compte.

Les étapes 1 à 3 donnent une raison de revenir chaque jour : la série, le contenu, la ville vivante. Celle-ci ajoute des **rendez-vous** à l'échelle de la semaine et du mois, et un peu de **lien** avec les proches :
1. **trois défis doux chaque semaine**, à la mesure de chacun ;
2. **un bilan au début de chaque semaine**, qui montre le chemin fait et lance la suivante ;
3. **l'humeur après une séance**, pour découvrir ce qui fait du bien ;
4. **visiter la ville d'un ami** grâce à un simple lien, et garder des cartes postales ;
5. **un récapitulatif du mois et de l'année**, qu'on peut partager en image.

Ce que font les autres, et ce que dit la recherche :
- **L'effet « nouveau départ »** (Dai, Milkman et Riis, 2014) : les gens s'engagent davantage aux débuts de semaine, de mois et d'année. Le bilan du début de semaine et le récapitulatif du mois s'appuient dessus.
- **Apple Forme (défis du mois)** : chaque défi est calculé sur ce que la personne a déjà fait. On reprend l'idée : des défis à sa mesure, jamais un chiffre tombé du ciel.
- **Animal Crossing (visites en rêve)** : on visite une copie de l'île d'un ami, même s'il n'est pas là, sans rien pouvoir y abîmer. C'est le modèle de la visite par lien, qui marche sans serveur.
- **Daylio, How We Feel** : noter son humeur d'un geste, puis voir quelles activités vont avec les bons jours. Suivre son humeur aide à mieux reconnaître ce qu'on ressent (Kauer et al., 2012).
- **Spotify Wrapped, Duolingo (bilan de l'année)** : un récapitulatif en image, qu'on a envie de montrer.
- **À ne pas reprendre** : les classements entre amis (comparaison et pression), les défis qui « échouent », les humeurs qu'on note pour gagner quelque chose.

Trois principes guident tout le reste :
- **Rien ne se rate et rien ne se reproche.** Un défi non relevé disparaît sans un mot ; un bilan ne compte que ce qui a été fait.
- **L'intime reste dans le téléphone.** L'humeur, les minutes et le journal ne quittent jamais l'appareil, sauf si la personne partage elle-même une image de son mois.
- **Aucune comparaison avec les autres.** On visite la ville d'un ami pour l'admirer, pas pour se mesurer.

## Objectifs

- **Un rendez-vous chaque semaine** : le bilan de la semaine passée et trois nouveaux défis.
- **Des défis à la mesure de chacun**, calculés sur ses quatre dernières semaines, avec une petite récompense.
- **Comprendre ce qui fait du bien** : une humeur notée d'un geste après une séance, et ce qui en ressort dans le Journal.
- **Montrer sa ville** : un lien à envoyer ; l'ami la voit en grand et peut en garder une carte postale.
- **Fêter le chemin parcouru** chaque mois et chaque année, en image si on veut.
- **Tout existe en français et en anglais.**

## Hors périmètre

- **Pas de serveur, de compte, de liste d'amis ni de notifications.** Le partage passe par un lien, comme une photo.
- **Pas de classement**, pas de comparaison des minutes, pas de défis entre amis.
- **Pas de journal intime** (texte libre) avec l'humeur. *Choix de Claude : un geste suffit, le texte viendra peut-être plus tard.*
- **Pas de nouvel élément à acheter** : la récompense des défis est en pièces.

## À éviter absolument

- **Un mot de reproche ou de perte** : « défi raté », « semaine perdue », « moins bien que la semaine dernière ».
- **Une humeur qui juge**, une récompense pour noter son humeur, ou un conseil qui joue au médecin.
- **Des données privées dans un lien ou une image partagée** : pièces, minutes, journal, humeurs, activités.
- **Des fenêtres qui s'ouvrent sans cesse** : chaque bilan ou récapitulatif s'ouvre tout seul une seule fois.
- **Une ville modifiée par une visite**, ou la ville d'un ami mélangée à la sienne.
- **Des textes qui débordent à 320 px**, en français comme en anglais.

## Contraintes

- Gratuit, sans serveur, sans compte, utilisable hors connexion.
- Même architecture : fichiers `src/NN-*.js` assemblés par `npm run build`, sans dépendance.
- **Données** : format v2 inchangé, nouveaux champs facultatifs (voir « Données et compatibilité »). Une ancienne version de l'app ignore ces champs sans erreur.
- **Reproductible** : la même semaine donne les mêmes défis dans tous les onglets et sur tous les appareils d'une même ville (tirage par la semaine et la date de création, comme les visiteurs).
- **Tests** : `npm run check`, `npm test` et `npm run test:browser` passent en local et dans le workflow de publication, qui tourne sous Linux (polices un peu plus larges).

## Partie A — Défis de la semaine

### Ce qui est décidé

**Trois défis par semaine.** La semaine suit le réglage « début de semaine » (lundi ou dimanche).
- **Tirage reproductible** : la semaine et la date de création de la ville.
- **Un défi par famille** :
  - **Pratique** : domaines variés, domaine retrouvé, longue séance, deux domaines le même jour ;
  - **Moments** : une séance avant 9 h, une séance après 20 h, une séance le week-end ;
  - **Découverte** : une activité tirée au sort menée au bout, une routine terminée, deux visiteurs salués, un nouvel élément posé, une séance en mode Concentration.
- **Défis impossibles écartés** :
  - « une routine terminée » seulement si une routine existe ;
  - « deux visiteurs salués » seulement si la ville vivante est active.

**À la mesure de chacun.** Les cibles viennent des **quatre semaines précédentes** et restent fixes toute la semaine :
- **domaines variés** : la moyenne des domaines différents pratiqués par semaine, plus un, entre 2 et 5 ;
- **domaine retrouvé** : un domaine absent la semaine passée, sinon le moins pratiqué ;
- **longue séance** : la durée médiane des séances réussies × 1,5, arrondie à 5 minutes, entre 10 et 60.

Une ville neuve, sans historique, reçoit les cibles de départ : 2 domaines, 15 minutes.

| Défi | Challenge | Relevé quand |
|---|---|---|
| Pratique {n} domaines différents | Practice {n} different areas | {n} domaines avec une séance réussie |
| Retrouve {domaine} | Get back to {area} | une séance réussie dans ce domaine |
| Une séance d'au moins {m} min | One session of at least {m} min | une séance réussie de {m} min ou plus |
| Deux domaines le même jour | Two areas on the same day | deux domaines un même jour |
| Une séance avant 9 h | A session before 9 am | une séance réussie terminée avant 9 h |
| Une séance après 20 h | A session after 8 pm | une séance réussie terminée après 20 h |
| Une séance le week-end | A weekend session | une séance réussie un samedi ou un dimanche |
| Une activité tirée au sort, jusqu'au bout | A drawn activity, all the way | une séance réussie venue du tirage |
| Une routine en entier | A whole routine | une routine terminée |
| Dis bonjour à deux visiteurs | Say hello to two visitors | des visiteurs salués deux jours différents |
| Un nouvel élément dans ta ville | Something new in your town | un élément posé cette semaine |
| Une séance en Concentration | A Focus session | une séance Concentration réussie |

**Récompense** : 5 M par défi relevé, une seule fois.
- Message : « Défi relevé : … · +5 M ».
- Le cadeau est enregistré comme ceux des visiteurs et des fêtes. Il n'est donc jamais compté deux fois quand deux onglets se rejoignent.

**Changer un défi** : une fois par semaine, un défi peut être remplacé par le suivant du tirage.

**Fin de semaine** : les défis non relevés disparaissent sans un mot. Le bilan ne compte que ceux relevés (« 2 défis relevés »).

**Où on les voit** :
- une carte « Défis de la semaine » dans le Journal, sous l'objectif de la semaine, avec leur progression (« 1 / 2 ») et la récompense ;
- le bilan de la semaine les présente au début de chaque semaine.

**Réglage** : les défis peuvent être coupés. Plus de carte, de message ni de récompense.

### Laissé au constructeur

La formulation exacte des défis, l'ordre du tirage au sein d'une famille et l'icône de chaque famille.

## Partie B — Bilan de la semaine

### Ce qui est décidé

**À la première ouverture d'une nouvelle semaine**, sur la Ville, une fenêtre « Ta semaine » s'ouvre **une fois**.

Elle ne s'ouvre pas :
- dans une ville créée cette semaine ;
- pendant une séance en cours ;
- si une autre fenêtre est ouverte ;
- si le réglage « Bilans au début de la semaine et du mois » est coupé.

Ensuite, une carte « Ta semaine dernière » reste en haut du Journal jusqu'à la fin de la semaine.

**Contenu**, de haut en bas :
- **les dates** de la semaine passée, et une phrase d'accueil choisie selon la semaine, toujours positive :
  - « Belle semaine ! » si l'objectif est atteint ;
  - « Une semaine bien remplie » s'il y a eu au moins 3 jours actifs ;
  - « Une semaine tout en douceur » sinon ;
  - « Bon retour ! » si elle a été vide ;
- **les chiffres** : temps de pratique, jours actifs, séances réussies, domaines pratiqués (pastilles de couleur) ;
- **les beaux moments** :
  - la plus longue séance, le domaine favori ;
  - ce qui est arrivé à la ville : éléments posés, visiteurs rencontrés, fêtes ;
  - les défis relevés ;
  - l'humeur, si elle a été notée : « Après 6 séances sur 8, tu te sentais bien » ;
- **l'objectif de la semaine** :
  - « Objectif atteint » quand c'est le cas ;
  - sinon, le chemin fait (« 45 min sur 60 »), sans mot de manque ;
- **un progrès sur la semaine d'avant**, seulement s'il est positif : « +20 min par rapport à la semaine d'avant » ;
- **« Cette semaine »** : les trois nouveaux défis, un bouton « Choisir mon objectif » et un bouton « C'est parti ».

**Une semaine vide** ne montre aucun chiffre à zéro. Elle affiche seulement « Bon retour ! Une nouvelle semaine commence » et les défis.

### Laissé au constructeur

La mise en page des chiffres et des pastilles, et l'ordre des beaux moments.

## Partie C — Humeur

### Ce qui est décidé

**Après une séance réussie**, l'écran de fin demande « Comment te sens-tu ? ».
- **Cinq visages** : « Pas bien du tout », « Pas trop », « Comme ci, comme ça », « Bien », « Très bien ».
- Un toucher suffit, et on peut changer d'avis tant que l'écran est ouvert.
- Un bouton « Passer », et rien n'est demandé deux fois.
- Les visages sont dessinés en SVG, avec leur nom lu par les lecteurs d'écran.

**Où va l'humeur** :
- elle est **gardée avec la séance**, dans le journal de l'appareil ;
- elle n'est **jamais** dans un lien, une image ou un bilan partagé.

**Dans le Journal**, une carte « Ce qui te fait du bien » apparaît dès 5 humeurs notées :
- **les barres** : pour chaque domaine avec au moins 2 humeurs, la part des séances après lesquelles tu te sentais bien ou très bien ;
- **une phrase** pour le domaine en tête : « Après Calme, tu te sentais bien 4 fois sur 5 ».

Aucune note globale, aucune série d'humeurs, aucun succès ni aucune pièce liés à l'humeur.

**Les moments difficiles** :
- **quand** : au moins 3 des 5 dernières humeurs notées en 14 jours sont « Pas trop » ou « Pas bien du tout » ;
- **la carte**, douce : « Tes dernières séances ont été difficiles. Une activité tranquille, un moment dehors ou parler à quelqu'un de confiance peut aider. Si ça dure, un professionnel de santé peut t'accompagner. » ;
- **sa durée** : un bouton « Merci » la ferme, et elle ne revient pas avant 7 jours ;
- **pas de numéro d'aide** : l'app est utilisée dans plusieurs pays.

**Réglage** : « Demander mon humeur après une séance », activé par défaut. Coupé, l'écran de fin ne la demande plus ; les humeurs déjà notées restent.

### Laissé au constructeur

Le dessin des visages, leurs couleurs et la mise en page des barres.

## Partie D — Visiter la ville d'un ami

### Ce qui est décidé

**Sans serveur, par un lien** qui contient la ville.

**Partager** : un bouton « Partager ma ville », sur la Ville à côté de « Personnaliser ma ville ».
- Il ouvre le partage du téléphone quand il existe ; sinon, le lien est copié et affiché dans une fenêtre pour le sélectionner.
- La fenêtre dit : « Ton ami verra ta ville telle qu'elle est : son nom et ses éléments, sans tes minutes, ton journal ni tes humeurs. »

**Ce que le lien contient, et rien d'autre** :
- le nom de la ville et la taille du terrain ;
- les éléments : type, place, étape d'une merveille, niveau ;
- les fleurs du Grand Arbre ;
- un identifiant tiré au hasard, pour reconnaître la même ville lors d'une visite suivante.

Le contenu est encodé de façon compacte : moins de 1 000 caractères pour une ville de 11 × 11 pleine.

**Ouvrir un lien** :
- l'app s'ouvre sur sa propre ville, puis montre aussitôt **la ville de l'ami en grand**, avec la vue en grand de l'étape 3 en lecture seule ;
- en haut, son nom (« Ville de Léa ») ; on peut zoomer et se déplacer ;
- elle est dessinée **sous son propre ciel** : l'heure, la saison et la météo de sa ville à soi, sans visiteur ni habitants ;
- deux boutons :
  - « Garder la carte postale » ;
  - « Partager ma ville en retour ».

Sa propre ville n'est jamais modifiée par une visite.

**Dans l'app installée sur iPhone**, un lien s'ouvre dans le navigateur, qui a sa propre mémoire. La fenêtre de partage propose donc aussi **« Visiter une ville amie »** : on y colle un lien reçu.

**Cartes postales** : dans le carnet, onglet « Visites », une partie **« Villes amies »** :
- pour chaque carte : vignette de la ville, son nom et la date de la visite ;
- toucher une carte rouvre la ville ;
- une même ville revisitée met sa carte à jour ;
- 50 cartes au plus : la plus ancienne laisse sa place.

**Un lien abîmé ou trop long** (plus de 4 000 caractères) donne un message doux : « Ce lien de ville n'est pas lisible ». L'app continue normalement.

### Laissé au constructeur

Le format exact du code, la vignette des cartes postales et la place des boutons de la visite.

## Partie E — Récapitulatifs du mois et de l'année

### Ce qui est décidé

**À la première ouverture d'un nouveau mois**, « Ton mois de septembre » s'ouvre une fois si le mois a eu de l'activité.
- Mêmes règles que le bilan de la semaine.
- Si les deux sont dus le même jour, le récapitulatif passe d'abord ; le bilan s'ouvrira à l'ouverture suivante.

**En janvier**, « Ton année 2026 » remplace le mois de décembre, qui reste disponible dans le Journal.

**Contenu** :
- **les chiffres** : temps de pratique, jours actifs ;
- **les séances** : leur nombre pour un mois. Pour l'année, il est omis : le journal ne garde que les 150 dernières séances ;
- **les domaines** : le domaine favori et la répartition par domaine ;
- **les moments** : le plus beau jour, la plus longue séance ;
- **la ville** : éléments posés, étapes de merveilles, ensembles découverts, visiteurs rencontrés pour la première fois, fêtes vécues ;
- **les défis relevés et les succès gagnés** ;
- **l'humeur**, sur l'écran seulement : « Après 18 séances sur 22, tu te sentais bien ».

**Partager l'image** : une carte de 1080 × 1350 px.
- Elle montre le nom de la période, trois chiffres (temps de pratique, jours actifs, éléments posés), le domaine favori et l'image de la ville.
- Elle passe par le partage du téléphone quand il accepte les fichiers, sinon par un téléchargement.
- Elle ne contient jamais l'humeur.

**Dans le Journal**, une carte « Ton mois » reste jusqu'à la fin du mois suivant, et une carte « Ton année » jusqu'à fin janvier.

### Laissé au constructeur

La mise en page de la fenêtre et de l'image, et le choix des beaux moments quand il y en a beaucoup.

## Partie F — Carnet, succès et réglages

### Ce qui est décidé

**Quatre succès de plus**, dans une nouvelle famille « Rituels ». Aucun ne dépend de l'humeur.

| Succès | Achievement | Condition |
|---|---|---|
| Premier défi | First challenge | relever un défi |
| Défis en série | Challenge streak | relever 12 défis |
| Semaine complète | Full week | relever les 3 défis d'une même semaine |
| Carte postale | Postcard | garder la carte postale d'une ville amie |

Le carnet compte donc 42 succès. Ils ne se rattrapent pas : rien avant cette étape ne les mesure.

**Réglages**, dans une nouvelle section « Rituels » :
- **Bilans au début de la semaine et du mois** (activé) : coupé, bilans et récapitulatifs ne s'ouvrent plus d'eux-mêmes et restent dans le Journal ;
- **Défis de la semaine** (activé) ;
- **Demander mon humeur après une séance** (activé).

## Partie G — Rythme et économie

**Récompense des défis** : 5 M par défi, donc 15 M par semaine au plus.

Pour quelqu'un qui pratique 30 min par jour (environ 210 M par semaine), cela fait au plus 7 % de ses gains. Le rythme des étapes 2 et 3 change à peine.

**Rien ne rapporte de pièces** parmi : l'humeur, le partage, les visites et les bilans.

*Choix de Claude* : les défis demandent de pratiquer, ils méritent donc un petit cadeau. Le reste est du lien et de la réflexion, qui ne doivent pas devenir des moyens de gagner.

## Données et compatibilité

**Nouveaux champs, tous facultatifs** :
- **réglages** : `rituals`, `challenges` et `mood`, des oui/non activés par défaut ;
- **`challenges`** : `{ week, swapped }`, la semaine des défis et l'éventuel défi changé ; les défis eux-mêmes se recalculent ;
- **`history[].mood`** : l'humeur après la séance, de 1 à 5 ;
- **`postcards`** : les cartes postales, chacune avec le code de la ville, son nom, sa taille, son nombre d'éléments et la date ;
- **`rituals`** : la dernière semaine, le dernier mois et la dernière année montrés d'eux-mêmes ;
- **`shareId`** : l'identifiant tiré au hasard, créé au premier partage ;
- **`gifts`** : il accepte les clés `chal:<semaine>:<défi>`.

**Fusion de deux onglets** :
- cartes postales : réunies, la plus récente d'une même ville gagne ;
- marqueurs des rituels : le plus avancé gagne ;
- humeur d'une séance : celle qui a été notée gagne ;
- cadeaux de défi en double : remboursés comme les autres cadeaux.

**Validation** : défis, humeurs et cartes postales inconnus ou mal formés sont ignorés, et les nombres bornés.

## Tests attendus

**Tests unitaires** :
- défis :
  - tirage reproductible, un par famille ;
  - cibles adaptées aux quatre semaines passées ;
  - défis impossibles écartés ;
  - progression ;
  - récompense une seule fois, sans double à la fusion ;
  - changement d'un défi ;
- bilan de la semaine : chiffres, phrase d'accueil, semaine vide sans zéros, progrès seulement positif ;
- humeur : enregistrement, validation, fusion, « Ce qui te fait du bien », moments difficiles ;
- lien de ville :
  - aller-retour ;
  - taille pour une ville 11 × 11 pleine ;
  - rien de privé dans le code ;
  - lien abîmé refusé sans erreur ;
- cartes postales : ajout, mise à jour, limite de 50 ;
- récapitulatifs : mois et année, chiffres, humeur absente de l'image ;
- succès : les quatre conditions et leur seuil.

**Tests navigateur** :
- bilan :
  - il s'ouvre une seule fois au début de la semaine (horloge simulée), puis plus au rechargement ;
  - sa carte reste dans le Journal ;
- défi relevé : message et 5 M une seule fois ;
- humeur : notée sur l'écran de fin et retrouvée dans le Journal ; le réglage coupé ne la demande plus ;
- partage : le lien s'affiche ;
- visite :
  - ouvrir le lien montre la ville de l'ami, sans toucher à la sienne ;
  - garder la carte postale la place dans le carnet ;
  - coller un lien dans « Visiter une ville amie » marche aussi ;
- récapitulatif du mois : il s'ouvre une fois, et l'image se crée ;
- réglages des rituels ;
- à 320 px, en français et en anglais, rien ne déborde.

## Risques connus

- **Un lien long** (environ 600 caractères pour une ville 11 × 11 pleine) peut être coupé par certaines messageries. La fenêtre de partage affiche donc le lien en entier, pour pouvoir le copier.
- **Sur iPhone**, un lien ouvert depuis une messagerie arrive dans le navigateur, pas dans l'app installée. La carte postale gardée dans le navigateur n'apparaît donc pas dans l'app. « Visiter une ville amie », dans l'app, contourne ce point.
- **Les fenêtres qui s'ouvrent seules** peuvent agacer : une seule par ouverture, une seule fois par période, et un réglage pour les couper.
- **L'humeur est un sujet sensible** : jamais obligatoire, jamais partagée, jamais récompensée, et des mots prudents.
