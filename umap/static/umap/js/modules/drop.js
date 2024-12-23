export default class DropControl {
  constructor(umap, leafletMap, dropzone) {
    this._umap = umap
    this._leafletMap = leafletMap
    this.dropzone = dropzone
  }

  enable() {
    this.controller = new AbortController()
    this.dropzone.addEventListener('dragenter', (e) => this.dragenter(e), {
      signal: this.controller.signal,
    })
    this.dropzone.addEventListener('dragover', (e) => this.dragover(e), {
      signal: this.controller.signal,
    })
    this.dropzone.addEventListener('drop', (e) => this.drop(e), {
      signal: this.controller.signal,
    })
    this.dropzone.addEventListener('dragleave', (e) => this.dragleave(e), {
      signal: this.controller.signal,
    })
  }

  disable() {
    this.controller.abort()
  }

  dragenter(event) {
    event.stopPropagation()
    event.preventDefault()
    this._leafletMap.scrollWheelZoom.disable()
    this.dropzone.classList.add('umap-dragover')
  }

  dragover(event) {
    event.stopPropagation()
    event.preventDefault()
  }

  drop(event) {
    this._leafletMap.scrollWheelZoom.enable()
    this.dropzone.classList.remove('umap-dragover')
    event.stopPropagation()
    event.preventDefault()
    const importer = this._umap.importer
    importer.build()
    importer.files = event.dataTransfer.files
    importer.submit()
  }

  dragleave() {
    this._leafletMap.scrollWheelZoom.enable()
    this.dropzone.classList.remove('umap-dragover')
  }
}
