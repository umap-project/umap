import * as DOMUtils from './domutils.js'
import { SCHEMA } from './schema.js'
import * as Utils from './utils.js'

export const RECENT = []

export function setRecent(url) {
  if (Utils.hasVar(url)) return
  if (url === SCHEMA.iconUrl.default) return
  if (RECENT.indexOf(url) === -1) RECENT.push(url)
}

export function isImg(src) {
  return Utils.isPath(src) || Utils.isRemoteUrl(src) || Utils.isDataImage(src)
}

export function makeElement(src, parent) {
  let icon
  if (isImg(src)) {
    icon = Utils.loadTemplate(Utils.sanitizeVars`<img loading="lazy" src="${src}">`)
  } else {
    icon = Utils.loadTemplate(Utils.sanitizeVars`<span>${src}</span>`)
  }
  parent.appendChild(icon)
  return icon
}

export function setContrast(icon, parent, src, bgcolor) {
  /*
   * icon: the element we'll adapt the style, it can be an image or text
   * parent: the element we'll consider to decide whether to adapt the style,
   * by looking at its background color
   * src: the raw "icon" value, can be an URL, a path, text, emoticon, etc.
   * bgcolor: the background color, used for caching and in case we cannot guess the
   * parent background color
   */
  if (!icon) return

  if (DOMUtils.contrastedColor(parent, bgcolor)) {
    // Decide whether to switch svg to white or not, but do it
    // only for internal SVG, as invert could do weird things
    if (src.endsWith('.svg') && src !== SCHEMA.iconUrl.default) {
      // Must be called after icon container is added to the DOM
      // An image
      icon.style.filter = 'invert(1)'
    } else if (!icon.src) {
      // Text icon
      icon.style.color = 'white'
    }
  }
}

export function formatUrl(url, properties) {
  if (Utils.hasVar(url)) {
    return Utils.greedyTemplate(url || '', properties || {})
  }
  return url
}
