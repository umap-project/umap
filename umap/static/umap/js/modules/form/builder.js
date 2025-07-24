import { translate } from '../i18n.js'
import { SCHEMA } from '../schema.js'
import * as Utils from '../utils.js'
import getClass from './fields.js'

export class Form extends Utils.WithEvents {
  constructor(obj, fields, properties) {
    super()
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
        console.debug(field)
      }
    }
    return value
  }

  setter(field, value) {
    if ('setter' in this.obj) {
      this.obj.setter(field, value)
    } else {
      Utils.setObjectValue(this.obj, field, value)
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
    let tpl = helper.getTemplate()
    if (helper.properties.label && !tpl.includes(helper.properties.label)) {
      tpl = `<label>${helper.properties.label}${tpl}</label>`
    }
    return `
      <div class="formbox" data-ref=container>
        ${tpl}
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
      color: 'ColorPicker',
      fillColor: 'ColorPicker',
      textPathColor: 'ColorPicker',
      iconUrl: 'IconUrl',
      licence: 'LicenceChooser',
      datalayersControl: 'DataLayersControl',
    }
    for (const [key, defaults] of Object.entries(SCHEMA)) {
      const properties = Object.assign({}, defaults)
      if (properties.type === Array) {
        properties.handler = 'CheckBoxes'
      } else if (properties.type === Boolean) {
        if (properties.nullable) properties.handler = 'NullableChoices'
        else properties.handler = 'Switch'
      } else if (properties.choices) {
        const text_length = properties.choices.reduce(
          (acc, [_, label]) => acc + label.length,
          0
        )
        // Try to be smart and use MultiChoice only
        // for choices where labels are shorts…
        if (text_length < 40) {
          properties.handler = 'MultiChoice'
        } else {
          properties.handler = 'Select'
          properties.selectOptions = properties.choices
        }
      } else if (properties.type === 'Text') {
        properties.handler = 'Textarea'
      } else if (properties.type === Number) {
        if (properties.step) properties.handler = 'Range'
        else properties.handler = 'IntInput'
      }
      if (customHandlers[key]) {
        properties.handler = customHandlers[key]
      }
      // Input uses this key for its type attribute
      delete properties.type
      this.defaultProperties[key] = properties
    }
  }

  setter(field, value) {
    const oldValue = this.getter(field)
    super.setter(field, value)
    if ('render' in this.obj) {
      this.obj.render([field], this)
    }
    if ('sync' in this.obj) {
      this.obj.sync.update(field, value, oldValue)
    }
  }

  getTemplate(helper) {
    let template
    if (helper.properties.inheritable) {
      const extraClassName = this.getter(helper.field) === undefined ? ' undefined' : ''
      template = `
        <div class="umap-field-${helper.name} formbox inheritable${extraClassName}">
          <div class="header" data-ref=header>
            ${helper.getLabelTemplate()}
            <span class="actions show-on-defined" data-ref=actions></span>
            <span class="buttons" data-ref=buttons>
              <button type="button" class="button undefine" data-ref=undefine>${translate('clear')}</button>
              <button type="button" class="button define" data-ref=define>${translate('define')}</button>
            </span>
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
