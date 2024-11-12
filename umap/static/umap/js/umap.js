L.Map.mergeOptions({
  overlay: {},
  datalayers: [],
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

    // TODO: remove me when moved to modules
    // and inheriting from ServerStored
    try {
      Object.defineProperty(this, 'isDirty', {
        get: () => U.SAVEMANAGER.has(this),
        set: (status) => {
          if (status) {
            U.SAVEMANAGER.add(this)
          } else {
            U.SAVEMANAGER.remove(this)
          }
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

    if (!this.options.noControl) {
      this.initShortcuts()
      this.initCaptionBar()
      this.on('contextmenu', this.onContextMenu)
      this.onceDataLoaded(this.setViewFromQueryString)
      this.on('click', this.closeInplaceToolbar)
      this.propagate()
    }

    window.onbeforeunload = () => (this.editEnabled && U.SAVEMANAGER.isDirty) || null
    this.backup()
  },


  getFeatureById: function (id) {
    let feature
    for (const datalayer of this.datalayers_index) {
      feature = datalayer.getFeatureById(id)
      if (feature) return feature
    }
  },

})
