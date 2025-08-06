import { loadTemplate, loadTemplateWithRefs } from '../utils.js'
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
    if (options.orientation === 'rows') {
      this.container.classList.add('umap-contextmenu-rows')
    }
    this.container.addEventListener('focusout', (event) => {
      if (!this.container.contains(event.relatedTarget)) this.close()
    })
  }

  open(event, items) {
    const left = event.clientX
    const top = event.clientY
    this.openAt([left, top], items)
  }

  openBelow(element, items) {
    const coords = this.getPosition(element)
    this.openAt([coords.left, coords.bottom], items)
  }

  addItems(items, container) {
    for (const item of items) {
      if (item === '-') {
        container.appendChild(document.createElement('hr'))
      } else if (item.items) {
        const [li, { bar }] = loadTemplateWithRefs(
          `<li class="dark"><ul data-ref=bar class="icon-bar"></ul></li>`
        )
        this.addItems(item.items, bar)
        container.appendChild(li)
      } else if (typeof item.action === 'string') {
        const li = loadTemplate(
          `<li class="${item.className || ''}"><a tabindex="0" href="${item.action}">${item.label}</a></li>`
        )
        container.appendChild(li)
      } else {
        let content = item.label || ''
        if (item.icon) {
          content = `<i class="icon icon-16 ${item.icon}"></i>${content}`
        }
        const li = loadTemplate(
          `<li class="${item.className || ''}"><button tabindex="0" class="flat" title="${item.title || ''}">${content}</button></li>`
        )
        li.firstChild.addEventListener('click', () => {
          this.close()
          item.action()
        })
        container.appendChild(li)
      }
    }
  }

  openAt([left, top], items) {
    this.container.innerHTML = ''
    this.addItems(items, this.container)
    // When adding contextmenu below the map container, clicking on any link will send the
    // "focusout" element on link click, preventing to trigger the click action
    const parent = document
      .elementFromPoint(left, top)
      .closest('.leaflet-container').parentNode
    parent.appendChild(this.container)
    if (this.options.fixed) {
      this.setPosition({ left, top })
    } else {
      this.computePosition([left, top])
    }
    this.container.querySelector('button, a').focus()
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
