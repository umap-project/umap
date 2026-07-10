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
  initialize: function (latlngs, geojson) {
    this.geojson = geojson
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
  },

  removeInteractions: function () {
    this.off('contextmenu editable:vertex:contextmenu', this.onContextMenu)
    this.off('click', this.onClick)
    this.off('editable:edited', this.onCommit)
  },

  onMouseOver: function () {
    this._map.fire('feature:mouseover', { id: this.geojson.id, layer: this })
  },

  onClick: function (event) {
    this._map.fire('feature:click', {
      id: this.geojson.id,
      layer: this,
      latlng: event.latlng,
      originalEvent: event.originalEvent,
    })
    DomEvent.stop(event)
  },

  resetTooltip: function () {
    const { text, show, hover, direction, interactive } = this.geojson.label
    let showLabel = show
    if (hover && showLabel) showLabel = null // Retrocompat.
    this.unbindTooltip()
    if ((showLabel === true || showLabel === null) && text) {
      this.bindTooltip(Utils.escapeHTML(text), {
        direction,
        interactive,
        permanent: showLabel === true,
      })
    }
  },

  onContextMenu: function (event) {
    DomEvent.stop(event)
    this._map.fire('feature:contextmenu', {
      id: this.geojson.id,
      latlng: event.latlng,
      coordinate: [event.latlng.lng, event.latlng.lat],
      // Set when right-clicking a vertex (editable:vertex:contextmenu): the
      // edit context menu offers vertex tools (split, continue…) instead.
      vertex: event.vertex,
      originalEvent: event.originalEvent,
    })
  },

  onCommit: function () {
    this._map.fire('feature:commit', {
      id: this.geojson.id,
      geometry: this.toGeometry(),
    })
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

  addInteractions() {
    FeatureMixin.addInteractions.call(this)
    this.on('dragend', this.onDragEnd)
    if (!this.geojson.readonly) this.on('mouseover', this.onMouseOver)
    this.on('mouseout', this.onMouseOut)
  },

  removeInteractions() {
    FeatureMixin.removeInteractions.call(this)
    this.off('dragend', this.onDragEnd)
    this.off('mouseover', this.onMouseOver)
    this.off('mouseout', this.onMouseOut)
  },

  onDragEnd: function () {
    this._map.fire('feature:dragend', { id: this.geojson.id, layer: this })
  },

  onMouseOut: function () {
    // Do not disable if the mouse went out while dragging.
    if (this.dragging?._draggable && !this.dragging._draggable._moving) {
      this._map.fire('feature:mouseout', { layer: this })
    }
  },
}

export const LeafletMarker = Marker.extend({
  parentClass: Marker,
  includes: [FeatureMixin, PointMixin],

  initialize: function (latlng, geojson) {
    FeatureMixin.initialize.call(this, latlng, geojson)
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
  },

  removeInteractions() {
    PointMixin.removeInteractions.call(this)
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
    this.resetTooltip()
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
    const direction = this.geojson.label?.direction
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
    this._icon?.classList.add('umap-icon-active')
    this._bringToFront()
  },

  unhighlight: function () {
    this._icon?.classList.remove('umap-icon-active')
    this._resetZIndex()
  },

  _resetZIndex() {
    // Override Leaflet default behaviour, which set the zIndex
    // according to feature's y coordinate, and group features
    // zIndex by their datalayer order
    this._zIndex = this.geojson.zIndex
    this._updateZIndex(0)
  },
})

const PathMixin = {
  maxVertex: 100,
  onMouseOver: function () {
    if (this._map.measureTools?.enabled()) {
      this.feature.app.tooltip.open({ content: this.getMeasure(), anchor: this })
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

  addInteractions: function () {
    FeatureMixin.addInteractions.call(this)
    this.on('drag editable:drag', this._onDrag)
  },

  removeInteractions: function () {
    FeatureMixin.removeInteractions.call(this)
    this.off('drag editable:drag', this._onDrag)
  },

  bindTooltip: function (content, options) {
    options.sticky = !options.permanent
    this.parentClass.prototype.bindTooltip.call(this, content, options)
  },

  highlight: function () {
    this.parentClass.prototype.setStyle.call(this, this.geojson.style.highlight)
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
    this._path.dataset.feature = this.geojson.id
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

  unhighlight: function () {
    this.parentClass.prototype.setStyle.call(this, this.geojson.style)
    this.resetTooltip()
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
  initialize: function (latlngs, geojson) {
    this._route = GeoJSON.coordsToLatLngs(
      geojson.properties._umap_options.route?.coordinates || []
    )
    FeatureMixin.initialize.call(this, latlngs, geojson)
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
    this._map.fire('feature:route', {
      id: this.geojson.id,
      coordinates: GeoJSON.latLngsToCoords(this._route),
    })
  },

  onDrawingMoved: function (event) {
    this.syncRoute()
  },

  onDrawingClick: function (event) {
    this._route.push(event.latlng)
    this.syncRoute()
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

    if (this.geojson.geometry?.type !== 'MultiPolygon') {
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
  initialize: function (latlng, geojson) {
    if (Array.isArray(latlng) && typeof latlng[0] !== 'number') {
      // Must be a line or polygon
      const bounds = new LatLngBounds(latlng)
      latlng = bounds.getCenter()
    }
    FeatureMixin.initialize.call(this, latlng, geojson)
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

export function layerClass(geojson) {
  const type = geojson.geometry?.type
  if (type === 'Point' || type === 'MultiPoint') {
    return geojson.style?.shape === 'circle' ? CircleMarker : LeafletMarker
  }
  if (type === 'Polygon' || type === 'MultiPolygon') {
    return geojson.style?.mask ? MaskPolygon : LeafletPolygon
  }
  const route = geojson.properties?._umap_options?.route
  if (route && route.active !== false) return LeafletRoute
  return LeafletPolyline
}
