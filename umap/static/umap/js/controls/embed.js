/* Share control */
L.Control.Embed = L.Control.extend({
    options: {
      position: 'topleft',
    },
  
    onAdd: function (map) {
      const container = L.DomUtil.create('div', 'leaflet-control-embed umap-control')
      const shareButton = L.DomUtil.createButton(
        '',
        container,
        L._('Embed and share this map'),
        map.renderShareBox,
        map
      )
      L.DomEvent.on(shareButton, 'dblclick', L.DomEvent.stopPropagation)
      return container
    },
  })