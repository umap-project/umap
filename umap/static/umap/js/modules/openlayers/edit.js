import DoubleClickZoom from 'ol/interaction/DoubleClickZoom.js'
import Draw from 'ol/interaction/Draw.js'
import Modify from 'ol/interaction/Modify.js'
import Select from 'ol/interaction/Select.js'
import Snap from 'ol/interaction/Snap.js'
import Translate from 'ol/interaction/Translate.js'
import VectorSource from 'ol/source/Vector.js'
import ContinueLine from './continueline.js'
import DrawHole from './hole.js'
import DrawRoute from './route.js'

export default class Editor {
  constructor(map, proxy) {
    this.map = map
    this.proxy = proxy
    this.editInteractions = []
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
    if (interaction) this.pauseEditInteractions()
    else this.resumeEditInteractions()
  }

  disable() {
    for (const interaction of this.editInteractions) {
      this.map.removeInteraction(interaction)
    }
  }

  async enable() {
    // Don't let select duplicate the highlighted style.
    this.select = new Select({ style: null })
    this.editInteractions.push(this.select)
    this.map.addInteraction(this.select)
    this.select.on('select', (event) => {
      for (const olFeature of [...event.selected, ...event.deselected]) {
        this.proxy.applyStyle(olFeature)
      }
      if (this.select.getFeatures().getLength()) {
        this.pauseEditInteractions(Modify)
      } else {
        this.resumeEditInteractions(Modify)
      }
    })

    const translateFeature = new Translate({
      features: this.select.getFeatures(),
    })
    this.map.addInteraction(translateFeature)
    translateFeature.on('translateend', (event) => {
      if (
        event.startCoordinate[0] === event.coordinate[0] &&
        event.startCoordinate[1] === event.coordinate[1]
      )
        return
      for (const olFeature of event.features.getArray()) {
        this.proxy.pullGeometry(olFeature)
      }
    })
    this.editInteractions.push(translateFeature)

    for (const source of Object.values(this.proxy.sources)) {
      await this.registerSourceForEdit(source)
    }
  }

  async registerSourceForEdit(source) {
    const modify = new Modify({ source })
    const snap = new Snap({ source })
    this.editInteractions.push(modify)
    this.editInteractions.push(snap)
    modify.on('modifyend', (event) => {
      event.features.forEach((olFeature) => {
        if (olFeature.get('route')) {
          const uFeature = this.proxy.getFeatureById(olFeature.getId())
          const geojson = this.proxy.OLFeatureToGeojson(olFeature)
          uFeature.setRoute(geojson.geometry.coordinates)
        } else {
          this.proxy.pullGeometry(olFeature)
        }
      })
    })
    this.map.addInteraction(modify)
    this.map.addInteraction(snap)
  }

  pauseEditInteractions(type) {
    for (const interaction of this.editInteractions) {
      if (type && !(interaction instanceof type)) continue
      if (interaction instanceof Snap) continue
      interaction.setActive(false)
    }
  }

  resumeEditInteractions(type) {
    for (const interaction of this.editInteractions) {
      if (type && !(interaction instanceof type)) continue
      interaction.setActive(true)
    }
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
    // Allow for escape to be catched by the app listener.
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
    for (const snap of this.editInteractions.filter((i) => i instanceof Snap)) {
      this.map.removeInteraction(snap)
      this.map.addInteraction(snap)
    }
  }
}
