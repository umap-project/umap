// Goes here all code related to Leaflet, DOM and user interactions.
import {
  Browser,
  LatLng,
  LatLngBounds,
  Map as LeafletMap,
  Marker,
  latLng,
  setOptions,
  stamp,
  TileLayer,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import { translate } from '../i18n.js'
import * as Utils from '../utils.js'
import { LeafletIcon } from './ui.js'

export class LeafletProxy {
  constructor(umap, element) {
    this.umap = umap
    this.points = {}
    this.map = new LeafletMap(element, {
      miniMapControl: false,
      attributionControl: false,
      zoomControl: false,
    })
    this.tilelayers = new TileLayerManager(this)
    this.proxyIncomingEvents()
    this.proxyOutgoingEvents()
  }

  proxyIncomingEvents() {
    this.map.on(
      'locateactivate locatedeactivate moveend zoomend contextmenu popupclose zoomlevelschange',
      (event) => {
        this.umap.fire(`map:${event.type}`, { event: event })
      }
    )
    this.map.on('feature:mouseover', () => {
      if (this.umap.editEnabled && !this.umap.editedFeature) {
        this.umap.tooltip.open({
          content: translate('Right-click to edit'),
        })
      }
    })
  }

  proxyOutgoingEvents() {
    // For hash changes
    this.umap.on('map:view:update', (event) => {
      let { zoom, latlng } = event.detail
      if (!Utils.LatLngIsValid(latlng)) return
      zoom = Math.min(zoom, this.map.getMaxZoom())
      zoom = Math.max(zoom, this.map.getMinZoom())
      this.map.setView(latlng, zoom)
    })
    this.umap.on('map:show:point', (event) => {
      this.showPoint({ ...event.detail })
    })
    this.umap.on('map:hide:point', (event) => {
      this.hidePoint(event.detail.id)
    })
    this.umap.on('map:view:fit-bounds', (event) => {
      const { bounds, zoom, easing } = event.detail
      if (easing) {
        this.map.flyToBounds(bounds, { maxZoom: zoom ?? this.zoom })
      } else {
        this.map.fitBounds(bounds, zoom ?? this.zoom)
      }
    })
    this.umap.on('map:view:set', (event) => {
      const { easing, center, zoom } = event.detail
      if (easing) {
        this.map.flyTo(center, { maxZoom: zoom ?? this.zoom })
      } else {
        this.map.setView(center, zoom ?? this.zoom)
      }
    })
    this.umap.on('draw:marker', () => this.map.editTools.startMarker())
    this.umap.on('draw:polyline', () => this.map.editTools.startPolyline())
    this.umap.on('draw:multiline', () => this.umap.editedFeature.ui.editor.newShape())
    this.umap.on('draw:polygon', () => this.map.editTools.startPolygon())
    this.umap.on('draw:multipolygon', () =>
      this.umap.editedFeature.ui.editor.newShape()
    )
    this.umap.on('draw:route', () => this.map.editTools.startRoute())
    this.umap.on('map:resize', () => this.map.invalidateSize())
  }

  get container() {
    return this.map._container
  }

  render() {
    if (!this.map.measureTools) {
      new L.Measurable(this.map)
    }
    this.initCenter()

    // Wait for URL to have been parsed before modifying the hash
    const updateHash = () => {
      const center = this.map.getCenter()
      this.umap.fire('map:view:updated', {
        zoom: this.map.getZoom(),
        latlng: [center.lat.toFixed(6), center.lng.toFixed(6)],
      })
    }
    this.map.on('moveend', updateHash)
    updateHash()
    this.tilelayers.init(this.umap.properties.tilelayers)
    this.tilelayers.selectDefault()
    this.updateUI()
  }

  setDefaultCenter() {
    this.umap.properties.center = this.latLng(this.umap.properties.center)
    this.map.setView(this.umap.properties.center, this.umap.properties.zoom)
  }

  async initCenter() {
    this.setDefaultCenter()

    if (this.umap.properties.hash && window.location.hash) {
      // FIXME An invalid hash will cause the load to fail
      this.umap.hash.parse()
    } else if (
      this.umap.properties.defaultView === 'locate' &&
      !this.umap.properties.noControl
    ) {
      await this.umap.controlManager.controls.locate.start()
    } else if (this.umap.properties.defaultView === 'data') {
      this.umap.onceDataLoaded(() => this.umap.fitDataBounds())
    } else if (this.umap.properties.defaultView === 'latest') {
      this.umap.onceDataLoaded(() => {
        if (!this.umap.hasData()) return
        // TODO: uMap.latestFeature ?
        const datalayer = this.umap.layers.tree.visible().first()
        if (datalayer) {
          const feature = datalayer.features.last()
          if (feature) {
            feature.zoomTo({
              callback: this.umap.properties.noControl ? null : feature.view,
            })
            return
          }
        }
      })
    }
  }

  updateUI() {
    if (this.umap.getProperty('scrollWheelZoom')) {
      this.map.scrollWheelZoom.enable()
      this.map.dragging.enable()
    } else {
      this.map.scrollWheelZoom.disable()
      // In mobile, do not let the user move the map
      // when scrolling the main page and touching the
      // map in an iframe. May be a bit dumb, but let's
      // try like this for now.
      if (Browser.mobile) this.map.dragging.disable()
    }
    this.handleLimitBounds()
  }

  latLng(a, b, c) {
    // manage geojson case and call original method
    if (!(a instanceof LatLng) && a.coordinates) {
      // Guess it's a geojson
      a = [a.coordinates[1], a.coordinates[0]]
    }
    return latLng(a, b, c)
  }

  showPoint({ id, latlng, icon }) {
    if (!this.points[id]) {
      this.points[id] = new Marker(latlng, {
        icon: new LeafletIcon(icon),
      })
    }
    this.points[id].addTo(this.map)
    this.points[id].setLatLng(latlng)
  }

  hidePoint(id) {
    this.points?.[id]?.remove()
  }

  handleLimitBounds() {
    const south = Number.parseFloat(this.umap.properties.limitBounds?.south)
    const west = Number.parseFloat(this.umap.properties.limitBounds?.west)
    const north = Number.parseFloat(this.umap.properties.limitBounds?.north)
    const east = Number.parseFloat(this.umap.properties.limitBounds?.east)
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
      this.map.setMinZoom(this.map.getBoundsZoom(bounds, false))
      try {
        this.map.setMaxBounds(bounds)
      } catch (e) {
        // Unusable bounds, like -2 -2 -2 -2?
        console.error('Error limiting bounds', e)
      }
    } else {
      this.map.setMinZoom(0)
      this.map.setMaxBounds()
    }
  }

  getLayersBounds(layers) {
    const bounds = new LatLngBounds()
    for (const layer of layers) {
      bounds.extend(layer.getBounds())
    }
    return bounds
  }

  get bounds() {
    return this.map.getBounds()
  }

  get center() {
    // TODO return geojson, not LatLng
    return this.map.getCenter()
  }

  set zoom(value) {
    this.map.setZoom(value)
  }

  get zoom() {
    return this.map.getZoom()
  }

  initEditTools() {
    this.map.editTools = new U.Editable(this.umap)
  }

  onEscape() {
    if (this.umap.editEnabled && this.map.editTools.drawing()) {
      this.map.editTools.onEscape()
      return true
    }
    if (this.map.measureTools.enabled()) {
      this.map.measureTools.stopDrawing()
      return true
    }
  }

  isDrawing() {
    return this.map.editTools.drawing()
  }

  interruptDrawing() {
    this.map.editTools.onEscape()
  }

  toggleFullscreen() {
    this.map.toggleFullscreen()
  }

  getBoundsZoom(bounds, inside) {
    return this.map.getBoundsZoom(bounds, inside)
  }

  get overlayPane() {
    return this.map.getPane('overlayPane')
  }

  createOverlayPane(id, container) {
    return this.map.createPane(`pane-${id}`, container || this.overlayPane)
  }

  removeLayer(layer) {
    this.map.removeLayer(layer)
  }

  addLayer(layer) {
    this.map.addLayer(layer)
  }

  hasLayer(layer) {
    return this.map.hasLayer(layer)
  }
}

class TileLayerManager {
  constructor(proxy) {
    this.proxy = proxy
    this.all = new Map()
    this.current = undefined
    this.overlay = undefined
  }

  get umap() {
    return this.proxy.umap
  }

  get map() {
    return this.proxy.map
  }

  init(specs) {
    this.all.clear()
    for (const spec of specs) {
      this.add(spec)
    }
  }

  create(spec) {
    const layer = new TileLayer(spec.url_template, spec)
    layer.on('loading', () => this.umap.loader.start(stamp(layer)))
    layer.on('load', () => this.umap.loader.stop(stamp(layer)))
    return layer
  }

  add(spec) {
    if (!spec.url_template) return
    if (this.all.has(spec.url_template)) return this.all.get(spec.url_template)
    const layer = this.create(spec)
    // TODO change order so the latest is first (specifically the custom layer (i.e not in the
    // ones from the DB) must appear first in the list)
    this.all.set(spec.url_template, layer)
    return layer
  }

  default() {
    return this.all.values().next().value
  }

  // Display the configured base layer: the custom one (`properties.tilelayer`)
  // if it is set, else the first of the registry.
  selectDefault() {
    const custom = this.umap.properties.tilelayer
    if (custom?.url_template && custom.attribution) {
      this.select(this.create(custom))
    } else {
      this.select(this.default())
    }
  }

  select(tilelayer) {
    this.map.fire('baselayerchange', { layer: tilelayer })
    const { minZoom, maxZoom } = tilelayer.options
    if (!Number.isNaN(minZoom) && this.proxy.zoom < minZoom) {
      this.map.setZoom(minZoom)
    }
    if (!Number.isNaN(maxZoom) && this.proxy.zoom > maxZoom) {
      this.map.setZoom(maxZoom)
    }
    try {
      this.map.addLayer(tilelayer)
      if (this.current) {
        this.map.removeLayer(this.current)
      }
      this.current = tilelayer
    } catch (e) {
      console.error(e)
      this.map.removeLayer(tilelayer)
      Alert.error(`${translate('Error in the tilelayer URL')}: ${tilelayer._url}`)
      // Users can put tilelayer URLs by hand, and if they add wrong {variable},
      // Leaflet throw an error, and then the map is no more editable
    }
    this.setOverlay()
  }

  setOverlay() {
    const spec = this.umap.properties.overlay
    if (!spec?.url_template) return
    const overlay = this.create(spec)
    try {
      this.map.addLayer(overlay)
      if (this.overlay) this.map.removeLayer(this.overlay)
      this.overlay = overlay
    } catch (e) {
      this.map.removeLayer(overlay)
      console.error(e)
      Alert.error(`${translate('Error in the overlay URL')}: ${overlay._url}`)
    }
  }
}
