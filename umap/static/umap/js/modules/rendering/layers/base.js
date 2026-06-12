import { GeoJSON, TileLayer } from '../../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../../i18n.js'
import * as Utils from '../../utils.js'
import * as UI from '../ui.js'

export const LayerMixin = {
  browsable: true,

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

export const Default = GeoJSON.extend({
  statics: {
    NAME: translate('Default'),
    TYPE: 'Default',
  },
  includes: [LayerMixin],

  initialize: function (datalayer) {
    this.datalayer = datalayer
    GeoJSON.prototype.initialize.call(this, null, {
      pointToLayer: (latlng) => {
        return new UI.LeafletMarker(latlng)
      },
      polylineToLayer: (latlngs) => {
        console.log('latlngs', latlngs)
        return new UI.LeafletPolyline(latlngs)
      },
      polygonToLayer: (latlngs) => {
        return new UI.LeafletPolygon(latlngs)
      },
      // The style is read straight from the feature's geojson `style` member
      // (baked by the data layer). The proxy never touches a Feature.
      style: (geojsonFeature) => {
        const options = { ...geojsonFeature.style }
        options.pointerEvents = options.interactive ? 'visiblePainted' : 'stroke'
        return options
      },
    })
  },

  onAdd: function (map) {
    LayerMixin.onAdd.call(this, map)
    return GeoJSON.prototype.onAdd.call(this, map)
  },

  onRemove: function (map) {
    LayerMixin.onRemove.call(this, map)
    return GeoJSON.prototype.onRemove.call(this, map)
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
