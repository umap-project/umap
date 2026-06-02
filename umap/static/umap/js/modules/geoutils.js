export async function distance(from, to, options) {
  const { distance } = await import('@turf/distance')
  return distance(from, to, options)
}

export async function cleanCoords(geojson, options) {
  const { cleanCoords } = await import('@turf/clean-coords')
  return cleanCoords(geojson, options)
}
