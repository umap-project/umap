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

  onDragStart(event) {
    // event.target is the source nodevent.
    const realSrc = document.elementFromPoint(event.clientX, event.clientY)
    // Only allow drag from the handle
    if (!realSrc.classList.contains('icon-drag')) {
      event.preventDefault()
      return
    }
    this.src = event.target
    this.initialIndex = this.nodeIndex(this.src)
    this.src.classList.add('ordering')
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/html', this.src.innerHTML)
  }

  onDragOver(event) {
    event.stopPropagation()
    event.preventDefault() // Necessary. Allows us to drop.
    event.dataTransfer.dropEffect = 'move'
    return false
  }

  onDragEnter(event) {
    event.stopPropagation()
    event.preventDefault()
    // event.target is the current hover target.
    const dst = this.findTarget(event.target)
    if (!dst || dst === this.src) return
    this.dst = dst
    const targetIndex = this.nodeIndex(this.dst)
    const srcIndex = this.nodeIndex(this.src)
    const parentNode = this.dst.parentNode
    if (targetIndex > srcIndex) {
      if (this.dst.nextSibling) {
        parentNode.insertBefore(this.src, this.dst.nextSibling)
      } else {
        parentNode.appendChild(this.src)
      }
    } else {
      parentNode.insertBefore(this.src, this.dst)
    }
  }

  onDragLeave(event) {
    // event.target is previous target element.
  }

  onDrop(event) {
    // event.target is current target element.
    if (event.stopPropagation) event.stopPropagation() // Stops the browser from redirecting.
    if (!this.dst) return
    this.onCommit(this.src, this.dst, this.initialIndex, this.nodeIndex(this.src))
    return false
  }

  onDragEnd(event) {
    // event.target is the source node.
    this.src.classList.remove('ordering')
  }
}
