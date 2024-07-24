import {
  Marker,
  Polyline,
  Polygon,
  DomUtil,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../i18n.js'

const FeatureMixin = {
  initialize: function (feature) {
    this.feature = feature
    this.parentClass.prototype.initialize.call(this, this.feature.coordinates)
  },

  onAdd: function (map) {
    this.addInteractions()
    return this.parentClass.prototype.onAdd.call(this, map)
  },

  onRemove: function (map) {
    this.parentClass.prototype.onRemove.call(this, map)
    if (map.editedFeature === this.feature) {
      this.feature._marked_for_deletion = true
      this.feature.endEdit()
      map.editPanel.close()
    }
  },

  addInteractions: function () {
    this.on('contextmenu editable:vertex:contextmenu', this.feature._showContextMenu, this.feature)
  },

  onVertexRawClick: function (e) {
    new L.Toolbar.Popup(e.latlng, {
      className: 'leaflet-inplace-toolbar',
      actions: this.getVertexActions(e),
    }).addTo(this.map, this, e.latlng, e.vertex)
  },
}

export const LeafletMarker = Marker.extend({
  parentClass: Marker,
  includes: [FeatureMixin],

  initialize: function (feature) {
    FeatureMixin.initialize.call(this, feature)
    this.setIcon(this.getIcon())
  },

  onCommit: function () {
    this.feature.coordinates = this._latlng
    this.feature.onCommit()
  },

  addInteractions() {
    FeatureMixin.addInteractions.call(this)
    this.on(
      'dragend',
      function (e) {
        this.isDirty = true
        this.feature.edit(e)
        this.feature.sync.update('geometry', this.getGeometry())
      },
      this
    )
    this.on('editable:drawing:commit', this.onCommit)
    if (!this.feature.isReadOnly()) this.on('mouseover', this._enableDragging)
    this.on('mouseout', this._onMouseOut)
    this._popupHandlersAdded = true // prevent Leaflet from binding event on bindPopup
    this.on('popupopen', this.highlight)
    this.on('popupclose', this.resetHighlight)
  },

  _onMouseOut: function () {
    if (this.dragging?._draggable && !this.dragging._draggable._moving) {
      // Do not disable if the mouse went out while dragging
      this._disableDragging()
    }
  },

  _enableDragging: function () {
    // TODO: start dragging after 1 second on mouse down
    if (this._map.editEnabled) {
      if (!this.editEnabled()) this.enableEdit()
      // Enabling dragging on the marker override the Draggable._OnDown
      // event, which, as it stopPropagation, refrain the call of
      // _onDown with map-pane element, which is responsible to
      // set the _moved to false, and thus to enable the click.
      // We should find a cleaner way to handle this.
      this._map.dragging._draggable._moved = false
    }
  },

  _disableDragging: function () {
    if (this._map.editEnabled) {
      if (this.editor?.drawing) return // when creating a new marker, the mouse can trigger the mouseover/mouseout event
      // do not listen to them
      this.disableEdit()
    }
  },

  _initIcon: function () {
    this.options.icon = this.getIcon()
    Marker.prototype._initIcon.call(this)
    // Allow to run code when icon is actually part of the DOM
    this.options.icon.onAdd()
    // this.resetTooltip()
  },

  getIconClass: function () {
    return this.feature.getOption('iconClass')
  },

  getIcon: function () {
    const Class = U.Icon[this.getIconClass()] || U.Icon.Default
    return new Class({ feature: this.feature })
  },

  _getTooltipAnchor: function () {
    const anchor = this.options.icon.options.tooltipAnchor.clone()
    const direction = this.getOption('labelDirection')
    if (direction === 'left') {
      anchor.x *= -1
    } else if (direction === 'bottom') {
      anchor.x = 0
      anchor.y = 0
    } else if (direction === 'top') {
      anchor.x = 0
    }
    return anchor
  },

  _redraw: function () {
    this._initIcon()
    this.update()
  },

  getCenter: function () {
    return this._latlng
  },
})

const PathMixin = {
  _onMouseOver: function () {
    if (this._map.measureTools?.enabled()) {
      this._map.tooltip.open({ content: this.feature.getMeasure(), anchor: this })
    } else if (this._map.editEnabled && !this._map.editedFeature) {
      this._map.tooltip.open({ content: translate('Click to edit'), anchor: this })
    }
  },

  onCommit: function () {
    this.feature.coordinates = this._latlngs
    this.feature.onCommit()
  },

  addInteractions: function () {
    FeatureMixin.addInteractions.call(this)
    this.on('editable:disable', this.onCommit)
    this.on('mouseover', this._onMouseOver)
    this.on('drag editable:drag', this._onDrag)
    this.on('popupopen', this.highlightPath)
    this.on('popupclose', this._redraw)
  },

  highlightPath: function () {
    this.parentClass.prototype.setStyle.call(this, {
      fillOpacity: Math.sqrt(this.feature.getDynamicOption('fillOpacity', 1.0)),
      opacity: 1.0,
      weight: 1.3 * this.feature.getDynamicOption('weight'),
    })
  },

  _onDrag: function () {
    this.feature.coordinates = this._latlngs
    if (this._tooltip) this._tooltip.setLatLng(this.getCenter())
  },

  onAdd: function (map) {
    this._container = null
    this.setStyle()
    FeatureMixin.onAdd.call(this, map)
    if (this.editing?.enabled()) this.editing.addHooks()
    // this.resetTooltip()
    this._path.dataset.feature = this.feature.id
  },

  onRemove: function (map) {
    if (this.editing?.enabled()) this.editing.removeHooks()
    FeatureMixin.onRemove.call(this, map)
  },

  setStyle: function (options = {}) {
    for (const option of this.feature.getStyleOptions()) {
      options[option] = this.feature.getDynamicOption(option)
    }
    options.pointerEvents = options.interactive ? 'visiblePainted' : 'stroke'
    this.parentClass.prototype.setStyle.call(this, options)
  },

  _redraw: function () {
    this.setStyle()
    // this.resetTooltip()
  },
}

export const LeafletPolyline = Polyline.extend({
  parentClass: Polyline,
  includes: [FeatureMixin, PathMixin],
})

export const LeafletPolygon = Polygon.extend({
  parentClass: Polygon,
  includes: [FeatureMixin, PathMixin],
})
