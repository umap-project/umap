import Feature from 'ol/Feature.js'
import { boundingExtent } from 'ol/extent.js'
import LineString from 'ol/geom/LineString.js'
import Point from 'ol/geom/Point.js'
import VectorLayer from 'ol/layer/Vector.js'
import { unByKey } from 'ol/Observable.js'
import { transformExtent } from 'ol/proj.js'
import Cluster from 'ol/source/Cluster.js'
import VectorSource from 'ol/source/Vector.js'
import CircleStyle from 'ol/style/Circle.js'
import Fill from 'ol/style/Fill.js'
import Stroke from 'ol/style/Stroke.js'
import Style from 'ol/style/Style.js'
import TextStyle from 'ol/style/Text.js'
import { blackOrWhite } from '../domutils.js'
import { FONT_FAMILY } from './utils.js'

const SPIDER_ZINDEX = 1e6
const SPIDER_LINE_STYLE = new Style({ stroke: new Stroke({ color: '#000', width: 1 }) })

function spiderfyLatLng(center, index, layerCount, resolution) {
  const step = 20
  const maxRadius = 150
  const angle = (index * step * Math.PI) / 180
  const progress = index / layerCount
  const radius = maxRadius * (1 - progress) ** 0.4
  const x = radius * Math.cos(angle)
  const y = radius * Math.sin(angle)
  const [lng, lat] = center
  return [lng + x * resolution, lat + y * resolution]
}

function memberStyle(member) {
  return [].concat(member.get('umapStyle') || [], member.get('umapText') || [])
}

export class Spider {
  constructor(map) {
    this.map = map
    this.source = new VectorSource()
    this.watching = []
    const layer = new VectorLayer({
      source: this.source,
      zIndex: SPIDER_ZINDEX,
      editable: true,
      style: (feature) => memberStyle(feature.get('represents')),
    })
    map.addLayer(layer)
    map.on('umap:highlight', () => layer.changed())
    map.on('moveend', () => this.collapse())
    // Clicking on the map should collapse the spider, unless the click is on a spiderfied marker.
    map.on('click', (event) => {
      const onSpider = map.getFeaturesAtPixel(event.pixel, {
        layerFilter: (candidate) => candidate === layer,
      }).length
      if (!onSpider) this.collapse()
    })
  }

  collapse() {
    unByKey(this.watching)
    this.watching = []
    this.source.clear()
  }

  reveal(members, center) {
    this.collapse()
    const resolution = this.map.getView().getResolution()
    const revealed = []
    members.forEach((member, index) => {
      const spread = spiderfyLatLng(center, index, members.length, resolution)
      const line = new Feature({ geometry: new LineString([center, spread]) })
      line.setStyle(SPIDER_LINE_STYLE)
      const marker = new Feature({
        geometry: new Point(spread),
        represents: member,
        interactive: member.get('interactive'),
        editable: member.get('editable'),
      })
      revealed.push(line, marker)
    })
    this.watching = members.map((member) =>
      member.on('change:geometry', () => this.collapse())
    )
    this.source.addFeatures(revealed)
  }
}

export function onClick(clusterFeature, { map, spider, app }) {
  const members = clusterFeature.get('features')
  const center = clusterFeature.getGeometry().getCoordinates()
  const view = map.getView()
  const extent = boundingExtent(members.map((r) => r.getGeometry().getCoordinates()))
  const sameSpot = extent[0] === extent[2] && extent[1] === extent[3]
  if (sameSpot || view.getZoom() === view.getMaxZoom()) {
    spider.reveal(members, center)
  } else {
    app.fire('map:view:fit', {
      bounds: transformExtent(extent, 'EPSG:3857', 'EPSG:4326'),
      zoom: view.getMaxZoom(),
    })
  }
}

function clusterStyle(clusterFeature, config = {}) {
  const members = clusterFeature.get('features')
  if (members.length === 1) return memberStyle(members[0])
  const color = config.color || '#000000'
  return new Style({
    image: new CircleStyle({
      radius: 20,
      stroke: new Stroke({ color: '#fff', width: 2 }),
      fill: new Fill({ color }),
    }),
    text: new TextStyle({
      text: members.length.toString(),
      font: `bold 12px ${FONT_FAMILY}`,
      fill: new Fill({ color: config.cluster?.textColor || blackOrWhite(color) }),
    }),
    // A distinct zIndex per cluster, else OL draws every count above every circle.
    // Southernmost on top.
    zIndex: Math.round(-clusterFeature.getGeometry().getCoordinates()[1]),
  })
}

export function createClusterLayer(source, zIndexOffset) {
  const radius = () => source.get('umapConfig')?.cluster?.radius || 80
  const clustered = new Cluster({
    source,
    distance: radius(),
    geometryFunction: (feature) =>
      feature.getGeometry().getType() === 'Point' ? feature.getGeometry() : null,
    createCluster: (geometry, features) => {
      const member = features.length === 1 ? features[0] : undefined
      return new Feature({
        geometry,
        features,
        represents: member,
        interactive: member ? member.get('interactive') : true,
        editable: member?.get('editable') ?? false,
      })
    },
  })
  const layer = new VectorLayer({ source: clustered, zIndexOffset, editable: true })
  layer.setStyle((feature) => clusterStyle(feature, source.get('umapConfig')))
  source.on('change:umapConfig', () => {
    clustered.setDistance(radius())
    layer.changed()
  })
  return layer
}
