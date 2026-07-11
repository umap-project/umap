import {
  LayerGroup,
  Control as LeafletControl,
  TileLayer,
} from '../../../vendors/leaflet/leaflet-src.esm.js'
import { Alert } from '../../components/alerts/alert.js'
import { translate } from '../i18n.js'
import * as Utils from '../utils.js'

export class Control {
  constructor(app) {
    this.app = app
  }

  mount() {
    this.container = this.render()
    this.app.controlManager.corners[this.constructor.position].appendChild(
      this.container
    )
    this.onMount()
  }

  render() {}
  onMount() {}

  show() {
    this.container.hidden = false
  }

  hide() {
    if (!this.container) return
    this.container.hidden = true
  }

  static get slug() {
    // Properties on the uMap object are camelCased, let's comply
    // TODO make properties case insensitive
    const stripped = this.name.replace(/Control$/, '')
    return stripped[0].toLowerCase() + stripped.slice(1)
  }

  get status() {
    return this.app.getProperty(`${this.constructor.slug}Control`)
  }

  get visible() {
    return this.status
  }

  update() {
    if (!this.container) {
      if (!this.visible) return
      this.mount()
    }
    if (this.visible) {
      this.show()
    } else {
      this.hide()
    }
  }
}

// Those controls have three states:
// - true => show in the left bar
// - false => hide
// - null => show when the "more" button is clicked
class MoreableControl extends Control {
  update() {
    if (!this.container) {
      if (this.status === false) return
      this.mount()
    }
    const status = this.status
    if (status === false) {
      this.hide()
    } else {
      this.show()
      this.container.classList.toggle(
        'display-on-more',
        status === undefined || status === null
      )
    }
    return status
  }
}

export class ZoomControl extends MoreableControl {
  static position = 'topleft'

  render() {
    const [container, { zoomIn, zoomOut }] = Utils.loadTemplateWithRefs(`
      <div class="umap-control umap-control-zoom">
        <a class="umap-control-zoom-in" href="#" role="button" title="${translate('Zoom in')}" aria-label="${translate('Zoom in')}" data-ref="zoomIn"><span aria-hidden="true">+</span></a>
        <a class="umap-control-zoom-out" href="#" role="button" title="${translate('Zoom out')}" aria-label="${translate('Zoom out')}" data-ref="zoomOut"><span aria-hidden="true">−</span></a>
      </div>
    `)
    this._zoomInButton = zoomIn
    this._zoomOutButton = zoomOut
    zoomIn.addEventListener('click', (event) => this.zoom(event, 1))
    zoomOut.addEventListener('click', (event) => this.zoom(event, -1))
    return container
  }

  onMount() {
    this.app.on('map:zoomend', () => this._update())
    this.app.on('map:zoomlevelschange', () => this._update())
  }

  zoom(event, direction) {
    event.preventDefault()
    event.stopPropagation()
    this.app.mapProxy.zoom += direction * (event.shiftKey ? 3 : 1)
  }

  _update() {
    const map = this.app.mapProxy.map
    const zoom = map.getZoom()
    const atMax = zoom >= map.getMaxZoom()
    const atMin = zoom <= map.getMinZoom()
    this._zoomInButton.classList.toggle('disabled', atMax)
    this._zoomOutButton.classList.toggle('disabled', atMin)
    this._zoomInButton.setAttribute('aria-disabled', atMax ? 'true' : 'false')
    this._zoomOutButton.setAttribute('aria-disabled', atMin ? 'true' : 'false')
  }
}

export class MeasureControl extends MoreableControl {
  static position = 'topleft'

  render() {
    // TODO remove direct call to leafletMap => turf
    const defaultUnit = this.app.mapProxy.map.measureTools?.options.defaultUnit
    const checked = (unit) => (unit === defaultUnit ? 'checked' : '')
    const [container, { toggle }] = Utils.loadTemplateWithRefs(`
      <div class="umap-control umap-control-measure">
        <a class="umap-control-measure-toggle" href="#" role="button" title="${translate('Measure distances')}" data-ref="toggle"></a>
        <input type="radio" id="km" name="unit" value="km" ${checked('km')}>
        <label for="km" title="${translate('kilometers')}">${translate('km')}</label>
        <input type="radio" id="mi" name="unit" value="mi" ${checked('mi')}>
        <label for="mi" title="${translate('miles')}">${translate('mi')}</label>
        <input type="radio" id="nm" name="unit" value="nm" ${checked('nm')}>
        <label for="nm" title="${translate('nautical miles')}">${translate('NM')}</label>
      </div>
    `)
    toggle.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.app.mapProxy.map.measureTools.toggle()
    })
    return container
  }
}

export class FullscreenControl extends MoreableControl {
  static position = 'topleft'

  render() {
    const enter = translate('View Fullscreen')
    const exit = translate('Exit Fullscreen')
    const [container, { enterButton, exitButton }] = Utils.loadTemplateWithRefs(`
      <div class="umap-control umap-control-fullscreen">
        <a class="enter" href="#" role="button" title="${enter}" aria-label="${enter}" data-ref="enterButton"></a>
        <a class="exit" href="#" role="button" title="${exit}" aria-label="${exit}" data-ref="exitButton"></a>
      </div>
    `)
    const toggle = (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.app.mapProxy.toggleFullscreen()
    }
    enterButton.addEventListener('click', toggle)
    exitButton.addEventListener('click', toggle)
    return container
  }
}

export class HomeControl extends MoreableControl {
  static position = 'topleft'

  render() {
    const path = this.app.getStaticPathFor('home.svg')
    const homeURL = this.app.urls.get('home')
    return Utils.loadTemplate(
      `<a href="${homeURL}" class="home-button" title="${translate('Back to home')}"><img src="${path}" alt="${translate('Home logo')}" width="38px" height="38px" /></a>`
    )
  }
}

export class EditControl extends Control {
  static position = 'topright'

  get visible() {
    return this.app.hasEditMode()
  }

  render() {
    const [container, { button }] = Utils.loadTemplateWithRefs(`
      <div class="edit-enable dark">
        <button type="button" data-ref="button" class="round"><i class="icon icon-16 icon-edit"></i> ${translate('Edit')}</button>
      </div>
    `)
    button.addEventListener('click', () => this.app.enableEdit())
    button.addEventListener('mouseover', () => {
      this.app.tooltip.open({
        content: this.app.help.displayLabel('TOGGLE_EDIT'),
        anchor: button,
        position: 'bottom',
        delay: 750,
        duration: 5000,
      })
    })
    return container
  }
}

export class LoadTemplateControl extends Control {
  static position = 'topright'

  get visible() {
    return this.app.properties.is_template
  }

  render() {
    const [container, { button }] = Utils.loadTemplateWithRefs(`
      <div class="load-template dark hide-on-edit">
        <button type="button" data-ref="button" class="round"><i class="icon icon-16 icon-template"></i>&nbsp;${translate('Reuse this template')}</button>
      </div>
    `)
    button.addEventListener('click', () => {
      const downloadUrl = this.app.urls.get('map_download', {
        map_id: this.app.id,
      })
      const targetUrl = `${this.app.urls.get('map_new')}?templateUrl=${downloadUrl}`
      window.open(targetUrl)
    })
    button.addEventListener('mouseover', () => {
      this.app.tooltip.open({
        content: translate('Create a new map using this template'),
        anchor: button,
        position: 'bottom',
        delay: 750,
        duration: 5000,
      })
    })
    return container
  }
}

export class MoreControl extends MoreableControl {
  static position = 'topleft'

  render() {
    const corner = this.app.controlManager.corners.topleft
    const className = 'umap-more-controls'
    const [container, { button }] = Utils.loadTemplateWithRefs(`
      <div class="umap-control umap-control-text">
        <button class="umap-control-more" type="button" data-ref="button"></button>
      </div>
    `)
    button.addEventListener('click', () => corner.classList.toggle(className))
    button.addEventListener('mouseover', () => {
      const extended = corner.classList.contains(className)
      this.app.tooltip.open({
        content: extended ? translate('Hide controls') : translate('More controls'),
        anchor: button,
        position: 'right',
        delay: 750,
      })
    })
    return container
  }
}

class ScaleControl extends Control {
  static position = 'bottomleft'
  render() {
    this._scaleControl = new LeafletControl.Scale()
    return this._scaleControl.addTo(this.app.mapProxy.map)._container
  }
}

export class PermanentCreditControl extends Control {
  static position = 'bottomleft'

  render() {
    return Utils.loadTemplate(
      `<div class="umap-permanent-credits-container text"></div>`
    )
  }

  get status() {
    return Boolean(this.app.getProperty('permanentCredit'))
  }

  show() {
    // Re-read the property each time the control becomes visible so user edits
    // in the settings panel are reflected.
    this.container.innerHTML = Utils.toHTML(this.app.getProperty('permanentCredit'))
    this.container.style.backgroundColor = this.app.getProperty(
      'permanentCreditBackground'
    )
      ? '#FFFFFFB0'
      : ''
    super.show()
  }
}

class SimpleButton extends MoreableControl {
  // Subclasses set: position, className, title, icon
  render() {
    const [container, { button }] = Utils.loadTemplateWithRefs(`
      <div class="umap-control ${this.className || ''}">
        <button type="button" title="${this.title || ''}" data-ref="button"></button>
      </div>
    `)
    this.button = button
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      this.onClick()
    })
    button.addEventListener('dblclick', (event) => event.stopPropagation())
    if (this.icon) {
      button.appendChild(
        Utils.loadTemplate(`<i class="icon icon-24 ${this.icon}"></i>`)
      )
    }
    return container
  }

  onClick() {}
}

export class DatalayersControl extends SimpleButton {
  static position = 'topleft'
  className = 'umap-control-browse'
  title = translate('Open browser')
  icon = 'icon-layers'

  onMount() {
    Utils.toggleBadge(this.container, this.app.browser?.hasActiveFilters())
  }

  onClick() {
    this.app.openBrowser()
  }
}

export class CaptionControl extends SimpleButton {
  static position = 'topleft'
  className = 'umap-control-caption'
  title = translate('About')
  icon = 'icon-info'

  onClick() {
    this.app.openCaption()
  }
}

export class EmbedControl extends SimpleButton {
  static position = 'topleft'
  className = 'umap-control-embed'
  title = translate('Share and download')
  icon = 'icon-share'

  onClick() {
    this.app.loadShare().then((share) => share.open())
  }
}

export class PrintControl extends SimpleButton {
  static position = 'topleft'
  title = translate('Print')
  icon = 'icon-print'

  onClick() {
    this.app.openPrinter('print')
  }
}

export class SearchControl extends SimpleButton {
  static position = 'topleft'
  className = 'umap-control-search'
  title = translate('Search location')
  icon = 'icon-search'

  async onClick() {
    const { Geocoder } = await import('../autocomplete.js')
    const [container, { search }] = Utils.loadTemplateWithRefs(`
      <div>
        <h3><i class="icon icon-16 icon-search"></i>${translate('Search location')}</h3>
        <div data-ref=search></div>
      </div>
    `)
    this.search = new Geocoder(this.app, search)
    this.app.panel.open({ content: container }).then(() => {
      this.search.input.focus()
    })
  }
}

export class AttributionControl extends Control {
  static position = 'bottomright'

  get visible() {
    return true
  }

  render() {
    const shortCredit = this.app.getProperty('shortCredit')
    const captionMenus = this.app.getProperty('captionMenus')
    const tilelayer = this.app.mapProxy.tilelayers?.current
    const template = Utils.sanitizeVars`
      <div class="umap-control-attribution">
        <div class="attribution-container">
          ${Utils.toHTML(tilelayer?.options.attribution)}
          <span data-ref="short"> — ${Utils.toHTML(shortCredit)}</span>
          <a  href="#" data-ref="caption"> — ${translate('Open caption')}</a>
          <a href="https://umap-project.org/" data-ref="site"> — ${translate('Powered by uMap')}</a>
        </div>
        <a href="#" class="attribution-toggle"></a>
      </div>
    `
    const [container, { short, caption, site }] = Utils.loadTemplateWithRefs(template)
    short.hidden = !shortCredit
    caption.hidden = !captionMenus
    site.hidden = !captionMenus
    caption.addEventListener('click', () => this.app.openCaption())
    return container
  }
}

export class TilelayersControl extends SimpleButton {
  static DEMO_TILES_OPTIONS = { s: 'a', z: 9, x: 265, y: 181, '-y': 181, r: '' }
  static position = 'topleft'
  className = 'umap-tilelayer-control'
  title = translate('Change map background')
  icon = 'icon-tilelayer'

  onClick() {
    this.openSwitcher()
  }

  openSwitcher(options = {}) {
    const [container, { tileContainer }] = Utils.loadTemplateWithRefs(`
      <div class="umap-edit-tilelayers">
        <h3><i class="icon icon-16 icon-tilelayer" title=""></i><span class="">${translate('Change tilelayers')}</span></h3>
        <ul data-ref="tileContainer"></ul>
      </div>
    `)
    const tilelayers = Array.from(this.app.mapProxy.tilelayers.all.values()).sort(
      (a, b) => a.options.rank - b.options.rank
    )
    for (const layer of tilelayers) {
      tileContainer.appendChild(this.addTileLayerElement(layer, options))
    }
    const panel = options.edit ? this.app.editPanel : this.app.panel
    panel.open({ content: container, highlight: 'tilelayers' })
  }

  addTileLayerElement(tilelayer, options) {
    const src = Utils.template(
      tilelayer.options.url_template,
      TilelayersControl.DEMO_TILES_OPTIONS
    )
    const li = Utils.loadTemplate(Utils.sanitizeVars`
      <li>
        <img src="${src}" loading="lazy" />
        <div>${tilelayer.options.name}</div>
      </li>
    `)
    li.addEventListener('click', () => {
      const oldTileLayer = this.app.properties.tilelayer
      this.app.mapProxy.tilelayers.select(tilelayer)
      if (options?.edit) {
        this.app.properties.tilelayer = tilelayer.toJSON()
        this.app.journal.update(
          'properties.tilelayer',
          this.app.properties.tilelayer,
          oldTileLayer
        )
      }
    })
    return li
  }
}

export class LocateControl extends SimpleButton {
  static position = 'topleft'
  title = translate('Center map on your location')
  icon = 'icon-locate'

  onMount() {
    this.app.on('map:locateactivate', () => {
      this.container.classList.add('active')
    })
    this.app.on('map:locatedeactivate', () => {
      this.container.classList.remove('active')
    })
  }

  async start() {
    await this.loadPlugin()
    this._locate.start()
  }

  stop() {
    this._locate?.stop()
  }

  async loadPlugin() {
    if (this._locate) return
    const { LocateControl: LeafletLocate } = await import(
      '../../../vendors/locatecontrol/L.Control.Locate.esm.js'
    )
    this._locate = new LeafletLocate({
      strings: { title: translate('Center map on your location') },
      showPopup: false,
      onLocationError: (err) => Alert.error(err.message),
    })
    // TODO remove direct call to leafletMap
    this._locate._map = this.app.mapProxy.map
    this._locate.onAdd(this.app.mapProxy.map)
  }

  async onClick() {
    if (this._locate?._active) this.stop()
    else this.start()
  }
}

class MiniMapControl extends Control {
  static position = 'bottomright'
  render() {
    const layer = this._cloneLayer(this.app.mapProxy.tilelayers.current)
    this._miniMap = new LeafletControl.MiniMap(layer, {
      aimingRectOptions: {
        color: this.app.getProperty('color'),
        fillColor: this.app.getProperty('fillColor'),
        stroke: this.app.getProperty('stroke'),
        fill: this.app.getProperty('fill'),
        weight: this.app.getProperty('weight'),
        opacity: this.app.getProperty('opacity'),
        fillOpacity: this.app.getProperty('fillOpacity'),
      },
    })
    // TODO remove direct call to leafletMap
    return this._miniMap.addTo(this.app.mapProxy.map)._container
  }

  _cloneLayer(layer) {
    return new TileLayer(layer._url, Object.assign({}, layer.options))
  }
}

export class ControlManager {
  static POSITIONS = ['topleft', 'topright', 'bottomleft', 'bottomright']

  static get MOREABLE_CONTROLS() {
    return ControlManager.CLASSES.filter(
      (Class) => Class.prototype instanceof MoreableControl
    ).map((Class) => Class.slug)
  }

  static CLASSES = [
    HomeControl,
    ZoomControl,
    SearchControl,
    FullscreenControl,
    LocateControl,
    EmbedControl,
    DatalayersControl,
    CaptionControl,
    PrintControl,
    MeasureControl,
    TilelayersControl,
    MoreControl,
    MiniMapControl,
    AttributionControl,
    EditControl,
    LoadTemplateControl,
    PermanentCreditControl,
    ScaleControl,
  ]

  constructor(app) {
    this.app = app
    this.controls = {}
    this.corners = {}
    for (const position of ControlManager.POSITIONS) {
      const corner = Utils.loadTemplate(
        `<div class="umap-controls umap-controls-${position}"></div>`
      )
      app.uiContainer.appendChild(corner)
      this.corners[position] = corner
    }
  }

  init() {
    for (const Class of ControlManager.CLASSES) {
      this.controls[Class.slug] = new Class(this.app)
    }
  }

  update() {
    if (this.app.properties.noControl) {
      for (const control of Object.values(this.controls)) {
        control.hide()
      }
      return
    }
    for (const control of Object.values(this.controls)) {
      control.update()
    }
  }
}
