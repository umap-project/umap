import { DomEvent } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { LineString, Point, Polygon } from '../data/features.js'
import { translate } from '../i18n.js'
import { WithTemplate } from '../utils.js'
import * as Utils from '../utils.js'
import ContextMenu from './contextmenu.js'
import TemplateImporter from '../templates.js'

const TOP_BAR_TEMPLATE = `
<div class="umap-main-edit-toolbox with-transition dark">
    <div class="umap-left-edit-toolbox" data-ref="left">
        <div class="logo"><a class="" href="/" title="${translate('Go to the homepage')}">uMap</a></div>
        <button class="map-name flat truncate" type="button" data-ref="name"></button>
        <button class="share-status flat truncate" type="button" data-ref="share"></button>
        <button class="edit-undo round flat" type="button" data-ref="undo" disabled>
            <i class="icon icon-16 icon-undo"></i>
        </button>
        <button class="edit-redo round flat" type="button" data-ref="redo" disabled>
            <i class="icon icon-16 icon-redo"></i>
        </button>
    </div>
    <div class="umap-right-edit-toolbox" data-ref="right">
        <button class="connected-peers round" type="button" data-ref="peers">
          <i class="icon icon-16 icon-peers icon-black"></i>
          <span></span>
        </button>
        <button class="umap-user flat" type="button" data-ref="user">
          <i class="icon icon-16 icon-profile"></i>
          <span class="username truncate" data-ref="username"></span>
        </button>
        <button class="umap-help-link flat" type="button" title="${translate('Help')}" data-ref="help">${translate('Help')}</button>
        <button class="edit-disable round disabled-on-dirty" type="button" data-ref="view">
            <i class="icon icon-16 icon-eye"></i>
            <span>${translate('View')}</span>
        </button>
        <button class="edit-save button round enabled-on-dirty" type="button" data-ref="save">
            <i class="icon icon-16 icon-save"></i>
            <i class="icon icon-16 icon-save-disabled"></i>
            <span hidden data-ref="saveLabel">${translate('Save')}</span>
            <span hidden data-ref="saveDraftLabel">${translate('Save draft')}</span>
            <span hidden data-ref="saveTemplateLabel">${translate('Save template')}</span>
        </button>
    </div>
</div>`

export class TopBar extends WithTemplate {
  constructor(umap, parent) {
    super()
    this._umap = umap
    this._menu = new ContextMenu({ className: 'dark', fixed: true })
    this.loadTemplate(TOP_BAR_TEMPLATE)
    this.parent = parent
  }

  setup() {
    this.parent.appendChild(this.element)
    this.elements.name.addEventListener('mouseover', () => {
      this._umap.tooltip.open({
        content: translate('Edit the title of the map'),
        anchor: this.elements.name,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    this.elements.share.addEventListener('mouseover', () => {
      this._umap.tooltip.open({
        content: translate('Update who can see and edit the map'),
        anchor: this.elements.share,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    if (this._umap.properties.editMode === 'advanced') {
      this.elements.name.addEventListener('click', () => this._umap.editCaption())
      this.elements.share.addEventListener('click', () => this._umap.permissions.edit())
    }
    this.elements.user.addEventListener('click', () => {
      if (this._umap.properties.user?.id) {
        const actions = [
          {
            label: translate('New map'),
            action: this._umap.urls.get('map_new'),
          },
          {
            label: translate('My maps'),
            action: this._umap.urls.get('user_dashboard'),
          },
          {
            label: translate('My teams'),
            action: this._umap.urls.get('user_teams'),
          },
        ]
        if (this._umap.urls.has('user_profile')) {
          actions.push({
            label: translate('My profile'),
            action: this._umap.urls.get('user_profile'),
          })
        }
        this._menu.openBelow(this.elements.user, actions)
      }
    })

    this.elements.peers.addEventListener('mouseover', () => {
      const connectedPeers = this._umap.sync.getPeers()
      if (!Object.keys(connectedPeers).length) return
      const ul = Utils.loadTemplate(
        `<ul>${Object.entries(connectedPeers)
          .sort((el) => el !== this._umap.user?.name)
          .map(([id, name]) => `<li>${name || translate('Anonymous')}</li>`)
          .join('')}</ul>`
      )
      this._umap.tooltip.open({
        content: ul,
        anchor: this.elements.peers,
        position: 'bottom',
        delay: 500,
        duration: 5000,
        accent: true,
      })
    })

    this.elements.help.addEventListener('click', () => this._umap.help.showGetStarted())
    this.elements.redo.addEventListener('click', () => this._umap.redo())
    this.elements.undo.addEventListener('click', () => this._umap.undo())
    this.elements.undo.addEventListener('mouseover', () => {
      this._umap.tooltip.open({
        content: this._umap.help.displayLabel('UNDO'),
        anchor: this.elements.undo,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    this.elements.redo.addEventListener('mouseover', () => {
      this._umap.tooltip.open({
        content: this._umap.help.displayLabel('REDO'),
        anchor: this.elements.redo,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    this.elements.view.addEventListener('click', () => this._umap.disableEdit())
    this.elements.view.addEventListener('mouseover', () => {
      this._umap.tooltip.open({
        content: this._umap.help.displayLabel('PREVIEW'),
        anchor: this.elements.view,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    this.elements.save.addEventListener('click', () => this._umap.saveAll())
    this.elements.save.addEventListener('mouseover', () => {
      this._umap.tooltip.open({
        content: this._umap.help.displayLabel('SAVE'),
        anchor: this.elements.save,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    this.redraw()
  }

  redraw() {
    const syncEnabled = this._umap.getProperty('syncEnabled')
    this.elements.peers.hidden = !syncEnabled
    this.elements.view.disabled = this._umap.sync._undoManager.isDirty()
    const isDraft = this._umap.permissions.isDraft()
    const isTemplate = this._umap.getProperty('is_template')
    this.elements.saveLabel.hidden = isDraft || isTemplate
    this.elements.saveDraftLabel.hidden = !isDraft || isTemplate
    this.elements.saveTemplateLabel.hidden = !isTemplate
    this._umap.sync._undoManager.toggleState()
  }
}

const BOTTOM_BAR_TEMPLATE = `
  <div class="umap-caption-bar">
    <h3 class="map-name"></h3>
    <span data-ref="author"></span>
    <button class="umap-about-link flat" type="button" title="${translate('Open caption')}" data-ref="caption">${translate('Open caption')}</button>
    <button class="umap-open-browser-link flat" type="button" title="${translate('Browse data')}" data-ref="browse">${translate('Browse data')}</button>
    <button class="umap-open-browser-link flat" type="button" title="${translate('Filter data')}" data-ref="filter">${translate('Filter data')}</button>
    <select data-ref="layers"></select>
  </div>
`

export class BottomBar extends WithTemplate {
  constructor(umap, slideshow, parent) {
    super()
    this._umap = umap
    this._slideshow = slideshow
    this.loadTemplate(BOTTOM_BAR_TEMPLATE)
    this.parent = parent
  }

  setup() {
    this.parent.appendChild(this.element)
    DomEvent.disableClickPropagation(this.element)
    this._umap.addAuthorLink(this.elements.author)
    this.elements.caption.addEventListener('click', () => this._umap.openCaption())
    this.elements.browse.addEventListener('click', () => this._umap.openBrowser('data'))
    this.elements.filter.addEventListener('click', () =>
      this._umap.openBrowser('filters')
    )
    this._slideshow.renderToolbox(this.element)
    this.elements.layers.addEventListener('change', () => {
      const select = this.elements.layers
      const selected = select.options[select.selectedIndex].value
      if (!selected) return
      this._umap.datalayers.active().map((datalayer) => {
        if (datalayer.properties.inCaption !== false) {
          datalayer.toggle(datalayer.id === selected)
        }
      })
    })
    this.redraw()
  }

  redraw() {
    const hasSlideshow = this._slideshow.isEnabled()
    const barEnabled = this._umap.properties.captionBar || hasSlideshow
    document.body.classList.toggle('umap-caption-bar-enabled', barEnabled)
    document.body.classList.toggle('umap-slideshow-enabled', hasSlideshow)
    const showMenus = this._umap.getProperty('captionMenus')
    this.elements.caption.hidden = !showMenus
    this.elements.browse.hidden = !showMenus
    this.elements.filter.hidden = !showMenus || !this._umap.properties.facetKey
    this.buildDataLayerSwitcher()
  }

  buildDataLayerSwitcher() {
    this.elements.layers.innerHTML = ''
    const datalayers = this._umap.datalayers.filter((d) => d.properties.inCaption)
    if (datalayers.length < 2) {
      this.elements.layers.hidden = true
    } else {
      this.elements.layers.appendChild(Utils.loadTemplate(`<option value=""></option>`))
      this.elements.layers.hidden = !this._umap.getProperty('layerSwitcher')
      const visible = datalayers.filter((datalayer) => datalayer.isVisible())
      for (const datalayer of datalayers) {
        const selected = visible.length === 1 && datalayer.isVisible() ? 'selected' : ''
        this.elements.layers.appendChild(
          Utils.loadTemplate(
            `<option value="${datalayer.id}" ${selected}>${datalayer.getName()}</option>`
          )
        )
      }
    }
  }
}

const EDIT_BAR_TEMPLATE = `
  <ul class="umap-edit-bar dark with-transition">
    <li data-ref="marker"><button type="button" data-getstarted><i class="icon icon-24 icon-marker"></i></button></li>
    <li data-ref="polyline"><button type="button" data-getstarted><i class="icon icon-24 icon-polyline"></i></button></li>
    <li data-ref="multiline" hidden>
      <button type="button" title="${translate('Add a line to the current multi')}"><i class="icon icon-24 icon-multiline"></i></button>
    </li>
    <li data-ref="polygon"><button type="button" data-getstarted><i class="icon icon-24 icon-polygon"></i></button></li>
    <li data-ref="multipolygon" hidden>
      <button type="button" title="${translate('Add a polygon to the current multi')}"><i class="icon icon-24 icon-multipolygon"></i></button>
    </li>
    <li data-ref="route" hidden><button type="button" data-getstarted title="${translate('Draw along routes')}"><i class="icon icon-24 icon-route"></i></button></li>
    <hr>
    <li data-ref="caption" hidden><button data-getstarted type="button" title="${translate('Edit map name and caption')}"><i class="icon icon-24 icon-caption"></i></button></li>
    <li data-ref="import" hidden><button type="button"><i class="icon icon-24 icon-upload"></i></button></li>
    <li data-ref="templates" hidden><button type="button" title="${translate('Load template')}" data-getstarted><i class="icon icon-24 icon-template"></i></button></li>
    <li data-ref="layers" hidden><button type="button" title="${translate('Manage layers')}"><i class="icon icon-24 icon-layers"></i></button></li>
    <li data-ref="tilelayers" hidden><button type="button" title="${translate('Change tilelayers')}"><i class="icon icon-24 icon-tilelayer"></i></button></li>
    <li data-ref="center" hidden><button type="button"><i class="icon icon-24 icon-center"></i></button></li>
    <li data-ref="permissions" hidden><button type="button" title="${translate('Update permissions and editors')}"><i class="icon icon-24 icon-key"></i></button></li>
    <li data-ref="settings" hidden><button data-getstarted type="button" title="${translate('Map advanced properties')}"><i class="icon icon-24 icon-settings"></i></button></li>
  </ul>
`

export class EditBar extends WithTemplate {
  constructor(umap, leafletMap, parent) {
    super()
    this.templateIimporter = new TemplateImporter(umap)
    this._umap = umap
    this._leafletMap = leafletMap
    this.loadTemplate(EDIT_BAR_TEMPLATE)
    this.parent = parent
  }

  setup() {
    this.parent.appendChild(this.element)
    DomEvent.disableClickPropagation(this.element)
    this._onClick('marker', () => this._leafletMap.editTools.startMarker())
    this._onClick('polyline', () => this._leafletMap.editTools.startPolyline())
    this._onClick('multiline', () => this._umap.editedFeature.ui.editor.newShape())
    this._onClick('polygon', () => this._leafletMap.editTools.startPolygon())
    this._onClick('multipolygon', () => this._umap.editedFeature.ui.editor.newShape())
    this._onClick('route', () => this._leafletMap.editTools.startRoute())
    this._onClick('caption', () => this._umap.editCaption())
    this._onClick('import', () => this._umap.importer.open())
    this._onClick('templates', () => this.templateIimporter.open())
    this._onClick('layers', () => this._umap.editDatalayers())
    this._onClick('tilelayers', () => this._leafletMap.editTileLayers())
    this._onClick('center', () => this._umap.editCenter())
    this._onClick('permissions', () => this._umap.permissions.edit())
    this._onClick('settings', () => this._umap.edit())
    this._addTitle('import', 'IMPORT_PANEL')
    this._addTitle('marker', 'DRAW_MARKER')
    this._addTitle('polyline', 'DRAW_LINE')
    this._addTitle('polygon', 'DRAW_POLYGON')
    this._leafletMap.on('seteditedfeature', () => this.redraw())
  }

  redraw() {
    const editedFeature = this._umap.editedFeature
    this.elements.multiline.hidden = !(editedFeature instanceof LineString)
    this.elements.multipolygon.hidden = !(editedFeature instanceof Polygon)
    this.elements.caption.hidden = this._umap.properties.editMode !== 'advanced'
    this.elements.import.hidden = this._umap.properties.editMode !== 'advanced'
    this.elements.templates.hidden =
      this._umap.properties.editMode !== 'advanced' && !this._umap.datalayers.count()
    this.elements.layers.hidden = this._umap.properties.editMode !== 'advanced'
    this.elements.tilelayers.hidden = this._umap.properties.editMode !== 'advanced'
    this.elements.center.hidden = this._umap.properties.editMode !== 'advanced'
    this.elements.permissions.hidden = this._umap.properties.editMode !== 'advanced'
    this.elements.settings.hidden = this._umap.properties.editMode !== 'advanced'
    this.elements.route.hidden = !this._umap.properties.ORSAPIKey
  }

  _addTitle(ref, label) {
    this.elements[ref].querySelector('button').title = this._umap.help.displayLabel(
      label,
      false
    )
  }

  _onClick(ref, action) {
    // Put the click on the button, not on the li, but keep the data-ref on the li
    // so to hide/show it when needed.
    this.elements[ref].querySelector('button').addEventListener('click', action)
  }
}
