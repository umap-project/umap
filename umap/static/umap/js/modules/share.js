import { MutatingForm } from './form/builder.js'
import { EXPORT_FORMATS } from './formatter.js'
import { translate } from './i18n.js'
import * as Utils from './utils.js'
import * as DOMUtils from './domutils.js'

export default class Share {
  constructor(umap) {
    this._umap = umap
  }

  build() {
    const downloadUrl = this._umap.urls.get('map_download', {
      map_id: this._umap.id,
    })
    const [container, { shortUrl, list, customLink, textarea, iframeOptionsWrapper }] =
      DOMUtils.loadTemplateWithRefs(`
      <div>
        <h3><i class="icon icon-16 icon-share"></i> ${translate('Share and download')}</h3>
        <h4>${translate('Share')}</h4>
        <copiable-input data-label="${translate('Link to view the map')}" data-value="${window.location.protocol + Utils.getBaseUrl()}"></copiable-input>
        <copiable-input data-label="${translate('Short link')}" data-value="${this._umap.properties.shortUrl}" data-ref="shortUrl" hidden></copiable-input>
        <copiable-textarea data-label="${translate('Customized link')}" data-ref="customLink"></copiable-textarea>
        <copiable-textarea data-label="${translate('Iframe')}" data-ref="textarea"></copiable-textarea>
        <div data-ref="iframeOptionsWrapper"></div>
        <hr>
        <h4>${translate('Download')}</h4>
        <h5>${translate("Only visible layers' data")}</h5>
        <ul data-ref="list" class="downloads"></ul>
        <h5>${translate('All data and settings of the map')}</h5>
        <p>
          <a href="${downloadUrl}" download="backup.umap">
            <i class="icon icon-16 icon-backup"></i>${translate('full backup')}
          </a>
        </p>
      </div>
    `)
    this.container = container
    if (this._umap.properties.shortUrl) {
      shortUrl.hidden = false
    }
    for (const format of Object.keys(EXPORT_FORMATS).concat('jpg', 'png')) {
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
    // TODO: move HIDDABLE_CONTROLS to SCHEMA ?
    for (const name of this._umap._leafletMap.HIDDABLE_CONTROLS) {
      UIFields.push(`queryString.${name}Control`)
    }
    const iframeExporter = new IframeExporter(this._umap)
    const buildIframeCode = () => {
      textarea.setAttribute('value', iframeExporter.build())
      customLink.setAttribute(
        'value',
        window.location.protocol + iframeExporter.buildUrl()
      )
    }
    buildIframeCode()
    const builder = new MutatingForm(iframeExporter, UIFields)
    builder.on('set', buildIframeCode)
    const iframeOptions = DOMUtils.createFieldset(
      iframeOptionsWrapper,
      translate('Embed and link options')
    )
    iframeOptions.appendChild(builder.build())
  }

  open() {
    if (!this.container) this.build()
    this._umap.panel.open({ content: this.container })
  }

  async format(mode) {
    const type = EXPORT_FORMATS[mode]
    const features = this._umap.datalayers
      .visible()
      .reduce((acc, dl) => acc.concat(dl.features.visible()), [])
    const content = await this._umap.formatter.stringify(features, mode)
    const filename = Utils.slugify(this._umap.properties.name) + type.ext
    return { content, filetype: type.filetype, filename }
  }

  async download(mode) {
    if (!(mode in EXPORT_FORMATS)) {
      this._umap.openPrinter(mode)
    } else {
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
}

class IframeExporter {
  constructor(umap) {
    this._umap = umap
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
    this.queryString.onLoadPanel = this._umap.getProperty('onLoadPanel')
  }

  buildUrl(options) {
    const datalayers = []
    if (this.options.viewCurrentFeature && this._umap.currentFeature) {
      this.queryString.feature = this._umap.currentFeature.getSlug()
    } else {
      delete this.queryString.feature
    }
    if (this.options.keepCurrentDatalayers) {
      this._umap.datalayers.visible().map((datalayer) => {
        if (datalayer.createdOnServer) {
          datalayers.push(datalayer.id)
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
    let code = `<iframe style="width: ${this.dimensions.width}; height: ${this.dimensions.height}; border: 0;" allowfullscreen allow="geolocation" src="${iframeUrl}"></iframe>`
    if (this.options.includeFullScreenLink) {
      const fullUrl = this.buildUrl({ scrollWheelZoom: true })
      code += `<p><a href="${fullUrl}">${translate('See full screen')}</a></p>`
    }
    return code
  }
}
