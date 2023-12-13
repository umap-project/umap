L.U.EditControl = L.Control.extend({
    options: {
      position: 'topright',
    },
  
    onAdd: function (map) {
      const container = L.DomUtil.create('div', 'leaflet-control-edit-enable')
      const enableEditing = L.DomUtil.createButton(
        '',
        container,
        L._('Edit'),
        map.enableEdit,
        map
      )
      L.DomEvent.on(
        enableEditing,
        'mouseover',
        function () {
          map.ui.tooltip({
            content: `${L._('Switch to edit mode')} (<kbd>Ctrl+E</kbd>)`,
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