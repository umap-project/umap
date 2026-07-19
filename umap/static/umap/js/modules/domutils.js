// Utils that needs the DOM
import * as Utils from './utils.js'

// Mirrors L.DomEvent.disableClickPropagation: prevents clicks on `el` from
// reaching the Leaflet map below. The `_leaflet_disable_click` flag is still
// expected by Leaflet's internals as long as it remains the map engine.
export const disableClickPropagation = (el) => {
  for (const type of ['mousedown', 'touchstart', 'dblclick', 'contextmenu']) {
    el.addEventListener(type, (event) => event.stopPropagation())
  }
  el._leaflet_disable_click = true
}

// From https://gist.github.com/Accudio/b9cb16e0e3df858cef0d31e38f1fe46f
// convert colour in range 0-255 to the modifier used within luminance calculation
const colourMod = (colour) => {
  const sRGB = colour / 255
  let mod = ((sRGB + 0.055) / 1.055) ** 2.4
  if (sRGB < 0.03928) mod = sRGB / 12.92
  return mod
}
const RGBRegex = /rgb *\( *([0-9]{1,3}) *, *([0-9]{1,3}) *, *([0-9]{1,3}) *\)/

export const textColorFromBackgroundColor = (el, bgcolor) => {
  return contrastedColor(el, bgcolor) ? '#ffffff' : '#000000'
}

const contrastWCAG21 = (rgb) => {
  const [r, g, b] = rgb
  // luminance of inputted colour
  const lum = 0.2126 * colourMod(r) + 0.7152 * colourMod(g) + 0.0722 * colourMod(b)
  // white has a luminance of 1
  const whiteLum = 1
  const contrast = (whiteLum + 0.05) / (lum + 0.05)
  return contrast > 3 ? 1 : 0
}
const colorNameToHex = (str) => {
  const ctx = document.createElement('canvas').getContext('2d')
  ctx.fillStyle = str
  return ctx.fillStyle
}
export const hexToRGB = (hex) => {
  return hex
    .replace(
      /^#?([a-f\d])([a-f\d])([a-f\d])$/i,
      (m, r, g, b) => `#${r}${r}${g}${g}${b}${b}`
    )
    .substring(1)
    .match(/.{2}/g)
    .map((x) => Number.parseInt(x, 16))
}
export const colorToRGB = (color) => {
  if (!color.startsWith('#')) color = colorNameToHex(color)
  return hexToRGB(color)
}

const CACHE_CONTRAST = {}
export const contrastedColorFromColor = (bgcolor) => {
  if (CACHE_CONTRAST[bgcolor] === undefined) {
    CACHE_CONTRAST[bgcolor] = contrastWCAG21(colorToRGB(bgcolor))
  }
  return CACHE_CONTRAST[bgcolor]
}

export const textColorFromColor = (bgcolor) =>
  contrastedColorFromColor(bgcolor) ? '#ffffff' : '#000000'

const rgbFromComputedStyle = (el) => {
  const match = RGBRegex.exec(
    window.getComputedStyle(el).getPropertyValue('background-color')
  )
  if (!match) return null
  return [
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10),
    Number.parseInt(match[3], 10),
  ]
}

// DOM variant: prefer the element's actually-rendered background; fall back to the color
// string (e.g. when the element isn't added to the DOM yet).
export const contrastedColor = (el, bgcolor) => {
  if (CACHE_CONTRAST[bgcolor] !== undefined) return CACHE_CONTRAST[bgcolor]
  const rgb = rgbFromComputedStyle(el)
  if (!rgb) return contrastedColorFromColor(bgcolor)
  const out = contrastWCAG21(rgb)
  if (bgcolor) CACHE_CONTRAST[bgcolor] = out
  return out
}

export const createFieldset = (parent, title, options) => {
  options = options || {}
  const [details, { summary, fieldset }] = loadTemplateWithRefs(`
    <details class="${options.className || ''}">
      <summary data-ref="summary"><h4>${title}</h4></summary>
      <fieldset data-ref="fieldset"></fieldset>
    </details>
  `)
  details.open = options.on === true
  parent.appendChild(details)
  if (options.icon) {
    const icon = loadTemplate(`<i class="icon icon-16 ${options.icon}"></i>`)
    summary.insertBefore(icon, summary.firstChild)
  }
  return fieldset
}

export const loadTemplateWithRefs = Utils.loadTemplateWithRefs
export const loadTemplate = Utils.loadTemplate
