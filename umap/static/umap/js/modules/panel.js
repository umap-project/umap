export class Panel {
  MODE = 'condensed'
  CLASSNAME = 'left'

  constructor(parent) {
    this.parent = parent
    this.container = L.DomUtil.create('div', '', this.parent)
    L.DomEvent.disableClickPropagation(this.container)
    L.DomEvent.on(this.container, 'contextmenu', L.DomEvent.stopPropagation) // Do not activate our custom context menu.
    L.DomEvent.on(this.container, 'wheel', L.DomEvent.stopPropagation)
    L.DomEvent.on(this.container, 'MozMousePixelScroll', L.DomEvent.stopPropagation)
  }

  resetClassName() {
    this.container.className = `with-transition panel ${this.CLASSNAME} ${this.MODE}`
  }

  open(e) {
    //this.fire('panel:open')
    // We reset all because we can't know which class has been added
    // by previous ui processes...
    this.resetClassName()
    this.container.innerHTML = ''
    const actionsContainer = L.DomUtil.create('ul', 'toolbox', this.container)
    const body = L.DomUtil.create('div', 'body', this.container)
    if (e.data.html.nodeType && e.data.html.nodeType === 1)
      body.appendChild(e.data.html)
    else body.innerHTML = e.data.html
    const closeLink = L.DomUtil.create('li', 'umap-close-link', actionsContainer)
    L.DomUtil.add('i', 'icon icon-16 icon-close', closeLink)
    closeLink.title = L._('Close')
    const resizeLink = L.DomUtil.create('li', 'umap-resize-link', actionsContainer)
    L.DomUtil.add('i', 'icon icon-16 icon-resize', resizeLink)
    resizeLink.title = L._('Toggle size')
    if (e.actions) {
      for (let i = 0; i < e.actions.length; i++) {
        actionsContainer.appendChild(e.actions[i])
      }
    }
    if (e.className) L.DomUtil.addClass(this.container, e.className)
    if (L.DomUtil.hasClass(this.container, 'on')) {
      // Already open.
      //this.fire('panel:ready')
    } else {
      L.DomEvent.once(
        this.container,
        'transitionend',
        function (e) {
          //this.fire('panel:ready')
        },
        this
      )
      L.DomUtil.addClass(this.container, 'on')
    }
    L.DomEvent.on(closeLink, 'click', this.close, this)
    L.DomEvent.on(resizeLink, 'click', this.resize, this)
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
    if (L.DomUtil.hasClass(this.container, 'on')) {
      L.DomUtil.removeClass(this.container, 'on')
      //this.fire('panel:closed')
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
