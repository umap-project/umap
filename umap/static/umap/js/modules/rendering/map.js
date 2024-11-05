// Goes here all code related to Leaflet, DOM and user interactions.
import {
  Map as BaseMap,
  DomUtil,
  DomEvent,
  latLngBounds,
  latLng,
  Control,
  setOptions,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../i18n.js'
import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import * as Utils from '../utils.js'
import * as Icon from './icon.js'

// Those options are not saved on the server, so they can live here
// instead of in umap.properties
BaseMap.mergeOptions({
  demoTileInfos: { s: 'a', z: 9, x: 265, y: 181, '-y': 181, r: '' },
  attributionControl: false,
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

  initControls: function () {
    this.helpMenuActions = {}
    this._controls = {}

    if (this.umap.hasEditMode() && !this.options.noControl) {
      new U.EditControl(this).addTo(this)

      new U.DrawToolbar({ map: this }).addTo(this)
      const editActions = [
        U.EditCaptionAction,
        U.EditPropertiesAction,
        U.EditLayersAction,
        U.ChangeTileLayerAction,
        U.UpdateExtentAction,
        U.UpdatePermsAction,
        U.ImportAction,
      ]
      if (this.options.editMode === 'advanced') {
        new U.SettingsToolbar({ actions: editActions }).addTo(this)
      }
    }
    this._controls.zoom = new Control.Zoom({
      zoomInTitle: translate('Zoom in'),
      zoomOutTitle: translate('Zoom out'),
    })
    this._controls.datalayers = new U.DataLayersControl(this.umap)
    this._controls.caption = new U.CaptionControl(this.umap)
    this._controls.locate = new U.Locate(this, {
      strings: {
        title: translate('Center map on your location'),
      },
      showPopup: false,
      // We style this control in our own CSS for consistency with other controls,
      // but the control breaks if we don't specify a class here, so a fake class
      // will do.
      icon: 'umap-fake-class',
      iconLoading: 'umap-fake-class',
      flyTo: this.options.easing,
      onLocationError: (err) => U.Alert.error(err.message),
    })
    this._controls.fullscreen = new Control.Fullscreen({
      title: {
        false: translate('View Fullscreen'),
        true: translate('Exit Fullscreen'),
      },
    })
    this._controls.search = new U.SearchControl()
    this._controls.embed = new Control.Embed(this.umap)
    this._controls.tilelayersChooser = new U.TileLayerChooser(this)
    if (this.options.user?.id) this._controls.star = new U.StarControl(this.umap)
    this._controls.editinosm = new Control.EditInOSM({
      position: 'topleft',
      widgetOptions: {
        helpText: translate(
          'Open this map extent in a map editor to provide more accurate data to OpenStreetMap'
        ),
      },
    })
    this._controls.measure = new L.MeasureControl().initHandler(this)
    this._controls.more = new U.MoreControls()
    this._controls.scale = L.control.scale()
    this._controls.permanentCredit = new U.PermanentCreditsControl(this)
    if (this.options.scrollWheelZoom) this.scrollWheelZoom.enable()
    else this.scrollWheelZoom.disable()
    this.umap.drop = new U.DropControl(this)
    this._controls.tilelayers = new U.TileLayerControl(this)
  },

  renderControls: function () {
    const hasSlideshow = Boolean(this.options.slideshow?.active)
    const barEnabled = this.options.captionBar || hasSlideshow
    document.body.classList.toggle('umap-caption-bar-enabled', barEnabled)
    document.body.classList.toggle('umap-slideshow-enabled', hasSlideshow)
    for (const control of Object.values(this._controls)) {
      this.removeControl(control)
    }
    if (this.options.noControl) return

    this._controls.attribution = new U.AttributionControl().addTo(this)
    if (this.options.miniMap) {
      this.whenReady(function () {
        if (this.selectedTilelayer) {
          this._controls.miniMap = new Control.MiniMap(this.selectedTilelayer, {
            aimingRectOptions: {
              color: this.umap.getOption('color'),
              fillColor: this.umap.getOption('fillColor'),
              stroke: this.umap.getOption('stroke'),
              fill: this.umap.getOption('fill'),
              weight: this.umap.getOption('weight'),
              opacity: this.umap.getOption('opacity'),
              fillOpacity: this.umap.getOption('fillOpacity'),
            },
          }).addTo(this)
          this._controls.miniMap._miniMap.invalidateSize()
        }
      })
    }
    for (const name of this.HIDDABLE_CONTROLS) {
      const status = this.umap.getOption(`${name}Control`)
      if (status === false) continue
      const control = this._controls[name]
      if (!control) continue
      control.addTo(this)
      if (status === undefined || status === null) {
        DomUtil.addClass(control._container, 'display-on-more')
      } else {
        DomUtil.removeClass(control._container, 'display-on-more')
      }
    }
    if (this.umap.getOption('permanentCredit'))
      this._controls.permanentCredit.addTo(this)
    if (this.umap.getOption('moreControl')) this._controls.more.addTo(this)
    if (this.umap.getOption('scaleControl')) this._controls.scale.addTo(this)
    this._controls.tilelayers.setLayers()
  },

  renderEditToolbar: function () {
    const className = 'umap-main-edit-toolbox'
    const container =
      document.querySelector(`.${className}`) ||
      DomUtil.create('div', `${className} with-transition dark`, this._controlContainer)
    container.innerHTML = ''
    const leftContainer = DomUtil.create('div', 'umap-left-edit-toolbox', container)
    const rightContainer = DomUtil.create('div', 'umap-right-edit-toolbox', container)
    const logo = DomUtil.create('div', 'logo', leftContainer)
    DomUtil.createLink('', logo, 'uMap', '/', null, translate('Go to the homepage'))
    const nameButton = DomUtil.createButton('map-name', leftContainer, '')
    DomEvent.on(nameButton, 'mouseover', () => {
      this.umap.tooltip.open({
        content: translate('Edit the title of the map'),
        anchor: nameButton,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    const shareStatusButton = DomUtil.createButton(
      'share-status',
      leftContainer,
      '',
      this.umap.permissions.edit,
      this.umap.permissions
    )
    DomEvent.on(shareStatusButton, 'mouseover', () => {
      this.umap.tooltip.open({
        content: translate('Update who can see and edit the map'),
        anchor: shareStatusButton,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    if (this.options.editMode === 'advanced') {
      DomEvent.on(nameButton, 'click', this.umap.editCaption, this.umap)
      DomEvent.on(
        shareStatusButton,
        'click',
        this.umap.permissions.edit,
        this.umap.permissions
      )
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
          label: translate('New map'),
          action: this.umap.urls.get('map_new'),
        },
        {
          label: translate('My maps'),
          action: this.umap.urls.get('user_dashboard'),
        },
        {
          label: translate('My teams'),
          action: this.umap.urls.get('user_teams'),
        },
      ]
      if (this.umap.urls.has('user_profile')) {
        actions.push({
          label: translate('My profile'),
          action: this.umap.urls.get('user_profile'),
        })
      }
      button.addEventListener('click', () => {
        menu.openBelow(button, actions)
      })
    }

    const connectedPeers = this.umap.sync.getNumberOfConnectedPeers()
    if (connectedPeers !== 0) {
      const connectedPeersCount = DomUtil.createButton(
        'leaflet-control-connected-peers',
        rightContainer,
        ''
      )
      DomEvent.on(connectedPeersCount, 'mouseover', () => {
        this.umap.tooltip.open({
          content: translate(
            '{connectedPeers} peer(s) currently connected to this map',
            {
              connectedPeers: connectedPeers,
            }
          ),
          anchor: connectedPeersCount,
          position: 'bottom',
          delay: 500,
          duration: 5000,
        })
      })

      const updateConnectedPeersCount = () => {
        connectedPeersCount.innerHTML = this.sync.getNumberOfConnectedPeers()
      }
      updateConnectedPeersCount()
    }

    this.umap.help.getStartedLink(rightContainer)
    const controlEditCancel = DomUtil.createButton(
      'leaflet-control-edit-cancel',
      rightContainer,
      DomUtil.add('span', '', null, translate('Cancel edits')),
      () => this.umap.askForReset()
    )
    DomEvent.on(controlEditCancel, 'mouseover', () => {
      this.umap.tooltip.open({
        content: this.umap.help.displayLabel('CANCEL'),
        anchor: controlEditCancel,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    const controlEditDisable = DomUtil.createButton(
      'leaflet-control-edit-disable',
      rightContainer,
      DomUtil.add('span', '', null, translate('View')),
      this.umap.disableEdit,
      this.umap
    )
    DomEvent.on(controlEditDisable, 'mouseover', () => {
      this.umap.tooltip.open({
        content: this.umap.help.displayLabel('PREVIEW'),
        anchor: controlEditDisable,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    const controlEditSave = DomUtil.createButton(
      'leaflet-control-edit-save button',
      rightContainer,
      DomUtil.add('span', '', null, translate('Save')),
      () => this.umap.saveAll()
    )
    DomEvent.on(controlEditSave, 'mouseover', () => {
      this.umap.tooltip.open({
        content: this.umap.help.displayLabel('SAVE'),
        anchor: controlEditSave,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
  },

  initCaptionBar: function () {
    const container = DomUtil.create('div', 'umap-caption-bar', this._controlContainer)
    const name = DomUtil.create('h3', 'map-name', container)
    DomEvent.disableClickPropagation(container)
    this.umap.addAuthorLink(container)
    if (this.umap.getOption('captionMenus')) {
      DomUtil.createButton(
        'umap-about-link flat',
        container,
        translate('Open caption'),
        this.umap.openCaption,
        this
      )
      DomUtil.createButton(
        'umap-open-browser-link flat',
        container,
        translate('Browse data'),
        () => this.openBrowser('data')
      )
      if (this.options.facetKey) {
        DomUtil.createButton(
          'umap-open-filter-link flat',
          container,
          translate('Filter data'),
          () => this.openBrowser('filters')
        )
      }
    }
    this.umap.onceDatalayersLoaded(function () {
      this.slideshow.renderToolbox(container)
    })
  },
}

const ManageTilelayerMixin = {
  initTileLayers: function () {
    this.tilelayers = []
    for (const props of this.options.tilelayers) {
      const layer = this.createTileLayer(props)
      this.tilelayers.push(layer)
      if (
        this.options.tilelayer &&
        this.options.tilelayer.url_template === props.url_template
      ) {
        // Keep control over the displayed attribution for non custom tilelayers
        this.options.tilelayer.attribution = props.attribution
      }
    }
    if (this.options.tilelayer?.url_template && this.options.tilelayer.attribution) {
      this.customTilelayer = this.createTileLayer(this.options.tilelayer)
      this.selectTileLayer(this.customTilelayer)
    } else {
      this.selectTileLayer(this.tilelayers[0])
    }
    if (this._controls) this._controls.tilelayers.setLayers()
  },

  createTileLayer: (tilelayer) => new L.TileLayer(tilelayer.url_template, tilelayer),

  selectTileLayer: function (tilelayer) {
    if (tilelayer === this.selectedTilelayer) {
      return
    }
    try {
      this.addLayer(tilelayer)
      this.fire('baselayerchange', { layer: tilelayer })
      if (this.selectedTilelayer) {
        this.removeLayer(this.selectedTilelayer)
      }
      this.selectedTilelayer = tilelayer
      if (
        !Number.isNaN(this.selectedTilelayer.options.minZoom) &&
        this.getZoom() < this.selectedTilelayer.options.minZoom
      ) {
        this.setZoom(this.selectedTilelayer.options.minZoom)
      }
      if (
        !Number.isNaN(this.selectedTilelayer.options.maxZoom) &&
        this.getZoom() > this.selectedTilelayer.options.maxZoom
      ) {
        this.setZoom(this.selectedTilelayer.options.maxZoom)
      }
    } catch (e) {
      console.error(e)
      this.removeLayer(tilelayer)
      Alert.error(`${translate('Error in the tilelayer URL')}: ${tilelayer._url}`)
      // Users can put tilelayer URLs by hand, and if they add wrong {variable},
      // Leaflet throw an error, and then the map is no more editable
    }
    this.setOverlay()
  },

  eachTileLayer: function (callback, context) {
    const urls = []
    const callOne = (layer) => {
      // Prevent adding a duplicate background,
      // while adding selected/custom on top of the list
      const url = layer.options.url_template
      if (urls.indexOf(url) !== -1) return
      callback.call(context, layer)
      urls.push(url)
    }
    if (this.selectedTilelayer) callOne(this.selectedTilelayer)
    if (this.customTilelayer) callOne(this.customTilelayer)
    this.tilelayers.forEach(callOne)
  },

  setOverlay: function () {
    if (!this.options.overlay || !this.options.overlay.url_template) return
    const overlay = this.createTileLayer(this.options.overlay)
    try {
      this.addLayer(overlay)
      if (this.overlay) this.removeLayer(this.overlay)
      this.overlay = overlay
    } catch (e) {
      this.removeLayer(overlay)
      console.error(e)
      Alert.error(`${translate('Error in the overlay URL')}: ${overlay._url}`)
    }
  },

  updateTileLayers: function () {
    const callback = (tilelayer) => {
      this.options.tilelayer = tilelayer.toJSON()
      this.umap.isDirty = true
    }
    if (this._controls.tilelayersChooser) {
      this._controls.tilelayersChooser.openSwitcher({ callback, edit: true })
    }
  },
}

const EditMixin = {
  startMarker: function () {
    return this.editTools.startMarker()
  },

  startPolyline: function () {
    return this.editTools.startPolyline()
  },

  startPolygon: function () {
    return this.editTools.startPolygon()
  },

  initEditTools: function () {
    this.editTools = new U.Editable(this.umap)
    this.renderEditToolbar()
  },
}

export const LeafletMap = BaseMap.extend({
  includes: [ControlsMixin, ManageTilelayerMixin, EditMixin],
  initialize: function (umap, element) {
    this.umap = umap
    const options = this.umap.properties

    BaseMap.prototype.initialize.call(this, element, options)

    // After calling parent initialize, as we are doing initCenter our-selves

    this.loader = new Control.Loading()
    this.loader.onAdd(this)

    if (!this.options.noControl) {
      DomEvent.on(document.body, 'dataloading', (e) => this.fire('dataloading', e))
      DomEvent.on(document.body, 'dataload', (e) => this.fire('dataload', e))
      this.on('click', this.closeInplaceToolbar)
    }

    this.on('baselayerchange', (e) => {
      if (this._controls.miniMap) this._controls.miniMap.onMainMapBaseLayerChange(e)
    })
  },

  attachToDom: function () {
    this.initControls()
    // Needs locate control and hash to exist
    this.initCenter()
    this.initTileLayers()
    // Needs tilelayer to exist for minimap
    this.renderControls()
    this.handleLimitBounds()
  },

  setOptions: function (options) {
    setOptions(this, options)
  },

  closeInplaceToolbar: function () {
    const toolbar = this._toolbars[L.Toolbar.Popup._toolbar_class_id]
    if (toolbar) toolbar.remove()
  },

  latLng: (a, b, c) => {
    // manage geojson case and call original method
    if (!(a instanceof L.LatLng) && a.coordinates) {
      // Guess it's a geojson
      a = [a.coordinates[1], a.coordinates[0]]
    }
    return latLng(a, b, c)
  },

  _setDefaultCenter: function () {
    this.options.center = this.latLng(this.options.center)
    this.setView(this.options.center, this.options.zoom)
  },

  initCenter: function () {
    this._setDefaultCenter()
    if (this.options.hash) this.addHash()
    if (this.options.hash && this._hash.parseHash(location.hash)) {
      // FIXME An invalid hash will cause the load to fail
      this._hash.update()
    } else if (this.options.defaultView === 'locate' && !this.options.noControl) {
      this._controls.locate.start()
    } else if (this.options.defaultView === 'data') {
      this.umap.onceDataLoaded(this.umap.fitDataBounds)
    } else if (this.options.defaultView === 'latest') {
      this.umap.onceDataLoaded(() => {
        if (!this.umap.hasData()) return
        const datalayer = this.umap.firstVisibleDatalayer()
        let feature
        if (datalayer) {
          const feature = datalayer.getFeatureByIndex(-1)
          if (feature) {
            feature.zoomTo({ callback: this.options.noControl ? null : feature.view })
            return
          }
        }
      })
    }
  },

  handleLimitBounds: function () {
    const south = Number.parseFloat(this.options.limitBounds.south)
    const west = Number.parseFloat(this.options.limitBounds.west)
    const north = Number.parseFloat(this.options.limitBounds.north)
    const east = Number.parseFloat(this.options.limitBounds.east)
    if (
      !Number.isNaN(south) &&
      !Number.isNaN(west) &&
      !Number.isNaN(north) &&
      !Number.isNaN(east)
    ) {
      const bounds = latLngBounds([
        [south, west],
        [north, east],
      ])
      this.options.minZoom = this.getBoundsZoom(bounds, false)
      try {
        this.setMaxBounds(bounds)
      } catch (e) {
        // Unusable bounds, like -2 -2 -2 -2?
        console.error('Error limiting bounds', e)
      }
    } else {
      this.options.minZoom = 0
      this.setMaxBounds()
    }
  },

  setMaxBounds: function (bounds) {
    // Hack. Remove me when fix is released:
    // https://github.com/Leaflet/Leaflet/pull/4494
    bounds = latLngBounds(bounds)

    if (!bounds.isValid()) {
      this.options.maxBounds = null
      return this.off('moveend', this._panInsideMaxBounds)
    }
    return BaseMap.prototype.setMaxBounds.call(this, bounds)
  },
})
