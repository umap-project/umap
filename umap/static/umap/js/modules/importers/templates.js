import { DomEvent, DomUtil } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import { BaseAjax, SingleMixin } from '../autocomplete.js'
import { translate } from '../i18n.js'
import * as Utils from '../utils.js'

const BOUNDARY_TYPES = {
  admin_6: 'département',
  admin_7: 'pays (loi Voynet)',
  admin_8: 'commune',
  admin_9: 'quartier, hameau, arrondissement',
  political: 'canton',
  local_authority: 'EPCI',
}

const TEMPLATE = `
  <h3>${translate('Load template')}</h3>
  <p>${translate('GeoDataMine: thematic data from OpenStreetMap')}.</p>
  <div class="formbox">
    <select name="theme">
      <option value="">${translate('Choose a template')}</option>
    </select>
    <label>
      <input type="checkbox" name="include_data" />
      ${translate('Include template data, if any')}
    </label>
  </div>
`

export class Importer {
  constructor(umap, options = {}) {
    this.umap = umap
    this.name = options.name || 'Templates'
    this.id = 'templates'
  }

  async open(importer) {
    const container = DomUtil.create('div')
    container.innerHTML = TEMPLATE
    const select = container.querySelector('select')
    const uri = this.umap.urls.get('template_list')
    const [data, response, error] = await this.umap.server.get(uri)
    if (!error) {
      for (const template of data.templates) {
        DomUtil.element({
          tagName: 'option',
          value: template.id,
          textContent: template.name,
          parent: select,
        })
      }
    } else {
      console.error(response)
    }
    const confirm = (form) => {
      let url = this.umap.urls.get('map_download', {
        map_id: select.options[select.selectedIndex].value,
      })
      if (!container.querySelector('[name=include_data]').checked) {
        url = `${url}?include_data=0`
      }
      importer.url = url
      importer.format = 'umap'
      importer.submit()
      this.umap.editPanel.close()
    }

    importer.dialog
      .open({
        template: container,
        className: `${this.id} importer dark`,
        accept: translate('Use this template'),
        cancel: false,
      })
      .then(confirm)
  }
}
