// Those module will be loaded even for a single map view, so let's track them.
// They all share a dep to turf/meta (~21.6 KB) and turf/helpers ((~7.9 KB))
import { area } from '@turf/area' // deps: meta, helpers — +1.6 KB
import { centroid } from '@turf/centroid' // deps: meta, helpers — +0.5 KB
import { flip } from '@turf/flip' // deps: clone, meta, helpers — +3.3 KB (clone)
import { length } from '@turf/length' // deps: distance (→invariant), meta — +4.7 KB
import { bbox } from '@turf/bbox' // deps: meta, helpers — +0.7 KB

export async function distance(from, to, options) {
  const { distance } = await import('@turf/distance')
  return distance(from, to, options)
}

export async function union(features) {
  const { union } = await import('@turf/union')
  return union({ type: 'FeatureCollection', features })
}

export function center(geometry) {
  return centroid(geometry).geometry.coordinates
}

export async function cleanCoords(geojson, options) {
  const { cleanCoords } = await import('@turf/clean-coords')
  return cleanCoords(geojson, options)
}

// Index of the sub-shape of a Multi* geometry that `point` ([lng, lat]) sits on:
// the polygon containing it, or the nearest line. -1 if none.
export async function shapeAt(geometry, point) {
  const shapes = geometry.coordinates
  if (geometry.type === 'MultiPolygon') {
    const { booleanPointInPolygon } = await import('@turf/boolean-point-in-polygon')
    return shapes.findIndex((coordinates) =>
      booleanPointInPolygon(point, { type: 'Polygon', coordinates })
    )
  }
  if (geometry.type === 'MultiLineString') {
    const { pointToLineDistance } = await import('@turf/point-to-line-distance')
    let best = -1
    let min = Number.POSITIVE_INFINITY
    shapes.forEach((coordinates, index) => {
      const distance = pointToLineDistance(point, { type: 'LineString', coordinates })
      if (distance < min) {
        min = distance
        best = index
      }
    })
    return best
  }
  return -1
}

// True if `arr` is a flat array of positions ([[lng, lat], ...] or [LatLng, ...]),
// false if it has an extra nesting level (Multi/Polygon-like).
export function isFlat(arr) {
  return (
    !Array.isArray(arr[0]) ||
    (typeof arr[0][0] !== 'object' && typeof arr[0][0] !== 'undefined')
  )
}

// Bounding boxes are kept in geojson order: [west, south, east, north].
export function unionBbox(a, b) {
  if (!a) return b || null
  if (!b) return a
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.max(a[3], b[3]),
  ]
}

export function isValidBbox(bbox) {
  return Array.isArray(bbox) && bbox.length === 4 && bbox.every(Number.isFinite)
}

// Bounding boxes are kept in geojson order: [west, south, east, north].
export function bboxIntersects(a, b) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
}

export { flip, area, length, bbox }
