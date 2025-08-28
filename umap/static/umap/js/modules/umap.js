import {
  DomUtil,
  Util as LeafletUtil,
  latLngBounds,
} from '../../vendors/leaflet/leaflet-src.esm.js'
import {
  uMapAlert as Alert,
  uMapAlertCreation as AlertCreation,
} from '../components/alerts/alert.js'
import Browser from './browser.js'
import Caption from './caption.js'
import { DataLayer } from './data/layer.js'
import Facets from './facets.js'
import { MutatingForm } from './form/builder.js'
import { Formatter } from './formatter.js'
import Help from './help.js'
import { getLocale, setLocale, translate } from './i18n.js'
import Importer from './importer.js'
import Orderable from './orderable.js'
import { MapPermissions } from './permissions.js'
import { LeafletMap } from './rendering/map.js'
import { Request, ServerRequest } from './request.js'
import Rules from './rules.js'
import { SCHEMA } from './schema.js'
import Share from './share.js'
import Slideshow from './slideshow.js'
import { SyncEngine } from './sync/engine.js'
import { BottomBar, EditBar, TopBar } from './ui/bar.js'
import ContextMenu from './ui/contextmenu.js'
import Dialog from './ui/dialog.js'
import { EditPanel, FullPanel, Panel } from './ui/panel.js'
import Tooltip from './ui/tooltip.js'
import URLs from './urls.js'
import * as Utils from './utils.js'
import { DataLayerManager } from './managers.js'
import { Importer as OpenRouteService } from './importers/openrouteservice.js'

export default class Umap {
  constructor(element, geojson) {
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

    // Needed for permissions
    this.syncEngine = new SyncEngine(this)
    this.sync = this.syncEngine.proxy(this)

    // Needed to render controls
    this.permissions = new MapPermissions(this)
    this.urls = new URLs(this.properties.urls)
    this.slideshow = new Slideshow(this, this._leafletMap)

    if (geojson.properties.schema) this.overrideSchema(geojson.properties.schema)

    // Do not display in an iframe.
    if (this.isEmbed) {
      this.properties.homeControl = false
    }

    this._leafletMap.setup()

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
    this.server = new ServerRequest()
    this.request = new Request()
    this.facets = new Facets(this)
    this.browser = new Browser(this, this._leafletMap)
    this.caption = new Caption(this, this._leafletMap)
    this.importer = new Importer(this)
    this.share = new Share(this)
    this.rules = new Rules(this, this)

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
    this.datalayers = new DataLayerManager()
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
        this.enableEdit()
      }
      this._defaultExtent = true
      this.properties.name = translate('Untitled map')
      await this.loadTemplateFromQueryString()
      await this.loadDataFromQueryString()
    }

    if (!this.properties.noControl) {
      this.initShortcuts()
      this._leafletMap.on('contextmenu', (event) => this.onContextMenu(event))
      this.onceDataLoaded(this.setViewFromQueryString)
      this.bottomBar.setup()
      this.propagate()
    }

    window.onbeforeunload = () => (this.editEnabled && this.isDirty) || null
  }

  get isDirty() {
    return this.sync._undoManager.isDirty()
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

  get fields() {
    if (!this.properties.fields) this.properties.fields = []
    return this.properties.fields
  }

  get fieldKeys() {
    return this.fields
      .map((field) => field.key)
      .concat(...this.datalayers.active().map((dl) => dl.fieldKeys))
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

  async loadTemplateFromQueryString() {
    const templateUrl = this.searchParams.get('templateUrl')
    if (templateUrl) {
      this.importer.build()
      this.importer.url = templateUrl
      this.importer.format = 'umap'
      this.importer.submit()
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

  getOwnContextMenu(event) {
    const items = []
    if (this.editEnabled) {
      items.push({
        items: [
          {
            title: this.help.displayLabel('DRAW_MARKER', false),
            icon: 'icon-marker',
            action: () => this._leafletMap.editTools.startMarker(),
          },
          {
            title: this.help.displayLabel('DRAW_LINE', false),
            icon: 'icon-polyline',
            action: () => this._leafletMap.editTools.startPolyline(),
          },
          {
            title: this.help.displayLabel('DRAW_POLYGON', false),
            icon: 'icon-polygon',
            action: () => this._leafletMap.editTools.startPolygon(),
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

  getSharedContextMenu(event) {
    const items = []
    if (this.properties.urls.routing) {
      items.push({
        label: translate('Directions from here'),
        action: () => this.openExternalRouting(event),
      })
    }
    if (this.properties.ORSAPIKey) {
      items.push({
        label: translate('Compute isochrone from here'),
        action: () => this.askForIsochrone(event),
      })
    }
    if (this.properties.urls.edit_in_osm) {
      items.push({
        label: translate('Edit in OpenStreetMap'),
        action: () => this.editInOSM(event),
      })
    }
    if (items.length) items.unshift('-')
    return items
  }

  onContextMenu(event) {
    const items = this.getOwnContextMenu(event).concat(this.getSharedContextMenu(event))
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

  getColor() {
    return this.getProperty('color')
  }

  getOption(key, feature) {
    // TODO: remove when field.js does not call blindly obj.getOption anymore
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
    const shortcuts = {
      Escape: {
        do: () => {
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
        do: () => this.sync._undoManager.undo(),
      },
      'Ctrl+Shift+Z': {
        if: () => this.editEnabled && !Utils.isWritable(event.target),
        do: () => this.sync._undoManager.redo(),
      },
      'Ctrl+m': {
        if: () => this.editEnabled,
        do: () => this._leafletMap.editTools.startMarker(),
      },
      'Ctrl+p': {
        if: () => this.editEnabled,
        do: () => this._leafletMap.editTools.startPolygon(),
      },
      'Ctrl+l': {
        if: () => this.editEnabled,
        do: () => this._leafletMap.editTools.startPolyline(),
      },
      'Ctrl+i': {
        if: () => this.editEnabled,
        do: () => this.importer.open(),
      },
      'Ctrl+o': {
        if: () => this.editEnabled,
        do: () => this.importer.openFiles(),
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

  async initDataLayers(datalayers) {
    datalayers = datalayers || this.properties.datalayers
    for (const options of datalayers) {
      // `false` to not propagate syncing elements served from uMap
      this.createDataLayer(options, false)
    }
    this.datalayersLoaded = true
    this.fire('datalayersloaded')
    const toLoad = []
    for (const datalayer of this.datalayers.active()) {
      if (datalayer.showAtLoad()) toLoad.push(() => datalayer.show())
    }
    while (toLoad.length) {
      const chunk = toLoad.splice(0, 10)
      await Promise.all(chunk.map((func) => func()))
    }

    this.dataloaded = true
    this.fire('dataloaded')
  }

  createDataLayer(properties = {}, sync = true) {
    properties.name =
      properties.name || `${translate('Layer')} ${this.datalayers.count() + 1}`
    const datalayer = new DataLayer(this, this._leafletMap, properties)

    if (sync !== false) {
      datalayer.sync.upsert(datalayer.properties)
    }
    return datalayer
  }

  // TODO: remove me in favor of createDataLayer
  createDirtyDataLayer(properties) {
    return this.createDataLayer(properties, true)
  }

  newDataLayer() {
    const datalayer = this.createDirtyDataLayer({})
    datalayer.edit()
  }

  reindexDataLayers() {
    this.datalayers.active().map((datalayer) => datalayer.reindex())
    this.onDataLayersChanged()
  }

  reorderDataLayers() {
    const parent = this._leafletMap.getPane('overlayPane')
    const datalayers = Object.values(this.datalayers)
      .filter((datalayer) => !datalayer._isDeleted)
      .sort((datalayer1, datalayer2) => datalayer1.rank > datalayer2.rank)
    for (const datalayer of datalayers) {
      const child = parent.querySelector(`[data-id="${datalayer.id}"]`)
      parent.appendChild(child)
    }
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
    if (!this.isDirty) return
    if (this._defaultExtent) this._setCenterAndZoom()
    const status = await this.sync.save()
    if (!status) return
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
    this.fire('saved')
  }

  getDisplayName() {
    return this.properties.name || translate('Untitled map')
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
    for (const datalayer of this.datalayers.active()) {
      if (datalayer.hasData()) return true
    }
  }

  hasLayers() {
    return Boolean(this.datalayers.count())
  }

  sortedValues(property) {
    return []
      .concat(...this.datalayers.active().map((dl) => dl.sortedValues(property)))
      .filter((val, idx, arr) => arr.indexOf(val) === idx)
      .sort(Utils.naturalSort)
  }

  editCaption() {
    if (!this.editEnabled) return
    if (this.properties.editMode !== 'advanced') return
    const container = DomUtil.create('div')
    const metadataFields = [
      'properties.name',
      'properties.description',
      'properties.is_template',
    ]

    DomUtil.createTitle(container, translate('Edit map details'), 'icon-caption')
    const builder = new MutatingForm(this, metadataFields, {
      className: 'map-metadata',
      umap: this,
    })
    const form = builder.build()
    container.appendChild(form)

    const tags = DomUtil.createFieldset(container, translate('Tags'))
    const tagsFields = ['properties.tags']
    const tagsBuilder = new MutatingForm(this, tagsFields, {
      umap: this,
    })
    tags.appendChild(tagsBuilder.build())
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
      this.setCenterAndZoom()
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
      'properties.layerSwitcher',
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
      () => {
        const bounds = this._leafletMap.getBounds()
        const oldLimitBounds = { ...this.properties.limitBounds }
        this.properties.limitBounds.south = LeafletUtil.formatNum(bounds.getSouth())
        this.properties.limitBounds.west = LeafletUtil.formatNum(bounds.getWest())
        this.properties.limitBounds.north = LeafletUtil.formatNum(bounds.getNorth())
        this.properties.limitBounds.east = LeafletUtil.formatNum(bounds.getEast())
        boundsBuilder.fetchAll()
        this.sync.update(
          'properties.limitBounds',
          this.properties.limitBounds,
          oldLimitBounds
        )
        this._leafletMap.handleLimitBounds()
      }
    )
    DomUtil.createButton('button', boundsButtons, translate('Empty'), () => {
      const oldLimitBounds = { ...this.properties.limitBounds }
      this.properties.limitBounds.south = null
      this.properties.limitBounds.west = null
      this.properties.limitBounds.north = null
      this.properties.limitBounds.east = null
      boundsBuilder.fetchAll()
      this._leafletMap.handleLimitBounds()
      this.sync.update(
        'properties.limitBounds',
        this.properties.limitBounds,
        oldLimitBounds
      )
    })
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

    return this.editPanel.open({
      content: container,
      className: 'dark',
      highlight: 'settings',
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
      this.permissions.setProperties(data.permissions)
      this.permissions.commit()
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
      subject: 'map',
    }
  }

  onPropertiesUpdated(fields = []) {
    this._leafletMap.pullProperties()
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
          if (fields.includes('properties.rules')) {
            this.rules.load()
          }
          this.datalayers.visible().map((datalayer) => {
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
          this.reorderDataLayers()
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
    datalayer = this.datalayers.find((datalayer) => {
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

  eachFeature(callback) {
    this.datalayers.browsable().map((datalayer) => {
      if (datalayer.isVisible()) datalayer.features.forEach(callback)
    })
  }

  removeDataLayers() {
    this.datalayers.active().map((datalayer) => {
      datalayer.del()
    })
  }

  emptyDataLayers() {
    this.datalayers.active().map((datalayer) => {
      datalayer.empty()
    })
  }

  editDatalayers() {
    if (!this.editEnabled) return
    const template = `
      <div>
        <h3><i class="icon icon-16 icon-layers"></i>${translate('Manage layers')}</h3>
        <ul data-ref=ul></ul>
      </div>
    `
    const [container, { ul }] = Utils.loadTemplateWithRefs(template)
    this.datalayers.reverse().map((datalayer) => {
      const row = Utils.loadTemplate(
        `<li class="orderable"><i class="icon icon-16 icon-drag" title="${translate('Drag to reorder')}"></i></li>`
      )
      datalayer.renderToolbox(row)
      const builder = new MutatingForm(
        datalayer,
        [['properties.name', { handler: 'EditableText' }]],
        { className: 'umap-form-inline' }
      )
      const form = builder.build()
      row.appendChild(form)
      row.classList.toggle('off', !datalayer.isVisible())
      row.dataset.id = datalayer.id
      ul.appendChild(row)
    })
    const onReorder = (src, dst, initialIndex, finalIndex) => {
      const movedLayer = this.datalayers[src.dataset.id]
      const targetLayer = this.datalayers[dst.dataset.id]
      const minIndex = Math.min(movedLayer.getDOMOrder(), targetLayer.getDOMOrder())
      const maxIndex = Math.max(movedLayer.getDOMOrder(), targetLayer.getDOMOrder())
      if (finalIndex === 0) movedLayer.bringToTop()
      else if (finalIndex > initialIndex) movedLayer.insertBefore(targetLayer)
      else movedLayer.insertAfter(targetLayer)
      this.sync.startBatch()
      this.datalayers.reverse().map((datalayer) => {
        const rank = datalayer.getDOMOrder()
        if (rank >= minIndex && rank <= maxIndex) {
          const oldRank = datalayer.rank
          datalayer.rank = rank
          datalayer.sync.update('options.rank', rank, oldRank)
          datalayer.redraw()
        }
      })
      this.sync.commitBatch()
      this.onDataLayersChanged()
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
    const datalayer = this.datalayers[id]
    if (!datalayer) throw new Error(`Can't find datalayer with id ${id}`)
    return datalayer
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
      this.properties.center = this._leafletMap.latLng(importedData.geometry)
    }
    for (const geojson of importedData.layers) {
      if (!geojson._umap_options && geojson._storage) {
        geojson._umap_options = geojson._storage
      }
      delete geojson._storage
      delete geojson._umap_options?.id // Never trust an id at this stage
      if (geojson._umap_options?.iconUrl?.startsWith('/')) {
        geojson._umap_options.iconUrl = remoteOrigin + geojson._umap_options.iconUrl
      }
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
    this.datalayers.browsable().map((d) => {
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

  async askForIsochrone(event) {
    if (!this.properties.ORSAPIKey) return
    const importer = new OpenRouteService(this)
    importer.isochrone(event.latlng)
  }

  setCenterAndZoom() {
    this._setCenterAndZoom(true)
    Alert.success(translate('The zoom and center have been modified.'))
  }

  _setCenterAndZoom(manual) {
    const oldCenter = { ...this.properties.center }
    const oldZoom = this.properties.zoom
    this.properties.center = this._leafletMap.getCenter()
    this.properties.zoom = this._leafletMap.getZoom()
    this._defaultExtent = false
    if (manual) {
      this.sync.startBatch()
      this.sync.update('properties.center', this.properties.center, oldCenter)
      this.sync.update('properties.zoom', this.properties.zoom, oldZoom)
      this.sync.commitBatch()
    }
  }

  getStaticPathFor(name) {
    return SCHEMA.iconUrl.default.replace('marker.svg', name)
  }

  undo() {
    this.sync._undoManager.undo()
  }

  redo() {
    this.sync._undoManager.redo()
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
