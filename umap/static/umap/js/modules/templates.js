import { uMapAlert as Alert } from '../components/alerts/alert.js'
import { translate } from './i18n.js'
import * as Utils from './utils.js'

const TEMPLATE = `
  <div>
    <form data-ref="form">
      <h3><i class="icon icon-24 icon-template"></i>${translate('Load map template')}</h3>
      <p>${translate('Use a template to initialize your map')}.</p>
      <div class="formbox">
        <div class="flat-tabs" data-ref="tabs">
          <button type="button" class="flat" data-value="mine" data-ref="mine">${translate('My templates')}</button>
          <button type="button" class="flat" data-value="staff">${translate('From staff')}</button>
          <button type="button" class="flat" data-value="community">${translate('From community')}</button>
        </div>
        <div data-ref="body" class="body"></div>
        <label>
          <input type="checkbox" name="include_data" />
          ${translate('Include template data, if any')}
        </label>
        <button type="button" class="primary" data-ref="confirm" disabled>${translate('Load this template')}</button>
      </div>
    </form>
  </div>
`

export default class TemplateImporter {
  constructor(umap) {
    this.umap = umap
  }

  async open() {
    const [root, { tabs, form, include_data, body, mine, confirm }] =
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
              <dd>
                ${Utils.toHTML(template.description)}
                <a href="${template.url}" target="_blank">${translate('Open')}<i class="icon icon-16 icon-external-link"></i></a>
              </dd>
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
    form.addEventListener('change', () => {
      if (form.template.value) {
        confirm.disabled = false
      }
    })
    const onConfirm = () => {
      const templateId = form.template.value
      if (!templateId) {
        Alert.error(translate('You must select a template.'))
        return false
      }
      let url = this.umap.urls.get('map_download', {
        map_id: templateId,
      })
      if (!form.include_data.checked) {
        url = `${url}?include_data=0`
      }
      this.umap.importer.build()
      this.umap.importer.url = url
      this.umap.importer.format = 'umap'
      this.umap.importer.submit()
      this.umap.editPanel.close()
    }
    confirm.addEventListener('click', onConfirm)

    this.umap.editPanel.open({
      content: root,
      highlight: 'templates',
    })
  }
}
