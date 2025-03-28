import { DomUtil } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { BaseAjax, SingleMixin } from '../autocomplete.js'
import * as Util from '../utils.js'

export class AutocompleteCommunes extends SingleMixin(BaseAjax) {
  createResult(item) {
    return super.createResult({
      value: item.code,
      label: `${item.nom} (${item.code})`,
    })
  }

  buildUrl(value) {
    let url = this.url
    let options = { q: encodeURIComponent(value) }
    const re = /^(0[1-9]|[1-9][ABab\d])\d{3}$/gm
    if (re.test(value)) {
      url = 'https://geo.api.gouv.fr/communes?code={code}&limit=5'
      options = { code: encodeURIComponent(value) }
    }
    return Util.template(url, options)
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
      placeholder: 'Nom ou code INSEE…',
      url: 'https://geo.api.gouv.fr/communes?nom={q}&limit=5',
      on_select: (choice) => {
        importer.url = `https://geo.api.gouv.fr/communes?code=${choice.item.value}&format=geojson&geometry=contour`
        importer.format = 'geojson'
        importer.layerName = choice.item.label
        importer.dialog.close()
      },
    }
    this.autocomplete = new AutocompleteCommunes(container, options)

    importer.dialog.open({
      template: container,
      className: `${this.id} importer dark`,
      cancel: false,
      accept: false,
    })
  }
}
