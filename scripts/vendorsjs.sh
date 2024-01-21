#!/usr/bin/env sh

mkdir -p umap/static/umap/vendors/leaflet/ && cp -r node_modules/leaflet/dist/** umap/static/umap/vendors/leaflet/
mkdir -p umap/static/umap/vendors/editable/ && cp -r node_modules/leaflet-editable/src/Leaflet.Editable.js umap/static/umap/vendors/editable/
mkdir -p umap/static/umap/vendors/editable/ && cp -r node_modules/leaflet.path.drag/src/Path.Drag.js umap/static/umap/vendors/editable/
mkdir -p umap/static/umap/vendors/hash/ && cp -r node_modules/leaflet-hash/leaflet-hash.js umap/static/umap/vendors/hash/
mkdir -p umap/static/umap/vendors/i18n/ && cp -r node_modules/leaflet-i18n/Leaflet.i18n.js umap/static/umap/vendors/i18n/
mkdir -p umap/static/umap/vendors/editinosm/ && cp -r node_modules/leaflet-editinosm/Leaflet.EditInOSM.* umap/static/umap/vendors/editinosm/
mkdir -p umap/static/umap/vendors/editinosm/ && cp -r node_modules/leaflet-editinosm/edit-in-osm.png umap/static/umap/vendors/editinosm/
mkdir -p umap/static/umap/vendors/minimap/ && cp -r node_modules/leaflet-minimap/dist/** umap/static/umap/vendors/minimap/
mkdir -p umap/static/umap/vendors/loading/ && cp -r node_modules/leaflet-loading/src/Control.Loading.* umap/static/umap/vendors/loading/
mkdir -p umap/static/umap/vendors/markercluster/ && cp -r node_modules/leaflet.markercluster/dist/** umap/static/umap/vendors/markercluster/
mkdir -p umap/static/umap/vendors/contextmenu/ && cp -r node_modules/leaflet-contextmenu/dist/leaflet.contextmenu.min.* umap/static/umap/vendors/contextmenu/
mkdir -p umap/static/umap/vendors/heat/ && cp -r node_modules/leaflet.heat/dist/leaflet-heat.js umap/static/umap/vendors/heat/
mkdir -p umap/static/umap/vendors/fullscreen/ && cp -r node_modules/leaflet-fullscreen/dist/** umap/static/umap/vendors/fullscreen/
mkdir -p umap/static/umap/vendors/toolbar/ && cp -r node_modules/leaflet-toolbar/dist/** umap/static/umap/vendors/toolbar/
mkdir -p umap/static/umap/vendors/formbuilder/ && cp -r node_modules/leaflet-formbuilder/Leaflet.FormBuilder.js umap/static/umap/vendors/formbuilder/
mkdir -p umap/static/umap/vendors/measurable/ && cp -r node_modules/leaflet-measurable/Leaflet.Measurable.* umap/static/umap/vendors/measurable/
mkdir -p umap/static/umap/vendors/photon/ && cp -r node_modules/leaflet.photon/leaflet.photon.js umap/static/umap/vendors/photon/
mkdir -p umap/static/umap/vendors/csv2geojson/ && cp -r node_modules/csv2geojson/csv2geojson.js umap/static/umap/vendors/csv2geojson/
mkdir -p umap/static/umap/vendors/togeojson/ && cp -r node_modules/@tmcw/togeojson/dist/togeojson.umd.* umap/static/umap/vendors/togeojson/
mkdir -p umap/static/umap/vendors/osmtogeojson/ && cp -r node_modules/osmtogeojson/osmtogeojson.js umap/static/umap/vendors/osmtogeojson/
mkdir -p umap/static/umap/vendors/georsstogeojson/ && cp -r node_modules/georsstogeojson/GeoRSSToGeoJSON.js umap/static/umap/vendors/georsstogeojson/
mkdir -p umap/static/umap/vendors/togpx/ && cp -r node_modules/togpx/togpx.js umap/static/umap/vendors/togpx/
mkdir -p umap/static/umap/vendors/tokml && cp -r node_modules/tokml/tokml.js umap/static/umap/vendors/tokml
mkdir -p umap/static/umap/vendors/locatecontrol/ && cp -r node_modules/leaflet.locatecontrol/dist/L.Control.Locate.min.* umap/static/umap/vendors/locatecontrol/
mkdir -p umap/static/umap/vendors/dompurify/ && cp -r node_modules/dompurify/dist/purify.min.* umap/static/umap/vendors/dompurify/
mkdir -p umap/static/umap/vendors/colorbrewer/ && cp node_modules/colorbrewer/index.js umap/static/umap/vendors/colorbrewer/colorbrewer.js
mkdir -p umap/static/umap/vendors/simple-statistics/ && cp node_modules/simple-statistics/dist/simple-statistics.min.* umap/static/umap/vendors/simple-statistics/
mkdir -p umap/static/umap/vendors/iconlayers/ && cp node_modules/leaflet-iconlayers/dist/* umap/static/umap/vendors/iconlayers/

echo 'Done!'
