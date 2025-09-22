import * as Utils from './utils.js'
import { translate } from './i18n.js'
import Orderable from './orderable.js'
import { uMapAlert as Alert } from '../components/alerts/alert.js'
import { Form } from './form/builder.js'

export class DataLayerManager extends Object {
  add(datalayer) {
    this[datalayer.id] = datalayer
  }
  active() {
    return Object.values(this)
      .filter((datalayer) => !datalayer.isDeleted)
      .sort((a, b) => a.rank > b.rank)
  }
  reverse() {
    return this.active().reverse()
  }
  count() {
    return this.active().length
  }
  find(func) {
    for (const datalayer of this.reverse()) {
      if (func.call(datalayer, datalayer)) {
        return datalayer
      }
    }
  }
  filter(func) {
    return this.active().filter(func)
  }
  visible() {
    return this.filter((datalayer) => datalayer.isVisible())
  }
  browsable() {
    return this.reverse().filter((datalayer) => datalayer.allowBrowse())
  }
  prev(datalayer) {
    const browsable = this.browsable()
    const current = browsable.indexOf(datalayer)
    const prev = browsable[current - 1] || browsable[browsable.length - 1]
    if (!prev.canBrowse()) return this.prev(prev)
    return prev
  }
  next(datalayer) {
    const browsable = this.browsable()
    const current = browsable.indexOf(datalayer)
    const next = browsable[current + 1] || browsable[0]
    if (!next.canBrowse()) return this.next(next)
    return next
  }
  first() {
    return this.active()[0]
  }
  last() {
    const layers = this.active()
    return layers[layers.length - 1]
  }
}

export class FeatureManager extends Map {
  add(feature) {
    if (this.has(feature.id)) {
      console.error('Duplicate id', feature, this.get(feature.id))
      feature.id = Utils.generateId()
      feature.datalayer._found_duplicate_id = true
    }
    this.set(feature.id, feature)
  }

  all() {
    return Array.from(this.values())
  }

  visible() {
    return this.all().filter((feature) => !feature.isFiltered())
  }

  del(feature) {
    this.delete(feature.id)
  }

  count() {
    return this.size
  }

  sort(by) {
    const features = this.all()
    Utils.sortFeatures(features, by, U.lang)
    this.clear()
    for (const feature of features) {
      this.set(feature.id, feature)
    }
  }

  getIndex(feature) {
    const entries = Array.from(this)
    return entries.findIndex(([id]) => id === feature.id)
  }

  first() {
    return this.values().next().value
  }

  last() {
    return this.all()[this.size - 1]
  }

  next(feature) {
    const index = this.getIndex(feature)
    return this.all()[index + 1]
  }

  prev(feature) {
    const index = this.getIndex(feature)
    return this.all()[index - 1]
  }
}

export class FieldManager extends Map {
  constructor(parent, dialog) {
    super()
    this.parent = parent
    this.dialog = dialog
    this.parent.properties.fields ??= []
    this.pull()
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
      return { ...field }
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
    field.type ??= 'String'
    // Copy object, so not to affect original
    // when edited.
    this.set(field.key, { ...field })
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
    const template = `
      <details id="fields">
        <summary>${translate('Manage Fields')}</summary>
        <fieldset>
          <ul data-ref=ul></ul>
          <button type="button" data-ref=add><i class="icon icon-16 icon-add"></i>${translate('Add a new field')}</button>
        </fieldset>
      </details>
    `
    const [fieldset, { ul, add }] = Utils.loadTemplateWithRefs(template)
    add.addEventListener('click', () => {
      this.editField().then(() => {
        this.parent.edit().then((panel) => {
          panel.scrollTo('details#fields')
        })
      })
    })
    container.appendChild(fieldset)
    for (const field of this.all()) {
      const [row, { edit, del }] = Utils.loadTemplateWithRefs(
        `<li class="orderable" data-key="${field.key}">
          <button class="icon icon-16 icon-edit" title="${translate('Edit this field')}" data-ref=edit></button>
          <button class="icon icon-16 icon-delete" title="${translate('Delete this field')}" data-ref=del></button>
          <i class="icon icon-16 icon-drag" title="${translate('Drag to reorder')}"></i>
          <i class="icon icon-16 icon-field-${field.type}" title="${field.type}"></i>
          ${field.key}
        </li>`
      )
      ul.appendChild(row)
      edit.addEventListener('click', () => {
        this.editField(field.key).then(() => {
          this.parent.edit().then((panel) => {
            panel.scrollTo('details#fields')
          })
        })
      })
      del.addEventListener('click', () => {
        this.confirmDelete(field.key).then(() => {
          this.parent.edit().then((panel) => {
            panel.scrollTo('details#fields')
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
    const FIELD_TYPES = [
      'String',
      'Text',
      'Number',
      'Date',
      'Datetime',
      'Enum',
      'Boolean',
    ]
    const field = this.get(name) || {}
    const metadatas = [
      ['key', { handler: 'BlurInput', label: translate('Field Name') }],
      [
        'type',
        {
          handler: 'Select',
          selectOptions: FIELD_TYPES,
          label: translate('Field Type'),
        },
      ],
    ]
    const form = new Form(field, metadatas)

    const [container, { body, addFilter }] = Utils.loadTemplateWithRefs(`
      <div>
        <h3>${translate('Manage field')}</h3>
        <div data-ref=body></div>
        <button type="button" data-ref=addFilter hidden><i class="icon icon-16 icon-filters"></i>${translate('Add filter for this field')}</button>
      </div>
    `)
    body.appendChild(form.build())
    if (this.parent.facets) {
      addFilter.addEventListener('click', () => {
        this.dialog.accept()
        this.parent.facets.filterForm(field.key)
      })
      addFilter.hidden = false
    }

    return this.dialog.open({ template: container }).then(() => {
      if (!this.validateName(field.key, field.key !== name)) {
        this.pull()
        return
      }
      this.parent.sync.startBatch()
      console.log(this.parent.properties.fields)
      const oldFields = Utils.CopyJSON(this.parent.properties.fields)
      if (!name) {
        this.add(field)
      } else if (name !== field.key) {
        this.clear()
        // Keep order on rename
        for (const old of oldFields) {
          if (old.key === name) {
            this.add(field)
          } else {
            this.add(old)
          }
        }
        this.parent.renameField(name, field.key)
      } else {
        this.push()
      }
      this.parent.sync.update(
        'properties.fields',
        this.parent.properties.fields,
        oldFields
      )
      this.parent.sync.commitBatch()
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
