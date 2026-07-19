import { default as OLMap } from 'ol/Map.js'
import TileLayer from 'ol/layer/Tile.js'
import ImageTile from 'ol/source/ImageTile.js'
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
import CircleStyle from 'ol/style/Circle.js'
import Icon from 'ol/style/Icon.js'
import TextStyle from 'ol/style/Text.js'
import { asArray } from 'ol/color.js'
import Modify from 'ol/interaction/Modify.js'
import { SCHEMA } from '../schema.js'
import { isDataImage, isPath, isRemoteUrl } from '../utils.js'
import * as Utils from '../utils.js'
import { textColorFromColor } from '../domutils.js'
import HeatmapLayer from 'ol/layer/Heatmap.js'

function rgba(color, opacity) {
  const rgba = asArray(color).slice()
  if (opacity != null) rgba[3] = opacity
  return rgba
}

// uMap markers as native OL styles: a colored pin Icon (with a drop shadow) plus the
// symbol as a SEPARATE style — an Icon for images (OL loads the URL itself; same-origin
// stays untainted) or a Text for glyphs. Each shape puts its tip at the anchor and its
// head centered `symbolOffset` px above it; the viewBox is padded so the shadow isn't
// clipped (which shifts the anchor by the padding).
const DEFAULT_URL = SCHEMA.iconUrl.default
// A real SVG drop shadow: it survives being drawImage'd onto OL's canvas because we bake the
// color into the SVG (no ol/style/Icon `color` tint), so OL rasterizes the data-URI as-is,
// filter included. The viewBox is padded so the blur isn't clipped (which would shift the anchor).
const SHADOW_FILTER =
  '<filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">' +
  '<feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.5"/></filter>'
const SHAPES = {
  // paths drawn in an unpadded box; the `-4` viewBox origin adds a 4px shadow margin,
  // and the extra width/height leaves room for the shadow falling to the bottom-right.
  Default: {
    path: 'M4,0 H28 A4,4 0 0 1 32,4 V28 A4,4 0 0 1 28,32 H24 L16,40 L8,32 H4 A4,4 0 0 1 0,28 V4 A4,4 0 0 1 4,0 Z',
    viewBox: '-4 -4 44 52',
    width: 44,
    height: 52,
    anchor: [20, 44],
    symbolOffset: 24,
  },
  Drop: {
    path: 'M16,44 C4,30 0,24 0,16 A16,16 0 0 1 32,16 C32,24 28,30 16,44 Z',
    viewBox: '-4 -4 44 56',
    width: 44,
    height: 56,
    anchor: [20, 48],
    symbolOffset: 28,
  },
  // A shiny ball (radial gradient) on a thin stick — uMap's "Ball". No symbol (matches Leaflet).
  Ball: {
    viewBox: '2 -4 28 44',
    width: 28,
    height: 44,
    anchor: [14, 38],
    body: (color, opacity) =>
      `<defs><radialGradient id="ball" gradientUnits="userSpaceOnUse" cx="13" cy="5" r="14">` +
      `<stop offset="0" stop-color="#fff"/>` +
      `<stop offset="0.55" stop-color="${color}"/>` +
      `<stop offset="1" stop-color="${color}"/>` +
      `</radialGradient></defs>` +
      `<g filter="url(#shadow)" opacity="${opacity}">` +
      `<line x1="16" y1="12" x2="16" y2="34" stroke="#000" stroke-width="2"/>` +
      `<circle cx="16" cy="8" r="8" fill="url(#ball)"/>` +
      `</g>`,
  },
}
const pinCache = new Map()

function pinIcon(
  shapeName,
  color = SCHEMA.color.default,
  opacity = SCHEMA.iconOpacity.default
) {
  const key = `${shapeName}|${color}|${opacity}`
  if (!pinCache.has(key)) {
    const shape = SHAPES[shapeName]
    // Simple shapes are a single colored path; richer ones (Ball) build their own body.
    const body = shape.body
      ? shape.body(color, opacity)
      : `<path d="${shape.path}" fill="${color}" opacity="${opacity}" filter="url(#shadow)"/>`
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${shape.width}" height="${shape.height}" viewBox="${shape.viewBox}">` +
      `<defs>${SHADOW_FILTER}</defs>` +
      body +
      `</svg>`
    pinCache.set(
      key,
      new Icon({
        src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
        anchor: shape.anchor,
        anchorXUnits: 'pixels',
        anchorYUnits: 'pixels',
      })
    )
  }
  return pinCache.get(key)
}

function isImg(url) {
  return isPath(url) || isRemoteUrl(url) || isDataImage(url)
}

// `bgColor` is the color the glyph sits on: the text is auto-contrasted against it (black on a
// light background, white on a dark one). Defaults to white (the colored pins carry white glyphs).
function symbolStyle(url, offset, size, bgColor) {
  if (isImg(url)) {
    const options = { src: url, displacement: [0, offset], crossOrigin: 'anonymous' }
    // The default marker keeps its intrinsic size; any other symbol is scaled to `size`
    // (width-based, so aspect is preserved — a very tall symbol can still overflow).
    if (size && url !== DEFAULT_URL) options.width = size
    return new Style({ image: new Icon(options) })
  }
  // A glyph / short text, sized from `size` when given (else the pin-head default).
  return new Style({
    text: new TextStyle({
      text: url,
      offsetY: -offset,
      font: `bold ${size ? Math.round(size * 0.72) : 14}px sans-serif`,
      fill: new Fill({ color: bgColor ? textColorFromColor(bgColor) : '#fff' }),
    }),
  })
}

const POINT_ZINDEX_OFFSET = 10000

export class OLProxy {
  constructor(app, element) {
    this.app = app
    this.sources = {}
    this.layers = {}
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
      const { content, center } = event.detail
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
    })
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
    //   this.map.setView(
    //     new View({
    //       center: fromLonLat(this.app.properties.center),
    //       zoom: this.app.getProperty('zoom'),
    //       // extent: [ 142018.18294748594, 4635148.893696092, 2945116.88422147, 7347746.153480427 ]
    //     })
    //   )
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
    const overlays = this.map.getOverlays().getArray()
    for (const overlay of overlays) {
      this.map.removeOverlay(overlay)
    }
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
      const heat = new HeatmapLayer({ source })
      source.on('change:umapConfig', () => {
        const config = source.get('umapConfig')?.heat || {}
        if (config.blur !== undefined) heat.setBlur(config.blur)
        // OL's absolute-density heatmap needs ~1/3 of Leaflet's radius to match visually.
        heat.setRadius((config.radius || 25) / 3)
        heat.setWeight(config.intensityProperty || 'weight')
      })
      layers['heat'] = heat
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
      olFeature.set(
        'umapStyle',
        this.style(feature.style, olFeature.getGeometry().getType())
      )
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
    olFeature.set(
      'umapStyle',
      this.style(geojson.style, olFeature.getGeometry().getType())
    )
  }

  addFeature(id, geojson) {
    const options = { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' }
    const olFeature = new GeoJSON().readFeature(geojson, options)
    olFeature.set(
      'umapStyle',
      this.style(geojson.style, olFeature.getGeometry().getType())
    )
    this.sources[id].addFeature(olFeature)
  }

  style(style = {}, geometryType) {
    const stroke = new Stroke({
      color: rgba(style.color, style.opacity),
      width: style.weight,
      lineDash: style.dashArray?.split(',').map(Number),
    })
    const fill =
      style.fill === false
        ? undefined
        : new Fill({
            color: rgba(style.fillColor || style.color, style.fillOpacity),
          })

    if (geometryType === 'Point') {
      // uMap "Circles" datalayer type: a proportional native circle.
      if (style.shape === 'circle') {
        return new Style({ image: new CircleStyle({ radius: 6, fill, stroke }) })
      }
      const iconClass = style.iconClass
      const opacity = style.iconOpacity

      // Circle / LargeCircle are plain circles → native CircleStyle, no rasterization.
      if (iconClass === 'Circle') {
        return new Style({
          image: new CircleStyle({
            radius: 5,
            fill: new Fill({ color: rgba(style.color, opacity) }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
          }),
        })
      }
      if (iconClass === 'LargeCircle') {
        // iconSize is a dynamic diameter; the 2px ring straddles the edge (radius = size/2 - 1).
        const iconSize = style.iconSize || SCHEMA.iconSize.default
        return [
          new Style({
            image: new CircleStyle({
              radius: iconSize / 2 - 1,
              fill: new Fill({ color: rgba('#fff', opacity) }),
              stroke: new Stroke({ color: rgba(style.color, opacity), width: 2 }),
            }),
          }),
          // Fit the symbol inside the disk, not edge-to-edge; glyph contrasts with the white disk.
          symbolStyle(
            style.iconUrl || DEFAULT_URL,
            0,
            Math.round(iconSize * 0.7),
            '#fff'
          ),
        ]
      }

      // Raw ("None"): no pin, just the symbol sized to iconSize, centered on the point.
      if (iconClass === 'Raw') {
        const iconSize = style.iconSize || SCHEMA.iconSize.default
        return symbolStyle(style.iconUrl || DEFAULT_URL, 0, iconSize)
      }

      // Default / Drop / Ball: an SVG pin, plus an optional symbol on top.
      const shapeName = SHAPES[iconClass] ? iconClass : 'Default'
      const shape = SHAPES[shapeName]
      const styles = [new Style({ image: pinIcon(shapeName, style.color, opacity) })]
      // Shapes with a `symbolOffset` host a symbol; others (Ball) are self-contained.
      if (shape.symbolOffset !== undefined) {
        styles.push(symbolStyle(style.iconUrl || DEFAULT_URL, shape.symbolOffset, 24))
      }
      return styles
    }
    return new Style({ stroke, fill })
  }

  get hasExtent() {
    return Boolean(this.map.getView().getUpdatedOptions_().extent)
  }

  getExtentBBoxString() {
    // southwest_lng,southwest_lat,northeast_lng,northeast_lat'
    return this.map.options.maxBounds?.toBBoxString()
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
    const source = new ImageTile({
      url,
      tilePixelRatio: retina ? 2 : 1,
      attributions: spec.attribution,
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
