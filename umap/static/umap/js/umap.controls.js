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

    // Snapping: attach a Leaflet.Snap MarkerSnap handler to any marker that
    // Leaflet.Editable lets the user move (a vertex being dragged, a whole
    // point feature being moved, or a marker being placed), so it sticks to
    // nearby existing features.
    this.on('editable:vertex:dragstart', (event) => {
      this.snapMarker(event.vertex, event.layer?.feature)
    })
    this.on('editable:vertex:dragend', (event) => {
      this.unsnapMarker(event.vertex)
    })
    this.on('editable:dragstart editable:drawing:start', (event) => {
      // Only markers expose a watchable `move`; whole-shape drags don't.
      if (event.layer instanceof L.Marker) {
        this.snapMarker(event.layer, event.layer.feature)
      }
    })
    this.on('editable:dragend editable:drawing:end', (event) => {
      if (event.layer instanceof L.Marker) this.unsnapMarker(event.layer)
    })
  },

  getSnapDistance: function () {
    // In pixels; 0 (or unset) disables snapping. Overridable via querystring.
    return this._umap.getProperty('snapDistance')
  },

  // Every visible feature the given marker may snap to, minus the feature it
  // belongs to (Leaflet.Snap's own self-exclusion relies on Leaflet.Draw
  // internals that Leaflet.Editable does not provide).
  snapGuides: function (exclude) {
    const guides = []
    this._umap.eachFeature((feature) => {
      if (feature === exclude) return
      const ui = feature.ui
      if (ui && this.map.hasLayer(ui)) guides.push(ui)
    })
    return guides
  },

  snapMarker: function (marker, feature) {
    const distance = this.getSnapDistance()
    if (!distance || !L.Handler.MarkerSnap || marker._snap) return
    // Construct without the marker: the marker-aware constructor path tries to
    // instantiate `L.Handler.MarkerDrag`, which Leaflet 1.x no longer exposes.
    // Leaflet.Editable's markers are already draggable, so we just watch them.
    const snap = new L.Handler.MarkerSnap(this.map, {
      snapDistance: distance,
    })
    for (const guide of this.snapGuides(feature)) snap.addGuideLayer(guide)
    // Remember the snapped position: when *placing* a new marker, Leaflet.Editable
    // overwrites the marker latlng with the raw click on commit, so we reapply it
    // on teardown (which runs after the commit).
    marker.on('snap', this._onSnap, this)
    marker.on('unsnap', this._onUnsnap, this)
    snap.watchMarker(marker)
    snap.enable()
    marker._snap = snap
  },

  unsnapMarker: function (marker) {
    if (!marker?._snap) return
    if (marker._snapLatLng) {
      marker.setLatLng(marker._snapLatLng)
      // setLatLng only moves the rendered marker; resync the feature geometry
      // so the snapped position is the one that gets saved.
      marker.feature?.pullGeometry()
    }
    marker.off('snap', this._onSnap, this)
    marker.off('unsnap', this._onUnsnap, this)
    marker._snap.unwatchMarker(marker)
    marker._snap.disable()
    delete marker._snap
    delete marker._snapLatLng
  },

  _onSnap: function (event) {
    event.target._snapLatLng = event.latlng
  },

  _onUnsnap: function (event) {
    delete event.target._snapLatLng
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
