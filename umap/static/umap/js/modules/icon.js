import * as DOMUtils from './domutils.js'
import { SCHEMA } from './schema.js'
import * as Utils from './utils.js'

export function getClass(name) {
  switch (name) {
    case 'Circle':
      return Circle
    case 'LargeCircle':
      return LargeCircle
    case 'Ball':
      return Ball
    case 'Drop':
      return Drop
    case 'Raw':
      return Raw
    default:
      return DefaultIcon
  }
}

export const RECENT = []

export class Icon {
  static defaults = {
    iconSize: null,
    iconAnchor: null,
    popupAnchor: null,
    tooltipAnchor: null,
    iconUrl: SCHEMA.iconUrl.default,
    className: '',
  }

  constructor(properties = {}) {
    this.properties = { ...this.constructor.defaults, ...properties }
  }

  get size() {
    return this.properties.iconSize
  }
  get anchor() {
    return this.properties.iconAnchor
  }
  get popupAnchor() {
    return this.properties.popupAnchor
  }
  get tooltipAnchor() {
    return this.properties.tooltipAnchor
  }
  get className() {
    return this.properties.className
  }

  _setRecent(url) {
    if (Utils.hasVar(url)) return
    if (url === SCHEMA.iconUrl.default) return
    if (RECENT.indexOf(url) === -1) RECENT.push(url)
  }

  get color() {
    return this.properties?.color || SCHEMA.color.default
  }

  get opacity() {
    return SCHEMA.iconOpacity.default
  }

  template = '<div></div>'

  update() {}

  render() {
    const [root, elements] = Utils.loadTemplateWithRefs(this.template)
    this.root = root
    this.elements = elements
    if (this.elements.container) {
      const src = this.iconUrl
      if (src) {
        this.elements.icon = makeElement(src, this.elements.container)
      }
    }
    this.update()
    return this.root
  }
}

class FeatureIcon extends Icon {
  constructor(feature) {
    super()
    this.feature = feature
  }

  get color() {
    return this.feature.getDynamicOption('color')
  }

  get opacity() {
    return this.feature.getOption('iconOpacity')
  }

  get iconUrl() {
    let url
    if (this.feature.iconUrl) {
      url = this.feature.iconUrl
      this._setRecent(url)
    } else {
      url = this.properties.iconUrl
    }
    return formatUrl(url, this.feature)
  }

  get className() {
    let className = super.className
    if (this.feature.isReadOnly()) className += ' readonly'
    if (this.feature.isActive()) className += ' umap-icon-active'
    return className
  }

  render() {
    super.render()
    this.root.dataset.feature = this.feature?.id
    return this.root
  }
}

export class DefaultIcon extends FeatureIcon {
  static defaults = {
    ...Icon.defaults,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
    tooltipAnchor: [16, -24],
    className: 'umap-div-icon',
  }

  template = `
    <div>
      <div class="icon-container" data-ref=container></div>
      <div class="icon-arrow" data-ref=arrow></div>
    </div>
  `

  update() {
    const { color, opacity } = this
    this.elements.container.style.backgroundColor = color
    this.elements.arrow.style.borderTopColor = color
    this.elements.container.style.opacity = opacity
    this.elements.arrow.style.opacity = opacity
    const src = this.iconUrl
    setContrast(this.elements.icon, this.elements.container, src, color)
  }
}

export class Circle extends FeatureIcon {
  static defaults = {
    ...Icon.defaults,
    iconSize: [12, 12],
    popupAnchor: [0, -6],
    tooltipAnchor: [6, 0],
    className: 'umap-circle-icon',
  }

  template = '<div>&nbsp;</div>'

  update() {
    this.root.style.backgroundColor = this.color
    this.root.style.opacity = this.opacity
  }
}

export class LargeCircle extends FeatureIcon {
  static defaults = {
    ...Icon.defaults,
    className: 'umap-large-circle-icon',
  }

  constructor(properties = {}) {
    super(properties)
    const size = this.feature?.getOption('iconSize') || SCHEMA.iconSize.default
    this.properties.popupAnchor = [0, -size / 2]
    this.properties.tooltipAnchor = [size / 2, 0]
    this.properties.iconAnchor = [size / 2, size / 2]
    this.properties.iconSize = [size, size]
  }

  template = '<div data-ref=container></div>'

  update() {
    const [w, h] = this.size
    this.root.style.opacity = this.opacity
    this.root.style.borderColor = this.color
    this.root.style.width = `${w}px`
    this.root.style.height = `${h}px`
  }
}

export class Raw extends DefaultIcon {
  static defaults = {
    ...DefaultIcon.defaults,
    className: 'umap-raw-icon',
  }

  constructor(properties = {}) {
    super(properties)
    const size = this.feature?.getOption('iconSize') || SCHEMA.iconSize.default
    this.properties.popupAnchor = [0, -size / 2]
    this.properties.tooltipAnchor = [size / 2, 0]
    this.properties.iconAnchor = [size / 2, size / 2]
    this.properties.iconSize = [size, size]
  }

  get color() {
    return 'transparent'
  }

  update() {
    const [w, h] = this.size
    this.root.style.width = `${w}px`
    this.root.style.height = `${h}px`
    setContrast(this.elements.icon, this.elements.container, this.iconUrl, this.color)
  }

  template = '<div data-ref=container></div>'
}

// biome-ignore lint/complexity/noStaticOnlyClass: subclass purely overrides defaults
export class Drop extends DefaultIcon {
  static defaults = {
    ...DefaultIcon.defaults,
    iconAnchor: [16, 42],
    popupAnchor: [0, -42],
    tooltipAnchor: [16, -24],
    className: 'umap-drop-icon',
  }
}

export class Ball extends DefaultIcon {
  static defaults = {
    ...DefaultIcon.defaults,
    iconAnchor: [8, 30],
    popupAnchor: [0, -28],
    tooltipAnchor: [8, -23],
    className: 'umap-ball-icon',
  }

  template = `
    <div>
      <div class="icon-container" data-ref=ball></div>
      <div class="icon-arrow" data-ref=arrow></div>
    </div>
  `

  update() {
    const { color } = this
    const background = `radial-gradient(circle at 6px 38% , white -4px, ${color} 8px) repeat scroll 0 0 transparent`
    this.elements.ball.style.background = background
    this.elements.ball.style.opacity = this.opacity
  }
}

export class Cluster extends Icon {
  static defaults = {
    ...Icon.defaults,
    iconSize: [40, 40],
    className: 'umap-cluster-icon',
  }

  template = '<div><span data-ref=counter></span></div>'

  update() {
    this.root.style.backgroundColor = this.properties.color
    this.elements.counter.textContent = this.properties.getCounter()
    this.elements.counter.style.color =
      this.properties.textColor ||
      DOMUtils.textColorFromBackgroundColor(
        this.elements.counter,
        this.properties.color
      )
  }
}

class SimpleCircle extends Icon {
  static defaults = {
    ...Icon.defaults,
    iconSize: [16, 16],
    className: 'umap-circle-icon',
  }

  template = '<div>&nbsp;</div>'
  fillColor = 'white'
  opacity = 1

  update() {
    this.root.style.backgroundColor = this.fillColor
    this.root.style.borderColor = this.borderColor
    this.root.style.opacity = this.opacity
  }
}

export class RouteIcon extends SimpleCircle {
  borderColor = 'orange'
}

export class LocationIcon extends SimpleCircle {
  borderColor = 'blue'
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

export function formatUrl(url, feature) {
  if (Utils.hasVar(url)) {
    return Utils.greedyTemplate(url || '', feature ? feature.extendedProperties() : {})
  }
  return url
}
