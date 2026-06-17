import { default as OLMap } from 'ol/Map.js'
import OSM from 'ol/source/OSM.js'
import TileLayer from 'ol/layer/Tile.js'
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
import { asArray } from 'ol/color.js'
import Modify from 'ol/interaction/Modify.js'

function rgba(color, opacity) {
  const rgba = asArray(color).slice()
  if (opacity != null) rgba[3] = opacity
  return rgba
}

export class OLProxy {
  constructor(umap, element) {
    this.umap = umap
    this.sources = {}
    this.layers = {}
    this.map = map = new OLMap({
      target: element,
      controls: [],
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
    })
    this.proxyOutgoingEvents()
    this.proxyIncomingEvents()
  }

  proxyIncomingEvents() {
    this.map.on('click', (event) => {
      console.log(event)
      const overlays = this.map.getOverlays().getArray()
      for (const overlay of overlays) {
        this.map.removeOverlay(overlay)
      }
      const { pixel, coordinate } = event
      this.map.forEachFeatureAtPixel(pixel, (olFeature, layer) => {
        const id = olFeature.getId()
        const feature = this.umap.getFeatureById(id)
        if (this.map.measureTools?.enabled()) return
        layer._popupHandlersAdded = true // Prevent leaflet from managing event
        if (event.originalEvent.shiftKey) {
          if (event.originalEvent.ctrlKey || event.originalEvent.metaKey) {
            feature.datalayer.edit(event)
          } else if (!feature.isReadOnly()) {
            // this.editLayer(id)
            feature.edit()
          }
        } else if (!this.map.editTools?.drawing()) {
          console.log('asking for feature.view')
          feature.view({ center: coordinate })
        }
      })
    })
  }

  proxyOutgoingEvents() {
    this.umap.on('map:view:set', (event) => {
      const { easing, zoom } = event.detail
      const center = event.detail.center
      if (easing) {
        this.view.animate({ zoom }, { center })
      } else {
        console.log(center)
        this.view.setCenter(fromLonLat(center))
        this.view.setZoom(zoom)
      }
    })
    this.umap.on('panel:show', (event) => {
      const { content } = event.detail
      this.umap.panel.open({ content })
    })
    this.umap.on('popup:show', (event) => {
      const { content, center } = event.detail
      console.log('we are in the show')
      const overlay = new Overlay({
        element: content,
        autoPan: {
          animation: {
            duration: 250,
          },
        },
      })
      overlay.setPosition(center)
      this.map.addOverlay(overlay)
    })
    this.umap.on('feature:reset', (event) => {
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
  attachUI(container) {
    // this.map.overlayContainer.appendChild(container)
    this.container.appendChild(container)
  }

  render() {
    this.map.setView(
      new View({
        center: fromLonLat(this.umap.properties.center),
        zoom: this.umap.getProperty('zoom'),
        // extent: [ 142018.18294748594, 4635148.893696092, 2945116.88422147, 7347746.153480427 ]
      })
    )
  }
  initEditTools() {}
  enableEdit() {
    for (const source of Object.values(this.sources)) {
      const modify = new Modify({ source })
      modify.on('modifyend', (event) => {
        event.features.forEach((olFeature) => {
          const feature = this.umap.getFeatureById(olFeature.getId())
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
    this.sources[id]?.clear()
  }

  onZoomEnd(id) {
    // No-op for now: OL has no cluster recompute, and zoom-based show/hide
    // (fromZoom/toZoom) is not wired on the OL side yet.
  }

  hasDataVisible(id) {
    return (this.sources[id]?.getFeatures().length ?? 0) > 0
  }

  removeFeature(id, featureId) {
    const olFeature = this.sources[id]?.getFeatureById(featureId)
    if (olFeature) this.sources[id].removeFeature(olFeature)
  }

  createLayer(datalayer) {
    this.sources[datalayer.id] = new VectorSource()
    this.layers[datalayer.id] = new VectorLayer({
      source: this.sources[datalayer.id],
    })
  }

  addData(id, geojson) {
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
      return new Style({ image: new CircleStyle({ radius: 6, fill, stroke }) })
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
