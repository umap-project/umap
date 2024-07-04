import { DomEvent, DomUtil } from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'

export default class TableEditor {
  constructor(datalayer) {
    this.datalayer = datalayer
    this.table = DomUtil.create('table')
    this.thead = DomUtil.create('thead', '', this.table)
    this.header = DomUtil.create('tr', '', this.thead)
    this.body = DomUtil.create('tbody', '', this.table)
    this.resetProperties()
    this.body.addEventListener('dblclick', (event) => {
      if (event.target.closest('[data-property]')) this.editCell(event.target)
    })
    this.body.addEventListener('click', (event) => this.setFocus(event.target))
    this.body.addEventListener('keydown', (event) => this.onKeyDown(event))
  }

  renderHeaders() {
    this.header.innerHTML = '<th><input type="checkbox" /></th>'
    for (let i = 0; i < this.properties.length; i++) {
      this.renderHeader(this.properties[i])
    }
    const checkbox = this.header.querySelector('input[type=checkbox]')
    checkbox.addEventListener('change', (event) => {
      if (checkbox.checked) this.checkAll()
      else this.checkAll(false)
    })
  }

  renderHeader(property) {
    const container = DomUtil.create('th', '', this.header)
    const title = DomUtil.add('span', '', container, property)
    const del = DomUtil.create('i', 'umap-delete', container)
    const rename = DomUtil.create('i', 'umap-edit', container)
    del.title = translate('Delete this property on all the features')
    rename.title = translate('Rename this property on all the features')
    DomEvent.on(del, 'click', () => this.deleteProperty(property))
    DomEvent.on(rename, 'click', () => this.renameProperty(property))
  }

  renderBody() {
    const bounds = this.datalayer.map.getBounds()
    const inBbox = this.datalayer.map.browser.options.inBbox
    let html = ''
    for (const feature of Object.values(this.datalayer._layers)) {
      if (feature.isFiltered()) continue
      if (inBbox && !feature.isOnScreen(bounds)) continue
      html += `<tr data-feature="${feature.id}"><th><input type="checkbox" /></th>${this.properties.map((prop) => `<td tabindex="0" data-property="${prop}">${feature.properties[prop] || ''}</td>`).join('')}</tr>`
    }
    // this.datalayer.eachLayer(this.renderRow, this)
    // const builder = new U.FormBuilder(feature, this.field_properties, {
    //   id: `umap-feature-properties_${L.stamp(feature)}`,
    //   className: 'trow',
    //   callback: feature.resetTooltip,
    // })
    // this.body.appendChild(builder.build())
    this.body.innerHTML = html
  }

  compileProperties() {
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
        { wrapper: 'td' },
      ])
    }
  }

  resetProperties() {
    this.properties = this.datalayer._propertiesIndex
  }

  validateName(name) {
    if (name.includes('.') !== -1) {
      U.Alert.error(translate('Invalide property name: {name}', { name: name }))
      return false
    }
    return true
  }

  renameProperty(property) {
    this.datalayer.map.dialog
      .prompt(translate('Please enter the new name of this property'))
      .then(({ prompt }) => {
        if (!prompt || !this.validateName(prompt)) return
        this.datalayer.eachLayer((feature) => {
          feature.renameProperty(property, prompt)
        })
        this.datalayer.deindexProperty(property)
        this.datalayer.indexProperty(prompt)
        this.open()
      })
  }

  deleteProperty(property) {
    this.datalayer.map.dialog
      .confirm(
        translate('Are you sure you want to delete this property on all the features?')
      )
      .then(() => {
        this.datalayer.eachLayer((feature) => {
          feature.deleteProperty(property)
        })
        this.datalayer.deindexProperty(property)
        this.resetProperties()
        this.open()
      })
  }

  addProperty() {
    this.datalayer.map.dialog
      .prompt(translate('Please enter the name of the property'))
      .then(({ prompt }) => {
        if (!prompt || !this.validateName(prompt)) return
        this.datalayer.indexProperty(prompt)
        this.edit()
      })
  }

  open() {
    const id = 'tableeditor:edit'
    this.compileProperties()
    this.renderHeaders()
    this.body.innerHTML = ''
    this.renderBody()
    const addButton = DomUtil.createButton(
      'flat',
      undefined,
      translate('Add a new property')
    )
    const iconElement = DomUtil.createIcon(addButton, 'icon-add')
    addButton.insertBefore(iconElement, addButton.firstChild)
    DomEvent.on(addButton, 'click', this.addProperty, this)

    const template = document.createElement('template')
    template.innerHTML = `
      <button class="flat" type="button" data-ref="delete">
        <i class="icon icon-16 icon-delete"></i>${translate('Delete selected rows')}
      </button>`
    const deleteButton = template.content.firstElementChild
    deleteButton.addEventListener('click', () => this.deleteRows())

    this.datalayer.map.fullPanel.open({
      content: this.table,
      className: 'umap-table-editor',
      actions: [addButton, deleteButton],
    })
  }

  editCell(cell) {
    const property = cell.dataset.property
    const field = `properties.${property}`
    const feature = this.datalayer.getFeatureById(
      event.target.parentNode.dataset.feature
    )
    const builder = new U.FormBuilder(feature, [field], {
      id: `umap-feature-properties_${L.stamp(feature)}`,
      className: 'trow',
      callback: feature.resetTooltip,
    })
    cell.innerHTML = ''
    cell.appendChild(builder.build())
    const input = builder.helpers[field].input
    input.focus()
    input.addEventListener('blur', () => {
      cell.innerHTML = feature.properties[property] || ''
    })
  }

  onKeyDown(event) {
    const key = event.key
    if (key === 'Enter') {
      const current = this.getFocus()
      if (current) {
        this.editCell(current)
        event.preventDefault()
        event.stopPropagation()
      }
    }
  }

  checkAll(status = true) {
    for (const checkbox of this.body.querySelectorAll('input[type=checkbox]')) {
      checkbox.checked = status
    }
  }

  getSelectedRows() {
    return Array.from(this.body.querySelectorAll('input[type=checkbox]:checked')).map(
      (checkbox) => checkbox.parentNode.parentNode
    )
  }

  getFocus() {
    return this.body.querySelector(':focus')
  }

  setFocus(cell) {
    cell.focus({ focusVisible: true })
  }

  deleteRows() {
    const selectedRows = this.getSelectedRows()
    if (!selectedRows.length) return
    this.datalayer.map.dialog
      .confirm(
        translate('Found {count} rows. Are you sure you want to delete all?', {
          count: selectedRows.length,
        })
      )
      .then(() => {
        this.datalayer.hide()
        for (const row of selectedRows) {
          const id = row.dataset.feature
          const feature = this.datalayer.getFeatureById(id)
          feature.del()
        }
        this.datalayer.show()
        this.datalayer.fire('datachanged')
        this.renderBody()
        this.datalayer.map.browser.resetFilters()
      })
  }
}
