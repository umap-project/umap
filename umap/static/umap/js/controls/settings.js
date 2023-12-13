// Leaflet.Toolbar doesn't allow twice same toolbar class…
L.U.SettingsToolbar = L.Toolbar.Control.extend({
  addTo: function (map) {
    if (map.options.editMode !== 'advanced') return
    L.Toolbar.Control.prototype.addTo.call(this, map)
  },
})