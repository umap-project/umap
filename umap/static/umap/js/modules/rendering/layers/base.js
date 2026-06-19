import { GeoJSON, TileLayer } from '../../../../vendors/leaflet/leaflet-src.esm.js'
import * as Utils from '../../utils.js'
import * as UI from '../ui.js'

export const Default = GeoJSON.extend({
  initialize: function (datalayer) {
    this.datalayer = datalayer
    GeoJSON.prototype.initialize.call(this, null, {
      pointToLayer: (geojson, latlng) => {
        if (geojson.style?.shape === 'circle') {
          const layer = new UI.CircleMarker(latlng, geojson)
          layer.options.pane = this.pane
          return layer
        }
        return new UI.LeafletMarker(latlng, geojson)
      },
      polylineToLayer: (latlngs, options, geojson) => {
        const Class = UI.layerClass(geojson)
        const layer = new Class(latlngs, geojson)
        layer.options.pane = this.pane
        return layer
      },
      polygonToLayer: (latlngs, options, geojson) => {
        const Class = UI.layerClass(geojson)
        const layer = new Class(latlngs, geojson)
        layer.options.pane = this.pane
        return layer
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
