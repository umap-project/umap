L.FormBuilder = L.Evented.extend({
  options: {
    className: 'leaflet-form',
  },

  defaultOptions: {
    // Eg.:
    // name: {label: L._('name')},
    // description: {label: L._('description'), handler: 'Textarea'},
    // opacity: {label: L._('opacity'), helpText: L._('Opacity, from 0.1 to 1.0 (opaque).')},
  },

  initialize: function (obj, fields, options) {
    L.setOptions(this, options)
    this.obj = obj
    this.form = L.DomUtil.create('form', this.options.className)
    this.setFields(fields)
    if (this.options.id) {
      this.form.id = this.options.id
    }
    if (this.options.className) {
      L.DomUtil.addClass(this.form, this.options.className)
    }
  },

  setFields: function (fields) {
    this.fields = fields || []
    this.helpers = {}
  },

  build: function () {
    this.form.innerHTML = ''
    for (const idx in this.fields) {
      this.buildField(this.fields[idx])
    }
    this.on('postsync', this.onPostSync)
    return this.form
  },

  buildField: function (field) {
    // field can be either a string like "option.name" or a full definition array,
    // like ['options.tilelayer.tms', {handler: 'CheckBox', helpText: 'TMS format'}]
    let type
    let helper
    let options
    if (Array.isArray(field)) {
      options = field[1] || {}
      field = field[0]
    } else {
      options = this.defaultOptions[this.getName(field)] || {}
    }
    type = options.handler || 'Input'
    if (typeof type === 'string' && L.FormBuilder[type]) {
      helper = new L.FormBuilder[type](this, field, options)
    } else {
      helper = new type(this, field, options)
    }
    this.helpers[field] = helper
    return helper
  },

  getter: function (field) {
    const path = field.split('.')
    let value = this.obj
    for (const sub of path) {
      value = value[sub]
    }
    return value
  },

  setter: function (field, value) {
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
  },

  restoreField: function (field) {
    const initial = this.helpers[field].initial
    this.setter(field, initial)
  },

  getName: (field) => {
    const fieldEls = field.split('.')
    return fieldEls[fieldEls.length - 1]
  },

  fetchAll: function () {
    for (const helper of Object.values(this.helpers)) {
      helper.fetch()
    }
  },

  syncAll: function () {
    for (const helper of Object.values(this.helpers)) {
      helper.sync()
    }
  },

  onPostSync: function (e) {
    if (e.helper.options.callback) {
      e.helper.options.callback.call(e.helper.options.callbackContext || this.obj, e)
    }
    if (this.options.callback) {
      this.options.callback.call(this.options.callbackContext || this.obj, e)
    }
  },
})

L.FormBuilder.Element = L.Evented.extend({
  initialize: function (builder, field, options) {
    this.builder = builder
    this.obj = this.builder.obj
    this.form = this.builder.form
    this.field = field
    L.setOptions(this, options)
    this.fieldEls = this.field.split('.')
    this.name = this.builder.getName(field)
    this.parentNode = this.getParentNode()
    this.buildLabel()
    this.build()
    this.buildHelpText()
    this.fireAndForward('helper:init')
  },

  fireAndForward: function (type, e = {}) {
    e.helper = this
    this.fire(type, e)
    this.builder.fire(type, e)
    if (this.obj.fire) this.obj.fire(type, e)
  },

  getParentNode: function () {
    return this.options.wrapper
      ? L.DomUtil.create(
          this.options.wrapper,
          this.options.wrapperClass || '',
          this.form
        )
      : this.form
  },

  get: function () {
    return this.builder.getter(this.field)
  },

  toHTML: function () {
    return this.get()
  },

  toJS: function () {
    return this.value()
  },

  sync: function () {
    this.fireAndForward('presync')
    this.set()
    this.fireAndForward('postsync')
  },

  set: function () {
    this.builder.setter(this.field, this.toJS())
  },

  getLabelParent: function () {
    return this.parentNode
  },

  getHelpTextParent: function () {
    return this.parentNode
  },

  buildLabel: function () {
    if (this.options.label) {
      this.label = L.DomUtil.create('label', '', this.getLabelParent())
      this.label.innerHTML = this.options.label
    }
  },

  buildHelpText: function () {
    if (this.options.helpText) {
      const container = L.DomUtil.create('small', 'help-text', this.getHelpTextParent())
      container.innerHTML = this.options.helpText
    }
  },

  fetch: () => {},

  finish: function () {
    this.fireAndForward('finish')
  },
})

L.FormBuilder.Textarea = L.FormBuilder.Element.extend({
  build: function () {
    this.input = L.DomUtil.create(
      'textarea',
      this.options.className || '',
      this.parentNode
    )
    if (this.options.placeholder) this.input.placeholder = this.options.placeholder
    this.fetch()
    L.DomEvent.on(this.input, 'input', this.sync, this)
    L.DomEvent.on(this.input, 'keypress', this.onKeyPress, this)
  },

  fetch: function () {
    const value = this.toHTML()
    this.initial = value
    if (value) {
      this.input.value = value
    }
  },

  value: function () {
    return this.input.value
  },

  onKeyPress: function (e) {
    if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey)) {
      L.DomEvent.stop(e)
      this.finish()
    }
  },
})

L.FormBuilder.Input = L.FormBuilder.Element.extend({
  build: function () {
    this.input = L.DomUtil.create(
      'input',
      this.options.className || '',
      this.parentNode
    )
    this.input.type = this.type()
    this.input.name = this.name
    this.input._helper = this
    if (this.options.placeholder) {
      this.input.placeholder = this.options.placeholder
    }
    if (this.options.min !== undefined) {
      this.input.min = this.options.min
    }
    if (this.options.max !== undefined) {
      this.input.max = this.options.max
    }
    if (this.options.step) {
      this.input.step = this.options.step
    }
    this.fetch()
    L.DomEvent.on(this.input, this.getSyncEvent(), this.sync, this)
    L.DomEvent.on(this.input, 'keydown', this.onKeyDown, this)
  },

  fetch: function () {
    const value = this.toHTML() !== undefined ? this.toHTML() : null
    this.initial = value
    this.input.value = value
  },

  getSyncEvent: () => 'input',

  type: function () {
    return this.options.type || 'text'
  },

  value: function () {
    return this.input.value || undefined
  },

  onKeyDown: function (e) {
    if (e.key === 'Enter') {
      L.DomEvent.stop(e)
      this.finish()
    }
  },
})

L.FormBuilder.BlurInput = L.FormBuilder.Input.extend({
  getSyncEvent: () => 'blur',

  build: function () {
    L.FormBuilder.Input.prototype.build.call(this)
    L.DomEvent.on(this.input, 'focus', this.fetch, this)
  },

  finish: function () {
    this.sync()
    L.FormBuilder.Input.prototype.finish.call(this)
  },

  sync: function () {
    // Do not commit any change if user only clicked
    // on the field than clicked outside
    if (this.initial !== this.value()) {
      L.FormBuilder.Input.prototype.sync.call(this)
    }
  },
})

L.FormBuilder.IntegerMixin = {
  value: function () {
    return !isNaN(this.input.value) && this.input.value !== ''
      ? parseInt(this.input.value, 10)
      : undefined
  },

  type: () => 'number',
}

L.FormBuilder.IntInput = L.FormBuilder.Input.extend({
  includes: [L.FormBuilder.IntegerMixin],
})

L.FormBuilder.BlurIntInput = L.FormBuilder.BlurInput.extend({
  includes: [L.FormBuilder.IntegerMixin],
})

L.FormBuilder.FloatMixin = {
  value: function () {
    return !isNaN(this.input.value) && this.input.value !== ''
      ? parseFloat(this.input.value)
      : undefined
  },

  type: () => 'number',
}

L.FormBuilder.FloatInput = L.FormBuilder.Input.extend({
  options: {
    step: 'any',
  },

  includes: [L.FormBuilder.FloatMixin],
})

L.FormBuilder.BlurFloatInput = L.FormBuilder.BlurInput.extend({
  options: {
    step: 'any',
  },

  includes: [L.FormBuilder.FloatMixin],
})

L.FormBuilder.CheckBox = L.FormBuilder.Element.extend({
  build: function () {
    const container = L.DomUtil.create('div', 'checkbox-wrapper', this.parentNode)
    this.input = L.DomUtil.create('input', this.options.className || '', container)
    this.input.type = 'checkbox'
    this.input.name = this.name
    this.input._helper = this
    this.fetch()
    L.DomEvent.on(this.input, 'change', this.sync, this)
  },

  fetch: function () {
    this.initial = this.toHTML()
    this.input.checked = this.initial === true
  },

  value: function () {
    return this.input.checked
  },

  toHTML: function () {
    return [1, true].indexOf(this.get()) !== -1
  },
})

L.FormBuilder.Select = L.FormBuilder.Element.extend({
  selectOptions: [['value', 'label']],

  build: function () {
    this.select = L.DomUtil.create('select', '', this.parentNode)
    this.select.name = this.name
    this.validValues = []
    this.buildOptions()
    L.DomEvent.on(this.select, 'change', this.sync, this)
  },

  getOptions: function () {
    return this.options.selectOptions || this.selectOptions
  },

  fetch: function () {
    this.buildOptions()
  },

  buildOptions: function () {
    this.select.innerHTML = ''
    for (const option of this.getOptions()) {
      if (typeof option === 'string') this.buildOption(option, option)
      else this.buildOption(option[0], option[1])
    }
  },

  buildOption: function (value, label) {
    this.validValues.push(value)
    const option = L.DomUtil.create('option', '', this.select)
    option.value = value
    option.innerHTML = label
    if (this.toHTML() === value) {
      option.selected = 'selected'
    }
  },

  value: function () {
    if (this.select[this.select.selectedIndex])
      return this.select[this.select.selectedIndex].value
  },

  getDefault: function () {
    return this.getOptions()[0][0]
  },

  toJS: function () {
    const value = this.value()
    if (this.validValues.indexOf(value) !== -1) {
      return value
    }
    return this.getDefault()
  },
})

L.FormBuilder.IntSelect = L.FormBuilder.Select.extend({
  value: function () {
    return parseInt(L.FormBuilder.Select.prototype.value.apply(this), 10)
  },
})

L.FormBuilder.NullableBoolean = L.FormBuilder.Select.extend({
  selectOptions: [
    [undefined, 'inherit'],
    [true, 'yes'],
    [false, 'no'],
  ],

  toJS: function () {
    let value = this.value()
    switch (value) {
      case 'true':
      case true:
        value = true
        break
      case 'false':
      case false:
        value = false
        break
      default:
        value = undefined
    }
    return value
  },
})
