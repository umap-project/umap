import { DomEvent, DomUtil } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../i18n.js'

export class Dialog {
  constructor() {
    this.className = 'umap-dialog window'
    this.container = DomUtil.create('dialog', this.className, document.body)
    DomEvent.disableClickPropagation(this.container)
    DomEvent.on(this.container, 'contextmenu', DomEvent.stopPropagation) // Do not activate our custom context menu.
    DomEvent.on(this.container, 'wheel', DomEvent.stopPropagation)
    DomEvent.on(this.container, 'MozMousePixelScroll', DomEvent.stopPropagation)
  }

  get visible() {
    return this.container.open
  }

  close() {
    this.container.close()
  }

  currentZIndex() {
    return Math.max(
      ...Array.from(document.querySelectorAll('dialog')).map(
        (el) => window.getComputedStyle(el).getPropertyValue('z-index') || 0
      )
    )
  }

  open({ className, content, modal } = {}) {
    this.container.innerHTML = ''
    const currentZIndex = this.currentZIndex()
    if (currentZIndex) this.container.style.zIndex = currentZIndex + 1
    if (modal) this.container.showModal()
    else this.container.show()
    if (className) {
      // Reset
      this.container.className = this.className
      this.container.classList.add(...className.split(' '))
    }
    const buttonsContainer = DomUtil.create('ul', 'buttons', this.container)
    const closeButton = DomUtil.createButtonIcon(
      DomUtil.create('li', '', buttonsContainer),
      'icon-close',
      translate('Close')
    )
    DomEvent.on(closeButton, 'click', this.close, this)
    this.container.appendChild(buttonsContainer)
    this.container.appendChild(content)
    DomEvent.once(this.container, 'keydown', (e) => {
      DomEvent.stop(e)
      if (e.key === 'Escape') this.close()
    })
  }
}

const PROMPT = `
<form>
  <h3></h3>
  <input type="text" name="prompt" />
  <input type="submit" value="${translate('Ok')}" />
</form>
`

export class Prompt extends Dialog {
  get input() {
    return this.container.querySelector('input[name="prompt"]')
  }

  get title() {
    return this.container.querySelector('h3')
  }

  get form() {
    return this.container.querySelector('form')
  }

  open({ className, title } = {}) {
    const content = DomUtil.element({ tagName: 'div', safeHTML: PROMPT })
    super.open({ className, content })
    this.title.textContent = title
    const promise = new Promise((resolve, reject) => {
      DomEvent.on(this.form, 'submit', (e) => {
        DomEvent.stop(e)
        resolve(this.input.value)
        this.close()
      })
    })
    return promise
  }
}
