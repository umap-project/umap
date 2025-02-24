import {
  DomUtil,
  Util as LeafletUtil,
  stamp,
  latLngBounds,
} from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate, setLocale, getLocale } from './i18n.js'
import * as Utils from './utils.js'
import { ServerStored } from './saving.js'
import * as SAVEMANAGER from './saving.js'
import { SyncEngine } from './sync/engine.js'
import { LeafletMap } from './rendering/map.js'
import URLs from './urls.js'
import { Panel, EditPanel, FullPanel } from './ui/panel.js'
import Dialog from './ui/dialog.js'
import { BottomBar, TopBar, EditBar } from './ui/bar.js'
import Tooltip from './ui/tooltip.js'
import ContextMenu from './ui/contextmenu.js'
import { Request, ServerRequest } from './request.js'
import Help from './help.js'
import { Formatter } from './formatter.js'
import Slideshow from './slideshow.js'
import { MapPermissions } from './permissions.js'
import { SCHEMA } from './schema.js'
import { DataLayer } from './data/layer.js'
import Facets from './facets.js'
import Browser from './browser.js'
import Caption from './caption.js'
import Importer from './importer.js'
import Rules from './rules.js'
import Share from './share.js'
import {
  uMapAlertCreation as AlertCreation,
  uMapAlert as Alert,
} from '../components/alerts/alert.js'
import Orderable from './orderable.js'
import { MutatingForm } from './form/builder.js'

export default class Umap extends ServerStored {
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
    const center = geojson.geometry
    this.properties.zoomControl = false
    this.properties.fullscreenControl = false

    this._leafletMap = new LeafletMap(this, element)

    this.properties.zoomControl = zoomControl !== undefined ? zoomControl : true
    this.properties.fullscreenControl =
      fullscreenControl !== undefined ? fullscreenControl : true

    if (center) {
      this._leafletMap.options.center = this.properties.center =
        this._leafletMap.latLng(center)
    }

    // Needed to render controls
    this.permissions = new MapPermissions(this)
    this.urls = new URLs(this.properties.urls)
    this.slideshow = new Slideshow(this, this._leafletMap)

    this._leafletMap.setup()

    if (geojson.properties.schema) this.overrideSchema(geojson.properties.schema)

    this.panel = new Panel(this, this._leafletMap)
    this.dialog = new Dialog({ className: 'dark' })
    this.topBar = new TopBar(this, this._leafletMap._controlContainer)
    this.bottomBar = new BottomBar(
      this,
      this.slideshow,
      this._leafletMap._controlContainer
    )
    this.editBar = new EditBar(
      this,
      this._leafletMap,
      this._leafletMap._controlContainer
    )
    this.tooltip = new Tooltip(this._leafletMap._controlContainer)
    this.contextmenu = new ContextMenu()
    this.editContextmenu = new ContextMenu({ className: 'dark', orientation: 'rows' })
    this.server = new ServerRequest()
    this.request = new Request()
    this.facets = new Facets(this)
    this.browser = new Browser(this, this._leafletMap)
    this.caption = new Caption(this, this._leafletMap)
    this.importer = new Importer(this)
    this.share = new Share(this)
    this.rules = new Rules(this)

    this.syncEngine = new SyncEngine(this)
    this.sync = this.syncEngine.proxy(this)

    if (this.hasEditMode()) {
      this.editPanel = new EditPanel(this, this._leafletMap)
      this.fullPanel = new FullPanel(this, this._leafletMap)
      this._leafletMap.initEditTools()
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
    if (this.properties.advancedFilterKey) {
      this.properties.facetKey = this.properties.advancedFilterKey
      delete this.properties.advancedFilterKey
    }

    // Global storage for retrieving datalayers and features.
    this.datalayers = {} // All datalayers, including deleted.
    this.datalayersIndex = [] // Datalayers actually on the map and ordered.
    this.featuresIndex = {}

    this.formatter = new Formatter(this)

    this.initDataLayers()

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
        this.isDirty = true
        this.enableEdit()
      }
      this._defaultExtent = true
      this.properties.name = translate('Untitled map')
      await this.loadDataFromQueryString()
    }

    if (!this.properties.noControl) {
      this.initShortcuts()
      this._leafletMap.on('contextmenu', (e) => this.onContextMenu(e))
      this.onceDataLoaded(this.setViewFromQueryString)
      this.bottomBar.setup()
      this.propagate()
    }

    window.onbeforeunload = () => (this.editEnabled && SAVEMANAGER.isDirty) || null
    this.backup()
  }

  get editedFeature() {
    return this._editedFeature
  }

  set editedFeature(feature) {
    if (this._editedFeature && this._editedFeature !== feature) {
      this._editedFeature.endEdit()
    }
    this._editedFeature = feature
    this.fire('seteditedfeature')
  }

  get activeFeature() {
    return this._activeFeature
  }

  set activeFeature(feature) {
    this._activeFeature = feature
  }

  setPropertiesFromQueryString() {
    const asBoolean = (key) => {
      const value = this.searchParams.get(key)
      if (value !== undefined && value !== null) {
        this.properties[key] = value === '1' || value === 'true'
      }
    }
    const asNullableBoolean = (key) => {
      if (this.searchParams.has(key)) {
        let value = this.searchParams.get(key)
        if (value === 'null') value = null
        else if (value === '0' || value === 'false') value = false
        else value = true
        this.properties[key] = value
      }
    }
    const asNumber = (key) => {
      const value = +this.searchParams.get(key)
      if (!Number.isNaN(value)) this.properties[name] = value
    }
    // FIXME retrocompat
    asBoolean('displayDataBrowserOnLoad')
    asBoolean('displayCaptionOnLoad')
    for (const [key, schema] of Object.entries(SCHEMA)) {
      switch (schema.type) {
        case Boolean:
          if (schema.nullable) asNullableBoolean(key)
          else asBoolean(key)
          break
        case Number:
          asNumber(key)
          break
        case String: {
          if (this.searchParams.has(key)) {
            const value = this.searchParams.get(key)
            if (value !== undefined) this.properties[key] = value
            break
          }
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
    // TODO: move to a "initPanel" function
    if (this.searchParams.has('share')) {
      this.share.open()
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
    // Comes after default panels, so if it opens in a panel it will
    // take precedence.
    const slug = this.searchParams.get('feature')
    if (slug && this.featuresIndex[slug]) this.featuresIndex[slug].view()
    if (this.searchParams.has('edit')) {
      if (this.hasEditMode()) this.enableEdit()
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

  async loadDataFromQueryString() {
    let data = this.searchParams.get('data')
    const dataUrls = this.searchParams.getAll('dataUrl')
    const dataFormat = this.searchParams.get('dataFormat') || 'geojson'
    if (dataUrls.length) {
      for (let dataUrl of dataUrls) {
        dataUrl = decodeURIComponent(dataUrl)
        dataUrl = this.renderUrl(dataUrl)
        dataUrl = this.proxyUrl(dataUrl)
        const datalayer = this.createDirtyDataLayer()
        await datalayer
          .importFromUrl(dataUrl, dataFormat)
          .then(() => datalayer.zoomTo())
      }
    } else if (data) {
      data = decodeURIComponent(data)
      const datalayer = this.createDirtyDataLayer()
      await datalayer.importRaw(data, dataFormat).then(() => datalayer.zoomTo())
    }
  }

  getOwnContextMenuItems(event) {
    const items = []
    if (this.hasEditMode()) {
      if (this.editEnabled) {
        if (!SAVEMANAGER.isDirty) {
          items.push({
            label: this.help.displayLabel('STOP_EDIT'),
            action: () => this.disableEdit(),
          })
        }
        if (this.properties.enableMarkerDraw) {
          items.push({
            label: this.help.displayLabel('DRAW_MARKER'),
            action: () => this._leafletMap.editTools.startMarker(),
          })
        }
        if (this.properties.enablePolylineDraw) {
          items.push({
            label: this.help.displayLabel('DRAW_POLYGON'),
            action: () => this._leafletMap.editTools.startPolygon(),
          })
        }
        if (this.properties.enablePolygonDraw) {
          items.push({
            label: this.help.displayLabel('DRAW_LINE'),
            action: () => this._leafletMap.editTools.startPolyline(),
          })
        }
        items.push('-')
        items.push({
          label: translate('Help'),
          action: () => this.help.show('edit'),
        })
      } else {
        items.push({
          label: this.help.displayLabel('TOGGLE_EDIT'),
          action: () => this.enableEdit(),
        })
      }
    }
    if (items.length) {
      items.push('-')
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
    if (this.properties.facetKey) {
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

  getSharedContextMenuItems(event) {
    const items = []
    if (this.properties.urls.routing) {
      items.push('-', {
        label: translate('Directions from here'),
        action: () => this.openExternalRouting(event),
      })
    }
    if (this.properties.urls.edit_in_osm) {
      items.push('-', {
        label: translate('Edit in OpenStreetMap'),
        action: () => this.editInOSM(event),
      })
    }
    return items
  }

  onContextMenu(event) {
    const items = this.getOwnContextMenuItems(event).concat(
      this.getSharedContextMenuItems(event)
    )
    this.contextmenu.open(event.originalEvent, items)
  }

  // Merge the given schema with the default one
  // Missing keys inside the schema are merged with the default ones.
  overrideSchema(schema) {
    for (const [key, extra] of Object.entries(schema)) {
      SCHEMA[key] = Object.assign({}, SCHEMA[key], extra)
    }
  }

  search() {
    if (this._leafletMap._controls.search) this._leafletMap._controls.search.open()
  }

  hasEditMode() {
    const editMode = this.properties.editMode
    return editMode === 'simple' || editMode === 'advanced'
  }

  getProperty(key, feature) {
    if (feature) {
      const value = this.rules.getOption(key, feature)
      if (value !== undefined) return value
    }
    if (Utils.usableOption(this.properties, key)) return this.properties[key]
    return SCHEMA[key]?.default
  }

  getOption(key, feature) {
    // TODO: remove when umap.forms.js is refactored and does not call blindly
    // obj.getOption anymore
    return this.getProperty(key, feature)
  }

  getGeoContext() {
    const bounds = this._leafletMap.getBounds()
    const center = this._leafletMap.getCenter()
    const context = {
      bbox: bounds.toBBoxString(),
      north: bounds.getNorthEast().lat,
      east: bounds.getNorthEast().lng,
      south: bounds.getSouthWest().lat,
      west: bounds.getSouthWest().lng,
      lat: center.lat,
      lng: center.lng,
      zoom: this._leafletMap.getZoom(),
    }
    context.left = context.west
    context.bottom = context.south
    context.right = context.east
    context.top = context.north
    return context
  }

  renderUrl(url) {
    return Utils.greedyTemplate(url, this.getGeoContext(), true)
  }

  initShortcuts() {
    const globalShortcuts = (event) => {
      if (event.key === 'Escape') {
        if (this.importer.dialog.visible) {
          this.importer.dialog.close()
        } else if (this.editEnabled && this._leafletMap.editTools.drawing()) {
          this._leafletMap.editTools.onEscape()
        } else if (this._leafletMap.measureTools.enabled()) {
          this._leafletMap.measureTools.stopDrawing()
        } else if (this.fullPanel?.isOpen()) {
          this.fullPanel?.close()
        } else if (this.editPanel?.isOpen()) {
          this.editPanel?.close()
        } else if (this.panel.isOpen()) {
          this.panel.close()
        }
      }

      // From now on, only ctrl/meta shortcut
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey) return

      if (event.key === 'f') {
        event.stopPropagation()
        event.preventDefault()
        this.search()
      }

      /* Edit mode only shortcuts */
      if (!this.hasEditMode()) return

      // Edit mode Off
      if (!this.editEnabled) {
        switch (event.key) {
          case 'e':
            event.stopPropagation()
            event.preventDefault()
            this.enableEdit()
            break
        }
        return
      }

      // Edit mode on
      let used = true
      switch (event.key) {
        case 'e':
          if (!SAVEMANAGER.isDirty) this.disableEdit()
          break
        case 's':
          if (SAVEMANAGER.isDirty) this.saveAll()
          break
        case 'z':
          if (Utils.isWritable(event.target)) {
            used = false
            break
          }
          if (SAVEMANAGER.isDirty) {
            this.askForReset()
          }
          break
        case 'm':
          this._leafletMap.editTools.startMarker()
          break
        case 'p':
          this._leafletMap.editTools.startPolygon()
          break
        case 'l':
          this._leafletMap.editTools.startPolyline()
          break
        case 'i':
          this.importer.open()
          break
        case 'o':
          this.importer.openFiles()
          break
        case 'h':
          this.help.showGetStarted()
          break
        default:
          used = false
      }
      if (used) {
        event.stopPropagation()
        event.preventDefault()
      }
    }
    document.addEventListener('keydown', globalShortcuts)
  }

  async initDataLayers(datalayers) {
    datalayers = datalayers || this.properties.datalayers
    for (const options of datalayers) {
      // `false` to not propagate syncing elements served from uMap
      this.createDataLayer(options, false)
    }
    this.datalayersLoaded = true
    this.fire('datalayersloaded')
    const toLoad = []
    for (const datalayer of this.datalayersIndex) {
      if (datalayer.showAtLoad()) toLoad.push(() => datalayer.show())
    }
    while (toLoad.length) {
      const chunk = toLoad.splice(0, 10)
      await Promise.all(chunk.map((func) => func()))
    }

    this.dataloaded = true
    this.fire('dataloaded')
  }

  createDataLayer(options = {}, sync = true) {
    options.name =
      options.name || `${translate('Layer')} ${this.datalayersIndex.length + 1}`
    const datalayer = new DataLayer(this, this._leafletMap, options)

    if (sync !== false) {
      datalayer.sync.upsert(datalayer.options)
    }
    return datalayer
  }

  createDirtyDataLayer(options) {
    const datalayer = this.createDataLayer(options, true)
    datalayer.isDirty = true
    return datalayer
  }

  newDataLayer() {
    const datalayer = this.createDirtyDataLayer({})
    datalayer.edit()
  }

  reindexDataLayers() {
    this.eachDataLayer((datalayer) => datalayer.reindex())
    this.onDataLayersChanged()
  }

  indexDatalayers() {
    const panes = this._leafletMap.getPane('overlayPane')

    this.datalayersIndex = []
    for (const pane of panes.children) {
      if (!pane.dataset || !pane.dataset.id) continue
      this.datalayersIndex.push(this.datalayers[pane.dataset.id])
    }
    this.onDataLayersChanged()
  }

  onceDatalayersLoaded(callback, context) {
    // Once datalayers **metadata** have been loaded
    if (this.datalayersLoaded) {
      callback.call(context || this, this)
    } else {
      this._leafletMap.once('datalayersloaded', callback, context)
    }
    return this
  }

  onceDataLoaded(callback, context) {
    // Once datalayers **data** have been loaded
    if (this.dataloaded) {
      callback.call(context || this, this)
    } else {
      this._leafletMap.once('dataloaded', callback, context || this)
    }
    return this
  }

  onDataLayersChanged() {
    if (this.browser) this.browser.update()
    this.caption.refresh()
  }

  async saveAll() {
    if (!SAVEMANAGER.isDirty) return
    if (this._defaultExtent) this._setCenterAndZoom()
    this.backup()
    await SAVEMANAGER.save()
    // Do a blind render for now, as we are not sure what could
    // have changed, we'll be more subtil when we'll remove the
    // save action
    this.render(['name', 'user', 'permissions'])
    if (!this._leafletMap.listens('saved')) {
      // When we save only layers, we don't have the map feedback message
      this._leafletMap.on('saved', () => {
        Alert.success(translate('Map has been saved!'))
      })
    }
    this.sync.saved()
    this.fire('saved')
  }

  getDisplayName() {
    return this.properties.name || translate('Untitled map')
  }

  backup() {
    this.backupProperties()
    this._datalayersIndex_bk = [].concat(this.datalayersIndex)
  }

  backupProperties() {
    this._backupProperties = Object.assign({}, this.properties)
    this._backupProperties.tilelayer = Object.assign({}, this.properties.tilelayer)
    this._backupProperties.limitBounds = Object.assign({}, this.properties.limitBounds)
    this._backupProperties.permissions = Object.assign({}, this.permissions.properties)
  }

  resetProperties() {
    this.properties = Object.assign({}, this._backupProperties)
    this.properties.tilelayer = Object.assign({}, this._backupProperties.tilelayer)
    this.permissions.properties = Object.assign({}, this._backupProperties.permissions)
  }

  setProperties(newProperties) {
    for (const key of Object.keys(SCHEMA)) {
      if (newProperties[key] !== undefined) {
        this.properties[key] = newProperties[key]
        if (key === 'rules') this.rules.load()
        if (key === 'slideshow') this.slideshow.load()
        // TODO: sync ?
      }
    }
  }

  hasData() {
    for (const datalayer of this.datalayersIndex) {
      if (datalayer.hasData()) return true
    }
  }

  hasLayers() {
    return Boolean(this.datalayersIndex.length)
  }

  allProperties() {
    return [].concat(...this.datalayersIndex.map((dl) => dl.allProperties()))
  }

  sortedValues(property) {
    return []
      .concat(...this.datalayersIndex.map((dl) => dl.sortedValues(property)))
      .filter((val, idx, arr) => arr.indexOf(val) === idx)
      .sort(U.Utils.naturalSort)
  }

  editCaption() {
    if (!this.editEnabled) return
    if (this.properties.editMode !== 'advanced') return
    const container = DomUtil.create('div')
    const metadataFields = ['properties.name', 'properties.description']

    DomUtil.createTitle(container, translate('Edit map details'), 'icon-caption')
    const builder = new MutatingForm(this, metadataFields, {
      className: 'map-metadata',
      umap: this,
    })
    const form = builder.build()
    container.appendChild(form)

    const credits = DomUtil.createFieldset(container, translate('Credits'))
    const creditsFields = [
      'properties.licence',
      'properties.shortCredit',
      'properties.longCredit',
      'properties.permanentCredit',
      'properties.permanentCreditBackground',
    ]
    const creditsBuilder = new MutatingForm(this, creditsFields, { umap: this })
    credits.appendChild(creditsBuilder.build())
    this.editPanel.open({ content: container, highlight: 'caption' })
  }

  editCenter() {
    if (!this.editEnabled) return
    if (this.properties.editMode !== 'advanced') return
    const container = DomUtil.create('div')
    const metadataFields = [
      ['properties.zoom', { handler: 'IntInput', label: translate('Default zoom') }],
      [
        'properties.center.lat',
        { handler: 'FloatInput', label: translate('Default latitude') },
      ],
      [
        'properties.center.lng',
        { handler: 'FloatInput', label: translate('Default longitude') },
      ],
      'properties.defaultView',
    ]

    DomUtil.createTitle(container, translate('Edit map default view'), 'icon-zoom')
    const builder = new MutatingForm(this, metadataFields, {
      className: 'map-metadata',
      umap: this,
    })
    const form = builder.build()
    const button = Utils.loadTemplate(
      `<button type="button">${translate('Use current center and zoom')}</button>`
    )
    button.addEventListener('click', () => {
      this._setCenterAndZoom()
      builder.fetchAll()
    })
    container.appendChild(form)
    container.appendChild(button)
    this.editPanel.open({ content: container, highlight: 'center' })
  }

  _editControls(container) {
    let UIFields = []
    for (const name of this._leafletMap.HIDDABLE_CONTROLS) {
      UIFields.push(`properties.${name}Control`)
    }
    UIFields = UIFields.concat([
      'properties.moreControl',
      'properties.scrollWheelZoom',
      'properties.miniMap',
      'properties.scaleControl',
      'properties.onLoadPanel',
      'properties.displayPopupFooter',
      'properties.captionBar',
      'properties.captionMenus',
    ])
    const builder = new MutatingForm(this, UIFields, { umap: this })
    const controlsOptions = DomUtil.createFieldset(
      container,
      translate('User interface options')
    )
    controlsOptions.appendChild(builder.build())
  }

  _editShapeProperties(container) {
    const shapeOptions = [
      'properties.color',
      'properties.iconClass',
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

    const builder = new MutatingForm(this, shapeOptions, { umap: this })
    const defaultShapeProperties = DomUtil.createFieldset(
      container,
      translate('Default shape properties')
    )
    defaultShapeProperties.appendChild(builder.build())
  }

  _editDefaultProperties(container) {
    const optionsFields = [
      'properties.zoomTo',
      'properties.easing',
      'properties.labelKey',
      'properties.sortKey',
      'properties.filterKey',
      'properties.facetKey',
      'properties.slugKey',
    ]

    const builder = new MutatingForm(this, optionsFields, { umap: this })
    const defaultProperties = DomUtil.createFieldset(
      container,
      translate('Default properties')
    )
    defaultProperties.appendChild(builder.build())
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
    const builder = new MutatingForm(this, popupFields, { umap: this })
    const popupFieldset = DomUtil.createFieldset(
      container,
      translate('Default interaction options')
    )
    popupFieldset.appendChild(builder.build())
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
    const customTilelayer = DomUtil.createFieldset(
      container,
      translate('Custom background')
    )
    const builder = new MutatingForm(this, tilelayerFields, { umap: this })
    customTilelayer.appendChild(builder.build())
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
        { handler: 'Range', min: 0, max: 1, step: 0.1, label: translate('Opacity') },
      ],
      ['properties.overlay.tms', { handler: 'Switch', label: translate('TMS format') }],
    ]
    const overlay = DomUtil.createFieldset(container, translate('Custom overlay'))
    const builder = new MutatingForm(this, overlayFields, { umap: this })
    overlay.appendChild(builder.build())
  }

  _editBounds(container) {
    if (!Utils.isObject(this.properties.limitBounds)) {
      this.properties.limitBounds = {}
    }
    const limitBounds = DomUtil.createFieldset(container, translate('Limit bounds'))
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
    const boundsBuilder = new MutatingForm(this, boundsFields, { umap: this })
    limitBounds.appendChild(boundsBuilder.build())
    const boundsButtons = DomUtil.create('div', 'button-bar half', limitBounds)
    DomUtil.createButton(
      'button',
      boundsButtons,
      translate('Use current bounds'),
      function () {
        const bounds = this._leafletMap.getBounds()
        this.properties.limitBounds.south = LeafletUtil.formatNum(bounds.getSouth())
        this.properties.limitBounds.west = LeafletUtil.formatNum(bounds.getWest())
        this.properties.limitBounds.north = LeafletUtil.formatNum(bounds.getNorth())
        this.properties.limitBounds.east = LeafletUtil.formatNum(bounds.getEast())
        boundsBuilder.fetchAll()

        this.sync.update(this, 'properties.limitBounds', this.properties.limitBounds)
        this.isDirty = true
        this._leafletMap.handleLimitBounds()
      },
      this
    )
    DomUtil.createButton(
      'button',
      boundsButtons,
      translate('Empty'),
      function () {
        this.properties.limitBounds.south = null
        this.properties.limitBounds.west = null
        this.properties.limitBounds.north = null
        this.properties.limitBounds.east = null
        boundsBuilder.fetchAll()
        this.isDirty = true
        this._leafletMap.handleLimitBounds()
      },
      this
    )
  }

  _editSlideshow(container) {
    const slideshow = DomUtil.createFieldset(container, translate('Slideshow'))
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
      umap: this,
    })
    slideshow.appendChild(slideshowBuilder.build())
  }

  _editSync(container) {
    const sync = DomUtil.createFieldset(container, translate('Real-time collaboration'))
    const builder = new MutatingForm(this, ['properties.syncEnabled'], {
      umap: this,
    })
    sync.appendChild(builder.build())
  }

  _advancedActions(container) {
    const advancedActions = DomUtil.createFieldset(
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
      Utils.loadTemplateWithRefs(tpl)
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
    download.addEventListener('click', () => this.share.open())
  }

  edit() {
    if (!this.editEnabled) return
    if (this.properties.editMode !== 'advanced') return
    const container = DomUtil.create('div')
    DomUtil.createTitle(
      container,
      translate('Map advanced properties'),
      'icon-settings'
    )
    this._editControls(container)
    this._editShapeProperties(container)
    this._editDefaultProperties(container)
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

    this.editPanel.open({
      content: container,
      className: 'dark',
      highlight: 'settings',
    })
  }

  reset() {
    if (this._leafletMap.editTools) this._leafletMap.editTools.stopDrawing()
    this.resetProperties()
    this.datalayersIndex = [].concat(this._datalayersIndex_bk)
    // Iter over all datalayers, including deleted if any.
    for (const datalayer of Object.values(this.datalayers)) {
      if (datalayer.isDeleted) datalayer.connectToMap()
      if (datalayer.isDirty) datalayer.reset()
    }
    this.ensurePanesOrder()
    this._leafletMap.initTileLayers()
    this.onDataLayersChanged()
    this.isDirty = !this.id
  }

  async save() {
    this.rules.commit()
    const geojson = {
      type: 'Feature',
      geometry: this.geometry(),
      properties: this.exportProperties(),
    }
    const formData = new FormData()
    formData.append('name', this.properties.name)
    formData.append('center', JSON.stringify(this.geometry()))
    formData.append('settings', JSON.stringify(geojson))
    const uri = this.urls.get('map_save', { map_id: this.id })
    const [data, _, error] = await this.server.post(uri, {}, formData)
    // FIXME: login_required response will not be an error, so it will not
    // stop code while it should
    if (error) {
      return
    }
    // TOOD: map.save may not always be the first call during save process
    // since SAVEMANAGER refactor
    if (data.login_required) {
      window.onLogin = () => this.saveAll()
      window.open(data.login_required)
      return
    }
    this.properties.user = data.user
    if (!this.id) {
      this.properties.id = data.id
      this.permissions.setProperties(data.permissions)
      this.permissions.commit()
      if (data.permissions?.anonymous_edit_url) {
        this._leafletMap.once('saved', () => {
          AlertCreation.info(
            translate('Your map has been created with an anonymous account!'),
            Number.Infinity,
            data.permissions.anonymous_edit_url,
            this.properties.urls.map_send_edit_link
              ? this.sendEditLinkEmail.bind(this)
              : null
          )
        })
      } else {
        this._leafletMap.once('saved', () => {
          Alert.success(translate('Congratulations, your map has been created!'))
        })
      }
    } else {
      if (!this.permissions.isDirty) {
        // Do not override local changes to permissions,
        // but update in case some other editors changed them in the meantime.
        this.permissions.setProperties(data.permissions)
        this.permissions.commit()
      }
      this._leafletMap.once('saved', () => {
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

  exportProperties() {
    const properties = {}
    for (const key of Object.keys(SCHEMA)) {
      if (this.properties[key] !== undefined) {
        properties[key] = this.properties[key]
      }
    }
    return properties
  }

  geometry() {
    /* Return a GeoJSON geometry Object */
    const latlng = this._leafletMap.latLng(
      this.properties.center || this._leafletMap.getCenter()
    )
    return {
      type: 'Point',
      coordinates: [latlng.lng, latlng.lat],
    }
  }

  toGeoJSON() {
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
  }

  enableEdit() {
    this.editBar.redraw()
    document.body.classList.add('umap-edit-enabled')
    this.editEnabled = true
    this.drop.enable()
    this.fire('edit:enabled')
    this.initSyncEngine()
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
    this.sync.stop()
  }

  fire(name) {
    this._leafletMap.fire(name)
  }

  askForReset(e) {
    if (this.getProperty('syncEnabled')) return
    this.dialog
      .confirm(translate('Are you sure you want to cancel your changes?'))
      .then(() => {
        this.reset()
        this.disableEdit()
      })
  }

  async initSyncEngine() {
    // this.properties.websocketEnabled is set by the server admin
    if (this.properties.websocketEnabled === false) return
    // this.properties.syncEnabled is set by the user in the map settings
    if (this.properties.syncEnabled !== true) {
      this.sync.stop()
    } else {
      await this.sync.authenticate()
    }
  }

  getSyncMetadata() {
    return {
      engine: this.sync,
      subject: 'map',
    }
  }

  render(fields = []) {
    // Propagate will remove the fields it has already
    // processed
    fields = this.propagate(fields)

    const impacts = Utils.getImpactsFromSchema(fields)
    for (const impact of impacts) {
      switch (impact) {
        case 'ui':
          this._leafletMap.renderUI()
          this.browser.redraw()
          this.topBar.redraw()
          this.bottomBar.redraw()
          break
        case 'data':
          this.eachVisibleDataLayer((datalayer) => {
            datalayer.redraw()
          })
          break
        case 'datalayer-index':
          this.reindexDataLayers()
          break
        case 'background':
          this._leafletMap.initTileLayers()
          break
        case 'bounds':
          this._leafletMap.handleLimitBounds()
          break
        case 'sync':
          this.initSyncEngine()
      }
    }
  }

  // This method does a targeted update of the UI,
  // it whould be merged with `render`` method and the
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
          if (this.properties.user?.id) {
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
          if (this.sync.websocketConnected) {
            el.textContent = Object.keys(this.sync.getPeers()).length
          } else {
            el.textContent = translate('Disconnected')
          }
          el.parentElement.classList.toggle('off', !this.sync.websocketConnected)
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
    return this.createDirtyDataLayer()
  }

  findDataLayer(method, context) {
    for (let i = this.datalayersIndex.length - 1; i >= 0; i--) {
      if (method.call(context, this.datalayersIndex[i])) {
        return this.datalayersIndex[i]
      }
    }
  }

  eachDataLayer(method, context) {
    for (let i = 0; i < this.datalayersIndex.length; i++) {
      method.call(context, this.datalayersIndex[i])
    }
  }

  eachDataLayerReverse(method, context, filter) {
    for (let i = this.datalayersIndex.length - 1; i >= 0; i--) {
      if (filter && !filter.call(context, this.datalayersIndex[i])) continue
      method.call(context, this.datalayersIndex[i])
    }
  }

  eachBrowsableDataLayer(method, context) {
    this.eachDataLayerReverse(method, context, (d) => d.allowBrowse())
  }

  eachVisibleDataLayer(method, context) {
    this.eachDataLayerReverse(method, context, (d) => d.isVisible())
  }

  eachFeature(callback, context) {
    this.eachBrowsableDataLayer((datalayer) => {
      if (datalayer.isVisible()) datalayer.eachFeature(callback, context)
    })
  }

  removeDataLayers() {
    this.eachDataLayerReverse((datalayer) => {
      datalayer.del()
    })
  }

  emptyDataLayers() {
    this.eachDataLayerReverse((datalayer) => {
      datalayer.empty()
    })
  }

  editDatalayers() {
    if (!this.editEnabled) return
    const container = DomUtil.create('div')
    DomUtil.createTitle(container, translate('Manage layers'), 'icon-layers')
    const ul = DomUtil.create('ul', '', container)
    this.eachDataLayerReverse((datalayer) => {
      const row = DomUtil.create('li', 'orderable', ul)
      DomUtil.createIcon(row, 'icon-drag', translate('Drag to reorder'))
      datalayer.renderToolbox(row)
      const builder = new MutatingForm(
        datalayer,
        [['options.name', { handler: 'EditableText' }]],
        { className: 'umap-form-inline' }
      )
      const form = builder.build()
      row.appendChild(form)
      row.classList.toggle('off', !datalayer.isVisible())
      row.dataset.id = stamp(datalayer)
    })
    const onReorder = (src, dst, initialIndex, finalIndex) => {
      const movedLayer = this.datalayers[src.dataset.id]
      const targetLayer = this.datalayers[dst.dataset.id]
      const minIndex = Math.min(movedLayer.getRank(), targetLayer.getRank())
      const maxIndex = Math.max(movedLayer.getRank(), targetLayer.getRank())
      if (finalIndex === 0) movedLayer.bringToTop()
      else if (finalIndex > initialIndex) movedLayer.insertBefore(targetLayer)
      else movedLayer.insertAfter(targetLayer)
      this.eachDataLayerReverse((datalayer) => {
        if (datalayer.getRank() >= minIndex && datalayer.getRank() <= maxIndex)
          datalayer.isDirty = true
      })
      this.indexDatalayers()
    }
    const orderable = new Orderable(ul, onReorder)

    const bar = DomUtil.create('div', 'button-bar', container)
    DomUtil.createButton(
      'show-on-edit block add-datalayer button',
      bar,
      translate('Add a layer'),
      this.newDataLayer,
      this
    )

    this.editPanel.open({ content: container, highlight: 'layers' })
  }

  getDataLayerByUmapId(id) {
    const datalayer = this.findDataLayer((d) => d.id === id)
    if (!datalayer) throw new Error(`Can't find datalayer with id ${id}`)
    return datalayer
  }

  firstVisibleDatalayer() {
    return this.findDataLayer((datalayer) => {
      if (datalayer.isVisible()) return true
    })
  }

  ensurePanesOrder() {
    this.eachDataLayer((datalayer) => {
      datalayer.bringToTop()
    })
  }

  openBrowser(mode) {
    this.onceDatalayersLoaded(() => this.browser.open(mode))
  }

  openCaption() {
    this.onceDatalayersLoaded(() => this.caption.open())
  }

  addAuthorLink(container) {
    const author = this.properties.author
    if (author?.name) {
      const el = Utils.loadTemplate(
        `<span class="umap-map-author"> ${translate('by')} <a href="${author.url}">${author.name}</a></span>`
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
      if (!layer) layer = this.createDirtyDataLayer({ name: file.name })
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

    this.setProperties(importedData.properties)

    if (importedData.geometry) {
      this.properties.center = this._leafletMap.latLng(importedData.geometry)
    }
    for (const geojson of importedData.layers) {
      if (!geojson._umap_options && geojson._storage) {
        geojson._umap_options = geojson._storage
        delete geojson._storage
      }
      delete geojson._umap_options?.id // Never trust an id at this stage
      const dataLayer = this.createDirtyDataLayer(geojson._umap_options)
      dataLayer.fromUmapGeoJSON(geojson)
    }

    // For now render->propagate expect a `properties.` prefix.
    // Remove this when we have refactored schema and render.
    const fields = Object.keys(importedData.properties).map(
      (field) => `properties.${field}`
    )
    this.render(fields)
    this._leafletMap._setDefaultCenter()
    this.isDirty = true
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
        U.Alert.error(
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

  getLayersBounds() {
    const bounds = new latLngBounds()
    this.eachBrowsableDataLayer((d) => {
      if (d.isVisible()) bounds.extend(d.layer.getBounds())
    })
    return bounds
  }

  fitDataBounds() {
    const bounds = this.getLayersBounds()
    if (!this.hasData() || !bounds.isValid()) return false
    this._leafletMap.fitBounds(bounds)
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

  openExternalRouting(event) {
    const url = this.urls.get('routing', {
      lat: event.latlng.lat,
      lng: event.latlng.lng,
      locale: getLocale(),
      zoom: this._leafletMap.getZoom(),
    })
    if (url) window.open(url)
  }

  editInOSM(event) {
    const url = this.urls.get('edit_in_osm', {
      lat: event.latlng.lat,
      lng: event.latlng.lng,
      zoom: Math.max(this._leafletMap.getZoom(), 16),
    })
    if (url) window.open(url)
  }

  setCenterAndZoom() {
    this._setCenterAndZoom()
    Alert.success(translate('The zoom and center have been modified.'))
  }

  _setCenterAndZoom() {
    this.properties.center = this._leafletMap.getCenter()
    this.properties.zoom = this._leafletMap.getZoom()
    this.isDirty = true
    this._defaultExtent = false
  }
}
