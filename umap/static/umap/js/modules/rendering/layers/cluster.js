import {
  FeatureGroup,
  Marker,
  Rectangle,
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

  zoomToCoverage() {
    if (this._map && this._coverage) {
      this._map.fitBounds(this._coverage.getBounds())
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
    if (this._map) {
      for (const cluster of this._clusters) {
        const layer = cluster._layers.length === 1 ? cluster._layers[0] : cluster
        this._map.removeLayer(layer)
      }
    }
  },

  addClusters() {
    if (this._map) {
      for (const cluster of this._clusters) {
        const layer = cluster._layers.length === 1 ? cluster._layers[0] : cluster
        this._map.addLayer(layer)
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
    const CRS = map.options.crs
    for (const layer of this._bucket) {
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
    leafletMap.on('zoomend', this.redraw, this)
    this.addClusters()
    return FeatureGroup.prototype.onAdd.call(this, leafletMap)
  },

  onRemove: function (leafletMap) {
    leafletMap.off('zoomend', this.redraw, this)
    this.off('click', this.onClick)
    this.off('mouseover', this.onMouseOver)
    this.off('mouseout', this.onMouseOut)
    LayerMixin.onRemove.call(this, leafletMap)
    this.removeClusters()
    return FeatureGroup.prototype.onRemove.call(this, leafletMap)
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
    event.layer.computeCoverage()
    this.showCoverage(event.layer)
  },

  onMouseOut(event) {
    this.hideCoverage()
  },

  onClick(event) {
    event.layer.zoomToCoverage()
  },

  getEditableProperties: () => [
    [
      'properties.cluster.radius',
      {
        handler: 'BlurIntInput',
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
