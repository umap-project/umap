L.U.TableEditor = L.Class.extend({
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
    const container = L.DomUtil.create('div', 'tcell', this.header),
      title = L.DomUtil.add('span', '', container, property),
      del = L.DomUtil.create('i', 'umap-delete', container),
      rename = L.DomUtil.create('i', 'umap-edit', container)
    del.title = L._('Delete this property on all the features')
    rename.title = L._('Rename this property on all the features')
    const doDelete = function () {
      if (
        confirm(
          L._('Are you sure you want to delete this property on all the features?')
        )
      ) {
        this.datalayer.eachLayer((feature) => {
          feature.deleteProperty(property)
        })
        this.datalayer.deindexProperty(property)
        this.resetProperties()
        this.edit()
      }
    }
    const doRename = function () {
      const newName = prompt(
        L._('Please enter the new name of this property'),
        property
      )
      if (!newName || !this.validateName(newName)) return
      this.datalayer.eachLayer((feature) => {
        feature.renameProperty(property, newName)
      })
      this.datalayer.deindexProperty(property)
      this.datalayer.indexProperty(newName)
      this.resetProperties()
      this.edit()
    }
    L.DomEvent.on(del, 'click', doDelete, this)
    L.DomEvent.on(rename, 'click', doRename, this)
  },

  renderRow: function (feature) {
    const builder = new L.U.FormBuilder(feature, this.field_properties, {
      id: `umap-feature-properties_${L.stamp(feature)}`,
      className: 'trow',
      callback: feature.resetTooltip,
    })
    this.body.appendChild(builder.build())
  },

  compileProperties: function () {
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

  validateName: function (name) {
    if (name.indexOf('.') !== -1) {
      this.datalayer.map.ui.alert({
        content: L._('Invalide property name: {name}', { name: name }),
        level: 'error',
      })
      return false
    }
    return true
  },

  edit: function () {
    const id = 'tableeditor:edit'
    this.datalayer.map.fire('dataloading', { id: id })
    this.compileProperties()
    this.renderHeaders()
    this.body.innerHTML = ''
    this.datalayer.eachLayer(this.renderRow, this)
    const addButton = L.DomUtil.create('li', 'add-property')
    L.DomUtil.create('i', 'umap-icon-16 umap-add', addButton)
    const label = L.DomUtil.create('span', '', addButton)
    label.textContent = label.title = L._('Add a new property')
    const addProperty = function () {
      const newName = prompt(L._('Please enter the name of the property'))
      if (!newName || !this.validateName(newName)) return
      this.datalayer.indexProperty(newName)
      this.edit()
    }
    L.DomEvent.on(addButton, 'click', addProperty, this)
    const className =
      this.properties.length > 2
        ? 'umap-table-editor fullwidth dark'
        : 'umap-table-editor dark'
    this.datalayer.map.ui.openPanel({
      data: { html: this.table },
      className: className,
      actions: [addButton],
    })
    this.datalayer.map.fire('dataload', { id: id })
  },
})
