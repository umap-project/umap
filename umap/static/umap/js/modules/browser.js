import { DomEvent, DomUtil, stamp } from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'
import * as Icon from './rendering/icon.js'
import * as Utils from './utils.js'
import { EXPORT_FORMATS } from './formatter.js'
import ContextMenu from './ui/contextmenu.js'
import { Form } from './form/builder.js'

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
    const row = DomUtil.create('li', `${feature.getClassName()} feature`)
    const zoom_to = DomUtil.createButtonIcon(
      row,
      'icon-zoom',
      translate('Bring feature to center')
    )
    const edit = DomUtil.createButtonIcon(
      row,
      'show-on-edit icon-edit',
      translate('Edit this feature')
    )
    const del = DomUtil.createButtonIcon(
      row,
      'show-on-edit icon-delete',
      translate('Delete this feature')
    )
    const colorBox = DomUtil.create(
      'i',
      `icon icon-16 icon-${feature.getClassName()} feature-color`,
      row
    )
    const title = DomUtil.create('span', 'feature-title', row)
    const symbol = feature._getIconUrl
      ? Icon.formatUrl(feature._getIconUrl(), feature)
      : null
    title.textContent = title.title = feature.getDisplayName() || '—'
    const bgcolor = feature.getPreviewColor()
    colorBox.style.backgroundColor = bgcolor
    if (symbol && symbol !== U.SCHEMA.iconUrl.default) {
      const icon = Icon.makeElement(symbol, colorBox)
      Icon.setContrast(icon, colorBox, symbol, bgcolor)
    } else if (DomUtil.contrastedColor(colorBox, bgcolor)) {
      colorBox.classList.add('icon-white')
    }
    const viewFeature = (e) => {
      feature.zoomTo({ ...e, callback: () => feature.view() })
    }
    DomEvent.on(zoom_to, 'click', viewFeature)
    DomEvent.on(title, 'click', viewFeature)
    DomEvent.on(edit, 'click', feature.edit, feature)
    DomEvent.on(del, 'click', feature.confirmDelete, feature)
    // HOTFIX. Remove when this is released:
    // https://github.com/Leaflet/Leaflet/pull/9052
    DomEvent.disableClickPropagation(row)
    parent.appendChild(row)
  }

  datalayerId(datalayer) {
    return `browse_data_datalayer_${stamp(datalayer)}`
  }

  addDataLayer(datalayer, parent) {
    let className = `datalayer ${datalayer.getHidableClass()}`
    if (this.mode !== 'layers') className += ' show-list'
    const container = DomUtil.create('div', className, parent)
    const headline = DomUtil.create('h5', '', container)
    container.id = this.datalayerId(datalayer)
    const ul = DomUtil.create('ul', '', container)
    this.updateDatalayer(datalayer)
  }

  updateDatalayer(datalayer) {
    // Compute once, but use it for each feature later.
    this.bounds = this._leafletMap.getBounds()
    const parent = DomUtil.get(this.datalayerId(datalayer))
    // Panel is not open
    if (!parent) return
    parent.classList.toggle('off', !datalayer.isVisible())
    const container = parent.querySelector('ul')
    const headline = parent.querySelector('h5')
    const toggleList = () => parent.classList.toggle('show-list')
    headline.innerHTML = ''
    const toggle = DomUtil.create('i', 'icon icon-16 datalayer-toggle-list', headline)
    DomEvent.on(toggle, 'click', toggleList)
    datalayer.renderToolbox(headline)
    const name = DomUtil.create('span', 'datalayer-name', headline)
    name.textContent = name.title = datalayer.options.name
    DomEvent.on(name, 'click', toggleList)
    container.innerHTML = ''
    datalayer.eachFeature((feature) => this.addFeature(feature, container))

    const total = datalayer.count()
    if (!total) return
    const current = container.querySelectorAll('li').length
    const count = total === current ? total : `${current}/${total}`
    const counter = DomUtil.create('span', 'datalayer-counter', headline)
    counter.textContent = `(${count})`
    counter.title = translate(`Features in this layer: ${count}`)
  }

  toggleBadge() {
    U.Utils.toggleBadge(this.filtersTitle, this.hasFilters())
    U.Utils.toggleBadge('.umap-control-browse', this.hasFilters())
  }

  onFormChange() {
    this._umap.eachBrowsableDataLayer((datalayer) => {
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
    this._umap.eachBrowsableDataLayer((datalayer) => {
      if (!isListDynamic && !datalayer.hasDynamicData()) return
      this.updateDatalayer(datalayer)
    })
  }

  update() {
    if (!this.isOpen()) return
    this.dataContainer.innerHTML = ''
    this._umap.eachBrowsableDataLayer((datalayer) => {
      this.addDataLayer(datalayer, this.dataContainer)
    })
  }

  open(mode) {
    // Force only if mode is known, otherwise keep current mode.
    if (mode) this.mode = mode
    const container = DomUtil.create('div')
    // HOTFIX. Remove when this is released:
    // https://github.com/Leaflet/Leaflet/pull/9052
    DomEvent.disableClickPropagation(container)

    DomUtil.createTitle(container, translate('Data browser'), 'icon-layers')
    this.formContainer = DomUtil.createFieldset(container, L._('Filters'), {
      on: this.mode === 'filters',
      className: 'filters',
      icon: 'icon-filters',
    })
    this.filtersTitle = container.querySelector('summary')
    this.toggleBadge()
    this.addMainToolbox(container)
    this.dataContainer = DomUtil.create('div', '', container)

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
    DomEvent.on(builder.form, 'reset', () => {
      window.setTimeout(builder.syncAll.bind(builder))
    })
    if (this._umap.properties.facetKey) {
      fields = this._umap.facets.build()
      filtersBuilder = new Form(this._umap.facets, fields)
      filtersBuilder.on('set', () => this.onFormChange())
      DomEvent.on(filtersBuilder.form, 'reset', () => {
        window.setTimeout(filtersBuilder.syncAll.bind(filtersBuilder))
      })
      this.formContainer.appendChild(filtersBuilder.build())
    }
    const reset = DomUtil.createButton('flat', this.formContainer, '', () =>
      this.resetFilters()
    )
    DomUtil.createIcon(reset, 'icon-restore')
    DomUtil.element({
      tagName: 'span',
      parent: reset,
      textContent: translate('Reset all'),
    })

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

  addMainToolbox(container) {
    const [toolbox, { toggle, fitBounds, download }] = Utils.loadTemplateWithRefs(`
      <div class="main-toolbox">
        <i class="icon icon-16 icon-eye" title="${translate('show/hide all layers')}" data-ref="toggle"></i>
        <i class="icon icon-16 icon-zoom" title="${translate('zoom to data extent')}" data-ref="fitBounds"></i>
        <i class="icon icon-16 icon-download" title="${translate('download visible data')}" data-ref="download"></i>
      </div>
    `)
    container.appendChild(toolbox)
    toggle.addEventListener('click', () => this.toggleLayers())
    fitBounds.addEventListener('click', () => this._umap.fitDataBounds())
    download.addEventListener('click', () => this.downloadVisible(download))
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
    this._umap.eachBrowsableDataLayer((datalayer) => {
      if (datalayer.isVisible()) allHidden = false
    })
    this._umap.eachBrowsableDataLayer((datalayer) => {
      datalayer._forcedVisibility = true
      if (allHidden) {
        datalayer.show()
      } else {
        if (datalayer.isVisible()) datalayer.hide()
      }
    })
  }

  static backButton(umap) {
    const button = DomUtil.createButtonIcon(
      DomUtil.create('li', '', undefined),
      'icon-back',
      translate('Back to browser')
    )
    // Fixme: remove me when this is merged and released
    // https://github.com/Leaflet/Leaflet/pull/9052
    DomEvent.disableClickPropagation(button)
    DomEvent.on(button, 'click', () => umap.openBrowser())
    return button
  }
}
