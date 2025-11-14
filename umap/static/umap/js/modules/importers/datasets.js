import { translate } from '../i18n.js'
import * as DOMUtils from '../domutils.js'

export class Importer {
  constructor(map, options) {
    this.name = options.name || 'Datasets'
    this.choices = options?.choices
    this.id = 'datasets'
  }

  async open(importer) {
    const [container, { select }] = DOMUtils.loadTemplateWithRefs(`
      <div class="formbox">
        <h3>${this.name}</h3>
        <select data-ref="select">
          <option value="">${translate('Choose a dataset')}</option>
        </select>
      </div>
    `)

    for (const dataset of this.choices) {
      const option = DOMUtils.loadTemplate(
        `<option value="${dataset.url}" data-format="${dataset.format || 'geojson'}">${dataset.label}</option>`
      )
      select.appendChild(option)
    }
    const confirm = () => {
      if (select.value) {
        importer.url = select.value
        importer.format = select.options[select.selectedIndex].dataset.format
        importer.layerName = select.options[select.selectedIndex].textContent
      }
    }

    importer.dialog
      .open({
        template: container,
        className: `${this.id} importer dark`,
        accept: translate('Choose this dataset'),
        cancel: false,
      })
      .then(confirm)
  }
}
