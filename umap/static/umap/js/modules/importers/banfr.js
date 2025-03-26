import { DomUtil } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import { BaseAjax, SingleMixin } from '../autocomplete.js'
import { translate } from '../i18n.js'
import * as Utils from '../utils.js'
import { AutocompleteCommunes } from './communesfr.js'

const TEMPLATE = `
  <div>
  <h3>Géocodage d’adresses en France</h3>
  <p>Géocoder un fichier CSV avec la base adresse nationale.</p>
  <fieldset class="formbox">
    <legend>Choisir un fichier CSV (encodé en UTF-8)</legend>
    <input type=file name=file data-ref=csvFile accept=".csv" />
  </fieldset>
  <fieldset class="formbox">
    <legend>Aperçu des données</legend>
    <table class="table-scrollable" data-ref=table></table>
  </fieldset>
  <fieldset class="formbox">
    <legend>Sélectionner les colonnes à utiliser</legend>
    <span data-ref="columns"></span>
  </fieldset>
  </div>
`

export class Importer {
  constructor(umap, options) {
    this._umap = umap
    this.name = options.name || 'Géocodage FR'
    this.id = 'banfr'
  }

  async open(importer) {
    let data
    const [container, { table, columns, csvFile }] =
      Utils.loadTemplateWithRefs(TEMPLATE)
    csvFile.addEventListener('change', () => {
      const reader = new FileReader()
      reader.onload = (evt) => {
        data = evt.target.result
        const rows = csv2geojson.auto(data).slice(0, 5)
        const cols = Object.keys(rows[0])
        table.innerHTML = ''
        columns.innerHTML = ''
        const tr = document.createElement('tr')
        for (const column of cols) {
          tr.appendChild(Utils.loadTemplate(`<th>${column}</th>`))
          columns.appendChild(
            Utils.loadTemplate(
              `<label><input type="checkbox" value="${column}" /> ${column}</label>`
            )
          )
        }
        table.appendChild(tr)
        for (const row of rows) {
          const tr = document.createElement('tr')
          for (const column of cols) {
            tr.appendChild(Utils.loadTemplate(`<td>${row[column]}</td>`))
          }
          table.appendChild(tr)
        }
      }
      reader.readAsText(csvFile.files[0])
    })

    const confirm = async (form) => {
      const formData = new FormData()
      formData.append('data', csvFile.files[0])
      for (const option of columns.querySelectorAll('input:checked')) {
        formData.append('columns', option.value)
      }
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
