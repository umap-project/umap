U.Importer = L.Class.extend({
  TYPES: ['geojson', 'csv', 'gpx', 'kml', 'osm', 'georss', 'umap'],
  initialize: function (map) {
    this.map = map
    this.presets = map.options.importPresets
  },

  build: function () {
    this.container = L.DomUtil.create('div', 'umap-upload')
    this.title = L.DomUtil.add('h3', '', this.container, L._('Import data'))
    this.presetBox = L.DomUtil.create('div', 'formbox', this.container)
    this.presetSelect = L.DomUtil.create('select', '', this.presetBox)
    this.fileBox = L.DomUtil.create('div', 'formbox', this.container)
    this.fileInput = L.DomUtil.element(
      'input',
      { type: 'file', multiple: 'multiple', autofocus: true },
      this.fileBox
    )
    this.map.ui.once('panel:closed', () => (this.fileInput.value = null))
    this.urlInput = L.DomUtil.element(
      'input',
      { type: 'text', placeholder: L._('Provide an URL here') },
      this.container
    )
    this.rawInput = L.DomUtil.element(
      'textarea',
      { placeholder: L._('Paste your data here') },
      this.container
    )
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
    this.clearLabel = L.DomUtil.add(
      'label',
      '',
      this.container,
      L._('Replace layer content')
    )
    this.submitInput = L.DomUtil.element(
      'input',
      { type: 'button', value: L._('Import'), className: 'button' },
      this.container
    )
    this.map.help.button(this.typeLabel, 'importFormats')
    this.typeInput = L.DomUtil.element('select', { name: 'format' }, this.typeLabel)
    this.layerInput = L.DomUtil.element(
      'select',
      { name: 'datalayer' },
      this.layerLabel
    )
    this.clearFlag = L.DomUtil.element(
      'input',
      { type: 'checkbox', name: 'clear' },
      this.clearLabel
    )
    let option
    this.map.eachDataLayerReverse((datalayer) => {
      if (datalayer.isLoaded() && !datalayer.isRemoteLayer()) {
        const id = L.stamp(datalayer)
        option = L.DomUtil.add('option', '', this.layerInput, datalayer.options.name)
        option.value = id
      }
    })
    L.DomUtil.element(
      'option',
      { value: '', textContent: L._('Import in a new layer') },
      this.layerInput
    )
    L.DomUtil.element(
      'option',
      { value: '', textContent: L._('Choose the data format') },
      this.typeInput
    )
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
          newType = L.Util.detectFileType(e.target.files[i])
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
    this.map.ui.openPanel({ data: { html: this.container }, className: 'dark' })
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
