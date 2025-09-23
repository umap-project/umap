import { DomEvent, DomUtil } from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'
import { Form } from './form/builder.js'
import * as Utils from './utils.js'
import Orderable from './orderable.js'
import { Fields } from './form/fields.js'

const WIDGETS = ['checkbox', 'radio', 'minmax']

class FiltersForm extends Form {
  buildField(field) {
    const [root, elements] = field.buildTemplate()
    elements.editFilter.addEventListener('click', field.properties.onClick)
    field.build()
  }

  getHelperTemplate(helper) {
    return helper.getTemplate()
  }
}

export default class Filters {
  constructor(parent, umap) {
    this._parent = parent
    this._umap = umap
    this.selected = {}
    this.load()
  }

  get size() {
    return this.defined.size
  }

  isActive() {
    for (const { type, min, max, choices } of Object.values(this.selected)) {
      if (min !== undefined || max !== undefined || choices?.length) {
        return true
      }
    }
    return false
  }

  // Loop on the data to compute the list of choices, min
  // and max values.
  compute() {
    const properties = Object.fromEntries(this.defined.keys().map((name) => [name, {}]))

    for (const name of this.defined.keys()) {
      const field = this._parent.fields.get(name)
      if (!field) continue
      properties[name].choices ??= new Set()
      const parser = this.getParser(field.type)
      this._parent.eachFeature((feature) => {
        let value = feature.properties[name]
        value = parser(value)
        switch (field.type) {
          case 'Date':
          case 'Datetime':
          case 'Number':
            if (!Number.isNaN(value)) {
              // Special cases where we want to be lousy when checking isNaN without
              // coercing to a Number first because we handle multiple types.
              // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/
              // Reference/Global_Objects/Number/isNaN
              // biome-ignore lint/suspicious/noGlobalIsNan: see above.
              if (isNaN(properties[name].min) || properties[name].min > value) {
                properties[name].min = value
              }
              // biome-ignore lint/suspicious/noGlobalIsNan: see above.
              if (isNaN(properties[name].max) || properties[name].max < value) {
                properties[name].max = value
              }
            }
            break
          case 'Enum':
            properties[name].choices = Array.from(
              new Set([...properties[name].choices, ...value])
            )
            break
          default:
            value = value || translate('<empty value>')
            properties[name].choices.add(value)
        }
      })
    }
    return properties
  }

  buildFormFields() {
    const filterProperties = this.compute()

    const formFields = []
    for (const name of this.defined.keys()) {
      const criteria = filterProperties[name] || {}
      const field = this._parent.fields.get(name)
      if (!field) continue
      const type = field.type
      let handler = 'FilterByChoices'
      if (criteria.widget === 'minmax' || criteria.widget === undefined) {
        if (type === 'Number') {
          handler = 'FilterByNumber'
        } else if (type === 'Date') {
          handler = 'FilterByDate'
        } else if (type === 'Datetime') {
          handler = 'FilterByDateTime'
        }
      }
      const label = `
        <span>${Utils.escapeHTML(this.defined.get(name).label || field.key)}
          <button class="icon icon-16 icon-edit show-on-edit" data-ref=editFilter></button>
        </span>`
      formFields.push([
        `selected.${name}`,
        {
          criteria: { ...criteria, choices: Array.from(criteria.choices) },
          handler: handler,
          label: label,
          onClick: () => {
            this._parent
              .edit()
              .then((panel) => panel.scrollTo('details#fields-management'))
            this._parent.filters.filterForm(name)
          },
        },
      ])
    }
    return formFields
  }

  load() {
    this.defined = new Map(Object.entries(this._parent.properties.filters || {}))
    this.loadLegacy()
  }

  loadLegacy() {
    const legacy =
      this._parent.properties.advancedFilterKey || this._parent.properties.facetKey
    if (!legacy) return
    for (const filter of legacy.split(',')) {
      let [key, label, widget] = filter.split('|')
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
        widget = 'minmax'
      }
      if (!WIDGETS.includes(widget)) {
        widget = 'checkbox'
      }
      this.defined.set(key, { label: label || key, widget })
      if (!this._parent.fields.has(key)) {
        this._parent.fields.add({ key, type })
      }
    }
    delete this._parent.properties.facetKey
    delete this._parent.properties.advancedFilterKey
    this.dumps(false)
    this._parent._migrated = true
  }

  getParser(type) {
    switch (type) {
      case 'Number':
        return Number.parseFloat
      case 'Datetime':
        return (v) => new Date(v)
      case 'Date':
        return Utils.parseNaiveDate
      case 'Enum':
        return (v) =>
          String(v || '')
            .split(',')
            .map((s) => s.trim())
      default:
        return (v) => String(v || '')
    }
  }

  dumps(sync = true) {
    const oldValue = this._parent.properties.filters
    this._parent.properties.filters = Object.fromEntries(this.defined.entries())
    if (sync) {
      this._parent.sync.update(
        'properties.filters',
        this._parent.properties.filters,
        oldValue
      )
      this._parent.render(['properties.filters'])
    }
  }

  has(name) {
    return this.defined.has(name)
  }

  get(name) {
    return this.defined.get(name)
  }

  add({ name, label, widget }) {
    if (!this.defined.has(name)) {
      this.update({ name, label, widget })
    }
  }

  update({ name, label, widget }) {
    this.defined.set(name, { label, widget })
    this.dumps()
  }

  remove(name) {
    this.defined.delete(name)
    this.dumps()
  }

  edit(container) {
    const template = `
      <fieldset class="formbox" id="filters">
        <legend data-help=filters>${translate('Filters')}</legend>
        <ul data-ref=ul></ul>
        <button class="umap-add" type="button" data-ref=add>
          <i class="icon icon-16 icon-add"></i> ${translate('Add filter')}
        </button>
      </fieldset>
    `
    const [body, { ul, add }] = Utils.loadTemplateWithRefs(template)
    this._umap.help.parse(body)
    this.defined.forEach((props, key) => {
      const [li, { edit, remove }] = Utils.loadTemplateWithRefs(
        `<li class="orderable" data-key="${key}">
          <button class="icon icon-16 icon-edit" data-ref="edit" title="${translate('Edit this filter')}"></button>
          <button class="icon icon-16 icon-delete" data-ref="remove" title="${translate('Remove this filter')}"></button>
          <i class="icon icon-16 icon-drag" title="${translate('Drag to reorder')}"></i>
          ${props.label || key}
        </li>`
      )
      ul.appendChild(li)
      remove.addEventListener('click', () => {
        this.remove(key)
        this._parent.edit().then((panel) => panel.scrollTo('details#fields-management'))
      })
      edit.addEventListener('click', () => {
        this.filterForm(key)
      })
    })
    add.addEventListener('click', () => this.filterForm())
    const onReorder = (src, dst, initialIndex, finalIndex) => {
      const orderedKeys = Array.from(ul.querySelectorAll('li')).map(
        (el) => el.dataset.key
      )
      const oldValue = Utils.CopyJSON(this._parent.properties.filters)
      const copy = Object.fromEntries(this.defined)
      this.defined.clear()
      for (const key of orderedKeys) {
        this.add({ name: key, ...copy[key] })
      }
      this._parent.sync.update(
        'properties.filters',
        this._parent.properties.filters,
        oldValue
      )
    }
    const orderable = new Orderable(ul, onReorder)
    container.appendChild(body)
  }

  filterForm(name) {
    let widget = WIDGETS[0]
    const field = this._parent.fields.get(name)
    if (['Number', 'Date', 'Datetime'].includes(field?.type)) {
      widget = 'minmax'
    }
    const properties = { name, widget, ...(this.defined.get(name) || {}) }
    const fieldKeys = name
      ? [name]
      : ['', ...this._parent.fieldKeys.filter((key) => !this.defined.has(key))]
    const metadata = [
      [
        'name',
        {
          handler: 'Select',
          selectOptions: fieldKeys,
          label: translate('Field to filter on'),
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
          choices: WIDGETS,
          label: translate('Widget for the filter'),
        },
      ],
    ]
    const form = new Form(properties, metadata)
    const [container, { body, editField }] = Utils.loadTemplateWithRefs(`
      <div>
        <h3>${translate('Manage filter')}</h3>
        <div data-ref=body></div>
        <button type="button" data-ref=editField><i class="icon icon-16 icon-edit"></i>${translate('Edit this field')}</button>
      </div>
    `)
    body.appendChild(form.build())
    editField.addEventListener('click', () => {
      this._umap.dialog.accept()
      this._parent.fields.editField(name)
    })

    return this._umap.dialog.open({ template: container }).then(() => {
      if (!properties.name) return
      if (name) {
        this.update({ ...properties })
      } else {
        this.add({ ...properties })
      }
      this._parent.edit().then((panel) => panel.scrollTo('details#fields-management'))
    })
  }

  buildForm(container) {
    const form = new FiltersForm(this, this.buildFormFields())
    container.appendChild(form.build())
    return form
  }
}

Fields.FilterBase = class extends Fields.Base {
  buildLabel() {}
}

Fields.FilterByChoices = class extends Fields.FilterBase {
  getTemplate() {
    return `
      <fieldset class="umap-filter">
        <legend data-ref=label>${this.properties.label}</legend>
        <ul data-ref=ul></ul>
      </fieldset>
      `
  }

  build() {
    this.type = this.properties.criteria.widget || 'checkbox'

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
    input.checked = this.get()?.choices?.includes(value)
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

Fields.MinMaxBase = class extends Fields.FilterBase {
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
    const { min, max, widget } = this.properties.criteria
    this.type = widget
    const inputType = this.getInputType(this.type)
    const minHTML = this.prepareForHTML(min)
    const maxHTML = this.prepareForHTML(max)
    return `
      <fieldset class="umap-filter">
        <legend>${this.properties.label}</legend>
        <label>${minLabel}<input min="${minHTML}" max="${maxHTML}" step=any type="${inputType}" data-ref=minInput /></label>
        <label>${maxLabel}<input min="${minHTML}" max="${maxHTML}" step=any type="${inputType}" data-ref=maxInput /></label>
      </fieldset>
    `
  }

  build() {
    this.minInput = this.elements.minInput
    this.maxInput = this.elements.maxInput
    const { min, max, type } = this.properties.criteria
    const { min: modifiedMin, max: modifiedMax } = this.get() || {}

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
