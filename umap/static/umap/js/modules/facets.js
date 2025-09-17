import { DomEvent, DomUtil } from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'
import { Form } from './form/builder.js'
import * as Utils from './utils.js'
import Orderable from './orderable.js'

const WIDGETS = ['checkbox', 'radio', 'minmax']

class FacetsForm extends Form {
  buildField(field) {
    const [root, elements] = field.buildTemplate()
    elements.editFacet.addEventListener('click', field.properties.onClick)
    field.build()
  }

  getHelperTemplate(helper) {
    return helper.getTemplate()
  }
}

export default class Facets {
  constructor(umap) {
    this._umap = umap
    this.selected = {}
    this.load()
  }

  get size() {
    return this.defined.size
  }

  getDataType(name) {
    if (this._umap.fields.has(name)) {
      return this._umap.fields.get(name).type
    }
    for (const datalayer of this._umap.datalayers.active()) {
      if (datalayer.fields.has(name)) {
        return datalayer.fields.get(name).type
      }
    }
  }

  compute() {
    const properties = {}

    for (const [name, props] of this.defined.entries()) {
      const widget = props.widget
      const dataType = props.dataType || this.getDataType(name)
      properties[name] = { widget, dataType }
      properties[name].choices = new Set()
    }

    this._umap.datalayers.browsable().map((datalayer) => {
      datalayer.features.forEach((feature) => {
        for (const [name, props] of this.defined.entries()) {
          const dataType = properties[name].dataType
          let value = feature.properties[name]
          const widget = this.defined.get(name).widget
          this.defined.get(name).dataType ??= dataType
          const parser = this.getParser(dataType)
          value = parser(value)
          switch (dataType) {
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
        }
      })
    })
    return properties
  }

  isActive() {
    for (const { type, min, max, choices } of Object.values(this.selected)) {
      if (min !== undefined || max !== undefined || choices?.length) {
        return true
      }
    }
    return false
  }

  build() {
    const facetProperties = this.compute()

    const fields = Array.from(this.defined.keys()).map((name) => {
      const criteria = facetProperties[name]
      let handler = 'FacetSearchChoices'
      if (criteria.widget === 'minmax' || criteria.widget === undefined) {
        if (criteria.dataType === 'Number') {
          handler = 'FacetSearchNumber'
        } else if (criteria.dataType === 'Date') {
          handler = 'FacetSearchDate'
        } else if (criteria.dataType === 'Datetime') {
          handler = 'FacetSearchDateTime'
        }
      }
      const label = `
        <span>${Utils.escapeHTML(this.defined.get(name).label)}
          <button class="icon icon-16 icon-edit show-on-edit" data-ref=editFacet></button>
        </span>`
      return [
        `selected.${name}`,
        {
          criteria: { ...criteria, choices: Array.from(criteria.choices) },
          handler: handler,
          label: label,
          onClick: () => {
            this._umap
              .edit()
              .then((panel) => panel.scrollTo('details#fields-management'))
            this._umap.facets.filterForm(name)
          },
        },
      ]
    })

    return fields
  }

  load() {
    this.defined = new Map(Object.entries(this._umap.properties.facets || {}))
    const old =
      this._umap.properties.advancedFilterKey || this._umap.properties.facetKey
    if (old) {
      for (const facet of old.split(',')) {
        let [name, label, widget] = facet.split('|')
        let dataType
        if (['number', 'date', 'datetime'].includes(widget)) {
          // Retrocompat
          if (widget === 'number') {
            dataType = 'Number'
          } else if (widget === 'datetime') {
            dataType = 'Datetime'
          } else if (widget === 'date') {
            dataType = 'Date'
          }
          widget = 'minmax'
        }
        if (!WIDGETS.includes(widget)) {
          widget = 'checkbox'
        }
        this.defined.set(name, { label: label || name, widget, dataType })
      }
      delete this._umap.properties.facetKey
      delete this._umap.properties.advancedFilterKey
      this.dumps(false)
    }
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
    const oldValue = this._umap.properties.facets
    this._umap.properties.facets = Object.fromEntries(
      this.defined.entries().map(
        // Remove dataType, which we don't want to store
        ([key, { label, widget }]) => [key, { label, widget }]
      )
    )
    if (sync) {
      this._umap.sync.update(
        'properties.facets',
        this._umap.properties.facets,
        oldValue
      )
      this._umap.render(['properties.facets'])
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
      <fieldset class="formbox" id="facets">
        <legend data-help=facets>${translate('Filters')}</legend>
        <ul data-ref=ul></ul>
        <button class="umap-add" type="button" data-ref=add>${translate('Add filter')}</button>
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
        this._umap.edit().then((panel) => panel.scrollTo('details#fields-management'))
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
      const oldFacets = Utils.CopyJSON(this._umap.properties.facets)
      const copy = Object.fromEntries(this.defined)
      this.defined.clear()
      for (const key of orderedKeys) {
        this.add({ name: key, ...copy[key] })
      }
      this._umap.sync.update(
        'properties.facets',
        this._umap.properties.facets,
        oldFacets
      )
    }
    const orderable = new Orderable(ul, onReorder)
    container.appendChild(body)
  }

  filterForm(name) {
    const properties = { name, ...(this.defined.get(name) || {}) }
    const fieldKeys = name
      ? [name]
      : ['', ...this._umap.fieldKeys.filter((key) => !this.defined.has(key))]
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
      this._umap.fields.editField(name)
    })

    return this._umap.dialog.open({ template: container }).then(() => {
      if (!properties.name) return
      if (name) {
        this.update({ ...properties })
      } else {
        this.add({ ...properties })
      }
      this._umap.edit().then((panel) => panel.scrollTo('details#fields-management'))
    })
  }

  buildForm(container) {
    const form = new FacetsForm(this, this.build())
    container.appendChild(form.build())
    return form
  }
}
