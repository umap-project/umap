import * as DOMUtils from '../domutils.js'
import { LineString, Point, Polygon } from '../data/features.js'
import { translate } from '../i18n.js'
import { WithTemplate } from '../utils.js'
import * as Utils from '../utils.js'
import ContextMenu from './contextmenu.js'

const TOP_BAR_TEMPLATE = `
<div class="umap-main-edit-toolbox with-transition dark">
    <div class="umap-left-edit-toolbox" data-ref="left">
        <div class="logo"><a class="" href="#" title="${translate('Go to the homepage')}" data-ref="home">uMap</a></div>
        <button class="map-name flat truncate" type="button" data-ref="name"></button>
        <button class="flat truncate" type="button" data-ref="share">
          <i class="icon icon-16 icon-draft show-on-draft"></i><span class="share-status"></span>
        </button>
        <button class="anonymous truncate soft-round" type="button" data-ref="shareAnonymous" hidden>
          <i class="icon icon-16 icon-anonymous"></i><span class="share-status"></span>
        </button>
        <button class="edit-undo flat" type="button" data-ref="undo" disabled>
            <i class="icon icon-16 icon-undo"></i>
        </button>
        <button class="edit-redo flat" type="button" data-ref="redo" disabled>
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
          <span class="username truncate" data-ref="username">${translate('Anonymous')}</span>
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
  constructor(app, parent) {
    super()
    this.app = app
    this._menu = new ContextMenu({ className: 'dark', fixed: true })
    this.loadTemplate(TOP_BAR_TEMPLATE)
    this.parent = parent
  }

  setup() {
    this.parent.appendChild(this.element)
    this.elements.home.href = this.app.urls.get('home')
    this.elements.name.addEventListener('mouseover', () => {
      this.app.tooltip.open({
        content: translate('Edit the title of the map'),
        anchor: this.elements.name,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    this.elements.share.addEventListener('mouseover', () => {
      this.app.tooltip.open({
        content: translate('Update who can see and edit the map'),
        anchor: this.elements.share,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    this.elements.shareAnonymous.addEventListener('mouseover', () => {
      this.app.tooltip.open({
        content: translate('Anonymous map: update who can see and edit it'),
        anchor: this.elements.shareAnonymous,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    if (this.app.properties.editMode === 'advanced') {
      this.elements.name.addEventListener('click', () => this.app.editCaption())
      this.elements.share.addEventListener('click', () => this.app.permissions.edit())
      this.elements.shareAnonymous.addEventListener('click', () =>
        this.app.permissions.edit()
      )
    }
    this.elements.user.addEventListener('click', () => {
      const actions = [
        {
          label: translate('New map'),
          action: this.app.urls.get('map_new'),
        },
      ]
      if (this.app.permissions.userIsAuth()) {
        actions.push(
          {
            label: translate('My maps'),
            action: this.app.urls.get('user_dashboard'),
          },
          {
            label: translate('My teams'),
            action: this.app.urls.get('user_teams'),
          }
        )
        if (this.app.urls.has('user_profile')) {
          actions.push({
            label: translate('My profile'),
            action: this.app.urls.get('user_profile'),
          })
        }
      } else {
        actions.push({
          label: translate('Login'),
          action: () => this.app.askForLogin(),
        })
      }
      this._menu.openBelow(this.elements.user, actions)
    })
    this.elements.peers.addEventListener('mouseover', () => {
      const connectedPeers = this.app.journal?.getPeers()
      if (!connectedPeers || !Object.keys(connectedPeers).length) return
      const ul = Utils.loadTemplate(
        `<ul>${Object.entries(connectedPeers)
          .sort((el) => el !== this.app.user?.name)
          .map(
            ([id, name]) =>
              Utils.sanitizeVars`<li>${name || translate('Anonymous')}</li>`
          )
          .join('')}</ul>`
      )
      this.app.tooltip.open({
        content: ul,
        anchor: this.elements.peers,
        position: 'bottom',
        delay: 500,
        duration: 5000,
        accent: true,
      })
    })

    this.elements.help.addEventListener('click', () => this.app.help.showGetStarted())
    this.elements.redo.addEventListener('click', () => this.app.redo())
    this.elements.undo.addEventListener('click', () => this.app.undo())
    this.elements.undo.addEventListener('mouseover', () => {
      this.app.tooltip.open({
        content: this.app.help.displayLabel('UNDO'),
        anchor: this.elements.undo,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    this.elements.redo.addEventListener('mouseover', () => {
      this.app.tooltip.open({
        content: this.app.help.displayLabel('REDO'),
        anchor: this.elements.redo,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    this.elements.view.addEventListener('click', () => this.app.disableEdit())
    this.elements.view.addEventListener('mouseover', () => {
      this.app.tooltip.open({
        content: this.app.help.displayLabel('PREVIEW'),
        anchor: this.elements.view,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    this.elements.save.addEventListener('click', () => this.app.saveAll())
    this.elements.save.addEventListener('mouseover', () => {
      this.app.tooltip.open({
        content: this.app.help.displayLabel('SAVE'),
        anchor: this.elements.save,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
  }

  redraw() {
    if (!this.app.editEnabled) return
    this.element.classList.toggle('draft', this.app.permissions.isDraft())
    const syncEnabled = this.app.getProperty('syncEnabled')
    this.elements.peers.hidden = !syncEnabled
    this.elements.view.disabled = this.app.journal._undoManager.isDirty()
    const isDraft = this.app.permissions.isDraft()
    const isTemplate = this.app.getProperty('is_template')
    this.elements.saveLabel.hidden = isDraft || isTemplate
    this.elements.saveDraftLabel.hidden = !isDraft || isTemplate
    this.elements.saveTemplateLabel.hidden = !isTemplate
    this.app.journal._undoManager.toggleState()
    this.elements.share.hidden = this.app.permissions.isAnonymousMap()
    this.elements.shareAnonymous.hidden = !this.app.permissions.isAnonymousMap()
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
  constructor(app, slideshow, parent) {
    super()
    this.app = app
    this._slideshow = slideshow
    this.loadTemplate(BOTTOM_BAR_TEMPLATE)
    this.parent = parent
    this.ready = false
  }

  setup() {
    DOMUtils.disableClickPropagation(this.element)
    this.app.addAuthorLink(this.elements.author)
    this.elements.caption.addEventListener('click', () => this.app.openCaption())
    this.elements.browse.addEventListener('click', () => this.app.openBrowser('data'))
    this.elements.filter.addEventListener('click', () =>
      this.app.openBrowser('filters')
    )
    this._slideshow.renderToolbox(this.element)
    this.elements.layers.addEventListener('change', () => {
      const select = this.elements.layers
      const selected = select.options[select.selectedIndex].value
      for (const layer of this.app.layers.tree) {
        if (layer.inCaption !== false) {
          // No layer selected, back to default visibility.
          if (!selected) {
            layer.autoVisibility = true
            if (layer.showAtZoom() && !layer.isVisible()) {
              layer.show()
            }
          } else {
            // Only deal with group or selected layer
            if (layer.id !== selected && layer.parent) continue
            const force = layer.id === selected
            layer.toggle(force)
          }
        }
      }
    })
    this.ready = true
  }

  redraw() {
    if (!this.ready) return
    const hasSlideshow = this._slideshow.isEnabled()
    const barEnabled = this.app.properties.captionBar || hasSlideshow
    document.body.classList.toggle('umap-caption-bar-enabled', barEnabled)
    document.body.classList.toggle('umap-slideshow-enabled', hasSlideshow)
    if (!barEnabled) return
    const showMenus = this.app.getProperty('captionMenus')
    this.elements.caption.hidden = !showMenus
    this.elements.browse.hidden = !showMenus
    this.elements.filter.hidden = !showMenus || !this.app.hasFilters()
    this.buildDataLayerSwitcher()
    this.parent.appendChild(this.element)
  }

  buildDataLayerSwitcher() {
    this.elements.layers.innerHTML = ''
    const layers = this.app.layers.tree.filter((d) => d.inCaption)
    if (layers.length < 2) {
      this.elements.layers.hidden = true
    } else {
      this.elements.layers.appendChild(
        Utils.loadTemplate(`<option value="">${translate('All layers')}</option>`)
      )
      this.elements.layers.hidden = !this.app.getProperty('layerSwitcher')
      const visible = []
      // The select should reflect the map state:
      // - if only on layer is visible, this layer should be selected
      // - if more than one layer are visible and they do not share the same parent,
      //   "All layers" should be selected
      // - if all descendants of a layer are visible and no other layer is visible,
      //  this parent should be selected.
      const collectVisible = (layer) => {
        if (layer.isFullVisible()) {
          visible.push(layer)
        } else {
          for (const child of layer.layers.root) {
            collectVisible(child)
          }
        }
      }
      for (const rootLayer of layers.copy().root()) {
        collectVisible(rootLayer)
      }
      for (const layer of layers) {
        const selected = visible.length === 1 && layer === visible[0] ? 'selected' : ''
        this.elements.layers.appendChild(
          Utils.loadTemplate(
            Utils.sanitizeVars`<option value="${layer.id}" ${selected}>${layer.getName(true)}</option>`
          )
        )
      }
    }
  }
}

const EDIT_BAR_TEMPLATE = `
  <div class="umap-edit-bar dark with-transition">
    <ul>
      <li data-ref="marker"><button class="drawing-tool" type="button" data-getstarted><i class="icon icon-24 icon-marker"></i></button></li>
      <li data-ref="linestring"><button class="drawing-tool" type="button" data-getstarted><i class="icon icon-24 icon-polyline"></i></button></li>
      <li data-ref="multiline" hidden>
        <button class="drawing-tool" type="button" title="${translate('Add a line to the current multi')}"><i class="icon icon-24 icon-multiline"></i></button>
      </li>
      <li data-ref="polygon"><button class="drawing-tool" type="button" data-getstarted><i class="icon icon-24 icon-polygon"></i></button></li>
      <li data-ref="multipolygon" hidden>
        <button class="drawing-tool" type="button" title="${translate('Add a polygon to the current multi')}"><i class="icon icon-24 icon-multipolygon"></i></button>
      </li>
      <li data-ref="route" hidden><button class="drawing-tool" type="button" data-getstarted title="${translate('Draw along routes')}"><i class="icon icon-24 icon-route"></i></button></li>
    </ul>
    <ul>
      <li data-ref="caption" hidden><button data-getstarted type="button" title="${translate('Edit map name and caption')}"><i class="icon icon-24 icon-info"></i></button></li>
      <li data-ref="import" hidden><button type="button"><i class="icon icon-24 icon-upload"></i></button></li>
      <li data-ref="templates" hidden><button type="button" title="${translate('Load template')}" data-getstarted><i class="icon icon-24 icon-template"></i></button></li>
      <li data-ref="layers" hidden><button type="button" title="${translate('Manage layers')}"><i class="icon icon-24 icon-layers"></i></button></li>
      <li data-ref="tilelayers" hidden><button type="button" title="${translate('Change tilelayers')}"><i class="icon icon-24 icon-tilelayer"></i></button></li>
      <li data-ref="center" hidden><button type="button"><i class="icon icon-24 icon-center"></i></button></li>
      <li data-ref="permissions" hidden><button type="button" title="${translate('Update permissions and editors')}"><i class="icon icon-24 icon-key"></i></button></li>
      <li data-ref="settings" hidden><button data-getstarted type="button" title="${translate('Map advanced properties')}"><i class="icon icon-24 icon-settings"></i></button></li>
    </ul>
  </div>
`

export class EditBar extends WithTemplate {
  constructor(app, parent) {
    super()
    this.app = app
    this.loadTemplate(EDIT_BAR_TEMPLATE)
    this.parent = parent
  }

  setup() {
    this.parent.appendChild(this.element)
    DOMUtils.disableClickPropagation(this.element)
    this.addDrawListener('marker')
    this.addDrawListener('linestring')
    this.addDrawListener('multiline')
    this.addDrawListener('polygon')
    this.addDrawListener('multipolygon')
    this.addDrawListener('route')
    this.addClickListener('caption', () => this.app.editCaption())
    this.addClickListener('import', () => this.app.openImporter())
    this.addClickListener('templates', () => {
      import('../templates.js').then(({ default: TemplateImporter }) => {
        const templateImporter = new TemplateImporter(this.app)
        templateImporter.open()
      })
    })
    this.addClickListener('layers', () => this.app.editDatalayers())
    this.addClickListener('tilelayers', () =>
      this.app.controlManager.controls.tilelayers.openSwitcher({ edit: true })
    )
    this.addClickListener('center', () => this.app.editCenter())
    this.addClickListener('permissions', () => this.app.permissions.edit())
    this.addClickListener('settings', () => this.app.edit())
    this.addTitle('import', 'IMPORT_PANEL')
    this.addTitle('marker', 'DRAW_MARKER')
    this.addTitle('linestring', 'DRAW_LINE')
    this.addTitle('polygon', 'DRAW_POLYGON')
    this.app.on('seteditedfeature', () => this.redraw())
  }

  redraw() {
    const editedFeature = this.app.editedFeature
    this.elements.multiline.hidden = !(editedFeature instanceof LineString)
    this.elements.multipolygon.hidden = !(editedFeature instanceof Polygon)
    this.elements.caption.hidden = this.app.properties.editMode !== 'advanced'
    this.elements.import.hidden = this.app.properties.editMode !== 'advanced'
    this.elements.templates.hidden =
      this.app.properties.editMode !== 'advanced' && !this.app.layers.count()
    this.elements.layers.hidden = this.app.properties.editMode !== 'advanced'
    this.elements.tilelayers.hidden = this.app.properties.editMode !== 'advanced'
    this.elements.center.hidden = this.app.properties.editMode !== 'advanced'
    this.elements.permissions.hidden = this.app.properties.editMode !== 'advanced'
    this.elements.settings.hidden = this.app.properties.editMode !== 'advanced'
    this.elements.route.hidden = !this.app.properties.ORSAPIKey
  }

  addTitle(ref, label) {
    this.elements[ref].querySelector('button').title = this.app.help.displayLabel(
      label,
      false
    )
  }

  addDrawListener(shape) {
    const action = (event) => {
      event.target.closest('button').classList.add('on')
      this.app.fire(`draw:${shape}`)
    }
    this.addClickListener(shape, action)
  }

  addClickListener(ref, action) {
    // Put the click on the button, not on the li, but keep the data-ref on the li
    // so to hide/show it when needed.
    this.elements[ref].querySelector('button').addEventListener('click', action)
  }
}
