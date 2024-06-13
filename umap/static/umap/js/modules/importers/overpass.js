import { DomUtil } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { BaseAjax, SingleMixin } from '../autocomplete.js'
import { translate } from '../i18n.js'
import { uMapAlert as Alert } from '../../components/alerts/alert.js'

const TEMPLATE = `
  <h3>Overpass</h3>
  <label>
    <span data-help="overpassImporter">${translate('Expression')}</span>
    <input type="text" placeholder="amenity=drinking_water" name="tags" />
  </label>
  <label>
    ${translate('Geometry mode')}
    <select name="out-mode">
      <option value="geom" selected>${translate('Default')}</option>
      <option value="center">${translate('Only geometry centers')}</option>
    </select>
  </label>
  <label id="area"><span>${translate('Search area')}</span></label>
`

class Autocomplete extends SingleMixin(BaseAjax) {
  handleResults(data) {
    return super.handleResults(data.features)
  }

  createResult(item) {
    return super.createResult({
      // Overpass convention to get their id from an osm one.
      value: item.properties.osm_id + 3600000000,
      label: `${item.properties.name}`,
    })
  }
}

export class Importer {
  constructor(map, options) {
    this.map = map
    this.name = options.name || 'Overpass'
    this.baseUrl = options?.url || 'https://overpass-api.de/api/interpreter'
    this.id = 'overpass'
  }

  async open(importer) {
    let boundary = null
    let boundaryName = null
    const container = DomUtil.create('div')
    container.innerHTML = TEMPLATE
    this.autocomplete = new Autocomplete(container.querySelector('#area'), {
      url: 'https://photon.komoot.io/api?q={q}&osm_tag=place',
      placeholder: translate(
        'Type area name, or let empty to load data in current map view'
      ),
      on_select: (choice) => {
        boundary = choice.item.value
        boundaryName = choice.item.label
      },
    })
    this.map.help.parse(container)

    const confirm = () => {
      let tags = container.querySelector('[name=tags]').value
      if (!tags) {
        Alert.error(translate('Please define an expression for the query first'))
        return
      }
      const outMode = container.querySelector('[name=out-mode]').value
      if (!tags.startsWith('[')) tags = `[${tags}]`
      let area = '{south},{west},{north},{east}'
      if (boundary) area = `area:${boundary}`
      let query = `[out:json];nwr${tags}(${area});out ${outMode};`
      importer.url = `${this.baseUrl}?data=${query}`
      if (boundary) importer.layerName = boundaryName
      importer.format = 'osm'
      importer.dialog.close()
    }
    L.DomUtil.createButton('', container, translate('Choose this data'), confirm)

    importer.dialog.open({
      content: container,
      className: `${this.id} importer dark`,
    })
  }
}
