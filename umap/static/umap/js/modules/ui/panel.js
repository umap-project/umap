import { DomEvent, DomUtil } from '../../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from '../i18n.js'

export class Panel {
  constructor(umap, leafletMap) {
    this.parent = leafletMap._controlContainer
    this._umap = umap
    this._leafletMap = leafletMap
    this.container = DomUtil.create('div', '', this.parent)
    // This will be set once according to the panel configurated at load
    // or by using panels as popups
    this.mode = null
    this.className = 'left'
    DomEvent.disableClickPropagation(this.container)
    DomEvent.on(this.container, 'contextmenu', DomEvent.stopPropagation) // Do not activate our custom context menu.
    DomEvent.on(this.container, 'wheel', DomEvent.stopPropagation)
    DomEvent.on(this.container, 'MozMousePixelScroll', DomEvent.stopPropagation)
  }

  setDefaultMode(mode) {
    if (!this.mode) this.mode = mode
  }

  isOpen() {
    return this.container.classList.contains('on')
  }

  open({ content, className, highlight, actions = [] } = {}) {
    if (this.isOpen()) {
      this.onClose()
    }
    this.container.className = `with-transition panel window ${this.className} ${
      this.mode || ''
    }`
    if (highlight) {
      this.container.dataset.highlight = highlight
    }
    document.body.classList.add(`panel-${this.className.split(' ')[0]}-on`)
    this.container.innerHTML = ''
    const actionsContainer = DomUtil.create('ul', 'buttons', this.container)
    const body = DomUtil.create('div', 'body', this.container)
    body.appendChild(content)
    const closeButton = DomUtil.createButtonIcon(
      DomUtil.create('li', '', actionsContainer),
      'icon-close',
      translate('Close')
    )
    const resizeButton = DomUtil.createButtonIcon(
      DomUtil.create('li', '', actionsContainer),
      'icon-resize',
      translate('Toggle size')
    )
    for (const action of actions) {
      const element = DomUtil.element({ tagName: 'li', parent: actionsContainer })
      element.appendChild(action)
    }
    if (className) DomUtil.addClass(body, className)
    const promise = new Promise((resolve, reject) => {
      DomUtil.addClass(this.container, 'on')
      resolve(this)
    })
    DomEvent.on(closeButton, 'click', this.close, this)
    DomEvent.on(resizeButton, 'click', this.resize, this)
    return promise
  }

  resize() {
    if (this.mode === 'condensed') {
      this.mode = 'expanded'
      this.container.classList.remove('condensed')
      this.container.classList.add('expanded')
    } else {
      this.mode = 'condensed'
      this.container.classList.remove('expanded')
      this.container.classList.add('condensed')
    }
  }

  close() {
    document.body.classList.remove(`panel-${this.className.split(' ')[0]}-on`)
    this.container.dataset.highlight = null
    this.onClose()
  }

  onClose() {
    if (DomUtil.hasClass(this.container, 'on')) {
      DomUtil.removeClass(this.container, 'on')
      this._leafletMap.invalidateSize({ pan: false })
    }
  }
  scrollTo(selector) {
    const fieldset = this.container.querySelector(selector)
    if (!fieldset) return
    fieldset.open = true
    const { top, left } = fieldset.getBoundingClientRect()
    this.container.scrollTo(left, top)
  }
}

export class EditPanel extends Panel {
  constructor(umap, leafletMap) {
    super(umap, leafletMap)
    this.className = 'right dark'
  }

  onClose() {
    super.onClose()
    this._umap.editedFeature = null
  }
}

export class FullPanel extends Panel {
  constructor(umap, leafletMap) {
    super(umap, leafletMap)
    this.className = 'full dark'
    this.mode = 'expanded'
  }
}
