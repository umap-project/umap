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

    // Snapping. Two complementary mechanisms:
    //  - While *drawing* (line, polygon, marker), the next point and the
    //    rubber-band follow `event.latlng`, so we rewrite it to the closest
    //    existing feature. This is the reliable, Google-My-Maps-like path.
    //  - While *editing* an existing marker/vertex by dragging, the position
    //    comes from the marker icon (not the event), so we attach a
    //    Leaflet.Snap MarkerSnap handler to it instead.
    this.on('editable:drawing:start', this.startSnapping)
    this.on('editable:drawing:end', this.stopSnapping)
    // Snap the raw map pointer events. Leaflet hands the same event object to
    // every listener of a fire and runs them in registration order, so this
    // handler (registered now, at setup) runs before the mousemove/mouseup
    // handlers Leaflet.Editable registers when drawing starts — letting us
    // rewrite `latlng` to a snapped position that the editor then consumes.
    this.map.on('mousemove mouseup', this.snapDrawingEvent, this)
    this.on('editable:vertex:dragstart', (event) => {
      this.snapMarker(event.vertex, event.layer?.feature)
    })
    this.on('editable:vertex:dragend', (event) => {
      this.unsnapMarker(event.vertex)
    })
    this.on('editable:dragstart', (event) => {
      // Only markers expose a watchable `move`; whole-shape drags don't.
      if (event.layer instanceof L.Marker) {
        this.snapMarker(event.layer, event.layer.feature)
      }
    })
    this.on('editable:dragend', (event) => {
      if (event.layer instanceof L.Marker) this.unsnapMarker(event.layer)
    })
  },

  getSnapDistance: function () {
    // In pixels; 0 (or unset) disables snapping. Overridable via querystring.
    return this._umap.getProperty('snapDistance')
  },

  startSnapping: function (event) {
    // Cache the guide layers for the whole drawing session — rebuilding the
    // list on every mousemove would be wasteful.
    this._snapGuides = this.getSnapDistance()
      ? this.snapGuides(event.layer?.feature)
      : null
  },

  stopSnapping: function () {
    this._snapGuides = null
    this.hideSnapIndicator()
  },

  // While a feature is being drawn, rewrite the pointer latlng to the closest
  // guide within `snapDistance`. Both the live rubber-band and the placed
  // vertex/marker derive their position from this event, so they snap onto
  // existing features. A visual indicator follows the snapped point so the
  // user gets feedback even for the very first vertex (which has no
  // rubber-band yet).
  snapDrawingEvent: function (event) {
    if (!this.drawing() || !this._snapGuides?.length || !L.GeometryUtil) {
      return this.hideSnapIndicator()
    }
    const closest = L.GeometryUtil.closestLayerSnap(
      this.map,
      this._snapGuides,
      event.latlng,
      this.getSnapDistance(),
      true
    )
    if (!closest) return this.hideSnapIndicator()
    // Copy into a fresh LatLng from lat/lng only: `closest.latlng` may *be* a
    // guide's own latlng object (and carries extra props from the snap math).
    // Reusing it would share one latlng across features — Leaflet later stamps
    // `__vertex` on it, creating a circular reference that breaks serialization.
    event.latlng = L.latLng(closest.latlng.lat, closest.latlng.lng)
    this.showSnapIndicator(event.latlng)
  },

  showSnapIndicator: function (latlng) {
    if (!this._snapIndicator) {
      this._snapIndicator = L.circleMarker(latlng, {
        radius: 7,
        weight: 3,
        color: '#e8a800',
        opacity: 1,
        fill: false,
        interactive: false,
        className: 'umap-snap-indicator',
      })
    }
    this._snapIndicator.setLatLng(latlng)
    if (!this.map.hasLayer(this._snapIndicator)) this._snapIndicator.addTo(this.map)
  },

  hideSnapIndicator: function () {
    if (this._snapIndicator && this.map.hasLayer(this._snapIndicator)) {
      this.map.removeLayer(this._snapIndicator)
    }
  },

  // Every visible feature the given marker may snap to, minus the feature it
  // belongs to (Leaflet.Snap's own self-exclusion relies on Leaflet.Draw
  // internals that Leaflet.Editable does not provide).
  snapGuides: function (exclude) {
    const guides = []
    this._umap.eachFeature((feature) => {
      if (feature === exclude) return
      const ui = feature.ui
      if (!ui || !this.map.hasLayer(ui)) return
      // Skip a path that is currently being edited: Leaflet.Editable stamps a
      // circular `__vertex` back-reference on its latlngs, and the snap
      // library's closest() JSON-serializes the geometry, which would throw.
      // (Markers use getLatLng() and are unaffected.)
      if (ui.getLatLngs && ui.editEnabled?.()) return
      guides.push(ui)
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
