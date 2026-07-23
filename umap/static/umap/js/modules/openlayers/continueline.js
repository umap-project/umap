import Draw from 'ol/interaction/Draw.js'
import LineString from 'ol/geom/LineString.js'
import MultiLineString from 'ol/geom/MultiLineString.js'

export default class ContinueLine {
  constructor(map, feature, index, atStart) {
    this.map = map
    this.feature = feature
    this.index = index
    this.atStart = atStart
  }

  start() {
    this.originalGeometry = this.feature.getGeometry().clone()
    this.isMulti = this.originalGeometry.getType() === 'MultiLineString'
    const ring = this.isMulti
      ? this.originalGeometry.getCoordinates()[this.index]
      : this.originalGeometry.getCoordinates()
    // Draw#extend grows from the last vertex and wants a plain LineString; feed it
    // the ring, reversed when we continue from its first vertex.
    this.feature.setGeometry(new LineString(this.atStart ? [...ring].reverse() : ring))
    const draw = new Draw({ type: 'LineString', stopClick: true })
    this.map.addInteraction(draw)
    draw.extend(this.feature)
    return new Promise((resolve) => {
      draw.on('drawend', () => {
        this.map.removeInteraction(draw)
        resolve(this.commit())
      })
      draw.on('drawabort', () => {
        this.map.removeInteraction(draw)
        this.feature.setGeometry(this.originalGeometry)
        resolve(null)
      })
    })
  }

  commit() {
    let ring = this.feature.getGeometry().getCoordinates()
    if (this.atStart) ring = [...ring].reverse()
    if (this.isMulti) {
      const coordinates = this.originalGeometry.getCoordinates()
      coordinates[this.index] = ring
      this.feature.setGeometry(new MultiLineString(coordinates))
    } else {
      this.feature.setGeometry(new LineString(ring))
    }
    return this.feature.getGeometry()
  }
}
