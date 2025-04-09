import { DomUtil } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import { BaseAjax, SingleMixin } from '../autocomplete.js'
import { translate } from '../i18n.js'
import * as Util from '../utils.js'
import { AutocompleteCommunes } from './communesfr.js'

const TEMPLATE = `
  <h3>Cadastre</h3>
  <p>Importer les données cadastrales d’une commune française.</p>
  <div class="formbox">
    <select name="theme">
      <option value="batiments">Bâtiments</option>
      <option value="communes">Communes</option>
      <option value="feuilles">Feuilles</option>
      <option value="lieux_dits">Lieux dits</option>
      <option value="parcelles" selected>Parcelles</option>
      <option value="prefixes_sections">Préfixes sections</option>
      <option value="sections">Sections</option>
      <option value="subdivisions_fiscales">Subdivisions fiscales</option>
    </select>
    <label id="boundary">
    </label>
  </div>
`

export class Importer {
  constructor(map, options) {
    this.name = options.name || 'Cadastre'
    this.id = 'cadastrefr'
  }

  async open(importer) {
    let boundary = null
    let boundaryName = null
    const container = DomUtil.create('div')
    container.innerHTML = TEMPLATE
    const select = container.querySelector('select')
    const options = {
      placeholder: 'Nom ou code INSEE…',
      url: 'https://geo.api.gouv.fr/communes?nom={q}&limit=5',
      on_select: (choice) => {
        boundary = choice.item.value
        boundaryName = choice.item.label
      },
    }
    this.autocomplete = new AutocompleteCommunes(container, options)

    const confirm = (form) => {
      if (!boundary || !form.theme) {
        Alert.error(translate('Please choose a theme and a boundary first.'))
        return
      }
      importer.url = `https://cadastre.data.gouv.fr/bundler/cadastre-etalab/communes/${boundary}/geojson/${form.theme}`
      importer.format = 'geojson'
      importer.layerName = `${boundaryName} — ${select.options[select.selectedIndex].textContent}`
    }

    importer.dialog
      .open({
        template: container,
        className: `${this.id} importer dark`,
        cancel: false,
        accept: translate('Choose this data'),
      })
      .then(confirm)
  }
}
