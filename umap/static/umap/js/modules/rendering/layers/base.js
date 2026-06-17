import { GeoJSON, TileLayer } from '../../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../../i18n.js'
import * as Utils from '../../utils.js'
import * as UI from '../ui.js'

export const LayerMixin = {
  browsable: true,

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
      pointToLayer: (geojson, latlng) => {
        if (geojson.style?.shape === 'circle') {
          return new UI.CircleMarker(latlng, geojson)
        }
        return new UI.LeafletMarker(latlng, geojson)
      },
      polylineToLayer: (latlngs, options, geojson) => {
        return new UI.LeafletPolyline(latlngs, geojson)
      },
      polygonToLayer: (latlngs, options, geojson) => {
        return new UI.LeafletPolygon(latlngs, geojson)
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

  addData: function (geojson) {
    // Leaflet's addData recurses per feature; only keep the collection itself (first call).
    if (geojson.features) this.geojson = geojson
    return GeoJSON.prototype.addData.call(this, geojson)
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
