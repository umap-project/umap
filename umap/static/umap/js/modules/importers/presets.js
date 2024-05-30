import { DomUtil } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../i18n.js'

export class Importer {
  constructor(map, options) {
    this.name = 'Presets'
    this.choices = options?.choices
  }

  async open(importer) {
    const container = DomUtil.create('div', 'formbox')
    const select = DomUtil.create('select', '', container)
    const noPreset = DomUtil.element({
      tagName: 'option',
      parent: select,
      value: '',
      textContent: translate('Choose a preset'),
    })
    for (const preset of this.choices) {
      const option = DomUtil.create('option', '', select)
      option.value = preset.url
      option.textContent = preset.label
      option.dataset.format = preset.format || 'geojson'
    }
    const confirm = () => {
      if (select.value) {
        importer.url = select.value
        importer.format = select.options[select.selectedIndex].dataset.format
      }
      importer.dialog.close()
    }
    L.DomUtil.createButton('', container, 'OK', confirm)

    importer.dialog.open({
      content: container,
      className: 'presets dark',
    })
  }
}
