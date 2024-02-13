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
    const path = this.field.split('.'),
      key = path[path.length - 1]
    return this.obj.getOption(key)
  },

  buildLabel: function () {
    if (this.options.label) {
      this.label = L.DomUtil.create('label', '', this.getLabelParent())
      this.label.textContent = this.label.title = this.options.label
      if (this.options.helpEntries)
        this.builder.map.help.button(this.label, this.options.helpEntries)
      else if (this.options.helpTooltip) {
        const info = L.DomUtil.create('i', 'info', this.label)
        L.DomEvent.on(
          info,
          'mouseover',
          function () {
            this.builder.map.ui.tooltip({
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
  colors: [
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
  ],

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
    const self = this,
      closePicker = () => {
        self.container.style.display = 'none'
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

L.FormBuilder.IconClassSwitcher = L.FormBuilder.Select.extend({
  selectOptions: [
    ['Default', L._('Default')],
    ['Circle', L._('Circle')],
    ['Drop', L._('Drop')],
    ['Ball', L._('Ball')],
  ],
})

L.FormBuilder.ProxyTTLSelect = L.FormBuilder.Select.extend({
  selectOptions: [
    [undefined, L._('No cache')],
    ['300', L._('5 min')],
    ['3600', L._('1 hour')],
    ['86400', L._('1 day')],
  ],
})

L.FormBuilder.PopupShape = L.FormBuilder.Select.extend({
  selectOptions: [
    ['Default', L._('Popup')],
    ['Large', L._('Popup (large)')],
    ['Panel', L._('Side panel')],
  ],
})

L.FormBuilder.PopupContent = L.FormBuilder.Select.extend({
  selectOptions: [
    ['Default', L._('Default')],
    ['Table', L._('Table')],
    ['GeoRSSImage', L._('GeoRSS (title + image)')],
    ['GeoRSSLink', L._('GeoRSS (only link)')],
    ['OSM', L._('OpenStreetMap')],
  ],
})

L.FormBuilder.LayerTypeChooser = L.FormBuilder.Select.extend({
  getOptions: function () {
    const layer_classes = [
      U.Layer.Default,
      U.Layer.Cluster,
      U.Layer.Heat,
      U.Layer.Choropleth,
    ]
    return layer_classes.map((class_) => [class_.TYPE, class_.NAME])
  },
})

L.FormBuilder.SlideshowDelay = L.FormBuilder.IntSelect.extend({
  getOptions: function () {
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

L.FormBuilder.DefaultView = L.FormBuilder.Select.extend({
  selectOptions: [
    ['center', L._('Saved center and zoom')],
    ['data', L._('Fit all data')],
    ['latest', L._('Latest feature')],
    ['locate', L._('User location')],
  ],
})

L.FormBuilder.OnLoadPanel = L.FormBuilder.Select.extend({
  selectOptions: [
    ['none', L._('None')],
    ['caption', L._('Caption')],
    ['databrowser', L._('Data browser')],
    ['facet', L._('Facet search')],
  ],
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

L.FormBuilder.LabelDirection = L.FormBuilder.Select.extend({
  selectOptions: [
    ['auto', L._('Automatic')],
    ['left', L._('On the left')],
    ['right', L._('On the right')],
    ['top', L._('On the top')],
    ['bottom', L._('On the bottom')],
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
  },
})

L.FormBuilder.IconUrl = L.FormBuilder.BlurInput.extend({
  type: function () {
    return 'hidden'
  },

  build: function () {
    L.FormBuilder.BlurInput.prototype.build.call(this)
    this.buttons = L.DomUtil.create('div', '', this.parentNode)
    this.tabs = L.DomUtil.create('div', 'pictogram-tabs', this.parentNode)
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
    else if (!value || L.Util.isPath(value)) this.showSymbolsTab()
    else if (L.Util.isRemoteUrl(value) || L.Util.isDataImage(value)) this.showURLTab()
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
    const symbol = L.DomUtil.add(
        'button',
        'flat tab-symbols',
        this.tabs,
        L._('Symbol')
      ),
      char = L.DomUtil.add(
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
    for (let el of els) {
      L.DomUtil.removeClass(el, 'on')
    }
    let el = this.tabs.querySelector(`.tab-${name}`)
    L.DomUtil.addClass(el, 'on')
    this.body.innerHTML = ''
  },

  updatePreview: function () {
    this.buttons.innerHTML = ''
    if (this.isDefault()) return
    if (!L.Util.hasVar(this.value())) {
      // Do not try to render URL with variables
      const box = L.DomUtil.create('div', 'umap-pictogram-choice', this.buttons)
      L.DomEvent.on(box, 'click', this.onDefine, this)
      const icon = U.Icon.makeIconElement(this.value(), box)
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
    const baseClass = 'umap-pictogram-choice',
      value = pictogram.src,
      search = L.Util.normalize(this.searchInput.value),
      title = pictogram.attribution
        ? `${pictogram.name} — © ${pictogram.attribution}`
        : pictogram.name || pictogram.src
    if (search && L.Util.normalize(title).indexOf(search) === -1) return
    const className = value === this.value() ? `${baseClass} selected` : baseClass,
      container = L.DomUtil.create('div', className, parent)
    U.Icon.makeIconElement(value, container)
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
    const parent = L.DomUtil.create('div', 'umap-pictogram-category'),
      grid = L.DomUtil.create('div', 'umap-pictogram-grid', parent)
    if (name) L.DomUtil.add('h6', '', parent, name)
    let status = false
    for (let item of items) {
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
      L.Util.naturalSort(a, b)
    )
    for (let [name, items] of sorted) {
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
    return !this.value() || this.value() === U.DEFAULT_ICON_URL
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
      L.Util.isRemoteUrl(this.value()) || L.Util.isDataImage(this.value())
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

  unselectAll: function (container) {
    const els = container.querySelectorAll('div.selected')
    for (const el in els) {
      if (els.hasOwnProperty(el)) L.DomUtil.removeClass(els[el], 'selected')
    }
  },
})

L.FormBuilder.Url = L.FormBuilder.Input.extend({
  type: function () {
    return 'url'
  },
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

L.FormBuilder.FacetSearch = L.FormBuilder.Element.extend({
  build: function () {
    this.container = L.DomUtil.create('div', 'umap-facet', this.parentNode)
    this.ul = L.DomUtil.create('ul', '', this.container)
    const choices = this.options.choices
    choices.sort()
    choices.forEach((value) => this.buildLi(value))
  },

  buildLabel: function () {
    this.label = L.DomUtil.add('h5', '', this.parentNode, this.options.label)
  },

  buildLi: function (value) {
    const property_li = L.DomUtil.create('li', '', this.ul),
      input = L.DomUtil.create('input', '', property_li),
      label = L.DomUtil.create('label', '', property_li)
    input.type = 'checkbox'
    input.id = `checkbox_${this.name}_${value}`
    input.checked = this.get().includes(value)
    input.dataset.value = value
    label.htmlFor = `checkbox_${this.name}_${value}`
    label.innerHTML = value
    L.DomEvent.on(input, 'change', (e) => this.sync())
  },

  toJS: function () {
    return [...this.ul.querySelectorAll('input:checked')].map((i) => i.dataset.value)
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
    let value = (this.backup = this.toHTML())
    if (!this.container.querySelector(`input[type="radio"][value="${value}"]`))
      value =
        typeof this.options.default !== 'undefined'
          ? this.options.default
          : this.default
    this.container.querySelector(`input[type="radio"][value="${value}"]`).checked = true
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
    for (let i = 0; i < choices.length; i++) {
      this.addChoice(choices[i][0], choices[i][1], i)
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
      default:
        value = null
    }
    return value
  },
})

L.FormBuilder.ControlChoice = L.FormBuilder.TernaryChoices.extend({
  choices: [
    [true, L._('always')],
    [false, L._('never')],
    ['null', L._('hidden')],
  ],
})

L.FormBuilder.LabelChoice = L.FormBuilder.TernaryChoices.extend({
  default: false,

  choices: [
    [true, L._('always')],
    [false, L._('never')],
    ['null', L._('on hover')],
  ],
})

L.FormBuilder.DataLayersControl = L.FormBuilder.ControlChoice.extend({
  choices: [
    [true, L._('collapsed')],
    ['expanded', L._('expanded')],
    [false, L._('never')],
    ['null', L._('hidden')],
  ],

  toJS: function () {
    let value = this.value()
    if (value !== 'expanded')
      value = L.FormBuilder.ControlChoice.prototype.toJS.call(this)
    return value
  },
})

L.FormBuilder.OutlinkTarget = L.FormBuilder.MultiChoice.extend({
  default: 'blank',

  choices: [
    ['blank', L._('new window')],
    ['self', L._('iframe')],
    ['parent', L._('parent window')],
  ],
})

L.FormBuilder.Range = L.FormBuilder.FloatInput.extend({
  type: function () {
    return 'range'
  },

  value: function () {
    return L.DomUtil.hasClass(this.wrapper, 'undefined')
      ? undefined
      : L.FormBuilder.FloatInput.prototype.value.call(this)
  },

  buildHelpText: function () {
    const datalist = L.DomUtil.create(
      'datalist',
      'umap-field-datalist',
      this.getHelpTextParent()
    )
    datalist.id = `range-${this.options.label || this.name}`
    this.input.setAttribute('list', datalist.id)
    let options = ''
    const step = this.options.step || 1,
      digits = step < 1 ? 1 : 0
    for (let i = this.options.min; i <= this.options.max; i += this.options.step) {
      options += `<option value="${i.toFixed(digits)}" label="${i.toFixed(
        digits
      )}"></option>`
    }
    datalist.innerHTML = options
    L.FormBuilder.Input.prototype.buildHelpText.call(this)
  },
})

L.FormBuilder.ManageOwner = L.FormBuilder.Element.extend({
  build: function () {
    const options = {
      className: 'edit-owner',
      on_select: L.bind(this.onSelect, this),
    }
    this.autocomplete = new U.AutoComplete.Ajax.Select(this.parentNode, options)
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
    }
    this.autocomplete = new U.AutoComplete.Ajax.SelectMultiple(this.parentNode, options)
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

U.FormBuilder = L.FormBuilder.extend({
  options: {
    className: 'umap-form',
  },

  defaultOptions: {
    name: { label: L._('name') },
    description: {
      label: L._('description'),
      handler: 'Textarea',
      helpEntries: 'textFormatting',
    },
    color: {
      handler: 'ColorPicker',
      label: L._('color'),
      helpEntries: 'colorValue',
      inheritable: true,
    },
    iconOpacity: {
      handler: 'Range',
      min: 0.1,
      max: 1,
      step: 0.1,
      label: L._('icon opacity'),
      inheritable: true,
    },
    opacity: {
      handler: 'Range',
      min: 0.1,
      max: 1,
      step: 0.1,
      label: L._('opacity'),
      inheritable: true,
    },
    stroke: {
      handler: 'Switch',
      label: L._('stroke'),
      helpEntries: 'stroke',
      inheritable: true,
    },
    weight: {
      handler: 'Range',
      min: 1,
      max: 20,
      step: 1,
      label: L._('weight'),
      inheritable: true,
    },
    fill: {
      handler: 'Switch',
      label: L._('fill'),
      helpEntries: 'fill',
      inheritable: true,
    },
    fillColor: {
      handler: 'ColorPicker',
      label: L._('fill color'),
      helpEntries: 'fillColor',
      inheritable: true,
    },
    fillOpacity: {
      handler: 'Range',
      min: 0.1,
      max: 1,
      step: 0.1,
      label: L._('fill opacity'),
      inheritable: true,
    },
    smoothFactor: {
      handler: 'Range',
      min: 0,
      max: 10,
      step: 0.5,
      label: L._('Simplify'),
      helpEntries: 'smoothFactor',
      inheritable: true,
    },
    dashArray: {
      label: L._('dash array'),
      helpEntries: 'dashArray',
      inheritable: true,
    },
    iconClass: {
      handler: 'IconClassSwitcher',
      label: L._('Icon shape'),
      inheritable: true,
    },
    iconUrl: {
      handler: 'IconUrl',
      label: L._('Icon symbol'),
      inheritable: true,
      helpText: U.Help.formatIconSymbol,
    },
    popupShape: { handler: 'PopupShape', label: L._('Popup shape'), inheritable: true },
    popupTemplate: {
      handler: 'PopupContent',
      label: L._('Popup content style'),
      inheritable: true,
    },
    popupContentTemplate: {
      label: L._('Popup content template'),
      handler: 'Textarea',
      helpEntries: ['dynamicProperties', 'textFormatting'],
      placeholder: '# {name}',
      inheritable: true,
    },
    datalayer: {
      handler: 'DataLayerSwitcher',
      label: L._('Choose the layer of the feature'),
    },
    moreControl: {
      handler: 'Switch',
      label: L._('Do you want to display the «more» control?'),
    },
    scrollWheelZoom: { handler: 'Switch', label: L._('Allow scroll wheel zoom?') },
    miniMap: { handler: 'Switch', label: L._('Do you want to display a minimap?') },
    scaleControl: {
      handler: 'Switch',
      label: L._('Do you want to display the scale control?'),
    },
    onLoadPanel: {
      handler: 'OnLoadPanel',
      label: L._('Do you want to display a panel on load?'),
    },
    defaultView: {
      handler: 'DefaultView',
      label: L._('Default view'),
    },
    displayPopupFooter: {
      handler: 'Switch',
      label: L._('Do you want to display popup footer?'),
    },
    captionBar: {
      handler: 'Switch',
      label: L._('Do you want to display a caption bar?'),
    },
    captionMenus: {
      handler: 'Switch',
      label: L._('Do you want to display caption menus?'),
    },
    zoomTo: {
      handler: 'IntInput',
      placeholder: L._('Inherit'),
      helpEntries: 'zoomTo',
      label: L._('Default zoom level'),
      inheritable: true,
    },
    showLabel: {
      handler: 'LabelChoice',
      label: L._('Display label'),
      inheritable: true,
    },
    labelDirection: {
      handler: 'LabelDirection',
      label: L._('Label direction'),
      inheritable: true,
    },
    labelInteractive: {
      handler: 'Switch',
      label: L._('Labels are clickable'),
      inheritable: true,
    },
    outlink: {
      label: L._('Link to…'),
      helpEntries: 'outlink',
      placeholder: 'http://...',
      inheritable: true,
    },
    outlinkTarget: {
      handler: 'OutlinkTarget',
      label: L._('Open link in…'),
      inheritable: true,
    },
    labelKey: {
      helpEntries: 'labelKey',
      placeholder: L._('Default: name'),
      label: L._('Label key'),
      inheritable: true,
    },
    zoomControl: { handler: 'ControlChoice', label: L._('Display the zoom control') },
    searchControl: {
      handler: 'ControlChoice',
      label: L._('Display the search control'),
    },
    fullscreenControl: {
      handler: 'ControlChoice',
      label: L._('Display the fullscreen control'),
    },
    embedControl: { handler: 'ControlChoice', label: L._('Display the embed control') },
    locateControl: {
      handler: 'ControlChoice',
      label: L._('Display the locate control'),
    },
    measureControl: {
      handler: 'ControlChoice',
      label: L._('Display the measure control'),
    },
    tilelayersControl: {
      handler: 'ControlChoice',
      label: L._('Display the tile layers control'),
    },
    editinosmControl: {
      handler: 'ControlChoice',
      label: L._('Display the control to open OpenStreetMap editor'),
    },
    datalayersControl: {
      handler: 'DataLayersControl',
      label: L._('Display the data layers control'),
    },
    starControl: {
      handler: 'ControlChoice',
      label: L._('Display the star map button'),
    },
    fromZoom: {
      handler: 'IntInput',
      label: L._('From zoom'),
      helpText: L._('Optional.'),
    },
    toZoom: { handler: 'IntInput', label: L._('To zoom'), helpText: L._('Optional.') },
    interactive: {
      handler: 'Switch',
      label: L._('Allow interactions'),
      helpEntries: 'interactive',
      inheritable: true,
    },
  },

  initialize: function (obj, fields, options) {
    this.map = obj.map || obj.getMap()
    L.FormBuilder.prototype.initialize.call(this, obj, fields, options)
    this.on('finish', this.finish)
  },

  setter: function (field, value) {
    L.FormBuilder.prototype.setter.call(this, field, value)
    if (this.options.makeDirty !== false) this.obj.isDirty = true
  },

  finish: function () {
    this.map.ui.closePanel()
  },
})
