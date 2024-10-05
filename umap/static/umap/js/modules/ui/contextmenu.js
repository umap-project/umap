import { loadTemplate } from '../utils.js'
import { Positioned } from './base.js'

export default class ContextMenu extends Positioned {
  constructor(options = {}) {
    super()
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

  open([left, top], items) {
    this.container.innerHTML = ''
    for (const item of items) {
      if (item === '-') {
        this.container.appendChild(document.createElement('hr'))
      } else if (typeof item.action === 'string') {
        const li = loadTemplate(
          `<li class="${item.className || ''}"><a tabindex="0" href="${item.action}">${item.label}</a></li>`
        )
        this.container.appendChild(li)
      } else {
        const li = loadTemplate(
          `<li class="${item.className || ''}"><button tabindex="0" class="flat">${item.label}</button></li>`
        )
        li.addEventListener('click', () => {
          this.close()
          item.action()
        })
        this.container.appendChild(li)
      }
    }
    document.body.appendChild(this.container)
    if (this.options.fixed) {
      this.setPosition({ left, top })
    } else {
      this.computePosition([left, top])
    }
    this.container.querySelector('li > *').focus()
    this.container.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          this.close()
        }
      },
      { once: true }
    )
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
