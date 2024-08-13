import {
  DomEvent,
  DomUtil,
  DivIcon,
  Icon,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import * as Utils from '../utils.js'
import { SCHEMA } from '../schema.js'

export function getClass(name) {
  switch (name) {
    case 'Circle':
      return Circle
    case 'Ball':
      return Ball
    case 'Drop':
      return Drop
    default:
      return DefaultIcon
  }
}

export const RECENT = []

const BaseIcon = L.DivIcon.extend({
  initialize: function (options) {
    const default_options = {
      iconSize: null, // Made in css
      iconUrl: SCHEMA.iconUrl.default,
      feature: null,
    }
    options = L.Util.extend({}, default_options, options)
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

  _getOpacity: function () {
    if (this.feature) return this.feature.getOption('iconOpacity')
    return SCHEMA.iconOpacity.default
  },

  onAdd: () => {},
})

const DefaultIcon = BaseIcon.extend({
  default_options: {
    iconAnchor: new L.Point(16, 40),
    popupAnchor: new L.Point(0, -40),
    tooltipAnchor: new L.Point(16, -24),
    className: 'umap-div-icon',
  },

  initialize: function (options) {
    options = L.Util.extend({}, this.default_options, options)
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

  createIcon: function () {
    this.elements = {}
    this.elements.main = DomUtil.create('div')
    this.elements.container = DomUtil.create(
      'div',
      'icon_container',
      this.elements.main
    )
    this.elements.main.dataset.feature = this.feature?.id
    this.elements.arrow = DomUtil.create('div', 'icon_arrow', this.elements.main)
    const src = this._getIconUrl('icon')
    if (src) {
      this.elements.icon = makeElement(src, this.elements.container)
    }
    this._setIconStyles(this.elements.main, 'icon')
    return this.elements.main
  },
})

const Circle = BaseIcon.extend({
  initialize: function (options) {
    const default_options = {
      popupAnchor: new L.Point(0, -6),
      tooltipAnchor: new L.Point(6, 0),
      className: 'umap-circle-icon',
    }
    options = L.Util.extend({}, default_options, options)
    BaseIcon.prototype.initialize.call(this, options)
  },

  _setIconStyles: function (img, name) {
    BaseIcon.prototype._setIconStyles.call(this, img, name)
    this.elements.main.style.backgroundColor = this._getColor()
    this.elements.main.style.opacity = this._getOpacity()
  },

  createIcon: function () {
    this.elements = {}
    this.elements.main = DomUtil.create('div')
    this.elements.main.innerHTML = '&nbsp;'
    this._setIconStyles(this.elements.main, 'icon')
    this.elements.main.dataset.feature = this.feature?.id
    return this.elements.main
  },
})

const Drop = DefaultIcon.extend({
  default_options: {
    iconAnchor: new L.Point(16, 42),
    popupAnchor: new L.Point(0, -42),
    tooltipAnchor: new L.Point(16, -24),
    className: 'umap-drop-icon',
  },
})

const Ball = DefaultIcon.extend({
  default_options: {
    iconAnchor: new L.Point(8, 30),
    popupAnchor: new L.Point(0, -28),
    tooltipAnchor: new L.Point(8, -23),
    className: 'umap-ball-icon',
  },

  createIcon: function () {
    this.elements = {}
    this.elements.main = DomUtil.create('div')
    this.elements.container = DomUtil.create(
      'div',
      'icon_container',
      this.elements.main
    )
    this.elements.main.dataset.feature = this.feature?.id
    this.elements.arrow = DomUtil.create('div', 'icon_arrow', this.elements.main)
    this._setIconStyles(this.elements.main, 'icon')
    return this.elements.main
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
    this.elements.container.style.background = background
    this.elements.container.style.opacity = this._getOpacity()
  },
})

export const Cluster = DivIcon.extend({
  options: {
    iconSize: [40, 40],
  },

  initialize: function (datalayer, cluster) {
    this.datalayer = datalayer
    this.cluster = cluster
  },

  createIcon: function () {
    const container = DomUtil.create('div', 'leaflet-marker-icon marker-cluster')
    const div = DomUtil.create('div', '', container)
    const span = DomUtil.create('span', '', div)
    const backgroundColor = this.datalayer.getColor()
    span.textContent = this.cluster.getChildCount()
    div.style.backgroundColor = backgroundColor
    return container
  },

  computeTextColor: function (el) {
    let color
    const backgroundColor = this.datalayer.getColor()
    if (this.datalayer.options.cluster?.textColor) {
      color = this.datalayer.options.cluster.textColor
    }
    return color || DomUtil.TextColorFromBackgroundColor(el, backgroundColor)
  },
})

export function isImg(src) {
  return Utils.isPath(src) || Utils.isRemoteUrl(src) || Utils.isDataImage(src)
}

export function makeElement(src, parent) {
  let icon
  if (isImg(src)) {
    icon = DomUtil.create('img')
    icon.src = src
  } else {
    icon = DomUtil.create('span')
    icon.textContent = src
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
    if (Utils.isPath(src) && src.endsWith('.svg') && src !== SCHEMA.iconUrl.default) {
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
