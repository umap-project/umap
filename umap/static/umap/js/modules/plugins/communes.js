import { DomUtil, DomEvent, stamp } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../i18n.js'
import { BaseAjax, SingleMixin } from '../autocomplete.js'
import { Request } from '../request.js'
import Alert from '../ui/alert.js'
import Dialog from '../ui/dialog.js'

class Autocomplete extends SingleMixin(BaseAjax) {
  URL = 'https://geo.api.gouv.fr/communes?nom={q}&limit=5'

  createResult(item) {
    return super.createResult({
      value: item.code,
      label: `${item.nom} (${item.code})`,
    })
  }
}

export class Plugin {
  constructor(map) {
    this.map = map
    this.name = 'Communes'
    this.type = 'importer'
    this.dialog = new Dialog(this.map._controlContainer)
    this.map.registerPlugin(this)
    this.options = {
      theme: null,
      boundary: null,
      aspoint: false,
    }
    const alert = new Alert(document.querySelector('header'))
    this.request = new Request(alert)
  }

  addImporter() {
    return {
      name: this.name,
      callback: this.open,
    }
  }

  async open(importer) {
    const container = DomUtil.create('div')
    DomUtil.createTitle(container, this.name)
    const options = {
      on_select: (choice) => {
        this.options.boundary = choice.item.value
        importer.urlInput.value = `https://geo.api.gouv.fr/communes?code=${this.options.boundary}&format=geojson&geometry=contour`
        importer.typeInput.value = 'geojson'
        this.dialog.close()
      },
    }
    this.autocomplete = new Autocomplete(container, options)

    this.dialog.open({
      content: container,
      className: 'communes dark',
    })
  }
}
