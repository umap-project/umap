import {
  LayerGroup,
  Marker,
  Point,
  Polyline,
  Rectangle,
  latLngBounds,
} from '../../../../vendors/leaflet/leaflet-src.esm.js'
import { Cluster as ClusterIcon } from '../../icon.js'
import { LeafletIcon } from '../ui.js'
import { Default as DefaultLayer } from './base.js'

const MarkerCluster = Marker.extend({
  computeCoverage() {
    if (this._layers.length < 2) return
    if (!this._coverage) {
      const latlngs = this._layers.map((layer) => layer._latlng)
      const bounds = latLngBounds(latlngs)
      this._coverage = new Rectangle(latlngs, {
        color: this.options.icon.umapIcon.properties.color,
        stroke: false,
      })
      this._latlng = bounds.getCenter()
    }
  },

  async zoomToCoverage() {
    let resolve = undefined
    const promise = new Promise((r) => {
      resolve = r
    })
    if (this._map && this._coverage) {
      this._map.once('moveend', () => resolve())
      this._map.fitBounds(this._coverage.getBounds())
    }
    return promise
  },

  _spiderfyLatLng: function (center, index) {
    const step = 20
    const maxRadius = 150
    const zoom = this._map.getZoom()
    const angle = (index * step * Math.PI) / 180
    const progress = index / this._layers.length
    const radius = maxRadius * (1 - progress) ** 0.4
    const x = radius * Math.cos(angle)
    const y = radius * Math.sin(angle)
    const point = this._map.project([center.lat, center.lng], zoom)
    const latlng = this._map.unproject(new Point(point.x + x, point.y + y), zoom)
    return latlng
  },

  spiderfy() {
    if (!this._map) return
    const crs = this._map.options.crs
    if (this._spider && this._map.hasLayer(this._spider)) this.unspiderfy()
    this._spider = new LayerGroup()
    let i = 1
    const center = this.getLatLng()
    for (const layer of this._layers) {
      const latlng = this._spiderfyLatLng(center, i++)
      layer._originalLatLng = layer._latlng
      layer.setLatLng(latlng)
      this._spider.addLayer(layer)
      const line = new Polyline([center, latlng], { color: 'black', weight: 1 })
      this._spider.addLayer(line)
    }
    this._map.addLayer(this._spider)
    this._icon.hidden = true
    this._map.once('click zoomstart', this.unspiderfy, this)
    this.once('remove', this.unspiderfy, this)
  },

  unspiderfy() {
    if (this._icon) this._icon.hidden = false
    if (this._spider) this._spider.remove()
    for (const layer of this._layers) {
      if (layer._originalLatLng) layer.setLatLng(layer._originalLatLng)
      delete layer._originalLatLng
    }
  },
})

export const Cluster = DefaultLayer.extend({
  initialize: function (datalayer) {
    DefaultLayer.prototype.initialize.call(this, datalayer)
    this._bucket = []
    this._group = new LayerGroup()
  },

  addData: function (geojson) {
    DefaultLayer.prototype.addData.call(this, geojson)
    // addData recurses per feature; cluster once the whole collection is in.
    if (geojson.features) this.redraw()
  },

  addLayer: function (layer) {
    if (!layer.getLatLng) return DefaultLayer.prototype.addLayer.call(this, layer)
    // Markers wait in the bucket until clustered, so they never hit the map raw.
    this._bucket.push(layer)
    return this
  },

  clearLayers: function () {
    this.removeClusters()
    this._bucket = []
    return DefaultLayer.prototype.clearLayers.call(this)
  },

  removeClusters() {
    this.hideCoverage()
    for (const layer of this._bucket) {
      delete layer._cluster
    }
    if (this._map) {
      this._group.clearLayers()
    }
  },

  redraw: function () {
    if (!this._map) return
    this.removeClusters()
    this._cluster()
    for (const cluster of this._clusters) {
      const layer = cluster._layers.length === 1 ? cluster._layers[0] : cluster
      this._group.addLayer(layer)
    }
  },

  _cluster() {
    const style = this.geojson?.style
    const radius = style?.cluster?.radius || 80
    this._clusters = []
    this._bounds = this._map.getBounds().pad(0.1)
    const CRS = this._map.options.crs
    for (const layer of this._bucket) {
      if (layer._cluster) continue
      if (!this._bounds.contains(layer._latlng)) continue
      layer._xy = CRS.latLngToPoint(layer._latlng, this._map.getZoom())
      let cluster = null
      for (const candidate of this._clusters) {
        if (candidate._xy.distanceTo(layer._xy) <= radius) {
          cluster = candidate
          break
        }
      }
      if (!cluster) {
        const umapIcon = new ClusterIcon({
          color: style?.color,
          textColor: style?.cluster?.textColor,
          getCounter: () => cluster._layers.length,
        })
        cluster = new MarkerCluster(layer._latlng, { icon: new LeafletIcon(umapIcon) })
        cluster.addEventParent(this)
        cluster._xy ??= layer._xy
        cluster._layers = []
        this._clusters.push(cluster)
      }
      cluster._layers.push(layer)
      layer._cluster = cluster
    }
    for (const cluster of this._clusters) {
      cluster.computeCoverage()
    }
  },

  removeLayer: function (layer) {
    if (!layer.getLatLng) return DefaultLayer.prototype.removeLayer.call(this, layer)
    this._bucket = this._bucket.filter((el) => el !== layer)
    return this
  },

  onAdd: function (map) {
    this.on('click', this.onClick)
    this.on('mouseover', this.onMouseOver)
    this.on('mouseout', this.onMouseOut)
    map.on('moveend', this.redraw, this)
    map.addLayer(this._group)
    this.redraw()
    return DefaultLayer.prototype.onAdd.call(this, map)
  },

  onRemove: function (map) {
    this.off('click', this.onClick)
    this.off('mouseover', this.onMouseOver)
    this.off('mouseout', this.onMouseOut)
    map.off('moveend', this.redraw, this)
    this.removeClusters()
    map.removeLayer(this._group)
    return DefaultLayer.prototype.onRemove.call(this, map)
  },

  onZoomEnd: function () {
    DefaultLayer.prototype.onZoomEnd.call(this)
    this.removeClusters()
  },

  showCoverage(cluster) {
    if (cluster._coverage) {
      this._shownCoverage = cluster._coverage
      this._map.addLayer(this._shownCoverage)
    }
  },

  hideCoverage() {
    if (this._shownCoverage && this._map) {
      this._map.removeLayer(this._shownCoverage)
    }
  },

  onMouseOver(event) {
    event.layer?.computeCoverage?.()
    this.showCoverage(event.layer)
  },

  onMouseOut(event) {
    this.hideCoverage()
  },

  onClick(event) {
    if (this._map.getZoom() === this._map.getMaxZoom()) {
      event.layer.spiderfy?.()
    } else {
      event.layer.zoomToCoverage?.()
    }
  },
})
