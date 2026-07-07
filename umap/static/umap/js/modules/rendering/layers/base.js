import { GeoJSON, TileLayer } from '../../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../../i18n.js'
import * as Utils from '../../utils.js'
import * as UI from '../ui.js'

function getStyleOptions() {
  return [
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
  ]
}

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
      style: (geojsonFeature) => {
        const feature = datalayer.features.get(geojsonFeature.id)
        const options = {}
        for (const option of getStyleOptions(geojsonFeature)) {
          options[option] = feature.getDynamicOption(option)
        }
        options.pointerEvents = options.interactive ? 'visiblePainted' : 'stroke'
        // this.parentClass.prototype.setStyle.call(this, options)
        // TODO remove me when this gets merged and released:
        // https://github.com/Leaflet/Leaflet/pull/9475

        // this._path.classList.toggle('leaflet-interactive', options.interactive)

        // Text decoration
        // this.setText(null) // Reset.
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
          // this.setText(textPath, textPathOptions)
        }
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
