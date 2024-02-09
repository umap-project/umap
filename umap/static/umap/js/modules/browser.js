// Uses `L._`` from Leaflet.i18n which we cannot import as a module yet
import { DomUtil, DomEvent } from '../../vendors/leaflet/leaflet-src.esm.js'

export default class Browser {
  constructor(map) {
    this.map = map
    this.map.on('moveend', this.onMoveEnd, this)
    this.options = {
      filter: '',
      inBbox: false,
    }
  }

  addFeature(feature, parent) {
    const filter = this.options.filter
    if (filter && !feature.matchFilter(filter, this.filterKeys)) return
    if (this.options.inBbox && !feature.isOnScreen(this.bounds)) return
    const feature_li = DomUtil.create('li', `${feature.getClassName()} feature`),
      zoom_to = DomUtil.create('i', 'feature-zoom_to', feature_li),
      edit = DomUtil.create('i', 'show-on-edit feature-edit', feature_li),
      del = DomUtil.create('i', 'show-on-edit feature-delete', feature_li),
      colorBox = DomUtil.create('i', 'feature-color', feature_li),
      title = DomUtil.create('span', 'feature-title', feature_li),
      symbol = feature._getIconUrl
        ? U.Icon.prototype.formatUrl(feature._getIconUrl(), feature)
        : null
    zoom_to.title = L._('Bring feature to center')
    edit.title = L._('Edit this feature')
    del.title = L._('Delete this feature')
    title.textContent = feature.getDisplayName() || '—'
    const bgcolor = feature.getDynamicOption('color')
    colorBox.style.backgroundColor = bgcolor
    if (symbol && symbol !== this.map.options.default_iconUrl) {
      const icon = U.Icon.makeIconElement(symbol, colorBox)
      U.Icon.setIconContrast(icon, colorBox, symbol, bgcolor)
    }
    DomEvent.on(
      zoom_to,
      'click',
      function (e) {
        e.callback = L.bind(this.view, this)
        this.zoomTo(e)
      },
      feature
    )
    DomEvent.on(
      title,
      'click',
      function (e) {
        e.callback = L.bind(this.view, this)
        this.zoomTo(e)
      },
      feature
    )
    DomEvent.on(edit, 'click', feature.edit, feature)
    DomEvent.on(del, 'click', feature.confirmDelete, feature)
    // HOTFIX. Remove when this is released:
    // https://github.com/Leaflet/Leaflet/pull/9052
    DomEvent.disableClickPropagation(feature_li)
    parent.appendChild(feature_li)
  }

  datalayerId(datalayer) {
    return `browse_data_datalayer_${L.stamp(datalayer)}`
  }

  onDataLayerChanged(e) {
    this.updateDatalayer(e.target)
  }

  addDataLayer(datalayer, parent) {
    const container = DomUtil.create('div', datalayer.getHidableClass(), parent),
      headline = DomUtil.create('h5', '', container),
      counter = DomUtil.create('span', 'datalayer-counter', headline)
    container.id = this.datalayerId(datalayer)
    datalayer.renderToolbox(headline)
    DomUtil.add('span', '', headline, datalayer.options.name)
    const ul = DomUtil.create('ul', '', container)
    this.updateDatalayer(datalayer)
    datalayer.on('datachanged', this.onDataLayerChanged, this)
    this.map.ui.once('panel:closed', () => {
      datalayer.off('datachanged', this.onDataLayerChanged, this)
    })
  }

  updateDatalayer(datalayer) {
    // Compute once, but use it for each feature later.
    this.bounds = this.map.getBounds()
    const parent = DomUtil.get(this.datalayerId(datalayer))
    // Panel is not open
    if (!parent) return
    DomUtil.classIf(parent, 'off', !datalayer.isVisible())
    const container = parent.querySelector('ul'),
      counter = parent.querySelector('.datalayer-counter')
    container.innerHTML = ''
    datalayer.eachFeature((feature) => this.addFeature(feature, container))

    let total = datalayer.count(),
      current = container.querySelectorAll('li').length,
      count = total == current ? total : `${current}/${total}`
    counter.textContent = count
    counter.title = L._('Features in this layer: {count}', { count: count })
  }

  onFormChange() {
    this.map.eachBrowsableDataLayer((datalayer) => {
      datalayer.resetLayer(true)
      this.updateDatalayer(datalayer)
    })
  }

  onMoveEnd() {
    const isBrowserOpen = !!document.querySelector('.umap-browse-data')
    if (!isBrowserOpen) return
    const isListDynamic = this.options.inBbox
    this.map.eachBrowsableDataLayer((datalayer) => {
      if (!isListDynamic && !datalayer.hasDynamicData()) return
      this.updateDatalayer(datalayer)
    })
  }

  open() {
    // Get once but use it for each feature later
    this.filterKeys = this.map.getFilterKeys()
    const container = DomUtil.create('div', 'umap-browse-data')
    // HOTFIX. Remove when this is released:
    // https://github.com/Leaflet/Leaflet/pull/9052
    DomEvent.disableClickPropagation(container)

    const title = DomUtil.add(
      'h3',
      'umap-browse-title',
      container,
      this.map.options.name
    )

    const formContainer = DomUtil.create('div', '', container)
    const dataContainer = DomUtil.create('div', 'umap-browse-features', container)

    const fields = [
      ['options.filter', { handler: 'Input', placeholder: L._('Filter') }],
      ['options.inBbox', { handler: 'Switch', label: L._('Current map view') }],
    ]
    const builder = new U.FormBuilder(this, fields, {
      makeDirty: false,
      callback: () => this.onFormChange(),
    })
    formContainer.appendChild(builder.build())

    this.map.ui.openPanel({
      data: { html: container },
      actions: [this.map._aboutLink()],
    })

    this.map.eachBrowsableDataLayer((datalayer) => {
      this.addDataLayer(datalayer, dataContainer)
    })
  }
}
