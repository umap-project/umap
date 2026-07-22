import { Alert, AlertCreation } from '../components/alerts/alert.js'
import * as Clipboard from './clipboard.js'
import { Fields } from './data/fields.js'
import { DataLayer } from './data/layer.js'
import * as DOMUtils from './domutils.js'
import DropControl from './drop.js'
import { Filters, migrateLegacyFilters } from './filters.js'
import { MutatingForm } from './form/builder.js'
import { Formatter } from './formatter.js'
import * as GeoUtils from './geoutils.js'
import Help from './help.js'
import { getLocale, setLocale, translate } from './i18n.js'
import { LayerManager } from './managers.js'
import { MapPermissions } from './permissions.js'
import { OLProxy } from './openlayers/index.js'
import { LeafletProxy } from './rendering/leaflet.js'
import { Request, ServerRequest } from './request.js'
import Rules from './rules.js'
import * as Schema from './schema.js'
import Slideshow from './slideshow.js'
import { BottomBar, EditBar, TopBar } from './ui/bar.js'
import ContextMenu from './ui/contextmenu.js'
import { ControlManager } from './ui/controls.js'
import Dialog from './ui/dialog.js'
import Hash from './ui/hash.js'
import Loader from './ui/loader.js'
import { EditPanel, FullPanel, Panel } from './ui/panel.js'
import Tooltip from './ui/tooltip.js'
import URLs from './urls.js'
import * as Utils from './utils.js'

export default class App extends Utils.WithEvents {
  constructor(element, geojson) {
    super()
    // We need to call async function in the init process,
    // the init itself does not need to be awaited, but some calls
    // in the process must be blocker
    this.init(element, geojson)
  }

  get id() {
    return this.properties.id
  }

  async init(element, geojson) {
    this.migrateLegacyProperties(geojson.properties)
    this.properties = Object.assign(
      {
        enableMarkerDraw: true,
        enablePolygonDraw: true,
        enablePolylineDraw: true,
        hash: true,
        limitBounds: {},
      },
      geojson.properties
    )
    this.createdAt = new Date(this.properties.created_at)
    this.modifiedAt = this.properties.modified_at
    this.searchParams = new URLSearchParams(window.location.search)

    // Locale name (pt_PT, en_US…)
    // To be used for Django localization
    if (geojson.properties.locale) setLocale(geojson.properties.locale)

    // Language code (pt-pt, en-us…)
    // To be used in javascript APIs
    if (geojson.properties.lang) U.lang = geojson.properties.lang

    // Make it available to utils, without needing a reference to `Umap`.
    U.LABEL_KEYS = geojson.properties.defaultLabelKeys || []
    U.DEFAULT_LABEL_KEY = U.LABEL_KEYS[0] || 'name'

    this.setPropertiesFromQueryString()

    // Needed for actions labels
    this.help = new Help(this)
    // Prevent default creation of controls
    const zoomControl = this.properties.zoomControl
    const fullscreenControl = this.properties.fullscreenControl
    this.properties.center = geojson.geometry.coordinates
    this.properties.zoomControl = false
    this.properties.fullscreenControl = false

    if (this.searchParams.has('leaflet')) {
      console.log('You still go Leaflet bro')
      this.mapProxy = new LeafletProxy(this, element)
    } else {
      console.log('So you wanna run OL')
      this.mapProxy = new OLProxy(this, element)
    }
    this.uiContainer = Utils.loadTemplate('<div class="umap-ui-container"></div>')
    this.mapProxy.attachUI(this.uiContainer)
    this.controlManager = new ControlManager(this)
    this.drop = new DropControl(this, this.mapProxy.container)

    this.properties.zoomControl = zoomControl !== undefined ? zoomControl : true
    this.properties.fullscreenControl =
      fullscreenControl !== undefined ? fullscreenControl : true

    // Needed to render controls
    this.permissions = new MapPermissions(this)
    this.urls = new URLs(this.properties.urls)
    this.slideshow = new Slideshow(this)

    if (geojson.properties.schema) this.overrideSchema(geojson.properties.schema)
    if (geojson.properties.ttl) {
      Schema.SCHEMA.ttl.choices = Array.from(Object.entries(geojson.properties.ttl))
      Schema.SCHEMA.ttl.default = geojson.properties.default_ttl
    }

    // Do not display in an iframe.
    if (this.isEmbed) {
      this.properties.homeControl = false
    }

    this.loader = new Loader(this.uiContainer)
    if (this.properties.hash) {
      this.hash = new Hash(this)
    }
    // initCenter (in setup) needs the locate control to exist.
    this.controlManager.init()
    this.mapProxy.render()
    this.controlManager.update()

    this.panel = new Panel(this)
    this.dialog = new Dialog({ className: 'dark' })
    this.topBar = new TopBar(this, this.uiContainer)
    this.bottomBar = new BottomBar(this, this.slideshow, this.uiContainer)
    this.editBar = new EditBar(this, this.uiContainer)
    this.tooltip = new Tooltip()
    this.contextmenu = new ContextMenu()
    this.server = new ServerRequest()
    this.request = new Request()
    this.fields = new Fields(this, this.dialog)
    this.filters = new Filters(this, this)
    this.rules = new Rules(this, this)

    this.request.on('dataloading', (event) => this.loader.start(event.detail.id))
    this.request.on('dataload', (event) => this.loader.stop(event.detail.id))
    this.server.on('dataloading', (event) => this.loader.start(event.detail.id))
    this.server.on('dataload', (event) => this.loader.stop(event.detail.id))

    if (this.hasEditMode()) {
      this.editPanel = new EditPanel(this)
      this.fullPanel = new FullPanel(this)
      this.mapProxy.initEditTools()
      this.topBar.setup()
      this.editBar.setup()
    }

    this.datalayersFromQueryString = this.searchParams.get('datalayers')
    if (this.datalayersFromQueryString) {
      this.datalayersFromQueryString = this.datalayersFromQueryString
        .toString()
        .split(',')
    }

    // Retrocompat
    if (
      this.properties.slideshow?.delay &&
      this.properties.slideshow.active === undefined
    ) {
      this.properties.slideshow.active = true
    }

    // Global storage for retrieving datalayers and features.
    this.layers = new LayerManager()
    this.featuresIndex = {}

    this.formatter = new Formatter(this)

    this.initDataLayers()
    this.on('datalayer:changed', () => this.onDataLayersChanged())
    this.on('feature:endedit', (event) => {
      if (this.editedFeature?.id === event.detail.id) {
        this.editedFeature = null
        this.editPanel.close()
      }
    })
    this.on('panel:show', (event) => {
      this.panel.setDefaultMode('expanded')
      this.panel.open({
        content: event.detail.content,
        actions: [this.panelBackButton()],
      })
    })
    this.on('panel:close', () => this.panel.close())

    if (this.properties.displayCaptionOnLoad) {
      // Retrocompat
      if (!this.properties.onLoadPanel) {
        this.properties.onLoadPanel = 'caption'
      }
      delete this.properties.displayCaptionOnLoad
    }
    if (this.properties.displayDataBrowserOnLoad) {
      // Retrocompat
      if (!this.properties.onLoadPanel) {
        this.properties.onLoadPanel = 'databrowser'
      }
      delete this.properties.displayDataBrowserOnLoad
    }
    if (this.properties.datalayersControl === 'expanded') {
      if (!this.properties.onLoadPanel) {
        this.properties.onLoadPanel = 'datalayers'
      }
      delete this.properties.datalayersControl
    }
    if (this.properties.onLoadPanel === 'facet') {
      this.properties.onLoadPanel = 'datafilters'
    }

    // Creation mode
    if (!this.id) {
      if (!this.properties.preview) {
        await this.enableEdit()
      }
      this._defaultExtent = true
      this.properties.name = translate('Untitled map')
      await this.loadTemplateFromQueryString()
      await this.loadDataFromQueryString()
    }

    if (!this.properties.noControl) {
      this.initShortcuts()
      this.onceDataLoaded(() => this.setViewFromQueryString())
      this.bottomBar.setup()
      this.propagate()
    }

    window.onbeforeunload = () => (this.editEnabled && this.isDirty) || null
  }

  get name() {
    return this.properties.name
  }

  get isDirty() {
    return this.journal._undoManager.isDirty()
  }

  get editedFeature() {
    return this._editedFeature
  }

  set editedFeature(feature) {
    const previous = this._editedFeature
    this._editedFeature = feature
    if (previous && previous.id !== feature?.id) {
      this.fire('feature:endedit', { id: previous.id })
    }
    this.fire('seteditedfeature')
  }

  get modifiedAt() {
    return this._modifiedAt
  }

  set modifiedAt(at) {
    if (!at) return
    if (typeof at === 'string') {
      at = new Date(at)
    }
    if (!this._modifiedAt || at > this._modifiedAt) {
      this._modifiedAt = at
    }
  }

  get isEmbed() {
    return window.self !== window.top
  }

  setPropertiesFromQueryString() {
    const asBoolean = (key, value) => {
      if (value !== undefined && value !== null) {
        this.properties[key] = value === '1' || value === 'true'
      }
    }
    const asNullableBoolean = (key, value) => {
      if (this.searchParams.has(key)) {
        if (value === 'null') value = null
        else if (value === '0' || value === 'false') value = false
        else value = true
        this.properties[key] = value
      }
    }
    const asNumber = (key, value) => {
      value = +value
      if (!Number.isNaN(value)) this.properties[name] = value
    }
    // FIXME retrocompat
    asBoolean('displayDataBrowserOnLoad')
    asBoolean('displayCaptionOnLoad')
    const setKey = (schema, key, value) => {
      switch (schema.type) {
        case Boolean:
          if (schema.nullable) asNullableBoolean(key, value)
          else asBoolean(key, value)
          break
        case Number:
          asNumber(key, value)
          break
        case String: {
          if (this.searchParams.has(key)) {
            if (value !== undefined) this.properties[key] = value
            break
          }
        }
      }
    }
    for (const [key, schema] of Object.entries(Schema.SCHEMA)) {
      setKey(schema, key, this.searchParams.get(key))
      if (schema.legacy) {
        for (const oldKey of schema.legacy) {
          setKey(schema, key, this.searchParams.get(oldKey))
        }
      }
    }
    // Specific case for datalayersControl
    // which accepts "expanded" value, on top of true/false/null
    if (this.searchParams.get('datalayersControl') === 'expanded') {
      if (!this.properties.onLoadPanel) {
        this.properties.onLoadPanel = 'datalayers'
      }
    }
  }

  async setViewFromQueryString() {
    if (this.properties.noControl) return
    // If a feature in the query string opens in app.panel (popupShape === 'Panel'),
    // skip the default panel: it would race with the feature in the lazy era.
    // Other popup shapes coexist fine.
    const slug = this.searchParams.get('feature')
    const feature = slug ? this.featuresIndex[slug] : null
    const featureOwnsPanel = feature?.getOption('popupShape') === 'Panel'
    if (!featureOwnsPanel) {
      if (this.searchParams.has('share')) {
        this.loadShare().then((share) => share.open())
      } else if (this.properties.onLoadPanel === 'databrowser') {
        this.panel.setDefaultMode('expanded')
        this.openBrowser('data')
      } else if (this.properties.onLoadPanel === 'datalayers') {
        this.panel.setDefaultMode('condensed')
        this.openBrowser('layers')
      } else if (this.properties.onLoadPanel === 'datafilters') {
        this.panel.setDefaultMode('expanded')
        this.openBrowser('filters')
      } else if (this.properties.onLoadPanel === 'caption') {
        this.panel.setDefaultMode('condensed')
        this.openCaption()
      }
    }
    if (feature) feature.view()
    if (this.searchParams.has('edit')) {
      if (this.hasEditMode()) await this.enableEdit()
      // Sometimes users share the ?edit link by mistake, let's remove
      // this search parameter from URL to prevent this
      const url = new URL(window.location)
      url.searchParams.delete('edit')
      history.pushState({}, '', url)
    }
    if (this.searchParams.has('download')) {
      const download_url = this.urls.get('map_download', {
        map_id: this.id,
      })
      window.location = download_url
    }
  }

  async loadImporter() {
    if (!this.importer) {
      const Importer = (await import('./importer.js')).default
      this.importer = new Importer(this)
    }
    return this.importer
  }

  async loadShare() {
    if (!this.share) {
      const Share = (await import('./share.js')).default
      this.share = new Share(this)
    }
    return this.share
  }

  async loadBrowser() {
    if (!this.browser) {
      const Browser = (await import('./browser.js')).default
      this.browser = new Browser(this)
    }
    return this.browser
  }

  async loadCaption() {
    if (!this.caption) {
      const Caption = (await import('./caption.js')).default
      this.caption = new Caption(this)
    }
    return this.caption
  }

  async loadTemplateFromQueryString() {
    const templateUrl = this.searchParams.get('templateUrl')
    if (templateUrl) {
      this.loadImporter().then((importer) => {
        importer.build()
        importer.url = templateUrl
        importer.format = 'umap'
        importer.submit()
      })
    }
  }

  async loadDataFromQueryString() {
    // Data injected from the URL may be edited and saved, so it must be
    // journaled: bring the journal up before creating the layer.
    await this.initJournal()
    let data = this.searchParams.get('data')
    const dataUrls = this.searchParams.getAll('dataUrl')
    const dataFormat = this.searchParams.get('dataFormat') || 'geojson'
    if (dataUrls.length) {
      for (let dataUrl of dataUrls) {
        dataUrl = decodeURIComponent(dataUrl)
        dataUrl = this.renderUrl(dataUrl)
        dataUrl = this.proxyUrl(dataUrl)
        const datalayer = this.createDataLayer()
        await datalayer
          .importFromUrl(dataUrl, dataFormat)
          .then(() => datalayer.zoomTo())
      }
    } else if (data) {
      data = decodeURIComponent(data)
      const datalayer = this.createDataLayer()
      await datalayer.importRaw(data, dataFormat).then(() => datalayer.zoomTo())
    }
  }

  hasFilters() {
    return this.filters.size || this.layers.tree.some((d) => d.filters.size)
  }

  hasActiveFilters() {
    return this.filters.isActive() || this.layers.tree.some((d) => d.filters.isActive())
  }

  getOwnContextMenu() {
    const items = []
    if (this.editEnabled) {
      items.push({
        items: [
          {
            title: this.help.displayLabel('DRAW_MARKER', false),
            icon: 'icon-marker',
            action: () => this.fire('draw:marker'),
          },
          {
            title: this.help.displayLabel('DRAW_LINE', false),
            icon: 'icon-polyline',
            action: () => this.fire('draw:polyline'),
          },
          {
            title: this.help.displayLabel('DRAW_POLYGON', false),
            icon: 'icon-polygon',
            action: () => this.fire('draw:polygon'),
          },
        ],
      })
    }
    items.push(
      {
        label: translate('Open browser'),
        action: () => this.openBrowser('layers'),
      },
      {
        label: translate('Browse data'),
        action: () => this.openBrowser('data'),
      }
    )
    if (this.hasFilters()) {
      items.push({
        label: translate('Filter data'),
        action: () => this.openBrowser('filters'),
      })
    }
    items.push(
      {
        label: translate('Open caption'),
        action: () => this.openCaption(),
      },
      {
        label: this.help.displayLabel('SEARCH'),
        action: () => this.search(),
      }
    )
    return items
  }

  getSharedContextMenu({ lat, lng }) {
    const latlng = `${lat.toFixed(6)},${lng.toFixed(6)}`
    const items = [
      {
        label: latlng,
        action: () => Clipboard.copy(latlng),
      },
    ]
    if (this.properties.urls.routing) {
      items.push({
        label: translate('Directions from here'),
        action: () => this.openExternalRouting({ lat, lng }),
      })
    }
    if (this.properties.ORSAPIKey) {
      items.push({
        label: translate('Compute isochrone from here'),
        action: () => this.askForIsochrone({ lat, lng }),
      })
    }
    if (this.properties.urls.edit_in_osm) {
      items.push({
        label: translate('Edit in OpenStreetMap'),
        action: () => this.editInOSM({ lat, lng }),
      })
    }
    items.push({
      label: translate('Open in OpenStreetMap'),
      action: () => this.openInOSM({ lat, lng }),
    })
    if (items.length) items.unshift('-')
    return items
  }

  onContextMenu({ lat, lng, pixel }) {
    const items = this.getOwnContextMenu().concat(
      this.getSharedContextMenu({ lat, lng })
    )
    this.contextmenu.openAt(pixel, items)
  }

  // Merge the given schema with the default one
  // Missing keys inside the schema are merged with the default ones.
  overrideSchema(schema) {
    for (const [key, extra] of Object.entries(schema)) {
      Schema.SCHEMA[key] = Object.assign({}, Schema.SCHEMA[key], extra)
    }
  }

  search() {
    this.controlManager.controls.search?.onClick()
  }

  hasEditMode() {
    const editMode = this.properties.editMode
    return editMode === 'simple' || editMode === 'advanced'
  }

  getProperty(key, feature) {
    let value
    if (feature) {
      value = this.rules.getOption(key, feature)
      if (value !== undefined) return value
    }
    value = this.properties[key]
    if (Schema.isValidValue(value, key)) return value
    return Schema.SCHEMA[key]?.default
  }

  getColor() {
    return this.getProperty('color')
  }

  getOption(key, feature) {
    // TODO: remove when field.js does not call blindly obj.getOption anymore
    return this.getProperty(key, feature)
  }

  renderUrl(url) {
    return Utils.greedyTemplate(url, this.mapProxy.getGeoContext(), true)
  }

  initShortcuts() {
    const shortcuts = {
      Escape: {
        do: () => {
          if (this.importer?.dialog.visible) {
            this.importer.dialog.close()
          } else if (this.mapProxy.onEscape()) {
            // Already done by mapProxy
          } else if (this.fullPanel?.isOpen()) {
            this.fullPanel?.close()
          } else if (this.editPanel?.isOpen()) {
            this.editPanel?.close()
          } else if (this.panel.isOpen()) {
            this.panel.close()
          }
        },
      },
      'Ctrl+f': {
        do: () => {
          this.search()
        },
      },
      'Ctrl+e': {
        if: () => this.hasEditMode(),
        do: () => {
          if (!this.editEnabled) this.enableEdit()
          else if (!this.isDirty) this.disableEdit()
        },
      },
      'Ctrl+s': {
        if: () => this.editEnabled && this.isDirty,
        do: () => this.saveAll(),
      },
      'Ctrl+z': {
        if: () => this.editEnabled && !Utils.isWritable(event.target),
        do: () => this.journal._undoManager.undo(),
      },
      'Ctrl+Shift+Z': {
        if: () => this.editEnabled && !Utils.isWritable(event.target),
        do: () => this.journal._undoManager.redo(),
      },
      'Ctrl+m': {
        if: () => this.editEnabled,
        do: () => this.fire('draw:marker'),
      },
      'Ctrl+p': {
        if: () => this.editEnabled,
        do: () => this.fire('draw:polygon'),
      },
      'Ctrl+l': {
        if: () => this.editEnabled,
        do: () => this.fire('draw:polyline'),
      },
      'Ctrl+i': {
        if: () => this.editEnabled,
        do: () => this.openImporter(),
      },
      'Ctrl+o': {
        if: () => this.editEnabled,
        do: () => this.openFilesImporter(),
      },
      'Ctrl+h': {
        if: () => this.editEnabled,
        do: () => this.help.showGetStarted(),
      },
    }
    const onKeyDown = (event) => {
      const shiftKey = event.shiftKey ? 'Shift+' : ''
      const altKey = event.altKey ? 'Alt+' : ''
      const ctrlKey = event.ctrlKey || event.metaKey ? 'Ctrl+' : ''
      const combination = `${ctrlKey}${shiftKey}${altKey}${event.key}`

      const shortcut = shortcuts[combination]
      if (shortcut && (!shortcut.if || shortcut.if())) {
        shortcut.do()
        event.stopPropagation()
        event.preventDefault()
      }
    }
    document.addEventListener('keydown', onKeyDown)
  }

  openImporter() {
    this.loadImporter().then((importer) => {
      importer.open()
    })
  }

  openFilesImporter() {
    this.loadImporter().then((importer) => {
      importer.openFiles()
    })
  }

  async initDataLayers(datalayers) {
    datalayers = datalayers || this.properties.datalayers
    for (const spec of datalayers) {
      // `false` to not propagate syncing elements served from uMap
      const datalayer = this.createDataLayer(spec, false)
    }
    this.datalayersLoaded = true
    this.fire('datalayersloaded')
    const toLoad = []
    for (const datalayer of this.layers.tree) {
      if (datalayer.showAtLoad()) toLoad.push(() => datalayer.show())
    }
    while (toLoad.length) {
      const chunk = toLoad.splice(0, 10)
      await Promise.all(chunk.map((func) => func()))
    }

    this.dataloaded = true
    this.fire('dataloaded')
  }

  createDataLayer(spec = {}, sync = true) {
    if (!spec.properties && spec._umap_options) {
      spec.properties = spec._umap_options
    }
    if (!spec.properties && spec._storage) {
      spec.properties = spec._storage
    }
    delete spec._storage
    delete spec._umap_options

    const datalayer = new DataLayer(this, spec)
    if (spec.features) {
      datalayer.fromUmapGeoJSON(spec)
    }

    if (sync !== false) {
      datalayer.journal.upsert({
        id: datalayer.id,
        rank: datalayer.rank,
        parent: datalayer.parentId,
        properties: datalayer.properties,
      })
    }
    for (const childSpec of spec.layers || []) {
      childSpec.parent = datalayer.id
      this.createDataLayer(childSpec, sync)
    }

    return datalayer
  }

  newDataLayer() {
    const datalayer = this.createDataLayer()
    datalayer.edit()
  }

  newGroup() {
    const group = this.createDataLayer({ properties: { group: true } })
    group.edit()
  }

  reindexDataLayers() {
    this.layers.tree.map((datalayer) => datalayer.reindex())
    this.fire('datalayer:changed')
  }

  onceDatalayersLoaded(callback) {
    // Once datalayers **metadata** have been loaded
    if (this.datalayersLoaded) {
      callback()
    } else {
      this.once('datalayersloaded', callback)
    }
    return this
  }

  onceDataLoaded(callback) {
    // Once datalayers **data** have been loaded
    if (this.dataloaded) {
      callback()
    } else {
      this.once('dataloaded', callback)
    }
    return this
  }

  onDataLayersChanged() {
    this.browser?.update()
    this.caption?.refresh()
    this.bottomBar.redraw()
  }

  async saveAll() {
    if (!this.isDirty) return
    if (this._defaultExtent) this._setCenterAndZoom()
    const status = await this.journal.save()
    if (!status) return
    // Do a blind render for now, as we are not sure what could
    // have changed, we'll be more subtil when we'll remove the
    // save action
    this.render(['name', 'user', 'permissions'])
    // When we save only layers, we don't have the map feedback message
    this.onMapSaved(() => {
      Alert.success(translate('Map has been saved!'))
    })
    this.fire('saved')
  }

  getDisplayName() {
    return this.properties.name || translate('Untitled map')
  }

  migrateLegacyProperties(properties) {
    if (properties.miniMap) {
      properties.miniMapControl = properties.miniMap
      delete properties.miniMap
      this._migrated = true
    }
    if (migrateLegacyFilters(properties)) {
      this._migrated = true
    }
  }

  setProperties(newProperties) {
    this.migrateLegacyProperties(newProperties)
    for (const key of Object.keys(Schema.SCHEMA)) {
      if (newProperties[key] !== undefined) {
        this.properties[key] = newProperties[key]
        if (key === 'rules') this.rules.load()
        if (key === 'slideshow') this.slideshow.load()
        // TODO: sync ?
      }
    }
  }

  hasData() {
    for (const datalayer of this.layers.tree) {
      if (datalayer.hasData()) return true
    }
  }

  hasLayers() {
    return Boolean(this.layers.tree.root().count())
  }

  sortedValues(property) {
    return []
      .concat(...this.layers.tree.map((dl) => dl.sortedValues(property)))
      .filter((val, idx, arr) => arr.indexOf(val) === idx)
      .sort(Utils.naturalSort)
  }

  async editCaption() {
    if (!this.editEnabled) return
    if (this.properties.editMode !== 'advanced') return
    const container = DOMUtils.loadTemplate(`
      <div>
        <h3>
          <i class="icon icon-16 icon-info"></i>
          ${translate('Edit map details')}
        </h3>
      </div>
    `)
    const metadataFields = [
      'properties.name',
      'properties.description',
      'properties.is_template',
    ]
    const builder = new MutatingForm(this, metadataFields, {
      className: 'map-metadata',
      app: this,
    })
    container.appendChild(await builder.build())

    const tags = DOMUtils.createFieldset(container, translate('Tags'))
    const tagsFields = ['properties.tags']
    const tagsBuilder = new MutatingForm(this, tagsFields, {
      app: this,
    })
    tags.appendChild(await tagsBuilder.build())
    const credits = DOMUtils.createFieldset(container, translate('Credits'))
    const creditsFields = [
      'properties.licence',
      'properties.shortCredit',
      'properties.longCredit',
      'properties.permanentCredit',
      'properties.permanentCreditBackground',
    ]
    const creditsBuilder = new MutatingForm(this, creditsFields, { app: this })
    credits.appendChild(await creditsBuilder.build())
    this.editPanel.open({ content: container, highlight: 'caption' })
  }

  editCenter() {
    if (!this.editEnabled) return
    if (this.properties.editMode !== 'advanced') return
    const container = DOMUtils.loadTemplate(`
      <div>
        <h3><i class="icon icon-16 icon-zoom"></i>${translate('Edit map default view')}</h3>
      </div>
    `)
    const metadataFields = [
      ['properties.zoom', { handler: 'IntInput', label: translate('Default zoom') }],
      // center is a GeoJSON [lon, lat] array, so address it by index, not by key.
      [
        'properties.center.1',
        { handler: 'FloatInput', label: translate('Default latitude') },
      ],
      [
        'properties.center.0',
        { handler: 'FloatInput', label: translate('Default longitude') },
      ],
      'properties.defaultView',
    ]

    const builder = new MutatingForm(this, metadataFields, {
      className: 'map-metadata',
      app: this,
    })
    builder.build().then((form) => container.appendChild(form))
    const button = DOMUtils.loadTemplate(
      `<button type="button">${translate('Use current center and zoom')}</button>`
    )
    button.addEventListener('click', () => {
      this.setCenterAndZoom()
      builder.fetchAll()
    })
    container.appendChild(button)
    this.editPanel.open({ content: container, highlight: 'center' })
  }

  _editControls(container) {
    let UIFields = []
    for (const name of ControlManager.MOREABLE_CONTROLS) {
      UIFields.push(`properties.${name}Control`)
    }
    UIFields = UIFields.concat([
      'properties.scrollWheelZoom',
      'properties.miniMapControl',
      'properties.scaleControl',
      'properties.onLoadPanel',
      'properties.displayPopupFooter',
      'properties.captionBar',
      'properties.captionMenus',
      'properties.layerSwitcher',
    ])
    const builder = new MutatingForm(this, UIFields, { app: this })
    const controlsOptions = DOMUtils.createFieldset(
      container,
      translate('User interface options')
    )
    builder.build().then((form) => controlsOptions.appendChild(form))
  }

  _editShapeProperties(container) {
    const shapeOptions = [
      'properties.color',
      'properties.iconClass',
      'properties.iconSize',
      'properties.iconUrl',
      'properties.iconOpacity',
      'properties.opacity',
      'properties.weight',
      'properties.fill',
      'properties.fillColor',
      'properties.fillOpacity',
      'properties.smoothFactor',
      'properties.dashArray',
    ]

    const builder = new MutatingForm(this, shapeOptions, { app: this })
    const defaultShapeProperties = DOMUtils.createFieldset(
      container,
      translate('Default shape properties')
    )
    builder.build().then((form) => defaultShapeProperties.appendChild(form))
  }

  _editDefaultKeys(container) {
    const shapeOptions = [
      'properties.zoomTo',
      'properties.easing',
      'properties.labelKey',
      'properties.sortKey',
      'properties.filterKey',
      'properties.slugKey',
    ]

    const builder = new MutatingForm(this, shapeOptions, { app: this })
    const defaultShapeProperties = DOMUtils.createFieldset(
      container,
      translate('Default properties')
    )
    builder.build().then((form) => defaultShapeProperties.appendChild(form))
  }

  _editInteractionsProperties(container) {
    const popupFields = [
      'properties.popupShape',
      'properties.popupTemplate',
      'properties.popupContentTemplate',
      'properties.showLabel',
      'properties.labelDirection',
      'properties.labelInteractive',
      'properties.outlinkTarget',
    ]
    const builder = new MutatingForm(this, popupFields, { app: this })
    const popupFieldset = DOMUtils.createFieldset(
      container,
      translate('Default interaction options')
    )
    builder.build().then((form) => popupFieldset.appendChild(form))
  }

  _editTilelayer(container) {
    if (!Utils.isObject(this.properties.tilelayer)) {
      this.properties.tilelayer = {}
    }
    const tilelayerFields = [
      [
        'properties.tilelayer.name',
        { handler: 'BlurInput', placeholder: translate('display name') },
      ],
      [
        'properties.tilelayer.url_template',
        {
          handler: 'BlurInput',
          helpText: `${translate('Supported scheme')}: http://{s}.domain.com/{z}/{x}/{y}.png`,
          placeholder: 'url',
          type: 'url',
        },
      ],
      [
        'properties.tilelayer.maxZoom',
        {
          handler: 'BlurIntInput',
          placeholder: translate('max zoom'),
          min: 0,
          max: this.properties.maxZoomLimit,
        },
      ],
      [
        'properties.tilelayer.minZoom',
        {
          handler: 'BlurIntInput',
          placeholder: translate('min zoom'),
          min: 0,
          max: this.properties.maxZoomLimit,
        },
      ],
      [
        'properties.tilelayer.attribution',
        { handler: 'BlurInput', placeholder: translate('attribution') },
      ],
      [
        'properties.tilelayer.tms',
        { handler: 'Switch', label: translate('TMS format') },
      ],
    ]
    const customTilelayer = DOMUtils.createFieldset(
      container,
      translate('Custom background')
    )
    const builder = new MutatingForm(this, tilelayerFields, { app: this })
    builder.build().then((form) => customTilelayer.appendChild(form))
  }

  _editOverlay(container) {
    if (!Utils.isObject(this.properties.overlay)) {
      this.properties.overlay = {}
    }
    const overlayFields = [
      [
        'properties.overlay.url_template',
        {
          handler: 'BlurInput',
          helpText: `${translate('Supported scheme')}: http://{s}.domain.com/{z}/{x}/{y}.png`,
          placeholder: 'url',
          label: translate('Background overlay url'),
          type: 'url',
        },
      ],
      [
        'properties.overlay.maxZoom',
        {
          handler: 'BlurIntInput',
          placeholder: translate('max zoom'),
          min: 0,
          max: this.properties.maxZoomLimit,
        },
      ],
      [
        'properties.overlay.minZoom',
        {
          handler: 'BlurIntInput',
          placeholder: translate('min zoom'),
          min: 0,
          max: this.properties.maxZoomLimit,
        },
      ],
      [
        'properties.overlay.attribution',
        { handler: 'BlurInput', placeholder: translate('attribution') },
      ],
      [
        'properties.overlay.opacity',
        {
          handler: 'Range',
          min: 0,
          max: 1,
          step: 0.1,
          label: translate('Opacity'),
          // Without this, the field name ("opacity") collides with the
          // inheritable SCHEMA.opacity, so the initial value is read from
          // app.getOption('opacity') instead of properties.overlay.opacity.
          // TODO: remove me when schema is per-model instead of one global.
          inheritable: false,
        },
      ],
      ['properties.overlay.tms', { handler: 'Switch', label: translate('TMS format') }],
    ]
    const overlay = DOMUtils.createFieldset(container, translate('Custom overlay'))
    const builder = new MutatingForm(this, overlayFields, { app: this })
    builder.build().then((form) => overlay.appendChild(form))
  }

  _editBounds(container) {
    if (!Utils.isObject(this.properties.limitBounds)) {
      this.properties.limitBounds = {}
    }
    const limitBounds = DOMUtils.createFieldset(container, translate('Limit bounds'))
    const boundsFields = [
      [
        'properties.limitBounds.south',
        { handler: 'BlurFloatInput', placeholder: translate('max South') },
      ],
      [
        'properties.limitBounds.west',
        { handler: 'BlurFloatInput', placeholder: translate('max West') },
      ],
      [
        'properties.limitBounds.north',
        { handler: 'BlurFloatInput', placeholder: translate('max North') },
      ],
      [
        'properties.limitBounds.east',
        { handler: 'BlurFloatInput', placeholder: translate('max East') },
      ],
    ]
    const boundsBuilder = new MutatingForm(this, boundsFields, { app: this })
    boundsBuilder.build().then((form) => limitBounds.appendChild(form))
    const [boundsButtons, { current, empty }] = DOMUtils.loadTemplateWithRefs(`
      <div class="button-bar half">
        <button type="button" data-ref="current">${translate('Use current bounds')}</button>
        <button type="button" class="flat" data-ref="empty">${translate('Empty')}</button>
      </div>
    `)
    limitBounds.appendChild(boundsButtons)
    current.addEventListener('click', () => {
      const [west, south, east, north] = this.mapProxy.bounds
      const oldLimitBounds = { ...this.properties.limitBounds }
      this.properties.limitBounds.south = south.toFixed(6)
      this.properties.limitBounds.west = west.toFixed(6)
      this.properties.limitBounds.north = north.toFixed(6)
      this.properties.limitBounds.east = east.toFixed(6)
      boundsBuilder.fetchAll()
      this.journal.update(
        'properties.limitBounds',
        this.properties.limitBounds,
        oldLimitBounds
      )
      this.mapProxy.handleLimitBounds()
    })
    empty.addEventListener('click', () => {
      const oldLimitBounds = { ...this.properties.limitBounds }
      this.properties.limitBounds.south = null
      this.properties.limitBounds.west = null
      this.properties.limitBounds.north = null
      this.properties.limitBounds.east = null
      boundsBuilder.fetchAll()
      this.mapProxy.handleLimitBounds()
      this.journal.update(
        'properties.limitBounds',
        this.properties.limitBounds,
        oldLimitBounds
      )
    })
  }

  _editSlideshow(container) {
    const slideshow = DOMUtils.createFieldset(container, translate('Slideshow'))
    const slideshowFields = [
      [
        'properties.slideshow.active',
        { handler: 'Switch', label: translate('Activate slideshow mode') },
      ],
      [
        'properties.slideshow.delay',
        {
          handler: 'SlideshowDelay',
          helpText: translate('Delay between two transitions when in play mode'),
        },
      ],
      [
        'properties.slideshow.easing',
        {
          handler: 'Switch',
          label: translate('Animated transitions'),
          inheritable: true,
        },
      ],
      [
        'properties.slideshow.autoplay',
        { handler: 'Switch', label: translate('Autostart when map is loaded') },
      ],
    ]
    const slideshowBuilder = new MutatingForm(this, slideshowFields, {
      app: this,
    })
    slideshowBuilder.build().then((form) => slideshow.appendChild(form))
  }

  _editSync(container) {
    const sync = DOMUtils.createFieldset(
      container,
      translate('Real-time collaboration')
    )
    const builder = new MutatingForm(this, ['properties.syncEnabled'], {
      app: this,
    })
    builder.build().then((form) => sync.appendChild(form))
  }

  _advancedActions(container) {
    const advancedActions = DOMUtils.createFieldset(
      container,
      translate('Advanced actions')
    )
    const tpl = `
    <div class="button-bar half">
        <button class="button" type="button" data-ref=del hidden>
          <i class="icon icon-24 icon-delete"></i>${translate('Delete')}
        </button>
        <button class="button" type="button" data-ref=clear hidden>
          <i class="icon icon-24 icon-empty"></i>${translate('Clear data')}
        </button>
        <button class="button" type="button" data-ref=empty hidden>
          <i class="icon icon-24 icon-empty"></i>${translate('Remove layers')}
        </button>
        <button class="button" type="button" data-ref=clone>
          <i class="icon icon-24 icon-clone"></i>${translate('Clone this map')}
        </button>
        <button class="button" type="button" data-ref=download>
          <i class="icon icon-24 icon-download"></i>${translate('Open share & download panel')}
        </button>
    </div>
    `
    const [bar, { del, clear, empty, clone, download }] =
      DOMUtils.loadTemplateWithRefs(tpl)
    advancedActions.appendChild(bar)
    if (this.permissions.isOwner()) {
      del.hidden = false
      del.addEventListener('click', () => this.del())
      clear.hidden = false
      clear.addEventListener('click', () => this.emptyDataLayers())
      empty.hidden = false
      empty.addEventListener('click', () => this.removeDataLayers())
    }
    clone.addEventListener('click', () => this.clone())
    download.addEventListener('click', () =>
      this.loadShare().then((share) => share.open())
    )
  }

  edit() {
    if (!this.editEnabled) return
    if (this.properties.editMode !== 'advanced') return
    const container = DOMUtils.loadTemplate(`
      <div>
        <h3><i class="icon icon-16 icon-settings"></i>${translate('Map advanced properties')}</h3>
      </div>
    `)
    this._editControls(container)
    this._editShapeProperties(container)
    this._editDefaultKeys(container)
    this.fields.edit(container)
    this._editInteractionsProperties(container)
    this.rules.edit(container)
    this._editTilelayer(container)
    this._editOverlay(container)
    this._editBounds(container)
    this._editSlideshow(container)
    if (this.properties.websocketEnabled && this.id) {
      this._editSync(container)
    }
    this._advancedActions(container)

    return this.editPanel.open({
      content: container,
      className: 'dark',
      highlight: 'settings',
    })
  }

  onAnonymousSave(editUrl) {
    AlertCreation.info(
      this,
      translate('Hey, you created a map without an account!'),
      Number.Infinity,
      editUrl,
      this.properties.urls.map_send_edit_link ? this.sendEditLinkEmail.bind(this) : null
    )
  }

  onMapSaved(callback) {
    // The saved message is different according to some situations:
    // - is the user logged in or not ?
    // - is it a new map or an existing map ?
    // This is usually managed on the uMap.save method.
    // But when updating a map while uMap itself is not dirty
    // there is a fallback message (in saveAll), but at this stage
    // we are not able to know if the map has been saved before and
    // thus if there is yet a "saved message" ready to be displayed.
    if (this._saveMessageSemaphore) return
    this._saveMessageSemaphore = true
    this.once('saved', () => {
      callback()
      this._saveMessageSemaphore = undefined
    })
  }

  async save() {
    const geojson = {
      type: 'Feature',
      geometry: this.geometry(),
      properties: this.exportProperties(),
    }
    const formData = new FormData()
    formData.append('name', this.properties.name)
    formData.append('is_template', Boolean(this.properties.is_template))
    formData.append('center', JSON.stringify(this.geometry()))
    formData.append('tags', this.properties.tags || [])
    formData.append('settings', JSON.stringify(geojson))
    const uri = this.urls.get('map_save', { map_id: this.id })
    const [data, _, error] = await this.server.post(uri, {}, formData)
    // FIXME: login_required response will not be an error, so it will not
    // stop code while it should
    if (error) {
      return
    }
    // TODO: map.save may not always be the first call during save process
    // since SAVEMANAGER refactor
    if (data.login_required) {
      this.askForLogin().then(() => this.saveAll())
      return
    }
    this.properties.user = data.user
    if (!this.id) {
      this.properties.id = data.id
      this.permissions.setProperties(data.permissions)
      this.permissions.commit()
      const anonymousEditUrl = data.permissions?.anonymous_edit_url
      if (anonymousEditUrl) {
        this.onMapSaved(() => this.onAnonymousSave(anonymousEditUrl))
      } else {
        this.onMapSaved(() => {
          Alert.success(translate('Congratulations, your map has been created!'))
        })
      }
    } else {
      this.permissions.setProperties(data.permissions)
      this.permissions.commit()
      this.onMapSaved(() => {
        Alert.success(data.info || translate('Map has been saved!'))
      })
    }
    // Update URL in case the name has changed.
    if (history?.pushState) {
      history.pushState({}, this.properties.name, data.url)
    } else {
      window.location = data.url
    }
    return true
  }

  askForLogin() {
    const promise = new Promise((resolve) => {
      const bc = new BroadcastChannel('auth')
      bc.onmessage = (event) => {
        if (event.data === 'auth:ok') {
          bc.postMessage('auth:close')
          const url = this.urls.get('whoami', { map_id: this.id })
          this.server.get(url).then(([data]) => {
            this.properties.user = data.user
            if (!this.id) {
              this.properties.permissions.owner = { ...data.user }
            }
            this.permissions.pull()
            this.render(['user', 'properties.permissions'])
            resolve()
          })
        }
      }
    })
    window.open(this.urls.get('login'))
    return promise
  }

  exportProperties() {
    const properties = {}
    for (const key of Object.keys(Schema.SCHEMA)) {
      if (this.properties[key] !== undefined) {
        properties[key] = this.properties[key]
      }
    }
    return properties
  }

  renameField(oldName, newName) {
    for (const datalayer of this.layers.tree) {
      datalayer.renameFeaturesField(oldName, newName)
    }
  }

  deleteField(name) {
    for (const datalayer of this.layers.tree) {
      datalayer.deleteFeaturesField(name)
    }
  }

  geometry() {
    /* Return a GeoJSON geometry Object */
    return {
      type: 'Point',
      coordinates: this.properties.center,
    }
  }

  async enableEdit() {
    document.body.classList.add('umap-edit-enabled')
    await this.initJournal()
    this.editEnabled = true
    this.drop.enable()
    this.fire('edit:enabled')
    this.editBar.redraw()
    this.topBar.redraw()
    this.checkForLegacy()
    this.checkForAnonymous()
    await this.mapProxy.enableEdit()
  }

  checkForAnonymous() {
    if (
      this.permissions.isAnonymousMap() &&
      this.permissions.isOwner() &&
      this.permissions.userIsAuth()
    ) {
      this.dialog
        .confirm(
          translate('This map is anonymous, do you want to attach it to your account?')
        )
        .then(() => {
          this.permissions.attach()
        })
    }
  }

  checkForLegacy() {
    let needSaveAlert = false
    if (this._migrated) {
      needSaveAlert = true
      delete this._migrated
      // Force user to save
      this.journal.update('properties.name', this.properties.name, this.properties.name)
    }
    for (const datalayer of this.layers.tree) {
      if (!datalayer.isReadOnly() && datalayer._migrated) {
        datalayer._migrated = false
        // Force user to resave those datalayers
        datalayer.journal.update(
          'properties.name',
          datalayer.properties.name,
          datalayer.properties.name
        )
        needSaveAlert = true
      }
    }
    if (needSaveAlert) {
      Alert.warning(
        translate('The map has been upgraded to latest version, please save it.')
      )
    }
  }

  disableEdit() {
    if (this.isDirty) return
    this.drop.disable()
    document.body.classList.remove('umap-edit-enabled')
    this.editedFeature = null
    this.editEnabled = false
    this.fire('edit:disabled')
    this.editPanel.close()
    this.fullPanel.close()
    this.journal.stop()
    this.mapProxy.disableEdit?.()
  }

  async initJournal() {
    if (!this.journal) {
      const { Journal } = await import('./journal/engine.js')
      this.journalEngine = new Journal(this)
      this.journal = this.journalEngine.proxy(this)
    }

    // this.properties.websocketEnabled is set by the server admin
    if (this.properties.websocketEnabled === false) return
    // this.properties.syncEnabled is set by the user in the map settings
    if (this.properties.syncEnabled !== true) {
      this.journal.stop()
    } else {
      await this.journal.authenticate()
    }
  }

  getJournalMetadata() {
    return {
      subject: 'map',
    }
  }

  render(fields = []) {
    // Propagate will remove the fields it has already
    // processed
    fields = this.propagate(fields)
    if (fields.includes('properties.filters')) {
      this.filters.load()
    }

    const impacts = Schema.getImpacts(fields)
    for (const impact of impacts) {
      switch (impact) {
        case 'ui':
          this.controlManager.update()
          this.mapProxy.updateUI()
          this.browser?.redraw()
          this.topBar.redraw()
          this.bottomBar.redraw()
          break
        case 'data':
          if (fields.includes('properties.rules')) {
            this.rules.load()
          }
          this.layers.tree.visible().map((datalayer) => {
            datalayer.redraw()
          })
          break
        case 'datalayer-index':
          this.reindexDataLayers()
          break
        case 'datalayer-rank':
          // When drag'n'dropping datalayers,
          // this get called once per datalayers.
          // (and same for undo/redo of the action)
          // TODO: call only once
          this.reorderLayers()
          break
        case 'background':
          this.mapProxy.tilelayers.init(this.properties.tilelayers)
          this.mapProxy.tilelayers.selectDefault()
          break
        case 'bounds':
          this.mapProxy.handleLimitBounds()
          break
        case 'sync':
          this.initJournal()
      }
    }
  }

  // This method does a targeted update of the UI,
  // it would be merged with `render`` method and the
  // SCHEMA at some point
  propagate(fields = []) {
    const impacts = {
      'properties.name': () => {
        Utils.eachElement('.map-name', (el) => {
          el.textContent = this.getDisplayName()
        })
      },
      user: () => {
        Utils.eachElement('.umap-user .username', (el) => {
          if (this.permissions.userIsAuth()) {
            el.textContent = this.properties.user.name
          }
        })
      },
      'properties.permissions': () => {
        const status = this.permissions.getShareStatusDisplay()
        if (status) {
          Utils.eachElement('.share-status', (el) => {
            el.textContent = translate('Visibility: {status}', {
              status: status,
            })
          })
        }
        this.topBar.redraw()
      },
      'properties.slideshow.active': () => {
        this.slideshow.load()
        this.bottomBar.redraw()
      },
      numberOfConnectedPeers: () => {
        Utils.eachElement('.connected-peers span', (el) => {
          if (this.journal?.websocketConnected) {
            el.textContent = Object.keys(this.journal.getPeers()).length
          } else {
            el.textContent = translate('Disconnected')
          }
          el.parentElement.classList.toggle('off', !this.journal?.websocketConnected)
        })
      },
      'properties.starred': () => {
        Utils.eachElement('.map-star', (el) => {
          el.classList.toggle('icon-starred', this.properties.starred)
          el.classList.toggle('icon-star', !this.properties.starred)
        })
        Utils.eachElement('.map-stars', (el) => {
          el.textContent = this.properties.stars || 0
        })
      },
    }
    for (const [field, impact] of Object.entries(impacts)) {
      if (!fields.length || fields.includes(field)) {
        impact()
        fields = fields.filter((item) => item !== field)
      }
    }
    return fields
  }

  // TODO: allow to control the default datalayer
  // (edit and viewing)
  // cf https://github.com/umap-project/umap/issues/585
  defaultEditDataLayer() {
    let layer = this.lastUsedDataLayer
    if (layer && layer.allowFeatures() && layer.isVisible()) {
      return layer
    }
    layer = this.layers.tree
      .visible()
      .filter((layer) => layer.allowFeatures())
      .first()
    if (layer) return layer
    layer = this.layers.tree.filter((layer) => layer.allowFeatures()).first()
    if (layer) {
      // No layer visible, let's force one
      layer.show()
      return layer
    }
    return this.createDataLayer()
  }

  eachFeature(callback) {
    this.layers.tree.browsable().map((datalayer) => {
      if (datalayer.isVisible()) datalayer.features.forEach(callback)
    })
  }

  removeDataLayers() {
    this.layers.tree.map((datalayer) => {
      datalayer.del()
    })
  }

  emptyDataLayers() {
    this.layers.tree.map((datalayer) => {
      datalayer.empty()
    })
  }

  async editDatalayers() {
    if (!this.editEnabled) return
    const onReorder = async (moved, target, dragMode) => {
      // TODO: ask target parent to do the reorder
      const movedLayer = this.layers.tree.get(moved.dataset.id)
      const targetLayer = this.layers.tree.get(target.dataset.id)
      this.journal.startBatch()
      const oldParentId = movedLayer.parent?.id
      // Set the parent before adding child, so the rank will be
      // computed correctly
      // We do not call parent setter, as it will issue a layers.add
      // which we want to control here (before/after/middle).
      const setParent = (parent) => {
        movedLayer._parent = parent
        movedLayer.journal.update('parentId', parent?.id, oldParentId)
      }
      if (dragMode === 'above') {
        const parent = targetLayer.parent || this
        parent.layers.addAfter(movedLayer, targetLayer)
        setParent(targetLayer.parent)
      } else if (dragMode === 'below') {
        const parent = targetLayer.parent || this
        parent.layers.addBefore(movedLayer, targetLayer)
        setParent(targetLayer.parent)
      } else if (dragMode === 'middle') {
        const parent = targetLayer
        parent.layers.add(movedLayer)
        setParent(targetLayer)
      }
      this.journal.commitBatch()
      this.reorderLayers()
      this.fire('datalayer:changed')
    }

    const template = `
      <div>
        <h3><i class="icon icon-16 icon-layers"></i>${translate('Manage layers')}</h3>
        <ul data-ref=ul></ul>
      </div>
    `
    const [container, { ul }] = Utils.loadTemplateWithRefs(template)
    const showLayer = async (layer, container) => {
      const nochildren =
        !layer.isLoaded() || layer.features.count() || layer.isRemoteLayer()
          ? ' no-children'
          : ''
      const [li, { body, toolbox, formbox, icon }] = Utils.loadTemplateWithRefs(`
          <li class="orderable${nochildren}">
            <details open data-ondelete data-id="${layer.id}">
              <summary class="with-toolbox" data-ontoggle data-id="${layer.id}">
                <span>
                  <i class="icon icon-16" data-ref="icon"></i>
                  <span data-ref=formbox class="datalayer-editable-title truncate"></span>
                </span>
                <span data-ref=toolbox class="toolbox"></span>
              </summary>
              <ul data-ref="body" class="orderable-container"></ul>
            </details>
          </li>
        `)
      if (layer.group) {
        icon.classList.add('icon-folder')
      } else if (layer.isRemoteLayer()) {
        icon.classList.add('icon-remote')
      } else {
        icon.classList.add('icon-layer')
      }
      layer.renderToolbox(toolbox)
      toolbox.appendChild(
        Utils.loadTemplate(
          `<i class="icon icon-16 icon-drag" title="${translate('Drag to reorder')}"></i>`
        )
      )
      const builder = new MutatingForm(
        layer,
        [['properties.name', { handler: 'EditableText' }]],
        { className: 'umap-form-inline' }
      )
      const form = await builder.build()
      formbox.appendChild(form)
      li.dataset.id = layer.id
      container.appendChild(li)
      for (const child of layer.layers.tree.root()) {
        await showLayer(child, body)
      }
    }
    const layers = this.layers.tree.root()
    for (const layer of layers) {
      await showLayer(layer, ul)
    }
    const { default: Orderable } = await import('./orderable.js')

    new Orderable(ul, onReorder, { allowTree: true })

    const [bar, { addLayer, addGroup }] = DOMUtils.loadTemplateWithRefs(`
      <div class="button-bar half">
        <button type="button" class="block add-datalayer" data-ref="addLayer">${translate('Add a layer')}</button>
        <button type="button" class="block add-group flat" data-ref="addGroup">${translate('Add a group')}</button>
      </div>
    `)
    addLayer.addEventListener('click', () => this.newDataLayer())
    addGroup.addEventListener('click', () => this.newGroup())
    container.appendChild(bar)

    this.editPanel.open({ content: container, highlight: 'layers' })
  }

  reorderLayers() {
    this.mapProxy.reorderLayers()
    for (const layer of this.layers.tree) {
      layer.redraw()
    }
  }

  openBrowser(mode) {
    this.onceDatalayersLoaded(() =>
      this.loadBrowser().then((browser) => browser.open(mode))
    )
  }

  panelBackButton() {
    const button = Utils.loadTemplate(
      `<button class="icon icon-16 icon-back" title="${translate('Back to browser')}"></button>`
    )
    // HOTFIX. Remove when this is released:
    // https://github.com/Leaflet/Leaflet/pull/9052
    DOMUtils.disableClickPropagation(button)
    button.addEventListener('click', () => this.openBrowser())
    return button
  }

  openCaption() {
    this.onceDatalayersLoaded(() =>
      this.loadCaption().then((caption) => caption.open())
    )
  }

  addAuthorLink(container) {
    const author = this.properties.author
    if (author?.name) {
      const el = Utils.loadTemplate(
        Utils.sanitizeVars`<span class="umap-map-author"> ${translate('by')} <a href="${author.url}">${author.name}</a></span>`
      )
      container.appendChild(el)
    }
  }

  async star() {
    if (!this.id) {
      return Alert.error(translate('Please save the map first'))
    }
    const url = this.urls.get('map_star', { map_id: this.id })
    const [data, response, error] = await this.server.post(url)
    if (error) {
      return
    }
    this.properties.starred = data.starred
    this.properties.stars = data.stars
    Alert.success(
      data.starred
        ? translate('Map has been starred')
        : translate('Map has been unstarred')
    )
    this.render(['properties.starred'])
  }

  processFileToImport(file, layer, type) {
    type = type || Utils.detectFileType(file)
    if (!type) {
      Alert.error(
        translate('Unable to detect format of file {filename}', {
          filename: file.name,
        })
      )
      return
    }
    if (type === 'umap') {
      this.importUmapFile(file, 'umap')
    } else {
      if (!layer) {
        const properties = { name: file.name }
        layer = this.createDataLayer({ properties })
      }
      layer.importFromFile(file, type)
    }
  }

  async importFromUrl(uri) {
    const response = await this.request.get(uri)
    if (response?.ok) {
      this.importRaw(await response.text())
    }
  }

  importRaw(rawData) {
    const importedData = JSON.parse(rawData)
    let remoteOrigin = ''
    if (importedData.uri) {
      const uri = new URL(importedData.uri)
      if (uri.origin !== window.location.origin) {
        remoteOrigin = uri.origin
      }
    }
    if (importedData.properties?.iconUrl?.startsWith('/')) {
      importedData.properties.iconUrl = remoteOrigin + importedData.properties.iconUrl
    }
    this.setProperties(importedData.properties)

    if (importedData.geometry) {
      this.properties.center = importedData.geometry.coordinates
    }
    for (const spec of importedData.layers) {
      // Never trust an id at this stage
      delete spec?.id
      delete spec.properties?.id
      if (spec.properties?.iconUrl?.startsWith('/')) {
        spec.properties.iconUrl = remoteOrigin + spec.properties.iconUrl
      }
      const datalayer = this.createDataLayer(spec)
    }

    // For now render->propagate expect a `properties.` prefix.
    // Remove this when we have refactored schema and render.
    const fields = Object.keys(importedData.properties).map(
      (field) => `properties.${field}`
    )
    this.fields.pull()
    this.filters.load()
    this.render(fields)
    this.mapProxy.setDefaultCenter()
  }

  importUmapFile(file) {
    const reader = new FileReader()
    reader.readAsText(file)
    reader.onload = (e) => {
      const rawData = e.target.result
      try {
        this.importRaw(rawData)
      } catch (e) {
        console.error('Error importing data', e)
        Alert.error(
          translate('Invalid umap data in {filename}', { filename: file.name })
        )
      }
    }
  }

  async del() {
    this.dialog
      .confirm(translate('Are you sure you want to delete this map?'))
      .then(async () => {
        const url = this.urls.get('map_delete', { map_id: this.id })
        const [data, response, error] = await this.server.post(url)
        if (data.redirect) window.location = data.redirect
      })
  }

  async clone() {
    this.dialog
      .confirm(
        translate('Are you sure you want to clone this map and all its datalayers?')
      )
      .then(async () => {
        const url = this.urls.get('map_clone', { map_id: this.id })
        const [data, response, error] = await this.server.post(url)
        if (data.redirect) window.location = data.redirect
      })
  }

  async sendEditLinkEmail(formData) {
    const sendLink =
      this.properties.urls.map_send_edit_link &&
      this.urls.get('map_send_edit_link', {
        map_id: this.id,
      })
    await this.server.post(sendLink, {}, formData)
  }

  fitDataBounds() {
    const allBounds = this.layers.tree
      .browsable()
      .visible()
      .map((d) => d.bounds)
    let bounds = null
    for (const b of allBounds) bounds = GeoUtils.unionBbox(bounds, b)
    if (!this.hasData() || !GeoUtils.isValidBbox(bounds)) return false
    this.fire('map:view:fit-bounds', { bounds })
  }

  proxyUrl(url, ttl) {
    if (this.properties.urls.ajax_proxy) {
      url = Utils.greedyTemplate(this.properties.urls.ajax_proxy, {
        url: encodeURIComponent(url),
        ttl: ttl,
      })
    }
    return url
  }

  openExternalRouting({ lat, lng }) {
    const url = this.urls.get('routing', {
      lat,
      lng,
      locale: getLocale(),
      zoom: this.mapProxy.zoom,
    })
    if (url) window.open(url)
  }

  editInOSM({ lat, lng }) {
    const url = this.urls.get('edit_in_osm', {
      lat,
      lng,
      zoom: Math.max(this.mapProxy.zoom, 16),
    })
    if (url) window.open(url)
  }

  openInOSM({ lat, lng }) {
    window.open(`https://www.openstreetmap.org/query?lat=${lat}&lon=${lng}`)
  }

  async askForIsochrone({ lat, lng }) {
    if (!this.properties.ORSAPIKey) return
    await this.loadImporter()
    const { Importer } = await import('./importers/openrouteservice.js')
    new Importer(this).isochrone({ lat, lng })
  }

  setCenterAndZoom() {
    this._setCenterAndZoom(true)
    Alert.success(translate('The zoom and center have been modified.'))
  }

  _setCenterAndZoom(manual) {
    const oldCenter = { ...this.properties.center }
    const oldZoom = this.properties.zoom
    this.properties.center = this.mapProxy.center
    this.properties.zoom = this.mapProxy.zoom
    this._defaultExtent = false
    if (manual) {
      this.journal.startBatch()
      this.journal.update('properties.center', this.properties.center, oldCenter)
      this.journal.update('properties.zoom', this.properties.zoom, oldZoom)
      this.journal.commitBatch()
    }
  }

  getStaticPathFor(name) {
    return Schema.SCHEMA.iconUrl.default.replace('marker.svg', name)
  }

  undo() {
    this.journal._undoManager.undo()
  }

  redo() {
    this.journal._undoManager.redo()
  }

  async screenshot() {
    const { snapdom, preCache } = await import('../../vendors/snapdom/snapdom.min.mjs')
    const el = document.querySelector('#map')
    await preCache(el)
    const result = await snapdom(el, {
      scale: 1,
      type: 'jpg',
      fast: false,
      exclude: [
        '.leaflet-control',
        '.umap-loader',
        '.panel',
        '.umap-caption-bar',
        '.umap-main-edit-toolbox',
        '.umap-edit-bar',
      ],
    })
    return result
  }

  async openPrinter(action) {
    if (!this._printer) {
      const Printer = (await import('./printer.js')).default
      this._printer = new Printer(this)
    }
    this._printer.open(action)
  }
}
