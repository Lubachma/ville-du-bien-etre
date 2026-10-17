# Ville du bien-être

Une application personnelle pour transformer les activités réelles en une ville qui grandit. Pensée pour être partagée à des amis via **GitHub Pages** : aucun serveur applicatif, compte ou abonnement nécessaire.

Chaque personne garde **sa propre progression sur son appareil**. Les villes ne sont ni partagées ni synchronisées entre téléphones.

## Utiliser l’app

- **Concentration** : garder l’app affichée pendant la session. La tolérance de sortie est réglable à 5, 10 ou 20 secondes.
- **Activité libre** : marcher, faire du sport ou écouter de la musique, écran verrouillé ou dans une autre app. Le chrono est retrouvé à la réouverture, même après fermeture. Le son de fin n’est pas garanti quand le navigateur suspend la page.
- Une session réussie rapporte des pièces pour construire. Le temps réellement effectué lors d’une interruption reste dans le journal et compte pour les objectifs hebdomadaires ; il ne donne ni pièces, ni bonus de série, ni déblocage de bâtiment.
- Le tirage peut tenir compte du temps disponible, de l’énergie et du lieu. Les tâches ponctuelles ou récurrentes quittent les propositions après réussite, puis reviennent si leur fréquence le prévoit.
- Les routines enchaînent 2 à 6 activités toujours disponibles, avec une pause libre entre les étapes. Leur progression est conservée au rechargement.
- Le journal contient un objectif hebdomadaire souple. Le bâtiment ciblé se choisit indépendamment de cet objectif.
- Personnaliser la ville permet de lui donner un nom et d’en exporter une image PNG. Les bâtiments gagnent des décorations avec les minutes réussies de leur domaine.

## Installer sur téléphone

1. Ouvrir l’adresse publiée en HTTPS, pas le fichier HTML reçu en pièce jointe.
2. **iPhone** : ouvrir dans Safari, puis **Partager → Sur l’écran d’accueil → Ajouter**. **Android** : menu de Chrome → **Installer l’application** ou **Ajouter à l’écran d’accueil**.
3. Ouvrir l’app depuis son icône. Dans les réglages, attendre l’indication **Disponible hors connexion** avant de compter sur le mode hors ligne.

Les libellés du téléphone peuvent varier. L’aide reste accessible dans **Réglages → Bien démarrer et installer l’app**. Installer avant de commencer évite d’avoir à transférer la ville entre le navigateur et l’app installée.

## Sauvegarde et confidentialité

Sur GitHub Pages, les données de progression restent dans le stockage local du navigateur. Les polices et icônes sont servies avec l’app ; aucun service d’analytics ou de publicité n’est intégré. L’hébergeur reçoit les requêtes nécessaires au téléchargement du site, pas les activités enregistrées.

**Réglages → Sauvegarde** permet d’exporter un fichier ou un texte et de le restaurer sur un autre appareil. Conserver cette copie : supprimer les données du navigateur ou désinstaller l’app peut supprimer la ville. La date affichée est celle de la demande d’export ; l’app ne peut pas vérifier que le fichier a réellement été conservé.

Les sauvegardes **VBE1** restent importables. Les nouveaux exports **VBE2** contiennent aussi les modes, routines et objectifs ; ils nécessitent cette nouvelle version de l’app. Une session en cours n’est pas transportée par l’export.

La progression de l’ancienne version locale est copiée vers un stockage v2 distinct, sans supprimer l’original. Une ancienne fenêtre ne peut ainsi pas écraser les nouveaux champs. Si une ancienne session est encore en cours, l’app demande de la terminer avant la reprise. Les anciennes fenêtres ne synchronisent plus leurs changements avec la v2 après migration.

En cas de stockage illisible, l’original est préservé avant réparation. En cas de quota atteint ou de stockage refusé, un avertissement reste visible et propose l’export. Il peut être nécessaire de libérer de la place avant de réessayer.

Le code conserve une intégration optionnelle au stockage du compte Claude uniquement si l’environnement Claude fournit son API. Cette intégration n’est pas active sur GitHub Pages.

## Développer et vérifier

Node.js 20 ou plus récent est nécessaire pour les outils ; le site publié n’en a pas besoin.

```sh
npm ci
npm run build
npm run check
npm test
npx playwright install chromium
npm run test:browser
npm run serve
```

L’app locale est accessible sur `http://127.0.0.1:8766`. Les tests navigateur utilisent des profils jetables et un serveur sous `/ville-du-bien-etre/` pour vérifier les chemins de GitHub Pages. Ils ne modifient pas la progression du navigateur habituel. Sur un Mac avec Chrome déjà installé, `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` évite d’installer Chromium.

Pour vérifier aussi le moteur WebKit : `npx playwright install webkit`, puis `BROWSER=webkit npm run test:browser`. Cela complète les tests Chrome sans remplacer les essais sur un iPhone physique.

- `src/` : règles, stockage, dessin de ville, parcours, sessions et installation.
- `styles.css`, `styles-activities.css`, `styles-features.css` : styles.
- `index.html` : structure des écrans.
- `scripts/build.mjs` : produit `app.js` et l’empreinte du cache hors ligne.
- `scripts/sw-template.js` : source du service worker.
- `tests/` : tests métier et parcours navigateur.

**Ne pas modifier directement `app.js` ou `sw.js`** : ils sont générés par le build. Aucun framework n’est nécessaire dans le navigateur.

## Publier sur GitHub Pages

Le dossier local doit être ajouté à un dépôt GitHub avec son `package-lock.json`, ses sources et le dossier `.github/`. Ne pas envoyer `node_modules/` ou `test-results/`.

1. Dans le dépôt GitHub : **Settings → Pages → Source → GitHub Actions**.
2. Dans **Actions**, choisir **Déployer sur GitHub Pages**, puis **Run workflow** sur la branche contenant l’app.
3. Le workflow construit, vérifie le code, exécute les tests puis publie uniquement les fichiers statiques de `dist/`. L’adresse publiée apparaît dans le résultat du déploiement.

Le workflow est **manuel** : un simple envoi de modifications ne déclenche pas une publication. Configuration fondée sur la [documentation GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Pour préparer les fichiers sans publier :

```sh
npm run package
```

Le dossier `dist/` peut aussi être publié comme site statique. Tous les chemins sont relatifs : le site fonctionne à la racine d’un domaine ou sous le nom d’un dépôt.

## Mises à jour et vérification sur téléphone

Le build change automatiquement la version hors ligne quand un fichier publié change. Une nouvelle version prête apparaît dans l’app ; elle s’applique avec **Mettre à jour**, après la session en cours. La ville est conservée. Le cache conserve une version cohérente du HTML, des styles et du JavaScript.

Avant de partager une version, vérifier sur un vrai iPhone et un vrai Android : installation depuis le lien, première ouverture hors connexion, activité libre écran verrouillé, retour après fermeture, sauvegarde/restauration et mise à jour. Les tests automatisés ne remplacent pas ces contrôles matériels.

## Licences

Polices Figtree et Young Serif : SIL Open Font License 1.1, textes conservés dans `fonts/` et dans la version publiée.
