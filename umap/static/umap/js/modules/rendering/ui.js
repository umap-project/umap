// Goes here all code related to Leaflet, DOM and user interactions.
import {
  CircleMarker as BaseCircleMarker,
  DivIcon,
  DomEvent,
  GeoJSON,
  LatLng,
  LatLngBounds,
  LineUtil,
  Marker,
  Polygon,
  Polyline,
  latLng,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import * as GeoUtils from '../geoutils.js'
import { translate } from '../i18n.js'
import * as Icon from '../icon.js'
import * as Utils from '../utils.js'
import * as TextUtils from '../textutils.js'

const FeatureMixin = {
  initialize: function (latlngs) {
    this.parentClass.prototype.initialize.call(this, latlngs)
  },

  onAdd: function (map) {
    this.addInteractions()
    return this.parentClass.prototype.onAdd.call(this, map)
  },

  onRemove: function (map) {
    this.removeInteractions()
    this.parentClass.prototype.onRemove.call(this, map)
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
    // this.on('mouseover', this.onMouseOver)
  },

  removeInteractions: function () {
    this.off('contextmenu editable:vertex:contextmenu', this.onContextMenu)
    this.off('click', this.onClick)
    this.off('editable:edited', this.onCommit)
    // this.off('mouseover', this.onMouseOver)
  },

  onMouseOver: function () {
    this._map.fire('feature:mouseover')
  },

  onClick: function (event) {
    this._map.fire('feature:click', {
      id: this.feature.id,
      layer: this,
      latlng: event.latlng,
      originalEvent: event.originalEvent,
    })
    // if (this._map.measureTools?.enabled()) return
    // this._popupHandlersAdded = true // Prevent leaflet from managing event
    // if (event.originalEvent.shiftKey) {
    //   if (event.originalEvent.ctrlKey || event.originalEvent.metaKey) {
    //     this.feature.datalayer.edit(event)
    //   } else if (!this.feature.isReadOnly()) {
    //     this.feature.toggleEditing(event)
    //   }
    // } else if (!this._map.editTools?.drawing()) {
    //   this.feature.view(event)
    // }
    DomEvent.stop(event)
  },

  // resetTooltip: function () {
  //   if (!this.feature.hasGeom()) return
  //   const displayName = this.feature.getDisplayName()
  //   let showLabel = this.feature.getOption('showLabel')
  //   const oldLabelHover = this.feature.getOption('labelHover')

  //   const options = {
  //     direction: this.feature.getOption('labelDirection'),
  //     interactive: this.feature.getOption('labelInteractive'),
  //   }

  //   if (oldLabelHover && showLabel) showLabel = null // Retrocompat.
  //   options.permanent = showLabel === true
  //   this.unbindTooltip()
  //   if ((showLabel === true || showLabel === null) && displayName) {
  //     this.bindTooltip(Utils.escapeHTML(displayName), options)
  //   }
  // },

  onContextMenu: function (event) {
    DomEvent.stop(event)
    const items = this.feature
      .getContextMenu(event)
      .concat(this.feature._umap.getSharedContextMenu(event))
    this.feature._umap.contextmenu.open(event.originalEvent, items)
  },

  onCommit: function () {
    this.feature.onCommit(this.toGeometry())
  },

  isVisible() {
    return Boolean(this._map?.hasLayer(this))
  },
}

export const LeafletIcon = DivIcon.extend({
  initialize: function (umapIcon) {
    this.umapIcon = umapIcon
    DivIcon.prototype.initialize.call(this, {
      iconSize: umapIcon.size,
      iconAnchor: umapIcon.anchor,
      popupAnchor: umapIcon.popupAnchor,
      tooltipAnchor: umapIcon.tooltipAnchor,
      className: umapIcon.className,
    })
  },
  createIcon: function () {
    const el = this.umapIcon.render()
    this._setIconStyles(el, 'icon')
    return el
  },
  createShadow: () => {},
})

const PointMixin = {
  toGeometry: function () {
    return {
      type: 'Point',
      coordinates: GeoJSON.latLngToCoords(this.getLatLng()),
    }
  },

  isOnScreen: function (bounds) {
    bounds = bounds || this._map.getBounds()
    return bounds.contains(this.getCenter())
  },

  addInteractions() {
    FeatureMixin.addInteractions.call(this)
    this.on('dragend', this._onDragEnd)
    // FIXME pass readonly in the geojson?
    //if (!this.feature.isReadOnly()) this.on('mouseover', this._enableDragging)
    this.on('mouseout', this._onMouseOut)
  },

  removeInteractions() {
    FeatureMixin.removeInteractions.call(this)
    this.off('dragend', this._onDragEnd)
    if (!this.feature.isReadOnly()) this.off('mouseover', this._enableDragging)
    this.off('mouseout', this._onMouseOut)
  },

  _onDragEnd(event) {
    if (this._cluster) {
      delete this._originalLatLng
      this.once('editable:edited', () => {
        this.feature.datalayer.dataChanged()
        this.feature.edit(event)
      })
    }
  },

  _onMouseOut: function () {
    if (this.dragging?._draggable && !this.dragging._draggable._moving) {
      // Do not disable if the mouse went out while dragging
      this._disableDragging()
    }
  },

  _enableDragging: function () {
    // TODO: start dragging after 1 second on mouse down
    if (this.feature._umap.editEnabled) {
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
    if (this.feature._umap.editEnabled) {
      if (this.editor?.drawing) return // when creating a new marker, the mouse can trigger the mouseover/mouseout event
      // do not listen to them
      this.disableEdit()
    }
  },
}

export const LeafletMarker = Marker.extend({
  parentClass: Marker,
  includes: [FeatureMixin, PointMixin],

  initialize: function (latlng, geojson) {
    this.geojson = geojson
    FeatureMixin.initialize.call(this, latlng)
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

  removeInteractions() {
    PointMixin.removeInteractions.call(this)
    this.off('popupopen', this.highlight)
    this.off('popupclose', this.resetHighlight)
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
    // FIXME
    // this.resetTooltip()
  },

  getIconClass: function () {
    return this.geojson.style?.iconClass
  },

  getIcon: function () {
    const Class = Icon.getClass(this.getIconClass())
    return new LeafletIcon(new Class(this.geojson))
  },

  _getTooltipAnchor: function () {
    const [x, y] = this.options.icon.options.tooltipAnchor
    const direction = this.feature.getOption('labelDirection')
    if (direction === 'left') return [-x, y]
    if (direction === 'bottom') return [0, 0]
    if (direction === 'top') return [0, y]
    return [x, y]
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

  _resetZIndex() {
    // Override Leaflet default behaviour, which set the zIndex
    // according to feature's y coordinate, and group features
    // zIndex by their datalayer order
    // FIXME pass in the geojson
    // this._zIndex = this.feature.datalayer.getDOMOrder()
    this._updateZIndex(0)
  },
})

const PathMixin = {
  maxVertex: 100,
  onMouseOver: function () {
    if (this._map.measureTools?.enabled()) {
      this.feature._umap.tooltip.open({ content: this.getMeasure(), anchor: this })
    } else {
      FeatureMixin.onMouseOver.call(this)
    }
  },

  shouldAllowGeometryEdit: function () {
    const pointsCount = this._parts.reduce((acc, part) => acc + part.length, 0)
    return (
      pointsCount < this.maxVertex || this._map.getZoom() === this._map.getMaxZoom()
    )
  },

  makeGeometryEditable: function () {
    // Feature has been removed since then?
    if (!this._map) return
    if (this.feature._umap.editedFeature !== this.feature) {
      this.disableEdit()
      return
    }
    this._map.once('moveend', this.makeGeometryEditable, this)
    if (this.shouldAllowGeometryEdit()) {
      this.enableEdit()
    } else {
      this.feature._umap.tooltip.open({
        content: translate('Please zoom in to edit the geometry'),
      })
      this.disableEdit()
    }
  },

  addInteractions: function () {
    FeatureMixin.addInteractions.call(this)
    this.on('drag editable:drag', this._onDrag)
    this.on('popupopen', this.highlightPath)
    this.on('popupclose', this._redraw)
  },

  removeInteractions: function () {
    FeatureMixin.removeInteractions.call(this)
    this.off('drag editable:drag', this._onDrag)
    this.off('popupopen', this.highlightPath)
    this.off('popupclose', this._redraw)
  },

  bindTooltip: function (content, options) {
    options.sticky = !options.permanent
    this.parentClass.prototype.bindTooltip.call(this, content, options)
  },

  highlightPath: function () {
    this.feature.activate()
    this.parentClass.prototype.setStyle.call(this, {
      fillOpacity: Math.sqrt(this.feature.getDynamicOption('fillOpacity', 1.0)),
      opacity: 1.0,
      weight: 1.3 * this.feature.getDynamicOption('weight'),
    })
  },

  _onDrag: function () {
    if (this._tooltip) this._tooltip.setLatLng(this.getCenter())
  },

  // beforeAdd: function (map) {
  //   this.options.renderer = this.feature.datalayer.renderer
  //   this.parentClass.prototype.beforeAdd.call(this, map)
  // },

  onAdd: function (map) {
    this._container = null
    FeatureMixin.onAdd.call(this, map)
    this.setStyle()
    if (this.editor?.enabled()) this.editor.addHooks()
    // this.resetTooltip()
    this._path.dataset.feature = this.feature.id
  },

  onRemove: function (map) {
    if (this.editor?.enabled()) this.editor.removeHooks()
    FeatureMixin.onRemove.call(this, map)
  },

  getStyle: function (feature) {
    const options = {}
    for (const option of this.getStyleOptions()) {
      options[option] = feature.getDynamicOption(option)
    }
    options.pointerEvents = options.interactive ? 'visiblePainted' : 'stroke'
    // this.parentClass.prototype.setStyle.call(this, options)
    // TODO remove me when this gets merged and released:
    // https://github.com/Leaflet/Leaflet/pull/9475

    this._path.classList.toggle('leaflet-interactive', options.interactive)

    // Text decoration
    this.setText(null) // Reset.
    const textPath = feature.getDynamicOption('textPath')
    if (textPath) {
      const color =
        feature.getOption('textPathColor') || feature.getDynamicOption('color')
      const textPathOptions = {
        repeat: feature.getOption('textPathRepeat'),
        offset: feature.getOption('textPathOffset') || undefined,
        position: feature.getOption('textPathPosition'),
        attributes: {
          fill: color,
          opacity: feature.getDynamicOption('opacity'),
          rotate: feature.getOption('textPathRotate'),
          'font-size': feature.getOption('textPathSize'),
        },
      }
      this.setText(textPath, textPathOptions)
    }
  },

  _redraw: function () {
    this.feature.deactivate()
    this.setStyle()
    this.resetTooltip()
  },

  isolateShape: function (atLatLng) {
    if (!this.feature.isMulti()) return
    const shape = this.enableEdit().deleteShapeAt(atLatLng)
    this.disableEdit()
    if (!shape) return
    // TODO: remove direct call to feature.datalayer.
    // Use an event instead ?
    const other = this.feature.datalayer.makeFeature({
      geometry: this.toGeometry(shape),
      properties: this.feature.cloneProperties(),
    })
    other.edit()
    return other
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
    bounds = bounds || this._map.getBounds()
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

  toGeometry: function (latlngs = this.getLatLngs()) {
    let multi = !LineUtil.isFlat(latlngs)
    if (multi && latlngs.length === 1) {
      // Simple LineString badly typed as Multi
      latlngs = latlngs[0]
      multi = false
    }
    return {
      type: multi ? 'MultiLineString' : 'LineString',
      coordinates: GeoJSON.latLngsToCoords(latlngs, multi ? 1 : 0, false),
    }
  },

  getMeasure: function (shape) {
    const length = GeoUtils.length(this.toGeometry(shape), { units: 'meters' })
    return TextUtils.readableDistance(length)
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
    if (GeoUtils.isFlat(this._latlngs)) {
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

export const RouteEditor = L.Editable.PolylineEditor.extend({
  options: {
    skipMiddleMarkers: true,
    draggable: false,
  },

  getLatLngs: function () {
    return this.feature._route
  },
})

export const LeafletRoute = LeafletPolyline.extend({
  initialize: function (feature, latlngs) {
    this._route = GeoJSON.coordsToLatLngs(
      feature.properties._umap_options.route?.coordinates
    )
    FeatureMixin.initialize.call(this, latlngs)
    delete this.dragging
  },

  addInteractions: function () {
    PathMixin.addInteractions.call(this)
    this.on('editable:drawing:clicked', this.onDrawingClick)
    this.on('editable:vertex:dragend editable:vertex:deleted', this.onDrawingMoved)
  },

  removeInteractions: function () {
    PathMixin.removeInteractions.call(this)
    this.off('editable:drawing:clicked', this.onDrawingClick)
    this.off('editable:vertex:dragend editable:vertex:deleted', this.onDrawingMoved)
  },

  getEditorClass: (tools) => {
    return RouteEditor
  },

  getClass: () => LeafletRoute,

  syncRoute() {
    this.feature.properties._umap_options.route.coordinates = GeoJSON.latLngsToCoords(
      this._route
    )
  },

  onDrawingMoved: function (event) {
    this.syncRoute()
    if (this._route.length >= 2) {
      this.feature.computeRoute()
    }
  },

  onDrawingClick: function (event) {
    this._route.push(event.latlng)
    this.syncRoute()
    if (this._route.length >= 2) {
      this.feature.computeRoute()
    }
  },

  shouldAllowGeometryEdit: function () {
    return (
      this._route.length < this.maxVertex ||
      this._map.getZoom() === this._map.getMaxZoom()
    )
  },
})

export const LeafletPolygon = Polygon.extend({
  parentClass: Polygon,
  includes: [FeatureMixin, PathMixin],

  getClass: () => LeafletPolygon,

  toGeometry: function (latlngs = this.getLatLngs()) {
    let holes = !LineUtil.isFlat(latlngs)
    let multi = holes && !LineUtil.isFlat(latlngs[0])
    if (multi && latlngs.length === 1) {
      // Simple LineString badly typed as Multi
      latlngs = latlngs[0]
      holes = !LineUtil.isFlat(latlngs)
      multi = false
    }
    let coords = GeoJSON.latLngsToCoords(latlngs, multi ? 2 : holes ? 1 : 0, true)
    if (!holes) coords = [coords]
    return {
      type: multi ? 'MultiPolygon' : 'Polygon',
      coordinates: coords,
    }
  },

  startHole: function (event) {
    this.enableEdit().newHole(event.latlng)
  },

  getMeasure: function (shape) {
    return TextUtils.readableArea(GeoUtils.area(this.toGeometry(shape)))
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
  initialize: function (latlng) {
    if (Array.isArray(latlng) && typeof latlng[0] !== 'number') {
      // Must be a line or polygon
      const bounds = new LatLngBounds(latlng)
      latlng = bounds.getCenter()
    }
    FeatureMixin.initialize.call(this, latlng)
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

  setText() {
    // Dummy function, as it inherits from PathMixin
  },
})
