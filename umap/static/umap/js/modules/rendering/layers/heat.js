// Uses global L.HeatLayer, not exposed as ESM
import {
  Bounds,
  LatLng,
  Marker,
  latLngBounds,
  point,
} from '../../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../../i18n.js'
import * as Utils from '../../utils.js'
import { LayerMixin } from './base.js'

export const Heat = L.HeatLayer.extend({
  statics: {
    NAME: translate('Heatmap'),
    TYPE: 'Heat',
  },
  includes: [LayerMixin],
  browsable: false,

  initialize: function (datalayer) {
    this.datalayer = datalayer
    L.HeatLayer.prototype.initialize.call(this, [], this.datalayer.properties.heat)
    LayerMixin.onInit.call(this, this.datalayer._leafletMap)
    if (!Utils.isObject(this.datalayer.properties.heat)) {
      this.datalayer.properties.heat = {}
    }
  },

  addLayer: function (layer) {
    if (layer instanceof Marker) {
      let latlng = layer.getLatLng()
      let alt
      if (this.datalayer.properties.heat?.intensityProperty) {
        alt = Number.parseFloat(
          layer.feature.properties[
            this.datalayer.properties.heat.intensityProperty || 0
          ]
        )
        latlng = new LatLng(latlng.lat, latlng.lng, alt)
      }
      this.addLatLng(latlng)
    }
  },

  removeLayer: (layer) => {
    // No op, there is no "removeLatLng" in Leaflet.heat
    // but this method is expected by DataLayer
  },

  onAdd: function (map) {
    LayerMixin.onAdd.call(this, map)
    return L.HeatLayer.prototype.onAdd.call(this, map)
  },

  onRemove: function (map) {
    LayerMixin.onRemove.call(this, map)
    return L.HeatLayer.prototype.onRemove.call(this, map)
  },

  clearLayers: function () {
    this.setLatLngs([])
  },

  getFeatures: () => ({}),

  getBounds: function () {
    return latLngBounds(this._latlngs)
  },

  getEditableProperties: () => [
    [
      'properties.heat.radius',
      {
        handler: 'Range',
        min: 10,
        max: 100,
        step: 5,
        label: translate('Heatmap radius'),
        helpText: translate('Override heatmap radius (default 25)'),
      },
    ],
    [
      'properties.heat.intensityProperty',
      {
        handler: 'BlurInput',
        placeholder: translate('Heatmap intensity property'),
        helpText: translate('Optional intensity property for heatmap'),
      },
    ],
  ],

  onEdit: function (field, builder) {
    if (field === 'properties.heat.intensityProperty') {
      this.datalayer.resetLayer(true) // We need to repopulate the latlngs
      return
    }
    if (field === 'properties.heat.radius') {
      this.options.radius = this.datalayer.properties.heat.radius
    }
    this._updateOptions()
  },

  redraw: function () {
    // setlalngs call _redraw through setAnimFrame, thus async, so this
    // can ends with race condition if we remove the layer very faslty after.
    // TODO: PR in upstream Leaflet.heat
    if (!this._map) return
    L.HeatLayer.prototype.redraw.call(this)
  },

  _redraw: function () {
    // Import patch from https://github.com/Leaflet/Leaflet.heat/pull/78
    // Remove me when this get merged and released.
    if (!this._map) {
      return
    }
    const data = []
    const r = this._heat._r
    const size = this._map.getSize()
    const bounds = new Bounds(point([-r, -r]), size.add([r, r]))
    const cellSize = r / 2
    const grid = []
    const panePos = this._map._getMapPanePos()
    const offsetX = panePos.x % cellSize
    const offsetY = panePos.y % cellSize
    let i
    let len
    let p
    let cell
    let x
    let y
    let j
    let len2

    this._max = 1

    for (i = 0, len = this._latlngs.length; i < len; i++) {
      p = this._map.latLngToContainerPoint(this._latlngs[i])
      x = Math.floor((p.x - offsetX) / cellSize) + 2
      y = Math.floor((p.y - offsetY) / cellSize) + 2

      const alt =
        this._latlngs[i].alt !== undefined
          ? this._latlngs[i].alt
          : this._latlngs[i][2] !== undefined
            ? +this._latlngs[i][2]
            : 1

      grid[y] = grid[y] || []
      cell = grid[y][x]

      if (!cell) {
        cell = grid[y][x] = [p.x, p.y, alt]
        cell.p = p
      } else {
        cell[0] = (cell[0] * cell[2] + p.x * alt) / (cell[2] + alt) // x
        cell[1] = (cell[1] * cell[2] + p.y * alt) / (cell[2] + alt) // y
        cell[2] += alt // cumulated intensity value
      }

      // Set the max for the current zoom level
      if (cell[2] > this._max) {
        this._max = cell[2]
      }
    }

    this._heat.max(this._max)

    for (i = 0, len = grid.length; i < len; i++) {
      if (grid[i]) {
        for (j = 0, len2 = grid[i].length; j < len2; j++) {
          cell = grid[i][j]
          if (cell && bounds.contains(cell.p)) {
            data.push([
              Math.round(cell[0]),
              Math.round(cell[1]),
              Math.min(cell[2], this._max),
            ])
          }
        }
      }
    }

    this._heat.data(data).draw(this.options.minOpacity)

    this._frame = null
  },
})
