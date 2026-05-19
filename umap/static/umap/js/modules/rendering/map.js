// Goes here all code related to Leaflet, DOM and user interactions.
import {
  Map as BaseMap,
  Browser,
  LatLng,
  LatLngBounds,
  latLng,
  setOptions,
  stamp,
  TileLayer,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import { translate } from '../i18n.js'
import * as Utils from '../utils.js'

// Those options are not saved on the server, so they can live here
// instead of in umap.properties
BaseMap.mergeOptions({
  demoTileInfos: { s: 'a', z: 9, x: 265, y: 181, '-y': 181, r: '' },
  attributionControl: false,
})

const ManageTilelayerMixin = {
  initTileLayers: function () {
    this.pullProperties()
    this.tilelayers = []
    for (const props of this.options.tilelayers) {
      const layer = this.createTileLayer(props)
      this.tilelayers.push(layer)
      if (
        this.options.tilelayer &&
        this.options.tilelayer.url_template === props.url_template
      ) {
        // Keep control over the displayed attribution for non custom tilelayers
        this.options.tilelayer.attribution = props.attribution
      }
    }
    if (this.options.tilelayer?.url_template && this.options.tilelayer.attribution) {
      this.customTilelayer = this.createTileLayer(this.options.tilelayer)
      this.selectTileLayer(this.customTilelayer)
    } else {
      this.selectTileLayer(this.tilelayers[0])
    }
  },

  createTileLayer: (tilelayer) => new TileLayer(tilelayer.url_template, tilelayer),

  selectTileLayer: function (tilelayer) {
    if (tilelayer === this.selectedTilelayer) {
      return
    }
    const onLoading = () => {
      this._umap.loader.start(stamp(tilelayer))
    }
    const onLoad = () => {
      this._umap.loader.stop(stamp(tilelayer))
    }
    try {
      tilelayer.on('loading', onLoading)
      tilelayer.on('load', onLoad)
      tilelayer.on('remove', () => {
        tilelayer.off('loading', onLoading)
        tilelayer.off('load', onLoad)
      })
      this.addLayer(tilelayer)
      this.fire('baselayerchange', { layer: tilelayer })
      if (this.selectedTilelayer) {
        this.removeLayer(this.selectedTilelayer)
      }
      this.selectedTilelayer = tilelayer
      if (
        !Number.isNaN(this.selectedTilelayer.options.minZoom) &&
        this.getZoom() < this.selectedTilelayer.options.minZoom
      ) {
        this.setZoom(this.selectedTilelayer.options.minZoom)
      }
      if (
        !Number.isNaN(this.selectedTilelayer.options.maxZoom) &&
        this.getZoom() > this.selectedTilelayer.options.maxZoom
      ) {
        this.setZoom(this.selectedTilelayer.options.maxZoom)
      }
    } catch (e) {
      console.error(e)
      this.removeLayer(tilelayer)
      Alert.error(`${translate('Error in the tilelayer URL')}: ${tilelayer._url}`)
      // Users can put tilelayer URLs by hand, and if they add wrong {variable},
      // Leaflet throw an error, and then the map is no more editable
    }
    this.setOverlay()
  },

  eachTileLayer: function (callback, context) {
    const urls = []
    const callOne = (layer) => {
      // Prevent adding a duplicate background,
      // while adding selected/custom on top of the list
      const url = layer.options.url_template
      if (urls.indexOf(url) !== -1) return
      callback.call(context, layer)
      urls.push(url)
    }
    if (this.selectedTilelayer) callOne(this.selectedTilelayer)
    if (this.customTilelayer) callOne(this.customTilelayer)
    this.tilelayers.forEach(callOne)
  },

  setOverlay: function () {
    if (!this.options.overlay || !this.options.overlay.url_template) return
    const overlay = this.createTileLayer(this.options.overlay)
    try {
      this.addLayer(overlay)
      if (this.overlay) this.removeLayer(this.overlay)
      this.overlay = overlay
    } catch (e) {
      this.removeLayer(overlay)
      console.error(e)
      Alert.error(`${translate('Error in the overlay URL')}: ${overlay._url}`)
    }
  },
}

export const LeafletMap = BaseMap.extend({
  includes: [ManageTilelayerMixin],

  // The initialize and the setup method might seem similar, but they
  // serve two different purposes:
  // initialize is for Leaflet internal, when we do "new LeafletMap",
  // while setup is the public API for the LeafletMap to actually
  // render to the DOM.
  initialize: function (umap, element) {
    this._umap = umap
    const options = this._umap.properties

    // Our control property name clashes with the default one, so let's force it to false
    // miniMap plugin does not add itself to the map, out of our control.
    BaseMap.prototype.initialize.call(this, element, {
      ...options,
      miniMapControl: false,
    })

    document.body.addEventListener('mapview:update', (event) => {
      let { zoom, latlng } = event.detail
      if (!Utils.LatLngIsValid(latlng)) return
      zoom = Math.min(zoom, this.getMaxZoom())
      zoom = Math.max(zoom, this.getMinZoom())
      this.setView(latlng, zoom)
    })
  },

  setup: function () {
    if (!this.measureTools) {
      new L.Measurable(this)
    }
    this.initCenter()

    // Wait for URL to have been parsed before modifying the hash
    const updateHash = () => {
      const center = this.getCenter()
      document.body.dispatchEvent(
        new CustomEvent('mapview:updated', {
          detail: {
            zoom: this.getZoom(),
            latlng: [center.lat.toFixed(6), center.lng.toFixed(6)],
          },
        })
      )
    }
    this.on('moveend', updateHash)
    updateHash()
    this.initTileLayers()
    this.renderUI()
  },

  pullProperties() {
    setOptions(this, this._umap.properties)
  },

  renderUI: function () {
    this.pullProperties()
    if (this.options.scrollWheelZoom) {
      this.scrollWheelZoom.enable()
      this.dragging.enable()
    } else {
      this.scrollWheelZoom.disable()
      // In mobile, do not let the user move the map
      // when scrolling the main page and touching the
      // map in an iframe. May be a bit dumb, but let's
      // try like this for now.
      if (Browser.mobile) this.dragging.disable()
    }
    this.handleLimitBounds()
  },

  latLng: (a, b, c) => {
    // manage geojson case and call original method
    if (!(a instanceof LatLng) && a.coordinates) {
      // Guess it's a geojson
      a = [a.coordinates[1], a.coordinates[0]]
    }
    return latLng(a, b, c)
  },

  _setDefaultCenter: function () {
    this.options.center = this.latLng(this.options.center)
    this.setView(this.options.center, this.options.zoom)
  },

  initCenter: async function () {
    this._setDefaultCenter()
    if (this.options.hash && window.location.hash) {
      // FIXME An invalid hash will cause the load to fail
      this._umap.hash.parse()
    } else if (this.options.defaultView === 'locate' && !this.options.noControl) {
      await this._umap.controlManager.controls.locate.start()
    } else if (this.options.defaultView === 'data') {
      this._umap.onceDataLoaded(this._umap.fitDataBounds)
    } else if (this.options.defaultView === 'latest') {
      this._umap.onceDataLoaded(() => {
        if (!this._umap.hasData()) return
        const datalayer = this._umap.layers.tree.visible().first()
        if (datalayer) {
          const feature = datalayer.features.last()
          if (feature) {
            feature.zoomTo({ callback: this.options.noControl ? null : feature.view })
            return
          }
        }
      })
    }
  },

  handleLimitBounds: function () {
    const south = Number.parseFloat(this.options.limitBounds?.south)
    const west = Number.parseFloat(this.options.limitBounds?.west)
    const north = Number.parseFloat(this.options.limitBounds?.north)
    const east = Number.parseFloat(this.options.limitBounds?.east)
    if (
      !Number.isNaN(south) &&
      !Number.isNaN(west) &&
      !Number.isNaN(north) &&
      !Number.isNaN(east)
    ) {
      const bounds = new LatLngBounds([
        [south, west],
        [north, east],
      ])
      this.options.minZoom = this.getBoundsZoom(bounds, false)
      try {
        this.setMaxBounds(bounds)
      } catch (e) {
        // Unusable bounds, like -2 -2 -2 -2?
        console.error('Error limiting bounds', e)
      }
    } else {
      this.options.minZoom = 0
      this.setMaxBounds()
    }
  },

  setMaxBounds: function (bounds) {
    // Hack. Remove me when fix is released:
    // https://github.com/Leaflet/Leaflet/pull/4494
    if (!(bounds instanceof LatLngBounds)) {
      bounds = new LatLngBounds(bounds)
    }

    if (!bounds.isValid()) {
      this.options.maxBounds = null
      return this.off('moveend', this._panInsideMaxBounds)
    }
    return BaseMap.prototype.setMaxBounds.call(this, bounds)
  },

  getLayersBounds: (layers) => {
    const bounds = new LatLngBounds()
    for (const layer of layers) {
      bounds.extend(layer.getBounds())
    }
    return bounds
  },

  initEditTools: function () {
    this.editTools = new U.Editable(this._umap)
  },
})
