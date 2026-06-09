U.Editable = L.Editable.extend({
  initialize: function (umap, options) {
    this._umap = umap
    // TODO remove direct call to Leaflet map
    L.Editable.prototype.initialize.call(this, umap.mapProxy.map, options)
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
      const feature = event.layer.feature
      // Sync _geometry from the UI so hasGeom() sees what is actually left.
      const geometry = event.layer.toGeometry()
      feature._geometry = geometry
      if (!feature.hasGeom() || event.layer instanceof U.LeafletMarker) {
        feature.del()
      } else {
        feature.onCommit(geometry)
        feature.edit()
      }
    })
    this.stopDrawing()
  },

  createVertexIcon: (options) =>
    L.Browser.mobile && L.Browser.touch
      ? L.divIcon({ iconSize: new L.Point(20, 20), ...options })
      : L.divIcon({ iconSize: new L.Point(12, 12), ...options }),
})
