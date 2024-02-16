# Changelog

## 2.0.0 - soon

This release is inauguring a new era in versionning uMap: in the future, we'll take care of better documenting breaking changes, so expect more major releases from now on. More details on [how we version](https://docs.umap-project.org/en/master/release/#when-to-make-a-release).

The main changes are:

* on the front-end side, we now use native ESM modules, so this may break on old browsers (see our [ESlint configuration](https://github.com/umap-project/umap/blob/a0634e5f55179fb52f7c00e39236b6339a7714b9/package.json#L68))
* on the back-end, we upgraded to Django 5.x, which drops support for Python 3.8 and Python 3.9.
* the OpenStreetMap OAuth1 client is not supported anymore
* licence switch from WTFPL to AGPLv3: having an OSI valid licence was a request from our partners and sponsors (#1605)

More details below!

### Breaking changes

* updrade to Django 5.x, which drops support for python < 3.10
* remove `django-compressor`, so `umap compress` is not a valid command anymore (compress is now done in the `collectstatic` process itself) (#1544, #1539)
* remove support for settings starting with `LEAFLET_STORAGE_` (deprecated since 1.0.0)
* remove support for deprecated OpenStreetMap OAuth1 backend in favour of OAuth2
* `FROM_EMAIL` setting is replaced by `DEFAULT_FROM_EMAIL`, which is [Django standard](https://docs.djangoproject.com/en/5.0/ref/settings/#default-from-email)

#### Migrate to OpenStreetMap OAuth2

* create a new app on OSM.org: https://www.openstreetmap.org/oauth2/applications/
* add the key and secret in your settings (or as env vars):
    * `SOCIAL_AUTH_OPENSTREETMAP_OAUTH2_KEY=xxxx`
    * `SOCIAL_AUTH_OPENSTREETMAP_OAUTH2_SECRET=xxxx`
* run the migration command, that will migrate all accounts from OAuth1 to Oauth2:
  `umap migrate`

### New features

* Ability to clone, delete and download all maps from user’s dashboard (#1430)
* Add experimental "map preview" in `/map/` endpoint (#1573)
* Adapt browser counter to the currently displayed features (#1572)
* Set preconnect link for tilelayer (#1552)
* Create an oEmbed endpoint for maps `/map/oembed/` (#1526)
* Use SVG for default icon (circle) (#1562)
* introduce `UMAP_HOME_FEED` to control which maps are shown on the home page (#1531)
* better algorithm (WCAG 21 based) to manage text and picto contrast (#1593)
* show last used pictograms in a separate tab (#1595)

### Bug fixes

* Uuse variable for color in browser if any (#1584)
* Non loaded layers should still be visible in legend and data browser (#1581)
* Do not try to reset tooltip of feature not on map (#1576)
* Empty file input when closing the importer panel (#1535)
* Honour datalayersControl=expanded in querystring (#1538)
* Fix icons for mailto and tel (#1547)
* Do not ask more classes than available values in choropleth mode (#1550)
* Build browser once features are on the map, not before (#1551)
* Replace `list.delete` call by the proper `remove` method
* Prevent datalayer to resetting to an old version on save (#1558)
* Messages coming from Django where never displayed in map view (#1588)
* Browser `inBbox` setting was not persistent  (#1586)
* Popup was not opening on click on browser when `inBbox` was active (#1586)
* reset table editor properties after creating a new one (#1610)
* do not try to animate the panel (#1608)

### Internal changes

* Move XHR management to a module and use fetch (#1555)
* Use https://umap-project.org link in map footer (#1541)
* Add support for JS modules (+module for URLs handling) (#1463)
* Pin versions in pyproject.toml (#1514)
* Set a umap-fragment web component for lists (#1516)
* Load Leaflet as a module
* Replaced `L.U` global by `U`

### Documentation

* Define an explicit release stragegy (#1567)

### Changed templates

* added `header.html` to add extra code in `<head>`
* added `branding.html` with site logo
* `registration/login.html`, which is not loaded in ajax anymore (and include `branding.html`)
* `umap/content.html` the JS call to load more have changed
* `umap/navigation.html`: it now includes `branding.html`

## 1.13.2 - 2024-01-25

### Bug fixes

- prevent datalayer to resetting to an old version on save (#1558)
- replace list.delete call by the proper remove method (#1559)


## 1.13.1 - 2024-01-08

### Bug fix
* icon element is undefined when clustered by @yohanboniface in #1512

## 1.13.0 - 2024-01-08

### New features
* Preview map only on click in user’s dashboard by @davidbgk in #1478
* feat(browser): add counter in datalayer headline by @yohanboniface in #1509
* Allow to type a latlng in the search box by @yohanboniface in #1480
* Add a popup template to showcase OpenStreetMap data by @yohanboniface in #1479
* Refactor Share & Download UI for better usability by @jschleic in #1454
* Move layer specific settings to a dedicated fieldset by @yohanboniface in #1499

### Bug fixes
* fix dirty flags when re-ordering layers by @jschleic in #1497
* Be more explicit on changed fields when updating choropleth form by @yohanboniface in #1490

### Documentation
* docs: Update the links in the README, remove the badges by @almet in #1501

### Internal Changes
* Create dependabot.yml by @almet in #1502

### Updated templates

- `umap/templates/auth/user_form.html`
- `umap/templates/umap/content.html`
- `umap/templates/umap/js.html`
- `umap/templates/umap/map_list.html`
- `umap/templates/umap/map_table.html`
- `umap/templates/umap/user_dashboard.html`

[See the diff](https://github.com/umap-project/umap/compare/1.12.2...1.13.0#files_bucket).

## 1.12.2 - 2023-12-29

### Bug  fixes
* Fix preview of TMS TileLayer by @yohanboniface in #1492
* Add a small box-shadow to tilelayer preview by @yohanboniface in #1493


## 1.12.1 - 2023-12-23

### New features
* Allow to edit pictogram categories from admin list by @yohanboniface in #1477

### Bug fixes
* Increase iconlayers titles on hover by @yohanboniface in #1476
* Remove zoom/moeveend events when deleting datalayer by @yohanboniface in #1484
* Better way of handling escape while drawing by @yohanboniface in #1483
* Do not fail on greedyTemplate when description is an object by @yohanboniface in #1482

### Internal changes
* build: Update makefile testjs to open the browser by @almet in #1472

## 1.12.0 - 2023-12-17

### New features
* Optimistic conflicts resolution mecanism by @almet in #772
* Use Leaflet.IconLayers as tilelayers switcher by @yohanboniface in #1469
* Use map style options to style minimap bbox rectangle by @yohanboniface in #1443
* Make it easier to open file dialog by @yohanboniface in #1445
* Use bounds instead of center when zooming to Polyline/Polygon by @yohanboniface in #1465
* Finish drawing line/polygon instead of cancelling when pressing Escape by @yohanboniface in #1444
* Allow to control the `interactive` option from the layer by @yohanboniface in #1446
* Replace "Ctrl" by "Cmd" under macOS and style the "kbd" tag in keyboard shortcuts labels by @yohanboniface in #1449

### Bug fixes
* Fix slideshow buttons not show when facets are active by @yohanboniface in #1435
* Always use fullwidth table editor by @yohanboniface in #1438
* fix: no data in facet filters when set as default panel by @k-3st3ban in #1447
* Make sure DataLayer._dataloaded is set only once all data is imported by @yohanboniface in #1458
* Fix toolbox overflow with facets’ search by @davidbgk in #1468
* Do not call `AttributionControl._update` for removed tile layer by @yohanboniface in #1466

### Documentation
* Mention more keyboard shortcuts by @yohanboniface in #1437
* [docs] Update the documentation by @almet in #1440
* [chore] fix docs requirements by @almet in #1450
* Better changelog rendering by @davidbgk in #1453
* [docs] Update security contact information by @almet in #1470
* [docs] Add some testing information by @almet in #1471

### Internal Changes
* Log error when loading tilelayer by @yohanboniface in #1442
* [ci] Add a separate target for docs by @almet in #1451
* Unify tooltip and headline and add the corresponding icon by @jschleic in #1455
* Use real tile URL in tests by @yohanboniface in #1467
* chore: fix a typo in `umap.forms.js` by @almet in #1473



## 1.11.1 - 2023-11-27

* Reset increasing icon text size by @yohanboniface in #1434
* But back blue links in popup and small credit by @yohanboniface in #1425
* Restore missing buttons in caption bar by @yohanboniface in #1422
* Restore style of "restore version button" by @yohanboniface in #1420
* Prevent dragging a datalayer to activate drag on the map by @yohanboniface in #1419
* Set map default center even if waiting for user location by @yohanboniface in #1432
* Do not exclude DEMO and SHOWCASE maps anymore from home by @yohanboniface in #1415
* Update search index command in documentation by @yohanboniface in #1416
* Use step=any by default for FloatInput by @yohanboniface in #1421
* Add in documentation example of filtering headers in ajax proxy conf by @yohanboniface in #1423
* Reuse the map_download view/url for the dashboard by @davidbgk in #1429
* Integrate with Github CI by @almet in #1413

## 1.11.0 - 2023-11-20

* Highlight selected feature by @jschleic in #1359
* Full map download endpoint by @davidbgk in #1396
* Refactor icon selector: use tabs, make options more explicit by @yohanboniface in #1395
* Allow to upload SVG pictograms and change hue according to background color by @yohanboniface in #1387
* Add Pictogram category by @yohanboniface in #1388
* Update white eye closed by @yohanboniface in #1389
* Update installation instructions by @almet in #1392
* Fix race condition with cluster layer by @yohanboniface in #1390
* Change background in pictograms list by @yohanboniface in #1394
* Add triangle icon to form fieldset to make toggle clearer by @yohanboniface in #1393
* Speedup the tests by using a weaker hash algo. by @almet in #1405
* Improve buttons’ contrasts on the homepage #a11y by @davidbgk in #1406
* Fix next/previous in popup footer in panel not openning next panel by @yohanboniface in #1403
* Set a default favicon by @davidbgk in #1401
* Fix vertex icons by @jschleic in #1407
* Fix heavy request for getting user maps by @yohanboniface in #1412

## 1.10.1 - 2023-10-27

* Add minimal CSV export by @yohanboniface in #1376
* A11Y: switch from links to buttons when pertinent by @davidbgk in #1290
* Fix map not loading when defaultView=latest and datalayer has no data by @yohanboniface in #1375
* Fix displayOnLoad not honoured at import by @yohanboniface in #1384
* Fix filter data crashing when data contains non string values by @yohanboniface in #1378
* Increase maxZoomLimit to 24 by @yohanboniface in #1381
* Round range step to 1 digit by @yohanboniface in #1380
* Keep only non graphic props in default properties, to prevent useless redraw by @yohanboniface in #1379
* Split defaultDatalayer in defaultView/EditDatalayer by @yohanboniface in #1383
* Fix variable declared globally by mistake by @yohanboniface in #1382
* Cancel tooltip on mouseout by @yohanboniface in #1385
* Update eye icon by @yohanboniface in #1386


## 1.9.3 - 2023-10-18

* Add experimental drag and drop of file on the map container by @yohanboniface in #1370
* Hide the next icon in buttons’ sprites by @davidbgk in #1371


## 1.9.2 - 2023-10-12

* Fix `map` reference in DataLayersControl by @yohanboniface in #1368
* Add back `HeatLayer._map` reference check by @yohanboniface in #1369


## 1.9.1 - 2023-10-12

* Fix import of .umap file containing a choropleth layer by @yohanboniface in #1367

## 1.9.0 - 2023-10-12

* Add experimental choropleth datalayer type by @yohanboniface in #1136
* Finally add Map.create_at field by @yohanboniface in #1350
* Update uwsgi.ini to prevent buffers errors with NGINX reverse proxies by @sircharlo in #1354
* switch to grid layout for multiple choice buttons by @jschleic in #1356
* Allow to hide a datalayer from the caption list by @yohanboniface in #1362
* Hide attribution on small screen and add a small ? to display it by @yohanboniface in #1349
* Heatmap improvements by @yohanboniface in #1358


## 1.8.2 - 2023-09-27

* Allow to restrict data browser items to current map view by @yohanboniface in #1339
* Set an explicit width to popup large container by @yohanboniface in #1343
* Do no try to fit data bounds if bounds are not valid by @yohanboniface in #1347
* Make sure SHORT_SITE_URL is defined before exposing Map.short_url by @yohanboniface in #1346
* Fix map's title when “dirty star” is present by @jschleic in #1348
* Redirect to canonical when URL contains the ?edit parameter by @yohanboniface in #1336
* Allow to add username to features (opt-in by instance) by @openbrian in #1324


## 1.8.1 - 2023-09-22

* Fix anonymous maps displayed by mistake in user dashboard by @yohanboniface in #1331
* Do not try to set editMode on _umap_options for old maps by @yohanboniface in #1332
* Fix datalayer's data duplicated at first save by @yohanboniface in #1334


## 1.8.0 - 2023-09-22

* Allow to define permissions for each datalayer instead of for the whole map by @yohanboniface in #1307
* Fix table editor not closing anymore from fullwidth by @yohanboniface in #1316
* Remove dot in property name by @yohanboniface in #1315
* Update Ubuntu installation documentation by @jvmatl in #1322
* Fix map displayed more than once in user dashboard when multiple editors by @yohanboniface in #1326
* Update Docker documentation by @jvmatl in #1320
* Docker: replace wait_for_database with depends_on and healthcheck by @openbrian in #1314
* Prune old .gz when saving a datalayer by @yohanboniface in #1329
* Restrict possible min/max zoom values by @davidbgk in #1321


## 1.7.3 - 2023-09-18

* Use css width for img custom width by @yohanboniface in #1306
* Enhance icon selector form by @yohanboniface in #1303
* Try to fix remote datalayer not sending dataloaded by @yohanboniface in #1298
* Setup to create integration tests with Playwright by @davidbgk in #1069
* Add a `powered by uMap` footer by @davidbgk in #1309
* Add outlinkTarget to default interactionProperties by @jschleic in #1313


## 1.7.2 - 2023-09-01

* Fix remote data not fetched on first save and add a button to manually fetch data by @yohanboniface in #1289
* Remove custom message from onbeforeunload event by @yohanboniface in #1288
* Edit header polish: move "My Dashboard" and "Help" to the right, display asterisk in dirty mode by @yohanboniface in #1287
* Make sure we load all data before downloading it by @yohanboniface in #1295
* Fix datalayers not sending "dataloaded" event when min/maxZoom is set and map is loaded outside those values by @yohanboniface in #1296
* Add back min-width for img in popup-large by @yohanboniface in #1297
* Avoid using a tuple as a content type when guessed by @davidbgk in #1291
* Put focus on name when opening feature edit panel by @yohanboniface in #1293
* Better distinguish panel behaviour in portrait vs landscape modes by @yohanboniface in #1292

## 1.7.1 - 2023-08-28

- quote URL in ajax proxy before passing it to Nginx

## 1.7.0 - 2023-08-28

- **BREAKING CHANGE** when `UMAP_XSENDFILE_HEADER` is set, uMap will now issue
 an internal redirect to Nginx for `ajax-proxy` requests, so **Nginx configuration
 needs to be updated**. See https://umap-project.readthedocs.io/en/master/ubuntu/#configure-ajax-proxy-cache
 for details.



## 1.6.1 - 2023-08-25

* fix: correct changelog link by @eMerzh in #1275
* Use magiclink extension for changelog with links by @davidbgk in #1278
* Fix datalayers being shown on zoom even if displayOnLoad is false by @yohanboniface in #1283
* Remove default center to prevent multiple map initialisations by @yohanboniface in #1284

## 1.6.0 - 2023-08-22

* Catch timeout error in ajax proxy by @yohanboniface in #1261
* Fix bug where minimap would not be displayed on load by @yohanboniface in #1267
* Allow to add more than one OAuth provider by @yohanboniface in #1271
* Protect back username field from being modified by social auth login by @yohanboniface in #1270
* Very lite "My Profile" page to allow changing username by @yohanboniface in #1269
* Store DataLayer's settings in DB by @yohanboniface in #1266
* When map has max bounds, use those bounds for limiting search by @yohanboniface in #1268
* Only call propagateShow at init if layer is visible by @yohanboniface in #1272

## 1.5.1 - 2023-08-15

- Fix layers behing hidden at zoom
- Fix bad status show in edit header on map creation (cf #1260)

## 1.5.0 - 2023-08-15

* Add target URL in CORS error message by @yohanboniface in #1228
* Use proper GPX mimetype by @yohanboniface in #1229
* Add icons to better distinguish edit panels by @yohanboniface in #1232
* Adapt logout behaviour in ajax/not ajax modes by @yohanboniface in #1235
* Fix popup panel not opening from the data browser by @yohanboniface in #1240
* Fix misplaced icons by @yohanboniface in #1241
* Allow to configure default share and edit status by @yohanboniface in #1245
* Bump mkdocs by @yohanboniface in #1246
* Use maintained fork of togeojson by @yohanboniface in #1249
* Do not try to compute geom based property before we have a geom by @yohanboniface in #1250
* Do not close panel when switching tilelayer by @yohanboniface in #1252
* Better control of default view by @yohanboniface in #1255
* Use latest release of black by @yohanboniface in #1193
* Explicitely use map default when dynamic var is unset by @yohanboniface in #1251
* Make fromZoom and toZoom options available for all layers by @yohanboniface in #1253
* Refactor "advanced filters" (and rename to facets) by @yohanboniface in #1243
* Edit header revamp by @yohanboniface in #1233
* adapt iframe min-width for popup large by @yohanboniface in #1238

## 1.4.4 - 2023-07-22
- fix tooltip anchor unstable (cf #1224)
- add a timeout in ajax proxy default view (cf #1222)
- allow non ascii chars in variables (cf #1221)
- add missing DB migration for label changes


## 1.4.3 - 2023-07-20
- fix issue introduced in 1.4.2 where trying to read a non existent gzip

## 1.4.2 - 2023-07-19
- fix If-Unmodified management for map prior to 1.3.0 (cf #1216)
- allow arobases in variables (cf #1217)

## 1.4.1 - 2023-07-17

- fix tooltip position, after Leaflet upgrade (cf #1207)
- replace `mousewheel` event by `wheel`, to follow Leaflet change (cf #1211)
- fallback user to dashboard after OAuth process (cf #1208)
- add share status in user dashboard (cf #1209)

## 1.4.0 - 2023-07-15
- add basic version of a "My Dashboard" page (cf #1196)
- better fit iframe in popups (cf #1203)
- fix missing line edit icons (cf #1205)
- bump Leaflet from 1.3.4 to 1.9.4 (cf #1201)
- fix permissions panel empty at first save (cf #1200)
- add `overflow-x: hidden` to popup (cf #1198)
- add time in datalayer versions list (cf #1195)

## 1.3.7 - 2023-07-03

- changed datalayer and tilelayer icons (cf #1188)
- fixed wrong language code passed to `localeCompare` (cf #1190)
- fixed natural sort of feature not placing space before other chars (cf #1191)

## 1.3.6 - 2023-07-01

- set font-display: swap; for fonts definition
- do not force scroll on popup content
- document Shift-Click and add Ctrl-Shift-click to edit datalayer
- advanced filter should not affect non browsable layers
- expose 'locale' parameter in templates
- pass options at datalayer creation when importing from umap file
- allow to set the lang while generating an anonymous_edit_url
- control links target
- allow to use properties as color value
- add "delete" link in data browser
- more natural sort of features
- be more strict when coordinates are set manually
- allow to sort reverse
- handle CORS errors with an explicit message
- add basic doc about settings
- add umap command in Docker PATH
- add a setting for the number of maps per search
- use SVG icons
- display latest created maps on empty search

## 1.3.5 - 2023-06-17

- fix stars link in header

## 1.3.4 - 2023-06-17

- allow to control icon opacity (cf #236)
- display the number of maps on search results page
- allow to customize user display name and URL slug
- fix geo: scheme in (description) links (cf #1140)
- fix popup footer floating within the content (cf #1146)

## 1.3.3 - 2023-06-07

- add Dockerfile
- fix content overlflow on popups (cf #1128)
- display uMap version in the credit box + link to changelog (cf #1129)

## 1.3.2 - 2023-06-04

- fix wrong message after creating a map while authenticated
- display user name in the map edit toolbar when authenticated

## 1.3.1 - 2023-06-03

- fix table rendering (cf #1117)
- fix some errors not caught in ajax proxy (cf #1118 #1119)
- add simple form to send secret edit link by email in anonymous mode (cf #1102)

## 1.3.0 - 2023-05-31

- added a filter by category panel (cf #1041, thanks @k-3st3ban)
- added a permanent credit (cf #1041, thanks @k-3st3ban)
- allow to add an overlay tilelayer
- replaced custom locate control with Leaflet.Locate (cf #1031, thanks @aleksejspopovs)
- fixed bug where we coud not edit permissions of a new saved map unless reloading the page
- CSS: Fix cut of text in iframes of popup content (cf #971, thanks @tordans)
- enhanced property fallback in string formatting (cf #862, thanks @mstock)
- lines and polygons measure is now displayed while drawing (cf #1068, thanks @knowname)
- refactored zoomTo while making easing transition non default (cf #679 #179)
- fixed old `_storage_options` not being cleaned when saving map (cf #1076)
- added star maps feature (cf #683)
- added a banner + removed create buttons when in read only mode (cf #1095)
- added DOMPurify to escape malicious input from user (cf #1094)
- expose direct map URL in the export panel (cf #699)
- added a very basic `/stats/` JSON view (cf #1100)
- added max width for the help box (on small screens, cf #887)
- display the steps for inputs of type range (cf #877)
- lazy load tile layers thumbnails (cf #1089)
- allow geolocation from iframe embeds (cf #898)
- remove the limit of visible maps in user’s view (cf #1025)
- switch to Django full text search instead of home made (cf #519)

## 1.2.7
- redirect to `user_maps` at auth end when `window.opener` is unavailable (Twitter auth flow)

## 1.2.6
- marked User.id as protected, to fix Twitter auth

## 1.2.5
- Allow to create search index without changing unaccent mutability (cf #519)
- switched from `If-None-Match` to `If-Unmodified-Since` for concurrency control
- prevent caching datalayers geojson when in edit mode
- refactored gzip management

## 1.2.4
- upgrade to Django 4.x, and upgrade of other deps
- switched from custom DictField to propert JsonField

## 1.2.3

- improved panel layout and image sizing (by @Binnette, cf #824)
- upgraded Django to 2.2.17 and Pillow 8.0.1 (which drops support for python 3.5)
- experimental fallback handling in templating (cf #820)
- fixed search URL, and allow to control it from settings (cf #842)
- fixed map frozen when setting by hand invalid coordinates (cf #799)
- fixed changing map ownership (cf #780)
- do not change map zoom when locating user (cf #763)
- update map extent on first save if it has not been changed yet (cf #841)


## 1.2.2

- fixed bug in popup inner HTML (cf #776)

## 1.2.1

- minimal RTL support (cf #752)
- fix username URL regex to allow spaces (cf #774)

## 1.2.0

- added translations for ar, ast, et, he, id, is, no, pt-br, pt-pt, si-lk, sr,
  sv, th-th, tr
- fixed username not updated when login with OAuth (by @Binnette, cf #754)
- removed protocol from iframe URL (by @Binnette, cf #748)
- fixed icon max-height (cf #143)
- better image and iframe sizing in right panel (cf #184)
- allow to use variables for tooltips (cf #737)
- add a marker on user geolocation (cf #339)
- change arrow direction when "more controls" is active (cf #485)
- add an experimental feature permalink (cf #294)
- fixed edge case where slideshow will run even when inactive
- fixed bug when trying to add a property with a dot in the name (cf #426)

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
- edit shortcuts has been added (Ctrl+E to toggle edit status, Ctrl+S to save, etc.)
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
- allow to close panel by Ctrl+Enter when editing in textarea
- add management for map max bounds
- add Ctrl+Z for canceling changes
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
