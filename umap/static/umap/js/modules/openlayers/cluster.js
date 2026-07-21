import Feature from 'ol/Feature.js'
import LineString from 'ol/geom/LineString.js'
import Point from 'ol/geom/Point.js'
import { boundingExtent } from 'ol/extent.js'
import Cluster from 'ol/source/Cluster.js'
import VectorSource from 'ol/source/Vector.js'
import VectorLayer from 'ol/layer/Vector.js'
import Style from 'ol/style/Style.js'
import CircleStyle from 'ol/style/Circle.js'
import TextStyle from 'ol/style/Text.js'
import Stroke from 'ol/style/Stroke.js'
import Fill from 'ol/style/Fill.js'
import { blackOrWhite } from '../domutils.js'

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

function spiderLayer(map) {
  let layer = map.get('spiderLayer')
  if (!layer) {
    layer = new VectorLayer({
      source: new VectorSource(),
      zIndex: SPIDER_ZINDEX,
      style: (feature) => feature.get('features')[0].get('umapStyle'),
    })
    map.set('spiderLayer', layer)
    map.addLayer(layer)
    map.on('umap:highlight', () => layer.changed())
    const collapse = () => layer.getSource().clear()
    map.on('moveend', collapse)
    // A click dismisses the spider — unless it landed on one of its own features (member or
    // link line), so a member's popup stays anchored to its still-visible marker.
    map.on('click', (event) => {
      const onSpider = map.getFeaturesAtPixel(event.pixel, {
        layerFilter: (candidate) => candidate === layer,
      }).length
      if (!onSpider) collapse()
    })
  }
  return layer
}

function spiderfy(members, center, map) {
  const source = spiderLayer(map).getSource()
  source.clear()
  const resolution = map.getView().getResolution()
  const revealed = []
  members.forEach((member, index) => {
    const spread = spiderfyLatLng(center, index, members.length, resolution)
    const line = new Feature({ geometry: new LineString([center, spread]) })
    line.setStyle(SPIDER_LINE_STYLE)
    const marker = new Feature({ features: [member], geometry: new Point(spread) })
    revealed.push(line, marker)
  })
  source.addFeatures(revealed)
}

export function onClusterClick(clusterFeature, map) {
  const members = clusterFeature.get('features')
  const center = clusterFeature.getGeometry().getCoordinates()
  if (members.length > 1) {
    const view = map.getView()
    const extent = boundingExtent(members.map((r) => r.getGeometry().getCoordinates()))
    const sameSpot = extent[0] === extent[2] && extent[1] === extent[3]
    if (sameSpot || view.getZoom() === view.getMaxZoom()) {
      spiderfy(members, center, map)
    } else {
      view.fit(extent, {
        duration: 1000,
        padding: [50, 50, 50, 50],
        maxZoom: view.getMaxZoom(),
      })
    }
    return true
  }
  // A spiderfied member (or a size-1 cluster) resolves to its original feature.
  return members[0].getId()
}

function clusterStyle(clusterFeature, config = {}) {
  const members = clusterFeature.get('features')
  if (members.length === 1) return members[0].get('umapStyle')
  const color = config.color || '#000000'
  return new Style({
    image: new CircleStyle({
      radius: 20,
      stroke: new Stroke({ color: '#fff', width: 2 }),
      fill: new Fill({ color }),
    }),
    text: new TextStyle({
      text: members.length.toString(),
      font: 'bold 12px sans-serif',
      fill: new Fill({ color: config.cluster?.textColor || blackOrWhite(color) }),
    }),
  })
}

export function createClusterLayer(source, zIndexOffset) {
  const radius = () => source.get('umapConfig')?.cluster?.radius || 80
  const clustered = new Cluster({
    source,
    distance: radius(),
    geometryFunction: (feature) =>
      feature.getGeometry().getType() === 'Point' ? feature.getGeometry() : null,
  })
  const layer = new VectorLayer({ source: clustered, zIndexOffset })
  layer.setStyle((feature) => clusterStyle(feature, source.get('umapConfig')))
  source.on('change:umapConfig', () => {
    clustered.setDistance(radius())
    layer.changed()
  })
  return layer
}
