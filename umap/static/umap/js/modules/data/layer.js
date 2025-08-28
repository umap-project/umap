// FIXME: this module should not depend on Leaflet
import {
  DomEvent,
  DomUtil,
  GeoJSON,
  stamp,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import {
  uMapAlert as Alert,
  uMapAlertConflict as AlertConflict,
} from '../../components/alerts/alert.js'
import { MutatingForm } from '../form/builder.js'
import { translate } from '../i18n.js'
import { DataLayerPermissions } from '../permissions.js'
import { Default as DefaultLayer } from '../rendering/layers/base.js'
import { Categorized, Choropleth, Circles } from '../rendering/layers/classified.js'
import { Cluster } from '../rendering/layers/cluster.js'
import { Heat } from '../rendering/layers/heat.js'
import * as Schema from '../schema.js'
import TableEditor from '../tableeditor.js'
import * as Utils from '../utils.js'
import { LineString, Point, Polygon } from './features.js'
import Rules from '../rules.js'
import Orderable from '../orderable.js'
import { FeatureManager } from '../managers.js'

export const LAYER_TYPES = [
  DefaultLayer,
  Cluster,
  Heat,
  Choropleth,
  Categorized,
  Circles,
]

const LAYER_MAP = LAYER_TYPES.reduce((acc, klass) => {
  acc[klass.TYPE] = klass
  return acc
}, {})

export class DataLayer {
  constructor(umap, leafletMap, data = {}) {
    this._umap = umap
    this.sync = umap.syncEngine.proxy(this)
    this.features = new FeatureManager()
    this._geojson = null
    this._propertiesIndex = []

    this._leafletMap = leafletMap
    this.parentPane = this._leafletMap.getPane('overlayPane')
    this.pane = this._leafletMap.createPane(`datalayer${stamp(this)}`, this.parentPane)
    // FIXME: should be on layer
    this.renderer = L.svg({ pane: this.pane })
    this.defaultProperties = {
      displayOnLoad: true,
      inCaption: true,
      browsable: true,
      editMode: 'advanced',
    }

    this._isDeleted = false
    this._referenceVersion = data._referenceVersion
    // Do not save it later.
    delete data._referenceVersion
    data.id = data.id || crypto.randomUUID()

    this.setProperties(data)
    this.pane.dataset.id = this.id
    if (this.properties.rank === undefined) {
      this.properties.rank = this._umap.datalayers.count()
    }

    if (!Utils.isObject(this.properties.remoteData)) {
      this.properties.remoteData = {}
    }
    // Retrocompat
    if (this.properties.remoteData?.from) {
      this.properties.fromZoom = this.properties.remoteData.from
      delete this.properties.remoteData.from
    }
    if (this.properties.remoteData?.to) {
      this.properties.toZoom = this.properties.remoteData.to
      delete this.properties.remoteData.to
    }
    this.connectToMap()
    this.permissions = new DataLayerPermissions(this._umap, this)
    this.rules = new Rules(umap, this)

    this._needsFetch = this.createdOnServer || this.isRemoteLayer()
    if (!this.createdOnServer) {
      if (this.showAtLoad()) this.show()
    }
    if (!this._needsFetch && !this._umap.fields.length) {
      this.properties.fields = [
        { key: U.DEFAULT_LABEL_KEY, type: 'String' },
        { key: 'description', type: 'Text' },
      ]
    }

    // Only layers that are displayed on load must be hidden/shown
    // Automatically, others will be shown manually, and thus will
    // be in the "forced visibility" mode
    if (this.isVisible()) this.propagateShow()
  }

  get id() {
    return this.properties.id
  }

  get createdOnServer() {
    return Boolean(this._referenceVersion)
  }

  onDirty(status) {
    if (status) {
      // A layer can be made dirty by indirect action (like dragging layers)
      // we need to have it loaded before saving it.
      if (!this.isLoaded()) this.fetchData()
    } else {
      this.isDeleted = false
    }
  }

  set isDeleted(status) {
    this._isDeleted = status
  }

  get isDeleted() {
    return this._isDeleted
  }

  get cssId() {
    return `datalayer-${stamp(this)}`
  }

  get rank() {
    // Make sure we always have a valid rank. Undefined rank may happen
    // after importing an old umap backup, and not touching the layers
    // after that.
    if (this.properties.rank === undefined) {
      this.properties.rank = this.getDOMOrder()
    }
    return this.properties.rank
  }

  set rank(value) {
    this.properties.rank = value
  }

  get fields() {
    if (!this.properties.fields) this.properties.fields = []
    return this.properties.fields
  }

  set fields(fields) {
    this.properties.fields = fields
  }

  get fieldKeys() {
    return this.fields.map((field) => field.key)
  }

  get sortKey() {
    return this.getProperty('sortKey') || U.DEFAULT_LABEL_KEY
  }

  getSyncMetadata() {
    return {
      subject: 'datalayer',
      metadata: { id: this.id },
    }
  }

  render(fields, builder) {
    // Propagate will remove the fields it has already
    // processed
    fields = this.propagate(fields)

    const impacts = Utils.getImpactsFromSchema(fields)

    for (const impact of impacts) {
      switch (impact) {
        case 'ui':
          this._umap.onDataLayersChanged()
          break
        case 'data':
          if (fields.includes('properties.type')) {
            this.resetLayer()
          }
          for (const field of fields) {
            this.layer.onEdit(field, builder)
          }
          this.redraw()
          break
        case 'remote-data':
          this.fetchRemoteData()
          break
        case 'datalayer-rank':
          this._umap.reorderDataLayers()
          break
      }
    }
  }

  // This method does a targeted update of the UI,
  // it whould be merged with `render`` method and the
  // SCHEMA at some point
  propagate(fields = []) {
    const impacts = {
      'properties.name': () => {
        Utils.eachElement('.datalayer-name', (el) => {
          if (el.dataset.id === this.id) {
            el.textContent = this.getName()
            el.title = this.getName()
          }
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

  showAtLoad() {
    return this.autoLoaded() && this.showAtZoom()
  }

  autoLoaded() {
    if (!this._umap.datalayersFromQueryString) return this.properties.displayOnLoad
    const datalayerIds = this._umap.datalayersFromQueryString
    let loadMe = datalayerIds.includes(this.id.toString())
    if (this.properties.old_id) {
      loadMe = loadMe || datalayerIds.includes(this.properties.old_id.toString())
    }
    return loadMe
  }

  insertBefore(other) {
    if (!other) return
    this.parentPane.insertBefore(this.pane, other.pane)
  }

  insertAfter(other) {
    if (!other) return
    this.parentPane.insertBefore(this.pane, other.pane.nextSibling)
  }

  bringToTop() {
    this.parentPane.appendChild(this.pane)
  }

  hasDataVisible() {
    return this.layer.hasDataVisible()
  }

  resetLayer(force) {
    // Only reset if type is defined (undefined is the default) and different from current type
    if (
      this.layer &&
      (!this.properties.type || this.properties.type === this.layer.getType()) &&
      !force
    ) {
      return
    }
    const visible = this.isVisible()
    if (this.layer) this.layer.clearLayers()
    // delete this.layer?
    if (visible) this._leafletMap.removeLayer(this.layer)
    const Class = LAYER_MAP[this.properties.type] || DefaultLayer
    this.layer = new Class(this)
    // Rendering layer changed, so let's force reset the feature rendering too.
    this.features.forEach((feature) => {
      feature.makeUI()
      this.showFeature(feature)
    })
    if (visible) this.show()
    this.propagateRemote()
  }

  async fetchData() {
    if (!this.createdOnServer) return
    if (this._loading) return
    this._loading = true
    const [geojson, response, error] = await this._umap.server.get(this._dataUrl())
    if (!error) {
      this._umap.modifiedAt = response.headers.get('last-modified')
      this.setReferenceVersion({ response, sync: false })
      delete geojson._umap_options
      // In case of maps pre 1.0 still around
      delete geojson._storage
      await this.fromUmapGeoJSON(geojson)
      this._loading = false
    }
  }

  dataChanged() {
    if (!this.isLoaded() || this._batch) return
    this._umap.onDataLayersChanged()
    this.layer.dataChanged()
  }

  fromGeoJSON(geojson, sync = true) {
    if (!geojson) return []
    const features = this.addData(geojson, sync)
    this._geojson = geojson
    this._needsFetch = false
    this.onDataLoaded()
    this.dataChanged()
    return features
  }

  onDataLoaded() {
    this.renderLegend()
  }

  async fromUmapGeoJSON(geojson) {
    if (geojson._storage) {
      // Retrocompat
      geojson._umap_options = geojson._storage
      delete geojson._storage
    }
    if (geojson._umap_options) this.setProperties(geojson._umap_options)
    if (this.isRemoteLayer()) {
      await this.fetchRemoteData()
    } else {
      this.fromGeoJSON(geojson, false)
    }
  }

  backupData() {
    if (this._geojson) {
      this._geojson_bk = Utils.CopyJSON(this._geojson)
    }
  }

  showAtZoom() {
    const from = Number.parseInt(this.properties.fromZoom, 10)
    const to = Number.parseInt(this.properties.toZoom, 10)
    const zoom = this._leafletMap.getZoom()
    return !((!Number.isNaN(from) && zoom < from) || (!Number.isNaN(to) && zoom > to))
  }

  hasDynamicData() {
    return this.isRemoteLayer() && Boolean(this.properties.remoteData?.dynamic)
  }

  async getUrl(url, initialUrl) {
    const response = await this._umap.request.get(url)
    return new Promise((resolve) => {
      if (response?.ok) {
        this._umap.modifiedAt = response.headers.get('last-modified')
        return resolve(response.text())
      }
      Alert.error(
        translate('Cannot load remote data for layer "{layer}" with url "{url}"', {
          layer: this.getName(),
          url: initialUrl || url,
        })
      )
    })
  }

  async fetchRemoteData(force) {
    if (!this.isRemoteLayer()) return
    if (!this.hasDynamicData() && this.isLoaded() && !force) return
    if (!this.isVisible()) return
    // Keep non proxied url for later use in Alert.
    const remoteUrl = this._umap.renderUrl(this.properties.remoteData.url)
    let url = remoteUrl
    if (this.properties.remoteData.proxy) {
      url = this._umap.proxyUrl(url, this.properties.remoteData.ttl)
    }
    return await this.getUrl(url, remoteUrl).then((raw) => {
      this.clear(false)
      return this._umap.formatter
        .parse(raw, this.properties.remoteData.format)
        .then((geojson) => this.fromGeoJSON(geojson, false))
        .catch((error) => {
          console.debug(error)
          Alert.error(
            translate('Cannot parse remote data for layer "{layer}" with url "{url}"', {
              layer: this.getName(),
              url: remoteUrl,
            })
          )
        })
    })
  }

  isLoaded() {
    return !this._needsFetch
  }

  setProperties(properties) {
    delete properties.geojson
    this.properties = Utils.CopyJSON(this.defaultProperties) // Start from fresh.
    this.updateProperties(properties)
  }

  updateProperties(properties) {
    this.properties = Object.assign(this.properties, properties)
    this.resetLayer()
  }

  connectToMap() {
    this._umap.datalayers.add(this)
    this._umap.onDataLayersChanged()
  }

  _dataUrl() {
    let url = this._umap.urls.get('datalayer_view', {
      pk: this.id,
      map_id: this._umap.id,
    })

    // No browser cache for owners/editors.
    if (this._umap.hasEditMode()) url = `${url}?${Date.now()}`
    return url
  }

  isRemoteLayer() {
    return Boolean(this.properties.remoteData?.url && this.properties.remoteData.format)
  }

  isClustered() {
    return this.properties.type === 'Cluster'
  }

  showFeature(feature) {
    if (feature.isFiltered()) return
    this.layer.addLayer(feature.ui)
  }

  hideFeature(feature) {
    this.layer.removeLayer(feature.ui)
  }

  addFeature(feature) {
    feature.connectToDataLayer(this)
    this.features.add(feature)
    this._umap.featuresIndex[feature.getSlug()] = feature
    // TODO: quid for remote data ?
    this.inferFields(feature)
    this.showFeature(feature)
    this.dataChanged()
  }

  removeFeature(feature, sync) {
    // This feature was not yet added, may be after
    // hitting Escape while drawing a new line or
    // polygon, not yet valid (not enough points)
    if (!this.features.has(feature.id)) return
    if (sync !== false) {
      const oldValue = feature.toGeoJSON()
      feature.sync.delete(oldValue)
    }
    this.hideFeature(feature)
    delete this._umap.featuresIndex[feature.getSlug()]
    feature.disconnectFromDataLayer(this)
    this.features.del(feature)
    if (this.isVisible()) this.dataChanged()
  }

  inferFields(feature) {
    if (!this.properties.fields) this.properties.fields = []
    const keys = this.fieldKeys
    for (const key in feature.properties) {
      if (typeof feature.properties[key] !== 'object') {
        if (key.indexOf('_') === 0) continue
        if (keys.includes(key)) continue
        this.properties.fields.push({ key, type: 'String' })
      }
    }
  }

  async confirmDeleteProperty(property) {
    return this._umap.dialog
      .confirm(
        translate('Are you sure you want to delete this field on all the features?')
      )
      .then(() => {
        this.deleteProperty(property)
      })
  }

  async askForRenameProperty(property) {
    return this._umap.dialog
      .prompt(translate('Please enter the new name of this field'))
      .then(({ prompt }) => {
        if (!prompt || !this.validateName(prompt)) return
        this.renameProperty(property, prompt)
      })
  }

  renameProperty(oldName, newName) {
    this.sync.startBatch()
    const oldFields = Utils.CopyJSON(this.fields)
    for (const field of this.fields) {
      if (field.key === oldName) {
        field.key = newName
        break
      }
    }
    this.sync.update('properties.fields', this.fields, oldFields)
    this.features.forEach((feature) => {
      feature.renameProperty(oldName, newName)
    })
    this.sync.commitBatch()
  }

  deleteProperty(property) {
    this.sync.startBatch()
    const oldFields = Utils.CopyJSON(this.fields)
    this.fields = this.fields.filter((field) => field.key !== property)
    this.sync.update('properties.fields', this.fields, oldFields)
    this.features.forEach((feature) => {
      feature.deleteProperty(property)
    })
    this.sync.commitBatch()
  }

  addProperty() {
    let resolve = undefined
    const promise = new Promise((r) => {
      resolve = r
    })
    this._umap.dialog
      .prompt(translate('Please enter the name of the property'))
      .then(({ prompt }) => {
        if (!prompt || !this.validateName(prompt)) return
        this.properties.fields.push({ key: prompt, type: 'String' })
        resolve()
      })
    return promise
  }

  validateName(name) {
    if (name.includes('.')) {
      Alert.error(translate('Name “{name}” should not contain a dot.', { name }))
      return false
    }
    if (this.fieldKeys.includes(name)) {
      Alert.error(translate('This name already exists: “{name}”', { name }))
      return false
    }
    return true
  }

  sortedValues(property) {
    return this.features
      .all()
      .map((feature) => feature.properties[property])
      .filter((val, idx, arr) => arr.indexOf(val) === idx)
      .sort(Utils.naturalSort)
  }

  addData(geojson, sync) {
    let data = []
    this._batch = true
    try {
      // Do not fail if remote data is somehow invalid,
      // otherwise the layer becomes uneditable.
      data = this.makeFeatures(geojson, sync)
    } catch (err) {
      console.debug('Error with DataLayer', this.id)
      console.error(err)
    }
    this._batch = false
    this.dataChanged()
    return data
  }

  makeFeatures(geojson = {}, sync = true) {
    if (geojson.type === 'Feature' || geojson.coordinates) {
      geojson = [geojson]
    }
    const collection = Array.isArray(geojson)
      ? geojson
      : geojson.features || geojson.geometries
    if (!collection) return
    const features = []
    Utils.sortFeatures(collection, this.sortKey, U.lang)
    for (const featureJson of collection) {
      if (featureJson.geometry?.type === 'GeometryCollection') {
        for (const geometry of featureJson.geometry.geometries) {
          const feature = this.makeFeature({
            type: 'Feature',
            geometry,
            properties: featureJson.properties,
          })
          if (feature) features.push(feature)
        }
      } else {
        const feature = this.makeFeature(featureJson, sync)
        if (feature) features.push(feature)
      }
    }
    return features
  }

  makeFeature(geojson = {}, sync = true, id = null) {
    // Both Feature and Geometry are valid geojson objects.
    const geometry = geojson.geometry || geojson
    let feature

    switch (geometry.type) {
      case 'Point':
        // FIXME: deal with MultiPoint
        feature = new Point(this._umap, this, geojson, id)
        break
      case 'MultiPoint':
        if (geometry.coordinates?.length === 1) {
          geojson.geometry.coordinates = geojson.geometry.coordinates[0]
          feature = new Point(this._umap, this, geojson, id)
        } else if (this._umap.editEnabled) {
          Alert.error(translate('Cannot process MultiPoint'))
        }
        break
      case 'MultiLineString':
      case 'LineString':
        feature = new LineString(this._umap, this, geojson, id)
        break
      case 'MultiPolygon':
      case 'Polygon':
        feature = new Polygon(this._umap, this, geojson, id)
        break
      default:
        console.debug(geojson)
        if (this._umap.editEnabled) {
          Alert.error(
            translate('Skipping unknown geometry.type: {type}', {
              type: geometry.type || 'undefined',
            })
          )
        }
    }
    if (feature && !feature.isEmpty()) {
      this.addFeature(feature)
      if (sync) feature.sync.upsert(feature.toGeoJSON(), null)
      return feature
    }
  }

  async importRaw(raw, format) {
    return this._umap.formatter
      .parse(raw, format)
      .then((geojson) => {
        this.sync.startBatch()
        const data = this.addData(geojson)
        this.sync.commitBatch()
        return data
      })
      .catch((error) => {
        console.debug(error)
        Alert.error(translate('Import failed: invalid data'))
      })
  }

  readFile(f) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsText(f)
    })
  }

  async importFromFiles(files, type) {
    const toLoad = []
    for (const file of files) {
      toLoad.push(this.importFromFile(file, type))
    }
    const features = await Promise.all(toLoad)
    return new Promise((resolve) => {
      resolve([].concat(...features))
    })
  }

  async importFromFile(file, type) {
    type = type || Utils.detectFileType(f)
    const raw = await this.readFile(file)
    return this.importRaw(raw, type)
  }

  async importFromUrl(uri, type) {
    uri = this._umap.renderUrl(uri)
    return await this.getUrl(uri).then((raw) => {
      return this.importRaw(raw, type)
    })
  }

  getColor() {
    return this.properties.color || this._umap.getProperty('color')
  }

  getDeleteUrl() {
    return this._umap.urls.get('datalayer_delete', {
      pk: this.id,
      map_id: this._umap.id,
    })
  }

  getVersionsUrl() {
    return this._umap.urls.get('datalayer_versions', {
      pk: this.id,
      map_id: this._umap.id,
    })
  }

  getVersionUrl(ref) {
    return this._umap.urls.get('datalayer_version', {
      pk: this.id,
      map_id: this._umap.id,
      ref: ref,
    })
  }

  del(sync = true) {
    const oldValue = Utils.CopyJSON(this.umapGeoJSON())
    // TODO merge datalayer del and features del in same
    // batch
    this.clear()
    if (sync) {
      this.isDeleted = true
      this.sync.delete(oldValue)
    }
    this.hide()
    this.parentPane.removeChild(this.pane)
    this._umap.onDataLayersChanged()
    this.layer.onDelete(this._leafletMap)
    this.propagateDelete()
    this._leaflet_events_bk = this._leaflet_events
  }

  empty() {
    if (this.isRemoteLayer()) return
    this.sync.startBatch()
    this.clear()
    this.sync.commitBatch()
  }

  clear(sync = true) {
    this.features.forEach((feature) => feature.del(sync))
    this.dataChanged()
  }

  clone() {
    const properties = Utils.CopyJSON(this.properties)
    properties.name = translate('Clone of {name}', { name: this.properties.name })
    delete properties.id
    const geojson = Utils.CopyJSON(this._geojson)
    const datalayer = this._umap.createDirtyDataLayer(properties)
    datalayer.fromGeoJSON(geojson)
    return datalayer
  }

  redraw() {
    if (!this.isVisible()) return
    this.features.forEach((feature) => feature.redraw())
  }

  reindex() {
    this.features.sort(this.sortKey)
    if (this.isBrowsable()) {
      this.resetLayer(true)
    }
  }

  _editMetadata(container) {
    const metadataFields = [
      'properties.name',
      'properties.description',
      [
        'properties.type',
        { handler: 'LayerTypeChooser', label: translate('Type of layer') },
      ],
      'properties.labelKey',
      [
        'properties.displayOnLoad',
        { label: translate('Display on load'), handler: 'Switch' },
      ],
      [
        'properties.browsable',
        {
          label: translate('Data is browsable'),
          handler: 'Switch',
          helpEntries: ['browsable'],
        },
      ],
      [
        'properties.inCaption',
        {
          label: translate('Show this layer in the caption'),
          handler: 'Switch',
        },
      ],
    ]
    DomUtil.createTitle(container, translate('Layer properties'), 'icon-layers')
    const builder = new MutatingForm(this, metadataFields)
    builder.on('set', ({ detail }) => {
      this._umap.onDataLayersChanged()
      if (detail.helper.field === 'properties.type') {
        this.edit().then((panel) => panel.scrollTo('details#layer-properties'))
      }
    })
    container.appendChild(builder.build())
  }

  _editLayerProperties(container) {
    const layerFields = this.layer.getEditableProperties()

    if (layerFields.length) {
      const builder = new MutatingForm(this, layerFields)
      const template = `
        <details id="layer-properties">
          <summary>${this.layer.getName()}: ${translate('settings')}</summary>
          <fieldset data-ref=fieldset></fieldset>
        </details>
      `
      const [details, { fieldset }] = Utils.loadTemplateWithRefs(template)
      container.appendChild(details)
      fieldset.appendChild(builder.build())
    }
  }

  _editShapeProperties(container) {
    const fields = [
      'properties.color',
      'properties.iconClass',
      'properties.iconSize',
      'properties.iconUrl',
      'properties.iconOpacity',
      'properties.opacity',
      'properties.stroke',
      'properties.weight',
      'properties.fill',
      'properties.fillColor',
      'properties.fillOpacity',
    ]

    const builder = new MutatingForm(this, fields, {
      id: 'datalayer-advanced-properties',
    })
    const shapeFieldset = DomUtil.createFieldset(
      container,
      translate('Shape properties')
    )
    shapeFieldset.appendChild(builder.build())
  }

  _editAdvancedProperties(container) {
    const fields = [
      'properties.smoothFactor',
      'properties.dashArray',
      'properties.zoomTo',
      'properties.fromZoom',
      'properties.toZoom',
      'properties.sortKey',
    ]

    const builder = new MutatingForm(this, fields, {
      id: 'datalayer-advanced-properties',
    })
    builder.on('set', ({ detail }) => {
      if (detail.helper.field === 'properties.sortKey') {
        this.reindex()
      }
    })
    const advancedFieldset = DomUtil.createFieldset(
      container,
      translate('Advanced properties')
    )
    advancedFieldset.appendChild(builder.build())
  }

  _editInteractionProperties(container) {
    const fields = [
      'properties.popupShape',
      'properties.popupTemplate',
      'properties.popupContentTemplate',
      'properties.showLabel',
      'properties.labelDirection',
      'properties.labelInteractive',
      'properties.outlinkTarget',
      'properties.interactive',
    ]
    const builder = new MutatingForm(this, fields)
    const popupFieldset = DomUtil.createFieldset(
      container,
      translate('Interaction options')
    )
    popupFieldset.appendChild(builder.build())
  }

  _editTextPathProperties(container) {
    const fields = [
      'properties.textPath',
      'properties.textPathColor',
      'properties.textPathRepeat',
      'properties.textPathRotate',
      'properties.textPathSize',
      'properties.textPathOffset',
      'properties.textPathPosition',
    ]
    const builder = new MutatingForm(this, fields)
    const fieldset = DomUtil.createFieldset(container, translate('Line decoration'))
    fieldset.appendChild(builder.build())
  }

  _editFields(container) {
    const template = `
      <details id="fields">
        <summary>${translate('Manage Fields')}</summary>
        <fieldset>
          <ul data-ref=ul></ul>
          <button type="button" data-ref=add><i class="icon icon-16 icon-add"></i>${translate('Add a new field')}</button>
        </fieldset>
      </details>
    `
    const [fieldset, { ul, add }] = Utils.loadTemplateWithRefs(template)
    add.addEventListener('click', () => {
      this.addProperty().then(() => {
        this.edit().then((panel) => {
          panel.scrollTo('details#fields')
        })
      })
    })
    container.appendChild(fieldset)
    for (const field of this.fields) {
      const [row, { rename, del }] = Utils.loadTemplateWithRefs(
        `<li class="orderable" data-key="${field.key}">
          <button class="icon icon-16 icon-edit" title="${translate('Rename this field')}" data-ref=rename></button>
          <button class="icon icon-16 icon-delete" title="${translate('Delete this field')}" data-ref=del></button>
          <i class="icon icon-16 icon-drag" title="${translate('Drag to reorder')}"></i>
          ${field.key}
        </li>`
      )
      ul.appendChild(row)
      rename.addEventListener('click', () => {
        this.askForRenameProperty(field.key).then(() => {
          this.edit().then((panel) => {
            panel.scrollTo('details#fields')
          })
        })
      })
      del.addEventListener('click', () => {
        this.confirmDeleteProperty(field.key).then(() => {
          this.edit().then((panel) => {
            panel.scrollTo('details#fields')
          })
        })
      })
    }
    const onReorder = (src, dst, initialIndex, finalIndex) => {
      const orderedKeys = Array.from(ul.querySelectorAll('li')).map(
        (el) => el.dataset.key
      )
      const oldFields = Utils.CopyJSON(this.properties.fields)
      this.properties.fields.sort(
        (fieldA, fieldB) =>
          orderedKeys.indexOf(fieldA.key) > orderedKeys.indexOf(fieldB.key)
      )
      this.sync.update('properties.fields', this.properties.fields, oldFields)
    }
    const orderable = new Orderable(ul, onReorder)
  }

  _editRemoteDataProperties(container) {
    // XXX I'm not sure **why** this is needed (as it's set during `this.initialize`)
    // but apparently it's needed.
    if (!Utils.isObject(this.properties.remoteData)) {
      this.properties.remoteData = {}
    }

    const fields = [
      [
        'properties.remoteData.url',
        { handler: 'Url', label: translate('Url'), helpEntries: ['formatURL'] },
      ],
      [
        'properties.remoteData.format',
        { handler: 'DataFormat', label: translate('Format') },
      ],
      'properties.fromZoom',
      'properties.toZoom',
      [
        'properties.remoteData.dynamic',
        {
          handler: 'Switch',
          label: translate('Dynamic'),
          helpEntries: ['dynamicRemoteData'],
        },
      ],
      [
        'properties.remoteData.licence',
        {
          label: translate('Licence'),
          helpText: translate('Please be sure the licence is compliant with your use.'),
        },
      ],
    ]
    if (this._umap.properties.urls.ajax_proxy) {
      fields.push([
        'properties.remoteData.proxy',
        {
          handler: 'Switch',
          label: translate('Proxy request'),
          helpEntries: ['proxyRemoteData'],
        },
      ])
      fields.push('properties.remoteData.ttl')
    }

    const remoteDataContainer = DomUtil.createFieldset(
      container,
      translate('Remote data')
    )
    const builder = new MutatingForm(this, fields)
    remoteDataContainer.appendChild(builder.build())
    DomUtil.createButton(
      'button umap-verify',
      remoteDataContainer,
      translate('Verify remote URL'),
      () => this.fetchRemoteData(true),
      this
    )
  }

  _buildAdvancedActions(container) {
    const advancedActions = DomUtil.createFieldset(
      container,
      translate('Advanced actions')
    )
    const filename = `${Utils.slugify(this.properties.name)}.geojson`
    const tpl = `
    <div class="button-bar half">
      <button class="button" type="button" data-ref=del>
        <i class="icon icon-24 icon-delete"></i>${translate('Delete')}
      </button>
      <button class="button" type="button" data-ref=empty hidden>
        <i class="icon icon-24 icon-empty"></i>${translate('Empty')}
      </button>
      <button class="button" type="button" data-ref=clone>
        <i class="icon icon-24 icon-clone"></i>${translate('Clone')}
      </button>
      <a class="button" href="${this._dataUrl()}" download="${filename}" data-ref=download hidden>
        <i class="icon icon-24 icon-download"></i>${translate('Download')}
      </a>
    </div>
    `
    const [bar, { del, empty, clone, download }] = Utils.loadTemplateWithRefs(tpl)
    advancedActions.appendChild(bar)
    del.addEventListener('click', () => {
      this.del()
      this._umap.editPanel.close()
    })

    if (!this.isRemoteLayer()) {
      empty.hidden = false
      empty.addEventListener('click', () => this.empty())
    }
    clone.addEventListener('click', () => this.clone().edit())
    if (this.createdOnServer) download.hidden = false
  }

  edit() {
    if (!this._umap.editEnabled) {
      return
    }
    const container = DomUtil.create('div', 'umap-layer-properties-container')
    this._editMetadata(container)
    this._editLayerProperties(container)
    this._editShapeProperties(container)
    this._editAdvancedProperties(container)
    this._editInteractionProperties(container)
    this._editTextPathProperties(container)
    this._editRemoteDataProperties(container)
    if (!this.isRemoteLayer()) {
      this._editFields(container)
    }
    this.rules.edit(container)

    if (this._umap.properties.urls.datalayer_versions) {
      this.buildVersionsFieldset(container)
    }

    this._buildAdvancedActions(container)

    const backButton = DomUtil.createButtonIcon(
      undefined,
      'icon-back',
      translate('Back to layers')
    )
    // Fixme: remove me when this is merged and released
    // https://github.com/Leaflet/Leaflet/pull/9052
    DomEvent.disableClickPropagation(backButton)
    DomEvent.on(backButton, 'click', this._umap.editDatalayers, this._umap)

    return this._umap.editPanel.open({
      content: container,
      highlight: 'layers',
      actions: [backButton],
    })
  }

  getOwnProperty(option) {
    if (Utils.usableOption(this.properties, option)) return this.properties[option]
  }

  getProperty(key, feature) {
    if (this.layer?.getOption) {
      const value = this.layer.getOption(key, feature)
      if (value !== undefined) return value
    }
    if (feature) {
      const value = this.rules.getOption(key, feature)
      if (value !== undefined) return value
    }
    if (this.getOwnProperty(key) !== undefined) {
      return this.getOwnProperty(key)
    }
    if (this.layer?.defaults?.[key]) {
      return this.layer.defaults[key]
    }
    return this._umap.getProperty(key, feature)
  }

  getOption(key, feature) {
    // TODO: remove when field.js does not call blindly obj.getOption anymore
    return this.getProperty(key, feature)
  }

  async buildVersionsFieldset(container) {
    const appendVersion = (data) => {
      const date = new Date(Number.parseInt(data.at, 10))
      const content = `${date.toLocaleString(U.lang)} (${Number.parseInt(data.size) / 1000}Kb)`
      const [el, { button }] = Utils.loadTemplateWithRefs(
        `<div class="umap-datalayer-version">
          <button type="button" title="${translate('Restore this version')}" data-ref=button>
            <i class="icon icon-16 icon-restore"></i> ${content}
          </button>
        </div>`
      )
      versionsContainer.appendChild(el)
      button.addEventListener('click', () => this.restore(data.ref))
    }

    const versionsContainer = DomUtil.createFieldset(container, translate('Versions'), {
      async callback() {
        const [{ versions }, response, error] = await this._umap.server.get(
          this.getVersionsUrl()
        )
        if (!error) versions.forEach(appendVersion)
      },
      context: this,
    })
  }

  async restore(version) {
    if (!this._umap.editEnabled) return
    this._umap.dialog
      .confirm(translate('Are you sure you want to restore this version?'))
      .then(async () => {
        const [geojson, response, error] = await this._umap.server.get(
          this.getVersionUrl(version)
        )
        if (!error) {
          if (geojson._storage) {
            // Retrocompat.
            geojson._umap_options = geojson._storage
            delete geojson._storage
          }
          if (geojson._umap_options) {
            const oldProperties = Utils.CopyJSON(this.properties)
            this.setProperties(geojson._umap_options)
            this.sync.update('properties', this.properties, oldProperties)
          }
          this.empty()
          if (this.isRemoteLayer()) {
            this.fetchRemoteData()
          } else {
            this.sync.startBatch()
            this.addData(geojson)
            this.sync.commitBatch()
          }
        }
      })
  }

  async show() {
    this._leafletMap.addLayer(this.layer)
    if (!this.isLoaded()) await this.fetchData()
    this.propagateShow()
  }

  hide() {
    this._leafletMap.removeLayer(this.layer)
    this.propagateHide()
  }

  toggle(force) {
    // From now on, do not try to how/hide
    // automatically this layer, as user
    // has taken control on this.
    this._forcedVisibility = true
    let display = force
    if (force === undefined) {
      if (!this.isVisible()) display = true
      else display = false
    }
    if (display) this.show()
    else this.hide()
    this._umap.bottomBar.redraw()
  }

  zoomTo() {
    if (!this.isVisible()) return
    const bounds = this.layer.getBounds()
    this.zoomToBounds(bounds)
  }

  zoomToBounds(bounds) {
    if (bounds.isValid()) {
      const options = { maxZoom: this.getProperty('zoomTo') }
      this._leafletMap.fitBounds(bounds, options)
    }
  }

  // Is this layer type browsable in theorie
  isBrowsable() {
    return this.layer?.browsable
  }

  // Is this layer browsable in theorie
  // AND the user allows it
  allowBrowse() {
    return !!this.properties.browsable && this.isBrowsable()
  }

  // Is this layer browsable in theorie
  // AND the user allows it
  // AND it makes actually sense (is visible, it has data…)
  canBrowse() {
    return this.allowBrowse() && this.isVisible() && this.hasData()
  }

  count() {
    return this.features.count()
  }

  hasData() {
    return !!this.count()
  }

  isVisible() {
    return Boolean(this.layer && this._leafletMap.hasLayer(this.layer))
  }

  getNextFeature(feature) {
    return this.features.next(feature) || this.getNextBrowsable().features.first()
  }

  getPreviousFeature(feature) {
    return this.features.prev(feature) || this.getPreviousBrowsable().features.last()
  }

  getPreviousBrowsable() {
    return this._umap.datalayers.prev(this)
  }

  getNextBrowsable() {
    return this._umap.datalayers.next(this)
  }

  umapGeoJSON() {
    const geojson = this._umap.formatter.toFeatureCollection(this.features.all())
    geojson._umap_options = this.properties
    return geojson
  }

  getDOMOrder() {
    return Array.from(this.parentPane.children).indexOf(this.pane)
  }

  isReadOnly() {
    // isReadOnly must return true if unset
    return this.properties.editMode === 'disabled'
  }

  isDataReadOnly() {
    // This layer cannot accept features
    return this.isReadOnly() || this.isRemoteLayer()
  }

  setReferenceVersion({ response, sync }) {
    this._referenceVersion = response.headers.get('X-Datalayer-Version')
    if (sync) {
      this.sync.update('_referenceVersion', this._referenceVersion, null, {
        undo: false,
      })
    }
  }

  prepareProperties() {
    const properties = Utils.CopyJSON(this.properties)
    delete properties.permissions
    return JSON.stringify(properties)
  }

  async save() {
    if (this.isDeleted) return await this.saveDelete()
    if (!this.isRemoteLayer() && !this.isLoaded()) return
    const geojson = this.umapGeoJSON()
    const formData = new FormData()
    formData.append('name', this.properties.name)
    formData.append('display_on_load', !!this.properties.displayOnLoad)
    formData.append('rank', this.rank)
    formData.append('settings', this.prepareProperties())
    // Filename support is shaky, don't do it for now.
    const blob = new Blob([JSON.stringify(geojson)], { type: 'application/json' })
    formData.append('geojson', blob)
    const saveURL = this._umap.urls.get('datalayer_save', {
      map_id: this._umap.id,
      pk: this.id,
      created: this.createdOnServer,
    })
    const headers = this._referenceVersion
      ? { 'X-Datalayer-Reference': this._referenceVersion }
      : {}
    const status = await this._trySave(saveURL, headers, formData)
    this._geojson = geojson
    return status
  }

  async _trySave(url, headers, formData) {
    if (this._forceSave) {
      headers = {}
      this._forceSave = false
    }
    const [data, response, error] = await this._umap.server.post(url, headers, formData)
    if (error) {
      if (response && response.status === 412) {
        AlertConflict.error(
          translate(
            'Whoops! Other contributor(s) changed some of the same map elements as you. ' +
              'This situation is tricky, you have to choose carefully which version is pertinent.'
          ),
          async () => {
            this._forceSave = true
            await this._umap.saveAll()
          }
        )
      } else {
        console.debug(error)
        Alert.error(translate('Cannot save layer, please try again in a few minutes.'))
      }
    } else {
      // Response contains geojson only if save has conflicted and conflicts have
      // been resolved. So we need to reload to get extra data (added by someone else)
      if (data.geojson) {
        this.clear(false)
        this.fromGeoJSON(data.geojson)
        delete data.geojson
      }
      delete data.id
      delete data._referenceVersion
      this.updateProperties(data)

      this.setReferenceVersion({ response, sync: true })

      this.backupData()
      this.connectToMap()
      this.redraw() // Needed for reordering features
      return true
    }
  }

  async saveDelete() {
    if (this.createdOnServer) {
      await this._umap.server.post(this.getDeleteUrl())
    }
    this.commitDelete()
    return true
  }

  commitDelete() {
    delete this._umap.datalayers[this.id]
  }

  getName() {
    return this.properties.name || translate('Untitled layer')
  }

  getPermalink() {
    return `${Utils.getBaseUrl()}?${Utils.buildQueryString({ datalayers: this.id })}${
      window.location.hash
    }`
  }

  tableEdit() {
    if (!this.isVisible()) return
    const editor = new TableEditor(this._umap, this, this._leafletMap)
    editor.open()
  }

  getFilterKeys() {
    // This keys will be used to filter feature from the browser text input.
    // By default, it will we use the "name" property, which is also the one used as label in the features list.
    // When map owner has configured another label or sort key, we try to be smart and search in the same keys.
    if (this._umap.properties.filterKey) return this._umap.properties.filterKey
    if (this.getProperty('labelKey')) return this.getProperty('labelKey')
    if (this._umap.properties.sortKey) return this._umap.properties.sortKey
    return 'displayName'
  }

  renderLegend() {
    for (const container of document.querySelectorAll(
      `.${this.cssId} .datalayer-legend`
    )) {
      container.innerHTML = ''
      if (this.layer.renderLegend) return this.layer.renderLegend(container)
      const keys = new Set(this.fieldKeys)
      const rules = new Map()
      for (const rule of this.rules) {
        rules.set(rule.condition, rule)
      }
      for (const rule of this._umap.rules) {
        if (!rules.has(rule.condition) && keys.has(rule.key)) {
          rules.set(rule.condition, rule)
        }
      }
      if (rules.size) {
        const ul = Utils.loadTemplate('<ul class="rules-caption"></ul>')
        container.appendChild(ul)
        for (const [_, rule] of rules) {
          rule.renderLegend(ul)
        }
      } else {
        const color = Utils.loadTemplate('<span class="datalayer-color"></span>')
        color.style.backgroundColor = this.getColor()
        container.appendChild(color)
      }
    }
  }

  renderToolbox(container) {
    const toggle = DomUtil.createButtonIcon(
      container,
      'icon-eye',
      translate('Show/hide layer')
    )
    const zoomTo = DomUtil.createButtonIcon(
      container,
      'icon-zoom',
      translate('Zoom to layer extent')
    )
    const edit = DomUtil.createButtonIcon(
      container,
      'icon-edit show-on-edit',
      translate('Edit')
    )
    const table = DomUtil.createButtonIcon(
      container,
      'icon-table show-on-edit',
      translate('Edit properties in a table')
    )
    const remove = DomUtil.createButtonIcon(
      container,
      'icon-delete show-on-edit',
      translate('Delete layer')
    )
    if (this.isReadOnly()) {
      container.classList.add('readonly')
    } else {
      edit.addEventListener('click', () => this.edit())
      table.addEventListener('click', () => this.tableEdit())
      remove.addEventListener('click', () => {
        if (!this.isVisible()) return
        this.del()
      })
    }
    DomEvent.on(toggle, 'click', () => this.toggle())
    DomEvent.on(zoomTo, 'click', this.zoomTo, this)
    container.classList.add(this.getHidableClass())
    container.classList.toggle('off', !this.isVisible())
  }

  getHidableElements() {
    return document.querySelectorAll(`.${this.getHidableClass()}`)
  }

  getHidableClass() {
    return `show_with_datalayer_${stamp(this)}`
  }

  propagateDelete() {
    const els = this.getHidableElements()
    for (const el of els) {
      DomUtil.remove(el)
    }
  }

  propagateRemote() {
    const els = this.getHidableElements()
    for (const el of els) {
      el.classList.toggle('remotelayer', this.isRemoteLayer())
    }
  }

  propagateHide() {
    const els = this.getHidableElements()
    for (let i = 0; i < els.length; i++) {
      DomUtil.addClass(els[i], 'off')
    }
  }

  propagateShow() {
    const els = this.getHidableElements()
    for (let i = 0; i < els.length; i++) {
      DomUtil.removeClass(els[i], 'off')
    }
  }
}
