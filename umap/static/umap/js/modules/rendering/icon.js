import {
  DivIcon,
  DomEvent,
  DomUtil,
  Icon,
  Point,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import { SCHEMA } from '../schema.js'
import * as Utils from '../utils.js'

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

const BaseIcon = DivIcon.extend({
  default_options: {
    iconSize: null, // Made in css
    iconUrl: SCHEMA.iconUrl.default,
    feature: null,
  },
  initialize: function (options) {
    options = { ...this.default_options, ...options }
    Icon.prototype.initialize.call(this, options)
    this.feature = this.options.feature
    if (this.feature?.isReadOnly()) {
      this.options.className += ' readonly'
    }
  },

  _setRecent: (url) => {
    if (Utils.hasVar(url)) return
    if (url === SCHEMA.iconUrl.default) return
    if (RECENT.indexOf(url) === -1) {
      RECENT.push(url)
    }
  },

  _getIconUrl: function (name) {
    let url
    if (this.feature?._getIconUrl(name)) {
      url = this.feature._getIconUrl(name)
      this._setRecent(url)
    } else {
      url = this.options[`${name}Url`]
    }
    return formatUrl(url, this.feature)
  },

  _getColor: function () {
    let color
    if (this.feature) color = this.feature.getDynamicOption('color')
    else if (this.options.color) color = this.options.color
    else color = SCHEMA.color.default
    return color
  },

  _getSize: function () {
    return this.feature?.getOption('iconSize') || SCHEMA.iconSize.default
  },

  _getOpacity: function () {
    if (this.feature) return this.feature.getOption('iconOpacity')
    return SCHEMA.iconOpacity.default
  },

  onAdd: () => {},

  _setIconStyles: function (img, name) {
    if (this.feature.isActive()) this.options.className += ' umap-icon-active'
    DivIcon.prototype._setIconStyles.call(this, img, name)
  },

  createIcon: function () {
    const [root, elements] = Utils.loadTemplateWithRefs(this.getTemplate())
    this.root = root
    this.elements = elements
    this.root.dataset.feature = this.feature?.id
    if (this.elements.container) {
      const src = this._getIconUrl('icon')
      if (src) {
        this.elements.icon = makeElement(src, this.elements.container)
      }
    }
    this._setIconStyles(this.root, 'icon')
    return this.root
  },
})

const DefaultIcon = BaseIcon.extend({
  default_options: {
    iconAnchor: new Point(16, 40),
    popupAnchor: new Point(0, -40),
    tooltipAnchor: new Point(16, -24),
    className: 'umap-div-icon',
  },

  initialize: function (options) {
    options = { ...this.default_options, ...options }
    BaseIcon.prototype.initialize.call(this, options)
  },

  _setIconStyles: function (img, name) {
    BaseIcon.prototype._setIconStyles.call(this, img, name)
    const color = this._getColor()
    const opacity = this._getOpacity()
    this.elements.container.style.backgroundColor = color
    this.elements.arrow.style.borderTopColor = color
    this.elements.container.style.opacity = opacity
    this.elements.arrow.style.opacity = opacity
  },

  onAdd: function () {
    const src = this._getIconUrl('icon')
    const bgcolor = this._getColor()
    setContrast(this.elements.icon, this.elements.container, src, bgcolor)
  },

  getTemplate: () => {
    return `
      <div>
        <div class="icon-container" data-ref=container></div>
        <div class="icon-arrow" data-ref=arrow></div>
      </div>
    `
  },
})

const Circle = BaseIcon.extend({
  initialize: function (options) {
    const default_options = {
      iconSize: new Point(12, 12),
      popupAnchor: new Point(0, -6),
      tooltipAnchor: new Point(6, 0),
      className: 'umap-circle-icon',
    }
    options = { ...default_options, ...(options || {}) }
    BaseIcon.prototype.initialize.call(this, options)
  },

  _setIconStyles: function (img, name) {
    BaseIcon.prototype._setIconStyles.call(this, img, name)
    this.root.style.backgroundColor = this._getColor()
    this.root.style.opacity = this._getOpacity()
  },

  getTemplate: () => {
    return '<div>&nbsp;</div>'
  },
})

const LargeCircle = BaseIcon.extend({
  default_options: {
    className: 'umap-large-circle-icon',
  },
  initialize: function (options) {
    BaseIcon.prototype.initialize.call(this, options)
    const size = this._getSize()
    this.options.popupAnchor = new Point(0, (size / 2) * -1)
    this.options.tooltipAnchor = new Point(size / 2, 0)
    this.options.iconAnchor = new Point(size / 2, size / 2)
  },

  _setIconStyles: function (img, name) {
    BaseIcon.prototype._setIconStyles.call(this, img, name)
    this.root.style.opacity = this._getOpacity()
    this.root.style.borderColor = this._getColor()
    this.root.style.width = `${this._getSize()}px`
    this.root.style.height = `${this._getSize()}px`
  },

  getTemplate: () => {
    return '<div data-ref=container></div>'
  },
})

const Raw = DefaultIcon.extend({
  default_options: {
    className: 'umap-raw-icon',
  },
  initialize: function (options) {
    DefaultIcon.prototype.initialize.call(this, options)
    const size = this._getSize()
    this.options.popupAnchor = new Point(0, (size / 2) * -1)
    this.options.tooltipAnchor = new Point(size / 2, 0)
    this.options.iconAnchor = new Point(size / 2, size / 2)
  },

  _setIconStyles: function (img, name) {
    BaseIcon.prototype._setIconStyles.call(this, img, name)
    this.root.style.width = `${this._getSize()}px`
    this.root.style.height = `${this._getSize()}px`
  },

  _getColor: () => 'transparent',

  getTemplate: () => {
    return '<div data-ref=container></div>'
  },
})

const Drop = DefaultIcon.extend({
  default_options: {
    iconAnchor: new Point(16, 42),
    popupAnchor: new Point(0, -42),
    tooltipAnchor: new Point(16, -24),
    className: 'umap-drop-icon',
  },
})

const Ball = DefaultIcon.extend({
  default_options: {
    iconAnchor: new Point(8, 30),
    popupAnchor: new Point(0, -28),
    tooltipAnchor: new Point(8, -23),
    className: 'umap-ball-icon',
  },

  getTemplate: () => {
    return `
      <div>
        <div class="icon-container" data-ref=ball></div>
        <div class="icon-arrow" data-ref=arrow></div>
      </div>
    `
  },

  _setIconStyles: function (img, name) {
    BaseIcon.prototype._setIconStyles.call(this, img, name)
    const color = this._getColor('color')
    let background
    if (L.Browser.ielt9) {
      background = color
    } else if (L.Browser.webkit) {
      background = `-webkit-gradient( radial, 6 38%, 0, 6 38%, 8, from(white), to(${color}) )`
    } else {
      background = `radial-gradient(circle at 6px 38% , white -4px, ${color} 8px) repeat scroll 0 0 transparent`
    }
    this.elements.ball.style.background = background
    this.elements.ball.style.opacity = this._getOpacity()
  },
})

export const Cluster = DivIcon.extend({
  options: {
    iconSize: [40, 40],
    className: 'umap-cluster-icon',
  },

  createIcon: function () {
    const template = '<div><span data-ref=counter></span></div>'
    const [root, { counter }] = Utils.loadTemplateWithRefs(template)
    this.root = root
    this.counter = counter
    this.counter.textContent = this.options.getCounter()
    this.root.style.backgroundColor = this.options.color
    this._setIconStyles(this.root, 'icon')
    return this.root
  },
})

export function isImg(src) {
  return Utils.isPath(src) || Utils.isRemoteUrl(src) || Utils.isDataImage(src)
}

export function makeElement(src, parent) {
  let icon
  if (isImg(src)) {
    icon = Utils.loadTemplate(`<img loading="lazy" src="${src}">`)
  } else {
    icon = Utils.loadTemplate(`<span>${src}</span>`)
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

  if (DomUtil.contrastedColor(parent, bgcolor)) {
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
  return Utils.greedyTemplate(url || '', feature ? feature.extendedProperties() : {})
}
