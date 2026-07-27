import TileLayer from 'ol/layer/Tile.js'
import XYZ from 'ol/source/XYZ.js'
import { Alert } from '../../components/alerts/alert.js'

export default class TileLayerManager {
  constructor(proxy) {
    this.proxy = proxy
    this.all = new Map()
    this.current = undefined
    this.overlay = undefined

    proxy.map.on('loadstart', (event) => {
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
      crossOrigin: null,
    })
    return new TileLayer({
      source,
      rank: spec.rank,
      name: spec.name,
      url,
      zIndex: -1,
      minZoom: spec.minZoom,
      maxZoom: spec.maxZoom,
      // Keep it to serialize back to JSON for saving it to the back.
      spec: { ...spec },
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
    if (tilelayer === this.current) return
    const minZoom = tilelayer.getMinZoom()
    const maxZoom = tilelayer.getMaxZoom()
    const view = this.map.getView()
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
