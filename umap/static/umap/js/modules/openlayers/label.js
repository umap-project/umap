import Fill from 'ol/style/Fill.js'
import Stroke from 'ol/style/Stroke.js'
import Style from 'ol/style/Style.js'
import TextStyle from 'ol/style/Text.js'
import { rgba, textWidth } from './utils.js'

const GAP = 12
const REPEAT_GAP = 20

function placement(direction, [x, top, bottom] = [0, 0, 0]) {
  const middle = (top + bottom) / 2
  switch (direction) {
    case 'left':
      return { textAlign: 'right', offsetX: -(x + GAP), offsetY: middle }
    case 'top':
      return { textBaseline: 'bottom', offsetX: 0, offsetY: top - GAP }
    case 'bottom':
      return { textBaseline: 'top', offsetX: 0, offsetY: bottom + GAP }
    default:
      return { textAlign: 'left', offsetX: x + GAP, offsetY: middle }
  }
}

export function anchorTexts(texts, textAnchor, direction) {
  const { offsetX, offsetY } = placement(direction, textAnchor)
  for (const style of texts) {
    const text = style.getText()
    text.setOffsetX(offsetX)
    text.setOffsetY(offsetY)
  }
}

// Permanent label (showLabel === true): the feature name drawn on the canvas,
// in a white box like the hover tooltip.
export function makeLabel(label, zIndex) {
  if (!label?.text || label.show !== true) return null
  const text = new TextStyle({
    text: label.text,
    font: '12px sans-serif',
    fill: new Fill({ color: '#333' }),
    backgroundFill: new Fill({ color: '#fff' }),
    backgroundStroke: new Stroke({ color: 'rgba(0, 0, 0, 0.15)', width: 1 }),
    padding: [3, 6, 3, 6],
    overflow: true,
    ...placement(label.direction),
  })
  return new Style({ text, zIndex })
}

// OL's textPath renders nothing on dense lines, so the text follows a simplified copy.
// Expected simplification level per zoom:
// - zoom 10 => ~1000
// - zoom 13 => ~300
// - zoom 16 => ~100
const textTolerance = (zoom) => 1000 * 0.3 ** ((zoom - 10) / 3)

export function simplifyForText(geometry, zoom) {
  return geometry.simplify(textTolerance(Math.round(zoom)))
}

// Text decoration drawn along (or on) the geometry itself.
export function makeTextPath(options, zIndex) {
  if (!options?.text) return null
  const font = `${options.fontSize}px sans-serif`
  const text = new TextStyle({
    text: options.text,
    textAlign: options.align === 'auto' ? undefined : options.align,
    textBaseline: 'middle',
    font,
    repeat: options.repeat ? textWidth(options.text, font) + REPEAT_GAP : null,
    fill: new Fill({ color: rgba(options.fill, options.opacity) }),
    stroke: new Stroke({ color: rgba(options.stroke, options.opacity), width: 3 }),
    offsetY: options.offset,
    keepUpright: false,
    placement: options.placement,
    overflow: true,
    rotation: (options.rotate * Math.PI) / 180,
  })
  return new Style({ text, zIndex })
}
