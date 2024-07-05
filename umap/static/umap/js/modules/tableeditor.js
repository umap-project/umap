import { DomEvent, DomUtil } from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'
import ContextMenu from './ui/contextmenu.js'
import { WithTemplate, loadTemplate } from './utils.js'

const TEMPLATE = `
  <table>
    <thead>
      <tr data-ref="header"></tr>
    </thead>
    <tbody data-ref="body">
    </tbody>
  </table>
`

export default class TableEditor extends WithTemplate {
  constructor(datalayer) {
    super()
    this.datalayer = datalayer
    this.map = this.datalayer.map
    this.contextmenu = new ContextMenu({ className: 'dark' })
    this.table = this.loadTemplate(TEMPLATE)
    this.resetProperties()
    this.elements.body.addEventListener('dblclick', (event) => {
      if (event.target.closest('[data-property]')) this.editCell(event.target)
    })
    this.elements.body.addEventListener('click', (event) => this.setFocus(event.target))
    this.elements.body.addEventListener('keydown', (event) => this.onKeyDown(event))
    this.elements.header.addEventListener('click', (event) => {
      const property = event.target.dataset.property
      if (property) this.openHeaderMenu(property)
    })
  }

  openHeaderMenu(property) {
    let filterItem
    if (this.map.facets.has(property)) {
      filterItem = {
        label: translate('Remove filter for this property'),
        action: () => {
          this.map.facets.remove(property)
          this.map.browser.open('filters')
        },
      }
    } else {
      filterItem = {
        label: translate('Add filter for this property'),
        action: () => {
          this.map.facets.add(property)
          this.map.browser.open('filters')
        },
      }
    }
    this.contextmenu.open(
      [event.clientX, event.clientY],
      [
        {
          label: translate('Delete this property on all the features'),
          action: () => this.deleteProperty(property),
        },
        {
          label: translate('Rename this property on all the features'),
          action: () => this.renameProperty(property),
        },
        filterItem,
      ]
    )
  }

  renderHeaders() {
    this.elements.header.innerHTML = ''
    const th = loadTemplate('<th><input type="checkbox" /></th>')
    const checkbox = th.firstChild
    this.elements.header.appendChild(th)
    for (const property of this.properties) {
      this.elements.header.appendChild(
        loadTemplate(
          `<th>${property}<button data-property="${property}" class="flat" aria-label="${translate('Advanced actions')}">…</button></th>`
        )
      )
    }
    checkbox.addEventListener('change', (event) => {
      if (checkbox.checked) this.checkAll()
      else this.checkAll(false)
    })
  }

  renderBody() {
    const bounds = this.map.getBounds()
    const inBbox = this.map.browser.options.inBbox
    let html = ''
    for (const feature of Object.values(this.datalayer._layers)) {
      if (feature.isFiltered()) continue
      if (inBbox && !feature.isOnScreen(bounds)) continue
      const tds = this.properties.map(
        (prop) =>
          `<td tabindex="0" data-property="${prop}">${feature.properties[prop] || ''}</td>`
      )
      html += `<tr data-feature="${feature.id}"><th><input type="checkbox" /></th>${tds.join('')}</tr>`
    }
    this.elements.body.innerHTML = html
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
    this.map.dialog
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
    this.map.dialog
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
    this.map.dialog
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
    this.elements.body.innerHTML = ''
    this.renderBody()

    const addButton = loadTemplate(`
      <button class="flat" type="button" data-ref="add">
        <i class="icon icon-16 icon-add"></i>${translate('Add a new property')}
      </button>`)
    addButton.addEventListener('click', () => this.addProperty())

    const deleteButton = loadTemplate(`
      <button class="flat" type="button" data-ref="delete">
        <i class="icon icon-16 icon-delete"></i>${translate('Delete selected rows')}
      </button>`)
    deleteButton.addEventListener('click', () => this.deleteRows())

    const filterButton = loadTemplate(`
      <button class="flat" type="button" data-ref="filters">
        <i class="icon icon-16 icon-filters"></i>${translate('Filter data')}
      </button>`)
    filterButton.addEventListener('click', () => this.map.browser.open('filters'))

    this.map.fullPanel.open({
      content: this.table,
      className: 'umap-table-editor',
      actions: [addButton, deleteButton, filterButton],
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
    for (const checkbox of this.elements.body.querySelectorAll(
      'input[type=checkbox]'
    )) {
      checkbox.checked = status
    }
  }

  getSelectedRows() {
    return Array.from(
      this.elements.body.querySelectorAll('input[type=checkbox]:checked')
    ).map((checkbox) => checkbox.parentNode.parentNode)
  }

  getFocus() {
    return this.elements.body.querySelector(':focus')
  }

  setFocus(cell) {
    cell.focus({ focusVisible: true })
  }

  deleteRows() {
    const selectedRows = this.getSelectedRows()
    if (!selectedRows.length) return
    this.map.dialog
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
        this.map.browser.resetFilters()
        this.map.browser.open('filters')
      })
  }
}
