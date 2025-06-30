import { uMapAlert as Alert } from '../components/alerts/alert.js'
import { translate } from './i18n.js'
import * as Utils from './utils.js'

const TEMPLATE = `
  <div>
    <form data-ref="form">
      <h3><i class="icon icon-24 icon-template"></i>${translate('Load map template')}</h3>
      <p>${translate('Loading a template will apply predefined styles and settings to your map')}.</p>
      <div class="formbox">
        <div class="flat-tabs" data-ref="tabs">
          <button type="button" class="flat" data-value="mine" data-ref="mine">${translate('My templates')}</button>
          <button type="button" class="flat" data-value="staff">${translate('From staff')}</button>
          <button type="button" class="flat" data-value="community">${translate('From community')}</button>
        </div>
        <div data-ref="body" class="body"></div>
        <div class="button-bar half">
          <button type="button" class="primary" data-ref="confirm" disabled>${translate('Load template')}</button>
          <button type="button" data-ref="confirmData" disabled>${translate('Load template with data')}</button>
        </div>
      </div>
    </form>
  </div>
`

export default class TemplateImporter {
  constructor(umap) {
    this.umap = umap
  }

  async open() {
    const [root, { tabs, form, body, mine, confirm, confirmData }] =
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
        if (!data.templates.length) {
          let message
          switch (source) {
            case 'mine':
              message = translate(
                'You have no registered template yet. You can add one by creating a new map and flagging it as "template".'
              )
              break
            case 'staff':
              message = translate(
                'There is no recommended template yet. Recommended templates are the ones starred by uMap administrators.'
              )
              break
            case 'community':
              message = translate('There is no public template yet.')
              break
          }
          body.textContent = message
          return
        }
        const ul = Utils.loadTemplate('<ul></ul>')
        body.appendChild(ul)
        for (const template of data.templates) {
          const item = Utils.loadTemplate(
            `<li>
                <label>
                  <input type="radio" value="${template.id}" name="template" />${template.name}
                  <a href="${template.url}" target="_blank"><nobr>${translate('Explore')}<i class="icon icon-16 icon-external-link"></i></nobr></a>
                </label>
              </li>
            `
          )
          ul.appendChild(item)
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
        confirmData.disabled = false
      }
    })
    const onConfirm = (includeData) => {
      const templateId = form.template.value
      if (!templateId) {
        Alert.error(translate('You must select a template.'))
        return false
      }
      let url = this.umap.urls.get('map_download', {
        map_id: templateId,
      })
      if (!includeData) {
        url = `${url}?include_data=0`
      }
      this.umap.importer.build()
      this.umap.importer.url = url
      this.umap.importer.format = 'umap'
      this.umap.importer.submit()
      this.umap.editPanel.close()
    }
    confirm.addEventListener('click', () => onConfirm(false))
    confirmData.addEventListener('click', () => onConfirm(true))

    this.umap.editPanel.open({
      content: root,
      highlight: 'templates',
    })
  }
}
