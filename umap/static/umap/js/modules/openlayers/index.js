import { never, noModifierKeys } from 'ol/events/condition.js'
import MultiPoint from 'ol/geom/MultiPoint.js'
import MouseWheelZoom from 'ol/interaction/MouseWheelZoom.js'
import VectorLayer from 'ol/layer/Vector.js'
import { default as OLMap } from 'ol/Map.js'
import Overlay from 'ol/Overlay.js'
import { fromLonLat, toLonLat } from 'ol/proj.js'
import VectorSource from 'ol/source/Vector.js'
import CircleStyle from 'ol/style/Circle.js'
import Fill from 'ol/style/Fill.js'
import Select from 'ol/interaction/Select.js'
import Stroke from 'ol/style/Stroke.js'
import Style from 'ol/style/Style.js'
import View from 'ol/View.js'
import { translate } from '../i18n.js'
import * as Utils from '../utils.js'
import { makeIcon, makePointOverlay } from './icon.js'
import {
  anchorLabel,
  anchorTextPath,
  makeLabel,
  makeTextPath,
  simplifyForText,
} from './label.js'
import TileLayerManager from './tilelayer.js'
import {
  fromOLExtent,
  invertPolygon,
  loadFonts,
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

const HIT_TOLERANCE = 5 // pixels

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

    // Do not allow to select spiderfied "false" markers (they are recreated at each
    // spiderfy, and this would activate the translate, which we do not want).
    const selectable = (feature) => feature.get('editable')
    const onHighlight = (feature) => {
      if (feature.get('represents')) {
        feature = feature.get('represents')
      }
      return feature?.umapStyles?.highlight
    }
    // Shift means "edit this feature" in uMap, not OL's default "toggle selection".
    this.select = new Select({
      style: onHighlight,
      filter: selectable,
      toggleCondition: never,
      hitTolerance: HIT_TOLERANCE,
    })
    this.map.addInteraction(this.select)
    this.select.on('select', (event) => this.onSelect(event))

    this.proxyOutgoingEvents()
    this.proxyIncomingEvents()
  }

  proxyIncomingEvents() {
    this.map.on('click', (event) => this.onClick(event))
    this.map.on('contextmenu', (event) => this.onContextMenu(event))
    this.map.on('loadstart', (event) => {
      this.app.loader.start('map-loading')
    })
    this.map.on('loadend', () => {
      this.app.loader.stop('map-loading')
    })
    // Whoever moves the view: a pan, our own setView, or an overlay panning itself
    // into sight.
    this.map.on('movestart', () => this.app.loader.start('map-moving'))
    this.map.on('moveend', () => this.app.loader.stop('map-moving'))
  }

  onPointerMove(event) {
    if (event.dragging) return
    const olFeature = this.map.forEachFeatureAtPixel(event.pixel, (feature) =>
      feature.get('interactive') ? feature : undefined,
      {hitTolerance: HIT_TOLERANCE}
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
    this.app.on(
      'draw:shape',
      async (event) => await this.editor?.startShape(event.detail)
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
      const popupOffsetY = olFeature?.umapStyles.popupOffsetY || 0
      this.popup.setOffset([0, popupOffsetY - POPUP_ARROW_HEIGHT])
      this.popup.setPosition(fromLonLat(center))
      const body = this.popup.get('body')
      body.innerHTML = ''
      body.appendChild(content)
      this.popup.element.classList.toggle('umap-popup-large', mode === 'large')
      if (olFeature.represented) {
        const features = olFeature.represented.get('features')
        if (features.length > 1) {
          this.spider.reveal(features, olFeature.getGeometry().getCoordinates())
        } else {
          this.select.selectFeature(olFeature.represented)
        }
      } else {
        this.select.selectFeature(olFeature)
      }
    })
    this.app.on('popup:close', () => this.closePopup())
    this.app.on('map:show:point', (event) => this.showPoint(event.detail))
    this.app.on('map:hide:point', () => this.hidePoint())
    this.app.on('feature:edit', (event) => {
      const { sourceId, id } = event.detail
      const olFeature = this.sources[sourceId]?.getFeatureById(id)
      if (!olFeature) return
      this.select.selectFeature(olFeature)
    })
    this.app.on('feature:endedit', () => this.select.clearSelection())
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
    const resolution = this.view.getResolutionForExtent(extent, this.map.getSize())
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
    this.limitExtent = bbox.some(Number.isNaN) ? undefined : toOLExtent(bbox)
    if (this.limitExtent) {
      options.extent = this.limitExtent
      const resolution = this.view.getResolutionForExtent(
        this.limitExtent,
        this.map.getSize()
      )
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
    return this.map.getViewport()
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
    await loadFonts()
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
    await this.tilelayers.init(this.app.properties.tilelayers)
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
    this.editor.enable()
    this.focus()
  }

  disableEdit() {
    this.editor.disable()
  }

  onEscape() {
    const drawing = this.editor?.activeDrawing
    if (!drawing) return false
    // Commit what has been drawn so far.
    drawing.finishDrawing()
    this.editor.endDrawing()
    return true
  }

  hasSelection() {
    return Boolean(this.select.getFeatures().getLength())
  }

  get selection() {
    return this.select
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

  // Overlays are anchored to a coordinate: dragging a feature would leave them
  // behind, pointing at where it no longer is.
  hideOverlays() {
    this.closePopup()
    this.hidePoint()
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

  async ensureSpider() {
    if (!this.spider) {
      // Several features under one marker: the click spreads or zooms them, it opens nothing.
      return import('./cluster.js').then((Cluster) => {
        this.spider ??= new Cluster.Spider(this.map)
        return Cluster
      })
    }
  }

  onClick(event) {
    this.closePopup()
    // Topmost interactive feature, skipping non-interactive ones.
    const olFeature = this.map.forEachFeatureAtPixel(event.pixel, (feature) =>
      feature.get('interactive') ? feature : undefined
    )
    if (olFeature?.get('features')?.length > 1) {
      this.ensureSpider().then((Cluster) => {
        Cluster.onClick(olFeature, {
          map: this.map,
          spider: this.spider,
          app: this.app,
        })
      })
    }
  }

  onSelect(event) {
    const olFeature = event.selected[0]
    if (!olFeature) return
    const geometry = olFeature.getGeometry()
    // A point is anchored where it is drawn, which differs from its data position
    // once spiderfied.
    const anchor =
      geometry.getType() === 'Point' ? geometry.getCoordinates() : event.mapBrowserEvent?.coordinate_
    const represented = olFeature.get('represents')
    const realFeatureId = represented ? represented.getId() : olFeature.id_
    if (event.selected.length === 1) {
      this.onFeatureClick(realFeatureId, event, anchor)
    }
  }

  onFeatureClick(id, event, anchor) {
    if (!id) return
    const uFeature = this.getFeatureById(id)
    if (!uFeature) return
    if (this.map.measureTools?.enabled()) return
    if (!event.mapBrowserEvent) return
    event.originalEvent = event.mapBrowserEvent
    event.originalEvent.coordinate = event.mapBrowserEvent.coordinate_
    if (event.mapBrowserEvent.shiftKey) {
      if (event.mapBrowserEvent.ctrlKey || event.mapBrowserEvent.metaKey) {
        uFeature.datalayer.edit(event)
      } else if (!uFeature.isReadOnly()) {
        uFeature.edit()
      }
    } else if (noModifierKeys(event) && !this.map.editTools?.drawing()) {
      // Events carry geographic lon/lat; the proxy converts to/from its projection.
      uFeature.view({ center: toLonLat(anchor) })
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
        style: (feature, resolution) =>
          isPoint(feature) ? feature.umapStyles.current : null,
        zIndexOffset: POINT_ZINDEX_OFFSET,
        editable: true,
      })
      // Labels and text above the paths but below the markers.
      layers.path = new VectorLayer({
        source,
        style: (feature) => {
          const { current, texts } = feature.umapStyles
          if (isPoint(feature)) return texts
          return [].concat(current, texts)
        },
        editable: true,
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

  redraw(id, geojson) {
    const source = this.sources[id]
    if (!source) return
    // Before addFeatures, so a (re)cluster uses the new config.
    source.set('umapConfig', geojson.style)
    // Reflect geojson in visible features on the map (eg. some can be
    // filtered out from the databrowser).
    const wanted = new Set(geojson.features.map((feature) => feature.id))
    source.removeFeatures(
      source.getFeatures().filter((olFeature) => !wanted.has(olFeature.getId()))
    )
    const added = []
    for (const feature of geojson.features) {
      const olFeature = source.getFeatureById(feature.id)
      if (olFeature) this.redrawFeature(olFeature, feature)
      else added.push(this.geojsonToOL(feature))
    }
    source.addFeatures(added)
  }

  redrawFeature(olFeature, geojson) {
    if (geojson.route) {
      olFeature.setGeometry(readGeometry(geojson.geometry))
    }
    this.applyGeojson(olFeature, geojson)
  }

  applyGeojson(olFeature, geojson) {
    const base = this.style(geojson)
    olFeature.umapStyles = {
      base: base.style,
      highlight: this.style(geojson, true).style,
      texts: base.texts,
      popupOffsetY: base.popupOffsetY,
    }
    const interactive = geojson.style?.interactive !== false
    olFeature.setProperties(
      {
        umapLabel: geojson.label,
        interactive,
        editable: interactive && !geojson.readonly,
        route: geojson.route,
      },
      true // Do not ask for rerender, here, it will be donne on the next line.
    )
    this.applyStyle(olFeature)
  }

  // A feature renders highlighted when its popup is open or it is selected in edit.
  isHighlighted(olFeature) {
    return Boolean(this.editor?.select?.getFeatures().getArray().includes(olFeature))
  }

  applyStyle(olFeature) {
    const styles = olFeature.umapStyles
    styles.current = this.isHighlighted(olFeature) ? styles.highlight : styles.base
  }

  closePopup() {
    this.popup.setPosition(undefined)
    //this.unhighlight()
  }

  style(geojson, highlight = false) {
    const base = geojson.style || {}
    const properties = highlight ? { ...base, ...geojson.highlight } : base
    const zIndex = highlight ? HIGHLIGHT_ZINDEX : geojson.zIndex
    const textPath = makeTextPath(base.textPath, zIndex)
    const label = makeLabel(geojson.label, zIndex)
    const texts = [textPath, label].filter(Boolean)
    if (geojson.geometry.type === 'Point') {
      const icon = makeIcon(properties, zIndex)
      if (label) anchorLabel(label, icon.textAnchor, geojson.label.direction)
      if (textPath) anchorTextPath(textPath, icon.textAnchor, base.textPath.offset)
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
    return Boolean(this.limitExtent)
  }

  getExtentBBoxString() {
    // southwest_lng,southwest_lat,northeast_lng,northeast_lat
    if (!this.limitExtent) return
    return fromOLExtent(this.limitExtent).join(',')
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
