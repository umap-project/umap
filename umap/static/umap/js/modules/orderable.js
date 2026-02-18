export default class Orderable {
  constructor(parent, onDrop, properties) {
    this.properties = Object.assign({}, properties)
    this.parent = parent
    this.onCommit = onDrop
    this.moved = null
    this.target = null
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
      if (node.classList.contains('orderable')) {
        if (!this.parent.contains(node)) return null
        return node
      }
      node = node.parentNode
    }
  }

  resetCSS(el) {
    el.classList.remove('target-above')
    el.classList.remove('target-middle')
    el.classList.remove('target-below')
    el.classList.remove('target-not-allowed')
  }

  onDragStart(event) {
    // event.target is the source nodevent.
    const handle = document.elementFromPoint(event.clientX, event.clientY)
    // Only allow drag from the handle
    if (!handle.classList.contains('icon-drag')) {
      event.preventDefault()
      return
    }
    this.moved = event.target
    if (!this.moved) return
    this.initialIndex = this.nodeIndex(this.moved)
    this.moved.classList.add('ordering')
    this.dropped = false
  }

  onDragOver(event) {
    event.stopPropagation()
    event.preventDefault() // Necessary. Allows us to drop.
    event.dataTransfer.dropEffect = 'move'
    const target = this.findTarget(event.target)
    if (
      !target ||
      !this.moved ||
      target === this.moved ||
      this.moved.contains(target)
    ) {
      return false
    }
    this.pointerY = event.clientY
    this.target = target
    const top = target.getBoundingClientRect().top
    const bottom = target.getBoundingClientRect().bottom
    const height = bottom - top
    const third = height / 3
    this.dragMode = undefined
    if (this.pointerY < top + third) {
      this.dragMode = 'above'
    } else if (this.pointerY > bottom - third) {
      this.dragMode = 'below'
    } else if (!this.target.classList.contains('no-children')) {
      if (this.properties.allowTree) {
        this.dragMode = 'middle'
      }
    } else {
      this.dragMode = 'not-allowed'
    }
    this.resetCSS(target)
    target.classList.add(`target-${this.dragMode}`)
    if (this.dragMode === 'not-allowed') return
    this.moved.classList.remove('drageffect')

    this.timeout = window.setTimeout(() => {
      if (this.pointerY !== event.clientY) return
      this.timeout = null
      if (this.dropped) return
      this.moved.classList.add('drageffect')
      const parentNode = target.parentNode
      if (this.dragMode === 'above') {
        parentNode.insertBefore(this.moved, this.target)
      } else if (this.dragMode === 'below') {
        if (this.target.nextSibling) {
          parentNode.insertBefore(this.moved, this.target.nextSibling)
        } else {
          parentNode.appendChild(this.moved)
        }
      } else if (this.dragMode === 'middle') {
        const container = this.target.querySelector('.orderable-container')
        if (container) {
          container.appendChild(this.moved)
        }
      }
    }, 200)
    return false
  }

  onDragEnter(event) {
    event.stopPropagation()
    event.preventDefault()
  }

  onDragLeave(event) {
    // event.target is previous target element.
    const target = this.findTarget(event.target)
    if (target) this.resetCSS(target)
  }

  onDrop(event) {
    // event.target is current target element.
    if (event.stopPropagation) event.stopPropagation() // Stops the browser from redirecting.
    if (!this.target) return
    this.resetCSS(this.target)
    // User dropped before DOM feedback, so we think they do not want the move to proceed.
    this.dropped = true
    if (!this.timeout) {
      this.onCommit(this.moved, this.target, this.dragMode)
    }
    return false
  }

  onDragEnd(event) {
    // event.target is the source node.
    this.moved.classList.remove('ordering')
  }
}
