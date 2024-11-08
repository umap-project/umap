!!! abstract "Ce que nous allons apprendre"

    - Importer le contour d’une commune
    - Importer le cadastre [sur l'instance uMap pour les agents publics](https://umap.incubateur.anct.gouv.fr/fr/)
    - Importer les contours des départements ou des régions
    - Importer un point d’intérêt (bibliothèques, parkings, …) qui est enregistré sur OpenStreetMap

## Procédons par étapes

Il est conseillé de vérifier si les données n’existent pas avant de se lancer dans leur dessin. On peut gagner un temps précieux avec l’assistant d’importation intégré dans uMap et conserver une carte qui n’est pas trop lourde au chargement.

Voilà les deux actions à effectuer une fois une carte préexistante, ou une nouvelle carte vierge ouverte :

- Cliquez sur l’outil d’import de données dans la barre de droite puis sélectionnez les données déjà prêtes à l’emploi
- Cliquez sur « Importer » et le cas échéant enjolivez la carte, car des figurés par défaut sont utilisés

uMap permet d’utiliser des données produites par de nombreux services et placées en open data sous différents formats. Nous verrons ultérieurement (niveau intermédiaire) où rechercher ces sources. D’ores et déjà, vous pouvez utiliser l’assistant d’importation pour récupérer en un clic des contours administratifs et des points d’intérêt.

### Ressources disponibles (05/11/2024)

Au 5 novembre 2024, les imports suivants sont disponibles :

- contour d’une commune : limites communales jointives, issues du Référentiel à Grande Échelle (RGE), mises à jour par l'IGN ;
- cadastre, sur l'instance uMap pour les agents publics :
  - Parcelles
  - Bâtiments
  - Communes (attention ce périmètre est moins précis, privilégier celui issu du RGE ci-dessus)
  - Feuilles
  - Lieux-dits
  - Préfixes des sections
  - Subdivisions fiscales. 
- contours des départements et des régions ;
- données issues d’OpenStreetMap placées dans [GeoDataMine](https://geodatamine.fr/). Comme son nom l’indique, GeoDataMine est une véritable mine de données très utiles pour les services publics :
    - Aire de jeux
    - Aménagements cyclables
    - Banques et DAB
    - Base Adresse
    - Bibliothèques
    - Cimetière
    - Cinémas
    - Commerces
    - Covoiturage
    - Déchets et recyclage… jusqu’à Toilettes
- overpass : pour se familiariser avec les types de requêtes à renseigner dans l’assistant, consulter les tutos plus avancés et la [page wiki](https://wiki.openstreetmap.org/wiki/Overpass_turbo/Wizard)


!!! note
    Il manque des données ? N’hésitez pas à contribuer pour les ajouter et vous en serez les premiers bénéficiaires !


### Cliquez sur l’outil d’import des données

Voici un bref passage en revu des différents imports proposés et pour finir l’import de la localisation des bibliothèques de Clermont- Ferrand :

![Import en un clic](https://github.com/user-attachments/assets/f53e52bf-b229-40ac-b76c-526ffa8728d5)

## 1. Importer le contour d’une commune

Cliquez sur l’outil d’importation en bas de la barre de droite, puis descendez jusqu’au cadre « Assistants d’import ».

Cliquez sur « Communes France » et sélectionnez la commune souhaitée dans une liste déroulante. Une fois la commune sélectionnée, le format est reconnu automatiquement (geojson) puis le type de calque (cliquer sur « ? » pour savoir quel choix opérer)

1. Pour que les données soient simplement copiées, choisir « Copier dans le calque ».
2. Pour que la carte évolue si le contour change, choisir « Associer au calque comme donnée distante ».

!!! note
    Le code affiché n’est pas le code postal mais le code INSEE de la commune.

Voici le résultat avec la commune d’Arles (la plus vaste de France métropolitaine, un gain certain si on fait l’économie de dessiner son contour !)

![Import en un clic](https://github.com/user-attachments/assets/241f4244-60da-44d2-a8a3-1d57e22860b8)


Une fois cet import réalisé, tout est réglable : couleur de contour, de fond, affichage oui non d’une étiquette.

## 2. Importer le cadastre 

Cliquez sur l’outil d’importation en bas de la barre de droite, puis descendez jusqu’au cadre « Assistants d’import ».

Cliquez sur « Cadastre », choisir l'objet du cadastre à importer, par défaut, les parcelles sont proposées. Sélectionner une commune, choisir le type de calque et cliquez sur "Importer". 

![cadastre1](https://github.com/user-attachments/assets/d9a407f6-1b70-4738-8fde-2a9c9ced8de3)

Pour régler l'épaisseur du trait et l'opacité du fond, cliquer dans la barre de droite sur "Gérer les calques", puis sur le petit stylo ("Editer") et enfin dans les "propriétés de la forme" :

![cadastre2](https://github.com/user-attachments/assets/99cf8395-a69a-411c-a2b2-4de8c50ec960)

On obtient une couche d'information moins chargée, ce qui permet d'ajouter d'autres données :

![cadastre3](https://github.com/user-attachments/assets/474ca77d-d63d-421a-be60-67aaa334f7d0)

Sur cet exemple, l'identifiant s'affiche au survol d'une parcelle avec la souris. Pour obtenir cet affichage, cliquer sur les "Propriétés avancées" du calque, juste en dessous des "Propriétés de la forme", puis dans "Clé pour le libellé", indiquer id. C'est en effet le nom donné dans le tableau de données à la colonne qui accueille l'identifiant des parcelles. 

!!! note
    Il est tout à fait possible d'utiliser le cadastre comme fond de carte. Dans ce cas, la méthode est différente, voir la fiche tuto [Où trouver des données](https://discover.umap-project.org/fr/tutorials/4-find-data/)

## 3. Importer les contours des départements ou des régions

Cliquez sur l’outil d’importation en bas de la barre de droite, puis descendez jusqu’au cadre « Assistants d’import ».

Cliquez sur « Contours nationaux » puis soit départements, soit régions et enfin le type de calque (voir supra l’explication). Tous les départements sont importés :

![départements](https://github.com/user-attachments/assets/b4adbb47-ef2d-45e3-baec-c850d8b51d32)

## 4. Importer un point d’intérêt issu de GeoDataMine

Cliquez sur l’outil d’importation en bas de la barre de droite, puis descendez jusqu’au cadre « Assistants d’import ».

Cliquez sur « GeoDataMine (thèmes OSM) » et sélectionnez les informations souhaitées, routes, bâtiments, commerces, services publics, …
Par exemple, en sélectionnant les points d’eau potable de la CA du Grand Avignon, puis « Copier dans un calque » ou « Associer comme données distantes » (dans ce dernier cas, la carte se mettra automatiquement à jour lorsque le jeu de données changera). 

![Grand Avignon](https://github.com/user-attachments/assets/ab7a697a-9280-4e5f-8825-aaa0e99c036d)

Voici une réelle économie de temps plutôt que de placer pointeur après pointeur tous les points d’eau.

## 5. La carte combinée

Bien entendu, on peut tout à fait combiner les différentes couches d’information et présenter par exemple la carte des Points d’eau potable dans la CA du Grand Avignon, avec les contours des communes qui composent l’EPCI, du département et de la région :

### Points d’eau potable du Grand Avignon

![Une carte combinant plusieurs imports](../../static/tutoriels/importer-multi.png)

[Voir la carte en plein écran](https://umap.incubateur.anct.gouv.fr/fr/map/points-deau-potable-grand-avignon_672)

Il faudra dans ce cas supprimer toutes les informations inutiles dans le tableau de données qui est accessible dans la barre de gauche pour chaque calque.

Pour gagner du temps : sélectionner tous les départements et désélectionner seulement le Vaucluse, puis cliquer sur « Supprimer les lignes sélectionnées ».



