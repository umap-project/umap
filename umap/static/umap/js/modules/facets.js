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

    names.forEach((name) => {
      const type = defined[name]['type']
      properties[name] = { type: type }
      this.selected[name] = { type: type }
      if (!['date', 'datetime', 'number'].includes(type)) {
        properties[name].choices = []
        this.selected[name].choices = []
      }
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
              value = value || L._('<empty value>')
              if (!properties[name].choices.includes(value)) {
                properties[name].choices.push(value)
              }
          }
        })
      })
    })
    return properties
  }

  redraw() {
    if (this.isOpen()) this.open()
  }

  isOpen() {
    return !!document.querySelector('.umap-facet-search')
  }

  open() {
    const container = L.DomUtil.create('div', 'umap-facet-search')
    const title = L.DomUtil.add(
      'h3',
      'umap-filter-title',
      container,
      L._('Facet search')
    )
    const defined = this.getDefined()
    const names = Object.keys(defined)
    const facetProperties = this.compute(names, defined)

    const filterFeatures = function () {
      let found = false
      this.map.eachBrowsableDataLayer((datalayer) => {
        datalayer.resetLayer(true)
        if (datalayer.hasDataVisible()) found = true
      })
      // TODO: display a results counter in the panel instead.
      if (!found) {
        this.map.ui.alert({
          content: L._('No results for these facets'),
          level: 'info',
        })
      }
    }

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

    const builder = new L.FormBuilder(this, fields, {
      callback: filterFeatures,
      callbackContext: this,
    })
    container.appendChild(builder.build())

    this.map.panel.open({ content: container })
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
