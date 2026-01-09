/* Used in view mode to define the current tilelayer */
U.TileLayerControl = L.Control.IconLayers.extend({
  initialize: function (map, options) {
    this.map = map
    this.maxShown = 9
    L.Control.IconLayers.prototype.initialize.call(this, {
      position: 'topleft',
      manageLayers: false,
    })
    this.on('activelayerchange', (e) => map.selectTileLayer(e.layer))
  },

  setLayers: function (layers) {
    if (!layers) {
      layers = []
      this.map.eachTileLayer((layer) => {
        try {
          // We'd like to use layer.getTileUrl, but this method will only work
          // when the tilelayer is actually added to the map (needs this._tileZoom
          // to be defined)
          // Fixme when https://github.com/Leaflet/Leaflet/pull/9201 is released
          const icon = U.Utils.template(
            layer.options.url_template,
            this.map.options.demoTileInfos
          )
          layers.push({
            title: layer.options.name,
            layer: layer,
            icon: icon,
          })
        } catch (e) {
          // Skip this tilelayer
          console.error(e)
        }
      })
    }
    this._allLayers = layers
    L.Control.IconLayers.prototype.setLayers.call(this, layers.slice(0, this.maxShown))
    if (this.map.selected_tilelayer) this.setActiveLayer(this.map.selected_tilelayer)
  },

  _createLayerElements: function () {
    L.Control.IconLayers.prototype._createLayerElements.call(this)
    if (Object.keys(this._allLayers).length <= this.maxShown) return
    const lastRow = this._container.querySelector(
      '.leaflet-iconLayers-layersRow:last-child'
    )
    const button = document.createElement('button')
    button.className =
      'leaflet-iconLayers-layerCell leaflet-iconLayers-layerCell-plus button'
    button.textContent = '+'
    lastRow.appendChild(button)
    button.addEventListener('click', () =>
      this.map._controls.tilelayersChooser.openSwitcher()
    )
  },
})

L.Control.MiniMap.include({
  initialize: function (layer, options) {
    L.Util.setOptions(this, options)
    this._layer = this._cloneLayer(layer)
  },

  onMainMapBaseLayerChange: function (e) {
    const layer = this._cloneLayer(e.layer)
    if (this._miniMap.hasLayer(this._layer)) {
      this._miniMap.removeLayer(this._layer)
    }
    this._layer = layer
    this._miniMap.addLayer(this._layer)
  },

  _cloneLayer: (layer) => new L.TileLayer(layer._url, L.Util.extend({}, layer.options)),
})

U.Editable = L.Editable.extend({
  initialize: function (umap, options) {
    this._umap = umap
    L.Editable.prototype.initialize.call(this, umap._leafletMap, options)
    this.on('editable:drawing:click editable:drawing:move', this.drawingTooltip)
    // Layer for items added by users
    this.on('editable:drawing:cancel', (event) => {
      this.resetButtons()
    })
    this.on('editable:drawing:commit', function (event) {
      this.resetButtons()
      if (this._umap.editedFeature !== event.layer) {
        const promise = event.layer.feature.edit(event)
        if (event.layer.feature.isRoute?.()) {
          promise.then((panel) => {
            panel.scrollTo('details#edit-route')
          })
        }
      }
    })
    this.on('editable:vertex:ctrlclick', (event) => {
      const index = event.vertex.getIndex()
      if (
        index === 0 ||
        (index === event.vertex.getLastIndex() && event.vertex.continue)
      )
        event.vertex.continue()
    })
    this.on('editable:vertex:altclick', (event) => {
      if (event.vertex.editor.vertexCanBeDeleted(event.vertex)) event.vertex.delete()
    })
    this.on('editable:vertex:rawclick', this.onVertexRawClick)
  },

  resetButtons: () => {
    const buttons = document.querySelectorAll('.umap-edit-bar .drawing-tool')
    for (const button of buttons) {
      button.classList.remove('on')
    }
  },

  startRoute: function (latlng) {
    const feature = this.createLineString()
    feature.askForRouteSettings().then(async () => {
      feature.ui.enableEdit(this.map).newShape(latlng)
    })
  },

  createLineString: function () {
    const datalayer = this._umap.defaultEditDataLayer()
    const line = new U.LineString(this._umap, datalayer, {
      geometry: { type: 'LineString', coordinates: [] },
    })
    line._needs_upsert = true
    return line
  },

  createPolyline: function (latlngs, properties = {}) {
    return this.createLineString().ui
  },

  createPolygon: function (latlngs) {
    const datalayer = this._umap.defaultEditDataLayer()
    const poly = new U.Polygon(this._umap, datalayer, {
      geometry: { type: 'Polygon', coordinates: [] },
    })
    poly._needs_upsert = true
    return poly.ui
  },

  createMarker: function (latlng) {
    const datalayer = this._umap.defaultEditDataLayer()
    const point = new U.Point(this._umap, datalayer, {
      geometry: { type: 'Point', coordinates: [latlng.lng, latlng.lat] },
    })
    point._needs_upsert = true
    return point.ui
  },

  _getDefaultProperties: function () {
    const result = {}
    if (this._umap.properties.featuresHaveOwner?.user) {
      result.geojson = { properties: { owner: this._umap.properties.user.id } }
    }
    return result
  },

  connectCreatedToMap: function (layer) {
    // Overrided from Leaflet.Editable
    const datalayer = this._umap.defaultEditDataLayer()
    datalayer.addFeature(layer.feature)
    return layer
  },

  drawingTooltip: function (e) {
    if (e.layer instanceof L.Marker && e.type === 'editable:drawing:start') {
      this._umap.tooltip.open({ content: L._('Click to add a marker') })
    }
    if (!(e.layer instanceof L.Polyline)) {
      // only continue with Polylines and Polygons
      return
    }
    let content = L._('Drawing')
    let measure
    if (e.layer.editor._drawnLatLngs) {
      // when drawing (a Polyline or Polygon)
      if (!e.layer.editor._drawnLatLngs.length) {
        // when drawing first point
        if (e.layer instanceof L.Polygon) {
          content = L._('Click to start drawing a polygon')
        } else if (e.layer instanceof L.Polyline) {
          content = L._('Click to start drawing a line')
        }
      } else {
        const tmpLatLngs = e.layer.editor._drawnLatLngs.slice()
        if (e.layer.editor._drawing === L.Editable.BACKWARD) {
          tmpLatLngs.unshift(e.latlng)
        } else {
          tmpLatLngs.push(e.latlng)
        }
        measure = e.layer.getMeasure(tmpLatLngs)

        if (e.layer.editor._drawnLatLngs.length < e.layer.editor.MIN_VERTEX) {
          // when drawing second point
          content = L._('Click to continue drawing')
        } else {
          // when drawing third point (or more)
          content = L._('Click last point to finish shape')
        }
      }
    } else {
      // when moving an existing point
      measure = e.layer.getMeasure()
    }
    if (measure) {
      if (e.layer instanceof L.Polygon) {
        content += ` ${L._('(area: {measure})', { measure: measure })}`
      } else if (e.layer instanceof L.Polyline) {
        content += ` ${L._('(length: {measure})', { measure: measure })}`
      }
    }
    if (content) {
      this._umap.tooltip.open({ content: content })
    }
  },

  closeTooltip: function () {
    this._umap.closeTooltip()
  },

  onVertexRawClick: (e) => {
    // Do not delete the vertex on click (but on alt-click only)
    e.cancel()
  },

  onEscape: function () {
    this.once('editable:drawing:end', (event) => {
      this._umap.tooltip.close()
      // When hitting Escape before adding a marker,
      // it tries to edit an unconnected marker.
      if (event?.layer?.feature?.datalayer === null) return
      // Leaflet.Editable will delete the drawn shape if invalid
      // (eg. line has only one drawn point)
      // So let's check if the layer has no more shape
      event.layer.feature.pullGeometry(false)
      if (!event.layer.feature.hasGeom() || event.layer instanceof U.LeafletMarker) {
        event.layer.feature.del()
      } else {
        event.layer.feature.onCommit()
        event.layer.feature.edit()
      }
    })
    this.stopDrawing()
  },

  createVertexIcon: (options) =>
    L.Browser.mobile && L.Browser.touch
      ? L.divIcon({ iconSize: new L.Point(20, 20), ...options })
      : L.divIcon({ iconSize: new L.Point(12, 12), ...options }),
})
