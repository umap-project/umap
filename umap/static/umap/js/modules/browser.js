import { DomEvent, DomUtil, stamp } from '../../vendors/leaflet/leaflet-src.esm.js'
import { Form } from './form/builder.js'
import { EXPORT_FORMATS } from './formatter.js'
import { translate } from './i18n.js'
import ContextMenu from './ui/contextmenu.js'
import * as Utils from './utils.js'
import { SCHEMA } from './schema.js'

export default class Browser {
  constructor(umap, leafletMap) {
    this._umap = umap
    this._leafletMap = leafletMap
    this._leafletMap.on('moveend', this.onMoveEnd, this)
    this.options = {
      filter: '',
      inBbox: false,
    }
    this.mode = 'layers'
  }

  addFeature(feature, parent) {
    if (feature.isFiltered()) return
    if (this.options.inBbox && !feature.isOnScreen(this.bounds)) return
    const template = `
      <li class="feature ${feature.getClassName()} ${feature.getUniqueClassName()} with-toolbox">
        <span>
          <i class="icon icon-16 icon-${feature.getClassName()} feature-color" data-ref=colorBox></i>
          <span class="feature-title truncate" data-ref=label></span>
        </span>
        <span>
          <button class="icon icon-16 icon-zoom" title="${translate('Bring feature to center')}" data-ref=zoom></button
          ><button class="icon icon-16 show-on-edit icon-edit" title="${translate('Edit this feature')}" data-ref=edit></button
          ><button class="icon icon-16 show-on-edit icon-delete" title="${translate('Delete this feature')}" data-ref=remove></button>
        </span>
      </li>
    `
    const [row, { zoom, edit, remove, colorBox, label }] =
      Utils.loadTemplateWithRefs(template)
    label.textContent = label.title = feature.getDisplayName() || '—'
    feature.makePreview(colorBox)
    const viewFeature = (e) => {
      feature.zoomTo({ ...e, callback: () => feature.view() })
    }
    zoom.addEventListener('click', viewFeature)
    label.addEventListener('click', viewFeature)
    edit.addEventListener('click', () => feature.edit())
    remove.addEventListener('click', () => feature.del())
    // HOTFIX. Remove when this is released:
    // https://github.com/Leaflet/Leaflet/pull/9052
    DomEvent.disableClickPropagation(row)
    parent.appendChild(row)
  }

  datalayerId(datalayer) {
    return `browse_data_datalayer_${stamp(datalayer)}`
  }

  addDataLayer(datalayer, parent) {
    const open = this.mode !== 'layers' ? ' open' : ''
    const [container, { headline, toolbox, label }] = Utils.loadTemplateWithRefs(`
      <details class="datalayer ${datalayer.cssId}" id="${this.datalayerId(datalayer)}"${open}>
        <summary data-ref=headline class="with-toolbox">
          <span>
            <span class="datalayer-name truncate" data-id="${datalayer.id}" data-ref=label></span>
            <span class="datalayer-counter"></span>
          </span>
          <span data-ref=toolbox></span>
        </summary>
        <ul></ul>
      </details>
    `)
    datalayer.renderToolbox(toolbox)
    parent.appendChild(container)
    this.updateFeaturesList(datalayer)
  }

  updateFeaturesList(datalayer) {
    // Compute once, but use it for each feature later.
    this.bounds = this._leafletMap.getBounds()
    const id = this.datalayerId(datalayer)
    const parent = document.getElementById(id)
    // Panel is not open
    if (!parent) return
    parent.classList.toggle('off', !datalayer.isVisible())
    const label = parent.querySelector('.datalayer-name')
    const container = parent.querySelector('ul')
    container.innerHTML = ''
    datalayer.features.forEach((feature) => this.addFeature(feature, container))
    datalayer.propagate(['properties.name'])
    const total = datalayer.count()
    if (!total) return
    const current = container.querySelectorAll('li').length
    const count = total === current ? total : `${current}/${total}`
    const counter = parent.querySelector('.datalayer-counter')
    counter.textContent = `(${count})`
    counter.title = translate(`Features in this layer: ${count}`)
  }

  toggleBadge() {
    Utils.toggleBadge(this.filtersTitle, this.hasActiveFilters())
    Utils.toggleBadge('.umap-control-browse', this.hasActiveFilters())
  }

  onFormChange() {
    this._umap.datalayers.browsable().map((datalayer) => {
      datalayer.resetLayer(true)
      this.updateFeaturesList(datalayer)
      if (this._umap.fullPanel?.isOpen()) datalayer.tableEdit()
    })
    this.toggleBadge()
  }

  redraw() {
    if (this.isOpen()) this.open()
  }

  isOpen() {
    return !!document.querySelector('.on .umap-browser')
  }

  hasActiveFilters() {
    return !!this.options.filter || this._umap.hasActiveFilters()
  }

  onMoveEnd() {
    if (!this.isOpen()) return
    this._umap.datalayers.browsable().map((datalayer) => {
      if (!this.options.inBbox && !datalayer.hasDynamicData()) return
      this.updateFeaturesList(datalayer)
    })
  }

  update() {
    if (!this.isOpen()) return
    this.dataContainer.innerHTML = ''
    for (const datalayer of this._umap.datalayers.browsable()) {
      this.addDataLayer(datalayer, this.dataContainer)
    }
  }

  open(mode) {
    // Force only if mode is known, otherwise keep current mode.
    if (mode) this.mode = mode
    const template = `
      <div>
        <h3><i class="icon icon-16 icon-layers"></i>${translate('Data browser')}</h3>
        <details class="filters" data-ref="details">
          <summary data-ref=filtersTitle>
            <i class="icon icon-16 icon-filters"></i>${translate('Filters')}
          </summary>
          <button type="button" class="show-on-edit flat" data-ref=manageFilters>${translate('Manage filters')}</button>
          <fieldset>
            <div data-ref="formContainer" class="formbox">
            </div>
            <button class="flat" type="button" data-ref=reset><i class="icon icon-16 icon-restore" title=""></i> ${translate('Reset all')}</button>
          </fieldset>
        </details>
        <div class="main-toolbox">
          <i class="icon icon-16 icon-eye" title="${translate('show/hide all layers')}" data-ref="toggle"></i>
          <i class="icon icon-16 icon-zoom" title="${translate('zoom to data extent')}" data-ref="fitBounds"></i>
          <i class="icon icon-16 icon-download" title="${translate('download visible data')}" data-ref="download"></i>
        </div>
        <div data-ref=dataContainer></div>
      </div>
    `
    const [
      container,
      {
        details,
        filtersTitle,
        toggle,
        fitBounds,
        download,
        dataContainer,
        formContainer,
        reset,
        manageFilters,
      },
    ] = Utils.loadTemplateWithRefs(template)
    // HOTFIX. Remove when this is released:
    // https://github.com/Leaflet/Leaflet/pull/9052
    DomEvent.disableClickPropagation(container)
    details.open = this.mode === 'filters'
    toggle.addEventListener('click', () => this.toggleLayers())
    fitBounds.addEventListener('click', () => this._umap.fitDataBounds())
    download.addEventListener('click', () => this.downloadVisible(download))
    download.hidden = this._umap.getProperty('embedControl') === false
    reset.addEventListener('click', () => this.resetFilters())
    manageFilters.addEventListener('click', () => {
      this._umap.edit().then((panel) => panel.scrollTo('details#fields-management'))
      this._umap.filters.edit()
    })

    this.filtersTitle = filtersTitle
    this.dataContainer = dataContainer
    this.formContainer = formContainer
    this.toggleBadge()
    this.buildFilters()
    this._umap.panel.open({
      content: container,
      className: 'umap-browser',
    })

    this.update()
  }

  buildFilters() {
    this.formContainer.innerHTML = ''
    const fields = [
      [
        'options.filter',
        { handler: 'Input', placeholder: translate('Search map features…') },
      ],
      ['options.inBbox', { handler: 'Switch', label: translate('Current map view') }],
    ]
    const searchForm = new Form(this, fields, { className: 'formbox' })
    const listenFormChanges = (form) => {
      form.on('set', () => this.onFormChange())
      form.form.addEventListener('reset', () => {
        window.setTimeout(form.syncAll.bind(form))
      })
    }
    this.formContainer.appendChild(searchForm.build())
    listenFormChanges(searchForm)
    if (this._umap.filters.size) {
      const filtersForm = this._umap.filters.buildForm(this.formContainer)
      listenFormChanges(filtersForm)
    }
    for (const datalayer of this._umap.datalayers.active()) {
      if (datalayer.filters.size) {
        const filtersForm = datalayer.filters.buildForm(this.formContainer)
        listenFormChanges(filtersForm)
      }
    }
  }

  resetFilters() {
    for (const form of this.formContainer?.querySelectorAll('form') || []) {
      form.reset()
    }
  }

  downloadVisible(element) {
    const menu = new ContextMenu({ fixed: true })
    const items = []
    for (const format of Object.keys(EXPORT_FORMATS)) {
      items.push({
        label: format,
        action: () => this._umap.share.download(format),
      })
    }
    menu.openBelow(element, items)
  }

  toggleLayers() {
    // If at least one layer is shown, hide it
    // otherwise show all
    let allHidden = true
    this._umap.datalayers.browsable().map((datalayer) => {
      if (datalayer.isVisible()) allHidden = false
    })
    this._umap.datalayers.browsable().map((datalayer) => {
      datalayer.autoVisibility = false
      if (allHidden) {
        datalayer.show()
      } else {
        if (datalayer.isVisible()) datalayer.hide()
      }
    })
  }

  static backButton(umap) {
    const button = Utils.loadTemplate(
      `<button class="icon icon-16 icon-back" title="${translate('Back to browser')}"></button>`
    )
    // Fixme: remove me when this is merged and released
    // https://github.com/Leaflet/Leaflet/pull/9052
    DomEvent.disableClickPropagation(button)
    button.addEventListener('click', () => umap.openBrowser())
    return button
  }
}
