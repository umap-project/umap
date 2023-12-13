L.U.BaseAction = L.ToolbarAction.extend({
  initialize: function (map) {
    this.map = map
    this.options.toolbarIcon = {
      className: this.options.className,
      tooltip: this.options.tooltip,
    }
    L.ToolbarAction.prototype.initialize.call(this)
    if (this.options.helpMenu && !this.map.helpMenuActions[this.options.className])
      this.map.helpMenuActions[this.options.className] = this
  },
})

L.U.ImportAction = L.U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'upload-data dark',
    tooltip: `${L._('Import data')} (Ctrl+I)`,
  },

  addHooks: function () {
    this.map.importer.open()
  },
})

L.U.EditPropertiesAction = L.U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'update-map-settings dark',
    tooltip: L._('Edit map settings'),
  },

  addHooks: function () {
    this.map.edit()
  },
})

L.U.ChangeTileLayerAction = L.U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'dark update-map-tilelayers',
    tooltip: L._('Change tilelayers'),
  },

  addHooks: function () {
    this.map.updateTileLayers()
  },
})

L.U.ManageDatalayersAction = L.U.BaseAction.extend({
  options: {
    className: 'dark manage-datalayers',
    tooltip: L._('Manage layers'),
  },

  addHooks: function () {
    this.map.manageDatalayers()
  },
})

L.U.UpdateExtentAction = L.U.BaseAction.extend({
  options: {
    className: 'update-map-extent dark',
    tooltip: L._('Save this center and zoom'),
  },

  addHooks: function () {
    this.map.updateExtent()
  },
})

L.U.UpdatePermsAction = L.U.BaseAction.extend({
  options: {
    className: 'update-map-permissions dark',
    tooltip: L._('Update permissions and editors'),
  },

  addHooks: function () {
    this.map.permissions.edit()
  },
})

L.U.DrawMarkerAction = L.U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'umap-draw-marker dark',
    tooltip: `${L._('Draw a marker')} (Ctrl+M)`,
  },

  addHooks: function () {
    this.map.startMarker()
  },
})

L.U.DrawPolylineAction = L.U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'umap-draw-polyline dark',
    tooltip: `${L._('Draw a polyline')} (Ctrl+L)`,
  },

  addHooks: function () {
    this.map.startPolyline()
  },
})

L.U.DrawPolygonAction = L.U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'umap-draw-polygon dark',
    tooltip: `${L._('Draw a polygon')} (Ctrl+P)`,
  },

  addHooks: function () {
    this.map.startPolygon()
  },
})

L.U.AddPolylineShapeAction = L.U.BaseAction.extend({
  options: {
    className: 'umap-draw-polyline-multi dark',
    tooltip: L._('Add a line to the current multi'),
  },

  addHooks: function () {
    this.map.editedFeature.editor.newShape()
  },
})

L.U.AddPolygonShapeAction = L.U.AddPolylineShapeAction.extend({
  options: {
    className: 'umap-draw-polygon-multi dark',
    tooltip: L._('Add a polygon to the current multi'),
  },
})

L.U.BaseFeatureAction = L.ToolbarAction.extend({
  initialize: function (map, feature, latlng) {
    this.map = map
    this.feature = feature
    this.latlng = latlng
    L.ToolbarAction.prototype.initialize.call(this)
    this.postInit()
  },

  postInit: function () {},

  hideToolbar: function () {
    this.map.removeLayer(this.toolbar)
  },

  addHooks: function () {
    this.onClick({ latlng: this.latlng })
    this.hideToolbar()
  },
})

L.U.CreateHoleAction = L.U.BaseFeatureAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-new-hole',
      tooltip: L._('Start a hole here'),
    },
  },

  onClick: function (e) {
    this.feature.startHole(e)
  },
})

L.U.ToggleEditAction = L.U.BaseFeatureAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-toggle-edit',
      tooltip: L._('Toggle edit mode (⇧+Click)'),
    },
  },

  onClick: function (e) {
    if (this.feature._toggleEditing) this.feature._toggleEditing(e) // Path
    else this.feature.edit(e) // Marker
  },
})

L.U.DeleteFeatureAction = L.U.BaseFeatureAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-delete-all',
      tooltip: L._('Delete this feature'),
    },
  },

  postInit: function () {
    if (!this.feature.isMulti())
      this.options.toolbarIcon.className = 'umap-delete-one-of-one'
  },

  onClick: function (e) {
    this.feature.confirmDelete(e)
  },
})

L.U.DeleteShapeAction = L.U.BaseFeatureAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-delete-one-of-multi',
      tooltip: L._('Delete this shape'),
    },
  },

  onClick: function (e) {
    this.feature.enableEdit().deleteShapeAt(e.latlng)
  },
})

L.U.ExtractShapeFromMultiAction = L.U.BaseFeatureAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-extract-shape-from-multi',
      tooltip: L._('Extract shape to separate feature'),
    },
  },

  onClick: function (e) {
    this.feature.isolateShape(e.latlng)
  },
})

L.U.BaseVertexAction = L.U.BaseFeatureAction.extend({
  initialize: function (map, feature, latlng, vertex) {
    this.vertex = vertex
    L.U.BaseFeatureAction.prototype.initialize.call(this, map, feature, latlng)
  },
})

L.U.DeleteVertexAction = L.U.BaseVertexAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-delete-vertex',
      tooltip: L._('Delete this vertex (Alt+Click)'),
    },
  },

  onClick: function () {
    this.vertex.delete()
  },
})

L.U.SplitLineAction = L.U.BaseVertexAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-split-line',
      tooltip: L._('Split line'),
    },
  },

  onClick: function () {
    this.vertex.split()
  },
})

L.U.ContinueLineAction = L.U.BaseVertexAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-continue-line',
      tooltip: L._('Continue line'),
    },
  },

  onClick: function () {
    this.vertex.continue()
  },
})