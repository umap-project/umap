import { DomUtil } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { BaseAjax, SingleMixin } from '../autocomplete.js'

class Autocomplete extends SingleMixin(BaseAjax) {
  createResult(item) {
    return super.createResult({
      value: item.code,
      label: `${item.nom} (${item.code})`,
    })
  }
}

export class Importer {
  constructor(map, options) {
    this.name = options.name || 'Communes'
    this.id = 'communesfr'
  }

  async open(importer) {
    const container = DomUtil.create('div')
    DomUtil.createTitle(container, this.name)
    DomUtil.element({
      tagName: 'p',
      parent: container,
      textContent: "Importer les contours d'une commune française.",
    })
    const options = {
      placeholder: 'Commune…',
      url: 'https://geo.api.gouv.fr/communes?nom={q}&limit=5',
      on_select: (choice) => {
        importer.url = `https://geo.api.gouv.fr/communes?code=${choice.item.value}&format=geojson&geometry=contour`
        importer.format = 'geojson'
        importer.layerName = choice.item.label
        importer.dialog.close()
      },
    }
    this.autocomplete = new Autocomplete(container, options)

    importer.dialog.open({
      content: container,
      className: `${this.id} importer dark`,
    })
  }
}
