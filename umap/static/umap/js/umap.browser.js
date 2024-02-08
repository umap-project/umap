L.U.Browser = L.Class.extend({
  options: {
    filter: '',
    inBbox: false,
  },

  initialize: function (map) {
    this.map = map
    this.map.on('moveend', this.onMoveEnd, this)
  },

  addFeature: function (feature, parent) {
    const filter = this.options.filter
    if (filter && !feature.matchFilter(filter, this.filterKeys)) return
    if (this.options.inBbox && !feature.isOnScreen(this.bounds)) return
    const feature_li = L.DomUtil.create('li', `${feature.getClassName()} feature`),
      zoom_to = L.DomUtil.create('i', 'feature-zoom_to', feature_li),
      edit = L.DomUtil.create('i', 'show-on-edit feature-edit', feature_li),
      del = L.DomUtil.create('i', 'show-on-edit feature-delete', feature_li),
      colorBox = L.DomUtil.create('i', 'feature-color', feature_li),
      title = L.DomUtil.create('span', 'feature-title', feature_li),
      symbol = feature._getIconUrl
        ? L.U.Icon.prototype.formatUrl(feature._getIconUrl(), feature)
        : null
    zoom_to.title = L._('Bring feature to center')
    edit.title = L._('Edit this feature')
    del.title = L._('Delete this feature')
    title.textContent = feature.getDisplayName() || '—'
    const bgcolor = feature.getDynamicOption('color')
    colorBox.style.backgroundColor = bgcolor
    if (symbol && symbol !== this.map.options.default_iconUrl) {
      const icon = L.U.Icon.makeIconElement(symbol, colorBox)
      L.U.Icon.setIconContrast(icon, colorBox, symbol, bgcolor)
    }
    L.DomEvent.on(
      zoom_to,
      'click',
      function (e) {
        e.callback = L.bind(this.view, this)
        this.zoomTo(e)
      },
      feature
    )
    L.DomEvent.on(
      title,
      'click',
      function (e) {
        e.callback = L.bind(this.view, this)
        this.zoomTo(e)
      },
      feature
    )
    L.DomEvent.on(edit, 'click', feature.edit, feature)
    L.DomEvent.on(del, 'click', feature.confirmDelete, feature)
    // HOTFIX. Remove when this is released:
    // https://github.com/Leaflet/Leaflet/pull/9052
    L.DomEvent.disableClickPropagation(feature_li)
    parent.appendChild(feature_li)
  },

  datalayerId: function (datalayer) {
    return `browse_data_datalayer_${L.stamp(datalayer)}`
  },

  onDataLayerChanged: function (e) {
    this.updateDatalayer(e.target)
  },

  addDataLayer: function (datalayer, parent) {
    const container = L.DomUtil.create('div', datalayer.getHidableClass(), parent),
      headline = L.DomUtil.create('h5', '', container),
      counter = L.DomUtil.create('span', 'datalayer-counter', headline)
    container.id = this.datalayerId(datalayer)
    datalayer.renderToolbox(headline)
    L.DomUtil.add('span', '', headline, datalayer.options.name)
    const ul = L.DomUtil.create('ul', '', container)
    this.updateDatalayer(datalayer)
    datalayer.on('datachanged', this.onDataLayerChanged, this)
    this.map.ui.once('panel:closed', () => {
      datalayer.off('datachanged', this.onDataLayerChanged, this)
    })
  },

  updateDatalayer: function (datalayer) {
    // Compute once, but use it for each feature later.
    this.bounds = this.map.getBounds()
    const parent = L.DomUtil.get(this.datalayerId(datalayer))
    // Panel is not open
    if (!parent) return
    L.DomUtil.classIf(parent, 'off', !datalayer.isVisible())
    const container = parent.querySelector('ul'),
      counter = parent.querySelector('.datalayer-counter')
    container.innerHTML = ''
    datalayer.eachFeature((feature) => this.addFeature(feature, container))

    let total = datalayer.count(),
      current = container.querySelectorAll('li').length,
      count = total == current ? total : `${current}/${total}`
    counter.textContent = count
    counter.title = L._('Features in this layer: {count}', { count: count })
  },

  onFormChange: function () {
    this.map.eachBrowsableDataLayer((datalayer) => {
      datalayer.resetLayer(true)
      this.updateDatalayer(datalayer)
    })
  },

  onMoveEnd: function () {
    const isBrowserOpen = !!document.querySelector('.umap-browse-data')
    if (!isBrowserOpen) return
    const isListDynamic = this.options.inBbox
    this.map.eachBrowsableDataLayer((datalayer) => {
      if (!isListDynamic && !datalayer.hasDynamicData()) return
      this.updateDatalayer(datalayer)
    })
  },

  open: function () {
    // Get once but use it for each feature later
    this.filterKeys = this.map.getFilterKeys()
    const container = L.DomUtil.create('div', 'umap-browse-data')
    // HOTFIX. Remove when this is released:
    // https://github.com/Leaflet/Leaflet/pull/9052
    L.DomEvent.disableClickPropagation(container)

    const title = L.DomUtil.add(
      'h3',
      'umap-browse-title',
      container,
      this.map.options.name
    )

    const formContainer = L.DomUtil.create('div', '', container)
    const dataContainer = L.DomUtil.create('div', 'umap-browse-features', container)

    const fields = [
      ['options.filter', { handler: 'Input', placeholder: L._('Filter') }],
      ['options.inBbox', { handler: 'Switch', label: L._('Current map view') }],
    ]
    const builder = new L.U.FormBuilder(this, fields, {
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
  },
})
