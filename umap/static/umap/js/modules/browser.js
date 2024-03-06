import { DomUtil, DomEvent } from '../../vendors/leaflet/leaflet-src.esm.js'
import Orderable from './orderable.js'
import {translate} from './i18n.js'

export default class Browser {
  constructor(map) {
    this.map = map
    this.map.on('moveend', this.onMoveEnd, this)
    this.map.on('edit:enabled', this.onEnableEdit, this)
    this.map.on('edit:disabled', this.onDisableEdit, this)
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
    zoom_to.title = translate('Bring feature to center')
    edit.title = translate('Edit this feature')
    del.title = translate('Delete this feature')
    title.textContent = feature.getDisplayName() || '—'
    const bgcolor = feature.getDynamicOption('color')
    colorBox.style.backgroundColor = bgcolor
    if (symbol && symbol !== U.SCHEMA.iconUrl.default) {
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
    let className = `orderable datalayer ${datalayer.getHidableClass()}`
    if (this.map.ui.PANEL_MODE !== 'condensed') className += ' show-list'
    const container = DomUtil.create(
        'div',
        className,
        parent
      ),
      headline = DomUtil.create('h5', '', container)
    container.id = this.datalayerId(datalayer)
    const ul = DomUtil.create('ul', '', container)
    this.updateDatalayer(datalayer)
    datalayer.on('datachanged', this.onDataLayerChanged, this)
    this.map.ui.once('panel:closed', () => {
      datalayer.off('datachanged', this.onDataLayerChanged, this)
    })
    container.dataset.id = L.stamp(datalayer)
  }

  updateDatalayer(datalayer) {
    // Compute once, but use it for each feature later.
    this.bounds = this.map.getBounds()
    const parent = DomUtil.get(this.datalayerId(datalayer))
    // Panel is not open
    if (!parent) return
    DomUtil.classIf(parent, 'off', !datalayer.isVisible())
    const container = parent.querySelector('ul')
    const headline = parent.querySelector('h5')
    const toggleList = () => parent.classList.toggle('show-list')
    headline.innerHTML = ''
    const toggle = DomUtil.create('i', 'datalayer-toggle-list', headline)
    DomEvent.on(toggle, 'click', toggleList)
    datalayer.renderToolbox(headline)
    const name = DomUtil.create('span', 'datalayer-name', headline)
    DomEvent.on(name, 'click', toggleList)
    container.innerHTML = ''
    datalayer.eachFeature((feature) => this.addFeature(feature, container))

    let total = datalayer.count(),
      current = container.querySelectorAll('li').length,
      count = total == current ? total : `${current}/${total}`
    name.textContent = `${datalayer.options.name} (${count})`
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
    const container = DomUtil.create('div')
    // HOTFIX. Remove when this is released:
    // https://github.com/Leaflet/Leaflet/pull/9052
    DomEvent.disableClickPropagation(container)

    const title = DomUtil.add('h3', '', container, translate('Browse data'))
    const formContainer = DomUtil.create('div', '', container)
    const dataContainer = DomUtil.create('div', '', container)

    const fields = [
      ['options.filter', { handler: 'Input', placeholder: translate('Filter') }],
      ['options.inBbox', { handler: 'Switch', label: translate('Current map view') }],
    ]
    const builder = new U.FormBuilder(this, fields, {
      makeDirty: false,
      callback: () => this.onFormChange(),
    })
    formContainer.appendChild(builder.build())

    let className = 'umap-browser'
    if (this.map.editEnabled) className += ' dark'
    this.map.ui.openPanel({
      data: { html: container },
      className: className
    })

    this.map.eachBrowsableDataLayer((datalayer) => {
      this.addDataLayer(datalayer, dataContainer)
    })
    // After datalayers have been added.
    const orderable = new Orderable(dataContainer, L.bind(this.onReorder, this))
  }

  onReorder(src, dst, initialIndex, finalIndex) {
    const layer = this.map.datalayers[src.dataset.id],
      other = this.map.datalayers[dst.dataset.id],
      minIndex = Math.min(layer.getRank(), other.getRank()),
      maxIndex = Math.max(layer.getRank(), other.getRank())
    if (finalIndex === 0) layer.bringToTop()
    else if (finalIndex > initialIndex) layer.insertBefore(other)
    else layer.insertAfter(other)
    this.map.eachDataLayerReverse((datalayer) => {
      if (datalayer.getRank() >= minIndex && datalayer.getRank() <= maxIndex)
        datalayer.isDirty = true
    })
    this.map.indexDatalayers()
  }

  onEnableEdit () {
    this.map.ui._panel.classList.add('dark')
  }

  onDisableEdit () {
    this.map.ui._panel.classList.remove('dark')
  }
}
