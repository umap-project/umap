/*eslint-env commonjs, browser */
(function(factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('leaflet'));
    } else {
        window.L.control.iconLayers = factory(window.L);
        window.L.Control.IconLayers = window.L.control.iconLayers.Constructor;
    }
})(function(L) {
    function each(o, cb) {
        for (var p in o) {
            if (o.hasOwnProperty(p)) {
                cb(o[p], p, o);
            }
        }
    }

    function find(ar, cb) {
        if (ar.length) {
            for (var i = 0; i < ar.length; i++) {
                if (cb(ar[i])) {
                    return ar[i];
                }
            }
        } else {
            for (var p in ar) {
                if (ar.hasOwnProperty(p) && cb(ar[p])) {
                    return ar[p];
                }
            }
        }
    }

    function first(o) {
        for (var p in o) {
            if (o.hasOwnProperty(p)) {
                return o[p];
            }
        }
    }

    function length(o) {
        var length = 0;
        for (var p in o) {
            if (o.hasOwnProperty(p)) {
                length++;
            }
        }
        return length;
    }

    function prepend(parent, el) {
        if (parent.children.length) {
            parent.insertBefore(el, parent.children[0]);
        } else {
            parent.appendChild(el);
        }
    }

    var IconLayers = L.Control.extend({
        includes: L.Mixin.Events,
        _getActiveLayer: function() {
            if (this._activeLayerId) {
                return this._layers[this._activeLayerId];
            } else if (length(this._layers)) {
                return first(this._layers);
            } else {
                return null;
            }
        },
        _getPreviousLayer: function() {
            var activeLayer = this._getActiveLayer();
            if (!activeLayer) {
                return null;
            } else if (this._previousLayerId) {
                return this._layers[this._previousLayerId];
            } else {
                return find(this._layers, function(l) {
                    return l.id !== activeLayer.id;
                }.bind(this)) || null;
            }
        },
        _getInactiveLayers: function() {
            var ar = [];
            var activeLayerId = this._getActiveLayer() ? this._getActiveLayer().id : null;
            var previousLayerId = this._getPreviousLayer() ? this._getPreviousLayer().id : null;
            each(this._layers, function(l) {
                if ((l.id !== activeLayerId) && (l.id !== previousLayerId)) {
                    ar.push(l);
                }
            });
            return ar;
        },
        _arrangeLayers: function() {
            var behaviors = {};
            behaviors.previous = function() {
                var layers = this._getInactiveLayers();
                if (this._getActiveLayer()) {
                    layers.unshift(this._getActiveLayer());
                }
                if (this._getPreviousLayer()) {
                    layers.unshift(this._getPreviousLayer());
                }
                return layers;
            };
            return behaviors[this.options.behavior].apply(this, arguments);
        },
        _getLayerCellByLayerId: function(id) {
            var els = this._container.getElementsByClassName('leaflet-iconLayers-layerCell');
            for (var i = 0; i < els.length; i++) {
                if (els[i].getAttribute('data-layerid') == id) {
                    return els[i];
                }
            }
        },
        _createLayerElement: function(layerObj) {
            var el = L.DomUtil.create('div', 'leaflet-iconLayers-layer');
            if (layerObj.title) {
                var titleContainerEl = L.DomUtil.create('div', 'leaflet-iconLayers-layerTitleContainer');
                var titleEl = L.DomUtil.create('div', 'leaflet-iconLayers-layerTitle');
                var checkIconEl = L.DomUtil.create('div', 'leaflet-iconLayers-layerCheckIcon');
                titleEl.innerHTML = layerObj.title;
                titleContainerEl.appendChild(titleEl);
                el.appendChild(titleContainerEl);
                el.appendChild(checkIconEl);
            }
            if (layerObj.icon) {
                el.setAttribute('style', 'background-image: url(\'' + layerObj.icon + '\')');
            }
            return el;
        },
        _createLayerElements: function() {
            var currentRow, layerCell;
            var layers = this._arrangeLayers();
            var activeLayerId = this._getActiveLayer() && this._getActiveLayer().id;

            for (var i = 0; i < layers.length; i++) {
                if (i % this.options.maxLayersInRow === 0) {
                    currentRow = L.DomUtil.create('div', 'leaflet-iconLayers-layersRow');
                    if (this.options.position.indexOf('bottom') === -1) {
                        this._container.appendChild(currentRow);
                    } else {
                        prepend(this._container, currentRow);
                    }
                }
                layerCell = L.DomUtil.create('div', 'leaflet-iconLayers-layerCell');
                layerCell.setAttribute('data-layerid', layers[i].id);
                if (i !== 0) {
                    L.DomUtil.addClass(layerCell, 'leaflet-iconLayers-layerCell_hidden');
                }
                if (layers[i].id === activeLayerId) {
                    L.DomUtil.addClass(layerCell, 'leaflet-iconLayers-layerCell_active');
                }
                if (this._expandDirection === 'left') {
                    L.DomUtil.addClass(layerCell, 'leaflet-iconLayers-layerCell_expandLeft');
                } else {
                    L.DomUtil.addClass(layerCell, 'leaflet-iconLayers-layerCell_expandRight');
                }
                layerCell.appendChild(this._createLayerElement(layers[i]));

                if (this.options.position.indexOf('right') === -1) {
                    currentRow.appendChild(layerCell);
                } else {
                    prepend(currentRow, layerCell);
                }
            }
        },
        _onLayerClick: function(e) {
            e.stopPropagation();
            var layerId = e.currentTarget.getAttribute('data-layerid');
            var layer = this._layers[layerId];
            this.setActiveLayer(layer.layer);
            this.expand();
        },
        _attachEvents: function() {
            each(this._layers, function(l) {
                var e = this._getLayerCellByLayerId(l.id);
                if (e) {
                    e.addEventListener('click', this._onLayerClick.bind(this));
                }
            }.bind(this));
            var layersRowCollection = this._container.getElementsByClassName('leaflet-iconLayers-layersRow');

            var onMouseEnter = function(e) {
                e.stopPropagation();
                this.expand();
            }.bind(this);

            var onMouseLeave = function(e) {
                e.stopPropagation();
                this.collapse();
            }.bind(this);

            var stopPropagation = function(e) {
                e.stopPropagation();
            };

            //TODO Don't make functions within a loop.
            for (var i = 0; i < layersRowCollection.length; i++) {
                var el = layersRowCollection[i];
                el.addEventListener('mouseenter', onMouseEnter);
                el.addEventListener('mouseleave', onMouseLeave);
                el.addEventListener('mousemove', stopPropagation);
            }
        },
        _render: function() {
            this._container.innerHTML = '';
            this._createLayerElements();
            this._attachEvents();
        },
        _switchMapLayers: function() {
            if (!this._map) {
                return;
            }
            var activeLayer = this._getActiveLayer();
            var previousLayer = this._getPreviousLayer();
            if (previousLayer) {
                this._map.removeLayer(previousLayer.layer);
            } else {
                each(this._layers, function(layerObject) {
                    var layer = layerObject.layer;
                    this._map.removeLayer(layer);
                }.bind(this));
            }
            if (activeLayer) {
                this._map.addLayer(activeLayer.layer);
            }
        },
        options: {
            position: 'bottomleft', // one of expanding directions depends on this
            behavior: 'previous', // may be 'previous', 'expanded' or 'first'
            expand: 'horizontal', // or 'vertical'
            autoZIndex: true, // from L.Control.Layers
            maxLayersInRow: 5,
            manageLayers: true
        },
        initialize: function(layers, options) {
            if (!L.Util.isArray(arguments[0])) {
                // first argument is options
                options = layers;
                layers = [];
            }
            L.setOptions(this, options);
            this._expandDirection = (this.options.position.indexOf('left') != -1) ? 'right' : 'left';
            if (this.options.manageLayers) {
                this.on('activelayerchange', this._switchMapLayers, this);
            }
            this.setLayers(layers);
        },
        onAdd: function(map) {
            this._container = L.DomUtil.create('div', 'leaflet-iconLayers');
            L.DomUtil.addClass(this._container, 'leaflet-iconLayers_' + this.options.position);
            this._render();
            map.on('click', this.collapse, this);
            if (this.options.manageLayers) {
                this._switchMapLayers();
            }
            return this._container;
        },
        onRemove: function(map) {
            map.off('click', this.collapse, this);
        },
        setLayers: function(layers) {
            this._layers = {};
            layers.map(function(layer) {
                var id = L.stamp(layer.layer);
                this._layers[id] = L.extend(layer, {
                    id: id
                });
            }.bind(this));
            if (this._container) {
                this._render();
            }
        },
        setActiveLayer: function(layer) {
            var l = layer && this._layers[L.stamp(layer)];
            if (!l || l.id === this._activeLayerId) {
                return;
            }
            this._previousLayerId = this._activeLayerId;
            this._activeLayerId = l.id;
            if (this._container) {
                this._render();
            }
            this.fire('activelayerchange', {
                layer: layer
            });
        },
        expand: function() {
            this._arrangeLayers().slice(1).map(function(l) {
                var el = this._getLayerCellByLayerId(l.id);
                L.DomUtil.removeClass(el, 'leaflet-iconLayers-layerCell_hidden');
            }.bind(this));
        },
        collapse: function() {
            this._arrangeLayers().slice(1).map(function(l) {
                var el = this._getLayerCellByLayerId(l.id);
                L.DomUtil.addClass(el, 'leaflet-iconLayers-layerCell_hidden');
            }.bind(this));
        }
    });

    var iconLayers = function(layers, options) {
        return new IconLayers(layers, options);
    };

    iconLayers.Constructor = IconLayers;

    return iconLayers;
});