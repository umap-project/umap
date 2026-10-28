import { Alert } from '../../components/alerts/alert.js'
import { translate } from '../i18n.js'
import LayerGroup from 'ol/layer/Group.js'
import View from 'ol/View.js'
import { default as OLMap } from 'ol/Map.js'

// Size of `.umap-edit-tilelayers li` in map.css.
const PREVIEW_SIZE = [256, 200]

export default class TileLayerManager {
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

  async init(specs) {
    this.all.clear()
    this.specs = specs
    await this.refresh()
  }

  async refresh() {
    await Promise.all([this.selectDefault(), this.setOverlay()])
  }

  async create(spec) {
    const opacity = Number.parseFloat(spec.opacity)
    const options = {
      name: spec.name,
      opacity: Number.isFinite(opacity) ? opacity : 1,
      // Keep it to serialize back to JSON for saving it to the back.
      spec: { ...spec },
    }
    if (spec.is_vector) {
      const [{ apply }] = await Promise.all([
        import('ol-mapbox-style'),
        import('./pmtiles.js'),
      ])
      const vectorlayer = new LayerGroup(options)
      apply(vectorlayer, spec.url_template)
      return vectorlayer
    }
    const retina = window.devicePixelRatio > 1 && spec.url_template.includes('{r}')
    const url = spec.url_template
      .replace('{s}', '{a-c}')
      .replace('{r}', retina ? '@2x' : '')
      .replace('{y}', spec.tms ? '{-y}' : '{y}')
    const [{ default: XYZ }, { default: TileLayer }] = await Promise.all([
      import('ol/source/XYZ.js'),
      import('ol/layer/Tile.js'),
    ])
    const source = new XYZ({
      url,
      tilePixelRatio: retina ? 2 : 1,
      attributions: spec.attribution,
      crossOrigin: 'anonymous',
    })
    return new TileLayer({
      ...options,
      source,
      rank: spec.rank,
      url,
      zIndex: -1,
      minZoom: spec.minZoom,
      maxZoom: spec.maxZoom,
    })
  }

  async add(spec) {
    if (!spec.url_template) return
    if (this.all.has(spec.url_template)) return this.all.get(spec.url_template)
    const layer = await this.create(spec)
    this.all.set(spec.url_template, layer)
    return layer
  }

  async default() {
    return await this.add(this.specs[0])
  }

  // Display the configured base layer: the custom one (`properties.tilelayer`)
  // if it is set, else the first of the registry.
  async selectDefault() {
    const custom = this.app.properties.tilelayer
    if (custom?.url_template && custom.attribution) {
      this.select(await this.add({ ...custom, rank: 0 }))
    } else {
      this.select(await this.default())
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
      Alert.error(
        `${translate('Error in the tilelayer URL')}: ${tilelayer.get('spec').url_template}`
      )
      // Users can put tilelayer URLs by hand, and if they add wrong {variable},
      // Leaflet throw an error, and then the map is no more editable
    }
    this.app.fire('map:baselayerchange', { layer: this.current })
  }

  async setOverlay() {
    const spec = this.app.properties.overlay
    const overlay = spec?.url_template ? await this.create(spec) : undefined
    if (this.overlay) this.map.removeLayer(this.overlay)
    this.overlay = overlay
    if (overlay) {
      try {
        this.map.addLayer(overlay)
      } catch (e) {
        this.map.removeLayer(overlay)
        this.overlay = undefined
        console.error(e)
        Alert.error(`${translate('Error in the overlay URL')}: ${spec.url_template}`)
      }
    }
  }

  async cloneLayer(layer) {
    return await this.create(layer.get('spec'))
  }

  async preview(layer, element) {
    const [width, height] = PREVIEW_SIZE
    const ratio = window.devicePixelRatio
    const canvas = document.createElement('canvas')
    canvas.width = width * ratio
    canvas.height = height * ratio
    canvas.getContext('2d').scale(ratio, ratio)
    element.appendChild(canvas)
    new OLMap({
      target: canvas,
      layers: [await this.cloneLayer(layer)],
      controls: [],
      interactions: [],
      view: new View({
        center: this.proxy.view.getCenter(),
        zoom: this.proxy.zoom,
      }),
    })
  }

  // Only load vector tiles deps when really needed.
  async *iterLayers() {
    for (const spec of this.specs.toSorted((a, b) => a.rank - b.rank)) {
      const layer = await this.add(spec)
      if (layer) yield layer
    }
  }
}
