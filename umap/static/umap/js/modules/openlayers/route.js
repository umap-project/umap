import { unByKey } from 'ol/Observable.js'
import Draw from 'ol/interaction/Draw.js'
import Snap from 'ol/interaction/Snap.js'
import { toLonLat } from 'ol/proj.js'
import VectorSource from 'ol/source/Vector.js'

export default class DrawRoute {
  constructor(map) {
    this.map = map
    // Holds the raw Draw sketch points; the renderer displays the waypoints.
    this.source = new VectorSource()
  }

  start(feature) {
    this.feature = feature
    this.draw = new Draw({
      source: this.source,
      type: 'Point',
      stopClick: true,
    })
    this.snap = new Snap({ source: this.source })
    this.map.addInteraction(this.draw)
    this.map.addInteraction(this.snap)
    this.removeKey = this.map.getInteractions().on('remove', (event) => {
      if (event.element === this.draw) this.stop()
    })
    this.waypoints = []
    return new Promise((resolve) => {
      this.resolve = resolve
      this.draw.on('drawend', (event) => {
        if (this.onDrawEnd(event)) this.resolve(true)
      })
    })
  }

  stop() {
    unByKey(this.removeKey)
    this.map.removeInteraction(this.snap)
    this.resolve?.(false)
  }

  onDrawEnd(event) {
    const coordinate = event.feature.getGeometry().getCoordinates()
    const lastPoint = this.waypoints.at(-1)
    if (coordinate[0] === lastPoint?.[0] && coordinate[1] === lastPoint?.[1]) {
      return true
    }
    this.waypoints.push(coordinate)
    this.feature.setRoute(Array.from(this.waypoints, (coord) => toLonLat(coord)))
  }
}
