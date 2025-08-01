import {
  AjaxAutocomplete,
  AjaxAutocompleteMultiple,
  AutocompleteDatalist,
} from '../autocomplete.js'
import { translate } from '../i18n.js'
import * as Icon from '../rendering/icon.js'
import { SCHEMA } from '../schema.js'
import * as Utils from '../utils.js'

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
    this.id = `${this.builder.properties.id || Date.now()}.${this.name}`
  }

  getDefaultProperties() {
    return {}
  }

  setProperties(properties) {
    this.properties = Object.assign(
      this.getDefaultProperties(),
      this.properties,
      properties
    )
  }

  onDefine() {}

  buildTemplate() {
    const template = this.builder.getTemplate(this)
    const [root, elements] = Utils.loadTemplateWithRefs(template)
    this.root = root
    this.elements = elements
    this.container = elements.container
    this.form.appendChild(this.root)
  }

  getTemplate() {
    return ''
  }

  build() {
    if (this.properties.helpText) {
      this.elements.helpText.textContent = this.properties.helpText
    } else {
      this.elements.helpText.hidden = true
    }

    if (this.elements.define) {
      this.elements.define.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        this.fetch()
        this.onDefine()
        this.root.classList.remove('undefined')
      })
    }
    if (this.elements.undefine) {
      this.elements.undefine.addEventListener('click', () => this.undefine())
    }
  }

  clear() {
    this.input.value = ''
  }

  get() {
    let value
    const path = this.field.split('.')
    const key = path[path.length - 1]
    if (!this.properties.inheritable) {
      value = this.builder.getter(this.field)
    } else {
      value = this.obj.getOption(key)
    }
    if (value === undefined) return SCHEMA[key]?.default
    return value
  }

  toHTML() {
    return this.get()
  }

  toJS() {
    return this.value()
  }

  sync() {
    this.set()
    this.builder.fire('set', { helper: this })
  }

  set() {
    this.builder.setter(this.field, this.toJS())
  }

  getLabelTemplate() {
    const label = this.properties.label
    const help = this.properties.helpEntries?.join() || ''
    return label
      ? `<label title="${label}" data-ref=label data-help="${help}">${label}</label>`
      : ''
  }

  fetch() {}

  finish() {}

  undefine() {
    this.root.classList.add('undefined')
    this.clear()
    this.sync()
  }
}

Fields.Textarea = class extends BaseElement {
  getTemplate() {
    return `<textarea placeholder="${this.properties.placeholder || ''}" name="${this.name}" data-ref=textarea></textarea>`
  }

  build() {
    super.build()
    this.textarea = this.elements.textarea
    this.input = this.textarea
    this.fetch()
    this.textarea.addEventListener(
      'input',
      Utils.debounce(() => this.sync(), 300)
    )
    this.textarea.addEventListener('keypress', (event) => this.onKeyPress(event))
  }

  fetch() {
    const value = this.toHTML()
    this.initial = value
    if (value) {
      this.textarea.value = value
    }
  }
  clear() {
    this.textarea.value = ''
  }
  value() {
    return this.textarea.value
  }

  onKeyPress(event) {
    if (event.key === 'Enter' && (event.shiftKey || event.ctrlKey)) {
      event.stopPropagation()
      event.preventDefault()
      this.finish()
    }
  }
}

Fields.Input = class extends BaseElement {
  getTemplate() {
    return `<input type="${this.type()}" name="${this.name}" placeholder="${this.properties.placeholder || ''}" data-ref=input />`
  }

  build() {
    super.build()
    this.input = this.elements.input
    this.input._helper = this
    if (this.properties.className) {
      this.input.classList.add(this.properties.className)
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
    this.listenForSync()
    this.input.addEventListener('keydown', (event) => this.onKeyDown(event))
  }

  fetch() {
    const value = this.toHTML() !== undefined ? this.toHTML() : null
    this.initial = value
    this.input.value = value
  }

  listenForSync() {
    this.input.addEventListener(
      'input',
      Utils.debounce(() => this.sync(), 300)
    )
  }

  type() {
    return this.properties.type || 'text'
  }

  value() {
    return this.input.value || undefined
  }

  onKeyDown(event) {
    if (event.key === 'Enter') {
      event.stopPropagation()
      event.preventDefault()
      this.finish()
      this.input.blur()
    }
  }
}

Fields.BlurInput = class extends Fields.Input {
  listenForSync() {
    this.input.addEventListener('blur', () => this.sync())
  }

  getTemplate() {
    return `<div class="blur-container">${super.getTemplate()}<button type="button">✔</button></div>`
  }

  build() {
    this.properties.className = 'blur'
    super.build()
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
      return !Number.isNaN(this.input.value) && this.input.value !== ''
        ? Number.parseInt(this.input.value, 10)
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
      return !Number.isNaN(this.input.value) && this.input.value !== ''
        ? Number.parseFloat(this.input.value)
        : undefined
    }

    type() {
      return 'number'
    }
  }

Fields.FloatInput = class extends FloatMixin(Fields.Input) {
  // TODO use public class properties when in baseline
  getDefaultProperties() {
    return { step: 'any' }
  }
}

Fields.BlurFloatInput = class extends FloatMixin(Fields.BlurInput) {
  getDefaultProperties() {
    return { step: 'any' }
  }
}

Fields.CheckBox = class extends BaseElement {
  getTemplate() {
    return `<input type=checkbox name="${this.name}" data-ref=input />`
  }

  build() {
    this.input = this.elements.input
    this.input._helper = this
    this.fetch()
    this.input.addEventListener('change', () => this.sync())
    super.build()
  }

  fetch() {
    this.initial = this.toHTML()
    this.input.checked = this.initial === true
  }

  value() {
    return this.root.classList.contains('undefined') ? undefined : this.input.checked
  }

  toHTML() {
    return [1, true].indexOf(this.get()) !== -1
  }

  clear() {
    this.fetch()
  }
}

Fields.CheckBoxes = class extends BaseElement {
  getInputTemplate(value, label) {
    return `<label><input type=checkbox value="${value}" name="${this.name}" data-ref=input />${label}</label>`
  }

  build() {
    const initial = this.get() || []
    for (const [value, label] of this.properties.choices) {
      const [root, { input }] = Utils.loadTemplateWithRefs(
        this.getInputTemplate(value, label)
      )
      this.container.appendChild(root)
      input.checked = initial.includes(value)
      input.addEventListener('change', () => this.sync())
    }
    super.build()
  }

  value() {
    return Array.from(this.root.querySelectorAll('input:checked')).map((el) => el.value)
  }
}

Fields.Select = class extends BaseElement {
  getTemplate() {
    return `<select name="${this.name}" data-ref=select></select>`
  }

  build() {
    this.select = this.elements.select
    this.validValues = []
    this.buildOptions()
    this.select.addEventListener('change', () => this.sync())
    super.build()
  }

  getOptions() {
    if (this.properties.getOptions) {
      return this.properties.getOptions()
    }
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
    const option = Utils.loadTemplate('<option></option>')
    this.select.appendChild(option)
    option.value = value
    option.textContent = label
    if (this.toHTML() === value) {
      option.selected = 'selected'
    }
  }

  value() {
    if (this.select[this.select.selectedIndex]) {
      return this.select[this.select.selectedIndex].value
    }
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
    return Number.parseInt(super.value(), 10)
  }
}

Fields.EditableText = class extends BaseElement {
  getTemplate() {
    return `<span class="${this.properties.className || ''}" data-ref=input></span>`
  }

  buildTemplate() {
    // No wrapper at all
    const template = this.getTemplate()
    this.input = Utils.loadTemplate(template)
    this.form.appendChild(this.input)
  }

  build() {
    this.fetch()
    this.input.addEventListener('input', () => this.sync())
    this.input.addEventListener('keypress', (event) => this.onKeyPress(event))
    this.input.addEventListener('dblclick', () => {
      if (this.input.contentEditable !== true) {
        this.input.contentEditable = true
        this.input.focus()
      }
    })
    this.input.addEventListener('blur', () => {
      this.input.contentEditable = false
    })
    this.input.addEventListener('mouseover', () => {
      this.builder._umap.tooltip.open({
        content: translate('Double click to edit the name'),
        anchor: this.input,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
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

  getDefaultProperties() {
    return {
      placeholder: translate('Inherit'),
    }
  }

  getTemplate() {
    return `${super.getTemplate()}<div class="umap-color-picker" hidden data-ref=colors></div>`
  }

  build() {
    super.build()
    for (const color of this.getColors()) {
      this.addColor(color)
    }
    this.spreadColor()
    this.input.autocomplete = 'off'
    this.input.addEventListener('focus', (event) => this.onFocus(event))
    this.input.addEventListener('blur', (event) => this.onBlur(event))
    this.input.addEventListener('change', () => this.sync())
  }

  onDefine() {
    this.onFocus()
  }

  onFocus() {
    this.showPicker()
    this.spreadColor()
  }

  showPicker() {
    this.elements.colors.hidden = false
  }

  closePicker() {
    this.elements.colors.hidden = true
  }

  onBlur() {
    // We must leave time for the click to be listened.
    window.setTimeout(() => this.closePicker(), 100)
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
    const span = Utils.loadTemplate('<span></span>')
    this.elements.colors.appendChild(span)
    span.style.backgroundColor = span.title = colorName
    const updateColorInput = () => {
      this.input.value = colorName
      this.sync()
      this.closePicker()
    }
    span.addEventListener('mousedown', updateColorInput)
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
    if (this.properties.allowEmpty) {
      options.push([null, translate('Import in a new layer')])
    }
    this.builder._umap.datalayers.reverse().map((datalayer) => {
      if (
        datalayer.isLoaded() &&
        !datalayer.isDataReadOnly() &&
        datalayer.isBrowsable()
      ) {
        options.push([datalayer.id, datalayer.getName()])
      }
    })
    return options
  }

  toHTML() {
    return this.obj.datalayer?.id
  }

  toJS() {
    return this.builder._umap.datalayers[this.value()]
  }

  set() {
    this.builder._umap.lastUsedDataLayer = this.toJS()
    this.builder.setter(this.field, this.toJS())
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
    const properties = this.builder.obj.fieldKeys
    autocomplete.suggestions = properties
  }
}

Fields.IconUrl = class extends Fields.BlurInput {
  type() {
    return 'hidden'
  }

  getTemplate() {
    return `
      <div>
        <div class="flat-tabs" data-ref=tabs></div>
        <div class="umap-pictogram-body" data-ref=body>
        ${super.getTemplate()}
        </div>
        <div data-ref=footer></div>
      </div>
    `
  }

  build() {
    super.build()
    this.tabs = this.elements.tabs
    this.body = this.elements.body
    this.footer = this.elements.footer
    this.button = Utils.loadTemplate(
      `<button type="button" class="button action-button" hidden>${translate('Change')}</button>`
    )
    this.button.addEventListener('click', () => this.onDefine())
    this.elements.buttons.appendChild(this.button)
    this.updatePreview()
  }

  async onDefine() {
    this.footer.innerHTML = ''
    const [{ data }, response, error] = await this.builder._umap.server.get(
      this.builder._umap.properties.urls.pictogram_list_json
    )
    if (!error) this.pictogramCollections = data
    this.buildTabs()
    const value = this.value()
    if (Icon.RECENT.length) this.showRecentTab()
    else if (!value || Utils.isPath(value)) this.showSymbolsTab()
    else if (Utils.isRemoteUrl(value) || Utils.isDataImage(value)) this.showURLTab()
    else this.showCharsTab()
    const closeButton = Utils.loadTemplate(
      `<button type="button" class="button action-button">${translate('Close')}</button>`
    )
    closeButton.addEventListener('click', (event) => {
      this.body.innerHTML = ''
      this.tabs.innerHTML = ''
      this.footer.innerHTML = ''
      if (this.isDefault()) this.undefine()
      else this.updatePreview()
    })
    this.footer.appendChild(closeButton)
  }

  buildTabs() {
    this.tabs.innerHTML = ''
    // Useless div, but loadTemplate needs a root element
    const [root, { recent, symbols, chars, url }] = Utils.loadTemplateWithRefs(`
      <div>
        <button class="flat tab-recent" data-ref=recent>${translate('Recent')}</button>
        <button class="flat tab-symbols" data-ref=symbols>${translate('Symbol')}</button>
        <button class="flat tab-chars" data-ref=chars>${translate('Emoji & Character')}</button>
        <button class="flat tab-url" data-ref=url>${translate('URL')}</button>
      </div>
    `)
    ;[recent, symbols, chars, url].forEach((node) => this.tabs.appendChild(node))
    if (Icon.RECENT.length) {
      recent.addEventListener('click', (event) => {
        event.stopPropagation()
        event.preventDefault()
        this.showRecentTab()
      })
    } else {
      recent.hidden = true
    }
    symbols.addEventListener('click', (event) => {
      event.stopPropagation()
      event.preventDefault()
      this.showSymbolsTab()
    })
    chars.addEventListener('click', (event) => {
      event.stopPropagation()
      event.preventDefault()
      this.showCharsTab()
    })
    url.addEventListener('click', (event) => {
      event.stopPropagation()
      event.preventDefault()
      this.showURLTab()
    })
  }

  openTab(name) {
    const els = this.tabs.querySelectorAll('button')
    for (const el of els) {
      el.classList.remove('on')
    }
    const el = this.tabs.querySelector(`.tab-${name}`)
    el.classList.add('on')
    this.body.innerHTML = ''
  }

  updatePreview() {
    this.elements.actions.innerHTML = ''
    this.button.hidden = !this.value() || this.isDefault()
    if (this.isDefault()) return
    if (!Utils.hasVar(this.value())) {
      // Do not try to render URL with variables
      const box = Utils.loadTemplate('<div class="umap-pictogram-choice"></div>')
      this.elements.actions.appendChild(box)
      box.addEventListener('click', () => this.onDefine())
      const icon = Icon.makeElement(this.value(), box)
    }
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
    const container = Utils.loadTemplate(
      `<div class="${className}" title="${title}"></div>`
    )
    parent.appendChild(container)
    Icon.makeElement(value, container)
    container.addEventListener('click', () => {
      this.input.value = value
      this.sync()
      this.unselectAll(this.grid)
      container.classList.add('selected')
      this.updatePreview()
    })
    return true // Icon has been added (not filtered)
  }

  clear() {
    this.input.value = ''
    this.unselectAll(this.body)
    this.sync()
    this.body.innerHTML = ''
    this.updatePreview()
  }

  addCategory(items, name, parent, attribution = null) {
    const hidden = name ? '' : ' hidden'
    const [container, { grid }] = Utils.loadTemplateWithRefs(`
      <div class="umap-pictogram-category">
        <h6${hidden}>${name}</h6>
        <div class="umap-pictogram-grid" data-ref=grid></div>
      </div>
    `)
    let hasIcons = false
    const sorted = items.sort((a, b) => Utils.naturalSort(a.name, b.name, U.lang))
    for (const item of sorted) {
      item.attribution ??= attribution
      hasIcons = this.addIconPreview(item, grid) || hasIcons
    }
    if (hasIcons) parent.appendChild(container)
  }

  buildSymbolsList() {
    this.grid.innerHTML = ''
    const categories = {}
    let category
    const collectionsNames = Object.keys(this.pictogramCollections)
    const [container, { select, icons }] = Utils.loadTemplateWithRefs(
      '<div><select data-ref="select"></select><div data-ref="icons"></div></div>'
    )
    for (const name of collectionsNames) {
      const option = Utils.loadTemplate(`<option value="${name}">${name}</option>`)
      select.appendChild(option)
    }
    this.grid.appendChild(container)
    select.hidden = collectionsNames.length === 1
    const loadCollection = (name) => {
      icons.innerHTML = ''
      const collection = this.pictogramCollections[name || collectionsNames[0]]
      if (!collection) return
      const sorted = Object.entries(collection.categories).sort(([a], [b]) =>
        Utils.naturalSort(a, b, U.lang)
      )
      for (const [name, items] of sorted) {
        this.addCategory(items, name, icons, collection.attribution)
      }
    }
    loadCollection()
    select.addEventListener('change', (event) => {
      loadCollection(event.target.value)
    })
  }

  buildRecentList() {
    this.grid.innerHTML = ''
    const items = U.Icon.RECENT.map((src) => ({
      src,
    }))
    this.addCategory(items, null, this.grid)
  }

  isDefault() {
    return !this.value() || this.value() === SCHEMA.iconUrl.default
  }

  addGrid(onSearch) {
    this.searchInput = Utils.loadTemplate(
      `<input type="search" placeholder="${translate('Search')}" />`
    )
    this.grid = Utils.loadTemplate('<div></div>')
    this.body.appendChild(this.searchInput)
    this.body.appendChild(this.grid)
    this.searchInput.addEventListener('input', onSearch)
  }

  showRecentTab() {
    if (!Icon.RECENT.length) return
    this.openTab('recent')
    this.addGrid(() => this.buildRecentList())
    this.buildRecentList()
  }

  showSymbolsTab() {
    this.openTab('symbols')
    this.addGrid(() => this.buildSymbolsList())
    this.buildSymbolsList()
  }

  showCharsTab() {
    this.openTab('chars')
    const value = !Icon.isImg(this.value()) ? this.value() : null
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
    const [element, { input }] = Utils.loadTemplateWithRefs(
      '<div class="blur-container"><input class="blur" data-ref="input" /><button type="button">✔</button></div>'
    )
    parent.appendChild(element)
    if (value) input.value = value
    input.addEventListener('blur', () => {
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
  getTemplate() {
    const label = this.properties.label
    const help = this.properties.helpEntries?.join() || ''
    return `${super.getTemplate()}<label title="${label}" for="${this.id}" data-ref=customLabel data-help="${help}">${label}</label>`
  }

  build() {
    super.build()
    // We have it in our template
    if (!this.properties.inheritable) {
      // We already have the label near the switch,
      // only show the default label in inheritable mode
      // as the switch itself may be hidden (until "defined")
      if (this.elements.label) {
        this.elements.label.hidden = true
        this.elements.label.innerHTML = ''
        this.elements.label.title = ''
      }
    }
    this.container.classList.add('with-switch')
    this.input.classList.add('switch')
    this.input.id = this.id
  }
}

Fields.FacetSearchBase = class extends BaseElement {
  buildLabel() {}
}

Fields.FacetSearchChoices = class extends Fields.FacetSearchBase {
  getTemplate() {
    return `
      <fieldset class="umap-facet">
        <legend data-ref=label>${Utils.escapeHTML(this.properties.label)}</legend>
        <ul data-ref=ul></ul>
      </fieldset>
      `
  }

  build() {
    this.type = this.properties.criteria.type

    const choices = this.properties.criteria.choices
    choices.sort()
    choices.forEach((value) => this.buildLi(value))
    super.build()
  }

  buildLi(value) {
    const name = `${this.type}_${this.name}`
    const [li, { input, label }] = Utils.loadTemplateWithRefs(`
      <li>
        <label>
          <input type="${this.type}" name="${name}" data-ref=input />
          <span data-ref=label></span>
        </label>
      </li>
    `)
    label.textContent = value
    input.checked = this.get().choices.includes(value)
    input.dataset.value = value
    input.addEventListener('change', () => this.sync())
    this.elements.ul.appendChild(li)
  }

  toJS() {
    return {
      type: this.type,
      choices: [...this.elements.ul.querySelectorAll('input:checked')].map(
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

  getTemplate() {
    const [minLabel, maxLabel] = this.getLabels()
    const { min, max, type } = this.properties.criteria
    this.type = type
    const inputType = this.getInputType(this.type)
    const minHTML = this.prepareForHTML(min)
    const maxHTML = this.prepareForHTML(max)
    return `
      <fieldset class="umap-facet">
        <legend>${Utils.escapeHTML(this.properties.label)}</legend>
        <label>${minLabel}<input min="${minHTML}" max="${maxHTML}" step=any type="${inputType}" data-ref=minInput /></label>
        <label>${maxLabel}<input min="${minHTML}" max="${maxHTML}" step=any type="${inputType}" data-ref=maxInput /></label>
      </fieldset>
    `
  }

  build() {
    this.minInput = this.elements.minInput
    this.maxInput = this.elements.maxInput
    const { min, max, type } = this.properties.criteria
    const { min: modifiedMin, max: modifiedMax } = this.get()

    const currentMin = modifiedMin !== undefined ? modifiedMin : min
    const currentMax = modifiedMax !== undefined ? modifiedMax : max
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

    if (max != null) {
      // Cf comment above about setAttribute vs value
      this.maxInput.setAttribute('value', this.prepareForHTML(max))
      this.maxInput.value = this.prepareForHTML(currentMax)
    }
    this.toggleStatus()

    this.minInput.addEventListener('change', () => this.sync())
    this.maxInput.addEventListener('change', () => this.sync())
    super.build()
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
  // TODO: use public property when it's in our baseline
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

  getTemplate() {
    return `<div class="${this.getClassName()} by${this.getChoices().length}" data-ref=wrapper></div>`
  }

  build() {
    const choices = this.getChoices()
    for (const [i, [value, label]] of choices.entries()) {
      this.addChoice(value, label, i)
    }
    this.fetch()
    super.build()
  }

  addChoice(value, label, counter) {
    const id = `${Date.now()}.${this.name}.${counter}`
    const input = Utils.loadTemplate(
      `<input type="radio" name="${this.name}" id="${id}" value="${value}" />`
    )
    this.elements.wrapper.appendChild(input)
    this.elements.wrapper.appendChild(
      Utils.loadTemplate(`<label for="${id}">${label}</label>`)
    )
    input.addEventListener('change', () => this.sync())
  }
}

Fields.TernaryChoices = class extends Fields.MultiChoice {
  getDefault() {
    return null
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
    return (
      this.properties.choices || [
        [true, translate('always')],
        [false, translate('never')],
        [null, translate('hidden')],
      ]
    )
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
    return this.root.classList.contains('undefined') ? undefined : super.value()
  }

  build() {
    super.build()
    let options = ''
    const step = this.properties.step || 1
    const digits = step < 1 ? 1 : 0
    const id = `range-${this.properties.label || this.name}`
    const range = this.properties.max - this.properties.min
    const ticks = this.properties.ticks || Math.min(20, range / step)
    const tickStep = range / ticks
    for (let i = this.properties.min; i <= this.properties.max; i += tickStep) {
      const ii = i.toFixed(digits)
      options += `<option value="${ii}" label="${ii}"></option>`
    }
    const datalist = Utils.loadTemplate(
      `<datalist class="umap-field-datalist" id="${id}">${options}</datalist>`
    )
    this.container.appendChild(datalist)
    this.input.setAttribute('list', id)
  }
}

Fields.ManageOwner = class extends BaseElement {
  build() {
    super.build()
    const options = {
      className: 'edit-owner',
      on_select: L.bind(this.onSelect, this),
      placeholder: translate("Type new owner's username"),
    }
    this.autocomplete = new AjaxAutocomplete(this.container, options)
    const owner = this.toHTML()
    if (owner) {
      this.autocomplete.displaySelected({
        item: { value: owner.id, label: owner.name },
      })
    }
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
    super.build()
    const options = {
      className: 'edit-editors',
      on_select: L.bind(this.onSelect, this),
      on_unselect: L.bind(this.onUnselect, this),
      placeholder: translate("Type editor's username"),
    }
    this.autocomplete = new AjaxAutocompleteMultiple(this.container, options)
    this._values = this.toHTML() || []
    if (this._values) {
      for (let i = 0; i < this._values.length; i++)
        this.autocomplete.displaySelected({
          item: { value: this._values[i].id, label: this._values[i].name },
        })
    }
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
