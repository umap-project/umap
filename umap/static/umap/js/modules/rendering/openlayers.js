import { default as OLMap } from 'ol/Map.js'
import OSM from 'ol/source/OSM.js'
import TileLayer from 'ol/layer/Tile.js'
import View from 'ol/View.js'
import GeoJSON from 'ol/format/GeoJSON.js'
import VectorSource from 'ol/source/Vector.js'
import VectorLayer from 'ol/layer/Vector.js'
import { fromLonLat } from 'ol/proj.js'
// import Draw from 'ol/interaction/Draw.js'

export class OLProxy {
  constructor(umap, element) {
    this.umap = umap
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
  }

  proxyOutgoingEvents() {
    this.umap.on('map:view:set', (event) => {
      const { easing, zoom } = event.detail
      const center =  event.detail.center
      if (easing) {
        this.view.animate({zoom}, {center});
      } else {
        console.log(center)
        this.view.setCenter(fromLonLat(center))
        this.view.setZoom(zoom)
      }
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
  initEditTools() {
    // const draw = new Draw({
    //   source: this.source,
    //   type: 'LineString',
    // })
    // this.map.addInteraction(draw)
  }
  createOverlayPane() {
    const container = document.querySelector('#map')
    const pane = document.createElement('div')
    container.appendChild(pane)
    return pane
  }
  hasLayer() {
    return true
  }
  addLayer(geojson) {
    console.log(geojson)

    this.source = new VectorSource({
      features: new GeoJSON().readFeatures(geojson, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      }),
    })

    const vectorLayer = new VectorLayer({
      source: this.source,
    })

    this.map.addLayer(vectorLayer)
    console.log(vectorLayer)
    return vectorLayer
  }
  get hasExtent() {
    return Boolean(this.map.getView().getUpdatedOptions_().extent)
  }

  getExtentBBoxString() {
    // southwest_lng,southwest_lat,northeast_lng,northeast_lat'
    return this.map.options.maxBounds?.toBBoxString()
  }
}
