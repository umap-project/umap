L.U.BaseAction = L.ToolbarAction.extend({
  initialize: function (map) {
    this.map = map
    this.options.toolbarIcon = {
      className: this.options.className,
      tooltip: this.options.tooltip,
    }
    L.ToolbarAction.prototype.initialize.call(this)
    if (this.options.helpMenu && !this.map.helpMenuActions[this.options.className])
      this.map.helpMenuActions[this.options.className] = this
  },
})

L.U.ImportAction = L.U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'upload-data dark',
    tooltip: `${L._('Import data')} (Ctrl+I)`,
  },

  addHooks: function () {
    this.map.importPanel()
  },
})

L.U.EditPropertiesAction = L.U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'update-map-settings dark',
    tooltip: L._('Edit map settings'),
  },

  addHooks: function () {
    this.map.edit()
  },
})

L.U.ChangeTileLayerAction = L.U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'dark update-map-tilelayers',
    tooltip: L._('Change tilelayers'),
  },

  addHooks: function () {
    this.map.updateTileLayers()
  },
})

L.U.ManageDatalayersAction = L.U.BaseAction.extend({
  options: {
    className: 'dark manage-datalayers',
    tooltip: L._('Manage layers'),
  },

  addHooks: function () {
    this.map.manageDatalayers()
  },
})

L.U.UpdateExtentAction = L.U.BaseAction.extend({
  options: {
    className: 'update-map-extent dark',
    tooltip: L._('Save this center and zoom'),
  },

  addHooks: function () {
    this.map.updateExtent()
  },
})

L.U.UpdatePermsAction = L.U.BaseAction.extend({
  options: {
    className: 'update-map-permissions dark',
    tooltip: L._('Update permissions and editors'),
  },

  addHooks: function () {
    this.map.permissions.edit()
  },
})

L.U.DrawMarkerAction = L.U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'umap-draw-marker dark',
    tooltip: L._('Draw a marker'),
  },

  addHooks: function () {
    this.map.startMarker()
  },
})

L.U.DrawPolylineAction = L.U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'umap-draw-polyline dark',
    tooltip: L._('Draw a polyline'),
  },

  addHooks: function () {
    this.map.startPolyline()
  },
})

L.U.DrawPolygonAction = L.U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'umap-draw-polygon dark',
    tooltip: L._('Draw a polygon'),
  },

  addHooks: function () {
    this.map.startPolygon()
  },
})

L.U.AddPolylineShapeAction = L.U.BaseAction.extend({
  options: {
    className: 'umap-draw-polyline-multi dark',
    tooltip: L._('Add a line to the current multi'),
  },

  addHooks: function () {
    this.map.editedFeature.editor.newShape()
  },
})

L.U.AddPolygonShapeAction = L.U.AddPolylineShapeAction.extend({
  options: {
    className: 'umap-draw-polygon-multi dark',
    tooltip: L._('Add a polygon to the current multi'),
  },
})

L.U.BaseFeatureAction = L.ToolbarAction.extend({
  initialize: function (map, feature, latlng) {
    this.map = map
    this.feature = feature
    this.latlng = latlng
    L.ToolbarAction.prototype.initialize.call(this)
    this.postInit()
  },

  postInit: function () {},

  hideToolbar: function () {
    this.map.removeLayer(this.toolbar)
  },

  addHooks: function () {
    this.onClick({ latlng: this.latlng })
    this.hideToolbar()
  },
})

L.U.CreateHoleAction = L.U.BaseFeatureAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-new-hole',
      tooltip: L._('Start a hole here'),
    },
  },

  onClick: function (e) {
    this.feature.startHole(e)
  },
})

L.U.ToggleEditAction = L.U.BaseFeatureAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-toggle-edit',
      tooltip: L._('Toggle edit mode (⇧+Click)'),
    },
  },

  onClick: function (e) {
    if (this.feature._toggleEditing) this.feature._toggleEditing(e) // Path
    else this.feature.edit(e) // Marker
  },
})

L.U.DeleteFeatureAction = L.U.BaseFeatureAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-delete-all',
      tooltip: L._('Delete this feature'),
    },
  },

  postInit: function () {
    if (!this.feature.isMulti())
      this.options.toolbarIcon.className = 'umap-delete-one-of-one'
  },

  onClick: function (e) {
    this.feature.confirmDelete(e)
  },
})

L.U.DeleteShapeAction = L.U.BaseFeatureAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-delete-one-of-multi',
      tooltip: L._('Delete this shape'),
    },
  },

  onClick: function (e) {
    this.feature.enableEdit().deleteShapeAt(e.latlng)
  },
})

L.U.ExtractShapeFromMultiAction = L.U.BaseFeatureAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-extract-shape-from-multi',
      tooltip: L._('Extract shape to separate feature'),
    },
  },

  onClick: function (e) {
    this.feature.isolateShape(e.latlng)
  },
})

L.U.BaseVertexAction = L.U.BaseFeatureAction.extend({
  initialize: function (map, feature, latlng, vertex) {
    this.vertex = vertex
    L.U.BaseFeatureAction.prototype.initialize.call(this, map, feature, latlng)
  },
})

L.U.DeleteVertexAction = L.U.BaseVertexAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-delete-vertex',
      tooltip: L._('Delete this vertex (Alt+Click)'),
    },
  },

  onClick: function () {
    this.vertex.delete()
  },
})

L.U.SplitLineAction = L.U.BaseVertexAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-split-line',
      tooltip: L._('Split line'),
    },
  },

  onClick: function () {
    this.vertex.split()
  },
})

L.U.ContinueLineAction = L.U.BaseVertexAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-continue-line',
      tooltip: L._('Continue line'),
    },
  },

  onClick: function () {
    this.vertex.continue()
  },
})

// Leaflet.Toolbar doesn't allow twice same toolbar class…
L.U.SettingsToolbar = L.Toolbar.Control.extend({})
L.U.DrawToolbar = L.Toolbar.Control.extend({
  initialize: function (options) {
    L.Toolbar.Control.prototype.initialize.call(this, options)
    this.map = this.options.map
    this.map.on('seteditedfeature', this.redraw, this)
  },

  appendToContainer: function (container) {
    this.options.actions = []
    if (this.map.options.enableMarkerDraw) {
      this.options.actions.push(L.U.DrawMarkerAction)
    }
    if (this.map.options.enablePolylineDraw) {
      this.options.actions.push(L.U.DrawPolylineAction)
      if (this.map.editedFeature && this.map.editedFeature instanceof L.U.Polyline) {
        this.options.actions.push(L.U.AddPolylineShapeAction)
      }
    }
    if (this.map.options.enablePolygonDraw) {
      this.options.actions.push(L.U.DrawPolygonAction)
      if (this.map.editedFeature && this.map.editedFeature instanceof L.U.Polygon) {
        this.options.actions.push(L.U.AddPolygonShapeAction)
      }
    }
    L.Toolbar.Control.prototype.appendToContainer.call(this, container)
  },

  redraw: function () {
    const container = this._control.getContainer()
    container.innerHTML = ''
    this.appendToContainer(container)
  },
})

L.U.EditControl = L.Control.extend({
  options: {
    position: 'topright',
  },

  onAdd: function (map) {
    const container = L.DomUtil.create(
        'div',
        'leaflet-control-edit-enable umap-control'
      ),
      edit = L.DomUtil.create('a', '', container)
    edit.href = '#'
    edit.title = `${L._('Enable editing')} (Ctrl+E)`

    L.DomEvent.addListener(edit, 'click', L.DomEvent.stop).addListener(
      edit,
      'click',
      map.enableEdit,
      map
    )
    return container
  },
})

/* Share control */
L.Control.Embed = L.Control.extend({
  options: {
    position: 'topleft',
  },

  onAdd: function (map) {
    const container = L.DomUtil.create('div', 'leaflet-control-embed umap-control')

    const link = L.DomUtil.create('a', '', container)
    link.href = '#'
    link.title = L._('Embed and share this map')

    L.DomEvent.on(link, 'click', L.DomEvent.stop)
      .on(link, 'click', map.renderShareBox, map)
      .on(link, 'dblclick', L.DomEvent.stopPropagation)

    return container
  },
})

L.U.MoreControls = L.Control.extend({
  options: {
    position: 'topleft',
  },

  onAdd: function () {
    const container = L.DomUtil.create('div', 'umap-control-text'),
      more = L.DomUtil.create('a', 'umap-control-more', container),
      less = L.DomUtil.create('a', 'umap-control-less', container)
    more.href = '#'
    more.title = L._('More controls')

    L.DomEvent.on(more, 'click', L.DomEvent.stop).on(more, 'click', this.toggle, this)

    less.href = '#'
    less.title = L._('Hide controls')

    L.DomEvent.on(less, 'click', L.DomEvent.stop).on(less, 'click', this.toggle, this)

    return container
  },

  toggle: function () {
    const pos = this.getPosition(),
      corner = this._map._controlCorners[pos],
      className = 'umap-more-controls'
    if (L.DomUtil.hasClass(corner, className)) L.DomUtil.removeClass(corner, className)
    else L.DomUtil.addClass(corner, className)
  },
})

L.U.PermanentCreditsControl = L.Control.extend({
  options: {
    position: 'bottomleft',
  },

  initialize: function (map, options) {
    this.map = map
    L.Control.prototype.initialize.call(this, options)
  },

  onAdd: function () {
    const paragraphContainer = L.DomUtil.create(
        'div',
        'umap-permanent-credits-container'
      ),
      creditsParagraph = L.DomUtil.create('p', '', paragraphContainer)

    this.paragraphContainer = paragraphContainer
    this.setCredits()
    this.setBackground()

    return paragraphContainer
  },

  setCredits: function () {
    this.paragraphContainer.innerHTML = L.Util.toHTML(this.map.options.permanentCredit)
  },

  setBackground: function () {
    if (this.map.options.permanentCreditBackground) {
      this.paragraphContainer.style.backgroundColor = '#FFFFFFB0'
    } else {
      this.paragraphContainer.style.backgroundColor = ''
    }
  },
})

L.U.DataLayersControl = L.Control.extend({
  options: {
    position: 'topleft',
  },

  labels: {
    zoomToLayer: L._('Zoom to layer extent'),
    toggleLayer: L._('Show/hide layer'),
    editLayer: L._('Edit'),
  },

  initialize: function (map, options) {
    this.map = map
    L.Control.prototype.initialize.call(this, options)
  },

  _initLayout: function (map) {
    const container = (this._container = L.DomUtil.create(
        'div',
        'leaflet-control-browse umap-control'
      )),
      actions = L.DomUtil.create('div', 'umap-browse-actions', container)
    this._datalayers_container = L.DomUtil.create(
      'ul',
      'umap-browse-datalayers',
      actions
    )

    const link = L.DomUtil.create('a', 'umap-browse-link', actions)
    link.href = '#'
    link.title = link.textContent = L._('Browse data')

    const toggle = L.DomUtil.create('a', 'umap-browse-toggle', container)
    toggle.href = '#'
    toggle.title = L._('See data layers')

    L.DomEvent.on(toggle, 'click', L.DomEvent.stop)

    L.DomEvent.on(link, 'click', L.DomEvent.stop).on(
      link,
      'click',
      map.openBrowser,
      map
    )

    map.whenReady(function () {
      this.update()
    }, this)

    if (L.Browser.pointer) {
      L.DomEvent.disableClickPropagation(container)
      L.DomEvent.on(container, 'wheel', L.DomEvent.stopPropagation)
      L.DomEvent.on(container, 'MozMousePixelScroll', L.DomEvent.stopPropagation)
    }
    if (!L.Browser.touch) {
      L.DomEvent.on(
        container,
        {
          mouseenter: this.expand,
          mouseleave: this.collapse,
        },
        this
      )
    } else {
      L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation)
      L.DomEvent.on(toggle, 'click', L.DomEvent.stop).on(
        toggle,
        'click',
        this.expand,
        this
      )
      map.on('click', this.collapse, this)
    }

    return container
  },

  onAdd: function (map) {
    if (!this._container) this._initLayout(map)
    if (map.options.datalayersControl === 'expanded') this.expand()
    return this._container
  },

  onRemove: function (map) {
    this.collapse()
  },

  update: function () {
    if (this._datalayers_container && this._map) {
      this._datalayers_container.innerHTML = ''
      this._map.eachDataLayerReverse(function (datalayer) {
        this.addDataLayer(this._datalayers_container, datalayer)
      }, this)
    }
  },

  expand: function () {
    L.DomUtil.addClass(this._container, 'expanded')
  },

  collapse: function () {
    if (this._map.options.datalayersControl === 'expanded') return
    L.DomUtil.removeClass(this._container, 'expanded')
  },

  addDataLayer: function (container, datalayer, draggable) {
    const datalayerLi = L.DomUtil.create('li', '', container)
    if (draggable)
      L.DomUtil.element(
        'i',
        { className: 'drag-handle', title: L._('Drag to reorder') },
        datalayerLi
      )
    datalayer.renderToolbox(datalayerLi)
    const title = L.DomUtil.add(
      'span',
      'layer-title',
      datalayerLi,
      datalayer.options.name
    )

    datalayerLi.id = `browse_data_toggle_${L.stamp(datalayer)}`
    L.DomUtil.classIf(datalayerLi, 'off', !datalayer.isVisible())

    title.textContent = datalayer.options.name
  },

  newDataLayer: function () {
    const datalayer = this.map.createDataLayer({})
    datalayer.edit()
  },

  openPanel: function () {
    if (!this.map.editEnabled) return
    const container = L.DomUtil.create('ul', 'umap-browse-datalayers')
    this.map.eachDataLayerReverse(function (datalayer) {
      this.addDataLayer(container, datalayer, true)
    }, this)
    const orderable = new L.U.Orderable(container)
    orderable.on(
      'drop',
      function (e) {
        const layer = this.map.datalayers[e.src.dataset.id],
          other = this.map.datalayers[e.dst.dataset.id],
          minIndex = Math.min(e.initialIndex, e.finalIndex)
        if (e.finalIndex === 0) layer.bringToTop()
        else if (e.finalIndex > e.initialIndex) layer.insertBefore(other)
        else layer.insertAfter(other)
        this.map.eachDataLayerReverse((datalayer) => {
          if (datalayer.getRank() >= minIndex) datalayer.isDirty = true
        })
        this.map.indexDatalayers()
      },
      this
    )

    const bar = L.DomUtil.create('div', 'button-bar', container),
      add = L.DomUtil.create('a', 'show-on-edit block add-datalayer button', bar)
    add.href = '#'
    add.textContent = add.title = L._('Add a layer')

    L.DomEvent.on(add, 'click', L.DomEvent.stop).on(
      add,
      'click',
      this.newDataLayer,
      this
    )

    this.map.ui.openPanel({ data: { html: container }, className: 'dark' })
  },
})

L.U.DataLayer.include({
  renderLegend: function (container) {
    const color = L.DomUtil.create('span', 'datalayer-color', container)
    color.style.backgroundColor = this.getColor()
  },

  renderToolbox: function (container) {
    const toggle = L.DomUtil.create('i', 'layer-toggle', container),
      zoomTo = L.DomUtil.create('i', 'layer-zoom_to', container),
      edit = L.DomUtil.create('i', 'layer-edit show-on-edit', container),
      table = L.DomUtil.create('i', 'layer-table-edit show-on-edit', container),
      remove = L.DomUtil.create('i', 'layer-delete show-on-edit', container)
    zoomTo.title = L._('Zoom to layer extent')
    toggle.title = L._('Show/hide layer')
    edit.title = L._('Edit')
    table.title = L._('Edit properties in a table')
    remove.title = L._('Delete layer')
    L.DomEvent.on(toggle, 'click', this.toggle, this)
    L.DomEvent.on(zoomTo, 'click', this.zoomTo, this)
    L.DomEvent.on(edit, 'click', this.edit, this)
    L.DomEvent.on(table, 'click', this.tableEdit, this)
    L.DomEvent.on(
      remove,
      'click',
      function () {
        if (!this.isVisible()) return
        if (!confirm(L._('Are you sure you want to delete this layer?'))) return
        this._delete()
        this.map.ui.closePanel()
      },
      this
    )
    L.DomUtil.addClass(container, this.getHidableClass())
    L.DomUtil.classIf(container, 'off', !this.isVisible())
    container.dataset.id = L.stamp(this)
  },

  getHidableElements: function () {
    return document.querySelectorAll(`.${this.getHidableClass()}`)
  },

  getHidableClass: function () {
    return `show_with_datalayer_${L.stamp(this)}`
  },

  propagateRemote: function () {
    const els = this.getHidableElements()
    for (let i = 0; i < els.length; i++) {
      L.DomUtil.classIf(els[i], 'remotelayer', this.isRemoteLayer())
    }
  },

  propagateHide: function () {
    const els = this.getHidableElements()
    for (let i = 0; i < els.length; i++) {
      L.DomUtil.addClass(els[i], 'off')
    }
  },

  propagateShow: function () {
    this.onceLoaded(function () {
      const els = this.getHidableElements()
      for (let i = 0; i < els.length; i++) {
        L.DomUtil.removeClass(els[i], 'off')
      }
    }, this)
  },
})

L.U.DataLayer.addInitHook(function () {
  this.on('hide', this.propagateHide)
  this.on('show', this.propagateShow)
  this.propagateShow()
})

L.U.Map.include({
  _openBrowser: function () {
    const browserContainer = L.DomUtil.create('div', 'umap-browse-data')

    const title = L.DomUtil.add(
      'h3',
      'umap-browse-title',
      browserContainer,
      this.options.name
    )

    const filter = L.DomUtil.create('input', '', browserContainer)
    let filterValue = ''

    const featuresContainer = L.DomUtil.create(
      'div',
      'umap-browse-features',
      browserContainer
    )

    const filterKeys = this.getFilterKeys()
    filter.type = 'text'
    filter.placeholder = L._('Filter…')
    filter.value = this.options.filter || ''

    const addFeature = (feature) => {
      const feature_li = L.DomUtil.create('li', `${feature.getClassName()} feature`),
        zoom_to = L.DomUtil.create('i', 'feature-zoom_to', feature_li),
        edit = L.DomUtil.create('i', 'show-on-edit feature-edit', feature_li),
        del = L.DomUtil.create('i', 'show-on-edit feature-delete', feature_li),
        color = L.DomUtil.create('i', 'feature-color', feature_li),
        title = L.DomUtil.create('span', 'feature-title', feature_li),
        symbol = feature._getIconUrl
          ? L.U.Icon.prototype.formatUrl(feature._getIconUrl(), feature)
          : null
      zoom_to.title = L._('Bring feature to center')
      edit.title = L._('Edit this feature')
      del.title = L._('Delete this feature')
      title.textContent = feature.getDisplayName() || '—'
      color.style.backgroundColor = feature.getOption('color')
      if (symbol) {
        color.style.backgroundImage = `url(${symbol})`
      }
      L.DomEvent.on(
        zoom_to,
        'click',
        function (e) {
          e.callback = L.bind(this.view, this)
          this.zoomTo(e)
        },
        feature
      )
      L.DomEvent.on(
        title,
        'click',
        function (e) {
          e.callback = L.bind(this.view, this)
          this.zoomTo(e)
        },
        feature
      )
      L.DomEvent.on(edit, 'click', feature.edit, feature)
      L.DomEvent.on(del, 'click', feature.confirmDelete, feature)
      return feature_li
    }

    const append = (datalayer) => {
      const container = L.DomUtil.create(
          'div',
          datalayer.getHidableClass(),
          featuresContainer
        ),
        headline = L.DomUtil.create('h5', '', container)
      container.id = `browse_data_datalayer_${datalayer.umap_id}`
      datalayer.renderToolbox(headline)
      L.DomUtil.add('span', '', headline, datalayer.options.name)
      const ul = L.DomUtil.create('ul', '', container)
      L.DomUtil.classIf(container, 'off', !datalayer.isVisible())

      const build = () => {
        ul.innerHTML = ''
        datalayer.eachFeature((feature) => {
          if (
            (filterValue && !feature.matchFilter(filterValue, filterKeys)) ||
            feature.properties.isVisible === false
          )
            return
          ul.appendChild(addFeature(feature))
        })
      }
      build()
      datalayer.on('datachanged', build)
      datalayer.map.ui.once('panel:closed', () => {
        datalayer.off('datachanged', build)
      })
      datalayer.map.ui.once('panel:ready', () => {
        datalayer.map.ui.once('panel:ready', () => {
          datalayer.off('datachanged', build)
        })
      })
    }

    const appendAll = function () {
      this.options.filter = filterValue = filter.value
      featuresContainer.innerHTML = ''
      this.eachBrowsableDataLayer((datalayer) => {
        append(datalayer)
      })
    }
    const resetLayers = function () {
      this.eachBrowsableDataLayer((datalayer) => {
        datalayer.resetLayer(true)
      })
    }
    L.bind(appendAll, this)()
    L.DomEvent.on(filter, 'input', appendAll, this)
    L.DomEvent.on(filter, 'input', resetLayers, this)
    const link = L.DomUtil.create('li', '')
    L.DomUtil.create('i', 'umap-icon-16 umap-caption', link)
    const label = L.DomUtil.create('span', '', link)
    label.textContent = label.title = L._('About')
    L.DomEvent.on(link, 'click', this.displayCaption, this)
    this.ui.openPanel({ data: { html: browserContainer }, actions: [link] })
  },

  _openFilter: function () {
    const filterContainer = L.DomUtil.create('div', 'umap-filter-data'),
      title = L.DomUtil.add(
        'h3',
        'umap-filter-title',
        filterContainer,
        this.options.name
      ),
      propertiesContainer = L.DomUtil.create(
        'div',
        'umap-filter-properties',
        filterContainer
      ),
      advancedFilterKeys = this.getAdvancedFilterKeys()

    const advancedFiltersFull = {}
    let filtersAlreadyLoaded = true
    if (!this.getMap().options.advancedFilters) {
      this.getMap().options.advancedFilters = {}
      filtersAlreadyLoaded = false
    }
    advancedFilterKeys.forEach((property) => {
      advancedFiltersFull[property] = []
      if (!filtersAlreadyLoaded || !this.getMap().options.advancedFilters[property]) {
        this.getMap().options.advancedFilters[property] = []
      }
    })
    this.eachBrowsableDataLayer((datalayer) => {
      datalayer.eachFeature((feature) => {
        advancedFilterKeys.forEach((property) => {
          if (feature.properties[property]) {
            if (!advancedFiltersFull[property].includes(feature.properties[property])) {
              advancedFiltersFull[property].push(feature.properties[property])
            }
          }
        })
      })
    })

    const addPropertyValue = function (property, value) {
      const property_li = L.DomUtil.create('li', ''),
        filter_check = L.DomUtil.create('input', '', property_li),
        filter_label = L.DomUtil.create('label', '', property_li)
      filter_check.type = 'checkbox'
      filter_check.id = `checkbox_${property}_${value}`
      filter_check.checked =
        this.getMap().options.advancedFilters[property] &&
        this.getMap().options.advancedFilters[property].includes(value)
      filter_check.setAttribute('data-property', property)
      filter_check.setAttribute('data-value', value)
      filter_label.htmlFor = `checkbox_${property}_${value}`
      filter_label.innerHTML = value
      L.DomEvent.on(
        filter_check,
        'change',
        function (e) {
          const property = e.srcElement.dataset.property
          const value = e.srcElement.dataset.value
          if (e.srcElement.checked) {
            this.getMap().options.advancedFilters[property].push(value)
          } else {
            this.getMap().options.advancedFilters[property].splice(
              this.getMap().options.advancedFilters[property].indexOf(value),
              1
            )
          }
          L.bind(filterFeatures, this)()
        },
        this
      )
      return property_li
    }

    const addProperty = function (property) {
      const container = L.DomUtil.create(
          'div',
          'property-container',
          propertiesContainer
        ),
        headline = L.DomUtil.add('h5', '', container, property)
      const ul = L.DomUtil.create('ul', '', container)
      const orderedValues = advancedFiltersFull[property]
      orderedValues.sort()
      orderedValues.forEach((value) => {
        ul.appendChild(L.bind(addPropertyValue, this)(property, value))
      })
    }

    const filterFeatures = function () {
      let noResults = true
      this.eachBrowsableDataLayer((datalayer) => {
        datalayer.eachFeature(function (feature) {
          feature.properties.isVisible = true
          for (const [property, values] of Object.entries(
            this.map.options.advancedFilters
          )) {
            if (values.length > 0) {
              if (
                !feature.properties[property] ||
                !values.includes(feature.properties[property])
              ) {
                feature.properties.isVisible = false
              }
            }
          }
          if (feature.properties.isVisible) {
            noResults = false
            if (!this.isLoaded()) this.fetchData()
            this.map.addLayer(feature)
            this.fire('show')
          } else {
            this.map.removeLayer(feature)
            this.fire('hide')
          }
        })
      })
      if (noResults) {
        this.help.show('advancedFiltersNoResults')
      } else {
        this.help.hide()
      }
    }

    propertiesContainer.innerHTML = ''
    advancedFilterKeys.forEach((property) => {
      L.bind(addProperty, this)(property)
    })

    const link = L.DomUtil.create('li', '')
    L.DomUtil.create('i', 'umap-icon-16 umap-caption', link)
    const label = L.DomUtil.create('span', '', link)
    label.textContent = label.title = L._('About')
    L.DomEvent.on(link, 'click', this.displayCaption, this)
    this.ui.openPanel({ data: { html: filterContainer }, actions: [link] })
  },

  displayCaption: function () {
    const container = L.DomUtil.create('div', 'umap-caption')
    let title = L.DomUtil.create('h3', '', container)
    title.textContent = this.options.name
    this.permissions.addOwnerLink('h5', container)
    if (this.options.description) {
      const description = L.DomUtil.create('div', 'umap-map-description', container)
      description.innerHTML = L.Util.toHTML(this.options.description)
    }
    const datalayerContainer = L.DomUtil.create('div', 'datalayer-container', container)
    this.eachVisibleDataLayer((datalayer) => {
      const p = L.DomUtil.create('p', 'datalayer-legend', datalayerContainer),
        legend = L.DomUtil.create('span', '', p),
        headline = L.DomUtil.create('strong', '', p),
        description = L.DomUtil.create('span', '', p)
      datalayer.onceLoaded(function () {
        datalayer.renderLegend(legend)
        if (datalayer.options.description) {
          description.innerHTML = L.Util.toHTML(datalayer.options.description)
        }
      })
      datalayer.renderToolbox(headline)
      L.DomUtil.add('span', '', headline, `${datalayer.options.name} `)
    })
    const creditsContainer = L.DomUtil.create('div', 'credits-container', container),
      credits = L.DomUtil.createFieldset(creditsContainer, L._('Credits'))
    title = L.DomUtil.add('h5', '', credits, L._('User content credits'))
    if (this.options.shortCredit || this.options.longCredit) {
      L.DomUtil.add(
        'p',
        '',
        credits,
        L.Util.toHTML(this.options.longCredit || this.options.shortCredit)
      )
    }
    if (this.options.licence) {
      const licence = L.DomUtil.add(
          'p',
          '',
          credits,
          `${L._('Map user content has been published under licence')} `
        ),
        link = L.DomUtil.add('a', '', licence, this.options.licence.name)
      link.href = this.options.licence.url
    } else {
      L.DomUtil.add('p', '', credits, L._('No licence has been set'))
    }
    L.DomUtil.create('hr', '', credits)
    title = L.DomUtil.create('h5', '', credits)
    title.textContent = L._('Map background credits')
    const tilelayerCredit = L.DomUtil.create('p', '', credits),
      name = L.DomUtil.create('strong', '', tilelayerCredit),
      attribution = L.DomUtil.create('span', '', tilelayerCredit)
    name.textContent = `${this.selected_tilelayer.options.name} `
    attribution.innerHTML = this.selected_tilelayer.getAttribution()
    L.DomUtil.create('hr', '', credits)
    const umapCredit = L.DomUtil.create('p', '', credits),
      urls = {
        leaflet: 'http://leafletjs.com',
        django: 'https://www.djangoproject.com',
        umap: 'http://wiki.openstreetmap.org/wiki/UMap',
        changelog: 'https://umap-project.readthedocs.io/en/latest/changelog/',
        version: this.options.umap_version,
      }
    umapCredit.innerHTML = L._(
      `
      Powered by <a href="{leaflet}">Leaflet</a> and
      <a href="{django}">Django</a>,
      glued by <a href="{umap}">uMap project</a>
      (version <a href="{changelog}">{version}</a>).
      `,
      urls
    )
    const browser = L.DomUtil.create('li', '')
    L.DomUtil.create('i', 'umap-icon-16 umap-list', browser)
    const labelBrowser = L.DomUtil.create('span', '', browser)
    labelBrowser.textContent = labelBrowser.title = L._('Browse data')
    L.DomEvent.on(browser, 'click', this.openBrowser, this)
    const actions = [browser]
    if (this.options.advancedFilterKey) {
      const filter = L.DomUtil.create('li', '')
      L.DomUtil.create('i', 'umap-icon-16 umap-add', filter)
      const labelFilter = L.DomUtil.create('span', '', filter)
      labelFilter.textContent = labelFilter.title = L._('Select data')
      L.DomEvent.on(filter, 'click', this.openFilter, this)
      actions.push(filter)
    }
    this.ui.openPanel({ data: { html: container }, actions: actions })
  },

  EXPORT_TYPES: {
    geojson: {
      formatter: function (map) {
        return JSON.stringify(map.toGeoJSON(), null, 2)
      },
      ext: '.geojson',
      filetype: 'application/json',
    },
    gpx: {
      formatter: function (map) {
        return togpx(map.toGeoJSON())
      },
      ext: '.gpx',
      filetype: 'application/xml',
    },
    kml: {
      formatter: function (map) {
        return tokml(map.toGeoJSON())
      },
      ext: '.kml',
      filetype: 'application/vnd.google-earth.kml+xml',
    },
    umap: {
      name: L._('Full map data'),
      formatter: function (map) {
        return map.serialize()
      },
      ext: '.umap',
      filetype: 'application/json',
      selected: true,
    },
  },

  renderShareBox: function () {
    const container = L.DomUtil.create('div', 'umap-share')
    const embedTitle = L.DomUtil.add('h4', '', container, L._('Embed the map'))
    const iframe = L.DomUtil.create('textarea', 'umap-share-iframe', container)
    const urlTitle = L.DomUtil.add('h4', '', container, L._('Direct link'))
    const exportUrl = L.DomUtil.create('input', 'umap-share-url', container)
    let option
    exportUrl.type = 'text'
    const UIFields = [
      ['dimensions.width', { handler: 'Input', label: L._('width') }],
      ['dimensions.height', { handler: 'Input', label: L._('height') }],
      [
        'options.includeFullScreenLink',
        { handler: 'Switch', label: L._('Include full screen link?') },
      ],
      [
        'options.currentView',
        { handler: 'Switch', label: L._('Current view instead of default map view?') },
      ],
      [
        'options.keepCurrentDatalayers',
        { handler: 'Switch', label: L._('Keep current visible layers') },
      ],
      [
        'options.viewCurrentFeature',
        { handler: 'Switch', label: L._('Open current feature on load') },
      ],
      'queryString.moreControl',
      'queryString.scrollWheelZoom',
      'queryString.miniMap',
      'queryString.scaleControl',
      'queryString.onLoadPanel',
      'queryString.captionBar',
      'queryString.captionMenus',
    ]
    for (let i = 0; i < this.HIDDABLE_CONTROLS.length; i++) {
      UIFields.push(`queryString.${this.HIDDABLE_CONTROLS[i]}Control`)
    }
    const iframeExporter = new L.U.IframeExporter(this)
    const buildIframeCode = () => {
      iframe.innerHTML = iframeExporter.build()
      exportUrl.value = window.location.protocol + iframeExporter.buildUrl()
    }
    buildIframeCode()
    const builder = new L.U.FormBuilder(iframeExporter, UIFields, {
      callback: buildIframeCode,
    })
    const iframeOptions = L.DomUtil.createFieldset(container, L._('Export options'))
    iframeOptions.appendChild(builder.build())
    if (this.options.shortUrl) {
      L.DomUtil.create('hr', '', container)
      L.DomUtil.add('h4', '', container, L._('Short URL'))
      const shortUrl = L.DomUtil.create('input', 'umap-short-url', container)
      shortUrl.type = 'text'
      shortUrl.value = this.options.shortUrl
    }
    L.DomUtil.create('hr', '', container)
    L.DomUtil.add('h4', '', container, L._('Download data'))
    const typeInput = L.DomUtil.create('select', '', container)
    typeInput.name = 'format'
    const exportCaveat = L.DomUtil.add(
      'small',
      'help-text',
      container,
      L._('Only visible features will be downloaded.')
    )
    exportCaveat.id = 'export_caveat_text'
    const toggleCaveat = () => {
      if (typeInput.value === 'umap') exportCaveat.style.display = 'none'
      else exportCaveat.style.display = 'inherit'
    }
    L.DomEvent.on(typeInput, 'change', toggleCaveat)
    for (const key in this.EXPORT_TYPES) {
      if (this.EXPORT_TYPES.hasOwnProperty(key)) {
        option = L.DomUtil.create('option', '', typeInput)
        option.value = key
        option.textContent = this.EXPORT_TYPES[key].name || key
        if (this.EXPORT_TYPES[key].selected) option.selected = true
      }
    }
    toggleCaveat()
    const download = L.DomUtil.create('a', 'button', container)
    download.textContent = L._('Download data')
    L.DomEvent.on(download, 'click', () => this.download(typeInput.value), this)
    this.ui.openPanel({ data: { html: container } })
  },

  download: function (mode) {
    const type = this.EXPORT_TYPES[mode || 'umap']
    const content = type.formatter(this)
    let name = this.options.name || 'data'
    name = name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    window.URL = window.URL || window.webkitURL
    const blob = new Blob([content], { type: type.filetype })
    const el = document.createElement('a')
    el.download = name + type.ext
    el.href = window.URL.createObjectURL(blob)
    el.style.display = 'none'
    document.body.appendChild(el)
    el.click()
    document.body.removeChild(el)
  },
})

L.U.TileLayerControl = L.Control.extend({
  options: {
    position: 'topleft',
  },

  initialize: function (map, options) {
    this.map = map
    L.Control.prototype.initialize.call(this, options)
  },

  onAdd: function () {
    const container = L.DomUtil.create('div', 'leaflet-control-tilelayers umap-control')

    const link = L.DomUtil.create('a', '', container)
    link.href = '#'
    link.title = L._('Change map background')

    L.DomEvent.on(link, 'click', L.DomEvent.stop)
      .on(link, 'click', this.openSwitcher, this)
      .on(link, 'dblclick', L.DomEvent.stopPropagation)

    return container
  },

  openSwitcher: function (options) {
    this._tilelayers_container = L.DomUtil.create(
      'ul',
      'umap-tilelayer-switcher-container'
    )
    this.buildList(options)
  },

  buildList: function (options) {
    this.map.eachTileLayer(function (tilelayer) {
      if (
        window.location.protocol === 'https:' &&
        tilelayer.options.url_template.indexOf('http:') === 0
      )
        return
      this.addTileLayerElement(tilelayer, options)
    }, this)
    this.map.ui.openPanel({
      data: { html: this._tilelayers_container },
      className: options.className,
    })
  },

  addTileLayerElement: function (tilelayer, options) {
    const selectedClass = this.map.hasLayer(tilelayer) ? 'selected' : '',
      el = L.DomUtil.create('li', selectedClass, this._tilelayers_container),
      img = L.DomUtil.create('img', '', el),
      name = L.DomUtil.create('div', '', el)
    img.src = L.Util.template(tilelayer.options.url_template, this.map.demoTileInfos)
    img.loading = 'lazy'
    name.textContent = tilelayer.options.name
    L.DomEvent.on(
      el,
      'click',
      function () {
        this.map.selectTileLayer(tilelayer)
        this.map.ui.closePanel()
        if (options && options.callback) options.callback(tilelayer)
      },
      this
    )
  },
})

L.U.AttributionControl = L.Control.Attribution.extend({
  options: {
    prefix: '',
  },

  _update: function () {
    L.Control.Attribution.prototype._update.call(this)
    if (this._map.options.shortCredit) {
      L.DomUtil.add(
        'span',
        '',
        this._container,
        ` — ${L.Util.toHTML(this._map.options.shortCredit)}`
      )
    }
    if (this._map.options.captionMenus) {
      const link = L.DomUtil.add('a', '', this._container, ` — ${L._('About')}`)
      L.DomEvent.on(link, 'click', L.DomEvent.stop)
        .on(link, 'click', this._map.displayCaption, this._map)
        .on(link, 'dblclick', L.DomEvent.stop)
    }
    if (window.top === window.self && this._map.options.captionMenus) {
      // We are not in iframe mode
      const home = L.DomUtil.add('a', '', this._container, ` — ${L._('Home')}`)
      home.href = '/'
    }
  },
})

L.U.StarControl = L.Control.extend({
  options: {
    position: 'topleft',
  },

  onAdd: function (map) {
    const status = map.options.starred ? ' starred' : ''
    const container = L.DomUtil.create(
        'div',
        `leaflet-control-star umap-control${status}`
      ),
      link = L.DomUtil.create('a', '', container)
    link.href = '#'
    link.title = L._('Star this map')
    L.DomEvent.on(link, 'click', L.DomEvent.stop)
      .on(link, 'click', map.star, map)
      .on(link, 'dblclick', L.DomEvent.stopPropagation)

    return container
  },
})

L.U.Search = L.PhotonSearch.extend({
  initialize: function (map, input, options) {
    L.PhotonSearch.prototype.initialize.call(this, map, input, options)
    this.options.url = map.options.urls.search
  },

  onBlur: function (e) {
    // Overrided because we don't want to hide the results on blur.
    this.fire('blur')
  },

  formatResult: function (feature, el) {
    const self = this
    const tools = L.DomUtil.create('span', 'search-result-tools', el),
      zoom = L.DomUtil.create('i', 'feature-zoom_to', tools),
      edit = L.DomUtil.create('i', 'feature-edit show-on-edit', tools)
    zoom.title = L._('Zoom to this place')
    edit.title = L._('Save this location as new feature')
    // We need to use "mousedown" because Leaflet.Photon listen to mousedown
    // on el.
    L.DomEvent.on(zoom, 'mousedown', (e) => {
      L.DomEvent.stop(e)
      self.zoomToFeature(feature)
    })
    L.DomEvent.on(edit, 'mousedown', (e) => {
      L.DomEvent.stop(e)
      const datalayer = self.map.defaultDataLayer()
      const layer = datalayer.geojsonToFeatures(feature)
      layer.isDirty = true
      layer.edit()
    })
    this._formatResult(feature, el)
  },

  zoomToFeature: function (feature) {
    const zoom = Math.max(this.map.getZoom(), 16) // Never unzoom.
    this.map.setView(
      [feature.geometry.coordinates[1], feature.geometry.coordinates[0]],
      zoom
    )
  },

  onSelected: function (feature) {
    this.zoomToFeature(feature)
    this.map.ui.closePanel()
  },
})

L.U.SearchControl = L.Control.extend({
  options: {
    position: 'topleft',
  },

  onAdd: function (map) {
    const container = L.DomUtil.create('div', 'leaflet-control-search umap-control'),
      self = this

    L.DomEvent.disableClickPropagation(container)
    const link = L.DomUtil.create('a', '', container)
    link.href = '#'
    link.title = L._('Search a place name')
    L.DomEvent.on(link, 'click', (e) => {
      L.DomEvent.stop(e)
      self.openPanel(map)
    })
    return container
  },

  openPanel: function (map) {
    const options = {
      limit: 10,
      noResultLabel: L._('No results'),
    }
    if (map.options.photonUrl) options.url = map.options.photonUrl
    const container = L.DomUtil.create('div', '')

    const title = L.DomUtil.create('h3', '', container)
    title.textContent = L._('Search location')
    const input = L.DomUtil.create('input', 'photon-input', container)
    const resultsContainer = L.DomUtil.create('div', 'photon-autocomplete', container)
    this.search = new L.U.Search(map, input, options)
    const id = Math.random()
    this.search.on('ajax:send', () => {
      map.fire('dataloading', { id: id })
    })
    this.search.on('ajax:return', () => {
      map.fire('dataload', { id: id })
    })
    this.search.resultsContainer = resultsContainer
    map.ui.once('panel:ready', () => {
      input.focus()
    })
    map.ui.openPanel({ data: { html: container } })
  },
})

L.Control.MiniMap.include({
  initialize: function (layer, options) {
    L.Util.setOptions(this, options)
    this._layer = this._cloneLayer(layer)
  },

  onMainMapBaseLayerChange: function (e) {
    const layer = this._cloneLayer(e.layer)
    if (this._miniMap.hasLayer(this._layer)) {
      this._miniMap.removeLayer(this._layer)
    }
    this._layer = layer
    this._miniMap.addLayer(this._layer)
  },

  _cloneLayer: function (layer) {
    return new L.TileLayer(layer._url, L.Util.extend({}, layer.options))
  },
})

L.Control.Loading.include({
  onAdd: function (map) {
    this._container = L.DomUtil.create('div', 'umap-loader', map._controlContainer)
    map.on('baselayerchange', this._layerAdd, this)
    this._addMapListeners(map)
    this._map = map
  },

  _showIndicator: function () {
    L.DomUtil.addClass(this._map._container, 'umap-loading')
  },

  _hideIndicator: function () {
    L.DomUtil.removeClass(this._map._container, 'umap-loading')
  },
})

/*
 * Make it dynamic
 */
L.U.ContextMenu = L.Map.ContextMenu.extend({
  _createItems: function (e) {
    this._map.setContextMenuItems(e)
    L.Map.ContextMenu.prototype._createItems.call(this)
  },

  _showAtPoint: function (pt, e) {
    this._items = []
    this._container.innerHTML = ''
    this._createItems(e)
    L.Map.ContextMenu.prototype._showAtPoint.call(this, pt, e)
  },
})

L.U.IframeExporter = L.Evented.extend({
  options: {
    includeFullScreenLink: true,
    currentView: false,
    keepCurrentDatalayers: false,
    viewCurrentFeature: false,
  },

  queryString: {
    scaleControl: false,
    miniMap: false,
    scrollWheelZoom: false,
    zoomControl: true,
    allowEdit: false,
    moreControl: true,
    searchControl: null,
    tilelayersControl: null,
    embedControl: null,
    datalayersControl: true,
    onLoadPanel: 'none',
    captionBar: false,
    captionMenus: true,
  },

  dimensions: {
    width: '100%',
    height: '300px',
  },

  initialize: function (map) {
    this.map = map
    this.baseUrl = L.Util.getBaseUrl()
    // Use map default, not generic default
    this.queryString.onLoadPanel = this.map.options.onLoadPanel
  },

  getMap: function () {
    return this.map
  },

  buildUrl: function (options) {
    const datalayers = []
    if (this.options.viewCurrentFeature && this.map.currentFeature) {
      this.queryString.feature = this.map.currentFeature.getSlug()
    }
    if (this.options.keepCurrentDatalayers) {
      this.map.eachDataLayer((datalayer) => {
        if (datalayer.isVisible() && datalayer.umap_id) {
          datalayers.push(datalayer.umap_id)
        }
      })
      this.queryString.datalayers = datalayers.join(',')
    } else {
      delete this.queryString.datalayers
    }
    const currentView = this.options.currentView ? window.location.hash : ''
    const queryString = L.extend({}, this.queryString, options)
    return `${this.baseUrl}?${L.Util.buildQueryString(queryString)}${currentView}`
  },

  build: function () {
    const iframeUrl = this.buildUrl()
    let code = `<iframe width="${this.dimensions.width}" height="${this.dimensions.height}" frameborder="0" allowfullscreen allow="geolocation" src="${iframeUrl}"></iframe>`
    if (this.options.includeFullScreenLink) {
      const fullUrl = this.buildUrl({ scrollWheelZoom: true })
      code += `<p><a href="${fullUrl}">${L._('See full screen')}</a></p>`
    }
    return code
  },
})

L.U.Editable = L.Editable.extend({
  initialize: function (map, options) {
    L.Editable.prototype.initialize.call(this, map, options)
    this.on(
      'editable:drawing:start editable:drawing:click editable:drawing:move',
      this.drawingTooltip
    )
    this.on('editable:drawing:end', this.closeTooltip)
    // Layer for items added by users
    this.on('editable:drawing:cancel', (e) => {
      if (e.layer._latlngs && e.layer._latlngs.length < e.layer.editor.MIN_VERTEX)
        e.layer.del()
      if (e.layer instanceof L.U.Marker) e.layer.del()
    })
    this.on('editable:drawing:commit', function (e) {
      e.layer.isDirty = true
      if (this.map.editedFeature !== e.layer) e.layer.edit(e)
    })
    this.on('editable:editing', (e) => {
      const layer = e.layer
      layer.isDirty = true
      if (layer._tooltip && layer.isTooltipOpen()) {
        layer._tooltip.setLatLng(layer.getCenter())
        layer._tooltip.update()
      }
    })
    this.on('editable:vertex:ctrlclick', (e) => {
      const index = e.vertex.getIndex()
      if (index === 0 || (index === e.vertex.getLastIndex() && e.vertex.continue))
        e.vertex.continue()
    })
    this.on('editable:vertex:altclick', (e) => {
      if (e.vertex.editor.vertexCanBeDeleted(e.vertex)) e.vertex.delete()
    })
    this.on('editable:vertex:rawclick', this.onVertexRawClick)
  },

  createPolyline: function (latlngs) {
    return new L.U.Polyline(this.map, latlngs)
  },

  createPolygon: function (latlngs) {
    const polygon = new L.U.Polygon(this.map, latlngs)
    return polygon
  },

  createMarker: function (latlng) {
    return new L.U.Marker(this.map, latlng)
  },

  connectCreatedToMap: function (layer) {
    // Overrided from Leaflet.Editable
    const datalayer = this.map.defaultDataLayer()
    datalayer.addLayer(layer)
    layer.isDirty = true
    return layer
  },

  drawingTooltip: function (e) {
    if (e.layer instanceof L.Marker && e.type != 'editable:drawing:move') {
      this.map.ui.tooltip({ content: L._('Click to add a marker') })
    }
    if (!(e.layer instanceof L.Polyline)) {
      // only continue with Polylines and Polygons
      return
    }

    let content
    let measure
    if (e.layer.editor._drawnLatLngs) {
      // when drawing (a Polyline or Polygon)
      if (!e.layer.editor._drawnLatLngs.length) {
        // when drawing first point
        if (e.layer instanceof L.Polygon) {
          content = L._('Click to start drawing a polygon')
        } else if (e.layer instanceof L.Polyline) {
          content = L._('Click to start drawing a line')
        }
      } else {
        const tmpLatLngs = e.layer.editor._drawnLatLngs.slice()
        tmpLatLngs.push(e.latlng)
        measure = e.layer.getMeasure(tmpLatLngs)

        if (e.layer.editor._drawnLatLngs.length < e.layer.editor.MIN_VERTEX) {
          // when drawing second point
          content = L._('Click to continue drawing')
        } else {
          // when drawing third point (or more)
          content = L._('Click last point to finish shape')
        }
      }
    } else {
      // when moving an existing point
      measure = e.layer.getMeasure()
    }
    if (measure) {
      if (e.layer instanceof L.Polygon) {
        content += L._(' (area: {measure})', { measure: measure })
      } else if (e.layer instanceof L.Polyline) {
        content += L._(' (length: {measure})', { measure: measure })
      }
    }
    if (content) {
      this.map.ui.tooltip({ content: content })
    }
  },

  closeTooltip: function () {
    this.map.ui.closeTooltip()
  },

  onVertexRawClick: function (e) {
    e.layer.onVertexRawClick(e)
    L.DomEvent.stop(e)
    e.cancel()
  },
})
