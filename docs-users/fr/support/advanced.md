# Usages avancés de uMap

## Précharger une carte avec des données {: #preloading-data }

Il est possible de précharger une carte avec des données en utilisant
les paramètres `data` ou `dataUrl` :

* Le paramètre `data` doit être URI encodé
  (avec la méthode `encodeURIComponent()` en JavaScript par exemple).
* Le paramètre `dataUrl` doit lier vers une URL encodée
  (avec la méthode `encodeURIComponent()` en JavaScript par exemple).

Vous pouvez ajouter le paramètre `dataFormat` en fonction de la
nature de vos données:

* `geojson` (défaut)
* `csv`
* `gpx`
* `georss`
* `kml`
* `osm`

Cet exemple, utilisant le paramètre `data`, va charger une carte avec un marqueur
positionné sur les Chutes du Niagara à partir de données en CSV :

https://umap.openstreetmap.fr/fr/map/?data=name%252Clatitude%252Clongitude%250AChutes%20du%20Niagara%252C43.084799710219066%252C-79.0693759918213&dataFormat=csv

Cet exemple, utilisant le paramètre `dataUrl`, va charger une carte avec les contours géographiques pour
la commune d’Arles, récupérés dynamiquement depuis
[geo.api.gouv.fr](https://geo.api.gouv.fr/) en GeoJSON :

https://umap.openstreetmap.fr/fr/map/?dataUrl=https%3A%2F%2Fgeo.api.gouv.fr%2Fcommunes%3Fcode%3D13004%26format%3Dgeojson%26geometry%3Dcontour
