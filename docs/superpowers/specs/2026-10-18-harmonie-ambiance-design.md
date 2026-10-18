# Étape 5 — Harmonie et ambiance : souhaits des habitants, harmonie de la ville et sons d'ambiance

Date : 18 octobre 2026. Projet : Ville du bien-être (`Lubachma/ville-du-bien-etre`). La feuille de route de `2026-10-18-langue-reglages-serie-design.md` s'arrêtait à l'étape 4, en ligne depuis le 18 octobre. Cette étape reprend les idées du classement de départ qui n'avaient pas encore été faites.

## Intention

Ludovic veut que les gens aient envie de revenir dans leur ville plus longtemps, et que le jeu soit plus amusant. Pour cette étape, il a demandé de faire directement ce qui est recommandé, sans questions : **tous les choix de ce document sont donc ceux de Claude**. Tout reste gratuit, sans serveur ni compte.

Les étapes 1 à 4 donnent des raisons de revenir (série, contenu, ville vivante, rituels). Il reste deux manques, visibles une fois la ville bien remplie :
- **Que faire de ses pièces et de sa ville ?** Une ville avancée accumule des pièces sans but précis, et on la réarrange rarement.
- **La séance elle-même** reste muette jusqu'au son de fin, alors que c'est le moment principal de l'app.

Cette étape ajoute donc :
1. **des souhaits d'habitants** : chaque jour, un bâtiment aimerait un décor juste à côté ; l'exaucer fait plaisir et rapporte un petit cadeau ;
2. **l'harmonie de la ville** : cinq étoiles à gagner en arrangeant sa ville, avec des conseils doux ;
3. **des sons d'ambiance pendant les séances** : pluie, vagues, feu de camp, vent ou bruit doux, au choix.

Ce que font les autres, et ce que dit la recherche :
- **Animal Crossing (évaluation de l'île)** : une note de 1 à 5 étoiles, des conseils pour l'améliorer, une récompense visible à la dernière étoile. On reprend les étoiles et les conseils, mais **une étoile gagnée ne se perd plus**.
- **Animal Crossing (demandes des habitants)** : un voisin demande un objet, on le lui apporte, il remercie. C'est le modèle des souhaits.
- **Islanders, Townscaper** : placer les éléments les uns près des autres est un plaisir en soi ; les voisinages comptent.
- **Noisli, Endel, Forest** : des fonds sonores (pluie, vent, bruit) pour se concentrer ou se détendre. Des sons de nature aident à récupérer après un stress (Alvarsson, Wiens et Nilsson, 2010). L'effet varie selon les personnes : c'est un choix, **coupé par défaut**.
- **À ne pas reprendre** : les demandes qui expirent, les notes qui baissent, les sons qui démarrent sans qu'on les ait choisis.

Trois principes guident tout le reste :
- **Rien ne se rate et rien ne se reproche.** Un souhait n'expire jamais ; on peut le laisser de côté sans un mot de manque. Une étoile gagnée reste gagnée.
- **Proposer, jamais juger.** Les conseils disent ce qui ferait plaisir, pas ce qui ne va pas.
- **Le silence par défaut.** Aucun son ne démarre sans que la personne l'ait choisi.

## Objectifs

- **Un petit objectif concret à chaque visite** de la ville : un souhait à exaucer avec un décor.
- **Une raison de réarranger sa ville** : cinq étoiles d'harmonie, chacune expliquée.
- **Des séances plus agréables** pour ceux qui le veulent : cinq ambiances sonores, sans fichier à télécharger.
- **Une récompense visible** : un nouveau décor, l'Arche fleurie, offert à la cinquième étoile.
- **Tout existe en français et en anglais.**

## Hors périmètre

- **Pas de son dans la ville** en dehors des séances. *Choix de Claude : le silence par défaut de l'étape 3 reste.*
- **Pas de musique ni de fichiers audio** : tout est fabriqué par le navigateur, hors connexion.
- **Pas de note qui baisse**, pas de comparaison avec d'autres villes.
- **Pas d'autre nouvel élément que l'Arche fleurie**, ni de nouveaux sols ou quartiers.
- **Pas de nouvelle langue** (allemand, italien). *Choix de Claude : une étape à part si Ludovic le souhaite.*

## À éviter absolument

- **Un mot de reproche ou de perte** : « souhait raté », « étoile perdue », « ta ville manque de… ».
- **Une pression pour acheter** : pas de compte à rebours, pas de souhait qui part, pas de rappel insistant.
- **Un son qui surprend** : pas de démarrage automatique, pas de saturation, pas de coupure brutale au milieu d'une séance qui continue.
- **Des textes qui débordent à 320 px**, en français comme en anglais.

## Contraintes

- Gratuit, sans serveur, sans compte, utilisable hors connexion.
- Même architecture : fichiers `src/NN-*.js` assemblés par `npm run build`, sans dépendance.
- **Données** : format v2 inchangé, nouveaux champs facultatifs (voir « Données et compatibilité »). Une ancienne version de l'app ignore ces champs sans erreur.
- **Reproductible** : le même jour donne le même souhait dans tous les onglets d'une même ville (tirage par le jour et la date de création, comme les visiteurs).
- **Liens de ville** : l'Arche fleurie s'ajoute à la fin de `SHARE_ITEMS` ; les liens déjà envoyés restent lisibles.
- **Tests** : `npm run check`, `npm test` et `npm run test:browser` passent en local et dans le workflow de publication, qui tourne sous Linux (polices un peu plus larges).

## Partie A — Souhaits des habitants

### Ce qui est décidé

**Un souhait à la fois**, et au plus un nouveau par jour : un bâtiment de la ville aimerait un décor dans une de ses huit cases voisines (diagonales comprises).

**Qui souhaite quoi.** Seuls les éléments des cinq domaines souhaitent (pas les décors, ni la Tour de l'horloge, ni les merveilles). Chaque domaine aime certains décors :

| Domaine | Décors aimés |
|---|---|
| Foyer | fleurs, haie, banc, potager |
| Esprit | banc, arbre, livres, lanterne |
| Corps | arbre, fanions, banc, fleurs |
| Calme | cerisier, étang, pas japonais, lanterne |
| Créativité | lampadaire, fanions, statue, fleurs |

**Le tirage** :
- parmi les bâtiments qui ont au moins une case voisine libre ;
- parmi les décors aimés qui sont **déjà débloqués** et que le bâtiment **n'a pas déjà** à côté ;
- avec `chance(jour + ':souhait')`, comme les visiteurs : le même jour, le même souhait dans tous les onglets ;
- sans candidat (ville vide, tout est déjà à côté), pas de souhait ce jour-là.

**Où on le voit** :
- **une bulle au-dessus du bâtiment**, dans la ville, avec le décor souhaité dessiné en petit. La toucher ouvre la fiche du bâtiment ;
- **une carte « Souhait du jour » sous la ville** : le nom du bâtiment, sa phrase (« J'aimerais un banc juste à côté. »), un bouton « Placer un banc · 2 M » qui lance la pose de ce décor, et un bouton « Pas maintenant » ;
- **la fiche du bâtiment** rappelle le souhait, avec le même bouton.

Le bâtiment parle à la première personne : pas d'article devant son nom, donc pas de « le / la / l' » à accorder. Le décor souhaité a sa propre tournure par langue (« un banc », « une haie », « des fleurs »).

**Exaucé** quand un décor du type voulu se trouve dans une case voisine du bâtiment :
- vérifié après chaque pose ou déplacement, et à chaque affichage de la Ville (un décor posé dans un autre onglet compte) ;
- **un petit cadeau de 3 M**, une seule fois ;
- **un message**, où le bâtiment remercie à la première personne : « Souhait exaucé · Boulangerie : « Merci, c'est parfait ! » · +3 M » ;
- **des étincelles** au-dessus du bâtiment (l'effet existant des ensembles) ;
- le souhait suivant arrive **le lendemain**.

**« Pas maintenant »** range le souhait sans rien dire de plus ; un autre viendra le lendemain.

**Le souhait suit son bâtiment** : déplacé, la bulle suit ; retiré, le souhait disparaît, et un autre viendra le lendemain.

**Jamais d'expiration** : un souhait non exaucé reste là, jour après jour, jusqu'à ce qu'il soit exaucé ou laissé de côté.

**Réglage** « Souhaits des habitants », activé par défaut. Coupé, plus de bulle ni de carte, et aucun souhait n'est tiré.

### Laissé au constructeur

Le dessin de la bulle, la mise en page de la carte et le choix du bâtiment quand plusieurs conviennent (dans le respect du tirage par jour).

## Partie B — Harmonie de la ville

### Ce qui est décidé

**Cinq étoiles, une par critère.** Une étoile se gagne quand la ville remplit son critère ; **elle reste gagnée pour toujours**, même si on déplace ou retire ensuite des éléments.

Un « bâtiment » est ici un élément d'un des cinq domaines (au sol ou non). Les cinq critères :

| Étoile | Critère |
|---|---|
| **Verdure** | au moins 2 éléments de nature (arbre, cerisier, haie, fleurs, potager), et au moins un pour 3 bâtiments |
| **Variété** | des bâtiments d'au moins 3 domaines différents |
| **Petits détails** | au moins 4 bâtiments, et au moins 3 sur 4 ont un décor dans une case voisine |
| **Quartiers** | au moins 2 ensembles de voisinage formés en même temps |
| **Lumières du soir** | au moins un lampadaire ou une lanterne, et au moins un pour 5 bâtiments |

**Chaque étoile rapporte 10 M**, une seule fois, avec le message « Nouvelle étoile d'harmonie : Verdure · +10 M ». Les étoiles sont vérifiées au même moment que les souhaits (pose, déplacement, affichage de la Ville).

**Où on le voit** : un bouton « Harmonie ★★☆☆☆ » sous la ville, à côté de « Personnaliser ma ville » et « Partager ma ville ». Il ouvre la fenêtre **« Harmonie de ta ville »** :
- les cinq étoiles, chacune avec son nom ;
- pour une étoile gagnée : sa date ;
- pour une étoile à venir : **un conseil doux et concret**, qui dit ce qui ferait plaisir, chiffre compris (« Encore 2 éléments de nature apporteraient de la verdure », « Un lampadaire ferait briller ta ville le soir »). Jamais « il manque », « pas assez ».

La ville d'un ami (visite) ne montre ni harmonie ni souhait.

### Laissé au constructeur

La mise en page de la fenêtre et la forme exacte des conseils, dans les règles ci-dessus.

## Partie C — Sons d'ambiance pendant les séances

### Ce qui est décidé

**Cinq ambiances**, plus « Aucune » (le choix par défaut) :
- **Pluie** : une pluie douce et régulière ;
- **Vagues** : un ressac lent, qui monte et redescend ;
- **Feu de camp** : un souffle grave avec de petits crépitements ;
- **Vent** : un vent qui passe et tourne doucement ;
- **Bruit doux** : un bruit grave et régulier (bruit brun), pour masquer les bruits autour.

**Fabriquées par le navigateur** (Web Audio), à partir de bruit filtré : aucun fichier, hors connexion. Le niveau reste doux, sans saturation, et la boucle ne s'entend pas.

**Quand** :
- pendant toute la séance, en Concentration comme en Activité libre ;
- **fondu d'entrée de 3 s** au départ ;
- **à la fin**, fondu de sortie de 1,5 s, puis le son de fin habituel ;
- **arrêt immédiat** si la séance est abandonnée, interrompue (sortie de l'app en Concentration) ou finie dans un autre onglet ;
- **pause et reprise** d'une routine : l'ambiance s'arrête pendant la pause libre entre deux étapes, et reprend avec l'étape suivante.

**Choisir** :
- **dans Réglages › Sessions** : « Ambiance pendant les séances » (les six choix) et « Volume de l'ambiance » (doux, normal, fort). Chaque choix fait entendre 3 s d'aperçu, pendant le geste ;
- **pendant la séance** : un bouton « Ambiance : Pluie » sur l'écran de la séance ouvre une petite fenêtre avec les six choix. Le changement s'entend aussitôt et devient le choix par défaut.

**Indépendante du son de fin** : couper le son de fin ne coupe pas l'ambiance, et inversement. La vibration ne change pas.

**Sur iPhone**, une app web perd le son quand l'écran se verrouille. Les réglages le disent simplement : « Sur iPhone, l'ambiance s'arrête quand l'écran se verrouille. »

### Laissé au constructeur

La recette de chaque ambiance (filtres, modulations, crépitements), dans ces limites : niveau moyen doux, crête toujours sous la saturation, boucle sans clic. La place du bouton sur l'écran de la séance.

## Partie D — Succès et Arche fleurie

### Ce qui est décidé

**Trois succès de plus**, dans la famille « Ville » :

| Succès | Achievement | Condition |
|---|---|---|
| Premier souhait | First wish | exaucer un souhait |
| Habitants comblés | Happy residents | exaucer 10 souhaits |
| Ville harmonieuse | Harmonious town | gagner les 5 étoiles d'harmonie ; offre l'Arche fleurie |

Le carnet compte donc **45 succès**. Ils ne se rattrapent pas : rien avant cette étape ne les mesure.

**L'Arche fleurie** est un nouveau décor, le 51e élément :
- offerte par « Ville harmonieuse », comme les autres décors offerts par un succès ; ensuite, elle s'achète 4 M ;
- **son dessin** : deux montants et un arc couverts de fleurs aux couleurs des cinq domaines ;
- elle compte comme un décor (pour les souhaits et « Petits détails »), pas comme un élément de nature.

La collection du carnet compte donc **51 éléments**.

## Partie E — Réglages

- **Sessions** : « Ambiance pendant les séances » et « Volume de l'ambiance » (Partie C).
- **Rituels** : « Souhaits des habitants » (Partie A), activé par défaut.

## Rythme et économie

- **Souhaits** : 3 M par souhait exaucé, au plus un par jour, soit au plus 21 M par semaine. Le décor à poser coûte de 0,5 à 6 M : le souhait est un petit merci, pas un gain.
- **Harmonie** : 10 M par étoile, 50 M en tout, une seule fois.
- Pour comparer : une minute de séance rapporte 1 M, et les défis au plus 15 M par semaine.

## Données et compatibilité

**Nouveaux champs, tous facultatifs** :
- **réglages** : `ambience` (`none` par défaut, ou `rain`, `waves`, `fire`, `wind`, `brown`), `ambienceVolume` (`soft`, `normal` ou `loud` ; `normal` par défaut), `townWishes` (oui/non, activé par défaut) ;
- **`townWish`** : le souhait en cours, `{ day, tile, item }`, avec `done` (date) une fois exaucé ou `skipped: true` s'il a été laissé de côté ; `null` sans souhait. *Choix de Claude : `wishes` désigne déjà la liste « Mes envies » du tirage, d'où le préfixe `town`.* ;
- **`gifts`** : il accepte les clés `wish:<jour>` (3 M) et `star:<critère>` (10 M). **Les étoiles gagnées sont ces clés** : leur date est celle de l'étoile, et rien d'autre ne les enregistre.

**Fusion de deux onglets** :
- souhait : celui du jour le plus récent gagne ; le même jour, un souhait exaucé ou laissé de côté gagne sur un souhait en cours ;
- cadeaux de souhait ou d'étoile en double : remboursés comme les autres cadeaux.

**Validation** : un souhait dont le bâtiment ou le décor est inconnu est ignoré ; les réglages hors liste reprennent leur valeur par défaut.

## Tests attendus

- **souhaits** : même tirage pour un même jour ; uniquement des décors débloqués, aimés et absents ; aucun souhait sans case voisine libre ; exaucé par un décor en diagonale ; 3 M une seule fois ; « Pas maintenant » ; le lendemain, un nouveau ; bâtiment retiré ; réglage coupé ;
- **harmonie** : chaque critère juste avant et juste à son seuil ; étoile gardée après un retrait ; 10 M une seule fois par étoile ; fenêtre « Harmonie de ta ville » à 320 px, en français et en anglais ;
- **ambiances** : chacune rendue hors ligne (OfflineAudioContext) reste sous la saturation, avec un niveau moyen dans des bornes douces ; l'ambiance démarre avec la séance, s'arrête à la fin, à l'abandon et à la sortie en Concentration ; « Aucune » ne crée aucun son ; le choix fait pendant la séance devient le choix par défaut ;
- **succès** : les trois seuils ; 45 succès ; l'Arche fleurie offerte et dessinée ; 51 éléments ; lien de ville avec l'Arche lisible ;
- **fusion** : souhait du jour le plus récent ; cadeaux en double remboursés.

## Risques connus

- **La qualité d'un son ne se teste pas** : les tests vérifient les niveaux, pas le timbre. Les recettes restent volontairement simples (bruit filtré), là où la synthèse sonne juste ; pas d'oiseaux ni de voix.
- **Sur iPhone**, le bouton silencieux peut aussi couper l'ambiance, comme le son de fin ; le verrouillage de l'écran l'arrête.
- **Une ville sans place autour de ses bâtiments** n'a plus de souhait : c'est voulu, et rien ne le reproche.
