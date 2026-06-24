import { loadTemplate } from '../domutils.js'

export default class Loader {
  constructor(parent) {
    this.parent = parent
    this.element = loadTemplate('<div class="umap-loader"></div>')
    this.parent.appendChild(this.element)
    document.body.addEventListener('dataloading', (event) =>
      this.start(event.detail.id)
    )
    document.body.addEventListener('dataload', (event) => this.stop(event.detail.id))
    this._counter = new Set()
  }

  start(id) {
    this._counter.add(id)
    this.parent.classList.add('umap-loading')
  }

  stop(id) {
    this._counter.delete(id)
    if (!this._counter.size) {
      this.parent.classList.remove('umap-loading')
    }
  }
}
