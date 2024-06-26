import { DomEvent } from '../../vendors/leaflet/leaflet-src.esm.js'

export default class Orderable {
  constructor(parent, onDrop, selector = '.orderable') {
    this.parent = parent
    this.onCommit = onDrop
    this.src = null
    this.dst = null
    this.els = this.parent.querySelectorAll(selector)
    for (let i = 0; i < this.els.length; i++) this.makeDraggable(this.els[i])
  }

  makeDraggable(node) {
    node.draggable = true
    DomEvent.on(node, 'dragstart', this.onDragStart, this)
    DomEvent.on(node, 'dragenter', this.onDragEnter, this)
    DomEvent.on(node, 'dragover', this.onDragOver, this)
    DomEvent.on(node, 'dragleave', this.onDragLeave, this)
    DomEvent.on(node, 'drop', this.onDrop, this)
    DomEvent.on(node, 'dragend', this.onDragEnd, this)
  }

  nodeIndex(node) {
    return Array.prototype.indexOf.call(this.parent.children, node)
  }

  findTarget(node) {
    while (node) {
      if (this.nodeIndex(node) !== -1) return node
      node = node.parentNode
    }
  }

  onDragStart(e) {
    // e.target is the source node.
    const realSrc = document.elementFromPoint(e.clientX, e.clientY)
    // Only allow drag from the handle
    if (!realSrc.classList.contains('icon-drag')) {
      e.preventDefault()
      return
    }
    this.src = e.target
    this.initialIndex = this.nodeIndex(this.src)
    this.src.classList.add('ordering')
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', this.src.innerHTML)
  }

  onDragOver(e) {
    DomEvent.stop(e)
    if (e.preventDefault) e.preventDefault() // Necessary. Allows us to drop.
    e.dataTransfer.dropEffect = 'move'
    return false
  }

  onDragEnter(e) {
    DomEvent.stop(e)
    // e.target is the current hover target.
    const dst = this.findTarget(e.target)
    if (!dst || dst === this.src) return
    this.dst = dst
    const targetIndex = this.nodeIndex(this.dst)
    const srcIndex = this.nodeIndex(this.src)
    if (targetIndex > srcIndex) this.parent.insertBefore(this.dst, this.src)
    else this.parent.insertBefore(this.src, this.dst)
  }

  onDragLeave(e) {
    // e.target is previous target element.
  }

  onDrop(e) {
    // e.target is current target element.
    if (e.stopPropagation) e.stopPropagation() // Stops the browser from redirecting.
    if (!this.dst) return
    this.onCommit(this.src, this.dst, this.initialIndex, this.nodeIndex(this.src))
    return false
  }

  onDragEnd(e) {
    // e.target is the source node.
    this.src.classList.remove('ordering')
  }
}
