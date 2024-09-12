import { DomEvent, DomUtil, stamp } from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'
import * as Icon from './rendering/icon.js'

export default class Browser {
  constructor(map) {
    this.map = map
    this.map.on('moveend', this.onMoveEnd, this)
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
    title.textContent = feature.getDisplayName() || '—'
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
    this.bounds = this.map.getBounds()
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
    name.textContent = datalayer.options.name
    DomEvent.on(name, 'click', toggleList)
    container.innerHTML = ''
    datalayer.eachFeature((feature) => this.addFeature(feature, container))

    const total = datalayer.count()
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
    this.map.eachBrowsableDataLayer((datalayer) => {
      datalayer.resetLayer(true)
      this.updateDatalayer(datalayer)
      if (this.map.fullPanel?.isOpen()) datalayer.tableEdit()
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
    return !!this.options.filter || this.map.facets.isActive()
  }

  onMoveEnd() {
    if (!this.isOpen()) return
    const isListDynamic = this.options.inBbox
    this.map.eachBrowsableDataLayer((datalayer) => {
      if (!isListDynamic && !datalayer.hasDynamicData()) return
      this.updateDatalayer(datalayer)
    })
  }

  update() {
    if (!this.isOpen()) return
    this.dataContainer.innerHTML = ''
    this.map.eachBrowsableDataLayer((datalayer) => {
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
    this.dataContainer = DomUtil.create('div', '', container)

    let fields = [
      [
        'options.filter',
        { handler: 'Input', placeholder: translate('Search map features…') },
      ],
      ['options.inBbox', { handler: 'Switch', label: translate('Current map view') }],
    ]
    const builder = new L.FormBuilder(this, fields, {
      callback: () => this.onFormChange(),
    })
    let filtersBuilder
    this.formContainer.appendChild(builder.build())
    DomEvent.on(builder.form, 'reset', () => {
      window.setTimeout(builder.syncAll.bind(builder))
    })
    if (this.map.options.facetKey) {
      fields = this.map.facets.build()
      filtersBuilder = new L.FormBuilder(this.map.facets, fields, {
        callback: () => this.onFormChange(),
      })
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

    this.map.panel.open({
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

  static backButton(map) {
    const button = DomUtil.createButtonIcon(
      DomUtil.create('li', '', undefined),
      'icon-back',
      translate('Back to browser')
    )
    // Fixme: remove me when this is merged and released
    // https://github.com/Leaflet/Leaflet/pull/9052
    DomEvent.disableClickPropagation(button)
    DomEvent.on(button, 'click', map.openBrowser, map)
    return button
  }
}
