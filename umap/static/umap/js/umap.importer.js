U.Importer = L.Class.extend({
  TYPES: ['geojson', 'csv', 'gpx', 'kml', 'osm', 'georss', 'umap'],
  initialize: function (map) {
    this.map = map
    this.presets = map.options.importPresets
  },

  build: function () {
    this.container = L.DomUtil.create('div', 'umap-upload')
    this.title = L.DomUtil.createTitle(
      this.container,
      L._('Import data'),
      'icon-upload'
    )
    this.presetBox = L.DomUtil.create('div', 'formbox', this.container)
    this.presetSelect = L.DomUtil.create('select', '', this.presetBox)
    this.fileBox = L.DomUtil.create('div', 'formbox', this.container)
    this.fileInput = L.DomUtil.element({
      tagName: 'input',
      type: 'file',
      parent: this.fileBox,
      multiple: 'multiple',
      autofocus: true,
    })
    this.urlInput = L.DomUtil.element({
      tagName: 'input',
      type: 'text',
      parent: this.container,
      placeholder: L._('Provide an URL here'),
    })
    this.rawInput = L.DomUtil.element({
      tagName: 'textarea',
      parent: this.container,
      placeholder: L._('Paste your data here'),
    })
    this.typeLabel = L.DomUtil.add(
      'label',
      '',
      this.container,
      L._('Choose the format of the data to import')
    )
    this.layerLabel = L.DomUtil.add(
      'label',
      '',
      this.container,
      L._('Choose the layer to import in')
    )
    this.clearLabel = L.DomUtil.element({
      tagName: 'label',
      parent: this.container,
      textContent: L._('Replace layer content'),
      for: 'datalayer-clear-check',
    })
    this.submitInput = L.DomUtil.element({
      tagName: 'input',
      type: 'button',
      parent: this.container,
      value: L._('Import'),
      className: 'button',
    })
    this.map.help.button(this.typeLabel, 'importFormats')
    this.typeInput = L.DomUtil.element({
      tagName: 'select',
      name: 'format',
      parent: this.typeLabel,
    })
    this.layerInput = L.DomUtil.element({
      tagName: 'select',
      name: 'datalayer',
      parent: this.layerLabel,
    })
    this.clearFlag = L.DomUtil.element({
      tagName: 'input',
      type: 'checkbox',
      name: 'clear',
      id: 'datalayer-clear-check',
      parent: this.clearLabel,
    })
    L.DomUtil.element({
      tagName: 'option',
      value: '',
      textContent: L._('Choose the data format'),
      parent: this.typeInput,
    })
    for (let i = 0; i < this.TYPES.length; i++) {
      option = L.DomUtil.create('option', '', this.typeInput)
      option.value = option.textContent = this.TYPES[i]
    }
    if (this.presets.length) {
      const noPreset = L.DomUtil.create('option', '', this.presetSelect)
      noPreset.value = noPreset.textContent = L._('Choose a preset')
      for (let j = 0; j < this.presets.length; j++) {
        option = L.DomUtil.create('option', '', presetSelect)
        option.value = this.presets[j].url
        option.textContent = this.presets[j].label
      }
    } else {
      this.presetBox.style.display = 'none'
    }
    L.DomEvent.on(this.submitInput, 'click', this.submit, this)
    L.DomEvent.on(
      this.fileInput,
      'change',
      (e) => {
        let type = '',
          newType
        for (let i = 0; i < e.target.files.length; i++) {
          newType = U.Utils.detectFileType(e.target.files[i])
          if (!type && newType) type = newType
          if (type && newType !== type) {
            type = ''
            break
          }
        }
        this.typeInput.value = type
      },
      this
    )
  },

  open: function () {
    if (!this.container) this.build()
    const onLoad = this.map.editPanel.open({ content: this.container })
    onLoad.then(() => {
      this.fileInput.value = null
      this.layerInput.innerHTML = ''
      let option
      this.map.eachDataLayerReverse((datalayer) => {
        if (datalayer.isLoaded() && !datalayer.isRemoteLayer()) {
          const id = L.stamp(datalayer)
          option = L.DomUtil.add('option', '', this.layerInput, datalayer.options.name)
          option.value = id
        }
      })
      L.DomUtil.element({
        tagName: 'option',
        value: '',
        textContent: L._('Import in a new layer'),
        parent: this.layerInput,
      })
    })
  },

  openFiles: function () {
    this.open()
    this.fileInput.showPicker()
  },

  submit: function () {
    let type = this.typeInput.value
    const layerId = this.layerInput[this.layerInput.selectedIndex].value
    let layer
    if (type === 'umap') {
      this.map.once('postsync', this.map._setDefaultCenter)
    }
    if (layerId) layer = this.map.datalayers[layerId]
    if (layer && this.clearFlag.checked) layer.empty()
    if (this.fileInput.files.length) {
      for (let i = 0, file; (file = this.fileInput.files[i]); i++) {
        this.map.processFileToImport(file, layer, type)
      }
    } else {
      if (!type)
        return this.map.ui.alert({
          content: L._('Please choose a format'),
          level: 'error',
        })
      if (this.rawInput.value && type === 'umap') {
        try {
          this.map.importRaw(this.rawInput.value, type)
        } catch (e) {
          this.ui.alert({ content: L._('Invalid umap data'), level: 'error' })
          console.error(e)
        }
      } else {
        if (!layer) layer = this.map.createDataLayer()
        if (this.rawInput.value) layer.importRaw(this.rawInput.value, type)
        else if (this.urlInput.value) layer.importFromUrl(this.urlInput.value, type)
        else if (this.presetSelect.selectedIndex > 0)
          layer.importFromUrl(
            this.presetSelect[this.presetSelect.selectedIndex].value,
            type
          )
      }
    }
  },
})
