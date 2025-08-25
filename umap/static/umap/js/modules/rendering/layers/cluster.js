import {
  FeatureGroup,
  LayerGroup,
  Point,
  Marker,
  Rectangle,
  Polyline,
  DomUtil,
  latLngBounds,
} from '../../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../../i18n.js'
import * as Utils from '../../utils.js'
import { Cluster as ClusterIcon } from '../icon.js'
import { LayerMixin } from './base.js'

const MarkerCluster = Marker.extend({
  _initIcon: function () {
    Marker.prototype._initIcon.call(this)
    const counter = this._icon.querySelector('span')
    // Compute text color only when icon is added to the DOM.
    const bgColor = this.options.icon.options.color
    const textColor = this.options.icon.options.textColor
    counter.style.color =
      textColor || DomUtil.TextColorFromBackgroundColor(counter, bgColor)
  },

  computeCoverage() {
    if (this._layers.length < 2) return
    if (!this._coverage) {
      const latlngs = this._layers.map((layer) => layer._latlng)
      const bounds = latLngBounds(latlngs)
      this._coverage = new Rectangle(latlngs, {
        color: this.options.icon.options.color,
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

export const Cluster = FeatureGroup.extend({
  statics: {
    NAME: translate('Clustered'),
    TYPE: 'Cluster',
  },
  includes: [LayerMixin],

  initialize: function (datalayer) {
    this.datalayer = datalayer
    this._bucket = []
    this._group = new LayerGroup()
    if (!Utils.isObject(this.datalayer.properties.cluster)) {
      this.datalayer.properties.cluster = {}
    }
    FeatureGroup.prototype.initialize.call(this)
    LayerMixin.onInit.call(this, this.datalayer._leafletMap)
  },

  dataChanged: function () {
    this.redraw()
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

  addClusters() {
    if (this._map) {
      for (const cluster of this._clusters) {
        const layer = cluster._layers.length === 1 ? cluster._layers[0] : cluster
        this._group.addLayer(layer)
      }
    }
  },

  redraw: function () {
    this.removeClusters()
    this.compute()
    this.addClusters()
  },

  compute() {
    const radius = this.datalayer.properties.cluster?.radius || 80
    this._clusters = []
    const map = this.datalayer._umap._leafletMap
    this._bounds = map.getBounds().pad(0.1)
    const CRS = map.options.crs
    for (const layer of this._bucket) {
      if (layer._cluster) continue
      if (!this._bounds.contains(layer._latlng)) continue
      layer._xy = CRS.latLngToPoint(layer._latlng, map.getZoom())
      let cluster = null
      for (const candidate of this._clusters) {
        if (candidate._xy.distanceTo(layer._xy) <= radius) {
          cluster = candidate
          break
        }
      }
      if (!cluster) {
        const icon = new ClusterIcon({
          color: this.datalayer.getColor(),
          textColor: this.datalayer.properties.cluster?.textColor,
          getCounter: () => cluster._layers.length,
        })
        cluster = new MarkerCluster(layer._latlng, { icon })
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

  addLayer: function (layer) {
    if (!layer.getLatLng) return FeatureGroup.prototype.addLayer.call(this, layer)
    // Do not add yet the layer to the map
    // wait for datachanged event, so we can compute breaks only once
    this._bucket.push(layer)
    return this
  },

  onAdd: function (leafletMap) {
    this.on('click', this.onClick)
    this.on('mouseover', this.onMouseOver)
    this.on('mouseout', this.onMouseOut)
    this.compute()
    LayerMixin.onAdd.call(this, leafletMap)
    leafletMap.on('moveend', this.onMoveEnd, this)
    leafletMap.on('zoomend', this.onZoomEnd, this)
    this.addClusters()
    leafletMap.addLayer(this._group)
    return FeatureGroup.prototype.onAdd.call(this, leafletMap)
  },

  onRemove: function (leafletMap) {
    leafletMap.off('zoomend', this.onZoomEnd, this)
    leafletMap.off('moveend', this.onMoveEnd, this)
    this.off('click', this.onClick)
    this.off('mouseover', this.onMouseOver)
    this.off('mouseout', this.onMouseOut)
    LayerMixin.onRemove.call(this, leafletMap)
    this.removeClusters()
    leafletMap.removeLayer(this._group)
    return FeatureGroup.prototype.onRemove.call(this, leafletMap)
  },

  onZoomEnd: function () {
    this.removeClusters()
  },

  onMoveEnd: function () {
    this.compute()
    this.addClusters()
  },

  showCoverage(cluster) {
    if (cluster._coverage) {
      this._shownCoverage = cluster._coverage
      this._map.addLayer(this._shownCoverage)
    }
  },

  hideCoverage() {
    if (this._shownCoverage) this._map.removeLayer(this._shownCoverage)
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

  getEditableProperties: () => [
    [
      'properties.cluster.radius',
      {
        handler: 'Range',
        min: 40,
        max: 200,
        step: 10,
        placeholder: translate('Clustering radius'),
        helpText: translate('Override clustering radius (default 80)'),
      },
    ],
    [
      'properties.cluster.textColor',
      {
        handler: 'TextColorPicker',
        placeholder: translate('Auto'),
        helpText: translate('Text color for the cluster label'),
      },
    ],
  ],

  onEdit: function (field, builder) {
    if (field === 'properties.cluster.radius') this.redraw()
  },
})
