import { DomUtil } from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'
import * as Utils from './utils.js'

export default class Caption {
  constructor(map) {
    this.map = map
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
      this.map.getDisplayName(),
      'icon-caption icon-block',
      'map-name'
    )
    this.map.addAuthorLink('h4', hgroup)
    if (this.map.options.description) {
      const description = DomUtil.element({
        tagName: 'div',
        className: 'umap-map-description text',
        safeHTML: Utils.toHTML(this.map.options.description),
        parent: container,
      })
    }
    const datalayerContainer = DomUtil.create('div', 'datalayer-container', container)
    this.map.eachDataLayerReverse((datalayer) =>
      this.addDataLayer(datalayer, datalayerContainer)
    )
    const creditsContainer = DomUtil.create('div', 'credits-container', container)
    this.addCredits(creditsContainer)
    this.map.panel.open({ content: container })
  }

  addDataLayer(datalayer, container) {
    if (!datalayer.options.inCaption) return
    const p = DomUtil.create('p', 'datalayer-legend', container)
    const legend = DomUtil.create('span', '', p)
    const headline = DomUtil.create('strong', '', p)
    datalayer.renderLegend(legend)
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
    if (this.map.options.shortCredit || this.map.options.longCredit) {
      DomUtil.element({
        tagName: 'p',
        parent: credits,
        safeHTML: Utils.toHTML(
          this.map.options.longCredit || this.map.options.shortCredit
        ),
      })
    }
    if (this.map.options.licence) {
      const licence = DomUtil.add(
        'p',
        '',
        credits,
        `${translate('Map user content has been published under licence')} `
      )
      DomUtil.createLink(
        '',
        licence,
        this.map.options.licence.name,
        this.map.options.licence.url
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
      textContent: `${this.map.selected_tilelayer.options.name} `,
    })
    DomUtil.element({
      tagName: 'span',
      parent: tilelayerCredit,
      safeHTML: this.map.selected_tilelayer.getAttribution(),
    })
    const urls = {
      leaflet: 'http://leafletjs.com',
      django: 'https://www.djangoproject.com',
      umap: 'https://umap-project.org/',
      changelog: 'https://docs.umap-project.org/en/master/changelog/',
      version: this.map.options.umap_version,
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
