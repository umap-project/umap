import { SCHEMA } from '../schema.js'
import { isDataImage, isPath, isRemoteUrl } from '../utils.js'
import { blackOrWhite } from '../domutils.js'
import Icon from 'ol/style/Icon.js'
import TextStyle from 'ol/style/Text.js'
import CircleStyle from 'ol/style/Circle.js'
import Style from 'ol/style/Style.js'
import Stroke from 'ol/style/Stroke.js'
import Fill from 'ol/style/Fill.js'
import { rgba } from './utils.js'
import IconImage from 'ol/style/IconImage.js'
import ImageState from 'ol/ImageState.js'
import { createCanvasContext2D } from 'ol/dom.js'
import { asString } from 'ol/color.js'

// Patch IconImage.replaceColor to have our own composite operation
// TODO make a PR upstream to either allow setting the composite operation
// or to control the IconImage creation on the Icon class (to subclass).
// Another option is to transform all our SVG to white color (instead of black),
// but this will break in some user context we do not control, and it will
// complicate life of uMap hosters
function patchedReplaceColor(pixelRatio) {
  if (
    !this.color_ ||
    this.canvas_[pixelRatio] ||
    this.imageState_ !== ImageState.LOADED
  ) {
    return
  }

  const image = this.image_
  const ctx = createCanvasContext2D(
    Math.ceil(image.width * pixelRatio),
    Math.ceil(image.height * pixelRatio)
  )
  const canvas = ctx.canvas

  ctx.scale(pixelRatio, pixelRatio)
  ctx.fillStyle = asString(this.color_)
  ctx.fillRect(0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio)

  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(image, 0, 0)

  this.canvas_[pixelRatio] = canvas
}
IconImage.prototype.replaceColor_ = patchedReplaceColor

const SHADOW_FILTER =
  '<filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">' +
  '<feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.5"/></filter>'
const SHAPES = {
  Default: {
    body: (color, opacity) =>
      `<path d="M4,0 H28 A4,4 0 0 1 32,4 V28 A4,4 0 0 1 28,32 H24 L16,40 L8,32 H4 A4,4 0 0 1 0,28 V4 A4,4 0 0 1 4,0 Z" fill="${color}" opacity="${opacity}" filter="url(#shadow)"/>`,
    viewBox: '-4 -4 44 52',
    width: 44,
    height: 52,
    anchor: [20, 44],
    symbolOffset: 24,
    shadow: SHADOW_FILTER,
  },
  Drop: {
    body: (color, opacity) =>
      `<path d="M16,44 C4,30 0,24 0,16 A16,16 0 0 1 32,16 C32,24 28,30 16,44 Z" fill="${color}" opacity="${opacity}" filter="url(#shadow)"/>`,
    viewBox: '-4 -4 44 56',
    width: 44,
    height: 56,
    anchor: [20, 48],
    symbolOffset: 28,
    shadow: SHADOW_FILTER,
  },
  // A shiny ball (radial gradient) on a thin stick — uMap's "Ball". No symbol.
  Ball: {
    viewBox: '2 -4 28 52',
    width: 28,
    height: 44,
    anchor: [14, 30],
    body: (color, opacity) =>
      `<defs><radialGradient id="ball" gradientUnits="userSpaceOnUse" cx="13" cy="5" r="12">` +
      `<stop offset="0" stop-color="#fff"/>` +
      `<stop offset="0.55" stop-color="${color}"/>` +
      `<stop offset="1" stop-color="${color}"/>` +
      `</radialGradient></defs>` +
      `<line x1="16" y1="12" x2="16" y2="34" stroke="#000" stroke-width="2"/>` +
      `<g filter="url(#shadow)" opacity="${opacity}">` +
      `<circle cx="16" cy="8" r="9" fill="url(#ball)"/>` +
      `</g>`,
    shadow:
      '<filter id="shadow" x="-50%" y="-50%" width="200%" height="400%">' +
      '<feDropShadow dx="1" dy="24" stdDeviation="3" flood-color="#000" flood-opacity="0.5"/></filter>',
  },
}
const SHAPE_CACHE = new Map()

function makeShape(
  shapeName,
  color = SCHEMA.color.default,
  opacity = SCHEMA.iconOpacity.default,
  scale = 1
) {
  const key = `${shapeName}|${color}|${opacity}|${scale}`
  if (!SHAPE_CACHE.has(key)) {
    const shape = SHAPES[shapeName]
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${shape.width}" height="${shape.height}" viewBox="${shape.viewBox}">` +
      `<defs>${shape.shadow}</defs>` +
      shape.body(color, opacity) +
      `</svg>`
    SHAPE_CACHE.set(
      key,
      new Icon({
        src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
        anchor: shape.anchor,
        anchorXUnits: 'pixels',
        anchorYUnits: 'pixels',
        scale,
      })
    )
  }
  return SHAPE_CACHE.get(key)
}

function isImg(url) {
  return isPath(url) || isRemoteUrl(url) || isDataImage(url)
}

let measureContext
function textWidth(text, font) {
  measureContext ??= document.createElement('canvas').getContext('2d')
  measureContext.font = font
  return measureContext.measureText(text).width
}

function wrapText(text, font, maxWidth) {
  const lines = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word
    if (line && textWidth(candidate, font) > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines.join('\n')
}

function makeSymbol(src, offset, size, bgColor, maxWidth, zIndex) {
  if (isImg(src)) {
    const options = {
      src,
      displacement: [0, offset],
      crossOrigin: null,
    }
    if (bgColor && src.endsWith('.svg') && src !== SCHEMA.iconUrl.default) {
      options.color = blackOrWhite(bgColor)
    }
    // Do not change size for default icon (white dot)
    if (size && src !== SCHEMA.iconUrl.default) {
      options.width = maxWidth ? Math.min(size, maxWidth) : size
    }
    return new Style({ image: new Icon(options), zIndex })
  }
  const font = `bold ${size ? Math.round(size * 0.72) : 12}px sans-serif`
  const label = maxWidth ? wrapText(src, font, maxWidth) : src
  const text = new TextStyle({
    text: label,
    offsetY: -offset,
    font,
    fill: new Fill({ color: bgColor ? blackOrWhite(bgColor) : '#fff' }),
  })
  if (maxWidth) {
    // Wrapping fits multi-word labels; a single word longer than the box still needs scaling.
    const widest = Math.max(...label.split('\n').map((line) => textWidth(line, font)))
    if (widest > maxWidth) text.setScale(maxWidth / widest)
  }
  return new Style({ text, zIndex })
}

// An icon is an optional shape (Ball, Drop, Circle…) + an optional symbol (say a star, a tree, an emoji, some short text)
export function makeIcon(properties, zIndex) {
  const iconClass = properties.iconClass
  const scale = properties.scale ?? 1
  const opacity = properties.iconOpacity

  // Circle / LargeCircle are plain circles → native CircleStyle, no rasterization.
  if (['Circle', 'ProportionalCircle'].includes(iconClass)) {
    const circleOpacity =
      iconClass === 'Circle' ? 0.5 : properties.fillOpacity || properties.iconOpacity
    const strokeColor =
      iconClass === 'Circle'
        ? '#fff'
        : rgba(properties.fillColor || properties.color, circleOpacity)
    const radius = (properties.radius || 6) * scale
    return {
      style: new Style({
        image: new CircleStyle({
          radius: radius,
          fill: new Fill({
            color: rgba(properties.fillColor || properties.color, circleOpacity),
          }),
          stroke: new Stroke({ color: strokeColor, width: 1 }),
        }),
        zIndex,
      }),
      popupOffsetY: -radius,
    }
  }
  if (iconClass === 'LargeCircle') {
    // iconSize is a dynamic diameter; the 2px ring straddles the edge (radius = size/2 - 1).
    const iconSize = properties.iconSize || SCHEMA.iconSize.default
    const radius = (iconSize / 2 - 1) * scale
    return {
      style: [
        new Style({
          image: new CircleStyle({
            radius,
            fill: new Fill({ color: rgba('#fff', opacity) }),
            stroke: new Stroke({ color: rgba(properties.color, opacity), width: 2 }),
          }),
          zIndex,
        }),
        // Symbol contrasts with the white disk; wrapped/scaled to stay inside the ring.
        makeSymbol(
          properties.iconUrl || SCHEMA.iconUrl.default,
          0,
          iconSize * scale,
          '#fff',
          (iconSize / 2) * scale,
          zIndex
        ),
      ],
      popupOffsetY: -radius,
    }
  }

  // Raw ("None"): no pin, just the symbol sized to iconSize, centered on the point.
  if (iconClass === 'Raw') {
    const iconSize = properties.iconSize || SCHEMA.iconSize.default
    return {
      style: makeSymbol(
        properties.iconUrl || SCHEMA.iconUrl.default,
        0,
        iconSize * scale,
        undefined,
        undefined,
        zIndex
      ),
      popupOffsetY: (-iconSize / 2) * scale,
    }
  }

  // Non native shapes
  // Default / Drop / Ball: an SVG pin, plus an optional symbol on top.
  const shapeName = SHAPES[iconClass] ? iconClass : 'Default'
  const shape = SHAPES[shapeName]
  const styles = [
    new Style({
      image: makeShape(shapeName, properties.color, opacity, scale),
      zIndex,
    }),
  ]
  // Shapes with a `symbolOffset` host a symbol; others (Ball) are self-contained.
  if (shape.symbolOffset !== undefined) {
    styles.push(
      makeSymbol(
        properties.iconUrl || SCHEMA.iconUrl.default,
        shape.symbolOffset * scale,
        24 * scale,
        properties.color,
        24 * scale,
        zIndex
      )
    )
  }
  return { style: styles, popupOffsetY: -shape.anchor[1] * scale }
}
