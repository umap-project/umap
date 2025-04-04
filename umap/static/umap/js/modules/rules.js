import { DomEvent, DomUtil, stamp } from '../../vendors/leaflet/leaflet-src.esm.js'
import { AutocompleteDatalist } from './autocomplete.js'
import { MutatingForm } from './form/builder.js'
import { translate } from './i18n.js'
import Orderable from './orderable.js'
import * as Utils from './utils.js'

const EMPTY_VALUES = ['', undefined, null]

class Rule {
  get condition() {
    return this._condition
  }

  set condition(value) {
    this._condition = value
    this.parse()
  }

  constructor(umap, condition = '', options = {}) {
    // TODO make this public properties when browser coverage is ok
    // cf https://caniuse.com/?search=public%20class%20field
    this._condition = null
    this.OPERATORS = [
      ['>', this.gt],
      ['<', this.lt],
      // When sent by Django
      ['&lt;', this.lt],
      ['!=', this.not_equal],
      ['=', this.equal],
    ]
    this._umap = umap
    this.active = true
    this.options = options
    this.condition = condition
  }

  render(fields) {
    this._umap.render(fields)
  }

  equal(other) {
    return this.expected === other
  }

  not_equal(other) {
    return this.expected !== other
  }

  gt(other) {
    return other > this.expected
  }

  lt(other) {
    return other < this.expected
  }

  parse() {
    let vars = []
    this.cast = (v) => v
    this.operator = undefined
    for (const [sign, func] of this.OPERATORS) {
      if (this.condition.includes(sign)) {
        this.operator = func
        vars = this.condition.split(sign)
        break
      }
    }
    if (vars.length !== 2) return
    this.key = vars[0]
    this.expected = vars[1]
    if (EMPTY_VALUES.includes(this.expected)) {
      this.cast = (v) => EMPTY_VALUES.includes(v)
    }
    // Special cases where we want to be lousy when checking isNaN without
    // coercing to a Number first because we handle multiple types.
    // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/
    // Reference/Global_Objects/Number/isNaN
    // biome-ignore lint/suspicious/noGlobalIsNan: expected might not be a number.
    else if (!isNaN(this.expected)) {
      this.cast = Number.parseFloat
    } else if (['true', 'false'].includes(this.expected)) {
      this.cast = (v) => {
        if (`${v}`.toLowerCase() === 'true') return true
        if (`${v}`.toLowerCase() === 'false') return false
      }
    }
    this.expected = this.cast(this.expected)
  }

  match(props) {
    if (!this.operator || !this.active) return false
    return this.operator(this.cast(props[this.key]))
  }

  getOption(option) {
    return this.options[option]
  }

  edit() {
    const options = [
      [
        'condition',
        {
          handler: 'BlurInput',
          label: translate('Condition'),
          placeholder: translate('key=value or key!=value'),
        },
      ],
      'options.color',
      'options.iconClass',
      'options.iconUrl',
      'options.iconOpacity',
      'options.opacity',
      'options.weight',
      'options.fill',
      'options.fillColor',
      'options.fillOpacity',
      'options.smoothFactor',
      'options.dashArray',
    ]
    const container = DomUtil.create('div')
    const builder = new MutatingForm(this, options)
    const defaultShapeProperties = DomUtil.add('div', '', container)
    defaultShapeProperties.appendChild(builder.build())
    const autocomplete = new AutocompleteDatalist(builder.helpers.condition.input)
    const properties = this._umap.allProperties()
    autocomplete.suggestions = properties
    autocomplete.input.addEventListener('input', (event) => {
      const value = event.target.value
      if (properties.includes(value)) {
        autocomplete.suggestions = [`${value}=`, `${value}!=`, `${value}>`, `${value}<`]
      } else if (value.endsWith('=')) {
        const key = value.split('!')[0].split('=')[0]
        autocomplete.suggestions = this._umap
          .sortedValues(key)
          .map((str) => `${value}${str || ''}`)
      }
    })
    this._umap.editPanel.open({ content: container, highlight: 'settings' })
  }

  renderToolbox(row) {
    row.classList.toggle('off', !this.active)
    const toggle = DomUtil.createButtonIcon(
      row,
      'icon-eye',
      translate('Show/hide layer')
    )
    const edit = DomUtil.createButtonIcon(
      row,
      'icon-edit show-on-edit',
      translate('Edit')
    )
    const remove = DomUtil.createButtonIcon(
      row,
      'icon-delete show-on-edit',
      translate('Delete layer')
    )
    DomEvent.on(edit, 'click', this.edit, this)
    DomEvent.on(
      remove,
      'click',
      function () {
        if (!confirm(translate('Are you sure you want to delete this rule?'))) return
        this._delete()
        this._umap.editPanel.close()
      },
      this
    )
    DomUtil.add('span', '', row, this.condition || translate('empty rule'))
    DomUtil.createIcon(row, 'icon-drag', translate('Drag to reorder'))
    row.dataset.id = stamp(this)
    DomEvent.on(toggle, 'click', () => {
      this.active = !this.active
      row.classList.toggle('off', !this.active)
      this._umap.render(['rules'])
    })
  }

  _delete() {
    this._umap.rules.rules = this._umap.rules.rules.filter((rule) => rule !== this)
    this._umap.rules.commit()
  }

  setter(key, value) {
    const oldRules = Utils.CopyJSON(this._umap.properties.rules || {})
    Utils.setObjectValue(this, key, value)
    this._umap.rules.commit()
    this._umap.sync.update('properties.rules', this._umap.properties.rules, oldRules)
  }
}

export default class Rules {
  constructor(umap) {
    this._umap = umap
    this.load()
  }

  load() {
    this.rules = []
    if (!this._umap.properties.rules?.length) return
    for (const { condition, options } of this._umap.properties.rules) {
      if (!condition) continue
      this.rules.push(new Rule(this._umap, condition, options))
    }
  }

  onReorder(src, dst, initialIndex, finalIndex) {
    const moved = this.rules.find((rule) => stamp(rule) === src.dataset.id)
    const reference = this.rules.find((rule) => stamp(rule) === dst.dataset.id)
    const movedIdx = this.rules.indexOf(moved)
    let referenceIdx = this.rules.indexOf(reference)
    const minIndex = Math.min(movedIdx, referenceIdx)
    const maxIndex = Math.max(movedIdx, referenceIdx)
    moved._delete() // Remove from array
    referenceIdx = this.rules.indexOf(reference)
    let newIdx
    if (finalIndex === 0) newIdx = 0
    else if (finalIndex > initialIndex) newIdx = referenceIdx
    else newIdx = referenceIdx + 1
    this.rules.splice(newIdx, 0, moved)
    this._umap.render(['rules'])
    this.commit()
  }

  edit(container) {
    const body = DomUtil.createFieldset(container, translate('Conditional style rules'))
    if (this.rules.length) {
      const ul = DomUtil.create('ul', '', body)
      for (const rule of this.rules) {
        rule.renderToolbox(DomUtil.create('li', 'orderable', ul))
      }

      const orderable = new Orderable(ul, this.onReorder.bind(this))
    }

    DomUtil.createButton('umap-add', body, translate('Add rule'), this.addRule, this)
  }

  addRule() {
    const rule = new Rule(this._umap)
    this.rules.push(rule)
    rule.edit(map)
  }

  commit() {
    this._umap.properties.rules = this.rules.map((rule) => {
      return {
        condition: rule.condition,
        options: rule.options,
      }
    })
  }

  getOption(option, feature) {
    for (const rule of this.rules) {
      if (rule.match(feature.properties)) {
        if (Utils.usableOption(rule.options, option)) return rule.options[option]
        break
      }
    }
  }
}
