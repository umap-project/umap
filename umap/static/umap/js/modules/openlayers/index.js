import { getHeight, getWidth } from 'ol/extent.js'
import MultiPoint from 'ol/geom/MultiPoint.js'
import MouseWheelZoom from 'ol/interaction/MouseWheelZoom.js'
import VectorLayer from 'ol/layer/Vector.js'
import { default as OLMap } from 'ol/Map.js'
import Overlay from 'ol/Overlay.js'
import { fromLonLat, toLonLat } from 'ol/proj.js'
import VectorSource from 'ol/source/Vector.js'
import CircleStyle from 'ol/style/Circle.js'
import Fill from 'ol/style/Fill.js'
import Stroke from 'ol/style/Stroke.js'
import Style from 'ol/style/Style.js'
import View from 'ol/View.js'
import { translate } from '../i18n.js'
import * as Utils from '../utils.js'
import { makeIcon, makePointOverlay } from './icon.js'
import { anchorTexts, makeLabel, makeTextPath, simplifyForText } from './label.js'
import TileLayerManager from './tilelayer.js'
import {
  fromOLExtent,
  invertPolygon,
  readFeature,
  readGeometry,
  rgba,
  toOLExtent,
  writeFeature,
} from './utils.js'

const POINT_ZINDEX_OFFSET = 10000
const HIGHLIGHT_ZINDEX = 1e6

const POPUP_ARROW_HEIGHT = 12
const FIT_PADDING = [50, 50, 50, 50]

const popupTemplate = `
  <div class="umap-popup window">
    <ul class="buttons">
        <li><button class="icon icon-16 icon-close" data-close=""></button><span class="sr-only">${translate('Close')}</span></li>
    </ul>
    <aside data-ref=body>
    </aside>
  </div>
`

export class OLProxy {
  constructor(app, element) {
    this.app = app
    this.sources = {}
    this.layers = {}
    this.point = null
    this.highlighted = null
    this.map = new OLMap({
      target: element,
      controls: [],
    })
    this.mouseWheelZoom = this.map
      .getInteractions()
      .getArray()
      .find((interaction) => interaction instanceof MouseWheelZoom)
    this.tilelayers = new TileLayerManager(this)

    this.map.on('pointermove', (event) => this.onPointerMove(event))

    const [container, { body }] = Utils.loadTemplateWithRefs(popupTemplate)
    this.popup = new Overlay({
      element: container,
      positioning: 'bottom-center',
      offset: [0, -POPUP_ARROW_HEIGHT],
      autoPan: {
        animation: {
          duration: 250,
        },
      },
    })
    this.popup.set('body', body)
    this.map.addOverlay(this.popup)
    container.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) this.app.fire('popup:close')
    })
    this.proxyOutgoingEvents()
    this.proxyIncomingEvents()
  }

  proxyIncomingEvents() {
    this.map.on('click', (event) => this.onClick(event))
    this.map.on('contextmenu', (event) => this.onContextMenu(event))
  }

  onPointerMove(event) {
    if (event.dragging) return
    const olFeature = this.map.forEachFeatureAtPixel(event.pixel, (feature) =>
      feature.get('interactive') ? feature : undefined
    )
    this.map.getTargetElement().style.cursor = olFeature ? 'pointer' : ''
    this.toggleTooltip(olFeature, event.originalEvent)
  }

  proxyOutgoingEvents() {
    this.app.on('map:resize', () => this.map.updateSize())
    this.app.on('draw:marker', async () => await this.editor?.startDrawing('Point'))
    this.app.on(
      'draw:linestring',
      async () => await this.editor?.startDrawing('LineString')
    )
    this.app.on('draw:polygon', async () => await this.editor?.startDrawing('Polygon'))
    this.app.on(
      'draw:hole',
      async (event) => await this.editor?.startHole(event.detail)
    )
    this.app.on('draw:route', async () => await this.editor?.startRoute())
    this.app.on('map:view:set', (event) => {
      const { easing, zoom, coordinates, callback } = event.detail
      this.setView({ coordinates, zoom, easing, callback })
    })
    this.app.on('map:view:fit', (event) => {
      const { easing, zoom, bounds, callback } = event.detail
      this.setView({ bounds, zoom, easing, callback })
    })
    this.app.on('panel:show', (event) => {
      const { content } = event.detail
      this.app.panel.open({ content })
      // Mimic popup behaviour
      this.map.once('click', () => this.app.fire('panel:close'))
    })
    this.app.on('popup:show', (event) => {
      const { sourceId, id, content, center, mode } = event.detail
      const olFeature = this.sources[sourceId]?.getFeatureById(id)
      const popupOffsetY = olFeature?.get('popupOffsetY') || 0
      this.popup.setOffset([0, popupOffsetY - POPUP_ARROW_HEIGHT])
      this.popup.setPosition(fromLonLat(center))
      const body = this.popup.get('body')
      body.innerHTML = ''
      body.appendChild(content)
      this.popup.element.classList.toggle('umap-popup-large', mode === 'large')
      this.highlight(sourceId, id)
    })
    this.app.on('popup:close', () => this.closePopup())
    this.app.on('map:show:point', (event) => this.showPoint(event.detail))
    this.app.on('map:hide:point', () => this.hidePoint())
    this.app.on('feature:reset', (event) => {
      const { sourceId, geojson } = event.detail
      const olFeature = this.sources[sourceId]?.getFeatureById(geojson.id)
      if (!olFeature) return
      this.redrawFeature(olFeature, geojson)
      olFeature.changed()
    })
  }

  get view() {
    return this.map.getView()
  }

  set zoom(value) {
    this.view.setZoom(value)
  }

  get zoom() {
    return this.view.getZoom()
  }

  get resolution() {
    return this.view.getResolution()
  }

  get bounds() {
    return fromOLExtent(this.view.calculateExtent())
  }

  get center() {
    return toLonLat(this.view.getCenter())
  }

  getBoundsZoom(bounds) {
    const extent = toOLExtent(bounds)
    const [width, height] = this.map.getSize()
    const resolution = Math.min(getWidth(extent) / width, getHeight(extent) / height)
    return this.view.getZoomForResolution(resolution)
  }

  setView({ coordinates, bounds, zoom, easing, callback }) {
    if (easing === undefined) easing = this.app.getProperty('easing')
    const duration = easing ? 500 : 0
    const id = Math.random()
    this.app.loader.start(id)
    const settled = () => {
      this.app.loader.stop(id)
      callback?.()
    }
    if (bounds) {
      const extent = toOLExtent(bounds)
      this.view.fit(extent, {
        duration,
        padding: FIT_PADDING,
        callback: settled,
      })
    } else if (easing) {
      this.view.animate({ center: fromLonLat(coordinates), zoom, duration }, settled)
    } else {
      // setCenter/setZoom are synchronous, with no animation callback.
      this.view.setCenter(fromLonLat(coordinates))
      if (zoom !== undefined) this.view.setZoom(zoom)
      settled()
    }
  }

  handleLimitBounds() {
    const limit = this.app.properties.limitBounds || {}
    const bbox = [limit.west, limit.south, limit.east, limit.north].map(
      Number.parseFloat
    )
    const base = this.tilelayers.current?.getMinZoom()
    const options = {
      center: this.view.getCenter(),
      zoom: this.view.getZoom(),
      minZoom: Number.isFinite(base) ? base : 0,
      maxZoom: this.view.getMaxZoom(),
      projection: this.view.getProjection(),
    }
    if (!bbox.some(Number.isNaN)) {
      const extent = toOLExtent(bbox)
      options.extent = extent
      const resolution = this.view.getResolutionForExtent(extent, this.map.getSize())
      options.minZoom = Math.max(
        options.minZoom,
        this.view.getZoomForResolution(resolution)
      )
    }
    // OL View does not have a setExtent, so need to recreate a new one…
    this.map.setView(new View(options))
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

  focus() {
    this.map.getTargetElement().focus()
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

  async render() {
    this.focus()
    await this.initCenter()
    const updateHash = () => {
      const [lng, lat] = this.center
      this.app.fire('map:view:updated', {
        // parseFloat drops trailing zeros so a round zoom stays `7`, not `7.00`.
        zoom: Number.parseFloat(this.zoom.toFixed(2)),
        coordinate: [lng.toFixed(6), lat.toFixed(6)],
      })
    }
    // OL has no zoomend, and we want only round zoom events.
    let lastZoom = Math.round(this.zoom)
    // OL emits a movend at its first render, even if the view hasn't changed, and this
    // can make dynamic remote data to be fetched twice.
    let firstRenderSeen = false
    this.map.on('moveend', () => {
      updateHash()
      if (!firstRenderSeen) {
        firstRenderSeen = true
        return
      }
      this.app.fire('map:moveend')
      const zoom = Math.round(this.zoom)
      if (zoom !== lastZoom) {
        lastZoom = zoom
        this.app.fire('map:zoomend')
      }
    })
    this.tilelayers.init(this.app.properties.tilelayers)
    this.tilelayers.selectDefault()
    this.handleLimitBounds()
    this.updateUI()
  }

  updateUI() {
    this.mouseWheelZoom.setActive(this.app.getProperty('scrollWheelZoom'))
  }

  setDefaultCenter() {
    this.setView({
      coordinates: this.app.properties.center,
      zoom: this.app.getProperty('zoom'),
      easing: false,
    })
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
      await this.toggleLocate()
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
              callback: this.app.properties.noControl ? null : () => feature.view(),
            })
            return
          }
        }
      })
    }
  }

  initEditTools() {}
  async enableEdit() {
    const { default: Editor } = await import('./edit.js')
    this.editor = new Editor(this.map, this)
    await this.editor.enable()
    this.focus()
  }

  disableEdit() {
    this.editor.disable()
  }

  onEscape() {
    if (!this.activeDrawing) return false
    this.activeDrawing.abortDrawing()
    this.endDrawing()
    return true
  }

  hasSelection() {
    return Boolean(this.editor?.select.getFeatures().getLength())
  }

  get selection() {
    return this.editor?.select
      .getFeatures()
      .getArray()
      .map((olFeature) => this.getFeatureById(olFeature.getId()))
  }

  hasLayer(id) {
    const layers = Object.values(this.layers[id] || {})
    if (!layers.length) return false
    // All layers added/removed together, so testing one is enough.
    return this.map.getLayers().getArray().includes(layers[0])
  }

  showLayer(id) {
    if (this.hasLayer(id)) return
    const layers = Object.values(this.layers[id] || {})
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

  showPoint({ coordinate, color }) {
    if (!this.point) {
      this.point = makePointOverlay()
      this.map.addOverlay(this.point)
    }
    this.point.getElement().style.borderColor = color
    this.point.setPosition(fromLonLat(coordinate))
  }

  hidePoint() {
    this.point?.setPosition(undefined)
  }

  deleteLayer(id) {
    this.hideLayer(id)
    delete this.layers[id]
    delete this.sources[id]
  }

  reorderLayers() {
    const datalayers = Array.from(this.app.layers.tree)
    let zIndex = datalayers.length
    for (const datalayer of datalayers) {
      const OLLayers = Object.values(this.layers[datalayer.id] || {})
      if (!OLLayers.length) continue
      for (const layer of OLLayers) {
        const offset = layer.get('zIndexOffset') || 0
        layer.setZIndex(zIndex + offset)
      }
      zIndex--
    }
  }

  clear(id) {
    this.sources[id]?.clear()
  }

  OLFeatureToGeojson(olFeature) {
    return writeFeature(olFeature)
  }

  pullGeometry(olFeature) {
    const feature = this.getFeatureById(olFeature.getId())
    if (!feature) return
    const { geometry } = this.OLFeatureToGeojson(olFeature)
    feature.onCommit(geometry)
  }

  pushGeometry(layerId, featureId, geometry) {
    const olFeature = this.sources[layerId]?.getFeatureById(featureId)
    if (!olFeature) return
    olFeature.setGeometry(readGeometry(geometry))
  }

  onZoomEnd(id) {
    // No-op for now: OL has no cluster recompute, and zoom-based show/hide
    // (fromZoom/toZoom) is not wired on the OL side yet.
  }

  onClick(event) {
    this.closePopup()
    // Topmost interactive feature (or a cluster), skipping non-interactive ones.
    const olFeature = this.map.forEachFeatureAtPixel(event.pixel, (feature) =>
      feature.get('features') || feature.get('interactive') ? feature : undefined
    )
    if (!olFeature) return
    const isCluster = Boolean(olFeature.get('features')?.length)
    if (isCluster) {
      // A cluster resolves to a member id, or nothing, when it spiderfies/zooms
      import('./cluster.js').then(({ onClusterClick }) => {
        this.onFeatureClick(onClusterClick(olFeature, this.map, this.app), event)
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
    // Restrict hit-testing to our data layers, else Modify's vertex overlay wins.
    const olFeature = this.map.forEachFeatureAtPixel(
      event.pixel,
      (feature) => (feature.get('interactive') ? feature : undefined),
      {
        layerFilter: (layer) => Object.values(this.sources).includes(layer.getSource()),
      }
    )
    const feature = olFeature && this.getFeatureById(olFeature.getId())
    if (feature) feature.onContextMenu(appEvent)
    else this.app.onContextMenu(appEvent)
  }

  removeFeature(id, featureId) {
    const olFeature = this.sources[id]?.getFeatureById(featureId)
    if (!olFeature) return
    this.editor?.select?.getFeatures().remove(olFeature)
    this.sources[id].removeFeature(olFeature)
  }

  clearLayer(id) {
    const source = this.sources[id]
    if (source) source.clear()
  }

  async createLayer(datalayer) {
    const source = new VectorSource()
    this.sources[datalayer.id] = source
    if (this.app.editEnabled && this.editor) {
      await this.editor.registerSourceForEdit(source)
    }
    const layers = {}
    const isPoint = (feature) => this.isPointGeometry(feature.getGeometry().getType())

    if (datalayer.Type?.type === 'Heat') {
      const { createHeatmapLayer } = await import('./heat.js')
      layers.heat = createHeatmapLayer(source)
    } else if (datalayer.Type?.type === 'Cluster') {
      const { createClusterLayer } = await import('./cluster.js')
      layers.cluster = createClusterLayer(source, POINT_ZINDEX_OFFSET)
    } else {
      layers.point = new VectorLayer({
        source,
        style: (feature) => (isPoint(feature) ? feature.get('umapStyle') : null),
        zIndexOffset: POINT_ZINDEX_OFFSET,
      })
      // Labels and text above the paths but below the markers.
      layers.path = new VectorLayer({
        source,
        style: (feature) => {
          const texts = feature.get('umapText') || []
          if (isPoint(feature)) return texts
          return [].concat(feature.get('umapStyle') || [], texts)
        },
      })
    }
    this.layers[datalayer.id] = layers
    this.reorderLayers()
  }

  isPointGeometry(type) {
    return type === 'Point' || type === 'MultiPoint'
  }

  geojsonToOL(geojson) {
    const olFeature = readFeature(geojson)
    this.applyGeojson(olFeature, geojson)
    return olFeature
  }

  addFeature(id, geojson) {
    this.sources[id].addFeature(this.geojsonToOL(geojson))
  }

  addData(id, geojson) {
    const olFeatures = geojson.features.map((data) => this.geojsonToOL(data))
    // Before addFeatures, so a (re)cluster uses the new config. Cluster/heat subscribe to the
    // source for it; the others ignore it.
    this.sources[id].set('umapConfig', geojson.style)
    this.sources[id].addFeatures(olFeatures)
  }

  redraw(id, geojson) {
    const source = this.sources[id]
    if (!source) return
    source.set('umapConfig', geojson.style)
    // Reflect geojson in visible features on the map (eg. some can be
    // filtered out from the databrowser).
    const wanted = new Set(geojson.features.map((feature) => feature.id))
    for (const olFeature of source.getFeatures()) {
      if (!wanted.has(olFeature.getId())) source.removeFeature(olFeature)
    }
    for (const feature of geojson.features) {
      const olFeature = source.getFeatureById(feature.id)
      if (olFeature) this.redrawFeature(olFeature, feature)
      else source.addFeature(this.geojsonToOL(feature))
    }
    source.changed()
  }

  redrawFeature(olFeature, geojson) {
    if (geojson.route) {
      olFeature.setGeometry(readGeometry(geojson.geometry))
    }
    this.applyGeojson(olFeature, geojson)
  }

  applyGeojson(olFeature, geojson) {
    const base = this.style(geojson)
    olFeature.set('umapBaseStyle', base.style)
    olFeature.set('umapHighlightStyle', this.style(geojson, true).style)
    olFeature.set('umapText', base.texts)
    olFeature.set('popupOffsetY', base.popupOffsetY)
    olFeature.set('umapLabel', geojson.label)
    olFeature.set('interactive', geojson.style?.interactive !== false)
    olFeature.set('route', geojson.route)
    this.applyStyle(olFeature)
  }

  // A feature renders highlighted when its popup is open or it is selected in edit.
  isHighlighted(olFeature) {
    return (
      olFeature === this.highlighted ||
      Boolean(this.editor?.select?.getFeatures().getArray().includes(olFeature))
    )
  }

  applyStyle(olFeature) {
    const key = this.isHighlighted(olFeature) ? 'umapHighlightStyle' : 'umapBaseStyle'
    olFeature.set('umapStyle', olFeature.get(key))
  }

  closePopup() {
    this.popup.setPosition(undefined)
    this.unhighlight()
  }

  highlight(sourceId, id) {
    const olFeature = this.sources[sourceId]?.getFeatureById(id)
    if (olFeature === this.highlighted) return
    const previous = this.highlighted
    this.highlighted = olFeature
    if (previous) this.applyStyle(previous)
    if (!olFeature) return
    this.applyStyle(olFeature)
    this.map.dispatchEvent('umap:highlight')
  }

  unhighlight() {
    if (!this.highlighted) return
    const olFeature = this.highlighted
    this.highlighted = null
    this.applyStyle(olFeature)
    this.map.dispatchEvent('umap:highlight')
  }

  style(geojson, highlight = false) {
    const base = geojson.style || {}
    const properties = highlight ? { ...base, ...geojson.highlight } : base
    const zIndex = highlight ? HIGHLIGHT_ZINDEX : geojson.zIndex
    const texts = [
      makeTextPath(base.textPath, zIndex),
      makeLabel(geojson.label, zIndex),
    ].filter(Boolean)
    if (geojson.geometry.type === 'Point') {
      const icon = makeIcon(properties, zIndex)
      anchorTexts(texts, icon.textAnchor, geojson.label?.direction)
      return { style: icon.style, texts, popupOffsetY: icon.popupOffsetY }
    }
    for (const t of texts) {
      t.setGeometry((feature) => simplifyForText(feature.getGeometry(), this.zoom))
    }
    const style = []
    const stroke =
      properties.stroke === false
        ? undefined
        : new Stroke({
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
    if (geojson.route) {
      const route = readGeometry(geojson.route.geometry)
      for (const t of texts) t.setGeometry(() => simplifyForText(route, this.zoom))
      style.push(new Style({ geometry: route, stroke, fill, zIndex }))
      style.push(
        new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({
              color: properties.fillColor || properties.color,
            }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
          }),
        })
      )
    } else if (properties.mask) {
      style.push(
        new Style({ geometry: (f) => invertPolygon(f.getGeometry()), fill, zIndex })
      )
      style.push(new Style({ stroke, zIndex }))
    } else {
      style.push(new Style({ stroke, fill, zIndex }))
    }
    return { style, texts, popupOffsetY: 0 }
  }

  get hasExtent() {
    return Boolean(this.view.getUpdatedOptions_().extent)
  }

  getExtentBBoxString() {
    // southwest_lng,southwest_lat,northeast_lng,northeast_lat
    const extent = this.view.getUpdatedOptions_().extent
    if (!extent) return
    return fromOLExtent(extent).join(',')
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

  async toggleMeasure(type) {
    if (!this.measureTool) {
      const { MeasureTool } = await import('./measure.js')
      this.measureTool = new MeasureTool(this.map)
    }
    this.measureTool.toggle(type)
  }

  toggleTooltip(olFeature, originalEvent) {
    const label = olFeature?.get('umapLabel')
    if (!label?.text || label.show !== null) {
      if (this.hovered) {
        this.app.tooltip.close()
        this.hovered = null
      }
      return
    }
    const at = [originalEvent.clientX, originalEvent.clientY]
    if (this.hovered === olFeature) {
      this.app.tooltip.anchorAt(at, label.direction)
    } else {
      this.hovered = olFeature
      this.app.tooltip.open({
        content: label.text,
        at,
        position: label.direction,
        white: true,
        duration: Number.POSITIVE_INFINITY,
      })
    }
  }
}
