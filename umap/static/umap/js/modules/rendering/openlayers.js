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
import Style from 'ol/style/Style.js'
import Stroke from 'ol/style/Stroke.js'
import Fill from 'ol/style/Fill.js'
import CircleStyle from 'ol/style/Circle.js'
import Icon from 'ol/style/Icon.js'
import TextStyle from 'ol/style/Text.js'
import { asArray } from 'ol/color.js'
import Modify from 'ol/interaction/Modify.js'
import { SCHEMA } from '../schema.js'
import { isDataImage, isPath, isRemoteUrl } from '../utils.js'
import Cluster from 'ol/source/Cluster.js'
import { boundingExtent } from 'ol/extent.js'
import LineString from 'ol/geom/LineString.js'
import Point from 'ol/geom/Point.js'
import Feature from 'ol/Feature.js'
import * as Utils from '../utils.js'
import HeatmapLayer from 'ol/layer/Heatmap.js'

function rgba(color, opacity) {
  const rgba = asArray(color).slice()
  if (opacity != null) rgba[3] = opacity
  return rgba
}

function spiderfyLatLng(center, index, layerCount, zoom, resolution) {
  const step = 20
  const maxRadius = 150
  const angle = (index * step * Math.PI) / 180
  const progress = index / layerCount
  const radius = maxRadius * (1 - progress) ** 0.4
  const x = radius * Math.cos(angle)
  const y = radius * Math.sin(angle)
  const [lng, lat] = center
  return [lng + x * resolution, lat + y * resolution]
}

// uMap markers as native OL styles: a colored pin Icon (with a drop shadow) plus the
// symbol as a SEPARATE style — an Icon for images (OL loads the URL itself; same-origin
// stays untainted) or a Text for glyphs. Each shape puts its tip at the anchor and its
// head centered `symbolOffset` px above it; the viewBox is padded so the shadow isn't
// clipped (which shifts the anchor by the padding).
const DEFAULT_URL = SCHEMA.iconUrl.default
// The browser drops SVG <filter>s when the icon <img> is drawImage'd onto OL's canvas, so
// the shadow can't be a filter. Fake a soft one with a few dim, offset copies of the path.
function shadowPaths(d) {
  return (
    `<path d="${d}" fill="#000" opacity="0.08" transform="translate(1 3)"/>` +
    `<path d="${d}" fill="#000" opacity="0.08" transform="translate(0.6 2)"/>` +
    `<path d="${d}" fill="#000" opacity="0.08" transform="translate(0.3 1)"/>`
  )
}
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
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${shape.width}" height="${shape.height}" viewBox="${shape.viewBox}">` +
      shadowPaths(shape.path) +
      `<path d="${shape.path}" fill="${color}" opacity="${opacity}"/></svg>`
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

function symbolStyle(url, offset) {
  if (isImg(url)) {
    const options = { src: url, displacement: [0, offset], crossOrigin: 'anonymous' }
    // The default marker keeps its own small size; other symbols are scaled to fit the
    // head (width-based, so aspect is preserved — a very tall symbol can still overflow).
    console.log(url, DEFAULT_URL)
    // if (url !== DEFAULT_URL) options.width = 24
    return new Style({ image: new Icon(options) })
  }
  // A glyph / short text.
  return new Style({
    text: new TextStyle({
      text: url,
      offsetY: -offset,
      font: 'bold 14px sans-serif',
      fill: new Fill({ color: '#fff' }),
    }),
  })
}

export class OLProxy {
  constructor(app, element) {
    this.app = app
    this.sources = {}
    this.layers = {}
    this.map = map = new OLMap({
      target: element,
      controls: [],
    })
    // Overlay holding the spiderfied cluster members (kept above the data layers). Cleared
    // on any view move — a resolution change reclusters, so the spread is stale anyway.
    this.spiderSource = new VectorSource()
    this.map.addLayer(new VectorLayer({ source: this.spiderSource, zIndex: 1000 }))
    this.map.on('moveend', () => this.spiderSource.clear())
    this.tilelayers = new TileLayerManager(this)
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
      olFeature.setStyle(this.style(geojson.style, olFeature.getGeometry().getType()))
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
    // this.map.overlayContainer.appendChild(container)
    this.container.appendChild(container)
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

  createOverlayPane() {
    const container = document.querySelector('#map')
    const pane = document.createElement('div')
    container.appendChild(pane)
    return pane
  }
  hasLayer(id) {
    const layer = this.layers[id]
    return Boolean(layer) && this.map.getLayers().getArray().includes(layer)
  }

  showLayer(id) {
    const layer = this.layers[id]
    if (layer) this.map.addLayer(layer)
  }

  hideLayer(id) {
    const layer = this.layers[id]
    if (layer) this.map.removeLayer(layer)
  }

  clear(id) {
    console.log('clear layer')
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
    const { pixel, coordinate } = event
    this.map.forEachFeatureAtPixel(pixel, (olFeature) => {
      let id = olFeature.getId()
      const features = olFeature.get('features')
      if (features) {
        if (features.length > 1) {
          if (this.zoom === this.map.getView().getMaxZoom()) {
            this.spiderfy(olFeature)
          } else {
            // Zoom to coverage
            const extent = boundingExtent(
              features.map((r) => r.getGeometry().getCoordinates())
            )
            map.getView().fit(extent, { duration: 1000, padding: [50, 50, 50, 50] })
          }
          return true
        }
        // A spiderfied member (or a size-1 cluster) resolves to its original feature.
        id = features[0].getId()
      }
      const feature = this.getFeatureById(id)
      if (!feature) return true
      if (this.map.measureTools?.enabled()) return true
      if (event.originalEvent.shiftKey) {
        if (event.originalEvent.ctrlKey || event.originalEvent.metaKey) {
          feature.datalayer.edit(event)
        } else if (!feature.isReadOnly()) {
          feature.edit()
        }
      } else if (!this.map.editTools?.drawing()) {
        // Events carry geographic lon/lat; the proxy converts to/from its projection.
        feature.view({ center: toLonLat(coordinate) })
      }
      return true
    })
  }

  removeFeature(id, featureId) {
    const olFeature = this.sources[id]?.getFeatureById(featureId)
    if (olFeature) this.sources[id].removeFeature(olFeature)
  }

  clearLayer(id) {
    const source = this.sources[id]
    if (source) source.clear()
  }

  createLayer(datalayer) {
    let source = new VectorSource()
    this.sources[datalayer.id] = source
    const cluster = datalayer.getProperty('cluster') || {}
    if (datalayer.Type?.type === 'Cluster') {
      source = new Cluster({
        source,
        distance: cluster.radius || 80,
        geometryFunction: (feature) => {
          const geometry = feature.getGeometry()
          if (geometry.getType() !== 'Point') return null
          return geometry
        },
      })
    }
    let layer
    if (datalayer.Type?.type === 'Heat') {
      console.log('we are in da heat', datalayer.properties.heat)
      layer = new HeatmapLayer({
        source,
        // radius: 8,
        // blur: 15,
        blur: datalayer.properties.heat?.blur,
        radius: datalayer.properties.heat?.radius / 3,
        weight: datalayer.properties.heat?.intensityProperty,
      })
    } else {
      layer = new VectorLayer({
        source,
        style: function (feature) {
          const features = feature.get('features')
          const size = features.length
          if (size === 1) return features[0].getStyle()
          return new Style({
            image: new CircleStyle({
              radius: 20,
              stroke: new Stroke({
                color: '#fff',
              }),
              fill: new Fill({
                color: datalayer.getProperty('color'),
              }),
            }),
            text: new TextStyle({
              text: size.toString(),
              fill: new Fill({
                color: cluster.textColor || '#fff',
              }),
            }),
          })
        },
      })
    }
    this.layers[datalayer.id] = layer
  }

  addData(id, geojson) {
    console.log('add data')
    const format = new GeoJSON()
    const options = { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' }
    // OL drops the top-level `style` member on read, so read each feature and
    // set its native OL style in the same pass.
    const olFeatures = geojson.features.map((feature) => {
      const olFeature = format.readFeature(feature, options)
      olFeature.setStyle(this.style(feature.style, olFeature.getGeometry().getType()))
      return olFeature
    })
    this.sources[id].addFeatures(olFeatures)
  }

  addFeature(id, geojson) {
    const options = { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' }
    const olFeature = new GeoJSON().readFeature(geojson, options)
    olFeature.setStyle(this.style(geojson.style, olFeature.getGeometry().getType()))
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
      if (style.shape === 'circle') {
        return new Style({ image: new CircleStyle({ radius: 6, fill, stroke }) })
      }
      const shapeName = SHAPES[style.iconClass] ? style.iconClass : 'Default'
      return [
        new Style({ image: pinIcon(shapeName, style.color, style.iconOpacity) }),
        symbolStyle(style.iconUrl || DEFAULT_URL, SHAPES[shapeName].symbolOffset),
      ]
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

  // Reveal a cluster's members as real features in the overlay (geometry = the spread
  // point, so each is clickable there), plus a link line each. Mirrors ol-ext SelectCluster:
  // clicking a revealed feature (which carries `features: [member]`) resolves to the member.
  spiderfy(clusterFeature) {
    this.spiderSource.clear()
    const members = clusterFeature.get('features')
    const center = clusterFeature.getGeometry().getCoordinates()
    const resolution = this.map.getView().getResolution()
    const revealed = []
    members.forEach((member, index) => {
      const spread = spiderfyLatLng(
        center,
        index,
        members.length,
        this.zoom,
        resolution
      )
      const marker = new Feature({ features: [member], geometry: new Point(spread) })
      marker.setStyle(member.getStyle())
      revealed.push(marker)
      // A link line: no data id, so a click on it resolves to no feature and exits cleanly.
      revealed.push(new Feature({ geometry: new LineString([center, spread]) }))
    })
    this.spiderSource.addFeatures(revealed)
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
    return new TileLayer({ source, rank: spec.rank, name: spec.name, url, zIndex: -1 })
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
    // this.map.fire('baselayerchange', { layer: tilelayer })
    console.log('tilelayer', tilelayer)
    const minZoom = tilelayer.getMinZoom()
    const maxZoom = tilelayer.getMaxZoom()
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
