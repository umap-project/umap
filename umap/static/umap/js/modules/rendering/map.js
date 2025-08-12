// Goes here all code related to Leaflet, DOM and user interactions.
import {
  Map as BaseMap,
  Control,
  DomEvent,
  DomUtil,
  latLng,
  latLngBounds,
  setOptions,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import DropControl from '../drop.js'
import { translate } from '../i18n.js'
import {
  AttributionControl,
  CaptionControl,
  DataLayersControl,
  EmbedControl,
  EditControl,
  HomeControl,
  MoreControl,
  PermanentCreditsControl,
  TileLayerChooser,
  LoadTemplateControl,
  PrintControl,
  SearchControl,
} from './controls.js'
import * as Utils from '../utils.js'
import * as Icon from './icon.js'

// Those options are not saved on the server, so they can live here
// instead of in umap.properties
BaseMap.mergeOptions({
  demoTileInfos: { s: 'a', z: 9, x: 265, y: 181, '-y': 181, r: '' },
  attributionControl: false,
})

const ControlsMixin = {
  HIDDABLE_CONTROLS: [
    'home',
    'zoom',
    'search',
    'fullscreen',
    'embed',
    'datalayers',
    'caption',
    'locate',
    'measure',
    'editinosm',
    'print',
    'tilelayers',
  ],

  initControls: function () {
    this._controls = {}

    if (this._umap.properties.is_template && !this.options.noControl) {
      new LoadTemplateControl(this).addTo(this)
    }

    if (this._umap.hasEditMode() && !this.options.noControl) {
      new EditControl(this).addTo(this)
    }
    this._controls.home = new HomeControl(this._umap)
    this._controls.zoom = new Control.Zoom({
      zoomInTitle: translate('Zoom in'),
      zoomOutTitle: translate('Zoom out'),
    })
    this._controls.datalayers = new DataLayersControl(this._umap)
    this._controls.caption = new CaptionControl(this._umap)
    this._controls.locate = new U.Locate(this, {
      strings: {
        title: translate('Center map on your location'),
      },
      showPopup: false,
      // We style this control in our own CSS for consistency with other controls,
      // but the control breaks if we don't specify a class here, so a fake class
      // will do.
      icon: 'umap-fake-class',
      iconLoading: 'umap-fake-class',
      flyTo: this.options.easing,
      onLocationError: (err) => U.Alert.error(err.message),
    })
    this._controls.fullscreen = new Control.Fullscreen({
      title: {
        false: translate('View Fullscreen'),
        true: translate('Exit Fullscreen'),
      },
    })
    this._controls.search = new SearchControl(this._umap)
    this._controls.embed = new EmbedControl(this._umap)
    this._controls.print = new PrintControl(this._umap)
    this._controls.tilelayersChooser = new TileLayerChooser(this._umap)
    this._controls.editinosm = new Control.EditInOSM({
      position: 'topleft',
      widgetOptions: {
        helpText: translate(
          'Open this map extent in a map editor to provide more accurate data to OpenStreetMap'
        ),
      },
    })
    this._controls.measure = new L.MeasureControl().initHandler(this)
    this._controls.more = new MoreControl()
    this._controls.scale = L.control.scale()
    this._controls.permanentCredit = new PermanentCreditsControl(this)
    this._umap.drop = new DropControl(this._umap, this, this._container)
    this._controls.tilelayers = new U.TileLayerControl(this)
  },

  renderControls: function () {
    for (const control of Object.values(this._controls)) {
      this.removeControl(control)
    }
    if (this.options.noControl) return

    this._controls.attribution = new AttributionControl().addTo(this)
    if (this.options.miniMap) {
      this.whenReady(function () {
        if (this.selectedTilelayer) {
          this._controls.miniMap = new Control.MiniMap(this.selectedTilelayer, {
            aimingRectOptions: {
              color: this._umap.getProperty('color'),
              fillColor: this._umap.getProperty('fillColor'),
              stroke: this._umap.getProperty('stroke'),
              fill: this._umap.getProperty('fill'),
              weight: this._umap.getProperty('weight'),
              opacity: this._umap.getProperty('opacity'),
              fillOpacity: this._umap.getProperty('fillOpacity'),
            },
          }).addTo(this)
          this._controls.miniMap._miniMap.invalidateSize()
        }
      })
    }
    for (const name of this.HIDDABLE_CONTROLS) {
      const status = this._umap.getProperty(`${name}Control`)
      if (status === false) continue
      const control = this._controls[name]
      if (!control) continue
      control.addTo(this)
      if (status === undefined || status === null) {
        DomUtil.addClass(control._container, 'display-on-more')
      } else {
        DomUtil.removeClass(control._container, 'display-on-more')
      }
    }
    if (this._umap.getProperty('permanentCredit'))
      this._controls.permanentCredit.addTo(this)
    if (this._umap.getProperty('moreControl')) this._controls.more.addTo(this)
    if (this._umap.getProperty('scaleControl')) this._controls.scale.addTo(this)
    this._controls.tilelayers.setLayers()
  },
}

const ManageTilelayerMixin = {
  initTileLayers: function () {
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
    if (this._controls) this._controls.tilelayers.setLayers()
  },

  createTileLayer: (tilelayer) => new L.TileLayer(tilelayer.url_template, tilelayer),

  selectTileLayer: function (tilelayer) {
    if (tilelayer === this.selectedTilelayer) {
      return
    }
    try {
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

  editTileLayers: function () {
    if (this._controls.tilelayersChooser) {
      this._controls.tilelayersChooser.openSwitcher({ edit: true })
    }
  },
}

export const LeafletMap = BaseMap.extend({
  includes: [ControlsMixin, ManageTilelayerMixin],

  // The initialize and the setup method might seem similar, but they
  // serve two different purposes:
  // initialize is for Leaflet internal, when we do "new LeafletMap",
  // while setup is the public API for the LeafletMap to actually
  // render to the DOM.
  initialize: function (umap, element) {
    this._umap = umap
    const options = this._umap.properties

    BaseMap.prototype.initialize.call(this, element, options)

    // After calling parent initialize, as we are doing initCenter our-selves

    this.loader = new Control.Loading()
    this.loader.onAdd(this)

    if (!this.options.noControl) {
      DomEvent.on(document.body, 'dataloading', (event) =>
        this.fire('dataloading', event.detail)
      )
      DomEvent.on(document.body, 'dataload', (event) =>
        this.fire('dataload', event.detail)
      )
    }

    this.on('baselayerchange', (e) => {
      if (this._controls.miniMap) this._controls.miniMap.onMainMapBaseLayerChange(e)
    })
  },

  setup: function () {
    this.initControls()
    // Needs locate control and hash to exist
    this.initCenter()
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
      if (L.Browser.mobile) this.dragging.disable()
    }
    // Needs tilelayer to exist for minimap
    this.renderControls()
    this.handleLimitBounds()
  },

  latLng: (a, b, c) => {
    // manage geojson case and call original method
    if (!(a instanceof L.LatLng) && a.coordinates) {
      // Guess it's a geojson
      a = [a.coordinates[1], a.coordinates[0]]
    }
    return latLng(a, b, c)
  },

  _setDefaultCenter: function () {
    this.options.center = this.latLng(this.options.center)
    this.setView(this.options.center, this.options.zoom)
  },

  initCenter: function () {
    this._setDefaultCenter()
    if (this.options.hash) this.addHash()
    if (this.options.hash && this._hash.parseHash(location.hash)) {
      // FIXME An invalid hash will cause the load to fail
      this._hash.update()
    } else if (this.options.defaultView === 'locate' && !this.options.noControl) {
      this._controls.locate.start()
    } else if (this.options.defaultView === 'data') {
      this._umap.onceDataLoaded(this._umap.fitDataBounds)
    } else if (this.options.defaultView === 'latest') {
      this._umap.onceDataLoaded(() => {
        if (!this._umap.hasData()) return
        const datalayer = this._umap.datalayers.visible()[0]
        let feature
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
    const south = Number.parseFloat(this.options.limitBounds.south)
    const west = Number.parseFloat(this.options.limitBounds.west)
    const north = Number.parseFloat(this.options.limitBounds.north)
    const east = Number.parseFloat(this.options.limitBounds.east)
    if (
      !Number.isNaN(south) &&
      !Number.isNaN(west) &&
      !Number.isNaN(north) &&
      !Number.isNaN(east)
    ) {
      const bounds = latLngBounds([
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
    bounds = latLngBounds(bounds)

    if (!bounds.isValid()) {
      this.options.maxBounds = null
      return this.off('moveend', this._panInsideMaxBounds)
    }
    return BaseMap.prototype.setMaxBounds.call(this, bounds)
  },

  initEditTools: function () {
    this.editTools = new U.Editable(this._umap)
  },
})
