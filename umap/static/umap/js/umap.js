L.Map.mergeOptions({
    base_layers: null,
    overlay_layers: null,
    datalayers: [],
    center: [4, 50],
    zoom: 6,
    hash: true,
    default_color: 'DarkBlue',
    default_smoothFactor: 1.0,
    default_opacity: 0.5,
    default_fillOpacity: 0.3,
    default_stroke: true,
    default_fill: true,
    default_weight: 3,
    default_iconClass: 'Default',
    default_zoomTo: 16,
    default_popupContentTemplate: '# {name}\n{description}',
    default_interactive: true,
    default_labelDirection: 'auto',
    attributionControl: false,
    allowEdit: true,
    embedControl: true,
    zoomControl: true,
    datalayersControl: true,
    searchControl: true,
    editInOSMControl: false,
    editInOSMControlOptions: false,
    scaleControl: true,
    noControl: false,  // Do not render any control.
    miniMap: false,
    name: '',
    description: '',
    displayPopupFooter: false,
    demoTileInfos: {s: 'a', z: 9, x: 265, y: 181, r: ''},
    licences: [],
    licence: '',
    enableMarkerDraw: true,
    enablePolygonDraw: true,
    enablePolylineDraw: true,
    limitBounds: {},
    importPresets: [
        // {url: 'http://localhost:8019/en/datalayer/1502/', label: 'Simplified World Countries', format: 'geojson'}
    ],
    moreControl: true,
    captionBar: false,
    slideshow: {},
    clickable: true,
    easing: true
});

L.U.Map.include({

    HIDDABLE_CONTROLS: ['zoom', 'search', 'fullscreen', 'embed', 'locate', 'measure', 'tilelayers', 'editinosm', 'datalayers'],

    initialize: function (el, geojson) {

        if (geojson.properties && geojson.properties.locale) L.setLocale(geojson.properties.locale);

        // Don't let default autocreation of controls
        var zoomControl = typeof geojson.properties.zoomControl !== 'undefined' ? geojson.properties.zoomControl : true;
        geojson.properties.zoomControl = false;
        var fullscreenControl = typeof geojson.properties.fullscreenControl !== 'undefined' ? geojson.properties.fullscreenControl : true;
        geojson.properties.fullscreenControl = false;
        L.Util.setBooleanFromQueryString(geojson.properties, 'scrollWheelZoom');
        L.Map.prototype.initialize.call(this, el, geojson.properties);

        this.ui = new L.U.UI(this._container);
        this.xhr = new L.U.Xhr(this.ui);
        this.xhr.on('dataloding', function (e) {
            this.fire('dataloding', e);
        });
        this.xhr.on('datalaod', function (e) {
            this.fire('datalaod', e);
        });

        this.initLoader();
        this.name = this.options.name;
        this.description = this.options.description;
        this.demoTileInfos = this.options.demoTileInfos;
        if (geojson.geometry) this.options.center = geojson.geometry;
        this.options.zoomControl = zoomControl;
        this.options.fullscreenControl = fullscreenControl;
        L.Util.setBooleanFromQueryString(this.options, 'moreControl');
        L.Util.setBooleanFromQueryString(this.options, 'scaleControl');
        L.Util.setBooleanFromQueryString(this.options, 'miniMap');
        L.Util.setBooleanFromQueryString(this.options, 'allowEdit');
        L.Util.setBooleanFromQueryString(this.options, 'displayDataBrowserOnLoad');
        L.Util.setBooleanFromQueryString(this.options, 'displayCaptionOnLoad');
        L.Util.setBooleanFromQueryString(this.options, 'captionBar');
        for (var i = 0; i < this.HIDDABLE_CONTROLS.length; i++) {
            L.Util.setNullableBooleanFromQueryString(this.options, this.HIDDABLE_CONTROLS[i] + 'Control');
        }
        this.datalayersOnLoad = L.Util.queryString('datalayers');
        this.options.onLoadPanel = L.Util.queryString('onLoadPanel', this.options.onLoadPanel);
        if (this.datalayersOnLoad) this.datalayersOnLoad = this.datalayersOnLoad.toString().split(',');

        if (L.Browser.ielt9) this.options.allowEdit = false; // TODO include ie9

        var editedFeature = null,
            self = this;
        try {
            Object.defineProperty(this, 'editedFeature', {
                get: function () {
                    return editedFeature;
                },
                set: function (feature) {
                    if (editedFeature && editedFeature !== feature) {
                        editedFeature.endEdit();
                    }
                    editedFeature = feature;
                    self.fire('seteditedfeature');
                }
            });
        }
        catch (e) {
            // Certainly IE8, which has a limited version of defineProperty
        }

        if (this.options.hash) this.addHash();
        this.initCenter();
        this.handleLimitBounds();

        this.initTileLayers(this.options.tilelayers);

        // Global storage for retrieving datalayers and features
        this.datalayers = {};
        this.datalayers_index = [];
        this.dirty_datalayers = [];
        this.features_index = {};

        // Retrocompat
        if (this.options.slideshow && this.options.slideshow.delay && this.options.slideshow.active === undefined) this.options.slideshow.active = true;

        this.initControls();

        // create datalayers
        this.initDatalayers();

        if (this.options.displayCaptionOnLoad) {
            // Retrocompat
            if (!this.options.onLoadPanel) {
                this.options.onLoadPanel = 'caption';
            }
            delete this.options.displayCaptionOnLoad;
        }
        if (this.options.displayDataBrowserOnLoad) {
            // Retrocompat
            if (!this.options.onLoadPanel) {
                this.options.onLoadPanel = 'databrowser';
            }
            delete this.options.displayDataBrowserOnLoad;
        }

        this.ui.on('panel:closed', function () {
            this.invalidateSize({pan: false});
        }, this);

        var isDirty = false; // global status
        try {
            Object.defineProperty(this, 'isDirty', {
                get: function () {
                    return isDirty || this.dirty_datalayers.length;
                },
                set: function (status) {
                    if (!isDirty && status) self.fire('isdirty');
                    isDirty = status;
                    self.checkDirty();
                }
            });
        }
        catch (e) {
            // Certainly IE8, which has a limited version of defineProperty
        }
        this.on('baselayerchange', function (e) {
            if (this._controls.miniMap) this._controls.miniMap.onMainMapBaseLayerChange(e);
        }, this);

        // Creation mode
        if (!this.options.umap_id) {
            this.isDirty = true;
            this._default_extent = true;
            this.options.name = L._('Untitled map');
            this.options.allowEdit = true;
            var datalayer = this.createDataLayer();
            datalayer.connectToMap();
            this.enableEdit();
            var dataUrl = L.Util.queryString('dataUrl', null),
                dataFormat = L.Util.queryString('dataFormat', 'geojson');
            if (dataUrl) {
                dataUrl = decodeURIComponent(dataUrl);
                dataUrl = this.localizeUrl(dataUrl);
                dataUrl = this.proxyUrl(dataUrl);
                datalayer.importFromUrl(dataUrl, dataFormat);
            }
        }

        this.help = new L.U.Help(this);
        this.slideshow = new L.U.Slideshow(this, this.options.slideshow);
        this.permissions = new L.U.MapPermissions(this, this.options.permissions);
        this.initCaptionBar();
        if (this.options.allowEdit) {
            this.editTools = new L.U.Editable(this);
            this.ui.on('panel:closed panel:open', function () {
                this.editedFeature = null;
            }, this);
            this.initEditBar();
        }
        this.initShortcuts();
        this.onceDatalayersLoaded(function () {
            if (this.options.onLoadPanel === 'databrowser') this.openBrowser();
            else if (this.options.onLoadPanel === 'caption') this.displayCaption();
        });
        this.onceDataLoaded(function () {
            const slug = L.Util.queryString('feature');
            if (slug && this.features_index[slug]) this.features_index[slug].view();
        });


        window.onbeforeunload = function (e) {
            var msg = L._('You have unsaved changes.');
            if (self.isDirty) {
                e.returnValue = msg;
                return msg;
            }
        };
        this.backup();
        this.initContextMenu();
        this.on('click contextmenu.show', this.closeInplaceToolbar);
    },

    initControls: function () {
        this.helpMenuActions = {};
        this._controls = {};

        if (this.options.allowEdit && !this.options.noControl) {
            new L.U.EditControl(this).addTo(this);

            new L.U.DrawToolbar({map: this}).addTo(this);

            var editActions = [
                L.U.ImportAction,
                L.U.EditPropertiesAction,
                L.U.ChangeTileLayerAction,
                L.U.ManageDatalayersAction,
                L.U.UpdateExtentAction,
                L.U.UpdatePermsAction
            ];
            new L.U.SettingsToolbar({actions: editActions}).addTo(this);
        }
        this._controls.zoom = new L.Control.Zoom({zoomInTitle: L._('Zoom in'), zoomOutTitle: L._('Zoom out')});
        this._controls.datalayers = new L.U.DataLayersControl(this);
        this._controls.locate = new L.U.LocateControl();
        this._controls.fullscreen = new L.Control.Fullscreen({title: {'false': L._('View Fullscreen'), 'true': L._('Exit Fullscreen')}});
        this._controls.search = new L.U.SearchControl();
        this._controls.embed = new L.Control.Embed(this, this.options.embedOptions);
        this._controls.tilelayers = new L.U.TileLayerControl(this);
        this._controls.editinosm = new L.Control.EditInOSM({
            position: 'topleft',
            widgetOptions: {helpText: L._('Open this map extent in a map editor to provide more accurate data to OpenStreetMap')}
        });
        this._controls.measure = (new L.MeasureControl()).initHandler(this);
        this._controls.more = new L.U.MoreControls();
        this._controls.scale = L.control.scale();
        if (this.options.scrollWheelZoom) this.scrollWheelZoom.enable();
        else this.scrollWheelZoom.disable();
        this.renderControls();
    },

    renderControls: function () {
        L.DomUtil.classIf(document.body, 'umap-caption-bar-enabled', this.options.captionBar || (this.options.slideshow && this.options.slideshow.active));
        L.DomUtil.classIf(document.body, 'umap-slideshow-enabled', this.options.slideshow && this.options.slideshow.active);
        for (var i in this._controls) {
            this.removeControl(this._controls[i]);
        }
        if (this.options.noControl) return;

        this._controls.attribution = (new L.U.AttributionControl()).addTo(this);
        if (this.options.miniMap && !this.options.noControl) {
            this.whenReady(function () {
                if (this.selected_tilelayer) {
                    this._controls.miniMap = new L.Control.MiniMap(this.selected_tilelayer).addTo(this);
                    this._controls.miniMap._miniMap.invalidateSize();
                }
            });
        }
        var name, status, control;
        for (var i = 0; i < this.HIDDABLE_CONTROLS.length; i++) {
            name = this.HIDDABLE_CONTROLS[i];
            status = this.options[name + 'Control'];
            if (status === false) continue;
            control = this._controls[name];
            control.addTo(this);
            if (status === undefined || status === null) L.DomUtil.addClass(control._container, 'display-on-more');
            else L.DomUtil.removeClass(control._container, 'display-on-more');
        }
        if (this.options.moreControl) this._controls.more.addTo(this);
        if (this.options.scaleControl) this._controls.scale.addTo(this);
    },

    initDatalayers: function () {
        var toload = dataToload = seen = this.options.datalayers.length,
            self = this,
            datalayer;
        var loaded = function () {
            self.datalayersLoaded = true;
            self.fire('datalayersloaded');
        };
        var decrementToLoad = function () {
            toload--;
            if (toload === 0) loaded();
        };
        var dataLoaded = function () {
            self.dataLoaded = true;
            self.fire('dataloaded');
        };
        var decrementDataToLoad = function () {
            dataToload--;
            if (dataToload === 0) dataLoaded();
        };
        for (var j = 0; j < this.options.datalayers.length; j++) {
            datalayer = this.createDataLayer(this.options.datalayers[j]);
            if (datalayer.displayedOnLoad()) datalayer.onceLoaded(decrementToLoad);
            else decrementToLoad();
            if (datalayer.displayedOnLoad()) datalayer.onceDataLoaded(decrementDataToLoad);
            else decrementDataToLoad();
        }
        if (seen === 0) loaded() && dataLoaded();  // no datalayer
    },

    indexDatalayers: function () {
        var panes = this.getPane('overlayPane'),
            pane;
        this.datalayers_index = [];
        for (var i = 0; i < panes.children.length; i++) {
            pane = panes.children[i];
            if (!pane.dataset || !pane.dataset.id) continue;
            this.datalayers_index.push(this.datalayers[pane.dataset.id]);
        }
        this.updateDatalayersControl();
    },

    ensurePanesOrder: function () {
        this.eachDataLayer(function (datalayer) {
            datalayer.bringToTop();
        });
    },

    onceDatalayersLoaded: function (callback, context) {
        // Once datalayers **metadata** have been loaded
        if (this.datalayersLoaded) {
            callback.call(context || this, this);
        } else {
            this.once('datalayersloaded', callback, context);
        }
        return this;
    },

    onceDataLoaded: function (callback, context) {
        // Once datalayers **data** have been loaded
        if (this.dataLoaded) {
            callback.call(context || this, this);
        } else {
            this.once('dataloaded', callback, context);
        }
        return this;
    },

    updateDatalayersControl: function () {
        if (this._controls.datalayers) this._controls.datalayers.update();
    },

    backupOptions: function () {
        this._backupOptions = L.extend({}, this.options);
        this._backupOptions.tilelayer = L.extend({}, this.options.tilelayer);
        this._backupOptions.limitBounds = L.extend({}, this.options.limitBounds);
        this._backupOptions.permissions = L.extend({}, this.permissions.options);
    },

    resetOptions: function () {
        this.options = L.extend({}, this._backupOptions);
        this.options.tilelayer = L.extend({}, this._backupOptions.tilelayer);
        this.permissions.options = L.extend({}, this._backupOptions.permissions);
    },

    initShortcuts: function () {
        var globalShortcuts = function (e) {
            var key = e.keyCode,
                modifierKey = e.ctrlKey || e.metaKey;

            /* Generic shortcuts */
            if (key === L.U.Keys.F && modifierKey) {
                L.DomEvent.stop(e);
                this.search();
            } else if (e.keyCode === L.U.Keys.ESC) {
                if (this.help.visible()) this.help.hide();
                else this.ui.closePanel();
            }

            if (!this.options.allowEdit) return;

            /* Edit mode only shortcuts */
            if (key === L.U.Keys.E && modifierKey && !this.editEnabled) {
                L.DomEvent.stop(e);
                this.enableEdit();
            } else if (key === L.U.Keys.E && modifierKey && this.editEnabled && !this.isDirty) {
                L.DomEvent.stop(e);
                this.disableEdit();
                this.ui.closePanel();
            }
            if (key === L.U.Keys.S && modifierKey) {
                L.DomEvent.stop(e);
                if (this.isDirty) {
                    this.save();
                }
            }
            if (key === L.U.Keys.Z && modifierKey && this.isDirty) {
                L.DomEvent.stop(e);
                this.askForReset();
            }
            if (key === L.U.Keys.M && modifierKey && this.editEnabled) {
                L.DomEvent.stop(e);
                this.editTools.startMarker();
            }
            if (key === L.U.Keys.P && modifierKey && this.editEnabled) {
                L.DomEvent.stop(e);
                this.editTools.startPolygon();
            }
            if (key === L.U.Keys.L && modifierKey && this.editEnabled) {
                L.DomEvent.stop(e);
                this.editTools.startPolyline();
            }
            if (key === L.U.Keys.I && modifierKey && this.editEnabled) {
                L.DomEvent.stop(e);
                this.importPanel();
            }
            if (key === L.U.Keys.H && modifierKey && this.editEnabled) {
                L.DomEvent.stop(e);
                this.help.show('edit');
            }
            if (e.keyCode === L.U.Keys.ESC) {
                if (this.editEnabled) this.editTools.stopDrawing();
                if (this.measureTools.enabled()) this.measureTools.stopDrawing();
            }
        };
        L.DomEvent.addListener(document, 'keydown', globalShortcuts, this);
    },

    initTileLayers: function () {
        this.tilelayers = [];
        for(var i in this.options.tilelayers) {
            if(this.options.tilelayers.hasOwnProperty(i)) {
                this.tilelayers.push(this.createTileLayer(this.options.tilelayers[i]));
                if (this.options.tilelayer && this.options.tilelayer.url_template === this.options.tilelayers[i].url_template) {
                    // Keep control over the displayed attribution for non custom tilelayers
                    this.options.tilelayer.attribution = this.options.tilelayers[i].attribution;
                }
            }
        }
        if (this.options.tilelayer && this.options.tilelayer.url_template && this.options.tilelayer.attribution) {
            this.customTilelayer = this.createTileLayer(this.options.tilelayer);
            this.selectTileLayer(this.customTilelayer);
        } else {
            this.selectTileLayer(this.tilelayers[0]);
        }
    },

    createTileLayer: function (tilelayer) {
        return new L.TileLayer(tilelayer.url_template, tilelayer);
    },

    selectTileLayer: function (tilelayer) {
        if (tilelayer === this.selected_tilelayer) { return; }
        try {
            this.addLayer(tilelayer);
            this.fire('baselayerchange', {layer: tilelayer});
            if (this.selected_tilelayer) {
                this.removeLayer(this.selected_tilelayer);
            }
            this.selected_tilelayer = tilelayer;
            if (!isNaN(this.selected_tilelayer.options.minZoom) && this.getZoom() < this.selected_tilelayer.options.minZoom) {
                this.setZoom(this.selected_tilelayer.options.minZoom);
            }
            if (!isNaN(this.selected_tilelayer.options.maxZoom) && this.getZoom() > this.selected_tilelayer.options.maxZoom) {
                this.setZoom(this.selected_tilelayer.options.maxZoom);
            }
        } catch (e) {
            this.removeLayer(tilelayer);
            this.ui.alert({content: L._('Error in the tilelayer URL') + ': ' + tilelayer._url, level: 'error'});
            // Users can put tilelayer URLs by hand, and if they add wrong {variable},
            // Leaflet throw an error, and then the map is no more editable
        }
    },

    eachTileLayer: function (method, context) {
        var urls = [];
        for (var i in this.tilelayers) {
            if (this.tilelayers.hasOwnProperty(i)) {
                method.call(context, this.tilelayers[i]);
                urls.push(this.tilelayers[i]._url);
            }
        }
        if (this.customTilelayer && (Array.prototype.indexOf && urls.indexOf(this.customTilelayer._url) === -1)) {
            method.call(context || this, this.customTilelayer);
        }
    },

    initCenter: function () {
        if (this.options.hash && this._hash.parseHash(location.hash)) {
            // FIXME An invalid hash will cause the load to fail
            this._hash.update();
        }
        else if(this.options.locate && this.options.locate.setView) {
            // Prevent from making two setViews at init
            // which is not very fluid...
            this.locate(this.options.locate);
        }
        else {
            this.options.center = this.latLng(this.options.center);
            this.setView(this.options.center, this.options.zoom);
        }
    },

    latLng: function(a, b, c) {
        // manage geojson case and call original method
        if (!(a instanceof L.LatLng) && a.coordinates) {
            // Guess it's a geojson
            a = [a.coordinates[1], a.coordinates[0]];
        }
        return L.latLng(a, b, c);
    },

    handleLimitBounds: function () {
        var south = parseFloat(this.options.limitBounds.south),
            west = parseFloat(this.options.limitBounds.west),
            north = parseFloat(this.options.limitBounds.north),
            east = parseFloat(this.options.limitBounds.east);
        if (!isNaN(south) && !isNaN(west) && !isNaN(north) && !isNaN(east)) {
            var bounds = L.latLngBounds([[south, west], [north, east]]);
            this.options.minZoom = this.getBoundsZoom(bounds, false);
            try {
                this.setMaxBounds(bounds);
            } catch (e) {
                // Unusable bounds, like -2 -2 -2 -2?
                console.error('Error limiting bounds', e);
            }
        } else {
            this.options.minZoom = 0;
            this.setMaxBounds();
        }
    },

    setMaxBounds: function (bounds) {
        // Hack. Remove me when fix is released:
        // https://github.com/Leaflet/Leaflet/pull/4494
        bounds = L.latLngBounds(bounds);

        if (!bounds.isValid()) {
            this.options.maxBounds = null;
            return this.off('moveend', this._panInsideMaxBounds);
        }
        return L.Map.prototype.setMaxBounds.call(this, bounds);
    },

    createDataLayer: function(datalayer) {
        datalayer = datalayer || {name: L._('Layer') + ' ' + (this.datalayers_index.length + 1)};
        return new L.U.DataLayer(this, datalayer);
    },

    getDefaultOption: function (option) {
        return this.options['default_' + option];
    },

    getOption: function (option) {
        if (L.Util.usableOption(this.options, option)) return this.options[option];
        return this.getDefaultOption(option);
    },

    updateExtent: function() {
        this.options.center = this.getCenter();
        this.options.zoom = this.getZoom();
        this.isDirty = true;
        this._default_extent = false;
        this.ui.alert({content: L._('The zoom and center have been set.'), 'level': 'info'});
    },

    updateTileLayers: function () {
        var self = this,
            callback = function (tilelayer) {
                self.options.tilelayer = tilelayer.toJSON();
                self.isDirty = true;
            };
        if (this._controls.tilelayers) this._controls.tilelayers.openSwitcher({callback: callback, className: 'dark'});
    },

    manageDatalayers: function () {
        if (this._controls.datalayers) this._controls.datalayers.openPanel();
    },

    renderShareBox: function () {
        var container = L.DomUtil.create('div', 'umap-share'),
            embedTitle = L.DomUtil.add('h4', '', container, L._('Embed the map')),
            iframe = L.DomUtil.create('textarea', 'umap-share-iframe', container),
            option;
        var UIFields = [
            ['dimensions.width', {handler: 'Input', label: L._('width')}],
            ['dimensions.height', {handler: 'Input', label: L._('height')}],
            ['options.includeFullScreenLink', {handler: 'Switch', label: L._('Include full screen link?')}],
            ['options.currentView', {handler: 'Switch', label: L._('Current view instead of default map view?')}],
            ['options.keepCurrentDatalayers', {handler: 'Switch', label: L._('Keep current visible layers')}],
            ['options.viewCurrentFeature', {handler: 'Switch', label: L._('Open current feature on load')}],
            'queryString.moreControl',
            'queryString.scrollWheelZoom',
            'queryString.miniMap',
            'queryString.scaleControl',
            'queryString.onLoadPanel',
            'queryString.captionBar'
        ];
        for (var i = 0; i < this.HIDDABLE_CONTROLS.length; i++) {
            UIFields.push('queryString.' + this.HIDDABLE_CONTROLS[i] + 'Control');
        }
        var iframeExporter = new L.U.IframeExporter(this);
        var buildIframeCode = function () {
            iframe.innerHTML = iframeExporter.build();
        };
        buildIframeCode();
        var builder = new L.U.FormBuilder(iframeExporter, UIFields, {
            callback: buildIframeCode
        });
        var iframeOptions = L.DomUtil.createFieldset(container, L._('Iframe export options'));
        iframeOptions.appendChild(builder.build());
        if (this.options.shortUrl) {
            L.DomUtil.create('hr', '', container);
            L.DomUtil.add('h4', '', container, L._('Short URL'));
            var shortUrl = L.DomUtil.create('input', 'umap-short-url', container);
            shortUrl.type = 'text';
            shortUrl.value = this.options.shortUrl;
        }
        L.DomUtil.create('hr', '', container);
        L.DomUtil.add('h4', '', container, L._('Download data'));
        var typeInput = L.DomUtil.create('select', '', container);
        typeInput.name = 'format';
        var exportCaveat = L.DomUtil.add('small', 'help-text', container, L._('Only visible features will be downloaded.'));
        exportCaveat.id = 'export_caveat_text';
        var toggleCaveat = function () {
            if (typeInput.value === 'umap') exportCaveat.style.display = 'none';
            else exportCaveat.style.display = 'inherit';
        }
        L.DomEvent.on(typeInput, 'change', toggleCaveat);
        var types = {
            geojson: {
                formatter: function (map) {return JSON.stringify(map.toGeoJSON(), null, 2);},
                ext: '.geojson',
                filetype: 'application/json'
            },
            gpx: {
                formatter: function (map) {return togpx(map.toGeoJSON());},
                ext: '.gpx',
                filetype: 'application/xml'
            },
            kml: {
                formatter: function (map) {return tokml(map.toGeoJSON());},
                ext: '.kml',
                filetype: 'application/vnd.google-earth.kml+xml'
            },
            umap: {
                name: L._('Full map data'),
                formatter: function (map) {return map.serialize();},
                ext: '.umap',
                filetype: 'application/json',
                selected: true
            }
        };
        for (var key in types) {
            if (types.hasOwnProperty(key)) {
                option = L.DomUtil.create('option', '', typeInput);
                option.value = key;
                option.textContent = types[key].name || key;
                if (types[key].selected) option.selected = true;
            }
        }
        toggleCaveat();
        var download = L.DomUtil.create('a', 'button', container);
        download.textContent = L._('Download data');
        L.DomEvent.on(download, 'click', function () {
            var type = types[typeInput.value],
                content = type.formatter(this),
                name = this.options.name || 'data';
            name = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            download.download = name + type.ext;
            window.URL = window.URL || window.webkitURL;
            var blob = new Blob([content], {type: type.filetype});
            download.href = window.URL.createObjectURL(blob);
        }, this);
        this.ui.openPanel({data: {html: container}});
    },

    toGeoJSON: function () {
        var features = [];
        this.eachDataLayer(function (datalayer) {
            if (datalayer.isVisible()) {
                features = features.concat(datalayer.featuresToGeoJSON());
            }
        });
        var geojson = {
            type: 'FeatureCollection',
            features: features
        };
        return geojson;
    },

    importPanel: function () {
        var container = L.DomUtil.create('div', 'umap-upload'),
            title = L.DomUtil.create('h4', '', container),
            presetBox = L.DomUtil.create('div', 'formbox', container),
            presetSelect = L.DomUtil.create('select', '', presetBox),
            fileBox = L.DomUtil.create('div', 'formbox', container),
            fileInput = L.DomUtil.create('input', '', fileBox),
            urlInput = L.DomUtil.create('input', '', container),
            rawInput = L.DomUtil.create('textarea', '', container),
            typeLabel = L.DomUtil.create('label', '', container),
            layerLabel = L.DomUtil.create('label', '', container),
            clearLabel = L.DomUtil.create('label', '', container),
            submitInput = L.DomUtil.create('input', '', container),
            map = this, option,
            types = ['geojson', 'csv', 'gpx', 'kml', 'osm', 'georss', 'umap'];
        title.textContent = L._('Import data');
        fileInput.type = 'file';
        fileInput.multiple = 'multiple';
        submitInput.type = 'button';
        submitInput.value = L._('Import');
        submitInput.className = 'button';
        typeLabel.textContent = L._('Choose the format of the data to import');
        this.help.button(typeLabel, 'importFormats');
        var typeInput = L.DomUtil.create('select', '', typeLabel);
        typeInput.name = 'format';
        layerLabel.textContent = L._('Choose the layer to import in');
        var layerInput = L.DomUtil.create('select', '', layerLabel);
        layerInput.name = 'datalayer';
        urlInput.type = 'text';
        urlInput.placeholder = L._('Provide an URL here');
        rawInput.placeholder = L._('Paste your data here');
        clearLabel.textContent = L._('Replace layer content');
        var clearFlag = L.DomUtil.create('input', '', clearLabel);
        clearFlag.type = 'checkbox';
        clearFlag.name = 'clear';
        this.eachDataLayerReverse(function (datalayer) {
            if (datalayer.isLoaded()) {
                var id = L.stamp(datalayer);
                option = L.DomUtil.create('option', '', layerInput);
                option.value = id;
                option.textContent = datalayer.options.name;
            }
        });
        L.DomUtil.element('option', {value: '', textContent: L._('Import in a new layer')}, layerInput);
        L.DomUtil.element('option', {value: '', textContent: L._('Choose the data format')}, typeInput);
        for (var i = 0; i < types.length; i++) {
            option = L.DomUtil.create('option', '', typeInput);
            option.value = option.textContent = types[i];
        }
        if (this.options.importPresets.length) {
            var noPreset = L.DomUtil.create('option', '', presetSelect);
            noPreset.value = noPreset.textContent = L._('Choose a preset');
            for (var j = 0; j < this.options.importPresets.length; j++) {
                option = L.DomUtil.create('option', '', presetSelect);
                option.value = this.options.importPresets[j].url;
                option.textContent = this.options.importPresets[j].label;
            }
        } else {
            presetBox.style.display = 'none';
        }

        var submit = function () {
            var type = typeInput.value,
                layerId = layerInput[layerInput.selectedIndex].value,
                layer;
            if (type === 'umap') {
                this.once('postsync', function () {
                    this.setView(this.latLng(this.options.center), this.options.zoom);
                });
            }
            if (layerId) layer = map.datalayers[layerId];
            if (layer && clearFlag.checked) layer.empty();
            if (fileInput.files.length) {
                var file;
                for (var i = 0, file; file = fileInput.files[i]; i++) {
                    type = type || L.Util.detectFileType(file);
                    if (!type) {
                        this.ui.alert({content: L._('Unable to detect format of file {filename}', {filename: file.name}), level: 'error'});
                        continue;
                    }
                    if (type === 'umap') {
                        this.importFromFile(file, 'umap');
                    } else {
                        var importLayer = layer;
                        if (!layer) importLayer = this.createDataLayer({name: file.name});
                        importLayer.importFromFile(file, type);
                    }
                }
            } else {
                if (!type) return this.ui.alert({content: L._('Please choose a format'), level: 'error'});
                if (rawInput.value && type === 'umap') {
                    try {
                        this.importRaw(rawInput.value, type);
                    } catch (e) {
                        this.ui.alert({content: L._('Invalid umap data'), level: 'error'});
                        console.error(e);
                    }
                } else {
                    if (!layer) layer = this.createDataLayer();
                    if (rawInput.value) layer.importRaw(rawInput.value, type);
                    else if (urlInput.value) layer.importFromUrl(urlInput.value, type);
                    else if (presetSelect.selectedIndex > 0) layer.importFromUrl(presetSelect[presetSelect.selectedIndex].value, type);
                }
            }
        };
        L.DomEvent.on(submitInput, 'click', submit, this);
        L.DomEvent.on(fileInput, 'change', function (e) {
            var type = '', newType;
            for (var i = 0; i < e.target.files.length; i++) {
                newType = L.Util.detectFileType(e.target.files[i]);
                if (!type && newType) type = newType;
                if (type && newType !== type) {
                    type = '';
                    break;
                }
            }
            typeInput.value = type;
        }, this);
        this.ui.openPanel({data: {html: container}, className: 'dark'});
    },

    importRaw: function(rawData) {
        var importedData = JSON.parse(rawData);

        var mustReindex = false;

        for (var i = 0; i < this.editableOptions.length; i++) {
            var option = this.editableOptions[i];
            if (typeof importedData.properties[option] !== 'undefined') {
                this.options[option] = importedData.properties[option];
                if (option === 'sortKey') mustReindex = true;
            }
        }

        if (importedData.geometry) this.options.center = this.latLng(importedData.geometry);
        var self = this;
        importedData.layers.forEach( function (geojson) {
            var dataLayer = self.createDataLayer();
            dataLayer.fromUmapGeoJSON(geojson);
        });

        this.initTileLayers();
        this.renderControls();
        this.handleLimitBounds();
        this.eachDataLayer(function (datalayer) {
            if (mustReindex) datalayer.reindex();
            datalayer.redraw();
        });
        this.fire('postsync');
        this.isDirty = true;
    },

    importFromFile: function (file) {
        var reader = new FileReader();
        reader.readAsText(file);
        var self = this;
        reader.onload = function (e) {
            var rawData = e.target.result;
            try {
                self.importRaw(rawData);
            } catch (e) {
                console.error('Error importing data', e);
                self.ui.alert({content: L._('Invalid umap data in {filename}', {filename: file.name}), level: 'error'});
            }
        };
    },

    openBrowser: function () {
        this.onceDatalayersLoaded(function () {
            this._openBrowser();
        });
    },

    displayCaption: function () {
        var container = L.DomUtil.create('div', 'umap-caption'),
            title = L.DomUtil.create('h3', '', container);
        title.textContent = this.options.name;
        this.permissions.addOwnerLink('h5', container);
        if (this.options.description) {
            var description = L.DomUtil.create('div', 'umap-map-description', container);
            description.innerHTML = L.Util.toHTML(this.options.description);
        }
        var datalayerContainer = L.DomUtil.create('div', 'datalayer-container', container);
        this.eachVisibleDataLayer(function (datalayer) {
            var p = L.DomUtil.create('p', '', datalayerContainer),
                color = L.DomUtil.create('span', 'datalayer-color', p),
                headline = L.DomUtil.create('strong', '', p),
                description = L.DomUtil.create('span', '', p);
                datalayer.onceLoaded(function () {
                    color.style.backgroundColor = this.getColor();
                    if (datalayer.options.description) {
                        description.innerHTML = L.Util.toHTML(datalayer.options.description);
                    }
                });
            datalayer.renderToolbox(headline);
            L.DomUtil.add('span', '', headline, datalayer.options.name + ' ');
        });
        var creditsContainer = L.DomUtil.create('div', 'credits-container', container),
            credits = L.DomUtil.createFieldset(creditsContainer, L._('Credits'));
        title = L.DomUtil.add('h5', '', credits, L._('User content credits'));
        if (this.options.shortCredit || this.options.longCredit) {
            L.DomUtil.add('p', '', credits, L.Util.toHTML(this.options.longCredit || this.options.shortCredit));
        }
        if (this.options.licence) {
            var licence = L.DomUtil.add('p', '', credits, L._('Map user content has been published under licence') + ' '),
                link = L.DomUtil.add('a', '', licence, this.options.licence.name);
            link.href = this.options.licence.url;
        } else {
            L.DomUtil.add('p', '', credits, L._('No licence has been set'));
        }
        L.DomUtil.create('hr', '', credits);
        title = L.DomUtil.create('h5', '', credits);
        title.textContent = L._('Map background credits');
        var tilelayerCredit = L.DomUtil.create('p', '', credits),
            name = L.DomUtil.create('strong', '', tilelayerCredit),
            attribution = L.DomUtil.create('span', '', tilelayerCredit);
        name.textContent = this.selected_tilelayer.options.name + ' ';
        attribution.innerHTML = this.selected_tilelayer.getAttribution();
        L.DomUtil.create('hr', '', credits);
        var umapCredit = L.DomUtil.create('p', '', credits),
            urls = {
                leaflet: 'http://leafletjs.com',
                django: 'https://www.djangoproject.com',
                umap: 'http://wiki.openstreetmap.org/wiki/UMap'
            };
        umapCredit.innerHTML = L._('Powered by <a href="{leaflet}">Leaflet</a> and <a href="{django}">Django</a>, glued by <a href="{umap}">uMap project</a>.', urls);
        var browser = L.DomUtil.create('li', '');
        L.DomUtil.create('i', 'umap-icon-16 umap-list', browser);
        var label = L.DomUtil.create('span', '', browser);
        label.textContent = label.title = L._('Browse data');
        L.DomEvent.on(browser, 'click', this.openBrowser, this);
        this.ui.openPanel({data: {html: container}, actions: [browser]});
    },

    eachDataLayer: function (method, context) {
        for (var i = 0; i < this.datalayers_index.length; i++) {
            method.call(context, this.datalayers_index[i]);
        }
    },

    eachDataLayerReverse: function (method, context, filter) {
        for (var i = this.datalayers_index.length - 1; i >= 0; i--) {
            if (filter && !filter.call(context, this.datalayers_index[i])) continue;
            method.call(context, this.datalayers_index[i]);
        }
    },

    eachBrowsableDataLayer: function (method, context) {
        this.eachDataLayerReverse(method, context, function (d) { return d.allowBrowse(); });
    },

    eachVisibleDataLayer: function (method, context) {
        this.eachDataLayerReverse(method, context, function (d) { return d.isVisible(); });
    },

    findDataLayer: function (method, context) {
        for (var i = this.datalayers_index.length - 1; i >= 0; i--) {
            if (method.call(context, this.datalayers_index[i])) return this.datalayers_index[i];
        }
    },

    backup: function () {
        this.backupOptions();
        this._datalayers_index_bk = [].concat(this.datalayers_index);
    },

    reset: function () {
        if (this.editTools) this.editTools.stopDrawing();
        this.resetOptions();
        this.datalayers_index = [].concat(this._datalayers_index_bk);
        this.dirty_datalayers.slice().forEach(function (datalayer) {
            if (datalayer.isDeleted) datalayer.connectToMap();
            datalayer.reset();
        });
        this.ensurePanesOrder();
        this.dirty_datalayers = [];
        this.updateDatalayersControl();
        this.initTileLayers();
        this.isDirty = false;
    },

    checkDirty: function () {
        L.DomUtil.classIf(this._container, 'umap-is-dirty', this.isDirty);
    },

    addDirtyDatalayer: function (datalayer) {
        if (this.dirty_datalayers.indexOf(datalayer) === -1) {
            this.dirty_datalayers.push(datalayer);
            this.isDirty = true;
        }
    },

    removeDirtyDatalayer: function (datalayer) {
        if (this.dirty_datalayers.indexOf(datalayer) !== -1) {
            this.dirty_datalayers.splice(this.dirty_datalayers.indexOf(datalayer), 1);
            this.checkDirty();
        }
    },

    continueSaving: function () {
        if (this.dirty_datalayers.length) this.dirty_datalayers[0].save();
        else this.fire('saved');
    },

    editableOptions: [
        'zoom',
        'scrollWheelZoom',
        'scaleControl',
        'moreControl',
        'miniMap',
        'displayPopupFooter',
        'onLoadPanel',
        'tilelayersControl',
        'name',
        'description',
        'licence',
        'tilelayer',
        'limitBounds',
        'color',
        'iconClass',
        'iconUrl',
        'smoothFactor',
        'opacity',
        'weight',
        'fill',
        'fillColor',
        'fillOpacity',
        'dashArray',
        'popupShape',
        'popupTemplate',
        'popupContentTemplate',
        'zoomTo',
        'captionBar',
        'slideshow',
        'sortKey',
        'labelKey',
        'filterKey',
        'slugKey',
        'showLabel',
        'labelDirection',
        'labelInteractive',
        'shortCredit',
        'longCredit',
        'zoomControl',
        'datalayersControl',
        'searchControl',
        'locateControl',
        'fullscreenControl',
        'editinosmControl',
        'embedControl',
        'measureControl',
        'tilelayersControl',
        'easing'
    ],

    exportOptions: function () {
        var properties = {};
        for (var i = this.editableOptions.length - 1; i >= 0; i--) {
            if (typeof this.options[this.editableOptions[i]] !== 'undefined') {
                properties[this.editableOptions[i]] = this.options[this.editableOptions[i]];
            }
        }
        return properties;
    },

    serialize: function () {
        var umapfile = {
            type: 'umap',
            uri: window.location.href,
            properties: this.exportOptions(),
            geometry: this.geometry(),
            layers: []
        };

        this.eachDataLayer(function (datalayer) {
            umapfile.layers.push(datalayer.umapGeoJSON());
        });

        return JSON.stringify(umapfile, null, 2);
    },

    save: function () {
        if (!this.isDirty) return;
        if (this._default_extent) this.updateExtent();
        var geojson = {
            type: 'Feature',
            geometry: this.geometry(),
            properties: this.exportOptions()
        };
        this.backup();
        var formData = new FormData();
        formData.append('name', this.options.name);
        formData.append('center', JSON.stringify(this.geometry()));
        formData.append('settings', JSON.stringify(geojson));
        this.post(this.getSaveUrl(), {
            data: formData,
            context: this,
            callback: function (data) {
                var duration = 3000;
                if (!this.options.umap_id) {
                    duration = 100000; // we want a longer message at map creation (TODO UGLY)
                    this.options.umap_id = data.id;
                    this.permissions.setOptions(data.permissions)
                } else if (!this.permissions.isDirty) {
                    // Do not override local changes to permissions,
                    // but update in case some other editors changed them in the meantime.
                    this.permissions.setOptions(data.permissions)
                }
                // Update URL in case the name has changed.
                if (history && history.pushState) history.pushState({}, this.options.name, data.url);
                else window.location = data.url;
                if (data.info) msg = data.info;
                else msg = L._('Map has been saved!');
                this.once('saved', function () {
                    this.isDirty = false;
                    this.ui.alert({content: msg, level: 'info', duration: duration});
                });
                this.ui.closePanel();
                this.permissions.save();
            }
        });
    },

    getEditUrl: function() {
        return L.Util.template(this.options.urls.map_update, {'map_id': this.options.umap_id});
    },

    getCreateUrl: function() {
        return L.Util.template(this.options.urls.map_create);
    },

    getSaveUrl: function () {
        return (this.options.umap_id && this.getEditUrl()) || this.getCreateUrl();
    },

    geometry: function() {
        /* Return a GeoJSON geometry Object */
        var latlng = this.latLng(this.options.center || this.getCenter());
        return {
            type: 'Point',
            coordinates: [
                latlng.lng,
                latlng.lat
            ]
        };
    },

    defaultDataLayer: function () {
        var datalayer, fallback;
        datalayer = this.lastUsedDataLayer;
        if (datalayer && !datalayer.isRemoteLayer() && datalayer.canBrowse() && datalayer.isVisible()) {
            return datalayer;
        }
        datalayer = this.findDataLayer(function (datalayer) {
            if (!datalayer.isRemoteLayer() && datalayer.canBrowse()) {
                fallback = datalayer;
                if (datalayer.isVisible()) return true;
            }
        });
        if (datalayer) return datalayer;
        if (fallback) {
            // No datalayer visible, let's force one
            this.addLayer(fallback.layer);
            return fallback;
        }
        return this.createDataLayer();
    },

    getDataLayerByUmapId: function (umap_id) {
        return this.findDataLayer(function (d) { return d.umap_id == umap_id; });
    },

    edit: function () {
        if(!this.editEnabled) return;
        var container = L.DomUtil.create('div','umap-edit-container'),
            metadataFields = [
                'options.name',
                'options.description'
            ],
            title = L.DomUtil.create('h4', '', container);
        title.textContent = L._('Edit map properties');
        var builder = new L.U.FormBuilder(this, metadataFields);
        var form = builder.build();
        container.appendChild(form);
        var UIFields = [];
        for (var i = 0; i < this.HIDDABLE_CONTROLS.length; i++) {
            UIFields.push('options.' + this.HIDDABLE_CONTROLS[i] + 'Control');
        }
        UIFields = UIFields.concat([
            'options.moreControl',
            'options.scrollWheelZoom',
            'options.miniMap',
            'options.scaleControl',
            'options.onLoadPanel',
            'options.displayPopupFooter',
            'options.captionBar'
        ]);
        builder = new L.U.FormBuilder(this, UIFields, {
            callback: this.renderControls,
            callbackContext: this
        });
        var controlsOptions = L.DomUtil.createFieldset(container, L._('User interface options'));
        controlsOptions.appendChild(builder.build());

        var shapeOptions = [
            'options.color',
            'options.iconClass',
            'options.iconUrl',
            'options.opacity',
            'options.weight',
            'options.fill',
            'options.fillColor',
            'options.fillOpacity'
        ];

        builder = new L.U.FormBuilder(this, shapeOptions, {
            callback: function (e) {
                this.eachDataLayer(function (datalayer) {
                    datalayer.redraw();
                });
            }
        });
        var defaultShapeProperties = L.DomUtil.createFieldset(container, L._('Default shape properties'));
        defaultShapeProperties.appendChild(builder.build());

        var optionsFields = [
            'options.smoothFactor',
            'options.dashArray',
            'options.zoomTo',
            ['options.easing', {handler: 'Switch', label: L._('Advanced transition')}],
            'options.labelKey',
            ['options.sortKey', {handler: 'BlurInput', helpEntries: 'sortKey', placeholder: L._('Default: name'), label: L._('Sort key'), inheritable: true}],
            ['options.filterKey', {handler: 'Input', helpEntries: 'filterKey', placeholder: L._('Default: name'), label: L._('Filter keys'), inheritable: true}],
            ['options.slugKey', {handler: 'BlurInput', helpEntries: 'slugKey', placeholder: L._('Default: name'), label: L._('Feature identifier key')}]
        ];

        builder = new L.U.FormBuilder(this, optionsFields, {
            callback: function (e) {
                this.eachDataLayer(function (datalayer) {
                    if (e.helper.field === 'options.sortKey') datalayer.reindex();
                    datalayer.redraw();
                });
            }
        });
        var defaultProperties = L.DomUtil.createFieldset(container, L._('Default properties'));
        defaultProperties.appendChild(builder.build());

        var popupFields = [
            'options.popupShape',
            'options.popupTemplate',
            'options.popupContentTemplate',
            'options.showLabel',
            'options.labelDirection',
            'options.labelInteractive'
        ];
        builder = new L.U.FormBuilder(this, popupFields, {
            callback: function (e) {
                if (e.helper.field === 'options.popupTemplate' || e.helper.field === 'options.popupContentTemplate' || e.helper.field === 'options.popupShape') return;
                this.eachDataLayer(function (datalayer) {
                    datalayer.redraw();
                })
            }
        });
        var popupFieldset = L.DomUtil.createFieldset(container, L._('Default interaction options'));
        popupFieldset.appendChild(builder.build());

        if (!L.Util.isObject(this.options.tilelayer)) {
            this.options.tilelayer = {};
        }
        var tilelayerFields = [
            ['options.tilelayer.name', {handler: 'BlurInput', placeholder: L._('display name')}],
            ['options.tilelayer.url_template', {handler: 'BlurInput', helpText: L._('Supported scheme') + ': http://{s}.domain.com/{z}/{x}/{y}.png', placeholder: 'url'}],
            ['options.tilelayer.maxZoom', {handler: 'BlurIntInput', placeholder: L._('max zoom')}],
            ['options.tilelayer.minZoom', {handler: 'BlurIntInput', placeholder: L._('min zoom')}],
            ['options.tilelayer.attribution', {handler: 'BlurInput', placeholder: L._('attribution')}],
            ['options.tilelayer.tms', {handler: 'Switch', label: L._('TMS format')}]
        ];
        var customTilelayer = L.DomUtil.createFieldset(container, L._('Custom background'));
        builder = new L.U.FormBuilder(this, tilelayerFields, {
            callback: this.initTileLayers,
            callbackContext: this
        });
        customTilelayer.appendChild(builder.build());

        if (!L.Util.isObject(this.options.limitBounds)) {
            this.options.limitBounds = {};
        }
        var limitBounds = L.DomUtil.createFieldset(container, L._('Limit bounds'));
        var boundsFields = [
            ['options.limitBounds.south', {handler: 'BlurFloatInput', placeholder: L._('max South')}],
            ['options.limitBounds.west', {handler: 'BlurFloatInput', placeholder: L._('max West')}],
            ['options.limitBounds.north', {handler: 'BlurFloatInput', placeholder: L._('max North')}],
            ['options.limitBounds.east', {handler: 'BlurFloatInput', placeholder: L._('max East')}]
        ];
        var boundsBuilder = new L.U.FormBuilder(this, boundsFields, {
            callback: this.handleLimitBounds,
            callbackContext: this
        });
        limitBounds.appendChild(boundsBuilder.build());
        var boundsButtons = L.DomUtil.create('div', 'button-bar half', limitBounds);
        var setCurrentButton = L.DomUtil.add('a', 'button', boundsButtons, L._('Use current bounds'));
        setCurrentButton.href = '#';
        L.DomEvent.on(setCurrentButton, 'click', function () {
            var bounds = this.getBounds();
            this.options.limitBounds.south = L.Util.formatNum(bounds.getSouth());
            this.options.limitBounds.west = L.Util.formatNum(bounds.getWest());
            this.options.limitBounds.north = L.Util.formatNum(bounds.getNorth());
            this.options.limitBounds.east = L.Util.formatNum(bounds.getEast());
            boundsBuilder.fetchAll();
            this.isDirty = true;
            this.handleLimitBounds();
        }, this);
        var emptyBounds = L.DomUtil.add('a', 'button', boundsButtons, L._('Empty'));
        emptyBounds.href = '#';
        L.DomEvent.on(emptyBounds, 'click', function () {
            this.options.limitBounds.south = null;
            this.options.limitBounds.west = null;
            this.options.limitBounds.north = null;
            this.options.limitBounds.east = null;
            boundsBuilder.fetchAll();
            this.isDirty = true;
            this.handleLimitBounds();
        }, this);

        var slideshow = L.DomUtil.createFieldset(container, L._('Slideshow'));
        var slideshowFields = [
            ['options.slideshow.active', {handler: 'Switch', label: L._('Activate slideshow mode')}],
            ['options.slideshow.delay', {handler: 'SlideshowDelay', helpText: L._('Delay between two transitions when in play mode')}],
            ['options.slideshow.easing', {handler: 'Switch', label: L._('Smart transitions'), inheritable: true}],
            ['options.slideshow.autoplay', {handler: 'Switch', label: L._('Autostart when map is loaded')}]
        ];
        var slideshowHandler = function () {
            this.slideshow.setOptions(this.options.slideshow);
            this.renderControls();
        };
        var slideshowBuilder = new L.U.FormBuilder(this, slideshowFields, {
            callback: slideshowHandler,
            callbackContext: this
        });
        slideshow.appendChild(slideshowBuilder.build());

        var credits = L.DomUtil.createFieldset(container, L._('Credits'));
        var creditsFields = [
            ['options.licence', {handler: 'LicenceChooser', label: L._('licence')}],
            ['options.shortCredit', {handler: 'Input', label: L._('Short credits'), helpEntries: ['shortCredit', 'textFormatting']}],
            ['options.longCredit', {handler: 'Textarea', label: L._('Long credits'), helpEntries: ['longCredit', 'textFormatting']}]
        ];
        var creditsBuilder = new L.U.FormBuilder(this, creditsFields, {
            callback: function () {this._controls.attribution._update();},
            callbackContext: this
        });
        credits.appendChild(creditsBuilder.build());

        var advancedActions = L.DomUtil.createFieldset(container, L._('Advanced actions'));
        var advancedButtons = L.DomUtil.create('div', 'button-bar half', advancedActions);
        var del = L.DomUtil.create('a', 'button umap-delete', advancedButtons);
        del.href = '#';
        del.textContent = L._('Delete');
        L.DomEvent
            .on(del, 'click', L.DomEvent.stop)
            .on(del, 'click', this.del, this);
        var clone = L.DomUtil.create('a', 'button umap-clone', advancedButtons);
        clone.href = '#';
        clone.textContent = L._('Clone');
        clone.title = L._('Clone this map');
        L.DomEvent
            .on(clone, 'click', L.DomEvent.stop)
            .on(clone, 'click', this.clone, this);
        var empty = L.DomUtil.create('a', 'button umap-empty', advancedButtons);
        empty.href = '#';
        empty.textContent = L._('Empty');
        empty.title = L._('Delete all layers');
        L.DomEvent
            .on(empty, 'click', L.DomEvent.stop)
            .on(empty, 'click', this.empty, this);
        var download = L.DomUtil.create('a', 'button umap-download', advancedButtons);
        download.href = '#';
        download.textContent = L._('Download');
        download.title = L._('Open download panel');
        L.DomEvent
            .on(download, 'click', L.DomEvent.stop)
            .on(download, 'click', this.renderShareBox, this);
        this.ui.openPanel({data: {html: container}, className: 'dark'});
    },

    enableEdit: function() {
        L.DomUtil.addClass(document.body, 'umap-edit-enabled');
        this.editEnabled = true;
        this.fire('edit:enabled');
    },

    disableEdit: function() {
        if (this.isDirty) return;
        L.DomUtil.removeClass(document.body, 'umap-edit-enabled');
        this.editedFeature = null;
        this.editEnabled = false;
        this.fire('edit:disabled');
    },

    getDisplayName: function () {
        return this.options.name || L._('Untitled map');
    },

    initCaptionBar: function () {
        var container = L.DomUtil.create('div', 'umap-caption-bar', this._controlContainer),
            name = L.DomUtil.create('h3', '', container);
        L.DomEvent.disableClickPropagation(container);
        this.permissions.addOwnerLink('span', container);
        var about = L.DomUtil.add('a', 'umap-about-link', container, ' — ' + L._('About'));
        about.href = '#';
        L.DomEvent.on(about, 'click', this.displayCaption, this);
        var browser = L.DomUtil.add('a', 'umap-open-browser-link', container, ' | ' + L._('Browse data'));
        browser.href = '#';
        L.DomEvent.on(browser, 'click', L.DomEvent.stop)
                  .on(browser, 'click', this.openBrowser, this);
        var setName = function () {
            name.textContent = this.getDisplayName();
        };
        L.bind(setName, this)();
        this.on('postsync', L.bind(setName, this));
        this.onceDatalayersLoaded(function () {
            this.slideshow.renderToolbox(container);
        });
    },

    initEditBar: function () {
        var container = L.DomUtil.create('div', 'umap-main-edit-toolbox with-transition dark', this._controlContainer),
            title = L.DomUtil.add('h3', '', container, L._('Editing') + '&nbsp;'),
            name = L.DomUtil.create('a', 'umap-click-to-edit', title),
            setName = function () {
                name.textContent = this.getDisplayName();
            };
        L.bind(setName, this)();
        L.DomEvent.on(name, 'click', this.edit, this);
        this.on('postsync', L.bind(setName, this));
        this.help.button(title, 'edit');
        var save = L.DomUtil.create('a', 'leaflet-control-edit-save button', container);
        save.href = '#';
        save.title = L._('Save current edits') + ' (Ctrl+S)';
        save.textContent = L._('Save');
        var cancel = L.DomUtil.create('a', 'leaflet-control-edit-cancel button', container);
        cancel.href = '#';
        cancel.title = L._('Cancel edits');
        cancel.textContent = L._('Cancel');
        var disable = L.DomUtil.create('a', 'leaflet-control-edit-disable', container);
        disable.href = '#';
        disable.title = disable.textContent = L._('Disable editing');


        L.DomEvent
            .addListener(disable, 'click', L.DomEvent.stop)
            .addListener(disable, 'click', function (e) {
                this.disableEdit(e);
                this.ui.closePanel();
            }, this);

        L.DomEvent
            .addListener(save, 'click', L.DomEvent.stop)
            .addListener(save, 'click', this.save, this);

        L.DomEvent
            .addListener(cancel, 'click', L.DomEvent.stop)
            .addListener(cancel, 'click', this.askForReset, this);
    },

    askForReset: function (e) {
        if (!confirm(L._('Are you sure you want to cancel your changes?'))) return;
        this.reset();
        this.disableEdit(e);
        this.ui.closePanel();
    },

    startMarker: function () {
        return this.editTools.startMarker();
    },

    startPolyline: function () {
        return this.editTools.startPolyline();
    },

    startPolygon: function () {
        return this.editTools.startPolygon();
    },

    del: function () {
        if (confirm(L._('Are you sure you want to delete this map?'))) {
            var url = L.Util.template(this.options.urls.map_delete, {'map_id': this.options.umap_id});
            this.post(url);
        }
    },

    clone: function () {
        if (confirm(L._('Are you sure you want to clone this map and all its datalayers?'))) {
            var url = L.Util.template(this.options.urls.map_clone, {'map_id': this.options.umap_id});
            this.post(url);
        }
    },

    empty: function () {
        this.eachDataLayerReverse(function (datalayer) {
            datalayer._delete();
        });
    },

    initLoader: function () {
        this.loader = new L.Control.Loading();
        this.loader.onAdd(this);
    },

    post: function (url, options) {
        options = options || {};
        options.listener = this;
        this.xhr.post(url, options);
    },

    get: function (url, options) {
        options = options || {};
        options.listener = this;
        this.xhr.get(url, options);
    },

    ajax: function (options) {
        options.listener = this;
        this.xhr._ajax(options);
    },

    initContextMenu: function () {
        this.contextmenu = new L.U.ContextMenu(this);
        this.contextmenu.enable();
    },

    setContextMenuItems: function (e) {
        var items = [];
        if (this._zoom !== this.getMaxZoom()) {
            items.push({
                text: L._('Zoom in'),
                callback: function () {this.zoomIn();}
            });
        }
        if (this._zoom !== this.getMinZoom()) {
            items.push({
                text: L._('Zoom out'),
                callback: function () {this.zoomOut();}
            });
        }
        if (e && e.relatedTarget) {
            if (e.relatedTarget.getContextMenuItems) {
                items = items.concat(e.relatedTarget.getContextMenuItems(e));
            }
        }
        if (this.options.allowEdit) {
            items.push('-');
            if (this.editEnabled) {
                if (!this.isDirty) {
                    items.push({
                        text: L._('Stop editing') + ' (Ctrl+E)',
                        callback: this.disableEdit
                    });
                }
                if (this.options.enableMarkerDraw) {
                    items.push(
                        {
                            text: L._('Draw a marker') + ' (Ctrl+M)',
                            callback: this.startMarker,
                            context: this
                        });
                }
                if (this.options.enablePolylineDraw) {
                    items.push(
                        {
                            text: L._('Draw a polygon') + ' (Ctrl+P)',
                            callback: this.startPolygon,
                            context: this
                        });
                }
                if (this.options.enablePolygonDraw) {
                    items.push(
                      {
                           text: L._('Draw a line') + ' (Ctrl+L)',
                           callback: this.startPolyline,
                           context: this
                       });
                }
                items.push('-');
                items.push({
                    text: L._('Help'),
                    callback: function () { this.help.show('edit');}
                });
            } else {
                items.push({
                    text: L._('Start editing') + ' (Ctrl+E)',
                    callback: this.enableEdit
                });
            }
        }
        items.push('-',
            {
                text: L._('Browse data'),
                callback: this.openBrowser
            },
            {
                text: L._('About'),
                callback: this.displayCaption
            },
            {
                text: L._('Search location'),
                callback: this.search
            }
        );
        if (this.options.urls.routing) {
            items.push('-',
                {
                    text: L._('Directions from here'),
                    callback: this.openExternalRouting
                }
            );
        }
        this.options.contextmenuItems = items;
    },

    openExternalRouting: function (e) {
        var url = this.options.urls.routing;
        if (url) {
            var params = {
                lat: e.latlng.lat,
                lng: e.latlng.lng,
                locale: L.locale,
                zoom: this.getZoom()
            };
            window.open(L.Util.template(url, params));
        }
        return;
    },

    getMap: function () {
        return this;
    },

    getGeoContext: function () {
        var context = {
                bbox: this.getBounds().toBBoxString(),
                north: this.getBounds().getNorthEast().lat,
                east: this.getBounds().getNorthEast().lng,
                south: this.getBounds().getSouthWest().lat,
                west: this.getBounds().getSouthWest().lng,
                lat: this.getCenter().lat,
                lng: this.getCenter().lng,
                zoom: this.getZoom()
            };
        context.left = context.west;
        context.bottom = context.south;
        context.right = context.east;
        context.top = context.north;
        return context;
    },

    localizeUrl: function (url) {
        return L.Util.greedyTemplate(url, this.getGeoContext(), true);
    },

    proxyUrl: function (url, ttl) {
        if (this.options.urls.ajax_proxy) {
            url = L.Util.greedyTemplate(this.options.urls.ajax_proxy, {url: encodeURIComponent(url), ttl: ttl});
        }
        return url;
    },

    closeInplaceToolbar: function () {
        var toolbar = this._toolbars[L.Toolbar.Popup._toolbar_class_id];
        if (toolbar) toolbar.remove();
    },

    search: function () {
        if (this._controls.search) this._controls.search.openPanel(this);
    },

    getFilterKeys: function () {
        return (this.options.filterKey || this.options.sortKey || 'name').split(',');
    }

});
