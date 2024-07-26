// Goes here all code related to Leaflet, DOM and user interactions.
import {
  Marker,
  Polyline,
  Polygon,
  DomUtil,
  LineUtil,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../i18n.js'
import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import * as Utils from '../utils.js'

const FeatureMixin = {
  initialize: function (feature) {
    this.feature = feature
    this.parentClass.prototype.initialize.call(this, this.feature.coordinates)
  },

  onAdd: function (map) {
    this.addInteractions()
    return this.parentClass.prototype.onAdd.call(this, map)
  },

  onRemove: function (map) {
    this.parentClass.prototype.onRemove.call(this, map)
    if (map.editedFeature === this.feature) {
      this.feature._marked_for_deletion = true
      this.feature.endEdit()
      map.editPanel.close()
    }
  },

  addInteractions: function () {
    this.on('contextmenu editable:vertex:contextmenu', this._showContextMenu)
    this.on('click', this.onClick)
  },

  onClick: function (event) {
    if (this._map.measureTools?.enabled()) return
    this._popupHandlersAdded = true // Prevent leaflet from managing event
    if (!this._map.editEnabled) {
      this.feature.view(event)
    } else if (!this.feature.isReadOnly()) {
      if (event.originalEvent.shiftKey) {
        if (event.originalEvent.ctrlKey || event.originalEvent.metaKey) {
          this.feature.datalayer.edit(event)
        } else {
          if (this.feature._toggleEditing) this.feature._toggleEditing(event)
          else this.feature.edit(event)
        }
      } else if (!this._map.editTools?.drawing()) {
        new L.Toolbar.Popup(event.latlng, {
          className: 'leaflet-inplace-toolbar',
          anchor: this.getPopupToolbarAnchor(),
          actions: this.feature.getInplaceToolbarActions(event),
        }).addTo(this._map, this.feature, event.latlng)
      }
    }
    L.DomEvent.stop(event)
  },

  resetTooltip: function () {
    if (!this.feature.hasGeom()) return
    const displayName = this.feature.getDisplayName(null)
    let showLabel = this.feature.getOption('showLabel')
    const oldLabelHover = this.feature.getOption('labelHover')

    const options = {
      direction: this.feature.getOption('labelDirection'),
      interactive: this.feature.getOption('labelInteractive'),
    }

    if (oldLabelHover && showLabel) showLabel = null // Retrocompat.
    options.permanent = showLabel === true
    this.unbindTooltip()
    if ((showLabel === true || showLabel === null) && displayName) {
      this.bindTooltip(Utils.escapeHTML(displayName), options)
    }
  },

  _showContextMenu: function (event) {
    L.DomEvent.stop(event)
    const pt = this._map.mouseEventToContainerPoint(event.originalEvent)
    event.relatedTarget = this
    this._map.contextmenu.showAt(pt, event)
  },

  getContextMenuItems: function (event) {
    const permalink = this.feature.getPermalink()
    let items = []
    if (permalink)
      items.push({
        text: translate('Permalink'),
        callback: () => {
          window.open(permalink)
        },
      })
    if (this._map.editEnabled && !this.feature.isReadOnly()) {
      items = items.concat(this.getContextMenuEditItems(event))
    }
    return items
  },

  getContextMenuEditItems: function () {
    let items = ['-']
    if (this._map.editedFeature !== this) {
      items.push({
        text: `${translate('Edit this feature')} (⇧+Click)`,
        callback: this.feature.edit,
        context: this.feature,
        iconCls: 'umap-edit',
      })
    }
    items = items.concat(
      {
        text: this._map.help.displayLabel('EDIT_FEATURE_LAYER'),
        callback: this.feature.datalayer.edit,
        context: this.feature.datalayer,
        iconCls: 'umap-edit',
      },
      {
        text: translate('Delete this feature'),
        callback: this.feature.confirmDelete,
        context: this.feature,
        iconCls: 'umap-delete',
      },
      {
        text: translate('Clone this feature'),
        callback: this.feature.clone,
        context: this.feature,
      }
    )
    return items
  },

  onCommit: function () {
    this.geometryChanged(false)
    this.feature.onCommit()
  },

  getPopupToolbarAnchor: () => [0, 0],
}

export const LeafletMarker = Marker.extend({
  parentClass: Marker,
  includes: [FeatureMixin],

  initialize: function (feature) {
    FeatureMixin.initialize.call(this, feature)
    this.setIcon(this.getIcon())
  },

  geometryChanged: function (sync = true) {
    this.feature.coordinates = this._latlng
    if (sync) {
      this.feature.sync.update('geometry', this.feature.geometry)
    }
  },

  addInteractions() {
    FeatureMixin.addInteractions.call(this)
    this.on('dragend', (event) => {
      this.isDirty = true
      this.feature.edit(event)
      this.geometryChanged()
    })
    this.on('editable:drawing:commit', this.onCommit)
    if (!this.feature.isReadOnly()) this.on('mouseover', this._enableDragging)
    this.on('mouseout', this._onMouseOut)
    this._popupHandlersAdded = true // prevent Leaflet from binding event on bindPopup
    this.on('popupopen', this.highlight)
    this.on('popupclose', this.resetHighlight)
  },

  _onMouseOut: function () {
    if (this.dragging?._draggable && !this.dragging._draggable._moving) {
      // Do not disable if the mouse went out while dragging
      this._disableDragging()
    }
  },

  _enableDragging: function () {
    // TODO: start dragging after 1 second on mouse down
    if (this._map.editEnabled) {
      if (!this.editEnabled()) this.enableEdit()
      // Enabling dragging on the marker override the Draggable._OnDown
      // event, which, as it stopPropagation, refrain the call of
      // _onDown with map-pane element, which is responsible to
      // set the _moved to false, and thus to enable the click.
      // We should find a cleaner way to handle this.
      this._map.dragging._draggable._moved = false
    }
  },

  _disableDragging: function () {
    if (this._map.editEnabled) {
      if (this.editor?.drawing) return // when creating a new marker, the mouse can trigger the mouseover/mouseout event
      // do not listen to them
      this.disableEdit()
    }
  },

  _initIcon: function () {
    this.options.icon = this.getIcon()
    Marker.prototype._initIcon.call(this)
    // Allow to run code when icon is actually part of the DOM
    this.options.icon.onAdd()
    this.resetTooltip()
  },

  getIconClass: function () {
    return this.feature.getOption('iconClass')
  },

  getIcon: function () {
    const Class = U.Icon[this.getIconClass()] || U.Icon.Default
    return new Class({ feature: this.feature })
  },

  _getTooltipAnchor: function () {
    const anchor = this.options.icon.options.tooltipAnchor.clone()
    const direction = this.feature.getOption('labelDirection')
    if (direction === 'left') {
      anchor.x *= -1
    } else if (direction === 'bottom') {
      anchor.x = 0
      anchor.y = 0
    } else if (direction === 'top') {
      anchor.x = 0
    }
    return anchor
  },

  _redraw: function () {
    // May no be on the map when in a cluster.
    if (this._map) {
      this._initIcon()
      this.update()
    }
  },

  getCenter: function () {
    return this._latlng
  },

  highlight: function () {
    DomUtil.addClass(this.options.icon.elements.main, 'umap-icon-active')
  },

  resetHighlight: function () {
    DomUtil.removeClass(this.options.icon.elements.main, 'umap-icon-active')
  },

  getPopupToolbarAnchor: function () {
    return this.options.icon.options.popupAnchor
  },
})

const PathMixin = {
  _onMouseOver: function () {
    if (this._map.measureTools?.enabled()) {
      this._map.tooltip.open({ content: this.feature.getMeasure(), anchor: this })
    } else if (this._map.editEnabled && !this._map.editedFeature) {
      this._map.tooltip.open({ content: translate('Click to edit'), anchor: this })
    }
  },

  geometryChanged: function () {
    this.feature.coordinates = this._latlngs
  },

  addInteractions: function () {
    FeatureMixin.addInteractions.call(this)
    this.on('editable:disable', this.onCommit)
    this.on('mouseover', this._onMouseOver)
    this.on('drag editable:drag', this._onDrag)
    this.on('popupopen', this.highlightPath)
    this.on('popupclose', this._redraw)
  },

  highlightPath: function () {
    this.parentClass.prototype.setStyle.call(this, {
      fillOpacity: Math.sqrt(this.feature.getDynamicOption('fillOpacity', 1.0)),
      opacity: 1.0,
      weight: 1.3 * this.feature.getDynamicOption('weight'),
    })
  },

  _onDrag: function () {
    if (this._tooltip) this._tooltip.setLatLng(this.getCenter())
  },

  onAdd: function (map) {
    this._container = null
    this.setStyle()
    FeatureMixin.onAdd.call(this, map)
    if (this.editing?.enabled()) this.editing.addHooks()
    this.resetTooltip()
    this._path.dataset.feature = this.feature.id
  },

  onRemove: function (map) {
    if (this.editing?.enabled()) this.editing.removeHooks()
    FeatureMixin.onRemove.call(this, map)
  },

  setStyle: function (options = {}) {
    for (const option of this.feature.getStyleOptions()) {
      options[option] = this.feature.getDynamicOption(option)
    }
    options.pointerEvents = options.interactive ? 'visiblePainted' : 'stroke'
    this.parentClass.prototype.setStyle.call(this, options)
  },

  _redraw: function () {
    this.setStyle()
    this.resetTooltip()
  },

  getVertexActions: () => [U.DeleteVertexAction],

  onVertexRawClick: function (event) {
    new L.Toolbar.Popup(event.latlng, {
      className: 'leaflet-inplace-toolbar',
      actions: this.getVertexActions(event),
    }).addTo(this._map, this, event.latlng, event.vertex)
  },

  getContextMenuItems: function (event) {
    let items = FeatureMixin.getContextMenuItems.call(this, event)
    items.push({
      text: translate('Display measure'),
      callback: () => Alert.info(this.feature.getMeasure()),
    })
    if (this._map.editEnabled && !this.feature.isReadOnly() && this.feature.isMulti()) {
      items = items.concat(this.getContextMenuMultiItems(event))
    }
    return items
  },

  getContextMenuMultiItems: function (event) {
    const items = [
      '-',
      {
        text: translate('Remove shape from the multi'),
        callback: () => {
          this.enableEdit().deleteShapeAt(event.latlng)
        },
      },
    ]
    const shape = this.shapeAt(event.latlng)
    if (this._latlngs.indexOf(shape) > 0) {
      items.push({
        text: translate('Make main shape'),
        callback: () => {
          this.enableEdit().deleteShape(shape)
          this.editor.prependShape(shape)
        },
      })
    }
    return items
  },

  getContextMenuEditItems: function (event) {
    const items = FeatureMixin.getContextMenuEditItems.call(this, event)
    if (
      this._map?.editedFeature !== this &&
      this.feature.isSameClass(this._map.editedFeature)
    ) {
      items.push({
        text: translate('Transfer shape to edited feature'),
        callback: () => {
          this.feature.transferShape(event.latlng, this._map.editedFeature)
        },
      })
    }
    if (this.feature.isMulti()) {
      items.push({
        text: translate('Extract shape to separate feature'),
        callback: () => {
          this.feature.isolateShape(event.latlng, this._map.editedFeature)
        },
      })
    }
    return items
  },
}

export const LeafletPolyline = Polyline.extend({
  parentClass: Polyline,
  includes: [FeatureMixin, PathMixin],

  getVertexActions: function (event) {
    const actions = PathMixin.getVertexActions.call(this, event)
    const index = event.vertex.getIndex()
    if (index === 0 || index === event.vertex.getLastIndex()) {
      actions.push(U.ContinueLineAction)
    } else {
      actions.push(U.SplitLineAction)
    }
    return actions
  },

  getContextMenuEditItems: function (event) {
    const items = PathMixin.getContextMenuEditItems.call(this, event)
    const vertexClicked = event.vertex
    let index
    if (!this.feature.isMulti()) {
      items.push({
        text: translate('Transform to polygon'),
        callback: this.feature.toPolygon,
        context: this.feature,
      })
    }
    if (vertexClicked) {
      index = event.vertex.getIndex()
      if (index !== 0 && index !== event.vertex.getLastIndex()) {
        items.push({
          text: translate('Split line'),
          callback: event.vertex.split,
          context: event.vertex,
        })
      } else if (index === 0 || index === event.vertex.getLastIndex()) {
        items.push({
          text: this._map.help.displayLabel('CONTINUE_LINE'),
          callback: event.vertex.continue,
          context: event.vertex.continue,
        })
      }
    }
    return items
  },

  getContextMenuMultiItems: function (event) {
    const items = PathMixin.getContextMenuMultiItems.call(this, event)
    items.push({
      text: translate('Merge lines'),
      callback: this.feature.mergeShapes,
      context: this.feature,
    })
    return items
  },
})

export const LeafletPolygon = Polygon.extend({
  parentClass: Polygon,
  includes: [FeatureMixin, PathMixin],

  getContextMenuEditItems: function (event) {
    const items = PathMixin.getContextMenuEditItems.call(this, event)
    const shape = this.shapeAt(event.latlng)
    // No multi and no holes.
    if (
      shape &&
      !this.feature.isMulti() &&
      (LineUtil.isFlat(shape) || shape.length === 1)
    ) {
      items.push({
        text: translate('Transform to lines'),
        callback: this.feature.toLineString,
        context: this.feature,
      })
    }
    items.push({
      text: translate('Start a hole here'),
      callback: this.startHole,
      context: this,
    })
    return items
  },

  startHole: function (event) {
    this.enableEdit().newHole(event.latlng)
  },
})
