# Changelog

## 1.1.2

- fixed parsing of two iframes
- updated i18n
- upgraded Django to 2.2.1 and psycopg2 to 2.8.1

## 1.1.1

- downgraded psycopg2 to 2.7.7 (migrations where failing); should be fixed with
  Django 2.2.1
- fixed annoying bug where "load more map" would fail
- allow to filter by share status in admin page

## 1.1.0

- added `Map.BLOCKED` share status, to redact maps issuing legal complaints
  (only available through the admin)
- replaced `DictField` by `JSONField` (`umap migrate` needed)
- added `search_fields` and `autocomplete_fields` to MapAdmin
- lowercase `frameborder` in iframe export
- fixed bug in slideshow since renaming of Leaflet.Storage

## 1.0.0

### Upgrading to 1.0

- because of the merge of django-leaflet-storage inside umap, the migrations
  has been reset, so a bit of SQL needs to be ran by hand:

```sql
BEGIN;
DELETE FROM django_migrations WHERE app = 'leaflet_storage';
DELETE FROM django_migrations WHERE app = 'umap';
ALTER TABLE leaflet_storage_datalayer RENAME TO umap_datalayer;
ALTER TABLE leaflet_storage_datalayer_id_seq RENAME TO umap_datalayer_id_seq;
ALTER TABLE leaflet_storage_licence RENAME TO umap_licence;
ALTER TABLE leaflet_storage_licence_id_seq RENAME TO umap_licence_id_seq;
ALTER TABLE leaflet_storage_map RENAME TO umap_map;
ALTER TABLE leaflet_storage_map_editors RENAME TO umap_map_editors;
ALTER TABLE leaflet_storage_map_editors_id_seq RENAME TO umap_map_editors_id_seq;
ALTER TABLE leaflet_storage_map_id_seq RENAME TO umap_map_id_seq;
ALTER TABLE leaflet_storage_pictogram RENAME TO umap_pictogram;
ALTER TABLE leaflet_storage_pictogram_id_seq RENAME TO umap_pictogram_id_seq;
ALTER TABLE leaflet_storage_tilelayer RENAME TO umap_tilelayer;
ALTER TABLE leaflet_storage_tilelayer_id_seq RENAME TO umap_tilelayer_id_seq;
COMMIT;
```

- Then fake initial migrations:

        umap migrate --fake-initial

- If you have customized some templates, change any `leaflet_storage/` path
  to `umap/`

- If you have customized some static, change any `storage/` path
  to `umap/`

- Each `LEAFLET_STORAGE_XXX` setting should be renamed in `UMAP_XXX` (but we
  still support them for now)

- If you still have a `MIDDLEWARE_CLASSES` setting, rename to `MIDDLEWARE`

- uMap now loads the local configuration from /etc/umap/umap.conf if
  `UMAP_SETTINGS` is not set, so you may want to use that path and remove
  the env var setting

- As usual, remember to update statics:

        umap collectstatic
        umap compress


### 1.0.0-rc.9
- increased maps displayed in user maps page (cf #651)
- exposed original map url in full export (cf #659)


### 1.0.0-rc.8

- fixed non browsable missing in caption panel
- fixed remote datalayers missing in browse data panel when displayed on load (cf #509)

### 1.0.0-rc.7

- fixed table popup template not displaying name anymore (cf #647)

### 1.0.0-rc.6

- fixed OSM properties not read anymore (cf #641)
- fixed permissions panel not active at first map save

### 1.0.0-rc.5

- fixed user autocompletion in permissions panel (cf #635)
- fixed ternary choice dealing with unknown values (cf #633)

### 1.0.0-rc.4

- fixed geodjango defaulting geojson parsing to SRID 3857 instead of 4326
- fixed tooltip on hover (cf #631)


### 1.0.0-rc.3

- added a readonly mode (`UMAP_READONLY=True`), useful to disallow update while
  migrating from one server to an other, for example


### 1.0.0-rc.2

- allow to cache proxied remote data requests (#513 #510 #160)
- fixed popup template parsing of url with url as query string (#607)
- naive support for nested variables in templates (#600)
- Removed Map.tilelayer foreignkey
- split popupTemplate in popupShape and popupTemplate: popupShape is for
  choosing between proper popup and panel, while popupTemplate now will allow
  to choose between default "name + description" mode, or table, or geoRSS ones.
  Allows to add more of those in the future also.
- fixed popup not opening on first zoom button click when marker is clustered (#611)

### 1.0.0-rc.1
- BREAKING: support of python 2 is removed per upgrading to Django 2.0
- WARNING: merge Leaflet-Storage and django-leaflet-storage inside umap to ease
  maintenance and contribution; See [Upgrading to 1.0](#upgrading-to-1.0)
- permissions management forms are now built in JS directly
- upgrade all dependencies
- added a language switcher in the home page footer
- added UMAP_CUSTOM_TEMPLATES and UMAP_CUSTOM_STATICS settings to make
  customization easier
- added empty `umap/theme.css` to ease customization
- add download link in the map and datalayers edit panel
- fixed some touch related CSS issues
- removed support for old URL (changed in version `0.3.0`)
- added languages: hr (Croatian), pl (Polish), hu (Hungarian), sl (Slovenian),
  el (Greek), gl (Galician)
- JS locales are now bundled, no need to generate them while installing
- local settings are now loaded from `/etc/umap/umap.conf` if available
- fixed an issue where it was not possible to change the tilelayer if the
  tilelayer control was not added to the map (#587)
- `showLabel` is now a ternary value (instead of having this plus `labelHover`)
  (#553)
- fixed resetting a select to undefined for inheritable fields (#551)
- fixed labelKey not being saved (#595)
- filtering in data browser now is also reflected in the displayed features
  (#550)
- fixed ClusterMarker text color on Chrome (#547)
- allow to clone also markers
- only list https ready tilerlayers when page is in https (#567)
- allow to use an unicode character as Marker symbol (#527)
- add `{rank}` as dynamic feature property (to be used in popup or icon symbol)
- add an explicit button to attach a owner to an anonyous map (#568)
- Add 'TablePanel' popup template (#481)


## 0.8.0
- allow colon in properties to be consumed in popupTemplate
- added am_ET, pl and sk_SK locales
- fixed default licence being created in every available languages
- switch to pytest for unit tests
- Django 1.10 compatibility
- add DataLayer.rank
- Expose DataLayer versions
- python3 support
- add nofollow meta when map is not public

## 0.7.5
- upgrade osmtogeojson to 2.1.0
- localize and proxy dataUrl parameter

## 0.7.4
- fix anonymous not able to edit map anymore

## 0.7.3
- add tooltip when drawing
- import multiple files at a time
- added Chinese (Taiwan) locale
- fixed right-click on path vertex not working propertly when editing

## 0.7.1
- upgrade Leaflet.Editable to 0.2.0
- fixed some bugs after Leaflet.Editable switch

## 0.7.0
- introduce panel popup mode
- upgraded leaflet.loading to 0.1.10
- make the cluster text color dynamic
- fix missing icons for transorm to polygon/polyline actions
- add a slideshow mode
- make possible to set cluster color by hand
- make possible to manage showLabel from layer and map
- basic kml/gpx download support
- MultiLineString are merged at import
- catch setMaxBounds errors (when using useless bounds)
- first version of a table editor
- it's now possible to cancel every mouse action of a polygon
  (useful when using them as background)
- simple custom popup templates
- more control over map data attribution (custom inputs added)
- basic HTTP optimistic concurrency control
- add "empty" button in limit bounds fieldset
- make possible to decide which properties the data browser will filter on
- add "datalayers" query string parameter to override shown datalayers on map load
- add edit fieldset for changing marker latlng by hand
- moved from Leaflet.Draw to Leaflet.Editable
- added Vietnamese
- by default, allow_edit is now false
- added Chinese (Taiwan) locale

## 0.6.x
- add TMS option to custom tilelayer
- allow to define default properties at map level
- support iframe in text formatting
- fix bug where polygon export were adding a point
- make that only visible elements are downloaded
- iframe export helper
- add Leaflet.label (for marker only atm)
- GeoRSS support
- heatmap support, thanks to https://github.com/Leaflet/Leaflet.heat
- added optional caption bar
- added new "large" popup template
- added a button to empty a layer without deleting it
- added a button to clone a datalayer
- added dataUrl and dataFormat on map creation page
- basic support for GeometryCollection import
- removed submodules and switched to grunt for assets management
- upgrade to django 1.6
- sesql replaced by django-pgindex
- support for gzip for datalayer geojson
- support for X-Senfile/Accel-Redirect
- more translations
- fix anonymous map owner not able to delete their map
- fix missing vendors assets
- reset South migrations (some were bugged); to be back again with django 1.7
- added russian locale
- http optimistic concurrency control
- longer anonymous cookie max_age (one month instead of session only)
- add possibility to override default zoom with LEAFLET_ZOOM setting
- fix bug where anonymous map wasn't editable by logged in users even if
  edit status was ANONYMOUS

## 0.5.x
- datalayers are now sent to backend as geojson
- there is now a global "save" button, and also a "cancel changes"
- added a contextmenu, thanks to https://github.com/aratcliffe/Leaflet.contextmenu
- added a loader, thanks to https://github.com/ebrelsford/Leaflet.loading
- import are processed client side, thanks to https://github.com/mapbox/csv2geojson
  and https://github.com/mapbox/togeojson
- download is handled client side
- option "outlink" as been added, to open external URL on polygon click
- edit shortcuts has been added (Ctrl-E to toggle edit status, Ctrl-S to save, etc.)
- links in popup now open in a now window
- possibility to add custom icon symbols
- new option to clusterize markers, thanks to https://github.com/Leaflet/Leaflet.markercluster
- remote data option added to datalayer: this will fetch data from a given URL
  instead of from the local database
- popup window can now display a table with all features properties
- support of OSM XML format, thanks to https://github.com/tyrasd/osmtogeojson
- added a measure control, thanks to https://github.com/makinacorpus/Leaflet.MeasureControl
- added Transifex config
- simple help boxes
- it's now possible to set background layer with manual settings
- add an edit button in the data browser (when in edit mode)
- add icon URL formatting with feature properties
- add "Transform to Polygon/Polyline" action
- new link on contextmenu to open external routing service from clicked point
- fix bug where features were duplicated when datalayer was deleted then reverted
- add layer action to databrowser
- add optional default CSS
- allow to close panel by ctrl-Enter when editing in textarea
- add management for map max bounds
- add Ctrl-Z for canceling changes
- internal storage structure totally reviewed: datalayers are stored as geojson files,
  instead of being split in features stored in PostGIS
- upload and download moved to client side (see Leaflet.Storage)
- cloned map name is now prefixed by "Clone of "
- added Transifex config
- workaround for non asciiable map names
- add a share_status fielf in Map model

## 0.4.x
- add a data browser
- add a popup footer with navigation between features
- some work on IE compat
- new tilelayer visual switcher
- Spanish translation, thanks to @ikks
- renamed internally category in datalayer
- add a rank column to tilelayer to control their order in the tilelayer edit box
- fix description that was not exported in the GeoJSON export
- return proper 403 if bad signature on anonymous_edit_url access
- refactored tilelayer management
- smarter encoding management at import
- smarter errors management at import
- handle other delimiters than just comma for CSV import
- Spanish translation, thanks to @ikks
- map clone possibility

## 0.3.x
- add a setting to display map caption on map load (cf #50)
- add nl translation
- update to Leaflet 0.6-dev and Leaflet.Draw 0.2
- handle anonymous map creation
- Fix color no more displayed in map info box (cf #70)
- portuguese translation (thanks @FranciscoDS)
- fix bug when the map title was too long (making the slug too long, and so over the
  database limit for this field)
- add a setting to display map caption on map load (cf Leaflet.Storage#50)
- update to django 1.5
- first version of a CSV import
- add a Textarea in import form
- first version of data export (GeoJSON only for now)


## 0.2.0
- handle auth from popup
- add a control for map settings management
- move to Leaflet 0.5
- move to Leaflet.draw 0.1.6
- default tooltip has now a fixed position
- make just drown polys editable
- handle path styling option (https://github.com/yohanboniface/Leaflet.Storage/issues/26)
- add an UI to manage icon style and picto (https://github.com/yohanboniface/django-leaflet-storage/issues/22)
- icon style and picto are now manageable also on Markers (https://github.com/yohanboniface/django-leaflet-storage/issues/21)
- add Leaflet.EditInOSM plugin in options
- add a scale control (optional)
- add an optional minimap (with Leaflet.MiniMap plugin)
- handle map settings management from front-end
- handle path styling options (https://github.com/yohanboniface/Leaflet.Storage/issues/26)
- remove Category.rank (https://github.com/yohanboniface/django-leaflet-storage/issues/46)
- Marker has now icon_class and pictogram fields (https://github.com/yohanboniface/django-leaflet-storage/issues/21)
- handle scale control
- basic short URL management
- fixed a bug where imports were failing if the category had a custom marker image

## 0.1.0

- first packaged version
