
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