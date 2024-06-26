# uMap advanced usages

## Preloading a map with data {: #preloading-data }

You can preload a map using the `dataUrl` parameter, that parameter must link
to an encoded URL (using JavaScript’s `encodeURIComponent()` for instance).

You can also set the `dataFormat` parameter given the resource you are linking to:

* `geojson` (default)
* `csv`
* `gpx`
* `georss`
* `kml`
* `osm`

This example will load a map with borders for Arles, dynamically fetched
from [geo.api.gouv.fr](https://geo.api.gouv.fr/) :

https://umap.openstreetmap.fr/en/map/?dataUrl=https%3A%2F%2Fgeo.api.gouv.fr%2Fcommunes%3Fcode%3D13004%26format%3Dgeojson%26geometry%3Dcontour
