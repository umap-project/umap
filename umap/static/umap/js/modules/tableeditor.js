import { DomEvent, DomUtil } from '../../vendors/leaflet/leaflet-src.esm.js'
import { MutatingForm } from './form/builder.js'
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
  constructor(umap, datalayer, leafletMap) {
    super()
    this.datalayer = datalayer
    this._umap = umap
    this._leafletMap = leafletMap
    this.contextmenu = new ContextMenu({ className: 'dark' })
    this.table = this.loadTemplate(TEMPLATE)
    if (!this.datalayer.isRemoteLayer()) {
      this.elements.body.addEventListener('dblclick', (event) => {
        if (event.target.closest('[data-property]')) this.editCell(event.target)
      })
    }
    this.elements.body.addEventListener('click', (event) => this.setFocus(event.target))
    this.elements.body.addEventListener('keydown', (event) => this.onKeyDown(event))
    this.elements.header.addEventListener('click', (event) => {
      const property = event.target.dataset.property
      if (property) this.openHeaderMenu(property)
    })
  }

  openHeaderMenu(property) {
    const actions = []
    let filterItem
    if (this._umap.facets.has(property)) {
      filterItem = {
        label: translate('Remove filter for this column'),
        action: () => {
          this._umap.facets.remove(property)
          this._umap.browser.open('filters')
        },
      }
    } else {
      filterItem = {
        label: translate('Add filter for this column'),
        action: () => {
          this._umap.facets.add(property)
          this._umap.browser.open('filters')
        },
      }
    }
    actions.push(filterItem)
    if (!this.datalayer.isRemoteLayer()) {
      actions.push({
        label: translate('Rename this column'),
        action: () => this.renameProperty(property),
      })
      actions.push({
        label: translate('Delete this column'),
        action: () => this.deleteProperty(property),
      })
    }
    this.contextmenu.open(event, actions)
  }

  renderHeaders() {
    this.elements.header.innerHTML = ''
    const th = loadTemplate('<th><input type="checkbox" /></th>')
    const checkbox = th.firstChild
    this.elements.header.appendChild(th)
    for (const field of this.datalayer.fields) {
      this.elements.header.appendChild(
        loadTemplate(
          `<th>${field.key}<button data-property="${field.key}" class="flat" aria-label="${translate('Advanced actions')}">…</button></th>`
        )
      )
    }
    checkbox.addEventListener('change', (event) => {
      if (checkbox.checked) this.checkAll()
      else this.checkAll(false)
    })
  }

  renderBody() {
    const bounds = this._leafletMap.getBounds()
    const inBbox = this._umap.browser.options.inBbox
    let html = ''
    this.datalayer.features.forEach((feature) => {
      if (feature.isFiltered()) return
      if (inBbox && !feature.isOnScreen(bounds)) return
      const tds = this.datalayer.fields.map(
        (field) =>
          `<td tabindex="0" data-property="${field.key}">${feature.properties[field.key] ?? ''}</td>`
      )
      html += `<tr data-feature="${feature.id}"><th><input type="checkbox" /></th>${tds.join('')}</tr>`
    })
    this.elements.body.innerHTML = html
  }

  renameProperty(property) {
    this.datalayer.askForRenameProperty(property).then(() => this.open())
  }

  deleteProperty(property) {
    this.datalayer.confirmDeleteProperty(property).then(() => this.open())
  }

  addProperty() {
    this.datalayer.addProperty().then(() => this.open())
  }

  open() {
    const id = 'tableeditor:edit'
    this.renderHeaders()
    this.elements.body.innerHTML = ''
    this.renderBody()

    const actions = []
    if (!this.datalayer.isRemoteLayer()) {
      const addButton = loadTemplate(`
        <button class="flat" type="button" data-ref="add">
          <i class="icon icon-16 icon-add"></i>${translate('Add a new field')}
        </button>`)
      addButton.addEventListener('click', () => this.addProperty())
      actions.push(addButton)

      const deleteButton = loadTemplate(`
        <button class="flat" type="button" data-ref="delete">
          <i class="icon icon-16 icon-delete"></i>${translate('Delete selected rows')}
        </button>`)
      deleteButton.addEventListener('click', () => this.deleteRows())
      actions.push(deleteButton)
    }

    const filterButton = loadTemplate(`
      <button class="flat" type="button" data-ref="filters">
        <i class="icon icon-16 icon-filters"></i>${translate('Filter data')}
      </button>`)
    filterButton.addEventListener('click', () => this._umap.browser.open('filters'))
    actions.push(filterButton)

    this._umap.fullPanel.open({
      content: this.table,
      className: 'umap-table-editor',
      actions: actions,
    })
  }

  editCell(cell) {
    if (this.datalayer.isRemoteLayer()) return
    const property = cell.dataset.property
    const field = `properties.${property}`
    const tr = event.target.closest('tr')
    const feature = this.datalayer.features.get(tr.dataset.feature)
    const handler = property === 'description' ? 'Textarea' : 'Input'
    const builder = new MutatingForm(feature, [[field, { handler }]], {
      id: `umap-feature-properties_${feature.id}`,
    })
    cell.innerHTML = ''
    cell.appendChild(builder.build())
    const input = builder.helpers[field].input
    input.focus()
    input.addEventListener('blur', () => {
      cell.innerHTML = feature.properties[property] || ''
      cell.focus()
    })
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        builder.restoreField(field)
        cell.innerHTML = feature.properties[property] || ''
        cell.focus()
        event.stopPropagation()
      }
    })
  }

  onKeyDown(event) {
    // Only on data <td>, not inputs or anything else
    if (!event.target.dataset.property) return
    const key = event.key
    const actions = {
      Enter: () => this.editCurrent(),
      ArrowRight: () => this.moveRight(),
      ArrowLeft: () => this.moveLeft(),
      ArrowUp: () => this.moveUp(),
      ArrowDown: () => this.moveDown(),
    }
    if (key in actions) {
      actions[key]()
      event.preventDefault()
    }
  }

  editCurrent() {
    const current = this.getFocus()
    if (current) {
      this.editCell(current)
    }
  }

  moveRight() {
    const cell = this.getFocus()
    if (cell.nextSibling) cell.nextSibling.focus()
  }

  moveLeft() {
    const cell = this.getFocus()
    if (cell.previousSibling) cell.previousSibling.focus()
  }

  moveDown() {
    const cell = this.getFocus()
    const tr = cell.closest('tr')
    const property = cell.dataset.property
    const nextTr = tr.nextSibling
    if (nextTr) {
      nextTr.querySelector(`td[data-property="${property}"`).focus()
    }
  }

  moveUp() {
    const cell = this.getFocus()
    const tr = cell.closest('tr')
    const property = cell.dataset.property
    const previousTr = tr.previousSibling
    if (previousTr) {
      previousTr.querySelector(`td[data-property="${property}"`).focus()
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
    this._umap.dialog
      .confirm(
        translate('Found {count} rows. Are you sure you want to delete all?', {
          count: selectedRows.length,
        })
      )
      .then(() => {
        this.datalayer.hide()
        for (const row of selectedRows) {
          const id = row.dataset.feature
          const feature = this.datalayer.features.get(id)
          feature.del()
        }
        this.datalayer.show()
        this.datalayer.dataChanged()
        this.renderBody()
        if (this._umap.browser.isOpen()) {
          this._umap.browser.resetFilters()
          this._umap.browser.open('filters')
        }
      })
  }
}
