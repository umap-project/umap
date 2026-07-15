import { translate } from './i18n.js'
import * as Utils from './utils.js'

export default class Printer {
  constructor(app) {
    this.app = app
    this.dialog = this.app.dialog
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
    const container = this.app.mapProxy.container
    for (const name of Array.from(container.classList)) {
      if (name.startsWith('print-')) {
        container.classList.remove(name)
      }
    }
    container.removeAttribute('style')
    this.app.fire('map:resize')
  }

  resizeMap() {
    const form = this.dialog.collectFormData()
    this.resetSize()
    const container = this.app.mapProxy.container
    if (form.format && form.mode) {
      container.classList.add(`print-${form.format}`)
      container.classList.add(`print-${form.mode}`)
      container.style.width = `${form.scale}%`
      this.app.fire('map:resize')
    }
  }

  open(action = 'print') {
    if (!this.container) this.build()
    this.action = action
    const acceptLabel = action === 'print' ? translate('Print') : translate('Download')
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
      .open({ template: this.container, cancel: false, accept: acceptLabel })
      .then((form) => this.onSubmit(form))
    this.resizeMap()
  }

  async onSubmit(form) {
    this.app.fire('dataloading', { id: 'screenshot' })
    if (this.action === 'print') {
      const win = window.open('', '_blank')
      // Using document.body.appendChild here will end with black font
      // on a black blackground, no idea why.
      win.document.write(`<span>${translate('Preparing the print…')}</span>`)
      // screenshot must be called after window.open, no idea why,
      // otherwise window.open sometimes fails and returns null.
      const screenshot = await this.app.screenshot()
      const img = await screenshot.toPng()
      img.addEventListener('load', () => {
        win.print()
        win.close()
      })
      win.document.querySelector('span').remove()
      win.document.body.appendChild(img)
      win.focus()
    } else {
      const screenshot = await this.app.screenshot()
      await screenshot.download({
        format: this.action,
        filename: Utils.slugify(this.app.properties.name),
      })
    }
    this.resetSize()
    this.app.fire('dataload', { id: 'screenshot' })
  }
}
