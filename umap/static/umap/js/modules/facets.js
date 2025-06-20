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
      const type = defined.get(name).type
      properties[name] = { type: type }
      selected = this.selected[name] || {}
      selected.type = type
      if (!['date', 'datetime', 'number'].includes(type)) {
        properties[name].choices = []
        selected.choices = selected.choices || []
      }
      this.selected[name] = selected
    }

    this._umap.datalayers.browsable().map((datalayer) => {
      datalayer.features.forEach((feature) => {
        for (const name of names) {
          let value = feature.properties[name]
          const type = defined.get(name).type
          const parser = this.getParser(type)
          value = parser(value)
          switch (type) {
            case 'date':
            case 'datetime':
            case 'number':
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
            default:
              value = value || translate('<empty value>')
              if (!properties[name].choices.includes(value)) {
                properties[name].choices.push(value)
              }
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
    const defined = this.getDefined()
    const names = [...defined.keys()]
    const facetProperties = this.compute(names, defined)

    const fields = names.map((name) => {
      const criteria = facetProperties[name]
      let handler = 'FacetSearchChoices'
      switch (criteria.type) {
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
    const defaultType = 'checkbox'
    const allowedTypes = [defaultType, 'radio', 'number', 'date', 'datetime']
    const defined = new Map()
    if (!this._umap.properties.facetKey) return defined
    return (this._umap.properties.facetKey || '').split(',').reduce((acc, curr) => {
      let [name, label, type] = curr.split('|')
      type = allowedTypes.includes(type) ? type : defaultType
      acc.set(name, { label: label || name, type: type })
      return acc
    }, defined)
  }

  getParser(type) {
    switch (type) {
      case 'number':
        return Number.parseFloat
      case 'datetime':
        return (v) => new Date(v)
      case 'date':
        return Utils.parseNaiveDate
      default:
        return (v) => String(v || '')
    }
  }

  dumps(parsed) {
    const dumped = []
    for (const [property, { label, type }] of parsed) {
      dumped.push([property, label, type].filter(Boolean).join('|'))
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

  add(property, label, type) {
    const defined = this.getDefined()
    if (!defined.has(property)) {
      defined.set(property, { label, type })
      this.dumps(defined)
    }
  }

  remove(property) {
    const defined = this.getDefined()
    defined.delete(property)
    this.dumps(defined)
  }
}
