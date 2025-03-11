import { DomUtil } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { BaseAjax, SingleMixin } from '../autocomplete.js'
import * as Utils from '../utils.js'
import { AutocompleteCommunes } from './communesfr.js'
import { translate } from '../i18n.js'
import { uMapAlert as Alert } from '../../components/alerts/alert.js'

const TEMPLATE = `
  <h3>Adresses</h3>
  <p>Géocoder un fichier CSV avec la base adresse nationale.</p>
  <fieldset>
    <legend>${translate('Choose a file')}</legend>
    <input type=file name=file />
  </fieldset>
  <fieldset>
    <legend>${translate('Preview')}</legend>
    <table></table>
  </fieldset>
  <fieldset>
    <legend>${translate('Colonnes')}</legend>
    <select multiple=multiple></select>
  </fieldset>
  </label>
`

export class Importer {
  constructor(umap, options) {
    this._umap = umap
    this.name = options.name || 'Adresses'
    this.id = 'banfr'
  }

  async open(importer) {
    let data
    const container = DomUtil.create('div')
    container.innerHTML = TEMPLATE
    const table = container.querySelector('table')
    const select = container.querySelector('select')
    const input = container.querySelector('input')
    input.addEventListener('change', () => {
      const reader = new FileReader()
      reader.onload = (evt) => {
        data = evt.target.result
        const rows = csv2geojson.auto(data).slice(0, 10)
        const columns = Object.keys(rows[0])
        table.innerHTML = ''
        select.innerHTML = ''
        const tr = document.createElement('tr')
        for (const column of columns) {
          tr.appendChild(Utils.loadTemplate(`<th>${column}</th>`))
          select.appendChild(
            Utils.loadTemplate(`<option value="${column}">${column}</option>`)
          )
        }
        table.appendChild(tr)
        for (const row of rows) {
          const tr = document.createElement('tr')
          for (const column of columns) {
            tr.appendChild(Utils.loadTemplate(`<td>${row[column]}</td>`))
          }
          table.appendChild(tr)
        }
      }
      reader.readAsText(input.files[0])
    })

    const confirm = async (form) => {
      const formData = new FormData()
      formData.append('data', input.files[0])
      for (const option of select.selectedOptions) {
        formData.append('columns', option.value)
      }
      console.log(formData)
      const response = await this._umap.request.post(
        'https://api-adresse.data.gouv.fr/search/csv/',
        {},
        formData
      )
      if (response?.ok) {
        importer.raw = await response.text()
        importer.format = 'csv'
      }
    }

    importer.dialog
      .open({
        template: container,
        className: `${this.id} importer dark`,
        cancel: false,
        accept: translate('Geocode'),
      })
      .then(confirm)
  }
}
