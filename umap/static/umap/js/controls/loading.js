L.Control.Loading.include({
  onAdd: function (map) {
    this._container = L.DomUtil.create('div', 'umap-loader', map._controlContainer)
    map.on('baselayerchange', this._layerAdd, this)
    this._addMapListeners(map)
    this._map = map
  },

  _showIndicator: function () {
    L.DomUtil.addClass(this._map._container, 'umap-loading')
  },

  _hideIndicator: function () {
    L.DomUtil.removeClass(this._map._container, 'umap-loading')
  },
})