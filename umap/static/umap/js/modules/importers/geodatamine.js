import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import { BaseAjax, SingleMixin } from '../autocomplete.js'
import { translate } from '../i18n.js'
import * as Utils from '../utils.js'
import * as DOMUtils from '../domutils.js'

const BOUNDARY_TYPES = {
  admin_6: 'département',
  admin_7: 'pays (loi Voynet)',
  admin_8: 'commune',
  admin_9: 'quartier, hameau, arrondissement',
  political: 'canton',
  local_authority: 'EPCI',
}

const TEMPLATE = `
  <div>
    <h3>GeoDataMine</h3>
    <p>${translate('GeoDataMine: thematic data from OpenStreetMap')}.</p>
    <div class="formbox">
      <select name="theme" data-ref="select">
        <option value="">${translate('Choose a theme')}</option>
      </select>
      <label>
        <input type="checkbox" name="aspoint" />
        ${translate('Simplify all geometries to points')}
      </label>
      <label id="boundary">
      </label>
    </div>
  </div>
`

class Autocomplete extends SingleMixin(BaseAjax) {
  createResult(item) {
    return super.createResult({
      value: item.id,
      label: `${item.name} (${BOUNDARY_TYPES[item.type]} — ${item.ref})`,
    })
  }
}

export class Importer {
  constructor(umap, options = {}) {
    this.umap = umap
    this.name = options.name || 'GeoDataMine'
    this.baseUrl = options?.url || 'https://geodatamine.fr'
    this.id = 'geodatamine'
  }

  async open(importer) {
    let boundary = null
    let boundaryName = null
    const [container, { select }] = DOMUtils.loadTemplateWithRefs(TEMPLATE)
    const response = await this.umap.request.get(`${this.baseUrl}/themes`)
    if (response?.ok) {
      const { themes } = await response.json()
      themes.sort((a, b) => Utils.naturalSort(a['name:fr'], b['name:fr']))
      for (const theme of themes) {
        const option = DOMUtils.loadTemplate(
          `<option value="${theme.id}">${theme['name:fr']}</option>`
        )
        select.appendChild(option)
      }
    } else {
      console.error(response)
    }
    this.autocomplete = new Autocomplete(container.querySelector('#boundary'), {
      placeholder: translate('Search admin boundary'),
      url: `${this.baseUrl}/boundaries/search?text={q}`,
      on_select: (choice) => {
        boundary = choice.item.value
        boundaryName = choice.item.label
      },
    })
    const confirm = (form) => {
      if (!boundary || !select.value) {
        Alert.error(translate('Please choose a theme and a boundary first.'))
        return
      }
      importer.url = `${this.baseUrl}/data/${form.theme}/${boundary}?format=geojson&aspoint=${Boolean(form.aspoint)}`
      importer.format = 'geojson'
      importer.layerName = `${boundaryName} — ${select.options[select.selectedIndex].textContent}`
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
