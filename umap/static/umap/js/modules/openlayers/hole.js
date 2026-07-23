import { unByKey } from 'ol/Observable.js'
import Draw from 'ol/interaction/Draw.js'
import Polygon from 'ol/geom/Polygon.js'
import MultiPolygon from 'ol/geom/MultiPolygon.js'
import LinearRing from 'ol/geom/LinearRing.js'

export default class DrawHole {
  constructor(map, feature) {
    this.map = map
    this.feature = feature
    this.type = this.feature.getGeometry().getType()
  }

  start() {
    // onDrawStart mutates this.feature live; keep the original to restore on abort.
    this.originalGeometry = this.feature.getGeometry().clone()
    const draw = new Draw({
      type: 'Polygon',
      stopClick: true,
      // TODO add style to remove fill for hole drawing.
    })
    draw.on('drawstart', (event) => this.onDrawStart(event))
    this.map.addInteraction(draw)
    return new Promise((resolve) => {
      const cleanup = () => {
        this.map.removeInteraction(draw)
        if (this.changeKey) unByKey(this.changeKey)
      }
      draw.on('drawend', () => {
        cleanup()
        resolve(this.feature.getGeometry())
      })
      draw.on('drawabort', () => {
        cleanup()
        this.feature.setGeometry(this.originalGeometry)
        resolve(null)
      })
    })
  }

  onDrawStart(event) {
    const hole = event.feature
    const firstPoint = hole.getGeometry().getCoordinates()[0][0]
    if (this.type === 'MultiPolygon') {
      for (const [idx, polygon] of this.feature.getGeometry().getPolygons().entries()) {
        if (polygon.intersectsCoordinate(firstPoint)) {
          this.idx = idx
          this.initialLength = polygon.getCoordinates().length
          break
        }
      }
    } else {
      this.initialLength = this.feature.getGeometry().getCoordinates().length
    }
    // TODO abort if firstPoint does not intersect polygon
    this.changeKey = hole.getGeometry().on('change', (e) => this.onGeomChange(e))
  }

  onGeomChange = (event) => {
    const drawnHole = new LinearRing(event.target.getCoordinates()[0])

    let geom
    if (this.type === 'Polygon') {
      let coordinates = this.feature.getGeometry().getCoordinates()
      geom = new Polygon(coordinates.slice(0, this.initialLength))
      geom.appendLinearRing(drawnHole)
    } else {
      geom = new MultiPolygon([])
      for (let [idx, polygon] of this.feature.getGeometry().getPolygons().entries()) {
        if (idx === this.idx) {
          let coordinates = polygon.getCoordinates()
          polygon = new Polygon(coordinates.slice(0, this.initialLength))
          polygon.appendLinearRing(drawnHole)
        }
        geom.appendPolygon(polygon)
      }
    }
    this.feature.setGeometry(geom)
  }
}
