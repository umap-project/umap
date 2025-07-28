#!/usr/bin/env sh
rm -rf umap/static/umap/vendors/

mkdir -p umap/static/umap/vendors/leaflet/ && cp -r node_modules/leaflet/dist/leaflet-src.esm.* umap/static/umap/vendors/leaflet/
mkdir -p umap/static/umap/vendors/leaflet/ && cp -r node_modules/leaflet/dist/*.css umap/static/umap/vendors/leaflet/
mkdir -p umap/static/umap/vendors/leaflet/ && cp -r node_modules/leaflet/dist/images umap/static/umap/vendors/leaflet/images
mkdir -p umap/static/umap/vendors/editable/ && cp -r node_modules/leaflet-editable/src/Leaflet.Editable.js umap/static/umap/vendors/editable/
mkdir -p umap/static/umap/vendors/editable/ && cp -r node_modules/leaflet.path.drag/src/Path.Drag.js umap/static/umap/vendors/editable/
mkdir -p umap/static/umap/vendors/hash/ && cp -r node_modules/leaflet-hash/leaflet-hash.js umap/static/umap/vendors/hash/
mkdir -p umap/static/umap/vendors/i18n/ && cp -r node_modules/leaflet-i18n/Leaflet.i18n.js umap/static/umap/vendors/i18n/
mkdir -p umap/static/umap/vendors/editinosm/ && cp -r node_modules/leaflet-editinosm/Leaflet.EditInOSM.* umap/static/umap/vendors/editinosm/
mkdir -p umap/static/umap/vendors/editinosm/ && cp -r node_modules/leaflet-editinosm/edit-in-osm.png umap/static/umap/vendors/editinosm/
mkdir -p umap/static/umap/vendors/minimap/ && cp -r node_modules/leaflet-minimap/dist/** umap/static/umap/vendors/minimap/
mkdir -p umap/static/umap/vendors/loading/ && cp -r node_modules/leaflet-loading/src/Control.Loading.* umap/static/umap/vendors/loading/
mkdir -p umap/static/umap/vendors/markercluster/ && cp -r node_modules/leaflet.markercluster/dist/leaflet.markercluster.* umap/static/umap/vendors/markercluster/
mkdir -p umap/static/umap/vendors/markercluster/ && cp -r node_modules/leaflet.markercluster/dist/MarkerCluster.* umap/static/umap/vendors/markercluster/
mkdir -p umap/static/umap/vendors/heat/ && cp -r node_modules/leaflet.heat/dist/leaflet-heat.js umap/static/umap/vendors/heat/
mkdir -p umap/static/umap/vendors/fullscreen/ && cp -r node_modules/leaflet-fullscreen/dist/** umap/static/umap/vendors/fullscreen/
mkdir -p umap/static/umap/vendors/measurable/ && cp -r node_modules/leaflet-measurable/Leaflet.Measurable.* umap/static/umap/vendors/measurable/
mkdir -p umap/static/umap/vendors/photon/ && cp -r node_modules/leaflet.photon/leaflet.photon.js umap/static/umap/vendors/photon/
mkdir -p umap/static/umap/vendors/csv2geojson/ && cp -r node_modules/csv2geojson/csv2geojson.js umap/static/umap/vendors/csv2geojson/
mkdir -p umap/static/umap/vendors/togeojson/ && cp node_modules/@tmcw/togeojson/dist/togeojson.es.mjs umap/static/umap/vendors/togeojson/togeojson.es.js
mkdir -p umap/static/umap/vendors/togeojson/ && cp node_modules/@tmcw/togeojson/dist/togeojson.es.mjs.map umap/static/umap/vendors/togeojson/togeojson.es.mjs.map
mkdir -p umap/static/umap/vendors/tokml/ && cp node_modules/@placemarkio/tokml/dist/tokml.es.mjs umap/static/umap/vendors/tokml/tokml.es.js
mkdir -p umap/static/umap/vendors/tokml/ && cp node_modules/@placemarkio/tokml/dist/tokml.es.mjs.map umap/static/umap/vendors/tokml/tokml.es.mjs.map
mkdir -p umap/static/umap/vendors/osmtogeojson/ && cp -r node_modules/osmtogeojson/osmtogeojson.js umap/static/umap/vendors/osmtogeojson/
mkdir -p umap/static/umap/vendors/georsstogeojson/ && cp -r node_modules/georsstogeojson/GeoRSSToGeoJSON.js umap/static/umap/vendors/georsstogeojson/
mkdir -p umap/static/umap/vendors/locatecontrol/ && cp -r node_modules/leaflet.locatecontrol/dist/L.Control.Locate.min.* umap/static/umap/vendors/locatecontrol/
mkdir -p umap/static/umap/vendors/dompurify/ && cp -r node_modules/dompurify/dist/purify.es.mjs umap/static/umap/vendors/dompurify/purify.es.js
mkdir -p umap/static/umap/vendors/dompurify/ && cp -r node_modules/dompurify/dist/purify.es.mjs.map umap/static/umap/vendors/dompurify/purify.es.mjs.map
mkdir -p umap/static/umap/vendors/colorbrewer/ && cp node_modules/colorbrewer/index.es.js umap/static/umap/vendors/colorbrewer/colorbrewer.js
mkdir -p umap/static/umap/vendors/simple-statistics/ && cp node_modules/simple-statistics/dist/simple-statistics.min.* umap/static/umap/vendors/simple-statistics/
mkdir -p umap/static/umap/vendors/iconlayers/ && cp node_modules/leaflet-iconlayers/dist/* umap/static/umap/vendors/iconlayers/
mkdir -p umap/static/umap/vendors/geojson-to-gpx/ && cp node_modules/@dwayneparton/geojson-to-gpx/dist/index.js umap/static/umap/vendors/geojson-to-gpx/
mkdir -p umap/static/umap/vendors/textpath/ && cp node_modules/leaflet-textpath/leaflet.textpath.js umap/static/umap/vendors/textpath/
mkdir -p umap/static/umap/vendors/betterknown/ && cp node_modules/betterknown/dist/betterknown.mjs umap/static/umap/vendors/betterknown/
mkdir -p umap/static/umap/vendors/openrouteservice/ && cp node_modules/openrouteservice-js/dist/ors-js-client.js* umap/static/umap/vendors/openrouteservice/

echo 'Done!'
