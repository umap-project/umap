import {
  DomEvent,
  DomUtil,
  GeoJSON,
  LineUtil,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import { MutatingForm } from '../form/builder.js'
import { translate } from '../i18n.js'
import {
  PREFERENCES as ORS_PREFERENCES,
  PROFILES as ORS_PROFILES,
  Importer as OpenRouteService,
} from '../importers/openrouteservice.js'
import loadPopup from '../rendering/popup.js'
import {
  LeafletMarker,
  LeafletPolygon,
  LeafletPolyline,
  LeafletRoute,
  MaskPolygon,
} from '../rendering/ui.js'
import { SCHEMA } from '../schema.js'
import * as Utils from '../utils.js'

class Feature {
  constructor(umap, datalayer, geojson = {}, id = null) {
    this._umap = umap
    this.sync = umap.syncEngine.proxy(this)
    this._ui = null

    // DataLayer the feature belongs to
    this.datalayer = datalayer
    this.properties = { _umap_options: {}, ...(geojson.properties || {}) }
    this.staticOptions = {}

    if (geojson.coordinates) {
      geojson = { geometry: geojson }
    }
    if (geojson.geometry) {
      this.populate(geojson)
    }

    if (id) {
      this.id = id
    } else {
      let geojson_id
      if (geojson) {
        geojson_id = geojson.id
      }

      // Each feature needs an unique identifier
      if (Utils.checkId(geojson_id)) {
        this.id = geojson_id
      } else {
        this.id = Utils.generateId()
      }
    }
  }

  get ui() {
    if (!this._ui) this.makeUI()
    return this._ui
  }

  get center() {
    return this.ui.getCenter()
  }

  get bounds() {
    return this.ui.getBounds()
  }

  get type() {
    return this.geometry.type
  }

  get coordinates() {
    return this.geometry.coordinates
  }

  get geometry() {
    return this._geometry
  }

  set geometry(value) {
    this._geometry_bk = Utils.CopyJSON(this._geometry)
    this._geometry = value
    this.pushGeometry()
  }

  get fields() {
    // Fields are user defined properties
    return [...this.datalayer.fields, ...this._umap.fields]
  }

  setter(key, value) {
    if (key === 'datalayer') {
      this.changeDataLayer(value)
    } else {
      Utils.setObjectValue(this, key, value)
    }
  }

  isOnScreen(bounds) {
    return this.ui?.isOnScreen(bounds)
  }

  pushGeometry() {
    this._setLatLngs(this.toLatLngs())
  }

  pullGeometry(sync = true) {
    const oldGeometry = Utils.CopyJSON(this._geometry)
    this.fromLatLngs(this._getLatLngs())
    if (sync) {
      this.sync.update('geometry', this.geometry, oldGeometry)
    }
  }

  fromLatLngs(latlngs) {
    this._geometry_bk = Utils.CopyJSON(this._geometry)
    this._geometry = this.convertLatLngs(latlngs)
  }

  makeUI() {
    const klass = this.getUIClass()
    this._ui = new klass(this, this.toLatLngs())
  }

  getUIClass() {
    return this.getOption('UIClass')
  }

  getClassName() {
    return this.staticOptions.className
  }

  getPreviewColor() {
    return this.getDynamicOption(this.staticOptions.mainColor)
  }

  getSyncMetadata() {
    return {
      subject: 'feature',
      metadata: {
        id: this.id,
        layerId: this.datalayer.id,
        featureType: this.getClassName(),
      },
    }
  }

  onCommit() {
    this.pullGeometry(false)
    // When the layer is a remote layer, we don't want to sync the creation of the
    // points via the websocket, as the other peers will get them themselves.
    if (this.datalayer?.isRemoteLayer()) return
    if (this._needs_upsert) {
      this.sync.upsert(this.toGeoJSON(), null)
      this._needs_upsert = false
    } else {
      this.sync.update('geometry', this.geometry, this._geometry_bk)
    }
  }

  isReadOnly() {
    return this.datalayer?.isDataReadOnly()
  }

  getSlug() {
    return (
      this.properties[this._umap.getProperty('slugKey') || U.DEFAULT_LABEL_KEY] || ''
    )
  }

  getPermalink() {
    const slug = this.getSlug()
    if (slug)
      return `${Utils.getBaseUrl()}?${Utils.buildQueryString({ feature: slug })}${
        window.location.hash
      }`
  }

  view({ latlng } = {}) {
    const outlink = this.getOption('outlink')
    const target = this.getOption('outlinkTarget')
    if (outlink) {
      switch (target) {
        case 'self':
          window.location = outlink
          break
        case 'parent':
          window.top.location = outlink
          break
        default:
          window.open(this.properties._umap_options.outlink)
      }
      return
    }
    // TODO deal with an event instead?
    if (this._umap.slideshow) {
      this._umap.slideshow.current = this
    }
    this._umap.currentFeature = this
    this.attachPopup().then(() => {
      this.ui.openPopup(latlng || this.center)
    })
  }

  render(fields) {
    const impactData = fields.some((field) => {
      return field.startsWith('properties.')
    })
    if (impactData) {
      if (this._umap.currentFeature === this) {
        this.view()
      }
    }
    this.redraw()
  }

  edit(event) {
    if (!this._umap.editEnabled || this.isReadOnly()) return
    if (this._umap.editedFeature === this && !event?.force) return
    // If this feature is active (popup open), let's close it.
    this.deactivate()
    const container = DomUtil.create('div', 'umap-feature-container')
    DomUtil.createTitle(
      container,
      translate('Feature properties'),
      `icon-${this.getClassName()}`
    )

    let builder = new MutatingForm(this, [
      ['datalayer', { handler: 'DataLayerSwitcher' }],
    ])
    // removeLayer step will close the edit panel, let's reopen it
    builder.on('set', () => this.edit(event))
    container.appendChild(builder.build())

    const properties = []
    for (const field of this.fields) {
      let handler = 'Input'
      if (field.key === 'description' || field.type === 'Text') {
        handler = 'Textarea'
      }
      properties.push([`properties.${field.key}`, { label: field.key, handler }])
    }
    builder = new MutatingForm(this, properties, {
      id: 'umap-feature-properties',
    })
    const form = builder.build()
    container.appendChild(form)
    const button = Utils.loadTemplate(
      `<button type="button"><i class="icon icon-16 icon-add"></i>${translate('Add a new field')}</button>`
    )
    button.addEventListener('click', () => {
      this.datalayer.addProperty().then(() => this.edit({ force: true }))
    })
    form.appendChild(button)
    this.appendEditFieldsets(container)
    const [details, { fieldset }] = Utils.loadTemplateWithRefs(`
      <details>
        <summary>${translate('Advanced actions')}</summary>
        <fieldset class="button-bar by2" data-ref=fieldset></fieldset>
      </details>
    `)
    container.appendChild(details)
    this.getAdvancedEditActions(fieldset)
    const onPanelLoaded = this._umap.editPanel.open({ content: container })
    onPanelLoaded.then(() => {
      builder.form.querySelector('input')?.focus()
    })
    this._umap.editedFeature = this
    if (!this.ui.isOnScreen(this._umap._leafletMap.getBounds())) this.zoomTo(event)
    return onPanelLoaded
  }

  toggleEditing() {
    if (this._umap.editedFeature === this) {
      this._umap.editPanel.close()
    } else {
      this.edit()
    }
  }

  getAdvancedEditActions(container) {
    const button = Utils.loadTemplate(`
      <button class="button" type="button">
        <i class="icon icon-24 icon-delete"></i>${translate('Delete')}
      </button>`)
    button.addEventListener('click', () => {
      this.del()
      this._umap.editPanel.close()
    })
    container.appendChild(button)
  }

  addExtraEditFieldset() {}

  appendEditFieldsets(container) {
    const optionsFields = this.getShapeOptions()
    let builder = new MutatingForm(this, optionsFields, {
      id: 'umap-feature-shape-properties',
    })
    const shapeProperties = DomUtil.createFieldset(
      container,
      translate('Shape properties')
    )
    shapeProperties.appendChild(builder.build())

    this.addExtraEditFieldset(container)

    const advancedOptions = this.getAdvancedOptions()
    builder = new MutatingForm(this, advancedOptions, {
      id: 'umap-feature-advanced-properties',
    })
    const advancedProperties = DomUtil.createFieldset(
      container,
      translate('Advanced properties')
    )
    advancedProperties.appendChild(builder.build())

    const interactionOptions = this.getInteractionOptions()
    builder = new MutatingForm(this, interactionOptions)
    const popupFieldset = DomUtil.createFieldset(
      container,
      translate('Interaction options')
    )
    popupFieldset.appendChild(builder.build())
  }

  getInteractionOptions() {
    return [
      'properties._umap_options.popupShape',
      'properties._umap_options.popupTemplate',
      'properties._umap_options.showLabel',
      'properties._umap_options.labelDirection',
      'properties._umap_options.labelInteractive',
      'properties._umap_options.outlink',
      'properties._umap_options.outlinkTarget',
    ]
  }

  endEdit() {
    this.ui.disableEdit()
  }

  getDisplayName() {
    const keys = U.LABEL_KEYS.slice() // Copy.
    const labelKey = this.getOption('labelKey')
    // Variables mode.
    if (labelKey) {
      if (Utils.hasVar(labelKey)) {
        return Utils.greedyTemplate(labelKey, this.extendedProperties()).trim()
      }
      keys.unshift(labelKey)
    }
    for (const key of keys) {
      const value = this.properties[key]
      if (value) return String(value).trim()
    }
    return this.datalayer.getName().trim()
  }

  hasPopupFooter() {
    if (
      this.datalayer.isRemoteLayer() &&
      this.datalayer.properties.remoteData.dynamic
    ) {
      return false
    }
    return this._umap.getProperty('displayPopupFooter')
  }

  getPopupClass() {
    const old = this.getOption('popupTemplate') // Retrocompat.
    return loadPopup(this.getOption('popupShape') || old)
  }

  async attachPopup() {
    const Class = this.getPopupClass()
    const popup = new Class(this)
    this.ui.bindPopup(popup)
    return popup.loadContent()
  }

  del(sync) {
    this._umap._leafletMap.closePopup()
    if (this.datalayer) {
      this.datalayer.removeFeature(this, sync)
    }
  }

  connectToDataLayer(datalayer) {
    this.datalayer = datalayer
  }

  disconnectFromDataLayer(datalayer) {
    if (this.datalayer === datalayer) {
      this.datalayer = null
    }
  }

  cleanProperty([key, value]) {
    // dot in key will break the dot based property access
    // while editing the feature
    key = key.replace('.', '_')
    return [key, value]
  }

  populate(geojson) {
    this._geometry = geojson.geometry
    this.properties = Object.fromEntries(
      Object.entries(geojson.properties || {}).map(this.cleanProperty)
    )
    this.properties._umap_options = L.extend(
      {},
      this.properties._storage_options,
      this.properties._umap_options
    )
    // Retrocompat
    if (this.properties._umap_options.clickable === false) {
      this.properties._umap_options.interactive = false
      delete this.properties._umap_options.clickable
    }
  }

  changeDataLayer(datalayer) {
    if (this.datalayer) {
      this.datalayer.removeFeature(this)
    }
    datalayer.addFeature(this)
    this.sync.upsert(this.toGeoJSON())
    this.redraw()
  }

  getOption(option, fallback) {
    let value = fallback
    if (typeof this.staticOptions[option] !== 'undefined') {
      value = this.staticOptions[option]
    } else if (Utils.usableOption(this.properties._umap_options, option)) {
      value = this.properties._umap_options[option]
    } else if (this.datalayer) {
      value = this.datalayer.getProperty(option, this)
    } else {
      value = this._umap.getProperty(option)
    }
    return value
  }

  getDynamicOption(key, fallback) {
    let value = this.getOption(key, fallback)
    // There is a variable inside.
    if (Utils.hasVar(value)) {
      value = Utils.greedyTemplate(value, this.properties, true)
      if (Utils.hasVar(value)) value = SCHEMA[key]?.default
    }
    return value
  }

  zoomTo({ easing, latlng, callback } = {}) {
    if (easing === undefined) easing = this._umap.getProperty('easing')
    if (callback) this._umap._leafletMap.once('moveend', callback.bind(this))
    if (easing) {
      this._umap._leafletMap.flyTo(this.center, this.getBestZoom())
    } else {
      latlng = latlng || this.center
      this._umap._leafletMap.setView(
        latlng,
        this.getBestZoom() || this._umap._leafletMap.getZoom()
      )
    }
  }

  getBestZoom() {
    return this.getOption('zoomTo')
  }

  getNext() {
    return this.datalayer.getNextFeature(this)
  }

  getPrevious() {
    return this.datalayer.getPreviousFeature(this)
  }

  cloneProperties() {
    const properties = L.extend({}, this.properties)
    properties._umap_options = L.extend({}, properties._umap_options)
    if (Object.keys && Object.keys(properties._umap_options).length === 0) {
      delete properties._umap_options // It can make a difference on big data sets
    }
    // Legacy
    delete properties._storage_options
    return properties
  }

  deleteProperty(property) {
    const oldValue = this.properties[property]
    delete this.properties[property]
    this.sync.update(`properties.${property}`, undefined, oldValue)
  }

  renameProperty(from, to) {
    const oldValue = this.properties[from]
    this.properties[to] = this.properties[from]
    this.deleteProperty(from)
    this.sync.update(`properties.${to}`, oldValue, undefined)
  }

  toGeoJSON() {
    return Utils.CopyJSON({
      type: 'Feature',
      geometry: this.geometry,
      properties: this.cloneProperties(),
      id: this.id,
    })
  }

  isFiltered() {
    const filterKeys = this.datalayer.getFilterKeys()
    const filter = this._umap.browser.options.filter
    if (filter && !this.matchFilter(filter, filterKeys)) return true
    if (!this.matchFacets()) return true
    return false
  }

  matchFilter(filter, keys) {
    filter = filter.toLowerCase()
    // When user hasn't touched settings, when a feature has no name
    // it will use the datalayer's name, so let's make the filtering
    // consistent.
    //  Also, if the user has defined a labelKey with vars, let's
    // compute before filtering
    if (Utils.hasVar(keys) || keys === 'displayName') {
      return this.getDisplayName().toLowerCase().indexOf(filter) !== -1
    }
    keys = keys.split(',')
    for (let i = 0, value; i < keys.length; i++) {
      value = `${this.properties[keys[i]] || ''}`
      if (value.toLowerCase().indexOf(filter) !== -1) return true
    }
    return false
  }

  matchFacets() {
    const selected = this._umap.facets.selected
    for (const [name, { type, min, max, choices }] of Object.entries(selected)) {
      let value = this.properties[name]
      const parser = this._umap.facets.getParser(type)
      value = parser(value)
      switch (type) {
        case 'date':
        case 'datetime':
        case 'number':
          if (!Number.isNaN(min) && !Number.isNaN(value) && min > value) return false
          if (!Number.isNaN(max) && !Number.isNaN(value) && max < value) return false
          break
        default:
          value = value || translate('<empty value>')
          if (choices?.length && !choices.includes(value)) return false
          break
      }
    }
    return true
  }

  isMulti() {
    return false
  }

  isEmpty() {
    return !this.coordinates.length
  }

  clone() {
    const geojson = this.toGeoJSON()
    delete geojson.id
    delete geojson.properties.id
    const feature = this.datalayer.makeFeature(geojson)
    feature.edit()
    return feature
  }

  extendedProperties() {
    // Include context properties
    const properties = this._umap.getGeoContext()
    const locale = L.getLocale()
    if (locale) properties.locale = locale
    if (U.lang) properties.lang = U.lang
    properties.rank = this.getRank() + 1
    properties.layer = this.datalayer.getName()
    if (this.ui._map && this.hasGeom()) {
      const center = this.center
      properties.lat = center.lat
      properties.lon = center.lng
      properties.lng = center.lng
      properties.alt = center?.alt
      if (typeof this.ui.getMeasure !== 'undefined') {
        properties.measure = this.ui.getMeasure()
      }
    }
    return Object.assign(properties, this.properties)
  }

  getRank() {
    return this.datalayer.features.getIndex(this)
  }

  redraw() {
    if (this.datalayer?.isVisible()) {
      if (this.getUIClass() !== this.ui.getClass()) {
        this.datalayer.hideFeature(this)
        this.makeUI()
        this.datalayer.showFeature(this)
      } else if (this.datalayer?.isBrowsable()) {
        this.ui._redraw()
      }
    }
  }

  getContextMenu(event) {
    const permalink = this.getPermalink()
    const items = []
    if (this._umap.editEnabled && !this.isReadOnly()) {
      items.push({
        items: this.getEditContextMenu(event),
      })
    }
    if (permalink) {
      items.push({
        label: translate('Permalink'),
        action: () => {
          window.open(permalink)
        },
      })
      items.push({
        label: translate('Layer permalink'),
        action: () => {
          window.open(this.datalayer.getPermalink())
        },
      })
    }
    items.push({
      label: translate('Copy as GeoJSON'),
      action: () => {
        L.Util.copyToClipboard(JSON.stringify(this.toGeoJSON()))
        this._umap.tooltip.open({ content: L._('✅ Copied!') })
      },
    })
    return items
  }

  getDrawingTools(event) {
    return [
      {
        title: translate('Toggle edit mode (⇧+Click)'),
        action: () => this.toggleEditing(),
        icon: 'icon-edit',
      },
    ]
  }

  getEditContextMenu(event) {
    const items = []
    const vertexClicked = event.vertex
    if (vertexClicked) {
      items.push(...this.getVertexTools(event))
    } else {
      items.push(...this.getDrawingTools(event))
    }
    items.push(
      '-',
      {
        title: this._umap.help.displayLabel('EDIT_FEATURE_LAYER', false),
        icon: 'icon-layers',
        action: () => this.datalayer.edit(),
      },
      {
        title: translate('Clone this feature'),
        icon: 'icon-copy',
        action: () => this.clone(),
      },
      {
        title: translate('Delete this feature'),
        icon: 'icon-delete',
        action: () => this.del(),
      }
    )
    return items
  }

  isActive() {
    return this._umap.activeFeature === this
  }

  activate() {
    this._umap.activeFeature = this
  }

  deactivate() {
    if (this._umap.activeFeature === this) {
      this._umap.activeFeature = undefined
      this.ui.closePopup()
    }
  }
}

export class Point extends Feature {
  constructor(umap, datalayer, geojson, id) {
    super(umap, datalayer, geojson, id)
    this.staticOptions = {
      mainColor: 'color',
      className: 'marker',
    }
  }

  _getLatLngs() {
    return this.ui.getLatLng()
  }

  _setLatLngs(latlng) {
    this.ui.setLatLng(latlng)
  }

  toLatLngs() {
    return GeoJSON.coordsToLatLng(this.coordinates)
  }

  convertLatLngs(latlng) {
    return { coordinates: GeoJSON.latLngToCoords(latlng), type: 'Point' }
  }

  getUIClass() {
    return super.getUIClass() || LeafletMarker
  }

  hasGeom() {
    return Boolean(this.coordinates)
  }

  _getIconUrl(name = 'icon') {
    return this.getOption(`${name}Url`)
  }

  getShapeOptions() {
    return [
      'properties._umap_options.color',
      'properties._umap_options.iconClass',
      'properties._umap_options.iconSize',
      'properties._umap_options.iconUrl',
      'properties._umap_options.iconOpacity',
    ]
  }

  getAdvancedOptions() {
    return ['properties._umap_options.zoomTo']
  }

  appendEditFieldsets(container) {
    super.appendEditFieldsets(container)
    // FIXME edit feature geometry.coordinates instead
    // (by learning FormBuilder to deal with array indexes ?)
    const coordinatesOptions = [
      ['ui._latlng.lat', { handler: 'FloatInput', label: translate('Latitude') }],
      ['ui._latlng.lng', { handler: 'FloatInput', label: translate('Longitude') }],
    ]
    const builder = new MutatingForm(this, coordinatesOptions)
    builder.on('set', () => {
      if (!this.ui._latlng.isValid()) {
        Alert.error(translate('Invalid latitude or longitude'))
        builder.restoreField('ui._latlng.lat')
        builder.restoreField('ui._latlng.lng')
      }
      this.pullGeometry()
      this.zoomTo({ easing: false })
    })
    const fieldset = DomUtil.createFieldset(container, translate('Coordinates'))
    fieldset.appendChild(builder.build())
  }

  zoomTo(event) {
    if (this.datalayer.isClustered() && this.ui._cluster) {
      this.ui._cluster.zoomToCoverage().then(() => {
        this.ui._cluster.spiderfy()
      })
    }
    super.zoomTo(event)
  }
}

class Path extends Feature {
  hasGeom() {
    return !this.isEmpty()
  }

  _getLatLngs() {
    return this.ui.getLatLngs()
  }

  _setLatLngs(latlngs) {
    this.ui.setLatLngs(latlngs)
  }

  edit(event) {
    if (this._umap.editEnabled) {
      const promise = super.edit(event)
      if (!this.ui.editEnabled()) this.ui.makeGeometryEditable()
      return promise
    }
  }

  toggleEditing() {
    if (this._umap.editEnabled) {
      if (this.ui.editEnabled()) {
        this.endEdit()
        this._umap.editPanel.close()
      } else {
        this.edit()
      }
    }
  }

  getShapeOptions() {
    return [
      'properties._umap_options.color',
      'properties._umap_options.opacity',
      'properties._umap_options.weight',
    ]
  }

  getAdvancedOptions() {
    return [
      'properties._umap_options.smoothFactor',
      'properties._umap_options.dashArray',
      'properties._umap_options.zoomTo',
    ]
  }

  getBestZoom() {
    return (
      this.getOption('zoomTo') ||
      this._umap._leafletMap.getBoundsZoom(this.bounds, true)
    )
  }

  transferShape(at, to) {
    const shape = this.ui.enableEdit().deleteShapeAt(at)
    // FIXME: make Leaflet.Editable send an event instead
    this.pullGeometry()
    this.ui.disableEdit()
    if (!shape) return
    to.ui.enableEdit().appendShape(shape)
    to.pullGeometry()
    if (this.isEmpty()) this.del()
  }

  isolateShape(latlngs) {
    const properties = this.cloneProperties()
    const type = this instanceof LineString ? 'LineString' : 'Polygon'
    const geometry = this.convertLatLngs(latlngs)
    const other = this.datalayer.makeFeature({ type, geometry, properties })
    other.edit()
    return other
  }

  zoomTo({ easing, callback }) {
    // Use bounds instead of centroid for paths.
    easing = easing || this._umap.getProperty('easing')
    if (easing) {
      this._umap._leafletMap.flyToBounds(this.bounds, this.getBestZoom())
    } else {
      this._umap._leafletMap.fitBounds(
        this.bounds,
        this.getBestZoom() || this._umap._leafletMap.getZoom()
      )
    }
    if (callback) callback.call(this)
  }

  getContextMenu(event) {
    const items = super.getContextMenu(event)
    items.push({
      label: translate('Display measure'),
      action: () => Alert.info(this.ui.getMeasure()),
    })
    return items
  }

  getVertexTools(event) {
    return [
      {
        action: () => event.vertex.delete(),
        title: translate('Delete this vertex (Alt+Click)'),
        icon: 'icon-delete-vertex',
      },
    ]
  }

  getDrawingTools(event) {
    const items = super.getDrawingTools(event)
    if (this.isMulti()) {
      items.push(
        {
          title: translate('Extract shape to separate feature'),
          icon: 'icon-extract-shape',
          action: () => {
            this.ui.isolateShape(event.latlng)
          },
        },
        {
          title: translate('Delete this shape'),
          icon: 'icon-delete-shape',
          action: () => this.ui.enableEdit().deleteShapeAt(event.latlng),
        }
      )
    }
    if (
      this._umap?.editedFeature !== this &&
      this.isSameClass(this._umap.editedFeature)
    ) {
      items.push({
        title: translate('Transfer shape to edited feature'),
        icon: 'icon-transfer-shape',
        action: () => {
          this.transferShape(event.latlng, this._umap.editedFeature)
        },
      })
    }
    return items
  }
}

export class LineString extends Path {
  constructor(umap, datalayer, geojson, id) {
    super(umap, datalayer, geojson, id)
    this.staticOptions = {
      stroke: true,
      fill: false,
      mainColor: 'color',
      className: 'polyline',
    }
  }

  toLatLngs(geometry) {
    return GeoJSON.coordsToLatLngs(this.coordinates, this.type === 'LineString' ? 0 : 1)
  }

  convertLatLngs(latlngs) {
    let multi = !LineUtil.isFlat(latlngs)
    let coordinates = GeoJSON.latLngsToCoords(latlngs, multi ? 1 : 0, false)
    if (coordinates.length === 1 && typeof coordinates[0][0] !== 'number') {
      coordinates = Utils.flattenCoordinates(coordinates)
      multi = false
    }
    const type = multi ? 'MultiLineString' : 'LineString'
    return { coordinates, type }
  }

  getUIClass() {
    const klass = super.getUIClass()
    if (klass) return klass
    if (this.isRoute()) {
      return LeafletRoute
    }
    return LeafletPolyline
  }

  isSameClass(other) {
    return other instanceof LineString
  }

  cancelRoute() {
    const oldRoute = Utils.CopyJSON(this.properties._umap_options.route)
    this.properties._umap_options.route.active = false
    this.redraw()
    this.edit()
    this.sync.update('properties._umap_options.route', null, oldRoute)
  }

  restoreRoute() {
    const oldRoute = Utils.CopyJSON(this.properties._umap_options.route)
    this._ensureRoute()
    delete this.properties._umap_options.route.active
    this.redraw()
    this.sync.update(
      'properties._umap_options.route',
      this.properties._umap_options.route,
      oldRoute
    )
    this.edit().then((panel) => {
      panel.scrollTo('details#edit-route')
    })
  }

  toRoute() {
    this._ensureRoute()
    this.properties._umap_options.route.coordinates = Utils.CopyJSON(this.coordinates)
    this.redraw()
    this.sync.update(
      'properties._umap_options.route',
      this.properties._umap_options.route,
      null
    )
    this.edit().then((panel) => {
      panel.scrollTo('details#edit-route')
    })
  }

  askForRouteSettings() {
    const container = Utils.loadTemplate(
      `<div><h3>${translate('Route settings')}</h3></div>`
    )
    container.appendChild(this.routeForm())
    return this._umap.dialog.open({ template: container })
  }

  toPolygon() {
    const geojson = this.toGeoJSON()
    geojson.geometry.type = 'Polygon'
    geojson.geometry.coordinates = [
      Utils.flattenCoordinates(geojson.geometry.coordinates),
    ]

    delete geojson.id // delete the copied id, a new one will be generated.

    const polygon = this.datalayer.makeFeature(geojson)
    polygon.edit()
    this.del()
  }

  isRoute() {
    return (
      !!this.properties._umap_options.route &&
      this.properties._umap_options.route.active !== false
    )
  }

  getAdvancedEditActions(container) {
    super.getAdvancedEditActions(container)
    const button = Utils.loadTemplate(`
      <button class="button" type="button"><i class="icon icon-24 icon-polygon"></i>${translate('Transform to polygon')}</button>
    `)
    container.appendChild(button)
    button.addEventListener('click', () => this.toPolygon())
    if (this.isRoute()) {
      const button = Utils.loadTemplate(`
        <button class="button" type="button"><i class="icon icon-24 icon-polyline"></i>${translate('Transform to regular line')}</button>
      `)
      container.appendChild(button)
      button.addEventListener('click', () => this.cancelRoute())
    } else if (!this.isMulti() && this.coordinates.length < 10) {
      const button = Utils.loadTemplate(`
        <button class="button" type="button"><i class="icon icon-24 icon-route"></i>${translate('Transform to route')}</button>
      `)
      container.appendChild(button)
      button.addEventListener('click', () =>
        this.askForRouteSettings().then(() => {
          this.toRoute()
          this.computeRoute()
        })
      )
    } else if (this.properties._umap_options.route?.coordinates) {
      const button = Utils.loadTemplate(`
        <button class="button" type="button"><i class="icon icon-24 icon-route"></i>${translate('Restore route')}</button>
      `)
      container.appendChild(button)
      button.addEventListener('click', () => this.restoreRoute())
    }
    if (this._umap.properties.ORSAPIKey) {
      const button = Utils.loadTemplate(`
        <button class="button" type="button"><i class="icon icon-24 icon-mountain"></i>${translate('Compute elevations')}</button>
      `)
      container.appendChild(button)
      button.addEventListener('click', () => this.computeElevation())
    }
  }

  _mergeShapes(from, to) {
    const toLeft = to[0]
    const toRight = to[to.length - 1]
    const fromLeft = from[0]
    const fromRight = from[from.length - 1]
    const l2ldistance = toLeft.distanceTo(fromLeft)
    const l2rdistance = toLeft.distanceTo(fromRight)
    const r2ldistance = toRight.distanceTo(fromLeft)
    const r2rdistance = toRight.distanceTo(fromRight)
    let toMerge
    if (l2rdistance < Math.min(l2ldistance, r2ldistance, r2rdistance)) {
      toMerge = [from, to]
    } else if (r2ldistance < Math.min(l2ldistance, l2rdistance, r2rdistance)) {
      toMerge = [to, from]
    } else if (r2rdistance < Math.min(l2ldistance, l2rdistance, r2ldistance)) {
      from.reverse()
      toMerge = [to, from]
    } else {
      from.reverse()
      toMerge = [from, to]
    }
    const a = toMerge[0]
    const b = toMerge[1]
    const p1 = this._umap._leafletMap.latLngToContainerPoint(a[a.length - 1])
    const p2 = this._umap._leafletMap.latLngToContainerPoint(b[0])
    const tolerance = 5 // px on screen
    if (Math.abs(p1.x - p2.x) <= tolerance && Math.abs(p1.y - p2.y) <= tolerance) {
      a.pop()
    }
    return a.concat(b)
  }

  mergeShapes() {
    if (!this.isMulti()) return
    const latlngs = this.ui.getLatLngs()
    if (!latlngs.length) return
    while (latlngs.length > 1) {
      latlngs.splice(0, 2, this._mergeShapes(latlngs[1], latlngs[0]))
    }
    this.ui.setLatLngs(latlngs[0])
    this.pullGeometry()
    if (!this.ui.editEnabled()) this.edit()
    this.ui.editor.reset()
  }

  isMulti() {
    return !LineUtil.isFlat(this.coordinates) && this.coordinates.length > 1
  }

  getVertexTools(event) {
    const items = super.getVertexTools(event)
    const index = event.vertex.getIndex()
    if (index !== 0 && index !== event.vertex.getLastIndex()) {
      items.push({
        title: translate('Split line'),
        icon: 'icon-split-line',
        action: () => event.vertex.split(),
      })
    } else if (index === 0 || index === event.vertex.getLastIndex()) {
      items.push({
        title: this._umap.help.displayLabel('CONTINUE_LINE', false),
        icon: 'icon-continue-line',
        action: () => event.vertex.continue(),
      })
    }
    return items
  }

  getDrawingTools(event) {
    const items = super.getDrawingTools(event)
    if (this.isMulti()) {
      items.push({
        title: translate('Merge lines'),
        icon: 'icon-merge',
        action: () => this.mergeShapes(),
      })
    } else {
      items.push({
        title: translate('Transform to polygon'),
        icon: 'icon-polygon',
        action: () => this.toPolygon(),
      })
    }
    return items
  }

  extendedProperties() {
    const [gain, loss] = this.ui.getElevation()
    return Object.assign({ gain, loss }, super.extendedProperties())
  }

  _ensureRoute() {
    if (!this.properties._umap_options.route) {
      this.properties._umap_options.route = {}
    }
    this.properties._umap_options.route.profile ??= ORS_PROFILES[0][0]
    this.properties._umap_options.route.preference ??= ORS_PREFERENCES[0][0]
    this.properties._umap_options.route.elevation ??= false
    this.properties._umap_options.route.coordinates ??= []
  }

  routeForm() {
    this._ensureRoute()
    const metadatas = [
      [
        'profile',
        {
          handler: 'Select',
          selectOptions: ORS_PROFILES,
          label: translate('Profile'),
        },
      ],
      [
        'elevation',
        {
          handler: 'Switch',
          label: translate('Compute elevations'),
        },
      ],
      [
        'preference',
        {
          handler: 'Select',
          selectOptions: ORS_PREFERENCES,
          label: translate('Route preference'),
        },
      ],
    ]
    const form = new MutatingForm(this.properties._umap_options.route, metadatas, {
      umap: this._umap,
    })
    return form.build()
  }

  _editRoute(container) {
    const template = `
        <details id="edit-route">
          <summary>${translate('Route settings')}</summary>
          <fieldset data-ref=fieldset></fieldset>
        </details>
      `
    const [details, { fieldset }] = Utils.loadTemplateWithRefs(template)
    container.appendChild(details)
    fieldset.appendChild(this.routeForm())
    const button = Utils.loadTemplate(
      `<button data-ref=button type="button">${translate('Compute route')}</button>`
    )
    fieldset.appendChild(button)
    button.addEventListener('click', async () => this.computeRoute())
  }

  addExtraEditFieldset(container) {
    const options = [
      'properties._umap_options.textPath',
      'properties._umap_options.textPathColor',
      'properties._umap_options.textPathRepeat',
      'properties._umap_options.textPathRotate',
      'properties._umap_options.textPathSize',
      'properties._umap_options.textPathOffset',
      'properties._umap_options.textPathPosition',
    ]
    const builder = new MutatingForm(this, options, {
      id: 'umap-feature-line-decoration',
    })
    const fieldset = DomUtil.createFieldset(container, translate('Line decoration'))
    fieldset.appendChild(builder.build())
    if (this._umap.properties.ORSAPIKey && this.isRoute()) {
      this._editRoute(container)
    }
  }

  async computeElevation() {
    if (!this._umap.properties.ORSAPIKey) return
    const importer = new OpenRouteService(this._umap)
    const geometry = await importer.elevation(this.geometry)
    if (geometry?.type) {
      const oldGeometry = Utils.CopyJSON(this._geometry)
      this.geometry = geometry
      this.ui.resetTooltip()
      this.sync.update('geometry', this.geometry, oldGeometry)
    }
  }

  async computeRoute() {
    if (!this._umap.properties.ORSAPIKey) return
    const importer = new OpenRouteService(this._umap)
    await importer.directions(this.properties._umap_options.route).then((geometry) => {
      if (geometry?.type) {
        const oldGeometry = Utils.CopyJSON(this._geometry)
        this.geometry = geometry
        this.ui.resetTooltip()
        this.sync.update('geometry', this.geometry, oldGeometry)
      }
    })
  }
}

export class Polygon extends Path {
  constructor(umap, datalayer, geojson, id) {
    super(umap, datalayer, geojson, id)
    this.staticOptions = {
      mainColor: 'fillColor',
      className: 'polygon',
    }
  }

  toLatLngs() {
    return GeoJSON.coordsToLatLngs(this.coordinates, this.type === 'Polygon' ? 1 : 2)
  }

  convertLatLngs(latlngs) {
    const holes = !LineUtil.isFlat(latlngs)
    let multi = holes && !LineUtil.isFlat(latlngs[0])
    let coordinates = GeoJSON.latLngsToCoords(latlngs, multi ? 2 : holes ? 1 : 0, true)
    if (Utils.polygonMustBeFlattened(coordinates)) {
      coordinates = coordinates[0]
      multi = false
    }
    const type = multi ? 'MultiPolygon' : 'Polygon'
    return { coordinates, type }
  }

  isEmpty() {
    return !this.coordinates.length || !this.coordinates[0].length
  }

  getUIClass() {
    if (this.getOption('mask')) return MaskPolygon
    return super.getUIClass() || LeafletPolygon
  }

  isSameClass(other) {
    return other instanceof Polygon
  }

  getShapeOptions() {
    const options = super.getShapeOptions()
    options.push(
      'properties._umap_options.stroke',
      'properties._umap_options.fill',
      'properties._umap_options.fillColor',
      'properties._umap_options.fillOpacity'
    )
    return options
  }

  getPreviewColor() {
    // If user set a fillColor, use it, otherwise default to color
    // which is usually the only one set
    const color = this.getDynamicOption(this.staticOptions.mainColor)
    if (color && color !== SCHEMA.color.default) return color
    return this.getDynamicOption('color')
  }

  getInteractionOptions() {
    const options = super.getInteractionOptions()
    options.push('properties._umap_options.interactive')
    return options
  }

  toLineString() {
    const geojson = this.toGeoJSON()
    delete geojson.id
    delete geojson.properties.id
    geojson.geometry.type = 'LineString'
    geojson.geometry.coordinates = Utils.flattenCoordinates(
      geojson.geometry.coordinates
    )
    const polyline = this.datalayer.makeFeature(geojson)
    polyline.edit()
    this.del()
  }

  getAdvancedOptions() {
    const actions = super.getAdvancedOptions()
    actions.push('properties._umap_options.mask')
    return actions
  }

  getAdvancedEditActions(container) {
    super.getAdvancedEditActions(container)
    const toLineString = DomUtil.createButton(
      'button umap-to-polyline',
      container,
      translate('Transform to lines'),
      this.toLineString,
      this
    )
  }

  isMulti() {
    // Change me when Leaflet#3279 is merged.
    // FIXME use TurfJS
    return (
      !LineUtil.isFlat(this.coordinates) &&
      !LineUtil.isFlat(this.coordinates[0]) &&
      this.coordinates.length > 1
    )
  }

  getDrawingTools(event) {
    const items = super.getDrawingTools(event)
    const shape = this.ui.shapeAt(event.latlng)
    // No multi and no holes.
    if (shape && !this.isMulti() && (LineUtil.isFlat(shape) || shape.length === 1)) {
      items.push({
        title: translate('Transform to lines'),
        icon: 'icon-polyline',
        action: () => this.toLineString(),
      })
    }
    items.push({
      title: translate('Start a hole here'),
      action: () => this.ui.startHole(event),
      icon: 'icon-hole',
    })
    return items
  }
}
