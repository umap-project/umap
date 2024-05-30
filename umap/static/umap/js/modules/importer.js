import { DomUtil, DomEvent } from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'
import { uMapAlert as Alert } from '../components/alerts/alert.js'
import Dialog from './ui/dialog.js'

const AVAILABLE_PLUGINS = ['geodatamine', 'communesfr', 'presets']

const TEMPLATE = `
    <h3><i class="icon icon-16 icon-upload"></i><span>${translate('Import data')}</span></h3>
    <div class="formbox">
      <input type="file" multiple autofocus />
      <input type="url" placeholder="${translate('Provide an URL here')}" />
      <textarea placeholder="${translate('Paste your data here')}"></textarea>
    </div>
    <div class="plugins">
      <h4>${translate('Import from:')}</h4>
      <div class="button-bar by4" id="plugins">
      </div>
    </div>
    <label data-help="importFormats">
      ${translate('Choose the format of the data to import')}
      <select name="format">
        <option>${translate('Choose the data format')}</option>
      </select>
    </label>
    <div class="destination">
      <label>
        ${translate('Choose the layer to import in')}
        <select name="layer-id"></select>
      </label>
      <label>
        ${translate('Replace layer content')}
        <input type="checkbox" name="clear" />
      </label>
    </div>
    <input type="button" class="button" name="import" value="${translate('Import')}" />
    `

export default class Importer {
  constructor(map) {
    this.map = map
    this.TYPES = ['geojson', 'csv', 'gpx', 'kml', 'osm', 'georss', 'umap']
    this.PLUGINS = []
    this.loadPlugins()
    this.dialog = new Dialog(this.map._controlContainer)
  }

  loadPlugins() {
    for (const key of AVAILABLE_PLUGINS) {
      if (key in this.map.options.plugins) {
        import(`./importers/${key}.js`).then((mod) => {
          this.PLUGINS.push(new mod.Importer(this.map, this.map.options.plugins[key]))
        })
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
    return (this.qs('[type=url]').value = value)
  }

  get format() {
    return this.qs('[name=format]').value
  }

  set format(value) {
    return (this.qs('[name=format]').value = value)
  }

  get files() {
    return this.qs('[type=file]').files
  }

  get raw() {
    return this.qs('textarea').value
  }

  get clear() {
    return Boolean(this.qs('[name=clear]').checked)
  }

  get layer() {
    const layerId = this.qs('[name=layer-id]').value
    if (layerId) return this.map.datalayers[layerId]
  }

  build() {
    this.container = DomUtil.create('div', 'umap-upload')
    this.container.innerHTML = TEMPLATE
    if (this.PLUGINS.length) {
      for (const plugin of this.PLUGINS) {
        L.DomUtil.createButton(
          'flat',
          this.container.querySelector('#plugins'),
          plugin.name,
          () => plugin.open(this)
        )
      }
    } else {
      this.qs('.plugins').style.display = 'none'
    }
    for (const type of this.TYPES) {
      DomUtil.element({
        tagName: 'option',
        parent: this.qs('[name=format]'),
        value: type,
        textContent: type,
      })
    }
    DomEvent.on(this.qs('[name=import]'), 'click', this.submit, this)
    DomEvent.on(this.qs('[type=file]'), 'change', this.onFileChange, this)
  }

  onFileChange(e) {
    let type = '',
      newType
    for (const file of e.target.files) {
      newType = U.Utils.detectFileType(file)
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
    const layerSelect = this.qs('[name="layer-id"]')
    layerSelect.innerHTML = ''
    this.map.eachDataLayerReverse((datalayer) => {
      if (datalayer.isLoaded() && !datalayer.isRemoteLayer()) {
        DomUtil.element({
          tagName: 'option',
          parent: layerSelect,
          textContent: datalayer.options.name,
          value: L.stamp(datalayer),
        })
      }
    })
    DomUtil.element({
      tagName: 'option',
      value: '',
      textContent: translate('Import in a new layer'),
      parent: layerSelect,
    })
  }

  open() {
    if (!this.container) this.build()
    const onLoad = this.map.editPanel.open({ content: this.container })
    onLoad.then(() => this.onLoad())
  }

  openFiles() {
    this.open()
    this.fileInput.showPicker()
  }

  submit() {
    let layer = this.layer
    if (this.format === 'umap') {
      this.map.once('postsync', this.map._setDefaultCenter)
    }
    if (layer && this.clear) layer.empty()
    if (this.files.length) {
      for (const file of this.files) {
        this.map.processFileToImport(file, layer, this.format)
      }
    } else {
      if (!this.format)
        return Alert.error(translate('Please choose a format'))
      if (this.raw && this.format === 'umap') {
        try {
          this.map.importRaw(this.raw, this.format)
        } catch (e) {
          Alert.error(L._('Invalid umap data'))
          console.error(e)
        }
      } else {
        if (!layer) layer = this.map.createDataLayer()
        if (this.raw) layer.importRaw(this.raw, this.format)
        else if (this.url) layer.importFromUrl(this.url, this.format)
      }
    }
  }
}
