import * as DOMUtils from '../domutils.js'
import { LineString, Point, Polygon } from '../data/features.js'
import { translate } from '../i18n.js'
import { WithTemplate } from '../utils.js'
import * as Utils from '../utils.js'
import ContextMenu from './contextmenu.js'
import TemplateImporter from '../templates.js'

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
  constructor(umap, parent) {
    super()
    this._umap = umap
    this._menu = new ContextMenu({ className: 'dark', fixed: true })
    this.loadTemplate(TOP_BAR_TEMPLATE)
    this.parent = parent
  }

  setup() {
    this.parent.appendChild(this.element)
    this.elements.home.href = this._umap.urls.get('home')
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
    this.elements.shareAnonymous.addEventListener('mouseover', () => {
      this._umap.tooltip.open({
        content: translate('Anonymous map: update who can see and edit it'),
        anchor: this.elements.shareAnonymous,
        position: 'bottom',
        delay: 500,
        duration: 5000,
      })
    })
    if (this._umap.properties.editMode === 'advanced') {
      this.elements.name.addEventListener('click', () => this._umap.editCaption())
      this.elements.share.addEventListener('click', () => this._umap.permissions.edit())
      this.elements.shareAnonymous.addEventListener('click', () =>
        this._umap.permissions.edit()
      )
    }
    this.elements.user.addEventListener('click', () => {
      const actions = [
        {
          label: translate('New map'),
          action: this._umap.urls.get('map_new'),
        },
      ]
      if (this._umap.permissions.userIsAuth()) {
        actions.push(
          {
            label: translate('My maps'),
            action: this._umap.urls.get('user_dashboard'),
          },
          {
            label: translate('My teams'),
            action: this._umap.urls.get('user_teams'),
          }
        )
        if (this._umap.urls.has('user_profile')) {
          actions.push({
            label: translate('My profile'),
            action: this._umap.urls.get('user_profile'),
          })
        }
      } else {
        actions.push({
          label: translate('Login'),
          action: () => this._umap.askForLogin(),
        })
      }
      this._menu.openBelow(this.elements.user, actions)
    })
    this.elements.peers.addEventListener('mouseover', () => {
      const connectedPeers = this._umap.journal.getPeers()
      if (!Object.keys(connectedPeers).length) return
      const ul = Utils.loadTemplate(
        `<ul>${Object.entries(connectedPeers)
          .sort((el) => el !== this._umap.user?.name)
          .map(
            ([id, name]) =>
              Utils.sanitizeVars`<li>${name || translate('Anonymous')}</li>`
          )
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
  }

  redraw() {
    this.element.classList.toggle('draft', this._umap.permissions.isDraft())
    const syncEnabled = this._umap.getProperty('syncEnabled')
    this.elements.peers.hidden = !syncEnabled
    this.elements.view.disabled = this._umap.journal._undoManager.isDirty()
    const isDraft = this._umap.permissions.isDraft()
    const isTemplate = this._umap.getProperty('is_template')
    this.elements.saveLabel.hidden = isDraft || isTemplate
    this.elements.saveDraftLabel.hidden = !isDraft || isTemplate
    this.elements.saveTemplateLabel.hidden = !isTemplate
    this._umap.journal._undoManager.toggleState()
    this.elements.share.hidden = this._umap.permissions.isAnonymousMap()
    this.elements.shareAnonymous.hidden = !this._umap.permissions.isAnonymousMap()
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
    this.ready = false
  }

  setup() {
    DOMUtils.disableClickPropagation(this.element)
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
      for (const layer of this._umap.layers.tree) {
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
    const barEnabled = this._umap.properties.captionBar || hasSlideshow
    document.body.classList.toggle('umap-caption-bar-enabled', barEnabled)
    document.body.classList.toggle('umap-slideshow-enabled', hasSlideshow)
    if (!barEnabled) return
    const showMenus = this._umap.getProperty('captionMenus')
    this.elements.caption.hidden = !showMenus
    this.elements.browse.hidden = !showMenus
    this.elements.filter.hidden = !showMenus || !this._umap.hasFilters()
    this.buildDataLayerSwitcher()
    this.parent.appendChild(this.element)
  }

  buildDataLayerSwitcher() {
    this.elements.layers.innerHTML = ''
    const layers = this._umap.layers.tree.filter((d) => d.inCaption)
    if (layers.length < 2) {
      this.elements.layers.hidden = true
    } else {
      this.elements.layers.appendChild(
        Utils.loadTemplate(`<option value="">${translate('All layers')}</option>`)
      )
      this.elements.layers.hidden = !this._umap.getProperty('layerSwitcher')
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

class ShapeDrawer {
  constructor(umap, element) {
    this._umap = umap
    this._element = element
    this._button = element.querySelector('button')
    this._panel = null
    this._button.addEventListener('click', (e) => {
      e.stopPropagation()
      this._panel ? this._close() : this._open()
    })
    document.addEventListener('click', (e) => {
      if (this._panel && !this._element.contains(e.target)) this._close()
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._panel) this._close()
    })
  }

  _open() {
    this._button.classList.add('on')
    const panel = document.createElement('div')
    panel.className = 'shape-drawer-panel dark'
    panel.innerHTML = `
      <ul class="shape-mode-bar">
        <li>
          <button type="button" data-mode="rect-drag" title="${translate('Draw rectangle by dragging')}">
            <i class="icon icon-24 icon-rectanglepolygonat"></i>
          </button>
        </li>
        <li>
          <button type="button" data-mode="rect-dims" title="${translate('Rectangle with dimensions')}">
            <i class="icon icon-24 icon-resize"></i>
          </button>
        </li>
        <li>
          <button type="button" data-mode="circle-drag" title="${translate('Draw circle by dragging')}">
            <i class="icon icon-24 icon-polygon"></i>
          </button>
        </li>
        <li>
          <button type="button" data-mode="circle-radius" title="${translate('Circle with radius')}">
            <i class="icon icon-24 icon-polygon-plus"></i>
          </button>
        </li>
      </ul>
      <div class="shape-dims-form" hidden></div>
    `
    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mode]')
      if (!btn) return
      e.stopPropagation()
      this._handleMode(btn.dataset.mode, panel)
    })
    this._element.appendChild(panel)
    this._panel = panel
  }

  _close() {
    this._button.classList.remove('on')
    this._panel?.remove()
    this._panel = null
  }

  _handleMode(mode, panel) {
    if (mode === 'rect-drag') {
      this._close()
      this._umap.fire('draw:rect-drag')
    } else if (mode === 'circle-drag') {
      this._close()
      this._umap.fire('draw:circle-drag')
    } else if (mode === 'rect-dims') {
      this._showForm(panel, [
        { name: 'width', label: translate('Width (m)'), value: 100 },
        { name: 'height', label: translate('Height (m)'), value: 100 },
      ], (vals) => this._umap.fire('draw:rect-at', { width: vals.width, height: vals.height }))
    } else if (mode === 'circle-radius') {
      this._showForm(panel, [
        { name: 'radius', label: translate('Radius (m)'), value: 50 },
      ], (vals) => this._umap.fire('draw:circle-at', { radius: vals.radius }))
    }
  }

  _showForm(panel, fields, onSubmit) {
    panel.querySelector('.shape-mode-bar').hidden = true
    const form = panel.querySelector('.shape-dims-form')
    form.hidden = false
    form.innerHTML = `
      ${fields.map((f) => `
        <label class="shape-field">
          <span>${f.label}</span>
          <input type="number" name="${f.name}" value="${f.value}" min="0.1" step="any">
        </label>`).join('')}
      <button type="button" class="button shape-place-btn">
        ${translate('Click map to place')} →
      </button>
    `
    form.querySelector('.shape-place-btn').addEventListener('click', (e) => {
      e.stopPropagation()
      const vals = {}
      let valid = true
      for (const f of fields) {
        const v = parseFloat(form.querySelector(`[name=${f.name}]`).value)
        if (isNaN(v) || v <= 0) { valid = false; break }
        vals[f.name] = v
      }
      if (!valid) return
      this._close()
      onSubmit(vals)
    })
  }
}

const EDIT_BAR_TEMPLATE = `
  <div class="umap-edit-bar dark with-transition">
    <ul>
      <li data-ref="marker"><button class="drawing-tool" type="button" data-getstarted><i class="icon icon-24 icon-marker"></i></button></li>
      <li data-ref="polyline"><button class="drawing-tool" type="button" data-getstarted><i class="icon icon-24 icon-polyline"></i></button></li>
      <li data-ref="multiline" hidden>
        <button class="drawing-tool" type="button" title="${translate('Add a line to the current multi')}"><i class="icon icon-24 icon-multiline"></i></button>
      </li>
      <li data-ref="polygon"><button class="drawing-tool" type="button" data-getstarted><i class="icon icon-24 icon-polygon"></i></button></li>
      <li data-ref="multipolygon" hidden>
        <button class="drawing-tool" type="button" title="${translate('Add a polygon to the current multi')}"><i class="icon icon-24 icon-multipolygon"></i></button>
      </li>
      <li data-ref="shapes" class="shape-drawer"><button class="drawing-tool" type="button" title="${translate('Draw shapes')}"><i class="icon icon-24 icon-rectanglepolygonat"></i></button></li>
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
  constructor(umap, parent) {
    super()
    this.templateIimporter = new TemplateImporter(umap)
    this._umap = umap
    this.loadTemplate(EDIT_BAR_TEMPLATE)
    this.parent = parent
  }

  setup() {
    this.parent.appendChild(this.element)
    DOMUtils.disableClickPropagation(this.element)
    this.addDrawListener('marker')
    this.addDrawListener('polyline')
    this.addDrawListener('multiline')
    this.addDrawListener('polygon')
    this.addDrawListener('multipolygon')
    new ShapeDrawer(this._umap, this.elements.shapes)
    this.addDrawListener('route')
    this.addClickListener('caption', () => this._umap.editCaption())
    this.addClickListener('import', () => this._umap.openImporter())
    this.addClickListener('templates', () => this.templateIimporter.open())
    this.addClickListener('layers', () => this._umap.editDatalayers())
    this.addClickListener('tilelayers', () =>
      this._umap.controlManager.controls.tilelayers.openSwitcher({ edit: true })
    )
    this.addClickListener('center', () => this._umap.editCenter())
    this.addClickListener('permissions', () => this._umap.permissions.edit())
    this.addClickListener('settings', () => this._umap.edit())
    this.addTitle('import', 'IMPORT_PANEL')
    this.addTitle('marker', 'DRAW_MARKER')
    this.addTitle('polyline', 'DRAW_LINE')
    this.addTitle('polygon', 'DRAW_POLYGON')
    this._umap.on('seteditedfeature', () => this.redraw())
  }

  redraw() {
    const editedFeature = this._umap.editedFeature
    this.elements.multiline.hidden = !(editedFeature instanceof LineString)
    this.elements.multipolygon.hidden = !(editedFeature instanceof Polygon)
    this.elements.caption.hidden = this._umap.properties.editMode !== 'advanced'
    this.elements.import.hidden = this._umap.properties.editMode !== 'advanced'
    this.elements.templates.hidden =
      this._umap.properties.editMode !== 'advanced' && !this._umap.layers.count()
    this.elements.layers.hidden = this._umap.properties.editMode !== 'advanced'
    this.elements.tilelayers.hidden = this._umap.properties.editMode !== 'advanced'
    this.elements.center.hidden = this._umap.properties.editMode !== 'advanced'
    this.elements.permissions.hidden = this._umap.properties.editMode !== 'advanced'
    this.elements.settings.hidden = this._umap.properties.editMode !== 'advanced'
    this.elements.route.hidden = !this._umap.properties.ORSAPIKey
  }

  addTitle(ref, label) {
    this.elements[ref].querySelector('button').title = this._umap.help.displayLabel(
      label,
      false
    )
  }

  addDrawListener(shape) {
    const action = (event) => {
      event.target.closest('button').classList.add('on')
      this._umap.fire(`draw:${shape}`)
    }
    this.addClickListener(shape, action)
  }

  addClickListener(ref, action) {
    // Put the click on the button, not on the li, but keep the data-ref on the li
    // so to hide/show it when needed.
    this.elements[ref].querySelector('button').addEventListener('click', action)
  }
}
