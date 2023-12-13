L.U.Editable = L.Editable.extend({
    initialize: function (map, options) {
      L.Editable.prototype.initialize.call(this, map, options)
      this.on(
        'editable:drawing:start editable:drawing:click editable:drawing:move',
        this.drawingTooltip
      )
      this.on('editable:drawing:end', this.closeTooltip)
      // Layer for items added by users
      this.on('editable:drawing:cancel', (e) => {
        if (e.layer._latlngs && e.layer._latlngs.length < e.layer.editor.MIN_VERTEX)
          e.layer.del()
        if (e.layer instanceof L.U.Marker) e.layer.del()
      })
      this.on('editable:drawing:commit', function (e) {
        e.layer.isDirty = true
        if (this.map.editedFeature !== e.layer) e.layer.edit(e)
      })
      this.on('editable:editing', (e) => {
        const layer = e.layer
        layer.isDirty = true
        if (layer._tooltip && layer.isTooltipOpen()) {
          layer._tooltip.setLatLng(layer.getCenter())
          layer._tooltip.update()
        }
      })
      this.on('editable:vertex:ctrlclick', (e) => {
        const index = e.vertex.getIndex()
        if (index === 0 || (index === e.vertex.getLastIndex() && e.vertex.continue))
          e.vertex.continue()
      })
      this.on('editable:vertex:altclick', (e) => {
        if (e.vertex.editor.vertexCanBeDeleted(e.vertex)) e.vertex.delete()
      })
      this.on('editable:vertex:rawclick', this.onVertexRawClick)
    },
  
    createPolyline: function (latlngs) {
      return new L.U.Polyline(this.map, latlngs, this._getDefaultProperties())
    },
  
    createPolygon: function (latlngs) {
      return new L.U.Polygon(this.map, latlngs, this._getDefaultProperties())
    },
  
    createMarker: function (latlng) {
      return new L.U.Marker(this.map, latlng, this._getDefaultProperties())
    },
  
    _getDefaultProperties: function () {
      const result = {}
      if (this.map.options.featuresHaveOwner && this.map.options.hasOwnProperty('user')) {
        result.geojson = { properties: { owner: this.map.options.user.id } }
      }
      return result
    },
  
    connectCreatedToMap: function (layer) {
      // Overrided from Leaflet.Editable
      const datalayer = this.map.defaultEditDataLayer()
      datalayer.addLayer(layer)
      layer.isDirty = true
      return layer
    },
  
    drawingTooltip: function (e) {
      if (e.layer instanceof L.Marker && e.type == 'editable:drawing:start') {
        this.map.ui.tooltip({ content: L._('Click to add a marker') })
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
          tmpLatLngs.push(e.latlng)
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
          content += L._(' (area: {measure})', { measure: measure })
        } else if (e.layer instanceof L.Polyline) {
          content += L._(' (length: {measure})', { measure: measure })
        }
      }
      if (content) {
        this.map.ui.tooltip({ content: content })
      }
    },
  
    closeTooltip: function () {
      this.map.ui.closeTooltip()
    },
  
    onVertexRawClick: function (e) {
      e.layer.onVertexRawClick(e)
      L.DomEvent.stop(e)
      e.cancel()
    },
  })