export default class Importer {
  constructor(map) {
    this.map = map
    this.presets = map.options.importPresets
  }

  #buildDatalayerOptions(layerSelect) {
    let option
    this.map.eachDataLayerReverse((datalayer) => {
      if (datalayer.isLoaded() && !datalayer.isRemoteLayer()) {
        const id = L.stamp(datalayer)
        option = L.DomUtil.add('option', '', layerSelect, datalayer.options.name)
        option.value = id
      }
    })
    L.DomUtil.element(
      'option',
      { value: '', textContent: L._('Import in a new layer') },
      layerSelect
    )
  }

  #buildPresetsOptions(presetSelect) {
    if (this.presets.length) {
      const presetBox = this.form.querySelector('#preset-box')
      presetBox.removeAttribute('hidden')
      const noPreset = L.DomUtil.create('option', '', presetSelect)
      noPreset.value = noPreset.textContent = L._('Choose a preset')
      for (const preset of this.presets) {
        option = L.DomUtil.create('option', '', presetSelect)
        option.value = preset.url
        option.textContent = preset.label
      }
    }
  }

  build() {
    const template = document.querySelector('#umap-upload')
    this.form = template.content.firstElementChild.cloneNode(true)
    this.presetSelect = this.form.querySelector('[name="preset-select"]')
    this.fileInput = this.form.querySelector('[name="file-input"]')
    this.map.ui.once('panel:closed', () => (this.fileInput.value = null))
    this.typeLabel = this.form.querySelector('#type-label')
    const helpButton = this.typeLabel.querySelector('button')
    this.map.help.button(this.typeLabel, 'importFormats', '', helpButton)
    this.formatSelect = this.form.querySelector('[name="format"]')
    this.layerSelect = this.form.querySelector('[name="datalayer"]')
    this.submitInput = this.form.querySelector('[name="submit-input"]')
    this.#buildDatalayerOptions(this.layerSelect)
    this.#buildPresetsOptions(this.presetSelect)

    this.submitInput.addEventListener('click', this.submit.bind(this))
    this.fileInput.addEventListener('change', (e) => {
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
    })
  }

  open() {
    if (!this.form) this.build()
    this.map.ui.openPanel({
      data: { html: this.form },
      className: 'dark',
    })
  }

  openFiles() {
    this.open()
    this.fileInput.showPicker()
  }

  submit() {
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
