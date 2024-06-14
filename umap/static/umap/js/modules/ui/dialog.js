import { DomUtil, DomEvent } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../i18n.js'

export default class Dialog {
  constructor(parent) {
    this.parent = parent
    this.className = 'umap-dialog window'
    this.container = DomUtil.create('dialog', this.className, this.parent)
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
  }
}
