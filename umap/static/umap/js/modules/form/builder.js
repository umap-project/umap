import getClass from './fields.js'
import * as Utils from '../utils.js'
import { SCHEMA } from '../schema.js'
import { translate } from '../i18n.js'

export class Form {
  constructor(obj, fields, properties) {
    this.setProperties(properties)
    this.defaultProperties = {}
    this.obj = obj
    this.form = Utils.loadTemplate('<form></form>')
    this.setFields(fields)
    if (this.properties.id) {
      this.form.id = this.properties.id
    }
    if (this.properties.className) {
      this.form.classList.add(...this.properties.className.split(' '))
    }
  }

  setProperties(properties) {
    this.properties = Object.assign({}, this.properties, properties)
  }

  setFields(fields) {
    this.fields = fields || []
    this.helpers = {}
  }

  build() {
    this.form.innerHTML = ''
    for (const definition of this.fields) {
      this.buildField(this.makeField(definition))
    }
    return this.form
  }

  buildField(field) {
    field.buildTemplate()
    field.build()
  }

  makeField(field) {
    // field can be either a string like "option.name" or a full definition array,
    // like ['properties.tilelayer.tms', {handler: 'CheckBox', helpText: 'TMS format'}]
    let properties
    if (Array.isArray(field)) {
      properties = field[1] || {}
      field = field[0]
    } else {
      properties = this.defaultProperties[this.getName(field)] || {}
    }
    const class_ = getClass(properties.handler || 'Input')
    this.helpers[field] = new class_(this, field, properties)
    return this.helpers[field]
  }

  getter(field) {
    const path = field.split('.')
    let value = this.obj
    for (const sub of path) {
      try {
        value = value[sub]
      } catch {
        console.log(field)
      }
    }
    return value
  }

  setter(field, value) {
    const path = field.split('.')
    let obj = this.obj
    let what
    for (let i = 0, l = path.length; i < l; i++) {
      what = path[i]
      if (what === path[l - 1]) {
        if (typeof value === 'undefined') {
          delete obj[what]
        } else {
          obj[what] = value
        }
      } else {
        obj = obj[what]
      }
    }
  }

  restoreField(field) {
    const initial = this.helpers[field].initial
    this.setter(field, initial)
  }

  getName(field) {
    const fieldEls = field.split('.')
    return fieldEls[fieldEls.length - 1]
  }

  fetchAll() {
    for (const helper of Object.values(this.helpers)) {
      helper.fetch()
    }
  }

  syncAll() {
    for (const helper of Object.values(this.helpers)) {
      helper.sync()
    }
  }

  onPostSync(helper) {
    if (this.properties.callback) {
      this.properties.callback(helper)
    }
  }

  finish() {}

  getTemplate(helper) {
    return `
      <div class="formbox" data-ref=container>
        ${helper.getTemplate()}
        <small class="help-text" data-ref=helpText></small>
      </div>`
  }
}

export class MutatingForm extends Form {
  constructor(obj, fields, properties) {
    super(obj, fields, properties)
    this._umap = obj._umap || properties.umap
    this.computeDefaultProperties()
    // this.on('finish', this.finish)
  }

  computeDefaultProperties() {
    const customHandlers = {
      sortKey: 'PropertyInput',
      easing: 'Switch',
      facetKey: 'PropertyInput',
      slugKey: 'PropertyInput',
      labelKey: 'PropertyInput',
    }
    for (const [key, schema] of Object.entries(SCHEMA)) {
      if (schema.type === Boolean) {
        if (schema.nullable) schema.handler = 'NullableChoices'
        else schema.handler = 'Switch'
      } else if (schema.type === 'Text') {
        schema.handler = 'Textarea'
      } else if (schema.type === Number) {
        if (schema.step) schema.handler = 'Range'
        else schema.handler = 'IntInput'
      } else if (schema.choices) {
        const text_length = schema.choices.reduce(
          (acc, [_, label]) => acc + label.length,
          0
        )
        // Try to be smart and use MultiChoice only
        // for choices where labels are shorts…
        if (text_length < 40) {
          schema.handler = 'MultiChoice'
        } else {
          schema.handler = 'Select'
          schema.selectOptions = schema.choices
        }
      } else {
        switch (key) {
          case 'color':
          case 'fillColor':
            schema.handler = 'ColorPicker'
            break
          case 'iconUrl':
            schema.handler = 'IconUrl'
            break
          case 'licence':
            schema.handler = 'LicenceChooser'
            break
        }
      }

      if (customHandlers[key]) {
        schema.handler = customHandlers[key]
      }
      // Input uses this key for its type attribute
      delete schema.type
      this.defaultProperties[key] = schema
    }
  }

  setter(field, value) {
    super.setter(field, value)
    this.obj.isDirty = true
    if ('render' in this.obj) {
      this.obj.render([field], this)
    }
    if ('sync' in this.obj) {
      this.obj.sync.update(field, value)
    }
  }

  getTemplate(helper) {
    let template
    if (helper.properties.inheritable) {
      const extraClassName = helper.get(true) === undefined ? ' undefined' : ''
      template = `
        <div class="umap-field-${helper.name} formbox inheritable${extraClassName}">
          <div class="header" data-ref=header>
            <a href="#" class="button undefine" data-ref=undefine>${translate('clear')}</a>
            <a href="#" class="button define" data-ref=define>${translate('define')}</a>
            <span class="quick-actions show-on-defined" data-ref=actions></span>
            ${helper.getLabelTemplate()}
          </div>
          <div class="show-on-defined" data-ref=container>
            ${helper.getTemplate()}
            <small class="help-text" data-ref=helpText></small>
          </div>
        </div>`
    } else {
      template = `
      <div class="formbox umap-field-${helper.name}" data-ref=container>
        ${helper.getLabelTemplate()}
        ${helper.getTemplate()}
        <small class="help-text" data-ref=helpText></small>
      </div>`
    }
    return template
  }

  build() {
    super.build()
    this._umap.help.parse(this.form)
    return this.form
  }

  finish(helper) {
    helper.input?.blur()
  }
}
