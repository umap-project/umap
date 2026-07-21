import { Alert } from '../../components/alerts/alert.js'
import * as Clipboard from '../clipboard.js'
import * as DOMUtils from '../domutils.js'
import { MutatingForm } from '../form/builder.js'
import * as GeoUtils from '../geoutils.js'
import { getLocale, translate } from '../i18n.js'
import * as Icon from '../icon.js'
import * as Schema from '../schema.js'
import * as TextUtils from '../textutils.js'
import * as Utils from '../utils.js'

class Feature {
  constructor(app, datalayer, geojson = {}, id = null) {
    this.app = app

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

  get journal() {
    if (!this._journal) {
      this._journal = this.app.journalEngine.proxy(this)
    }
    return this._journal
  }

  get center() {
    return GeoUtils.center(this.geometry)
  }

  get bounds() {
    if (this.isEmpty()) return null
    return GeoUtils.bbox(this.geometry)
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
    return this.datalayer.inheritedFields.values()
  }

  setter(key, value) {
    if (key === 'datalayer') {
      this.changeDataLayer(value)
    } else {
      Utils.setObjectValue(this, key, value)
    }
  }

  isOnScreen(bounds) {
    bounds = bounds || this.app.mapProxy.bounds
    if (!this.bounds) return false
    return GeoUtils.bboxIntersects(bounds, this.bounds)
  }

  pushGeometry() {
    this.app.mapProxy.pushGeometry(this.datalayer.id, this.id, this.geometry)
  }

  toLatLngs() {
    return GeoUtils.flip(this.geometry).coordinates
  }

  getClassName() {
    return this.staticOptions.className
  }

  getUniqueClassName() {
    return `feature-${this.datalayer.id}-${this.id}`
  }

  getMainColor() {
    return this.staticOptions.mainColor
  }

  getPreviewColor() {
    return this.getDynamicOption(this.getMainColor())
  }

  getJournalMetadata() {
    return {
      subject: 'feature',
      metadata: {
        id: this.id,
        layerId: this.datalayer.id,
        featureType: this.getClassName(),
      },
    }
  }

  onCommit(geometry) {
    this._geometry_bk = Utils.CopyJSON(this._geometry)
    this._geometry = geometry
    // When the layer is a remote layer, we don't want to sync the creation of the
    // points via the websocket, as the other peers will get them themselves.
    if (this.datalayer?.isRemoteLayer()) return
    if (this._needs_upsert) {
      this.journal.upsert(this.toJournal(), null)
      this._needs_upsert = false
    } else {
      this.journal.update('geometry', this.geometry, this._geometry_bk)
    }
  }

  isReadOnly() {
    return this.datalayer?.isDataReadOnly()
  }

  getSlug() {
    return this.properties[this.app.getProperty('slugKey') || U.DEFAULT_LABEL_KEY] || ''
  }

  getPermalink() {
    const slug = this.getSlug()
    if (slug)
      return `${Utils.getBaseUrl()}?${Utils.buildQueryString({ feature: slug })}${
        window.location.hash
      }`
  }

  async buildCard() {
    const container = document.createElement('div')
    container.classList.add('umap-popup')
    const name = this.getOption('popupTemplate')
    const { default: loadTemplate } = await import('../rendering/template.js')
    const content = await loadTemplate(name, this, container)
    const elements = container.querySelectorAll('img,iframe')
    if (!elements.length && container.textContent.replace('\n', '') === '') {
      container.innerHTML = ''
      container.appendChild(
        DOMUtils.loadTemplate(Utils.sanitizeVars`<h3>${this.getDisplayName()}</h3>`)
      )
    }
    return container
  }

  view({ center } = {}) {
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
    if (this.app.slideshow) {
      this.app.slideshow.current = this
    }
    this.app.currentFeature = this
    this.buildCard().then((element) => {
      const popupShape = this.getOption('popupShape')
      if (popupShape === 'Panel') {
        this.app.fire('panel:show', { id: this.id, content: element })
      } else {
        this.app.fire('popup:show', {
          id: this.id,
          content: element,
          center: center || this.center,
          mode: popupShape === 'Large' ? 'large' : 'normal',
        })
      }
    })
  }

  render(fields) {
    const impactData = fields.some((field) => {
      return field.startsWith('properties.')
    })
    if (impactData) {
      Utils.eachElement(`.${this.getUniqueClassName()} .feature-title`, (el) => {
        el.textContent = this.getDisplayName()
        el.title = this.getDisplayName()
      })
      if (this.app.currentFeature === this) {
        this.view()
      }
    }
    const impactPreview = fields.some((field) => {
      return field.startsWith('properties._umap_options')
    })
    if (impactPreview) {
      Utils.eachElement(`.${this.getUniqueClassName()} .feature-color`, (el) => {
        this.makePreview(el)
      })
    }
    this.redraw()
  }

  edit(event) {
    if (!this.app.editEnabled || this.isReadOnly()) return
    if (this.app.editedFeature === this && !event?.force) return
    // If this feature is active (popup open), let's close it.
    this.deactivate()
    const container = DOMUtils.loadTemplate(`
      <div class="umap-feature-container">
        <h3><i class="icon icon-16 icon-${this.getClassName()}"></i> ${translate('Feature properties')}</h3>
      </div>
    `)

    // No need to journal the datalayer key, given we already do a delete/upsert when
    // it changes.
    let builder = new MutatingForm(this, [
      ['datalayer', { handler: 'FeatureDataLayerSwitcher', journal: false }],
    ])
    // removeLayer step will close the edit panel, let's reopen it
    builder.on('set', () => this.edit(event))
    builder.build().then((form) => container.appendChild(form))

    const properties = []
    for (const field of this.fields) {
      const options = { handler: 'Input', label: field.key }
      if (field.key === 'description' || field.TYPE === 'Text') {
        options.handler = 'Textarea'
        options.helpEntries = ['textFormatting']
      } else if (field.TYPE === 'Number') {
        options.handler = 'FloatInput'
      } else if (field.TYPE === 'Date') {
        options.handler = 'DateInput'
      } else if (field.TYPE === 'Datetime') {
        options.handler = 'DateTimeInput'
      } else if (field.TYPE === 'Boolean') {
        options.handler = 'Switch'
      } else if (field.TYPE === 'Enum') {
        options.helpText = translate('Comma separated list of values')
      }
      properties.push([`properties.${field.key}`, options])
    }
    builder = new MutatingForm(this, properties, {
      id: 'umap-feature-properties',
    })
    const onFormCreated = builder.build()
    onFormCreated.then((form) => {
      container.appendChild(form)
      const button = Utils.loadTemplate(
        `<button type="button"><i class="icon icon-16 icon-add"></i>${translate('Add a new field')}</button>`
      )
      button.addEventListener('click', () => {
        this.datalayer.fields.editField().then(() => this.edit({ force: true }))
      })
      form.appendChild(button)
      this.appendEditFieldsets(container)
      this.addAdvancedActions(container)
    })
    const onPanelLoaded = this.app.editPanel.open({ content: container })
    onPanelLoaded.then(() => {
      builder.form.querySelector('input')?.focus()
    })
    this.app.editedFeature = this
    this.app.fire('feature:edit', { id: this.id })
    return Promise.all([onFormCreated, onPanelLoaded]).then(([form, panel]) => panel)
  }

  addAdvancedActions(container) {
    const [details, { fieldset }] = Utils.loadTemplateWithRefs(`
      <details>
        <summary><h4>${translate('Advanced actions')}</h4></summary>
        <fieldset class="button-bar by2" data-ref=fieldset></fieldset>
      </details>
    `)
    container.appendChild(details)
    this.getAdvancedEditActions(fieldset)
  }

  toggleEditing() {
    if (this.app.editedFeature === this) {
      this.app.editPanel.close()
    } else {
      this.edit()
    }
  }

  endEdit() {
    this.app.fire('feature:endedit', { id: this.id })
  }

  getAdvancedEditActions(container) {
    const button = Utils.loadTemplate(`
      <button class="button" type="button">
        <i class="icon icon-24 icon-delete"></i>${translate('Delete')}
      </button>`)
    button.addEventListener('click', () => {
      this.del()
      this.app.editPanel.close()
    })
    container.appendChild(button)
  }

  addExtraEditFieldset(container) {}

  appendEditFieldsets(container) {
    const optionsFields = this.getShapeOptions()
    let builder = new MutatingForm(this, optionsFields, {
      id: 'umap-feature-shape-properties',
    })
    const shapeProperties = DOMUtils.createFieldset(
      container,
      translate('Shape properties')
    )
    builder.build().then((form) => shapeProperties.appendChild(form))

    this.addExtraEditFieldset(container)

    const advancedOptions = this.getAdvancedOptions()
    builder = new MutatingForm(this, advancedOptions, {
      id: 'umap-feature-advanced-properties',
    })
    const advancedProperties = DOMUtils.createFieldset(
      container,
      translate('Advanced properties')
    )
    builder.build().then((form) => advancedProperties.appendChild(form))

    const interactionOptions = this.getInteractionOptions()
    builder = new MutatingForm(this, interactionOptions)
    const popupFieldset = DOMUtils.createFieldset(
      container,
      translate('Interaction options')
    )
    builder.build().then((form) => popupFieldset.appendChild(form))
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
    return this.app.getProperty('displayPopupFooter')
  }

  del(sync) {
    this.endEdit()
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
    this.properties._umap_options = Object.assign(
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
      const oldDatalayer = this.datalayer
      oldDatalayer.removeFeature(this)
      oldDatalayer.redraw()
    }
    datalayer.addFeature(this)
    this.journal.upsert(this.toJournal())
    datalayer.redraw()
  }

  getOption(option, fallback) {
    let value = fallback
    if (typeof this.staticOptions[option] !== 'undefined') {
      value = this.staticOptions[option]
    } else if (Schema.isValidValue(this.properties._umap_options[option], option)) {
      value = this.properties._umap_options[option]
    } else if (this.datalayer) {
      value = this.datalayer.getProperty(option, this)
    } else {
      value = this.app.getProperty(option)
    }
    return value
  }

  getDynamicOption(key, fallback) {
    let value = this.getOption(key, fallback)
    // There is a variable inside.
    if (Utils.hasVar(value)) {
      value = Utils.greedyTemplate(value, this.properties, true)
      if (Utils.hasVar(value)) value = Schema.SCHEMA[key]?.default
    }
    return value
  }

  zoomTo({ easing, latlng, callback } = {}) {
    if (easing === undefined) easing = this.app.getProperty('easing')
    if (callback) this.app.once('map:moveend', (event) => callback.call(this, event))
    this.app.fire('map:view:set', {
      coordinates: latlng || this.center,
      zoom: this.getBestZoom(),
      easing,
    })
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
    const properties = Object.assign({}, this.properties)
    properties._umap_options = Object.assign({}, properties._umap_options)
    if (Object.keys && Object.keys(properties._umap_options).length === 0) {
      delete properties._umap_options // It can make a difference on big data sets
    }
    // Legacy
    delete properties._storage_options
    return properties
  }

  deleteField(name) {
    const oldValue = this.properties[name]
    delete this.properties[name]
    this.journal.update(`properties.${name}`, undefined, oldValue)
  }

  renameField(from, to) {
    const oldValue = this.properties[from]
    this.properties[to] = this.properties[from]
    this.deleteField(from)
    this.journal.update(`properties.${to}`, oldValue, undefined)
  }

  toGeoJSON() {
    return Utils.CopyJSON({
      type: 'Feature',
      geometry: this.geometry,
      properties: this.cloneProperties(),
    })
  }

  toJournal() {
    const geojson = this.toGeoJSON()
    geojson.id = this.id
    return geojson
  }

  getStyleProperties() {
    return [
      'smoothFactor',
      'color',
      'opacity',
      'stroke',
      'weight',
      'fill',
      'fillColor',
      'fillOpacity',
      'dashArray',
      'interactive',
      'shape',
      'radius',
      'iconClass',
      'iconUrl',
      'iconOpacity',
      'iconSize',
    ]
  }

  getRenderProperties() {
    const style = {}
    for (const option of this.getStyleProperties()) {
      style[option] = this.getDynamicOption(option)
    }
    style.highlight = {
      opacity: 1,
      fillOpacity: Math.sqrt(style.fillOpacity ?? 1),
      weight: 1.3 * style.weight,
    }
    return style
  }

  toRenderer() {
    const geojson = this.toGeoJSON()
    geojson.id = this.id
    geojson.style = this.getRenderProperties()
    geojson.readonly = this.isReadOnly()
    geojson.label = this.getLabel()
    // Per-feature values a Type computes as feature attributes (vs style), e.g. the heat weight.
    const attributes = this.datalayer.computed?.attributes?.[this.id]
    if (attributes) geojson.properties = { ...geojson.properties, ...attributes }
    // geojson.zIndex = this.datalayer.getDOMOrder()
    return geojson
  }

  getLabel() {
    return {
      text: this.getDisplayName(),
      show: this.getOption('showLabel'),
      hover: this.getOption('labelHover'),
      direction: this.getOption('labelDirection'),
      interactive: this.getOption('labelInteractive'),
    }
  }

  isFiltered() {
    const filterKeys = this.datalayer.getFilterKeys()
    const filter = this.app.browser?.options.filter
    if (filter && !this.matchFullTextFilter(filter, filterKeys)) return true
    for (const ancestor of this.datalayer.ancestry) {
      if (ancestor.filters.matchFeature(this)) return true
    }
    return false
  }

  matchFullTextFilter(filter, keys) {
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

  isMulti() {
    return false
  }

  isEmpty() {
    return !this.coordinates.length
  }

  clone() {
    const geojson = this.toGeoJSON()
    delete geojson.properties.id
    const feature = this.datalayer.makeFeature(geojson)
    feature.edit()
    return feature
  }

  extendedProperties() {
    // Include context properties
    const properties = this.app.mapProxy.getGeoContext()
    const locale = getLocale()
    if (locale) properties.locale = locale
    if (U.lang) properties.lang = U.lang
    properties.rank = this.getRank() + 1
    properties.layer = this.datalayer.getName()
    properties.id = this.id
    if (this.hasGeom()) {
      const [lng, lat, alt] = this.center
      properties.lat = lat
      properties.lon = lng
      properties.lng = lng
      properties.alt = alt
      properties.measure = this.measure
    }
    return Object.assign(properties, this.properties)
  }

  getRank() {
    return this.datalayer.features.getIndex(this)
  }

  redraw() {
    this.app.fire('feature:reset', {
      sourceId: this.datalayer.id,
      geojson: this.toRenderer(),
    })
  }

  onContextMenu({ lat, lng, pixel, vertex }) {
    const items = this.getContextMenu({ vertex }).concat(
      this.app.getSharedContextMenu({ lat, lng })
    )
    this.app.contextmenu.openAt(pixel, items)
  }

  getContextMenu(event) {
    const permalink = this.getPermalink()
    const items = []
    if (this.app.editEnabled && !this.isReadOnly()) {
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
        Clipboard.copy(JSON.stringify(this.toGeoJSON()))
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
        title: this.app.help.displayLabel('EDIT_FEATURE_LAYER', false),
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

  deactivate() {
    this.app.fire('popup:close')
  }

  makePreview(element) {
    element.innerHTML = ''
    const symbol = Icon.formatUrl(this.iconUrl, this.extendedProperties())
    const bgcolor = this.getPreviewColor()
    element.style.backgroundColor = bgcolor
    if (symbol && symbol !== Schema.SCHEMA.iconUrl.default) {
      const icon = Icon.makeElement(symbol, element)
      Icon.setContrast(icon, element, symbol, bgcolor)
    } else if (DOMUtils.contrastedColor(element, bgcolor)) {
      element.classList.add('icon-white')
    }
  }
}

export class Point extends Feature {
  constructor(app, datalayer, geojson, id) {
    super(app, datalayer, geojson, id)
    this.staticOptions = {
      mainColor: 'color',
      className: 'marker',
    }
  }

  get center() {
    return this.coordinates
  }

  hasGeom() {
    return Boolean(this.coordinates)
  }

  get iconUrl() {
    return this.getOption('iconUrl')
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
    const [lng, lat] = this.coordinates
    const latlng = { lat, lng }
    const coordinatesOptions = [
      ['lat', { handler: 'FloatInput', label: translate('Latitude') }],
      ['lng', { handler: 'FloatInput', label: translate('Longitude') }],
    ]
    const builder = new MutatingForm(latlng, coordinatesOptions, { app: this.app })
    builder.on('set', () => {
      const coordinates = [latlng.lng, latlng.lat]
      if (!Utils.coordinateIsValid(coordinates)) {
        Alert.error(translate('Invalid latitude or longitude'))
        return
      }
      this.onCommit({ type: 'Point', coordinates })
      this.pushGeometry()
      this.zoomTo({ easing: false })
    })
    const fieldset = DOMUtils.createFieldset(container, translate('Coordinates'))
    builder.build().then((form) => fieldset.appendChild(form))
  }
}

class Path extends Feature {
  hasGeom() {
    return !this.isEmpty()
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
      this.getOption('zoomTo') || this.app.mapProxy.getBoundsZoom(this.bounds, true)
    )
  }

  async _removeShapeAt(coordinate) {
    const index = await GeoUtils.shapeAt(this.geometry, coordinate)
    if (index === -1) return null
    const shapes = Utils.CopyJSON(this.coordinates)
    const [extracted] = shapes.splice(index, 1)
    const single = this.geometry.type.replace('Multi', '')
    this.geometry = {
      type: shapes.length > 1 ? this.geometry.type : single,
      coordinates: shapes.length > 1 ? shapes : shapes[0],
    }
    return extracted
  }

  appendShape(coordinates) {
    const oldGeometry = Utils.CopyJSON(this._geometry)
    const type = this.geometry.type
    const isMultiType = type.startsWith('Multi')
    this.geometry = {
      type: isMultiType ? type : `Multi${type}`,
      coordinates: isMultiType
        ? [...this.coordinates, coordinates]
        : [this.coordinates, coordinates],
    }
    this.journal.update('geometry', this.geometry, oldGeometry)
  }

  isolateShape(coordinate) {
    if (!this.isMulti()) return
    const oldGeometry = Utils.CopyJSON(this._geometry)
    return this.journal.update(
      'geometry',
      async () => {
        const extracted = await this._removeShapeAt(coordinate)
        if (!extracted) return
        const single = this.geometry.type.replace('Multi', '')
        this.datalayer
          .makeFeature({
            geometry: { type: single, coordinates: extracted },
            properties: this.cloneProperties(),
          })
          .edit()
        return this.geometry
      },
      oldGeometry
    )
  }

  deleteShape(coordinate) {
    if (!this.isMulti()) return
    const oldGeometry = Utils.CopyJSON(this._geometry)
    return this.journal.update(
      'geometry',
      async () => {
        const extracted = await this._removeShapeAt(coordinate)
        if (!extracted) return
        return this.geometry
      },
      oldGeometry
    )
  }

  transferShape(coordinate, to) {
    if (this.isMulti()) {
      const oldGeometry = Utils.CopyJSON(this._geometry)
      return this.journal.update(
        'geometry',
        async () => {
          const extracted = await this._removeShapeAt(coordinate)
          if (!extracted) return
          to.appendShape(extracted)
          return this.geometry
        },
        oldGeometry
      )
    }
    to.appendShape(Utils.CopyJSON(this.coordinates))
    this.del()
  }

  zoomTo({ easing, callback }) {
    // Use bounds instead of centroid for paths.
    easing = easing || this.app.getProperty('easing')
    const zoom = this.getBestZoom()
    this.app.fire('map:view:fit-bounds', { bounds: this.bounds, zoom, easing })
    if (callback) callback.call(this)
  }

  getContextMenu(event) {
    const items = super.getContextMenu(event)
    items.push({
      label: translate('Display measure'),
      action: () => Alert.info(this.measure),
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
            this.isolateShape(event.coordinate)
          },
        },
        {
          title: translate('Delete this shape'),
          icon: 'icon-delete-shape',
          action: () => this.deleteShape(event.coordinate),
        }
      )
    }
    if (this.app?.editedFeature !== this && this.isSameClass(this.app.editedFeature)) {
      items.push({
        title: translate('Transfer shape to edited feature'),
        icon: 'icon-transfer-shape',
        action: () => {
          this.transferShape(event.coordinate, this.app.editedFeature)
        },
      })
    }
    return items
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
    const fieldset = DOMUtils.createFieldset(container, translate('Line decoration'))
    builder.build().then((form) => fieldset.appendChild(form))
  }
}

export class LineString extends Path {
  constructor(app, datalayer, geojson, id) {
    super(app, datalayer, geojson, id)
    this.staticOptions = {
      stroke: true,
      fill: false,
      mainColor: 'color',
      className: 'polyline',
    }
  }

  get measure() {
    return TextUtils.readableDistance(
      GeoUtils.length(this.geometry, { units: 'meters' })
    )
  }

  isSameClass(other) {
    return other instanceof LineString
  }

  cancelRoute() {
    const oldRoute = Utils.CopyJSON(this.properties._umap_options.route)
    this.properties._umap_options.route.active = false
    this.redraw()
    // The feature is no longer a route
    this.edit({ force: true })
    this.journal.update('properties._umap_options.route', null, oldRoute)
  }

  restoreRoute() {
    const oldRoute = Utils.CopyJSON(this.properties._umap_options.route)
    this._ensureRoute()
    delete this.properties._umap_options.route.active
    this.redraw()
    this.journal.update(
      'properties._umap_options.route',
      this.properties._umap_options.route,
      oldRoute
    )
    this.edit({ force: true }).then((panel) => {
      panel.scrollTo('details#edit-route')
    })
  }

  toRoute() {
    this._ensureRoute()
    this.properties._umap_options.route.coordinates = Utils.CopyJSON(this.coordinates)
    this.redraw()
    this.journal.update(
      'properties._umap_options.route',
      this.properties._umap_options.route,
      null
    )
    this.edit({ force: true }).then((panel) => {
      panel.scrollTo('details#edit-route')
    })
  }

  async askForRouteSettings() {
    const container = Utils.loadTemplate(
      `<div><h3>${translate('Route settings')}</h3></div>`
    )
    container.appendChild(await this.routeForm())
    return this.app.dialog.open({ template: container })
  }

  toPolygon() {
    const geojson = this.toGeoJSON()
    geojson.geometry.type = 'Polygon'
    geojson.geometry.coordinates = [
      Utils.flattenCoordinates(geojson.geometry.coordinates),
    ]
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
      <button type="button"><i class="icon icon-24 icon-polygon"></i>${translate('Transform to polygon')}</button>
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
    if (this.app.properties.ORSAPIKey) {
      const button = Utils.loadTemplate(`
        <button class="button" type="button"><i class="icon icon-24 icon-mountain"></i>${translate('Compute elevations')}</button>
      `)
      container.appendChild(button)
      button.addEventListener('click', () => this.computeElevation())
    }
  }

  async _reduceMulti(previous, current) {
    if (!previous?.length) return current
    const previousStart = previous[0]
    const previousEnd = previous[previous.length - 1]
    const currentStart = current[0]
    const currentEnd = current[current.length - 1]
    // Compute distance between edges (start/end with all combinations)
    const ss = await GeoUtils.distance(previousStart, currentStart)
    const se = await GeoUtils.distance(previousStart, currentEnd)
    const ee = await GeoUtils.distance(previousEnd, currentEnd)
    const es = await GeoUtils.distance(previousEnd, currentStart)
    const shortest = Math.min(ss, ee, es, se)
    // Find the shortest distance
    switch (shortest) {
      case se:
        return [...current, ...previous]
      case es:
        return [...previous, ...current]
      case ee:
        return [...previous, ...[...current].reverse()]
      case ss:
        return [...[...current].reverse(), ...previous]
      default:
        throw new Error('Cannot compute merge orientation (invalid coordinates?)')
    }
  }

  mergeShapes() {
    if (!this.isMulti()) return
    const oldGeometry = Utils.CopyJSON(this._geometry)
    this.journal.update(
      'geometry',
      async () => {
        let coordinates = []
        for (const coords of this.geometry.coordinates) {
          coordinates = await this._reduceMulti(coordinates, coords)
        }
        this.geometry = await GeoUtils.cleanCoords({ type: 'LineString', coordinates })
        return this.geometry
      },
      oldGeometry
    )
  }

  isMulti() {
    return !GeoUtils.isFlat(this.coordinates) && this.coordinates.length > 1
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
        title: this.app.help.displayLabel('CONTINUE_LINE', false),
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
    const [gain, loss] = this.getElevation()
    return Object.assign({ gain, loss }, super.extendedProperties())
  }

  getElevation() {
    const lineElevation = (coords) => {
      let gain = 0
      let loss = 0
      for (let i = 0, n = coords.length - 1; i < n; i++) {
        const fromAlt = coords[i][2]
        const toAlt = coords[i + 1][2]
        if (fromAlt === undefined || toAlt === undefined) continue
        if (fromAlt > toAlt) loss += fromAlt - toAlt
        else gain += toAlt - fromAlt
      }
      return [gain, loss]
    }
    const { type, coordinates } = this.geometry
    const shapes = type === 'LineString' ? [coordinates] : coordinates
    let totalGain = 0
    let totalLoss = 0
    for (const shape of shapes) {
      const [gain, loss] = lineElevation(shape)
      totalGain += gain
      totalLoss += loss
    }
    return [Math.round(totalGain), Math.round(totalLoss)]
  }

  loadORS() {
    return import('../importers/openrouteservice.js')
  }

  async _ensureRoute() {
    if (!this.properties._umap_options.route) {
      this.properties._umap_options.route = {}
    }
    return this.loadORS().then(({ PROFILES, PREFERENCES }) => {
      this.properties._umap_options.route.profile ??= PROFILES[0][0]
      this.properties._umap_options.route.preference ??= PREFERENCES[0][0]
      this.properties._umap_options.route.elevation ??= false
      this.properties._umap_options.route.coordinates ??= []
      return { PROFILES, PREFERENCES }
    })
  }

  async routeForm() {
    return this._ensureRoute().then(async ({ PROFILES, PREFERENCES }) => {
      const metadatas = [
        [
          'profile',
          {
            handler: 'Select',
            selectOptions: PROFILES,
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
            selectOptions: PREFERENCES,
            label: translate('Route preference'),
          },
        ],
      ]
      const form = new MutatingForm(this.properties._umap_options.route, metadatas, {
        app: this.app,
      })
      return await form.build()
    })
  }

  async _editRoute(container) {
    const template = `
        <details id="edit-route">
          <summary>${translate('Route settings')}</summary>
          <fieldset data-ref=fieldset></fieldset>
        </details>
      `
    const [details, { fieldset }] = Utils.loadTemplateWithRefs(template)
    container.appendChild(details)
    fieldset.appendChild(await this.routeForm())
    const button = Utils.loadTemplate(
      `<button data-ref=button type="button">${translate('Compute route')}</button>`
    )
    fieldset.appendChild(button)
    button.addEventListener('click', async () => this.computeRoute())
  }

  computeElevation() {
    if (!this.app.properties.ORSAPIKey) return
    const oldGeometry = Utils.CopyJSON(this._geometry)
    this.journal.update(
      'geometry',
      async () => {
        const { Importer } = await this.loadORS()
        const importer = new Importer(this.app)
        const geometry = await importer.elevation(this.geometry)
        if (!geometry?.type) return
        this.geometry = geometry
        this.redraw()
        Alert.success(translate('Elevation has been added!'))
        return this.geometry
      },
      oldGeometry
    )
  }

  setRoute(coordinates) {
    this.properties._umap_options.route.coordinates = coordinates
    if (coordinates.length >= 2) this.computeRoute()
  }

  computeRoute() {
    if (!this.app.properties.ORSAPIKey) return
    const oldGeometry = Utils.CopyJSON(this._geometry)
    this.journal.update(
      'geometry',
      async () => {
        const { Importer } = await this.loadORS()
        const importer = new Importer(this.app)
        const geometry = await importer.directions(this.properties._umap_options.route)
        if (!geometry?.type) return
        this.geometry = geometry
        this.redraw()
        return this.geometry
      },
      oldGeometry
    )
  }

  addExtraEditFieldset(container) {
    super.addExtraEditFieldset(container)
    if (this.app.properties.ORSAPIKey && this.isRoute()) {
      this._editRoute(container)
    }
  }
}

export class Polygon extends Path {
  constructor(app, datalayer, geojson, id) {
    super(app, datalayer, geojson, id)
    this.staticOptions = {
      mainColor: 'fillColor',
      className: 'polygon',
    }
  }

  get measure() {
    return TextUtils.readableArea(GeoUtils.area(this.geometry))
  }

  isEmpty() {
    return !this.coordinates.length || !this.coordinates[0].length
  }

  getStyleProperties() {
    return [...super.getStyleProperties(), 'mask']
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
    if (color && color !== Schema.SCHEMA.color.default) return color
    return this.getDynamicOption('color')
  }

  getInteractionOptions() {
    const options = super.getInteractionOptions()
    options.push('properties._umap_options.interactive')
    return options
  }

  toLineString() {
    const geojson = this.toGeoJSON()
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
    const toLineString = DOMUtils.loadTemplate(
      `<button type="button" class="umap-to-polyline">
        <i class="icon icon-24 icon-polyline"></i>${translate('Transform to lines')}
      </button>`
    )
    container.appendChild(toLineString)
    toLineString.addEventListener('click', () => this.toLineString())
  }

  isMulti() {
    return (
      !GeoUtils.isFlat(this.coordinates) &&
      !GeoUtils.isFlat(this.coordinates[0]) &&
      this.coordinates.length > 1
    )
  }

  getDrawingTools(event) {
    const items = super.getDrawingTools(event)
    if (!this.isMulti() && this.coordinates.length === 1) {
      items.push({
        title: translate('Transform to lines'),
        icon: 'icon-polyline',
        action: () => this.toLineString(),
      })
    }
    items.push({
      title: translate('Start a hole here'),
      action: () => this.startHole(event.coordinate),
      icon: 'icon-hole',
    })
    return items
  }

  startHole(coordinate) {
    this.app.fire('feature:hole', { id: this.id, coordinate })
  }
}
