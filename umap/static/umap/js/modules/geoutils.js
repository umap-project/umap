export async function distance(from, to, options) {
  const { distance } = await import('@turf/distance')
  return distance(from, to, options)
}

export async function cleanCoords(geojson, options) {
  const { cleanCoords } = await import('@turf/clean-coords')
  return cleanCoords(geojson, options)
}

// True if `arr` is a flat array of positions ([[lng, lat], ...] or [LatLng, ...]),
// false if it has an extra nesting level (Multi/Polygon-like).
export function isFlat(arr) {
  return (
    !Array.isArray(arr[0]) ||
    (typeof arr[0][0] !== 'object' && typeof arr[0][0] !== 'undefined')
  )
}
