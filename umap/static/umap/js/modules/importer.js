export default class Importer {
  constructor(map) {
    this.map = map
  }

  open() {
    if (!this.form) this._build()
    this.map.ui.openPanel({
      data: { html: this.form },
      className: 'dark',
    })
  }

  openFiles() {
    this.open()
    this.fileInput.showPicker()
  }

  _build() {
    const template = document.querySelector('#umap-upload')
    this.form = template.content.firstElementChild.cloneNode(true)

    this.typeLabel = this.form.querySelector('#type-label')
    const helpButton = this.typeLabel.querySelector('button')
    this.map.help.button(this.typeLabel, 'importFormats', '', helpButton)

    this.layerSelect = this.form.querySelector('[name="datalayer"]')
    this._buildDatalayerOptions(this.layerSelect)
    this.presetSelect = this.form.querySelector('[name="preset-select"]')
    this._buildPresetsOptions(this.presetSelect)

    this.fileInput = this.form.querySelector('[name="file-input"]')
    this.formatSelect = this.form.querySelector('[name="format"]')

    this._connectedCallback()
  }

  _buildDatalayerOptions(layerSelect) {
    const options = []
    this.map.eachDataLayerReverse((datalayer) => {
      if (datalayer.isLoaded() && !datalayer.isRemoteLayer()) {
        options.push(
          `<option value="${L.stamp(datalayer)}">${datalayer.options.name}</option>`
        )
      }
    })
    options.push(`<option value="">${L._('Import in a new layer')}</option>`)
    layerSelect.innerHTML = options.join('')
  }

  _buildPresetsOptions(presetSelect) {
    const presets = this.map.options.importPresets
    if (!presets.length) return
    const options = []
    presetSelect.parentElement.removeAttribute('hidden')
    options.push(
      `<option value="${L._('Choose a preset')}">${L._('Choose a preset')}</option>`
    )
    for (const preset of presets) {
      options.push(`<option value="${preset.url}">${preset.label}</option>`)
    }
    presetSelect.innerHTML = options.join('')
  }

  _connectedCallback() {
    const controller = new AbortController()
    const signal = controller.signal
    this.form
      .querySelector('[name="submit-input"]')
      .addEventListener('click', this._submit.bind(this), { signal })

    this.fileInput.addEventListener(
      'change',
      (e) => {
        let type = ''
        let newType
        for (const file of e.target.files) {
          newType = L.Util.detectFileType(file)
          if (!type && newType) {
            type = newType
          }
          if (type && newType !== type) {
            type = ''
            break
          }
        }
        this.formatSelect.value = type
      },
      { signal }
    )

    this.map.ui.once(
      'panel:closed',
      () => {
        this.fileInput.value = null
        controller.abort()
      },
      { signal }
    )
  }

  _submit() {
    const urlInputValue = this.form.querySelector('[name="url-input"]').value
    const rawInputValue = this.form.querySelector('[name="raw-input"]').value
    const clearFlag = this.form.querySelector('[name="clear"]')
    const type = this.formatSelect.value
    const layerId = this.layerSelect[this.layerSelect.selectedIndex].value
    let layer
    if (type === 'umap') {
      this.map.once('postsync', this.map._setDefaultCenter)
    }
    if (layerId) layer = this.map.datalayers[layerId]
    if (layer && clearFlag.checked) layer.empty()
    if (this.fileInput.files.length) {
      for (const file of this.fileInput.files) {
        this.map.processFileToImport(file, layer, type)
      }
    } else {
      if (!type)
        return this.map.ui.alert({
          content: L._('Please choose a format'),
          level: 'error',
        })
      if (rawInputValue && type === 'umap') {
        try {
          this.map.importRaw(rawInputValue, type)
        } catch (e) {
          this.ui.alert({ content: L._('Invalid umap data'), level: 'error' })
          console.error(e)
        }
      } else {
        if (!layer) layer = this.map.createDataLayer()
        if (rawInputValue) layer.importRaw(rawInputValue, type)
        else if (urlInputValue) layer.importFromUrl(urlInputValue, type)
        else if (this.presetSelect.selectedIndex > 0)
          layer.importFromUrl(
            this.presetSelect[this.presetSelect.selectedIndex].value,
            type
          )
      }
    }
  }
}
