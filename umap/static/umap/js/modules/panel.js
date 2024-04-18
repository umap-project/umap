import { DomUtil, DomEvent } from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'

export class Panel {
  constructor(map) {
    this.parent = map._controlContainer
    this.map = map
    this.container = DomUtil.create('div', '', this.parent)
    this.mode = 'condensed'
    this.classname = 'left'
    DomEvent.disableClickPropagation(this.container)
    DomEvent.on(this.container, 'contextmenu', DomEvent.stopPropagation) // Do not activate our custom context menu.
    DomEvent.on(this.container, 'wheel', DomEvent.stopPropagation)
    DomEvent.on(this.container, 'MozMousePixelScroll', DomEvent.stopPropagation)
  }

  open({ content, className, actions = [] } = {}) {
    this.container.className = `with-transition panel ${this.classname} ${this.mode}`
    this.container.innerHTML = ''
    const actionsContainer = DomUtil.create('ul', 'toolbox', this.container)
    const body = DomUtil.create('div', 'body', this.container)
    body.appendChild(content)
    const closeLink = DomUtil.create('li', 'umap-close-link', actionsContainer)
    DomUtil.add('i', 'icon icon-16 icon-close', closeLink)
    closeLink.title = translate('Close')
    const resizeLink = DomUtil.create('li', 'umap-resize-link', actionsContainer)
    DomUtil.add('i', 'icon icon-16 icon-resize', resizeLink)
    resizeLink.title = translate('Toggle size')
    for (let action of actions) {
      actionsContainer.appendChild(action)
    }
    if (className) DomUtil.addClass(body, className)
    const promise = new Promise((resolve, reject) => {
      DomUtil.addClass(this.container, 'on')
      resolve()
    })
    DomEvent.on(closeLink, 'click', this.close, this)
    DomEvent.on(resizeLink, 'click', this.resize, this)
    return promise
  }

  resize() {
    if (this.mode === 'expanded') {
      this.mode = 'condensed'
      this.container.classList.remove('expanded')
      this.container.classList.add('condensed')
    } else {
      this.mode = 'expanded'
      this.container.classList.remove('condensed')
      this.container.classList.add('expanded')
    }
  }

  close() {
    if (DomUtil.hasClass(this.container, 'on')) {
      DomUtil.removeClass(this.container, 'on')
      this.map.invalidateSize({ pan: false })
      this.map.editedFeature = null
    }
  }
}

export class EditPanel extends Panel {
  constructor(map) {
    super(map)
    this.classname = 'right dark'
  }
}

export class FullPanel extends Panel {
  constructor(map) {
    super(map)
    this.classname = 'full dark'
    this.mode = 'expanded'
  }
}
