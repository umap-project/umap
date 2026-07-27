import { asArray } from 'ol/color.js'
import GeoJSON from 'ol/format/GeoJSON.js'
import { transformExtent } from 'ol/proj.js'

const PROJECTION = { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' }
const geojsonFormat = new GeoJSON()

export function readGeometry(data) {
  return geojsonFormat.readGeometry(data, PROJECTION)
}

export function readFeature(data) {
  return geojsonFormat.readFeature(data, PROJECTION)
}

export function writeFeature(olFeature) {
  return geojsonFormat.writeFeatureObject(olFeature, PROJECTION)
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

let measureContext
export function textWidth(text, font) {
  measureContext ??= document.createElement('canvas').getContext('2d')
  measureContext.font = font
  return measureContext.measureText(text).width
}
