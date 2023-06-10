#!/usr/bin/env sh

mkdir -p umap/static/umap/vendors/leaflet/ && cp -r node_modules/leaflet/dist/** umap/static/umap/vendors/leaflet/
mkdir -p umap/static/umap/vendors/editable/ && cp -r node_modules/leaflet-editable/src/*.js umap/static/umap/vendors/editable/
mkdir -p umap/static/umap/vendors/editable/ && cp -r node_modules/leaflet.path.drag/src/*.js umap/static/umap/vendors/editable/
mkdir -p umap/static/umap/vendors/hash/ && cp -r node_modules/leaflet-hash/*.js umap/static/umap/vendors/hash/
mkdir -p umap/static/umap/vendors/i18n/ && cp -r node_modules/leaflet-i18n/*.js umap/static/umap/vendors/i18n/
mkdir -p umap/static/umap/vendors/editinosm/ && cp -r node_modules/leaflet-editinosm/Leaflet.EditInOSM.* umap/static/umap/vendors/editinosm/
mkdir -p umap/static/umap/vendors/editinosm/ && cp -r node_modules/leaflet-editinosm/edit-in-osm.png umap/static/umap/vendors/editinosm/
mkdir -p umap/static/umap/vendors/minimap/ && cp -r node_modules/leaflet-minimap/src/** umap/static/umap/vendors/minimap/
mkdir -p umap/static/umap/vendors/loading/ && cp -r node_modules/leaflet-loading/src/** umap/static/umap/vendors/loading/
mkdir -p umap/static/umap/vendors/markercluster/ && cp -r node_modules/leaflet.markercluster/dist/** umap/static/umap/vendors/markercluster/
mkdir -p umap/static/umap/vendors/contextmenu/ && cp -r node_modules/leaflet-contextmenu/dist/** umap/static/umap/vendors/contextmenu/
mkdir -p umap/static/umap/vendors/heat/ && cp -r node_modules/leaflet.heat/dist/** umap/static/umap/vendors/heat/
mkdir -p umap/static/umap/vendors/fullscreen/ && cp -r node_modules/leaflet-fullscreen/dist/** umap/static/umap/vendors/fullscreen/
mkdir -p umap/static/umap/vendors/toolbar/ && cp -r node_modules/leaflet-toolbar/dist/** umap/static/umap/vendors/toolbar/
mkdir -p umap/static/umap/vendors/formbuilder/ && cp -r node_modules/leaflet-formbuilder/*.js umap/static/umap/vendors/formbuilder/
mkdir -p umap/static/umap/vendors/measurable/ && cp -r node_modules/leaflet-measurable/Leaflet.Measurable.* umap/static/umap/vendors/measurable/
mkdir -p umap/static/umap/vendors/photon/ && cp -r node_modules/leaflet.photon/*.js umap/static/umap/vendors/photon/
mkdir -p umap/static/umap/vendors/csv2geojson/ && cp -r node_modules/csv2geojson/*.js umap/static/umap/vendors/csv2geojson/
mkdir -p umap/static/umap/vendors/togeojson/ && cp -r node_modules/@tmcw/togeojson/dist/togeojson.umd.js umap/static/umap/vendors/togeojson/togeojson.js
mkdir -p umap/static/umap/vendors/osmtogeojson/ && cp -r node_modules/osmtogeojson/osmtogeojson.js umap/static/umap/vendors/osmtogeojson/
mkdir -p umap/static/umap/vendors/georsstogeojson/ && cp -r node_modules/georsstogeojson/GeoRSSToGeoJSON.js umap/static/umap/vendors/georsstogeojson/
mkdir -p umap/static/umap/vendors/togpx/ && cp -r node_modules/togpx/togpx.js umap/static/umap/vendors/togpx/
mkdir -p umap/static/umap/vendors/tokml && cp -r node_modules/tokml/tokml.js umap/static/umap/vendors/tokml
mkdir -p umap/static/umap/vendors/locatecontrol/ && cp -r node_modules/leaflet.locatecontrol/dist/L.Control.Locate.css umap/static/umap/vendors/locatecontrol/
mkdir -p umap/static/umap/vendors/locatecontrol/ && cp -r node_modules/leaflet.locatecontrol/src/L.Control.Locate.js umap/static/umap/vendors/locatecontrol/
mkdir -p umap/static/umap/vendors/dompurify/ && cp -r node_modules/dompurify/dist/purify.js umap/static/umap/vendors/dompurify/
mkdir -p umap/static/umap/vendors/chroma/ && cp -r node_modules/chroma-js/chroma.min.js umap/static/umap/vendors/chroma/

echo 'Done!'
