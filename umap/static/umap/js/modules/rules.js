import { stamp } from '../../vendors/leaflet/leaflet-src.esm.js'
import { AutocompleteDatalist } from './autocomplete.js'
import { MutatingForm } from './form/builder.js'
import { translate } from './i18n.js'
import Orderable from './orderable.js'
import * as Utils from './utils.js'
import * as Icon from './rendering/icon.js'
import { SCHEMA } from './schema.js'
import { Registry as Fields } from './data/fields.js'

const EMPTY_VALUES = ['', undefined, null]

class Rule {
  get condition() {
    return this._condition
  }

  get label() {
    return this.name || this.condition
  }

  set condition(value) {
    this._condition = value
    this.parse()
  }

  constructor(umap, parent, condition = '', name = '', properties = {}) {
    // TODO make this public properties when browser coverage is ok
    // cf https://caniuse.com/?search=public%20class%20field
    this._condition = null
    this.OPERATORS = [
      ['>', 'gt'],
      ['<', 'lt'],
      // When sent by Django
      ['&lt;', 'lt'],
      ['!=', 'not_equal'],
      ['=', 'equal'],
    ]
    this.parent = parent
    this._umap = umap
    this.active = true
    this.properties = properties
    this.condition = condition
    this.name = name
  }

  render(fields) {
    this.parent.render(fields)
  }

  parse() {
    let vars = []
    this.cast = (v) => v
    this.operator = undefined
    let operator = undefined
    for (const [sign, funcName] of this.OPERATORS) {
      if (this.condition.includes(sign)) {
        operator = funcName
        vars = this.condition.split(sign)
        break
      }
    }
    if (vars.length !== 2) return
    this.field = this.parent.fields.get(vars[0]) || new Fields.String(vars[0])
    this.operator = this.field[operator]
    this.expected = vars[1]
    if (EMPTY_VALUES.includes(this.expected)) {
      this.cast = (v) => EMPTY_VALUES.includes(v)
    }
    // TODO: deal with legacy rules on non typed fields
    else {
      this.cast = this.field.parse
      if (
        // Special cases where we want to be lousy when checking isNaN without
        // coercing to a Number first because we handle multiple types.
        // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/
        // Reference/Global_Objects/Number/isNaN
        // biome-ignore lint/suspicious/noGlobalIsNan: expected might not be a number.
        !isNaN(this.expected) &&
        ['gt', 'lt'].includes(operator) &&
        this.field.TYPE !== 'Number'
      ) {
        this.cast = Number.parseFloat
      }
    }
    this.expected = this.cast(this.expected)
  }

  match(props) {
    if (!this.operator || !this.active || !this.field) return false
    return this.operator(this.expected, this.cast(props[this.field.key]))
  }

  getOption(option) {
    return this.properties[option]
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
      'name',
      'properties.color',
      'properties.iconClass',
      'properties.iconSize',
      'properties.iconUrl',
      'properties.iconOpacity',
      'properties.opacity',
      'properties.weight',
      'properties.fill',
      'properties.fillColor',
      'properties.fillOpacity',
      'properties.smoothFactor',
      'properties.dashArray',
    ]
    const builder = new MutatingForm(this, options)
    const container = document.createElement('div')
    container.appendChild(builder.build())
    const autocomplete = new AutocompleteDatalist(builder.helpers.condition.input)
    const properties = Array.from(this.parent.fields.keys())
    autocomplete.suggestions = properties
    autocomplete.input.addEventListener('input', (event) => {
      const value = event.target.value
      if (properties.includes(value)) {
        autocomplete.suggestions = [`${value}=`, `${value}!=`, `${value}>`, `${value}<`]
      } else if (value.endsWith('=')) {
        const key = value.split('!')[0].split('=')[0]
        if (key) {
          autocomplete.suggestions = this.parent
            .sortedValues(key)
            .map((str) => `${value}${str ?? ''}`)
        }
      }
    })
    const backButton = Utils.loadTemplate(`
      <button class="flat" type="button" data-ref="add">
        <i class="icon icon-16 icon-back" title="${translate('Back to list')}"></i>
      </button>`)
    backButton.addEventListener('click', () =>
      this.parent.edit().then((panel) => {
        panel.scrollTo('details#rules')
      })
    )

    this._umap.editPanel.open({
      content: container,
      highlight: 'settings',
      actions: [backButton],
    })
  }

  renderToolbox(ul) {
    const template = `
      <li data-id="${stamp(this)}" class="orderable">
        <button class="icon icon-16 icon-eye" title="${translate('Toggle rule')}" data-ref=toggle></button>
        <button class="icon icon-16 icon-edit show-on-edit" title="${translate('Edit')}" data-ref=edit></button>
        <button class="icon icon-16 icon-delete show-on-edit" title="${translate('Delete rule')}" data-ref=remove></button>
        <span>${this.label || translate('empty rule')}</span>
        <i class="icon icon-16 icon-drag" title="${translate('Drag to reorder')}"></i>
      </li>
    `
    const [li, { toggle, edit, remove }] = Utils.loadTemplateWithRefs(template)
    ul.appendChild(li)
    li.classList.toggle('off', !this.active)
    edit.addEventListener('click', () => this.edit())
    remove.addEventListener('click', () => {
      if (!confirm(translate('Are you sure you want to delete this rule?'))) return
      this._delete()
      this.parent.edit().then((panel) => panel.scrollTo('details#rules'))
    })
    toggle.addEventListener('click', () => {
      this.active = !this.active
      li.classList.toggle('off', !this.active)
      this.parent.render(['rules'])
    })
  }

  _delete() {
    // TODO refactor this call to update
    const oldRules = Utils.CopyJSON(this.parent.properties.rules || {})
    this.parent.rules.rules = this.parent.rules.rules.filter((rule) => rule !== this)
    this.parent.rules.commit()
    this.parent.sync.update('properties.rules', this.parent.properties.rules, oldRules)
  }

  setter(key, value) {
    const oldRules = Utils.CopyJSON(this.parent.properties.rules || {})
    Utils.setObjectValue(this, key, value)
    this.parent.rules.commit()
    this.parent.sync.update('properties.rules', this.parent.properties.rules, oldRules)
  }

  renderLegend(ul) {
    const [li, { colorBox }] = Utils.loadTemplateWithRefs(
      `<li><span class="color-box" data-ref=colorBox></span>${this.label}</li>`
    )
    const bgcolor =
      this.properties.fillColor || this.properties.color || this.parent.getColor()
    const symbol = this.properties.iconUrl
    colorBox.style.backgroundColor = bgcolor
    if (symbol && symbol !== SCHEMA.iconUrl.default) {
      const icon = Icon.makeElement(symbol, colorBox)
      Icon.setContrast(icon, colorBox, symbol, bgcolor)
    }
    ul.appendChild(li)
  }
}

export default class Rules {
  constructor(umap, parent) {
    this._umap = umap
    this.parent = parent
    this.load()
  }

  load() {
    this.rules = []
    if (!this.parent.properties.rules?.length) return
    for (const { condition, name, properties, options } of this.parent.properties
      .rules) {
      if (!condition) continue
      const rule = new Rule(
        this._umap,
        this.parent,
        condition,
        name,
        properties || options
      )
      this.rules.push(rule)
    }
  }

  onReorder(src, dst, initialIndex, finalIndex) {
    const oldRules = Utils.CopyJSON(this.parent.properties.rules || {})
    const moved = this.rules.find((rule) => stamp(rule) === +src.dataset.id)
    const reference = this.rules.find((rule) => stamp(rule) === +dst.dataset.id)
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
    this.parent.render(['rules'])
    this.commit()
    this.parent.sync.update('properties.rules', this.parent.properties.rules, oldRules)
  }

  edit(container) {
    const template = `
      <details id="rules">
        <summary><h4>${translate('Conditional style rules')}</h4></summary>
        <fieldset>
          <ul data-ref=ul></ul>
          <button type="button" data-ref=add>${translate('Add rule')}</button>
        </fieldset>
      </details>
    `
    const [body, { ul, add }] = Utils.loadTemplateWithRefs(template)
    if (this.rules.length) {
      for (const rule of this.rules) {
        rule.renderToolbox(ul)
      }
      const orderable = new Orderable(ul, this.onReorder.bind(this))
    }
    add.addEventListener('click', () => this.addRule())
    container.appendChild(body)
  }

  count() {
    return this.rules.length
  }

  renderLegend(container, keys = new Set()) {
    const ul = Utils.loadTemplate('<ul class="rules-caption"></ul>')
    container.appendChild(ul)
    for (const rule of this.rules) {
      if (keys.size && !keys.has(rule.key)) continue
      rule.renderLegend(ul)
    }
  }

  addRule() {
    const rule = new Rule(this._umap, this.parent)
    this.rules.push(rule)
    rule.edit(map)
  }

  commit() {
    this.parent.properties.rules = this.rules.map((rule) => {
      return {
        name: rule.name,
        condition: rule.condition,
        properties: rule.properties,
      }
    })
  }

  getOption(name, feature) {
    for (const rule of this.rules) {
      if (rule.match(feature.properties)) {
        if (Utils.usableOption(rule.properties, name)) return rule.properties[name]
      }
    }
  }

  *[Symbol.iterator]() {
    for (const rule of this.rules) {
      yield rule
    }
  }
}
