import { translate } from './i18n.js'

export default class TableEditor {
  constructor(datalayer) {
    this.datalayer = datalayer
  }

  async open() {
    const mod = await import('../../vendors/tabulator/js/tabulator_esm.js')
    const data = []
    this.datalayer.eachFeature((feature) => {
      // Allow to retrieve feature later for sync
      feature.properties._id = feature.id
      // Pass by reference, so tabluator edits in place.
      data.push(feature.properties)
    })
    const properties = this.datalayer._propertiesIndex
    if (properties.length === 0) properties.push('name')
    if (!properties.includes('description')) properties.push('description')
    const columns = properties.map((prop) => this.columnDefinition(prop))

    const tableEl = document.createElement('div')
    // We use TabulatorFull instead of Tabulator + Modules as per bug
    // https://github.com/olifolkerd/tabulator/issues/3455
    const table = new mod.TabulatorFull(tableEl, {
      // Be very carefull when touching height or changing the parent element
      // of the table: when the height is not set or the space on the parent
      // element is not enough, with a bit table it will freeze the browser
      // https://tabulator.info/docs/6.2/layout#height-variable
      height: '100%',
      renderHorizontal: 'virtual',
      data: data,
      rowHeader: {
        headerSort: false,
        resizable: false,
        frozen: true,
        headerHozAlign: 'center',
        hozAlign: 'center',
        formatter: 'rowSelection',
        titleFormatter: 'rowSelection',
        titleFormatterParams: {
          rowRange: 'active', // Only toggle the values of the active filtered rows
        },
      },
      columns: columns,
      headerSortClickElement: 'icon',
      editTriggerEvent: 'dblclick',
    })
    table.on('cellEdited', (cell) => {
      const id = cell.getData()._id
      const feature = this.datalayer.getFeatureById(id)
      feature.onCommit() // Sync the changes.
      feature.render([cell.getColumn().getField()]) // Update the map.
    })

    const template = document.createElement('template')
    template.innerHTML = `
      <button class="flat" type="button" data-ref="add">
        <i class="icon icon-16 icon-add"></i>${translate('Add new column')}
      </button>`
    const addButton = template.content.firstElementChild
    addButton.addEventListener('click', () => this.addColumn(table))

    template.innerHTML = `
      <button class="flat" type="button" data-ref="delete">
        <i class="icon icon-16 icon-delete"></i>${translate('Delete selected rows')}
      </button>`
    const deleteButton = template.content.firstElementChild
    deleteButton.addEventListener('click', () => this.deleteRows(table))

    this.datalayer.map.fullPanel.open({
      content: tableEl,
      actions: [deleteButton, addButton],
    })
  }

  columnDefinition(property) {
    function headerFilterFunc(headerValue, rowValue) {
      if (rowValue === undefined) return
      switch (headerValue[0]) {
        case '!':
          return !rowValue.includes(headerValue.slice(1))
        case '>':
          return rowValue > headerValue.slice(1)
        case '<':
          return rowValue < headerValue.slice(1)
        default:
          return rowValue.includes(headerValue)
      }
    }

    return {
      title: property,
      field: property,
      editor: property === 'description' ? 'textarea' : 'input',
      // Do not show _umap_options and _id
      visible: !property.startsWith('_'),
      headerFilter: 'input',
      headerFilterFunc: headerFilterFunc,
      headerMenu: [
        {
          label: translate('Rename this column'),
          action: (e, column) => this.renameColumn(column),
        },
        {
          label: translate('Hide this column'),
          action: (e, column) => column.hide(),
        },
        {
          label: translate('Delete this column'),
          action: (e, column) => this.deleteColumn(column),
        },
      ],
    }
  }

  validateName(name) {
    if (name.includes('.')) {
      U.Alert.error(translate('Invalide property name: {name}', { name: name }))
      return false
    }
    if (this.datalayer._propertiesIndex.includes(name)) {
      U.Alert.error(translate('This name already exists: {name}', { name: name }))
      return false
    }
    return true
  }

  deleteColumn(column) {
    const property = column.getField()
    this.datalayer.map.dialog
      .confirm(
        translate('Are you sure you want to delete this property on all the features?')
      )
      .then(() => {
        column.delete().then(() => {
          this.datalayer.eachLayer((feature) => {
            feature.deleteProperty(property)
          })
          this.datalayer.deindexProperty(property)
        })
      })
  }

  renameColumn(column) {
    const property = column.getField()
    this.datalayer.map.dialog
      .prompt(translate('Please enter the new name of this property'))
      .then(({ prompt }) => {
        if (!prompt || !this.validateName(prompt)) return
        this.datalayer.eachLayer((feature) => {
          feature.renameProperty(property, prompt)
        })
        this.datalayer.deindexProperty(property)
        this.datalayer.indexProperty(prompt)
        column.updateDefinition({ field: prompt, title: prompt })
      })
  }

  addColumn(table) {
    this.datalayer.map.dialog
      .prompt(translate('Please enter the name of the column'))
      .then(({ prompt }) => {
        if (!prompt || !this.validateName(prompt)) return
        this.datalayer.indexProperty(prompt)
        table.addColumn(this.columnDefinition(prompt), true)
      })
  }

  deleteRows(table) {
    const selectedRows = table.getSelectedRows()
    if (!selectedRows.length) return
    this.datalayer.map.dialog
      .confirm(
        translate('Found {count} rows. Are you sure you want to delete all?', {
          count: selectedRows.length,
        })
      )
      .then(() => {
        table.blockRedraw()
        for (const row of selectedRows) {
          row.delete()
          const id = row.getData()._id
          const feature = this.datalayer.getFeatureById(id)
          feature.del()
        }
        table.restoreRedraw()
        table.clearFilter(true)
      })
  }
}
