L.U.Search = L.PhotonSearch.extend({
  initialize: function (map, input, options) {
    L.PhotonSearch.prototype.initialize.call(this, map, input, options)
    this.options.url = map.options.urls.search
    if (map.options.maxBounds) this.options.bbox = map.options.maxBounds.toBBoxString()
  },

  onBlur: function (e) {
    // Overrided because we don't want to hide the results on blur.
    this.fire('blur')
  },

  formatResult: function (feature, el) {
    const self = this
    const tools = L.DomUtil.create('span', 'search-result-tools', el),
      zoom = L.DomUtil.create('i', 'feature-zoom_to', tools),
      edit = L.DomUtil.create('i', 'feature-edit show-on-edit', tools)
    zoom.title = L._('Zoom to this place')
    edit.title = L._('Save this location as new feature')
    // We need to use "mousedown" because Leaflet.Photon listen to mousedown
    // on el.
    L.DomEvent.on(zoom, 'mousedown', (e) => {
      L.DomEvent.stop(e)
      self.zoomToFeature(feature)
    })
    L.DomEvent.on(edit, 'mousedown', (e) => {
      L.DomEvent.stop(e)
      const datalayer = self.map.defaultEditDataLayer()
      const layer = datalayer.geojsonToFeatures(feature)
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
    this.map.ui.closePanel()
  },
})


L.U.SearchControl = L.Control.extend({
  options: {
    position: 'topleft',
  },

  onAdd: function (map) {
    const container = L.DomUtil.create('div', 'leaflet-control-search umap-control')
    L.DomEvent.disableClickPropagation(container)
    L.DomUtil.createButton(
      '',
      container,
      L._('Search a place name'),
      (e) => {
        L.DomEvent.stop(e)
        this.openPanel(map)
      },
      this
    )
    return container
  },

  openPanel: function (map) {
    const options = {
      limit: 10,
      noResultLabel: L._('No results'),
    }
    if (map.options.photonUrl) options.url = map.options.photonUrl
    const container = L.DomUtil.create('div', '')

    const title = L.DomUtil.create('h3', '', container)
    title.textContent = L._('Search location')
    const input = L.DomUtil.create('input', 'photon-input', container)
    const resultsContainer = L.DomUtil.create('div', 'photon-autocomplete', container)
    this.search = new L.U.Search(map, input, options)
    const id = Math.random()
    this.search.on('ajax:send', () => {
      map.fire('dataloading', { id: id })
    })
    this.search.on('ajax:return', () => {
      map.fire('dataload', { id: id })
    })
    this.search.resultsContainer = resultsContainer
    map.ui.once('panel:ready', () => {
      input.focus()
    })
    map.ui.openPanel({ data: { html: container } })
  },
})