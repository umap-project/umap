import { FeatureGroup, TileLayer } from '../../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../../i18n.js'
import * as Utils from '../../utils.js'

export const LayerMixin = {
  browsable: true,

  onInit: function (leafletMap) {
    leafletMap.on('zoomend', this.onZoomEnd, this)
  },

  onDelete: function (leafletMap) {
    leafletMap.off('zoomend', this.onZoomEnd, this)
  },

  onAdd: function (leafletMap) {
    leafletMap.on('moveend', this.onMoveEnd, this)
  },

  onRemove: function (leafletMap) {
    leafletMap.off('moveend', this.onMoveEnd, this)
  },

  getType: function () {
    const proto = Object.getPrototypeOf(this)
    return proto.constructor.TYPE
  },

  getName: function () {
    const proto = Object.getPrototypeOf(this)
    return proto.constructor.NAME
  },

  getFeatures: function () {
    return this._layers
  },

  getEditableProperties: () => [],

  onEdit: () => {},

  hasDataVisible: function () {
    return !!Object.keys(this._layers).length
  },

  // Called when data changed on the datalayer
  dataChanged: () => {},

  onMoveEnd: function () {
    if (this.datalayer.hasDynamicData() && this.datalayer.showAtZoom()) {
      this.datalayer.fetchData()
    }
  },

  onZoomEnd() {
    if (!this.datalayer.autoVisibility) return
    if (!this.datalayer.showAtZoom() && this.datalayer.isVisible()) {
      this.datalayer.hide()
    }
    if (this.datalayer.showAtZoom() && !this.datalayer.isVisible()) {
      this.datalayer.show()
    }
  },
}

export const Default = FeatureGroup.extend({
  statics: {
    NAME: translate('Default'),
    TYPE: 'Default',
  },
  includes: [LayerMixin],

  initialize: function (datalayer) {
    this.datalayer = datalayer
    FeatureGroup.prototype.initialize.call(this)
    LayerMixin.onInit.call(this, this.datalayer._leafletMap)
  },

  onAdd: function (leafletMap) {
    LayerMixin.onAdd.call(this, leafletMap)
    return FeatureGroup.prototype.onAdd.call(this, leafletMap)
  },

  onRemove: function (leafletMap) {
    LayerMixin.onRemove.call(this, leafletMap)
    return FeatureGroup.prototype.onRemove.call(this, leafletMap)
  },
})

TileLayer.include({
  toJSON() {
    return {
      minZoom: this.options.minZoom,
      maxZoom: this.options.maxZoom,
      attribution: this.options.attribution,
      url_template: this._url,
      name: this.options.name,
      tms: this.options.tms,
    }
  },

  getAttribution() {
    return Utils.toHTML(this.options.attribution)
  },
})
