L.U.Browser = L.Class.extend({
  options: {
    filter: '',
    inBbox: false,
  },

  initialize: function (map) {
    this.map = map
  },

  addFeature: function (feature) {
    const feature_li = L.DomUtil.create('li', `${feature.getClassName()} feature`),
      zoom_to = L.DomUtil.create('i', 'feature-zoom_to', feature_li),
      edit = L.DomUtil.create('i', 'show-on-edit feature-edit', feature_li),
      del = L.DomUtil.create('i', 'show-on-edit feature-delete', feature_li),
      color = L.DomUtil.create('i', 'feature-color', feature_li),
      title = L.DomUtil.create('span', 'feature-title', feature_li),
      symbol = feature._getIconUrl
        ? L.U.Icon.prototype.formatUrl(feature._getIconUrl(), feature)
        : null
    zoom_to.title = L._('Bring feature to center')
    edit.title = L._('Edit this feature')
    del.title = L._('Delete this feature')
    title.textContent = feature.getDisplayName() || '—'
    color.style.backgroundColor = feature.getOption('color')
    if (symbol) color.style.backgroundImage = `url(${symbol})`
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
    return feature_li
  },

  addDatalayer: function (datalayer, dataContainer) {
    const filterKeys = this.map.getFilterKeys()
    const container = L.DomUtil.create(
        'div',
        datalayer.getHidableClass(),
        dataContainer
      ),
      headline = L.DomUtil.create('h5', '', container)
    container.id = `browse_data_datalayer_${datalayer.umap_id}`
    datalayer.renderToolbox(headline)
    L.DomUtil.add('span', '', headline, datalayer.options.name)
    const ul = L.DomUtil.create('ul', '', container)
    L.DomUtil.classIf(container, 'off', !datalayer.isVisible())

    const build = () => {
      ul.innerHTML = ''
      const bounds = this.map.getBounds()
      datalayer.eachFeature((feature) => {
        if (
          this.options.filter &&
          !feature.matchFilter(this.options.filter, filterKeys)
        )
          return
        if (this.options.inBbox && !feature.isOnScreen(bounds)) return
        ul.appendChild(this.addFeature(feature))
      })
    }

    build()
    datalayer.on('datachanged', build)
    datalayer.map.ui.once('panel:closed', () => {
      datalayer.off('datachanged', build)
      this.map.off('moveend', build)
    })
    datalayer.map.ui.once('panel:ready', () => {
      datalayer.map.ui.once('panel:ready', () => {
        datalayer.off('datachanged', build)
      })
    })
  },

  open: function () {
    const container = L.DomUtil.create('div', 'umap-browse-data')
    // HOTFIX. Remove when this is merged and released:
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

    const appendAll = () => {
      dataContainer.innerHTML = ''
      this.map.eachBrowsableDataLayer((datalayer) => {
        this.addDatalayer(datalayer, dataContainer)
      })
    }
    const resetLayers = () => {
      this.map.eachBrowsableDataLayer((datalayer) => {
        datalayer.resetLayer(true)
      })
    }
    const fields = [
      ['options.filter', { handler: 'Input', placeholder: L._('Filter') }],
      ['options.inBbox', { handler: 'Switch', label: L._('Current map view') }],
    ]
    const builder = new L.U.FormBuilder(this, fields, {
      makeDirty: false,
      callback: (e) => {
        if (e.helper.field === 'options.inBbox') {
          if (this.options.inBbox) this.map.on('moveend', appendAll)
          else this.map.off('moveend', appendAll)
        }
        appendAll()
        resetLayers()
      },
    })
    formContainer.appendChild(builder.build())

    appendAll()

    this.map.ui.openPanel({
      data: { html: container },
      actions: [this.map._aboutLink()],
    })
  },
})
