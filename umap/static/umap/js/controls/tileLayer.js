L.U.TileLayerControl = L.Control.extend({
  options: {
    position: 'topleft',
  },

  initialize: function (map, options) {
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

  openSwitcher: function (options) {
    this._tilelayers_container = L.DomUtil.create(
      'ul',
      'umap-tilelayer-switcher-container'
    )
    this.buildList(options)
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
    this.map.ui.openPanel({
      data: { html: this._tilelayers_container },
      className: options.className,
    })
  },

  addTileLayerElement: function (tilelayer, options) {
    const selectedClass = this.map.hasLayer(tilelayer) ? 'selected' : '',
      el = L.DomUtil.create('li', selectedClass, this._tilelayers_container),
      img = L.DomUtil.create('img', '', el),
      name = L.DomUtil.create('div', '', el)
    img.src = L.Util.template(tilelayer.options.url_template, this.map.demoTileInfos)
    img.loading = 'lazy'
    name.textContent = tilelayer.options.name
    L.DomEvent.on(
      el,
      'click',
      function () {
        this.map.selectTileLayer(tilelayer)
        if (options && options.callback) options.callback(tilelayer)
      },
      this
    )
  },
})