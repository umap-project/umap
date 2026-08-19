import { translate } from './i18n.js'
import * as Utils from './utils.js'

export default class Printer {
  constructor(app) {
    this.app = app
    this.dialog = this.app.dialog
    this.printElement = this.app.mapProxy.container.parentNode

  }

  build() {
    const [container, { format, mode, scale }] =
      Utils.loadTemplateWithRefs(Utils.sanitizeVars`
      <div>
        <h3>${translate('Print map')}</h3>
        <div class="formbox">
          <label>${translate('Choose a format')}
            <select name="format" data-ref="format">
              <option value="a4">A4</option>
              <option value="usletter">US Letter</option>
            </select>
          </label>
          <label>${translate('Scale map')}
            <input type="range" min="50" max="150" name="scale" data-ref="scale" />
          </label>
          <div class="umap-multiplechoice by2" data-ref="mode">
              <input type="radio" name="mode" id="mode.0" value="portrait"><label for="mode.0">${translate('portrait')}</label>
              <input type="radio" name="mode" id="mode.1" value="landscape" checked=""><label for="mode.1">${translate('landscape')}</label>
          </div>
        </div>
      </div>
    `)
    this.container = container
    format.addEventListener('change', () => this.resizeMap())
    mode.addEventListener('change', () => this.resizeMap())
    scale.addEventListener('change', () => this.resizeMap())
  }

  resetSize() {
    for (const name of Array.from(this.printElement.classList)) {
      if (name.startsWith('print-')) {
        this.printElement.classList.remove(name)
      }
    }
    this.printElement.removeAttribute('style')
    this.app.fire('map:resize')
  }

  resizeMap() {
    const form = this.dialog.collectFormData()
    this.resetSize()
    if (form.format && form.mode) {
      this.printElement.classList.add(`print-${form.format}`)
      this.printElement.classList.add(`print-${form.mode}`)
      this.printElement.style.width = `${form.scale}%`
      this.app.fire('map:resize')
    }
  }

  open() {
    if (!this.container) this.build()
    this.dialog.on(
      'close',
      (event) => {
        if (event.target.returnValue !== 'accept') {
          this.resetSize()
        }
      },
      { once: true }
    )
    this.dialog
      .open({ template: this.container, cancel: false, accept: translate('Print') })
      .then((form) => {
        window.print()
        this.resetSize()
      })
    this.resizeMap()
  }

}
