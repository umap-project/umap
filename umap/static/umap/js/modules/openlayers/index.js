import { default as OLMap } from 'ol/Map.js'
import TileLayer from 'ol/layer/Tile.js'
import XYZ from 'ol/source/XYZ.js'
import View from 'ol/View.js'
import GeoJSON from 'ol/format/GeoJSON.js'
import VectorSource from 'ol/source/Vector.js'
import VectorLayer from 'ol/layer/Vector.js'
import { fromLonLat, transformExtent, toLonLat } from 'ol/proj.js'
// import Draw from 'ol/interaction/Draw.js'
import Overlay from 'ol/Overlay.js'
import Stroke from 'ol/style/Stroke.js'
import Fill from 'ol/style/Fill.js'
import Style from 'ol/style/Style.js'
import Modify from 'ol/interaction/Modify.js'
import * as Utils from '../utils.js'
import { makeIcon } from './icon.js'
import { rgba } from './utils.js'

const POINT_ZINDEX_OFFSET = 10000
const HIGHLIGHT_ZINDEX = 1e6

export class OLProxy {
  constructor(app, element) {
    this.app = app
    this.sources = {}
    this.layers = {}
    this.highlighted = null
    this.map = new OLMap({
      target: element,
      controls: [],
    })
    this.tilelayers = new TileLayerManager(this)

    this.map.on('pointermove', (event) => {
      this.map.getTargetElement().style.cursor = this.map.hasFeatureAtPixel(event.pixel)
        ? 'pointer'
        : ''
    })

    this.proxyOutgoingEvents()
    this.proxyIncomingEvents()
  }

  proxyIncomingEvents() {
    this.map.on('click', (event) => this.onClick(event))
    this.map.on('contextmenu', (event) => this.onContextMenu(event))
  }

  proxyOutgoingEvents() {
    // For hash changes
    this.app.on('map:view:update', (event) => {
      let { zoom, coordinate } = event.detail
      if (!Utils.coordinateIsValid(coordinate)) return
      zoom = Math.min(zoom, this.map.getView().getMaxZoom())
      zoom = Math.max(zoom, this.map.getView().getMinZoom())
      this.map.setView(
        new View({
          center: fromLonLat(coordinate),
          zoom,
        })
      )
    })

    this.app.on('map:view:set', (event) => {
      const { easing, zoom } = event.detail
      const coordinates = event.detail.coordinates
      if (easing) {
        this.view.animate({ zoom }, { coordinates })
      } else {
        this.view.setCenter(fromLonLat(coordinates))
        this.view.setZoom(zoom)
      }
    })
    this.app.on('panel:show', (event) => {
      const { content } = event.detail
      this.app.panel.open({ content })
    })
    this.app.on('popup:show', (event) => {
      const { sourceId, id, content, center } = event.detail
      const overlay = new Overlay({
        element: content,
        autoPan: {
          animation: {
            duration: 250,
          },
        },
      })
      overlay.setPosition(fromLonLat(center))
      this.map.addOverlay(overlay)
      this.highlight(sourceId, id)
    })
    this.app.on('popup:close', () => this.closePopup())
    this.app.on('feature:reset', (event) => {
      const { sourceId, geojson } = event.detail
      const olFeature = this.sources[sourceId]?.getFeatureById(geojson.id)
      if (!olFeature) return
      this.setFeatureStyle(olFeature, geojson)
      olFeature.changed()
    })
  }

  get view() {
    return this.map.getView()
  }

  set zoom(value) {
    this.map.getView().setZoom(value)
  }

  get zoom() {
    return this.map.getView().getZoom()
  }

  get resolution() {
    return this.map.getView().getResolution()
  }

  get bounds() {
    return transformExtent(this.view.calculateExtent(), 'EPSG:3857', 'EPSG:4326')
  }

  get center() {
    return toLonLat(this.view.getCenter())
  }

  getGeoContext() {
    const [west, south, east, north] = this.bounds
    const [lon, lat] = this.center
    return {
      // southwest_lng,southwest_lat,northeast_lng,northeast_lat
      bbox: `${west},${south},${east},${north}`,
      north,
      east,
      south,
      west,
      lat,
      lon,
      lng: lon,
      zoom: this.zoom,
      left: west,
      bottom: south,
      right: east,
      top: north,
    }
  }

  position(a, b, c) {}
  get container() {
    return this.map.overlayContainerStopEvent_.parentNode
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
    // A UI interaction (slider drag, wheel over a panel) bubbles to the viewport where the map
    // listens, and pans/zooms it. Stop the events the map acts on — the same ones OL checks to
    // skip its stopevent overlay.
    for (const type of ['pointerdown', 'wheel', 'keydown']) {
      container.addEventListener(type, (event) => event.stopPropagation())
    }
  }

  render() {
    this.initCenter()
    const updateHash = () => {
      const [lng, lat] = this.center
      this.app.fire('map:view:updated', {
        zoom: this.zoom.toFixed(2),
        coordinate: [lng.toFixed(6), lat.toFixed(6)],
      })
    }
    this.map.on('moveend', updateHash)
    // updateHash()
    this.tilelayers.init(this.app.properties.tilelayers)
    this.tilelayers.selectDefault()
  }

  setDefaultCenter() {
    this.map.setView(
      new View({
        center: fromLonLat(this.app.properties.center),
        zoom: this.app.getProperty('zoom'),
      })
    )
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

  initEditTools() {}
  enableEdit() {
    for (const source of Object.values(this.sources)) {
      const modify = new Modify({ source })
      modify.on('modifyend', (event) => {
        event.features.forEach((olFeature) => {
          const feature = this.getFeatureById(olFeature.getId())
          if (!feature) return
          const { geometry } = new GeoJSON().writeFeatureObject(olFeature, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          })
          feature.onCommit(geometry)
        })
      })
      this.map.addInteraction(modify)
    }
  }

  hasLayer(id) {
    const layers = Object.values(this.layers[id] || {})
    if (!layers.length) return false
    // All layers added/removed together, so testing one is enough.
    return this.map.getLayers().getArray().includes(layers[0])
  }

  showLayer(id) {
    const layers = Object.values(this.layers[id] || {})
    if (!layers.length) return
    for (const layer of layers) {
      this.map.addLayer(layer)
    }
  }

  hideLayer(id) {
    const layers = Object.values(this.layers[id] || {})
    if (!layers.length) return
    for (const layer of layers) {
      this.map.removeLayer(layer)
    }
  }

  deleteLayer(id) {
    this.hideLayer(id)
    delete this.layers[id]
    delete this.sources[id]
  }

  reorderLayers() {
    for (const datalayer of this.app.layers.tree) {
      this.applyZIndex(datalayer)
    }
  }

  clear(id) {
    this.sources[id]?.clear()
  }

  pushGeometry(layerId, featureId, geometry) {
    const olFeature = this.sources[layerId]?.getFeatureById(featureId)
    if (!olFeature) return
    olFeature.setGeometry(
      new GeoJSON().readGeometry(geometry, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      })
    )
  }

  onZoomEnd(id) {
    // No-op for now: OL has no cluster recompute, and zoom-based show/hide
    // (fromZoom/toZoom) is not wired on the OL side yet.
  }

  onClick(event) {
    this.closePopup()
    // getFeaturesAtPixel returns features top-to-bottom; we act on the topmost.
    const olFeature = this.map.getFeaturesAtPixel(event.pixel)[0]
    if (!olFeature) return
    const isCluster = Boolean(olFeature.get('features')?.length)
    if (isCluster) {
      // A cluster resolves to a member id, or nothing, when it spiderfies/zooms
      import('./cluster.js').then(({ onClusterClick }) => {
        this.onFeatureClick(onClusterClick(olFeature, this.map), event)
      })
    } else {
      this.onFeatureClick(olFeature.getId(), event)
    }
  }

  onFeatureClick(id, event) {
    if (!id) return
    const uFeature = this.getFeatureById(id)
    if (!uFeature) return
    if (this.map.measureTools?.enabled()) return
    if (event.originalEvent.shiftKey) {
      if (event.originalEvent.ctrlKey || event.originalEvent.metaKey) {
        uFeature.datalayer.edit(event)
      } else if (!uFeature.isReadOnly()) {
        uFeature.edit()
      }
    } else if (!this.map.editTools?.drawing()) {
      // Events carry geographic lon/lat; the proxy converts to/from its projection.
      uFeature.view({ center: toLonLat(event.coordinate) })
    }
  }

  onContextMenu(event) {
    event.originalEvent.preventDefault()
    const [lng, lat] = toLonLat(event.coordinate)
    const appEvent = {
      lat,
      lng,
      pixel: [event.originalEvent.clientX, event.originalEvent.clientY],
    }
    const olFeature = this.map.getFeaturesAtPixel(event.pixel)[0]
    const feature = olFeature && this.getFeatureById(olFeature.getId())
    if (feature) feature.onContextMenu(appEvent)
    else this.app.onContextMenu(appEvent)
  }

  removeFeature(id, featureId) {
    const olFeature = this.sources[id]?.getFeatureById(featureId)
    if (olFeature) this.sources[id].removeFeature(olFeature)
  }

  clearLayer(id) {
    const source = this.sources[id]
    if (source) source.clear()
  }

  async createLayer(datalayer) {
    const source = new VectorSource()
    this.sources[datalayer.id] = source
    const layers = {}
    const isPoint = (feature) => this.isPointGeometry(feature.getGeometry().getType())

    if (datalayer.Type?.type === 'Heat') {
      const { createHeatmapLayer } = await import('./heat.js')
      layers['heat'] = createHeatmapLayer(source)
    } else if (datalayer.Type?.type === 'Cluster') {
      const { createClusterLayer } = await import('./cluster.js')
      layers['cluster'] = createClusterLayer(source, POINT_ZINDEX_OFFSET)
    } else {
      layers['point'] = new VectorLayer({
        source,
        style: (feature) => (isPoint(feature) ? feature.get('umapStyle') : null),
        zIndexOffset: POINT_ZINDEX_OFFSET,
      })
      layers['path'] = new VectorLayer({
        source,
        style: (feature) => (isPoint(feature) ? null : feature.get('umapStyle')),
      })
    }
    this.layers[datalayer.id] = layers
    this.applyZIndex(datalayer)
  }

  // Points ride the high zIndex band so all markers stay above all paths, across layers.
  applyZIndex(datalayer) {
    const layers = Object.values(this.layers[datalayer.id] || {})
    if (!layers.length) return
    for (const layer of layers) {
      layer.setZIndex(datalayer.rank + (layer.get('zIndexOffset') || 0))
    }
  }

  isPointGeometry(type) {
    return type === 'Point' || type === 'MultiPoint'
  }

  addData(id, geojson) {
    const format = new GeoJSON()
    const options = { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' }
    // OL drops the top-level `style` member on read, so read each feature and stash its OL
    // style as `umapStyle` (the layer style fns read it — see createLayer).
    const olFeatures = geojson.features.map((feature) => {
      const olFeature = format.readFeature(feature, options)
      this.setFeatureStyle(olFeature, feature)
      return olFeature
    })
    // Before addFeatures, so a (re)cluster uses the new config. Cluster/heat subscribe to the
    // source for it; the others ignore it.
    this.sources[id].set('umapConfig', geojson.style)
    this.sources[id].addFeatures(olFeatures)
  }

  redraw(id, geojson) {
    const source = this.sources[id]
    if (!source) return
    source.set('umapConfig', geojson.style)
    for (const feature of geojson.features) {
      const olFeature = source.getFeatureById(feature.id)
      if (olFeature) this.setFeatureStyle(olFeature, feature)
    }
    source.changed()
  }

  setFeatureStyle(olFeature, geojson) {
    olFeature.set('umapBaseStyle', this.style(geojson))
    olFeature.set('umapHighlightStyle', this.style(geojson, true))
    olFeature.set(
      'umapStyle',
      olFeature.get(
        olFeature === this.highlighted ? 'umapHighlightStyle' : 'umapBaseStyle'
      )
    )
  }

  closePopup() {
    for (const overlay of this.map.getOverlays().getArray().slice()) {
      this.map.removeOverlay(overlay)
    }
    this.unhighlight()
  }

  highlight(sourceId, id) {
    const olFeature = this.sources[sourceId]?.getFeatureById(id)
    if (olFeature === this.highlighted) return
    this.unhighlight()
    if (!olFeature) return
    this.highlighted = olFeature
    olFeature.set('umapStyle', olFeature.get('umapHighlightStyle'))
    this.map.dispatchEvent('umap:highlight')
  }

  unhighlight() {
    if (!this.highlighted) return
    const olFeature = this.highlighted
    this.highlighted = null
    olFeature.set('umapStyle', olFeature.get('umapBaseStyle'))
    this.map.dispatchEvent('umap:highlight')
  }

  addFeature(id, geojson) {
    const options = { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' }
    const olFeature = new GeoJSON().readFeature(geojson, options)
    this.setFeatureStyle(olFeature, geojson)
    this.sources[id].addFeature(olFeature)
  }

  style(geojson, highlight = false) {
    const base = geojson.style || {}
    const properties = highlight ? { ...base, ...geojson.highlight } : base
    const zIndex = highlight ? HIGHLIGHT_ZINDEX : geojson.zIndex
    if (geojson.geometry.type === 'Point') {
      return makeIcon(properties, zIndex)
    }
    const stroke = new Stroke({
      color: rgba(properties.color, properties.opacity),
      width: properties.weight,
      lineDash: properties.dashArray?.split(',').map(Number),
    })
    const fill =
      properties.fill === false
        ? undefined
        : new Fill({
            color: rgba(
              properties.fillColor || properties.color,
              properties.fillOpacity
            ),
          })
    return new Style({ stroke, fill, zIndex })
  }

  get hasExtent() {
    return Boolean(this.map.getView().getUpdatedOptions_().extent)
  }

  getExtentBBoxString() {
    // southwest_lng,southwest_lat,northeast_lng,northeast_lat'
    return this.map.options.maxBounds?.toBBoxString()
  }

  toggleFullscreen() {
    const doc = this.map.getOwnerDocument()
    if (doc.fullscreenElement) {
      doc.exitFullscreen()
    } else {
      this.map.getTargetElement().requestFullscreen()
    }
  }

  async toggleLocate() {
    const { toggle } = await import('./geolocation.js')
    await toggle(this.map, this.app)
  }
}

class TileLayerManager {
  constructor(proxy) {
    this.proxy = proxy
    this.all = new Map()
    this.current = undefined
    this.overlay = undefined

    proxy.map.on('loadstart', (event) => {
      console.log(event)
      this.app.loader.start('tiles')
    })
    proxy.map.on('loadend', () => {
      this.app.loader.stop('tiles')
    })
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
    const retina = window.devicePixelRatio > 1 && spec.url_template.includes('{r}')
    const url = spec.url_template
      .replace('{s}', '{a-c}')
      .replace('{r}', retina ? '@2x' : '')
    const source = new XYZ({
      url,
      tilePixelRatio: retina ? 2 : 1,
      attributions: spec.attribution,
      crossOrigin: 'anonymous',
    })
    return new TileLayer({
      source,
      rank: spec.rank,
      name: spec.name,
      url,
      zIndex: -1,
      minZoom: spec.minZoom,
      maxZoom: spec.maxZoom,
    })
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
    const view = this.map.getView()
    const minZoom = tilelayer.getMinZoom()
    const maxZoom = tilelayer.getMaxZoom()
    if (Number.isFinite(minZoom)) view.setMinZoom(minZoom)
    if (Number.isFinite(maxZoom)) view.setMaxZoom(maxZoom)
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
    this.app.fire('map:baselayerchange', { layer: this.current })
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

  cloneLayer(layer) {
    return new TileLayer({
      source: layer.getSource(),
    })
  }
}
