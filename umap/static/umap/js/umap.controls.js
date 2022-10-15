L.U.BaseAction = L.ToolbarAction.extend({

    initialize: function (map) {
        this.map = map;
        this.options.toolbarIcon = {
            className: this.options.className,
            tooltip: this.options.tooltip
        };
        L.ToolbarAction.prototype.initialize.call(this);
        if (this.options.helpMenu && !this.map.helpMenuActions[this.options.className]) this.map.helpMenuActions[this.options.className] = this;
    }

});

L.U.ImportAction = L.U.BaseAction.extend({

    options: {
        helpMenu: true,
        className: 'upload-data dark',
        tooltip: L._('Import data') + ' (Ctrl+I)'
    },

    addHooks: function () {
        this.map.importPanel();
    }

});

L.U.EditPropertiesAction = L.U.BaseAction.extend({

    options: {
        helpMenu: true,
        className: 'update-map-settings dark',
        tooltip: L._('Edit map settings')
    },

    addHooks: function () {
        this.map.edit();
    }

});

L.U.ChangeTileLayerAction = L.U.BaseAction.extend({

    options: {
        helpMenu: true,
        className: 'dark update-map-tilelayers',
        tooltip: L._('Change tilelayers')
    },

    addHooks: function () {
        this.map.updateTileLayers();
    }

});

L.U.ManageDatalayersAction = L.U.BaseAction.extend({

    options: {
        className: 'dark manage-datalayers',
        tooltip: L._('Manage layers')
    },

    addHooks: function () {
        this.map.manageDatalayers();
    }

});

L.U.UpdateExtentAction = L.U.BaseAction.extend({

    options: {
        className: 'update-map-extent dark',
        tooltip: L._('Save this center and zoom')
    },

    addHooks: function () {
        this.map.updateExtent();
    }

});

L.U.UpdatePermsAction = L.U.BaseAction.extend({

    options: {
        className: 'update-map-permissions dark',
        tooltip: L._('Update permissions and editors')
    },

    addHooks: function () {
        this.map.permissions.edit();
    }

});

L.U.DrawMarkerAction = L.U.BaseAction.extend({

    options: {
        helpMenu: true,
        className: 'umap-draw-marker dark',
        tooltip: L._('Draw a marker')
    },

    addHooks: function () {
        this.map.startMarker();
    }

});

L.U.DrawPolylineAction = L.U.BaseAction.extend({

    options: {
        helpMenu: true,
        className: 'umap-draw-polyline dark',
        tooltip: L._('Draw a polyline')
    },

    addHooks: function () {
        this.map.startPolyline();
    }

});

L.U.DrawPolygonAction = L.U.BaseAction.extend({

    options: {
        helpMenu: true,
        className: 'umap-draw-polygon dark',
        tooltip: L._('Draw a polygon')
    },

    addHooks: function () {
        this.map.startPolygon();
    }

});

L.U.AddPolylineShapeAction = L.U.BaseAction.extend({

    options: {
        className: 'umap-draw-polyline-multi dark',
        tooltip: L._('Add a line to the current multi')
    },

    addHooks: function () {
        this.map.editedFeature.editor.newShape();
    }

});

L.U.AddPolygonShapeAction = L.U.AddPolylineShapeAction.extend({

    options: {
        className: 'umap-draw-polygon-multi dark',
        tooltip: L._('Add a polygon to the current multi')
    }

});

L.U.BaseFeatureAction = L.ToolbarAction.extend({

    initialize: function (map, feature, latlng) {
        this.map = map;
        this.feature = feature;
        this.latlng = latlng;
        L.ToolbarAction.prototype.initialize.call(this);
        this.postInit();
    },

    postInit: function () {},

    hideToolbar: function () {
        this.map.removeLayer(this.toolbar);
    },

    addHooks: function () {
        this.onClick({latlng: this.latlng});
        this.hideToolbar();
    }

});

L.U.CreateHoleAction = L.U.BaseFeatureAction.extend({

    options: {
        toolbarIcon: {
            className: 'umap-new-hole',
            tooltip: L._('Start a hole here')
        }
    },

    onClick: function (e) {
        this.feature.startHole(e);
    }

});

L.U.ToggleEditAction = L.U.BaseFeatureAction.extend({

    options: {
        toolbarIcon: {
            className: 'umap-toggle-edit',
            tooltip: L._('Toggle edit mode (Shift+Click)')
        }
    },

    onClick: function (e) {
        if (this.feature._toggleEditing) this.feature._toggleEditing(e);  // Path
        else this.feature.edit(e);  // Marker
    }

});

L.U.DeleteFeatureAction = L.U.BaseFeatureAction.extend({

    options: {
        toolbarIcon: {
            className: 'umap-delete-all',
            tooltip: L._('Delete this feature')
        }
    },

    postInit: function () {
        if (!this.feature.isMulti()) this.options.toolbarIcon.className = 'umap-delete-one-of-one';
    },

    onClick: function (e) {
        this.feature.confirmDelete(e);
    }

});

L.U.DeleteShapeAction = L.U.BaseFeatureAction.extend({

    options: {
        toolbarIcon: {
            className: 'umap-delete-one-of-multi',
            tooltip: L._('Delete this shape')
        }
    },

    onClick: function (e) {
        this.feature.enableEdit().deleteShapeAt(e.latlng);
    }

});

L.U.ExtractShapeFromMultiAction = L.U.BaseFeatureAction.extend({

    options: {
        toolbarIcon: {
            className: 'umap-extract-shape-from-multi',
            tooltip: L._('Extract shape to separate feature')
        }
    },

    onClick: function (e) {
        this.feature.isolateShape(e.latlng);
    }

});

L.U.BaseVertexAction = L.U.BaseFeatureAction.extend({

    initialize: function (map, feature, latlng, vertex) {
        this.vertex = vertex;
        L.U.BaseFeatureAction.prototype.initialize.call(this, map, feature, latlng);
    }

});

L.U.DeleteVertexAction = L.U.BaseVertexAction.extend({

    options: {
        toolbarIcon: {
            className: 'umap-delete-vertex',
            tooltip: L._('Delete this vertex (Alt+Click)')
        }
    },

    onClick: function () {
        this.vertex.delete();
    }

});

L.U.SplitLineAction = L.U.BaseVertexAction.extend({

    options: {
        toolbarIcon: {
            className: 'umap-split-line',
            tooltip: L._('Split line')
        }
    },

    onClick: function () {
        this.vertex.split();
    }

});

L.U.ContinueLineAction = L.U.BaseVertexAction.extend({

    options: {
        toolbarIcon: {
            className: 'umap-continue-line',
            tooltip: L._('Continue line')
        }
    },

    onClick: function () {
        this.vertex.continue();
    }

});

// Leaflet.Toolbar doesn't allow twice same toolbar class…
L.U.SettingsToolbar = L.Toolbar.Control.extend({});
L.U.DrawToolbar = L.Toolbar.Control.extend({

    initialize: function (options) {
        L.Toolbar.Control.prototype.initialize.call(this, options);
        this.map = this.options.map;
        this.map.on('seteditedfeature', this.redraw, this);
    },

    appendToContainer: function (container) {
        this.options.actions = [];
        if (this.map.options.enableMarkerDraw) {
            this.options.actions.push(L.U.DrawMarkerAction);
        }
        if (this.map.options.enablePolylineDraw) {
            this.options.actions.push(L.U.DrawPolylineAction);
            if (this.map.editedFeature && this.map.editedFeature instanceof L.U.Polyline) {
                this.options.actions.push(L.U.AddPolylineShapeAction);
            }
        }
        if (this.map.options.enablePolygonDraw) {
            this.options.actions.push(L.U.DrawPolygonAction);
            if (this.map.editedFeature && this.map.editedFeature instanceof L.U.Polygon) {
                this.options.actions.push(L.U.AddPolygonShapeAction);
            }
        }
        L.Toolbar.Control.prototype.appendToContainer.call(this, container);
    },

    redraw: function () {
        var container = this._control.getContainer();
        container.innerHTML = '';
        this.appendToContainer(container);
    }

});


L.U.EditControl = L.Control.extend({

    options: {
        position: 'topright'
    },

    onAdd: function (map) {
        var container = L.DomUtil.create('div', 'leaflet-control-edit-enable umap-control'),
            edit = L.DomUtil.create('a', '', container);
        edit.href = '#';
        edit.title = L._('Enable editing') + ' (Ctrl+E)';

        L.DomEvent
            .addListener(edit, 'click', L.DomEvent.stop)
            .addListener(edit, 'click', map.enableEdit, map);
        return container;
    }

});

/* Share control */
L.Control.Embed = L.Control.extend({

    options: {
        position: 'topleft'
    },

    onAdd: function (map) {
        var container = L.DomUtil.create('div', 'leaflet-control-embed umap-control');

        var link = L.DomUtil.create('a', '', container);
        link.href = '#';
        link.title = L._('Embed and share this map');

        L.DomEvent
            .on(link, 'click', L.DomEvent.stop)
            .on(link, 'click', map.renderShareBox, map)
            .on(link, 'dblclick', L.DomEvent.stopPropagation);

        return container;
    }
});

L.U.MoreControls = L.Control.extend({

    options: {
        position: 'topleft'
    },

    onAdd: function () {
        var container = L.DomUtil.create('div', ''),
            more = L.DomUtil.create('a', 'umap-control-more umap-control-text', container),
            less = L.DomUtil.create('a', 'umap-control-less umap-control-text', container);
        more.href = '#';
        more.title = L._('More controls');

        L.DomEvent
            .on(more, 'click', L.DomEvent.stop)
            .on(more, 'click', this.toggle, this);

        less.href = '#';
        less.title = L._('Hide controls');

        L.DomEvent
            .on(less, 'click', L.DomEvent.stop)
            .on(less, 'click', this.toggle, this);

        return container;
    },

    toggle: function () {
        var pos = this.getPosition(),
            corner = this._map._controlCorners[pos],
            className = 'umap-more-controls';
        if (L.DomUtil.hasClass(corner, className)) L.DomUtil.removeClass(corner, className);
        else L.DomUtil.addClass(corner, className);
    }

});


L.U.DataLayersControl = L.Control.extend({

    options: {
        position: 'topleft'
    },

    labels: {
        zoomToLayer: L._('Zoom to layer extent'),
        toggleLayer: L._('Show/hide layer'),
        editLayer: L._('Edit')
    },

    initialize: function (map, options) {
        this.map = map;
        L.Control.prototype.initialize.call(this, options);
    },

    _initLayout: function (map) {
        var container = this._container = L.DomUtil.create('div', 'leaflet-control-browse umap-control'),
            actions = L.DomUtil.create('div', 'umap-browse-actions', container);
        this._datalayers_container = L.DomUtil.create('ul', 'umap-browse-datalayers', actions);

        var link = L.DomUtil.create('a', 'umap-browse-link', actions);
        link.href = '#';
        link.title = link.textContent = L._('Browse data');

        var toggle = L.DomUtil.create('a', 'umap-browse-toggle', container);
        toggle.href = '#';
        toggle.title = L._('See data layers')

        L.DomEvent
            .on(toggle, 'click', L.DomEvent.stop);

        L.DomEvent
            .on(link, 'click', L.DomEvent.stop)
            .on(link, 'click', map.openBrowser, map);

        map.whenReady(function () {
            this.update();
        }, this);

        if (L.Browser.pointer) {
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.on(container, 'mousewheel', L.DomEvent.stopPropagation);
            L.DomEvent.on(container, 'MozMousePixelScroll', L.DomEvent.stopPropagation);
        }
        if (!L.Browser.touch) {
            L.DomEvent.on(container, {
                mouseenter: this.expand,
                mouseleave: this.collapse
            }, this);
        } else {
            L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
            L.DomEvent.on(toggle, 'click', L.DomEvent.stop)
                      .on(toggle, 'click', this.expand, this);
            map.on('click', this.collapse, this);
        }

        return container;
    },

    onAdd: function (map) {
        if (!this._container) this._initLayout(map);
        if (map.options.datalayersControl === 'expanded') this.expand();
        return this._container;
    },

    onRemove: function (map) {
        this.collapse();
    },

    update: function () {
        if (this._datalayers_container && this._map) {
            this._datalayers_container.innerHTML = '';
            this._map.eachDataLayerReverse(function (datalayer) {
                this.addDataLayer(this._datalayers_container, datalayer);
            }, this)
        }
    },

    expand: function () {
        L.DomUtil.addClass(this._container, 'expanded');
    },

    collapse: function () {
        if (this._map.options.datalayersControl === 'expanded') return;
        L.DomUtil.removeClass(this._container, 'expanded');
    },

    addDataLayer: function (container, datalayer, draggable) {
        var datalayerLi = L.DomUtil.create('li', '', container);
        if (draggable) L.DomUtil.element('i', {className: 'drag-handle', title: L._('Drag to reorder')}, datalayerLi);
        datalayer.renderToolbox(datalayerLi);
        var title = L.DomUtil.add('span', 'layer-title', datalayerLi, datalayer.options.name);

        datalayerLi.id = 'browse_data_toggle_' + L.stamp(datalayer);
        L.DomUtil.classIf(datalayerLi, 'off', !datalayer.isVisible());

        title.textContent = datalayer.options.name;
    },

    newDataLayer: function () {
        var datalayer = this.map.createDataLayer({});
        datalayer.edit();
    },

    openPanel: function () {
        if (!this.map.editEnabled) return;
        var container = L.DomUtil.create('ul', 'umap-browse-datalayers');
        this.map.eachDataLayerReverse(function (datalayer) {
            this.addDataLayer(container, datalayer, true);
        }, this);
        var orderable = new L.U.Orderable(container);
        orderable.on('drop', function (e) {
            var layer = this.map.datalayers[e.src.dataset.id],
                other = this.map.datalayers[e.dst.dataset.id],
                minIndex = Math.min(e.initialIndex, e.finalIndex);
            if (e.finalIndex === 0) layer.bringToTop();
            else if (e.finalIndex > e.initialIndex) layer.insertBefore(other);
            else layer.insertAfter(other);
            this.map.eachDataLayerReverse(function (datalayer) {
                if (datalayer.getRank() >= minIndex) datalayer.isDirty = true;
            });
            this.map.indexDatalayers();
        }, this);

        var bar = L.DomUtil.create('div', 'button-bar', container),
            add = L.DomUtil.create('a', 'show-on-edit block add-datalayer button', bar);
        add.href = '#';
        add.textContent = add.title = L._('Add a layer');

        L.DomEvent
            .on(add, 'click', L.DomEvent.stop)
            .on(add, 'click', this.newDataLayer, this);

        this.map.ui.openPanel({data: {html: container}, className: 'dark'});
    }

});

L.U.DataLayer.include({

    renderToolbox: function (container) {
        var toggle = L.DomUtil.create('i', 'layer-toggle', container),
            zoomTo = L.DomUtil.create('i', 'layer-zoom_to', container),
            edit = L.DomUtil.create('i', 'layer-edit show-on-edit', container),
            table = L.DomUtil.create('i', 'layer-table-edit show-on-edit', container),
            remove = L.DomUtil.create('i', 'layer-delete show-on-edit', container);
        zoomTo.title = L._('Zoom to layer extent');
        toggle.title = L._('Show/hide layer');
        edit.title = L._('Edit');
        table.title = L._('Edit properties in a table');
        remove.title = L._('Delete layer');
        L.DomEvent.on(toggle, 'click', this.toggle, this);
        L.DomEvent.on(zoomTo, 'click', this.zoomTo, this);
        L.DomEvent.on(edit, 'click', this.edit, this);
        L.DomEvent.on(table, 'click', this.tableEdit, this);
        L.DomEvent.on(remove, 'click', function () {
                    if (!this.isVisible()) return;
                    if (!confirm(L._('Are you sure you want to delete this layer?'))) return;
                    this._delete();
                    this.map.ui.closePanel();
                }, this);
        L.DomUtil.addClass(container, this.getHidableClass());
        L.DomUtil.classIf(container, 'off', !this.isVisible());
        container.dataset.id = L.stamp(this);
    },

    getHidableElements: function () {
        return document.querySelectorAll('.' + this.getHidableClass());
    },

    getHidableClass: function () {
        return 'show_with_datalayer_' + L.stamp(this);
    },

    propagateRemote: function () {
        var els = this.getHidableElements();
        for (var i = 0; i < els.length; i++) {
            L.DomUtil.classIf(els[i], 'remotelayer', this.isRemoteLayer());
        }
    },

    propagateHide: function () {
        var els = this.getHidableElements();
        for (var i = 0; i < els.length; i++) {
            L.DomUtil.addClass(els[i], 'off');
        }
    },

    propagateShow: function () {
        this.onceLoaded(function () {
            var els = this.getHidableElements();
            for (var i = 0; i < els.length; i++) {
                L.DomUtil.removeClass(els[i], 'off');
            }
        }, this);
    }

});

L.U.DataLayer.addInitHook(function () {
    this.on('hide', this.propagateHide);
    this.on('show', this.propagateShow);
    this.propagateShow();
});


L.U.Map.include({

    _openBrowser: function () {
        var browserContainer = L.DomUtil.create('div', 'umap-browse-data'),
            title = L.DomUtil.add('h3', 'umap-browse-title', browserContainer, this.options.name),
            filter = L.DomUtil.create('input', '', browserContainer),
            filterValue = '',
            featuresContainer = L.DomUtil.create('div', 'umap-browse-features', browserContainer),
            filterKeys = this.getFilterKeys();
        filter.type = 'text';
        filter.placeholder = L._('Filter…');
        filter.value = this.options.filter || '';

        var addFeature = function (feature) {
            var feature_li = L.DomUtil.create('li', feature.getClassName() + ' feature'),
                zoom_to = L.DomUtil.create('i', 'feature-zoom_to', feature_li),
                edit = L.DomUtil.create('i', 'show-on-edit feature-edit', feature_li),
                color = L.DomUtil.create('i', 'feature-color', feature_li),
                title = L.DomUtil.create('span', 'feature-title', feature_li),
                symbol = feature._getIconUrl ? L.U.Icon.prototype.formatUrl(feature._getIconUrl(), feature): null;
            zoom_to.title = L._('Bring feature to center');
            edit.title = L._('Edit this feature');
            title.textContent = feature.getDisplayName() || '—';
            color.style.backgroundColor = feature.getOption('color');
            if (symbol) {
                color.style.backgroundImage = 'url(' + symbol + ')';
            }
            L.DomEvent.on(zoom_to, 'click', function (e) {
                e.callback = L.bind(this.view, this);
                this.bringToCenter(e);
            }, feature);
            L.DomEvent.on(title, 'click', function (e) {
                e.callback = L.bind(this.view, this)
                this.bringToCenter(e);
            }, feature);
            L.DomEvent.on(edit, 'click', function () {
                this.edit();
            }, feature);
            return feature_li;
        };

        var append = function (datalayer) {
            var container = L.DomUtil.create('div', datalayer.getHidableClass(), featuresContainer),
                headline = L.DomUtil.create('h5', '', container);
            container.id = 'browse_data_datalayer_' + datalayer.umap_id;
            datalayer.renderToolbox(headline);
            L.DomUtil.add('span', '', headline, datalayer.options.name);
            var ul = L.DomUtil.create('ul', '', container);
            L.DomUtil.classIf(container, 'off', !datalayer.isVisible());

            var build = function () {
                ul.innerHTML = '';
                datalayer.eachFeature(function (feature) {
                    if (filterValue && !feature.matchFilter(filterValue, filterKeys)) return;
                    ul.appendChild(addFeature(feature));
                });
            };
            build();
            datalayer.on('datachanged', build);
            datalayer.map.ui.once('panel:closed', function () {
                datalayer.off('datachanged', build);
            });
            datalayer.map.ui.once('panel:ready', function () {
                datalayer.map.ui.once('panel:ready', function () {
                    datalayer.off('datachanged', build);
                });
            });
        };

        var appendAll = function () {
            this.options.filter = filterValue = filter.value;
            featuresContainer.innerHTML = '';
            this.eachBrowsableDataLayer(function (datalayer) {
                append(datalayer);
            });
        };
        var resetLayers = function () {
            this.eachBrowsableDataLayer(function (datalayer) {
                datalayer.resetLayer(true);
            });
        }
        L.bind(appendAll, this)();
        L.DomEvent.on(filter, 'input', appendAll, this);
        L.DomEvent.on(filter, 'input', resetLayers, this);
        var link = L.DomUtil.create('li', '');
        L.DomUtil.create('i', 'umap-icon-16 umap-caption', link);
        var label = L.DomUtil.create('span', '', link);
        label.textContent = label.title = L._('About');
        L.DomEvent.on(link, 'click', this.displayCaption, this);
        this.ui.openPanel({data: {html: browserContainer}, actions: [link]});
    }

});



L.U.TileLayerControl = L.Control.extend({

    options: {
        position: 'topleft'
    },

    initialize: function (map, options) {
        this.map = map;
        L.Control.prototype.initialize.call(this, options);
    },

    onAdd: function () {
        var container = L.DomUtil.create('div', 'leaflet-control-tilelayers umap-control');

        var link = L.DomUtil.create('a', '', container);
        link.href = '#';
        link.title = L._('Change map background');

        L.DomEvent
            .on(link, 'click', L.DomEvent.stop)
            .on(link, 'click', this.openSwitcher, this)
            .on(link, 'dblclick', L.DomEvent.stopPropagation);

        return container;
    },

    openSwitcher: function (options) {
        this._tilelayers_container = L.DomUtil.create('ul', 'umap-tilelayer-switcher-container');
        this.buildList(options);
    },

    buildList: function (options) {
        this.map.eachTileLayer(function (tilelayer) {
            if (window.location.protocol === 'https:' && tilelayer.options.url_template.indexOf('http:') === 0) return;
            this.addTileLayerElement(tilelayer, options);
        }, this);
        this.map.ui.openPanel({data: {html: this._tilelayers_container}, className: options.className});
    },

    addTileLayerElement: function (tilelayer, options) {
        var selectedClass = this.map.hasLayer(tilelayer) ? 'selected' : '',
            el = L.DomUtil.create('li', selectedClass, this._tilelayers_container),
            img = L.DomUtil.create('img', '', el),
            name = L.DomUtil.create('div', '', el);
        img.src = L.Util.template(tilelayer.options.url_template, this.map.demoTileInfos);
        name.textContent = tilelayer.options.name;
        L.DomEvent.on(el, 'click', function () {
            this.map.selectTileLayer(tilelayer);
            this.map.ui.closePanel();
            if (options && options.callback) options.callback(tilelayer);
        }, this);
    }


});

L.U.AttributionControl = L.Control.Attribution.extend({

    options: {
        prefix: ''
    },

    _update: function () {
        L.Control.Attribution.prototype._update.call(this);
        if (this._map.options.shortCredit) {
            L.DomUtil.add('span', '', this._container, ' — ' + L.Util.toHTML(this._map.options.shortCredit));
        }
        var link = L.DomUtil.add('a', '', this._container, ' — ' + L._('About'));
        L.DomEvent
            .on(link, 'click', L.DomEvent.stop)
            .on(link, 'click', this._map.displayCaption, this._map)
            .on(link, 'dblclick', L.DomEvent.stop);
        if (window.top === window.self) {
            // We are not in iframe mode
            var home = L.DomUtil.add('a', '', this._container, ' — ' + L._('Home'));
            home.href = '/';
        }
    }

});


L.U.LocateControl = L.Control.extend({

    options: {
        position: 'topleft'
    },

    onFound: function (e) {
        this._map._geolocated_circle.setRadius(e.accuracy);
        this._map._geolocated_circle.setLatLng(e.latlng);
        this._map._geolocated_marker.setLatLng(e.latlng);
        this._map.addLayer(this._map._geolocated_circle);
        this._map.addLayer(this._map._geolocated_marker);
    },

    onError: function (e) {
        this.ui.alert({content: L._('Unable to locate you.'), 'level': 'error'});
    },

    activate: function () {
        this._map.locate({
            setView: true,
            maxZoom: this._map.getZoom(),
            enableHighAccuracy: true,
            watch: true
        });
        this._active = true;
    },

    deactivate: function () {
        this._map._geolocated_marker.removeFrom(this._map)
        this._map._geolocated_circle.removeFrom(this._map)
        this._map.stopLocate();
        this._active = false;
    },

    toggle: function () {
        if (!this._active) this.activate();
        else this.deactivate();
        L.DomUtil.classIf(this._container, "active", this._active);
    },

    onAdd: function (map) {
        var container = L.DomUtil.create('div', 'leaflet-control-locate umap-control'),
            link = L.DomUtil.create('a', '', container);
        link.href = '#';
        link.title = L._('Center map on your location');

        map._geolocated_circle = L.circle(map.getCenter(), {
            radius: 10,
            weight: 0
        });

        map._geolocated_marker = L.marker(map.getCenter(), {
            icon: L.divIcon({className: 'geolocated', iconAnchor: [8, 9]}),
        });

        map.on("locationerror", this.onError, this);

        map.on("locationfound", this.onFound, this);

        L.DomEvent
            .on(link, 'click', L.DomEvent.stop)
            .on(link, 'click', this.toggle, this)
            .on(link, 'dblclick', L.DomEvent.stopPropagation);

        return container;
    }
});


L.U.Search = L.PhotonSearch.extend({

    initialize: function (map, input, options) {
        L.PhotonSearch.prototype.initialize.call(this, map, input, options);
        this.options.url = map.options.urls.search;
    },

    onBlur: function (e) {
        // Overrided because we don't want to hide the results on blur.
        this.fire('blur');
    },

    formatResult: function (feature, el) {
        var self = this;
        var tools = L.DomUtil.create('span', 'search-result-tools', el),
            zoom = L.DomUtil.create('i', 'feature-zoom_to', tools),
            edit = L.DomUtil.create('i', 'feature-edit show-on-edit', tools);
        zoom.title = L._('Zoom to this place');
        edit.title = L._('Save this location as new feature');
        // We need to use "mousedown" because Leaflet.Photon listen to mousedown
        // on el.
        L.DomEvent.on(zoom, 'mousedown', function (e) {
            L.DomEvent.stop(e);
            self.zoomToFeature(feature);
        });
        L.DomEvent.on(edit, 'mousedown', function (e) {
            L.DomEvent.stop(e);
            var datalayer = self.map.defaultDataLayer();
            var layer = datalayer.geojsonToFeatures(feature);
            layer.isDirty = true;
            layer.edit();
        });
        this._formatResult(feature, el);
    },

    zoomToFeature: function (feature) {
        var zoom = Math.max(this.map.getZoom(), 16);  // Never unzoom.
        this.map.setView([feature.geometry.coordinates[1], feature.geometry.coordinates[0]], zoom);
    },

    onSelected: function (feature) {
        this.zoomToFeature(feature);
        this.map.ui.closePanel();
    }

});

L.U.SearchControl = L.Control.extend({

    options: {
        position: 'topleft',
    },

    onAdd: function (map) {
        var container = L.DomUtil.create('div', 'leaflet-control-search umap-control'),
            self = this;

        L.DomEvent.disableClickPropagation(container);
        var link = L.DomUtil.create('a', '', container);
        link.href = '#';
        link.title = L._('Search a place name')
        L.DomEvent.on(link, 'click', function (e) {
            L.DomEvent.stop(e);
            self.openPanel(map);
        });
        return container;
    },

    openPanel: function (map) {
        var options = {
            limit: 10,
            noResultLabel: L._('No results'),
        }
        if (map.options.photonUrl) options.url = map.options.photonUrl;
        var container = L.DomUtil.create('div', '');

        var title = L.DomUtil.create('h3', '', container);
        title.textContent = L._('Search location');
        var input = L.DomUtil.create('input', 'photon-input', container);
        var resultsContainer = L.DomUtil.create('div', 'photon-autocomplete', container);
        this.search = new L.U.Search(map, input, options);
        var id = Math.random();
        this.search.on('ajax:send', function () {
            map.fire('dataloading', {id: id});
        });
        this.search.on('ajax:return', function () {
            map.fire('dataload', {id: id});
        });
        this.search.resultsContainer = resultsContainer;
        map.ui.once('panel:ready', function () {
            input.focus();
        });
        map.ui.openPanel({data: {html: container}});
    }

});


L.Control.MiniMap.include({

    initialize: function (layer, options) {
        L.Util.setOptions(this, options);
        this._layer = this._cloneLayer(layer);
    },

    onMainMapBaseLayerChange: function (e) {
        var layer = this._cloneLayer(e.layer);
        if (this._miniMap.hasLayer(this._layer)) {
            this._miniMap.removeLayer(this._layer);
        }
        this._layer = layer;
        this._miniMap.addLayer(this._layer);
    },

    _cloneLayer: function (layer) {
        return new L.TileLayer(layer._url, L.Util.extend({}, layer.options));
    }

});


L.Control.Loading.include({

    onAdd: function (map) {
        this._container = L.DomUtil.create('div', 'umap-loader', map._controlContainer);
        map.on('baselayerchange', this._layerAdd, this);
        this._addMapListeners(map);
        this._map = map;
    },

    _showIndicator: function () {
        L.DomUtil.addClass(this._map._container, 'umap-loading');
    },

    _hideIndicator: function() {
        L.DomUtil.removeClass(this._map._container, 'umap-loading');
    }

});


/*
* Make it dynamic
*/
L.U.ContextMenu = L.Map.ContextMenu.extend({

    _createItems: function (e) {
        this._map.setContextMenuItems(e);
        L.Map.ContextMenu.prototype._createItems.call(this);
    },

    _showAtPoint: function (pt, e) {
        this._items = [];
        this._container.innerHTML = '';
        this._createItems(e);
        L.Map.ContextMenu.prototype._showAtPoint.call(this, pt, e);
    }

});

L.U.IframeExporter = L.Evented.extend({

    options: {
        includeFullScreenLink: true,
        currentView: false,
        keepCurrentDatalayers: false,
        viewCurrentFeature: false
    },

    queryString: {
        scaleControl: false,
        miniMap: false,
        scrollWheelZoom: false,
        zoomControl: true,
        allowEdit: false,
        moreControl: true,
        searchControl: null,
        tilelayersControl: null,
        embedControl: null,
        datalayersControl: true,
        onLoadPanel: 'none',
        captionBar: false
    },

    dimensions: {
        width: '100%',
        height: '300px'
    },

    initialize: function (map) {
        this.map = map;
        this.baseUrl = L.Util.getBaseUrl();
        // Use map default, not generic default
        this.queryString.onLoadPanel = this.map.options.onLoadPanel;
    },

    getMap: function () {
        return this.map;
    },

    build: function () {
        var datalayers = [];
        if (this.options.viewCurrentFeature && this.map.currentFeature) {
            this.queryString.feature = this.map.currentFeature.getSlug();
        }
        if (this.options.keepCurrentDatalayers) {
            this.map.eachDataLayer(function (datalayer) {
                if (datalayer.isVisible() && datalayer.umap_id) {
                    datalayers.push(datalayer.umap_id);
                }
            });
            this.queryString.datalayers = datalayers.join(',');
        } else {
            delete this.queryString.datalayers;
        }
        var currentView = this.options.currentView ? window.location.hash : '',
            iframeUrl = this.baseUrl + '?' + L.Util.buildQueryString(this.queryString) + currentView,
            code = '<iframe width="' + this.dimensions.width + '" height="' + this.dimensions.height + '" frameborder="0" allowfullscreen src="' + iframeUrl + '"></iframe>';
        if (this.options.includeFullScreenLink) {
            code += '<p><a href="' + this.baseUrl + '">' + L._('See full screen') + '</a></p>';
        }
        return code;
    }

});

L.U.Editable = L.Editable.extend({

    initialize: function (map, options) {
        L.Editable.prototype.initialize.call(this, map, options);
        this.on('editable:drawing:start editable:drawing:click', this.drawingTooltip);
        this.on('editable:drawing:end', this.closeTooltip);
        // Layer for items added by users
        this.on('editable:drawing:cancel', function (e) {
            if (e.layer._latlngs && e.layer._latlngs.length < e.layer.editor.MIN_VERTEX) e.layer.del();
            if (e.layer instanceof L.U.Marker) e.layer.del();
        });
        this.on('editable:drawing:commit', function (e) {
            e.layer.isDirty = true;
            if (this.map.editedFeature !== e.layer) e.layer.edit(e);
        });
        this.on('editable:editing', function (e) {
            var layer = e.layer;
            layer.isDirty = true;
            if (layer._tooltip && layer.isTooltipOpen()) {
                layer._tooltip.setLatLng(layer.getCenter());
                layer._tooltip.update();
            }
        });
        this.on('editable:vertex:ctrlclick', function (e) {
            var index = e.vertex.getIndex();
            if (index === 0 || index === e.vertex.getLastIndex() && e.vertex.continue) e.vertex.continue();
        });
        this.on('editable:vertex:altclick', function (e) {
            if (e.vertex.editor.vertexCanBeDeleted(e.vertex)) e.vertex.delete();
        });
        this.on('editable:vertex:rawclick', this.onVertexRawClick);
    },

    createPolyline: function (latlngs) {
        return new L.U.Polyline(this.map, latlngs);
    },

    createPolygon: function (latlngs) {
        var polygon = new L.U.Polygon(this.map, latlngs);
        return polygon;
    },

    createMarker: function (latlng) {
        return new L.U.Marker(this.map, latlng);
    },

    connectCreatedToMap: function (layer) {
        // Overrided from Leaflet.Editable
        var datalayer = this.map.defaultDataLayer();
        datalayer.addLayer(layer);
        layer.isDirty = true;
        return layer;
    },

    drawingTooltip: function (e) {
        var content;
        if (e.layer instanceof L.Marker) content = L._('Click to add a marker');
        else if (e.layer instanceof L.Polyline) {
            if (!e.layer.editor._drawnLatLngs.length) {
                if (e.layer instanceof L.Polygon) content = L._('Click to start drawing a polygon');
                else if (e.layer instanceof L.Polyline) content = L._('Click to start drawing a line');
            } else if (e.layer.editor._drawnLatLngs.length < e.layer.editor.MIN_VERTEX) {
                content = L._('Click to continue drawing');
            } else {
                content = L._('Click last point to finish shape');
            }
        }
        if (content) this.map.ui.tooltip({content: content});
    },

    closeTooltip: function () {
        this.map.ui.closeTooltip();
    },

    onVertexRawClick: function (e) {
        e.layer.onVertexRawClick(e);
        L.DomEvent.stop(e);
        e.cancel();
    }

});
