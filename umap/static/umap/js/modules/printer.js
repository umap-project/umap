import { translate } from './i18n.js'
import * as Utils from './utils.js'

export default class Printer {
  constructor(umap) {
    this.umap = umap
    this.dialog = this.umap.dialog
  }

  build() {
    const [container, { format, mode }] = Utils.loadTemplateWithRefs(`
      <div>
        <h3>${translate('Print map')}</h3>
        <div class="formbox">
          <label>${translate('Choose a format')}
            <select name="format" data-ref="format">
              <option value="a4">A4</option>
              <option value="usletter">US Letter</option>
            </select>
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
  }

  resetSize() {
    const map = this.umap._leafletMap
    for (const name of Array.from(map._container.classList)) {
      if (name.startsWith('print-')) {
        map._container.classList.remove(name)
      }
    }
    map.invalidateSize()
  }

  resizeMap() {
    const form = this.dialog.collectFormData()
    this.resetSize()
    const map = this.umap._leafletMap
    if (form.format && form.mode) {
      map._container.classList.add(`print-${form.format}`)
      map._container.classList.add(`print-${form.mode}`)
      map.invalidateSize()
    }
  }

  open(action = 'print') {
    if (!this.container) this.build()
    this.action = action
    const acceptLabel = action === 'print' ? translate('Print') : translate('Download')
    this.dialog
      .open({ template: this.container, cancel: false, accept: acceptLabel })
      .then(
        (form) => this.onPrint(form),
        () => this.resetSize()
      )
    this.resizeMap()
  }

  async onPrint(form) {
    if (this.action === 'print') {
      const win = window.open('', '_blank')
      // screenshot be called after window.open, no idea why,
      // otherwise window.open sometimes fails and returns null.
      const screenshot = await this.umap.screenshot()
      const img = await screenshot.toPng()
      // TODO clean me
      img.setAttribute('onload', 'window.print();window.close()')
      win.document.write(img.outerHTML)
      win.focus()
    } else {
      const screenshot = await this.umap.screenshot()
      await screenshot.download({ format: this.action, filename: 'umap-screenshot' })
    }
    this.resetSize()
  }
}
