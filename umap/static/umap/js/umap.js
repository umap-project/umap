L.Map.mergeOptions({
  overlay: {},
  datalayers: [],
  hash: true,
  maxZoomLimit: 24,
  attributionControl: false,
  editMode: 'advanced',
  noControl: false, // Do not render any control.
  name: '',
  description: '',
  // When a TileLayer is in TMS mode, it needs -y instead of y.
  // This is usually handled by the TileLayer instance itself, but
  // we cannot rely on this because of the y is overriden by Leaflet
  // See https://github.com/Leaflet/Leaflet/pull/9201
  // And let's remove this -y when this PR is merged and released.
  demoTileInfos: { s: 'a', z: 9, x: 265, y: 181, '-y': 181, r: '' },
  licences: [],
  licence: '',
  enableMarkerDraw: true,
  enablePolygonDraw: true,
  enablePolylineDraw: true,
  limitBounds: {},
  slideshow: {},
  clickable: true,
  permissions: {},
  featuresHaveOwner: false,
})

U.Map = L.Map.extend({
  includes: [ControlsMixin],

  initialize: async function (el, geojson) {
    this.sync_engine = new U.SyncEngine(this)
    this.sync = this.sync_engine.proxy(this)
    // Locale name (pt_PT, en_US…)
    // To be used for Django localization
    if (geojson.properties.locale) L.setLocale(geojson.properties.locale)

    // Language code (pt-pt, en-us…)
    // To be used in javascript APIs
    if (geojson.properties.lang) L.lang = geojson.properties.lang

    this.setOptionsFromQueryString(geojson.properties)
    // Prevent default creation of controls
    const zoomControl = geojson.properties.zoomControl
    const fullscreenControl = geojson.properties.fullscreenControl
    geojson.properties.zoomControl = false
    geojson.properties.fullscreenControl = false

    L.Map.prototype.initialize.call(this, el, geojson.properties)

    if (geojson.properties.schema) this.overrideSchema(geojson.properties.schema)

    // After calling parent initialize, as we are doing initCenter our-selves
    if (geojson.geometry) this.options.center = this.latLng(geojson.geometry)
    this.urls = new U.URLs(this.options.urls)

    this.panel = new U.Panel(this)
    this.dialog = new U.Dialog({ className: 'dark' })
    this.tooltip = new U.Tooltip(this._controlContainer)
    this.contextmenu = new U.ContextMenu()
    if (this.hasEditMode()) {
      this.editPanel = new U.EditPanel(this)
      this.fullPanel = new U.FullPanel(this)
    }
    if (!this.options.noControl) {
      L.DomEvent.on(document.body, 'dataloading', (e) => this.fire('dataloading', e))
      L.DomEvent.on(document.body, 'dataload', (e) => this.fire('dataload', e))
    }
    this.server = new U.ServerRequest()
    this.request = new U.Request()

    this.initLoader()
    this.name = this.options.name
    this.description = this.options.description
    this.demoTileInfos = this.options.demoTileInfos
    this.options.zoomControl = zoomControl !== undefined ? zoomControl : true
    this.options.fullscreenControl =
      fullscreenControl !== undefined ? fullscreenControl : true

    this.datalayersFromQueryString = L.Util.queryString('datalayers')
    if (this.datalayersFromQueryString) {
      this.datalayersFromQueryString = this.datalayersFromQueryString
        .toString()
        .split(',')
    }

    let editedFeature = null
    try {
      Object.defineProperty(this, 'editedFeature', {
        get: () => editedFeature,
        set: (feature) => {
          if (editedFeature && editedFeature !== feature) {
            editedFeature.endEdit()
          }
          editedFeature = feature
          this.fire('seteditedfeature')
        },
      })
    } catch (e) {
      // Certainly IE8, which has a limited version of defineProperty
    }

    // Retrocompat
    if (this.options.slideshow?.delay && this.options.slideshow.active === undefined) {
      this.options.slideshow.active = true
    }
    if (this.options.advancedFilterKey) {
      this.options.facetKey = this.options.advancedFilterKey
      delete this.options.advancedFilterKey
    }

    // Global storage for retrieving datalayers and features.
    this.datalayers = {} // All datalayers, including deleted.
    this.datalayers_index = [] // Datalayers actually on the map and ordered.
    this.features_index = {}

    // Needed for actions labels
    this.help = new U.Help(this)

    this.formatter = new U.Formatter(this)

    this.initControls()
    // Needs locate control and hash to exist
    this.initCenter()
    this.initTileLayers()
    // Needs tilelayer to exist for minimap
    this.renderControls()
    this.handleLimitBounds()
    this.initDataLayers()

    if (this.options.displayCaptionOnLoad) {
      // Retrocompat
      if (!this.options.onLoadPanel) {
        this.options.onLoadPanel = 'caption'
      }
      delete this.options.displayCaptionOnLoad
    }
    if (this.options.displayDataBrowserOnLoad) {
      // Retrocompat
      if (!this.options.onLoadPanel) {
        this.options.onLoadPanel = 'databrowser'
      }
      delete this.options.displayDataBrowserOnLoad
    }
    if (this.options.datalayersControl === 'expanded') {
      if (!this.options.onLoadPanel) {
        this.options.onLoadPanel = 'datalayers'
      }
      delete this.options.datalayersControl
    }
    if (this.options.onLoadPanel === 'facet') {
      this.options.onLoadPanel = 'datafilters'
    }

    let isDirty = false // self status
    try {
      Object.defineProperty(this, 'isDirty', {
        get: () => isDirty,
        set: function (status) {
          isDirty = status
          this.checkDirty()
        },
      })
    } catch (e) {
      // Certainly IE8, which has a limited version of defineProperty
    }
    this.on(
      'baselayerchange',
      function (e) {
        if (this._controls.miniMap) this._controls.miniMap.onMainMapBaseLayerChange(e)
      },
      this
    )

    // Creation mode
    if (!this.options.umap_id) {
      if (!this.options.preview) {
        this.isDirty = true
        this.enableEdit()
      }
      this._default_extent = true
      this.options.name = L._('Untitled map')
      await this.loadDataFromQueryString()
    }

    this.slideshow = new U.Slideshow(this, this.options.slideshow)
    this.permissions = new U.MapPermissions(this)
    if (this.hasEditMode()) {
      this.editTools = new U.Editable(this)
      this.renderEditToolbar()
    }

    this.initShortcuts()
    if (!this.options.noControl) this.initCaptionBar()
    this.onceDataLoaded(this.setViewFromQueryString)

    window.onbeforeunload = () => (this.editEnabled && this.isDirty) || null
    this.backup()
    this.on('click', this.closeInplaceToolbar)
    this.on('contextmenu', this.onContextMenu)
    this.propagate()
  },

  initSyncEngine: async function () {
    if (this.options.websocketEnabled === false) return
    if (this.options.syncEnabled !== true) {
      this.sync.stop()
    } else {
      const ws_token_uri = this.urls.get('map_websocket_auth_token', {
        map_id: this.options.umap_id,
      })
      await this.sync.authenticate(ws_token_uri, this.options.websocketURI, this.server)
    }
  },

  getSyncMetadata: function () {
    return {
      engine: this.sync,
      subject: 'map',
    }
  },

  render: function (fields) {
    const impacts = U.Utils.getImpactsFromSchema(fields)

    for (const impact of impacts) {
      switch (impact) {
        case 'ui':
          this.initCaptionBar()
          this.renderEditToolbar()
          this.renderControls()
          this.browser.redraw()
          this.propagate()
          break
        case 'data':
          this.redrawVisibleDataLayers()
          break
        case 'datalayer-index':
          this.reindexDataLayers()
          break
        case 'background':
          this.initTileLayers()
          break
        case 'bounds':
          this.handleLimitBounds()
          break
        case 'sync':
          this.initSyncEngine()
      }
    }
  },

  reindexDataLayers: function () {
    this.eachDataLayer((datalayer) => datalayer.reindex())
    this.onDataLayersChanged()
  },

  redrawVisibleDataLayers: function () {
    this.eachVisibleDataLayer((datalayer) => {
      datalayer.redraw()
    })
  },

  setOptionsFromQueryString: (options) => {
    // This is not an editable option
    L.Util.setFromQueryString(options, 'editMode')
    // FIXME retrocompat
    L.Util.setBooleanFromQueryString(options, 'displayDataBrowserOnLoad')
    L.Util.setBooleanFromQueryString(options, 'displayCaptionOnLoad')
    for (const [key, schema] of Object.entries(U.SCHEMA)) {
      switch (schema.type) {
        case Boolean:
          if (schema.nullable) L.Util.setNullableBooleanFromQueryString(options, key)
          else L.Util.setBooleanFromQueryString(options, key)
          break
        case Number:
          L.Util.setNumberFromQueryString(options, key)
          break
        case String:
          L.Util.setFromQueryString(options, key)
          break
      }
    }
    // Specific case for datalayersControl
    // which accepts "expanded" value, on top of true/false/null
    if (L.Util.queryString('datalayersControl') === 'expanded') {
      if (!options.onLoadPanel) {
        options.onLoadPanel = 'datalayers'
      }
    }
  },

  loadDataFromQueryString: async function () {
    let data = L.Util.queryString('data', null)
    const url = new URL(window.location.href)
    const dataUrls = new URLSearchParams(url.search).getAll('dataUrl')
    const dataFormat = L.Util.queryString('dataFormat', 'geojson')
    if (dataUrls.length) {
      for (let dataUrl of dataUrls) {
        dataUrl = decodeURIComponent(dataUrl)
        dataUrl = this.localizeUrl(dataUrl)
        dataUrl = this.proxyUrl(dataUrl)
        const datalayer = this.createDataLayer()
        await datalayer.importFromUrl(dataUrl, dataFormat)
      }
    } else if (data) {
      data = decodeURIComponent(data)
      const datalayer = this.createDataLayer()
      await datalayer.importRaw(data, dataFormat)
    }
  },

  setViewFromQueryString: async function () {
    if (this.options.noControl) return
    if (L.Util.queryString('share')) {
      this.share.open()
    } else if (this.options.onLoadPanel === 'databrowser') {
      this.panel.setDefaultMode('expanded')
      this.openBrowser('data')
    } else if (this.options.onLoadPanel === 'datalayers') {
      this.panel.setDefaultMode('condensed')
      this.openBrowser('layers')
    } else if (this.options.onLoadPanel === 'datafilters') {
      this.panel.setDefaultMode('expanded')
      this.openBrowser('filters')
    } else if (this.options.onLoadPanel === 'caption') {
      this.panel.setDefaultMode('condensed')
      this.openCaption()
    }
    // Comes after default panels, so if it opens in a panel it will
    // take precedence.
    const slug = L.Util.queryString('feature')
    if (slug && this.features_index[slug]) this.features_index[slug].view()
    if (L.Util.queryString('edit')) {
      if (this.hasEditMode()) this.enableEdit()
      // Sometimes users share the ?edit link by mistake, let's remove
      // this search parameter from URL to prevent this
      const url = new URL(window.location)
      url.searchParams.delete('edit')
      history.pushState({}, '', url)
    }
    if (L.Util.queryString('download')) {
      const download_url = this.urls.get('map_download', {
        map_id: this.options.umap_id,
      })
      window.location = download_url
    }
  },

  // Merge the given schema with the default one
  // Missing keys inside the schema are merged with the default ones.
  overrideSchema: (schema) => {
    for (const [key, extra] of Object.entries(schema)) {
      U.SCHEMA[key] = L.extend({}, U.SCHEMA[key], extra)
    }
  },

  initControls: function () {
    this.helpMenuActions = {}
    this._controls = {}

    if (this.hasEditMode() && !this.options.noControl) {
      new U.EditControl(this).addTo(this)

      new U.DrawToolbar({ map: this }).addTo(this)
      const editActions = [
        U.EditCaptionAction,
        U.EditPropertiesAction,
        U.EditLayersAction,
        U.ChangeTileLayerAction,
        U.UpdateExtentAction,
        U.UpdatePermsAction,
        U.ImportAction,
      ]
      if (this.options.editMode === 'advanced') {
        new U.SettingsToolbar({ actions: editActions }).addTo(this)
      }
    }
    this._controls.zoom = new L.Control.Zoom({
      zoomInTitle: L._('Zoom in'),
      zoomOutTitle: L._('Zoom out'),
    })
    this._controls.datalayers = new U.DataLayersControl(this)
    this._controls.caption = new U.CaptionControl(this)
    this._controls.locate = new U.Locate(this, {
      strings: {
        title: L._('Center map on your location'),
      },
      showPopup: false,
      // We style this control in our own CSS for consistency with other controls,
      // but the control breaks if we don't specify a class here, so a fake class
      // will do.
      icon: 'umap-fake-class',
      iconLoading: 'umap-fake-class',
      flyTo: this.options.easing,
      onLocationError: (err) => U.Alert.error(err.message),
    })
    this._controls.fullscreen = new L.Control.Fullscreen({
      title: { false: L._('View Fullscreen'), true: L._('Exit Fullscreen') },
    })
    this._controls.search = new U.SearchControl()
    this._controls.embed = new L.Control.Embed(this)
    this._controls.tilelayersChooser = new U.TileLayerChooser(this)
    if (this.options.user?.id) this._controls.star = new U.StarControl(this)
    this._controls.editinosm = new L.Control.EditInOSM({
      position: 'topleft',
      widgetOptions: {
        helpText: L._(
          'Open this map extent in a map editor to provide more accurate data to OpenStreetMap'
        ),
      },
    })
    this._controls.measure = new L.MeasureControl().initHandler(this)
    this._controls.more = new U.MoreControls()
    this._controls.scale = L.control.scale()
    this._controls.permanentCredit = new U.PermanentCreditsControl(this)
    if (this.options.scrollWheelZoom) this.scrollWheelZoom.enable()
    else this.scrollWheelZoom.disable()
    this.browser = new U.Browser(this)
    this.facets = new U.Facets(this)
    this.caption = new U.Caption(this)
    this.importer = new U.Importer(this)
    this.drop = new U.DropControl(this)
    this.share = new U.Share(this)
    this.rules = new U.Rules(this)
    this._controls.tilelayers = new U.TileLayerControl(this)
  },

  renderControls: function () {
    const hasSlideshow = Boolean(this.options.slideshow?.active)
    const barEnabled = this.options.captionBar || hasSlideshow
    document.body.classList.toggle('umap-caption-bar-enabled', barEnabled)
    document.body.classList.toggle('umap-slideshow-enabled', hasSlideshow)
    for (const control of Object.values(this._controls)) {
      this.removeControl(control)
    }
    if (this.options.noControl) return

    this._controls.attribution = new U.AttributionControl().addTo(this)
    if (this.options.miniMap) {
      this.whenReady(function () {
        if (this.selected_tilelayer) {
          this._controls.miniMap = new L.Control.MiniMap(this.selected_tilelayer, {
            aimingRectOptions: {
              color: this.getOption('color'),
              fillColor: this.getOption('fillColor'),
              stroke: this.getOption('stroke'),
              fill: this.getOption('fill'),
              weight: this.getOption('weight'),
              opacity: this.getOption('opacity'),
              fillOpacity: this.getOption('fillOpacity'),
            },
          }).addTo(this)
          this._controls.miniMap._miniMap.invalidateSize()
        }
      })
    }
    let name
    let status
    let control
    for (let i = 0; i < this.HIDDABLE_CONTROLS.length; i++) {
      name = this.HIDDABLE_CONTROLS[i]
      status = this.getOption(`${name}Control`)
      if (status === false) continue
      control = this._controls[name]
      if (!control) continue
      control.addTo(this)
      if (status === undefined || status === null)
        L.DomUtil.addClass(control._container, 'display-on-more')
      else L.DomUtil.removeClass(control._container, 'display-on-more')
    }
    if (this.getOption('permanentCredit')) this._controls.permanentCredit.addTo(this)
    if (this.getOption('moreControl')) this._controls.more.addTo(this)
    if (this.getOption('scaleControl')) this._controls.scale.addTo(this)
    this._controls.tilelayers.setLayers()
  },

  initDataLayers: async function (datalayers) {
    datalayers = datalayers || this.options.datalayers
    for (const options of datalayers) {
      // `false` to not propagate syncing elements served from uMap
      this.createDataLayer(options, false)
    }
    await this.loadDataLayers()
  },

  loadDataLayers: async function () {
    this.datalayersLoaded = true
    this.fire('datalayersloaded')
    for (const datalayer of this.datalayers_index) {
      if (datalayer.showAtLoad()) await datalayer.show()
    }
    this.dataloaded = true
    this.fire('dataloaded')
  },

  indexDatalayers: function () {
    const panes = this.getPane('overlayPane')
    let pane
    this.datalayers_index = []
    for (let i = 0; i < panes.children.length; i++) {
      pane = panes.children[i]
      if (!pane.dataset || !pane.dataset.id) continue
      this.datalayers_index.push(this.datalayers[pane.dataset.id])
    }
    this.onDataLayersChanged()
  },

  onDataLayersChanged: function () {
    if (this.browser) this.browser.update()
    this.caption.refresh()
  },

  ensurePanesOrder: function () {
    this.eachDataLayer((datalayer) => {
      datalayer.bringToTop()
    })
  },

  onceDatalayersLoaded: function (callback, context) {
    // Once datalayers **metadata** have been loaded
    if (this.datalayersLoaded) {
      callback.call(context || this, this)
    } else {
      this.once('datalayersloaded', callback, context)
    }
    return this
  },

  onceDataLoaded: function (callback, context) {
    // Once datalayers **data** have been loaded
    if (this.dataloaded) {
      callback.call(context || this, this)
    } else {
      this.once('dataloaded', callback, context)
    }
    return this
  },

  backupOptions: function () {
    this._backupOptions = L.extend({}, this.options)
    this._backupOptions.tilelayer = L.extend({}, this.options.tilelayer)
    this._backupOptions.limitBounds = L.extend({}, this.options.limitBounds)
    this._backupOptions.permissions = L.extend({}, this.permissions.options)
  },

  resetOptions: function () {
    this.options = L.extend({}, this._backupOptions)
    this.options.tilelayer = L.extend({}, this._backupOptions.tilelayer)
    this.permissions.options = L.extend({}, this._backupOptions.permissions)
  },

  initShortcuts: function () {
    const globalShortcuts = function (e) {
      if (e.key === 'Escape') {
        if (this.importer.dialog.visible) {
          this.importer.dialog.close()
        } else if (this.editEnabled && this.editTools.drawing()) {
          this.editTools.stopDrawing()
        } else if (this.measureTools.enabled()) {
          this.measureTools.stopDrawing()
        } else if (this.fullPanel?.isOpen()) {
          this.fullPanel?.close()
        } else if (this.editPanel?.isOpen()) {
          this.editPanel?.close()
        } else if (this.panel.isOpen()) {
          this.panel.close()
        }
      }

      // From now on, only ctrl/meta shortcut
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey) return

      if (e.key === 'f') {
        L.DomEvent.stop(e)
        this.search()
      }

      /* Edit mode only shortcuts */
      if (!this.hasEditMode()) return

      // Edit mode Off
      if (!this.editEnabled) {
        switch (e.key) {
          case 'e':
            L.DomEvent.stop(e)
            this.enableEdit()
            break
        }
        return
      }

      // Edit mode on
      let used = true
      switch (e.key) {
        case 'e':
          if (!this.isDirty) this.disableEdit()
          break
        case 's':
          if (this.isDirty) this.save()
          break
        case 'z':
          if (this.isDirty) this.askForReset()
          break
        case 'm':
          this.editTools.startMarker()
          break
        case 'p':
          this.editTools.startPolygon()
          break
        case 'l':
          this.editTools.startPolyline()
          break
        case 'i':
          this.importer.open()
          break
        case 'o':
          this.importer.openFiles()
          break
        case 'h':
          this.help.show('edit')
          break
        default:
          used = false
      }
      if (used) L.DomEvent.stop(e)
    }
    L.DomEvent.addListener(document, 'keydown', globalShortcuts, this)
  },

  initTileLayers: function () {
    this.tilelayers = []
    for (const props of this.options.tilelayers) {
      const layer = this.createTileLayer(props)
      this.tilelayers.push(layer)
      if (
        this.options.tilelayer &&
        this.options.tilelayer.url_template === props.url_template
      ) {
        // Keep control over the displayed attribution for non custom tilelayers
        this.options.tilelayer.attribution = props.attribution
      }
    }
    if (this.options.tilelayer?.url_template && this.options.tilelayer.attribution) {
      this.customTilelayer = this.createTileLayer(this.options.tilelayer)
      this.selectTileLayer(this.customTilelayer)
    } else {
      this.selectTileLayer(this.tilelayers[0])
    }
    if (this._controls) this._controls.tilelayers.setLayers()
  },

  createTileLayer: (tilelayer) => new L.TileLayer(tilelayer.url_template, tilelayer),

  selectTileLayer: function (tilelayer) {
    if (tilelayer === this.selected_tilelayer) {
      return
    }
    try {
      this.addLayer(tilelayer)
      this.fire('baselayerchange', { layer: tilelayer })
      if (this.selected_tilelayer) {
        this.removeLayer(this.selected_tilelayer)
      }
      this.selected_tilelayer = tilelayer
      if (
        !Number.isNaN(this.selected_tilelayer.options.minZoom) &&
        this.getZoom() < this.selected_tilelayer.options.minZoom
      ) {
        this.setZoom(this.selected_tilelayer.options.minZoom)
      }
      if (
        !Number.isNaN(this.selected_tilelayer.options.maxZoom) &&
        this.getZoom() > this.selected_tilelayer.options.maxZoom
      ) {
        this.setZoom(this.selected_tilelayer.options.maxZoom)
      }
    } catch (e) {
      console.error(e)
      this.removeLayer(tilelayer)
      U.Alert.error(`${L._('Error in the tilelayer URL')}: ${tilelayer._url}`)
      // Users can put tilelayer URLs by hand, and if they add wrong {variable},
      // Leaflet throw an error, and then the map is no more editable
    }
    this.setOverlay()
  },

  eachTileLayer: function (callback, context) {
    const urls = []
    const callOne = (layer) => {
      // Prevent adding a duplicate background,
      // while adding selected/custom on top of the list
      const url = layer.options.url_template
      if (urls.indexOf(url) !== -1) return
      callback.call(context, layer)
      urls.push(url)
    }
    if (this.selected_tilelayer) callOne(this.selected_tilelayer)
    if (this.customTilelayer) callOne(this.customTilelayer)
    this.tilelayers.forEach(callOne)
  },

  setOverlay: function () {
    if (!this.options.overlay || !this.options.overlay.url_template) return
    const overlay = this.createTileLayer(this.options.overlay)
    try {
      this.addLayer(overlay)
      if (this.overlay) this.removeLayer(this.overlay)
      this.overlay = overlay
    } catch (e) {
      this.removeLayer(overlay)
      console.error(e)
      U.Alert.error(`${L._('Error in the overlay URL')}: ${overlay._url}`)
    }
  },

  _setDefaultCenter: function () {
    this.options.center = this.latLng(this.options.center)
    this.setView(this.options.center, this.options.zoom)
  },

  hasData: function () {
    for (const datalayer of this.datalayers_index) {
      if (datalayer.hasData()) return true
    }
  },

  hasLayers: function () {
    return Boolean(this.datalayers_index.length)
  },

  fitDataBounds: function () {
    const bounds = this.getLayersBounds()
    if (!this.hasData() || !bounds.isValid()) return false
    this.fitBounds(bounds)
  },

  initCenter: function () {
    this._setDefaultCenter()
    if (this.options.hash) this.addHash()
    if (this.options.hash && this._hash.parseHash(location.hash)) {
      // FIXME An invalid hash will cause the load to fail
      this._hash.update()
    } else if (this.options.defaultView === 'locate' && !this.options.noControl) {
      this._controls.locate.start()
    } else if (this.options.defaultView === 'data') {
      this.onceDataLoaded(this.fitDataBounds)
    } else if (this.options.defaultView === 'latest') {
      this.onceDataLoaded(() => {
        if (!this.hasData()) return
        const datalayer = this.firstVisibleDatalayer()
        let feature
        if (datalayer) {
          const feature = datalayer.getFeatureByIndex(-1)
          if (feature) {
            feature.zoomTo({ callback: this.options.noControl ? null : feature.view })
            return
          }
        }
      })
    }
  },

  latLng: (a, b, c) => {
    // manage geojson case and call original method
    if (!(a instanceof L.LatLng) && a.coordinates) {
      // Guess it's a geojson
      a = [a.coordinates[1], a.coordinates[0]]
    }
    return L.latLng(a, b, c)
  },

  handleLimitBounds: function () {
    const south = Number.parseFloat(this.options.limitBounds.south)
    const west = Number.parseFloat(this.options.limitBounds.west)
    const north = Number.parseFloat(this.options.limitBounds.north)
    const east = Number.parseFloat(this.options.limitBounds.east)
    if (
      !Number.isNaN(south) &&
      !Number.isNaN(west) &&
      !Number.isNaN(north) &&
      !Number.isNaN(east)
    ) {
      const bounds = L.latLngBounds([
        [south, west],
        [north, east],
      ])
      this.options.minZoom = this.getBoundsZoom(bounds, false)
      try {
        this.setMaxBounds(bounds)
      } catch (e) {
        // Unusable bounds, like -2 -2 -2 -2?
        console.error('Error limiting bounds', e)
      }
    } else {
      this.options.minZoom = 0
      this.setMaxBounds()
    }
  },

  setMaxBounds: function (bounds) {
    // Hack. Remove me when fix is released:
    // https://github.com/Leaflet/Leaflet/pull/4494
    bounds = L.latLngBounds(bounds)

    if (!bounds.isValid()) {
      this.options.maxBounds = null
      return this.off('moveend', this._panInsideMaxBounds)
    }
    return L.Map.prototype.setMaxBounds.call(this, bounds)
  },

  createDataLayer: function (options = {}, sync = true) {
    options.name = options.name || `${L._('Layer')} ${this.datalayers_index.length + 1}`
    const datalayer = new U.DataLayer(this, options, sync)

    if (sync !== false) {
      datalayer.sync.upsert(datalayer.options)
    }
    return datalayer
  },

  newDataLayer: function () {
    const datalayer = this.createDataLayer({})
    datalayer.edit()
  },

  getDefaultOption: (option) => U.SCHEMA[option]?.default,

  getOption: function (option, feature) {
    if (feature) {
      const value = this.rules.getOption(option, feature)
      if (value !== undefined) return value
    }
    if (U.Utils.usableOption(this.options, option)) return this.options[option]
    return this.getDefaultOption(option)
  },

  setCenterAndZoom: function () {
    this._setCenterAndZoom()
    U.Alert.success(L._('The zoom and center have been modified.'))
  },

  _setCenterAndZoom: function () {
    this.options.center = this.getCenter()
    this.options.zoom = this.getZoom()
    this.isDirty = true
    this._default_extent = false
  },

  updateTileLayers: function () {
    const callback = (tilelayer) => {
      this.options.tilelayer = tilelayer.toJSON()
      this.isDirty = true
    }
    if (this._controls.tilelayersChooser) {
      this._controls.tilelayersChooser.openSwitcher({ callback, edit: true })
    }
  },

  toGeoJSON: function () {
    let features = []
    this.eachDataLayer((datalayer) => {
      if (datalayer.isVisible()) {
        features = features.concat(datalayer.featuresToGeoJSON())
      }
    })
    const geojson = {
      type: 'FeatureCollection',
      features: features,
    }
    return geojson
  },

  eachFeature: function (callback, context) {
    this.eachBrowsableDataLayer((datalayer) => {
      if (datalayer.isVisible()) datalayer.eachFeature(callback, context)
    })
  },

  processFileToImport: function (file, layer, type) {
    type = type || U.Utils.detectFileType(file)
    if (!type) {
      U.Alert.error(
        L._('Unable to detect format of file {filename}', {
          filename: file.name,
        })
      )
      return
    }
    if (type === 'umap') {
      this.importFromFile(file, 'umap')
    } else {
      if (!layer) layer = this.createDataLayer({ name: file.name })
      layer.importFromFile(file, type)
    }
  },

  importFromUrl: async function (uri) {
    const response = await this.request.get(uri)
    if (response?.ok) {
      this.importRaw(await response.text())
    }
  },

  importRaw: function (rawData) {
    const importedData = JSON.parse(rawData)

    let mustReindex = false

    for (const option of Object.keys(U.SCHEMA)) {
      if (typeof importedData.properties[option] !== 'undefined') {
        this.options[option] = importedData.properties[option]
        if (option === 'sortKey') mustReindex = true
      }
    }

    if (importedData.geometry) this.options.center = this.latLng(importedData.geometry)
    importedData.layers.forEach((geojson) => {
      if (!geojson._umap_options && geojson._storage) {
        geojson._umap_options = geojson._storage
        delete geojson._storage
      }
      delete geojson._umap_options?.id // Never trust an id at this stage
      const dataLayer = this.createDataLayer(geojson._umap_options)
      dataLayer.fromUmapGeoJSON(geojson)
    })

    this.initTileLayers()
    this.renderControls()
    this.handleLimitBounds()
    this.eachDataLayer((datalayer) => {
      if (mustReindex) datalayer.reindex()
      datalayer.redraw()
    })
    this.propagate()
    this.fire('postsync')
    this.isDirty = true
  },

  importFromFile: function (file) {
    const reader = new FileReader()
    reader.readAsText(file)
    reader.onload = (e) => {
      const rawData = e.target.result
      try {
        this.importRaw(rawData)
      } catch (e) {
        console.error('Error importing data', e)
        U.Alert.error(L._('Invalid umap data in {filename}', { filename: file.name }))
      }
    }
  },

  openBrowser: function (mode) {
    this.onceDatalayersLoaded(() => this.browser.open(mode))
  },

  openCaption: function () {
    this.onceDatalayersLoaded(() => this.caption.open())
  },

  eachDataLayer: function (method, context) {
    for (let i = 0; i < this.datalayers_index.length; i++) {
      method.call(context, this.datalayers_index[i])
    }
  },

  eachDataLayerReverse: function (method, context, filter) {
    for (let i = this.datalayers_index.length - 1; i >= 0; i--) {
      if (filter && !filter.call(context, this.datalayers_index[i])) continue
      method.call(context, this.datalayers_index[i])
    }
  },

  eachBrowsableDataLayer: function (method, context) {
    this.eachDataLayerReverse(method, context, (d) => d.allowBrowse())
  },

  eachVisibleDataLayer: function (method, context) {
    this.eachDataLayerReverse(method, context, (d) => d.isVisible())
  },

  findDataLayer: function (method, context) {
    for (let i = this.datalayers_index.length - 1; i >= 0; i--) {
      if (method.call(context, this.datalayers_index[i]))
        return this.datalayers_index[i]
    }
  },

  backup: function () {
    this.backupOptions()
    this._datalayers_index_bk = [].concat(this.datalayers_index)
  },

  reset: function () {
    if (this.editTools) this.editTools.stopDrawing()
    this.resetOptions()
    this.datalayers_index = [].concat(this._datalayers_index_bk)
    // Iter over all datalayers, including deleted if any.
    for (const datalayer of Object.values(this.datalayers)) {
      if (datalayer.isDeleted) datalayer.connectToMap()
      if (datalayer.isDirty) datalayer.reset()
    }
    this.ensurePanesOrder()
    this.initTileLayers()
    this.isDirty = false
    this.onDataLayersChanged()
  },

  checkDirty: function () {
    this._container.classList.toggle('umap-is-dirty', this.isDirty)
  },

  exportOptions: function () {
    const properties = {}
    for (const option of Object.keys(U.SCHEMA)) {
      if (typeof this.options[option] !== 'undefined') {
        properties[option] = this.options[option]
      }
    }
    return properties
  },

  saveSelf: async function () {
    this.rules.commit()
    const geojson = {
      type: 'Feature',
      geometry: this.geometry(),
      properties: this.exportOptions(),
    }
    const formData = new FormData()
    formData.append('name', this.options.name)
    formData.append('center', JSON.stringify(this.geometry()))
    formData.append('settings', JSON.stringify(geojson))
    const uri = this.urls.get('map_save', { map_id: this.options.umap_id })
    const [data, _, error] = await this.server.post(uri, {}, formData)
    // FIXME: login_required response will not be an error, so it will not
    // stop code while it should
    if (error) {
      return
    }
    if (data.login_required) {
      window.onLogin = () => this.save()
      window.open(data.login_required)
      return
    }
    this.options.user = data.user
    this.renderEditToolbar()
    if (!this.options.umap_id) {
      this.options.umap_id = data.id
      this.permissions.setOptions(data.permissions)
      this.permissions.commit()
      if (data.permissions?.anonymous_edit_url) {
        this.once('saved', () => {
          U.AlertCreation.info(
            L._('Your map has been created with an anonymous account!'),
            Number.Infinity,
            data.permissions.anonymous_edit_url,
            this.options.urls.map_send_edit_link
              ? this.sendEditLinkEmail.bind(this)
              : null
          )
        })
      } else {
        this.once('saved', () => {
          U.Alert.success(L._('Congratulations, your map has been created!'))
        })
      }
    } else {
      if (!this.permissions.isDirty) {
        // Do not override local changes to permissions,
        // but update in case some other editors changed them in the meantime.
        this.permissions.setOptions(data.permissions)
        this.permissions.commit()
      }
      this.once('saved', () => {
        U.Alert.success(data.info || L._('Map has been saved!'))
      })
    }
    // Update URL in case the name has changed.
    if (history?.pushState) {
      history.pushState({}, this.options.name, data.url)
    } else {
      window.location = data.url
    }
    this.propagate()
    return true
  },

  save: async function () {
    if (!this.isDirty) return
    if (this._default_extent) this._setCenterAndZoom()
    this.backup()
    if (this.options.editMode === 'advanced') {
      // Only save the map if the user has the rights to do so.
      const ok = await this.saveSelf()
      if (!ok) return
    }
    await this.permissions.save()
    // Iter over all datalayers, including deleted.
    for (const datalayer of Object.values(this.datalayers)) {
      if (datalayer.isDirty) await datalayer.save()
    }
    this.isDirty = false
    this.renderEditToolbar()
    this.fire('saved')
  },

  propagate: function () {
    let els = document.querySelectorAll('.map-name')
    for (const el of els) {
      el.textContent = this.getDisplayName()
    }
    const status = this.permissions.getShareStatusDisplay()
    els = document.querySelectorAll('.share-status')
    for (const el of els) {
      if (status) {
        el.textContent = L._('Visibility: {status}', {
          status: status,
        })
      }
    }
  },

  star: async function () {
    if (!this.options.umap_id) {
      return U.Alert.error(L._('Please save the map first'))
    }
    const url = this.urls.get('map_star', { map_id: this.options.umap_id })
    const [data, response, error] = await this.server.post(url)
    if (error) {
      return
    }
    this.options.starred = data.starred
    U.Alert.success(
      data.starred ? L._('Map has been starred') : L._('Map has been unstarred')
    )
    this.renderControls()
  },

  geometry: function () {
    /* Return a GeoJSON geometry Object */
    const latlng = this.latLng(this.options.center || this.getCenter())
    return {
      type: 'Point',
      coordinates: [latlng.lng, latlng.lat],
    }
  },

  firstVisibleDatalayer: function () {
    return this.findDataLayer((datalayer) => {
      if (datalayer.isVisible()) return true
    })
  },

  // TODO: allow to control the default datalayer
  // (edit and viewing)
  // cf https://github.com/umap-project/umap/issues/585
  defaultEditDataLayer: function () {
    let datalayer
    let fallback
    datalayer = this.lastUsedDataLayer
    if (
      datalayer &&
      !datalayer.isDataReadOnly() &&
      datalayer.isBrowsable() &&
      datalayer.isVisible()
    ) {
      return datalayer
    }
    datalayer = this.findDataLayer((datalayer) => {
      if (!datalayer.isDataReadOnly() && datalayer.isBrowsable()) {
        fallback = datalayer
        if (datalayer.isVisible()) return true
      }
    })
    if (datalayer) return datalayer
    if (fallback) {
      // No datalayer visible, let's force one
      fallback.show()
      return fallback
    }
    return this.createDataLayer()
  },

  getDataLayerByUmapId: function (umap_id) {
    return this.findDataLayer((d) => d.umap_id === umap_id)
  },

  _editControls: function (container) {
    let UIFields = []
    for (let i = 0; i < this.HIDDABLE_CONTROLS.length; i++) {
      UIFields.push(`options.${this.HIDDABLE_CONTROLS[i]}Control`)
    }
    UIFields = UIFields.concat([
      'options.moreControl',
      'options.scrollWheelZoom',
      'options.miniMap',
      'options.scaleControl',
      'options.onLoadPanel',
      'options.defaultView',
      'options.displayPopupFooter',
      'options.captionBar',
      'options.captionMenus',
    ])
    builder = new U.FormBuilder(this, UIFields)
    const controlsOptions = L.DomUtil.createFieldset(
      container,
      L._('User interface options')
    )
    controlsOptions.appendChild(builder.build())
  },

  _editShapeProperties: function (container) {
    const shapeOptions = [
      'options.color',
      'options.iconClass',
      'options.iconUrl',
      'options.iconOpacity',
      'options.opacity',
      'options.weight',
      'options.fill',
      'options.fillColor',
      'options.fillOpacity',
      'options.smoothFactor',
      'options.dashArray',
    ]

    builder = new U.FormBuilder(this, shapeOptions)
    const defaultShapeProperties = L.DomUtil.createFieldset(
      container,
      L._('Default shape properties')
    )
    defaultShapeProperties.appendChild(builder.build())
  },

  _editDefaultProperties: function (container) {
    const optionsFields = [
      'options.zoomTo',
      'options.easing',
      'options.labelKey',
      'options.sortKey',
      'options.filterKey',
      'options.facetKey',
      'options.slugKey',
    ]

    builder = new U.FormBuilder(this, optionsFields)
    const defaultProperties = L.DomUtil.createFieldset(
      container,
      L._('Default properties')
    )
    defaultProperties.appendChild(builder.build())
  },

  _editInteractionsProperties: function (container) {
    const popupFields = [
      'options.popupShape',
      'options.popupTemplate',
      'options.popupContentTemplate',
      'options.showLabel',
      'options.labelDirection',
      'options.labelInteractive',
      'options.outlinkTarget',
    ]
    builder = new U.FormBuilder(this, popupFields)
    const popupFieldset = L.DomUtil.createFieldset(
      container,
      L._('Default interaction options')
    )
    popupFieldset.appendChild(builder.build())
  },

  _editTilelayer: function (container) {
    if (!U.Utils.isObject(this.options.tilelayer)) {
      this.options.tilelayer = {}
    }
    const tilelayerFields = [
      [
        'options.tilelayer.name',
        { handler: 'BlurInput', placeholder: L._('display name') },
      ],
      [
        'options.tilelayer.url_template',
        {
          handler: 'BlurInput',
          helpText: `${L._('Supported scheme')}: http://{s}.domain.com/{z}/{x}/{y}.png`,
          placeholder: 'url',
          type: 'url',
        },
      ],
      [
        'options.tilelayer.maxZoom',
        {
          handler: 'BlurIntInput',
          placeholder: L._('max zoom'),
          min: 0,
          max: this.options.maxZoomLimit,
        },
      ],
      [
        'options.tilelayer.minZoom',
        {
          handler: 'BlurIntInput',
          placeholder: L._('min zoom'),
          min: 0,
          max: this.options.maxZoomLimit,
        },
      ],
      [
        'options.tilelayer.attribution',
        { handler: 'BlurInput', placeholder: L._('attribution') },
      ],
      ['options.tilelayer.tms', { handler: 'Switch', label: L._('TMS format') }],
    ]
    const customTilelayer = L.DomUtil.createFieldset(
      container,
      L._('Custom background')
    )
    builder = new U.FormBuilder(this, tilelayerFields)
    customTilelayer.appendChild(builder.build())
  },

  _editOverlay: function (container) {
    if (!U.Utils.isObject(this.options.overlay)) {
      this.options.overlay = {}
    }
    const overlayFields = [
      [
        'options.overlay.url_template',
        {
          handler: 'BlurInput',
          helpText: `${L._('Supported scheme')}: http://{s}.domain.com/{z}/{x}/{y}.png`,
          placeholder: 'url',
          label: L._('Background overlay url'),
          type: 'url',
        },
      ],
      [
        'options.overlay.maxZoom',
        {
          handler: 'BlurIntInput',
          placeholder: L._('max zoom'),
          min: 0,
          max: this.options.maxZoomLimit,
        },
      ],
      [
        'options.overlay.minZoom',
        {
          handler: 'BlurIntInput',
          placeholder: L._('min zoom'),
          min: 0,
          max: this.options.maxZoomLimit,
        },
      ],
      [
        'options.overlay.attribution',
        { handler: 'BlurInput', placeholder: L._('attribution') },
      ],
      [
        'options.overlay.opacity',
        { handler: 'Range', min: 0, max: 1, step: 0.1, label: L._('Opacity') },
      ],
      ['options.overlay.tms', { handler: 'Switch', label: L._('TMS format') }],
    ]
    const overlay = L.DomUtil.createFieldset(container, L._('Custom overlay'))
    builder = new U.FormBuilder(this, overlayFields)
    overlay.appendChild(builder.build())
  },

  _editBounds: function (container) {
    if (!U.Utils.isObject(this.options.limitBounds)) {
      this.options.limitBounds = {}
    }
    const limitBounds = L.DomUtil.createFieldset(container, L._('Limit bounds'))
    const boundsFields = [
      [
        'options.limitBounds.south',
        { handler: 'BlurFloatInput', placeholder: L._('max South') },
      ],
      [
        'options.limitBounds.west',
        { handler: 'BlurFloatInput', placeholder: L._('max West') },
      ],
      [
        'options.limitBounds.north',
        { handler: 'BlurFloatInput', placeholder: L._('max North') },
      ],
      [
        'options.limitBounds.east',
        { handler: 'BlurFloatInput', placeholder: L._('max East') },
      ],
    ]
    const boundsBuilder = new U.FormBuilder(this, boundsFields)
    limitBounds.appendChild(boundsBuilder.build())
    const boundsButtons = L.DomUtil.create('div', 'button-bar half', limitBounds)
    L.DomUtil.createButton(
      'button',
      boundsButtons,
      L._('Use current bounds'),
      function () {
        const bounds = this.getBounds()
        this.options.limitBounds.south = L.Util.formatNum(bounds.getSouth())
        this.options.limitBounds.west = L.Util.formatNum(bounds.getWest())
        this.options.limitBounds.north = L.Util.formatNum(bounds.getNorth())
        this.options.limitBounds.east = L.Util.formatNum(bounds.getEast())
        boundsBuilder.fetchAll()

        this.sync.update(this, 'options.limitBounds', this.options.limitBounds)
        this.isDirty = true
        this.handleLimitBounds()
      },
      this
    )
    L.DomUtil.createButton(
      'button',
      boundsButtons,
      L._('Empty'),
      function () {
        this.options.limitBounds.south = null
        this.options.limitBounds.west = null
        this.options.limitBounds.north = null
        this.options.limitBounds.east = null
        boundsBuilder.fetchAll()
        this.isDirty = true
        this.handleLimitBounds()
      },
      this
    )
  },

  _editSlideshow: function (container) {
    const slideshow = L.DomUtil.createFieldset(container, L._('Slideshow'))
    const slideshowFields = [
      [
        'options.slideshow.active',
        { handler: 'Switch', label: L._('Activate slideshow mode') },
      ],
      [
        'options.slideshow.delay',
        {
          handler: 'SlideshowDelay',
          helpText: L._('Delay between two transitions when in play mode'),
        },
      ],
      [
        'options.slideshow.easing',
        { handler: 'Switch', label: L._('Animated transitions'), inheritable: true },
      ],
      [
        'options.slideshow.autoplay',
        { handler: 'Switch', label: L._('Autostart when map is loaded') },
      ],
    ]
    const slideshowBuilder = new U.FormBuilder(this, slideshowFields, {
      callback: () => this.slideshow.setOptions(this.options.slideshow),
    })
    slideshow.appendChild(slideshowBuilder.build())
  },

  _editSync: function (container) {
    const sync = L.DomUtil.createFieldset(container, L._('Real-time collaboration'))
    const builder = new U.FormBuilder(this, ['options.syncEnabled'])
    sync.appendChild(builder.build())
  },

  _advancedActions: function (container) {
    const advancedActions = L.DomUtil.createFieldset(container, L._('Advanced actions'))
    const advancedButtons = L.DomUtil.create('div', 'button-bar half', advancedActions)
    if (this.permissions.isOwner()) {
      const deleteButton = U.Utils.loadTemplate(`
        <button class="button" type="button">
          <i class="icon icon-24 icon-delete"></i>${L._('Delete')}
        </button>`)
      deleteButton.addEventListener('click', () => this.del())
      advancedButtons.appendChild(deleteButton)

      L.DomUtil.createButton(
        'button umap-empty',
        advancedButtons,
        L._('Clear data'),
        this.emptyDataLayers,
        this
      )
      L.DomUtil.createButton(
        'button umap-empty',
        advancedButtons,
        L._('Remove layers'),
        this.removeDataLayers,
        this
      )
    }
    L.DomUtil.createButton(
      'button umap-clone',
      advancedButtons,
      L._('Clone this map'),
      this.clone,
      this
    )
    L.DomUtil.createButton(
      'button umap-download',
      advancedButtons,
      L._('Open share & download panel'),
      this.share.open,
      this.share
    )
  },

  editCaption: function () {
    if (!this.editEnabled) return
    if (this.options.editMode !== 'advanced') return
    const container = L.DomUtil.create('div', 'umap-edit-container')
    const metadataFields = ['options.name', 'options.description']

    L.DomUtil.createTitle(container, L._('Edit map details'), 'icon-caption')
    const builder = new U.FormBuilder(this, metadataFields, {
      className: 'map-metadata',
    })
    const form = builder.build()
    container.appendChild(form)

    const credits = L.DomUtil.createFieldset(container, L._('Credits'))
    const creditsFields = [
      'options.licence',
      'options.shortCredit',
      'options.longCredit',
      'options.permanentCredit',
      'options.permanentCreditBackground',
    ]
    const creditsBuilder = new U.FormBuilder(this, creditsFields)
    credits.appendChild(creditsBuilder.build())
    this.editPanel.open({ content: container })
  },

  edit: function () {
    if (!this.editEnabled) return
    if (this.options.editMode !== 'advanced') return
    const container = L.DomUtil.create('div')
    L.DomUtil.createTitle(container, L._('Map advanced properties'), 'icon-settings')
    this._editControls(container)
    this._editShapeProperties(container)
    this._editDefaultProperties(container)
    this._editInteractionsProperties(container)
    this.rules.edit(container)
    this._editTilelayer(container)
    this._editOverlay(container)
    this._editBounds(container)
    this._editSlideshow(container)
    if (this.options.websocketEnabled) {
      this._editSync(container)
    }
    this._advancedActions(container)

    this.editPanel.open({ content: container, className: 'dark' })
  },

  enableEdit: function () {
    L.DomUtil.addClass(document.body, 'umap-edit-enabled')
    this.editEnabled = true
    this.drop.enable()
    this.fire('edit:enabled')
    this.initSyncEngine()
  },

  disableEdit: function () {
    if (this.isDirty) return
    this.drop.disable()
    L.DomUtil.removeClass(document.body, 'umap-edit-enabled')
    this.editedFeature = null
    this.editEnabled = false
    this.fire('edit:disabled')
    this.editPanel.close()
    this.fullPanel.close()
    this.sync.stop()
    this.closeInplaceToolbar()
  },

  hasEditMode: function () {
    return this.options.editMode === 'simple' || this.options.editMode === 'advanced'
  },

  getDisplayName: function () {
    return this.options.name || L._('Untitled map')
  },

  initCaptionBar: function () {
    const container = L.DomUtil.create(
      'div',
      'umap-caption-bar',
      this._controlContainer
    )
    const name = L.DomUtil.create('h3', '', container)
    L.DomEvent.disableClickPropagation(container)
    this.addAuthorLink('span', container)
    if (this.getOption('captionMenus')) {
      L.DomUtil.createButton(
        'umap-about-link flat',
        container,
        L._('Open caption'),
        this.openCaption,
        this
      )
      L.DomUtil.createButton(
        'umap-open-browser-link flat',
        container,
        L._('Browse data'),
        () => this.openBrowser('data')
      )
      if (this.options.facetKey) {
        L.DomUtil.createButton(
          'umap-open-filter-link flat',
          container,
          L._('Filter data'),
          () => this.openBrowser('filters')
        )
      }
    }
    const setName = function () {
      name.textContent = this.getDisplayName()
    }
    L.bind(setName, this)()
    this.on('postsync', L.bind(setName, this))
    this.onceDatalayersLoaded(function () {
      this.slideshow.renderToolbox(container)
    })
  },

  askForReset: function (e) {
    this.dialog
      .confirm(L._('Are you sure you want to cancel your changes?'))
      .then(() => {
        this.reset()
        this.disableEdit()
      })
  },

  startMarker: function () {
    return this.editTools.startMarker()
  },

  startPolyline: function () {
    return this.editTools.startPolyline()
  },

  startPolygon: function () {
    return this.editTools.startPolygon()
  },

  del: async function () {
    this.dialog
      .confirm(L._('Are you sure you want to delete this map?'))
      .then(async () => {
        const url = this.urls.get('map_delete', { map_id: this.options.umap_id })
        const [data, response, error] = await this.server.post(url)
        if (data.redirect) window.location = data.redirect
      })
  },

  clone: async function () {
    this.dialog
      .confirm(L._('Are you sure you want to clone this map and all its datalayers?'))
      .then(async () => {
        const url = this.urls.get('map_clone', { map_id: this.options.umap_id })
        const [data, response, error] = await this.server.post(url)
        if (data.redirect) window.location = data.redirect
      })
  },

  removeDataLayers: function () {
    this.eachDataLayerReverse((datalayer) => {
      datalayer._delete()
    })
  },

  emptyDataLayers: function () {
    this.eachDataLayerReverse((datalayer) => {
      datalayer.empty()
    })
  },

  initLoader: function () {
    this.loader = new L.Control.Loading()
    this.loader.onAdd(this)
  },

  getContextMenuItems: function (event) {
    const items = []
    if (this.hasEditMode()) {
      if (this.editEnabled) {
        if (!this.isDirty) {
          items.push({
            label: this.help.displayLabel('STOP_EDIT'),
            action: () => this.disableEdit(),
          })
        }
        if (this.options.enableMarkerDraw) {
          items.push({
            label: this.help.displayLabel('DRAW_MARKER'),
            action: () => this.startMarker(event),
          })
        }
        if (this.options.enablePolylineDraw) {
          items.push({
            label: this.help.displayLabel('DRAW_POLYGON'),
            action: () => this.startPolygon(event),
          })
        }
        if (this.options.enablePolygonDraw) {
          items.push({
            label: this.help.displayLabel('DRAW_LINE'),
            action: () => this.startPolyline(event),
          })
        }
        items.push('-')
        items.push({
          label: L._('Help'),
          action: () => this.help.show('edit'),
        })
      } else {
        items.push({
          label: this.help.displayLabel('TOGGLE_EDIT'),
          action: () => this.enableEdit(),
        })
      }
    }
    items.push(
      '-',
      {
        label: L._('Open browser'),
        action: () => this.openBrowser('layers'),
      },
      {
        label: L._('Browse data'),
        action: () => this.openBrowser('data'),
      }
    )
    if (this.options.facetKey) {
      items.push({
        label: L._('Filter data'),
        action: () => this.openBrowser('filters'),
      })
    }
    items.push(
      {
        label: L._('Open caption'),
        action: () => this.openCaption(),
      },
      {
        label: this.help.displayLabel('SEARCH'),
        action: () => this.search(event),
      }
    )
    if (this.options.urls.routing) {
      items.push('-', {
        label: L._('Directions from here'),
        action: () => this.openExternalRouting(event),
      })
    }
    if (this.options.urls.edit_in_osm) {
      items.push('-', {
        label: L._('Edit in OpenStreetMap'),
        action: () => this.editInOSM(event),
      })
    }
    return items
  },

  onContextMenu: function (event) {
    const items = this.getContextMenuItems(event)
    this.contextmenu.open(
      [event.originalEvent.clientX, event.originalEvent.clientY],
      items
    )
  },

  editInOSM: function (e) {
    const url = this.urls.get('edit_in_osm', {
      lat: e.latlng.lat,
      lng: e.latlng.lng,
      zoom: Math.max(this.getZoom(), 16),
    })
    if (url) window.open(url)
  },

  openExternalRouting: function (e) {
    const url = this.urls.get('routing', {
      lat: e.latlng.lat,
      lng: e.latlng.lng,
      locale: L.getLocale(),
      zoom: this.getZoom(),
    })
    if (url) window.open(url)
  },

  getMap: function () {
    return this
  },

  getGeoContext: function () {
    const context = {
      bbox: this.getBounds().toBBoxString(),
      north: this.getBounds().getNorthEast().lat,
      east: this.getBounds().getNorthEast().lng,
      south: this.getBounds().getSouthWest().lat,
      west: this.getBounds().getSouthWest().lng,
      lat: this.getCenter().lat,
      lng: this.getCenter().lng,
      zoom: this.getZoom(),
    }
    context.left = context.west
    context.bottom = context.south
    context.right = context.east
    context.top = context.north
    return context
  },

  localizeUrl: function (url) {
    return U.Utils.greedyTemplate(url, this.getGeoContext(), true)
  },

  proxyUrl: function (url, ttl) {
    if (this.options.urls.ajax_proxy) {
      url = U.Utils.greedyTemplate(this.options.urls.ajax_proxy, {
        url: encodeURIComponent(url),
        ttl: ttl,
      })
    }
    return url
  },

  getFeatureById: function (id) {
    let feature
    for (const datalayer of this.datalayers_index) {
      feature = datalayer.getFeatureById(id)
      if (feature) return feature
    }
  },

  closeInplaceToolbar: function () {
    const toolbar = this._toolbars[L.Toolbar.Popup._toolbar_class_id]
    if (toolbar) toolbar.remove()
  },

  search: function () {
    if (this._controls.search) this._controls.search.open()
  },

  getLayersBounds: function () {
    const bounds = new L.latLngBounds()
    this.eachBrowsableDataLayer((d) => {
      if (d.isVisible()) bounds.extend(d.layer.getBounds())
    })
    return bounds
  },

  sendEditLinkEmail: async function (formData) {
    const sendLink =
      this.options.urls.map_send_edit_link &&
      this.urls.get('map_send_edit_link', {
        map_id: this.options.umap_id,
      })
    await this.server.post(sendLink, {}, formData)
  },

  allProperties: function () {
    return [].concat(...this.datalayers_index.map((dl) => dl._propertiesIndex))
  },

  sortedValues: function (property) {
    return []
      .concat(...this.datalayers_index.map((dl) => dl.sortedValues(property)))
      .filter((val, idx, arr) => arr.indexOf(val) === idx)
      .sort(U.Utils.naturalSort)
  },

  addAuthorLink: function (element, container) {
    if (this.options.author?.name) {
      const authorContainer = L.DomUtil.add(
        element,
        'umap-map-author',
        container,
        ` ${L._('by')} `
      )
      L.DomUtil.createLink(
        '',
        authorContainer,
        this.options.author.name,
        this.options.author.url
      )
    }
  },
})
