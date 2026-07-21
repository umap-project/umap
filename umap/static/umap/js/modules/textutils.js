import { translate } from './i18n.js'

// Human readable distance (in meters) for the given unit (km, mi or nm).
// Ported from Leaflet.Measurable (L.GeoUtil), translate replacing L._.
export function readableDistance(distance, unit = 'km') {
  if (unit === 'mi') {
    distance *= 1.09361
    if (distance > 1760) {
      return translate('{distance} miles', {
        distance: (distance / 1760).toFixed(1),
      })
    }
    return translate('{distance} yd', { distance: distance.toFixed(2) })
  }
  if (unit === 'nm') {
    return translate('{distance} NM', { distance: Math.ceil(distance / 1852) })
  }
  if (distance > 100000) {
    return translate('{distance} km', { distance: Math.ceil(distance / 1000) })
  }
  if (distance > 1000) {
    return translate('{distance} km', { distance: (distance / 1000).toFixed(1) })
  }
  return translate('{distance} m', { distance: distance.toFixed(2) })
}

// Human readable area (in square meters) for the given unit (km or mi).
// Ported from Leaflet.Measurable (L.GeoUtil), translate replacing L._.
export function readableArea(area, unit = 'km') {
  if (unit === 'mi') {
    // Square yards in 1 meter
    area /= 0.836127
    // 3097600 square yards in 1 square mile
    if (area >= 3097600) {
      return translate('{area} mi²', { area: (area / 3097600).toFixed(2) })
    }
    // 4840 square yards in 1 acre
    if (area >= 4840) {
      return translate('{area} acres', { area: (area / 4840).toFixed(2) })
    }
    return translate('{area} yd²', { area: Math.ceil(area) })
  }
  if (area >= 100000) {
    return translate('{area} ha', { area: (area * 0.0001).toFixed(2) })
  }
  return translate('{area} m²', { area: area.toFixed(2) })
}
