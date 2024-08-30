import { FeatureGroup, TileLayer } from '../../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../../i18n.js'
import * as Utils from '../../utils.js'

export const LayerMixin = {
  browsable: true,

  onInit: function (map) {
    if (this.datalayer.autoLoaded()) map.on('zoomend', this.onZoomEnd, this)
  },

  onDelete: function (map) {
    map.off('zoomend', this.onZoomEnd, this)
  },

  onAdd: function (map) {
    map.on('moveend', this.onMoveEnd, this)
  },

  onRemove: function (map) {
    map.off('moveend', this.onMoveEnd, this)
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

  getEditableOptions: () => [],

  onEdit: () => {},

  hasDataVisible: function () {
    return !!Object.keys(this._layers).length
  },

  // Called when data changed on the datalayer
  dataChanged: () => {},

  onMoveEnd: function () {
    if (this.datalayer.hasDynamicData() && this.datalayer.showAtZoom()) {
      this.datalayer.fetchRemoteData()
    }
  },

  onZoomEnd() {
    if (this.datalayer._forcedVisibility) return
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
    LayerMixin.onInit.call(this, this.datalayer.map)
  },

  onAdd: function (map) {
    LayerMixin.onAdd.call(this, map)
    return FeatureGroup.prototype.onAdd.call(this, map)
  },

  onRemove: function (map) {
    LayerMixin.onRemove.call(this, map)
    return FeatureGroup.prototype.onRemove.call(this, map)
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
