import { DomUtil, DomEvent } from '../../vendors/leaflet/leaflet-src.esm.js'
import { translate } from './i18n.js'

export class Panel {
  MODE = 'condensed'
  CLASSNAME = 'left'

  constructor(map) {
    this.parent = map._container
    this.map = map
    this.container = DomUtil.create('div', '', this.parent)
    DomEvent.disableClickPropagation(this.container)
    DomEvent.on(this.container, 'contextmenu', DomEvent.stopPropagation) // Do not activate our custom context menu.
    DomEvent.on(this.container, 'wheel', DomEvent.stopPropagation)
    DomEvent.on(this.container, 'MozMousePixelScroll', DomEvent.stopPropagation)
  }

  open(e) {
    this.container.className = `with-transition panel ${this.CLASSNAME} ${this.MODE}`
    this.container.innerHTML = ''
    const actionsContainer = DomUtil.create('ul', 'toolbox', this.container)
    const body = DomUtil.create('div', 'body', this.container)
    if (e.data.html.nodeType && e.data.html.nodeType === 1)
      body.appendChild(e.data.html)
    else body.innerHTML = e.data.html
    const closeLink = DomUtil.create('li', 'umap-close-link', actionsContainer)
    DomUtil.add('i', 'icon icon-16 icon-close', closeLink)
    closeLink.title = translate('Close')
    const resizeLink = DomUtil.create('li', 'umap-resize-link', actionsContainer)
    DomUtil.add('i', 'icon icon-16 icon-resize', resizeLink)
    resizeLink.title = translate('Toggle size')
    if (e.actions) {
      for (let i = 0; i < e.actions.length; i++) {
        actionsContainer.appendChild(e.actions[i])
      }
    }
    if (e.className) DomUtil.addClass(body, e.className)
    const promise = new Promise((resolve, reject) => {
      DomUtil.addClass(this.container, 'on')
      resolve()
    })
    DomEvent.on(closeLink, 'click', this.close, this)
    DomEvent.on(resizeLink, 'click', this.resize, this)
    return promise
  }

  resize() {
    if (this.MODE === 'expanded') {
      this.MODE = 'condensed'
      this.container.classList.remove('expanded')
      this.container.classList.add('condensed')
    } else {
      this.MODE = 'expanded'
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
  CLASSNAME = 'right dark'
}

export class FullPanel extends Panel {
  CLASSNAME = 'full dark'
  MODE = 'expanded'
}
