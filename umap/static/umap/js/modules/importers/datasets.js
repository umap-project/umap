import { DomUtil } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../i18n.js'

export class Importer {
  constructor(map, options) {
    this.name = options.name || 'Datasets'
    this.choices = options?.choices
    this.id = 'datasets'
  }

  async open(importer) {
    const container = DomUtil.create('div', 'formbox')
    DomUtil.element({ tagName: 'h3', textContent: this.name, parent: container })
    const select = DomUtil.create('select', '', container)
    const noPreset = DomUtil.element({
      tagName: 'option',
      parent: select,
      value: '',
      textContent: translate('Choose a dataset'),
    })
    for (const dataset of this.choices) {
      const option = DomUtil.create('option', '', select)
      option.value = dataset.url
      option.textContent = dataset.label
      option.dataset.format = dataset.format || 'geojson'
    }
    const confirm = () => {
      if (select.value) {
        importer.url = select.value
        importer.format = select.options[select.selectedIndex].dataset.format
        importer.layerName = select.options[select.selectedIndex].textContent
      }
    }

    importer.dialog
      .open({
        template: container,
        className: `${this.id} importer dark`,
        accept: translate('Choose this dataset'),
        cancel: false,
      })
      .then(confirm)
  }
}
