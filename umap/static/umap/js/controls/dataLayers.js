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
  
      L.DomUtil.createButton(
        'umap-browse-link',
        actions,
        L._('Browse data'),
        map.openBrowser,
        map
      )
  
      const toggleButton = L.DomUtil.createButton(
        'umap-browse-toggle',
        container,
        L._('See data layers')
      )
      L.DomEvent.on(toggleButton, 'click', L.DomEvent.stop)
  
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
        L.DomEvent.on(toggleButton, 'click', L.DomEvent.stop).on(
          toggleButton,
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
        this.map.eachDataLayerReverse(function (datalayer) {
          this.addDataLayer(this._datalayers_container, datalayer)
        }, this)
      }
    },
  
    expand: function () {
      L.DomUtil.addClass(this._container, 'expanded')
    },
  
    collapse: function () {
      if (this.map.options.datalayersControl === 'expanded') return
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
  
      const bar = L.DomUtil.create('div', 'button-bar', container)
      L.DomUtil.createButton(
        'show-on-edit block add-datalayer button',
        bar,
        L._('Add a layer'),
        this.newDataLayer,
        this
      )
  
      this.map.ui.openPanel({ data: { html: container }, className: 'dark' })
    },
  })
