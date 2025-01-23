import { translate } from './i18n.js'
import * as Utils from './utils.js'
import { uMapAlert as Alert } from '../components/alerts/alert.js'

const TEMPLATE = `
<div class="umap-caption">
  <div class="header">
    <i class="icon icon-16 icon-caption icon-block"></i>
    <hgroup>
      <h3><span class="map-name" data-ref="name"></span></h3>
      <h5 class="dates" data-ref="dates"></h5>
      <h4 data-ref="author"></h4>
      <h5><i class="icon icon-16 icon-star map-star" data-ref="star"></i><span class="map-stars"></span></h5>
    </hgroup>
  </div>
  <div class="umap-map-description text" data-ref="description"></div>
  <div class="datalayer-container" data-ref="datalayersContainer"></div>
  <div class="credits-container">
    <details>
      <summary>${translate('Credits')}</summary>
      <fieldset>
        <h5>${translate('User content credits')}</h5>
        <p data-ref="userCredits"></p>
        <p data-ref="licence">${translate('Map user content has been published under licence')} <a href="#" data-ref="licenceLink"></a></p>
        <p data-ref="noLicence">${translate('No licence has been set')}</p>
        <h5>${translate('Map background credits')}</h5>
        <p><strong data-ref="bgName"></strong> <span data-ref="bgAttribution"></span></p>
        <p data-ref="poweredBy"></p>
      </fieldset>
    </details>
  </div>
</div>`

export default class Caption extends Utils.WithTemplate {
  constructor(umap, leafletMap) {
    super()
    this._umap = umap
    this._leafletMap = leafletMap
    this.loadTemplate(TEMPLATE)
    this.elements.star.addEventListener('click', async () => {
      if (this._umap.properties.user?.id) {
        await this._umap.star()
        this.refresh()
      } else {
        Alert.error(translate('You must be logged in'))
      }
    })
  }

  isOpen() {
    return Boolean(document.querySelector('.on .umap-caption'))
  }

  refresh() {
    if (!this.isOpen()) return
    this.open()
  }

  open() {
    this.elements.name.textContent = this._umap.getDisplayName()
    this.elements.author.innerHTML = ''
    this._umap.addAuthorLink(this.elements.author)
    if (this._umap.properties.description) {
      this.elements.description.innerHTML = Utils.toHTML(
        this._umap.properties.description
      )
    } else {
      this.elements.description.hidden = true
    }
    this.elements.datalayersContainer.innerHTML = ''
    this._umap.eachDataLayerReverse((datalayer) =>
      this.addDataLayer(datalayer, this.elements.datalayersContainer)
    )
    this.addCredits()
    if (this._umap.properties.created_at) {
      const created_at = translate('Created at {date}', {
        date: new Date(this._umap.properties.created_at).toLocaleDateString(),
      })
      const modified_at = translate('Modified at {date}', {
        date: new Date(this._umap.properties.modified_at).toLocaleDateString(),
      })
      this.elements.dates.innerHTML = `${created_at} - ${modified_at}`
    } else {
      this.elements.dates.hidden = true
    }
    this._umap.panel.open({ content: this.element }).then(() => {
      // Create the legend when the panel is actually on the DOM
      this._umap.eachDataLayerReverse((datalayer) => datalayer.renderLegend())
      this._umap.propagate()
    })
  }

  addDataLayer(datalayer, parent) {
    if (!datalayer.options.inCaption) return
    const template = `
    <p class="caption-item ${datalayer.cssId}">
      <span class="datalayer-legend"></span>
      <strong data-ref="toolbox"></strong>
      <span class="text" data-ref="description"></span>
    </p>`
    const [element, { toolbox, description }] = Utils.loadTemplateWithRefs(template)
    if (datalayer.options.description) {
      description.innerHTML = Utils.toHTML(datalayer.options.description)
    } else {
      description.hidden = true
    }
    datalayer.renderToolbox(toolbox)
    parent.appendChild(element)
    // Use textContent for security
    const name = Utils.loadTemplate('<span></span>')
    name.textContent = datalayer.options.name
    toolbox.appendChild(name)
  }

  addCredits() {
    if (this._umap.properties.shortCredit || this._umap.properties.longCredit) {
      this.elements.userCredits.innerHTML = Utils.toHTML(
        this._umap.properties.longCredit || this._umap.properties.shortCredit
      )
    } else {
      this.elements.userCredits.hidden = true
    }
    if (this._umap.properties.licence) {
      this.elements.licenceLink.href = this._umap.properties.licence.url
      this.elements.licenceLink.textContent = this._umap.properties.licence.name
      this.elements.noLicence.hidden = true
    } else {
      this.elements.licence.hidden = true
    }
    this.elements.bgName.textContent = this._leafletMap.selectedTilelayer.options.name
    this.elements.bgAttribution.innerHTML =
      this._leafletMap.selectedTilelayer.getAttribution()
    const urls = {
      leaflet: 'http://leafletjs.com',
      django: 'https://www.djangoproject.com',
      umap: 'https://umap-project.org/',
      changelog: 'https://docs.umap-project.org/en/master/changelog/',
      version: this._umap.properties.umap_version,
    }
    this.elements.poweredBy.innerHTML = translate(
      `
      Powered by <a href="{leaflet}">Leaflet</a> and
      <a href="{django}">Django</a>,
      glued by <a href="{umap}">uMap project</a>
      (version <a href="{changelog}">{version}</a>).
      `,
      urls
    )
  }
}
