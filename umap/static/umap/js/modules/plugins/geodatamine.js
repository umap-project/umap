import { DomUtil, DomEvent, stamp } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../i18n.js'
import { AjaxAutocomplete } from '../autocomplete.js'
import { Request } from '../request.js'
import Alert from '../ui/alert.js'
import Dialog from '../ui/dialog.js'

class Autocomplete extends AjaxAutocomplete {
  constructor(request, el, options) {
    super(el, options)
    this.request = request
  }

  createResult(item) {
    return super.createResult({
      value: item.id,
      label: `${item.name} (${item.ref})`,
    })
  }

  async search() {
    let val = this.input.value
    if (val.length < this.options.minChar) {
      this.clear()
      return
    }
    if (`${val}` === `${this.cache}`) return
    else this.cache = val
    val = val.toLowerCase()
    const response = await this.request.get(
      `https://geodatamine.fr/boundaries/search?text=${encodeURIComponent(val)}`
    )
    if (response && response.ok) {
      const data = await response.json()
      this.handleResults(data)
    }
  }
}

export class Plugin {
  constructor(map) {
    this.map = map
    this.name = 'GeoDataMine'
    this.baseUrl = 'https://geodatamine.fr'
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
    const response = await this.request.get(`${this.baseUrl}/themes`)
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
    const options = {
      className: 'edit-owner',
      on_select: (choice) => this.onSelect(choice),
    }
    this.autocomplete = new Autocomplete(this.request, container, options)
    const confirm = () => {
      importer.urlInput.value = `${this.baseUrl}/data/${select.value}/${this.options.boundary}?format=geojson`
      importer.typeInput.value = 'geojson'
      this.dialog.close()
    }
    L.DomUtil.createButton('', container, 'OK', confirm)

    this.dialog.open({
      content: container,
      className: 'geodatamine dark',
    })
  }

  onSelect(choice) {
    this.options.boundary = choice.item.value
  }
}
