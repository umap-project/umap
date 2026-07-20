import { asArray } from 'ol/color.js'

export function rgba(color, opacity) {
  const rgba = asArray(color).slice()
  if (opacity != null) rgba[3] = opacity
  return rgba
}
