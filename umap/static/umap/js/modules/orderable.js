export default class Orderable {
  constructor(parent, onDrop) {
    this.parent = parent
    this.onCommit = onDrop
    this.src = null
    this.dst = null
    for (const node of this.parent.querySelectorAll('.orderable')) {
      this.makeDraggable(node)
    }
  }

  makeDraggable(node) {
    node.draggable = true
    node.addEventListener('dragstart', (event) => this.onDragStart(event))
    node.addEventListener('dragenter', (event) => this.onDragEnter(event))
    node.addEventListener('dragover', (event) => this.onDragOver(event))
    node.addEventListener('dragleave', (event) => this.onDragLeave(event))
    node.addEventListener('drop', (event) => this.onDrop(event))
    node.addEventListener('dragend', (event) => this.onDragEnd(event))
  }

  nodeIndex(node) {
    return Array.prototype.indexOf.call(this.parent.children, node)
  }

  findTarget(node) {
    while (node) {
      if (node.classList.contains('orderable')) return node
      node = node.parentNode
    }
  }

  resetCSS(el) {
    el.classList.remove('target-above')
    el.classList.remove('target-middle')
    el.classList.remove('target-below')
  }

  onDragStart(event) {
    // event.target is the source nodevent.
    const realSrc = document.elementFromPoint(event.clientX, event.clientY)
    // Only allow drag from the handle
    if (!realSrc.classList.contains('icon-drag')) {
      event.preventDefault()
      return
    }
    this.src = event.target
    if (!this.src) return
    this.initialIndex = this.nodeIndex(this.src)
    this.src.classList.add('ordering')
  }

  onDragOver(event) {
    event.stopPropagation()
    event.preventDefault() // Necessary. Allows us to drop.
    event.dataTransfer.dropEffect = 'move'
    const dst = this.findTarget(event.target)
    if (!dst || dst === this.src) return false
    this.pointerY = event.clientY
    this.dst = dst
    const top = dst.getBoundingClientRect().top
    const bottom = dst.getBoundingClientRect().bottom
    const height = bottom - top
    const third = height / 3
    if (this.pointerY < top + third) {
      this.dragMode = 'above'
    } else if (this.pointerY > bottom - third) {
      this.dragMode = 'below'
    } else {
      this.dragMode = 'middle'
    }
    this.resetCSS(dst)
    dst.classList.add(`target-${this.dragMode}`)
    this.src.classList.remove('drageffect')

    window.setTimeout(() => {
      if (this.pointerY !== event.clientY) return
      this.src.classList.add('drageffect')
      const parentNode = dst.parentNode
      if (this.dragMode === 'above') {
        parentNode.insertBefore(this.src, this.dst)
      } else if (this.dragMode === 'below') {
        if (this.dst.nextSibling) {
          parentNode.insertBefore(this.src, this.dst.nextSibling)
        } else {
          parentNode.appendChild(this.src)
        }
      } else if (this.dragMode === 'middle') {
        const container = this.dst.querySelector('.orderable-container')
        if (container) {
          container.appendChild(this.src)
        }
      }
    }, 500)
    return false
  }

  onDragEnter(event) {
    event.stopPropagation()
    event.preventDefault()
  }

  onDragLeave(event) {
    // event.target is previous target element.
    const dst = this.findTarget(event.target)
    if (dst) this.resetCSS(dst)
  }

  onDrop(event) {
    // event.target is current target element.
    if (event.stopPropagation) event.stopPropagation() // Stops the browser from redirecting.
    if (!this.dst) return
    this.resetCSS(this.dst)
    this.onCommit(
      this.src,
      this.dst,
      this.initialIndex,
      this.nodeIndex(this.src),
      this.dragMode
    )
    return false
  }

  onDragEnd(event) {
    // event.target is the source node.
    this.src.classList.remove('ordering')
  }
}
