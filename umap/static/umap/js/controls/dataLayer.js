L.U.DataLayer.include({
  renderLegend: function (container) {
    if (this.layer.renderLegend) return this.layer.renderLegend(container)
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
    if (this.isReadOnly()) {
      L.DomUtil.addClass(container, 'readonly')
    } else {
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
    }
    L.DomEvent.on(toggle, 'click', this.toggle, this)
    L.DomEvent.on(zoomTo, 'click', this.zoomTo, this)
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
  if (this.isVisible()) this.propagateShow()
})