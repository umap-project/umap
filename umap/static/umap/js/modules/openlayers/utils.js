import { asArray } from 'ol/color.js'
import GeoJSON from 'ol/format/GeoJSON.js'
import Polygon, { fromExtent } from 'ol/geom/Polygon.js'
import { get as getProjection, transformExtent } from 'ol/proj.js'

const PROJECTION = { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' }
const geojsonFormat = new GeoJSON()
const WORLD = fromExtent(getProjection('EPSG:3857').getExtent()).getCoordinates()[0]

export function invertPolygon(geometry) {
  const rings = [WORLD]
  const polygons =
    geometry.getType() === 'MultiPolygon' ? geometry.getPolygons() : [geometry]
  for (const polygon of polygons) rings.push(...polygon.getCoordinates())
  return new Polygon(rings)
}

// The data feature a rendered one stands for: a cluster of one or a spiderfied
// marker stands for its member, a cluster of several for none.
export function targetFeature(olFeature) {
  if (olFeature.get('represents')) return olFeature.get('represents')
  if (!olFeature.get('features')) return olFeature
}

// A point on the shape itself: a centroid can fall off a curved line or a concave
// polygon.
export function popupAnchor(geometry) {
  switch (geometry.getType()) {
    case 'LineString':
      return geometry.getCoordinateAt(0.5)
    case 'MultiLineString':
      return geometry.getLineString(0).getCoordinateAt(0.5)
    case 'Polygon':
      return geometry.getInteriorPoint().getCoordinates().slice(0, 2)
    case 'MultiPolygon':
      return geometry.getInteriorPoints().getPoint(0).getCoordinates().slice(0, 2)
    default:
      return geometry.getCoordinates()
  }
}

export function readGeometry(data) {
  return geojsonFormat.readGeometry(data, PROJECTION)
}

export function readFeature(data) {
  return geojsonFormat.readFeature(data, PROJECTION)
}

export function writeFeature(olFeature) {
  return geojsonFormat.writeFeatureObject(olFeature, { ...PROJECTION, decimals: 6 })
}

export function toOLExtent(extent) {
  return transformExtent(extent, 'EPSG:4326', 'EPSG:3857')
}

export function fromOLExtent(extent) {
  return transformExtent(extent, 'EPSG:3857', 'EPSG:4326')
}

export function rgba(color, opacity) {
  const rgba = asArray(color).slice()
  if (opacity != null) rgba[3] = opacity
  return rgba
}

// Font to use in canvas (no CSS there) to try to make test screenshots less OS
// dependent.
export const FONT_FAMILY = 'fira_sans, sans-serif'

export const HIT_TOLERANCE = 5 // pixels

// Make sure fonts used in canvas are preloaded, otherwise it will fallback to
// system font (if the font is not in the DOM yet; eg. the bold used in a cluster
// is not in the DOM for a normal map detail view).
export async function loadFonts() {
  await Promise.allSettled([
    document.fonts.load(`12px ${FONT_FAMILY}`),
    document.fonts.load(`bold 12px ${FONT_FAMILY}`),
  ])
}

let measureContext
export function textWidth(text, font) {
  measureContext ??= document.createElement('canvas').getContext('2d')
  measureContext.font = font
  return measureContext.measureText(text).width
}
