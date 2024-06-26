# uMap advanced usages

## Preloading a map with data {: #preloading-data }

You can preload a map using the `data` or the `dataUrl` parameter:

* The `data` parameter must be URI encoded
  (using JavaScript’s `encodeURIComponent()` for instance).
* The `dataURL` parameter must link to an encoded URL
  (using JavaScript’s `encodeURIComponent()` for instance).

You can add the `dataFormat` parameter given the nature of your data:

* `geojson` (default)
* `csv`
* `gpx`
* `georss`
* `kml`
* `osm`


This example, using the `data` parameter, will load a map with a marker
set on Niagara Falls from CSV formatted data:

https://umap.openstreetmap.fr/en/map/?data=name%252Clatitude%252Clongitude%250ANiagara%20Falls%252C43.084799710219066%252C-79.0693759918213&dataFormat=csv

That example, using the `dataUrl` parameter, will load a map with
borders for Arles, dynamically fetched from
[geo.api.gouv.fr](https://geo.api.gouv.fr/) in GeoJSON:

https://umap.openstreetmap.fr/en/map/?dataUrl=https%3A%2F%2Fgeo.api.gouv.fr%2Fcommunes%3Fcode%3D13004%26format%3Dgeojson%26geometry%3Dcontour
