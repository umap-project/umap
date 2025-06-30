import colorbrewer from '../../../../vendors/colorbrewer/colorbrewer.js'
import { DomUtil, FeatureGroup } from '../../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../../i18n.js'
import * as Utils from '../../utils.js'
import { CircleMarker } from '../ui.js'
import { LayerMixin } from './base.js'

// Layer where each feature color is relative to the others,
// so we need all features before behing able to set one
// feature layer
const ClassifiedMixin = {
  initialize: function (datalayer) {
    this.datalayer = datalayer
    this.colorSchemes = Object.keys(colorbrewer)
      .filter((k) => k !== 'schemeGroups')
      .sort()
    const key = this.getType().toLowerCase()
    if (!Utils.isObject(this.datalayer.properties[key])) {
      this.datalayer.properties[key] = {}
    }
    this.ensureOptions(this.datalayer.properties[key])
    FeatureGroup.prototype.initialize.call(this, [], this.datalayer.properties[key])
    LayerMixin.onInit.call(this, this.datalayer._leafletMap)
  },

  ensureOptions: () => {},

  dataChanged: function () {
    this.redraw()
  },

  redraw: function () {
    this.compute()
    if (this._map) this.eachLayer(this._map.addLayer, this._map)
  },

  getStyleProperty: (feature) => {
    return feature.staticOptions.mainColor
  },

  getOption: function (option, feature) {
    if (!feature) return
    if (option === this.getStyleProperty(feature)) {
      const value = this._getOption(feature)
      return value
    }
  },

  addLayer: function (layer) {
    // Do not add yet the layer to the map
    // wait for datachanged event, so we can compute breaks only once
    const id = this.getLayerId(layer)
    this._layers[id] = layer
    return this
  },

  onAdd: function (map) {
    this.compute()
    LayerMixin.onAdd.call(this, map)
    return FeatureGroup.prototype.onAdd.call(this, map)
  },

  onRemove: function (map) {
    LayerMixin.onRemove.call(this, map)
    return FeatureGroup.prototype.onRemove.call(this, map)
  },

  getValues: function () {
    const values = []
    this.datalayer.features.forEach((feature) => {
      const value = this._getValue(feature)
      if (value !== undefined) values.push(value)
    })
    return values
  },

  renderLegend: function (container) {
    if (!this.datalayer.isLoaded()) return
    const parent = DomUtil.create('ul', '', container)
    const items = this.getLegendItems()
    for (const [color, label] of items) {
      const li = DomUtil.create('li', '', parent)
      const colorEl = DomUtil.create('span', 'datalayer-color', li)
      colorEl.style.backgroundColor = color
      const labelEl = DomUtil.create('span', '', li)
      labelEl.textContent = label
    }
  },

  getColorSchemes: function (classes) {
    const found = this.colorSchemes.filter((scheme) =>
      Boolean(colorbrewer[scheme][classes])
    )
    if (found.length) return found
    return [['', translate('Default')]]
  },
}

export const Choropleth = FeatureGroup.extend({
  statics: {
    NAME: translate('Choropleth'),
    TYPE: 'Choropleth',
  },
  includes: [LayerMixin, ClassifiedMixin],
  // Have defaults that better suit the choropleth mode.
  defaults: {
    color: 'white',
    fillOpacity: 0.7,
    weight: 2,
  },
  MODES: {
    kmeans: translate('K-means'),
    equidistant: translate('Equidistant'),
    jenks: translate('Jenks-Fisher'),
    quantiles: translate('Quantiles'),
    manual: translate('Manual'),
  },

  _getValue: function (feature) {
    const key = this.datalayer.properties.choropleth?.property || 'value'
    const value = +feature.properties[key]
    if (!Number.isNaN(value)) return value
  },

  compute: function () {
    const values = this.getValues()

    if (!values.length) {
      this.options.breaks = []
      this.options.colors = []
      return
    }
    const mode = this.datalayer.properties.choropleth?.mode
    let classes = +this.datalayer.properties.choropleth?.classes || 5
    let breaks
    classes = Math.min(classes, values.length)
    if (mode === 'manual') {
      const manualBreaks = this.datalayer.properties.choropleth?.breaks
      if (manualBreaks) {
        breaks = manualBreaks
          .split(',')
          .map((b) => +b)
          .filter((b) => !Number.isNaN(b))
      }
    } else if (mode === 'equidistant') {
      breaks = ss.equalIntervalBreaks(values, classes)
    } else if (mode === 'jenks') {
      breaks = ss.jenks(values, classes)
    } else if (mode === 'quantiles') {
      const quantiles = [...Array(classes)].map((e, i) => i / classes).concat(1)
      breaks = ss.quantile(values, quantiles)
    } else {
      breaks = ss.ckmeans(values, classes).map((cluster) => cluster[0])
      breaks.push(ss.max(values)) // Needed for computing the legend
    }
    this.options.breaks = breaks || []
    this.datalayer.properties.choropleth.breaks = this.options.breaks
      .map((b) => +b.toFixed(2))
      .join(',')
    let colorScheme = this.datalayer.properties.choropleth.brewer
    if (!colorbrewer[colorScheme]) colorScheme = 'Blues'
    this.options.colors = colorbrewer[colorScheme][this.options.breaks.length - 1] || []
  },

  _getOption: function (feature) {
    if (!feature) return // FIXME should not happen
    const featureValue = this._getValue(feature)
    // Find the bucket/step/limit that this value is less than and give it that color
    for (let i = 1; i < this.options.breaks.length; i++) {
      if (featureValue <= this.options.breaks[i]) {
        return this.options.colors[i - 1]
      }
    }
  },

  onEdit: function (field, builder) {
    // Only compute the breaks if we're dealing with choropleth
    if (!field.startsWith('properties.choropleth')) return
    // If user touches the breaks, then force manual mode
    if (field === 'properties.choropleth.breaks') {
      this.datalayer.properties.choropleth.mode = 'manual'
      if (builder) builder.helpers['properties.choropleth.mode'].fetch()
    }
    this.compute()
    // If user changes the mode or the number of classes,
    // then update the breaks input value
    if (
      field === 'properties.choropleth.mode' ||
      field === 'properties.choropleth.classes'
    ) {
      if (builder) builder.helpers['properties.choropleth.breaks'].fetch()
    }
  },

  getEditableProperties: function () {
    return [
      [
        'properties.choropleth.property',
        {
          handler: 'Select',
          selectOptions: this.datalayer.fieldKeys,
          label: translate('Choropleth property value'),
        },
      ],
      [
        'properties.choropleth.brewer',
        {
          handler: 'Select',
          label: translate('Choropleth color palette'),
          selectOptions: this.colorSchemes,
        },
      ],
      [
        'properties.choropleth.classes',
        {
          handler: 'Range',
          min: 3,
          max: 9,
          step: 1,
          label: translate('Choropleth classes'),
          helpText: translate('Number of desired classes (default 5)'),
        },
      ],
      [
        'properties.choropleth.breaks',
        {
          handler: 'BlurInput',
          label: translate('Choropleth breakpoints'),
          helpText: translate(
            'Comma separated list of numbers, including min and max values.'
          ),
        },
      ],
      [
        'properties.choropleth.mode',
        {
          handler: 'MultiChoice',
          default: 'kmeans',
          choices: Object.entries(this.MODES),
          label: translate('Choropleth mode'),
        },
      ],
    ]
  },

  getLegendItems: function () {
    return this.options.breaks.slice(0, -1).map((el, index) => {
      const from = +this.options.breaks[index].toFixed(1)
      const to = +this.options.breaks[index + 1].toFixed(1)
      return [this.options.colors[index], `${from} - ${to}`]
    })
  },
})

export const Circles = FeatureGroup.extend({
  statics: {
    NAME: translate('Proportional circles'),
    TYPE: 'Circles',
  },
  includes: [LayerMixin, ClassifiedMixin],
  defaults: {
    weight: 1,
    UIClass: CircleMarker,
  },

  ensureOptions: function (options) {
    if (!Utils.isObject(this.datalayer.properties.circles.radius)) {
      this.datalayer.properties.circles.radius = {}
    }
  },

  _getValue: function (feature) {
    const key = this.datalayer.properties.circles.property || 'value'
    const value = +feature.properties[key]
    if (!Number.isNaN(value)) return value
  },

  compute: function () {
    const values = this.getValues()
    this.options.minValue = Math.sqrt(Math.min(...values))
    this.options.maxValue = Math.sqrt(Math.max(...values))
    this.options.minPX = this.datalayer.properties.circles.radius?.min || 2
    this.options.maxPX = this.datalayer.properties.circles.radius?.max || 50
  },

  onEdit: function (field, builder) {
    this.compute()
  },

  _computeRadius: function (value) {
    const valuesRange = this.options.maxValue - this.options.minValue
    const pxRange = this.options.maxPX - this.options.minPX
    const radius =
      this.options.minPX +
      ((Math.sqrt(value) - this.options.minValue) / valuesRange) * pxRange
    return radius || this.options.minPX
  },

  _getOption: function (feature) {
    if (!feature) return // FIXME should not happen
    return this._computeRadius(this._getValue(feature))
  },

  getEditableProperties: function () {
    return [
      [
        'properties.circles.property',
        {
          handler: 'Select',
          selectOptions: this.datalayer.fieldKeys,
          label: translate('Property name to compute circles'),
        },
      ],
      [
        'properties.circles.radius.min',
        {
          handler: 'Range',
          label: translate('Min circle radius'),
          min: 2,
          max: 10,
          step: 1,
        },
      ],
      [
        'properties.circles.radius.max',
        {
          handler: 'Range',
          label: translate('Max circle radius'),
          min: 12,
          max: 50,
          step: 2,
        },
      ],
    ]
  },

  getStyleProperty: (feature) => {
    return 'radius'
  },

  renderLegend: function (container) {
    const parent = DomUtil.create('ul', 'circles-layer-legend', container)
    const color = this.datalayer.getProperty('color')
    const values = this.getValues()
    if (!values.length) return
    values.sort((a, b) => a - b)
    const minValue = values[0]
    const maxValue = values[values.length - 1]
    const medianValue = values[Math.round(values.length / 2)]
    const items = [
      [this.options.minPX, minValue],
      [this._computeRadius(medianValue), medianValue],
      [this.options.maxPX, maxValue],
    ]
    for (const [size, label] of items) {
      const li = DomUtil.create('li', '', parent)
      const circleEl = DomUtil.create('span', 'circle', li)
      circleEl.style.backgroundColor = color
      circleEl.style.height = `${size * 2}px`
      circleEl.style.width = `${size * 2}px`
      circleEl.style.opacity = this.datalayer.getProperty('opacity')
      const labelEl = DomUtil.create('span', 'label', li)
      labelEl.textContent = label
    }
  },
})

export const Categorized = FeatureGroup.extend({
  statics: {
    NAME: translate('Categorized'),
    TYPE: 'Categorized',
  },
  includes: [LayerMixin, ClassifiedMixin],
  MODES: {
    manual: translate('Manual'),
    alpha: translate('Alphabetical'),
  },
  defaults: {
    color: 'white',
    // fillColor: 'red',
    fillOpacity: 0.7,
    weight: 2,
  },

  _getValue: function (feature) {
    const key =
      this.datalayer.properties.categorized.property || this.datalayer.fieldKeys[0]
    return feature.properties[key]
  },

  _getOption: function (feature) {
    if (!feature) return // FIXME should not happen
    const featureValue = this._getValue(feature)
    for (let i = 0; i < this.options.categories.length; i++) {
      if (featureValue === this.options.categories[i]) {
        return this.options.colors[i]
      }
    }
  },

  compute: function () {
    const values = this.getValues()

    if (!values.length) {
      this.options.categories = []
      this.options.colors = []
      return
    }
    const mode = this.datalayer.properties.categorized.mode
    let categories = []
    if (mode === 'manual') {
      const manualCategories = this.datalayer.properties.categorized.categories
      if (manualCategories) {
        categories = manualCategories.split(',')
      }
    } else {
      categories = values
        .filter((val, idx, arr) => arr.indexOf(val) === idx)
        .sort(Utils.naturalSort)
    }
    this.options.categories = categories
    this.datalayer.properties.categorized.categories = this.options.categories.join(',')
    const colorScheme = this.datalayer.properties.categorized.brewer
    this._classes = this.options.categories.length
    if (colorbrewer[colorScheme]?.[this._classes]) {
      this.options.colors = colorbrewer[colorScheme][this._classes]
    } else {
      this.options.colors = colorbrewer?.Accent[this._classes]
        ? colorbrewer?.Accent[this._classes]
        : Utils.COLORS
    }
  },

  getEditableProperties: function () {
    return [
      [
        'properties.categorized.property',
        {
          handler: 'Select',
          selectOptions: this.datalayer.fieldKeys,
          label: translate('Category property'),
        },
      ],
      [
        'properties.categorized.brewer',
        {
          handler: 'Select',
          label: translate('Color palette'),
          getOptions: () => this.getColorSchemes(this._classes),
        },
      ],
      [
        'properties.categorized.categories',
        {
          handler: 'BlurInput',
          label: translate('Categories'),
          helpText: translate('Comma separated list of categories.'),
        },
      ],
      [
        'properties.categorized.mode',
        {
          handler: 'MultiChoice',
          default: 'alpha',
          choices: Object.entries(this.MODES),
          label: translate('Categories mode'),
        },
      ],
    ]
  },

  onEdit: function (field, builder) {
    // Only compute the categories if we're dealing with categorized
    if (!field.startsWith('properties.categorized') && field !== 'properties.type') {
      return
    }
    // If user touches the categories, then force manual mode
    if (field === 'properties.categorized.categories') {
      this.datalayer.properties.categorized.mode = 'manual'
      if (builder) builder.helpers['properties.categorized.mode'].fetch()
    }
    this.compute()
    // Rebuild list of color palettes when aggregation property changes.
    builder?.helpers['properties.categorized.brewer']?.fetch()
    // If user changes the mode
    // then update the categories input value
    if (field === 'properties.categorized.mode') {
      if (builder) builder.helpers['properties.categorized.categories'].fetch()
    }
  },

  getLegendItems: function () {
    return this.options.categories.map((limit, index) => {
      return [this.options.colors[index], this.options.categories[index]]
    })
  },
})
