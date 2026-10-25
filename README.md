# Ventes · BOUAZZA IMMO

Application de suivi commercial de la résidence (36 appartements F3, R+4, Al Hoceima) :

- **Tableau de bord** : lots disponibles, en option, réservés et vendus, avancement par niveau, encaissé et reste à encaisser, échéances à venir et en retard, relances clients.
- **Lots** : liste filtrable ou plan des niveaux en couleur, fiche par lot (surfaces, statut, client, prix, échéancier, encaissements, notes, historique).
- **Clients** : prospects et acquéreurs, étape commerciale, lots d’intérêt, relances, appel et WhatsApp en un geste.
- **Encaissements** : journal par mois, totaux par mode de paiement.
- **Réglages** : prix au m² par niveau, prix des terrasses, échéancier type, sauvegarde et import, exports CSV pour Excel.

Fonctionne hors ligne. Les données restent **sur l’appareil** (aucun serveur, aucun compte). Pensez à exporter une sauvegarde régulièrement depuis *Réglages*.

## Mise en ligne sur GitHub Pages

1. Créez un dépôt sur GitHub (par exemple `ventes`). Il peut être privé si votre offre GitHub permet Pages sur un dépôt privé, sinon public : le dépôt ne contient aucune donnée client.
2. Envoyez-y tout le contenu de ce dossier (bouton **Add file → Upload files**, glissez les fichiers et dossiers, puis **Commit changes**).
3. Dans le dépôt : **Settings → Pages → Build and deployment**, *Source* : **Deploy from a branch**, branche **main**, dossier **/ (root)**, puis **Save**.
4. Après une minute environ, l’adresse s’affiche en haut de la page Pages, du type `https://votre-nom.github.io/ventes/`.

## Installer sur le téléphone

- **iPhone (Safari)** : ouvrez l’adresse, bouton **Partager**, puis **Sur l’écran d’accueil**.
- **Android (Chrome)** : ouvrez l’adresse, menu **⋮**, puis **Installer l’application** (ou *Ajouter à l’écran d’accueil*).

## Mettre à jour l’application

Remplacez les fichiers dans le dépôt, puis changez le numéro de version dans `sw.js` (`ventes-v1.0.0` → `ventes-v1.0.1`) pour que les téléphones récupèrent la nouvelle version. Les données saisies ne sont pas touchées.

## Plusieurs vendeurs

Chaque téléphone a ses propres données. Pour partager un même suivi entre plusieurs personnes en temps réel, il faudra brancher une base de données en ligne (Supabase ou Firebase, par exemple). En attendant, un seul appareil de référence, ou l’échange de sauvegardes, évite les doublons.
