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