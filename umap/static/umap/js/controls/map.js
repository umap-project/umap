L.U.Map.include({
  _openFacet: function () {
    const container = L.DomUtil.create('div', 'umap-facet-search'),
      title = L.DomUtil.add('h3', 'umap-filter-title', container, L._('Facet search')),
      keys = Object.keys(this.getFacetKeys())

    const knownValues = {}

    keys.forEach((key) => {
      knownValues[key] = []
      if (!this.facets[key]) this.facets[key] = []
    })

    this.eachBrowsableDataLayer((datalayer) => {
      datalayer.eachFeature((feature) => {
        keys.forEach((key) => {
          let value = feature.properties[key]
          if (typeof value !== 'undefined' && !knownValues[key].includes(value)) {
            knownValues[key].push(value)
          }
        })
      })
    })

    const filterFeatures = function () {
      let found = false
      this.eachBrowsableDataLayer((datalayer) => {
        datalayer.resetLayer(true)
        if (datalayer.hasDataVisible()) found = true
      })
      // TODO: display a results counter in the panel instead.
      if (!found)
        this.ui.alert({ content: L._('No results for these facets'), level: 'info' })
    }

    const fields = keys.map((current) => [
      `facets.${current}`,
      {
        handler: 'FacetSearch',
        choices: knownValues[current],
        label: this.getFacetKeys()[current],
      },
    ])
    const builder = new L.U.FormBuilder(this, fields, {
      makeDirty: false,
      callback: filterFeatures,
      callbackContext: this,
    })
    container.appendChild(builder.build())

    this.ui.openPanel({ data: { html: container }, actions: [this._aboutLink()] })
  },

  _aboutLink: function () {
    const link = L.DomUtil.create('li', '')
    L.DomUtil.create('i', 'umap-icon-16 umap-caption', link)
    const label = L.DomUtil.create('span', '', link)
    label.textContent = label.title = L._('About')
    L.DomEvent.on(link, 'click', this.displayCaption, this)
    return link
  },

  displayCaption: function () {
    const container = L.DomUtil.create('div', 'umap-caption')
    let title = L.DomUtil.create('h3', '', container)
    title.textContent = this.options.name
    this.permissions.addOwnerLink('h5', container)
    if (this.options.description) {
      const description = L.DomUtil.create('div', 'umap-map-description', container)
      description.innerHTML = L.Util.toHTML(this.options.description)
    }
    const datalayerContainer = L.DomUtil.create('div', 'datalayer-container', container)
    this.eachVisibleDataLayer((datalayer) => {
      if (!datalayer.options.inCaption) return
      const p = L.DomUtil.create('p', 'datalayer-legend', datalayerContainer),
        legend = L.DomUtil.create('span', '', p),
        headline = L.DomUtil.create('strong', '', p),
        description = L.DomUtil.create('span', '', p)
      datalayer.onceLoaded(function () {
        datalayer.renderLegend(legend)
        if (datalayer.options.description) {
          description.innerHTML = L.Util.toHTML(datalayer.options.description)
        }
      })
      datalayer.renderToolbox(headline)
      L.DomUtil.add('span', '', headline, `${datalayer.options.name} `)
    })
    const creditsContainer = L.DomUtil.create('div', 'credits-container', container),
      credits = L.DomUtil.createFieldset(creditsContainer, L._('Credits'))
    title = L.DomUtil.add('h5', '', credits, L._('User content credits'))
    if (this.options.shortCredit || this.options.longCredit) {
      L.DomUtil.add(
        'p',
        '',
        credits,
        L.Util.toHTML(this.options.longCredit || this.options.shortCredit)
      )
    }
    if (this.options.licence) {
      const licence = L.DomUtil.add(
        'p',
        '',
        credits,
        `${L._('Map user content has been published under licence')} `
      )
      L.DomUtil.createLink(
        '',
        licence,
        this.options.licence.name,
        this.options.licence.url
      )
    } else {
      L.DomUtil.add('p', '', credits, L._('No licence has been set'))
    }
    L.DomUtil.create('hr', '', credits)
    title = L.DomUtil.create('h5', '', credits)
    title.textContent = L._('Map background credits')
    const tilelayerCredit = L.DomUtil.create('p', '', credits),
      name = L.DomUtil.create('strong', '', tilelayerCredit),
      attribution = L.DomUtil.create('span', '', tilelayerCredit)
    name.textContent = `${this.selected_tilelayer.options.name} `
    attribution.innerHTML = this.selected_tilelayer.getAttribution()
    L.DomUtil.create('hr', '', credits)
    const umapCredit = L.DomUtil.create('p', '', credits),
      urls = {
        leaflet: 'http://leafletjs.com',
        django: 'https://www.djangoproject.com',
        umap: 'http://wiki.openstreetmap.org/wiki/UMap',
        changelog: 'https://umap-project.readthedocs.io/en/master/changelog/',
        version: this.options.umap_version,
      }
    umapCredit.innerHTML = L._(
      `
      Powered by <a href="{leaflet}">Leaflet</a> and
      <a href="{django}">Django</a>,
      glued by <a href="{umap}">uMap project</a>
      (version <a href="{changelog}">{version}</a>).
      `,
      urls
    )
    const browser = L.DomUtil.create('li', '')
    L.DomUtil.create('i', 'umap-icon-16 umap-list', browser)
    const labelBrowser = L.DomUtil.create('span', '', browser)
    labelBrowser.textContent = labelBrowser.title = L._('Browse data')
    L.DomEvent.on(browser, 'click', this.openBrowser, this)
    const actions = [browser]
    if (this.options.facetKey) {
      const filter = L.DomUtil.create('li', '')
      L.DomUtil.create('i', 'umap-icon-16 umap-add', filter)
      const labelFilter = L.DomUtil.create('span', '', filter)
      labelFilter.textContent = labelFilter.title = L._('Facet search')
      L.DomEvent.on(filter, 'click', this.openFacet, this)
      actions.push(filter)
    }
    this.ui.openPanel({ data: { html: container }, actions: actions })
  },

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

  renderEditToolbar: function () {
    const container = L.DomUtil.create(
      'div',
      'umap-main-edit-toolbox with-transition dark',
      this._controlContainer
    )
    const leftContainer = L.DomUtil.create('div', 'umap-left-edit-toolbox', container)
    const rightContainer = L.DomUtil.create('div', 'umap-right-edit-toolbox', container)
    const logo = L.DomUtil.create('div', 'logo', leftContainer)
    L.DomUtil.createLink('', logo, 'uMap', '/', null, L._('Go to the homepage'))
    const nameButton = L.DomUtil.createButton(
      'map-name',
      leftContainer,
      '',
      this.edit,
      this
    )
    L.DomEvent.on(
      nameButton,
      'mouseover',
      function () {
        this.ui.tooltip({
          content: L._('Edit the title of the map'),
          anchor: nameButton,
          position: 'bottom',
          delay: 500,
          duration: 5000,
        })
      },
      this
    )
    const shareStatusButton = L.DomUtil.createButton(
      'share-status',
      leftContainer,
      '',
      this.permissions.edit,
      this.permissions
    )
    L.DomEvent.on(
      shareStatusButton,
      'mouseover',
      function () {
        this.ui.tooltip({
          content: L._('Update who can see and edit the map'),
          anchor: shareStatusButton,
          position: 'bottom',
          delay: 500,
          duration: 5000,
        })
      },
      this
    )
    const update = () => {
      const status = this.permissions.getShareStatusDisplay()
      nameButton.textContent = this.getDisplayName()
      // status is not set until map is saved once
      if (status) {
        shareStatusButton.textContent = L._('Visibility: {status}', {
          status: status,
        })
      }
    }
    update()
    this.once('saved', L.bind(update, this))
    if (this.options.editMode === 'advanced') {
      L.DomEvent.on(nameButton, 'click', this.edit, this)
      L.DomEvent.on(shareStatusButton, 'click', this.permissions.edit, this.permissions)
    }
    this.on('postsync', L.bind(update, this))
    if (this.options.user) {
      L.DomUtil.createLink(
        'umap-user',
        rightContainer,
        L._(`My Dashboard <span>({username})</span>`, {
          username: this.options.user.name,
        }),
        this.options.user.url
      )
    }
    this.help.link(rightContainer, 'edit')
    const controlEditCancel = L.DomUtil.createButton(
      'leaflet-control-edit-cancel',
      rightContainer,
      L.DomUtil.add('span', '', null, L._('Cancel edits')),
      this.askForReset,
      this
    )
    L.DomEvent.on(
      controlEditCancel,
      'mouseover',
      function () {
        this.ui.tooltip({
          content: `${L._('Cancel')} (<kbd>Ctrl+Z</kbd>)`,
          anchor: controlEditCancel,
          position: 'bottom',
          delay: 500,
          duration: 5000,
        })
      },
      this
    )
    const controlEditDisable = L.DomUtil.createButton(
      'leaflet-control-edit-disable',
      rightContainer,
      L.DomUtil.add('span', '', null, L._('View')),
      function (e) {
        this.disableEdit(e)
        this.ui.closePanel()
      },
      this
    )
    L.DomEvent.on(
      controlEditDisable,
      'mouseover',
      function () {
        this.ui.tooltip({
          content: `${L._('Back to preview')} (<kbd>Ctrl+E</kbd>)`,
          anchor: controlEditDisable,
          position: 'bottom',
          delay: 500,
          duration: 5000,
        })
      },
      this
    )
    const controlEditSave = L.DomUtil.createButton(
      'leaflet-control-edit-save button',
      rightContainer,
      L.DomUtil.add('span', '', null, L._('Save')),
      this.save,
      this
    )
    L.DomEvent.on(
      controlEditSave,
      'mouseover',
      function () {
        this.ui.tooltip({
          content: `${L._('Save current edits')} (<kbd>Ctrl+S</kbd>)`,
          anchor: controlEditSave,
          position: 'bottom',
          delay: 500,
          duration: 5000,
        })
      },
      this
    )
  },

  renderShareBox: function () {
    const container = L.DomUtil.create('div', 'umap-share')
    const embedTitle = L.DomUtil.add('h4', '', container, L._('Embed the map'))
    const iframe = L.DomUtil.create('textarea', 'umap-share-iframe', container)
    const urlTitle = L.DomUtil.add('h4', '', container, L._('Direct link'))
    const exportUrl = L.DomUtil.create('input', 'umap-share-url', container)
    let option
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
    for (let i = 0; i < this.HIDDABLE_CONTROLS.length; i++) {
      UIFields.push(`queryString.${this.HIDDABLE_CONTROLS[i]}Control`)
    }
    const iframeExporter = new L.U.IframeExporter(this)
    const buildIframeCode = () => {
      iframe.innerHTML = iframeExporter.build()
      exportUrl.value = window.location.protocol + iframeExporter.buildUrl()
    }
    buildIframeCode()
    const builder = new L.U.FormBuilder(iframeExporter, UIFields, {
      callback: buildIframeCode,
    })
    const iframeOptions = L.DomUtil.createFieldset(container, L._('Export options'))
    iframeOptions.appendChild(builder.build())
    if (this.options.shortUrl) {
      L.DomUtil.create('hr', '', container)
      L.DomUtil.add('h4', '', container, L._('Short URL'))
      const shortUrl = L.DomUtil.create('input', 'umap-short-url', container)
      shortUrl.type = 'text'
      shortUrl.value = this.options.shortUrl
    }
    L.DomUtil.create('hr', '', container)
    L.DomUtil.add('h4', '', container, L._('Backup data'))
    const downloadUrl = L.Util.template(this.options.urls.map_download, {
      map_id: this.options.umap_id,
    })
    const link = L.DomUtil.createLink(
      'button',
      container,
      L._('Download full data'),
      downloadUrl
    )
    let name = this.options.name || 'data'
    name = name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    link.setAttribute('download', `${name}.umap`)
    L.DomUtil.create('hr', '', container)
    L.DomUtil.add('h4', '', container, L._('Download data'))
    const typeInput = L.DomUtil.create('select', '', container)
    typeInput.name = 'format'
    const exportCaveat = L.DomUtil.add(
      'small',
      'help-text',
      container,
      L._('Only visible features will be downloaded.')
    )
    for (const key in this.EXPORT_TYPES) {
      if (this.EXPORT_TYPES.hasOwnProperty(key)) {
        option = L.DomUtil.create('option', '', typeInput)
        option.value = key
        option.textContent = this.EXPORT_TYPES[key].name || key
        if (this.EXPORT_TYPES[key].selected) option.selected = true
      }
    }
    L.DomUtil.createButton(
      'button',
      container,
      L._('Download data'),
      () => this.download(typeInput.value),
      this
    )
    this.ui.openPanel({ data: { html: container } })
  },

})