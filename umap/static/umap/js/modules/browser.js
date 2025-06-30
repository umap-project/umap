import { DomEvent, DomUtil, stamp } from '../../vendors/leaflet/leaflet-src.esm.js'
import { Form } from './form/builder.js'
import { EXPORT_FORMATS } from './formatter.js'
import { translate } from './i18n.js'
import * as Icon from './rendering/icon.js'
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
      <li class="feature ${feature.getClassName()}">
        <button class="icon icon-16 icon-zoom" title="${translate('Bring feature to center')}" data-ref=zoom></button>
        <button class="icon icon-16 show-on-edit icon-edit" title="${translate('Edit this feature')}" data-ref=edit></button>
        <button class="icon icon-16 show-on-edit icon-delete" title="${translate('Delete this feature')}" data-ref=remove></button>
        <i class="icon icon-16 icon-${feature.getClassName()} feature-color" data-ref=colorBox></i>
        <span class="feature-title" data-ref=label></span>
      </li>
    `
    const [row, { zoom, edit, remove, colorBox, label }] =
      Utils.loadTemplateWithRefs(template)
    label.textContent = label.title = feature.getDisplayName() || '—'
    const symbol = feature._getIconUrl
      ? Icon.formatUrl(feature._getIconUrl(), feature)
      : null
    const bgcolor = feature.getPreviewColor()
    colorBox.style.backgroundColor = bgcolor
    if (symbol && symbol !== SCHEMA.iconUrl.default) {
      const icon = Icon.makeElement(symbol, colorBox)
      Icon.setContrast(icon, colorBox, symbol, bgcolor)
    } else if (DomUtil.contrastedColor(colorBox, bgcolor)) {
      colorBox.classList.add('icon-white')
    }
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
      <details class="datalayer ${datalayer.getHidableClass()}" id="${this.datalayerId(datalayer)}"${open}>
        <summary data-ref=headline>
          <span data-ref=toolbox></span>
          <span class="datalayer-name" data-id="${datalayer.id}" data-ref=label></span>
          <span class="datalayer-counter"></span>
        </summary>
        <ul></ul>
      </details>
    `)
    datalayer.renderToolbox(toolbox)
    parent.appendChild(container)
    this.updateDatalayer(datalayer)
  }

  updateDatalayer(datalayer) {
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
    Utils.toggleBadge(this.filtersTitle, this.hasFilters())
    Utils.toggleBadge('.umap-control-browse', this.hasFilters())
  }

  onFormChange() {
    this._umap.datalayers.browsable().map((datalayer) => {
      datalayer.resetLayer(true)
      this.updateDatalayer(datalayer)
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

  hasFilters() {
    return !!this.options.filter || this._umap.facets.isActive()
  }

  onMoveEnd() {
    if (!this.isOpen()) return
    const isListDynamic = this.options.inBbox
    this._umap.datalayers.browsable().map((datalayer) => {
      if (!isListDynamic && !datalayer.hasDynamicData()) return
      this.updateDatalayer(datalayer)
    })
  }

  update() {
    if (!this.isOpen()) return
    this.dataContainer.innerHTML = ''
    this._umap.datalayers.browsable().map((datalayer) => {
      this.addDataLayer(datalayer, this.dataContainer)
    })
  }

  open(mode) {
    // Force only if mode is known, otherwise keep current mode.
    if (mode) this.mode = mode
    const template = `
      <div>
        <h3><i class="icon icon-16 icon-layers"></i>${translate('Data browser')}</h3>
        <details class="filters" data-ref="details">
          <summary data-ref=filtersTitle><i class="icon icon-16 icon-filters"></i>${translate('Filters')}</summary>
          <fieldset>
            <div data-ref=formContainer>
            </div>
            <button class="flat" type="button" data-ref=reset><i class="icon icon-16 icon-restore" title=""></i>${translate('Reset all')}</button>
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

    this.filtersTitle = filtersTitle
    this.dataContainer = dataContainer
    this.formContainer = formContainer
    this.toggleBadge()

    let fields = [
      [
        'options.filter',
        { handler: 'Input', placeholder: translate('Search map features…') },
      ],
      ['options.inBbox', { handler: 'Switch', label: translate('Current map view') }],
    ]
    const builder = new Form(this, fields)
    builder.on('set', () => this.onFormChange())
    let filtersBuilder
    this.formContainer.appendChild(builder.build())
    builder.form.addEventListener('reset', () => {
      window.setTimeout(builder.syncAll.bind(builder))
    })
    if (this._umap.properties.facetKey) {
      fields = this._umap.facets.build()
      filtersBuilder = new Form(this._umap.facets, fields)
      filtersBuilder.on('set', () => this.onFormChange())
      filtersBuilder.form.addEventListener('reset', () => {
        window.setTimeout(filtersBuilder.syncAll.bind(filtersBuilder))
      })
      this.formContainer.appendChild(filtersBuilder.build())
    }
    reset.addEventListener('click', () => this.resetFilters())

    this._umap.panel.open({
      content: container,
      className: 'umap-browser',
    })

    this.update()
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
      datalayer._forcedVisibility = true
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
