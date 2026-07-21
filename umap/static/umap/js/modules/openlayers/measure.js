import { translate } from '../i18n.js'
import * as TextUtils from '../textutils.js'
import LineString from 'ol/geom/LineString.js'
import Point from 'ol/geom/Point.js'
import Draw from 'ol/interaction/Draw.js'
import Modify from 'ol/interaction/Modify.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorSource from 'ol/source/Vector.js'
import CircleStyle from 'ol/style/Circle.js'
import Fill from 'ol/style/Fill.js'
import RegularShape from 'ol/style/RegularShape.js'
import Stroke from 'ol/style/Stroke.js'
import Style from 'ol/style/Style.js'
import Text from 'ol/style/Text.js'
import { getArea, getLength } from 'ol/sphere.js'

const fillWhite = new Fill({
  color: 'rgba(255, 255, 255, 1)',
})
const padding = [3, 3, 3, 3]
const lightGray = 'rgba(0, 0, 0, 0.4)'
const mediumGray = 'rgba(0, 0, 0, 0.7)'

const drawStyle = new Style({
  fill: new Fill({ color: 'rgba(200, 200, 200, 0.2)' }),
  stroke: new Stroke({
    color: lightGray,
    lineDash: [10, 10],
    width: 2,
  }),
  image: new CircleStyle({
    radius: 5,
    stroke: new Stroke({ color: mediumGray }),
    fill: new Fill({ color: 'rgba(255, 255, 255, 0.2)' }),
  }),
})

const labelStyle = new Style({
  text: new Text({
    fill: fillWhite,
    backgroundFill: new Fill({ color: mediumGray }),
    padding,
    textBaseline: 'bottom',
    offsetY: -15,
  }),
  image: new RegularShape({
    radius: 8,
    points: 3,
    angle: Math.PI,
    displacement: [0, 10],
    fill: new Fill({ color: mediumGray }),
  }),
})

const tipStyle = new Style({
  text: new Text({
    fill: fillWhite,
    backgroundFill: new Fill({ color: lightGray }),
    padding,
    textAlign: 'left',
    offsetX: 15,
  }),
})

const modifyStyle = new Style({
  image: new CircleStyle({
    radius: 5,
    stroke: new Stroke({ color: mediumGray }),
    fill: new Fill({ color: lightGray }),
  }),
  text: new Text({
    text: translate('Drag to modify'),
    fill: fillWhite,
    backgroundFill: new Fill({ color: mediumGray }),
    padding,
    textAlign: 'left',
    offsetX: 15,
  }),
})

const segmentStyle = new Style({
  text: new Text({
    fill: fillWhite,
    backgroundFill: new Fill({ color: lightGray }),
    padding,
    textBaseline: 'bottom',
    offsetY: -12,
  }),
  image: new RegularShape({
    radius: 6,
    points: 3,
    angle: Math.PI,
    displacement: [0, 8],
    fill: new Fill({ color: lightGray }),
  }),
})

export class MeasureTool {
  constructor(map) {
    this.draw = null
    this.map = map
    this.source = new VectorSource()
    this.layer = new VectorLayer({
      source: this.source,
      style: (feature) => this.style(feature),
    })
    this.modify = new Modify({ source: this.source, style: modifyStyle })
    this.tipPoint = null
  }
  activate(type) {
    this.map.addLayer(this.layer)
    this.modify.setActive(true)
    this.map.addInteraction(this.modify)
  }
  deactivate() {
    this.source.clear()
    this.map.removeLayer(this.layer)
    this.draw.setActive(false)
    this.modify.setActive(false)
    this.map.removeInteraction(this.draw)
  }

  toggle(type) {
    if (this.map.getLayers().getArray().includes(this.layer)) {
      if (this.draw.type_ !== type) {
        this.map.removeInteraction(this.draw)
        this.draw.setActive(false)
        this.startDraw(type)
      } else {
        this.deactivate()
      }
    } else {
      this.startDraw(type)
      this.activate(type)
    }
  }

  startDraw(type) {
    let drawingTip
    if (type === 'Polygon') {
      drawingTip = translate('Click to continue drawing the polygon')
    } else {
      drawingTip = translate('Click to continue drawing the line')
    }
    const idleTip = translate('Click to start measuring')
    let tip = idleTip
    this.draw = new Draw({
      source: this.source,
      type: type,
      style: (feature) => this.style(feature, type, tip),
    })
    this.draw.on('drawstart', () => {
      this.modify.setActive(false)
      tip = drawingTip
    })
    this.draw.on('drawend', () => {
      modifyStyle.setGeometry(this.tipPoint)
      this.modify.setActive(true)
      this.map.once('pointermove', () => {
        modifyStyle.setGeometry(null)
      })
      tip = idleTip
    })
    this.map.addInteraction(this.draw)
  }

  style(feature, drawType, tip) {
    const styles = []
    const geometry = feature.getGeometry()
    const type = geometry.getType()
    let point, label, line
    if (!drawType || drawType === type || type === 'Point') {
      styles.push(drawStyle)
      if (type === 'Polygon') {
        point = geometry.getInteriorPoint()
        label = TextUtils.readableArea(getArea(geometry))
        line = new LineString(geometry.getCoordinates()[0])
      } else if (type === 'LineString') {
        point = new Point(geometry.getLastCoordinate())
        label = TextUtils.readableDistance(getLength(geometry))
        line = geometry
      }
    }
    if (line) {
      let count = 0
      const segmentStyles = []
      line.forEachSegment(function (a, b) {
        const segment = new LineString([a, b])
        const label = TextUtils.readableDistance(getLength(segment))
        if (segmentStyles.length - 1 < count) {
          segmentStyles.push(segmentStyle.clone())
        }
        const segmentPoint = new Point(segment.getCoordinateAt(0.5))
        segmentStyles[count].setGeometry(segmentPoint)
        segmentStyles[count].getText().setText(label)
        styles.push(segmentStyles[count])
        count++
      })
    }
    if (label) {
      labelStyle.setGeometry(point)
      labelStyle.getText().setText(label)
      styles.push(labelStyle)
    }
    if (
      tip &&
      type === 'Point' &&
      !this.modify.getOverlay().getSource().getFeatures().length
    ) {
      this.tipPoint = geometry
      tipStyle.getText().setText(tip)
      styles.push(tipStyle)
    }
    return styles
  }
}
