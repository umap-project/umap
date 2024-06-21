/* Shapes  */

U.Popup = L.Popup.extend({
  options: {
    parseTemplate: true,
  },

  initialize: function (feature) {
    this.feature = feature
    this.container = L.DomUtil.create('div', 'umap-popup')
    this.format()
    L.Popup.prototype.initialize.call(this, {}, feature)
    this.setContent(this.container)
  },

  format: function () {
    const mode = this.feature.getOption('popupTemplate') || 'Default',
      klass = U.PopupTemplate[mode] || U.PopupTemplate.Default
    this.content = new klass(this.feature, this.container)
    this.content.render()
    const els = this.container.querySelectorAll('img,iframe')
    for (let i = 0; i < els.length; i++) {
      this.onElementLoaded(els[i])
    }
    if (!els.length && this.container.textContent.replace('\n', '') === '') {
      this.container.innerHTML = ''
      L.DomUtil.add('h3', '', this.container, this.feature.getDisplayName())
    }
  },

  onElementLoaded: function (el) {
    L.DomEvent.on(
      el,
      'load',
      function () {
        this._updateLayout()
        this._updatePosition()
        this._adjustPan()
      },
      this
    )
  },
})

U.Popup.Large = U.Popup.extend({
  options: {
    maxWidth: 500,
    className: 'umap-popup-large',
  },
})

U.Popup.Panel = U.Popup.extend({
  options: {
    zoomAnimation: false,
  },

  onAdd: function (map) {
    map.panel.setDefaultMode('expanded')
    map.panel.open({
      content: this._content,
      actions: [U.Browser.backButton(map)],
    })

    // fire events as in base class Popup.js:onAdd
    map.fire('popupopen', { popup: this })
    if (this._source) {
      this._source.fire('popupopen', { popup: this }, true)
      if (!(this._source instanceof L.Path)) {
        this._source.on('preclick', L.DomEvent.stopPropagation)
      }
    }
  },

  onRemove: function (map) {
    map.panel.close()

    // fire events as in base class Popup.js:onRemove
    map.fire('popupclose', { popup: this })
    if (this._source) {
      this._source.fire('popupclose', { popup: this }, true)
      if (!(this._source instanceof L.Path)) {
        this._source.off('preclick', L.DomEvent.stopPropagation)
      }
    }
  },

  update: function () {},
  _updateLayout: function () {},
  _updatePosition: function () {},
  _adjustPan: function () {},
  _animateZoom: function () {},
})
U.Popup.SimplePanel = U.Popup.Panel // Retrocompat.

/* Content templates */

U.PopupTemplate = {}

U.PopupTemplate.Default = L.Class.extend({
  initialize: function (feature, container) {
    this.feature = feature
    this.container = container
  },

  renderTitle: function () {},

  renderBody: function () {
    const template = this.feature.getOption('popupContentTemplate')
    const target = this.feature.getOption('outlinkTarget')
    const container = L.DomUtil.create('div', 'umap-popup-container text')
    let content = ''
    let properties
    let center
    properties = this.feature.extendedProperties()
    // Resolve properties inside description
    properties.description = U.Utils.greedyTemplate(
      this.feature.properties.description || '',
      properties
    )
    content = U.Utils.greedyTemplate(template, properties)
    content = U.Utils.toHTML(content, { target: target })
    container.innerHTML = content
    return container
  },

  renderFooter: function () {
    if (this.feature.hasPopupFooter()) {
      const footer = L.DomUtil.create('ul', 'umap-popup-footer', this.container),
        previousLi = L.DomUtil.create('li', 'previous', footer),
        zoomLi = L.DomUtil.create('li', 'zoom', footer),
        nextLi = L.DomUtil.create('li', 'next', footer),
        next = this.feature.getNext(),
        prev = this.feature.getPrevious()
      // Fixme: remove me when this is merged and released
      // https://github.com/Leaflet/Leaflet/pull/9052
      L.DomEvent.disableClickPropagation(footer)
      if (next)
        nextLi.title = L._('Go to «{feature}»', {
          feature: next.properties.name || L._('next'),
        })
      if (prev)
        previousLi.title = L._('Go to «{feature}»', {
          feature: prev.properties.name || L._('previous'),
        })
      zoomLi.title = L._('Zoom to this feature')
      L.DomEvent.on(nextLi, 'click', () => {
        if (next) next.zoomTo({ callback: next.view })
      })
      L.DomEvent.on(previousLi, 'click', () => {
        if (prev) prev.zoomTo({ callback: prev.view })
      })
      L.DomEvent.on(
        zoomLi,
        'click',
        function () {
          this.zoomTo()
        },
        this.feature
      )
    }
  },

  render: function () {
    const title = this.renderTitle()
    if (title) this.container.appendChild(title)
    const body = this.renderBody()
    if (body) L.DomUtil.add('div', 'umap-popup-content', this.container, body)
    this.renderFooter()
  },
})

U.PopupTemplate.BaseWithTitle = U.PopupTemplate.Default.extend({
  renderTitle: function () {
    let title
    if (this.feature.getDisplayName()) {
      title = L.DomUtil.create('h3', 'popup-title')
      title.textContent = this.feature.getDisplayName()
    }
    return title
  },
})

U.PopupTemplate.Table = U.PopupTemplate.BaseWithTitle.extend({
  formatRow: function (key, value) {
    if (value.indexOf('http') === 0) {
      value = `<a href="${value}" target="_blank">${value}</a>`
    }
    return value
  },

  addRow: function (container, key, value) {
    const tr = L.DomUtil.create('tr', '', container)
    L.DomUtil.add('th', '', tr, key)
    L.DomUtil.element({
      tagName: 'td',
      parent: tr,
      innerHTML: this.formatRow(key, value),
    })
  },

  renderBody: function () {
    const table = L.DomUtil.create('table')

    for (const key in this.feature.properties) {
      if (typeof this.feature.properties[key] === 'object' || key === 'name') continue
      // TODO, manage links (url, mailto, wikipedia...)
      this.addRow(table, key, U.Utils.escapeHTML(this.feature.properties[key]).trim())
    }
    return table
  },
})

U.PopupTemplate.GeoRSSImage = U.PopupTemplate.BaseWithTitle.extend({
  options: {
    minWidth: 300,
    maxWidth: 500,
    className: 'umap-popup-large umap-georss-image',
  },

  renderBody: function () {
    const container = L.DomUtil.create('a')
    container.href = this.feature.properties.link
    container.target = '_blank'
    if (this.feature.properties.img) {
      const img = L.DomUtil.create('img', '', container)
      img.src = this.feature.properties.img
      // Sadly, we are unable to override this from JS the clean way
      // See https://github.com/Leaflet/Leaflet/commit/61d746818b99d362108545c151a27f09d60960ee#commitcomment-6061847
      img.style.maxWidth = `${this.options.maxWidth}px`
      img.style.maxHeight = `${this.options.maxWidth}px`
      this.onElementLoaded(img)
    }
    return container
  },
})

U.PopupTemplate.GeoRSSLink = U.PopupTemplate.Default.extend({
  options: {
    className: 'umap-georss-link',
  },

  renderBody: function () {
    const title = this.renderTitle(this),
      a = L.DomUtil.add('a')
    a.href = this.feature.properties.link
    a.target = '_blank'
    a.appendChild(title)
    return a
  },
})

U.PopupTemplate.OSM = U.PopupTemplate.Default.extend({
  options: {
    className: 'umap-openstreetmap',
  },

  getName: function () {
    const props = this.feature.properties
    const locale = L.getLocale()
    if (locale && props[`name:${locale}`]) return props[`name:${locale}`]
    return props.name
  },

  renderBody: function () {
    const props = this.feature.properties
    const container = L.DomUtil.add('div')
    const title = L.DomUtil.add('h3', 'popup-title', container)
    const color = this.feature.getDynamicOption('color')
    title.style.backgroundColor = color
    const iconUrl = this.feature.getDynamicOption('iconUrl')
    let icon = U.Icon.makeIconElement(iconUrl, title)
    L.DomUtil.addClass(icon, 'icon')
    U.Icon.setIconContrast(icon, title, iconUrl, color)
    if (L.DomUtil.contrastedColor(title, color)) title.style.color = 'white'
    L.DomUtil.add('span', '', title, this.getName())
    const street = props['addr:street']
    if (street) {
      const row = L.DomUtil.add('address', 'address', container)
      const number = props['addr:housenumber']
      if (number) {
        // Poor way to deal with international forms of writting addresses
        L.DomUtil.add('span', '', row, `${L._('No.')}: ${number}`)
        L.DomUtil.add('span', '', row, `${L._('Street')}: ${street}`)
      } else {
        L.DomUtil.add('span', '', row, street)
      }
    }
    if (props.website) {
      L.DomUtil.element({
        tagName: 'a',
        parent: container,
        href: props.website,
        textContent: props.website,
      })
    }
    const phone = props.phone || props['contact:phone']
    if (phone) {
      L.DomUtil.add(
        'div',
        '',
        container,
        L.DomUtil.element({ tagName: 'a', href: `tel:${phone}`, textContent: phone })
      )
    }
    if (props.mobile) {
      L.DomUtil.add(
        'div',
        '',
        container,
        L.DomUtil.element({
          tagName: 'a',
          href: `tel:${props.mobile}`,
          textContent: props.mobile,
        })
      )
    }
    const email = props.email || props['contact:email']
    if (email) {
      L.DomUtil.add(
        'div',
        '',
        container,
        L.DomUtil.element('a', { href: `mailto:${email}`, textContent: email })
      )
    }
    const id = props['@id'] || props['id']
    if (id) {
      L.DomUtil.add(
        'div',
        'osm-link',
        container,
        L.DomUtil.element({
          tagName: 'a',
          href: `https://www.openstreetmap.org/${id}`,
          textContent: L._('See on OpenStreetMap'),
        })
      )
    }
    return container
  },
})
