// Utils that needs the DOM
import * as Utils from './utils.js'
import { translate } from './i18n.js'
import Tooltip from './ui/tooltip.js'

export const copyToClipboard = (textToCopy) => {
  const tooltip = new Tooltip()
  // https://stackoverflow.com/a/65996386
  // Navigator clipboard api needs a secure context (https)
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(textToCopy)
  } else {
    // Use the 'out of viewport hidden text area' trick
    const textArea = document.createElement('textarea')
    textArea.value = textToCopy

    // Move textarea out of the viewport so it's not visible
    textArea.style.position = 'absolute'
    textArea.style.left = '-999999px'

    document.body.prepend(textArea)
    textArea.select()

    try {
      document.execCommand('copy')
    } catch (error) {
      console.error(error)
    } finally {
      textArea.remove()
    }
  }
  tooltip.open({ content: translate('✅ Copied!'), duration: 5000 })
}

export const copiableInput = (parent, label, value) => {
  const [container, { input, button }] = Utils.loadTemplateWithRefs(`
    <div class="copiable-input">
      <label>${label}<input type="text" readOnly value="${value}" data-ref=input /></label>
      <button type="button" class="icon icon-24 icon-copy" title="${translate('copy')}" data-ref=button></button>
    </div>
  `)
  button.addEventListener('click', () => copyToClipboard(input.value))
  parent.appendChild(container)
  return input
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

const CACHE_CONTRAST = {}
export const contrastedColor = (el, bgcolor) => {
  // Return 0 for black and 1 for white
  // bgcolor is a human color, it can be a any keyword (purple…)
  if (typeof CACHE_CONTRAST[bgcolor] !== 'undefined') return CACHE_CONTRAST[bgcolor]
  let rgb = window.getComputedStyle(el).getPropertyValue('background-color')
  rgb = RGBRegex.exec(rgb)
  if (rgb && rgb.length === 4) {
    rgb = [
      Number.parseInt(rgb[1], 10),
      Number.parseInt(rgb[2], 10),
      Number.parseInt(rgb[3], 10),
    ]
  } else {
    // The element may not yet be added to the DOM, so let's try
    // another way
    const hex = colorNameToHex(bgcolor)
    rgb = hexToRGB(hex)
  }
  if (!rgb) return 1
  const out = contrastWCAG21(rgb)
  if (bgcolor) CACHE_CONTRAST[bgcolor] = out
  return out
}
