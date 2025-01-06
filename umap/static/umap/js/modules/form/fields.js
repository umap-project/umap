import * as Utils from '../utils.js'
import { translate } from '../i18n.js'
import {
  AjaxAutocomplete,
  AjaxAutocompleteMultiple,
  AutocompleteDatalist,
} from '../autocomplete.js'

const Fields = {}

export default function getClass(name) {
  if (typeof name === 'function') return name
  if (!Fields[name]) throw Error(`Unknown class ${name}`)
  return Fields[name]
}

class BaseElement {
  constructor(builder, field, properties) {
    this.builder = builder
    this.obj = this.builder.obj
    this.form = this.builder.form
    this.field = field
    this.setProperties(properties)
    this.fieldEls = this.field.split('.')
    this.name = this.builder.getName(field)
    this.parentNode = this.getParentNode()
  }

  setProperties(properties) {
    this.properties = Object.assign({}, this.properties, properties)
  }

  onDefine() {}

  getParentNode() {
    const classNames = ['formbox']
    if (this.properties.inheritable) {
      classNames.push(inheritable)
      if (this.get(true)) classNames.push('undefined')
    }
    classNames.push(`umap-field-${this.name}`)
    const [wrapper, { header, define, undefine, quickContainer, container }] =
      Utils.loadTemplateWithRefs(`
      <div>
        <div class="header" data-ref=header>
          <a href="#" class="button undefine" data-ref=undefine>${translate('clear')}</a>
          <a href="#" class="button define" data-ref=define>${translate('define')}</a>
          <span class="quick-actions show-on-defined" data-ref=quickContainer></span>
        </div>
        <div class="show-on-defined" data-ref=container></div>
      </div>`)
    this.wrapper = wrapper
    this.wrapper.classList.add(...classNames)
    this.header = header
    this.form.appendChild(this.wrapper)
    if (this.properties.inheritable) {
      define.addEventListener('click', (event) => {
        e.preventDefault()
        e.stopPropagation()
        this.fetch()
        this.onDefine()
        this.wrapper.classList.remove('undefined')
      })
      undefine.addEventListener('click', () => this.undefine())
    } else {
      define.hidden = true
      undefine.hidden = true
    }

    this.quickContainer = quickContainer
    this.extendedContainer = container
    return this.extendedContainer
  }

  clear() {
    this.input.value = ''
  }

  get(own) {
    if (!this.properties.inheritable || own) return this.builder.getter(this.field)
    const path = this.field.split('.')
    const key = path[path.length - 1]
    return this.obj.getOption(key)
  }

  toHTML() {
    return this.get()
  }

  toJS() {
    return this.value()
  }

  sync() {
    this.set()
    this.onPostSync()
  }

  set() {
    this.builder.setter(this.field, this.toJS())
  }

  getLabelParent() {
    return this.header
  }

  getHelpTextParent() {
    return this.parentNode
  }

  buildLabel() {
    if (this.properties.label) {
      this.label = L.DomUtil.create('label', '', this.getLabelParent())
      this.label.textContent = this.label.title = this.properties.label
      if (this.properties.helpEntries) {
        this.builder._umap.help.button(this.label, this.properties.helpEntries)
      } else if (this.properties.helpTooltip) {
        const info = L.DomUtil.create('i', 'info', this.label)
        L.DomEvent.on(info, 'mouseover', () => {
          this.builder._umap.tooltip.open({
            anchor: info,
            content: this.properties.helpTooltip,
            position: 'top',
          })
        })
      }
    }
  }

  buildHelpText() {
    if (this.properties.helpText) {
      const container = L.DomUtil.create('small', 'help-text', this.getHelpTextParent())
      container.innerHTML = this.properties.helpText
    }
  }

  fetch() {}

  finish() {
    this.fireAndForward('finish')
  }

  onPostSync() {
    if (this.properties.callback) {
      this.properties.callback(this.obj)
    }
    this.builder.onPostSync()
  }

  undefine() {
    this.wrapper.classList.add('undefined')
    this.clear()
    this.sync()
  }
}

Fields.Textarea = class extends BaseElement {
  build() {
    this.input = L.DomUtil.create(
      'textarea',
      this.properties.className || '',
      this.parentNode
    )
    if (this.properties.placeholder)
      this.input.placeholder = this.properties.placeholder
    this.fetch()
    L.DomEvent.on(this.input, 'input', this.sync, this)
    L.DomEvent.on(this.input, 'keypress', this.onKeyPress, this)
  }

  fetch() {
    const value = this.toHTML()
    this.initial = value
    if (value) {
      this.input.value = value
    }
  }

  value() {
    return this.input.value
  }

  onKeyPress(e) {
    if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey)) {
      L.DomEvent.stop(e)
      this.finish()
    }
  }
}

Fields.Input = class extends BaseElement {
  build() {
    this.input = L.DomUtil.create(
      'input',
      this.properties.className || '',
      this.parentNode
    )
    this.input.type = this.type()
    this.input.name = this.name
    this.input._helper = this
    if (this.properties.placeholder) {
      this.input.placeholder = this.properties.placeholder
    }
    if (this.properties.min !== undefined) {
      this.input.min = this.properties.min
    }
    if (this.properties.max !== undefined) {
      this.input.max = this.properties.max
    }
    if (this.properties.step) {
      this.input.step = this.properties.step
    }
    this.fetch()
    L.DomEvent.on(this.input, this.getSyncEvent(), this.sync, this)
    L.DomEvent.on(this.input, 'keydown', this.onKeyDown, this)
  }

  fetch() {
    const value = this.toHTML() !== undefined ? this.toHTML() : null
    this.initial = value
    this.input.value = value
  }

  getSyncEvent() {
    return 'input'
  }

  type() {
    return this.properties.type || 'text'
  }

  value() {
    return this.input.value || undefined
  }

  onKeyDown(e) {
    if (e.key === 'Enter') {
      L.DomEvent.stop(e)
      this.finish()
    }
  }
}

Fields.BlurInput = class extends Fields.Input {
  getSyncEvent() {
    return 'blur'
  }

  build() {
    this.properties.className = 'blur'
    super.build()
    const button = L.DomUtil.create('span', 'button blur-button')
    L.DomUtil.after(this.input, button)
    this.input.addEventListener('focus', () => this.fetch())
  }

  finish() {
    this.sync()
    super.finish()
  }

  sync() {
    // Do not commit any change if user only clicked
    // on the field than clicked outside
    if (this.initial !== this.value()) {
      super.sync()
    }
  }
}
const IntegerMixin = (Base) =>
  class extends Base {
    value() {
      return !isNaN(this.input.value) && this.input.value !== ''
        ? parseInt(this.input.value, 10)
        : undefined
    }

    type() {
      return 'number'
    }
  }

Fields.IntInput = class extends IntegerMixin(Fields.Input) {}
Fields.BlurIntInput = class extends IntegerMixin(Fields.BlurInput) {}

const FloatMixin = (Base) =>
  class extends Base {
    value() {
      return !isNaN(this.input.value) && this.input.value !== ''
        ? parseFloat(this.input.value)
        : undefined
    }

    type() {
      return 'number'
    }
  }

Fields.FloatInput = class extends FloatMixin(Fields.Input) {
  // options: {
  //   step: 'any',
  // }
}

Fields.BlurFloatInput = class extends FloatMixin(Fields.BlurInput) {
  // options: {
  //   step: 'any',
  // },
}

Fields.CheckBox = class extends BaseElement {
  build() {
    const container = Utils.loadTemplate('<div class="checkbox-wrapper"></div>')
    this.parentNode.appendChild(container)
    this.input = L.DomUtil.create('input', this.properties.className || '', container)
    this.input.type = 'checkbox'
    this.input.name = this.name
    this.input._helper = this
    this.fetch()
    this.input.addEventListener('change', () => this.sync())
  }

  fetch() {
    this.initial = this.toHTML()
    this.input.checked = this.initial === true
  }

  value() {
    return this.wrapper.classList.contains('undefined') ? undefined : this.input.checked
  }

  toHTML() {
    return [1, true].indexOf(this.get()) !== -1
  }

  clear() {
    this.fetch()
  }
}

Fields.Select = class extends BaseElement {
  build() {
    this.select = L.DomUtil.create('select', '', this.parentNode)
    this.select.name = this.name
    this.validValues = []
    this.buildOptions()
    L.DomEvent.on(this.select, 'change', this.sync, this)
  }

  getOptions() {
    return this.properties.selectOptions
  }

  fetch() {
    this.buildOptions()
  }

  buildOptions() {
    this.select.innerHTML = ''
    for (const option of this.getOptions()) {
      if (typeof option === 'string') this.buildOption(option, option)
      else this.buildOption(option[0], option[1])
    }
  }

  buildOption(value, label) {
    this.validValues.push(value)
    const option = L.DomUtil.create('option', '', this.select)
    option.value = value
    option.innerHTML = label
    if (this.toHTML() === value) {
      option.selected = 'selected'
    }
  }

  value() {
    if (this.select[this.select.selectedIndex])
      return this.select[this.select.selectedIndex].value
  }

  getDefault() {
    if (this.properties.inheritable) return undefined
    return this.getOptions()[0][0]
  }

  toJS() {
    const value = this.value()
    if (this.validValues.indexOf(value) !== -1) {
      return value
    }
    return this.getDefault()
  }

  clear() {
    this.select.value = ''
  }
}

Fields.IntSelect = class extends Fields.Select {
  value() {
    return parseInt(super.value(), 10)
  }
}

Fields.NullableBoolean = class extends Fields.Select {
  getOptions() {
    return [
      [undefined, 'inherit'],
      [true, 'yes'],
      [false, 'no'],
    ]
  }

  toJS() {
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
  }
}

Fields.EditableText = class extends BaseElement {
  build() {
    this.input = L.DomUtil.create(
      'span',
      this.properties.className || '',
      this.parentNode
    )
    this.input.contentEditable = true
    this.fetch()
    L.DomEvent.on(this.input, 'input', this.sync, this)
    L.DomEvent.on(this.input, 'keypress', this.onKeyPress, this)
  }

  getParentNode() {
    return this.form
  }

  value() {
    return this.input.textContent
  }

  fetch() {
    this.input.textContent = this.toHTML()
  }

  onKeyPress(event) {
    if (event.keyCode === 13) {
      event.preventDefault()
      this.input.blur()
    }
  }
}

Fields.ColorPicker = class extends Fields.Input {
  getColors() {
    return Utils.COLORS
  }

  getParentNode() {
    super.getParentNode()
    return this.quickContainer
  }

  build() {
    super.build()
    this.input.placeholder = this.properties.placeholder || translate('Inherit')
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
  }

  onFocus() {
    this.container.style.display = 'block'
    this.spreadColor()
  }

  onBlur() {
    const closePicker = () => {
      this.container.style.display = 'none'
    }
    // We must leave time for the click to be listened.
    window.setTimeout(closePicker, 100)
  }

  sync() {
    this.spreadColor()
    super.sync()
  }

  spreadColor() {
    if (this.input.value) this.input.style.backgroundColor = this.input.value
    else this.input.style.backgroundColor = 'inherit'
  }

  addColor(colorName) {
    const span = L.DomUtil.create('span', '', this.container)
    span.style.backgroundColor = span.title = colorName
    const updateColorInput = function () {
      this.input.value = colorName
      this.sync()
      this.container.style.display = 'none'
    }
    L.DomEvent.on(span, 'mousedown', updateColorInput, this)
  }
}

Fields.TextColorPicker = class extends Fields.ColorPicker {
  getColors() {
    return [
      'Black',
      'DarkSlateGrey',
      'DimGrey',
      'SlateGrey',
      'LightSlateGrey',
      'Grey',
      'DarkGrey',
      'LightGrey',
      'White',
    ]
  }
}

Fields.LayerTypeChooser = class extends Fields.Select {
  getOptions() {
    return U.LAYER_TYPES.map((class_) => [class_.TYPE, class_.NAME])
  }
}

Fields.SlideshowDelay = class extends Fields.IntSelect {
  getOptions() {
    const options = []
    for (let i = 1; i < 30; i++) {
      options.push([i * 1000, translate('{delay} seconds', { delay: i })])
    }
    return options
  }
}

Fields.DataLayerSwitcher = class extends Fields.Select {
  getOptions() {
    const options = []
    this.builder._umap.eachDataLayerReverse((datalayer) => {
      if (
        datalayer.isLoaded() &&
        !datalayer.isDataReadOnly() &&
        datalayer.isBrowsable()
      ) {
        options.push([L.stamp(datalayer), datalayer.getName()])
      }
    })
    return options
  }

  toHTML() {
    return L.stamp(this.obj.datalayer)
  }

  toJS() {
    return this.builder._umap.datalayers[this.value()]
  }

  set() {
    this.builder._umap.lastUsedDataLayer = this.toJS()
    this.obj.changeDataLayer(this.toJS())
  }
}

Fields.DataFormat = class extends Fields.Select {
  getOptions() {
    return [
      [undefined, translate('Choose the data format')],
      ['geojson', 'geojson'],
      ['osm', 'osm'],
      ['csv', 'csv'],
      ['gpx', 'gpx'],
      ['kml', 'kml'],
      ['georss', 'georss'],
    ]
  }
}

Fields.LicenceChooser = class extends Fields.Select {
  getOptions() {
    const licences = []
    const licencesList = this.builder.obj.properties.licences
    let licence
    for (const i in licencesList) {
      licence = licencesList[i]
      licences.push([i, licence.name])
    }
    return licences
  }

  toHTML() {
    return this.get()?.name
  }

  toJS() {
    return this.builder.obj.properties.licences[this.value()]
  }
}

Fields.NullableBoolean = class extends Fields.Select {
  getOptions() {
    return [
      [undefined, translate('inherit')],
      [true, translate('yes')],
      [false, translate('no')],
    ]
  }

  toJS() {
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
  }
}

// Adds an autocomplete using all available user defined properties
Fields.PropertyInput = class extends Fields.BlurInput {
  build() {
    super.build()
    const autocomplete = new AutocompleteDatalist(this.input)
    // Will be used on Umap and DataLayer
    const properties = this.builder.obj.allProperties()
    autocomplete.suggestions = properties
  }
}

Fields.IconUrl = class extends Fields.BlurInput {
  type() {
    return 'hidden'
  }

  build() {
    super.build()
    this.buttons = L.DomUtil.create('div', '', this.parentNode)
    this.tabs = L.DomUtil.create('div', 'flat-tabs', this.parentNode)
    this.body = L.DomUtil.create('div', 'umap-pictogram-body', this.parentNode)
    this.footer = L.DomUtil.create('div', '', this.parentNode)
    this.updatePreview()
    this.on('define', this.onDefine)
  }

  async onDefine() {
    this.buttons.innerHTML = ''
    this.footer.innerHTML = ''
    const [{ pictogram_list }, response, error] = await this.builder._umap.server.get(
      this.builder._umap.properties.urls.pictogram_list_json
    )
    if (!error) this.pictogram_list = pictogram_list
    this.buildTabs()
    const value = this.value()
    if (U.Icon.RECENT.length) this.showRecentTab()
    else if (!value || Utils.isPath(value)) this.showSymbolsTab()
    else if (Utils.isRemoteUrl(value) || Utils.isDataImage(value)) this.showURLTab()
    else this.showCharsTab()
    const closeButton = L.DomUtil.createButton(
      'button action-button',
      this.footer,
      translate('Close'),
      function (e) {
        this.body.innerHTML = ''
        this.tabs.innerHTML = ''
        this.footer.innerHTML = ''
        if (this.isDefault()) this.undefine(e)
        else this.updatePreview()
      },
      this
    )
  }

  buildTabs() {
    this.tabs.innerHTML = ''
    if (U.Icon.RECENT.length) {
      const recent = L.DomUtil.add(
        'button',
        'flat tab-recent',
        this.tabs,
        translate('Recent')
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
      translate('Symbol')
    )
    const char = L.DomUtil.add(
      'button',
      'flat tab-chars',
      this.tabs,
      translate('Emoji & Character')
    )
    url = L.DomUtil.add('button', 'flat tab-url', this.tabs, translate('URL'))
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
  }

  openTab(name) {
    const els = this.tabs.querySelectorAll('button')
    for (const el of els) {
      L.DomUtil.removeClass(el, 'on')
    }
    const el = this.tabs.querySelector(`.tab-${name}`)
    L.DomUtil.addClass(el, 'on')
    this.body.innerHTML = ''
  }

  updatePreview() {
    this.buttons.innerHTML = ''
    if (this.isDefault()) return
    if (!Utils.hasVar(this.value())) {
      // Do not try to render URL with variables
      const box = L.DomUtil.create('div', 'umap-pictogram-choice', this.buttons)
      L.DomEvent.on(box, 'click', this.onDefine, this)
      const icon = U.Icon.makeElement(this.value(), box)
    }
    this.button = L.DomUtil.createButton(
      'button action-button',
      this.buttons,
      this.value() ? translate('Change') : translate('Add'),
      this.onDefine,
      this
    )
  }

  addIconPreview(pictogram, parent) {
    const baseClass = 'umap-pictogram-choice'
    const value = pictogram.src
    const search = Utils.normalize(this.searchInput.value)
    const title = pictogram.attribution
      ? `${pictogram.name} — © ${pictogram.attribution}`
      : pictogram.name || pictogram.src
    if (search && Utils.normalize(title).indexOf(search) === -1) return
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
  }

  clear() {
    this.input.value = ''
    this.unselectAll(this.body)
    this.sync()
    this.body.innerHTML = ''
    this.updatePreview()
  }

  addCategory(items, name) {
    const parent = L.DomUtil.create('div', 'umap-pictogram-category')
    if (name) L.DomUtil.add('h6', '', parent, name)
    const grid = L.DomUtil.create('div', 'umap-pictogram-grid', parent)
    let status = false
    for (const item of items) {
      status = this.addIconPreview(item, grid) || status
    }
    if (status) this.grid.appendChild(parent)
  }

  buildSymbolsList() {
    this.grid.innerHTML = ''
    const categories = {}
    let category
    for (const props of this.pictogram_list) {
      category = props.category || translate('Generic')
      categories[category] = categories[category] || []
      categories[category].push(props)
    }
    const sorted = Object.entries(categories).toSorted(([a], [b]) =>
      Utils.naturalSort(a, b, U.lang)
    )
    for (const [name, items] of sorted) {
      this.addCategory(items, name)
    }
  }

  buildRecentList() {
    this.grid.innerHTML = ''
    const items = U.Icon.RECENT.map((src) => ({
      src,
    }))
    this.addCategory(items)
  }

  isDefault() {
    return !this.value() || this.value() === U.SCHEMA.iconUrl.default
  }

  addGrid(onSearch) {
    this.searchInput = L.DomUtil.create('input', '', this.body)
    this.searchInput.type = 'search'
    this.searchInput.placeholder = translate('Search')
    this.grid = L.DomUtil.create('div', '', this.body)
    L.DomEvent.on(this.searchInput, 'input', onSearch, this)
  }

  showRecentTab() {
    if (!U.Icon.RECENT.length) return
    this.openTab('recent')
    this.addGrid(this.buildRecentList)
    this.buildRecentList()
  }

  showSymbolsTab() {
    this.openTab('symbols')
    this.addGrid(this.buildSymbolsList)
    this.buildSymbolsList()
  }

  showCharsTab() {
    this.openTab('chars')
    const value = !U.Icon.isImg(this.value()) ? this.value() : null
    const input = this.buildInput(this.body, value)
    input.placeholder = translate('Type char or paste emoji')
    input.type = 'text'
  }

  showURLTab() {
    this.openTab('url')
    const value =
      Utils.isRemoteUrl(this.value()) || Utils.isDataImage(this.value())
        ? this.value()
        : null
    const input = this.buildInput(this.body, value)
    input.placeholder = translate('Add image URL')
    input.type = 'url'
  }

  buildInput(parent, value) {
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
  }

  unselectAll(container) {
    for (const el of container.querySelectorAll('div.selected')) {
      el.classList.remove('selected')
    }
  }
}

Fields.Url = class extends Fields.Input {
  type() {
    return 'url'
  }
}

Fields.Switch = class extends Fields.CheckBox {
  getParentNode() {
    super.getParentNode()
    if (this.properties.inheritable) return this.quickContainer
    return this.extendedContainer
  }

  build() {
    super.build()
    console.log(this)
    if (this.properties.inheritable) {
      this.label = Utils.loadTemplate('<label></label>')
    }
    this.input.parentNode.appendChild(this.label)
    L.DomUtil.addClass(this.input.parentNode, 'with-switch')
    const id = `${this.builder.properties.id || Date.now()}.${this.name}`
    this.label.setAttribute('for', id)
    L.DomUtil.addClass(this.input, 'switch')
    this.input.id = id
  }
}

Fields.FacetSearchBase = class extends BaseElement {
  buildLabel() {
    this.label = L.DomUtil.element({
      tagName: 'legend',
      textContent: this.properties.label,
    })
  }
}

Fields.FacetSearchChoices = class extends Fields.FacetSearchBase {
  build() {
    this.container = L.DomUtil.create('fieldset', 'umap-facet', this.parentNode)
    this.container.appendChild(this.label)
    this.ul = L.DomUtil.create('ul', '', this.container)
    this.type = this.properties.criteria.type

    const choices = this.properties.criteria.choices
    choices.sort()
    choices.forEach((value) => this.buildLi(value))
  }

  buildLi(value) {
    const property_li = L.DomUtil.create('li', '', this.ul)
    const label = L.DomUtil.create('label', '', property_li)
    const input = L.DomUtil.create('input', '', label)
    L.DomUtil.add('span', '', label, value)

    input.type = this.type
    input.name = `${this.type}_${this.name}`
    input.checked = this.get().choices.includes(value)
    input.dataset.value = value

    L.DomEvent.on(input, 'change', (e) => this.sync())
  }

  toJS() {
    return {
      type: this.type,
      choices: [...this.ul.querySelectorAll('input:checked')].map(
        (i) => i.dataset.value
      ),
    }
  }
}

Fields.MinMaxBase = class extends Fields.FacetSearchBase {
  getInputType(type) {
    return type
  }

  getLabels() {
    return [translate('Min'), translate('Max')]
  }

  prepareForHTML(value) {
    return value.valueOf()
  }

  build() {
    this.container = L.DomUtil.create('fieldset', 'umap-facet', this.parentNode)
    this.container.appendChild(this.label)
    const { min, max, type } = this.properties.criteria
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
  }

  toggleStatus() {
    this.minInput.dataset.modified = this.isMinModified()
    this.maxInput.dataset.modified = this.isMaxModified()
  }

  sync() {
    super.sync()
    this.toggleStatus()
  }

  isMinModified() {
    const default_ = this.minInput.getAttribute('value')
    const current = this.minInput.value
    return current !== default_
  }

  isMaxModified() {
    const default_ = this.maxInput.getAttribute('value')
    const current = this.maxInput.value
    return current !== default_
  }

  toJS() {
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
  }
}

Fields.FacetSearchNumber = class extends Fields.MinMaxBase {
  prepareForJS(value) {
    return new Number(value)
  }
}

Fields.FacetSearchDate = class extends Fields.MinMaxBase {
  prepareForJS(value) {
    return new Date(value)
  }

  toLocaleDateTime(dt) {
    return new Date(dt.valueOf() - dt.getTimezoneOffset() * 60000)
  }

  prepareForHTML(value) {
    // Value must be in local time
    if (Number.isNaN(value)) return
    return this.toLocaleDateTime(value).toISOString().substr(0, 10)
  }

  getLabels() {
    return [translate('From'), translate('Until')]
  }
}

Fields.FacetSearchDateTime = class extends Fields.FacetSearchDate {
  getInputType(type) {
    return 'datetime-local'
  }

  prepareForHTML(value) {
    // Value must be in local time
    if (Number.isNaN(value)) return
    return this.toLocaleDateTime(value).toISOString().slice(0, -1)
  }
}

Fields.MultiChoice = class extends BaseElement {
  getDefault() {
    return 'null'
  }
  getClassName() {
    return 'umap-multiplechoice'
  }

  clear() {
    const checked = this.container.querySelector('input[type="radio"]:checked')
    if (checked) checked.checked = false
  }

  fetch() {
    this.initial = this.toHTML()
    let value = this.initial
    if (!this.container.querySelector(`input[type="radio"][value="${value}"]`)) {
      value =
        this.properties.default !== undefined ? this.properties.default : this.default
    }
    const choices = this.getChoices().map(([value, label]) => `${value}`)
    if (choices.includes(`${value}`)) {
      this.container.querySelector(`input[type="radio"][value="${value}"]`).checked =
        true
    }
  }

  value() {
    const checked = this.container.querySelector('input[type="radio"]:checked')
    if (checked) return checked.value
  }

  getChoices() {
    return this.properties.choices || this.choices
  }

  build() {
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
  }

  addChoice(value, label, counter) {
    const input = L.DomUtil.create('input', '', this.container)
    label = L.DomUtil.add('label', '', this.container, label)
    input.type = 'radio'
    input.name = this.name
    input.value = value
    const id = `${Date.now()}.${this.name}.${counter}`
    label.setAttribute('for', id)
    input.id = id
    L.DomEvent.on(input, 'change', this.sync, this)
  }
}

Fields.TernaryChoices = class extends Fields.MultiChoice {
  getDefault() {
    return 'null'
  }

  toJS() {
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
  }
}

Fields.NullableChoices = class extends Fields.TernaryChoices {
  getChoices() {
    return [
      [true, translate('always')],
      [false, translate('never')],
      ['null', translate('hidden')],
    ]
  }
}

Fields.DataLayersControl = class extends Fields.TernaryChoices {
  getChoices() {
    return [
      [true, translate('collapsed')],
      ['expanded', translate('expanded')],
      [false, translate('never')],
      ['null', translate('hidden')],
    ]
  }

  toJS() {
    let value = this.value()
    if (value !== 'expanded') value = super.toJS()
    return value
  }
}

Fields.Range = class extends Fields.FloatInput {
  type() {
    return 'range'
  }

  value() {
    return this.wrapper.classList.contains('undefined') ? undefined : super.value()
  }

  buildHelpText() {
    let options = ''
    const step = this.properties.step || 1
    const digits = step < 1 ? 1 : 0
    const id = `range-${this.properties.label || this.name}`
    for (
      let i = this.properties.min;
      i <= this.properties.max;
      i += this.properties.step
    ) {
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
    super.buildHelpText()
  }
}

Fields.ManageOwner = class extends BaseElement {
  build() {
    const options = {
      className: 'edit-owner',
      on_select: L.bind(this.onSelect, this),
      placeholder: translate("Type new owner's username"),
    }
    this.autocomplete = new AjaxAutocomplete(this.parentNode, options)
    const owner = this.toHTML()
    if (owner)
      this.autocomplete.displaySelected({
        item: { value: owner.id, label: owner.name },
      })
  }

  value() {
    return this._value
  }

  onSelect(choice) {
    this._value = {
      id: choice.item.value,
      name: choice.item.label,
      url: choice.item.url,
    }
    this.set()
  }
}

Fields.ManageEditors = class extends BaseElement {
  build() {
    const options = {
      className: 'edit-editors',
      on_select: L.bind(this.onSelect, this),
      on_unselect: L.bind(this.onUnselect, this),
      placeholder: translate("Type editor's username"),
    }
    this.autocomplete = new AjaxAutocompleteMultiple(this.parentNode, options)
    this._values = this.toHTML()
    if (this._values)
      for (let i = 0; i < this._values.length; i++)
        this.autocomplete.displaySelected({
          item: { value: this._values[i].id, label: this._values[i].name },
        })
  }

  value() {
    return this._values
  }

  onSelect(choice) {
    this._values.push({
      id: choice.item.value,
      name: choice.item.label,
      url: choice.item.url,
    })
    this.set()
  }

  onUnselect(choice) {
    const index = this._values.findIndex((item) => item.id === choice.item.value)
    if (index !== -1) {
      this._values.splice(index, 1)
      this.set()
    }
  }
}

Fields.ManageTeam = class extends Fields.IntSelect {
  getOptions() {
    return [[null, translate('None')]].concat(
      this.properties.teams.map((team) => [team.id, team.name])
    )
  }

  toHTML() {
    return this.get()?.id
  }

  toJS() {
    const value = this.value()
    for (const team of this.properties.teams) {
      if (team.id === value) return team
    }
  }
}
