import {
  DomEvent,
  DomUtil,
  LatLngBounds,
} from '../../vendors/leaflet/leaflet-src.esm.js'
import { uMapAlert as Alert } from '../components/alerts/alert.js'
import { translate } from './i18n.js'
import { SCHEMA } from './schema.js'
import Dialog from './ui/dialog.js'
import * as Utils from './utils.js'

const TEMPLATE = `
  <div class="umap-import">
    <h3><i class="icon icon-16 icon-upload"></i><span>${translate('Import data')}</span></h3>
    <fieldset class="formbox">
      <legend class="counter">${translate('Choose data')}</legend>
      <input type="file" multiple autofocus onchange />
      <textarea onchange placeholder="${translate('Paste your data here')}"></textarea>
      <input class="highlightable" type="url" placeholder="${translate('Provide an URL here')}" onchange />
      <button type=button class="importers" hidden data-ref="importersButton"><i class="icon icon-16 icon-magic"></i>${translate('Import helpers')}</button>
    </fieldset>
    <fieldset class="formbox">
      <legend class="counter" data-help="importFormats">${translate(
        'Choose the format'
      )}</legend>
      <select name="format" onchange></select>
    </fieldset>
    <fieldset id="destination" class="formbox">
      <legend class="counter">${translate('Choose the layer')}</legend>
      <select name="layer-id" onchange></select>
      <label id="clear">
        <input type="checkbox" name="clear" />
        ${translate('Replace layer content')}
      </label>
      <input type="text" name="layer-name" placeholder="${translate('Layer name')}" />
    </fieldset>
    <fieldset id="import-mode" class="formbox">
      <legend class="counter" data-help="importMode">${translate('Choose import mode')}</legend>
      <label>
        <input type="radio" name="action" value="copy" checked onchange />
        ${translate('Copy into the layer')}
      </label>
      <label>
        <input type="radio" name="action" value="link" onchange />
        ${translate('Link to the layer as remote data')}
      </label>
    </fieldset>
    <input type="button" class="button primary" name="submit" value="${translate('Import data')}" disabled />
  </div>
    `

const GRID_TEMPLATE = `
  <div>
    <h3><i class="icon icon-16 icon-magic"></i>${translate('Import helpers')}</h3>
    <p>${translate('Import helpers will fill the URL field for you.')}</p>
    <ul class="grid-container by4" data-ref="grid"></ul>
  </div>
`

export default class Importer extends Utils.WithTemplate {
  constructor(umap) {
    super()
    this._umap = umap
    this.TYPES = ['geojson', 'csv', 'gpx', 'kml', 'osm', 'georss', 'umap']
    this.IMPORTERS = []
    this.loadImporters()
    this.dialog = new Dialog({
      className: 'importers dark',
      back: () => this.showImporters(),
    })
  }

  loadImporters() {
    for (const [name, config] of Object.entries(
      this._umap.properties.importers || {}
    )) {
      const register = (mod) => {
        this.IMPORTERS.push(new mod.Importer(this._umap, config))
      }
      // We need to have explicit static paths for Django's collectstatic with hashes.
      switch (name) {
        case 'geodatamine':
          import('./importers/geodatamine.js').then(register)
          break
        case 'communesfr':
          import('./importers/communesfr.js').then(register)
          break
        case 'cadastrefr':
          import('./importers/cadastrefr.js').then(register)
          break
        case 'overpass':
          import('./importers/overpass.js').then(register)
          break
        case 'datasets':
          import('./importers/datasets.js').then(register)
          break
        case 'banfr':
          import('./importers/banfr.js').then(register)
          break
        case 'opendata':
          import('./importers/opendata.js').then(register)
          break
      }
    }
  }

  qs(query) {
    return this.container.querySelector(query)
  }

  get url() {
    return this.qs('[type=url]').value
  }

  set url(value) {
    this.qs('[type=url]').value = value
    this.onChange()
  }

  get format() {
    return this.qs('[name=format]').value
  }

  set format(value) {
    this.qs('[name=format]').value = value
    this.onChange()
  }

  get files() {
    return this.qs('[type=file]').files
  }

  set files(files) {
    this.qs('[type=file]').files = files
    this.onFileChange()
  }

  get raw() {
    return this.qs('textarea').value
  }

  set raw(value) {
    this.qs('textarea').value = value
    this.onChange()
  }

  get clear() {
    return Boolean(this.qs('[name=clear]').checked)
  }

  get action() {
    return this.qs('[name=action]:checked')?.value
  }

  get layerId() {
    return this.qs('[name=layer-id]').value
  }

  set layerId(value) {
    this.qs('[name=layer-id]').value = value
  }

  get layerName() {
    return this.qs('[name=layer-name]').value
  }

  set layerName(name) {
    this.qs('[name=layer-name]').value = name
    this.onChange()
  }

  set layer(layer) {
    this._layer = layer
  }

  get layer() {
    return (
      this._layer ||
      this._umap.datalayers[this.layerId] ||
      this._umap.createDirtyDataLayer({ name: this.layerName })
    )
  }

  showImporters() {
    if (!this.IMPORTERS.length) return
    const [element, { grid }] = Utils.loadTemplateWithRefs(GRID_TEMPLATE)
    for (const plugin of this.IMPORTERS.sort((a, b) => (a.name > b.name ? 1 : -1))) {
      const button = Utils.loadTemplate(
        `<li><button type="button" class="${plugin.id}">${plugin.name}</button></li>`
      )
      button.addEventListener('click', () => plugin.open(this))
      grid.appendChild(button)
    }
    this.dialog.open({ template: element, cancel: false, accept: false, back: false })
  }

  build() {
    this.container = this.loadTemplate(TEMPLATE)
    if (this.IMPORTERS.length) {
      // TODO use this.elements instead of this.qs
      const button = this.qs('[data-ref=importersButton]')
      button.addEventListener('click', () => this.showImporters())
      button.toggleAttribute('hidden', false)
    }
    for (const type of this.TYPES) {
      DomUtil.element({
        tagName: 'option',
        parent: this.qs('[name=format]'),
        value: type,
        textContent: type,
      })
    }
    this._umap.help.parse(this.container)
    this.qs('[name=submit]').addEventListener('click', () => this.submit())
    DomEvent.on(this.qs('[type=file]'), 'change', this.onFileChange, this)
    for (const element of this.container.querySelectorAll('[onchange]')) {
      DomEvent.on(element, 'change', this.onChange, this)
    }
  }

  onChange() {
    this.qs('#destination').toggleAttribute('hidden', this.format === 'umap')
    this.qs('#import-mode').toggleAttribute(
      'hidden',
      this.format === 'umap' || !this.url
    )
    this.qs('[name=layer-name]').toggleAttribute('hidden', Boolean(this.layerId))
    this.qs('#clear').toggleAttribute('hidden', !this.layerId)
    this.qs('[name=submit').toggleAttribute('disabled', !this.canSubmit())
  }

  onFileChange() {
    let type = ''
    let newType
    for (const file of this.files) {
      newType = Utils.detectFileType(file)
      if (!type && newType) type = newType
      if (type && newType !== type) {
        type = ''
        break
      }
    }
    this.format = type
  }

  onLoad() {
    this.qs('[type=file]').value = null
    this.url = null
    this.format = undefined
    this.layerName = null
    this.raw = null
    const layerSelect = this.qs('[name="layer-id"]')
    layerSelect.innerHTML = ''
    this._umap.datalayers.reverse().map((datalayer) => {
      if (datalayer.isLoaded() && !datalayer.isRemoteLayer()) {
        DomUtil.element({
          tagName: 'option',
          parent: layerSelect,
          textContent: datalayer.getName(),
          value: datalayer.id,
        })
      }
    })
    DomUtil.element({
      tagName: 'option',
      value: '',
      textContent: translate('Import in a new layer'),
      parent: layerSelect,
      selected: true,
    })
  }

  open() {
    if (!this.container) this.build()
    const onLoad = this._umap.editPanel.open({
      content: this.container,
      highlight: 'import',
    })
    onLoad.then(() => this.onLoad())
  }

  openFiles() {
    this.open()
    this.qs('[type=file]').showPicker()
  }

  canSubmit() {
    if (!this.format) return false
    const hasFiles = Boolean(this.files.length)
    const hasRaw = Boolean(this.raw)
    const hasUrl = Boolean(this.url)
    const hasAction = Boolean(this.action)
    if (!hasFiles && !hasRaw && !hasUrl) return false
    if (this.url) return hasAction
    return true
  }

  submit() {
    if (this.format === 'umap') {
      this.full()
    } else if (!this.url) {
      this.copy()
    } else if (this.action) {
      this[this.action]()
    }
  }

  full() {
    try {
      if (this.files.length) {
        for (const file of this.files) {
          this._umap.processFileToImport(file, null, 'umap')
        }
      } else if (this.raw) {
        this._umap.importRaw(this.raw)
      } else if (this.url) {
        this._umap.importFromUrl(this.url, this.format)
      }
      this.onSuccess()
    } catch (e) {
      this.onError(translate('Invalid umap data'))
      console.debug(e)
      return false
    }
  }

  link() {
    if (!this.url) {
      return false
    }
    if (!this.format) {
      this.onError(translate('Please choose a format'))
      return false
    }
    const layer = this.layer
    layer.properties.remoteData = {
      url: this.url,
      format: this.format,
    }
    if (this._umap.properties.urls.ajax_proxy) {
      layer.properties.remoteData.proxy = true
      layer.properties.remoteData.ttl = SCHEMA.ttl.default
    }
    layer.fetchRemoteData(true).then((features) => {
      if (features?.length) {
        layer.zoomTo()
        this.onSuccess()
      } else {
        this.onError()
      }
    })
  }

  async copy() {
    // Format may be guessed from file later.
    // Usefull in case of multiple files with different formats.
    if (!this.format && !this.files.length) {
      this.onError(translate('Please choose a format'))
      return false
    }
    let promise
    const layer = this.layer
    if (this.clear) layer.empty()
    if (this.files.length) {
      promise = layer.importFromFiles(this.files, this.format)
    } else if (this.raw) {
      promise = layer.importRaw(this.raw, this.format)
    } else if (this.url) {
      promise = layer.importFromUrl(this.url, this.format)
    }
    if (promise) promise.then((data) => this.onCopyFinished(layer, data))
  }

  onError(message = translate('No data has been found for import')) {
    Alert.error(message)
  }

  onSuccess(count) {
    if (count) {
      Alert.success(
        translate('Successfully imported {count} feature(s)', {
          count: count,
        })
      )
    } else {
      Alert.success(translate('Data successfully imported!'))
    }
  }

  onCopyFinished(layer, features) {
    // undefined features means error, let original error message pop
    if (!features) return
    if (!features.length) {
      this.onError()
    } else {
      const bounds = new LatLngBounds()
      for (const feature of features) {
        const featureBounds = feature.ui.getBounds
          ? feature.ui.getBounds()
          : feature.ui.getCenter()
        bounds.extend(featureBounds)
      }
      this.onSuccess(features.length)
      layer.zoomToBounds(bounds)
    }
  }
}
