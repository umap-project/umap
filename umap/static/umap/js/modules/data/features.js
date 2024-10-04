import {
  DomUtil,
  DomEvent,
  stamp,
  GeoJSON,
  LineUtil,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import * as Utils from '../utils.js'
import { SCHEMA } from '../schema.js'
import { translate } from '../i18n.js'
import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import {
  LeafletMarker,
  LeafletPolyline,
  LeafletPolygon,
  MaskPolygon,
} from '../rendering/ui.js'
import loadPopup from '../rendering/popup.js'

class Feature {
  constructor(datalayer, geojson = {}, id = null) {
    this.sync = datalayer.map.sync_engine.proxy(this)
    this._marked_for_deletion = false
    this._isDirty = false
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

  set isDirty(status) {
    this._isDirty = status
    if (this.datalayer) {
      this.datalayer.isDirty = status
    }
  }

  get isDirty() {
    return this._isDirty
  }

  get ui() {
    if (!this._ui) this.makeUI()
    return this._ui
  }

  get map() {
    return this.datalayer?.map
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
    this._geometry = value
    this.pushGeometry()
  }

  isOnScreen(bounds) {
    return this.ui?.isOnScreen(bounds)
  }

  pushGeometry() {
    this._setLatLngs(this.toLatLngs())
  }

  pullGeometry(sync = true) {
    this.fromLatLngs(this._getLatLngs())
    if (sync) {
      this.sync.update('geometry', this.geometry)
    }
  }

  fromLatLngs(latlngs) {
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
        layerId: this.datalayer?.umap_id || null,
        featureType: this.getClassName(),
      },
    }
  }

  onCommit() {
    // When the layer is a remote layer, we don't want to sync the creation of the
    // points via the websocket, as the other peers will get them themselves.
    if (this.datalayer?.isRemoteLayer()) return

    // The "endEdit" event is triggered at the end of an edition,
    // and will trigger the sync.
    // In the case of a deletion (or a change of layer), we don't want this
    // event triggered to cause a sync event, as it would reintroduce
    // deleted features.
    // The `._marked_for_deletion` private property is here to track this status.
    if (this._marked_for_deletion === true) {
      this._marked_for_deletion = false
      return
    }
    this.sync.upsert(this.toGeoJSON())
  }

  isReadOnly() {
    return this.datalayer?.isDataReadOnly()
  }

  getSlug() {
    return this.properties[this.map.getOption('slugKey') || 'name'] || ''
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
    if (this.map.slideshow) {
      this.map.slideshow.current = this
    }
    this.map.currentFeature = this
    this.attachPopup()
    this.ui.openPopup(latlng || this.center)
  }

  render(fields) {
    const impactData = fields.some((field) => {
      return field.startsWith('properties.')
    })
    if (impactData) {
      if (this.map.currentFeature === this) {
        this.view()
      }
    }
    this.redraw()
  }

  edit(event) {
    if (!this.map.editEnabled || this.isReadOnly()) return
    const container = DomUtil.create('div', 'umap-feature-container')
    DomUtil.createTitle(
      container,
      translate('Feature properties'),
      `icon-${this.getClassName()}`
    )

    let builder = new U.FormBuilder(
      this,
      [['datalayer', { handler: 'DataLayerSwitcher' }]],
      {
        callback() {
          this.edit(event)
        }, // removeLayer step will close the edit panel, let's reopen it
      }
    )
    container.appendChild(builder.build())

    const properties = []
    for (const property of this.datalayer._propertiesIndex) {
      if (['name', 'description'].includes(property)) {
        continue
      }
      properties.push([`properties.${property}`, { label: property }])
    }
    // We always want name and description for now (properties management to come)
    properties.unshift('properties.description')
    properties.unshift('properties.name')
    builder = new U.FormBuilder(this, properties, {
      id: 'umap-feature-properties',
    })
    container.appendChild(builder.build())
    this.appendEditFieldsets(container)
    const advancedActions = DomUtil.createFieldset(
      container,
      translate('Advanced actions')
    )
    this.getAdvancedEditActions(advancedActions)
    const onLoad = this.map.editPanel.open({ content: container })
    onLoad.then(() => {
      builder.helpers['properties.name'].input.focus()
    })
    this.map.editedFeature = this
    if (!this.ui.isOnScreen(this.map.getBounds())) this.zoomTo(event)
  }

  getAdvancedEditActions(container) {
    const button = Utils.loadTemplate(`
      <button class="button" type="button">
        <i class="icon icon-24 icon-delete"></i>${translate('Delete')}
      </button>`)
    button.addEventListener('click', () => {
      this.confirmDelete().then(() => this.map.editPanel.close())
    })
    container.appendChild(button)
  }

  appendEditFieldsets(container) {
    const optionsFields = this.getShapeOptions()
    let builder = new U.FormBuilder(this, optionsFields, {
      id: 'umap-feature-shape-properties',
    })
    const shapeProperties = DomUtil.createFieldset(
      container,
      translate('Shape properties')
    )
    shapeProperties.appendChild(builder.build())

    const advancedOptions = this.getAdvancedOptions()
    builder = new U.FormBuilder(this, advancedOptions, {
      id: 'umap-feature-advanced-properties',
    })
    const advancedProperties = DomUtil.createFieldset(
      container,
      translate('Advanced properties')
    )
    advancedProperties.appendChild(builder.build())

    const interactionOptions = this.getInteractionOptions()
    builder = new U.FormBuilder(this, interactionOptions)
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

  endEdit() {}

  getDisplayName(fallback) {
    if (fallback === undefined) fallback = this.datalayer.getName()
    const key = this.getOption('labelKey') || 'name'
    // Variables mode.
    if (U.Utils.hasVar(key))
      return U.Utils.greedyTemplate(key, this.extendedProperties())
    // Simple mode.
    return this.properties[key] || this.properties.title || fallback
  }

  hasPopupFooter() {
    if (this.datalayer.isRemoteLayer() && this.datalayer.options.remoteData.dynamic) {
      return false
    }
    return this.map.getOption('displayPopupFooter')
  }

  getPopupClass() {
    const old = this.getOption('popupTemplate') // Retrocompat.
    return loadPopup(this.getOption('popupShape') || old)
  }

  attachPopup() {
    const Class = this.getPopupClass()
    this.ui.bindPopup(new Class(this))
  }

  async confirmDelete() {
    const confirmed = await this.map.dialog.confirm(
      translate('Are you sure you want to delete the feature?')
    )
    if (confirmed) {
      this.del()
      return true
    }
    return false
  }

  del(sync) {
    this.isDirty = true
    this.map.closePopup()
    if (this.datalayer) {
      this.datalayer.removeFeature(this, sync)
    }
  }

  connectToDataLayer(datalayer) {
    this.datalayer = datalayer
    // FIXME should be in layer/ui
    this.ui.options.renderer = this.datalayer.renderer
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
      this.datalayer.isDirty = true
      this.datalayer.removeFeature(this)
    }

    datalayer.addFeature(this)
    this.sync.upsert(this.toGeoJSON())
    datalayer.isDirty = true
    this.redraw()
  }

  getOption(option, fallback) {
    let value = fallback
    if (typeof this.staticOptions[option] !== 'undefined') {
      value = this.staticOptions[option]
    } else if (U.Utils.usableOption(this.properties._umap_options, option)) {
      value = this.properties._umap_options[option]
    } else if (this.datalayer) {
      value = this.datalayer.getOption(option, this)
    } else {
      value = this.map.getOption(option)
    }
    return value
  }

  getDynamicOption(option, fallback) {
    let value = this.getOption(option, fallback)
    // There is a variable inside.
    if (U.Utils.hasVar(value)) {
      value = U.Utils.greedyTemplate(value, this.properties, true)
      if (U.Utils.hasVar(value)) value = this.map.getDefaultOption(option)
    }
    return value
  }

  zoomTo({ easing, latlng, callback } = {}) {
    if (easing === undefined) easing = this.map.getOption('easing')
    if (callback) this.map.once('moveend', callback.bind(this))
    if (easing) {
      this.map.flyTo(this.center, this.getBestZoom())
    } else {
      latlng = latlng || this.center
      this.map.setView(latlng, this.getBestZoom() || this.map.getZoom())
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
    delete this.properties[property]
    this.isDirty = true
  }

  renameProperty(from, to) {
    this.properties[to] = this.properties[from]
    this.deleteProperty(from)
  }

  toGeoJSON() {
    return Utils.CopyJSON({
      type: 'Feature',
      geometry: this.geometry,
      properties: this.cloneProperties(),
      id: this.id,
    })
  }

  getInplaceToolbarActions() {
    return [U.ToggleEditAction, U.DeleteFeatureAction]
  }

  getMap() {
    return this.map
  }

  isFiltered() {
    const filterKeys = this.datalayer.getFilterKeys()
    const filter = this.map.browser.options.filter
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
    const selected = this.map.facets.selected
    for (const [name, { type, min, max, choices }] of Object.entries(selected)) {
      let value = this.properties[name]
      const parser = this.map.facets.getParser(type)
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

  clone() {
    const geojson = this.toGeoJSON()
    delete geojson.id
    delete geojson.properties.id
    const feature = this.datalayer.makeFeature(geojson)
    feature.isDirty = true
    feature.edit()
    return feature
  }

  extendedProperties() {
    // Include context properties
    const properties = this.map.getGeoContext()
    const locale = L.getLocale()
    if (locale) properties.locale = locale
    if (L.lang) properties.lang = L.lang
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
    return L.extend(properties, this.properties)
  }

  getRank() {
    return this.datalayer._index.indexOf(L.stamp(this))
  }

  redraw() {
    if (this.datalayer?.isVisible()) {
      if (this.getUIClass() !== this.ui.getClass()) {
        this.datalayer.hideFeature(this)
        this.makeUI()
        this.datalayer.showFeature(this)
      } else {
        this.ui._redraw()
      }
    }
  }

  getContextMenuItems(event) {
    const permalink = this.getPermalink()
    let items = []
    if (permalink) {
      items.push({
        label: translate('Permalink'),
        action: () => {
          window.open(permalink)
        },
      })
    }
    items.push({
      label: translate('Copy as GeoJSON'),
      action: () => {
        L.Util.copyToClipboard(JSON.stringify(this.toGeoJSON()))
        this.map.tooltip.open({ content: L._('✅ Copied!') })
      },
    })
    if (this.map.editEnabled && !this.isReadOnly()) {
      items = items.concat(this.getContextMenuEditItems(event))
    }
    return items
  }

  getContextMenuEditItems() {
    let items = ['-']
    if (this.map.editedFeature !== this) {
      items.push({
        label: `${translate('Edit this feature')} (⇧+Click)`,
        action: () => this.edit(),
      })
    }
    items = items.concat(
      {
        label: this.map.help.displayLabel('EDIT_FEATURE_LAYER'),
        action: () => this.datalayer.edit(),
      },
      {
        label: translate('Delete this feature'),
        action: () => this.confirmDelete(),
      },
      {
        label: translate('Clone this feature'),
        action: () => this.clone(),
      }
    )
    return items
  }
}

export class Point extends Feature {
  constructor(datalayer, geojson, id) {
    super(datalayer, geojson, id)
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
    const builder = new U.FormBuilder(this, coordinatesOptions, {
      callback: () => {
        if (!this.ui._latlng.isValid()) {
          Alert.error(translate('Invalid latitude or longitude'))
          builder.restoreField('ui._latlng.lat')
          builder.restoreField('ui._latlng.lng')
        }
        this.pullGeometry()
        this.zoomTo({ easing: false })
      },
    })
    const fieldset = DomUtil.createFieldset(container, translate('Coordinates'))
    fieldset.appendChild(builder.build())
  }

  zoomTo(event) {
    if (this.datalayer.isClustered() && !this.ui._icon) {
      // callback is mandatory for zoomToShowLayer
      this.datalayer.layer.zoomToShowLayer(this.ui, event.callback || (() => {}))
    } else {
      super.zoomTo(event)
    }
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

  connectToDataLayer(datalayer) {
    super.connectToDataLayer(datalayer)
    // We keep markers on their own layer on top of the paths.
    this.ui.options.pane = this.datalayer.pane
  }

  edit(event) {
    if (this.map.editEnabled) {
      super.edit(event)
      if (!this.ui.editEnabled()) this.ui.makeGeometryEditable()
    }
  }

  _toggleEditing(event) {
    if (this.map.editEnabled) {
      if (this.ui.editEnabled()) {
        this.endEdit()
        this.map.editPanel.close()
      } else {
        this.edit(event)
      }
    }
    // FIXME: disable when disabling global edit
    L.DomEvent.stop(event)
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
    return this.getOption('zoomTo') || this.map.getBoundsZoom(this.bounds, true)
  }

  endEdit() {
    this.ui.disableEdit()
    super.endEdit()
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

  getInplaceToolbarActions(event) {
    const items = super.getInplaceToolbarActions(event)
    if (this.isMulti()) {
      items.push(U.DeleteShapeAction)
      items.push(U.ExtractShapeFromMultiAction)
    }
    return items
  }

  zoomTo({ easing, callback }) {
    // Use bounds instead of centroid for paths.
    easing = easing || this.map.getOption('easing')
    if (easing) {
      this.map.flyToBounds(this.bounds, this.getBestZoom())
    } else {
      this.map.fitBounds(this.bounds, this.getBestZoom() || this.map.getZoom())
    }
    if (callback) callback.call(this)
  }

  getContextMenuItems(event) {
    const items = super.getContextMenuItems(event)
    items.push({
      label: translate('Display measure'),
      action: () => Alert.info(this.ui.getMeasure()),
    })
    if (this.map.editEnabled && !this.isReadOnly() && this.isMulti()) {
      items.push(...this.getContextMenuMultiItems(event))
    }
    return items
  }

  getContextMenuMultiItems(event) {
    const items = [
      '-',
      {
        label: translate('Remove shape from the multi'),
        action: () => {
          this.ui.enableEdit().deleteShapeAt(event.latlng)
        },
      },
    ]
    const shape = this.ui.shapeAt(event.latlng)
    if (this.ui._latlngs.indexOf(shape) > 0) {
      items.push({
        label: translate('Make main shape'),
        action: () => {
          this.ui.enableEdit().deleteShape(shape)
          this.ui.editor.prependShape(shape)
        },
      })
    }
    return items
  }

  getContextMenuEditItems(event) {
    const items = super.getContextMenuEditItems(event)
    if (this.map?.editedFeature !== this && this.isSameClass(this.map.editedFeature)) {
      items.push({
        label: translate('Transfer shape to edited feature'),
        action: () => {
          this.transferShape(event.latlng, this.map.editedFeature)
        },
      })
    }
    if (this.isMulti()) {
      items.push({
        label: translate('Extract shape to separate feature'),
        action: () => {
          this.ui.isolateShape(event.latlng)
        },
      })
    }
    return items
  }
}

export class LineString extends Path {
  constructor(datalayer, geojson, id) {
    super(datalayer, geojson, id)
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

  isEmpty() {
    return !this.coordinates.length
  }

  getUIClass() {
    return super.getUIClass() || LeafletPolyline
  }

  isSameClass(other) {
    return other instanceof LineString
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

  getAdvancedEditActions(container) {
    super.getAdvancedEditActions(container)
    DomUtil.createButton(
      'button umap-to-polygon',
      container,
      translate('Transform to polygon'),
      this.toPolygon,
      this
    )
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
    const p1 = this.map.latLngToContainerPoint(a[a.length - 1])
    const p2 = this.map.latLngToContainerPoint(b[0])
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
    this.isDirty = true
  }

  isMulti() {
    return !LineUtil.isFlat(this.coordinates) && this.coordinates.length > 1
  }

  getContextMenuEditItems(event) {
    const items = super.getContextMenuEditItems(event)
    const vertexClicked = event.vertex
    if (!this.isMulti()) {
      items.push({
        label: translate('Transform to polygon'),
        action: () => this.toPolygon(),
      })
    }
    if (vertexClicked) {
      const index = event.vertex.getIndex()
      if (index !== 0 && index !== event.vertex.getLastIndex()) {
        items.push({
          label: translate('Split line'),
          action: () => event.vertex.split(),
        })
      } else if (index === 0 || index === event.vertex.getLastIndex()) {
        items.push({
          label: this.map.help.displayLabel('CONTINUE_LINE'),
          action: () => event.vertex.continue(),
        })
      }
    }
    return items
  }

  getContextMenuMultiItems(event) {
    const items = super.getContextMenuMultiItems(event)
    items.push({
      label: translate('Merge lines'),
      action: () => this.mergeShapes(),
    })
    return items
  }
}

export class Polygon extends Path {
  constructor(datalayer, geojson, id) {
    super(datalayer, geojson, id)
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

  getInplaceToolbarActions(event) {
    const items = super.getInplaceToolbarActions(event)
    items.push(U.CreateHoleAction)
    return items
  }

  getContextMenuEditItems(event) {
    const items = super.getContextMenuEditItems(event)
    const shape = this.ui.shapeAt(event.latlng)
    // No multi and no holes.
    if (shape && !this.isMulti() && (LineUtil.isFlat(shape) || shape.length === 1)) {
      items.push({
        label: translate('Transform to lines'),
        action: () => this.toLineString(),
      })
    }
    items.push({
      label: translate('Start a hole here'),
      action: () => this.ui.startHole(event),
    })
    return items
  }
}
