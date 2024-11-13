import { DomUtil } from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'
import * as Utils from './utils.js'

export default class Caption {
  constructor(umap, leafletMap) {
    this._umap = umap
    this._leafletMap = leafletMap
  }

  isOpen() {
    return Boolean(document.querySelector('.on .umap-caption'))
  }

  refresh() {
    if (!this.isOpen()) return
    this.open()
  }

  open() {
    const container = DomUtil.create('div', 'umap-caption')
    const hgroup = DomUtil.element({ tagName: 'hgroup', parent: container })
    DomUtil.createTitle(
      hgroup,
      this._umap.getDisplayName(),
      'icon-caption icon-block',
      'map-name'
    )
    const title = Utils.loadTemplate('<h4></h4>')
    hgroup.appendChild(title)
    this._umap.addAuthorLink(title)
    if (this._umap.properties.description) {
      const description = DomUtil.element({
        tagName: 'div',
        className: 'umap-map-description text',
        safeHTML: Utils.toHTML(this._umap.properties.description),
        parent: container,
      })
    }
    const datalayerContainer = DomUtil.create('div', 'datalayer-container', container)
    this._umap.eachDataLayerReverse((datalayer) =>
      this.addDataLayer(datalayer, datalayerContainer)
    )
    const creditsContainer = DomUtil.create('div', 'credits-container', container)
    this.addCredits(creditsContainer)
    this._umap.panel.open({ content: container }).then(() => {
      // Create the legend when the panel is actually on the DOM
      this._umap.eachDataLayerReverse((datalayer) => datalayer.renderLegend())
    })
  }

  addDataLayer(datalayer, container) {
    if (!datalayer.options.inCaption) return
    const p = DomUtil.create('p', `caption-item ${datalayer.cssId}`, container)
    const legend = DomUtil.create('span', 'datalayer-legend', p)
    const headline = DomUtil.create('strong', '', p)
    if (datalayer.options.description) {
      DomUtil.element({
        tagName: 'span',
        parent: p,
        safeHTML: Utils.toHTML(datalayer.options.description),
      })
    }
    datalayer.renderToolbox(headline)
    DomUtil.add('span', '', headline, `${datalayer.options.name} `)
  }

  addCredits(container) {
    const credits = DomUtil.createFieldset(container, translate('Credits'))
    let title = DomUtil.add('h5', '', credits, translate('User content credits'))
    if (this._umap.properties.shortCredit || this._umap.properties.longCredit) {
      DomUtil.element({
        tagName: 'p',
        parent: credits,
        safeHTML: Utils.toHTML(
          this._umap.properties.longCredit || this._umap.properties.shortCredit
        ),
      })
    }
    if (this._umap.properties.licence) {
      const licence = DomUtil.add(
        'p',
        '',
        credits,
        `${translate('Map user content has been published under licence')} `
      )
      DomUtil.createLink(
        '',
        licence,
        this._umap.properties.licence.name,
        this._umap.properties.licence.url
      )
    } else {
      DomUtil.add('p', '', credits, translate('No licence has been set'))
    }
    title = DomUtil.create('h5', '', credits)
    title.textContent = translate('Map background credits')
    const tilelayerCredit = DomUtil.create('p', '', credits)
    DomUtil.element({
      tagName: 'strong',
      parent: tilelayerCredit,
      textContent: `${this._leafletMap.selectedTilelayer.options.name} `,
    })
    DomUtil.element({
      tagName: 'span',
      parent: tilelayerCredit,
      safeHTML: this._leafletMap.selectedTilelayer.getAttribution(),
    })
    const urls = {
      leaflet: 'http://leafletjs.com',
      django: 'https://www.djangoproject.com',
      umap: 'https://umap-project.org/',
      changelog: 'https://docs.umap-project.org/en/master/changelog/',
      version: this._umap.properties.umap_version,
    }
    const creditHTML = translate(
      `
      Powered by <a href="{leaflet}">Leaflet</a> and
      <a href="{django}">Django</a>,
      glued by <a href="{umap}">uMap project</a>
      (version <a href="{changelog}">{version}</a>).
      `,
      urls
    )
    DomUtil.element({ tagName: 'p', innerHTML: creditHTML, parent: credits })
  }
}
