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
  GeoJSON,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import { Alert } from '../../components/alerts/alert.js'
import { translate } from '../i18n.js'
import * as GeoUtils from '../geoutils.js'
import * as Utils from '../utils.js'
import { LeafletIcon, layerClass } from './ui.js'
import { Default as DefaultLayer } from '../rendering/layers/base.js'
import { Cluster } from '../rendering/layers/cluster.js'
import { Heat } from '../rendering/layers/heat.js'

// Leaflet layers we override (but only for the *rendering* part, no compute/config…)
const LAYER_MAP = { Cluster, Heat }

export class LeafletProxy {
  constructor(app, element) {
    this.app = app
    this.points = {}
    this.layers = {}
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
        this.app.fire(`map:${event.type}`, { event: event })
      }
    )
    this.map.on('feature:mouseover', (event) => {
      if (!this.app.editEnabled) return
      if (!this.app.editedFeature) {
        this.app.tooltip.open({
          content: translate('Right-click to edit'),
        })
      }
      // Drag-to-move on hover, for markers only.
      const { layer } = event
      if (layer.getLatLng && !layer.editEnabled()) {
        layer.enableEdit()
      }
    })
    this.map.on('feature:mouseout', (event) => {
      if (!this.app.editEnabled) return
      const { layer } = event
      if (!layer.editor?.drawing) layer.disableEdit()
    })
    this.map.on('feature:dragend', (event) => {
      const { id, layer } = event
      if (layer._cluster) {
        const feature = this.getFeatureById(id)
        // Else unspiderfy snaps the marker back to its pre-spiderfy position.
        delete layer._originalLatLng
        // The layer
        layer.once('editable:edited', () => {
          // Force recompute of the related cluster
          feature.datalayer.dataChanged()
          feature.edit()
        })
      }
    })
    this.map.on('feature:click', (event) => {
      const { id, layer, latlng } = event
      const feature = this.getFeatureById(id)
      if (this.map.measureTools?.enabled()) return
      layer._popupHandlersAdded = true // Prevent leaflet from managing event
      if (event.originalEvent.shiftKey) {
        if (event.originalEvent.ctrlKey || event.originalEvent.metaKey) {
          feature.datalayer.edit(event)
        } else if (!feature.isReadOnly()) {
          feature.edit()
        }
      } else if (!this.map.editTools?.drawing()) {
        feature.view({ center: [latlng.lng, latlng.lat] })
      }
    })
    this.map.on('feature:commit', (event) => {
      this.getFeatureById(event.id)?.onCommit(event.geometry)
    })
    this.map.on('feature:route', (event) => {
      this.getFeatureById(event.id)?.setRoute(event.coordinates)
    })
    this.map.on('feature:contextmenu', (event) => {
      const feature = this.getFeatureById(event.id)
      if (!feature) return
      const items = feature
        .getContextMenu(event)
        .concat(this.app.getSharedContextMenu(event))
      this.app.contextmenu.open(event.originalEvent, items)
    })
  }

  proxyOutgoingEvents() {
    // For hash changes
    this.app.on('map:view:update', (event) => {
      let { zoom, coordinate } = event.detail
      if (!Utils.coordinateIsValid(coordinate)) return
      zoom = Math.min(zoom, this.map.getMaxZoom())
      zoom = Math.max(zoom, this.map.getMinZoom())
      const [lng, lat] = coordinate
      this.map.setView([lat, lng], zoom, { animate: false })
    })
    this.app.on('map:show:point', (event) => {
      this.showPoint({ ...event.detail })
    })
    this.app.on('map:hide:point', (event) => {
      this.hidePoint(event.detail.id)
    })
    this.app.on('map:view:fit-bounds', (event) => {
      const { bounds, zoom, easing } = event.detail
      const latLngBounds = this.toLatLngBounds(bounds)
      if (easing) {
        this.map.flyToBounds(latLngBounds, { maxZoom: zoom ?? this.zoom })
      } else {
        this.map.fitBounds(latLngBounds, zoom ?? this.zoom)
      }
    })
    this.app.on('map:view:set', (event) => {
      const { easing, zoom } = event.detail
      const center = this.latLng({ coordinates: event.detail.center })
      if (easing) {
        this.map.flyTo(center, { maxZoom: zoom ?? this.zoom })
      } else {
        this.map.setView(center, zoom ?? this.zoom)
      }
    })
    this.app.on('draw:marker', () => this.map.editTools.startMarker())
    this.app.on('draw:polyline', () => this.map.editTools.startPolyline())
    this.app.on('draw:multiline', () =>
      this.getLayer(this.app.editedFeature.id)?.editor.newShape()
    )
    this.app.on('draw:polygon', () => this.map.editTools.startPolygon())
    this.app.on('draw:multipolygon', () =>
      this.getLayer(this.app.editedFeature.id)?.editor.newShape()
    )
    this.app.on('draw:route', () => this.map.editTools.startRoute())
    this.app.on('map:resize', () => this.map.invalidateSize())
    this.app.on('panel:show', (event) => {
      this.revealInCluster(this.getLayer(event.detail.id))
      // The panel popup isn't a Leaflet popup, so emulate its close lifecycle:
      // close on a map background click, or when another Leaflet popup opens.
      this.map.once('click popupopen', () => this.app.fire('panel:close'))
    })
    this.app.on('popup:show', (event) => {
      const { id, content, center } = event.detail
      const [lon, lat] = center
      // The popup is map-level (not layer-bound), so highlight the matching
      // feature's layer here, and undo it once this popup closes.
      const layer = this.getLayer(id)
      const offset = layer?._getPopupAnchor?.()
      this.map.openPopup(content, [lat, lon], offset ? { offset } : undefined)
      layer?.highlight()
      this.revealInCluster(layer)
      this.map.once('popupclose', () => layer?.unhighlight())
    })
    this.app.on('popup:close', () => this.map.closePopup())
    this.app.on('feature:edit', (event) => {
      this.editLayer(event.detail.id)
    })
    this.app.on('feature:endedit', (event) => {
      this.getLayer(event.detail.id)?.disableEdit()
    })
    this.app.on('feature:hole', (event) => {
      const { id, coordinate } = event.detail
      this.getLayer(id)
        ?.enableEdit()
        .newHole(this.latLng({ coordinates: coordinate }))
    })
    this.app.on('feature:reset', (event) => {
      const { sourceId, geojson } = event.detail
      const group = this.layers[sourceId]
      const layer = this.getLayer(geojson.id)
      if (!layer) return
      if (layerClass(geojson) !== layer.getClass()) {
        const wasEditing = layer.editEnabled()
        this.removeFeature(sourceId, geojson.id)
        this.addFeature(sourceId, geojson)
        if (wasEditing) this.editLayer(geojson.id)
        return
      }
      // Swap in the freshly baked geojson (Leaflet reads layer.feature, our
      // code reads layer.geojson — same object), then reflect it.
      layer.geojson = layer.feature = geojson
      if (layer.setIcon) {
        // Marker: rebuild the icon (and tooltip) from the new geojson.
        layer._redraw()
      } else {
        // Path/CircleMarker: re-read geojson.style through the group style fn.
        group.resetStyle(layer)
        layer.resetTooltip()
      }
    })
  }

  get container() {
    return this.map._container
  }

  getFeatureById(id) {
    for (const layer of this.app.layers.tree) {
      if (layer.features.has(id)) {
        return layer.features.get(id)
      }
    }
  }

  attachUI(container) {
    this.container.appendChild(container)
  }

  render() {
    if (!this.map.measureTools) {
      new L.Measurable(this.map)
    }
    this.initCenter()

    // Wait for URL to have been parsed before modifying the hash
    const updateHash = () => {
      const center = this.map.getCenter()
      this.app.fire('map:view:updated', {
        zoom: this.map.getZoom(),
        coordinate: [center.lng.toFixed(6), center.lat.toFixed(6)],
      })
    }
    this.map.on('moveend', updateHash)
    updateHash()
    this.tilelayers.init(this.app.properties.tilelayers)
    this.tilelayers.selectDefault()
    this.updateUI()
  }

  setDefaultCenter() {
    const [lon, lat] = this.app.properties.center
    // this.app.properties.center = this.latLng()
    this.map.setView([lat, lon], this.app.properties.zoom)
  }

  async initCenter() {
    this.setDefaultCenter()

    if (this.app.properties.hash && window.location.hash) {
      // FIXME An invalid hash will cause the load to fail
      this.app.hash.parse()
    } else if (
      this.app.properties.defaultView === 'locate' &&
      !this.app.properties.noControl
    ) {
      await this.app.controlManager.controls.locate.start()
    } else if (this.app.properties.defaultView === 'data') {
      this.app.onceDataLoaded(() => this.app.fitDataBounds())
    } else if (this.app.properties.defaultView === 'latest') {
      this.app.onceDataLoaded(() => {
        if (!this.app.hasData()) return
        // TODO: uMap.latestFeature ?
        const datalayer = this.app.layers.tree.visible().first()
        if (datalayer) {
          const feature = datalayer.features.last()
          if (feature) {
            feature.zoomTo({
              callback: this.app.properties.noControl ? null : feature.view,
            })
            return
          }
        }
      })
    }
  }

  updateUI() {
    if (this.app.getProperty('scrollWheelZoom')) {
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

  showPoint({ id, position, icon }) {
    const [lng, lat] = position
    if (!this.points[id]) {
      this.points[id] = new Marker([lat, lng], {
        icon: new LeafletIcon(icon),
      })
    }
    this.points[id].addTo(this.map)
    this.points[id].setLatLng([lat, lng])
  }

  hidePoint(id) {
    this.points?.[id]?.remove()
  }

  handleLimitBounds() {
    const south = Number.parseFloat(this.app.properties.limitBounds?.south)
    const west = Number.parseFloat(this.app.properties.limitBounds?.west)
    const north = Number.parseFloat(this.app.properties.limitBounds?.north)
    const east = Number.parseFloat(this.app.properties.limitBounds?.east)
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

  toLatLngBounds([west, south, east, north]) {
    return new LatLngBounds([
      [south, west],
      [north, east],
    ])
  }

  getGeoContext() {
    const [west, south, east, north] = this.bounds
    const [lng, lat] = this.center
    const context = {
      bbox: this.bounds.join(','),
      north,
      east,
      south,
      west,
      lat,
      lng,
      zoom: this.zoom,
    }
    context.left = west
    context.bottom = south
    context.right = east
    context.top = north
    return context
  }

  get bounds() {
    const bounds = this.map.getBounds()
    return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
  }

  get center() {
    const center = this.map.getCenter()
    return [center.lng, center.lat]
  }

  set zoom(value) {
    this.map.setZoom(value)
  }

  get zoom() {
    return this.map.getZoom()
  }

  initEditTools() {
    this.map.editTools = new U.Editable(this.app)
  }
  enableEdit() {}
  onEscape() {
    if (this.app.editEnabled && this.map.editTools.drawing()) {
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
    return this.map.getBoundsZoom(this.toLatLngBounds(bounds), inside)
  }

  get overlayPane() {
    return this.map.getPane('overlayPane')
  }

  createOverlayPane(id, container) {
    return this.map.createPane(`pane-${id}`, container || this.overlayPane)
  }

  hideLayer(id) {
    const layer = this.layers[id]
    if (layer) this.map.removeLayer(layer)
  }

  clearLayer(id) {
    const layer = this.layers[id]
    if (layer) layer.clearLayers()
  }

  createLayer(datalayer) {
    const Class = LAYER_MAP[datalayer.Type?.type] || DefaultLayer
    const layer = new Class(datalayer)
    // Paths render into the datalayer's own pane, so they stack by datalayer
    // order; Leaflet lazily creates one renderer per pane.
    layer.pane = `pane-${datalayer.id}`
    this.layers[datalayer.id] = layer
  }

  showLayer(id) {
    const layer = this.layers[id]
    if (layer) this.map.addLayer(layer)
  }

  addData(id, geojson) {
    this.layers[id].addData(geojson)
  }

  addFeature(id, geojson) {
    this.layers[id]?.addData(geojson)
  }

  hasLayer(id) {
    const layer = this.layers[id]
    return Boolean(layer) && this.map.hasLayer(layer)
  }

  clear(id) {
    this.layers[id]?.clearLayers()
  }

  getLayerInGroup(layerId, featureId) {
    const group = this.layers[layerId]
    return (
      group?.getLayers?.().find((l) => l.feature?.id === featureId) ||
      group?._bucket?.find((m) => m.feature?.id === featureId)
    )
  }

  pushGeometry(layerId, featureId, geometry) {
    const layer = this.getLayerInGroup(layerId, featureId)
    if (!layer) return
    const coordinates = GeoUtils.flip(geometry).coordinates
    if (geometry.type === 'Point') layer.setLatLng(coordinates)
    else layer.setLatLngs(coordinates)
    // Stale editing handles otherwise keep pointing at the previous geometry.
    if (layer.editor?.enabled()) layer.editor.reset()
  }

  startDrawing(layerId, geojson) {
    // Build the layer so it looks real but let Leaflet.Editable add it to the map
    const group = this.layers[layerId]
    const layer = GeoJSON.geometryToLayer(geojson, group.options)
    layer.feature = geojson
    layer.defaultOptions = layer.options
    group.resetStyle(layer)
    return layer
  }

  connectDrawing(layer) {
    const feature = this.getFeatureById(layer.feature.id)
    this.layers[feature.datalayer.id].addLayer(layer)
    return layer
  }

  removeFeature(id, featureId) {
    const layer = this.getLayerInGroup(id, featureId)
    if (layer) this.layers[id]?.removeLayer(layer)
  }

  get hasExtent() {
    return Boolean(this.map.options.maxBounds)
  }

  getExtentBBoxString() {
    // southwest_lng,southwest_lat,northeast_lng,northeast_lat'
    return this.map.options.maxBounds?.toBBoxString()
  }

  editLayer(id) {
    const layer = this.getLayer(id)
    if (!layer) return
    // Paths gate geometry editing on vertex count vs zoom; markers edit freely.
    if (layer.shouldAllowGeometryEdit) this.makeGeometryEditable(layer)
    else layer.enableEdit()
  }

  makeGeometryEditable(layer) {
    if (!layer._map) return
    // Re-evaluate as the viewport changes; stop once another feature is edited.
    if (this.app.editedFeature?.id !== layer.feature.id) {
      layer.disableEdit()
      return
    }
    this.map.once('moveend', () => this.makeGeometryEditable(layer))
    if (layer.shouldAllowGeometryEdit()) {
      layer.enableEdit()
    } else {
      this.app.tooltip.open({
        content: translate('Please zoom in to edit the geometry'),
      })
      layer.disableEdit()
    }
  }

  revealInCluster(layer) {
    const cluster = layer?._cluster
    if (cluster) cluster.zoomToCoverage().then(() => cluster.spiderfy())
  }

  getLayer(id) {
    for (const layer of Object.values(this.map._layers)) {
      if (layer.feature?.id === id) return layer
    }
    // Clustered markers wait in the cluster bucket, not on the map.
    for (const group of Object.values(this.layers)) {
      const layer = group._bucket?.find((marker) => marker.feature?.id === id)
      if (layer) return layer
    }
  }
}

class TileLayerManager {
  constructor(proxy) {
    this.proxy = proxy
    this.all = new Map()
    this.current = undefined
    this.overlay = undefined
  }

  get app() {
    return this.proxy.app
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
    layer.on('loading', () => this.app.loader.start(stamp(layer)))
    layer.on('load', () => this.app.loader.stop(stamp(layer)))
    return layer
  }

  add(spec) {
    if (!spec.url_template) return
    if (this.all.has(spec.url_template)) return this.all.get(spec.url_template)
    const layer = this.create(spec)
    this.all.set(spec.url_template, layer)
    return layer
  }

  default() {
    return this.all.values().next().value
  }

  // Display the configured base layer: the custom one (`properties.tilelayer`)
  // if it is set, else the first of the registry.
  selectDefault() {
    const custom = this.app.properties.tilelayer
    if (custom?.url_template && custom.attribution) {
      this.select(this.add({ ...custom, rank: 0 }))
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
    const spec = this.app.properties.overlay
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
