import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import { translate } from '../i18n.js'
import * as Utils from '../utils.js'

const PORTALS = [
  {
    name: 'Aix-Marseille Métropole',
    url: 'https://data.ampmetropole.fr',
    platform: 'opendatasoft',
  },
  {
    name: 'Bordeaux Métropole',
    url: 'https://opendata.bordeaux-metropole.fr',
    platform: 'opendatasoft',
  },
  {
    name: 'Région Centre-Val de Loire',
    url: 'https://data.centrevaldeloire.fr',
    platform: 'opendatasoft',
  },
  {
    name: 'Ville de Clermont-Ferrand',
    url: 'https://opendata.clermont-ferrand.fr',
    platform: 'opendatasoft',
  },
  {
    name: 'Métropole de Dijon',
    url: 'https://data.metropole-dijon.fr',
    platform: 'opendatasoft',
  },
  {
    name: 'Région Île-de-France',
    url: 'https://data.iledefrance.fr',
    platform: 'opendatasoft',
  },
  {
    name: 'Toulouse Métropole',
    url: 'https://data.toulouse-metropole.fr',
    platform: 'opendatasoft',
  },
  {
    name: 'Tours Métropole Val de Loire',
    url: 'https://data.tours-metropole.fr/',
    platform: 'opendatasoft',
  },
]

const TEMPLATE = `
  <div>
    <h3>Open Data</h3>
    <p>${translate('Import data from public open data portals')}.</p>
    <div class="formbox">
      <select name="instance" data-ref="portals">
        <option disabled selected value="">${translate('Choose a portal')}</option>
      </select>
      <select name="dataset" hidden data-ref="datasets">
        <option disabled selected value="">${translate('Choose a dataset')}</option>
      </select>
      <input type="hidden" name="geofield" data-ref="geofield">
      <label><input type="checkbox" name="in_bbox">${translate('Limit results to current map view')}</label>
    </div>
  </div>
`

export class Importer {
  constructor(umap, options = {}) {
    this.umap = umap
    this.name = options.name || 'Open Data'
    this.id = 'opendata'
    this.portals = options.choices || PORTALS
  }

  async fetchDatasets(baseUrl) {
    let results = []
    let total = null
    const hardLimit = 500
    while (total === null || results.length < total) {
      const offset = results.length
      const response = await this.umap.request.get(
        `${baseUrl}/api/explore/v2.1/catalog/datasets?where=features%20in%20%28%22geo%22%29&limit=100&offset=${offset}&order_by=title asc`
      )
      if (!response.ok) break
      const data = await response.json()
      if (total === null) {
        total = data.total_count
      }
      results = results.concat(data.results)
      if (total === null || results.length > hardLimit) break
    }
    return results
  }

  async open(importer) {
    let fields_map = {}
    const [container, { portals, datasets, geofield }] =
      Utils.loadTemplateWithRefs(TEMPLATE)
    portals.addEventListener('change', async (event) => {
      const results = await this.fetchDatasets(event.target.value)
      if (results) {
        fields_map = {}
        Array.from(datasets.children).forEach((option) => {
          if (!option.disabled) {
            option.remove()
          } else {
            option.selected = true
          }
        })
        for (const result of results) {
          const fields = result.fields.filter((field) => field.type === 'geo_point_2d')
          if (!fields.length) {
            console.debug('No geofield found for', result)
            continue
          }
          if (fields.length > 1) {
            console.debug('More than one geofield found for', result)
          }
          fields_map[result.dataset_id] = fields[0].name
          const el = Utils.loadTemplate(
            `<option value="${result.dataset_id}">${result.metas.default.title} (${result.metas.default.records_count})</option>`
          )
          datasets.appendChild(el)
        }
        datasets.hidden = false
      }
    })
    datasets.addEventListener('change', (event) => {
      geofield.value = fields_map[event.target.value]
    })
    for (const instance of this.portals) {
      const el = Utils.loadTemplate(
        `<option value="${instance.url}">${instance.name}</option>`
      )
      portals.appendChild(el)
    }

    const confirm = (form) => {
      if (!form.instance) {
        Alert.error(translate('Please choose an instance first.'))
        return
      }
      let url = `${form.instance}/api/explore/v2.1/catalog/datasets/${form.dataset}/exports/geojson?select=%2A&limit=-1&timezone=UTC&use_labels=false&epsg=4326`
      if (form.in_bbox) {
        url += `&where=in_bbox%28${form.geofield}%2C%20{south},{west},{north},{east}%29`
      }
      importer.url = url
      importer.format = 'geojson'
      importer.layerName = datasets.options[datasets.selectedIndex].textContent
    }

    importer.dialog
      .open({
        template: container,
        className: `${this.id} importer dark`,
        accept: translate('Choose this data'),
        cancel: false,
      })
      .then(confirm)
  }
}
