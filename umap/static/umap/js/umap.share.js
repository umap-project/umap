U.Share = L.Class.extend({
  EXPORT_TYPES: {
    geojson: {
      formatter: function (map) {
        return JSON.stringify(map.toGeoJSON(), null, 2)
      },
      ext: '.geojson',
      filetype: 'application/json',
    },
    gpx: {
      formatter: function (map) {
        return togpx(map.toGeoJSON())
      },
      ext: '.gpx',
      filetype: 'application/gpx+xml',
    },
    kml: {
      formatter: function (map) {
        return tokml(map.toGeoJSON())
      },
      ext: '.kml',
      filetype: 'application/vnd.google-earth.kml+xml',
    },
    csv: {
      formatter: function (map) {
        const table = []
        map.eachFeature((feature) => {
          const row = feature.toGeoJSON()['properties'],
            center = feature.getCenter()
          delete row['_umap_options']
          row['Latitude'] = center.lat
          row['Longitude'] = center.lng
          table.push(row)
        })
        return csv2geojson.dsv.csvFormat(table)
      },
      ext: '.csv',
      filetype: 'text/csv',
    },
  },

  initialize: function (map) {
    this.map = map
  },

  build: function () {
    this.container = L.DomUtil.create('div', '')
    this.title = L.DomUtil.createTitle(
      this.container,
      L._('Share and download'),
      'icon-share'
    )

    L.DomUtil.createCopiableInput(
      this.container,
      L._('Link to view the map'),
      window.location.protocol + U.Utils.getBaseUrl()
    )

    if (this.map.options.shortUrl) {
      L.DomUtil.createCopiableInput(
        this.container,
        L._('Short link'),
        this.map.options.shortUrl
      )
    }

    L.DomUtil.create('hr', '', this.container)

    L.DomUtil.add('h4', '', this.container, L._('Download'))
    L.DomUtil.add('small', 'label', this.container, L._("Only visible layers' data"))
    for (const key in this.EXPORT_TYPES) {
      if (this.EXPORT_TYPES.hasOwnProperty(key)) {
        L.DomUtil.createButton(
          'download-file',
          this.container,
          this.EXPORT_TYPES[key].name || key,
          () => this.download(key),
          this
        )
      }
    }
    L.DomUtil.create('div', 'vspace', this.container)
    L.DomUtil.add(
      'small',
      'label',
      this.container,
      L._('All data and settings of the map')
    )
    const downloadUrl = U.Utils.template(this.map.options.urls.map_download, {
      map_id: this.map.options.umap_id,
    })
    const link = L.DomUtil.createLink(
      'download-backup',
      this.container,
      L._('full backup'),
      downloadUrl
    )
    let name = this.map.options.name || 'data'
    name = name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    link.setAttribute('download', `${name}.umap`)
    L.DomUtil.create('hr', '', this.container)

    const embedTitle = L.DomUtil.add('h4', '', this.container, L._('Embed the map'))
    const iframe = L.DomUtil.create('textarea', 'umap-share-iframe', this.container)
    const urlTitle = L.DomUtil.add('h4', '', this.container, L._('Direct link'))
    const exportUrl = L.DomUtil.createCopiableInput(
      this.container,
      L._('Share this link to open a customized map view'),
      ''
    )

    exportUrl.type = 'text'
    const UIFields = [
      ['dimensions.width', { handler: 'Input', label: L._('width') }],
      ['dimensions.height', { handler: 'Input', label: L._('height') }],
      [
        'options.includeFullScreenLink',
        { handler: 'Switch', label: L._('Include full screen link?') },
      ],
      [
        'options.currentView',
        { handler: 'Switch', label: L._('Current view instead of default map view?') },
      ],
      [
        'options.keepCurrentDatalayers',
        { handler: 'Switch', label: L._('Keep current visible layers') },
      ],
      [
        'options.viewCurrentFeature',
        { handler: 'Switch', label: L._('Open current feature on load') },
      ],
      'queryString.moreControl',
      'queryString.scrollWheelZoom',
      'queryString.miniMap',
      'queryString.scaleControl',
      'queryString.onLoadPanel',
      'queryString.captionBar',
      'queryString.captionMenus',
    ]
    for (let i = 0; i < this.map.HIDDABLE_CONTROLS.length; i++) {
      UIFields.push(`queryString.${this.map.HIDDABLE_CONTROLS[i]}Control`)
    }
    const iframeExporter = new U.IframeExporter(this.map)
    const buildIframeCode = () => {
      iframe.textContent = iframeExporter.build()
      exportUrl.value = window.location.protocol + iframeExporter.buildUrl()
    }
    buildIframeCode()
    const builder = new U.FormBuilder(iframeExporter, UIFields, {
      callback: buildIframeCode,
    })
    const iframeOptions = L.DomUtil.createFieldset(
      this.container,
      L._('Embed and link options')
    )
    iframeOptions.appendChild(builder.build())
  },

  open: function () {
    if (!this.container) this.build()
    this.map.panel.open({ content: this.container })
  },

  format: function (mode) {
    const type = this.EXPORT_TYPES[mode]
    const content = type.formatter(this.map)
    let name = this.map.options.name || 'data'
    name = name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const filename = name + type.ext
    return { content, filetype: type.filetype, filename }
  },

  download: function (mode) {
    const { content, filetype, filename } = this.format(mode)
    const blob = new Blob([content], { type: filetype })
    window.URL = window.URL || window.webkitURL
    const el = document.createElement('a')
    el.download = filename
    el.href = window.URL.createObjectURL(blob)
    el.style.display = 'none'
    document.body.appendChild(el)
    el.click()
    document.body.removeChild(el)
  },
})

U.IframeExporter = L.Evented.extend({
  options: {
    includeFullScreenLink: true,
    currentView: false,
    keepCurrentDatalayers: false,
    viewCurrentFeature: false,
  },

  queryString: {
    scaleControl: false,
    miniMap: false,
    scrollWheelZoom: false,
    zoomControl: true,
    editMode: 'disabled',
    moreControl: true,
    searchControl: null,
    tilelayersControl: null,
    embedControl: null,
    datalayersControl: true,
    onLoadPanel: 'none',
    captionBar: false,
    captionMenus: true,
  },

  dimensions: {
    width: '100%',
    height: '300px',
  },

  initialize: function (map) {
    this.map = map
    this.baseUrl = U.Utils.getBaseUrl()
    // Use map default, not generic default
    this.queryString.onLoadPanel = this.map.getOption('onLoadPanel')
  },

  getMap: function () {
    return this.map
  },

  buildUrl: function (options) {
    const datalayers = []
    if (this.options.viewCurrentFeature && this.map.currentFeature) {
      this.queryString.feature = this.map.currentFeature.getSlug()
    } else {
      delete this.queryString.feature
    }
    if (this.options.keepCurrentDatalayers) {
      this.map.eachDataLayer((datalayer) => {
        if (datalayer.isVisible() && datalayer.umap_id) {
          datalayers.push(datalayer.umap_id)
        }
      })
      this.queryString.datalayers = datalayers.join(',')
    } else {
      delete this.queryString.datalayers
    }
    const currentView = this.options.currentView ? window.location.hash : ''
    const queryString = L.extend({}, this.queryString, options)
    return `${this.baseUrl}?${U.Utils.buildQueryString(queryString)}${currentView}`
  },

  build: function () {
    const iframeUrl = this.buildUrl()
    let code = `<iframe width="${this.dimensions.width}" height="${this.dimensions.height}" frameborder="0" allowfullscreen allow="geolocation" src="${iframeUrl}"></iframe>`
    if (this.options.includeFullScreenLink) {
      const fullUrl = this.buildUrl({ scrollWheelZoom: true })
      code += `<p><a href="${fullUrl}">${L._('See full screen')}</a></p>`
    }
    return code
  },
})
