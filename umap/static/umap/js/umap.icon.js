U.Icon = L.DivIcon.extend({
  statics: {
    RECENT: [],
  },
  initialize: function (map, options) {
    this.map = map
    const default_options = {
      iconSize: null, // Made in css
      iconUrl: this.map.getDefaultOption('iconUrl'),
      feature: null,
    }
    options = L.Util.extend({}, default_options, options)
    L.Icon.prototype.initialize.call(this, options)
    this.feature = this.options.feature
    if (this.feature && this.feature.isReadOnly()) {
      this.options.className += ' readonly'
    }
  },

  _setRecent: function (url) {
    if (U.Utils.hasVar(url)) return
    if (url === U.SCHEMA.iconUrl.default) return
    if (U.Icon.RECENT.indexOf(url) === -1) {
      U.Icon.RECENT.push(url)
    }
  },

  _getIconUrl: function (name) {
    let url
    if (this.feature && this.feature._getIconUrl(name)) {
      url = this.feature._getIconUrl(name)
      this._setRecent(url)
    } else {
      url = this.options[`${name}Url`]
    }
    return this.formatUrl(url, this.feature)
  },

  _getColor: function () {
    let color
    if (this.feature) color = this.feature.getDynamicOption('color')
    else if (this.options.color) color = this.options.color
    else color = this.map.getDefaultOption('color')
    return color
  },

  _getOpacity: function () {
    if (this.feature) return this.feature.getOption('iconOpacity')
    return this.map.getDefaultOption('iconOpacity')
  },

  formatUrl: function (url, feature) {
    return U.Utils.greedyTemplate(
      url || '',
      feature ? feature.extendedProperties() : {}
    )
  },

  onAdd: function () {},
})

U.Icon.Default = U.Icon.extend({
  default_options: {
    iconAnchor: new L.Point(16, 40),
    popupAnchor: new L.Point(0, -40),
    tooltipAnchor: new L.Point(16, -24),
    className: 'umap-div-icon',
  },

  initialize: function (map, options) {
    options = L.Util.extend({}, this.default_options, options)
    U.Icon.prototype.initialize.call(this, map, options)
  },

  _setIconStyles: function (img, name) {
    U.Icon.prototype._setIconStyles.call(this, img, name)
    const color = this._getColor(),
      opacity = this._getOpacity()
    this.elements.container.style.backgroundColor = color
    this.elements.arrow.style.borderTopColor = color
    this.elements.container.style.opacity = opacity
    this.elements.arrow.style.opacity = opacity
  },

  onAdd: function () {
    const src = this._getIconUrl('icon')
    const bgcolor = this._getColor()
    U.Icon.setIconContrast(this.elements.icon, this.elements.container, src, bgcolor)
  },

  createIcon: function () {
    this.elements = {}
    this.elements.main = L.DomUtil.create('div')
    this.elements.container = L.DomUtil.create(
      'div',
      'icon_container',
      this.elements.main
    )
    this.elements.arrow = L.DomUtil.create('div', 'icon_arrow', this.elements.main)
    const src = this._getIconUrl('icon')
    if (src) {
      this.elements.icon = U.Icon.makeIconElement(src, this.elements.container)
    }
    this._setIconStyles(this.elements.main, 'icon')
    return this.elements.main
  },
})

U.Icon.Circle = U.Icon.extend({
  initialize: function (map, options) {
    const default_options = {
      popupAnchor: new L.Point(0, -6),
      tooltipAnchor: new L.Point(6, 0),
      className: 'umap-circle-icon',
    }
    options = L.Util.extend({}, default_options, options)
    U.Icon.prototype.initialize.call(this, map, options)
  },

  _setIconStyles: function (img, name) {
    U.Icon.prototype._setIconStyles.call(this, img, name)
    this.elements.main.style.backgroundColor = this._getColor()
    this.elements.main.style.opacity = this._getOpacity()
  },

  createIcon: function () {
    this.elements = {}
    this.elements.main = L.DomUtil.create('div')
    this.elements.main.innerHTML = '&nbsp;'
    this._setIconStyles(this.elements.main, 'icon')
    return this.elements.main
  },
})

U.Icon.Drop = U.Icon.Default.extend({
  default_options: {
    iconAnchor: new L.Point(16, 42),
    popupAnchor: new L.Point(0, -42),
    tooltipAnchor: new L.Point(16, -24),
    className: 'umap-drop-icon',
  },
})

U.Icon.Ball = U.Icon.Default.extend({
  default_options: {
    iconAnchor: new L.Point(8, 30),
    popupAnchor: new L.Point(0, -28),
    tooltipAnchor: new L.Point(8, -23),
    className: 'umap-ball-icon',
  },

  createIcon: function () {
    this.elements = {}
    this.elements.main = L.DomUtil.create('div')
    this.elements.container = L.DomUtil.create(
      'div',
      'icon_container',
      this.elements.main
    )
    this.elements.arrow = L.DomUtil.create('div', 'icon_arrow', this.elements.main)
    this._setIconStyles(this.elements.main, 'icon')
    return this.elements.main
  },

  _setIconStyles: function (img, name) {
    U.Icon.prototype._setIconStyles.call(this, img, name)
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

U.Icon.Cluster = L.DivIcon.extend({
  options: {
    iconSize: [40, 40],
  },

  initialize: function (datalayer, cluster) {
    this.datalayer = datalayer
    this.cluster = cluster
  },

  createIcon: function () {
    const container = L.DomUtil.create('div', 'leaflet-marker-icon marker-cluster'),
      div = L.DomUtil.create('div', '', container),
      span = L.DomUtil.create('span', '', div),
      backgroundColor = this.datalayer.getColor()
    span.textContent = this.cluster.getChildCount()
    div.style.backgroundColor = backgroundColor
    return container
  },

  computeTextColor: function (el) {
    let color
    const backgroundColor = this.datalayer.getColor()
    if (this.datalayer.options.cluster && this.datalayer.options.cluster.textColor) {
      color = this.datalayer.options.cluster.textColor
    }
    return color || L.DomUtil.TextColorFromBackgroundColor(el, backgroundColor)
  },
})

U.Icon.isImg = function (src) {
  return U.Utils.isPath(src) || U.Utils.isRemoteUrl(src) || U.Utils.isDataImage(src)
}

U.Icon.makeIconElement = function (src, parent) {
  let icon
  if (U.Icon.isImg(src)) {
    icon = L.DomUtil.create('img')
    icon.src = src
  } else {
    icon = L.DomUtil.create('span')
    icon.textContent = src
  }
  parent.appendChild(icon)
  return icon
}

U.Icon.setIconContrast = function (icon, parent, src, bgcolor) {
  /*
   * icon: the element we'll adapt the style, it can be an image or text
   * parent: the element we'll consider to decide whether to adapt the style,
   * by looking at its background color
   * src: the raw "icon" value, can be an URL, a path, text, emoticon, etc.
   * bgcolor: the background color, used for caching and in case we cannot guess the
   * parent background color
   */
  if (!icon) return

  if (L.DomUtil.contrastedColor(parent, bgcolor)) {
    // Decide whether to switch svg to white or not, but do it
    // only for internal SVG, as invert could do weird things
    if (
      U.Utils.isPath(src) &&
      src.endsWith('.svg') &&
      src !== U.SCHEMA.iconUrl.default
    ) {
      // Must be called after icon container is added to the DOM
      // An image
      icon.style.filter = 'invert(1)'
    } else if (!icon.src) {
      // Text icon
      icon.style.color = 'white'
    }
  }
}
