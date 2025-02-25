U.EditControl = L.Control.extend({
  options: {
    position: 'topright',
  },

  onAdd: function (map) {
    const container = L.DomUtil.create('div', 'edit-enable')
    const enableEditing = L.DomUtil.createButton(
      '',
      container,
      L._('Edit'),
      map._umap.enableEdit,
      map._umap
    )
    L.DomEvent.on(
      enableEditing,
      'mouseover',
      () => {
        map._umap.tooltip.open({
          content: map._umap.help.displayLabel('TOGGLE_EDIT'),
          anchor: enableEditing,
          position: 'bottom',
          delay: 750,
          duration: 5000,
        })
      },
      this
    )

    return container
  },
})

U.MoreControls = L.Control.extend({
  options: {
    position: 'topleft',
  },

  onAdd: function () {
    const container = L.DomUtil.create('div', 'umap-control-text')
    const moreButton = L.DomUtil.createButton(
      'umap-control-more',
      container,
      L._('More controls'),
      this.toggle,
      this
    )
    const lessButton = L.DomUtil.createButton(
      'umap-control-less',
      container,
      L._('Hide controls'),
      this.toggle,
      this
    )
    return container
  },

  toggle: function () {
    const pos = this.getPosition()
    const corner = this._map._controlCorners[pos]
    const className = 'umap-more-controls'
    if (L.DomUtil.hasClass(corner, className)) L.DomUtil.removeClass(corner, className)
    else L.DomUtil.addClass(corner, className)
  },
})

U.PermanentCreditsControl = L.Control.extend({
  options: {
    position: 'bottomleft',
  },

  initialize: function (map, options) {
    this.map = map
    L.Control.prototype.initialize.call(this, options)
  },

  onAdd: function () {
    this.paragraphContainer = L.DomUtil.create(
      'div',
      'umap-permanent-credits-container text'
    )
    this.setCredits()
    this.setBackground()
    return this.paragraphContainer
  },

  setCredits: function () {
    this.paragraphContainer.innerHTML = U.Utils.toHTML(this.map.options.permanentCredit)
  },

  setBackground: function () {
    if (this.map.options.permanentCreditBackground) {
      this.paragraphContainer.style.backgroundColor = '#FFFFFFB0'
    } else {
      this.paragraphContainer.style.backgroundColor = ''
    }
  },
})

L.Control.Button = L.Control.extend({
  initialize: function (umap, options) {
    this._umap = umap
    L.Control.prototype.initialize.call(this, options)
  },

  getClassName: function () {
    return this.options.className
  },

  onAdd: function (map) {
    const container = L.DomUtil.create('div', `${this.getClassName()} umap-control`)
    const button = L.DomUtil.createButton(
      '',
      container,
      this.options.title,
      this.onClick,
      this
    )
    L.DomEvent.on(button, 'dblclick', L.DomEvent.stopPropagation)
    this.afterAdd(container)
    return container
  },

  afterAdd: (container) => {},
})

U.DataLayersControl = L.Control.Button.extend({
  options: {
    position: 'topleft',
    className: 'umap-control-browse',
    title: L._('Open browser'),
  },

  afterAdd: function (container) {
    U.Utils.toggleBadge(container, this._umap.browser?.hasFilters())
  },

  onClick: function () {
    this._umap.openBrowser()
  },
})

U.CaptionControl = L.Control.Button.extend({
  options: {
    position: 'topleft',
    className: 'umap-control-caption',
    title: L._('About'),
  },

  onClick: function () {
    this._umap.openCaption()
  },
})

L.Control.Embed = L.Control.Button.extend({
  options: {
    position: 'topleft',
    title: L._('Share and download'),
    className: 'leaflet-control-embed umap-control',
  },

  onClick: function () {
    this._umap.share.open()
  },
})

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
    const button = L.DomUtil.element({
      tagName: 'button',
      className:
        'leaflet-iconLayers-layerCell leaflet-iconLayers-layerCell-plus button',
      textContent: '+',
      parent: lastRow,
    })
    L.DomEvent.on(button, 'click', () =>
      this.map._controls.tilelayersChooser.openSwitcher()
    )
  },
})

/* Used in edit mode to define the default tilelayer */
U.TileLayerChooser = L.Control.extend({
  options: {
    position: 'topleft',
  },

  initialize: function (map, options = {}) {
    this.map = map
    L.Control.prototype.initialize.call(this, options)
  },

  onAdd: function () {
    const container = L.DomUtil.create('div', 'leaflet-control-tilelayers umap-control')
    const changeMapBackgroundButton = L.DomUtil.createButton(
      '',
      container,
      L._('Change map background'),
      this.openSwitcher,
      this
    )
    L.DomEvent.on(changeMapBackgroundButton, 'dblclick', L.DomEvent.stopPropagation)
    return container
  },

  openSwitcher: function (options = {}) {
    const container = L.DomUtil.create('div', 'umap-edit-tilelayers')
    L.DomUtil.createTitle(container, L._('Change tilelayers'), 'icon-tilelayer')
    this._tilelayers_container = L.DomUtil.create('ul', '', container)
    this.buildList(options)
    const panel = options.edit ? this.map._umap.editPanel : this.map._umap.panel
    panel.open({ content: container, highlight: 'tilelayers' })
  },

  buildList: function (options) {
    this.map.eachTileLayer(function (tilelayer) {
      if (
        window.location.protocol === 'https:' &&
        tilelayer.options.url_template.indexOf('http:') === 0
      )
        return
      this.addTileLayerElement(tilelayer, options)
    }, this)
  },

  addTileLayerElement: function (tilelayer, options) {
    const selectedClass = this.map.hasLayer(tilelayer) ? 'selected' : ''
    const el = L.DomUtil.create('li', selectedClass, this._tilelayers_container)
    const img = L.DomUtil.create('img', '', el)
    const name = L.DomUtil.create('div', '', el)
    img.src = U.Utils.template(
      tilelayer.options.url_template,
      this.map.options.demoTileInfos
    )
    img.loading = 'lazy'
    name.textContent = tilelayer.options.name
    L.DomEvent.on(
      el,
      'click',
      () => {
        this.map.selectTileLayer(tilelayer)
        this.map._controls.tilelayers.setLayers()
        if (options?.edit) {
          this.map._umap.properties.tilelayer = tilelayer.toJSON()
          this.map._umap.isDirty = true
        }
      },
      this
    )
  },
})

U.AttributionControl = L.Control.Attribution.extend({
  options: {
    prefix: '',
  },

  _update: function () {
    // Layer is no more on the map
    if (!this._map) return
    L.Control.Attribution.prototype._update.call(this)
    // Use our own container, so we can hide/show on small screens
    const credits = this._container.innerHTML
    this._container.innerHTML = ''
    const container = L.DomUtil.create('div', 'attribution-container', this._container)
    container.innerHTML = credits
    const shortCredit = this._map._umap.getProperty('shortCredit')
    const captionMenus = this._map._umap.getProperty('captionMenus')
    if (shortCredit) {
      L.DomUtil.element({
        tagName: 'span',
        parent: container,
        safeHTML: ` — ${U.Utils.toHTML(shortCredit)}`,
      })
    }
    if (captionMenus) {
      const link = L.DomUtil.add('a', '', container, ` — ${L._('Open caption')}`)
      L.DomEvent.on(link, 'click', L.DomEvent.stop)
        .on(link, 'click', () => this._map._umap.openCaption())
        .on(link, 'dblclick', L.DomEvent.stop)
    }
    if (window.top === window.self && captionMenus) {
      // We are not in iframe mode
      L.DomUtil.createLink('', container, ` — ${L._('Home')}`, '/')
    }
    if (captionMenus) {
      L.DomUtil.createLink(
        '',
        container,
        ` — ${L._('Powered by uMap')}`,
        'https://umap-project.org/'
      )
    }
    L.DomUtil.createLink('attribution-toggle', this._container, '')
  },
})

/*
 * Take control over L.Control.Locate to be able to
 * call start() before adding the control (and thus the button) to the map.
 */
U.Locate = L.Control.Locate.extend({
  initialize: function (map, options) {
    // When calling start(), it will try to add a location marker
    // on the layer, which is normally added in the addTo/onAdd method
    this._layer = this.options.layer = new L.LayerGroup()
    // When calling start(), it will call _activate(), which then adds
    // location related event listeners on the map
    this.map = map
    L.Control.Locate.prototype.initialize.call(this, options)
  },

  onAdd: function (map) {
    const active = this._active
    const container = L.Control.Locate.prototype.onAdd.call(this, map)
    this._active = active
    return container
  },

  _activate: function () {
    this._map = this.map
    L.Control.Locate.prototype._activate.call(this)
  },

  remove: function () {
    // Prevent to call remove if the control is not really added to the map
    // This occurs because we do create the control and call its activate
    // method before adding the control button itself to the map, in the
    // case where the map defaultView is set to "location"
    if (!this._container || !this._container.parentNode) return
    return L.Control.Locate.prototype.remove.call(this)
  },
})

U.Search = L.PhotonSearch.extend({
  initialize: function (map, input, options) {
    this.options.placeholder = L._('Type a place name or coordinates')
    this.options.location_bias_scale = 0.5
    L.PhotonSearch.prototype.initialize.call(this, map, input, options)
    this.options.url = map.options.urls.search
    if (map.options.maxBounds) this.options.bbox = map.options.maxBounds.toBBoxString()
    this.reverse = new L.PhotonReverse({
      handleResults: (geojson) => {
        this.handleResultsWithReverse(geojson)
      },
    })
  },

  handleResultsWithReverse: function (geojson) {
    const latlng = this.reverse.latlng
    geojson.features.unshift({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [latlng.lng, latlng.lat] },
      properties: {
        name: L._('Go to "{coords}"', { coords: `${latlng.lat} ${latlng.lng}` }),
      },
    })

    this.handleResults(geojson)
  },

  search: function () {
    const pattern = /^(?<lat>[-+]?\d{1,2}[.,]\d+)\s*[ ,]\s*(?<lng>[-+]?\d{1,3}[.,]\d+)$/
    if (pattern.test(this.input.value)) {
      this.hide()
      const { lat, lng } = pattern.exec(this.input.value).groups
      const latlng = L.latLng(lat, lng)
      if (latlng.isValid()) {
        this.reverse.doReverse(latlng)
      } else {
        U.Alert.error(L._('Invalid latitude or longitude'))
      }
      return
    }
    // Only numbers, abort.
    if (/^[\d .,]*$/.test(this.input.value)) return
    // Do normal search
    this.options.includePosition = this.map.getZoom() > 10
    L.PhotonSearch.prototype.search.call(this)
  },

  onBlur: function (e) {
    // Overrided because we don't want to hide the results on blur.
    this.fire('blur')
  },

  formatResult: function (feature, el) {
    const tools = L.DomUtil.create('span', 'search-result-tools', el)
    const zoom = L.DomUtil.createButtonIcon(
      tools,
      'icon-zoom',
      L._('Zoom to this place')
    )
    const edit = L.DomUtil.createButtonIcon(
      tools,
      'icon-edit',
      L._('Save this location as new feature')
    )
    // We need to use "mousedown" because Leaflet.Photon listen to mousedown
    // on el.
    L.DomEvent.on(zoom, 'mousedown', (e) => {
      L.DomEvent.stop(e)
      this.zoomToFeature(feature)
    })
    L.DomEvent.on(edit, 'mousedown', (e) => {
      L.DomEvent.stop(e)
      const datalayer = this.map._umap.defaultEditDataLayer()
      const layer = datalayer.makeFeature(feature)
      layer.isDirty = true
      layer.edit()
    })
    this._formatResult(feature, el)
  },

  zoomToFeature: function (feature) {
    const zoom = Math.max(this.map.getZoom(), 16) // Never unzoom.
    this.map.setView(
      [feature.geometry.coordinates[1], feature.geometry.coordinates[0]],
      zoom
    )
  },

  onSelected: function (feature) {
    this.zoomToFeature(feature)
    this.map.panel.close()
  },
})

U.SearchControl = L.Control.extend({
  options: {
    position: 'topleft',
  },

  onAdd: function (map) {
    this.map = map
    const container = L.DomUtil.create('div', 'leaflet-control-search umap-control')
    L.DomEvent.disableClickPropagation(container)
    L.DomUtil.createButton(
      '',
      container,
      L._('Search location'),
      (e) => {
        L.DomEvent.stop(e)
        this.open()
      },
      this
    )
    return container
  },

  open: function () {
    const options = {
      limit: 10,
      noResultLabel: L._('No results'),
    }
    if (this.map.options.photonUrl) options.url = this.map.options.photonUrl
    const container = L.DomUtil.create('div', '')

    L.DomUtil.createTitle(container, L._('Search location'), 'icon-search')
    const input = L.DomUtil.create('input', 'photon-input', container)
    const resultsContainer = L.DomUtil.create('div', 'photon-autocomplete', container)
    this.search = new U.Search(this.map, input, options)
    const id = Math.random()
    this.search.on('ajax:send', () => {
      this.map.fire('dataloading', { id: id })
    })
    this.search.on('ajax:return', () => {
      this.map.fire('dataload', { id: id })
    })
    this.search.resultsContainer = resultsContainer
    this.map._umap.panel.open({ content: container }).then(input.focus())
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

L.Control.Loading.include({
  onAdd: function (map) {
    this._container = L.DomUtil.create('div', 'umap-loader', map._controlContainer)
    map.on('baselayerchange', this._layerAdd, this)
    this._addMapListeners(map)
    this._map = map
  },

  _showIndicator: function () {
    this._map._container.classList.add('umap-loading')
  },

  _hideIndicator: function () {
    this._map._container.classList.remove('umap-loading')
  },
})

U.Editable = L.Editable.extend({
  initialize: function (umap, options) {
    this._umap = umap
    L.Editable.prototype.initialize.call(this, umap._leafletMap, options)
    this.on('editable:drawing:click editable:drawing:move', this.drawingTooltip)
    // Layer for items added by users
    this.on('editable:drawing:cancel', (event) => {
      if (event.layer instanceof U.LeafletMarker) event.layer.feature.del()
    })
    this.on('editable:drawing:commit', function (event) {
      event.layer.feature.isDirty = true
      if (this._umap.editedFeature !== event.layer) event.layer.feature.edit(event)
    })
    this.on('editable:editing', (event) => {
      const feature = event.layer.feature
      feature.isDirty = true
      feature.pullGeometry(false)
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

  createPolyline: function (latlngs) {
    const datalayer = this._umap.defaultEditDataLayer()
    const point = new U.LineString(this._umap, datalayer, {
      geometry: { type: 'LineString', coordinates: [] },
    })
    return point.ui
  },

  createPolygon: function (latlngs) {
    const datalayer = this._umap.defaultEditDataLayer()
    const point = new U.Polygon(this._umap, datalayer, {
      geometry: { type: 'Polygon', coordinates: [] },
    })
    return point.ui
  },

  createMarker: function (latlng) {
    const datalayer = this._umap.defaultEditDataLayer()
    const point = new U.Point(this._umap, datalayer, {
      geometry: { type: 'Point', coordinates: [latlng.lng, latlng.lat] },
    })
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
    layer.isDirty = true
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
    e.layer.onVertexRawClick(e)
    L.DomEvent.stop(e)
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
      if (!event.layer.feature.hasGeom()) {
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
