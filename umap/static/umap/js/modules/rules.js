import { DomUtil, DomEvent, stamp } from '../../vendors/leaflet/leaflet-src.esm.js'
import * as Utils from './utils.js'
import { translate } from './i18n.js'

class Rule {
  constructor(map, condition = '', options = {}) {
    this.map = map
    this.condition = condition
    this.parse()
    this.options = options
    let isDirty = false
    Object.defineProperty(this, 'isDirty', {
      get: () => {
        return isDirty
      },
      set: (status) => {
        isDirty = status
        if (status) {
          this.map.isDirty = status
        }
      },
    })
  }

  render(fields) {
    this.map.render(fields)
  }

  parse() {
    let vars = []
    if (this.condition.includes('!=')) {
      this.operator = (our, other) => our != other
      vars = this.condition.split('!=')
    } else if (this.condition.includes('=')) {
      this.operator = (our, other) => our === other
      vars = this.condition.split('=')
    }
    if (vars.length != 2) this.operator = undefined
    this.key = vars[0]
    this.expected = vars[1]
  }

  match(props) {
    if (!this.operator) return false
    return this.operator(this.expected, props[this.key])
  }

  getMap() {
    return this.map
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
          label: L._('Condition'),
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
    const builder = new U.FormBuilder(this, options)
    const defaultShapeProperties = L.DomUtil.add('div', '', container)
    defaultShapeProperties.appendChild(builder.build())

    this.map.editPanel.open({ content: container })
  }

  renderToolbox(container) {
    const toggle = L.DomUtil.createButtonIcon(
      container,
      'icon-eye',
      L._('Show/hide layer')
    )
    const edit = L.DomUtil.createButtonIcon(
      container,
      'icon-edit show-on-edit',
      L._('Edit')
    )
    const remove = L.DomUtil.createButtonIcon(
      container,
      'icon-delete show-on-edit',
      L._('Delete layer')
    )
    L.DomEvent.on(edit, 'click', this.edit, this)
    L.DomEvent.on(
      remove,
      'click',
      function () {
        if (!confirm(L._('Are you sure you want to delete this rule?'))) return
        this._delete()
        this.map.editPanel.close()
      },
      this
    )
    DomUtil.add('span', '', container, this.condition || translate('empty rule'))
    //L.DomEvent.on(toggle, 'click', this.toggle, this)
  }

  _delete() {
    this.map.rules.rules = this.map.rules.rules.filter((rule) => rule != this)
  }
}

export default class Rules {
  constructor(map) {
    this.map = map
    this.rules = []
    this.loadRules()
  }

  loadRules() {
    if (!this.map.options.rules?.length) return
    for (const { condition, options } of this.map.options.rules) {
      if (!condition) continue
      this.rules.push(new Rule(this.map, condition, options))
    }
  }

  edit(container) {
    const body = L.DomUtil.createFieldset(
      container,
      translate('Conditional style rules')
    )
    if (this.rules.length) {
      const list = DomUtil.create('ul', '', body)
      for (const rule of this.rules) {
        rule.renderToolbox(DomUtil.create('li', '', list))
      }
    }
    L.DomUtil.createButton('umap-add', body, translate('Add rule'), this.addRule, this)
  }

  addRule() {
    const rule = new Rule(this.map)
    rule.isDirty = true
    this.rules.push(rule)
    rule.edit(map)
  }

  commit() {
    this.map.options.rules = this.rules.map((rule) => {
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
