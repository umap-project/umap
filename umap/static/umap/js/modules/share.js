import { DomUtil } from '../../vendors/leaflet/leaflet-src.esm.js'
import { EXPORT_FORMATS } from './formatter.js'
import { translate } from './i18n.js'
import * as Utils from './utils.js'

export default class Share {
  constructor(map) {
    this.map = map
  }

  build() {
    this.container = DomUtil.create('div', '')
    this.title = DomUtil.createTitle(
      this.container,
      translate('Share and download'),
      'icon-share'
    )

    DomUtil.createCopiableInput(
      this.container,
      translate('Link to view the map'),
      window.location.protocol + Utils.getBaseUrl()
    )

    if (this.map.options.shortUrl) {
      DomUtil.createCopiableInput(
        this.container,
        translate('Short link'),
        this.map.options.shortUrl
      )
    }

    DomUtil.create('hr', '', this.container)

    DomUtil.add('h4', '', this.container, translate('Download'))
    DomUtil.add(
      'small',
      'label',
      this.container,
      translate("Only visible layers' data")
    )
    const list = document.createElement('ul')
    list.classList.add('downloads')
    this.container.appendChild(list)
    for (const format of Object.keys(EXPORT_FORMATS)) {
      const button = Utils.loadTemplate(`
        <li>
          <button class="flat" type="button">
            <i class="icon icon-16 icon-download"></i>${format}
          </button>
        </li>
      `)
      button.addEventListener('click', () => this.download(format))
      list.appendChild(button)
    }
    DomUtil.create('div', 'vspace', this.container)
    DomUtil.add(
      'small',
      'label',
      this.container,
      translate('All data and settings of the map')
    )
    const downloadUrl = Utils.template(this.map.options.urls.map_download, {
      map_id: this.map.options.umap_id,
    })
    const link = Utils.loadTemplate(`
      <div>
        <a href="${downloadUrl}">
          <i class="icon icon-16 icon-backup"></i>${translate('full backup')}
        </a>
      </div>
    `)
    this.container.appendChild(link)
    // File will be named by back-office
    link.setAttribute('download', 'backup.umap')
    DomUtil.create('hr', '', this.container)

    const embedTitle = DomUtil.add('h4', '', this.container, translate('Embed the map'))
    const iframe = DomUtil.create('textarea', 'umap-share-iframe', this.container)
    const urlTitle = DomUtil.add('h4', '', this.container, translate('Direct link'))
    const exportUrl = DomUtil.createCopiableInput(
      this.container,
      translate('Share this link to open a customized map view'),
      ''
    )

    exportUrl.type = 'text'
    const UIFields = [
      ['dimensions.width', { handler: 'Input', label: translate('width') }],
      ['dimensions.height', { handler: 'Input', label: translate('height') }],
      [
        'options.includeFullScreenLink',
        { handler: 'Switch', label: translate('Include full screen link?') },
      ],
      [
        'options.currentView',
        {
          handler: 'Switch',
          label: translate('Current view instead of default map view?'),
        },
      ],
      [
        'options.keepCurrentDatalayers',
        { handler: 'Switch', label: translate('Keep current visible layers') },
      ],
      [
        'options.viewCurrentFeature',
        { handler: 'Switch', label: translate('Open current feature on load') },
      ],
      'queryString.moreControl',
      'queryString.scrollWheelZoom',
      'queryString.miniMap',
      'queryString.scaleControl',
      'queryString.onLoadPanel',
      'queryString.captionBar',
      'queryString.captionMenus',
    ]
    for (let i = 0; i < this.map.HIDDABLE_CONTROLS.length; i++) {
      UIFields.push(`queryString.${this.map.HIDDABLE_CONTROLS[i]}Control`)
    }
    const iframeExporter = new IframeExporter(this.map)
    const buildIframeCode = () => {
      iframe.textContent = iframeExporter.build()
      exportUrl.value = window.location.protocol + iframeExporter.buildUrl()
    }
    buildIframeCode()
    const builder = new U.FormBuilder(iframeExporter, UIFields, {
      callback: buildIframeCode,
    })
    const iframeOptions = DomUtil.createFieldset(
      this.container,
      translate('Embed and link options')
    )
    iframeOptions.appendChild(builder.build())
  }

  open() {
    if (!this.container) this.build()
    this.map.panel.open({ content: this.container })
  }

  async format(mode) {
    const type = EXPORT_FORMATS[mode]
    const content = await type.formatter(this.map)
    let name = this.map.options.name || 'data'
    name = name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const filename = name + type.ext
    return { content, filetype: type.filetype, filename }
  }

  async download(mode) {
    const { content, filetype, filename } = await this.format(mode)
    const blob = new Blob([content], { type: filetype })
    window.URL = window.URL || window.webkitURL
    const el = document.createElement('a')
    el.download = filename
    el.href = window.URL.createObjectURL(blob)
    el.style.display = 'none'
    document.body.appendChild(el)
    el.click()
    document.body.removeChild(el)
  }
}

class IframeExporter {
  constructor(map) {
    this.map = map
    this.baseUrl = Utils.getBaseUrl()
    this.options = {
      includeFullScreenLink: true,
      currentView: false,
      keepCurrentDatalayers: false,
      viewCurrentFeature: false,
    }

    this.queryString = {
      scaleControl: false,
      miniMap: false,
      scrollWheelZoom: false,
      zoomControl: true,
      editMode: 'disabled',
      moreControl: true,
      searchControl: null,
      tilelayersControl: null,
      embedControl: null,
      datalayersControl: true,
      onLoadPanel: 'none',
      captionBar: false,
      captionMenus: true,
    }

    this.dimensions = {
      width: '100%',
      height: '300px',
    }
    // Use map default, not generic default
    this.queryString.onLoadPanel = this.map.getOption('onLoadPanel')
  }

  getMap() {
    return this.map
  }

  buildUrl(options) {
    const datalayers = []
    if (this.options.viewCurrentFeature && this.map.currentFeature) {
      this.queryString.feature = this.map.currentFeature.getSlug()
    } else {
      delete this.queryString.feature
    }
    if (this.options.keepCurrentDatalayers) {
      this.map.eachDataLayer((datalayer) => {
        if (datalayer.isVisible() && datalayer.umap_id) {
          datalayers.push(datalayer.umap_id)
        }
      })
      this.queryString.datalayers = datalayers.join(',')
    } else {
      delete this.queryString.datalayers
    }
    const currentView = this.options.currentView ? window.location.hash : ''
    const queryString = L.extend({}, this.queryString, options)
    return `${this.baseUrl}?${Utils.buildQueryString(queryString)}${currentView}`
  }

  build() {
    const iframeUrl = this.buildUrl()
    let code = `<iframe width="${this.dimensions.width}" height="${this.dimensions.height}" frameborder="0" allowfullscreen allow="geolocation" src="${iframeUrl}"></iframe>`
    if (this.options.includeFullScreenLink) {
      const fullUrl = this.buildUrl({ scrollWheelZoom: true })
      code += `<p><a href="${fullUrl}">${translate('See full screen')}</a></p>`
    }
    return code
  }
}
