import * as Utils from '../utils.js'
import { translate } from '../i18n.js'
import Orderable from '../orderable.js'
import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import { Form } from '../form/builder.js'

export const getDefaultFields = () => [
  { key: U.DEFAULT_LABEL_KEY, type: 'String' },
  { key: 'description', type: 'Text' },
]

export const Registry = {}

class BaseField {
  constructor(key) {
    this.key = key
  }

  values(features) {
    return features
      .map((feature) => this.parse(feature.properties[this.key]))
      .filter((val, idx, arr) => arr.indexOf(val) === idx)
  }

  equal(expected, other) {
    return expected === other
  }

  not_equal(expected, other) {
    return expected !== other
  }

  gt(expected, other) {
    return other > expected
  }

  lt(expected, other) {
    return other < expected
  }

  render(value) {
    return Utils.escapeHTML(value).trim()
  }

  dumps() {
    return {
      key: this.key,
      type: this.TYPE,
    }
  }
}

Registry.String = class extends BaseField {
  constructor(key) {
    super(key)
    // FIXME make it dynamic from class name
    this.TYPE = 'String'
    this.LABEL = translate('Short text')
  }

  parse(value) {
    return String(value ?? '')
  }

  render(value) {
    value = super.render(value)
    // TODO, manage links (url, mailto, wikipedia...)
    if (value.indexOf('http') === 0) {
      value = `<a href="${value}" target="_blank">${value}</a>`
    }
    return value
  }
}

Registry.Text = class extends Registry.String {
  constructor(key) {
    super(key)
    // FIXME make it dynamic from class name
    this.TYPE = 'Text'
    this.LABEL = translate('Text')
  }

  render(value) {
    return Utils.toHTML(value)
  }
}

Registry.Number = class extends BaseField {
  constructor(key) {
    super(key)
    // FIXME make it dynamic from class name
    this.TYPE = 'Number'
    this.LABEL = translate('Number')
  }

  parse(value) {
    return Number.parseFloat(value)
  }
}

Registry.Datetime = class extends BaseField {
  constructor(key) {
    super(key)
    // FIXME make it dynamic from class name
    this.TYPE = 'Datetime'
    this.LABEL = translate('Date and time')
  }

  parse(value) {
    return new Date(value)
  }
}

Registry.Date = class extends BaseField {
  constructor(key) {
    super(key)
    // FIXME make it dynamic from class name
    this.TYPE = 'Date'
    this.LABEL = translate('Date')
  }

  parse(value) {
    return Utils.parseNaiveDate(value)
  }
}

Registry.Boolean = class extends BaseField {
  constructor(key) {
    super(key)
    // FIXME make it dynamic from class name
    this.TYPE = 'Boolean'
    this.LABEL = translate('Yes / No')
  }

  parse(value) {
    // 'yes' is used in OpenStreetMap data
    return ['true', '1', 'yes'].includes(`${value}`.toLowerCase())
  }
}

Registry.Enum = class extends BaseField {
  constructor(key) {
    super(key)
    // FIXME make it dynamic from class name
    this.TYPE = 'Enum'
    this.LABEL = translate('List of values')
  }

  parse(value) {
    return String(value || '')
      .split(',')
      .map((s) => s.trim())
  }

  values(features) {
    return features
      .reduce(
        (acc, feature) => acc.concat(this.parse(feature.properties[this.key])),
        []
      )
      .filter((val, idx, arr) => arr.indexOf(val) === idx)
  }

  equal(expected, other) {
    return Boolean(new Set(other).intersection(new Set(expected)).size)
  }

  not_equal(expected, other) {
    return !new Set(other).intersection(new Set(expected)).size
  }

  gt(expected, other) {
    return false
  }

  lt(expected, other) {
    return false
  }
}

const FIELD_TYPES = Object.entries(Registry).map(([name, klass]) => [
  name,
  new klass().LABEL,
])

export class Fields extends Map {
  constructor(parent, dialog) {
    super()
    this.parent = parent
    this.dialog = dialog
    this.parent.properties.fields ??= []
    this.pull()
  }

  isDefault() {
    const keys = Array.from(this.keys())
    const defaultKeys = getDefaultFields().map((field) => field.key)
    return (
      keys.length === defaultKeys.length &&
      keys.every((value, index) => value === defaultKeys[index])
    )
  }

  pull() {
    this.clear()
    for (const field of this.parent.properties.fields) {
      this.add(field)
    }
  }

  push() {
    this.parent.properties.fields = this.all().map((field) => {
      // We don't want to keep the reference, otherwise editing
      // it will also change the old value
      return { ...field.dumps() }
    })
  }

  async commit() {
    return new Promise((resolve) => {
      const oldFields = Utils.CopyJSON(this.parent.properties.fields)
      resolve()
      this.push()
      this.parent.sync.update(
        'properties.fields',
        this.parent.properties.fields,
        oldFields
      )
    })
  }

  add(field) {
    if (!field?.key) {
      console.error('Invalid field', field)
      return
    }
    const klass = Registry[field.type] || Registry.String
    this.set(field.key, new klass(field.key))
    this.push()
  }

  delete(key) {
    super.delete(key)
    this.push()
  }

  all() {
    return Array.from(this.values())
  }

  edit(container) {
    const [root, { ul, add, manageFilters }] = Utils.loadTemplateWithRefs(`
      <details id="fields-management">
        <summary><h4>${translate('Manage Fields')}</h4></summary>
        <fieldset>
          <ul data-ref=ul></ul>
          <div class="button-bar half">
            <button type="button" data-ref=add>${translate('Add a new field')}</button>
            <button type="button" data-ref="manageFilters">${translate('Manage filters')}</button>
          </div>
        </fieldset>
      </details>
    `)
    container.appendChild(root)
    add.hidden = this.parent.isRemoteLayer?.()
    add.addEventListener('click', () => {
      this.editField().then(() => {
        this.parent.edit().then((panel) => {
          panel.scrollTo('details#fields-management')
        })
      })
    })
    manageFilters.addEventListener('click', () => this.parent.filters.edit())
    for (const field of this.all()) {
      const [row, { edit, del, addFilter, editFilter }] = Utils.loadTemplateWithRefs(
        `<li class="orderable with-toolbox" data-key="${field.key}">
          <span>
            <i class="icon icon-16 icon-field-${field.TYPE}" title="${field.LABEL}"></i>
            ${field.key}
          </span>
          <span>
            <button class="icon icon-16 icon-edit" title="${translate('Edit this field')}" data-ref=edit></button>
            <button class="icon icon-16 icon-filters" title="${translate('Edit filter')}" data-ref=editFilter></button>
            <button class="icon icon-16 icon-filters-empty" title="${translate('Add a filter for this field')}" data-ref=addFilter></button>
            <button class="icon icon-16 icon-delete" title="${translate('Delete this field')}" data-ref=del></button>
            <i class="icon icon-16 icon-drag" title="${translate('Drag to reorder')}"></i>
          </span>
        </li>`
      )
      editFilter.hidden = !this.parent.filters.has(field.key)
      addFilter.hidden = this.parent.filters.has(field.key)
      del.hidden = this.parent.isRemoteLayer?.()
      editFilter.addEventListener('click', () =>
        this.parent.filters.createFilterForm(field.key)
      )
      addFilter.addEventListener('click', () =>
        this.parent.filters.createFilterForm(field.key)
      )
      ul.appendChild(row)
      edit.addEventListener('click', () => {
        this.editField(field.key).then(() => {
          this.parent.edit().then((panel) => {
            panel.scrollTo('details#fields-management')
          })
        })
      })
      del.addEventListener('click', () => {
        this.confirmDelete(field.key).then(() => {
          this.parent.edit().then((panel) => {
            panel.scrollTo('details#fields-management')
          })
        })
      })
    }
    const onReorder = (src, dst, initialIndex, finalIndex) => {
      const orderedKeys = Array.from(ul.querySelectorAll('li')).map(
        (el) => el.dataset.key
      )
      const oldFields = Utils.CopyJSON(this.parent.properties.fields)
      const copy = Object.fromEntries(this)
      this.clear()
      for (const key of orderedKeys) {
        this.add(copy[key])
      }
      this.parent.sync.update(
        'properties.fields',
        this.parent.properties.fields,
        oldFields
      )
    }
    const orderable = new Orderable(ul, onReorder)
  }

  async editField(name) {
    if (!name && this.parent.isRemoteLayer?.()) return
    const field = this.get(name)
    const data = field?.dumps() || {}
    const metadatas = [
      [
        'key',
        {
          handler: 'BlurInput',
          label: translate('Field Name'),
          disabled: this.parent.isRemoteLayer?.(),
        },
      ],
      [
        'type',
        {
          handler: 'Select',
          selectOptions: FIELD_TYPES,
          label: translate('Field Type'),
        },
      ],
    ]
    const form = new Form(data, metadatas)

    const [container, { body, addFilter }] = Utils.loadTemplateWithRefs(`
      <div>
        <h3>${translate('Manage field')}</h3>
        <div data-ref=body></div>
        <button type="button" data-ref=addFilter hidden><i class="icon icon-16 icon-filters"></i>${translate('Add filter for this field')}</button>
      </div>
    `)
    body.appendChild(form.build())
    if (this.parent.filters) {
      addFilter.addEventListener('click', () => {
        this.dialog.accept().then(() => {
          this.parent.filters.createFilterForm(data.key)
        })
      })
      addFilter.hidden = false
    }

    return this.dialog.open({ template: container }).then(() => {
      if (!this.validateName(data.key, data.key !== name)) {
        this.pull()
        return
      }
      this.parent.sync.startBatch()
      const oldFields = Utils.CopyJSON(this.parent.properties.fields)
      if (!name) {
        this.add(data)
      } else if (name !== data.key || field.TYPE !== data.type) {
        this.clear()
        // Keep order on rename
        for (const old of oldFields) {
          if (old.key === name) {
            this.add(data)
          } else {
            this.add(old)
          }
        }
        if (name !== data.key) {
          this.parent.renameField(name, data.key)
        }
      } else {
        this.push()
      }
      this.parent.sync.update(
        'properties.fields',
        this.parent.properties.fields,
        oldFields
      )
      this.parent.sync.commitBatch()
      this.parent.render(['properties.fields'])
    })
  }

  validateName(name, isNew = false) {
    if (!name) {
      Alert.error(translate('Name cannot be empty.'))
      return false
    }
    if (name.includes('.')) {
      Alert.error(translate('Name “{name}” should not contain a dot.', { name }))
      return false
    }
    if (isNew && this.has(name)) {
      Alert.error(translate('This name already exists: “{name}”', { name }))
      return false
    }
    return true
  }

  async confirmDelete(name) {
    return this.dialog
      .confirm(translate('Are you sure you want to delete this field on all the data?'))
      .then(() => {
        this.parent.sync.startBatch()
        const oldFields = Utils.CopyJSON(this.parent.properties.fields)
        this.delete(name)
        this.push()
        if (this.parent.filters.has(name)) {
          this.parent.filters.remove(name)
        }
        this.parent.deleteField(name)
        this.parent.sync.update(
          'properties.fields',
          this.parent.properties.fields,
          oldFields
        )
        this.parent.sync.commitBatch()
      })
  }
}
