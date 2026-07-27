import { asArray } from 'ol/color.js'
import GeoJSON from 'ol/format/GeoJSON.js'

const PROJECTION = { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' }
const geojsonFormat = new GeoJSON()

export const readGeometry = (data) => geojsonFormat.readGeometry(data, PROJECTION)
export const readFeature = (data) => geojsonFormat.readFeature(data, PROJECTION)
export const writeFeature = (olFeature) =>
  geojsonFormat.writeFeatureObject(olFeature, PROJECTION)

export function rgba(color, opacity) {
  const rgba = asArray(color).slice()
  if (opacity != null) rgba[3] = opacity
  return rgba
}

let measureContext
export function textWidth(text, font) {
  measureContext ??= document.createElement('canvas').getContext('2d')
  measureContext.font = font
  return measureContext.measureText(text).width
}
