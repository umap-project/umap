import { translate } from './i18n.js'
import { Form } from './form/builder.js'
import * as Utils from './utils.js'
import Orderable from './orderable.js'
import { Fields } from './form/fields.js'

const EMPTY_VALUE = translate('<empty value>')

const Widgets = {}

class BaseWidget {
  constructor(parent, label, field) {
    this.parent = parent
    this.label = label
    this.field = field
  }

  get userData() {
    return this.parent.userData[this.field] || {}
  }

  dumps() {
    const props = {
      widget: this.KEY,
      fieldKey: this.field,
    }
    if (this.label) {
      props.label = this.label
    }
    return props
  }

  getFormField(field) {
    return 'FilterByCheckbox'
  }

  computeInitialData(data, value) {}
}

Widgets.MinMax = class extends BaseWidget {
  constructor(parent, label, field) {
    super(parent, label, field)
    // FIXME make it dynamic from class name
    this.KEY = 'MinMax'
  }
  match(value) {
    if (this.userData.min > value) return true
    if (this.userData.max < value) return true
    return false
  }
  isActive() {
    return this.userData.min !== undefined || this.userData.max !== undefined
  }
  getFormField(field) {
    if (field.TYPE === 'Number') {
      return 'FilterByNumber'
    }
    if (field.TYPE === 'Date') {
      return 'FilterByDate'
    }
    if (field.TYPE === 'Datetime') {
      return 'FilterByDateTime'
    }
    return super.getFormField(field)
  }
  computeInitialData(data, value) {
    if (value === undefined || value === null) return
    if (data.min === undefined || data.min > value) {
      data.min = value
    }
    if (data.max === undefined || data.max < value) {
      data.max = value
    }
  }
}
// Can't use static properties yet (baseline >= 2022)
Widgets.MinMax.NAME = translate('Min/Max')

class Choices extends BaseWidget {
  match(value) {
    if (!this.userData.selected?.length) return false
    if (Array.isArray(value)) {
      const intersection = value.filter((item) => this.userData.selected.includes(item))
      if (intersection.length !== this.userData.selected.length) return true
    } else {
      value = value || EMPTY_VALUE
      if (!this.userData.selected.includes(value)) return true
    }
    return false
  }
  isActive() {
    return !!this.userData.selected?.length
  }

  computeInitialData(data, value) {
    data.choices ??= new Set()
    if (Array.isArray(value)) {
      data.choices = new Set([...data.choices, ...value])
    } else {
      value = value || EMPTY_VALUE
      data.choices.add(value)
    }
  }
}

Widgets.Checkbox = class extends Choices {
  constructor(parent, label, field) {
    super(parent, label, field)
    this.KEY = 'Checkbox'
  }
}
Widgets.Checkbox.NAME = translate('Multiple choices')

Widgets.Radio = class extends Choices {
  constructor(parent, label, field) {
    super(parent, label, field)
    this.KEY = 'Radio'
  }
  getFormField(field) {
    return 'FilterByRadio'
  }
}
Widgets.Radio.NAME = translate('Exclusive choice')

Widgets.Switch = class extends BaseWidget {
  constructor(parent, label, field) {
    super(parent, label, field)
    this.KEY = 'Switch'
  }
  match(value) {
    if (this.userData.wanted === undefined) return false
    return !!value !== this.userData.wanted
  }
  isActive() {
    return this.userData.wanted !== undefined
  }
  getFormField(field) {
    return 'FilterBySwitch'
  }
}
Widgets.Switch.NAME = translate('Yes/No')

const loadWidget = (key) => {
  return Widgets[key] || Widgets.Checkbox
}

export class Filters {
  constructor(parent, umap) {
    this._parent = parent
    this._umap = umap
    this.available = new Map()
    this.userData = {}
    this.load()
  }

  get size() {
    return this.available.size
  }

  isActive() {
    return Array.from(this.available.values()).some((obj) => obj.isActive())
  }

  // Loop on the data to compute the list of choices, min
  // and max values.
  computeInitialData() {
    const initialData = Object.fromEntries(
      Array.from(this.available.keys()).map((name) => [name, {}])
    )

    for (const [name, filter] of this.available.entries()) {
      const field = this._parent.fields.get(name)
      if (!field) continue
      this._parent.eachFeature((feature) => {
        let value = feature.properties[name]
        value = field.parse(value)
        filter.computeInitialData(initialData[name], value)
      })
    }
    return initialData
  }

  buildFormFields() {
    const initialData = this.computeInitialData()

    const formFields = []
    for (const [name, filter] of this.available.entries()) {
      const field = this._parent.fields.get(name)
      if (!field) continue
      formFields.push([
        `userData.${name}`,
        {
          initialData: initialData[name] || {},
          handler: filter.getFormField(field),
          label: Utils.escapeHTML(this.available.get(name).label || field.key),
          onClick: () => {
            this._parent
              .edit()
              .then((panel) => panel.scrollTo('details#fields-management'))
            this._parent.filters.createFilterForm(name)
          },
        },
      ])
    }
    return formFields
  }

  load() {
    let filters = this._parent.properties.filters
    if (!Array.isArray(filters)) filters = []
    for (const filter of filters) {
      this._add({ ...filter })
    }
  }

  dumps(sync = true) {
    const oldValue = this._parent.properties.filters
    this._parent.properties.filters = Array.from(
      this.available.entries().map(([key, filter]) => filter.dumps())
    )
    if (sync) {
      this._parent.sync.update(
        'properties.filters',
        this._parent.properties.filters,
        oldValue
      )
      this._parent.render(['properties.filters'])
    }
  }

  has(fieldKey) {
    return this.available.has(fieldKey)
  }

  get(fieldKey) {
    return this.available.get(fieldKey)
  }

  add({ fieldKey, label, widget }) {
    if (!this.available.has(fieldKey)) {
      this.update({ fieldKey, label, widget })
    }
  }

  _add({ fieldKey, label, widget }) {
    const klass = loadWidget(widget)
    const inst = new klass(this, label, fieldKey)
    this.available.set(fieldKey, inst)
  }

  update({ fieldKey, label, widget }) {
    this._add({ fieldKey, label, widget })
    this.dumps()
  }

  remove(fieldKey) {
    this.available.delete(fieldKey)
    this.dumps()
  }

  edit() {
    const template = `
      <div>
        <h3>${translate('Manage filters')}</h3>
      </div>
    `
    const body = Utils.loadTemplate(template)
    this._listFilters(this._umap.filters, body, translate('Map (all layers)'))
    this._umap.datalayers.active().forEach((datalayer) => {
      this._listFilters(
        datalayer.filters,
        body,
        `${datalayer.getName()} (${translate('single layer')})`
      )
    })
    this._umap.dialog.open({ template: body })
  }

  _listFilters(filters, container, title) {
    const template = `
      <details>
        <summary>${title}</summary>
        <ul data-ref=ul></ul>
        <div>
          <button type="button" data-ref=add>${translate('Add filter')}</button>
        </div>
      </details>
    `
    const [body, { ul, add }] = Utils.loadTemplateWithRefs(template)
    if (!filters._parent.fields.size) {
      add.disabled = true
      ul.appendChild(
        Utils.loadTemplate(
          `<li>${translate('Add a field prior to create a filter.')}</li>`
        )
      )
    } else if (!filters._parent.fields.isDefault()) {
      body.open = true
    }
    filters.available.forEach((filter, fieldKey) => {
      const [li, { edit, remove }] = Utils.loadTemplateWithRefs(
        `<li class="orderable with-toolbox" data-fieldkey="${fieldKey}">
          <span>
            ${filter.label || fieldKey}
          </span>
          <span>
            <button class="icon icon-16 icon-edit" data-ref="edit" title="${translate('Edit this filter')}"></button>
            <button class="icon icon-16 icon-delete" data-ref="remove" title="${translate('Remove this filter')}"></button>
            <i class="icon icon-16 icon-drag" title="${translate('Drag to reorder')}"></i>
          </span>
        </li>`
      )
      ul.appendChild(li)
      remove.addEventListener('click', () => {
        filters.remove(fieldKey)
        filters._parent
          .edit()
          .then((panel) => panel.scrollTo('details#fields-management'))
      })
      edit.addEventListener('click', () => {
        filters.createFilterForm(fieldKey)
      })
    })
    add.addEventListener('click', () => filters.createFilterForm())
    const onReorder = (src, dst, initialIndex, finalIndex) => {
      const orderedKeys = Array.from(ul.querySelectorAll('li')).map(
        (el) => el.dataset.fieldkey
      )
      const oldValue = Utils.CopyJSON(filters._parent.properties.filters)
      const copy = filters.available.entries().reduce((acc, [key, filter]) => {
        acc[key] = filter.dumps()
        return acc
      }, {})

      filters.available.clear()
      for (const fieldKey of orderedKeys) {
        filters.add({ ...copy[fieldKey] })
      }
      filters._parent.sync.update(
        'properties.filters',
        filters._parent.properties.filters,
        oldValue
      )
    }
    const orderable = new Orderable(ul, onReorder)
    container.appendChild(body)
  }

  createFilterForm(fieldKey) {
    let widget = 'Checkbox'
    const field = this._parent.fields.get(fieldKey)
    if (['Number', 'Date', 'Datetime'].includes(field?.TYPE)) {
      widget = 'MinMax'
    } else if (field?.TYPE === 'Boolean') {
      widget = 'Switch'
    }
    const properties = {
      target: this._parent.fields.size ? this._parent : null,
      fieldKey,
      widget,
      ...(this.available?.get(fieldKey)?.dumps() || {}),
    }
    const fieldKeys = fieldKey
      ? [fieldKey]
      : [
          '',
          ...Array.from(this._parent.fields.keys()).filter(
            (fieldKey) => !this.available.has(fieldKey)
          ),
        ]
    const metadata = [
      [
        'target',
        {
          handler: 'FilterTargetSelect',
          label: translate('Apply filter to'),
          disabled: Boolean(fieldKey),
        },
      ],
      [
        'fieldKey',
        {
          handler: 'Select',
          selectOptions: fieldKeys,
          label: translate('Filter on'),
        },
      ],
      [
        'label',
        { handler: 'Input', label: translate('Human readable name of the filter') },
      ],
      [
        'widget',
        {
          handler: 'MultiChoice',
          choices: Object.entries(Widgets).map(([key, klass]) => [key, klass.NAME]),
          label: translate('Widget for the filter'),
        },
      ],
    ]
    const form = new Form(properties, metadata, { umap: this._umap })
    let label
    if (fieldKey) {
      label = translate('Edit filter')
    } else {
      label = translate('Add filter')
    }

    const [container, { body, editField }] = Utils.loadTemplateWithRefs(`
      <div>
        <h3>${label}</h3>
        <div data-ref=body></div>
        <button type="button" data-ref=editField><i class="icon icon-16 icon-edit"></i>${translate('Edit this field')}</button>
      </div>
    `)
    body.appendChild(form.build())
    editField.addEventListener('click', () => {
      this._umap.dialog.accept().then(() => {
        this._parent.fields.editField(fieldKey)
      })
    })

    return this._umap.dialog.open({ template: container }).then(() => {
      const target = properties.target
      if (!target) return
      if (!properties.fieldKey) return
      if (fieldKey) {
        target.filters.update({ ...properties })
      } else {
        target.filters.add({ ...properties })
      }
      target.filters._parent
        .edit()
        .then((panel) => panel.scrollTo('details#fields-management'))
    })
  }

  buildForm(container) {
    const form = new FiltersForm(this, this.buildFormFields(), { className: 'formbox' })
    container.appendChild(form.build())
    return form
  }

  matchFeature(feature) {
    for (const [fieldKey, obj] of this.available.entries()) {
      if (!obj.isActive()) continue
      const field = this._parent.fields.get(fieldKey)
      // This field may only exist on another layer.
      if (!field) continue
      let value = feature.properties[fieldKey]
      value = field.parse(value)
      if (obj.match(value)) return true
    }
    return false
  }
}

class FiltersForm extends Form {
  buildField(field) {
    const [root, elements] = field.buildTemplate()
    elements.editFilter.addEventListener('click', field.properties.onClick)
    field.build()
  }

  getHelperTemplate(helper) {
    return helper.getTemplate()
  }

  getTemplate(helper) {
    return `
      <fieldset class="umap-filter">
        <legend data-ref=label>
          <span>${helper.properties.label}</span>
          <span class="filter-toolbox">
            <button type="button" class="icon icon-16 icon-edit show-on-edit" data-ref=editFilter title="${translate('Edit filter')}"></button>
          </span>
        </legend>
        <div data-ref="container">${helper.getTemplate()}</div>
      </fieldset>
    `
  }
}

const FilterBase = class extends Fields.Base {
  buildLabel() {}
}

const FilterByChoices = class extends FilterBase {
  getTemplate() {
    return '<ul data-ref=ul></ul>'
  }

  build() {
    this.type = this.getType()

    const choices = Array.from(this.properties.initialData.choices || [])
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
    input.checked = this.get()?.selected?.includes(value)
    input.dataset.value = value
    input.addEventListener('change', () => this.sync())
    this.elements.ul.appendChild(li)
  }

  toJS() {
    return {
      selected: [...this.elements.ul.querySelectorAll('input:checked')].map(
        (i) => i.dataset.value
      ),
    }
  }
}

Fields.FilterByCheckbox = class extends FilterByChoices {
  getType() {
    return 'checkbox'
  }
}

Fields.FilterByRadio = class extends FilterByChoices {
  getType() {
    return 'radio'
  }
}

Fields.MinMaxBase = class extends FilterBase {
  getLabels() {
    return [translate('Min'), translate('Max')]
  }

  prepareForHTML(value) {
    return value?.valueOf() ?? null
  }

  getTemplate() {
    const [minLabel, maxLabel] = this.getLabels()
    const { min, max } = this.properties.initialData
    const inputType = this.getInputType()
    const minHTML = this.prepareForHTML(min)
    const maxHTML = this.prepareForHTML(max)
    return `
      <label>${minLabel}<input min="${minHTML}" max="${maxHTML}" step=any type="${inputType}" data-ref=minInput /></label>
      <label>${maxLabel}<input min="${minHTML}" max="${maxHTML}" step=any type="${inputType}" data-ref=maxInput /></label>
    `
  }

  build() {
    this.minInput = this.elements.minInput
    this.maxInput = this.elements.maxInput
    const { min, max, type } = this.properties.initialData
    const { min: userMin, max: userMax } = this.get() || {}

    const currentMin = userMin !== undefined ? userMin : min
    const currentMax = userMax !== undefined ? userMax : max
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
    const opts = {}
    if (this.minInput.value !== '' && this.isMinModified()) {
      opts.min = this.prepareForJS(this.minInput.value)
    }
    if (this.maxInput.value !== '' && this.isMaxModified()) {
      opts.max = this.prepareForJS(this.maxInput.value)
    }
    return opts
  }
}

Fields.FilterByNumber = class extends Fields.MinMaxBase {
  getInputType(type) {
    return 'number'
  }

  prepareForJS(value) {
    return new Number(value)
  }
}

Fields.FilterByDate = class extends Fields.MinMaxBase {
  getInputType(type) {
    return 'date'
  }

  prepareForJS(value) {
    return new Date(value)
  }

  toLocaleDateTime(dt) {
    return new Date(dt.valueOf() - dt.getTimezoneOffset() * 60000)
  }

  prepareForHTML(value) {
    // Value must be in local time
    if (!value || isNaN(value)) return
    return this.toLocaleDateTime(value).toISOString().substr(0, 10)
  }

  getLabels() {
    return [translate('From'), translate('Until')]
  }
}

Fields.FilterByDateTime = class extends Fields.FilterByDate {
  getInputType() {
    return 'datetime-local'
  }

  prepareForHTML(value) {
    // Value must be in local time
    if (Number.isNaN(value)) return
    return this.toLocaleDateTime(value).toISOString().slice(0, -1)
  }
}

Fields.FilterTargetSelect = class extends Fields.Select {
  getOptions() {
    const options = []
    if (this.builder.properties.umap.fields.size) {
      if (!this.obj.target) {
        this.obj.target = this.builder.properties.umap
      }
      options.push([
        `map:${this.builder.properties.umap.id}`,
        `${this.builder.properties.umap.properties.name} (${translate('all layers')})`,
      ])
    }
    this.builder.properties.umap.datalayers.reverse().map((datalayer) => {
      if (datalayer.isBrowsable() && datalayer.fields.size) {
        if (!this.obj.target) {
          this.obj.target = datalayer
        }
        options.push([
          `layer:${datalayer.id}`,
          `${datalayer.getName()}  (${translate('single layer')})`,
        ])
      }
    })
    return options
  }

  toHTML() {
    if (!this.obj.target) return null
    // TODO: better way to check for class
    // Importing DataLayer will end in circular import
    const type = this.obj.target._umap ? 'layer' : 'map'
    return `${type}:${this.obj.target?.id}`
  }

  toJS() {
    const value = this.value()
    if (!value) return null
    const [type, id] = value.split(':')
    if (type === 'map') {
      return this.builder.properties.umap
    }
    return this.builder.properties.umap.datalayers[id]
  }
}

Fields.FilterBySwitch = class extends FilterBase {
  getTemplate() {
    return `
      <div class="ternary-switch">
        <input type="radio" id="${this.id}.1" name="${this.name}" value="true" />
        <label tabindex="0" for="${this.id}.1">${translate('yes')}</label>
        <input type="radio" id="${this.id}.2" name="${this.name}" value="unset" checked />
        <label tabindex="0" for="${this.id}.2">${translate('unset')}</label>
        <input type="radio" id="${this.id}.3" name="${this.name}" value="false" />
        <label tabindex="0" for="${this.id}.3">${translate('no')}</label>
      </div>
    `
  }

  build() {
    super.build()
    this.inputs = Array.from(this.form[this.name])
    for (const input of this.inputs) {
      input.addEventListener('change', () => this.sync())
    }
  }

  value() {
    return this.form[this.name].value
  }

  toJS() {
    if (this.value() === 'unset') return {}
    return { wanted: this.value() === 'true' }
  }
}

export const migrateLegacyFilters = (properties) => {
  const legacy = properties.advancedFilterKey || properties.facetKey
  if (!legacy) return false
  properties.filters ??= []
  properties.fields ??= []
  for (const filter of legacy.split(',')) {
    let [fieldKey, label, widget] = filter.split('|')
    let type = 'String'
    if (['number', 'date', 'datetime'].includes(widget)) {
      // Retrocompat
      if (widget === 'number') {
        type = 'Number'
      } else if (widget === 'datetime') {
        type = 'Datetime'
      } else if (widget === 'date') {
        type = 'Date'
      }
      widget = 'MinMax'
    }
    if (widget === 'radio') {
      widget = 'Radio'
    }
    if (!(widget in Widgets)) {
      widget = 'Checkbox'
    }
    properties.filters.push({ fieldKey, label, widget })
    properties.fields.push({ key: fieldKey, type })
  }
  delete properties.facetKey
  delete properties.advancedFilterKey
  return true
}
