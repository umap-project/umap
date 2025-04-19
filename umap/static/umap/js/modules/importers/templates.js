import { DomEvent, DomUtil } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { uMapAlert as Alert } from '../../components/alerts/alert.js'
import { BaseAjax, SingleMixin } from '../autocomplete.js'
import { translate } from '../i18n.js'
import * as Utils from '../utils.js'

const TEMPLATE = `
  <div>
    <h3>${translate('Load map template')}</h3>
    <p>${translate('Use a template to initialize your map')}.</p>
    <div class="formbox">
      <div class="flat-tabs" data-ref="tabs">
        <button type="button" class="flat" data-value="mine" data-ref="mine">${translate('My templates')}</button>
        <button type="button" class="flat" data-value="staff">${translate('Staff templates')}</button>
        <button type="button" class="flat" data-value="community">${translate('Community templates')}</button>
      </div>
      <div data-ref="body" class="body"></div>
      <label>
        <input type="checkbox" name="include_data" />
        ${translate('Include template data, if any')}
      </label>
    </div>
  </div>
`

export class Importer {
  constructor(umap, options = {}) {
    this.umap = umap
    this.name = options.name || 'Templates'
    this.id = 'templates'
  }

  async open(importer) {
    const [root, { tabs, include_data, body, mine }] =
      Utils.loadTemplateWithRefs(TEMPLATE)
    const uri = this.umap.urls.get('template_list')
    const userIsAuth = Boolean(this.umap.properties.user?.id)
    const defaultTab = userIsAuth ? 'mine' : 'staff'
    mine.hidden = !userIsAuth

    const loadTemplates = async (source) => {
      const [data, response, error] = await this.umap.server.get(
        `${uri}?source=${source}`
      )
      if (!error) {
        body.innerHTML = ''
        for (const template of data.templates) {
          const item = Utils.loadTemplate(
            `<dl>
              <dt><label><input type="radio" value="${template.id}" name="template" />${template.name}</label></dt>
              <dd>${template.description}&nbsp;<a href="${template.url}" target="_blank">${translate('Open')}</a></dd>
            </dl>`
          )
          body.appendChild(item)
        }
        tabs.querySelectorAll('button').forEach((el) => el.classList.remove('on'))
        tabs.querySelector(`[data-value="${source}"]`).classList.add('on')
      } else {
        console.error(response)
      }
    }
    loadTemplates(defaultTab)
    tabs
      .querySelectorAll('button')
      .forEach((el) =>
        el.addEventListener('click', () => loadTemplates(el.dataset.value))
      )
    const confirm = (form) => {
      console.log(form)
      if (!form.template) {
        Alert.error(translate('You must select a template.'))
        return false
      }
      let url = this.umap.urls.get('map_download', {
        map_id: form.template,
      })
      if (!form.include_data) {
        url = `${url}?include_data=0`
      }
      importer.url = url
      importer.format = 'umap'
      importer.submit()
      this.umap.editPanel.close()
    }

    importer.dialog
      .open({
        template: root,
        className: `${this.id} importer dark`,
        accept: translate('Use this template'),
        cancel: false,
      })
      .then(confirm)
  }
}
