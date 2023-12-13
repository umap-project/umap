L.U.MoreControls = L.Control.extend({
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
    const pos = this.getPosition(),
      corner = this._map._controlCorners[pos],
      className = 'umap-more-controls'
    if (L.DomUtil.hasClass(corner, className)) L.DomUtil.removeClass(corner, className)
    else L.DomUtil.addClass(corner, className)
  },
})