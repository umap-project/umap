import { DomUtil } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { BaseAjax, SingleMixin } from '../autocomplete.js'

class Autocomplete extends SingleMixin(BaseAjax) {
  URL = 'https://geodatamine.fr/boundaries/search?text={q}'

  createResult(item) {
    return super.createResult({
      value: item.id,
      label: `${item.name} (${item.ref})`,
    })
  }
}

export class Importer {
  constructor() {
    this.name = 'GeoDataMine'
    this.baseUrl = 'https://geodatamine.fr'
    this.options = {
      theme: null,
      boundary: null,
      aspoint: false,
    }
  }

  async open(importer) {
    const container = DomUtil.create('div')
    DomUtil.createTitle(container, this.name)
    const response = await importer.map.request.get(`${this.baseUrl}/themes`)
    const select = DomUtil.element({ tagName: 'select', parent: container })
    if (response && response.ok) {
      const { themes } = await response.json()
      for (const theme of themes) {
        DomUtil.element({
          tagName: 'option',
          value: theme.id,
          textContent: theme['name:fr'],
          parent: select,
        })
      }
    } else {
      console.error(response)
    }
    this.autocomplete = new Autocomplete(container, {
      on_select: (choice) => (this.options.boundary = choice.item.value),
    })
    const confirm = () => {
      importer.urlInput.value = `${this.baseUrl}/data/${select.value}/${this.options.boundary}?format=geojson`
      importer.typeInput.value = 'geojson'
      importer.dialog.close()
    }
    L.DomUtil.createButton('', container, 'OK', confirm)

    importer.dialog.open({
      content: container,
      className: 'geodatamine dark',
    })
  }
}
