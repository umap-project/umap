L.U.Layer = {
    canBrowse: true,

    getFeatures: function () {
        return this._layers;
    },

    getEditableOptions: function () {return [];},

    postUpdate: function () {}

};

L.U.Layer.Default = L.FeatureGroup.extend({
    _type: 'Default',
    includes: [L.U.Layer],

    initialize: function (datalayer) {
        this.datalayer = datalayer;
        L.FeatureGroup.prototype.initialize.call(this);
    }

});


L.U.MarkerCluster = L.MarkerCluster.extend({
// Custom class so we can call computeTextColor
// when element is already on the DOM.

    _initIcon: function () {
        L.MarkerCluster.prototype._initIcon.call(this);
        var div = this._icon.querySelector('div');
        // Compute text color only when icon is added to the DOM.
        div.style.color = this._iconObj.computeTextColor(div);
    }

});

L.U.Layer.Cluster = L.MarkerClusterGroup.extend({
    _type: 'Cluster',
    includes: [L.U.Layer],

    initialize: function (datalayer) {
        this.datalayer = datalayer;
        var options = {
            polygonOptions: {
                color: this.datalayer.getColor()
            },
            iconCreateFunction: function (cluster) {
                return new L.U.Icon.Cluster(datalayer, cluster);
            }
        };
        if (this.datalayer.options.cluster && this.datalayer.options.cluster.radius) {
            options.maxClusterRadius = this.datalayer.options.cluster.radius;
        }
        L.MarkerClusterGroup.prototype.initialize.call(this, options);
        this._markerCluster = L.U.MarkerCluster;
    },

    getEditableOptions: function () {
        if (!L.Util.isObject(this.datalayer.options.cluster)) {
            this.datalayer.options.cluster = {};
        }
        return [
            ['options.cluster.radius', {handler: 'BlurIntInput', placeholder: L._('Clustering radius'), helpText: L._('Override clustering radius (default 80)')}],
            ['options.cluster.textColor', {handler: 'TextColorPicker', placeholder: L._('Auto'), helpText: L._('Text color for the cluster label')}],
        ];

    },

    postUpdate: function (e) {
        if (e.helper.field === 'options.cluster.radius') {
            // No way to reset radius of an already instanciated MarkerClusterGroup...
            this.datalayer.resetLayer(true);
            return;
        }
        if (e.helper.field === 'options.color') {
            this.options.polygonOptions.color = this.datalayer.getColor();
        }
    }

});

L.U.Layer.Heat = L.HeatLayer.extend({
    _type: 'Heat',
    includes: [L.U.Layer],
    canBrowse: false,

    initialize: function (datalayer) {
        this.datalayer = datalayer;
        L.HeatLayer.prototype.initialize.call(this, [], this.datalayer.options.heat);
    },

    addLayer: function (layer) {
        if (layer instanceof L.Marker) {
            var latlng = layer.getLatLng(), alt;
            if (this.datalayer.options.heat && this.datalayer.options.heat.intensityProperty) {
                alt = parseFloat(layer.properties[this.datalayer.options.heat.intensityProperty || 0]);
                latlng = new L.LatLng(latlng.lat, latlng.lng, alt);
            }
            this.addLatLng(latlng);
        }
    },

    clearLayers: function () {
        this.setLatLngs([]);
    },

    redraw: function () {
        // setlalngs call _redraw through setAnimFrame, thus async, so this
        // can ends with race condition if we remove the layer very faslty after.
        // Remove me when https://github.com/Leaflet/Leaflet.heat/pull/53 is released.
        if (!this._map) return;
        L.HeatLayer.prototype.redraw.call(this);
    },

    getFeatures: function () {
        return {};
    },

    getBounds: function () {
        return L.latLngBounds(this._latlngs);
    },

    getEditableOptions: function () {
        if (!L.Util.isObject(this.datalayer.options.heat)) {
            this.datalayer.options.heat = {};
        }
        return [
            ['options.heat.radius', {handler: 'BlurIntInput', placeholder: L._('Heatmap radius'), helpText: L._('Override heatmap radius (default 25)')}],
            ['options.heat.intensityProperty', {handler: 'BlurInput', placeholder: L._('Heatmap intensity property'), helpText: L._('Optional intensity property for heatmap')}]
        ];

    },

    postUpdate: function (e) {
        if (e.helper.field === 'options.heat.intensityProperty') {
            this.datalayer.resetLayer(true);  // We need to repopulate the latlngs
            return;
        }
        if (e.helper.field === 'options.heat.radius') {
            this.options.radius = this.datalayer.options.heat.radius;
        }
        this._updateOptions();
    }

});

L.U.DataLayer = L.Evented.extend({

    options: {
        displayOnLoad: true,
        browsable: true
    },

    initialize: function (map, data) {
        this.map = map;
        this._index = Array();
        this._layers = {};
        this._geojson = null;
        this._propertiesIndex = [];

        this.parentPane = this.map.getPane('overlayPane');
        this.pane = this.map.createPane('datalayer' + L.stamp(this), this.parentPane);
        this.pane.dataset.id = L.stamp(this);
        this.renderer = L.svg({pane: this.pane});

        var isDirty = false,
            isDeleted = false,
            self = this;
        try {
            Object.defineProperty(this, 'isDirty', {
                get: function () {
                    return isDirty;
                },
                set: function (status) {
                    if (!isDirty && status) self.fire('dirty');
                    isDirty = status;
                    if (status) {
                        self.map.addDirtyDatalayer(self);
                        // A layer can be made dirty by indirect action (like dragging layers)
                        // we need to have it loaded before saving it.
                        if (!self.isLoaded()) self.fetchData();
                    } else {
                        self.map.removeDirtyDatalayer(self);
                        self.isDeleted = false;
                    }
                }
            });
        }
        catch (e) {
            // Certainly IE8, which has a limited version of defineProperty
        }
        try {
            Object.defineProperty(this, 'isDeleted', {
                get: function () {
                    return isDeleted;
                },
                set: function (status) {
                    if (!isDeleted && status) self.fire('deleted');
                    isDeleted = status;
                    if (status) self.isDirty = status;
                }
            });
        }
        catch (e) {
            // Certainly IE8, which has a limited version of defineProperty
        }
        this.setUmapId(data.id);
        this.setOptions(data);
        this.backupOptions();
        this.connectToMap();
        if (this.displayedOnLoad()) this.show();
        if (!this.umap_id) this.isDirty = true;
        this.onceLoaded(function () {
            this.map.on('moveend', this.fetchRemoteData, this);
        });
    },

    displayedOnLoad: function () {
        return ((this.map.datalayersOnLoad && this.umap_id && this.map.datalayersOnLoad.indexOf(this.umap_id.toString()) !== -1) ||
            (!this.map.datalayersOnLoad && this.options.displayOnLoad));
    },

    insertBefore: function (other) {
        if (!other) return;
        this.parentPane.insertBefore(this.pane, other.pane);
    },

    insertAfter: function (other) {
        if (!other) return;
        this.parentPane.insertBefore(this.pane, other.pane.nextSibling);
    },

    bringToTop: function () {
        this.parentPane.appendChild(this.pane);
    },

    resetLayer: function (force) {
        if (this.layer && this.options.type === this.layer._type && !force) return;
        var visible = this.isVisible();
        if (this.layer) this.layer.clearLayers();
        // delete this.layer?
        if (visible) this.map.removeLayer(this.layer);
        var Class = L.U.Layer[this.options.type] || L.U.Layer.Default;
        this.layer = new Class(this);
        var filterKeys = this.map.getFilterKeys(),
            filter = this.map.options.filter;
        this.eachLayer(function (layer) {
            if (filter && !layer.matchFilter(filter, filterKeys)) return;
            this.layer.addLayer(layer);
        });
        if (visible) this.map.addLayer(this.layer);
        this.propagateRemote();
    },

    eachLayer: function (method, context) {
        for (var i in this._layers) {
            method.call(context || this, this._layers[i]);
        }
        return this;
    },

    eachFeature: function (method, context) {
        if (this.layer && this.layer.canBrowse) {
            for (var i = 0; i < this._index.length; i++) {
                method.call(context || this, this._layers[this._index[i]]);
            }
        }
        return this;
    },

    fetchData: function () {
        if (!this.umap_id) return;
        this.map.get(this._dataUrl(), {
            callback: function (geojson, response) {
                this._etag = response.getResponseHeader('ETag');
                this.fromUmapGeoJSON(geojson);
                this.backupOptions();
                this.fire('loaded');
            },
            context: this
        });
    },

    fromGeoJSON: function (geojson) {
        this.addData(geojson);
        this._geojson = geojson;
        this.fire('dataloaded');
        this.fire('datachanged');
    },

    fromUmapGeoJSON: function (geojson) {
        if (geojson._storage) geojson._umap_options = geojson._storage;  // Retrocompat
        if (geojson._umap_options) this.setOptions(geojson._umap_options);
        if (this.isRemoteLayer()) this.fetchRemoteData();
        else this.fromGeoJSON(geojson);
        this._loaded = true;
    },

    clear: function () {
        this.layer.clearLayers();
        this._layers = {};
        this._index = Array();
        if (this._geojson) {
            this.backupData();
            this._geojson = null;
        }
    },

    backupData: function () {
        this._geojson_bk = L.Util.CopyJSON(this._geojson);
    },

    reindex: function () {
        var features = [];
        this.eachFeature(function (feature) {
            features.push(feature);
        });
        L.Util.sortFeatures(features, this.map.getOption('sortKey'));
        this._index = [];
        for (var i = 0; i < features.length; i++) {
            this._index.push(L.Util.stamp(features[i]));
        }
    },

    fetchRemoteData: function () {
        if (!this.isRemoteLayer()) return;
        var from = parseInt(this.options.remoteData.from, 10),
            to = parseInt(this.options.remoteData.to, 10);
        if ((!isNaN(from) && this.map.getZoom() < from) ||
            (!isNaN(to) && this.map.getZoom() > to) ) {
            this.clear();
            return;
        }
        if (!this.options.remoteData.dynamic && this.hasDataLoaded()) return;
        if (!this.isVisible()) return;
        var self = this,
            url = this.map.localizeUrl(this.options.remoteData.url);
        if (this.options.remoteData.proxy) url = this.map.proxyUrl(url, this.options.remoteData.ttl);
        this.map.ajax({
            uri: url,
            verb: 'GET',
            callback: function (raw) {
                self.clear();
                self.rawToGeoJSON(raw, self.options.remoteData.format, function (geojson) {self.fromGeoJSON(geojson);});
            }
        });
    },

    onceLoaded: function (callback, context) {
        if (this.isLoaded()) callback.call(context || this, this);
        else this.once('loaded', callback, context);
        return this;
    },

    onceDataLoaded: function (callback, context) {
        if (this.hasDataLoaded()) callback.call(context || this, this);
        else this.once('dataloaded', callback, context);
        return this;
    },

    isLoaded: function () {
        return !this.umap_id || this._loaded;
    },

    hasDataLoaded: function () {
        return !this.umap_id || this._geojson !== null;
    },

    setUmapId: function (id) {
        // Datalayer is null when listening creation form
        if (!this.umap_id && id) this.umap_id = id;
    },

    backupOptions: function () {
        this._backupOptions = L.Util.CopyJSON(this.options);
    },

    resetOptions: function () {
        this.options = L.Util.CopyJSON(this._backupOptions);
    },

    setOptions: function (options) {
        this.options = L.Util.CopyJSON(L.U.DataLayer.prototype.options);  // Start from fresh.
        this.updateOptions(options);
    },

    updateOptions: function (options) {
        L.Util.setOptions(this, options);
        this.resetLayer();
    },

    connectToMap: function () {
        var id = L.stamp(this);
        if (!this.map.datalayers[id]) {
            this.map.datalayers[id] = this;
            if (L.Util.indexOf(this.map.datalayers_index, this) === -1) this.map.datalayers_index.push(this);
        }
        this.map.updateDatalayersControl();
    },

    _dataUrl: function() {
        var template = this.map.options.urls.datalayer_view;
        return L.Util.template(template, {'pk': this.umap_id, 'map_id': this.map.options.umap_id});
    },

    isRemoteLayer: function () {
        return !!(this.options.remoteData && this.options.remoteData.url && this.options.remoteData.format);
    },

    isClustered: function () {
        return this.options.type === 'Cluster';
    },

    addLayer: function (feature) {
        var id = L.stamp(feature);
        feature.connectToDataLayer(this);
        this._index.push(id);
        this._layers[id] = feature;
        this.layer.addLayer(feature);
        this.indexProperties(feature);
        if (this.hasDataLoaded()) this.fire('datachanged');
        this.map.features_index[feature.getSlug()] = feature;
    },

    removeLayer: function (feature) {
        var id = L.stamp(feature);
        feature.disconnectFromDataLayer(this);
        this._index.splice(this._index.indexOf(id), 1);
        delete this._layers[id];
        this.layer.removeLayer(feature);
        delete this.map.features_index[feature.getSlug()];
        if (this.hasDataLoaded()) this.fire('datachanged');
    },

    indexProperties: function (feature) {
        for (var i in feature.properties) if (typeof feature.properties[i] !== 'object') this.indexProperty(i);
    },

    indexProperty: function (name) {
        if (!name) return;
        if (name.indexOf('_') === 0) return;
        if (L.Util.indexOf(this._propertiesIndex, name) !== -1) return;
        this._propertiesIndex.push(name);
    },

    deindexProperty: function (name) {
        var idx = this._propertiesIndex.indexOf(name);
        if (idx !== -1) this._propertiesIndex.splice(idx, 1);
    },

    addData: function (geojson) {
        try {
            // Do not fail if remote data is somehow invalid,
            // otherwise the layer becomes uneditable.
            this.geojsonToFeatures(geojson);
        } catch (err) {
            console.log("Error with DataLayer", this.umap_id);
            console.error(err);
        }
    },

    addRawData: function (c, type) {
        var self = this;
        this.rawToGeoJSON(c, type, function (geojson) {
            self.addData(geojson);
        });
    },

    rawToGeoJSON: function (c, type, callback) {
        var self = this;
        var toDom = function (x) {
                return (new DOMParser()).parseFromString(x, 'text/xml');
            };

        // TODO add a duck typing guessType
        if (type === 'csv') {
            csv2geojson.csv2geojson(c, {
                delimiter: 'auto',
                includeLatLon: false
            }, function(err, result) {
                if (err) {
                    var message;
                    if (err.type === 'Error') {
                        message = err.message;
                    } else {
                        message = L._('{count} errors during import: {message}', {count: err.length, message: err[0].message});
                    }
                    self.map.ui.alert({content: message, level: 'error', duration: 10000});
                    console.log(err);
                }
                if (result && result.features.length) {
                    callback(result);
                }
            });
        } else if (type === 'gpx') {
            callback(toGeoJSON.gpx(toDom(c)));
        } else if (type === 'georss') {
            callback(GeoRSSToGeoJSON(toDom(c)));
        } else if (type === 'kml') {
            callback(toGeoJSON.kml(toDom(c)));
        } else if (type === 'osm') {
            var d;
            try {
                d = JSON.parse(c);
            } catch (e) {
                d = toDom(c);
            }
            callback(osmtogeojson(d, {flatProperties: true}));
        } else if (type === 'geojson') {
            try {
                var gj = JSON.parse(c);
                callback(gj);
            } catch(err) {
                self.map.ui.alert({content: 'Invalid JSON file: ' + err});
                return;
            }
        }
    },

    geojsonToFeatures: function (geojson) {
        if (!geojson) return;
        var features = geojson instanceof Array ? geojson : geojson.features,
            i, len, latlng, latlngs;

        if (features) {
            L.Util.sortFeatures(features, this.map.getOption('sortKey'));
            for (i = 0, len = features.length; i < len; i++) {
                this.geojsonToFeatures(features[i]);
            }
            return this;
        }

        var geometry = geojson.type === 'Feature' ? geojson.geometry : geojson;
        if (!geometry) return;  // null geometry is valid geojson.
        var coords = geometry.coordinates,
            layer, tmp;

        switch (geometry.type) {
            case 'Point':
                try {
                    latlng = L.GeoJSON.coordsToLatLng(coords);
                } catch (e) {
                    console.error('Invalid latlng object from', coords);
                    break;
                }
                layer = this._pointToLayer(geojson, latlng);
                break;

            case 'MultiLineString':
            case 'LineString':
                latlngs = L.GeoJSON.coordsToLatLngs(coords, geometry.type === 'LineString' ? 0 : 1);
                if (!latlngs.length) break;
                layer = this._lineToLayer(geojson, latlngs);
                break;

            case 'MultiPolygon':
            case 'Polygon':
                latlngs = L.GeoJSON.coordsToLatLngs(coords, geometry.type === 'Polygon' ? 1 : 2);
                layer = this._polygonToLayer(geojson, latlngs);
                break;
            case 'GeometryCollection':
                return this.geojsonToFeatures(geometry.geometries);

            default:
                this.map.ui.alert({content: L._('Skipping unknown geometry.type: {type}', {type: geometry.type || 'undefined'}), level: 'error'});
        }
        if (layer) {
            this.addLayer(layer);
            return layer;
        }
    },

    _pointToLayer: function(geojson, latlng) {
        return new L.U.Marker(
            this.map,
            latlng,
            {'geojson': geojson, 'datalayer': this}
        );
    },

    _lineToLayer: function(geojson, latlngs) {
        return new L.U.Polyline(
            this.map,
            latlngs,
            {'geojson': geojson, 'datalayer': this, color: null}
        );
    },

    _polygonToLayer: function(geojson, latlngs) {
        // Ensure no empty hole
        // for (var i = latlngs.length - 1; i > 0; i--) {
        //     if (!latlngs.slice()[i].length) latlngs.splice(i, 1);
        // }
        return new L.U.Polygon(
            this.map,
            latlngs,
            {'geojson': geojson, 'datalayer': this}
        );
    },

    importRaw: function (raw, type) {
        this.addRawData(raw, type);
        this.isDirty = true;
        this.zoomTo();
    },

    importFromFiles: function (files, type) {
        for (var i = 0, f; f = files[i]; i++) {
            this.importFromFile(f, type);
        }
    },

    importFromFile: function (f, type) {
        var reader = new FileReader(),
            self = this;
        type = type || L.Util.detectFileType(f);
        reader.readAsText(f);
        reader.onload = function (e) {
            self.importRaw(e.target.result, type);
        };
    },

    importFromUrl: function (url, type) {
        url = this.map.localizeUrl(url);
        var self = this;
        this.map.xhr._ajax({verb: 'GET', uri: url, callback: function (data) {
            self.importRaw(data, type);
        }});
    },

    getEditUrl: function() {
        return L.Util.template(this.map.options.urls.datalayer_update, {'map_id': this.map.options.umap_id, 'pk': this.umap_id});
    },

    getCreateUrl: function() {
        return L.Util.template(this.map.options.urls.datalayer_create, {'map_id': this.map.options.umap_id});
    },

    getSaveUrl: function () {
        return (this.umap_id && this.getEditUrl()) || this.getCreateUrl();
    },

    getColor: function () {
        return this.options.color || this.map.getOption('color');
    },

    getDeleteUrl: function () {
        return L.Util.template(this.map.options.urls.datalayer_delete, {'pk': this.umap_id, 'map_id': this.map.options.umap_id});

    },

    getVersionsUrl: function () {
        return L.Util.template(this.map.options.urls.datalayer_versions, {'pk': this.umap_id, 'map_id': this.map.options.umap_id});
    },

    getVersionUrl: function (name) {
        return L.Util.template(this.map.options.urls.datalayer_version, {'pk': this.umap_id, 'map_id': this.map.options.umap_id, name: name});
    },

    _delete: function () {
        this.isDeleted = true;
        this.erase();
    },

    empty: function () {
        if (this.isRemoteLayer()) return;
        this.clear();
        this.isDirty = true;
    },

    clone: function () {
        var options = L.Util.CopyJSON(this.options);
        options.name = L._('Clone of {name}', {name: this.options.name});
        delete options.id;
        var geojson = L.Util.CopyJSON(this._geojson),
            datalayer = this.map.createDataLayer(options);
        datalayer.fromGeoJSON(geojson);
        return datalayer;
    },

    erase: function () {
        this.hide();
        delete this.map.datalayers[L.stamp(this)];
        this.map.datalayers_index.splice(this.getRank(), 1);
        this.parentPane.removeChild(this.pane);
        this.map.updateDatalayersControl();
        this.fire('erase');
        this._leaflet_events_bk = this._leaflet_events;
        this.off();
        this.clear();
        delete this._loaded;
    },

    reset: function () {
        if (!this.umap_id) this.erase();

        this.resetOptions();
        this.parentPane.appendChild(this.pane);
        if (this._leaflet_events_bk && !this._leaflet_events) {
            this._leaflet_events = this._leaflet_events_bk;
        }
        this.clear();
        this.hide();
        if (this.isRemoteLayer()) this.fetchRemoteData();
        else if (this._geojson_bk) this.fromGeoJSON(this._geojson_bk);
        this._loaded = true;
        this.show();
        this.isDirty = false;
    },

    redraw: function () {
        this.hide();
        this.show();
    },

    edit: function () {
        if(!this.map.editEnabled || !this.isLoaded()) {return;}
        var container = L.DomUtil.create('div', 'umap-layer-properties-container'),
            metadataFields = [
                'options.name',
                'options.description',
                ['options.type', {handler: 'LayerTypeChooser', label: L._('Type of layer')}],
                ['options.displayOnLoad', {label: L._('Display on load'), handler: 'Switch'}],
                ['options.browsable', {label: L._('Data is browsable'), handler: 'Switch', helpEntries: 'browsable'}]
            ];
        var title = L.DomUtil.add('h3', '', container, L._('Layer properties'));
        var builder = new L.U.FormBuilder(this, metadataFields, {
            callback: function (e) {
                this.map.updateDatalayersControl();
                if (e.helper.field === 'options.type') {
                    this.resetLayer();
                    this.edit();
                }
            }
        });
        container.appendChild(builder.build());

        var shapeOptions = [
            'options.color',
            'options.iconClass',
            'options.iconUrl',
            'options.opacity',
            'options.stroke',
            'options.weight',
            'options.fill',
            'options.fillColor',
            'options.fillOpacity',
        ];

        shapeOptions = shapeOptions.concat(this.layer.getEditableOptions());

        var redrawCallback = function (field) {
            this.hide();
            this.layer.postUpdate(field);
            this.show();
        };

        builder = new L.U.FormBuilder(this, shapeOptions, {
            id: 'datalayer-advanced-properties',
            callback: redrawCallback
        });
        var shapeProperties = L.DomUtil.createFieldset(container, L._('Shape properties'));
        shapeProperties.appendChild(builder.build());

        var optionsFields = [
            'options.smoothFactor',
            'options.dashArray',
            'options.zoomTo',
            'options.labelKey'
        ];

        optionsFields = optionsFields.concat(this.layer.getEditableOptions());

        builder = new L.U.FormBuilder(this, optionsFields, {
            id: 'datalayer-advanced-properties',
            callback: redrawCallback
        });
        var advancedProperties = L.DomUtil.createFieldset(container, L._('Advanced properties'));
        advancedProperties.appendChild(builder.build());

        var popupFields = [
            'options.popupShape',
            'options.popupTemplate',
            'options.popupContentTemplate',
            'options.showLabel',
            'options.labelDirection',
            'options.labelInteractive',
        ];
        builder = new L.U.FormBuilder(this, popupFields, {callback: redrawCallback});
        var popupFieldset = L.DomUtil.createFieldset(container, L._('Interaction options'));
        popupFieldset.appendChild(builder.build());

        if (!L.Util.isObject(this.options.remoteData)) {
            this.options.remoteData = {};
        }
        var remoteDataFields = [
            ['options.remoteData.url', {handler: 'Url', label: L._('Url'), helpEntries: 'formatURL'}],
            ['options.remoteData.format', {handler: 'DataFormat', label: L._('Format')}],
            ['options.remoteData.from', {label: L._('From zoom'), helpText: L._('Optional.')}],
            ['options.remoteData.to', {label: L._('To zoom'), helpText: L._('Optional.')}],
            ['options.remoteData.dynamic', {handler: 'Switch', label: L._('Dynamic'), helpEntries: 'dynamicRemoteData'}],
            ['options.remoteData.licence', {label: L._('Licence'), helpText: L._('Please be sure the licence is compliant with your use.')}]
        ];
        if (this.map.options.urls.ajax_proxy) {
            remoteDataFields.push(['options.remoteData.proxy', {handler: 'Switch', label: L._('Proxy request'), helpEntries: 'proxyRemoteData'}]);
            remoteDataFields.push(['options.remoteData.ttl', {handler: 'ProxyTTLSelect', label: L._('Cache proxied request')}]);
        }

        var remoteDataContainer = L.DomUtil.createFieldset(container, L._('Remote data'));
        builder = new L.U.FormBuilder(this, remoteDataFields);
        remoteDataContainer.appendChild(builder.build());

        if (this.map.options.urls.datalayer_versions) this.buildVersionsFieldset(container);

        var advancedActions = L.DomUtil.createFieldset(container, L._('Advanced actions'));
        var advancedButtons = L.DomUtil.create('div', 'button-bar half', advancedActions);
        var deleteLink = L.DomUtil.create('a', 'button delete_datalayer_button umap-delete', advancedButtons);
        deleteLink.textContent = L._('Delete');
        deleteLink.href = '#';
        L.DomEvent.on(deleteLink, 'click', L.DomEvent.stop)
                  .on(deleteLink, 'click', function () {
                    this._delete();
                    this.map.ui.closePanel();
                }, this);
        if (!this.isRemoteLayer()) {
            var emptyLink = L.DomUtil.create('a', 'button umap-empty', advancedButtons);
            emptyLink.textContent = L._('Empty');
            emptyLink.href = '#';
            L.DomEvent.on(emptyLink, 'click', L.DomEvent.stop)
                      .on(emptyLink, 'click', this.empty, this);
        }
        var cloneLink = L.DomUtil.create('a', 'button umap-clone', advancedButtons);
        cloneLink.textContent = L._('Clone');
        cloneLink.href = '#';
        L.DomEvent.on(cloneLink, 'click', L.DomEvent.stop)
                  .on(cloneLink, 'click', function () {
                    var datalayer = this.clone();
                    datalayer.edit();
                }, this);
        if (this.umap_id) {
            var download = L.DomUtil.create('a', 'button umap-download', advancedButtons);
            download.textContent = L._('Download');
            download.href = this._dataUrl();
            download.target = '_blank';
        }
        this.map.ui.openPanel({data: {html: container}, className: 'dark'});

    },

    getOption: function (option) {
        if (L.Util.usableOption(this.options, option)) return this.options[option];
        else return this.map.getOption(option);
    },

    buildVersionsFieldset: function (container) {

        var appendVersion = function (data) {
            var date = new Date(parseInt(data.at, 10));
            var content = date.toLocaleDateString(L.locale) + ' (' + parseInt(data.size) / 1000 + 'Kb)';
            var el = L.DomUtil.create('div', 'umap-datalayer-version', versionsContainer);
            var a = L.DomUtil.create('a', '', el);
            L.DomUtil.add('span', '', el, content);
            a.href = '#';
            a.title = L._('Restore this version');
            L.DomEvent.on(a, 'click', L.DomEvent.stop)
                      .on(a, 'click', function () {
                        this.restore(data.name);
                      }, this);
        };

        var versionsContainer = L.DomUtil.createFieldset(container, L._('Versions'), {callback: function () {
            this.map.xhr.get(this.getVersionsUrl(), {
                callback: function (data) {
                    for (var i = 0; i < data.versions.length; i++) {
                        appendVersion.call(this, data.versions[i]);
                    };
                },
                context: this
            });
        }, context: this});
    },

    restore: function (version) {
        if (!this.map.editEnabled) return;
        if (!confirm(L._('Are you sure you want to restore this version?'))) return;
        this.map.xhr.get(this.getVersionUrl(version), {
            callback: function (geojson) {
                if (geojson._storage) geojson._umap_options = geojson._storage;  // Retrocompat.
                if (geojson._umap_options) this.setOptions(geojson._umap_options);
                this.empty();
                if (this.isRemoteLayer()) this.fetchRemoteData();
                else this.addData(geojson);
                this.isDirty = true;
            },
            context: this
        })
    },

    featuresToGeoJSON: function () {
        var features = [];
        this.eachLayer(function (layer) {
            features.push(layer.toGeoJSON());
        });
        return features;
    },

    show: function () {
        if(!this.isLoaded()) this.fetchData();
        this.map.addLayer(this.layer);
        this.fire('show');
    },

    hide: function () {
        this.map.removeLayer(this.layer);
        this.fire('hide');
    },

    toggle: function () {
        if (!this.isVisible()) this.show();
        else this.hide();
    },

    zoomTo: function () {
        if (!this.isVisible()) return;
        var bounds = this.layer.getBounds();
        if (bounds.isValid()) this.map.fitBounds(bounds);
    },

    allowBrowse: function () {
        return !!this.options.browsable && this.canBrowse() && this.isVisible();
    },

    hasData: function () {
        return !!this._index.length;
    },

    isVisible: function () {
        return this.map.hasLayer(this.layer);
    },

    canBrowse: function () {
        return this.layer && this.layer.canBrowse;
    },

    getFeatureByIndex: function (index) {
        if (index === -1) index = this._index.length - 1;
        var id = this._index[index];
        return this._layers[id];
    },

    getNextFeature: function (feature) {
        var id = this._index.indexOf(L.stamp(feature)),
            nextId = this._index[id + 1];
        return nextId? this._layers[nextId]: this.getNextBrowsable().getFeatureByIndex(0);
    },

    getPreviousFeature: function (feature) {
        if (this._index <= 1) { return null; }
        var id = this._index.indexOf(L.stamp(feature)),
            previousId = this._index[id - 1];
        return previousId? this._layers[previousId]: this.getPreviousBrowsable().getFeatureByIndex(-1);
    },

    getPreviousBrowsable: function () {
        var id = this.getRank(), next, index = this.map.datalayers_index;
        while(id = index[++id] ? id : 0, next = index[id]) {
            if (next === this || (next.allowBrowse() && next.hasData())) break;
        }
        return next;
    },

    getNextBrowsable: function () {
        var id = this.getRank(), prev, index = this.map.datalayers_index;
        while(id = index[--id] ? id : index.length - 1, prev = index[id]) {
            if (prev === this || (prev.allowBrowse() && prev.hasData())) break;
        }
        return prev;
    },

    umapGeoJSON: function () {
        return {
            type: 'FeatureCollection',
            features: this.isRemoteLayer() ? [] : this.featuresToGeoJSON(),
            _umap_options: this.options
        };
    },

    metadata: function () {
        return {
            id: this.umap_id,
            name: this.options.name,
            displayOnLoad: this.options.displayOnLoad
        }
    },

    getRank: function () {
        return this.map.datalayers_index.indexOf(this);
    },

    save: function () {
        if (this.isDeleted) return this.saveDelete();
        if (!this.isLoaded()) {return;}
        var geojson = this.umapGeoJSON();
        var formData = new FormData();
        formData.append('name', this.options.name);
        formData.append('display_on_load', !!this.options.displayOnLoad);
        formData.append('rank', this.getRank());
        // Filename support is shaky, don't do it for now.
        var blob = new Blob([JSON.stringify(geojson)], {type: 'application/json'});
        formData.append('geojson', blob);
        this.map.post(this.getSaveUrl(), {
            data: formData,
            callback: function (data, response) {
                this._geojson = geojson;
                this._etag = response.getResponseHeader('ETag');
                this.setUmapId(data.id);
                this.updateOptions(data);
                this.backupOptions();
                this.connectToMap();
                this._loaded = true;
                this.redraw();  // Needed for reordering features
                this.isDirty = false;
                this.map.continueSaving();
            },
            context: this,
            headers: {'If-Match': this._etag || ''}
        });
    },

    saveDelete: function () {
        var callback = function () {
            this.isDirty = false;
            this.map.continueSaving();
        }
        if (!this.umap_id) return callback.call(this);
        this.map.xhr.post(this.getDeleteUrl(), {
            callback: callback,
            context: this
        });
    },

    getMap: function () {
        return this.map;
    },

    getName: function () {
        return this.options.name || L._('Untitled layer');
    },

    tableEdit: function () {
        if (this.isRemoteLayer() || !this.isVisible()) return;
        var editor = new L.U.TableEditor(this);
        editor.edit();
    }

});

L.TileLayer.include({

    toJSON: function () {
        return {
            minZoom: this.options.minZoom,
            maxZoom: this.options.maxZoom,
            attribution: this.options.attribution,
            url_template: this._url,
            name: this.options.name,
            tms: this.options.tms
        };
    },

    getAttribution: function () {
        return L.Util.toHTML(this.options.attribution);
    }

});
