L.U.FeatureMixin = {
  staticOptions: {},

  initialize(map, latlng, options) {
    this.map = map
    if (typeof options === 'undefined') {
      options = {}
    }
    // DataLayer the marker belongs to
    this.datalayer = options.datalayer || null
    this.properties = { _umap_options: {} }
    if (options.geojson) {
      this.populate(options.geojson)
    }
    let isDirty = false
    const self = this
    try {
      Object.defineProperty(this, 'isDirty', {
        get() {
          return isDirty
        },
        set(status) {
          if (!isDirty && status) {
            self.fire('isdirty')
          }
          isDirty = status
          if (self.datalayer) {
            self.datalayer.isDirty = status
          }
        },
      })
    } catch (e) {
      // Certainly IE8, which has a limited version of defineProperty
    }
    this.preInit()
    this.addInteractions()
    this.parentClass.prototype.initialize.call(this, latlng, options)
  },

  preInit() {},

  isReadOnly() {
    return this.datalayer && this.datalayer.isRemoteLayer()
  },

  getSlug() {
    return this.properties[this.map.options.slugKey || 'name'] || ''
  },

  getPermalink() {
    const slug = this.getSlug()
    if (slug)
      return `${L.Util.getBaseUrl()}?${L.Util.buildQueryString({ feature: slug })}${
        window.location.hash
      }`
  },

  view(e) {
    if (this.map.editEnabled) return
    const outlink = this.properties._umap_options.outlink
    const target = this.properties._umap_options.outlinkTarget
    if (outlink) {
      switch (target) {
        case 'self':
          window.location = outlink
          break
        case 'parent':
          window.top.location = outlink
          break
        default:
          const win = window.open(this.properties._umap_options.outlink)
      }
      return
    }
    // TODO deal with an event instead?
    if (this.map.slideshow) this.map.slideshow.current = this
    this.map.currentFeature = this
    this.attachPopup()
    this.openPopup((e && e.latlng) || this.getCenter())
  },

  openPopup(...args) {
    if (this.map.editEnabled) return
    this.parentClass.prototype.openPopup.apply(this, args)
  },

  edit(e) {
    if (!this.map.editEnabled || this.isReadOnly()) return
    const container = L.DomUtil.create('div', 'umap-datalayer-container')

    let builder = new L.U.FormBuilder(this, ['datalayer'], {
      callback() {
        this.edit(e)
      }, // removeLayer step will close the edit panel, let's reopen it
    })
    container.appendChild(builder.build())

    const properties = []
    let property
    for (let i = 0; i < this.datalayer._propertiesIndex.length; i++) {
      property = this.datalayer._propertiesIndex[i]
      if (L.Util.indexOf(['name', 'description'], property) !== -1) {
        continue
      }
      properties.push([`properties.${property}`, { label: property }])
    }
    // We always want name and description for now (properties management to come)
    properties.unshift('properties.description')
    properties.unshift('properties.name')
    builder = new L.U.FormBuilder(this, properties, {
      id: 'umap-feature-properties',
      callback: this.resetTooltip,
    })
    container.appendChild(builder.build())
    this.appendEditFieldsets(container)
    const advancedActions = L.DomUtil.createFieldset(container, L._('Advanced actions'))
    this.getAdvancedEditActions(advancedActions)
    this.map.ui.openPanel({ data: { html: container }, className: 'dark' })
    this.map.editedFeature = this
    if (!this.isOnScreen()) this.zoomTo(e)
  },

  getAdvancedEditActions(container) {
    const deleteLink = L.DomUtil.create('a', 'button umap-delete', container)
    deleteLink.href = '#'
    deleteLink.textContent = L._('Delete')
    L.DomEvent.on(
      deleteLink,
      'click',
      function (e) {
        L.DomEvent.stop(e)
        if (this.confirmDelete()) this.map.ui.closePanel()
      },
      this
    )
  },

  appendEditFieldsets(container) {
    const optionsFields = this.getShapeOptions()
    var builder = new L.U.FormBuilder(this, optionsFields, {
      id: 'umap-feature-shape-properties',
      callback: this._redraw,
    })
    const shapeProperties = L.DomUtil.createFieldset(container, L._('Shape properties'))
    shapeProperties.appendChild(builder.build())

    const advancedOptions = this.getAdvancedOptions()
    var builder = new L.U.FormBuilder(this, advancedOptions, {
      id: 'umap-feature-advanced-properties',
      callback: this._redraw,
    })
    const advancedProperties = L.DomUtil.createFieldset(
      container,
      L._('Advanced properties')
    )
    advancedProperties.appendChild(builder.build())

    const interactionOptions = this.getInteractionOptions()
    builder = new L.U.FormBuilder(this, interactionOptions, {
      callback: this._redraw,
    })
    const popupFieldset = L.DomUtil.createFieldset(
      container,
      L._('Interaction options')
    )
    popupFieldset.appendChild(builder.build())
  },

  getInteractionOptions() {
    return [
      'properties._umap_options.popupShape',
      'properties._umap_options.popupTemplate',
      'properties._umap_options.showLabel',
      'properties._umap_options.labelDirection',
      'properties._umap_options.labelInteractive',
    ]
  },

  endEdit() {},

  getDisplayName(fallback) {
    if (fallback === undefined) fallback = this.datalayer.options.name
    const key = this.getOption('labelKey') || 'name'
    // Variables mode.
    if (key.includes('{')) return L.Util.greedyTemplate(key, this.extendedProperties())
    // Simple mode.
    return this.properties[key] || this.properties.title || fallback
  },

  hasPopupFooter() {
    if (L.Browser.ielt9) return false
    if (this.datalayer.isRemoteLayer() && this.datalayer.options.remoteData.dynamic)
      return false
    return this.map.options.displayPopupFooter
  },

  getPopupClass() {
    const old = this.getOption('popupTemplate') // Retrocompat.
    return L.U.Popup[this.getOption('popupShape') || old] || L.U.Popup
  },

  attachPopup() {
    const Class = this.getPopupClass()
    this.bindPopup(new Class(this))
  },

  confirmDelete() {
    if (confirm(L._('Are you sure you want to delete the feature?'))) {
      this.del()
      return true
    }
    return false
  },

  del() {
    this.isDirty = true
    this.map.closePopup()
    if (this.datalayer) {
      this.datalayer.removeLayer(this)
      this.disconnectFromDataLayer(this.datalayer)
    }
  },

  connectToDataLayer(datalayer) {
    this.datalayer = datalayer
    this.options.renderer = this.datalayer.renderer
  },

  disconnectFromDataLayer(datalayer) {
    if (this.datalayer === datalayer) {
      this.datalayer = null
    }
  },

  populate(feature) {
    this.properties = L.extend({}, feature.properties)
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
  },

  changeDataLayer(datalayer) {
    if (this.datalayer) {
      this.datalayer.isDirty = true
      this.datalayer.removeLayer(this)
    }
    datalayer.addLayer(this)
    datalayer.isDirty = true
    this._redraw()
  },

  getOption(option, fallback) {
    let value = fallback
    if (typeof this.staticOptions[option] !== 'undefined') {
      value = this.staticOptions[option]
    } else if (L.Util.usableOption(this.properties._umap_options, option)) {
      value = this.properties._umap_options[option]
    } else if (this.datalayer) {
      value = this.datalayer.getOption(option)
    } else {
      value = this.map.getOption(option)
    }
    return value
  },

  zoomTo(e = {}) {
    const easing = e.easing !== undefined ? e.easing : this.map.options.easing
    if (easing) {
      this.map.flyTo(this.getCenter(), this.getBestZoom())
    } else {
      const latlng = e.latlng || this.getCenter()
      this.map.setView(latlng, this.getBestZoom() || this.map.getZoom())
    }
    if (e.callback) e.callback.call(this)
  },

  getBestZoom() {
    return this.getOption('zoomTo')
  },

  getNext() {
    return this.datalayer.getNextFeature(this)
  },

  getPrevious() {
    return this.datalayer.getPreviousFeature(this)
  },

  cloneProperties() {
    const properties = L.extend({}, this.properties)
    properties._umap_options = L.extend({}, properties._umap_options)
    if (Object.keys && Object.keys(properties._umap_options).length === 0) {
      delete properties._umap_options // It can make a difference on big data sets
    }
    return properties
  },

  deleteProperty(property) {
    delete this.properties[property]
    this.makeDirty()
  },

  renameProperty(from, to) {
    this.properties[to] = this.properties[from]
    this.deleteProperty(from)
  },

  toGeoJSON() {
    const geojson = this.parentClass.prototype.toGeoJSON.call(this)
    geojson.properties = this.cloneProperties()
    delete geojson.properties._storage_options
    return geojson
  },

  addInteractions() {
    this.on('contextmenu editable:vertex:contextmenu', this._showContextMenu, this)
    this.on('click', this._onClick)
  },

  _onClick(e) {
    if (this.map.measureTools && this.map.measureTools.enabled()) return
    this._popupHandlersAdded = true // Prevent leaflet from managing event
    if (!this.map.editEnabled) {
      this.view(e)
    } else if (!this.isReadOnly()) {
      if (e.originalEvent.shiftKey) {
        if (this._toggleEditing) this._toggleEditing(e)
        else this.edit(e)
      } else {
        new L.Toolbar.Popup(e.latlng, {
          className: 'leaflet-inplace-toolbar',
          anchor: this.getPopupToolbarAnchor(),
          actions: this.getInplaceToolbarActions(e),
        }).addTo(this.map, this, e.latlng)
      }
    }
    L.DomEvent.stop(e)
  },

  getPopupToolbarAnchor() {
    return [0, 0]
  },

  getInplaceToolbarActions(e) {
    return [L.U.ToggleEditAction, L.U.DeleteFeatureAction]
  },

  _showContextMenu(e) {
    L.DomEvent.stop(e)
    const pt = this.map.mouseEventToContainerPoint(e.originalEvent)
    e.relatedTarget = this
    this.map.contextmenu.showAt(pt, e)
  },

  makeDirty() {
    this.isDirty = true
  },

  getMap() {
    return this.map
  },

  getContextMenuItems(e) {
    const permalink = this.getPermalink()
    let items = []
    if (permalink)
      items.push({
        text: L._('Permalink'),
        callback() {
          window.open(permalink)
        },
      })
    if (this.map.editEnabled && !this.isReadOnly()) {
      items = items.concat(this.getContextMenuEditItems(e))
    }
    return items
  },

  getContextMenuEditItems() {
    let items = ['-']
    if (this.map.editedFeature !== this) {
      items.push({
        text: L._('Edit this feature'),
        callback: this.edit,
        context: this,
        iconCls: 'umap-edit',
      })
    }
    items = items.concat(
      {
        text: L._("Edit feature's layer"),
        callback: this.datalayer.edit,
        context: this.datalayer,
        iconCls: 'umap-edit',
      },
      {
        text: L._('Delete this feature'),
        callback: this.confirmDelete,
        context: this,
        iconCls: 'umap-delete',
      },
      {
        text: L._('Clone this feature'),
        callback: this.clone,
        context: this,
      }
    )
    return items
  },

  onRemove(map) {
    this.parentClass.prototype.onRemove.call(this, map)
    if (this.map.editedFeature === this) {
      this.endEdit()
      this.map.ui.closePanel()
    }
  },

  resetTooltip() {
    const displayName = this.getDisplayName(null)
    let showLabel = this.getOption('showLabel')
    const oldLabelHover = this.getOption('labelHover')

    const options = {
      direction: this.getOption('labelDirection'),
      interactive: this.getOption('labelInteractive'),
    }

    if (oldLabelHover && showLabel) showLabel = null // Retrocompat.
    options.permanent = showLabel === true
    this.unbindTooltip()
    if ((showLabel === true || showLabel === null) && displayName)
      this.bindTooltip(L.Util.escapeHTML(displayName), options)
  },

  matchFilter(filter, keys) {
    filter = filter.toLowerCase()
    for (let i = 0; i < keys.length; i++) {
      if ((this.properties[keys[i]] || '').toLowerCase().includes(filter)) return true
    }
    return false
  },

  onVertexRawClick(e) {
    new L.Toolbar.Popup(e.latlng, {
      className: 'leaflet-inplace-toolbar',
      actions: this.getVertexActions(e),
    }).addTo(this.map, this, e.latlng, e.vertex)
  },

  getVertexActions() {
    return [L.U.DeleteVertexAction]
  },

  isMulti() {
    return false
  },

  clone() {
    const layer = this.datalayer.geojsonToFeatures(this.toGeoJSON())
    layer.isDirty = true
    layer.edit()
    return layer
  },

  extendedProperties() {
    // Include context properties
    properties = this.map.getGeoContext()
    center = this.getCenter()
    properties.lat = center.lat
    properties.lon = center.lng
    properties.lng = center.lng
    properties.rank = this.getRank() + 1
    if (typeof this.getMeasure !== 'undefined') {
      properties.measure = this.getMeasure()
    }
    return L.extend(properties, this.properties)
  },

  getRank() {
    return this.datalayer._index.indexOf(L.stamp(this))
  },
}

L.U.Marker = L.Marker.extend({
  parentClass: L.Marker,
  includes: [L.U.FeatureMixin],

  preInit() {
    this.setIcon(this.getIcon())
  },

  addInteractions() {
    L.U.FeatureMixin.addInteractions.call(this)
    this.on(
      'dragend',
      function (e) {
        this.isDirty = true
        this.edit(e)
      },
      this
    )
    if (!this.isReadOnly()) this.on('mouseover', this._enableDragging)
    this.on('mouseout', this._onMouseOut)
    this._popupHandlersAdded = true // prevent Leaflet from binding event on bindPopup
  },

  _onMouseOut() {
    if (
      this.dragging &&
      this.dragging._draggable &&
      !this.dragging._draggable._moving
    ) {
      // Do not disable if the mouse went out while dragging
      this._disableDragging()
    }
  },

  _enableDragging() {
    // TODO: start dragging after 1 second on mouse down
    if (this.map.editEnabled) {
      if (!this.editEnabled()) this.enableEdit()
      // Enabling dragging on the marker override the Draggable._OnDown
      // event, which, as it stopPropagation, refrain the call of
      // _onDown with map-pane element, which is responsible to
      // set the _moved to false, and thus to enable the click.
      // We should find a cleaner way to handle this.
      this.map.dragging._draggable._moved = false
    }
  },

  _disableDragging() {
    if (this.map.editEnabled) {
      if (this.editor && this.editor.drawing) return // when creating a new marker, the mouse can trigger the mouseover/mouseout event
      // do not listen to them
      this.disableEdit()
    }
  },

  _redraw() {
    if (this.datalayer && this.datalayer.isVisible()) {
      this._initIcon()
      this.update()
    }
  },

  _initIcon() {
    this.options.icon = this.getIcon()
    L.Marker.prototype._initIcon.call(this)
    this.resetTooltip()
  },

  disconnectFromDataLayer(datalayer) {
    this.options.icon.datalayer = null
    L.U.FeatureMixin.disconnectFromDataLayer.call(this, datalayer)
  },

  _getIconUrl(name) {
    if (typeof name === 'undefined') name = 'icon'
    return this.getOption(`${name}Url`)
  },

  getIconClass() {
    return this.getOption('iconClass')
  },

  getIcon() {
    const Class = L.U.Icon[this.getIconClass()] || L.U.Icon.Default
    return new Class(this.map, { feature: this })
  },

  getCenter() {
    return this._latlng
  },

  getClassName() {
    return 'marker'
  },

  getShapeOptions() {
    return [
      'properties._umap_options.color',
      'properties._umap_options.iconClass',
      'properties._umap_options.iconUrl',
    ]
  },

  getAdvancedOptions() {
    return ['properties._umap_options.zoomTo']
  },

  appendEditFieldsets(container) {
    L.U.FeatureMixin.appendEditFieldsets.call(this, container)
    const coordinatesOptions = [
      ['_latlng.lat', { handler: 'FloatInput', label: L._('Latitude') }],
      ['_latlng.lng', { handler: 'FloatInput', label: L._('Longitude') }],
    ]
    const builder = new L.U.FormBuilder(this, coordinatesOptions, {
      callback() {
        if (!this._latlng.isValid())
          return this.map.ui.alert({
            content: L._('Invalid latitude or longitude'),
            level: 'error',
          })
        this._redraw()
        this.zoomTo({ easing: false })
      },
      callbackContext: this,
    })
    const fieldset = L.DomUtil.createFieldset(container, L._('Coordinates'))
    fieldset.appendChild(builder.build())
  },

  zoomTo(e) {
    if (this.datalayer.isClustered() && !this._icon) {
      // callback is mandatory for zoomToShowLayer
      this.datalayer.layer.zoomToShowLayer(this, e.callback || (() => {}))
    } else {
      L.U.FeatureMixin.zoomTo.call(this, e)
    }
  },

  isOnScreen() {
    const bounds = this.map.getBounds()
    return bounds.contains(this._latlng)
  },

  getPopupToolbarAnchor() {
    return this.options.icon.options.popupAnchor
  },
})

L.U.PathMixin = {
  connectToDataLayer(datalayer) {
    L.U.FeatureMixin.connectToDataLayer.call(this, datalayer)
    // We keep markers on their own layer on top of the paths.
    this.options.pane = this.datalayer.pane
  },

  edit(e) {
    if (this.map.editEnabled) {
      if (!this.editEnabled()) this.enableEdit()
      L.U.FeatureMixin.edit.call(this, e)
    }
  },

  _toggleEditing(e) {
    if (this.map.editEnabled) {
      if (this.editEnabled()) {
        this.endEdit()
        this.map.ui.closePanel()
      } else {
        this.edit(e)
      }
    }
    // FIXME: disable when disabling global edit
    L.DomEvent.stop(e)
  },

  styleOptions: [
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
  ],

  getShapeOptions() {
    return [
      'properties._umap_options.color',
      'properties._umap_options.opacity',
      'properties._umap_options.weight',
    ]
  },

  getAdvancedOptions() {
    return [
      'properties._umap_options.smoothFactor',
      'properties._umap_options.dashArray',
      'properties._umap_options.zoomTo',
    ]
  },

  setStyle(options = {}) {
    let option
    for (const idx in this.styleOptions) {
      option = this.styleOptions[idx]
      options[option] = this.getOption(option)
    }
    if (options.interactive) this.options.pointerEvents = 'visiblePainted'
    else this.options.pointerEvents = 'stroke'
    this.parentClass.prototype.setStyle.call(this, options)
  },

  _redraw() {
    this.setStyle()
    this.resetTooltip()
  },

  onAdd(map) {
    this._container = null
    this.setStyle()
    // Show tooltip again when Leaflet.label allow static label on path.
    // cf https://github.com/Leaflet/Leaflet/pull/3952
    // this.map.on('showmeasure', this.showMeasureTooltip, this);
    // this.map.on('hidemeasure', this.removeTooltip, this);
    this.parentClass.prototype.onAdd.call(this, map)
    if (this.editing && this.editing.enabled()) this.editing.addHooks()
    this.resetTooltip()
  },

  onRemove(map) {
    // this.map.off('showmeasure', this.showMeasureTooltip, this);
    // this.map.off('hidemeasure', this.removeTooltip, this);
    if (this.editing && this.editing.enabled()) this.editing.removeHooks()
    L.U.FeatureMixin.onRemove.call(this, map)
  },

  getBestZoom() {
    return this.getOption('zoomTo') || this.map.getBoundsZoom(this.getBounds(), true)
  },

  endEdit() {
    this.disableEdit()
    L.U.FeatureMixin.endEdit.call(this)
  },

  _onMouseOver() {
    if (this.map.measureTools && this.map.measureTools.enabled()) {
      this.map.ui.tooltip({ content: this.getMeasure(), anchor: this })
    } else if (this.map.editEnabled && !this.map.editedFeature) {
      this.map.ui.tooltip({ content: L._('Click to edit'), anchor: this })
    }
  },

  addInteractions() {
    L.U.FeatureMixin.addInteractions.call(this)
    this.on('mouseover', this._onMouseOver)
    this.on('edit', this.makeDirty)
    this.on('drag editable:drag', this._onDrag)
  },

  _onDrag() {
    if (this._tooltip) this._tooltip.setLatLng(this.getCenter())
  },

  transferShape(at, to) {
    const shape = this.enableEdit().deleteShapeAt(at)
    this.disableEdit()
    if (!shape) return
    to.enableEdit().appendShape(shape)
    if (!this._latlngs.length || !this._latlngs[0].length) this.del()
  },

  isolateShape(at) {
    if (!this.isMulti()) return
    const shape = this.enableEdit().deleteShapeAt(at)
    this.disableEdit()
    if (!shape) return
    const properties = this.cloneProperties()
    const other = new (this instanceof L.U.Polyline ? L.U.Polyline : L.U.Polygon)(
      this.map,
      shape,
      { geojson: { properties } }
    )
    this.datalayer.addLayer(other)
    other.edit()
    return other
  },

  getContextMenuItems(e) {
    let items = L.U.FeatureMixin.getContextMenuItems.call(this, e)
    items.push({
      text: L._('Display measure'),
      callback() {
        this.map.ui.alert({ content: this.getMeasure(), level: 'info' })
      },
      context: this,
    })
    if (this.map.editEnabled && !this.isReadOnly() && this.isMulti()) {
      items = items.concat(this.getContextMenuMultiItems(e))
    }
    return items
  },

  getContextMenuMultiItems({ latlng }) {
    const items = [
      '-',
      {
        text: L._('Remove shape from the multi'),
        callback() {
          this.enableEdit().deleteShapeAt(latlng)
        },
        context: this,
      },
    ]
    const shape = this.shapeAt(latlng)
    if (this._latlngs.indexOf(shape) > 0) {
      items.push({
        text: L._('Make main shape'),
        callback() {
          this.enableEdit().deleteShape(shape)
          this.editor.prependShape(shape)
        },
        context: this,
      })
    }
    return items
  },

  getContextMenuEditItems(e) {
    const items = L.U.FeatureMixin.getContextMenuEditItems.call(this, e)
    if (
      this.map.editedFeature &&
      this.isSameClass(this.map.editedFeature) &&
      this.map.editedFeature !== this
    ) {
      items.push({
        text: L._('Transfer shape to edited feature'),
        callback() {
          this.transferShape(e.latlng, this.map.editedFeature)
        },
        context: this,
      })
    }
    if (this.isMulti()) {
      items.push({
        text: L._('Extract shape to separate feature'),
        callback() {
          this.isolateShape(e.latlng, this.map.editedFeature)
        },
        context: this,
      })
    }
    return items
  },

  getInplaceToolbarActions(e) {
    const items = L.U.FeatureMixin.getInplaceToolbarActions.call(this, e)
    if (this.isMulti()) {
      items.push(L.U.DeleteShapeAction)
      items.push(L.U.ExtractShapeFromMultiAction)
    }
    return items
  },

  isOnScreen() {
    const bounds = this.map.getBounds()
    return bounds.overlaps(this.getBounds())
  },
}

L.U.Polyline = L.Polyline.extend({
  parentClass: L.Polyline,
  includes: [L.U.FeatureMixin, L.U.PathMixin],

  staticOptions: {
    stroke: true,
    fill: false,
  },

  isSameClass(other) {
    return other instanceof L.U.Polyline
  },

  getClassName() {
    return 'polyline'
  },

  getMeasure(shape) {
    const length = L.GeoUtil.lineLength(this.map, shape || this._defaultShape())
    return L.GeoUtil.readableDistance(length, this.map.measureTools.getMeasureUnit())
  },

  getContextMenuEditItems(e) {
    const items = L.U.PathMixin.getContextMenuEditItems.call(this, e)
    const vertexClicked = e.vertex
    let index
    if (!this.isMulti()) {
      items.push({
        text: L._('Transform to polygon'),
        callback: this.toPolygon,
        context: this,
      })
    }
    if (vertexClicked) {
      index = e.vertex.getIndex()
      if (index !== 0 && index !== e.vertex.getLastIndex()) {
        items.push({
          text: L._('Split line'),
          callback: e.vertex.split,
          context: e.vertex,
        })
      } else if (index === 0 || index === e.vertex.getLastIndex()) {
        items.push({
          text: L._('Continue line (Ctrl+Click)'),
          callback: e.vertex.continue,
          context: e.vertex.continue,
        })
      }
    }
    return items
  },

  getContextMenuMultiItems(e) {
    const items = L.U.PathMixin.getContextMenuMultiItems.call(this, e)
    items.push({
      text: L._('Merge lines'),
      callback: this.mergeShapes,
      context: this,
    })
    return items
  },

  toPolygon() {
    const geojson = this.toGeoJSON()
    geojson.geometry.type = 'Polygon'
    geojson.geometry.coordinates = [
      L.Util.flattenCoordinates(geojson.geometry.coordinates),
    ]
    const polygon = this.datalayer.geojsonToFeatures(geojson)
    polygon.edit()
    this.del()
  },

  getAdvancedEditActions(container) {
    L.U.FeatureMixin.getAdvancedEditActions.call(this, container)
    const toPolygon = L.DomUtil.create('a', 'button umap-to-polygon', container)
    toPolygon.href = '#'
    toPolygon.textContent = L._('Transform to polygon')
    L.DomEvent.on(toPolygon, 'click', this.toPolygon, this)
  },

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
    const a = toMerge[0] // px on screen
    const b = toMerge[1]
    const p1 = this.map.latLngToContainerPoint(a[a.length - 1])
    const p2 = this.map.latLngToContainerPoint(b[0])
    const tolerance = 5
    if (Math.abs(p1.x - p2.x) <= tolerance && Math.abs(p1.y - p2.y) <= tolerance) {
      a.pop()
    }
    return a.concat(b)
  },

  mergeShapes() {
    if (!this.isMulti()) return
    const latlngs = this.getLatLngs()
    if (!latlngs.length) return
    while (latlngs.length > 1) {
      latlngs.splice(0, 2, this._mergeShapes(latlngs[1], latlngs[0]))
    }
    this.setLatLngs(latlngs[0])
    if (!this.editEnabled()) this.edit()
    this.editor.reset()
    this.isDirty = true
  },

  isMulti() {
    return !L.LineUtil.isFlat(this._latlngs) && this._latlngs.length > 1
  },

  getVertexActions(e) {
    const actions = L.U.FeatureMixin.getVertexActions.call(this, e)
    const index = e.vertex.getIndex()
    if (index === 0 || index === e.vertex.getLastIndex())
      actions.push(L.U.ContinueLineAction)
    else actions.push(L.U.SplitLineAction)
    return actions
  },
})

L.U.Polygon = L.Polygon.extend({
  parentClass: L.Polygon,
  includes: [L.U.FeatureMixin, L.U.PathMixin],

  isSameClass(other) {
    return other instanceof L.U.Polygon
  },

  getClassName() {
    return 'polygon'
  },

  getShapeOptions() {
    const options = L.U.PathMixin.getShapeOptions()
    options.push(
      'properties._umap_options.stroke',
      'properties._umap_options.fill',
      'properties._umap_options.fillColor',
      'properties._umap_options.fillOpacity'
    )
    return options
  },

  getInteractionOptions() {
    const options = [
      [
        'properties._umap_options.interactive',
        {
          handler: 'Switch',
          label: L._('Allow interactions'),
          helpEntries: 'interactive',
          inheritable: true,
        },
      ],
      [
        'properties._umap_options.outlink',
        {
          label: L._('Link to…'),
          helpEntries: 'outlink',
          placeholder: 'http://...',
          inheritable: true,
        },
      ],
      [
        'properties._umap_options.outlinkTarget',
        { handler: 'OutlinkTarget', label: L._('Open link in…'), inheritable: true },
      ],
    ]
    return options.concat(L.U.FeatureMixin.getInteractionOptions())
  },

  getMeasure(shape) {
    const area = L.GeoUtil.geodesicArea(shape || this._defaultShape())
    return L.GeoUtil.readableArea(area, this.map.measureTools.getMeasureUnit())
  },

  getContextMenuEditItems(e) {
    const items = L.U.PathMixin.getContextMenuEditItems.call(this, e)
    const shape = this.shapeAt(e.latlng)
    // No multi and no holes.
    if (shape && !this.isMulti() && (L.LineUtil.isFlat(shape) || shape.length === 1)) {
      items.push({
        text: L._('Transform to lines'),
        callback: this.toPolyline,
        context: this,
      })
    }
    items.push({
      text: L._('Start a hole here'),
      callback: this.startHole,
      context: this,
    })
    return items
  },

  startHole({ latlng }) {
    this.enableEdit().newHole(latlng)
  },

  toPolyline() {
    const geojson = this.toGeoJSON()
    geojson.geometry.type = 'LineString'
    geojson.geometry.coordinates = L.Util.flattenCoordinates(
      geojson.geometry.coordinates
    )
    const polyline = this.datalayer.geojsonToFeatures(geojson)
    polyline.edit()
    this.del()
  },

  getAdvancedEditActions(container) {
    L.U.FeatureMixin.getAdvancedEditActions.call(this, container)
    const toPolyline = L.DomUtil.create('a', 'button umap-to-polyline', container)
    toPolyline.href = '#'
    toPolyline.textContent = L._('Transform to lines')
    L.DomEvent.on(toPolyline, 'click', this.toPolyline, this)
  },

  isMulti() {
    // Change me when Leaflet#3279 is merged.
    return (
      !L.LineUtil.isFlat(this._latlngs) &&
      !L.LineUtil.isFlat(this._latlngs[0]) &&
      this._latlngs.length > 1
    )
  },

  getInplaceToolbarActions(e) {
    const items = L.U.PathMixin.getInplaceToolbarActions.call(this, e)
    items.push(L.U.CreateHoleAction)
    return items
  },
})
