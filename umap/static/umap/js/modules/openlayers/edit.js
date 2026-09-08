import { primaryAction } from 'ol/events/condition.js'
import DoubleClickZoom from 'ol/interaction/DoubleClickZoom.js'
import Draw from 'ol/interaction/Draw.js'
import Modify from 'ol/interaction/Modify.js'
import Select from 'ol/interaction/Select.js'
import Snap from 'ol/interaction/Snap.js'
import Translate from 'ol/interaction/Translate.js'
import { unByKey } from 'ol/Observable.js'
import VectorSource from 'ol/source/Vector.js'
import ContinueLine from './continueline.js'
import DrawHole from './hole.js'
import DrawRoute from './route.js'

export default class Editor {
  constructor(map, proxy) {
    this.map = map
    this.proxy = proxy
    this.watched = new Map()
    this.listeners = []
    this._activeDrawing = null
    this.doubleClickZoom = this.map
      .getInteractions()
      .getArray()
      .find((interaction) => interaction instanceof DoubleClickZoom)
  }

  get activeDrawing() {
    return this._activeDrawing
  }

  set activeDrawing(interaction) {
    this._activeDrawing = interaction
    this.doubleClickZoom?.setActive(!interaction)
    if (interaction) this.pauseInteractions()
    else this.resumeInteractions()
  }

  disable() {
    unByKey(this.listeners)
    this.map.removeInteraction(this.select)
    this.map.removeInteraction(this.translate)
    for (const { modify, snap } of this.watched.values()) {
      this.map.removeInteraction(modify)
      this.map.removeInteraction(snap)
    }
  }

  enable() {
    // Do not allow to select spiderfied "false" markers (they are recreated at each
    // spiderfy, and this would activate the translate, which we do not want).
    const selectable = (feature) =>
      feature.get('editable') && !feature.get('represents')
    // Style: null, so select do not duplicate the highlighted style.
    this.select = new Select({ style: null, filter: selectable })
    this.map.addInteraction(this.select)
    this.select.on('select', (event) => {
      for (const olFeature of [...event.selected, ...event.deselected]) {
        this.proxy.applyStyle(olFeature)
      }
    })

    this.translate = new Translate({ features: this.select.getFeatures() })
    this.map.addInteraction(this.translate)
    this.translate.on('translatestart', () => this.proxy.hideOverlays())
    this.translate.on('translateend', (event) => {
      const { startCoordinate: start, coordinate: end } = event
      if (start[0] === end[0] && start[1] === end[1]) return
      for (const olFeature of event.features.getArray()) {
        this.proxy.pullGeometry(olFeature)
      }
    })

    const layers = this.map.getLayers()
    layers.forEach((layer) => this.watch(layer))
    this.listeners = [
      layers.on('add', (event) => this.watch(event.element)),
      layers.on('remove', (event) => this.unwatch(event.element)),
    ]
  }

  watch(layer) {
    if (!layer.get('editable')) return
    const source = layer.getSource()
    if (this.watched.has(source)) return
    const modify = new Modify({
      source,
      filter: (drawn) => drawn.get('editable'),
      // Do not allow to modify a selected feature, as they can already be translated,
      // and both interactions will conflict for LineString.
      condition: (event) =>
        primaryAction(event) &&
        !event.map.forEachFeatureAtPixel(event.pixel, (feature) =>
          this.select.getFeatures().getArray().includes(feature)
        ),
    })
    modify.on('modifystart', () => this.proxy.hideOverlays())
    modify.on('modifyend', (event) => {
      for (const drawn of event.features.getArray()) {
        const represented = drawn.get('represents')
        // A spiderfied marker has been drawn.
        if (represented) represented.setGeometry(drawn.getGeometry().clone())
        this.onModified(represented || drawn)
      }
    })
    const snap = new Snap({ source })
    this.watched.set(source, { modify, snap })
    // OL serves the last added interaction first: Snap after Modify, or nothing snaps.
    this.map.addInteraction(modify)
    this.map.addInteraction(snap)
  }

  unwatch(layer) {
    const source = layer.getSource()
    const { modify, snap } = this.watched.get(source) || {}
    if (modify) this.map.removeInteraction(modify)
    if (snap) this.map.removeInteraction(snap)
    this.watched.delete(source)
  }

  onModified(olFeature) {
    if (olFeature.get('route')) {
      const uFeature = this.proxy.getFeatureById(olFeature.getId())
      const geojson = this.proxy.OLFeatureToGeojson(olFeature)
      uFeature.setRoute(geojson.geometry.coordinates)
    } else {
      this.proxy.pullGeometry(olFeature)
    }
  }

  // Snap stays on: drawing snaps to existing features too.
  pauseInteractions() {
    this.select.setActive(false)
    this.translate.setActive(false)
    for (const { modify } of this.watched.values()) modify.setActive(false)
  }

  resumeInteractions() {
    this.select.setActive(true)
    this.translate.setActive(true)
    for (const { modify } of this.watched.values()) modify.setActive(true)
  }

  async startRoute() {
    if (this.activeDrawing) return
    const drawRoute = new DrawRoute(this.map)
    const datalayer = await this.proxy.app.defaultEditDataLayer()
    const route = datalayer.makeRoute()
    if (!(await route.askForRouteSettings())) return route.del(false)
    const onFinished = drawRoute.start(route)
    this.activeDrawing = drawRoute.draw
    const finished = await onFinished
    this.endDrawing()
    if (route.isDraft()) route.del(false)
    else if (finished) route.edit()
  }

  async startHole({ featureId, sourceId }) {
    const olFeature = this.proxy.sources[sourceId].getFeatureById(featureId)
    const drawHole = new DrawHole(this.map, olFeature)
    const promise = drawHole.start()
    this.activeDrawing = drawHole.draw
    promise.then((geometry) => {
      this.activeDrawing = null
      if (geometry) this.proxy.pullGeometry(olFeature)
    })
  }

  async startDrawing(type) {
    if (this.activeDrawing) return
    // Allow for Escape to be catched by the app listener.
    this.proxy.focus()
    if (!this.drawingSource) {
      this.drawingSource = new VectorSource()
      this.drawingSource.on('addfeature', (event) => {
        this.proxy.app.fire('feature:create', {
          geojson: this.proxy.OLFeatureToGeojson(event.feature),
        })
      })
    }
    const draw = new Draw({ source: this.drawingSource, type })
    this.activeDrawing = draw
    this.map.addInteraction(draw)
    this._moveSnapToTop()
    draw.on('drawend', () => this.endDrawing())
    draw.on('drawabort', () => this.endDrawing())
  }

  endDrawing() {
    if (!this.activeDrawing) return
    this.map.removeInteraction(this.activeDrawing)
    document.querySelector('.umap-edit-bar .drawing-tool.on')?.classList.remove('on')
    this.activeDrawing = null
  }

  async startContinueLine(feature, sourceId, index, atStart) {
    const olFeature = this.proxy.sources[sourceId].getFeatureById(feature.id)
    const continueLine = new ContinueLine(this.map, olFeature, index, atStart)
    const promise = continueLine.start()
    this.activeDrawing = continueLine.draw
    this._moveSnapToTop()
    promise.then((geometry) => {
      this.activeDrawing = null
      if (geometry) this.proxy.pullGeometry(olFeature)
    })
  }

  // Snap must be the last interaction to intercept coordinates before Draw/Modify.
  _moveSnapToTop() {
    for (const { snap } of this.watched.values()) {
      this.map.removeInteraction(snap)
      this.map.addInteraction(snap)
    }
  }
}
