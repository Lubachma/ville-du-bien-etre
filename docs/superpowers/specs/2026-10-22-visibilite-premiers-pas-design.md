# Étape 8 — Visibilité et premiers pas : qu'on trouve la ville, et qu'on s'y sente bien dès la première minute

Date : 22 octobre 2026. Projet : Ville du bien-être (`Lubachma/ville-du-bien-etre`). L'étape 7 (fiabilité) est en ligne depuis le 22 octobre.

## Intention

Ludovic a demandé ce qu'il serait intéressant d'ajouter pour que des gens viennent et restent. Il a validé l'ordre proposé (« oui go ») : **tous les choix de ce document sont ceux de Claude**. Tout reste gratuit, sans serveur ni compte.

L'analyse du 21 octobre a montré que le contenu suffit pour un an, mais que deux portes restent fermées.

- **On ne trouve pas la ville.**
  - Le site demande aux moteurs de recherche de l'ignorer (`noindex`).
  - Un lien partagé s'affiche sans image ni description.
  - L'image d'un récapitulatif ne dit pas où trouver l'app.
  - Un ami qui ouvre un lien de ville ne lit nulle part ce qu'est le jeu.
- **La première minute n'accueille pas.** Un nouveau venu arrive sur une ville de départ sans explication.
  - Un « souhait du jour » l'invite tout de suite à dépenser (« Placer un banc · 2 M »).
  - Un message sur une étoile d'harmonie (« +10 M ») s'affiche avant toute séance.
  - Sur iPhone, l'aide conseille d'installer l'app avant de commencer.
  - La plus courte séance proposée dure 5 minutes.

Ce que dit la recherche (sources dans l'analyse du 21 octobre) :
- **Santé et forme** : environ 20 % des gens reviennent le lendemain, 8 % au 7e jour, 3 à 4 % au 30e. L'abandon se concentre juste après la première ouverture.
- **Habitude** : les premières répétitions sont celles qui la renforcent le plus, et commencer petit aide.
- **Liens partagés** : un lien sans aperçu est peu cliqué. Wordle a décollé grâce à une image à partager qui renvoie au jeu.
- **Perte de progrès** : c'est ce qui fait le plus partir des apps comme Finch (« 234 jours de série remis à zéro »).
- **Safari** : dans un onglet, le stockage d'un site non visité pendant 7 jours d'utilisation de Safari peut être effacé, alors que celui d'une app ajoutée à l'écran d'accueil ne l'est pas. Sur iPhone, l'app ajoutée a son propre stockage, séparé de celui de Safari.
- **Représentation** : tous les habitants ont la même couleur de peau. Finch a été critiqué pour un manque de cet ordre.

Cette étape ouvre ces deux portes, en cinq parties : être trouvable (A), les premiers pas (B), le lien d'un ami et les images partagées (C), une ville à l'abri (D), des habitants qui ressemblent à tout le monde (E).

## Objectifs

- **Être trouvable** : le site indexable, un aperçu soigné pour chaque lien partagé, l'adresse de l'app sur les images partagées, des captures pour l'installation enrichie d'Android.
- **Une première récompense en 2 minutes**, avec un accueil qui explique le jeu en trois lignes, sans rien à lire de plus.
- **Un ami qui ouvre un lien comprend le jeu** et peut commencer sa propre ville en un geste.
- **Ne pas perdre sa ville** : l'installation proposée au bon moment (après la première séance), un transfert en un geste vers l'app installée sur iPhone, un rappel de sauvegarde adapté au risque.
- **Des habitants divers** : plusieurs couleurs de peau, une canne, un fauteuil roulant.
- **Tout existe en français et en anglais.**

## Hors périmètre

- **Pas de page d'accueil séparée** (`decouvrir.html`). L'accueil de l'app, écrit dans la page elle-même, sert de contenu indexable. Une page à part viendra peut-être, au vu des premières données de recherche.
- **Pas de `robots.txt` ni de `sitemap.xml`** : sur une page de projet GitHub, ils seraient à la racine du domaine (`lubachma.github.io`), hors de ce dépôt.
- **Rien de l'étape 9** : boutiques d'apps, autres langues.
- **Pas de mesure d'audience**, pas de notification, pas de serveur.
- **Pas de nouvelle durée de séance** dans la liste (elle commence toujours à 5 min). Les 2 minutes sont réservées à la première séance proposée par l'accueil.
- **Pas d'autre changement des règles du jeu** : gains, prix, déblocages et série restent identiques.

## À éviter absolument

- **Un accueil insistant** : une fenêtre qui bloque, un tutoriel en dix étapes, une invitation qui revient après avoir été fermée.
- **Culpabiliser** ou faire peur avec la perte de données. On dit simplement comment garder sa ville à l'abri.
- **Une régression pour les villes existantes.** Rien ne change pour une ville qui a déjà une séance : ni accueil, ni carte nouvelle, ni règle différente. Seul le rappel de sauvegarde d'un onglet sur iPhone ou iPad change (partie D).
- **Une donnée privée dans une image ou un lien partagés** : seulement l'adresse publique de l'app, jamais les minutes ni l'humeur au-delà de ce que l'image montre déjà.
- **Des textes qui débordent à 320 px**, en français comme en anglais.
- **Du mouvement** quand les animations sont réduites, ou **du son** sans un choix de la personne.

## Contraintes

- **Architecture inchangée** :
  - JavaScript sans dépendance à l'exécution, sources dans `src/NN-*.js` ;
  - `app.js` et `sw.js` générés par `npm run build`.
- **Un seul nouveau champ enregistré** : `breathing`, facultatif, dans la séance en cours (`S.active`), pour la respiration de la première séance (partie B).
  - Ce qui est propre à l'appareil (accueil fermé) va dans une clé `localStorage` à part, comme celles qui existent déjà (`ville-bien-etre/v1:…`).
  - La règle de l'étape 7 s'applique : un champ s'ajoute sans changer le sens d'un champ existant ; une version plus ancienne l'ignore.
- **« Une ville sans séance »** veut dire : aucune séance réussie ni interrompue (`S.stats.ok + S.stats.ko === 0`). L'historique ne compte pas : il peut être vide pour une ville qui a des séances.
- **Hors connexion** : rien de ce qui sert l'app ne vient du réseau. Les images d'aperçu (dossier `apercu/`) sont publiées mais ne font pas partie du cache hors connexion. Seuls les robots, les messageries et l'installation d'Android les lisent.
- **Tests** : `npm run check`, `npm test` et `npm run test:browser` passent sur Chromium et WebKit, en local, dans « Vérifier » et dans le workflow de publication.
- **Textes** : dans les deux dictionnaires, avec le tutoiement en français et sans accord en genre envers la personne.

## Partie A — Être trouvable

**Ce qui est décidé**

- **Indexation**
  - `<meta name="robots" content="noindex">` est retiré.
  - `<link rel="canonical" href="https://lubachma.github.io/ville-du-bien-etre/">` est ajouté.
- **Description de la page et du manifeste**, identique aux deux endroits :
  - « Une app gratuite de bien-être : chaque minute de lecture, de sport ou de calme fait grandir ta ville. Sans compte, sans pub, même hors connexion. »
  - Le titre reste « Ville du bien-être ».
- **Aperçu des liens (Open Graph)**
  - Balises : `og:type` website, `og:site_name`, `og:title`, `og:description`, `og:url` (l'adresse canonique), `og:image` (adresse absolue de l'image 1200 × 630), `og:image:width`/`height`/`alt`, `og:locale` fr_CH et `og:locale:alternate` en_GB.
  - Ajouter aussi `twitter:card` summary_large_image.
  - Titre de l'aperçu : « Ville du bien-être — prends soin de toi, ta ville grandit ».
- **Images d'aperçu**, dans un dossier `apercu/` publié mais hors du cache hors connexion :
  - `apercu/ville-1200x630.png` : une ville belle et vivante en fin d'après-midi, avec le nom de l'app et sa promesse. La ville est dessinée par l'app elle-même.
  - trois captures d'écran de téléphone (390 × 844 à l'échelle 2, soit 780 × 1688) : la ville, une séance avec le compagnon, le carnet.
  - Elles sont produites par un script `npm run apercu`, sur le modèle de la planche, et committées. On le relance quand l'apparence change.
- **Manifeste** : une liste `screenshots` avec les trois captures (`form_factor` « narrow », `label` en français). Avec la description, elles donnent l'installation enrichie d'Android.
- **Publication** :
  - `scripts/package.mjs` copie `apercu/` dans `dist/`.
  - Sa garde contre les adresses absolues d'`index.html` ignore seulement les balises `og:*`, `twitter:*` et `link rel="canonical"`. Ce sont des métadonnées, jamais chargées par l'app.
- **README** : il dit quelles trois adresses changer si l'on publie ailleurs (canonical, `og:url` et `og:image`).

**Laissé au constructeur** : la composition exacte de l'image d'aperçu et le choix des villes amorcées pour les captures.

## Partie B — Les premiers pas

**Ce qui est décidé**

- **Une carte « Bienvenue »** en haut de la vue Ville, écrite dans `index.html` (textes traduits par `data-i18n`, cachée par défaut).
  - L'app l'affiche pour une ville sans séance, sauf si elle a été fermée sur cet appareil.
  - Le contenu est dans la page même : les moteurs de recherche le lisent.
  - **Contenu (français)** :
    - titre « Bienvenue dans ta ville » ;
    - phrase « Ici, chaque moment pour toi fait grandir une ville : un livre, une marche, quelques minutes de calme. » ;
    - trois étapes numérotées : « Lance un chrono pour une vraie activité. », « Chaque minute terminée te rapporte des pièces. », « Construis ta ville avec tes pièces. » ;
    - note « Gratuit, sans compte ni pub. Ta ville reste sur cet appareil. ».
  - **Boutons** :
    - « Commencer par 2 minutes de calme » (principal) ;
    - « Choisir une activité » (ouvre l'onglet Activités) ;
    - un lien par autre langue disponible (aujourd'hui « English » ou « Français »). Il change la langue aussitôt, sans ouvrir les Réglages ; le focus reste sur le lien de langue ;
    - un bouton de fermeture (une croix, nommée « Fermer l'accueil »). Le focus va ensuite à « Lancer une activité ».
  - **Fermer** la retire pour de bon sur cet appareil. « Tout recommencer » (Réglages) la fait revenir. Elle disparaît d'elle-même après la première séance, réussie ou non.
  - **Sur iPhone**, dans l'app installée et avec une ville sans séance, un bouton de plus : « J'avais commencé dans Safari : coller ma ville » (partie D).
- **La première séance** proposée par l'accueil :
  - **Réglages de la séance** : nommée « Respirer » (le nom suit la langue, comme les modèles d'activités), domaine Calme, mode Concentration, **2 minutes**.
  - **Respiration guidée** : allumée pour cette séance seulement, par le champ `breathing` de la séance en cours. Elle survit à un rechargement. Le bouton de respiration de cette séance ne change que la séance ; le réglage de la personne ne change pas.
  - **Récompense** : 2 M, comme toute séance de 2 minutes.
  - **Suite** : l'écran de fin habituel (succès « Premier pas », Jardin zen débloqué), puis la carte d'invitation du compagnon dans la ville, comme aujourd'hui. La carte « Prochain déblocage » annonce déjà le Jardin zen après la première séance Calme.
  - Avec l'étoile de départ (+10 M) et les 2 M gagnés, la ville a 17 M : le Jardin zen (8 M) peut être construit tout de suite.
- **Avant la première séance, rien ne détourne de l'accueil** :
  - **Étoile d'harmonie de la ville de départ** : versée à la première ouverture sans message. Une étoile gagnée en posant un bâtiment garde son message.
  - **Souhait du jour** : il commence le lendemain de la première séance réussie. Le premier jour reste simple ; le deuxième apporte une nouveauté.
  - **Carte d'installation** : elle vient après la première séance (partie D).
- **Le texte de l'aide** (« Bien démarrer ») ne dit plus « Installe l'app avant de commencer ». Il dit : « Tu peux commencer ici, sans rien installer. Sur iPhone, installe l'app quand tu veux : copie ta ville avec « Copier ma ville », puis colle-la à la première ouverture de l'app. » Le README dit la même chose.

**Laissé au constructeur** : la mise en forme de la carte. Elle doit être lisible à 320 px dans les deux langues, et ne pas cacher le bouton « Lancer une activité ».

## Partie C — Le lien d'un ami et les images partagées

**Ce qui est décidé**

- **Un nouveau venu qui ouvre la ville d'un ami** (une ville sans séance de son côté) :
  - Sous le nom et la taille de la ville, une ligne : « Cette ville grandit avec de vrais moments : lire, bouger, respirer, ranger, créer. »
  - Dans la barre de la visite :
    - un bouton principal « Faire grandir ma ville », qui ferme la visite ;
    - « Garder la carte postale » reste, en second ;
    - « Partager ma ville en retour » est caché, puisqu'il n'y a encore rien à partager.
  - Quand la visite se ferme (par ce bouton, la croix, Échap ou le geste retour), le focus va au bouton principal de l'accueil, ou à « Lancer une activité » si l'accueil a été fermé.
  - Pour une ville qui a déjà une séance, la visite ne change pas.
- **Images partagées** : l'image du récapitulatif et l'image exportée de la ville montrent l'adresse de l'app.
  - Elle est calculée depuis l'adresse de la page : hôte et chemin, sans protocole ni barre finale, par exemple `lubachma.github.io/ville-du-bien-etre`.
  - Récapitulatif : « Ville du bien-être · <adresse> ».
  - Image de la ville : la ligne existante, puis l'adresse sur une seconde ligne.
  - Le titre reste le premier texte dessiné de chaque image.

## Partie D — Ta ville à l'abri

**Ce qui est décidé**

- **La carte d'installation** est rendue par l'app elle-même (elle doit savoir si la ville a une séance). Elle n'apparaît qu'après la première séance de la ville, réussie ou non, sur iPhone comme sur Android. « Ne plus afficher » reste. Elle n'apparaît jamais dans l'app installée.
  - Son titre devient « Garde ta ville à l'abri ».
  - **Sur iPhone et iPad**, son texte dit :
    - que le navigateur peut effacer les données d'un site resté sept jours sans visite, mais pas celles d'une app ajoutée à l'écran d'accueil ;
    - les étapes pour l'ajouter ;
    - qu'il faut ensuite copier la ville ici et la coller à la première ouverture de l'app.
  - **Sur Android**, le texte dit qu'installée, l'app s'ouvre depuis l'écran d'accueil et garde la ville sur ce téléphone (même stockage). Le bouton « Installer » reste.
- **Transfert vers l'app installée, sur iPhone et iPad** :
  - **Dans le navigateur**, la carte d'installation a un bouton « Copier ma ville ». Il copie le texte de sauvegarde, avec le message « Ville copiée : colle-la à la première ouverture de l'app. ». La copie compte comme une sauvegarde, comme « Copier ma sauvegarde » dans les Réglages. Si la copie échoue, un message propose d'ouvrir Réglages → Sauvegarde.
  - **Dans l'app installée**, avec une ville sans séance, la carte « Bienvenue » propose « J'avais commencé dans Safari : coller ma ville ».
    - Le bouton lit le presse-papiers (le système demande l'accord), puis ouvre une fenêtre « Reprendre ma ville » avec le même résumé que la restauration (pièces, constructions, séances, dernière séance).
    - « Reprendre cette ville » remplace la ville neuve, en un geste : elle n'a encore aucune séance.
    - Si le presse-papiers est refusé, vide ou ne contient pas de ville, un message doux propose d'ouvrir Réglages → Sauvegarde, où l'on peut coller le texte. Une sauvegarde abîmée donne le message habituel de la restauration.
- **Le rappel de sauvegarde, dans un onglet de navigateur sur iPhone ou iPad**, vient dès la première séance réussie, quand la ville a plus de 5 jours et que la dernière sauvegarde a plus de 5 jours (ou n'existe pas). Le premier jour reste donc à la carte d'installation. Ailleurs, rien ne change (3 séances réussies, 14 jours).
- **Les récapitulatifs du mois et de l'année** ont un bouton « Sauvegarder ma ville », à côté de celui de l'image.

## Partie E — Des habitants qui ressemblent à tout le monde

**Ce qui est décidé**

- **Couleur de peau**
  - Chaque personne dessinée reçoit une couleur parmi **cinq**, du plus clair au plus foncé : les promeneurs, les habitants qui font une activité, les visiteurs du jour (accordéoniste, artiste). Les visites d'amis et les fêtes ne dessinent pas de personnes.
  - Le choix est stable : il dépend de la ville et de la personne (son rang, son domaine, son identité de visiteur), pas de l'image. Un décalage propre à chaque ville fait tourner les cinq couleurs, si bien que cinq promeneurs ont toujours cinq couleurs différentes.
- **Mobilité**
  - Parmi les promeneurs, environ un sur cinq marche avec une canne, et environ un sur sept se déplace en fauteuil roulant : une roue, un dossier, assis.
  - Les accessoires de saison et de météo (bonnet, parapluie, lanterne) s'ajoutent comme aux autres.
- **Lisibilité** : tout reste reconnaissable à 35 px de large par case, de jour comme de nuit (planche), et chaque tracé reste dans le cadre de la personne.

## Données et compatibilité

- **Un nouveau champ** : `S.active.breathing`, booléen facultatif, posé seulement par la première séance de l'accueil. Une version plus ancienne l'ignore : la séance continue sans respiration guidée.
- **Une nouvelle clé propre à l'appareil** : `ville-bien-etre/v1:welcome-closed`, posée quand l'accueil est fermé, effacée par « Tout recommencer ». Celle qui masque la carte d'installation existe déjà (`ville-bien-etre/v1:install-hint`).
- **Le format v2 est inchangé.**
- **Une ville existante** (avec au moins une séance) ne voit ni l'accueil ni de changement dans ses cartes. Seul le rappel de sauvegarde d'un onglet sur iPhone ou iPad peut venir plus tôt.

## Tests attendus

- **Être trouvable**
  - Pas de `noindex`.
  - Les balises `canonical`, `og:*` et `twitter:*` sont présentes, avec des adresses absolues vers le site.
  - L'image d'aperçu et les trois captures existent, aux tailles annoncées.
  - Le manifeste a sa description et ses `screenshots`.
  - `npm run package` réussit et copie `apercu/`.
  - La garde des adresses absolues refuse toujours une adresse ailleurs que dans les balises permises.
- **Accueil**
  - Il est montré pour une ville neuve, caché pour une ville avec une séance (même sans historique).
  - Fermé, il ne revient pas, sauf après « Tout recommencer ».
  - Après la première séance, réussie ou non, il a disparu.
  - Le changement de langue depuis l'accueil fonctionne, sans ouvrir les Réglages, et garde le focus.
  - À 320 px, rien ne déborde, en français et en anglais.
- **Première séance**
  - « Commencer par 2 minutes de calme » lance une séance Calme de 2 minutes en Concentration, avec la respiration guidée.
  - Après un rechargement en cours de séance, la respiration est toujours là.
  - Le réglage `breathing` de la personne est inchangé après la séance.
  - 2 M sont gagnés, et le Jardin zen est débloqué et payable.
- **Avant la première séance** : pas de souhait du jour, pas de message d'étoile (mais l'étoile est versée), pas de carte d'installation. Après la séance, la carte d'installation vient ; le souhait vient le lendemain.
- **Lien d'un ami**
  - Pour un nouveau venu : la ligne, le bouton « Faire grandir ma ville » (qui ferme la visite et amène le focus sur l'accueil), pas de « Partager en retour ». Échap mène aussi à l'accueil.
  - Pour une ville avec une séance : la visite est inchangée.
- **Images** : l'adresse figure en pied de l'image du récapitulatif et de l'image exportée, après le titre.
- **À l'abri**
  - La carte d'installation n'apparaît qu'après une séance, et jamais dans l'app installée.
  - « Copier ma ville » écrit un texte de sauvegarde valide dans le presse-papiers et compte comme une sauvegarde.
  - Coller dans l'app installée (iPhone et mode « standalone » simulés) restaure la ville.
  - Un presse-papiers vide, refusé ou sans ville donne le message doux.
  - Le rappel de sauvegarde suit les deux règles selon le contexte.
  - Le bouton « Sauvegarder ma ville » est dans les récapitulatifs.
- **Habitants**
  - Cinq promeneurs ont cinq couleurs de peau différentes.
  - La canne et le fauteuil sont dessinés dans le cadre de la personne.
  - La planche est relue.

## Risques connus

- **Le site devient trouvable.** C'est voulu, et l'indexation prend des jours ou des semaines. Search Console peut l'accélérer ; c'est hors de ce dépôt.
- **Adresses absolues** : publier ailleurs demande de changer trois adresses dans `index.html`, et le README le dit.
- **Presse-papiers sur iPhone** : le système demande une autorisation (« Coller »). S'il refuse, on retombe sur le collage manuel dans Réglages.
- **Une première séance de 2 minutes** compte comme un jour actif et commence la série. C'est un pas plus petit qu'avant, mais seulement le premier jour.
- **Images d'aperçu figées** : relancer `npm run apercu` quand l'apparence change.
- **iPhone détecté par l'agent utilisateur** (pour le rappel plus fréquent et la carte) : une erreur de détection donne seulement un rappel plus ou moins fréquent. Safari sur Mac garde la règle ordinaire. Les tests simulent l'iPhone par l'agent utilisateur, car le WebKit de Playwright se présente comme un Safari de Mac.
- **Souhait du lendemain** : une personne dont les séances ont toutes été interrompues n'a pas encore de souhait du jour. C'est voulu : le souhait se paie avec les pièces des séances réussies.
