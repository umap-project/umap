import { Control } from '../../../vendors/leaflet/leaflet-src.esm.js'
import * as Utils from '../utils.js'
import { translate } from '../i18n.js'

export const HomeControl = Control.extend({
  options: {
    position: 'topleft',
  },

  onAdd: (map) => {
    const path = map._umap.getStaticPathFor('home.svg')
    const container = Utils.loadTemplate(
      `<a href="/" class="home-button" title="${translate('Back to home')}"><img src="${path}" alt="${translate('Home logo')}" width="38px" height="38px" /></a>`
    )
    return container
  },
})

export const EditControl = Control.extend({
  options: {
    position: 'topright',
  },

  onAdd: (map) => {
    const template = `
      <div class="edit-enable dark">
        <button type="button" data-ref="button" class="round"><i class="icon icon-16 icon-edit"></i> ${translate('Edit')}</button>
      </div>
    `
    const [container, { button }] = Utils.loadTemplateWithRefs(template)
    button.addEventListener('click', () => map._umap.enableEdit())
    button.addEventListener('mouseover', () => {
      map._umap.tooltip.open({
        content: map._umap.help.displayLabel('TOGGLE_EDIT'),
        anchor: button,
        position: 'bottom',
        delay: 750,
        duration: 5000,
      })
    })
    return container
  },
})

export const LoadTemplateControl = Control.extend({
  options: {
    position: 'topright',
  },

  onAdd: (map) => {
    const template = `
      <div class="load-template dark hide-on-edit">
        <button type="button" data-ref="button" class="round"><i class="icon icon-16 icon-template"></i>&nbsp;${translate('Reuse this template')}</button>
      </div>
    `
    const [container, { button }] = Utils.loadTemplateWithRefs(template)
    button.addEventListener('click', () => {
      const downloadUrl = map._umap.urls.get('map_download', {
        map_id: map._umap.id,
      })
      const targetUrl = `${map._umap.urls.get('map_new')}?templateUrl=${downloadUrl}`
      window.open(targetUrl)
    })
    button.addEventListener('mouseover', () => {
      map._umap.tooltip.open({
        content: translate('Create a new map using this template'),
        anchor: button,
        position: 'bottom',
        delay: 750,
        duration: 5000,
      })
    })
    return container
  },
})

export const MoreControl = Control.extend({
  options: {
    position: 'topleft',
  },

  onAdd: function (map) {
    const pos = this.getPosition()
    const corner = map._controlCorners[pos]
    const className = 'umap-more-controls'
    const template = `
      <div class="umap-control-text">
        <button class="umap-control-more" type="button" data-ref="button"></button>
      </div>
    `
    const [container, { button }] = Utils.loadTemplateWithRefs(template)
    button.addEventListener('click', () => corner.classList.toggle(className))
    button.addEventListener('mouseover', () => {
      const extended = corner.classList.contains(className)
      map._umap.tooltip.open({
        content: extended ? translate('Hide controls') : translate('More controls'),
        anchor: button,
        position: 'right',
        delay: 750,
      })
    })
    return container
  },
})

export const PermanentCreditsControl = Control.extend({
  options: {
    position: 'bottomleft',
  },

  onAdd: (map) => {
    const container = Utils.loadTemplate(
      `<div class="umap-permanent-credits-container text">${Utils.toHTML(map.options.permanentCredit)}</div>`
    )
    const background = map.options.permanentCreditBackground ? '#FFFFFFB0' : ''
    container.style.backgroundColor = background
    return container
  },
})

const BaseButton = Control.extend({
  initialize: function (umap, options) {
    this._umap = umap
    Control.prototype.initialize.call(this, options)
  },

  onAdd: function (map) {
    const template = `
      <div class="${this.options.className} umap-control">
        <button type="button" title="${this.options.title}" data-ref="button"></button>
      </div>
    `
    const [container, { button }] = Utils.loadTemplateWithRefs(template)
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      this.onClick()
    })
    button.addEventListener('dblclick', (event) => {
      event.stopPropagation()
    })
    if (this.options.icon) {
      button.appendChild(
        Utils.loadTemplate(`<i class="icon icon-24 ${this.options.icon}"></i>`)
      )
    }
    this.afterAdd(container, map)
    return container
  },

  onRemove(map) {
    this.afterRemove(map)
  },

  afterAdd: (container, map) => {},
  afterRemove: (map) => {},
})

export const DataLayersControl = BaseButton.extend({
  options: {
    position: 'topleft',
    className: 'umap-control-browse',
    title: translate('Open browser'),
    icon: 'icon-layers',
  },

  afterAdd: function (container) {
    Utils.toggleBadge(container, this._umap.browser?.hasFilters())
  },

  onClick: function () {
    this._umap.openBrowser()
  },
})

export const CaptionControl = BaseButton.extend({
  options: {
    position: 'topleft',
    className: 'umap-control-caption',
    title: translate('About'),
    icon: 'icon-caption',
  },

  onClick: function () {
    this._umap.openCaption()
  },
})

export const EmbedControl = BaseButton.extend({
  options: {
    position: 'topleft',
    title: translate('Share and download'),
    className: 'leaflet-control-embed',
    icon: 'icon-share',
  },

  onClick: function () {
    this._umap.share.open()
  },
})

export const PrintControl = BaseButton.extend({
  options: {
    position: 'topleft',
    title: translate('Print'),
    icon: 'icon-print',
  },

  onClick: function () {
    this._umap.openPrinter('print')
  },
})

export const SearchControl = BaseButton.extend({
  options: {
    position: 'topleft',
    title: translate('Search location'),
    className: 'leaflet-control-search',
    icon: 'icon-search',
  },

  afterAdd(container, map) {
    this.layer = L.layerGroup().addTo(map)
    this.photonOptions = {
      limit: 10,
      noResultLabel: translate('No results'),
    }
    if (map.options.photonUrl) this.photonOptions.url = map.options.photonUrl
  },

  afterRemove: function (map) {
    this.layer.remove()
  },

  onClick: function () {
    const template = `
      <div>
        <h3><i class="icon icon-16 icon-search"></i>${translate('Search location')}</h3>
        <input class="photon-input" data-ref=input />
        <div class="photon-autocomplete" data-ref=resultsContainer></div>
      </div>
    `
    const [container, { input, resultsContainer }] =
      Utils.loadTemplateWithRefs(template)
    const id = Math.random()
    this._umap.panel.open({ content: container }).then(() => {
      this.search = new U.Search(
        this._umap._leafletMap,
        input,
        this.layer,
        this.photonOptions
      )
      this.search.on('ajax:send', () => {
        this._umap.fire('dataloading', { id: id })
      })
      this.search.on('ajax:return', () => {
        this._umap.fire('dataload', { id: id })
      })
      this.search.resultsContainer = resultsContainer
      input.focus()
    })
  },
})

export const AttributionControl = Control.Attribution.extend({
  options: {
    prefix: '',
  },

  _update: function () {
    // Layer is no more on the map
    if (!this._map) return
    Control.Attribution.prototype._update.call(this)
    const shortCredit = this._map._umap.getProperty('shortCredit')
    const captionMenus = this._map._umap.getProperty('captionMenus')
    // Use our own container, so we can hide/show on small screens
    const originalCredits = this._container.innerHTML
    this._container.innerHTML = ''
    const template = `
      <div class="attribution-container">
        ${originalCredits}
        <span data-ref="short"> — ${Utils.toHTML(shortCredit)}</span>
        <a  href="#" data-ref="caption"> — ${translate('Open caption')}</a>
        <a href="/" data-ref="home"> — ${translate('Home')}</a>
        <a href="https://umap-project.org/" data-ref="site"> — ${translate('Powered by uMap')}</a>
        <a href="#" class="attribution-toggle"></a>
      </div>
    `
    const [container, { short, caption, home, site }] =
      Utils.loadTemplateWithRefs(template)
    caption.addEventListener('click', () => this._map._umap.openCaption())
    this._container.appendChild(container)
    short.hidden = !shortCredit
    caption.hidden = !captionMenus
    site.hidden = !captionMenus
    home.hidden = this._map._umap.isEmbed || !captionMenus
  },
})

/* Used in edit mode to define the default tilelayer */
export const TileLayerChooser = BaseButton.extend({
  options: {
    position: 'topleft',
  },

  onClick: function () {
    this.openSwitcher({ edit: true })
  },

  openSwitcher: function (options = {}) {
    const template = `
      <div class="umap-edit-tilelayers">
        <h3><i class="icon icon-16 icon-tilelayer" title=""></i><span class="">${translate('Change tilelayers')}</span></h3>
        <ul data-ref="tileContainer"></ul>
      </div>
    `
    const [container, { tileContainer }] = Utils.loadTemplateWithRefs(template)
    this.buildList(tileContainer, options)
    const panel = options.edit ? this._umap.editPanel : this._umap.panel
    panel.open({ content: container, highlight: 'tilelayers' })
  },

  buildList: function (container, options) {
    this._umap._leafletMap.eachTileLayer((tilelayer) => {
      const browserIsHttps = window.location.protocol === 'https:'
      const tileLayerIsHttp = tilelayer.options.url_template.indexOf('http:') === 0
      if (browserIsHttps && tileLayerIsHttp) return
      container.appendChild(this.addTileLayerElement(tilelayer, options))
    })
  },

  addTileLayerElement: function (tilelayer, options) {
    const selectedClass = this._umap._leafletMap.hasLayer(tilelayer) ? 'selected' : ''
    const src = Utils.template(
      tilelayer.options.url_template,
      this._umap._leafletMap.options.demoTileInfos
    )
    const template = `
      <li>
        <img src="${src}" loading="lazy" />
        <div>${tilelayer.options.name}</div>
      </li>
    `
    const li = Utils.loadTemplate(template)
    li.addEventListener('click', () => {
      const oldTileLayer = this._umap.properties.tilelayer
      this._umap._leafletMap.selectTileLayer(tilelayer)
      this._umap._leafletMap._controls.tilelayers.setLayers()
      if (options?.edit) {
        this._umap.properties.tilelayer = tilelayer.toJSON()
        this._umap.sync.update(
          'properties.tilelayer',
          this._umap.properties.tilelayer,
          oldTileLayer
        )
      }
    })
    return li
  },
})
