U.BaseAction = L.ToolbarAction.extend({
  initialize: function (map) {
    this.map = map
    if (this.options.label) {
      this.options.tooltip = this.map.help.displayLabel(
        this.options.label,
        (withKbdTag = false)
      )
    }
    this.options.toolbarIcon = {
      className: this.options.className,
      tooltip: this.options.tooltip,
    }
    L.ToolbarAction.prototype.initialize.call(this)
    if (this.options.helpMenu && !this.map.helpMenuActions[this.options.className])
      this.map.helpMenuActions[this.options.className] = this
  },
})

U.ImportAction = U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'upload-data dark',
    label: 'IMPORT_PANEL',
  },

  addHooks: function () {
    this.map.importer.open()
  },
})

U.EditLayersAction = U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'umap-control-browse dark',
    tooltip: L._('Manage layers'),
  },

  addHooks: function () {
    this.map.editDatalayers()
  },
})

U.EditCaptionAction = U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'umap-control-caption dark',
    tooltip: L._('Edit map name and caption'),
  },

  addHooks: function () {
    this.map.editCaption()
  },
})

U.EditPropertiesAction = U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'update-map-settings dark',
    tooltip: L._('Map advanced properties'),
  },

  addHooks: function () {
    this.map.edit()
  },
})

U.ChangeTileLayerAction = U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'dark update-map-tilelayers',
    tooltip: L._('Change tilelayers'),
  },

  addHooks: function () {
    this.map.updateTileLayers()
  },
})

U.UpdateExtentAction = U.BaseAction.extend({
  options: {
    className: 'update-map-extent dark',
    tooltip: L._('Save this center and zoom'),
  },

  addHooks: function () {
    this.map.setCenterAndZoom()
  },
})

U.UpdatePermsAction = U.BaseAction.extend({
  options: {
    className: 'update-map-permissions dark',
    tooltip: L._('Update permissions and editors'),
  },

  addHooks: function () {
    this.map.permissions.edit()
  },
})

U.DrawMarkerAction = U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'umap-draw-marker dark',
    label: 'DRAW_MARKER',
  },

  addHooks: function () {
    this.map.startMarker()
  },
})

U.DrawPolylineAction = U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'umap-draw-polyline dark',
    label: 'DRAW_LINE',
  },

  addHooks: function () {
    this.map.startPolyline()
  },
})

U.DrawPolygonAction = U.BaseAction.extend({
  options: {
    helpMenu: true,
    className: 'umap-draw-polygon dark',
    label: 'DRAW_POLYGON',
  },

  addHooks: function () {
    this.map.startPolygon()
  },
})

U.AddPolylineShapeAction = U.BaseAction.extend({
  options: {
    className: 'umap-draw-polyline-multi dark',
    tooltip: L._('Add a line to the current multi'),
  },

  addHooks: function () {
    this.map.editedFeature.ui.editor.newShape()
  },
})

U.AddPolygonShapeAction = U.AddPolylineShapeAction.extend({
  options: {
    className: 'umap-draw-polygon-multi dark',
    tooltip: L._('Add a polygon to the current multi'),
  },
})

U.BaseFeatureAction = L.ToolbarAction.extend({
  initialize: function (map, feature, latlng) {
    this.map = map
    this.feature = feature
    this.latlng = latlng
    L.ToolbarAction.prototype.initialize.call(this)
    this.postInit()
  },

  postInit: () => {},

  hideToolbar: function () {
    this.map.removeLayer(this.toolbar)
  },

  addHooks: function () {
    this.onClick({ latlng: this.latlng })
    this.hideToolbar()
  },
})

U.CreateHoleAction = U.BaseFeatureAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-new-hole',
      tooltip: L._('Start a hole here'),
    },
  },

  onClick: function (event) {
    this.feature.ui.startHole(event)
  },
})

U.ToggleEditAction = U.BaseFeatureAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-toggle-edit',
      tooltip: L._('Toggle edit mode (⇧+Click)'),
    },
  },

  onClick: function (event) {
    if (this.feature._toggleEditing) {
      this.feature._toggleEditing(event) // Path
    } else {
      this.feature.edit(event) // Marker
    }
  },
})

U.DeleteFeatureAction = U.BaseFeatureAction.extend({
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

U.DeleteShapeAction = U.BaseFeatureAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-delete-one-of-multi',
      tooltip: L._('Delete this shape'),
    },
  },

  onClick: function (e) {
    this.feature.ui.enableEdit().deleteShapeAt(e.latlng)
  },
})

U.ExtractShapeFromMultiAction = U.BaseFeatureAction.extend({
  options: {
    toolbarIcon: {
      className: 'umap-extract-shape-from-multi',
      tooltip: L._('Extract shape to separate feature'),
    },
  },

  onClick: function (e) {
    this.feature.ui.isolateShape(e.latlng)
  },
})

U.BaseVertexAction = U.BaseFeatureAction.extend({
  initialize: function (map, feature, latlng, vertex) {
    this.vertex = vertex
    U.BaseFeatureAction.prototype.initialize.call(this, map, feature, latlng)
  },
})

U.DeleteVertexAction = U.BaseVertexAction.extend({
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

U.SplitLineAction = U.BaseVertexAction.extend({
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

U.ContinueLineAction = U.BaseVertexAction.extend({
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
U.SettingsToolbar = L.Toolbar.Control.extend({})
U.DrawToolbar = L.Toolbar.Control.extend({
  initialize: function (options) {
    L.Toolbar.Control.prototype.initialize.call(this, options)
    this.map = this.options.map
    this.map.on('seteditedfeature', this.redraw, this)
  },

  appendToContainer: function (container) {
    this.options.actions = []
    if (this.map.options.enableMarkerDraw) {
      this.options.actions.push(U.DrawMarkerAction)
    }
    if (this.map.options.enablePolylineDraw) {
      this.options.actions.push(U.DrawPolylineAction)
      if (this.map.editedFeature && this.map.editedFeature instanceof U.LineString) {
        this.options.actions.push(U.AddPolylineShapeAction)
      }
    }
    if (this.map.options.enablePolygonDraw) {
      this.options.actions.push(U.DrawPolygonAction)
      if (this.map.editedFeature && this.map.editedFeature instanceof U.Polygon) {
        this.options.actions.push(U.AddPolygonShapeAction)
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

U.DropControl = L.Class.extend({
  initialize: function (map) {
    this.map = map
    this.dropzone = map._container
  },

  enable: function () {
    L.DomEvent.on(this.dropzone, 'dragenter', this.dragenter, this)
    L.DomEvent.on(this.dropzone, 'dragover', this.dragover, this)
    L.DomEvent.on(this.dropzone, 'drop', this.drop, this)
    L.DomEvent.on(this.dropzone, 'dragleave', this.dragleave, this)
  },

  disable: function () {
    L.DomEvent.off(this.dropzone, 'dragenter', this.dragenter, this)
    L.DomEvent.off(this.dropzone, 'dragover', this.dragover, this)
    L.DomEvent.off(this.dropzone, 'drop', this.drop, this)
    L.DomEvent.off(this.dropzone, 'dragleave', this.dragleave, this)
  },

  dragenter: function (e) {
    L.DomEvent.stop(e)
    this.map.scrollWheelZoom.disable()
    this.dropzone.classList.add('umap-dragover')
  },

  dragover: (e) => {
    L.DomEvent.stop(e)
  },

  drop: function (e) {
    this.map.scrollWheelZoom.enable()
    this.dropzone.classList.remove('umap-dragover')
    L.DomEvent.stop(e)
    for (let i = 0, file; (file = e.dataTransfer.files[i]); i++) {
      this.map.processFileToImport(file)
    }
    this.map.onceDataLoaded(this.map.fitDataBounds)
  },

  dragleave: function () {
    this.map.scrollWheelZoom.enable()
    this.dropzone.classList.remove('umap-dragover')
  },
})

U.EditControl = L.Control.extend({
  options: {
    position: 'topright',
  },

  onAdd: function (map) {
    const container = L.DomUtil.create('div', 'leaflet-control-edit-enable')
    const enableEditing = L.DomUtil.createButton(
      '',
      container,
      L._('Edit'),
      map.enableEdit,
      map
    )
    L.DomEvent.on(
      enableEditing,
      'mouseover',
      () => {
        map.tooltip.open({
          content: map.help.displayLabel('TOGGLE_EDIT'),
          anchor: enableEditing,
          position: 'bottom',
          delay: 750,
          duration: 5000,
        })
      },
      this
    )

    return container
  },
})

U.MoreControls = L.Control.extend({
  options: {
    position: 'topleft',
  },

  onAdd: function () {
    const container = L.DomUtil.create('div', 'umap-control-text')
    const moreButton = L.DomUtil.createButton(
      'umap-control-more',
      container,
      L._('More controls'),
      this.toggle,
      this
    )
    const lessButton = L.DomUtil.createButton(
      'umap-control-less',
      container,
      L._('Hide controls'),
      this.toggle,
      this
    )
    return container
  },

  toggle: function () {
    const pos = this.getPosition()
    const corner = this._map._controlCorners[pos]
    const className = 'umap-more-controls'
    if (L.DomUtil.hasClass(corner, className)) L.DomUtil.removeClass(corner, className)
    else L.DomUtil.addClass(corner, className)
  },
})

U.PermanentCreditsControl = L.Control.extend({
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
    )
    const creditsParagraph = L.DomUtil.create('p', '', paragraphContainer)

    this.paragraphContainer = paragraphContainer
    this.setCredits()
    this.setBackground()

    return paragraphContainer
  },

  setCredits: function () {
    this.paragraphContainer.innerHTML = U.Utils.toHTML(this.map.options.permanentCredit)
  },

  setBackground: function () {
    if (this.map.options.permanentCreditBackground) {
      this.paragraphContainer.style.backgroundColor = '#FFFFFFB0'
    } else {
      this.paragraphContainer.style.backgroundColor = ''
    }
  },
})

L.Control.Button = L.Control.extend({
  initialize: function (map, options) {
    this.map = map
    L.Control.prototype.initialize.call(this, options)
  },

  getClassName: function () {
    return this.options.className
  },

  onAdd: function (map) {
    const container = L.DomUtil.create('div', `${this.getClassName()} umap-control`)
    const button = L.DomUtil.createButton(
      '',
      container,
      this.options.title,
      this.onClick,
      this
    )
    L.DomEvent.on(button, 'dblclick', L.DomEvent.stopPropagation)
    this.afterAdd(container)
    return container
  },

  afterAdd: (container) => {},
})

U.DataLayersControl = L.Control.Button.extend({
  options: {
    position: 'topleft',
    className: 'umap-control-browse',
    title: L._('Open browser'),
  },

  afterAdd: function (container) {
    U.Utils.toggleBadge(container, this.map.browser.hasFilters())
  },

  onClick: function () {
    this.map.openBrowser()
  },
})

U.CaptionControl = L.Control.Button.extend({
  options: {
    position: 'topleft',
    className: 'umap-control-caption',
    title: L._('About'),
  },

  onClick: function () {
    this.map.openCaption()
  },
})

U.StarControl = L.Control.Button.extend({
  options: {
    position: 'topleft',
    title: L._('Star this map'),
  },

  getClassName: function () {
    const status = this.map.options.starred ? ' starred' : ''
    return `leaflet-control-star umap-control${status}`
  },

  onClick: function () {
    this.map.star()
  },
})

L.Control.Embed = L.Control.Button.extend({
  options: {
    position: 'topleft',
    title: L._('Share and download'),
    className: 'leaflet-control-embed umap-control',
  },

  onClick: function () {
    this.map.share.open()
  },
})

const ControlsMixin = {
  HIDDABLE_CONTROLS: [
    'zoom',
    'search',
    'fullscreen',
    'embed',
    'datalayers',
    'caption',
    'locate',
    'measure',
    'editinosm',
    'star',
    'tilelayers',
  ],

  renderEditToolbar: function () {
    const className = 'umap-main-edit-toolbox'
    const container =
      document.querySelector(`.${className}`) ||
      L.DomUtil.create(
        'div',
        `${className} with-transition dark`,
        this._controlContainer
      )
    container.innerHTML = ''
    const leftContainer = L.DomUtil.create('div', 'umap-left-edit-toolbox', container)
    const rightContainer = L.DomUtil.create('div', 'umap-right-edit-toolbox', container)
    const logo = L.DomUtil.create('div', 'logo', leftContainer)
    L.DomUtil.createLink('', logo, 'uMap', '/', null, L._('Go to the homepage'))
    const nameButton = L.DomUtil.createButton('map-name', leftContainer, '')
    L.DomEvent.on(
      nameButton,
      'mouseover',
      function () {
        this.tooltip.open({
          content: L._('Edit the title of the map'),
          anchor: nameButton,
          position: 'bottom',
          delay: 500,
          duration: 5000,
        })
      },
      this
    )
    const shareStatusButton = L.DomUtil.createButton(
      'share-status',
      leftContainer,
      '',
      this.permissions.edit,
      this.permissions
    )
    L.DomEvent.on(
      shareStatusButton,
      'mouseover',
      function () {
        this.tooltip.open({
          content: L._('Update who can see and edit the map'),
          anchor: shareStatusButton,
          position: 'bottom',
          delay: 500,
          duration: 5000,
        })
      },
      this
    )
    if (this.options.editMode === 'advanced') {
      L.DomEvent.on(nameButton, 'click', this.editCaption, this)
      L.DomEvent.on(shareStatusButton, 'click', this.permissions.edit, this.permissions)
    }
    if (this.options.user?.id) {
      const button = U.Utils.loadTemplate(`
        <button class="umap-user flat" type="button">
          <i class="icon icon-16 icon-profile"></i>
          <span>${this.options.user.name}</span>
        </button>
        `)
      rightContainer.appendChild(button)
      const menu = new U.ContextMenu({ className: 'dark', fixed: true })
      const actions = [
        {
          label: L._('New map'),
          action: this.urls.get('map_new'),
        },
        {
          label: L._('My maps'),
          action: this.urls.get('user_dashboard'),
        },
        {
          label: L._('My teams'),
          action: this.urls.get('user_teams'),
        },
      ]
      if (this.urls.has('user_profile')) {
        actions.push({
          label: L._('My profile'),
          action: this.urls.get('user_profile'),
        })
      }
      button.addEventListener('click', () => {
        const x = button.offsetLeft
        const y = button.offsetTop + button.offsetHeight
        menu.open([x, y], actions)
      })
    }
    this.help.getStartedLink(rightContainer)
    const controlEditCancel = L.DomUtil.createButton(
      'leaflet-control-edit-cancel',
      rightContainer,
      L.DomUtil.add('span', '', null, L._('Cancel edits')),
      this.askForReset,
      this
    )
    L.DomEvent.on(
      controlEditCancel,
      'mouseover',
      function () {
        this.tooltip.open({
          content: this.help.displayLabel('CANCEL'),
          anchor: controlEditCancel,
          position: 'bottom',
          delay: 500,
          duration: 5000,
        })
      },
      this
    )
    const controlEditDisable = L.DomUtil.createButton(
      'leaflet-control-edit-disable',
      rightContainer,
      L.DomUtil.add('span', '', null, L._('View')),
      this.disableEdit,
      this
    )
    L.DomEvent.on(
      controlEditDisable,
      'mouseover',
      function () {
        this.tooltip.open({
          content: this.help.displayLabel('PREVIEW'),
          anchor: controlEditDisable,
          position: 'bottom',
          delay: 500,
          duration: 5000,
        })
      },
      this
    )
    const controlEditSave = L.DomUtil.createButton(
      'leaflet-control-edit-save button',
      rightContainer,
      L.DomUtil.add('span', '', null, L._('Save')),
      this.save,
      this
    )
    L.DomEvent.on(
      controlEditSave,
      'mouseover',
      function () {
        this.tooltip.open({
          content: this.help.displayLabel('SAVE'),
          anchor: controlEditSave,
          position: 'bottom',
          delay: 500,
          duration: 5000,
        })
      },
      this
    )
  },

  editDatalayers: function () {
    if (!this.editEnabled) return
    const container = L.DomUtil.create('div')
    L.DomUtil.createTitle(container, L._('Manage layers'), 'icon-layers')
    const ul = L.DomUtil.create('ul', '', container)
    this.eachDataLayerReverse((datalayer) => {
      const row = L.DomUtil.create('li', 'orderable', ul)
      L.DomUtil.createIcon(row, 'icon-drag', L._('Drag to reorder'))
      datalayer.renderToolbox(row)
      const title = L.DomUtil.add('span', '', row, datalayer.options.name)
      row.classList.toggle('off', !datalayer.isVisible())
      title.textContent = datalayer.options.name
      row.dataset.id = L.stamp(datalayer)
    })
    const onReorder = (src, dst, initialIndex, finalIndex) => {
      const layer = this.datalayers[src.dataset.id]
      const other = this.datalayers[dst.dataset.id]
      const minIndex = Math.min(layer.getRank(), other.getRank())
      const maxIndex = Math.max(layer.getRank(), other.getRank())
      if (finalIndex === 0) layer.bringToTop()
      else if (finalIndex > initialIndex) layer.insertBefore(other)
      else layer.insertAfter(other)
      this.eachDataLayerReverse((datalayer) => {
        if (datalayer.getRank() >= minIndex && datalayer.getRank() <= maxIndex)
          datalayer.isDirty = true
      })
      this.indexDatalayers()
    }
    const orderable = new U.Orderable(ul, onReorder)

    const bar = L.DomUtil.create('div', 'button-bar', container)
    L.DomUtil.createButton(
      'show-on-edit block add-datalayer button',
      bar,
      L._('Add a layer'),
      this.newDataLayer,
      this
    )

    this.editPanel.open({ content: container })
  },
}

/* Used in view mode to define the current tilelayer */
U.TileLayerControl = L.Control.IconLayers.extend({
  initialize: function (map, options) {
    this.map = map
    this.maxShown = 9
    L.Control.IconLayers.prototype.initialize.call(this, {
      position: 'topleft',
      manageLayers: false,
    })
    this.on('activelayerchange', (e) => map.selectTileLayer(e.layer))
  },

  setLayers: function (layers) {
    if (!layers) {
      layers = []
      this.map.eachTileLayer((layer) => {
        try {
          // We'd like to use layer.getTileUrl, but this method will only work
          // when the tilelayer is actually added to the map (needs this._tileZoom
          // to be defined)
          // Fixme when https://github.com/Leaflet/Leaflet/pull/9201 is released
          const icon = U.Utils.template(
            layer.options.url_template,
            this.map.demoTileInfos
          )
          layers.push({
            title: layer.options.name,
            layer: layer,
            icon: icon,
          })
        } catch (e) {
          // Skip this tilelayer
          console.error(e)
        }
      })
    }
    this._allLayers = layers
    L.Control.IconLayers.prototype.setLayers.call(this, layers.slice(0, this.maxShown))
    if (this.map.selected_tilelayer) this.setActiveLayer(this.map.selected_tilelayer)
  },

  _createLayerElements: function () {
    L.Control.IconLayers.prototype._createLayerElements.call(this)
    if (Object.keys(this._allLayers).length <= this.maxShown) return
    const lastRow = this._container.querySelector(
      '.leaflet-iconLayers-layersRow:last-child'
    )
    const button = L.DomUtil.element({
      tagName: 'button',
      className:
        'leaflet-iconLayers-layerCell leaflet-iconLayers-layerCell-plus button',
      textContent: '+',
      parent: lastRow,
    })
    L.DomEvent.on(button, 'click', () =>
      this.map._controls.tilelayersChooser.openSwitcher()
    )
  },
})

/* Used in edit mode to define the default tilelayer */
U.TileLayerChooser = L.Control.extend({
  options: {
    position: 'topleft',
  },

  initialize: function (map, options = {}) {
    this.map = map
    L.Control.prototype.initialize.call(this, options)
  },

  onAdd: function () {
    const container = L.DomUtil.create('div', 'leaflet-control-tilelayers umap-control')
    const changeMapBackgroundButton = L.DomUtil.createButton(
      '',
      container,
      L._('Change map background'),
      this.openSwitcher,
      this
    )
    L.DomEvent.on(changeMapBackgroundButton, 'dblclick', L.DomEvent.stopPropagation)
    return container
  },

  openSwitcher: function (options = {}) {
    const container = L.DomUtil.create('div', 'umap-tilelayer-switcher-container')
    L.DomUtil.createTitle(container, L._('Change tilelayers'), 'icon-tilelayer')
    this._tilelayers_container = L.DomUtil.create('ul', '', container)
    this.buildList(options)
    const panel = options.edit ? this.map.editPanel : this.map.panel
    panel.open({ content: container })
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
  },

  addTileLayerElement: function (tilelayer, options) {
    const selectedClass = this.map.hasLayer(tilelayer) ? 'selected' : ''
    const el = L.DomUtil.create('li', selectedClass, this._tilelayers_container)
    const img = L.DomUtil.create('img', '', el)
    const name = L.DomUtil.create('div', '', el)
    img.src = U.Utils.template(tilelayer.options.url_template, this.map.demoTileInfos)
    img.loading = 'lazy'
    name.textContent = tilelayer.options.name
    L.DomEvent.on(
      el,
      'click',
      function () {
        this.map.selectTileLayer(tilelayer)
        this.map._controls.tilelayers.setLayers()
        if (options?.callback) options.callback(tilelayer)
      },
      this
    )
  },
})

U.AttributionControl = L.Control.Attribution.extend({
  options: {
    prefix: '',
  },

  _update: function () {
    // Layer is no more on the map
    if (!this._map) return
    L.Control.Attribution.prototype._update.call(this)
    // Use our own container, so we can hide/show on small screens
    const credits = this._container.innerHTML
    this._container.innerHTML = ''
    const container = L.DomUtil.create('div', 'attribution-container', this._container)
    container.innerHTML = credits
    const shortCredit = this._map.getOption('shortCredit')
    const captionMenus = this._map.getOption('captionMenus')
    if (shortCredit) {
      L.DomUtil.element({
        tagName: 'span',
        parent: container,
        safeHTML: ` — ${U.Utils.toHTML(shortCredit)}`,
      })
    }
    if (captionMenus) {
      const link = L.DomUtil.add('a', '', container, ` — ${L._('Open caption')}`)
      L.DomEvent.on(link, 'click', L.DomEvent.stop)
        .on(link, 'click', this._map.openCaption, this._map)
        .on(link, 'dblclick', L.DomEvent.stop)
    }
    if (window.top === window.self && captionMenus) {
      // We are not in iframe mode
      L.DomUtil.createLink('', container, ` — ${L._('Home')}`, '/')
    }
    if (captionMenus) {
      L.DomUtil.createLink(
        '',
        container,
        ` — ${L._('Powered by uMap')}`,
        'https://umap-project.org/'
      )
    }
    L.DomUtil.createLink('attribution-toggle', this._container, '')
  },
})

/*
 * Take control over L.Control.Locate to be able to
 * call start() before adding the control (and thus the button) to the map.
 */
U.Locate = L.Control.Locate.extend({
  initialize: function (map, options) {
    // When calling start(), it will try to add a location marker
    // on the layer, which is normally added in the addTo/onAdd method
    this._layer = this.options.layer = new L.LayerGroup()
    // When calling start(), it will call _activate(), which then adds
    // location related event listeners on the map
    this.map = map
    L.Control.Locate.prototype.initialize.call(this, options)
  },

  onAdd: function (map) {
    const active = this._active
    const container = L.Control.Locate.prototype.onAdd.call(this, map)
    this._active = active
    return container
  },

  _activate: function () {
    this._map = this.map
    L.Control.Locate.prototype._activate.call(this)
  },

  remove: function () {
    // Prevent to call remove if the control is not really added to the map
    // This occurs because we do create the control and call its activate
    // method before adding the control button itself to the map, in the
    // case where the map defaultView is set to "location"
    if (!this._container || !this._container.parentNode) return
    return L.Control.Locate.prototype.remove.call(this)
  },
})

U.Search = L.PhotonSearch.extend({
  initialize: function (map, input, options) {
    this.options.placeholder = L._('Type a place name or coordinates')
    this.options.location_bias_scale = 0.5
    L.PhotonSearch.prototype.initialize.call(this, map, input, options)
    this.options.url = map.options.urls.search
    if (map.options.maxBounds) this.options.bbox = map.options.maxBounds.toBBoxString()
    this.reverse = new L.PhotonReverse({
      handleResults: (geojson) => {
        this.handleResultsWithReverse(geojson)
      },
    })
  },

  handleResultsWithReverse: function (geojson) {
    const latlng = this.reverse.latlng
    geojson.features.unshift({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [latlng.lng, latlng.lat] },
      properties: {
        name: L._('Go to "{coords}"', { coords: `${latlng.lat} ${latlng.lng}` }),
      },
    })

    this.handleResults(geojson)
  },

  search: function () {
    const pattern = /^(?<lat>[-+]?\d{1,2}[.,]\d+)\s*[ ,]\s*(?<lng>[-+]?\d{1,3}[.,]\d+)$/
    if (pattern.test(this.input.value)) {
      this.hide()
      const { lat, lng } = pattern.exec(this.input.value).groups
      const latlng = L.latLng(lat, lng)
      if (latlng.isValid()) {
        this.reverse.doReverse(latlng)
      } else {
        U.Alert.error(L._('Invalid latitude or longitude'))
      }
      return
    }
    // Only numbers, abort.
    if (/^[\d .,]*$/.test(this.input.value)) return
    // Do normal search
    this.options.includePosition = this.map.getZoom() > 10
    L.PhotonSearch.prototype.search.call(this)
  },

  onBlur: function (e) {
    // Overrided because we don't want to hide the results on blur.
    this.fire('blur')
  },

  formatResult: function (feature, el) {
    const tools = L.DomUtil.create('span', 'search-result-tools', el)
    const zoom = L.DomUtil.createButtonIcon(
      tools,
      'icon-zoom',
      L._('Zoom to this place')
    )
    const edit = L.DomUtil.createButtonIcon(
      tools,
      'icon-edit',
      L._('Save this location as new feature')
    )
    // We need to use "mousedown" because Leaflet.Photon listen to mousedown
    // on el.
    L.DomEvent.on(zoom, 'mousedown', (e) => {
      L.DomEvent.stop(e)
      this.zoomToFeature(feature)
    })
    L.DomEvent.on(edit, 'mousedown', (e) => {
      L.DomEvent.stop(e)
      const datalayer = this.map.defaultEditDataLayer()
      const layer = datalayer.makeFeature(feature)
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
    this.map.panel.close()
  },
})

U.SearchControl = L.Control.extend({
  options: {
    position: 'topleft',
  },

  onAdd: function (map) {
    this.map = map
    const container = L.DomUtil.create('div', 'leaflet-control-search umap-control')
    L.DomEvent.disableClickPropagation(container)
    L.DomUtil.createButton(
      '',
      container,
      L._('Search location'),
      (e) => {
        L.DomEvent.stop(e)
        this.open()
      },
      this
    )
    return container
  },

  open: function () {
    const options = {
      limit: 10,
      noResultLabel: L._('No results'),
    }
    if (this.map.options.photonUrl) options.url = this.map.options.photonUrl
    const container = L.DomUtil.create('div', '')

    L.DomUtil.createTitle(container, L._('Search location'), 'icon-search')
    const input = L.DomUtil.create('input', 'photon-input', container)
    const resultsContainer = L.DomUtil.create('div', 'photon-autocomplete', container)
    this.search = new U.Search(this.map, input, options)
    const id = Math.random()
    this.search.on('ajax:send', () => {
      this.map.fire('dataloading', { id: id })
    })
    this.search.on('ajax:return', () => {
      this.map.fire('dataload', { id: id })
    })
    this.search.resultsContainer = resultsContainer
    this.map.panel.open({ content: container }).then(input.focus())
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

  _cloneLayer: (layer) => new L.TileLayer(layer._url, L.Util.extend({}, layer.options)),
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

U.Editable = L.Editable.extend({
  initialize: function (map, options) {
    L.Editable.prototype.initialize.call(this, map, options)
    this.on('editable:drawing:click editable:drawing:move', this.drawingTooltip)
    this.on('editable:drawing:end', (event) => {
      this.map.tooltip.close()
      // Leaflet.Editable will delete the drawn shape if invalid
      // (eg. line has only one drawn point)
      // So let's check if the layer has no more shape
      if (!event.layer.feature.hasGeom()) {
        event.layer.feature.del()
      } else {
        event.layer.feature.edit()
      }
    })
    // Layer for items added by users
    this.on('editable:drawing:cancel', (event) => {
      if (event.layer instanceof U.LeafletMarker) event.layer.feature.del()
    })
    this.on('editable:drawing:commit', function (event) {
      event.layer.feature.isDirty = true
      if (this.map.editedFeature !== event.layer) event.layer.feature.edit(event)
    })
    this.on('editable:editing', (event) => {
      const feature = event.layer.feature
      feature.isDirty = true
      feature.pullGeometry(false)
    })
    this.on('editable:vertex:ctrlclick', (event) => {
      const index = event.vertex.getIndex()
      if (
        index === 0 ||
        (index === event.vertex.getLastIndex() && event.vertex.continue)
      )
        event.vertex.continue()
    })
    this.on('editable:vertex:altclick', (event) => {
      if (event.vertex.editor.vertexCanBeDeleted(event.vertex)) event.vertex.delete()
    })
    this.on('editable:vertex:rawclick', this.onVertexRawClick)
  },

  createPolyline: function (latlngs) {
    const datalayer = this.map.defaultEditDataLayer()
    const point = new U.LineString(datalayer, {
      geometry: { type: 'LineString', coordinates: [] },
    })
    return point.ui
  },

  createPolygon: function (latlngs) {
    const datalayer = this.map.defaultEditDataLayer()
    const point = new U.Polygon(datalayer, {
      geometry: { type: 'Polygon', coordinates: [] },
    })
    return point.ui
  },

  createMarker: function (latlng) {
    const datalayer = this.map.defaultEditDataLayer()
    const point = new U.Point(datalayer, {
      geometry: { type: 'Point', coordinates: [latlng.lng, latlng.lat] },
    })
    return point.ui
  },

  _getDefaultProperties: function () {
    const result = {}
    if (this.map.options.featuresHaveOwner?.user) {
      result.geojson = { properties: { owner: this.map.options.user.id } }
    }
    return result
  },

  connectCreatedToMap: function (layer) {
    // Overrided from Leaflet.Editable
    const datalayer = this.map.defaultEditDataLayer()
    datalayer.addFeature(layer.feature)
    layer.isDirty = true
    return layer
  },

  drawingTooltip: function (e) {
    if (e.layer instanceof L.Marker && e.type === 'editable:drawing:start') {
      this.map.tooltip.open({ content: L._('Click to add a marker') })
    }
    if (!(e.layer instanceof L.Polyline)) {
      // only continue with Polylines and Polygons
      return
    }

    let content = L._('Drawing')
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
        if (e.layer.editor._drawing === L.Editable.BACKWARD) {
          tmpLatLngs.unshift(e.latlng)
        } else {
          tmpLatLngs.push(e.latlng)
        }
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
        content += ` ${L._('(area: {measure})', { measure: measure })}`
      } else if (e.layer instanceof L.Polyline) {
        content += ` ${L._('(length: {measure})', { measure: measure })}`
      }
    }
    if (content) {
      this.map.tooltip.open({ content: content })
    }
  },

  closeTooltip: function () {
    this.map.ui.closeTooltip()
  },

  onVertexRawClick: (e) => {
    e.layer.onVertexRawClick(e)
    L.DomEvent.stop(e)
    e.cancel()
  },
})
