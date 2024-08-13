// WARNING must be loaded dynamically, or at least after leaflet.markercluster
// Uses global L.MarkerCluster and L.MarkerClusterGroup, not exposed as ESM
import { translate } from '../../i18n.js'
import { LayerMixin } from './base.js'
import * as Utils from '../../utils.js'
import { Evented } from '../../../../vendors/leaflet/leaflet-src.esm.js'
import { Cluster as ClusterIcon } from '../icon.js'

const MarkerCluster = L.MarkerCluster.extend({
  // Custom class so we can call computeTextColor
  // when element is already on the DOM.

  _initIcon: function () {
    L.MarkerCluster.prototype._initIcon.call(this)
    const div = this._icon.querySelector('div')
    // Compute text color only when icon is added to the DOM.
    div.style.color = this._iconObj.computeTextColor(div)
  },
})

export const Cluster = L.MarkerClusterGroup.extend({
  statics: {
    NAME: translate('Clustered'),
    TYPE: 'Cluster',
  },
  includes: [LayerMixin],

  initialize: function (datalayer) {
    this.datalayer = datalayer
    if (!Utils.isObject(this.datalayer.options.cluster)) {
      this.datalayer.options.cluster = {}
    }
    const options = {
      polygonOptions: {
        color: this.datalayer.getColor(),
      },
      iconCreateFunction: (cluster) => new ClusterIcon(datalayer, cluster),
    }
    if (this.datalayer.options.cluster?.radius) {
      options.maxClusterRadius = this.datalayer.options.cluster.radius
    }
    L.MarkerClusterGroup.prototype.initialize.call(this, options)
    LayerMixin.onInit.call(this, this.datalayer.map)
    this._markerCluster = MarkerCluster
    this._layers = []
  },

  onAdd: function (map) {
    LayerMixin.onAdd.call(this, map)
    return L.MarkerClusterGroup.prototype.onAdd.call(this, map)
  },

  onRemove: function (map) {
    // In some situation, the onRemove is called before the layer is really
    // added to the map: basically when combining a defaultView=data + max/minZoom
    // and loading the map at a zoom outside of that zoom range.
    // FIXME: move this upstream (_unbindEvents should accept a map parameter
    // instead of relying on this._map)
    this._map = map
    LayerMixin.onRemove.call(this, map)
    return L.MarkerClusterGroup.prototype.onRemove.call(this, map)
  },

  addLayer: function (layer) {
    this._layers.push(layer)
    return L.MarkerClusterGroup.prototype.addLayer.call(this, layer)
  },

  removeLayer: function (layer) {
    this._layers.splice(this._layers.indexOf(layer), 1)
    return L.MarkerClusterGroup.prototype.removeLayer.call(this, layer)
  },

  getEditableOptions: () => [
    [
      'options.cluster.radius',
      {
        handler: 'BlurIntInput',
        placeholder: translate('Clustering radius'),
        helpText: translate('Override clustering radius (default 80)'),
      },
    ],
    [
      'options.cluster.textColor',
      {
        handler: 'TextColorPicker',
        placeholder: translate('Auto'),
        helpText: translate('Text color for the cluster label'),
      },
    ],
  ],

  onEdit: function (field, builder) {
    if (field === 'options.cluster.radius') {
      // No way to reset radius of an already instanciated MarkerClusterGroup...
      this.datalayer.resetLayer(true)
      return
    }
    if (field === 'options.color') {
      this.options.polygonOptions.color = this.datalayer.getColor()
    }
  },
})
