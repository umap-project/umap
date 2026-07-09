import * as DOMUtils from '../domutils.js'
import { translate } from '../i18n.js'
import * as Utils from '../utils.js'

async function loadColors() {
  const { schemeGroups, ...schemes } = (await import('colorbrewer')).default
  return schemes
}

export function loadType(type) {
  switch (type) {
    case 'Choropleth':
      return Choropleth
    case 'Categorized':
      return Categorized
    case 'Circles':
      return Circles
    case 'Cluster':
      return Cluster
    case 'Heat':
      return Heat
    default:
      return DefaultType
  }
}

function buildCaption(items) {
  const ul = DOMUtils.loadTemplate('<ul></ul>')
  for (const [color, label] of items) {
    // TODO: do we really need this?
    // const opacity = this.datalayer.getOption('fillOpacity')
    const li = DOMUtils.loadTemplate(Utils.sanitizeVars`
      <li>
        <span class="datalayer-color" style="background-color: ${color};"></span>
        <span>${label}</span>
      </li>
    `)
    ul.appendChild(li)
  }
  return ul
}

class DefaultType {
  static type = 'Default'
  static name = translate('Default')
  static browsable = true

  static async compute() {
    return { properties: {} }
  }

  static ensureProperties(properties) {
    if (this.key) properties[this.key] ??= {}
  }

  static async editableProperties() {
    return []
  }
}

class Choropleth extends DefaultType {
  static type = 'Choropleth'
  static name = translate('Choropleth')
  static key = 'choropleth'
  static modes = {
    kmeans: translate('K-means'),
    equidistant: translate('Equidistant'),
    jenks: translate('Jenks-Fisher'),
    quantiles: translate('Quantiles'),
    manual: translate('Manual'),
  }
  static defaults = {
    color: 'white',
    fillOpacity: 0.7,
    weight: 2,
  }

  static async compute(properties, features, fields) {
    // TODO check in prod own may classified layers does not have defined
    // the property (and thus fallback on "value").
    const key = properties[this.key]?.property || fields[0] || 'value'
    const values = features.map((feature) => +feature.properties?.[key])
    let breaks = []
    let colors = []

    if (!values.length) {
      return { properties: {}, caption: null }
    }
    const mode = properties.choropleth?.mode
    let classes = +properties.choropleth?.classes || 5
    classes = Math.min(classes, values.length)
    if (mode === 'manual') {
      const manualBreaks = properties.choropleth?.breaks
      if (manualBreaks) {
        breaks = manualBreaks
          .split(',')
          .map((b) => +b)
          .filter((b) => !Number.isNaN(b))
      }
    } else if (mode === 'equidistant') {
      const equalIntervalBreaks = (
        await import('simple-statistics/equal_interval_breaks.js')
      ).default
      breaks = equalIntervalBreaks(values, classes)
    } else if (mode === 'jenks') {
      const jenks = (await import('simple-statistics/jenks.js')).default
      breaks = jenks(values, classes)
    } else if (mode === 'quantiles') {
      const quantile = (await import('simple-statistics/quantile.js')).default
      const quantiles = [...Array(classes)].map((e, i) => i / classes).concat(1)
      breaks = quantile(values, quantiles)
    } else {
      const ckmeans = (await import('simple-statistics/ckmeans.js')).default
      const max = (await import('simple-statistics/max.js')).default
      breaks = ckmeans(values, classes).map((cluster) => cluster[0])
      breaks.push(max(values)) // Needed for computing the legend
    }
    // TODO mv to form logic
    // breaks = breaks.map((b) => +b.toFixed(2)).join(',')
    let colorScheme = properties.choropleth?.brewer
    const colorbrewer = await loadColors()
    if (!colorbrewer[colorScheme]) colorScheme = 'Blues'
    // First break is the bottom boundary of the data range,
    // so no feature value can be below it.
    const thresholds = breaks.slice(1)
    colors = colorbrewer[colorScheme][thresholds.length] || []
    const featuresProperties = features.reduce((acc, feature) => {
      const value = +feature.properties?.[key]
      // TODO test algo
      let color
      for (const [index, threshold] of thresholds.entries()) {
        if (value <= threshold) {
          color = colors[index]
          break
        }
      }
      acc[feature.id] = { [feature.getMainColor()]: color }
      return acc
    }, {})
    const items = breaks.slice(0, -1).map((el, index) => {
      const from = +breaks[index].toFixed(1)
      const to = +breaks[index + 1].toFixed(1)
      return [colors[index], `${from} - ${to}`]
    })
    return { properties: featuresProperties, caption: buildCaption(items) }
  }

  static async editableProperties(fields) {
    return [
      [
        'properties.choropleth.property',
        {
          handler: 'Select',
          selectOptions: fields.keys(),
          label: translate('Choropleth property value'),
        },
      ],
      [
        'properties.choropleth.brewer',
        {
          handler: 'Select',
          label: translate('Choropleth color palette'),
          selectOptions: Object.keys(await loadColors()).sort(),
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
          choices: Object.entries(Choropleth.modes),
          label: translate('Choropleth mode'),
        },
      ],
    ]
  }
}

class Categorized extends DefaultType {
  static type = 'Categorized'
  static name = translate('Categorized')
  static key = 'categorized'
  static modes = {
    manual: translate('Manual'),
    alpha: translate('Alphabetical'),
  }
  static defaults = {
    color: 'white',
    fillOpacity: 0.7,
    weight: 2,
  }

  static async compute(properties, features, fields) {
    const key = properties[this.key]?.property || fields[0] || 'value'
    const values = features
      .map((feature) => feature.properties?.[key])
      .filter((value) => value !== undefined)
    if (!values.length) {
      return { properties: {}, caption: null }
    }
    const mode = properties.categorized?.mode
    let categories = []
    if (mode === 'manual') {
      const manual = properties.categorized?.categories
      if (manual) categories = manual.split(',')
    } else {
      categories = values
        .filter((val, idx, arr) => arr.indexOf(val) === idx)
        .sort(Utils.naturalSort)
    }
    const classes = categories.length
    const colorScheme = properties.categorized?.brewer
    const colorbrewer = await loadColors()
    let colors
    if (colorbrewer[colorScheme]?.[classes]) {
      colors = colorbrewer[colorScheme][classes]
    } else {
      colors = colorbrewer.Accent[classes] || Utils.COLORS
    }
    const featuresProperties = features.reduce((acc, feature) => {
      const index = categories.indexOf(feature.properties?.[key])
      acc[feature.id] = { [feature.getMainColor()]: colors[index] }
      return acc
    }, {})
    const items = categories.map((category, index) => [colors[index], category])
    return { properties: featuresProperties, caption: buildCaption(items) }
  }

  static async editableProperties(fields) {
    return [
      [
        'properties.categorized.property',
        {
          handler: 'Select',
          selectOptions: fields.keys(),
          label: translate('Category property'),
        },
      ],
      [
        'properties.categorized.brewer',
        {
          handler: 'Select',
          label: translate('Color palette'),
          selectOptions: Object.keys(await loadColors()).sort(),
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
          choices: Object.entries(Categorized.modes),
          label: translate('Categories mode'),
        },
      ],
    ]
  }
}

class Circles extends DefaultType {
  static type = 'Circles'
  static name = translate('Proportional circles')
  static key = 'circles'
  static defaults = {
    weight: 1,
    shape: 'circle',
  }

  static ensureProperties(properties) {
    super.ensureProperties(properties)
    properties[this.key].radius ??= {}
  }

  static async compute(properties, features, fields) {
    const key = properties[this.key]?.property || fields[0] || 'value'
    const values = features
      .map((feature) => +feature.properties?.[key])
      .filter((value) => !Number.isNaN(value))
    if (!values.length) {
      return { properties: {}, caption: null }
    }
    const minValue = Math.sqrt(Math.min(...values))
    const maxValue = Math.sqrt(Math.max(...values))
    const minPX = properties.circles?.radius?.min || 2
    const maxPX = properties.circles?.radius?.max || 50
    const computeRadius = (value) => {
      const valuesRange = maxValue - minValue
      const pxRange = maxPX - minPX
      const radius = minPX + ((Math.sqrt(value) - minValue) / valuesRange) * pxRange
      return radius || minPX
    }
    const featuresProperties = features.reduce((acc, feature) => {
      const value = +feature.properties?.[key]
      acc[feature.id] = { radius: Number.isNaN(value) ? minPX : computeRadius(value) }
      return acc
    }, {})
    // Legend: min / median / max circle sizes.
    const sorted = [...values].sort((a, b) => a - b)
    const median = sorted[Math.round(sorted.length / 2)]
    const items = [
      [minPX, sorted[0]],
      [computeRadius(median), median],
      [maxPX, sorted[sorted.length - 1]],
    ]
    // TODO find a way to get result of getProperty here
    const color = properties.color || 'DarkBlue'
    const opacity = properties.fillOpacity ?? 0.5
    const caption = Circles.buildCaption(items, color, opacity)
    return { properties: featuresProperties, caption }
  }

  static buildCaption(items, color, opacity) {
    const ul = DOMUtils.loadTemplate('<ul class="circles-layer-legend"></ul>')
    for (const [size, label] of items) {
      const li = DOMUtils.loadTemplate(Utils.sanitizeVars`
        <li>
          <span class="circle"
                style="background-color: ${color};
                       height: ${size * 2}px;
                       width: ${size * 2}px;
                       opacity: ${opacity};"></span>
          <span class="label">${label}</span>
        </li>
      `)
      ul.appendChild(li)
    }
    return ul
  }

  static async editableProperties(fields) {
    return [
      [
        'properties.circles.property',
        {
          handler: 'Select',
          selectOptions: fields.keys(),
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
  }
}

class Cluster extends DefaultType {
  static type = 'Cluster'
  static name = translate('Clustered')
  static key = 'cluster'

  static renderConfig(properties) {
    return {
      [this.key]: {
        radius: properties.cluster?.radius,
        textColor: properties.cluster?.textColor,
      },
    }
  }

  static async editableProperties(fields) {
    return [
      [
        'properties.cluster.radius',
        {
          handler: 'Range',
          min: 10,
          max: 200,
          step: 10,
          placeholder: translate('Clustering radius'),
          helpText: translate('Override clustering radius (default 80)'),
        },
      ],
      [
        'properties.cluster.textColor',
        {
          handler: 'TextColorPicker',
          placeholder: translate('Auto'),
          helpText: translate('Text color for the cluster label'),
        },
      ],
    ]
  }
}

class Heat extends DefaultType {
  static type = 'Heat'
  static name = translate('Heatmap')
  static key = 'heat'
  static browsable = false

  static renderConfig(properties) {
    return {
      [this.key]: {
        radius: properties.heat?.radius,
        intensityProperty: properties.heat?.intensityProperty,
      },
    }
  }

  static async editableProperties(fields) {
    return [
      [
        'properties.heat.radius',
        {
          handler: 'Range',
          min: 10,
          max: 100,
          step: 5,
          label: translate('Heatmap radius'),
          helpText: translate('Override heatmap radius (default 25)'),
        },
      ],
      [
        'properties.heat.intensityProperty',
        {
          handler: 'Select',
          selectOptions: [
            ['', translate('Select field to compute intensity')],
            ...fields.keys(),
          ],
          helpText: translate('Optional intensity field to compute heatmap'),
        },
      ],
    ]
  }
}

export const TYPES = [DefaultType, Choropleth, Categorized, Circles, Cluster, Heat]
