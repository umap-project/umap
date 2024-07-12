import { loadTemplate } from '../utils.js'

export default class ContextMenu {
  constructor(options = {}) {
    this.options = options
    this.container = document.createElement('ul')
    this.container.className = 'umap-contextmenu'
    if (options.className) {
      this.container.classList.add(options.className)
    }
    this.container.addEventListener('focusout', (event) => {
      if (!this.container.contains(event.relatedTarget)) this.close()
    })
  }

  open([x, y], items) {
    this.container.innerHTML = ''
    for (const item of items) {
      const li = loadTemplate(
        `<li class="${item.className || ''}"><button tabindex="0" class="flat">${item.label}</button></li>`
      )
      li.addEventListener('click', () => {
        this.close()
        item.action()
      })
      this.container.appendChild(li)
    }
    document.body.appendChild(this.container)
    this.setPosition([x, y], this.container)
    this.container.querySelector('button').focus()
    this.container.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        this.close()
      }
    })
  }

  setPosition([x, y], element) {
    if (x < window.innerWidth / 2) {
      this.container.style.left = `${x}px`
    } else {
      this.container.style.left = `${x - element.offsetWidth}px`
    }
    if (y < window.innerHeight / 2) {
      this.container.style.top = `${y}px`
    } else {
      this.container.style.top = `${y - element.offsetHeight}px`
    }
  }

  close() {
    try {
      this.container.remove()
    } catch {
      // Race condition in Chrome: the focusout close has "half" removed the node
      // So it's still visible in the DOM, but we calling .remove on it (or parentNode.removeChild)
      // will crash.
    }
  }
}
