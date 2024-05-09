L.Util.copyToClipboard = function (textToCopy) {
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
}

L.Util.queryString = function (name, fallback) {
  const decode = (s) => decodeURIComponent(s.replace(/\+/g, ' '))
  const qs = window.location.search.slice(1).split('&'),
    qa = {}
  for (const i in qs) {
    const key = qs[i].split('=')
    if (!key) continue
    qa[decode(key[0])] = key[1] ? decode(key[1]) : 1
  }
  return qa[name] || fallback
}

L.Util.booleanFromQueryString = function (name) {
  const value = L.Util.queryString(name)
  return value === '1' || value === 'true'
}

L.Util.setFromQueryString = function (options, name) {
  const value = L.Util.queryString(name)
  if (typeof value !== 'undefined') options[name] = value
}

L.Util.setBooleanFromQueryString = function (options, name) {
  const value = L.Util.queryString(name)
  if (typeof value !== 'undefined') options[name] = value == '1' || value == 'true'
}

L.Util.setNumberFromQueryString = function (options, name) {
  const value = +L.Util.queryString(name)
  if (!isNaN(value)) options[name] = value
}

L.Util.setNullableBooleanFromQueryString = function (options, name) {
  let value = L.Util.queryString(name)
  if (typeof value !== 'undefined') {
    if (value === 'null') value = null
    else if (value === '0' || value === 'false') value = false
    else value = true
    options[name] = value
  }
}

L.DomUtil.add = (tagName, className, container, content) => {
  const el = L.DomUtil.create(tagName, className, container)
  if (content) {
    if (content.nodeType && content.nodeType === 1) {
      el.appendChild(content)
    } else {
      el.textContent = content
    }
  }
  return el
}

L.DomUtil.createFieldset = (container, legend, options) => {
  options = options || {}
  const details = L.DomUtil.create('details', options.className || '', container)
  const summary = L.DomUtil.add('summary', '', details)
  if (options.icon) L.DomUtil.createIcon(summary, options.icon)
  L.DomUtil.add('span', '', summary, legend)
  const fieldset = L.DomUtil.add('fieldset', '', details)
  details.open = options.on === true
  if (options.callback) {
    L.DomEvent.on(details, 'toggle', () => {
      if (details.open) options.callback.call(options.context || this)
    })
  }
  return fieldset
}

L.DomUtil.createButton = (className, container, content, callback, context) => {
  const el = L.DomUtil.add('button', className, container, content)
  el.type = 'button'
  if (!content.nodeType) {
    el.title = content
  }
  if (callback) {
    L.DomEvent.on(el, 'click', L.DomEvent.stop).on(el, 'click', callback, context)
  }
  return el
}

L.DomUtil.createLink = (className, container, content, url, target, title) => {
  const el = L.DomUtil.add('a', className, container, content)
  el.href = url
  if (target) {
    el.target = target
  }
  if (title) {
    el.title = title
  }
  return el
}

L.DomUtil.createIcon = (parent, className, title, size = 16) => {
  return L.DomUtil.element({
    tagName: 'i',
    parent: parent,
    className: `icon icon-${size} ${className}`,
    title: title || '',
  })
}

L.DomUtil.createButtonIcon = (parent, className, title, size = 16) => {
  return L.DomUtil.element({
    tagName: 'button',
    parent: parent,
    className: `icon icon-${size} ${className}`,
    title: title || '',
  })
}

L.DomUtil.createTitle = (parent, text, className, tag = 'h3') => {
  const title = L.DomUtil.create(tag, '', parent)
  L.DomUtil.createIcon(title, className)
  L.DomUtil.add('span', '', title, text)
  return title
}

L.DomUtil.createCopiableInput = (parent, label, value) => {
  const wrapper = L.DomUtil.add('div', 'copiable-input', parent)
  const labelEl = L.DomUtil.add('label', '', wrapper, label)
  const input = L.DomUtil.add('input', '', labelEl)
  input.type = 'text'
  input.readOnly = true
  input.value = value
  const button = L.DomUtil.createButton(
    '',
    wrapper,
    '',
    () => L.Util.copyToClipboard(input.value),
    this
  )
  button.title = L._('copy')
  return input
}

L.DomUtil.classIf = (el, className, bool) => {
  if (bool) L.DomUtil.addClass(el, className)
  else L.DomUtil.removeClass(el, className)
}

L.DomUtil.element = ({ tagName, parent, ...attrs }) => {
  const el = document.createElement(tagName)
  if (attrs.innerHTML) {
    attrs.innerHTML = U.Utils.escapeHTML(attrs.innerHTML)
  } else if (attrs.safeHTML) {
    attrs.innerHTML = attrs.safeHTML
  }
  for (const attr in attrs) {
    el[attr] = attrs[attr]
  }
  if (typeof parent !== 'undefined') {
    parent.appendChild(el)
  }
  return el
}

L.DomUtil.before = (target, el) => {
  target.parentNode.insertBefore(el, target)
  return el
}

L.DomUtil.after = (target, el) => {
  target.parentNode.insertBefore(el, target.nextSibling)
  return el
}

// From https://gist.github.com/Accudio/b9cb16e0e3df858cef0d31e38f1fe46f
// convert colour in range 0-255 to the modifier used within luminance calculation
L.DomUtil.colourMod = (colour) => {
  const sRGB = colour / 255
  let mod = Math.pow((sRGB + 0.055) / 1.055, 2.4)
  if (sRGB < 0.03928) mod = sRGB / 12.92
  return mod
}
L.DomUtil.RGBRegex = /rgb *\( *([0-9]{1,3}) *, *([0-9]{1,3}) *, *([0-9]{1,3}) *\)/
L.DomUtil.TextColorFromBackgroundColor = (el, bgcolor) => {
  return L.DomUtil.contrastedColor(el, bgcolor) ? '#ffffff' : '#000000'
}
L.DomUtil.contrastWCAG21 = (rgb) => {
  const [r, g, b] = rgb
  // luminance of inputted colour
  const lum =
    0.2126 * L.DomUtil.colourMod(r) +
    0.7152 * L.DomUtil.colourMod(g) +
    0.0722 * L.DomUtil.colourMod(b)
  // white has a luminance of 1
  const whiteLum = 1
  const contrast = (whiteLum + 0.05) / (lum + 0.05)
  return contrast > 3 ? 1 : 0
}

const _CACHE_CONSTRAST = {}
L.DomUtil.contrastedColor = (el, bgcolor) => {
  // Return 0 for black and 1 for white
  // bgcolor is a human color, it can be a any keyword (purple…)
  if (typeof _CACHE_CONSTRAST[bgcolor] !== 'undefined') return _CACHE_CONSTRAST[bgcolor]
  let out = 0
  let rgb = window.getComputedStyle(el).getPropertyValue('background-color')
  rgb = L.DomUtil.RGBRegex.exec(rgb)
  if (!rgb || rgb.length !== 4) return out
  rgb = [parseInt(rgb[1], 10), parseInt(rgb[2], 10), parseInt(rgb[3], 10)]
  out = L.DomUtil.contrastWCAG21(rgb)
  if (bgcolor) _CACHE_CONSTRAST[bgcolor] = out
  return out
}
L.DomEvent.once = (el, types, fn, context) => {
  // cf https://github.com/Leaflet/Leaflet/pull/3528#issuecomment-134551575

  if (typeof types === 'object') {
    for (const type in types) {
      L.DomEvent.once(el, type, types[type], fn)
    }
    return L.DomEvent
  }

  const handler = L.bind(() => {
    L.DomEvent.off(el, types, fn, context).off(el, types, handler, context)
  }, L.DomEvent)

  // add a listener that's executed once and removed after that
  return L.DomEvent.on(el, types, fn, context).on(el, types, handler, context)
}

/*
 * Global events
 */
U.Keys = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  TAB: 9,
  ENTER: 13,
  ESC: 27,
  APPLE: 91,
  SHIFT: 16,
  ALT: 17,
  CTRL: 18,
  E: 69,
  F: 70,
  H: 72,
  I: 73,
  L: 76,
  M: 77,
  O: 79,
  P: 80,
  S: 83,
  Z: 90,
}

U.Help = L.Class.extend({
  SHORTCUTS: {
    DRAW_MARKER: {
      shortcut: 'Modifier+M',
      label: L._('Draw a marker'),
    },
    DRAW_LINE: {
      shortcut: 'Modifier+L',
      label: L._('Draw a polyline'),
    },
    DRAW_POLYGON: {
      shortcut: 'Modifier+P',
      label: L._('Draw a polygon'),
    },
    TOGGLE_EDIT: {
      shortcut: 'Modifier+E',
      label: L._('Toggle edit mode'),
    },
    STOP_EDIT: {
      shortcut: 'Modifier+E',
      label: L._('Stop editing'),
    },
    SAVE_MAP: {
      shortcut: 'Modifier+S',
      label: L._('Save map'),
    },
    IMPORT_PANEL: {
      shortcut: 'Modifier+I',
      label: L._('Import data'),
    },
    SEARCH: {
      shortcut: 'Modifier+F',
      label: L._('Search location'),
    },
    CANCEL: {
      shortcut: 'Modifier+Z',
      label: L._('Cancel edits'),
    },
    PREVIEW: {
      shortcut: 'Modifier+E',
      label: L._('Back to preview'),
    },
    SAVE: {
      shortcut: 'Modifier+S',
      label: L._('Save current edits'),
    },
    EDIT_FEATURE_LAYER: {
      shortcut: 'Modifier+⇧+Click',
      label: L._("Edit feature's layer"),
    },
    CONTINUE_LINE: {
      shortcut: 'Modifier+Click',
      label: L._('Continue line'),
    },
  },

  displayLabel: function (action, withKbdTag = true) {
    let { shortcut, label } = this.SHORTCUTS[action]
    const modifier = this.isMacOS ? 'Cmd' : 'Ctrl'
    shortcut = shortcut.replace('Modifier', modifier)
    if (withKbdTag) {
      shortcut = shortcut
        .split('+')
        .map((el) => `<kbd>${el}</kbd>`)
        .join('+')
      label += ` ${shortcut}`
    } else {
      label += ` (${shortcut})`
    }
    return label
  },

  initialize: function (map) {
    this.map = map
    this.box = L.DomUtil.create(
      'div',
      'umap-help-box with-transition dark',
      document.body
    )
    const closeButton = L.DomUtil.createButton(
      'umap-close-link',
      this.box,
      '',
      this.hide,
      this
    )
    L.DomUtil.add('i', 'umap-close-icon', closeButton)
    const label = L.DomUtil.create('span', '', closeButton)
    label.title = label.textContent = L._('Close')
    this.content = L.DomUtil.create('div', 'umap-help-content', this.box)
    this.isMacOS = /mac/i.test(
      // eslint-disable-next-line compat/compat -- Fallback available.
      navigator.userAgentData ? navigator.userAgentData.platform : navigator.platform
    )
  },

  onKeyDown: function (e) {
    const key = e.keyCode,
      ESC = 27
    if (key === ESC) {
      this.hide()
    }
  },

  show: function () {
    this.content.innerHTML = ''
    for (let i = 0, name; i < arguments.length; i++) {
      name = arguments[i]
      L.DomUtil.add('div', 'umap-help-entry', this.content, this.resolve(name))
    }
    L.DomUtil.addClass(document.body, 'umap-help-on')
  },

  hide: function () {
    L.DomUtil.removeClass(document.body, 'umap-help-on')
  },

  visible: function () {
    return L.DomUtil.hasClass(document.body, 'umap-help-on')
  },

  resolve: function (name) {
    return typeof this[name] === 'function' ? this[name]() : this[name]
  },

  button: function (container, entries, classname) {
    const helpButton = L.DomUtil.createButton(
      classname || 'umap-help-button',
      container,
      L._('Help')
    )
    if (entries) {
      L.DomEvent.on(helpButton, 'click', L.DomEvent.stop).on(
        helpButton,
        'click',
        function (e) {
          const args = typeof entries === 'string' ? [entries] : entries
          this.show.apply(this, args)
        },
        this
      )
    }
    return helpButton
  },

  link: function (container, entries) {
    const helpButton = this.button(container, entries, 'umap-help-link')
    helpButton.textContent = L._('Help')
    return helpButton
  },

  edit: function () {
    const container = L.DomUtil.create('div', ''),
      self = this,
      title = L.DomUtil.create('h3', '', container),
      actionsContainer = L.DomUtil.create('ul', 'umap-edit-actions', container)
    const addAction = (action) => {
      const actionContainer = L.DomUtil.add('li', '', actionsContainer)
      L.DomUtil.add('i', action.options.className, actionContainer),
        L.DomUtil.add('span', '', actionContainer, action.options.tooltip)
      L.DomEvent.on(actionContainer, 'click', action.addHooks, action)
      L.DomEvent.on(actionContainer, 'click', self.hide, self)
    }
    title.textContent = L._('Where do we go from here?')
    for (const id in this.map.helpMenuActions) {
      addAction(this.map.helpMenuActions[id])
    }
    return container
  },

  importFormats: function () {
    const container = L.DomUtil.create('div')
    L.DomUtil.add('h3', '', container, 'GeojSON')
    L.DomUtil.add('p', '', container, L._('All properties are imported.'))
    L.DomUtil.add('h3', '', container, 'GPX')
    L.DomUtil.add('p', '', container, `${L._('Properties imported:')}name, desc`)
    L.DomUtil.add('h3', '', container, 'KML')
    L.DomUtil.add('p', '', container, `${L._('Properties imported:')}name, description`)
    L.DomUtil.add('h3', '', container, 'CSV')
    L.DomUtil.add(
      'p',
      '',
      container,
      L._(
        'Comma, tab or semi-colon separated values. SRS WGS84 is implied. Only Point geometries are imported. The import will look at the column headers for any mention of «lat» and «lon» at the begining of the header, case insensitive. All other column are imported as properties.'
      )
    )
    L.DomUtil.add('h3', '', container, 'uMap')
    L.DomUtil.add(
      'p',
      '',
      container,
      L._('Imports all umap data, including layers and settings.')
    )
    return container
  },

  textFormatting: function () {
    const container = L.DomUtil.create('div'),
      title = L.DomUtil.add('h3', '', container, L._('Text formatting')),
      elements = L.DomUtil.create('ul', '', container)
    L.DomUtil.add('li', '', elements, L._('*single star for italic*'))
    L.DomUtil.add('li', '', elements, L._('**double star for bold**'))
    L.DomUtil.add('li', '', elements, L._('# one hash for main heading'))
    L.DomUtil.add('li', '', elements, L._('## two hashes for second heading'))
    L.DomUtil.add('li', '', elements, L._('### three hashes for third heading'))
    L.DomUtil.add('li', '', elements, L._('Simple link: [[http://example.com]]'))
    L.DomUtil.add(
      'li',
      '',
      elements,
      L._('Link with text: [[http://example.com|text of the link]]')
    )
    L.DomUtil.add('li', '', elements, L._('Image: {{http://image.url.com}}'))
    L.DomUtil.add(
      'li',
      '',
      elements,
      L._('Image with custom width (in px): {{http://image.url.com|width}}')
    )
    L.DomUtil.add('li', '', elements, L._('Iframe: {{{http://iframe.url.com}}}'))
    L.DomUtil.add(
      'li',
      '',
      elements,
      L._('Iframe with custom height (in px): {{{http://iframe.url.com|height}}}')
    )
    L.DomUtil.add(
      'li',
      '',
      elements,
      L._(
        'Iframe with custom height and width (in px): {{{http://iframe.url.com|height*width}}}'
      )
    )
    L.DomUtil.add('li', '', elements, L._('--- for a horizontal rule'))
    return container
  },

  dynamicProperties: function () {
    const container = L.DomUtil.create('div')
    L.DomUtil.add('h3', '', container, L._('Dynamic properties'))
    L.DomUtil.add(
      'p',
      '',
      container,
      L._(
        'Use placeholders with feature properties between brackets, eg. &#123;name&#125;, they will be dynamically replaced by the corresponding values.'
      )
    )
    return container
  },

  formatURL: `${L._(
    'Supported variables that will be dynamically replaced'
  )}: {bbox}, {lat}, {lng}, {zoom}, {east}, {north}..., {left}, {top}..., locale, lang`,
  colorValue: L._('Must be a valid CSS value (eg.: DarkBlue or #123456)'),
  smoothFactor: L._(
    'How much to simplify the polyline on each zoom level (more = better performance and smoother look, less = more accurate)'
  ),
  dashArray: L._(
    'A comma separated list of numbers that defines the stroke dash pattern. Ex.: "5, 10, 15".'
  ),
  zoomTo: L._('Zoom level for automatic zooms'),
  labelKey: L._(
    'The name of the property to use as feature label (eg.: "nom"). You can also use properties inside brackets to use more than one or mix with static content (eg.: "&lcub;name&rcub; in &lcub;place&rcub;")'
  ),
  stroke: L._('Whether to display or not polygons paths.'),
  fill: L._('Whether to fill polygons with color.'),
  fillColor: L._('Optional. Same as color if not set.'),
  shortCredit: L._('Will be displayed in the bottom right corner of the map'),
  longCredit: L._('Will be visible in the caption of the map'),
  permanentCredit: L._(
    'Will be permanently visible in the bottom left corner of the map'
  ),
  sortKey: L._(
    'Comma separated list of properties to use for sorting features. To reverse the sort, put a minus sign (-) before. Eg. mykey,-otherkey.'
  ),
  slugKey: L._('The name of the property to use as feature unique identifier.'),
  filterKey: L._('Comma separated list of properties to use when filtering features by text input'),
  facetKey: L._(
    'Comma separated list of properties to use for filters (eg.: mykey,otherkey). To control label, add it after a | (eg.: mykey|My Key,otherkey|Other Key). To control input field type, add it after another | (eg.: mykey|My Key|checkbox,otherkey|Other Key|datetime). Allowed values for the input field type are checkbox (default), radio, number, date and datetime.'
  ),
  interactive: L._(
    'If false, the polygon or line will act as a part of the underlying map.'
  ),
  outlink: L._('Define link to open in a new window on polygon click.'),
  dynamicRemoteData: L._('Fetch data each time map view changes.'),
  proxyRemoteData: L._("To use if remote server doesn't allow cross domain (slower)"),
  browsable: L._(
    'Set it to false to hide this layer from the slideshow, the data browser, the popup navigation…'
  ),
})

L.LatLng.prototype.isValid = function () {
  return (
    isFinite(this.lat) &&
    Math.abs(this.lat) <= 90 &&
    isFinite(this.lng) &&
    Math.abs(this.lng) <= 180
  )
}
