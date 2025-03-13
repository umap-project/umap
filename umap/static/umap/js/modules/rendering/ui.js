// Goes here all code related to Leaflet, DOM and user interactions.
import {
  Marker,
  Polyline,
  Polygon,
  CircleMarker as BaseCircleMarker,
  DomUtil,
  LineUtil,
  latLng,
  LatLng,
  LatLngBounds,
  DomEvent,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../i18n.js'
import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import * as Utils from '../utils.js'
import * as Icon from './icon.js'

const FeatureMixin = {
  initialize: function (feature, latlngs) {
    this.feature = feature
    this.parentClass.prototype.initialize.call(this, latlngs)
  },

  onAdd: function (map) {
    this.addInteractions()
    return this.parentClass.prototype.onAdd.call(this, map)
  },

  onRemove: function (map) {
    this.parentClass.prototype.onRemove.call(this, map)
    if (map._umap.editedFeature === this.feature) {
      this.feature.endEdit()
      map._umap.editPanel.close()
    }
  },

  _removeIcon: function () {
    // It may not be in the DOM, and Leaflet does not deal with this
    // situation
    if (this._icon) Marker.prototype._removeIcon.call(this)
  },

  addInteractions: function () {
    this.on('contextmenu editable:vertex:contextmenu', this.onContextMenu)
    this.on('click', this.onClick)
    this.on('editable:edited', this.onCommit)
  },

  onClick: function (event) {
    if (this._map.measureTools?.enabled()) return
    this._popupHandlersAdded = true // Prevent leaflet from managing event
    if (!this._map._umap.editEnabled) {
      this.feature.view(event)
    } else if (!this.feature.isReadOnly()) {
      if (event.originalEvent.shiftKey) {
        if (event.originalEvent.ctrlKey || event.originalEvent.metaKey) {
          this.feature.datalayer.edit(event)
        } else {
          this.feature.toggleEditing(event)
        }
      } else if (!this._map.editTools?.drawing()) {
        this._map._umap.editContextmenu.open(
          event.originalEvent,
          this.feature.getInplaceEditMenu(event)
        )
      }
    }
    DomEvent.stop(event)
  },

  resetTooltip: function () {
    if (!this.feature.hasGeom()) return
    const displayName = this.feature.getDisplayName()
    let showLabel = this.feature.getOption('showLabel')
    const oldLabelHover = this.feature.getOption('labelHover')

    const options = {
      direction: this.feature.getOption('labelDirection'),
      interactive: this.feature.getOption('labelInteractive'),
    }

    if (oldLabelHover && showLabel) showLabel = null // Retrocompat.
    options.permanent = showLabel === true
    this.unbindTooltip()
    if ((showLabel === true || showLabel === null) && displayName) {
      this.bindTooltip(Utils.escapeHTML(displayName), options)
    }
  },

  onContextMenu: function (event) {
    DomEvent.stop(event)
    const items = this.feature
      .getContextMenuItems(event)
      .concat(this._map._umap.getSharedContextMenuItems(event))
    this._map._umap.contextmenu.open(event.originalEvent, items)
  },

  onCommit: function () {
    this.feature.onCommit()
  },
}

const PointMixin = {
  isOnScreen: function (bounds) {
    return bounds.contains(this.getCenter())
  },

  addInteractions() {
    FeatureMixin.addInteractions.call(this)
    this.on('dragend', (event) => {
      this.isDirty = true
      this.feature.edit(event)
      // this.feature.pullGeometry(false)
    })
    if (!this.feature.isReadOnly()) this.on('mouseover', this._enableDragging)
    this.on('mouseout', this._onMouseOut)
  },

  _onMouseOut: function () {
    if (this.dragging?._draggable && !this.dragging._draggable._moving) {
      // Do not disable if the mouse went out while dragging
      this._disableDragging()
    }
  },

  _enableDragging: function () {
    // TODO: start dragging after 1 second on mouse down
    if (this._map._umap.editEnabled) {
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
    if (this._map._umap.editEnabled) {
      if (this.editor?.drawing) return // when creating a new marker, the mouse can trigger the mouseover/mouseout event
      // do not listen to them
      this.disableEdit()
    }
  },
}

export const LeafletMarker = Marker.extend({
  parentClass: Marker,
  includes: [FeatureMixin, PointMixin],

  initialize: function (feature, latlng) {
    FeatureMixin.initialize.call(this, feature, latlng)
    this.setIcon(this.getIcon())
  },

  getClass: () => LeafletMarker,

  setLatLngs: function (latlng) {
    return this.setLatLng(latlng)
  },

  getEvents: function () {
    const events = Marker.prototype.getEvents.call(this)
    events.moveend = this.onMoveEnd
    return events
  },

  addInteractions() {
    PointMixin.addInteractions.call(this)
    this._popupHandlersAdded = true // prevent Leaflet from binding event on bindPopup
    this.on('popupopen', this.highlight)
    this.on('popupclose', this.resetHighlight)
  },

  onMoveEnd: function () {
    this._initIcon()
    this.update()
  },

  _initIcon: function () {
    if (!this._map.getBounds().contains(this.getCenter())) {
      if (this._icon) this._removeIcon()
      if (this._tooltip && this.isTooltipOpen()) {
        this.unbindTooltip()
      }
      return
    }
    this.options.icon = this.getIcon()
    Marker.prototype._initIcon.call(this)
    // Allow to run code when icon is actually part of the DOM
    this.options.icon.onAdd()
    this.resetTooltip()
  },

  getIconClass: function () {
    return this.feature.getOption('iconClass')
  },

  getIcon: function () {
    const Class = Icon.getClass(this.getIconClass())
    return new Class({ feature: this.feature })
  },

  _getTooltipAnchor: function () {
    const anchor = this.options.icon.options.tooltipAnchor.clone()
    const direction = this.feature.getOption('labelDirection')
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
    // May no be on the map when in a cluster.
    if (this._map) {
      this._initIcon()
      this.update()
    }
  },

  getCenter: function () {
    return this._latlng
  },

  highlight: function () {
    this.feature.activate()
    this._redraw()
    this._bringToFront()
  },

  resetHighlight: function () {
    this.feature.deactivate()
    this._redraw()
    this._resetZIndex()
  },
})

const PathMixin = {
  _onMouseOver: function () {
    if (this._map.measureTools?.enabled()) {
      this._map._umap.tooltip.open({ content: this.getMeasure(), anchor: this })
    } else if (this._map._umap.editEnabled && !this._map._umap.editedFeature) {
      this._map._umap.tooltip.open({
        content: translate('Click to edit'),
        anchor: this,
      })
    }
  },

  makeGeometryEditable: function () {
    // Feature has been removed since then?
    if (!this._map) return
    if (this._map._umap.editedFeature !== this.feature) {
      this.disableEdit()
      return
    }
    this._map.once('moveend', this.makeGeometryEditable, this)
    const pointsCount = this._parts.reduce((acc, part) => acc + part.length, 0)
    if (pointsCount > 100 && this._map.getZoom() < this._map.getMaxZoom()) {
      this._map._umap.tooltip.open({
        content: L._('Please zoom in to edit the geometry'),
      })
      this.disableEdit()
    } else {
      this.enableEdit()
    }
  },

  addInteractions: function () {
    FeatureMixin.addInteractions.call(this)
    this.on('mouseover', this._onMouseOver)
    this.on('drag editable:drag', this._onDrag)
    this.on('popupopen', this.highlightPath)
    this.on('popupclose', this._redraw)
  },

  bindTooltip: function (content, options) {
    options.sticky = !options.permanent
    this.parentClass.prototype.bindTooltip.call(this, content, options)
  },

  highlightPath: function () {
    this.parentClass.prototype.setStyle.call(this, {
      fillOpacity: Math.sqrt(this.feature.getDynamicOption('fillOpacity', 1.0)),
      opacity: 1.0,
      weight: 1.3 * this.feature.getDynamicOption('weight'),
    })
  },

  _onDrag: function () {
    if (this._tooltip) this._tooltip.setLatLng(this.getCenter())
  },

  onAdd: function (map) {
    this._container = null
    FeatureMixin.onAdd.call(this, map)
    this.setStyle()
    if (this.editor?.enabled()) this.editor.addHooks()
    this.resetTooltip()
    this._path.dataset.feature = this.feature.id
  },

  onRemove: function (map) {
    if (this.editor?.enabled()) this.editor.removeHooks()
    FeatureMixin.onRemove.call(this, map)
  },

  setStyle: function (options = {}) {
    for (const option of this.getStyleOptions()) {
      options[option] = this.feature.getDynamicOption(option)
    }
    options.pointerEvents = options.interactive ? 'visiblePainted' : 'stroke'
    this.parentClass.prototype.setStyle.call(this, options)
    // TODO remove me when this gets merged and released:
    // https://github.com/Leaflet/Leaflet/pull/9475

    this._path.classList.toggle('leaflet-interactive', options.interactive)
  },

  _redraw: function () {
    this.setStyle()
    this.resetTooltip()
  },

  onVertexRawClick: function (event) {
    this._map._umap.editContextmenu.open(
      event.originalEvent,
      this.feature.getInplaceEditVertexMenu(event)
    )
  },

  isolateShape: function (atLatLng) {
    if (!this.feature.isMulti()) return
    const shape = this.enableEdit().deleteShapeAt(atLatLng)
    this.feature.pullGeometry()
    this.disableEdit()
    if (!shape) return
    return this.feature.isolateShape(shape)
  },

  getStyleOptions: () => [
    'smoothFactor',
    'color',
    'opacity',
    'stroke',
    'weight',
    'fill',
    'fillColor',
    'fillOpacity',
    'dashArray',
    'interactive',
  ],

  isOnScreen: function (bounds) {
    return bounds.overlaps(this.getBounds())
  },

  _setLatLngs: function (latlngs) {
    this.parentClass.prototype._setLatLngs.call(this, latlngs)
    if (this.editor?.enabled()) {
      this.editor.reset()
    }
  },
}

export const LeafletPolyline = Polyline.extend({
  parentClass: Polyline,
  includes: [FeatureMixin, PathMixin],

  getClass: () => LeafletPolyline,

  getMeasure: function (shape) {
    let shapes
    if (shape) {
      shapes = [shape]
    } else if (LineUtil.isFlat(this._latlngs)) {
      shapes = [this._latlngs]
    } else {
      shapes = this._latlngs
    }
    // FIXME: compute from data in feature (with TurfJS)
    const length = shapes.reduce(
      (acc, shape) => acc + L.GeoUtil.lineLength(this._map, shape),
      0
    )
    return L.GeoUtil.readableDistance(length, this._map.measureTools.getMeasureUnit())
  },

  getElevation: function () {
    const lineElevation = (latlngs) => {
      let gain = 0
      let loss = 0
      for (let i = 0, n = latlngs.length - 1; i < n; i++) {
        const fromAlt = latlngs[i].alt
        const toAlt = latlngs[i + 1].alt
        if (fromAlt === undefined || toAlt === undefined) continue
        if (fromAlt > toAlt) loss += fromAlt - toAlt
        else gain += toAlt - fromAlt
      }
      return [gain, loss]
    }
    let shapes
    if (LineUtil.isFlat(this._latlngs)) {
      shapes = [this._latlngs]
    } else {
      shapes = this._latlngs
    }
    let totalGain = 0
    let totalLoss = 0
    for (const shape of shapes) {
      const [gain, loss] = lineElevation(shape)
      totalGain += gain
      totalLoss += loss
    }
    return [Math.round(totalGain), Math.round(totalLoss)]
  },
})

export const LeafletPolygon = Polygon.extend({
  parentClass: Polygon,
  includes: [FeatureMixin, PathMixin],

  getClass: () => LeafletPolygon,

  startHole: function (event) {
    this.enableEdit().newHole(event.latlng)
  },

  getMeasure: function (shape) {
    const area = L.GeoUtil.geodesicArea(shape || this._defaultShape())
    return L.GeoUtil.readableArea(area, this._map.measureTools.getMeasureUnit())
  },
})
const WORLD = [
  latLng([90, 180]),
  latLng([90, -180]),
  latLng([-90, -180]),
  latLng([-90, 180]),
]

export const MaskPolygon = LeafletPolygon.extend({
  getClass: () => MaskPolygon,

  getLatLngs: function () {
    // Exclude World coordinates.
    return LeafletPolygon.prototype.getLatLngs.call(this).slice(1)
  },

  _setLatLngs: function (latlngs) {
    const newLatLngs = []
    newLatLngs.push(WORLD)

    if (!this.feature.isMulti()) {
      latlngs = [latlngs]
    }
    for (const ring of latlngs) {
      newLatLngs.push(ring)
    }
    LeafletPolygon.prototype._setLatLngs.call(this, newLatLngs)
    this._bounds = new LatLngBounds(latlngs)
  },

  _defaultShape: function () {
    // Do not compute with world coordinates (eg. for centering the popup).
    return this._latlngs[1]
  },
})

export const CircleMarker = BaseCircleMarker.extend({
  parentClass: BaseCircleMarker,
  includes: [FeatureMixin, PathMixin, PointMixin],
  initialize: function (feature, latlng) {
    if (Array.isArray(latlng) && !(latlng[0] instanceof Number)) {
      // Must be a line or polygon
      const bounds = new LatLngBounds(latlng)
      latlng = bounds.getCenter()
    }
    FeatureMixin.initialize.call(this, feature, latlng)
  },
  getClass: () => CircleMarker,
  getStyleOptions: function () {
    const options = PathMixin.getStyleOptions.call(this)
    options.push('radius')
    return options
  },
  getCenter: function () {
    return this._latlng
  },
})
