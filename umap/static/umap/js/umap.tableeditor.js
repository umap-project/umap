U.TableEditor = L.Class.extend({
  initialize: function (datalayer) {
    this.datalayer = datalayer
    this.table = L.DomUtil.create('div', 'table')
    this.header = L.DomUtil.create('div', 'thead', this.table)
    this.body = L.DomUtil.create('div', 'tbody', this.table)
    this.resetProperties()
  },

  renderHeaders: function () {
    this.header.innerHTML = ''
    for (let i = 0; i < this.properties.length; i++) {
      this.renderHeader(this.properties[i])
    }
  },

  renderHeader: function (property) {
    const container = L.DomUtil.create('div', 'tcell', this.header)
    const title = L.DomUtil.add('span', '', container, property)
    const del = L.DomUtil.create('i', 'umap-delete', container)
    const rename = L.DomUtil.create('i', 'umap-edit', container)
    del.title = L._('Delete this property on all the features')
    rename.title = L._('Rename this property on all the features')
    L.DomEvent.on(del, 'click', () => this.deleteProperty(property))
    L.DomEvent.on(rename, 'click', () => this.renameProperty(property))
  },

  renderRow: function (feature) {
    const builder = new U.FormBuilder(feature, this.field_properties, {
      id: `umap-feature-properties_${L.stamp(feature)}`,
      className: 'trow',
      callback: feature.resetTooltip,
    })
    this.body.appendChild(builder.build())
  },

  compileProperties: function () {
    this.resetProperties()
    if (this.properties.length === 0) this.properties = ['name']
    // description is a forced textarea, don't edit it in a text input, or you lose cariage returns
    if (this.properties.indexOf('description') !== -1)
      this.properties.splice(this.properties.indexOf('description'), 1)
    this.properties.sort()
    this.field_properties = []
    for (let i = 0; i < this.properties.length; i++) {
      this.field_properties.push([
        `properties.${this.properties[i]}`,
        { wrapper: 'div', wrapperClass: 'tcell' },
      ])
    }
  },

  resetProperties: function () {
    this.properties = this.datalayer._propertiesIndex
  },

  validateName: (name) => {
    if (name.indexOf('.') !== -1) {
      U.Alert.error(L._('Invalide property name: {name}', { name: name }))
      return false
    }
    return true
  },

  renameProperty: function (property) {
    this.datalayer.map.dialog
      .prompt(L._('Please enter the new name of this property'))
      .then(({ prompt }) => {
        if (!prompt || !this.validateName(prompt)) return
        this.datalayer.eachLayer((feature) => {
          feature.renameProperty(property, prompt)
        })
        this.datalayer.deindexProperty(property)
        this.datalayer.indexProperty(prompt)
        this.edit()
      })
  },

  deleteProperty: function (property) {
    this.datalayer.map.dialog
      .confirm(
        L._('Are you sure you want to delete this property on all the features?')
      )
      .then(() => {
        this.datalayer.eachLayer((feature) => {
          feature.deleteProperty(property)
        })
        this.datalayer.deindexProperty(property)
        this.resetProperties()
        this.edit()
      })
  },

  addProperty: function () {
    this.datalayer.map.dialog
      .prompt(L._('Please enter the name of the property'))
      .then(({ prompt }) => {
        if (!prompt || !this.validateName(prompt)) return
        this.datalayer.indexProperty(prompt)
        this.edit()
      })
  },

  deleteRows: function () {
    const dialog = this.datalayer.map.dialog
    const promise = dialog.prompt(L._('Deleting rows matching condition'))

    const autocomplete = new U.AutocompleteDatalist(
      dialog.dialog.querySelector('[name=prompt]')
    )
    autocomplete.suggestions = this.datalayer._propertiesIndex
    autocomplete.input.addEventListener('input', (event) => {
      const value = event.target.value
      if (this.datalayer._propertiesIndex.includes(value)) {
        autocomplete.suggestions = [`${value}=`, `${value}!=`, `${value}>`, `${value}<`]
      } else if (value.endsWith('=')) {
        const key = value.split('!')[0].split('=')[0]
        autocomplete.suggestions = this.datalayer
          .sortedValues(key)
          .map((str) => `${value}${str || ''}`)
      }
    })

    promise.then(({ prompt }) => {
      if (!prompt) return
      const rule = new U.Rule(prompt)
      const matched = []
      this.datalayer.eachLayer((feature) => {
        if (rule.match(feature.properties)) {
          matched.push(feature)
        }
      })
      if (!matched) {
        U.Alert.error(L._('Nothing matched'))
        return
      }
      this.datalayer.hide()
      for (const feature of matched) {
        feature.del()
      }
      this.datalayer.isDirty = true
      this.datalayer.show()
      this.edit()
    })
  },

  edit: function () {
    const id = 'tableeditor:edit'
    this.compileProperties()
    this.renderHeaders()
    this.body.innerHTML = ''
    this.datalayer.eachLayer(this.renderRow, this)
    const addButton = L.DomUtil.createButton(
      'flat',
      undefined,
      L._('Add a new property')
    )
    const iconElement = L.DomUtil.createIcon(addButton, 'icon-add')
    addButton.insertBefore(iconElement, addButton.firstChild)
    L.DomEvent.on(addButton, 'click', this.addProperty, this)
    const refineButton = L.DomUtil.createButton('flat', undefined, L._('Delete rows'))
    refineButton.insertBefore(
      L.DomUtil.createIcon(refineButton, 'icon-add'),
      refineButton.firstChild
    )
    L.DomEvent.on(refineButton, 'click', this.deleteRows, this)
    this.datalayer.map.fullPanel.open({
      content: this.table,
      className: 'umap-table-editor',
      actions: [addButton, refineButton],
    })
  },
})
