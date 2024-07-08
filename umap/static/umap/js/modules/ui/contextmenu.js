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
        item.action()
      })
      this.container.appendChild(li)
    }
    document.body.appendChild(this.container)
    this.container.style.top = `${y}px`
    this.container.style.left = `${x}px`
    this.container.querySelector('button').focus()
    this.container.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        this.close()
      }
    })
  }

  close() {
    this.container.parentNode.removeChild(this.container)
  }
}
