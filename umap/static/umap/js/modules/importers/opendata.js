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
    name: 'Auverge-Rhône-Alpes',
    url: 'https://admin.open-datara.fr',
    platform: 'prodige',
  },
  {
    name: 'Bordeaux Métropole',
    url: 'https://opendata.bordeaux-metropole.fr',
    platform: 'opendatasoft',
  },
  {
    name: 'Nouvelle Aquitaine',
    url: 'https://admin.sigena.fr',
    platform: 'prodige',
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
    name: 'Martinique',
    url: 'https://admin.geomartinique.fr',
    platform: 'prodige',
  },
  {
    name: 'Région Pays de la Loire',
    url: 'https://admin.sigloire.fr',
    platform: 'prodige',
  },
  {
    name: 'Saint-Pierre et Miquelon',
    url: 'https://admin.geospm.com',
    platform: 'prodige',
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
      <label data-ref="in_bbox" hidden><input type="checkbox" name="in_bbox">${translate('Limit results to current map view')}</label>
    </div>
  </div>
`

class Connector {
  constructor(umap, baseUrl) {
    this.umap = umap
    this.baseUrl = baseUrl
  }
}

class Prodige extends Connector {
  async datasets() {
    const datasets = []
    const endpoint = this.umap.proxyUrl(
      `${this.baseUrl}/api/ogc-features/collections.json`,
      3600
    )
    const response = await this.umap.request.get(endpoint)
    if (!response?.ok) return datasets
    const data = await response.json()
    for (const dataset of data.collections) {
      let url
      for (const link of dataset.links) {
        if (link.type === 'application/geo+json') url = link.href
      }
      if (!url) continue
      datasets.push({
        label: dataset.title,
        url: this.umap.proxyUrl(url, 3600),
      })
    }
    return datasets.sort((a, b) => Utils.naturalSort(a.label, b.label, U.lang))
  }
}

class OpenDataSoft extends Connector {
  async datasets() {
    let results = []
    let total = null
    const hardLimit = 500
    while (total === null || results.length < total) {
      const offset = results.length
      const response = await this.umap.request.get(
        `${this.baseUrl}/api/explore/v2.1/catalog/datasets?where=features%20in%20%28%22geo%22%29&limit=100&offset=${offset}&order_by=title asc`
      )
      if (!response?.ok) break
      const data = await response.json()
      if (total === null) {
        total = data.total_count
      }
      results = results.concat(data.results)
      if (total === null || results.length > hardLimit) break
    }
    const datasets = []
    for (const result of results) {
      const fields = result.fields.filter((field) => field.type === 'geo_point_2d')
      if (!fields.length) {
        console.debug('No geofield found for', result)
        continue
      }
      if (fields.length > 1) {
        console.debug('More than one geofield found for', result)
      }
      const url = `${this.baseUrl}/api/explore/v2.1/catalog/datasets/${result.dataset_id}/exports/geojson?select=%2A&limit=-1&timezone=UTC&use_labels=false&epsg=4326`
      const bbox_url = `${url}&where=in_bbox%28${fields[0].name}%2C%20{south},{west},{north},{east}%29`
      datasets.push({
        id: result.dataset_id,
        label: `${result.metas.default.title} (${result.metas.default.records_count})`,
        url,
        bbox_url,
      })
    }
    return datasets
  }
}

export class Importer {
  constructor(umap, options = {}) {
    this.umap = umap
    this.name = options.name || 'Open Data'
    this.id = 'opendata'
    this.portals = options.choices || PORTALS
  }

  resetSelect(select) {
    Array.from(select.children).forEach((option) => {
      if (!option.disabled) {
        option.remove()
      } else {
        option.selected = true
      }
    })
  }

  async open(importer) {
    const [container, { portals, datasets, in_bbox }] =
      Utils.loadTemplateWithRefs(TEMPLATE)
    datasets.addEventListener('change', (event) => {
      const select = event.target
      const selected = select.options[select.selectedIndex]
      const bbox_url = selected.dataset.bbox_url
      in_bbox.checked = false
      in_bbox.hidden = !bbox_url
    })
    portals.addEventListener('change', async (event) => {
      const select = event.target
      const selected = select.options[select.selectedIndex]
      const platform = selected.dataset.platform
      let connector
      if (platform === 'opendatasoft') {
        connector = new OpenDataSoft(this.umap, selected.value)
      } else if (platform === 'prodige') {
        connector = new Prodige(this.umap, selected.value)
      } else {
        console.error('Unknown platform', platform)
        return
      }
      const results = await connector.datasets(event.target.value)
      if (results) {
        this.resetSelect(datasets)
        for (const result of results) {
          const el = Utils.loadTemplate(
            `<option value="${result.url}" data-url="${result.url}" data-bbox_url="${result.bbox_url || ''}">${result.label}</option>`
          )
          datasets.appendChild(el)
        }
        datasets.hidden = false
      }
    })
    for (const instance of this.portals) {
      const el = Utils.loadTemplate(
        `<option value="${instance.url}" data-platform="${instance.platform}">${instance.name}</option>`
      )
      portals.appendChild(el)
    }

    const confirm = (form) => {
      if (!form.instance) {
        Alert.error(translate('Please choose an instance first.'))
        return
      }
      let url = form.dataset
      if (form.in_bbox) {
        const selected = datasets.options[datasets.selectedIndex]
        url = selected.dataset.bbox_url
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
