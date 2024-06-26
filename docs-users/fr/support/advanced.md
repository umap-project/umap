# Usages avancés de uMap

## Précharger une carte avec des données {: #preloading-data }

Il est possible de précharger une carte avec des données en utilisant
le paramètre `dataUrl`, ce paramètre doit lier vers une URL encodée
(avec la méthode `encodeURIComponent()` en JavaScript par exemple).

Vous pouvez aussi utiliser le paramètre `dataFormat` en fonction de la
ressource distante vers laquelle vous faites un lien:

* `geojson` (défaut)
* `csv`
* `gpx`
* `georss`
* `kml`
* `osm`

Cet exemple va charger une carte avec les contours géographiques pour
la commune d’Arles, récupérés dynamiquement depuis
[geo.api.gouv.fr](https://geo.api.gouv.fr/):

https://umap.openstreetmap.fr/en/map/?dataUrl=https%3A%2F%2Fgeo.api.gouv.fr%2Fcommunes%3Fcode%3D13004%26format%3Dgeojson%26geometry%3Dcontour
