import { DomUtil, DomEvent, stamp } from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'
import * as Utils from './utils.js'

export default class Facets {
  constructor(map) {
    this.map = map
    this.selected = {}
  }

  compute(names, defined) {
    const properties = {}
    let selected

    names.forEach((name) => {
      const type = defined[name]['type']
      properties[name] = { type: type }
      selected = this.selected[name] || {}
      selected.type = type
      if (!['date', 'datetime', 'number'].includes(type)) {
        properties[name].choices = []
        selected.choices = selected.choices || []
      }
      this.selected[name] = selected
    })

    this.map.eachBrowsableDataLayer((datalayer) => {
      datalayer.eachFeature((feature) => {
        names.forEach((name) => {
          let value = feature.properties[name]
          const type = defined[name]['type']
          const parser = this.getParser(type)
          value = parser(value)
          switch (type) {
            case 'date':
            case 'datetime':
            case 'number':
              if (!isNaN(value)) {
                if (isNaN(properties[name].min) || properties[name].min > value) {
                  properties[name].min = value
                }
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
        })
      })
    })
    return properties
  }

  isActive() {
    for (let { type, min, max, choices } of Object.values(this.selected)) {
      if (min !== undefined || max != undefined || choices?.length) {
        return true
      }
    }
    return false
  }

  build() {
    const defined = this.getDefined()
    const names = Object.keys(defined)
    const facetProperties = this.compute(names, defined)

    const fields = names.map((name) => {
      let criteria = facetProperties[name]
      let handler = 'FacetSearchChoices'
      switch (criteria['type']) {
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
      let label = defined[name]['label']
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
    return (this.map.options.facetKey || '').split(',').reduce((acc, curr) => {
      let [name, label, type] = curr.split('|')
      type = allowedTypes.includes(type) ? type : defaultType
      acc[name] = { label: label || name, type: type }
      return acc
    }, {})
  }

  getParser(type) {
    switch (type) {
      case 'number':
        return parseFloat
      case 'datetime':
        return (v) => new Date(v)
      case 'date':
        return Utils.parseNaiveDate
      default:
        return (v) => String(v || '')
    }
  }
}
