import { DomEvent, DomUtil } from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'
import * as Utils from './utils.js'

export default class Facets {
  constructor(umap) {
    this._umap = umap
    this.selected = {}
  }

  compute(names, defined) {
    const properties = {}
    let selected

    for (const name of names) {
      const widget = defined.get(name).widget
      properties[name] = { widget }
      selected = this.selected[name] || {}
      selected.widget = widget
      if (!['date', 'datetime', 'number'].includes(widget)) {
        properties[name].choices = new Set()
        selected.choices = selected.choices || new Set()
      }
      this.selected[name] = selected
    }

    this._umap.datalayers.browsable().map((datalayer) => {
      const fields = datalayer.properties.fields.reduce((fields, field) => {
        fields[field.key] = field
        return fields
      }, {})
      datalayer.features.forEach((feature) => {
        for (const name of names) {
          let dataType = fields[name].type || 'String'
          // TODO retrocompat, guess dataType from widget if undefined
          let value = feature.properties[name]
          const widget = defined.get(name).widget
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
    if (selected.choices) selected.choices = Array.from(selected.choices)
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
    const defined = this.getDefined()
    const names = [...defined.keys()]
    const facetProperties = this.compute(names, defined)

    const fields = names.map((name) => {
      const criteria = facetProperties[name]
      let handler = 'FacetSearchChoices'
      switch (criteria.widget) {
        case 'number':
          handler = 'FacetSearchNumber'
          break
        case 'date':
          handler = 'FacetSearchDate'
          break
        case 'datetime':
          handler = 'FacetSearchDateTime'
          break
      }
      const label = defined.get(name).label
      return [
        `selected.${name}`,
        {
          criteria: criteria,
          handler: handler,
          label: label,
        },
      ]
    })

    return fields
  }

  getDefined() {
    const defaultWidget = 'checkbox'
    const allowedWidgets = [defaultWidget, 'radio', 'number', 'date', 'datetime']
    const defined = new Map()
    if (!this._umap.properties.facetKey) return defined
    return (this._umap.properties.facetKey || '').split(',').reduce((acc, curr) => {
      let [name, label, widget] = curr.split('|')
      widget = allowedWidgets.includes(widget) ? widget : defaultWidget
      acc.set(name, { label: label || name, widget })
      return acc
    }, defined)
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

  dumps(parsed) {
    const dumped = []
    for (const [property, { label, widget }] of parsed) {
      dumped.push([property, label, widget].filter(Boolean).join('|'))
    }
    const oldValue = this._umap.properties.facetKey
    this._umap.properties.facetKey = dumped.join(',')
    this._umap.sync.update(
      'properties.facetKey',
      this._umap.properties.facetKey,
      oldValue
    )
  }

  has(property) {
    return this.getDefined().has(property)
  }

  add(property, label, widget) {
    const defined = this.getDefined()
    if (!defined.has(property)) {
      defined.set(property, { label, widget })
      this.dumps(defined)
    }
  }

  remove(property) {
    const defined = this.getDefined()
    defined.delete(property)
    this.dumps(defined)
  }
}
