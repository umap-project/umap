L.U.StarControl = L.Control.extend({
  options: {
    position: 'topleft',
  },

  onAdd: function (map) {
    const status = map.options.starred ? ' starred' : ''
    const container = L.DomUtil.create(
      'div',
      `leaflet-control-star umap-control${status}`
    )
    const starMapButton = L.DomUtil.createButton(
      '',
      container,
      L._('Star this map'),
      map.star,
      map
    )
    L.DomEvent.on(starMapButton, 'dblclick', L.DomEvent.stopPropagation)
    return container
  },
})