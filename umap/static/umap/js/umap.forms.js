U.COLORS = [
  'Black',
  'Navy',
  'DarkBlue',
  'MediumBlue',
  'Blue',
  'DarkGreen',
  'Green',
  'Teal',
  'DarkCyan',
  'DeepSkyBlue',
  'DarkTurquoise',
  'MediumSpringGreen',
  'Lime',
  'SpringGreen',
  'Aqua',
  'Cyan',
  'MidnightBlue',
  'DodgerBlue',
  'LightSeaGreen',
  'ForestGreen',
  'SeaGreen',
  'DarkSlateGray',
  'DarkSlateGrey',
  'LimeGreen',
  'MediumSeaGreen',
  'Turquoise',
  'RoyalBlue',
  'SteelBlue',
  'DarkSlateBlue',
  'MediumTurquoise',
  'Indigo',
  'DarkOliveGreen',
  'CadetBlue',
  'CornflowerBlue',
  'MediumAquaMarine',
  'DimGray',
  'DimGrey',
  'SlateBlue',
  'OliveDrab',
  'SlateGray',
  'SlateGrey',
  'LightSlateGray',
  'LightSlateGrey',
  'MediumSlateBlue',
  'LawnGreen',
  'Chartreuse',
  'Aquamarine',
  'Maroon',
  'Purple',
  'Olive',
  'Gray',
  'Grey',
  'SkyBlue',
  'LightSkyBlue',
  'BlueViolet',
  'DarkRed',
  'DarkMagenta',
  'SaddleBrown',
  'DarkSeaGreen',
  'LightGreen',
  'MediumPurple',
  'DarkViolet',
  'PaleGreen',
  'DarkOrchid',
  'YellowGreen',
  'Sienna',
  'Brown',
  'DarkGray',
  'DarkGrey',
  'LightBlue',
  'GreenYellow',
  'PaleTurquoise',
  'LightSteelBlue',
  'PowderBlue',
  'FireBrick',
  'DarkGoldenRod',
  'MediumOrchid',
  'RosyBrown',
  'DarkKhaki',
  'Silver',
  'MediumVioletRed',
  'IndianRed',
  'Peru',
  'Chocolate',
  'Tan',
  'LightGray',
  'LightGrey',
  'Thistle',
  'Orchid',
  'GoldenRod',
  'PaleVioletRed',
  'Crimson',
  'Gainsboro',
  'Plum',
  'BurlyWood',
  'LightCyan',
  'Lavender',
  'DarkSalmon',
  'Violet',
  'PaleGoldenRod',
  'LightCoral',
  'Khaki',
  'AliceBlue',
  'HoneyDew',
  'Azure',
  'SandyBrown',
  'Wheat',
  'Beige',
  'WhiteSmoke',
  'MintCream',
  'GhostWhite',
  'Salmon',
  'AntiqueWhite',
  'Linen',
  'LightGoldenRodYellow',
  'OldLace',
  'Red',
  'Fuchsia',
  'Magenta',
  'DeepPink',
  'OrangeRed',
  'Tomato',
  'HotPink',
  'Coral',
  'DarkOrange',
  'LightSalmon',
  'Orange',
  'LightPink',
  'Pink',
  'Gold',
  'PeachPuff',
  'NavajoWhite',
  'Moccasin',
  'Bisque',
  'MistyRose',
  'BlanchedAlmond',
  'PapayaWhip',
  'LavenderBlush',
  'SeaShell',
  'Cornsilk',
  'LemonChiffon',
  'FloralWhite',
  'Snow',
  'Yellow',
  'LightYellow',
  'Ivory',
  'White',
]

L.FormBuilder.Element.include({
  undefine: function () {
    L.DomUtil.addClass(this.wrapper, 'undefined')
    this.clear()
    this.sync()
  },

  getParentNode: function () {
    if (this.options.wrapper) {
      return L.DomUtil.create(
        this.options.wrapper,
        this.options.wrapperClass || '',
        this.form
      )
    }
    let className = 'formbox'
    if (this.options.inheritable) {
      className +=
        this.get(true) === undefined ? ' inheritable undefined' : ' inheritable '
    }
    className += ` umap-field-${this.name}`
    this.wrapper = L.DomUtil.create('div', className, this.form)
    this.header = L.DomUtil.create('div', 'header', this.wrapper)
    if (this.options.inheritable) {
      const undefine = L.DomUtil.add('a', 'button undefine', this.header, L._('clear'))
      const define = L.DomUtil.add('a', 'button define', this.header, L._('define'))
      L.DomEvent.on(
        define,
        'click',
        function (e) {
          L.DomEvent.stop(e)
          this.fetch()
          this.fire('define')
          L.DomUtil.removeClass(this.wrapper, 'undefined')
        },
        this
      )
      L.DomEvent.on(undefine, 'click', L.DomEvent.stop).on(
        undefine,
        'click',
        this.undefine,
        this
      )
    }
    this.quickContainer = L.DomUtil.create(
      'span',
      'quick-actions show-on-defined',
      this.header
    )
    this.extendedContainer = L.DomUtil.create('div', 'show-on-defined', this.wrapper)
    return this.extendedContainer
  },

  getLabelParent: function () {
    return this.header
  },

  clear: function () {
    this.input.value = ''
  },

  get: function (own) {
    if (!this.options.inheritable || own) return this.builder.getter(this.field)
    const path = this.field.split('.')
    const key = path[path.length - 1]
    return this.obj.getOption(key)
  },

  buildLabel: function () {
    if (this.options.label) {
      this.label = L.DomUtil.create('label', '', this.getLabelParent())
      this.label.textContent = this.label.title = this.options.label
      if (this.options.helpEntries) {
        this.builder.map.help.button(this.label, this.options.helpEntries)
      } else if (this.options.helpTooltip) {
        const info = L.DomUtil.create('i', 'info', this.label)
        L.DomEvent.on(
          info,
          'mouseover',
          function () {
            this.builder.map.tooltip.open({
              anchor: info,
              content: this.options.helpTooltip,
              position: 'top',
            })
          },
          this
        )
      }
    }
  },
})

L.FormBuilder.Select.include({
  clear: function () {
    this.select.value = ''
  },

  getDefault: function () {
    if (this.options.inheritable) return undefined
    return this.getOptions()[0][0]
  },
})

L.FormBuilder.CheckBox.include({
  value: function () {
    return L.DomUtil.hasClass(this.wrapper, 'undefined')
      ? undefined
      : this.input.checked
  },

  clear: function () {
    this.fetch()
  },
})

L.FormBuilder.ColorPicker = L.FormBuilder.Input.extend({
  colors: U.COLORS,
  getParentNode: function () {
    L.FormBuilder.CheckBox.prototype.getParentNode.call(this)
    return this.quickContainer
  },

  build: function () {
    L.FormBuilder.Input.prototype.build.call(this)
    this.input.placeholder = this.options.placeholder || L._('Inherit')
    this.container = L.DomUtil.create(
      'div',
      'umap-color-picker',
      this.extendedContainer
    )
    this.container.style.display = 'none'
    for (const idx in this.colors) {
      this.addColor(this.colors[idx])
    }
    this.spreadColor()
    this.input.autocomplete = 'off'
    L.DomEvent.on(this.input, 'focus', this.onFocus, this)
    L.DomEvent.on(this.input, 'blur', this.onBlur, this)
    L.DomEvent.on(this.input, 'change', this.sync, this)
    this.on('define', this.onFocus)
  },

  onFocus: function () {
    this.container.style.display = 'block'
    this.spreadColor()
  },

  onBlur: function () {
    const closePicker = () => {
      this.container.style.display = 'none'
    }
    // We must leave time for the click to be listened.
    window.setTimeout(closePicker, 100)
  },

  sync: function () {
    this.spreadColor()
    L.FormBuilder.Input.prototype.sync.call(this)
  },

  spreadColor: function () {
    if (this.input.value) this.input.style.backgroundColor = this.input.value
    else this.input.style.backgroundColor = 'inherit'
  },

  addColor: function (colorName) {
    const span = L.DomUtil.create('span', '', this.container)
    span.style.backgroundColor = span.title = colorName
    const updateColorInput = function () {
      this.input.value = colorName
      this.sync()
      this.container.style.display = 'none'
    }
    L.DomEvent.on(span, 'mousedown', updateColorInput, this)
  },
})

L.FormBuilder.TextColorPicker = L.FormBuilder.ColorPicker.extend({
  colors: [
    'Black',
    'DarkSlateGrey',
    'DimGrey',
    'SlateGrey',
    'LightSlateGrey',
    'Grey',
    'DarkGrey',
    'LightGrey',
    'White',
  ],
})

L.FormBuilder.LayerTypeChooser = L.FormBuilder.Select.extend({
  getOptions: () => {
    return U.LAYER_TYPES.map((class_) => [class_.TYPE, class_.NAME])
  },
})

L.FormBuilder.SlideshowDelay = L.FormBuilder.IntSelect.extend({
  getOptions: () => {
    const options = []
    for (let i = 1; i < 30; i++) {
      options.push([i * 1000, L._('{delay} seconds', { delay: i })])
    }
    return options
  },
})

L.FormBuilder.DataLayerSwitcher = L.FormBuilder.Select.extend({
  getOptions: function () {
    const options = []
    this.builder.map.eachDataLayerReverse((datalayer) => {
      if (
        datalayer.isLoaded() &&
        !datalayer.isDataReadOnly() &&
        datalayer.isBrowsable()
      ) {
        options.push([L.stamp(datalayer), datalayer.getName()])
      }
    })
    return options
  },

  toHTML: function () {
    return L.stamp(this.obj.datalayer)
  },

  toJS: function () {
    return this.builder.map.datalayers[this.value()]
  },

  set: function () {
    this.builder.map.lastUsedDataLayer = this.toJS()
    this.obj.changeDataLayer(this.toJS())
  },
})

L.FormBuilder.DataFormat = L.FormBuilder.Select.extend({
  selectOptions: [
    [undefined, L._('Choose the data format')],
    ['geojson', 'geojson'],
    ['osm', 'osm'],
    ['csv', 'csv'],
    ['gpx', 'gpx'],
    ['kml', 'kml'],
    ['georss', 'georss'],
  ],
})

L.FormBuilder.LicenceChooser = L.FormBuilder.Select.extend({
  getOptions: function () {
    const licences = []
    const licencesList = this.builder.obj.options.licences
    let licence
    for (const i in licencesList) {
      licence = licencesList[i]
      licences.push([i, licence.name])
    }
    return licences
  },

  toHTML: function () {
    return this.get().name
  },

  toJS: function () {
    return this.builder.obj.options.licences[this.value()]
  },
})

L.FormBuilder.NullableBoolean = L.FormBuilder.Select.extend({
  selectOptions: [
    [undefined, L._('inherit')],
    [true, L._('yes')],
    [false, L._('no')],
  ],

  toJS: function () {
    let value = this.value()
    switch (value) {
      case 'true':
      case true:
        value = true
        break
      case 'false':
      case false:
        value = false
        break
      default:
        value = undefined
    }
    return value
  },
})

L.FormBuilder.BlurInput.include({
  build: function () {
    this.options.className = 'blur'
    L.FormBuilder.Input.prototype.build.call(this)
    const button = L.DomUtil.create('span', 'button blur-button')
    L.DomUtil.after(this.input, button)
    L.DomEvent.on(this.input, 'focus', this.fetch, this)
  },
})

L.FormBuilder.IconUrl = L.FormBuilder.BlurInput.extend({
  type: () => 'hidden',

  build: function () {
    L.FormBuilder.BlurInput.prototype.build.call(this)
    this.buttons = L.DomUtil.create('div', '', this.parentNode)
    this.tabs = L.DomUtil.create('div', 'flat-tabs', this.parentNode)
    this.body = L.DomUtil.create('div', 'umap-pictogram-body', this.parentNode)
    this.footer = L.DomUtil.create('div', '', this.parentNode)
    this.updatePreview()
    this.on('define', this.onDefine)
  },

  onDefine: async function () {
    this.buttons.innerHTML = ''
    this.footer.innerHTML = ''
    const [{ pictogram_list }, response, error] = await this.builder.map.server.get(
      this.builder.map.options.urls.pictogram_list_json
    )
    if (!error) this.pictogram_list = pictogram_list
    this.buildTabs()
    const value = this.value()
    if (U.Icon.RECENT.length) this.showRecentTab()
    else if (!value || U.Utils.isPath(value)) this.showSymbolsTab()
    else if (U.Utils.isRemoteUrl(value) || U.Utils.isDataImage(value)) this.showURLTab()
    else this.showCharsTab()
    const closeButton = L.DomUtil.createButton(
      'button action-button',
      this.footer,
      L._('Close'),
      function (e) {
        this.body.innerHTML = ''
        this.tabs.innerHTML = ''
        this.footer.innerHTML = ''
        if (this.isDefault()) this.undefine(e)
        else this.updatePreview()
      },
      this
    )
  },

  buildTabs: function () {
    this.tabs.innerHTML = ''
    if (U.Icon.RECENT.length) {
      const recent = L.DomUtil.add(
        'button',
        'flat tab-recent',
        this.tabs,
        L._('Recent')
      )
      L.DomEvent.on(recent, 'click', L.DomEvent.stop).on(
        recent,
        'click',
        this.showRecentTab,
        this
      )
    }
    const symbol = L.DomUtil.add('button', 'flat tab-symbols', this.tabs, L._('Symbol'))
    const char = L.DomUtil.add(
      'button',
      'flat tab-chars',
      this.tabs,
      L._('Emoji & Character')
    )
    url = L.DomUtil.add('button', 'flat tab-url', this.tabs, L._('URL'))
    L.DomEvent.on(symbol, 'click', L.DomEvent.stop).on(
      symbol,
      'click',
      this.showSymbolsTab,
      this
    )
    L.DomEvent.on(char, 'click', L.DomEvent.stop).on(
      char,
      'click',
      this.showCharsTab,
      this
    )
    L.DomEvent.on(url, 'click', L.DomEvent.stop).on(url, 'click', this.showURLTab, this)
  },

  openTab: function (name) {
    const els = this.tabs.querySelectorAll('button')
    for (const el of els) {
      L.DomUtil.removeClass(el, 'on')
    }
    const el = this.tabs.querySelector(`.tab-${name}`)
    L.DomUtil.addClass(el, 'on')
    this.body.innerHTML = ''
  },

  updatePreview: function () {
    this.buttons.innerHTML = ''
    if (this.isDefault()) return
    if (!U.Utils.hasVar(this.value())) {
      // Do not try to render URL with variables
      const box = L.DomUtil.create('div', 'umap-pictogram-choice', this.buttons)
      L.DomEvent.on(box, 'click', this.onDefine, this)
      const icon = U.Icon.makeElement(this.value(), box)
    }
    this.button = L.DomUtil.createButton(
      'button action-button',
      this.buttons,
      this.value() ? L._('Change') : L._('Add'),
      this.onDefine,
      this
    )
  },

  addIconPreview: function (pictogram, parent) {
    const baseClass = 'umap-pictogram-choice'
    const value = pictogram.src
    const search = U.Utils.normalize(this.searchInput.value)
    const title = pictogram.attribution
      ? `${pictogram.name} — © ${pictogram.attribution}`
      : pictogram.name || pictogram.src
    if (search && U.Utils.normalize(title).indexOf(search) === -1) return
    const className = value === this.value() ? `${baseClass} selected` : baseClass
    const container = L.DomUtil.create('div', className, parent)
    U.Icon.makeElement(value, container)
    container.title = title
    L.DomEvent.on(
      container,
      'click',
      function (e) {
        this.input.value = value
        this.sync()
        this.unselectAll(this.grid)
        L.DomUtil.addClass(container, 'selected')
      },
      this
    )
    return true // Icon has been added (not filtered)
  },

  clear: function () {
    this.input.value = ''
    this.unselectAll(this.body)
    this.sync()
    this.body.innerHTML = ''
    this.updatePreview()
  },

  addCategory: function (items, name) {
    const parent = L.DomUtil.create('div', 'umap-pictogram-category')
    if (name) L.DomUtil.add('h6', '', parent, name)
    const grid = L.DomUtil.create('div', 'umap-pictogram-grid', parent)
    let status = false
    for (const item of items) {
      status = this.addIconPreview(item, grid) || status
    }
    if (status) this.grid.appendChild(parent)
  },

  buildSymbolsList: function () {
    this.grid.innerHTML = ''
    const categories = {}
    let category
    for (const props of this.pictogram_list) {
      category = props.category || L._('Generic')
      categories[category] = categories[category] || []
      categories[category].push(props)
    }
    const sorted = Object.entries(categories).toSorted(([a], [b]) =>
      U.Utils.naturalSort(a, b, L.lang)
    )
    for (const [name, items] of sorted) {
      this.addCategory(items, name)
    }
  },

  buildRecentList: function () {
    this.grid.innerHTML = ''
    const items = U.Icon.RECENT.map((src) => ({
      src,
    }))
    this.addCategory(items)
  },

  isDefault: function () {
    return !this.value() || this.value() === U.SCHEMA.iconUrl.default
  },

  addGrid: function (onSearch) {
    this.searchInput = L.DomUtil.create('input', '', this.body)
    this.searchInput.type = 'search'
    this.searchInput.placeholder = L._('Search')
    this.grid = L.DomUtil.create('div', '', this.body)
    L.DomEvent.on(this.searchInput, 'input', onSearch, this)
  },

  showRecentTab: function () {
    if (!U.Icon.RECENT.length) return
    this.openTab('recent')
    this.addGrid(this.buildRecentList)
    this.buildRecentList()
  },

  showSymbolsTab: function () {
    this.openTab('symbols')
    this.addGrid(this.buildSymbolsList)
    this.buildSymbolsList()
  },

  showCharsTab: function () {
    this.openTab('chars')
    const value = !U.Icon.isImg(this.value()) ? this.value() : null
    const input = this.buildInput(this.body, value)
    input.placeholder = L._('Type char or paste emoji')
    input.type = 'text'
  },

  showURLTab: function () {
    this.openTab('url')
    const value =
      U.Utils.isRemoteUrl(this.value()) || U.Utils.isDataImage(this.value())
        ? this.value()
        : null
    const input = this.buildInput(this.body, value)
    input.placeholder = L._('Add image URL')
    input.type = 'url'
  },

  buildInput: function (parent, value) {
    const input = L.DomUtil.create('input', 'blur', parent)
    const button = L.DomUtil.create('span', 'button blur-button', parent)
    if (value) input.value = value
    L.DomEvent.on(input, 'blur', () => {
      // Do not clear this.input when focus-blur
      // empty input
      if (input.value === value) return
      this.input.value = input.value
      this.sync()
    })
    return input
  },

  unselectAll: (container) => {
    const els = container.querySelectorAll('div.selected')
    for (const el in els) {
      if (els.hasOwnProperty(el)) L.DomUtil.removeClass(els[el], 'selected')
    }
  },
})

L.FormBuilder.Url = L.FormBuilder.Input.extend({
  type: () => 'url',
})

L.FormBuilder.Switch = L.FormBuilder.CheckBox.extend({
  getParentNode: function () {
    L.FormBuilder.CheckBox.prototype.getParentNode.call(this)
    if (this.options.inheritable) return this.quickContainer
    return this.extendedContainer
  },

  build: function () {
    L.FormBuilder.CheckBox.prototype.build.apply(this)
    if (this.options.inheritable)
      this.label = L.DomUtil.create('label', '', this.input.parentNode)
    else this.input.parentNode.appendChild(this.label)
    L.DomUtil.addClass(this.input.parentNode, 'with-switch')
    const id = `${this.builder.options.id || Date.now()}.${this.name}`
    this.label.setAttribute('for', id)
    L.DomUtil.addClass(this.input, 'switch')
    this.input.id = id
  },
})

L.FormBuilder.FacetSearchBase = L.FormBuilder.Element.extend({
  buildLabel: function () {
    this.label = L.DomUtil.element({
      tagName: 'legend',
      textContent: this.options.label,
    })
  },
})
L.FormBuilder.FacetSearchChoices = L.FormBuilder.FacetSearchBase.extend({
  build: function () {
    this.container = L.DomUtil.create('fieldset', 'umap-facet', this.parentNode)
    this.container.appendChild(this.label)
    this.ul = L.DomUtil.create('ul', '', this.container)
    this.type = this.options.criteria.type

    const choices = this.options.criteria.choices
    choices.sort()
    choices.forEach((value) => this.buildLi(value))
  },

  buildLi: function (value) {
    const property_li = L.DomUtil.create('li', '', this.ul)
    const label = L.DomUtil.create('label', '', property_li)
    const input = L.DomUtil.create('input', '', label)
    L.DomUtil.add('span', '', label, value)

    input.type = this.type
    input.name = `${this.type}_${this.name}`
    input.checked = this.get().choices.includes(value)
    input.dataset.value = value

    L.DomEvent.on(input, 'change', (e) => this.sync())
  },

  toJS: function () {
    return {
      type: this.type,
      choices: [...this.ul.querySelectorAll('input:checked')].map(
        (i) => i.dataset.value
      ),
    }
  },
})

L.FormBuilder.MinMaxBase = L.FormBuilder.FacetSearchBase.extend({
  getInputType: (type) => type,

  getLabels: () => [L._('Min'), L._('Max')],

  prepareForHTML: (value) => value.valueOf(),

  build: function () {
    this.container = L.DomUtil.create('fieldset', 'umap-facet', this.parentNode)
    this.container.appendChild(this.label)
    const { min, max, type } = this.options.criteria
    const { min: modifiedMin, max: modifiedMax } = this.get()

    const currentMin = modifiedMin !== undefined ? modifiedMin : min
    const currentMax = modifiedMax !== undefined ? modifiedMax : max
    this.type = type
    this.inputType = this.getInputType(this.type)

    const [minLabel, maxLabel] = this.getLabels()

    this.minLabel = L.DomUtil.create('label', '', this.container)
    this.minLabel.textContent = minLabel

    this.minInput = L.DomUtil.create('input', '', this.minLabel)
    this.minInput.type = this.inputType
    this.minInput.step = 'any'
    this.minInput.min = this.prepareForHTML(min)
    this.minInput.max = this.prepareForHTML(max)
    if (min != null) {
      // The value stored using setAttribute is not modified by
      // user input, and will be used as initial value when calling
      // form.reset(), and can also be retrieve later on by using
      // getAttributing, to compare with current value and know
      // if this value has been modified by the user
      // https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/reset
      this.minInput.setAttribute('value', this.prepareForHTML(min))
      this.minInput.value = this.prepareForHTML(currentMin)
    }

    this.maxLabel = L.DomUtil.create('label', '', this.container)
    this.maxLabel.textContent = maxLabel

    this.maxInput = L.DomUtil.create('input', '', this.maxLabel)
    this.maxInput.type = this.inputType
    this.maxInput.step = 'any'
    this.maxInput.min = this.prepareForHTML(min)
    this.maxInput.max = this.prepareForHTML(max)
    if (max != null) {
      // Cf comment above about setAttribute vs value
      this.maxInput.setAttribute('value', this.prepareForHTML(max))
      this.maxInput.value = this.prepareForHTML(currentMax)
    }
    this.toggleStatus()

    L.DomEvent.on(this.minInput, 'change', () => this.sync())
    L.DomEvent.on(this.maxInput, 'change', () => this.sync())
  },

  toggleStatus: function () {
    this.minInput.dataset.modified = this.isMinModified()
    this.maxInput.dataset.modified = this.isMaxModified()
  },

  sync: function () {
    L.FormBuilder.Element.prototype.sync.call(this)
    this.toggleStatus()
  },

  isMinModified: function () {
    const default_ = this.minInput.getAttribute('value')
    const current = this.minInput.value
    return current !== default_
  },

  isMaxModified: function () {
    const default_ = this.maxInput.getAttribute('value')
    const current = this.maxInput.value
    return current !== default_
  },

  toJS: function () {
    const opts = {
      type: this.type,
    }
    if (this.minInput.value !== '' && this.isMinModified()) {
      opts.min = this.prepareForJS(this.minInput.value)
    }
    if (this.maxInput.value !== '' && this.isMaxModified()) {
      opts.max = this.prepareForJS(this.maxInput.value)
    }
    return opts
  },
})

L.FormBuilder.FacetSearchNumber = L.FormBuilder.MinMaxBase.extend({
  prepareForJS: (value) => new Number(value),
})

L.FormBuilder.FacetSearchDate = L.FormBuilder.MinMaxBase.extend({
  prepareForJS: (value) => new Date(value),

  toLocaleDateTime: (dt) => new Date(dt.valueOf() - dt.getTimezoneOffset() * 60000),

  prepareForHTML: function (value) {
    // Value must be in local time
    if (Number.isNaN(value)) return
    return this.toLocaleDateTime(value).toISOString().substr(0, 10)
  },

  getLabels: () => [L._('From'), L._('Until')],
})

L.FormBuilder.FacetSearchDateTime = L.FormBuilder.FacetSearchDate.extend({
  getInputType: (type) => 'datetime-local',

  prepareForHTML: function (value) {
    // Value must be in local time
    if (Number.isNaN(value)) return
    return this.toLocaleDateTime(value).toISOString().slice(0, -1)
  },
})

L.FormBuilder.MultiChoice = L.FormBuilder.Element.extend({
  default: 'null',
  className: 'umap-multiplechoice',

  clear: function () {
    const checked = this.container.querySelector('input[type="radio"]:checked')
    if (checked) checked.checked = false
  },

  fetch: function () {
    this.initial = this.toHTML()
    let value = this.initial
    if (!this.container.querySelector(`input[type="radio"][value="${value}"]`)) {
      value = this.options.default !== undefined ? this.options.default : this.default
    }
    const choices = this.getChoices().map(([value, label]) => `${value}`)
    if (choices.includes(`${value}`)) {
      this.container.querySelector(`input[type="radio"][value="${value}"]`).checked =
        true
    }
  },

  value: function () {
    const checked = this.container.querySelector('input[type="radio"]:checked')
    if (checked) return checked.value
  },

  getChoices: function () {
    return this.options.choices || this.choices
  },

  build: function () {
    const choices = this.getChoices()
    this.container = L.DomUtil.create(
      'div',
      `${this.className} by${choices.length}`,
      this.parentNode
    )
    for (const [i, [value, label]] of choices.entries()) {
      this.addChoice(value, label, i)
    }
    this.fetch()
  },

  addChoice: function (value, label, counter) {
    const input = L.DomUtil.create('input', '', this.container)
    label = L.DomUtil.add('label', '', this.container, label)
    input.type = 'radio'
    input.name = this.name
    input.value = value
    const id = `${Date.now()}.${this.name}.${counter}`
    label.setAttribute('for', id)
    input.id = id
    L.DomEvent.on(input, 'change', this.sync, this)
  },
})

L.FormBuilder.TernaryChoices = L.FormBuilder.MultiChoice.extend({
  default: 'null',

  toJS: function () {
    let value = this.value()
    switch (value) {
      case 'true':
      case true:
        value = true
        break
      case 'false':
      case false:
        value = false
        break
      case 'null':
      case null:
        value = null
        break
      default:
        value = undefined
    }
    return value
  },
})

L.FormBuilder.NullableChoices = L.FormBuilder.TernaryChoices.extend({
  choices: [
    [true, L._('always')],
    [false, L._('never')],
    ['null', L._('hidden')],
  ],
})

L.FormBuilder.DataLayersControl = L.FormBuilder.TernaryChoices.extend({
  choices: [
    [true, L._('collapsed')],
    ['expanded', L._('expanded')],
    [false, L._('never')],
    ['null', L._('hidden')],
  ],

  toJS: function () {
    let value = this.value()
    if (value !== 'expanded')
      value = L.FormBuilder.TernaryChoices.prototype.toJS.call(this)
    return value
  },
})

L.FormBuilder.Range = L.FormBuilder.FloatInput.extend({
  type: () => 'range',

  value: function () {
    return L.DomUtil.hasClass(this.wrapper, 'undefined')
      ? undefined
      : L.FormBuilder.FloatInput.prototype.value.call(this)
  },

  buildHelpText: function () {
    let options = ''
    const step = this.options.step || 1
    const digits = step < 1 ? 1 : 0
    const id = `range-${this.options.label || this.name}`
    for (let i = this.options.min; i <= this.options.max; i += this.options.step) {
      options += `<option value="${i.toFixed(digits)}" label="${i.toFixed(
        digits
      )}"></option>`
    }
    const datalist = L.DomUtil.element({
      tagName: 'datalist',
      parent: this.getHelpTextParent(),
      className: 'umap-field-datalist',
      safeHTML: options,
      id: id,
    })
    this.input.setAttribute('list', id)
    L.FormBuilder.Input.prototype.buildHelpText.call(this)
  },
})

L.FormBuilder.ManageOwner = L.FormBuilder.Element.extend({
  build: function () {
    const options = {
      className: 'edit-owner',
      on_select: L.bind(this.onSelect, this),
      placeholder: L._("Type new owner's username"),
    }
    this.autocomplete = new U.AjaxAutocomplete(this.parentNode, options)
    const owner = this.toHTML()
    if (owner)
      this.autocomplete.displaySelected({
        item: { value: owner.id, label: owner.name },
      })
  },

  value: function () {
    return this._value
  },

  onSelect: function (choice) {
    this._value = {
      id: choice.item.value,
      name: choice.item.label,
      url: choice.item.url,
    }
    this.set()
  },
})

L.FormBuilder.ManageEditors = L.FormBuilder.Element.extend({
  build: function () {
    const options = {
      className: 'edit-editors',
      on_select: L.bind(this.onSelect, this),
      on_unselect: L.bind(this.onUnselect, this),
      placeholder: L._("Type editor's username"),
    }
    this.autocomplete = new U.AjaxAutocompleteMultiple(this.parentNode, options)
    this._values = this.toHTML()
    if (this._values)
      for (let i = 0; i < this._values.length; i++)
        this.autocomplete.displaySelected({
          item: { value: this._values[i].id, label: this._values[i].name },
        })
  },

  value: function () {
    return this._values
  },

  onSelect: function (choice) {
    this._values.push({
      id: choice.item.value,
      name: choice.item.label,
      url: choice.item.url,
    })
    this.set()
  },

  onUnselect: function (choice) {
    const index = this._values.findIndex((item) => item.id === choice.item.value)
    if (index !== -1) {
      this._values.splice(index, 1)
      this.set()
    }
  },
})

L.FormBuilder.ManageTeam = L.FormBuilder.IntSelect.extend({
  getOptions: function () {
    return [[null, L._('None')]].concat(
      this.options.teams.map((team) => [team.id, team.name])
    )
  },
  toHTML: function () {
    return this.get()?.id
  },
  toJS: function () {
    const value = this.value()
    for (const team of this.options.teams) {
      if (team.id === value) return team
    }
  },
})

U.FormBuilder = L.FormBuilder.extend({
  options: {
    className: 'umap-form',
  },

  customHandlers: {
    sortKey: 'BlurInput',
    easing: 'Switch',
    facetKey: 'BlurInput',
    slugKey: 'BlurInput',
  },

  computeDefaultOptions: function () {
    for (const [key, schema] of Object.entries(U.SCHEMA)) {
      if (schema.type === Boolean) {
        if (schema.nullable) schema.handler = 'NullableChoices'
        else schema.handler = 'Switch'
      } else if (schema.type === 'Text') {
        schema.handler = 'Textarea'
      } else if (schema.type === Number) {
        if (schema.step) schema.handler = 'Range'
        else schema.handler = 'IntInput'
      } else if (schema.choices) {
        const text_length = schema.choices.reduce(
          (acc, [_, label]) => acc + label.length,
          0
        )
        // Try to be smart and use MultiChoice only
        // for choices where labels are shorts…
        if (text_length < 40) {
          schema.handler = 'MultiChoice'
        } else {
          schema.handler = 'Select'
          schema.selectOptions = schema.choices
        }
      } else {
        switch (key) {
          case 'color':
          case 'fillColor':
            schema.handler = 'ColorPicker'
            break
          case 'iconUrl':
            schema.handler = 'IconUrl'
            break
          case 'licence':
            schema.handler = 'LicenceChooser'
            break
        }
      }
      if (this.customHandlers[key]) {
        schema.handler = this.customHandlers[key]
      }
      // FormBuilder use this key for the input type itself
      delete schema.type
      this.defaultOptions[key] = schema
    }
  },

  initialize: function (obj, fields, options) {
    this.map = obj.map || obj.getMap()
    this.computeDefaultOptions()
    L.FormBuilder.prototype.initialize.call(this, obj, fields, options)
    this.on('finish', this.finish)
  },

  setter: function (field, value) {
    L.FormBuilder.prototype.setter.call(this, field, value)
    this.obj.isDirty = true
    if ('render' in this.obj) {
      this.obj.render([field], this)
    }
    if ('sync' in this.obj) {
      this.obj.sync.update(field, value)
    }
  },

  finish: (event) => {
    event.helper?.input?.blur()
  },
})
